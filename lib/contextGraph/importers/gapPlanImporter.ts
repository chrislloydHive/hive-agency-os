// lib/contextGraph/importers/gapPlanImporter.ts
// GAP Plan Importer - imports data from GAP Plan runs into Context Graph
//
// Imports structured data from GAP Plan runs including:
// - gapStructured.scores (website, content, seo, etc.)
// - gapStructured.maturityStage
// - gapStructured.kpisToWatch
// - insights (categorized findings)
//
// DOMAIN AUTHORITY:
// - GAP Plan is a secondary source (fills gaps only)
// - Never overwrites Lab-sourced data
// - Never overwrites human-confirmed fields
// - Lower confidence than Lab sources

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import { setField, setDomainFields, createProvenance } from '../mutate';
import { getTableName } from '@/lib/airtable/tables';

// ============================================================================
// Types for GAP Plan Data
// ============================================================================

interface GapPlanScores {
  overall?: number;
  brand?: number;
  content?: number;
  seo?: number;
  website?: number;
  authority?: number;
  digitalFootprint?: number;
  technical?: number;
}

interface GapPlanKpi {
  name: string;
  description?: string;
  whyItMatters?: string;
  whatGoodLooksLike?: string;
}

interface GapPlanInsight {
  id: string;
  companyId?: string;
  title: string;
  body: string;
  category: string; // brand, content, seo, website, etc.
  severity: 'low' | 'medium' | 'high' | 'critical';
  status?: string;
  source?: {
    type: string;
    toolSlug?: string;
    toolRunId?: string;
  };
  createdAt?: string;
}

interface GapPlanOffer {
  name: string;
  description?: string;
  targetAudience?: string;
  priceTier?: 'low' | 'mid' | 'high' | 'unknown';
}

interface GapPlanCompetitor {
  name: string;
  domain?: string;
  positioningNote?: string;
}

interface GapPlanAudienceSummary {
  icpDescription: string;
  keyPainPoints: string[];
  buyingTriggers?: string[];
}

interface GapPlanBrandIdentityNotes {
  tone?: string[];
  personality?: string[];
  differentiationSummary?: string;
}

interface GapPlanStructured {
  scores: GapPlanScores;
  maturityStage?: string;
  dimensionDiagnostics?: unknown[];
  keyFindings?: string[];
  recommendedNextSteps?: string[];
  kpisToWatch?: GapPlanKpi[];
  // Extended fields for Context Graph completeness (v2)
  primaryOffers?: GapPlanOffer[];
  competitors?: GapPlanCompetitor[];
  audienceSummary?: GapPlanAudienceSummary;
  brandIdentityNotes?: GapPlanBrandIdentityNotes;
  unknowns?: string[];
}

interface GapPlanDataJson {
  companyName?: string;
  snapshotId?: string;
  labsRun?: string[];
  gapStructured?: GapPlanStructured;
  insights?: GapPlanInsight[];
  durationMs?: number;
}

interface GapPlanRunWithData {
  id: string;
  status: string;
  url?: string;
  createdAt?: string;
  dataJson?: GapPlanDataJson;
}

// ============================================================================
// Fetch GAP Plan Runs with Data JSON
// ============================================================================

/**
 * Fetch GAP Plan runs with full Data JSON for a company
 */
async function fetchGapPlanRunsWithData(
  companyId: string,
  limit: number = 5
): Promise<GapPlanRunWithData[]> {
  try {
    const tableName = getTableName('GAP_PLAN_RUN', 'AIRTABLE_GAP_PLAN_RUN_TABLE');
    const { base } = await import('@/lib/airtable/client');

    const allRecords = await base(tableName)
      .select({
        maxRecords: 100,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .firstPage();

    // Filter for matching company
    const matchedRecords = allRecords.filter((record) => {
      const fields = record.fields;
      const companyField = fields['Company'];
      const companyIdField = fields['Company ID'] as string | undefined;

      return (Array.isArray(companyField) && companyField.includes(companyId)) ||
             (companyIdField && companyIdField === companyId);
    }).slice(0, limit);

    console.log(`[gapPlanImporter] Found ${matchedRecords.length} GAP Plan runs for company ${companyId}`);

    return matchedRecords.map((record) => {
      const fields = record.fields;
      const dataJsonStr = fields['Data JSON'] as string | undefined;

      let dataJson: GapPlanDataJson | undefined;
      if (dataJsonStr) {
        try {
          dataJson = JSON.parse(dataJsonStr);
        } catch (e) {
          console.warn(`[gapPlanImporter] Failed to parse Data JSON for run ${record.id}`);
        }
      }

      return {
        id: record.id,
        status: (fields['Status'] as string) || 'pending',
        url: (fields['URL'] as string) || (fields['Website URL'] as string),
        createdAt: fields['Created At'] as string | undefined,
        dataJson,
      };
    });
  } catch (error) {
    console.error('[gapPlanImporter] Error fetching GAP Plan runs:', error);
    return [];
  }
}

// ============================================================================
// GAP Plan Importer
// ============================================================================

/**
 * GAP Plan Importer
 *
 * Imports structured data from GAP Plan runs into the context graph.
 * Acts as a secondary source - fills gaps but never overwrites Lab data.
 */
export const gapPlanImporter: DomainImporter = {
  id: 'gapPlan',
  label: 'GAP Plan',

  async supports(companyId: string, _domain: string): Promise<boolean> {
    try {
      const runs = await fetchGapPlanRunsWithData(companyId, 3);
      const hasCompleted = runs.some(
        (run) => run.status === 'completed' && run.dataJson?.gapStructured
      );
      console.log(`[gapPlanImporter] supports check: { companyId: ${companyId}, hasData: ${hasCompleted} }`);
      return hasCompleted;
    } catch (error) {
      console.warn('[gapPlanImporter] Error checking support:', error);
      return false;
    }
  },

  async importAll(
    graph: CompanyContextGraph,
    companyId: string,
    _domain: string
  ): Promise<ImportResult> {
    const proofMode = process.env.DEBUG_CONTEXT_PROOF === '1';

    const result: ImportResult = {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [],
      sourceRunIds: [],
    };

    // Initialize proof structure in proof mode
    if (proofMode) {
      result.proof = {
        extractionPath: null,
        rawKeysFound: 0,
        candidateWrites: [],
        droppedByReason: {
          emptyValue: 0,
          domainAuthority: 0,
          wrongDomainForField: 0,
          sourcePriority: 0,
          humanConfirmed: 0,
          notCanonical: 0,
          other: 0,
        },
        persistedWrites: [],
      };
    }

    try {
      // Fetch GAP Plan runs with Data JSON
      const runs = await fetchGapPlanRunsWithData(companyId, 5);
      const completedRuns = runs.filter(
        (run) => run.status === 'completed' && run.dataJson?.gapStructured
      );

      if (completedRuns.length === 0) {
        result.errors.push('No completed GAP Plan runs with structured data found');
        return result;
      }

      console.log(`[gapPlanImporter] Processing ${completedRuns.length} completed GAP Plan runs`);

      // Use the most recent run with data
      const latestRun = completedRuns[0];
      result.sourceRunIds.push(latestRun.id);

      // Populate proof extraction data
      if (proofMode && result.proof) {
        result.proof.extractionPath = `GAP_PLAN_RUN:dataJson.gapStructured`;
        // Count raw keys in the structured data
        const structured = latestRun.dataJson?.gapStructured;
        if (structured) {
          let rawKeyCount = 0;
          if (structured.scores) rawKeyCount += Object.keys(structured.scores).length;
          if (structured.maturityStage) rawKeyCount++;
          if (structured.kpisToWatch?.length) rawKeyCount++;
          if (structured.keyFindings?.length) rawKeyCount++;
          if (structured.recommendedNextSteps?.length) rawKeyCount++;
          if (structured.primaryOffers?.length) rawKeyCount++;
          if (structured.competitors?.length) rawKeyCount++;
          if (structured.audienceSummary) rawKeyCount++;
          if (structured.brandIdentityNotes) rawKeyCount++;
          result.proof.rawKeysFound = rawKeyCount;
        }
      }

      // Create provenance for GAP Plan source (lower confidence than Labs)
      const provenance = createProvenance('gap_full', {
        confidence: 0.6, // Lower than Labs (0.85) - this is gap-filling data
        runId: latestRun.id,
        validForDays: 30,
      });

      // Import from structured data
      if (latestRun.dataJson) {
        const dataImport = importFromGapPlanData(graph, latestRun.dataJson, provenance);
        result.fieldsUpdated += dataImport.count;
        result.updatedPaths.push(...dataImport.paths);
      }

      result.success = result.fieldsUpdated > 0;
      console.log(`[gapPlanImporter] Imported ${result.fieldsUpdated} fields from GAP Plan run ${latestRun.id}`);

      // Populate persisted writes for proof
      if (proofMode && result.proof) {
        result.proof.persistedWrites = result.updatedPaths;
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[gapPlanImporter] Import error:', error);
    }

    return result;
  },
};

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import data from GAP Plan structured data
 * Maps gapStructured and insights to context fields
 */
function importFromGapPlanData(
  graph: CompanyContextGraph,
  data: GapPlanDataJson,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  const structured = data.gapStructured;
  if (!structured) {
    return { count, paths };
  }

  // =========================================================================
  // OBJECTIVES DOMAIN - KPIs to watch
  // =========================================================================
  if (structured.kpisToWatch && structured.kpisToWatch.length > 0) {
    const kpiLabels = structured.kpisToWatch.map((kpi) => kpi.name);
    if (!graph.objectives?.kpiLabels?.value?.length) {
      setDomainFields(graph, 'objectives', { kpiLabels }, provenance);
      paths.push('objectives.kpiLabels');
      count++;
    }

    // Also store KPI details in objectives if empty
    const kpiDetails = structured.kpisToWatch.map((kpi) => ({
      name: kpi.name,
      description: kpi.description,
      target: kpi.whatGoodLooksLike,
    }));
    // Store as stringified JSON in a suitable field
    if (!graph.objectives?.primaryBusinessGoal?.value && kpiDetails.length > 0) {
      const kpiSummary = structured.kpisToWatch
        .map((kpi) => `${kpi.name}: ${kpi.description || ''}`)
        .join('; ');
      setField(graph, 'objectives', 'primaryBusinessGoal', kpiSummary.substring(0, 500), provenance);
      paths.push('objectives.primaryBusinessGoal');
      count++;
    }
  }

  // =========================================================================
  // IDENTITY DOMAIN - Maturity stage
  // =========================================================================
  if (structured.maturityStage) {
    // Map maturity stage to marketMaturity if not already set
    // marketMaturity expects: "launch" | "growth" | "plateau" | "turnaround" | "exit" | "other"
    if (!graph.identity?.marketMaturity?.value) {
      const stageMap: Record<string, 'launch' | 'growth' | 'plateau' | 'turnaround' | 'exit' | 'other'> = {
        'developing': 'launch',
        'early': 'launch',
        'emerging': 'growth',
        'scaling': 'growth',
        'established': 'plateau',
        'leading': 'plateau',
        'foundation': 'launch',
      };
      const normalizedStage = structured.maturityStage.toLowerCase();
      const mappedStage = stageMap[normalizedStage] || 'other';
      setField(graph, 'identity', 'marketMaturity', mappedStage, provenance);
      paths.push('identity.marketMaturity');
      count++;
    }
  }

  // =========================================================================
  // WEBSITE DOMAIN - Website score (only if empty)
  // Note: This is a deprecated domain but we fill it for backward compat
  // =========================================================================
  if (structured.scores.website !== undefined && !graph.website?.websiteScore?.value) {
    setField(graph, 'website', 'websiteScore', structured.scores.website, provenance);
    paths.push('website.websiteScore');
    count++;
  }

  // =========================================================================
  // CONTENT DOMAIN - Content score (only if empty)
  // Note: This is a deprecated domain but we fill it for backward compat
  // =========================================================================
  if (structured.scores.content !== undefined && !graph.content?.contentScore?.value) {
    setField(graph, 'content', 'contentScore', structured.scores.content, provenance);
    paths.push('content.contentScore');
    count++;
  }

  // =========================================================================
  // SEO DOMAIN - SEO score (only if empty)
  // Note: This is a deprecated domain but we fill it for backward compat
  // =========================================================================
  if (structured.scores.seo !== undefined && !graph.seo?.seoScore?.value) {
    setField(graph, 'seo', 'seoScore', structured.scores.seo, provenance);
    paths.push('seo.seoScore');
    count++;
  }

  // =========================================================================
  // INSIGHTS - Extract categorized insights to relevant domains
  // =========================================================================
  if (data.insights && data.insights.length > 0) {
    const insightImport = importInsightsToContext(graph, data.insights, provenance);
    count += insightImport.count;
    paths.push(...insightImport.paths);
  }

  // =========================================================================
  // KEY FINDINGS - Log for visibility (cannot store directly - enum type mismatch)
  // =========================================================================
  if (structured.keyFindings && structured.keyFindings.length > 0) {
    // Note: keyFindings are free text, but secondaryObjectives expects enum values
    // ("lead_generation" | "sales_conversions" | etc). Skipping this mapping.
    console.log(`[gapPlanImporter] Found ${structured.keyFindings.length} key findings (not imported - no suitable field)`);
  }

  // =========================================================================
  // RECOMMENDED NEXT STEPS - Could inform work items or objectives
  // =========================================================================
  if (structured.recommendedNextSteps && structured.recommendedNextSteps.length > 0) {
    // For now, we don't have a good place for these
    // They could potentially go to a work queue or recommendations field
    console.log(`[gapPlanImporter] Found ${structured.recommendedNextSteps.length} recommended next steps (not imported - no suitable field)`);
  }

  // =========================================================================
  // EXTENDED FIELDS (v2) - For Context Graph Completeness
  // =========================================================================

  // Import primary offers to productOffer domain
  const offersImport = importPrimaryOffers(graph, structured, provenance);
  count += offersImport.count;
  paths.push(...offersImport.paths);

  // Import competitors to competitive domain
  const competitorsImport = importCompetitors(graph, structured, provenance);
  count += competitorsImport.count;
  paths.push(...competitorsImport.paths);

  // Import audience summary to audience domain
  const audienceImport = importAudienceSummary(graph, structured, provenance);
  count += audienceImport.count;
  paths.push(...audienceImport.paths);

  // Import brand identity notes to brand domain
  const brandImport = importBrandIdentityNotes(graph, structured, provenance);
  count += brandImport.count;
  paths.push(...brandImport.paths);

  // Log unknowns for debugging
  if (structured.unknowns && structured.unknowns.length > 0) {
    console.log(`[gapPlanImporter] Unknowns flagged by GAP Plan: ${structured.unknowns.join(', ')}`);
  }

  return { count, paths };
}

/**
 * Import insights to appropriate context domains
 * Categorizes insights by their category field and maps to domain-specific fields
 */
function importInsightsToContext(
  graph: CompanyContextGraph,
  insights: GapPlanInsight[],
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  // Group insights by category
  const byCategory: Record<string, GapPlanInsight[]> = {};
  for (const insight of insights) {
    const cat = insight.category.toLowerCase();
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(insight);
  }

  // Brand insights → brand.brandWeaknesses (only if empty)
  if (byCategory['brand'] && byCategory['brand'].length > 0) {
    if (!graph.brand?.brandWeaknesses?.value?.length) {
      const brandIssues = byCategory['brand'].map((i) => `${i.title}: ${i.body}`);
      setDomainFields(graph, 'brand', { brandWeaknesses: brandIssues }, provenance);
      paths.push('brand.brandWeaknesses');
      count++;
    }
  }

  // Website insights → website.criticalIssues (only if empty)
  if (byCategory['website'] && byCategory['website'].length > 0) {
    if (!graph.website?.criticalIssues?.value?.length) {
      const websiteIssues = byCategory['website'].map((i) => `${i.title}: ${i.body}`);
      setDomainFields(graph, 'website', { criticalIssues: websiteIssues }, provenance);
      paths.push('website.criticalIssues');
      count++;
    }
  }

  // Content insights → content.keyTopics (only if empty)
  if (byCategory['content'] && byCategory['content'].length > 0) {
    if (!graph.content?.keyTopics?.value?.length) {
      const contentIssues = byCategory['content'].map((i) => `${i.title}: ${i.body}`);
      setDomainFields(graph, 'content', { keyTopics: contentIssues }, provenance);
      paths.push('content.keyTopics');
      count++;
    }
  }

  // SEO insights → seo.seoRecommendations (only if empty)
  if (byCategory['seo'] && byCategory['seo'].length > 0) {
    if (!graph.seo?.seoRecommendations?.value?.length) {
      const seoIssues = byCategory['seo'].map((i) => `${i.title}: ${i.body}`);
      setDomainFields(graph, 'seo', { seoRecommendations: seoIssues }, provenance);
      paths.push('seo.seoRecommendations');
      count++;
    }
  }

  // Audience insights → audience.behavioralDrivers (only if empty)
  if (byCategory['audience'] && byCategory['audience'].length > 0) {
    if (!graph.audience?.behavioralDrivers?.value?.length) {
      const audienceIssues = byCategory['audience'].map((i) => `${i.title}: ${i.body}`);
      setDomainFields(graph, 'audience', { behavioralDrivers: audienceIssues }, provenance);
      paths.push('audience.behavioralDrivers');
      count++;
    }
  }

  return { count, paths };
}

// ============================================================================
// Extended Import Functions (v2) - For Context Graph Completeness
// ============================================================================

/**
 * Import primary offers to productOffer domain
 * Maps: gapStructured.primaryOffers → productOffer.primaryProducts, productOffer.valueProposition
 */
function importPrimaryOffers(
  graph: CompanyContextGraph,
  structured: GapPlanStructured,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  if (!structured.primaryOffers || structured.primaryOffers.length === 0) {
    return { count, paths };
  }

  // Map offer names to primaryProducts (only if empty)
  if (!graph.productOffer?.primaryProducts?.value?.length) {
    const productNames = structured.primaryOffers.map((offer) => offer.name);
    setDomainFields(graph, 'productOffer', { primaryProducts: productNames }, provenance);
    paths.push('productOffer.primaryProducts');
    count++;
  }

  // Derive valueProposition from offers if empty
  if (!graph.productOffer?.valueProposition?.value) {
    const offersWithDesc = structured.primaryOffers.filter((o) => o.description);
    if (offersWithDesc.length > 0) {
      // Use the first offer's description as the value proposition
      const valueProp = offersWithDesc[0].description;
      if (valueProp) {
        setField(graph, 'productOffer', 'valueProposition', valueProp, provenance);
        paths.push('productOffer.valueProposition');
        count++;
      }
    }
  }

  // Map pricing tier to pricingNotes if available and empty
  if (!graph.productOffer?.pricingNotes?.value) {
    const offersWithPricing = structured.primaryOffers.filter((o) => o.priceTier && o.priceTier !== 'unknown');
    if (offersWithPricing.length > 0) {
      const pricingNote = offersWithPricing
        .map((o) => `${o.name}: ${o.priceTier} tier`)
        .join('; ');
      setField(graph, 'productOffer', 'pricingNotes', pricingNote, provenance);
      paths.push('productOffer.pricingNotes');
      count++;
    }
  }

  // Map to productLines if empty
  if (!graph.productOffer?.productLines?.value?.length) {
    const productLines = structured.primaryOffers.map((offer) => offer.name);
    setDomainFields(graph, 'productOffer', { productLines }, provenance);
    paths.push('productOffer.productLines');
    count++;
  }

  console.log(`[gapPlanImporter] Imported ${count} productOffer fields from ${structured.primaryOffers.length} offers`);
  return { count, paths };
}

/**
 * Import competitors to competitive domain
 * Maps: gapStructured.competitors → competitive.competitors, identity.primaryCompetitors
 */
function importCompetitors(
  graph: CompanyContextGraph,
  structured: GapPlanStructured,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  if (!structured.competitors || structured.competitors.length === 0) {
    return { count, paths };
  }

  const competitorNames = structured.competitors.map((c) => c.name);

  // Map to identity.primaryCompetitors (only if empty)
  if (!graph.identity?.primaryCompetitors?.value?.length) {
    setDomainFields(graph, 'identity', { primaryCompetitors: competitorNames }, provenance);
    paths.push('identity.primaryCompetitors');
    count++;
  }

  // Note: competitive.competitors has a complex schema with many required fields
  // We'll use competitiveAdvantages instead for simple string-based competitor data
  if (!graph.competitive?.competitiveAdvantages?.value?.length) {
    const competitorNotes = structured.competitors
      .filter((c) => c.positioningNote)
      .map((c) => `vs ${c.name}: ${c.positioningNote}`);
    if (competitorNotes.length > 0) {
      setDomainFields(graph, 'competitive', { competitiveAdvantages: competitorNotes }, provenance);
      paths.push('competitive.competitiveAdvantages');
      count++;
    }
  }

  // Map positioning notes to competitive.positionSummary if empty
  if (!graph.competitive?.positionSummary?.value) {
    const notesWithPositioning = structured.competitors.filter((c) => c.positioningNote);
    if (notesWithPositioning.length > 0) {
      const positionSummary = `Key competitors: ${notesWithPositioning.map((c) => `${c.name} (${c.positioningNote})`).join('; ')}`;
      setField(graph, 'competitive', 'positionSummary', positionSummary, provenance);
      paths.push('competitive.positionSummary');
      count++;
    }
  }

  console.log(`[gapPlanImporter] Imported ${count} competitive fields from ${structured.competitors.length} competitors`);
  return { count, paths };
}

/**
 * Import audience summary to audience domain
 * Maps: gapStructured.audienceSummary → audience.icpDescription, audience.painPoints
 */
function importAudienceSummary(
  graph: CompanyContextGraph,
  structured: GapPlanStructured,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  if (!structured.audienceSummary) {
    return { count, paths };
  }

  const { icpDescription, keyPainPoints, buyingTriggers } = structured.audienceSummary;

  // Map ICP description (only if empty)
  if (icpDescription && !graph.audience?.icpDescription?.value) {
    setField(graph, 'audience', 'icpDescription', icpDescription, provenance);
    paths.push('audience.icpDescription');
    count++;
  }

  // Map pain points (only if empty)
  if (keyPainPoints && keyPainPoints.length > 0 && !graph.audience?.painPoints?.value?.length) {
    setDomainFields(graph, 'audience', { painPoints: keyPainPoints }, provenance);
    paths.push('audience.painPoints');
    count++;
  }

  // Map buying triggers to motivations if empty
  if (buyingTriggers && buyingTriggers.length > 0 && !graph.audience?.motivations?.value?.length) {
    setDomainFields(graph, 'audience', { motivations: buyingTriggers }, provenance);
    paths.push('audience.motivations');
    count++;
  }

  // Map ICP to primaryAudience if empty (audienceDescription doesn't exist)
  if (icpDescription && !graph.audience?.primaryAudience?.value) {
    setField(graph, 'audience', 'primaryAudience', icpDescription, provenance);
    paths.push('audience.primaryAudience');
    count++;
  }

  console.log(`[gapPlanImporter] Imported ${count} audience fields from audience summary`);
  return { count, paths };
}

/**
 * Import brand identity notes to brand domain
 * Maps: gapStructured.brandIdentityNotes → brand.toneOfVoice, brand.brandPersonality, brand.differentiators
 */
function importBrandIdentityNotes(
  graph: CompanyContextGraph,
  structured: GapPlanStructured,
  provenance: ReturnType<typeof createProvenance>
): { count: number; paths: string[] } {
  const paths: string[] = [];
  let count = 0;

  if (!structured.brandIdentityNotes) {
    return { count, paths };
  }

  const { tone, personality, differentiationSummary } = structured.brandIdentityNotes;

  // Map tone to toneOfVoice (only if empty)
  if (tone && tone.length > 0 && !graph.brand?.toneOfVoice?.value) {
    const toneString = tone.join(', ');
    setField(graph, 'brand', 'toneOfVoice', toneString, provenance);
    paths.push('brand.toneOfVoice');
    count++;
  }

  // Map personality to brandPersonality string (only if empty)
  // brandPersonality is a string, not string[], so we join the array
  if (personality && personality.length > 0 && !graph.brand?.brandPersonality?.value) {
    const personalityString = personality.join(', ');
    setField(graph, 'brand', 'brandPersonality', personalityString, provenance);
    paths.push('brand.brandPersonality');
    count++;
  }

  // Map differentiation summary to differentiators (only if empty)
  if (differentiationSummary && !graph.brand?.differentiators?.value?.length) {
    // Split differentiation summary into array items if it contains commas or semicolons
    const differentiators = differentiationSummary.includes(';')
      ? differentiationSummary.split(';').map((s) => s.trim()).filter(Boolean)
      : differentiationSummary.includes(',')
        ? differentiationSummary.split(',').map((s) => s.trim()).filter(Boolean)
        : [differentiationSummary];
    setDomainFields(graph, 'brand', { differentiators }, provenance);
    paths.push('brand.differentiators');
    count++;
  }

  // Map tone to uniqueSellingPoints if empty (voiceDescriptors doesn't exist)
  if (tone && tone.length > 0 && !graph.brand?.uniqueSellingPoints?.value?.length) {
    setDomainFields(graph, 'brand', { uniqueSellingPoints: tone }, provenance);
    paths.push('brand.uniqueSellingPoints');
    count++;
  }

  console.log(`[gapPlanImporter] Imported ${count} brand fields from brand identity notes`);
  return { count, paths };
}

export default gapPlanImporter;
