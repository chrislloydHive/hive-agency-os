// lib/contextGraph/importers/brandLabImporter.ts
// Brand Lab Importer - imports data from Brand Lab and Brand Evidence into Context Graph
//
// Maps Brand Lab results and Brand Evidence to context graph fields:
// - Brand: positioning, toneOfVoice, brandStrengths, brandWeaknesses, differentiators
// - Identity: competitiveLandscape, primaryCompetitors

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { listDiagnosticRunsForCompany, type DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { setField, setDomainFields, createProvenance } from '../mutate';
import type { BrandEvidence } from '@/lib/gap-heavy/types';

/**
 * Brand Lab Importer
 *
 * Imports historical Brand Lab and Brand Evidence data into the context graph.
 * Uses the most recent completed run with brand data.
 */
export const brandLabImporter: DomainImporter = {
  id: 'brandLab',
  label: 'Brand Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      // Check Diagnostic Runs table first (primary source)
      const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'brandLab',
        limit: 5,
      });
      const hasDiagnosticBrandLab = diagnosticRuns.some(run =>
        run.status === 'complete' && run.rawJson
      );
      if (hasDiagnosticBrandLab) {
        console.log('[brandLabImporter] Found Brand Lab data in Diagnostic Runs');
        return true;
      }

      // Fall back to Heavy GAP Runs (legacy)
      const runs = await getHeavyGapRunsByCompanyId(companyId, 5);
      const hasBrandData = runs.some(run => {
        const status = run.status;
        const hasBrand = run.evidencePack?.brandLab || run.evidencePack?.brand;
        return (status === 'completed' || status === 'paused') && hasBrand;
      });

      return hasBrandData;
    } catch (error) {
      console.warn('[brandLabImporter] Error checking support:', error);
      return false;
    }
  },

  async importAll(
    graph: CompanyContextGraph,
    companyId: string,
    domain: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [],
      sourceRunIds: [],
    };

    try {
      // 1. Try Diagnostic Runs table first (primary source)
      const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
        toolId: 'brandLab',
        limit: 5,
      });
      const diagnosticBrandRun = diagnosticRuns.find(run =>
        run.status === 'complete' && run.rawJson
      );

      if (diagnosticBrandRun && diagnosticBrandRun.rawJson) {
        console.log('[brandLabImporter] Importing from Diagnostic Runs table');
        result.sourceRunIds.push(diagnosticBrandRun.id);

        const provenance = createProvenance('brand_lab', {
          confidence: 0.85,
          runId: diagnosticBrandRun.id,
          validForDays: 45,
        });

        const rawJson = diagnosticBrandRun.rawJson as any;
        const labImport = importFromDiagnosticBrandLab(graph, rawJson, provenance);
        result.fieldsUpdated += labImport.count;
        result.updatedPaths.push(...labImport.paths);

        if (result.fieldsUpdated > 0) {
          result.success = true;
          console.log(`[brandLabImporter] Imported ${result.fieldsUpdated} fields from Diagnostic Runs`);
          return result;
        }
      }

      // 2. Fall back to Heavy GAP Runs (legacy)
      const runs = await getHeavyGapRunsByCompanyId(companyId, 10);

      // Find the most recent run with brand data
      const runWithBrand = runs.find(run => {
        const status = run.status;
        return (status === 'completed' || status === 'paused') &&
               (run.evidencePack?.brandLab || run.evidencePack?.brand);
      });

      if (!runWithBrand) {
        if (result.fieldsUpdated === 0) {
          result.errors.push('No completed runs found with brand data');
        }
        return result;
      }

      result.sourceRunIds.push(runWithBrand.id);

      // Create provenance for brand lab source
      const provenance = createProvenance('brand_lab', {
        confidence: 0.85,
        runId: runWithBrand.id,
        validForDays: 45,
      });

      // Import from Brand Lab result if available
      if (runWithBrand.evidencePack?.brandLab) {
        const brandLab = runWithBrand.evidencePack.brandLab as any;
        const labImport = importFromBrandLab(graph, brandLab, provenance);
        result.fieldsUpdated += labImport.count;
        result.updatedPaths.push(...labImport.paths);
      }

      // Import from Brand Evidence if available
      if (runWithBrand.evidencePack?.brand) {
        const brandEvidence = runWithBrand.evidencePack.brand as BrandEvidence;
        const evidenceImport = importFromBrandEvidence(graph, brandEvidence, provenance);
        result.fieldsUpdated += evidenceImport.count;
        result.updatedPaths.push(...evidenceImport.paths);
      }

      result.success = result.fieldsUpdated > 0;
      console.log(`[brandLabImporter] Imported ${result.fieldsUpdated} fields from Heavy GAP Brand Lab/Evidence`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[brandLabImporter] Import error:', error);
    }

    return result;
  },
};

/**
 * Import data from Brand Lab result
 */
function importFromBrandLab(
  graph: CompanyContextGraph,
  brandLab: any,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Brand positioning
  if (brandLab.positioning) {
    setField(graph, 'brand', 'positioning', brandLab.positioning, provenance);
    paths.push('brand.positioning');
    count++;
  }

  // Brand clarity score as narrative
  if (brandLab.clarityScore !== undefined) {
    const narrative = `Brand clarity score: ${brandLab.clarityScore}/100. ${brandLab.claritySummary || ''}`;
    setField(graph, 'brand', 'brandPerception', narrative, provenance);
    paths.push('brand.brandPerception');
    count++;
  }

  // Differentiation analysis
  if (brandLab.differentiationScore !== undefined || brandLab.differentiators) {
    if (brandLab.differentiators && Array.isArray(brandLab.differentiators)) {
      setDomainFields(graph, 'brand', {
        differentiators: brandLab.differentiators,
      }, provenance);
      paths.push('brand.differentiators');
      count++;
    }
  }

  // Brand strengths
  if (brandLab.strengths && Array.isArray(brandLab.strengths)) {
    setDomainFields(graph, 'brand', {
      brandStrengths: brandLab.strengths,
    }, provenance);
    paths.push('brand.brandStrengths');
    count++;
  }

  // Brand weaknesses
  if (brandLab.weaknesses && Array.isArray(brandLab.weaknesses)) {
    setDomainFields(graph, 'brand', {
      brandWeaknesses: brandLab.weaknesses,
    }, provenance);
    paths.push('brand.brandWeaknesses');
    count++;
  }

  // Tone of voice
  if (brandLab.toneOfVoice) {
    setField(graph, 'brand', 'toneOfVoice', brandLab.toneOfVoice, provenance);
    paths.push('brand.toneOfVoice');
    count++;
  }

  // Messaging pillars
  if (brandLab.messagingPillars && Array.isArray(brandLab.messagingPillars)) {
    setDomainFields(graph, 'brand', {
      messagingPillars: brandLab.messagingPillars,
    }, provenance);
    paths.push('brand.messagingPillars');
    count++;
  }

  // Value propositions
  if (brandLab.valueProps && Array.isArray(brandLab.valueProps)) {
    setDomainFields(graph, 'brand', {
      valueProps: brandLab.valueProps,
    }, provenance);
    paths.push('brand.valueProps');
    count++;
  }

  // Competitive position
  if (brandLab.competitivePosition) {
    setField(graph, 'brand', 'competitivePosition', brandLab.competitivePosition, provenance);
    paths.push('brand.competitivePosition');
    count++;
  }

  return { count, paths };
}

/**
 * Import data from Brand Evidence
 */
function importFromBrandEvidence(
  graph: CompanyContextGraph,
  brand: BrandEvidence,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Value proposition summary
  if (brand.valuePropositionSummary && !graph.brand.positioning.value) {
    setField(graph, 'brand', 'positioning', brand.valuePropositionSummary, provenance);
    paths.push('brand.positioning');
    count++;
  }

  // Tone descriptors
  if (brand.toneDescriptors && brand.toneDescriptors.length > 0 && !graph.brand.toneOfVoice.value) {
    setField(graph, 'brand', 'toneOfVoice', brand.toneDescriptors.join(', '), provenance);
    paths.push('brand.toneOfVoice');
    count++;
  }

  // Primary tagline as tagline
  if (brand.primaryTagline) {
    setField(graph, 'brand', 'tagline', brand.primaryTagline, provenance);
    paths.push('brand.tagline');
    count++;
  }

  // Trust signals as brand strengths
  if (brand.trustSignalsExamples && brand.trustSignalsExamples.length > 0) {
    setDomainFields(graph, 'brand', {
      brandStrengths: brand.trustSignalsExamples,
    }, provenance);
    paths.push('brand.brandStrengths');
    count++;
  }

  // Brand archetype influences brand personality
  if (brand.brandArchetype && brand.brandArchetype !== 'unknown') {
    const archetypeMap: Record<string, string> = {
      innovator: 'Innovative and forward-thinking',
      trusted_guide: 'Trustworthy and guiding',
      challenger: 'Bold and disruptive',
      operator: 'Efficient and reliable',
      authority: 'Expert and authoritative',
    };
    const personality = archetypeMap[brand.brandArchetype] || brand.brandArchetype;
    setField(graph, 'brand', 'brandPersonality', personality, provenance);
    paths.push('brand.brandPersonality');
    count++;
  }

  // Competitor context
  if (brand.competitorBrandContext) {
    const competitors = brand.competitorBrandContext.competitors;
    if (competitors && competitors.length > 0) {
      // Add competitor names to identity domain
      const competitorNames = competitors.map(c => c.name);
      setDomainFields(graph, 'identity', {
        primaryCompetitors: competitorNames,
      }, provenance);
      paths.push('identity.primaryCompetitors');
      count++;

      // Add differentiation notes to competitive landscape
      if (brand.competitorBrandContext.differentiationNotes) {
        setField(graph, 'identity', 'competitiveLandscape',
          brand.competitorBrandContext.differentiationNotes, provenance);
        paths.push('identity.competitiveLandscape');
        count++;
      }
    }
  }

  // Competitor overlap notes
  if (brand.competitorOverlapNotes && !graph.identity.competitiveLandscape.value) {
    setField(graph, 'identity', 'competitiveLandscape', brand.competitorOverlapNotes, provenance);
    paths.push('identity.competitiveLandscape');
    count++;
  }

  return { count, paths };
}

/**
 * Import data from Diagnostic Runs Brand Lab rawJson
 * The unified Brand Lab format uses a dimensions-based structure
 */
function importFromDiagnosticBrandLab(
  graph: CompanyContextGraph,
  rawJson: any,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Helper to extract value from evidence strings like "Key: Value"
  const extractFromEvidence = (found: string[], prefix: string): string | undefined => {
    for (const item of found || []) {
      if (item.startsWith(prefix)) {
        // Handle quoted values: 'Positioning theme: "..."' -> extract inside quotes
        const quotedMatch = item.match(/"([^"]+)"/);
        if (quotedMatch) return quotedMatch[1];
        // Handle colon-separated: 'Key: Value' -> extract after colon
        const colonIndex = item.indexOf(':');
        if (colonIndex > 0) return item.substring(colonIndex + 1).trim();
      }
    }
    return undefined;
  };

  // Build dimension map for easy access
  const dimensions: Record<string, any> = {};
  if (rawJson.dimensions && Array.isArray(rawJson.dimensions)) {
    for (const dim of rawJson.dimensions) {
      dimensions[dim.key] = dim;
    }
  }

  // Extract positioning from the positioning dimension
  const positioningDim = dimensions['positioning'];
  if (positioningDim?.evidence?.found) {
    const positioning = extractFromEvidence(positioningDim.evidence.found, 'Positioning theme');
    if (positioning) {
      setField(graph, 'brand', 'positioning', positioning, provenance);
      paths.push('brand.positioning');
      count++;
    }

    const competitiveAngle = extractFromEvidence(positioningDim.evidence.found, 'Competitive angle');
    if (competitiveAngle) {
      setField(graph, 'brand', 'competitivePosition', competitiveAngle, provenance);
      paths.push('brand.competitivePosition');
      count++;
    }
  }

  // Extract differentiators from messaging dimension
  const messagingDim = dimensions['messaging'];
  if (messagingDim?.evidence?.found) {
    const diffString = extractFromEvidence(messagingDim.evidence.found, 'Differentiators');
    if (diffString) {
      // Split by comma and clean up
      const differentiators = diffString.split(',').map(d => d.trim()).filter(Boolean);
      if (differentiators.length > 0) {
        setDomainFields(graph, 'brand', { differentiators }, provenance);
        paths.push('brand.differentiators');
        count++;
      }
    }
  }

  // Extract identity info (tagline, core promise)
  const identityDim = dimensions['identity'];
  if (identityDim?.evidence?.found) {
    const tagline = extractFromEvidence(identityDim.evidence.found, 'Tagline detected');
    if (tagline) {
      setField(graph, 'brand', 'tagline', tagline, provenance);
      paths.push('brand.tagline');
      count++;
    }

    const corePromise = extractFromEvidence(identityDim.evidence.found, 'Core promise identified');
    if (corePromise && !graph.brand.positioning?.value) {
      setField(graph, 'brand', 'positioning', corePromise, provenance);
      paths.push('brand.positioning');
      count++;
    }
  }

  // Extract ICP from audienceFit dimension
  const audienceDim = dimensions['audienceFit'];
  if (audienceDim?.evidence?.found) {
    const icp = extractFromEvidence(audienceDim.evidence.found, 'Primary ICP');
    if (icp) {
      setField(graph, 'audience', 'icpDescription', icp, provenance);
      paths.push('audience.icpDescription');
      count++;
    }
  }

  // Extract trust archetype
  const trustDim = dimensions['trust'];
  if (trustDim?.evidence?.found) {
    const archetype = extractFromEvidence(trustDim.evidence.found, 'Trust archetype');
    if (archetype) {
      setField(graph, 'brand', 'brandPersonality', archetype, provenance);
      paths.push('brand.brandPersonality');
      count++;
    }
  }

  // Extract visual personality
  const visualDim = dimensions['visual'];
  if (visualDim?.evidence?.found) {
    const personality = extractFromEvidence(visualDim.evidence.found, 'Visual personality');
    if (personality) {
      setField(graph, 'brand', 'visualIdentitySummary', personality, provenance);
      paths.push('brand.visualIdentitySummary');
      count++;
    }
  }

  // Store narrative summary as brand perception
  if (rawJson.narrativeSummary) {
    setField(graph, 'brand', 'brandPerception', rawJson.narrativeSummary, provenance);
    paths.push('brand.brandPerception');
    count++;
  }

  // Collect brand issues as weaknesses
  if (rawJson.issues && rawJson.issues.length > 0) {
    const weaknesses = rawJson.issues
      .filter((i: any) => i.severity === 'high' || i.severity === 'medium')
      .map((i: any) => i.description || i.title)
      .filter(Boolean);
    if (weaknesses.length > 0) {
      setDomainFields(graph, 'brand', { brandWeaknesses: weaknesses }, provenance);
      paths.push('brand.brandWeaknesses');
      count++;
    }
  }

  return { count, paths };
}

export default brandLabImporter;
