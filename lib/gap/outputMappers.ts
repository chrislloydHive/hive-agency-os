// lib/gap/outputMappers.ts
// Backward compatibility mappers for GAP output templates
// These map from the new canonical templates to existing API/Airtable formats

import type {
  InitialAssessmentOutput,
  FullGapOutput,
  DimensionIdType,
} from './outputTemplates';
import type {
  GapIaV2Result,
  GapIaSummary,
  GapIaDimensions,
  DimensionSummary,
  DigitalFootprintDimension,
  AuthorityDimension,
  BreakdownItem,
  QuickWinItem,
  CoreMarketingContext,
  DiagnosticCategory,
} from './types';
import type { GrowthAccelerationPlan } from '../growth-plan/types';

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
  }
): GapIaV2AiOutput {
  const { url, domain, businessName, companyType, brandTier } = enrichmentData;

  // Map summary
  const summary: GapIaSummary = {
    overallScore: templateOutput.marketingReadinessScore,
    maturityStage: mapMaturityStageToLegacy(templateOutput.maturityStage),
    headlineDiagnosis: generateHeadlineDiagnosis(templateOutput),
    narrative: templateOutput.executiveSummary,
    topOpportunities: templateOutput.topOpportunities,
  };

  // Map dimensions (convert array to object structure)
  const dimensions: GapIaDimensions = mapDimensionSummariesToLegacy(templateOutput.dimensionSummaries);

  // Map breakdown (generate from dimension key issues)
  const breakdown = {
    bullets: generateBreakdownBullets(templateOutput),
  };

  // Map quick wins
  const quickWins = {
    bullets: templateOutput.quickWins.map((qw, index) => ({
      category: mapDimensionToCategory(qw.dimensionId || inferDimensionFromAction(qw.action)),
      action: qw.action,
      expectedImpact: 'high' as const, // Default for IA quick wins
      effortLevel: 'low' as const, // Default for IA quick wins
    })),
  };

  // Generate legacy core object (required for Airtable)
  const core: CoreMarketingContext = generateCoreContext(
    url,
    domain,
    businessName,
    templateOutput.dimensionSummaries,
    enrichmentData
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
 */
function mapDimensionSummariesToLegacy(
  dimensionSummaries: InitialAssessmentOutput['dimensionSummaries']
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
      dimensions.digitalFootprint = {
        ...baseDimension,
        subscores: {
          googleBusinessProfile: estimateSubscore(dim.score, 'gbp'),
          linkedinPresence: estimateSubscore(dim.score, 'linkedin'),
          socialPresence: estimateSubscore(dim.score, 'social'),
          reviewsReputation: estimateSubscore(dim.score, 'reviews'),
        },
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
  enrichmentData: any
): CoreMarketingContext {
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

    // Quick summary (use first topOpportunity or generate)
    quickSummary: '', // Will be populated by API handler
    topOpportunities: [], // Will be populated by API handler
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
function estimateSubscore(overallScore: number, subcategory: string): number {
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
    domain: string;
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
  const { url, domain, businessName, gapId } = gapIaData;

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

