// lib/types/strategyV2.ts
// Strategy V2 - Strategic Decisions, Not Tactics
//
// Strategy V2 reframes strategy from "activities" to "decisions":
// ❌ Strategy = what we do
// ✅ Strategy = what we choose
//
// Each pillar is a strategic bet with:
// - Decision statement (clear choice)
// - Target audience focus (who this is for)
// - Competitive rationale (why this wins vs alternatives)
// - Explicit tradeoff (what we deprioritize)

import type { CompanyStrategy, StrategyPillar, StrategyStatus } from './strategy';

// ============================================================================
// Field-Level Provenance Types
// ============================================================================

/**
 * Source of a field's value - used to protect user edits from AI overwrites
 */
export type FieldSource = 'User' | 'AI' | 'AI_suggestion' | 'Inherited';

/**
 * Confidence level for a field value
 */
export type FieldConfidence = 'High' | 'Medium' | 'Low';

/**
 * Field-level provenance tracking
 * Allows us to know who/what set a value and whether it should be protected
 */
export interface FieldProvenance {
  /** Who set this value */
  source: FieldSource;
  /** Confidence level */
  confidence: FieldConfidence;
  /** When this value was last set */
  updatedAt: string;
  /** Optional note about the source */
  note?: string;
}

/**
 * Track provenance for strategy fields that can be edited or AI-generated
 */
export interface StrategyFieldProvenance {
  // Summary fields
  strategySummary?: FieldProvenance;

  // Strategic choices
  'strategicChoices.whoWeWinWith'?: FieldProvenance;
  'strategicChoices.whereWeFocus'?: FieldProvenance;
  'strategicChoices.howWeDifferentiate'?: FieldProvenance;
  'strategicChoices.whatWeDeprioritize'?: FieldProvenance;

  // Success definition
  'successDefinition.primaryMetric'?: FieldProvenance;

  // Pillar-level provenance keyed by pillarId.fieldName
  [pillarFieldKey: string]: FieldProvenance | undefined;
}

/**
 * Create provenance for a user-edited field
 */
export function createUserProvenance(note?: string): FieldProvenance {
  return {
    source: 'User',
    confidence: 'High',
    updatedAt: new Date().toISOString(),
    note,
  };
}

/**
 * Create provenance for an AI-generated field
 */
export function createAIProvenance(note?: string): FieldProvenance {
  return {
    source: 'AI',
    confidence: 'Medium',
    updatedAt: new Date().toISOString(),
    note,
  };
}

/**
 * Create provenance for an AI suggestion (applied but not yet confirmed)
 */
export function createAISuggestionProvenance(note?: string): FieldProvenance {
  return {
    source: 'AI_suggestion',
    confidence: 'Low',
    updatedAt: new Date().toISOString(),
    note,
  };
}

/**
 * Check if a field is protected from AI overwrite (user-edited)
 */
export function isFieldProtected(provenance: FieldProvenance | undefined): boolean {
  return provenance?.source === 'User';
}

// ============================================================================
// Strategy V2 Core Types
// ============================================================================

/**
 * Strategic choices - the four key decisions that define strategy
 */
export interface StrategicChoices {
  /** Who are we choosing to win with? */
  whoWeWinWith: string;
  /** Where are we focusing first? */
  whereWeFocus: string;
  /** How do we differentiate vs competitors? */
  howWeDifferentiate: string;
  /** What are we explicitly NOT doing? */
  whatWeDeprioritize: string;
}

/**
 * Strategy V2 Pillar - a strategic bet, not an activity
 *
 * Each pillar must represent a clear CHOICE with tradeoffs,
 * not a generic improvement or optimization.
 */
export interface StrategyPillarV2 {
  id: string;
  /** Name of the strategic pillar */
  pillarName: string;
  /** The decision being made (not an activity) */
  decision: string;
  /** Who this pillar is for */
  targetAudience: string;
  /** Why this wins vs alternatives */
  competitiveRationale: string;
  /** What we're explicitly deprioritizing with this choice */
  explicitTradeoff: string;
  /** Priority level */
  priority: 'High' | 'Medium' | 'Low';
  /** Order in pillar list */
  order?: number;
}

/**
 * Success definition with primary and supporting metrics
 */
export interface SuccessDefinition {
  /** The primary metric that defines success */
  primaryMetric: string;
  /** Supporting metrics that indicate progress */
  supportingMetrics: string[];
}

/**
 * Confidence notes for strategy validation
 */
export interface StrategyConfidenceNotes {
  /** Fields where the strategy is well-grounded */
  highConfidence: string[];
  /** Fields that need human review or validation */
  needsReview: string[];
}

/**
 * Company Strategy V2 - Strategic decisions, not tactics
 */
export interface CompanyStrategyV2 {
  id: string;
  companyId: string;

  // Strategy identity
  /** Strategy title */
  strategyTitle: string;
  /** 2-3 sentence summary of the strategic direction */
  strategySummary: string;

  // The four strategic choices
  strategicChoices: StrategicChoices;

  // Strategic pillars (3-5 bets)
  strategyPillars: StrategyPillarV2[];

  // Success definition
  successDefinition: SuccessDefinition;

  // Confidence tracking
  confidenceNotes: StrategyConfidenceNotes;

  // Status & lifecycle
  status: StrategyStatus;
  version: number;

  // Timeline
  startDate?: string;
  endDate?: string;
  quarterLabel?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  finalizedAt?: string;
  finalizedBy?: string;

  // V2 metadata
  isV2: true;
  migratedFromV1?: boolean;

  // Context version tracking (for detecting when Context changes affect Strategy)
  /** Context updatedAt timestamp when this strategy was generated */
  contextVersionUsedAt?: string;
  /** Hash of strategy-impacting Context fields when strategy was generated */
  contextVersionHash?: string;

  // Versioning for safe regeneration
  /** If this strategy was based on another, link to the parent */
  basedOnStrategyId?: string;
  /** Version status for managing draft vs active */
  versionStatus?: 'draft' | 'active' | 'archived';

  // Field-level provenance for protecting user edits
  /** Track which fields were user-edited vs AI-generated */
  fieldProvenance?: StrategyFieldProvenance;
}

// ============================================================================
// AI Proposal Types
// ============================================================================

/**
 * AI-proposed Strategy V2 (before saving)
 */
export interface AiStrategyV2Proposal {
  strategyTitle: string;
  strategySummary: string;
  strategicChoices: StrategicChoices;
  strategyPillars: Omit<StrategyPillarV2, 'id'>[];
  successDefinition: SuccessDefinition;
  confidenceNotes: StrategyConfidenceNotes;
  /** Context compliance tracking */
  contextCompliance?: ContextCompliance;
  generatedAt: string;
}

/**
 * Strategy V2 propose request
 */
export interface AiStrategyV2ProposeRequest {
  companyId: string;
  /** Use only confirmed Context fields */
  useConfirmedContextOnly?: boolean;
  /** Include Audience Lab output */
  includeAudienceLab?: boolean;
  /** Include Competition V4 data */
  includeCompetition?: boolean;
  /** Prior strategy for continuity (if regenerating) */
  priorStrategyId?: string;
}

/**
 * Strategy V2 propose response
 */
export interface AiStrategyV2ProposeResponse {
  proposal: AiStrategyV2Proposal;
  confidence: number;
  sources: string[];
  warnings?: string[];
}

// ============================================================================
// Context Compliance Types (AI Output Validation)
// ============================================================================

/**
 * A detected conflict between AI output and confirmed context
 */
export interface ContextConflict {
  /** The context field path that conflicts */
  field: string;
  /** Description of the conflict */
  issue: string;
  /** Suggested resolution */
  suggestion: string;
}

/**
 * Context compliance tracking for AI outputs
 * Ensures AI respects confirmed context values
 */
export interface ContextCompliance {
  /** List of confirmed context field paths that were explicitly used */
  usedConfirmedFields: string[];
  /** Assumptions the AI had to make (fields not in confirmed context) */
  assumptionsMade: string[];
  /** Conflicts detected between AI output and confirmed context */
  conflictsDetected: ContextConflict[];
}

/**
 * Create an empty context compliance object
 */
export function createEmptyContextCompliance(): ContextCompliance {
  return {
    usedConfirmedFields: [],
    assumptionsMade: [],
    conflictsDetected: [],
  };
}

// ============================================================================
// Confirmed Context Bundle Types
// ============================================================================

/**
 * A bundle of confirmed context values that AI must respect
 * Only includes fields marked as User-confirmed (source='User')
 */
export interface ConfirmedContextBundle {
  /** Primary audience (immutable if set) */
  primaryAudience?: string;
  /** Secondary audience */
  secondaryAudience?: string;
  /** Business model */
  businessModel?: string;
  /** Value proposition */
  valueProposition?: string;
  /** Company category/industry */
  category?: string;
  /** Geographic focus */
  geography?: string;
  /** Competitive category */
  competitiveCategory?: string;
  /** Budget constraints (immutable if set) */
  budget?: string;
  /** Primary objectives */
  primaryObjectives?: string[];
  /** Non-goals */
  nonGoals?: string[];
  /** Success definition */
  successDefinition?: string;
  /** Company stage */
  stage?: string;
  /** Any regulatory constraints */
  regulatory?: string;
}

/**
 * Full context bundle (for background reference, not invariants)
 */
export interface FullContextBundle extends ConfirmedContextBundle {
  /** Audience summary (can be AI-generated) */
  audienceSummary?: string;
  /** Competitive posture */
  competitivePosture?: string;
  /** Known unknowns */
  knownUnknowns?: string[];
  /** Internal capabilities */
  internalCapabilities?: string;
  /** Timeline constraints */
  timeline?: string;
}

// ============================================================================
// Regenerate Ideas Types (Non-destructive suggestions)
// ============================================================================

/**
 * An alternative pillar suggestion
 */
export interface AlternativePillarSuggestion {
  pillarName: string;
  decision: string;
  tradeoff: string;
  competitiveRationale?: string;
  /** Why this is a good alternative */
  reasoning: string;
}

/**
 * AI-generated strategy ideas/suggestions without overwriting current strategy
 */
export interface StrategyIdeasResponse {
  /** Alternative pillar ideas */
  alternativePillars: AlternativePillarSuggestion[];
  /** Alternative differentiation angles */
  alternativeDifferentiationAngles: {
    angle: string;
    reasoning: string;
  }[];
  /** Alternative deprioritization choices */
  alternativeDeprioritizations: {
    choice: string;
    reasoning: string;
  }[];
  /** Timestamp of generation */
  generatedAt: string;
  /** Data sources used */
  sources: string[];
}

// ============================================================================
// Conversion Functions (V1 <-> V2)
// ============================================================================

/**
 * Convert V1 Strategy to V2 Strategy
 * Maps activity-based pillars to decision-based pillars
 */
export function strategyV1ToV2(v1: CompanyStrategy): CompanyStrategyV2 {
  const now = new Date().toISOString();

  // Convert V1 pillars to V2 pillars
  const v2Pillars: StrategyPillarV2[] = v1.pillars.map((p) => ({
    id: p.id,
    pillarName: p.title,
    // V1 descriptions become decisions - mark for review
    decision: p.description || `Focus on ${p.title}`,
    targetAudience: 'Needs definition', // V1 didn't have this
    competitiveRationale: 'Needs definition', // V1 didn't have this
    explicitTradeoff: 'Needs definition', // V1 didn't have this
    priority: mapV1Priority(p.priority),
    order: p.order,
  }));

  // Infer strategic choices from V1 data
  const strategicChoices: StrategicChoices = {
    whoWeWinWith: v1.objectives?.[0] || 'Needs definition',
    whereWeFocus: v2Pillars[0]?.pillarName || 'Needs definition',
    howWeDifferentiate: 'Needs definition',
    whatWeDeprioritize: 'Needs definition',
  };

  return {
    id: v1.id,
    companyId: v1.companyId,
    strategyTitle: v1.title,
    strategySummary: v1.summary,
    strategicChoices,
    strategyPillars: v2Pillars,
    successDefinition: {
      primaryMetric: 'Needs definition',
      supportingMetrics: [],
    },
    confidenceNotes: {
      highConfidence: [],
      needsReview: [
        'strategicChoices.howWeDifferentiate',
        'strategicChoices.whatWeDeprioritize',
        'All pillar tradeoffs',
      ],
    },
    status: v1.status,
    version: v1.version || 1,
    startDate: v1.startDate,
    endDate: v1.endDate,
    quarterLabel: v1.quarterLabel,
    createdAt: v1.createdAt,
    updatedAt: now,
    createdBy: v1.createdBy,
    finalizedAt: v1.finalizedAt,
    finalizedBy: v1.finalizedBy,
    isV2: true,
    migratedFromV1: true,
  };
}

/**
 * Convert V2 Strategy back to V1 Strategy (for backward compatibility)
 */
export function strategyV2ToV1(v2: CompanyStrategyV2): CompanyStrategy {
  // Convert V2 pillars to V1 pillars
  const v1Pillars: StrategyPillar[] = v2.strategyPillars.map((p) => ({
    id: p.id,
    title: p.pillarName,
    // Combine decision + competitive rationale into description
    description: `${p.decision}\n\nWhy: ${p.competitiveRationale}\n\nTradeoff: ${p.explicitTradeoff}`,
    priority: mapV2Priority(p.priority),
    order: p.order,
    kpis: v2.successDefinition.supportingMetrics,
  }));

  // Extract objectives from strategic choices
  const objectives: string[] = [];
  if (v2.strategicChoices.whoWeWinWith) {
    objectives.push(`Win with: ${v2.strategicChoices.whoWeWinWith}`);
  }
  if (v2.strategicChoices.whereWeFocus) {
    objectives.push(`Focus: ${v2.strategicChoices.whereWeFocus}`);
  }

  return {
    id: v2.id,
    companyId: v2.companyId,
    title: v2.strategyTitle,
    summary: v2.strategySummary,
    objectives,
    pillars: v1Pillars,
    status: v2.status,
    version: v2.version,
    startDate: v2.startDate,
    endDate: v2.endDate,
    quarterLabel: v2.quarterLabel,
    createdAt: v2.createdAt,
    updatedAt: v2.updatedAt,
    createdBy: v2.createdBy,
    finalizedAt: v2.finalizedAt,
    finalizedBy: v2.finalizedBy,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map V1 priority to V2 priority
 */
function mapV1Priority(priority: 'low' | 'medium' | 'high'): 'High' | 'Medium' | 'Low' {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return 'Medium';
  }
}

/**
 * Map V2 priority to V1 priority
 */
function mapV2Priority(priority: 'High' | 'Medium' | 'Low'): 'low' | 'medium' | 'high' {
  switch (priority) {
    case 'High':
      return 'high';
    case 'Medium':
      return 'medium';
    case 'Low':
      return 'low';
    default:
      return 'medium';
  }
}

/**
 * Generate a unique ID for strategy items
 */
export function generateStrategyV2ItemId(): string {
  return `sv2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate a V2 pillar has all required decision components
 */
export function validatePillar(pillar: StrategyPillarV2): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!pillar.decision || pillar.decision === 'Needs definition') {
    issues.push('Missing decision statement');
  }

  if (!pillar.targetAudience || pillar.targetAudience === 'Needs definition') {
    issues.push('Missing target audience');
  }

  if (!pillar.competitiveRationale || pillar.competitiveRationale === 'Needs definition') {
    issues.push('Missing competitive rationale');
  }

  if (!pillar.explicitTradeoff || pillar.explicitTradeoff === 'Needs definition') {
    issues.push('Missing explicit tradeoff');
  }

  // Check for anti-patterns
  const forbiddenVerbs = ['optimize', 'improve', 'enhance', 'leverage', 'maximize'];
  const decisionLower = pillar.decision.toLowerCase();
  for (const verb of forbiddenVerbs) {
    if (decisionLower.startsWith(verb)) {
      issues.push(`Decision starts with vague verb "${verb}" - needs a clearer choice`);
    }
  }

  // Check for channel names (shouldn't be in pillars)
  const channelNames = ['google', 'meta', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];
  const pillarText = `${pillar.pillarName} ${pillar.decision}`.toLowerCase();
  for (const channel of channelNames) {
    if (pillarText.includes(channel)) {
      issues.push(`Pillar contains channel name "${channel}" - strategy should be channel-agnostic`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate entire V2 strategy
 */
export function validateStrategyV2(strategy: CompanyStrategyV2): {
  valid: boolean;
  issues: string[];
  pillarIssues: Record<string, string[]>;
} {
  const issues: string[] = [];
  const pillarIssues: Record<string, string[]> = {};

  // Check strategic choices
  if (!strategy.strategicChoices.whoWeWinWith || strategy.strategicChoices.whoWeWinWith === 'Needs definition') {
    issues.push('Missing "Who we win with" choice');
  }
  if (!strategy.strategicChoices.whereWeFocus || strategy.strategicChoices.whereWeFocus === 'Needs definition') {
    issues.push('Missing "Where we focus" choice');
  }
  if (!strategy.strategicChoices.howWeDifferentiate || strategy.strategicChoices.howWeDifferentiate === 'Needs definition') {
    issues.push('Missing "How we differentiate" choice');
  }
  if (!strategy.strategicChoices.whatWeDeprioritize || strategy.strategicChoices.whatWeDeprioritize === 'Needs definition') {
    issues.push('Missing "What we deprioritize" choice');
  }

  // Check pillar count
  if (strategy.strategyPillars.length < 2) {
    issues.push('Strategy should have at least 2 pillars');
  }
  if (strategy.strategyPillars.length > 5) {
    issues.push('Strategy should have at most 5 pillars - too many dilutes focus');
  }

  // Validate each pillar
  for (const pillar of strategy.strategyPillars) {
    const pillarValidation = validatePillar(pillar);
    if (!pillarValidation.valid) {
      pillarIssues[pillar.id] = pillarValidation.issues;
    }
  }

  // Check success definition
  if (!strategy.successDefinition.primaryMetric || strategy.successDefinition.primaryMetric === 'Needs definition') {
    issues.push('Missing primary success metric');
  }

  return {
    valid: issues.length === 0 && Object.keys(pillarIssues).length === 0,
    issues,
    pillarIssues,
  };
}

/**
 * Create a one-sentence strategy summary
 */
export function createOneSentenceSummary(strategy: CompanyStrategyV2): string {
  const { strategicChoices } = strategy;

  if (
    strategicChoices.whoWeWinWith === 'Needs definition' ||
    strategicChoices.howWeDifferentiate === 'Needs definition'
  ) {
    return strategy.strategySummary;
  }

  return `Win with ${strategicChoices.whoWeWinWith} by ${strategicChoices.howWeDifferentiate}, prioritizing ${strategicChoices.whereWeFocus} over ${strategicChoices.whatWeDeprioritize}.`;
}

/**
 * Create empty V2 strategy
 */
export function createEmptyStrategyV2(companyId: string): CompanyStrategyV2 {
  const now = new Date().toISOString();

  return {
    id: generateStrategyV2ItemId(),
    companyId,
    strategyTitle: 'New Strategy',
    strategySummary: '',
    strategicChoices: {
      whoWeWinWith: '',
      whereWeFocus: '',
      howWeDifferentiate: '',
      whatWeDeprioritize: '',
    },
    strategyPillars: [],
    successDefinition: {
      primaryMetric: '',
      supportingMetrics: [],
    },
    confidenceNotes: {
      highConfidence: [],
      needsReview: [],
    },
    status: 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
    isV2: true,
  };
}
