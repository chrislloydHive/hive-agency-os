// lib/gap/canonicalMapper.ts
//
// Canonical GAP Assessment Mappers
//
// This module provides mappers to convert various GAP outputs to the canonical
// GapFullAssessmentV1 type. All GAP pipelines (baseline, full, lead magnet)
// should use these mappers to ensure consistent output shapes.
//
// Key functions:
// - mapBaselineCoreToFullAssessment: Converts baseline GAP-IA output to canonical type
// - mapFullGapToFullAssessment: Converts full GAP output to canonical type
// - projectToBaselineSummary: Creates lean projection for UI components
//
// Social/Digital footprint gating is applied centrally in these mappers,
// ensuring consistent behavior across all sources.
//
// ============================================================================

import type {
  GapFullAssessmentV1,
  BaselineGapSummary,
  GapDimensions,
  GapQuickWin,
  GapMaturityStage,
  GapAssessmentSource,
  DimensionSummary,
  DigitalFootprintDimension,
  AuthorityDimension,
  SocialFootprintSnapshot,
  DigitalFootprintData,
  GapDataConfidence,
  GapIaBenchmarks,
  DimensionId,
  GapStrategicPriority,
  GapRoadmap90Days,
  GapKPI,
} from './types';
import type { GapIaV2AiOutput } from './outputMappers';
import type { InitialAssessmentOutput, FullGapOutput, DimensionIdType } from './outputTemplates';
import {
  computeDigitalFootprintSubscores,
  computeDigitalFootprintScore,
  sanitizeDigitalFootprintNarrative,
  sanitizeSocialQuickWinsAndOpportunities,
} from './socialFootprintGating';

// ============================================================================
// Types for Mapper Input
// ============================================================================

/**
 * Input for mapping baseline GAP-IA to canonical format
 */
export interface BaselineCoreToCanonicalInput {
  /** Core GAP-IA V2 API output */
  coreResult: GapIaV2AiOutput;

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

  /** Business context */
  businessContext?: {
    businessType?: string;
    brandTier?: string;
    companyType?: string;
  };

  /** Benchmarks (if available) */
  benchmarks?: GapIaBenchmarks;
}

/**
 * Input for mapping full GAP output to canonical format
 */
export interface FullGapToCanonicalInput {
  /** Full GAP LLM output (validated) */
  fullGapOutput: FullGapOutput;

  /** GAP-IA dimensions (scores are read-only from IA) */
  gapIaDimensions: GapDimensions;

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

  /** Business context */
  businessContext?: {
    businessType?: string;
    brandTier?: string;
    companyType?: string;
  };

  /** Benchmarks (if available) */
  benchmarks?: GapIaBenchmarks;
}

// ============================================================================
// Maturity Stage Normalization
// ============================================================================

/**
 * Normalize maturity stage from various formats to canonical GapMaturityStage
 */
export function normalizeMaturityStage(
  stage: string | undefined
): GapMaturityStage {
  if (!stage) return 'Emerging';

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
// Baseline Core → GapFullAssessmentV1
// ============================================================================

/**
 * Map baseline GAP-IA core result to GapFullAssessmentV1
 *
 * This is the primary mapper for OS baseline context building.
 * It applies social/GBP gating to ensure dimensions and recommendations
 * are consistent with detection data.
 *
 * @param input - Baseline core input with metadata and detection data
 * @returns GapFullAssessmentV1 canonical assessment
 */
export function mapBaselineCoreToFullAssessment(
  input: BaselineCoreToCanonicalInput
): GapFullAssessmentV1 {
  const { coreResult, metadata, detectionData, businessContext, benchmarks } = input;
  const { socialFootprint } = detectionData ?? {};

  // Extract and gate dimensions
  const dimensions = buildGatedDimensions(coreResult, socialFootprint);

  // Extract and sanitize quick wins and opportunities
  const rawQuickWins = extractQuickWinsFromCore(coreResult);
  const rawOpportunities = coreResult.summary?.topOpportunities ?? [];

  const sanitized = sanitizeSocialQuickWinsAndOpportunities(
    socialFootprint,
    rawQuickWins.map((qw) => qw.action),
    rawOpportunities
  );

  // Build canonical quick wins
  const quickWins: GapQuickWin[] = rawQuickWins.map((qw, index) => ({
    action: sanitized.quickWins[index] ?? qw.action,
    dimensionId: qw.dimensionId,
    impactLevel: qw.impactLevel,
    effortLevel: qw.effortLevel,
  }));

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
    overallScore: coreResult.summary?.overallScore ?? 0,
    maturityStage: normalizeMaturityStage(coreResult.summary?.maturityStage),
    executiveSummary: coreResult.summary?.narrative ?? '',

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
    businessType: businessContext?.businessType,
    brandTier: businessContext?.brandTier,
    companyType: businessContext?.companyType as any,

    // Benchmarks
    benchmarks,

    // Full GAP sections not populated for baseline
    strategicPriorities: undefined,
    roadmap90Days: undefined,
    kpis: undefined,

    // Notes
    notes: undefined,
    confidence: detectionData?.dataConfidence?.level,
  };

  return assessment;
}

// ============================================================================
// Full GAP → GapFullAssessmentV1
// ============================================================================

/**
 * Map full GAP output to GapFullAssessmentV1
 *
 * This is the primary mapper for DMA full GAP reports.
 * Scores are read-only from GAP-IA (passed via gapIaDimensions).
 * Social/GBP gating is applied to narratives and recommendations.
 *
 * @param input - Full GAP input with metadata and detection data
 * @returns GapFullAssessmentV1 canonical assessment with plan sections
 */
export function mapFullGapToFullAssessment(
  input: FullGapToCanonicalInput
): GapFullAssessmentV1 {
  const {
    fullGapOutput,
    gapIaDimensions,
    metadata,
    detectionData,
    businessContext,
    benchmarks,
  } = input;
  const { socialFootprint } = detectionData ?? {};

  // Use dimensions from GAP-IA (scores are read-only)
  // Apply gating to narratives where needed
  const dimensions = applyGatingToDimensions(gapIaDimensions, socialFootprint);

  // Extract and sanitize quick wins
  const rawQuickWins: GapQuickWin[] = fullGapOutput.quickWins.map((qw) => ({
    action: qw.action,
    dimensionId: qw.dimensionId as DimensionId,
    impactLevel: qw.impactLevel,
    effortLevel: qw.effortLevel,
    expectedOutcome: qw.expectedOutcome,
  }));

  const sanitized = sanitizeSocialQuickWinsAndOpportunities(
    socialFootprint,
    rawQuickWins.map((qw) => qw.action),
    [] // Full GAP uses strategicPriorities instead of topOpportunities
  );

  const quickWins: GapQuickWin[] = rawQuickWins.map((qw, index) => ({
    ...qw,
    action: sanitized.quickWins[index] ?? qw.action,
  }));

  // Extract top opportunities from strategic priorities
  const topOpportunities = fullGapOutput.strategicPriorities
    .slice(0, 5)
    .map((sp) => sp.title);

  // Build strategic priorities
  const strategicPriorities: GapStrategicPriority[] =
    fullGapOutput.strategicPriorities.map((sp) => ({
      title: sp.title,
      description: sp.description,
      relatedDimensions: sp.relatedDimensions as DimensionId[] | undefined,
      timeframe: sp.timeframe,
    }));

  // Build roadmap
  const roadmap90Days: GapRoadmap90Days = {
    phase0_30: {
      whyItMatters: fullGapOutput.roadmap90Days.phase0_30.whyItMatters,
      actions: fullGapOutput.roadmap90Days.phase0_30.actions,
    },
    phase30_60: {
      whyItMatters: fullGapOutput.roadmap90Days.phase30_60.whyItMatters,
      actions: fullGapOutput.roadmap90Days.phase30_60.actions,
    },
    phase60_90: {
      whyItMatters: fullGapOutput.roadmap90Days.phase60_90.whyItMatters,
      actions: fullGapOutput.roadmap90Days.phase60_90.actions,
    },
  };

  // Build KPIs
  const kpis: GapKPI[] = fullGapOutput.kpis.map((kpi) => ({
    name: kpi.name,
    whatItMeasures: kpi.whatItMeasures,
    whyItMatters: kpi.whyItMatters,
    whatGoodLooksLike: kpi.whatGoodLooksLike,
    relatedDimensions: kpi.relatedDimensions as DimensionId[] | undefined,
  }));

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

    // Overall metrics (from full GAP output, validated against GAP-IA)
    overallScore: fullGapOutput.overallScore,
    maturityStage: fullGapOutput.maturityStage as GapMaturityStage,
    executiveSummary: fullGapOutput.executiveSummary,

    // Dimensions (from GAP-IA, gated)
    dimensions,

    // Quick wins and opportunities
    quickWins,
    topOpportunities,

    // Detection data
    socialFootprint,
    digitalFootprintData: detectionData?.digitalFootprint,
    dataConfidence: detectionData?.dataConfidence,

    // Full GAP plan sections
    strategicPriorities,
    roadmap90Days,
    kpis,

    // Business context
    businessType: businessContext?.businessType,
    brandTier: businessContext?.brandTier,
    companyType: businessContext?.companyType as any,

    // Benchmarks
    benchmarks,

    // Notes
    notes: fullGapOutput.notes,
    confidence: fullGapOutput.confidence,
  };

  return assessment;
}

// ============================================================================
// Projection Functions
// ============================================================================

/**
 * Project GapFullAssessmentV1 to BaselineGapSummary
 *
 * Creates a lean view of the canonical assessment for UI components
 * that don't need full GAP plan sections.
 *
 * @param full - Full canonical assessment
 * @returns Lean baseline summary projection
 */
export function projectToBaselineSummary(
  full: GapFullAssessmentV1
): BaselineGapSummary {
  return {
    companyName: full.companyName,
    url: full.url,
    domain: full.domain,
    source: full.source,
    runId: full.runId,
    generatedAt: full.generatedAt,
    companyId: full.companyId,

    overallScore: full.overallScore,
    maturityStage: full.maturityStage,
    executiveSummary: full.executiveSummary,

    dimensions: full.dimensions,

    quickWins: full.quickWins,
    topOpportunities: full.topOpportunities,

    socialFootprint: full.socialFootprint,
    dataConfidence: full.dataConfidence,

    businessType: full.businessType,
    brandTier: full.brandTier,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build gated dimensions from core result
 *
 * Applies social footprint gating to digitalFootprint subscores and narratives.
 */
function buildGatedDimensions(
  coreResult: GapIaV2AiOutput,
  socialFootprint?: SocialFootprintSnapshot
): GapDimensions {
  const dims = coreResult.dimensions;

  // Build base dimensions (non-gated)
  const brand: DimensionSummary = dims.brand ?? createEmptyDimension('brand');
  const content: DimensionSummary = dims.content ?? createEmptyDimension('content');
  const seo: DimensionSummary = dims.seo ?? createEmptyDimension('seo');
  const website: DimensionSummary = dims.website ?? createEmptyDimension('website');

  // Build gated digitalFootprint dimension
  const rawDf = dims.digitalFootprint;
  const subscores = computeDigitalFootprintSubscores(socialFootprint);
  const gatedScore = computeDigitalFootprintScore(subscores);
  const sanitizedNarrative = sanitizeDigitalFootprintNarrative(
    socialFootprint,
    rawDf?.oneLiner ?? 'Digital presence needs improvement',
    rawDf?.issues ?? []
  );

  const digitalFootprint: DigitalFootprintDimension = {
    score: gatedScore,
    label: rawDf?.label ?? 'Digital Footprint',
    oneLiner: sanitizedNarrative.oneLiner,
    issues: sanitizedNarrative.issues,
    narrative: rawDf?.narrative,
    subscores,
  };

  // Authority dimension (no gating, but ensure subscores exist)
  const rawAuth = dims.authority;
  const authority: AuthorityDimension = rawAuth ?? {
    score: 50,
    label: 'Authority',
    oneLiner: 'Authority and trust signals need assessment',
    issues: [],
    subscores: {
      domainAuthority: 50,
      backlinks: 50,
      brandSearchDemand: 50,
      industryRecognition: 50,
    },
  };

  return {
    brand,
    content,
    seo,
    website,
    digitalFootprint,
    authority,
  };
}

/**
 * Apply gating to existing dimensions
 *
 * Used when dimensions already exist (e.g., from GAP-IA) and we need
 * to apply gating to narratives only.
 */
function applyGatingToDimensions(
  dims: GapDimensions,
  socialFootprint?: SocialFootprintSnapshot
): GapDimensions {
  // Recompute digitalFootprint subscores from detection
  const subscores = computeDigitalFootprintSubscores(socialFootprint);
  const gatedScore = computeDigitalFootprintScore(subscores);
  const sanitizedNarrative = sanitizeDigitalFootprintNarrative(
    socialFootprint,
    dims.digitalFootprint.oneLiner,
    dims.digitalFootprint.issues
  );

  return {
    ...dims,
    digitalFootprint: {
      ...dims.digitalFootprint,
      score: gatedScore,
      oneLiner: sanitizedNarrative.oneLiner,
      issues: sanitizedNarrative.issues,
      subscores,
    },
  };
}

/**
 * Extract quick wins from core result in standardized format
 */
function extractQuickWinsFromCore(
  coreResult: GapIaV2AiOutput
): GapQuickWin[] {
  const bullets = coreResult.quickWins?.bullets ?? [];

  return bullets.map((bullet) => ({
    action: typeof bullet === 'string' ? bullet : bullet.action ?? '',
    dimensionId: typeof bullet === 'object' ? inferDimensionFromCategory(bullet.category) : undefined,
    impactLevel: typeof bullet === 'object' ? bullet.expectedImpact : undefined,
    effortLevel: typeof bullet === 'object' ? bullet.effortLevel : undefined,
  }));
}

/**
 * Create empty dimension placeholder
 */
function createEmptyDimension(id: DimensionId): DimensionSummary {
  const labels: Record<DimensionId, string> = {
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
 * Infer dimension ID from category string
 */
function inferDimensionFromCategory(
  category: string | undefined
): DimensionId | undefined {
  if (!category) return undefined;

  const mappings: Record<string, DimensionId> = {
    Brand: 'brand',
    Content: 'content',
    SEO: 'seo',
    'Website & Conversion': 'website',
    Website: 'website',
    Other: 'digitalFootprint',
  };

  return mappings[category];
}

// ============================================================================
// Exports
// ============================================================================

// Note: BaselineCoreToCanonicalInput and FullGapToCanonicalInput are
// already exported inline with their interface declarations above.
