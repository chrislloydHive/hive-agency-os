// lib/gap/outputTemplates.ts
// Shared, strongly-typed output templates for GAP-IA and Full GAP
// This ensures consistent structure and prevents drift across assessment types

import { z } from 'zod';

// ============================================================================
// Shared Constants & Types
// ============================================================================

/**
 * Maturity stages used across both GAP-IA and Full GAP
 * Normalized from LLM variations (e.g., "early" → "Foundational")
 */
export const MaturityStage = z.enum([
  'Foundational',
  'Emerging',
  'Established',
  'Advanced',
  'CategoryLeader',
]);
export type MaturityStageType = z.infer<typeof MaturityStage>;

/**
 * Six core marketing dimensions
 * These are consistent across all GAP assessments
 */
export const DimensionId = z.enum([
  'brand',
  'content',
  'seo',
  'website',
  'digitalFootprint',
  'authority',
]);
export type DimensionIdType = z.infer<typeof DimensionId>;

/**
 * Impact level for recommendations
 */
export const ImpactLevel = z.enum(['low', 'medium', 'high']);
export type ImpactLevelType = z.infer<typeof ImpactLevel>;

/**
 * Effort level for recommendations
 */
export const EffortLevel = z.enum(['low', 'medium', 'high']);
export type EffortLevelType = z.infer<typeof EffortLevel>;

// ============================================================================
// GAP-IA (Initial Assessment) Output Template
// ============================================================================

/**
 * Single dimension summary for GAP-IA
 *
 * Purpose: Concise, scannable assessment of one marketing dimension
 * Constraints:
 * - summary: 1 sentence (60-90 chars recommended)
 * - keyIssue: 1 specific issue (40-80 chars recommended)
 * - Must NOT repeat across dimensions (enforce in prompt/heuristics)
 */
export const InitialAssessmentDimensionSchema = z.object({
  id: DimensionId,
  score: z.number().min(0).max(100),
  summary: z.string().min(1).max(500), // Short summary for scannable view
  keyIssue: z.string().min(1).max(500), // Single most critical issue

  // NOTE: In future prompt updates, enforce that keyIssue values are:
  // 1. Non-overlapping across dimensions
  // 2. Specific to this dimension's domain
  // 3. Actionable (not just descriptive)
});
export type InitialAssessmentDimension = z.infer<typeof InitialAssessmentDimensionSchema>;

/**
 * Quick win recommendation (tactical, high-impact actions)
 *
 * Constraints:
 * - Exactly 3 items required
 * - Each item: 1 concise sentence (80-120 chars recommended)
 * - Must be actionable without further research
 */
export const InitialAssessmentQuickWinSchema = z.object({
  action: z.string().min(1).max(300),
  dimensionId: DimensionId.optional(), // Which dimension this addresses (optional for IA)
});
export type InitialAssessmentQuickWin = z.infer<typeof InitialAssessmentQuickWinSchema>;

/**
 * Top opportunity (strategic insight)
 *
 * Constraints:
 * - Exactly 3 items required
 * - Each item: 1 sentence describing strategic potential
 */
export const InitialAssessmentOpportunitySchema = z.string().min(1).max(300);

/**
 * Complete GAP-IA output structure
 *
 * This is the canonical shape that the LLM MUST return for Initial Assessment.
 * All fields are required unless marked optional.
 *
 * Validation rules:
 * - Exactly 6 dimensions (all DimensionId values)
 * - Exactly 3 topOpportunities
 * - Exactly 3 quickWins
 * - marketingReadinessScore = average of all dimension scores (recalculated)
 */
export const InitialAssessmentOutputSchema = z.object({
  // Executive Summary
  executiveSummary: z.string().min(100).max(1000), // 2-3 paragraphs

  // Overall Metrics
  marketingReadinessScore: z.number().min(0).max(100),
  maturityStage: MaturityStage,

  // Strategic Insights (constrained arrays)
  topOpportunities: z.array(InitialAssessmentOpportunitySchema)
    .length(3) // EXACTLY 3 required
    .describe('Three highest-leverage opportunities (1 sentence each)'),

  quickWins: z.array(InitialAssessmentQuickWinSchema)
    .length(3) // EXACTLY 3 required
    .describe('Three immediate tactical wins (1 sentence each)'),

  // Dimension Summaries (all 6 required)
  dimensionSummaries: z.array(InitialAssessmentDimensionSchema)
    .length(6) // EXACTLY 6 required (brand, content, seo, website, digitalFootprint, authority)
    .refine(
      (dims) => {
        const ids = dims.map((d) => d.id);
        return ids.length === new Set(ids).size; // All unique
      },
      { message: 'All dimension IDs must be unique' }
    )
    .refine(
      (dims) => {
        const required: DimensionIdType[] = ['brand', 'content', 'seo', 'website', 'digitalFootprint', 'authority'];
        const ids = dims.map((d) => d.id);
        return required.every((req) => ids.includes(req));
      },
      { message: 'Must include all 6 required dimensions' }
    ),

  // Business context (optional but highly recommended for heuristics)
  businessType: z.string().optional().describe('Type of business (e.g., b2b_saas, local_business, ecommerce)'),
  brandTier: z.string().optional().describe('Brand tier (e.g., enterprise, smb, startup, global_category_leader)'),
  businessName: z.string().optional().describe('Business or brand name'),

  // Optional metadata
  notes: z.string().optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});
export type InitialAssessmentOutput = z.infer<typeof InitialAssessmentOutputSchema>;

// ============================================================================
// Full GAP (Growth Acceleration Plan) Output Template
// ============================================================================

/**
 * Detailed dimension analysis for Full GAP
 *
 * Purpose: Deep strategic analysis with specific findings and recommendations
 * Constraints:
 * - summary: 1-2 sentences (high-level takeaway)
 * - detailedAnalysis: 3-5 paragraphs of strategic insight
 * - keyFindings: 3-5 bullet points (specific, actionable observations)
 */
export const FullGapDimensionAnalysisSchema = z.object({
  id: DimensionId,
  score: z.number().min(0).max(100), // Read-only from GAP-IA

  summary: z.string().min(1).max(500), // High-level takeaway
  detailedAnalysis: z.string().min(150).max(5000), // Deep strategic analysis (1-5 paragraphs)

  keyFindings: z.array(z.string().min(1).max(500))
    .min(3)
    .max(5)
    .describe('3-5 specific, actionable findings from analysis'),

  // NOTE: For future non-repetition enforcement:
  // - keyFindings should not duplicate findings from other dimensions
  // - Each finding should be specific to this dimension's domain
  // - Avoid generic statements that could apply to any dimension
});
export type FullGapDimensionAnalysis = z.infer<typeof FullGapDimensionAnalysisSchema>;

/**
 * Quick win for Full GAP (more detailed than IA)
 *
 * Purpose: Tactical action with clear ROI within 30-60 days
 * Constraints:
 * - action: "Do X so that Y" format (what + why)
 * - 3-5 items required
 * - Effort vs impact tradeoff clearly stated
 */
export const FullGapQuickWinSchema = z.object({
  dimensionId: DimensionId,
  action: z.string().min(1).max(500).describe('Action in "Do X so that Y" format'),
  impactLevel: ImpactLevel,
  effortLevel: EffortLevel,
  expectedOutcome: z.string().min(1).max(300).optional(), // What success looks like
});
export type FullGapQuickWin = z.infer<typeof FullGapQuickWinSchema>;

/**
 * Strategic priority (larger than quick win, requires multiple steps)
 *
 * Purpose: Multi-step program or initiative (2-6 months)
 * Constraints:
 * - title: Concise name (3-8 words)
 * - description: 2-4 sentences explaining the initiative
 * - Must be larger scope than quick wins
 */
export const FullGapStrategicPrioritySchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(100).max(1000),
  relatedDimensions: z.array(DimensionId).min(1).max(3).optional(), // Which dimensions this addresses
  timeframe: z.enum(['short', 'medium', 'long']).optional(), // 0-3mo, 3-6mo, 6-12mo
});
export type FullGapStrategicPriority = z.infer<typeof FullGapStrategicPrioritySchema>;

/**
 * Roadmap phase (30-day increment)
 *
 * Purpose: Break down 90-day plan into digestible phases
 * Constraints:
 * - whyItMatters: 1-2 sentences on strategic rationale
 * - actions: 3-7 specific actions for this phase
 */
export const FullGapRoadmapPhaseSchema = z.object({
  whyItMatters: z.string().min(50).max(500),
  actions: z.array(z.string().min(1).max(300))
    .min(3)
    .max(7)
    .describe('Specific actions to take in this 30-day phase'),
});
export type FullGapRoadmapPhase = z.infer<typeof FullGapRoadmapPhaseSchema>;

/**
 * KPI definition (what to measure and why)
 *
 * Purpose: Define success metrics with context
 * Constraints:
 * - name: Short metric name (e.g., "Organic Search Traffic")
 * - whatItMeasures: 1 sentence technical definition
 * - whyItMatters: 1-2 sentences on business impact
 * - whatGoodLooksLike: Specific benchmark or threshold
 */
export const FullGapKPISchema = z.object({
  name: z.string().min(1).max(200),
  whatItMeasures: z.string().min(1).max(500),
  whyItMatters: z.string().min(1).max(500),
  whatGoodLooksLike: z.string().min(1).max(500),
  relatedDimensions: z.array(DimensionId).min(1).max(3).optional(),
});
export type FullGapKPI = z.infer<typeof FullGapKPISchema>;

/**
 * Complete Full GAP output structure
 *
 * This is the canonical shape that the LLM MUST return for Full GAP.
 * All fields are required unless marked optional.
 *
 * Critical constraints:
 * - Scores are READ-ONLY (inherited from GAP-IA, never re-scored)
 * - Quick wins: 3-5 items (tactical, immediate impact)
 * - Strategic priorities: 3-7 items (larger initiatives)
 * - Roadmap: Exactly 3 phases (0-30, 30-60, 60-90 days)
 * - KPIs: 4-8 items (balanced across dimensions)
 *
 * Voice:
 * - JSON output: Third-person or neutral
 * - Markdown output: Second-person ("you/your")
 */
export const FullGapOutputSchema = z.object({
  // Executive Summary
  executiveSummary: z.string().min(200).max(2000), // 3-5 paragraphs

  // Overall Metrics (READ-ONLY from GAP-IA)
  overallScore: z.number().min(0).max(100),
  maturityStage: MaturityStage,

  // Deep Dimension Analysis (all 6 required)
  dimensionAnalyses: z.array(FullGapDimensionAnalysisSchema)
    .length(6) // EXACTLY 6 required
    .refine(
      (dims) => {
        const ids = dims.map((d) => d.id);
        return ids.length === new Set(ids).size;
      },
      { message: 'All dimension IDs must be unique' }
    )
    .refine(
      (dims) => {
        const required: DimensionIdType[] = ['brand', 'content', 'seo', 'website', 'digitalFootprint', 'authority'];
        const ids = dims.map((d) => d.id);
        return required.every((req) => ids.includes(req));
      },
      { message: 'Must include all 6 required dimensions' }
    ),

  // Tactical Recommendations (constrained arrays)
  quickWins: z.array(FullGapQuickWinSchema)
    .min(3)
    .max(5)
    .describe('3-5 immediate tactical wins (30-60 day timeframe)'),

  // Strategic Recommendations
  strategicPriorities: z.array(FullGapStrategicPrioritySchema)
    .min(3)
    .max(7)
    .describe('3-7 larger strategic initiatives (2-6 month timeframe)'),

  // 90-Day Roadmap (exactly 3 phases)
  roadmap90Days: z.object({
    phase0_30: FullGapRoadmapPhaseSchema,
    phase30_60: FullGapRoadmapPhaseSchema,
    phase60_90: FullGapRoadmapPhaseSchema,
  }).describe('Three 30-day phases breaking down the first 90 days'),

  // Success Metrics
  kpis: z.array(FullGapKPISchema)
    .min(4)
    .max(8)
    .describe('4-8 key performance indicators to track progress'),

  // Optional metadata
  notes: z.string().optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});
export type FullGapOutput = z.infer<typeof FullGapOutputSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate and normalize InitialAssessmentOutput from LLM response
 *
 * Handles common LLM variations:
 * - Trim/fill arrays to required counts
 * - Normalize enum values
 * - Recalculate overall score
 * - Log warnings for malformed data
 *
 * @param rawOutput - Unvalidated LLM response
 * @param options - Validation options (e.g., strict mode)
 * @returns Validated and normalized output
 */
export function validateInitialAssessmentOutput(
  rawOutput: unknown,
  options: { strict?: boolean } = {}
): InitialAssessmentOutput {
  const { strict = false } = options;

  // First pass: parse with Zod
  let parsed: any;
  try {
    parsed = InitialAssessmentOutputSchema.parse(rawOutput);
  } catch (error) {
    // If not strict, attempt to repair
    if (!strict && typeof rawOutput === 'object' && rawOutput !== null) {
      console.warn('[outputTemplates] Initial validation failed, attempting repair:', error);
      parsed = repairInitialAssessmentOutput(rawOutput);
    } else {
      throw error;
    }
  }

  // Recalculate overall score (LLM may generate inconsistent scores)
  const dimensionScores = parsed.dimensionSummaries.map((d: any) => d.score);
  const recalculatedScore = Math.round(
    dimensionScores.reduce((sum: number, score: number) => sum + score, 0) / dimensionScores.length
  );

  if (Math.abs(recalculatedScore - parsed.marketingReadinessScore) > 2) {
    console.warn(
      `[outputTemplates] Score mismatch - LLM: ${parsed.marketingReadinessScore}, Calculated: ${recalculatedScore}. Using calculated.`
    );
    parsed.marketingReadinessScore = recalculatedScore;
  }

  return parsed;
}

/**
 * Repair malformed InitialAssessmentOutput
 *
 * Common repairs:
 * - Trim or fill topOpportunities to exactly 3
 * - Trim or fill quickWins to exactly 3
 * - Fill missing dimensions with placeholders
 * - Normalize maturity stage enum
 */
function repairInitialAssessmentOutput(rawOutput: any): InitialAssessmentOutput {
  const repaired: any = { ...rawOutput };

  // Repair topOpportunities (must be exactly 3)
  if (!Array.isArray(repaired.topOpportunities)) {
    repaired.topOpportunities = [];
  }
  while (repaired.topOpportunities.length < 3) {
    console.warn('[outputTemplates] Filling missing topOpportunity with placeholder');
    repaired.topOpportunities.push('TBD - Additional opportunity to be identified');
  }
  if (repaired.topOpportunities.length > 3) {
    console.warn(`[outputTemplates] Trimming topOpportunities from ${repaired.topOpportunities.length} to 3`);
    repaired.topOpportunities = repaired.topOpportunities.slice(0, 3);
  }

  // Repair quickWins (must be exactly 3)
  if (!Array.isArray(repaired.quickWins)) {
    repaired.quickWins = [];
  }
  while (repaired.quickWins.length < 3) {
    console.warn('[outputTemplates] Filling missing quickWin with placeholder');
    repaired.quickWins.push({ action: 'TBD - Additional quick win to be identified' });
  }
  if (repaired.quickWins.length > 3) {
    console.warn(`[outputTemplates] Trimming quickWins from ${repaired.quickWins.length} to 3`);
    repaired.quickWins = repaired.quickWins.slice(0, 3);
  }

  // Repair dimensionSummaries (must be exactly 6)
  if (!Array.isArray(repaired.dimensionSummaries)) {
    repaired.dimensionSummaries = [];
  }
  const requiredDimensions: DimensionIdType[] = ['brand', 'content', 'seo', 'website', 'digitalFootprint', 'authority'];
  const existingIds = new Set(repaired.dimensionSummaries.map((d: any) => d.id));

  for (const dimId of requiredDimensions) {
    if (!existingIds.has(dimId)) {
      console.warn(`[outputTemplates] Filling missing dimension: ${dimId}`);
      repaired.dimensionSummaries.push({
        id: dimId,
        score: 50, // Placeholder score
        summary: `TBD - ${dimId} analysis to be completed`,
        keyIssue: `TBD - Key issue for ${dimId} to be identified`,
      });
    }
  }

  // Normalize maturityStage enum
  if (typeof repaired.maturityStage === 'string') {
    const normalized = normalizeMaturityStage(repaired.maturityStage);
    if (normalized !== repaired.maturityStage) {
      console.warn(`[outputTemplates] Normalized maturityStage: ${repaired.maturityStage} → ${normalized}`);
      repaired.maturityStage = normalized;
    }
  }

  return InitialAssessmentOutputSchema.parse(repaired);
}

/**
 * Validate and normalize FullGapOutput from LLM response
 *
 * Handles common LLM variations:
 * - Trim/fill arrays to required counts
 * - Normalize enum values
 * - Ensure scores match GAP-IA (read-only)
 * - Log warnings for malformed data
 *
 * @param rawOutput - Unvalidated LLM response
 * @param gapIaScores - Scores from GAP-IA (for validation)
 * @param options - Validation options (e.g., strict mode)
 * @returns Validated and normalized output
 */
export function validateFullGapOutput(
  rawOutput: unknown,
  gapIaScores: { overall: number; dimensions: Record<DimensionIdType, number> },
  options: { strict?: boolean } = {}
): FullGapOutput {
  const { strict = false } = options;

  // First pass: parse with Zod
  let parsed: any;
  try {
    parsed = FullGapOutputSchema.parse(rawOutput);
  } catch (error) {
    // If not strict, attempt to repair
    if (!strict && typeof rawOutput === 'object' && rawOutput !== null) {
      console.warn('[outputTemplates] Full GAP validation failed, attempting repair:', error);
      parsed = repairFullGapOutput(rawOutput);
    } else {
      throw error;
    }
  }

  // Validate scores match GAP-IA (read-only constraint)
  if (Math.abs(parsed.overallScore - gapIaScores.overall) > 2) {
    console.warn(
      `[outputTemplates] Overall score mismatch - Full GAP: ${parsed.overallScore}, GAP-IA: ${gapIaScores.overall}. Using GAP-IA score.`
    );
    parsed.overallScore = gapIaScores.overall;
  }

  for (const dimAnalysis of parsed.dimensionAnalyses) {
    const expectedScore = gapIaScores.dimensions[dimAnalysis.id as DimensionIdType];
    if (expectedScore !== undefined && Math.abs(dimAnalysis.score - expectedScore) > 2) {
      console.warn(
        `[outputTemplates] ${dimAnalysis.id} score mismatch - Full GAP: ${dimAnalysis.score}, GAP-IA: ${expectedScore}. Using GAP-IA score.`
      );
      dimAnalysis.score = expectedScore;
    }
  }

  return parsed;
}

/**
 * Repair malformed FullGapOutput
 *
 * Common repairs:
 * - Trim or fill arrays to required counts
 * - Fill missing dimensions with placeholders
 * - Normalize enum values
 */
function repairFullGapOutput(rawOutput: any): FullGapOutput {
  const repaired: any = { ...rawOutput };

  // Repair quickWins (must be 3-5)
  if (!Array.isArray(repaired.quickWins)) {
    repaired.quickWins = [];
  }
  while (repaired.quickWins.length < 3) {
    console.warn('[outputTemplates] Filling missing quickWin with placeholder');
    repaired.quickWins.push({
      dimensionId: 'brand',
      action: 'TBD - Additional quick win to be identified',
      impactLevel: 'medium',
      effortLevel: 'low',
    });
  }
  if (repaired.quickWins.length > 5) {
    console.warn(`[outputTemplates] Trimming quickWins from ${repaired.quickWins.length} to 5`);
    repaired.quickWins = repaired.quickWins.slice(0, 5);
  }

  // Repair strategicPriorities (must be 3-7)
  if (!Array.isArray(repaired.strategicPriorities)) {
    repaired.strategicPriorities = [];
  }
  while (repaired.strategicPriorities.length < 3) {
    console.warn('[outputTemplates] Filling missing strategicPriority with placeholder');
    repaired.strategicPriorities.push({
      title: 'TBD - Additional strategic priority',
      description: 'To be defined based on deeper analysis of business context and goals.',
    });
  }
  if (repaired.strategicPriorities.length > 7) {
    console.warn(`[outputTemplates] Trimming strategicPriorities from ${repaired.strategicPriorities.length} to 7`);
    repaired.strategicPriorities = repaired.strategicPriorities.slice(0, 7);
  }

  // Repair kpis (must be 4-8)
  if (!Array.isArray(repaired.kpis)) {
    repaired.kpis = [];
  }
  while (repaired.kpis.length < 4) {
    console.warn('[outputTemplates] Filling missing KPI with placeholder');
    repaired.kpis.push({
      name: 'TBD - Additional KPI',
      whatItMeasures: 'To be defined',
      whyItMatters: 'To be determined based on strategic priorities',
      whatGoodLooksLike: 'Benchmarks to be established',
    });
  }
  if (repaired.kpis.length > 8) {
    console.warn(`[outputTemplates] Trimming kpis from ${repaired.kpis.length} to 8`);
    repaired.kpis = repaired.kpis.slice(0, 8);
  }

  // Repair dimensionAnalyses (must be exactly 6)
  if (!Array.isArray(repaired.dimensionAnalyses)) {
    repaired.dimensionAnalyses = [];
  }
  const requiredDimensions: DimensionIdType[] = ['brand', 'content', 'seo', 'website', 'digitalFootprint', 'authority'];
  const existingIds = new Set(repaired.dimensionAnalyses.map((d: any) => d.id));

  for (const dimId of requiredDimensions) {
    if (!existingIds.has(dimId)) {
      console.warn(`[outputTemplates] Filling missing dimension analysis: ${dimId}`);
      repaired.dimensionAnalyses.push({
        id: dimId,
        score: 50, // Placeholder score
        summary: `TBD - ${dimId} analysis to be completed`,
        detailedAnalysis: `Detailed analysis for ${dimId} dimension to be provided.`,
        keyFindings: [
          `TBD - Key finding 1 for ${dimId}`,
          `TBD - Key finding 2 for ${dimId}`,
          `TBD - Key finding 3 for ${dimId}`,
        ],
      });
    }
  }

  // Repair roadmap90Days phases
  if (!repaired.roadmap90Days) {
    repaired.roadmap90Days = {};
  }
  const phases = ['phase0_30', 'phase30_60', 'phase60_90'];
  for (const phase of phases) {
    if (!repaired.roadmap90Days[phase]) {
      console.warn(`[outputTemplates] Filling missing roadmap phase: ${phase}`);
      repaired.roadmap90Days[phase] = {
        whyItMatters: `TBD - Strategic rationale for ${phase}`,
        actions: [
          `TBD - Action 1 for ${phase}`,
          `TBD - Action 2 for ${phase}`,
          `TBD - Action 3 for ${phase}`,
        ],
      };
    }
  }

  // Normalize maturityStage enum
  if (typeof repaired.maturityStage === 'string') {
    const normalized = normalizeMaturityStage(repaired.maturityStage);
    if (normalized !== repaired.maturityStage) {
      console.warn(`[outputTemplates] Normalized maturityStage: ${repaired.maturityStage} → ${normalized}`);
      repaired.maturityStage = normalized;
    }
  }

  return FullGapOutputSchema.parse(repaired);
}

/**
 * Normalize maturity stage enum from LLM variations
 *
 * Common LLM variations:
 * - "early" → "Foundational"
 * - "developing" → "Emerging"
 * - "established" → "Established"
 * - "advanced" → "Advanced"
 * - "category leader" / "leading" → "CategoryLeader"
 */
export function normalizeMaturityStage(stage: string): MaturityStageType {
  const normalized = stage.toLowerCase().trim().replace(/[^a-z]/g, '');

  const mappings: Record<string, MaturityStageType> = {
    'early': 'Foundational',
    'earlystage': 'Foundational',
    'foundational': 'Foundational',
    'foundation': 'Foundational',
    'developing': 'Emerging',
    'emerging': 'Emerging',
    'established': 'Established',
    'scaling': 'Established',
    'advanced': 'Advanced',
    'mature': 'Advanced',
    'categoryleader': 'CategoryLeader',
    'leader': 'CategoryLeader',
    'leading': 'CategoryLeader',
  };

  return mappings[normalized] || 'Emerging'; // Default to Emerging if unknown
}
