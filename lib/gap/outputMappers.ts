// lib/gap/outputMappers.ts
// Backward compatibility mappers for GAP output templates
// These map from the new canonical templates to existing API/Airtable formats
//
// NOTE: digitalFootprint scores + narratives are constrained by socialFootprint detection
// to avoid contradictions (e.g., telling a company to 'set up' a GBP when one already exists).
// See lib/gap/socialFootprintGating.ts for the sanitization logic.
//
// Previous behavior: estimateSubscore() used random variance around the overall score,
// completely ignoring actual detection data.
// New behavior: Subscores are derived from socialFootprint, and narratives are sanitized
// to remove/rewrite contradictory recommendations.
//
// ============================================================================
// WHICH SOURCES USE WHICH MAPPING
// ============================================================================
//
// mapInitialAssessmentToApiResponse:
//   - baseline_context_build: via lib/gap/orchestrator/osGapIaBaseline.ts → generateGapIaAnalysisCore
//   - os_baseline: same path as above
//   - gap_ia_run: via lib/gap/core.ts → generateGapIaAnalysisCore
//
// All sources MUST pass socialFootprint to enable gating. If socialFootprint is
// undefined, a warning is logged and gating is skipped (raw LLM output used as-is).
//

import type {
  InitialAssessmentOutput,
  FullGapOutput,
  DimensionIdType,
} from './outputTemplates';
import type { SocialFootprintSnapshot } from './socialDetection';
import {
  computeDigitalFootprintSubscores,
  computeDigitalFootprintScore,
  sanitizeDigitalFootprintNarrative,
  sanitizeSocialQuickWinsAndOpportunities,
  sanitizeQuickSummary,
} from './socialFootprintGating';
import type {
  GapIaV2Result,
  GapIaSummary,
  GapIaDimensions,
  DimensionSummary,
  DigitalFootprintDimension,
  AuthorityDimension,
  BreakdownItem,
  CoreMarketingContext,
  DiagnosticCategory,
  GapFullAssessmentV1,
  GapDimensions,
  GapQuickWin,
  GapMaturityStage,
  GapAssessmentSource,
  DigitalFootprintData,
  GapDataConfidence,
  DimensionId,
} from './types';

// GapIaInsights type (inline from GapIaRun.insights)
interface GapIaInsights {
  overallSummary: string;
  brandInsights: string[];
  contentInsights: string[];
  seoInsights: string[];
  websiteInsights: string[];
  recommendedNextStep?: string;
}

// ============================================================================
// GAP-IA Mappers
// ============================================================================

/**
 * Complete GAP-IA V2 AI Output (matches GapIaV2AiOutputSchema from schemas.ts)
 * This is the full structure that includes both V2 fields and legacy fields
 */
export interface GapIaV2AiOutput extends GapIaV2Result {
  core: CoreMarketingContext;
  insights: GapIaInsights;
}

/**
 * Map InitialAssessmentOutput (new template) to GapIaV2AiOutput (existing API format)
 *
 * Purpose: Maintain backward compatibility with existing API contracts and Airtable schema
 *
 * Key transformations:
 * - topOpportunities (new) → summary.topOpportunities (existing)
 * - dimensionSummaries (new) → dimensions.{brand,content,etc} (existing)
 * - Generate legacy core and insights objects for Airtable compatibility
 *
 * @param templateOutput - Validated output from new template
 * @param enrichmentData - Additional data from HTML signals, digital footprint, etc.
 * @returns Complete GapIaV2AiOutput matching existing API schema
 */
export function mapInitialAssessmentToApiResponse(
  templateOutput: InitialAssessmentOutput,
  enrichmentData: {
    url: string;
    domain: string;
    businessName?: string;
    companyType?: string;
    brandTier?: string;
    htmlSignals?: any;
    digitalFootprint?: any;
    multiPageSnapshot?: any;
    /** V5 socialFootprint detection result - used to gate subscores and narratives */
    socialFootprint?: SocialFootprintSnapshot;
  }
): GapIaV2AiOutput {
  const { url, domain, businessName, socialFootprint } = enrichmentData;

  // Defensive warning: if socialFootprint is missing, gating won't be applied
  // This helps identify pipelines that aren't passing detection results
  if (!socialFootprint) {
    console.warn('[outputMappers] WARNING: socialFootprint is undefined for', {
      domain,
      url,
      hint: 'Subscores and narratives will NOT be gated by detection results',
    });
  }

  // Sanitize quickWins and topOpportunities to avoid contradicting detection
  const rawQuickWinActions = templateOutput.quickWins.map(qw => qw.action);
  const sanitized = sanitizeSocialQuickWinsAndOpportunities(
    socialFootprint,
    rawQuickWinActions,
    templateOutput.topOpportunities
  );

  // Map summary
  const summary: GapIaSummary = {
    overallScore: templateOutput.marketingReadinessScore,
    maturityStage: mapMaturityStageToLegacy(templateOutput.maturityStage),
    headlineDiagnosis: generateHeadlineDiagnosis(templateOutput),
    narrative: templateOutput.executiveSummary,
    topOpportunities: sanitized.topOpportunities,
  };

  // Map dimensions (convert array to object structure)
  // Pass socialFootprint to derive accurate subscores from detection
  const dimensions: GapIaDimensions = mapDimensionSummariesToLegacy(
    templateOutput.dimensionSummaries,
    socialFootprint
  );

  // Map breakdown (generate from dimension key issues)
  const breakdown = {
    bullets: generateBreakdownBullets(templateOutput),
  };

  // Map quick wins (using sanitized actions)
  const quickWins = {
    bullets: templateOutput.quickWins.map((qw, index) => {
      // Use sanitized action if available (may have been filtered/rewritten)
      const sanitizedAction = sanitized.quickWins[index] ?? qw.action;
      return {
        category: mapDimensionToCategory(qw.dimensionId || inferDimensionFromAction(sanitizedAction)),
        action: sanitizedAction,
        expectedImpact: 'high' as const, // Default for IA quick wins
        effortLevel: 'low' as const, // Default for IA quick wins
      };
    }).filter(qw => qw.action), // Remove any empty actions from filtering
  };

  // Generate legacy core object (required for Airtable)
  // Pass sanitized topOpportunities and socialFootprint for quickSummary sanitization
  const core: CoreMarketingContext = generateCoreContext(
    url,
    domain,
    businessName,
    templateOutput.dimensionSummaries,
    enrichmentData,
    sanitized.topOpportunities,
    socialFootprint
  );

  // Generate legacy insights object (required for Airtable)
  const insights: GapIaInsights = generateInsights(templateOutput.dimensionSummaries);

  // Assemble complete response (matches GapIaV2AiOutputSchema)
  return {
    // V2 fields (new canonical structure)
    summary,
    dimensions,
    breakdown,
    quickWins,

    // Legacy fields (backward compatibility)
    core,
    insights,
  };
}

/**
 * Map maturity stage from new template to legacy format
 */
function mapMaturityStageToLegacy(stage: string): 'early' | 'developing' | 'advanced' {
  const mappings: Record<string, 'early' | 'developing' | 'advanced'> = {
    'Foundational': 'early',
    'Emerging': 'developing',
    'Established': 'developing',
    'Advanced': 'advanced',
    'CategoryLeader': 'advanced',
  };
  return mappings[stage] || 'developing';
}

/**
 * Convert dimensionSummaries array to legacy dimensions object structure
 *
 * For digitalFootprint dimension:
 * - Subscores are derived from socialFootprint detection (not random variance)
 * - Narratives (oneLiner, issues) are sanitized to avoid contradicting detection
 */
function mapDimensionSummariesToLegacy(
  dimensionSummaries: InitialAssessmentOutput['dimensionSummaries'],
  socialFootprint?: SocialFootprintSnapshot
): GapIaDimensions {
  const dimensions: Partial<GapIaDimensions> = {};

  for (const dim of dimensionSummaries) {
    const baseDimension: Omit<DimensionSummary, 'narrative'> & { narrative?: string } = {
      score: dim.score,
      label: formatDimensionLabel(dim.id),
      oneLiner: dim.summary,
      issues: [dim.keyIssue], // Single key issue becomes first issue
    };

    // Special handling for dimensions with subscores
    if (dim.id === 'digitalFootprint') {
      // V5: Compute subscores from socialFootprint detection instead of random variance
      const subscores = computeDigitalFootprintSubscores(socialFootprint);

      // Override the model's overall score with detection-based calculation
      // This ensures the score is consistent with the subscores
      const detectionBasedScore = computeDigitalFootprintScore(subscores);

      // Sanitize narratives to avoid contradicting detection signals
      const sanitizedNarrative = sanitizeDigitalFootprintNarrative(
        socialFootprint,
        dim.summary,
        [dim.keyIssue]
      );

      dimensions.digitalFootprint = {
        score: detectionBasedScore,
        label: formatDimensionLabel(dim.id),
        oneLiner: sanitizedNarrative.oneLiner,
        issues: sanitizedNarrative.issues,
        subscores,
      } as DigitalFootprintDimension;
    } else if (dim.id === 'authority') {
      dimensions.authority = {
        ...baseDimension,
        subscores: {
          domainAuthority: estimateSubscore(dim.score, 'domain'),
          backlinks: estimateSubscore(dim.score, 'backlinks'),
          brandSearchDemand: estimateSubscore(dim.score, 'brand'),
          industryRecognition: estimateSubscore(dim.score, 'recognition'),
        },
      } as AuthorityDimension;
    } else {
      // Standard dimensions (brand, content, seo, website)
      (dimensions as any)[dim.id] = baseDimension;
    }
  }

  return dimensions as GapIaDimensions;
}

/**
 * Generate headline diagnosis from template output
 */
function generateHeadlineDiagnosis(templateOutput: InitialAssessmentOutput): string {
  const stage = templateOutput.maturityStage;
  const score = templateOutput.marketingReadinessScore;

  if (score >= 80) {
    return `Strong ${stage.toLowerCase()} marketing foundation with targeted optimization opportunities.`;
  } else if (score >= 60) {
    return `Solid ${stage.toLowerCase()} marketing presence with key growth opportunities identified.`;
  } else if (score >= 40) {
    return `${stage} marketing foundation with significant improvement potential.`;
  } else {
    return `Early-stage marketing presence with substantial growth opportunities ahead.`;
  }
}

/**
 * Generate breakdown bullets from dimension summaries
 */
function generateBreakdownBullets(templateOutput: InitialAssessmentOutput): BreakdownItem[] {
  const bullets: BreakdownItem[] = [];

  // Convert each dimension's keyIssue to a breakdown bullet
  for (const dim of templateOutput.dimensionSummaries) {
    const impactLevel = dim.score < 40 ? 'high' : dim.score < 70 ? 'medium' : 'low';

    bullets.push({
      category: mapDimensionToCategory(dim.id),
      impactLevel: impactLevel as 'high' | 'medium' | 'low',
      statement: dim.keyIssue,
    });
  }

  // Sort by impact level (high first)
  bullets.sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    return impactOrder[a.impactLevel] - impactOrder[b.impactLevel];
  });

  return bullets.slice(0, 10); // Max 10 bullets
}

/**
 * Generate legacy core context object
 */
function generateCoreContext(
  url: string,
  domain: string,
  businessName: string | undefined,
  dimensionSummaries: InitialAssessmentOutput['dimensionSummaries'],
  enrichmentData: any,
  sanitizedTopOpportunities: string[],
  socialFootprint?: SocialFootprintSnapshot
): CoreMarketingContext {
  // Generate quickSummary from top opportunities and sanitize it
  const rawQuickSummary = sanitizedTopOpportunities.slice(0, 3).join(' ');
  const quickSummary = sanitizeQuickSummary(socialFootprint, rawQuickSummary);

  const core: CoreMarketingContext = {
    url,
    domain,
    businessName: businessName || domain,

    // Business context from enrichment data
    brandTier: enrichmentData.brandTier,
    companyType: enrichmentData.companyType,

    // Dimension-specific contexts (populated from summaries)
    brand: {},
    content: {},
    seo: {},
    website: {},

    // Quick summary (sanitized to avoid detection contradictions)
    quickSummary,
    topOpportunities: sanitizedTopOpportunities,
  };

  // Populate dimension scores in core (required for Airtable)
  for (const dim of dimensionSummaries) {
    if (dim.id === 'brand') {
      core.brand = { brandScore: dim.score };
    } else if (dim.id === 'content') {
      core.content = { contentScore: dim.score };
    } else if (dim.id === 'seo') {
      core.seo = { seoScore: dim.score };
    } else if (dim.id === 'website') {
      core.website = { websiteScore: dim.score };
    }
  }

  return core;
}

/**
 * Generate legacy insights object
 */
function generateInsights(
  dimensionSummaries: InitialAssessmentOutput['dimensionSummaries']
): GapIaInsights {
  const insights: GapIaInsights = {
    overallSummary: '', // Will be populated by API handler
    brandInsights: [],
    contentInsights: [],
    seoInsights: [],
    websiteInsights: [],
  };

  // Populate insights from dimension summaries
  for (const dim of dimensionSummaries) {
    if (dim.id === 'brand') {
      insights.brandInsights = [dim.summary, dim.keyIssue];
    } else if (dim.id === 'content') {
      insights.contentInsights = [dim.summary, dim.keyIssue];
    } else if (dim.id === 'seo') {
      insights.seoInsights = [dim.summary, dim.keyIssue];
    } else if (dim.id === 'website') {
      insights.websiteInsights = [dim.summary, dim.keyIssue];
    }
  }

  return insights;
}

/**
 * Format dimension ID to display label
 */
function formatDimensionLabel(dimId: DimensionIdType): string {
  const labels: Record<DimensionIdType, string> = {
    brand: 'Brand & Positioning',
    content: 'Content & Messaging',
    seo: 'SEO & Visibility',
    website: 'Website & Conversion',
    digitalFootprint: 'Digital Footprint',
    authority: 'Authority & Trust',
  };
  return labels[dimId];
}

/**
 * Estimate subscore for dimensions with subscores
 * This is a placeholder - in real implementation, subscores would come from enrichmentData
 */
function estimateSubscore(overallScore: number, _subcategory: string): number {
  // Slight variation around overall score (+/- 10%)
  const variance = Math.random() * 20 - 10;
  return Math.max(0, Math.min(100, Math.round(overallScore + variance)));
}

/**
 * Map dimension ID to DiagnosticCategory (capitalize)
 */
function mapDimensionToCategory(dimId: DimensionIdType): DiagnosticCategory {
  const mappings: Record<DimensionIdType, DiagnosticCategory> = {
    'brand': 'Brand',
    'content': 'Content',
    'seo': 'SEO',
    'website': 'Website & Conversion',
    'digitalFootprint': 'Other',
    'authority': 'Other',
  };
  return mappings[dimId];
}

/**
 * Infer dimension from action text (used when dimensionId not provided)
 */
function inferDimensionFromAction(action: string): DimensionIdType {
  const actionLower = action.toLowerCase();

  if (actionLower.includes('brand') || actionLower.includes('positioning') || actionLower.includes('identity')) {
    return 'brand';
  } else if (actionLower.includes('content') || actionLower.includes('blog') || actionLower.includes('messaging')) {
    return 'content';
  } else if (actionLower.includes('seo') || actionLower.includes('search') || actionLower.includes('keyword')) {
    return 'seo';
  } else if (actionLower.includes('website') || actionLower.includes('page') || actionLower.includes('conversion') || actionLower.includes('cta')) {
    return 'website';
  } else if (actionLower.includes('google') || actionLower.includes('linkedin') || actionLower.includes('social') || actionLower.includes('review')) {
    return 'digitalFootprint';
  } else if (actionLower.includes('authority') || actionLower.includes('backlink') || actionLower.includes('trust')) {
    return 'authority';
  }

  return 'brand'; // Default fallback
}

// ============================================================================
// Canonical GapFullAssessmentV1 Mapper (from InitialAssessmentOutput)
// ============================================================================

/**
 * Input for mapping InitialAssessmentOutput to GapFullAssessmentV1
 */
export interface InitialAssessmentToCanonicalInput {
  /** Validated InitialAssessmentOutput from LLM */
  templateOutput: InitialAssessmentOutput;

  /** Run metadata */
  metadata: {
    runId: string;
    url: string;
    domain: string;
    companyName: string;
    companyId?: string;
    source: GapAssessmentSource;
  };

  /** Detection data for gating */
  detectionData?: {
    socialFootprint?: SocialFootprintSnapshot;
    digitalFootprint?: DigitalFootprintData;
    dataConfidence?: GapDataConfidence;
  };
}

/**
 * Map InitialAssessmentOutput directly to GapFullAssessmentV1
 *
 * This is the canonical mapper for GAP-IA outputs. It produces the unified
 * GapFullAssessmentV1 type that both DMA and OS can consume.
 *
 * Social footprint gating is applied to digitalFootprint subscores and
 * all narratives/recommendations.
 *
 * @param input - Initial assessment input with metadata and detection data
 * @returns GapFullAssessmentV1 canonical assessment
 */
export function mapInitialAssessmentToCanonical(
  input: InitialAssessmentToCanonicalInput
): GapFullAssessmentV1 {
  const { templateOutput, metadata, detectionData } = input;
  const { socialFootprint } = detectionData ?? {};

  // Sanitize quick wins and opportunities using social footprint gating
  const rawQuickWinActions = templateOutput.quickWins.map((qw) => qw.action);
  const sanitized = sanitizeSocialQuickWinsAndOpportunities(
    socialFootprint,
    rawQuickWinActions,
    templateOutput.topOpportunities
  );

  // Build dimensions with gating
  const dimensions = buildCanonicalDimensions(
    templateOutput.dimensionSummaries,
    socialFootprint
  );

  // Build quick wins
  const quickWins: GapQuickWin[] = templateOutput.quickWins.map((qw, index) => ({
    action: sanitized.quickWins[index] ?? qw.action,
    dimensionId: qw.dimensionId as DimensionId | undefined,
    impactLevel: 'high', // Default for IA quick wins
    effortLevel: 'low', // Default for IA quick wins
  }));

  // Normalize maturity stage
  const maturityStage = normalizeMaturityStageToCanonical(
    templateOutput.maturityStage
  );

  // Build the canonical assessment
  const assessment: GapFullAssessmentV1 = {
    // Metadata
    companyName: metadata.companyName,
    url: metadata.url,
    domain: metadata.domain,
    source: metadata.source,
    runId: metadata.runId,
    generatedAt: new Date().toISOString(),
    companyId: metadata.companyId,

    // Overall metrics
    overallScore: templateOutput.marketingReadinessScore,
    maturityStage,
    executiveSummary: templateOutput.executiveSummary,

    // Dimensions
    dimensions,

    // Quick wins and opportunities
    quickWins,
    topOpportunities: sanitized.topOpportunities,

    // Detection data (preserved for downstream consumers)
    socialFootprint,
    digitalFootprintData: detectionData?.digitalFootprint,
    dataConfidence: detectionData?.dataConfidence,

    // Business context
    businessType: templateOutput.businessType,
    brandTier: templateOutput.brandTier,

    // Full GAP sections not populated for initial assessment
    strategicPriorities: undefined,
    roadmap90Days: undefined,
    kpis: undefined,

    // Notes
    notes: templateOutput.notes,
    confidence: templateOutput.confidence,
  };

  return assessment;
}

/**
 * Build canonical dimensions from InitialAssessmentOutput dimension summaries
 */
function buildCanonicalDimensions(
  dimensionSummaries: InitialAssessmentOutput['dimensionSummaries'],
  socialFootprint?: SocialFootprintSnapshot
): GapDimensions {
  const dims: Partial<GapDimensions> = {};

  for (const dim of dimensionSummaries) {
    const baseDimension: DimensionSummary = {
      score: dim.score,
      label: formatDimensionLabel(dim.id),
      oneLiner: dim.summary,
      issues: [dim.keyIssue],
    };

    if (dim.id === 'digitalFootprint') {
      // Apply social footprint gating to digitalFootprint
      const subscores = computeDigitalFootprintSubscores(socialFootprint);
      const gatedScore = computeDigitalFootprintScore(subscores);
      const sanitizedNarrative = sanitizeDigitalFootprintNarrative(
        socialFootprint,
        dim.summary,
        [dim.keyIssue]
      );

      dims.digitalFootprint = {
        score: gatedScore,
        label: formatDimensionLabel(dim.id),
        oneLiner: sanitizedNarrative.oneLiner,
        issues: sanitizedNarrative.issues,
        subscores,
      } as DigitalFootprintDimension;
    } else if (dim.id === 'authority') {
      dims.authority = {
        ...baseDimension,
        subscores: {
          domainAuthority: estimateSubscore(dim.score, 'domain'),
          backlinks: estimateSubscore(dim.score, 'backlinks'),
          brandSearchDemand: estimateSubscore(dim.score, 'brand'),
          industryRecognition: estimateSubscore(dim.score, 'recognition'),
        },
      } as AuthorityDimension;
    } else {
      // Standard dimensions
      (dims as any)[dim.id] = baseDimension;
    }
  }

  // Ensure all dimensions exist
  if (!dims.brand) dims.brand = createEmptyDimension('brand');
  if (!dims.content) dims.content = createEmptyDimension('content');
  if (!dims.seo) dims.seo = createEmptyDimension('seo');
  if (!dims.website) dims.website = createEmptyDimension('website');
  if (!dims.digitalFootprint) {
    dims.digitalFootprint = {
      ...createEmptyDimension('digitalFootprint'),
      subscores: computeDigitalFootprintSubscores(socialFootprint),
    } as DigitalFootprintDimension;
  }
  if (!dims.authority) {
    dims.authority = {
      ...createEmptyDimension('authority'),
      subscores: {
        domainAuthority: 50,
        backlinks: 50,
        brandSearchDemand: 50,
        industryRecognition: 50,
      },
    } as AuthorityDimension;
  }

  return dims as GapDimensions;
}

/**
 * Create empty dimension placeholder
 */
function createEmptyDimension(id: DimensionIdType): DimensionSummary {
  const labels: Record<DimensionIdType, string> = {
    brand: 'Brand & Positioning',
    content: 'Content & Messaging',
    seo: 'SEO & Visibility',
    website: 'Website & Conversion',
    digitalFootprint: 'Digital Footprint',
    authority: 'Authority & Trust',
  };

  return {
    score: 50,
    label: labels[id],
    oneLiner: `${labels[id]} assessment pending`,
    issues: [],
  };
}

/**
 * Normalize maturity stage to canonical GapMaturityStage
 */
function normalizeMaturityStageToCanonical(stage: string): GapMaturityStage {
  const normalized = stage.toLowerCase().trim().replace(/[^a-z]/g, '');

  const mappings: Record<string, GapMaturityStage> = {
    early: 'Foundational',
    earlystage: 'Foundational',
    foundational: 'Foundational',
    foundation: 'Foundational',
    developing: 'Emerging',
    emerging: 'Emerging',
    established: 'Established',
    scaling: 'Established',
    advanced: 'Advanced',
    mature: 'Advanced',
    categoryleader: 'CategoryLeader',
    leader: 'CategoryLeader',
    leading: 'CategoryLeader',
  };

  return mappings[normalized] || 'Emerging';
}

// ============================================================================
// Full GAP Mappers
// ============================================================================

/**
 * Map FullGapOutput (new template) to GrowthAccelerationPlan (existing API format)
 *
 * Purpose: Maintain backward compatibility with existing Full GAP API and Airtable schema
 *
 * Note: This is a simplified mapper that returns key fields. The Full GAP system is complex
 * with many optional fields. This mapper focuses on the core structure matching the template output.
 * Additional fields would be populated by the API handler based on the actual implementation needs.
 *
 * @param templateOutput - Validated output from new template
 * @param gapIaData - Source GAP-IA data (for scores and context)
 * @returns Partial GrowthAccelerationPlan for further enrichment by API handler
 */
export function mapFullGapToApiResponse(
  templateOutput: FullGapOutput,
  gapIaData: {
    url: string;
    businessName: string;
    gapId: string;
  }
): {
  gapId: string;
  websiteUrl: string;
  companyName: string;
  generatedAt: string;
  executiveSummary: string;
  overallScore: number;
  maturityStage: string;
  dimensionScores: Record<string, number>;
  quickWinsSummary: Array<{ action: string; dimensionId: string; impact: string }>;
  strategicPrioritiesSummary: Array<{ title: string; description: string }>;
  roadmapPhases: {
    phase0_30: { actions: string[]; rationale: string };
    phase30_60: { actions: string[]; rationale: string };
    phase60_90: { actions: string[]; rationale: string };
  };
  kpisSummary: Array<{ name: string; description: string }>;
  notes?: string;
} {
  const { url, businessName, gapId } = gapIaData;

  // Extract dimension scores
  const dimensionScores: Record<string, number> = {};
  for (const dim of templateOutput.dimensionAnalyses) {
    dimensionScores[dim.id] = dim.score;
  }

  // Simplify quick wins
  const quickWinsSummary = templateOutput.quickWins.map((qw) => ({
    action: qw.action,
    dimensionId: qw.dimensionId,
    impact: qw.impactLevel,
  }));

  // Simplify strategic priorities
  const strategicPrioritiesSummary = templateOutput.strategicPriorities.map((sp) => ({
    title: sp.title,
    description: sp.description,
  }));

  // Simplify roadmap
  const roadmapPhases = {
    phase0_30: {
      actions: templateOutput.roadmap90Days.phase0_30.actions,
      rationale: templateOutput.roadmap90Days.phase0_30.whyItMatters,
    },
    phase30_60: {
      actions: templateOutput.roadmap90Days.phase30_60.actions,
      rationale: templateOutput.roadmap90Days.phase30_60.whyItMatters,
    },
    phase60_90: {
      actions: templateOutput.roadmap90Days.phase60_90.actions,
      rationale: templateOutput.roadmap90Days.phase60_90.whyItMatters,
    },
  };

  // Simplify KPIs
  const kpisSummary = templateOutput.kpis.map((kpi) => ({
    name: kpi.name,
    description: kpi.whatItMeasures,
  }));

  return {
    gapId,
    websiteUrl: url,
    companyName: businessName,
    generatedAt: new Date().toISOString(),
    executiveSummary: templateOutput.executiveSummary,
    overallScore: templateOutput.overallScore,
    maturityStage: templateOutput.maturityStage,
    dimensionScores,
    quickWinsSummary,
    strategicPrioritiesSummary,
    roadmapPhases,
    kpisSummary,
    notes: templateOutput.notes,
  };
}

