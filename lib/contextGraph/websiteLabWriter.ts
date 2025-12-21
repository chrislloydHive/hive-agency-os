// lib/contextGraph/websiteLabWriter.ts
// WebsiteLab Domain Writer - Maps full WebsiteUXLabResultV4 to Context Graph
//
// This writer takes the comprehensive WebsiteLab result and writes normalized
// facts into the Context Graph via mergeField, so running Website Lab actually
// populates the Context UI.
//
// DOMAIN AUTHORITY: website_lab can only write to 'website' and 'digitalInfra' domains.
// Cross-domain observations (brand, content, audience, etc.) are tracked as
// 'wrongDomainForField' skips for debugging but NOT written.

import type { CompanyContextGraph } from './companyContextGraph';
import type { ProvenanceTag } from './types';
import { setDomainFields, setFieldUntyped, setFieldUntypedWithResult, createProvenance } from './mutate';
import { saveContextGraph } from './storage';
import type { WebsiteUXLabResultV4 } from '@/lib/gap-heavy/modules/websiteLab';
import { canLabWriteToDomain, type DomainKey } from '@/lib/os/context/domainAuthority';

// ============================================================================
// MAPPING CONFIGURATION
// ============================================================================

/**
 * Mapping entry for a single field
 */
interface FieldMapping {
  /** Source path in WebsiteLabResult (dot notation) */
  source: string;
  /** Target path in Context Graph (domain.field) */
  target: string;
  /** Optional transform function */
  transform?: (value: unknown) => unknown;
  /** Confidence multiplier (default 1.0) */
  confidenceMultiplier?: number;
}

/**
 * Declarative mapping configuration
 * Maps paths in WebsiteUXLabResultV4 to Context Graph domain.field paths
 */
export const WEBSITE_LAB_MAPPINGS: FieldMapping[] = [
  // ============================================================================
  // Website Domain - Core Metrics
  // ============================================================================
  {
    source: 'siteAssessment.score',
    target: 'website.websiteScore',
  },
  {
    source: 'siteAssessment.executiveSummary',
    target: 'website.executiveSummary',
  },
  {
    source: 'heuristics.overallScore',
    target: 'website.websiteScore',
    confidenceMultiplier: 0.9, // Slightly lower confidence than direct score
  },

  // ============================================================================
  // Website Domain - Funnel & Conversion
  // ============================================================================
  {
    source: 'siteAssessment.keyIssues',
    target: 'website.conversionBlocks',
  },
  {
    source: 'strategistViews.conversion.funnelBlockers',
    target: 'website.conversionBlocks',
    confidenceMultiplier: 0.95,
  },
  {
    source: 'strategistViews.conversion.opportunities',
    target: 'website.conversionOpportunities',
  },
  {
    source: 'siteAssessment.funnelHealthScore',
    target: 'website.funnelHealthScore',
  },

  // ============================================================================
  // Website Domain - Quick Wins & Recommendations
  // ============================================================================
  {
    source: 'siteAssessment.quickWins',
    target: 'website.quickWins',
    transform: (wins) =>
      Array.isArray(wins)
        ? wins.map((w: { title?: string; description?: string }) =>
            typeof w === 'string' ? w : w.title || w.description || String(w)
          )
        : [],
  },
  {
    source: 'impactMatrix.quickWins',
    target: 'website.quickWins',
    transform: (wins) =>
      Array.isArray(wins)
        ? wins.map((w: { title?: string }) => w.title || String(w))
        : [],
    confidenceMultiplier: 0.9,
  },
  {
    source: 'siteAssessment.strategicInitiatives',
    target: 'website.recommendations',
    transform: (initiatives) =>
      Array.isArray(initiatives)
        ? initiatives.map(
            (i: { title?: string; description?: string }) =>
              i.title || i.description || String(i)
          )
        : [],
  },
  {
    source: 'ctaIntelligence.recommendations',
    target: 'website.recommendations',
    confidenceMultiplier: 0.85,
  },

  // ============================================================================
  // Website Domain - Page Assessments
  // ============================================================================
  {
    source: 'siteAssessment.pageLevelScores',
    target: 'website.pageAssessments',
    transform: (pages) =>
      Array.isArray(pages)
        ? pages.map(
            (p: {
              path?: string;
              type?: string;
              score?: number;
              weaknesses?: string[];
              strengths?: string[];
            }) => ({
              url: p.path || '',
              pageType: p.type || null,
              score: p.score || null,
              issues: p.weaknesses || [],
              recommendations: p.strengths || [],
            })
          )
        : [],
  },

  // ============================================================================
  // Website Domain - Infrastructure Detection
  // ============================================================================
  {
    source: 'siteGraph.pages',
    target: 'website.hasContactForm',
    transform: (pages) =>
      Array.isArray(pages)
        ? pages.some(
            (p: { type?: string; evidenceV3?: { ctas?: string[] } }) =>
              p.type === 'contact' ||
              (p.evidenceV3?.ctas || []).some((cta: string) =>
                /contact|get.?in.?touch|reach.?out/i.test(cta)
              )
          )
        : null,
    confidenceMultiplier: 0.8,
  },
  {
    source: 'trustAnalysis.signals',
    target: 'website.infraNotes',
    transform: (signals) =>
      Array.isArray(signals)
        ? signals.map(
            (s: { type?: string; description?: string }) =>
              `${s.type}: ${s.description}`
          )
        : [],
    confidenceMultiplier: 0.75,
  },

  // ============================================================================
  // Website Domain - Mobile & Accessibility
  // ============================================================================
  {
    source: 'visualBrandEvaluation.layout.scannabilityScore',
    target: 'website.mobileScore',
    confidenceMultiplier: 0.7, // Proxy metric
  },
  {
    source: 'visualBrandEvaluation.colorHarmony.accessibilityScore',
    target: 'website.accessibilityScore',
  },

  // ============================================================================
  // Brand Domain - Visual Identity
  // ============================================================================
  {
    source: 'visualBrandEvaluation.colorHarmony.primaryColors',
    target: 'brand.brandColors',
  },
  {
    source: 'visualBrandEvaluation.typography.fontFamilies',
    target: 'brand.visualIdentitySummary',
    transform: (fonts) =>
      Array.isArray(fonts) ? `Typography: ${fonts.join(', ')}` : null,
    confidenceMultiplier: 0.8,
  },
  {
    source: 'visualBrandEvaluation.brandConsistencyScore',
    target: 'brand.brandConsistency',
  },
  {
    source: 'visualBrandEvaluation.narrative',
    target: 'brand.visualIdentitySummary',
    confidenceMultiplier: 0.9,
  },

  // ============================================================================
  // Brand Domain - Messaging & Positioning
  // ============================================================================
  {
    source: 'contentIntelligence.valuePropositionStrength',
    target: 'brand.valuePropositionScore',
  },
  {
    source: 'strategistViews.copywriting.toneAnalysis.detectedTone',
    target: 'brand.toneOfVoice',
  },
  {
    source: 'strategistViews.copywriting.messagingIssues',
    target: 'brand.brandWeaknesses',
    confidenceMultiplier: 0.85,
  },
  {
    source: 'strategistViews.copywriting.differentiationAnalysis.competitivePositioning',
    target: 'brand.competitivePosition',
  },
  {
    source: 'strategistViews.copywriting.differentiationAnalysis.recommendations',
    target: 'brand.differentiators',
    confidenceMultiplier: 0.8,
  },

  // ============================================================================
  // Brand Domain - Trust & Perception
  // ============================================================================
  {
    source: 'trustAnalysis.trustScore',
    target: 'brand.trustScore',
  },
  {
    source: 'trustAnalysis.narrative',
    target: 'brand.brandPerception',
    confidenceMultiplier: 0.85,
  },
  {
    source: 'siteAssessment.strengths',
    target: 'brand.brandStrengths',
  },

  // ============================================================================
  // Content Domain - Headlines & Quality
  // ============================================================================
  {
    source: 'contentIntelligence.summaryScore',
    target: 'content.contentScore',
  },
  {
    source: 'contentIntelligence.narrative',
    target: 'content.contentSummary',
  },
  {
    source: 'contentIntelligence.qualityMetrics.clarityScore',
    target: 'content.clarityScore',
  },
  {
    source: 'contentIntelligence.qualityMetrics.readingLevel',
    target: 'content.readingLevel',
  },
  {
    source: 'contentIntelligence.improvements',
    target: 'content.contentGaps',
    transform: (improvements) =>
      Array.isArray(improvements)
        ? improvements.map((i: string) => ({
            topic: i,
            priority: 'medium' as const,
            audienceNeed: null,
            recommendedFormat: null,
          }))
        : [],
  },

  // ============================================================================
  // Content Domain - CTA Analysis
  // ============================================================================
  {
    source: 'ctaIntelligence.summaryScore',
    target: 'content.ctaEffectiveness',
  },
  {
    source: 'ctaIntelligence.narrative',
    target: 'content.ctaSummary',
  },
  {
    source: 'ctaIntelligence.patterns.primaryCta',
    target: 'content.primaryCta',
  },

  // ============================================================================
  // Persona/Audience Domain - From Persona Simulations
  // ============================================================================
  {
    source: 'personas',
    target: 'audience.personaInsights',
    transform: (personas) =>
      Array.isArray(personas)
        ? personas.map(
            (p: {
              persona?: string;
              goal?: string;
              success?: boolean;
              frictionNotes?: string[];
            }) => ({
              persona: p.persona,
              goal: p.goal,
              success: p.success,
              frictionPoints: p.frictionNotes || [],
            })
          )
        : [],
  },

  // ============================================================================
  // Historical/Metrics Domain - Scores Over Time
  // ============================================================================
  {
    source: 'siteAssessment.benchmarkLabel',
    target: 'historical.websiteBenchmark',
  },
  {
    source: 'siteAssessment.multiPageConsistencyScore',
    target: 'historical.siteConsistencyScore',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a value is "meaningful" (not null, undefined, empty array, or empty string)
 */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Create provenance tag for Website Lab source
 */
function createWebsiteLabProvenance(
  runId: string | undefined,
  confidenceMultiplier: number = 1.0
): ProvenanceTag {
  return createProvenance('website_lab', {
    runId,
    sourceRunId: runId,
    confidence: 0.85 * confidenceMultiplier,
    validForDays: 30, // Website analysis valid for ~30 days
  });
}

// ============================================================================
// MAIN WRITER FUNCTION
// ============================================================================

export interface WebsiteLabWriterResult {
  /** Number of fields successfully updated */
  fieldsUpdated: number;
  /** Fields that were updated (for logging/debugging) */
  updatedPaths: string[];
  /** Fields that were skipped (source value was null/undefined) */
  skippedPaths: string[];
  /** Any errors encountered */
  errors: string[];
  /** Proof data for debugging (populated in proof mode) */
  proof?: {
    extractionPath: string;
    candidateWrites: Array<{
      path: string;
      valuePreview: string;
      source: string;
      confidence: number;
    }>;
    droppedByReason: {
      emptyValue: number;
      domainAuthority: number;
      wrongDomainForField: number;
      sourcePriority: number;
      humanConfirmed: number;
      notCanonical: number;
      other: number;
    };
    /** Top offending field keys for debugging */
    offendingFields?: Array<{ path: string; reason: string }>;
  };
}

/**
 * Write WebsiteLab results to Context Graph
 *
 * Takes a full WebsiteUXLabResultV4 and writes normalized facts
 * into the appropriate Context Graph domains.
 *
 * @param graph - The context graph to update
 * @param result - Full WebsiteUXLabResultV4 from Website Lab
 * @param runId - Optional run ID for provenance tracking
 * @param options - Optional options including proof mode
 * @returns Summary of what was updated
 */
export function writeWebsiteLabToGraph(
  graph: CompanyContextGraph,
  result: WebsiteUXLabResultV4,
  runId?: string,
  options?: { proofMode?: boolean }
): WebsiteLabWriterResult {
  const proofMode = options?.proofMode || process.env.DEBUG_CONTEXT_PROOF === '1';

  const summary: WebsiteLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  // Initialize proof data if in proof mode
  if (proofMode) {
    summary.proof = {
      extractionPath: 'WEBSITE_LAB_MAPPINGS',
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
      offendingFields: [],
    };
  }

  for (const mapping of WEBSITE_LAB_MAPPINGS) {
    try {
      // Extract source value
      let value = getNestedValue(result, mapping.source);

      // Skip if no meaningful value
      if (!isMeaningfulValue(value)) {
        summary.skippedPaths.push(`${mapping.source} → ${mapping.target}`);
        if (proofMode && summary.proof) {
          summary.proof.droppedByReason.emptyValue++;
        }
        continue;
      }

      // Apply transform if specified
      if (mapping.transform) {
        value = mapping.transform(value);

        // Check again after transform
        if (!isMeaningfulValue(value)) {
          summary.skippedPaths.push(`${mapping.source} → ${mapping.target} (transform returned empty)`);
          if (proofMode && summary.proof) {
            summary.proof.droppedByReason.emptyValue++;
          }
          continue;
        }
      }

      // Parse target path
      const [domain, field] = mapping.target.split('.');
      if (!domain || !field) {
        summary.errors.push(`Invalid target path: ${mapping.target}`);
        continue;
      }

      // Create provenance with confidence multiplier
      const provenance = createWebsiteLabProvenance(
        runId,
        mapping.confidenceMultiplier
      );

      // Capture candidate write for proof (before domain check)
      if (proofMode && summary.proof) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        summary.proof.candidateWrites.push({
          path: mapping.target,
          valuePreview: valueStr.slice(0, 100) + (valueStr.length > 100 ? '...' : ''),
          source: provenance.source,
          confidence: provenance.confidence,
        });
      }

      // =========================================================================
      // DOMAIN AUTHORITY CHECK - website_lab can only write to website/digitalInfra
      // =========================================================================
      const isAuthorizedDomain = canLabWriteToDomain('website_lab', domain as DomainKey);

      if (!isAuthorizedDomain) {
        // Skip this mapping - field belongs to a domain websiteLab cannot write to
        summary.skippedPaths.push(
          `${mapping.source} → ${mapping.target} (wrongDomainForField: website_lab cannot write to '${domain}')`
        );

        if (proofMode && summary.proof) {
          summary.proof.droppedByReason.wrongDomainForField++;
          // Track top 10 offending fields
          if (summary.proof.offendingFields && summary.proof.offendingFields.length < 10) {
            summary.proof.offendingFields.push({
              path: mapping.target,
              reason: `website_lab cannot write to '${domain}' domain`,
            });
          }
        }
        continue;
      }

      // Write to graph using setFieldUntypedWithResult to track blocking
      const writeResult = setFieldUntypedWithResult(graph, domain, field, value, provenance, { debug: proofMode });

      if (writeResult.result.updated) {
        summary.fieldsUpdated++;
        summary.updatedPaths.push(mapping.target);
      } else {
        summary.skippedPaths.push(`${mapping.source} → ${mapping.target} (blocked: ${writeResult.result.reason})`);

        // Track skip reason in proof
        if (proofMode && summary.proof) {
          const reason = writeResult.result.reason;
          if (reason === 'blocked_source') {
            summary.proof.droppedByReason.domainAuthority++;
          } else if (reason === 'lower_priority' || reason === 'low_confidence') {
            summary.proof.droppedByReason.sourcePriority++;
          } else if (reason === 'human_confirmed' || reason === 'human_override') {
            summary.proof.droppedByReason.humanConfirmed++;
          } else {
            // Catches: empty_value, higher_priority, same_priority_newer, and other
            summary.proof.droppedByReason.other++;
          }
        }
      }
    } catch (error) {
      summary.errors.push(
        `Error mapping ${mapping.source} → ${mapping.target}: ${error}`
      );
    }
  }

  // Update history refs with run ID
  if (runId) {
    const provenance = createWebsiteLabProvenance(runId);
    setDomainFields(
      graph,
      'historyRefs',
      { latestWebsiteLabRunId: runId } as Record<string, unknown>,
      provenance
    );
  }

  // Log summary
  console.log(
    `[WebsiteLabWriter] Updated ${summary.fieldsUpdated} fields, skipped ${summary.skippedPaths.length}, errors: ${summary.errors.length}`
  );
  if (proofMode && summary.proof) {
    console.log(
      `[WebsiteLabWriter] Proof: wrongDomainForField=${summary.proof.droppedByReason.wrongDomainForField}, ` +
      `domainAuthority=${summary.proof.droppedByReason.domainAuthority}, ` +
      `emptyValue=${summary.proof.droppedByReason.emptyValue}`
    );
  }

  return summary;
}

/**
 * Write WebsiteLab results to Context Graph and save
 *
 * Convenience function that writes and persists in one call.
 *
 * @param companyId - Company ID
 * @param result - Full WebsiteUXLabResultV4 from Website Lab
 * @param runId - Optional run ID for provenance tracking
 * @returns Updated graph and write summary
 */
export async function writeWebsiteLabAndSave(
  companyId: string,
  result: WebsiteUXLabResultV4,
  runId?: string
): Promise<{
  graph: CompanyContextGraph;
  summary: WebsiteLabWriterResult;
}> {
  // Load existing graph
  const { loadContextGraph } = await import('./storage');
  const { createEmptyContextGraph } = await import('./companyContextGraph');

  let graph = await loadContextGraph(companyId);

  // Create empty graph if none exists
  if (!graph) {
    graph = createEmptyContextGraph(companyId, companyId);
  }

  // Write results to graph
  const summary = writeWebsiteLabToGraph(graph, result, runId);

  // Save updated graph
  await saveContextGraph(graph, 'website_lab');

  return { graph, summary };
}

/**
 * Get a human-readable summary of what fields would be updated
 * without actually writing them (for preview/dry-run)
 */
export function previewWebsiteLabMappings(
  result: WebsiteUXLabResultV4
): Array<{
  source: string;
  target: string;
  hasValue: boolean;
  sampleValue?: unknown;
}> {
  return WEBSITE_LAB_MAPPINGS.map((mapping) => {
    let value = getNestedValue(result, mapping.source);
    const hasValue = isMeaningfulValue(value);

    // Apply transform for preview
    if (hasValue && mapping.transform) {
      value = mapping.transform(value);
    }

    // Truncate long values for preview
    let sampleValue = value;
    if (typeof value === 'string' && value.length > 100) {
      sampleValue = value.substring(0, 100) + '...';
    } else if (Array.isArray(value) && value.length > 3) {
      sampleValue = [...value.slice(0, 3), `... (${value.length} total)`];
    }

    return {
      source: mapping.source,
      target: mapping.target,
      hasValue,
      sampleValue: hasValue ? sampleValue : undefined,
    };
  });
}
