// lib/types/strategy.ts
// MVP Strategy types for Company Strategy Workspace
//
// These types define the marketing strategy structure with pillars,
// objectives, and AI-assisted planning capabilities.

// ============================================================================
// Core Strategy Types
// ============================================================================

/**
 * Provenance record for AI-generated or AI-improved content
 * Tracks what inputs were used and when
 */
export interface FieldProvenance {
  /** Whether this value was generated or improved by AI */
  generatedByAI: boolean;
  /** When this value was applied (optional - not set during generation) */
  appliedAt?: string;
  /** When this value was generated */
  generatedAt?: string;
  /** Sources used to generate this value (optional) */
  sourcesUsed?: string[];
  /** AI confidence in this value */
  confidence?: 'high' | 'medium' | 'low';
  /** Hashes of inputs used to generate this value (for staleness detection) */
  basedOnHashes?: {
    contextHash?: string;
    objectivesHash?: string;
    strategyHash?: string;
    tacticsHash?: string;
  };
  /** Original draft ID before apply */
  originalDraftId?: string;
  /** Model used for generation */
  model?: string;
}

/**
 * Strategy objective - a measurable goal the strategy aims to achieve
 * Lives on Strategy (not Context) - these are strategic commitments
 */
export interface StrategyObjective {
  id: string;
  text: string;
  metric?: string;    // e.g. "Trials/week"
  target?: string;    // e.g. "+25%"
  timeframe?: string; // e.g. "90 days"
  status?: 'draft' | 'active' | 'achieved' | 'abandoned' | 'deferred';
  /** Provenance for AI-generated objectives */
  provenance?: FieldProvenance;
}

/**
 * Status of a tactical play
 */
export type StrategyPlayStatus = 'proposed' | 'active' | 'paused' | 'proven';

/**
 * Channel tags for tactical plays
 */
export type TacticChannel =
  | 'seo'
  | 'content'
  | 'website'
  | 'media'
  | 'social'
  | 'email'
  | 'brand'
  | 'analytics'
  | 'conversion'
  | 'other';

export const TACTIC_CHANNEL_LABELS: Record<TacticChannel, string> = {
  seo: 'SEO',
  content: 'Content',
  website: 'Website',
  media: 'Paid Media',
  social: 'Social',
  email: 'Email',
  brand: 'Brand',
  analytics: 'Analytics',
  conversion: 'CRO',
  other: 'Other',
};

export const TACTIC_CHANNEL_COLORS: Record<TacticChannel, string> = {
  seo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  content: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  website: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  media: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  social: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  email: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  brand: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  analytics: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  conversion: 'bg-red-500/10 text-red-400 border-red-500/30',
  other: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

/**
 * Impact/Effort levels for tactical plays
 */
export type ImpactLevel = 'low' | 'medium' | 'high';
export type EffortLevel = 'low' | 'medium' | 'high';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Risk with optional mitigation strategy
 */
export interface StrategyRisk {
  risk: string;
  mitigation?: string;
  likelihood?: 'low' | 'medium' | 'high';
  impact?: 'low' | 'medium' | 'high';
}

/**
 * Evaluation fields for strategic items (priorities, tactics)
 * These are first-class structured fields for decision-making
 */
export interface StrategyEvaluation {
  /** Benefits / advantages of this approach */
  pros?: string[];
  /** Drawbacks / disadvantages of this approach */
  cons?: string[];
  /** Explicit tradeoffs being made */
  tradeoffs?: string[];
  /** Risks with optional mitigation strategies */
  risks?: StrategyRisk[];
  /** Assumptions that must hold true */
  assumptions?: string[];
  /** Dependencies on other items or external factors */
  dependencies?: string[];
}

/**
 * Strategy play - a tactical initiative that bridges strategy to work
 * Connects to objectives and pillars to show how strategy executes
 * Includes evaluation fields for decision-making (pros/cons/tradeoffs/risks)
 */
export interface StrategyPlay extends StrategyEvaluation {
  id: string;
  title: string;
  description?: string;
  /** Legacy: single objective link */
  objectiveId?: string;
  /** V6+: Multiple objective links */
  objectiveIds?: string[];
  objectiveTitle?: string;  // Denormalized objective title for display
  /** Legacy: single priority link */
  priorityId?: string;
  /** V6+: Multiple priority links */
  priorityIds?: string[];
  pillarTitle?: string;     // Links by pillar title (simple mapping)
  channels?: TacticChannel[]; // Channel tags (SEO, Content, etc.)
  impact?: ImpactLevel;     // Expected impact
  effort?: EffortLevel;     // Required effort
  confidence?: ConfidenceLevel; // AI confidence in this tactic
  successMetric?: string;
  timeframe?: string;
  status: StrategyPlayStatus;
  createdAt?: string;
  updatedAt?: string;
  /** Provenance for AI-generated tactics */
  provenance?: FieldProvenance;
}

/**
 * Play status display configuration
 */
export const PLAY_STATUS_LABELS: Record<StrategyPlayStatus, string> = {
  proposed: 'Proposed',
  active: 'Active',
  paused: 'Paused',
  proven: 'Proven',
};

export const PLAY_STATUS_COLORS: Record<StrategyPlayStatus, string> = {
  proposed: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  paused: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  proven: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

/**
 * Strategic Bet Status - lifecycle state of a bet
 */
export type StrategicBetStatus = 'draft' | 'accepted' | 'rejected';

/**
 * Strategic Bet - a key strategic commitment with explicit tradeoffs
 *
 * This is the ONLY mid-layer decision object in the strategy model.
 * Strategic Bets are debated in Command screen and executed via Orchestration.
 *
 * Schema:
 * - title: What we're betting on
 * - intent: Directional outcome we expect
 * - linkedObjectives: Which objectives this bet supports
 * - pros: Advantages (human + AI identified)
 * - cons: Risks and downsides
 * - tradeoffs: Explicit "we are NOT doing X" choices
 * - confidence: Optional score or tag
 * - status: draft | accepted | rejected
 *
 * NO metrics here - metrics live in Objectives only
 * NO tactics here - tactics are derived in Orchestration only
 */
export interface StrategicBet {
  id: string;
  /** What we're betting on */
  title: string;
  /** Directional intent - what outcome we expect from this bet */
  intent: string;
  /** Links to objectives this bet supports */
  linkedObjectives: string[];
  /** Advantages of this bet (human + AI identified) */
  pros: string[];
  /** Risks and downsides of this bet */
  cons: string[];
  /** Explicit tradeoffs - what we are NOT doing */
  tradeoffs: string[];
  /** Confidence level in this bet */
  confidence?: 'high' | 'medium' | 'low';
  /** Lifecycle status: draft (proposed) | accepted (committed) | rejected */
  status: StrategicBetStatus;
  /** Display order */
  order?: number;
  /** Provenance for AI-generated bets */
  provenance?: FieldProvenance;
}

/**
 * @deprecated Use StrategicBet instead. Kept for backward compatibility.
 * Strategy pillar - legacy type for Strategic Priority
 * Includes evaluation fields for decision-making (pros/cons/tradeoffs/risks)
 */
export interface StrategyPillar extends StrategyEvaluation {
  id: string;
  title: string;
  description: string;
  /** Why this priority matters (rationale) */
  rationale?: string;
  /** Legacy: single tradeoff string (for backward compat) */
  tradeoff?: string;
  /** Legacy: single risks string (for backward compat) */
  risksLegacy?: string;
  /** @deprecated Metrics live in Objectives only */
  kpis?: string[];
  services?: StrategyService[];
  priority: 'low' | 'medium' | 'high';
  status?: 'draft' | 'active' | 'completed';
  order?: number;
  /** Source artifact ID if this pillar was promoted from an artifact */
  sourceArtifactId?: string;
  /** Provenance for AI-generated priorities */
  provenance?: FieldProvenance;
}

/**
 * Services that can be associated with pillars
 */
export type StrategyService =
  | 'website'
  | 'seo'
  | 'content'
  | 'media'
  | 'brand'
  | 'social'
  | 'email'
  | 'analytics'
  | 'conversion'
  | 'other';

/**
 * Strategy status
 */
export type StrategyStatus = 'draft' | 'finalized' | 'archived';

/**
 * Lock state for strategy workflow
 */
export type StrategyLockState = 'draft' | 'locked';

/**
 * Strategy Frame - core positioning inputs
 */
export interface StrategyFrame {
  // Core frame fields
  audience?: string;           // Who we serve (ICP description)
  offering?: string;           // What we offer (primary product/service)
  valueProp?: string;          // Why us (unique value proposition)
  positioning?: string;        // How we're different (market position)
  constraints?: string;        // What limits us (legal, resource, etc.)
  successMetrics?: string[];   // How we measure success
  nonGoals?: string[];         // What we're explicitly NOT doing

  // Legacy field mappings (for backward compat)
  targetAudience?: string;     // @deprecated - use audience
  primaryOffering?: string;    // @deprecated - use offering
  valueProposition?: string;   // @deprecated - use valueProp

  // Frame state
  isLocked?: boolean;          // When locked, AI won't propose changes
  lockedAt?: string;           // When the frame was locked
  lockedBy?: string;           // Who locked the frame
}

/**
 * Compute frame completeness as a percentage
 * Core fields: audience, offering, valueProp, positioning (required)
 * Optional fields: constraints, successMetrics, nonGoals
 */
export function computeFrameCompleteness(frame?: StrategyFrame): {
  percent: number;
  filled: string[];
  missing: string[];
} {
  if (!frame) {
    return { percent: 0, filled: [], missing: ['audience', 'offering', 'valueProp', 'positioning'] };
  }

  const coreFields = ['audience', 'offering', 'valueProp', 'positioning'] as const;
  const optionalFields = ['constraints', 'successMetrics', 'nonGoals'] as const;

  const filled: string[] = [];
  const missing: string[] = [];

  // Helper to check if a value is non-empty
  const hasContent = (val: unknown): boolean => {
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    return Boolean(val);
  };

  // Check core fields (worth more weight)
  for (const field of coreFields) {
    // Check canonical field first, then legacy fallback
    const legacyField = field === 'audience' ? 'targetAudience' : field === 'offering' ? 'primaryOffering' : field === 'valueProp' ? 'valueProposition' : null;
    const value = frame[field] || (legacyField ? frame[legacyField] : undefined);
    if (hasContent(value)) {
      filled.push(field);
    } else {
      missing.push(field);
    }
  }

  // Check optional fields
  for (const field of optionalFields) {
    const value = frame[field];
    if (hasContent(value)) {
      filled.push(field);
    }
  }

  // Core fields are 80% of the score, optional are 20%
  const coreWeight = 0.8;
  const optionalWeight = 0.2;
  const coreScore = (filled.filter(f => coreFields.includes(f as typeof coreFields[number])).length / coreFields.length) * coreWeight;
  const optionalScore = (filled.filter(f => optionalFields.includes(f as typeof optionalFields[number])).length / optionalFields.length) * optionalWeight;

  return {
    percent: Math.round((coreScore + optionalScore) * 100),
    filled,
    missing,
  };
}

/**
 * Normalize legacy frame fields to canonical names
 */
export function normalizeFrame(frame?: StrategyFrame): StrategyFrame {
  if (!frame) return {};
  return {
    ...frame,
    audience: frame.audience || frame.targetAudience,
    offering: frame.offering || frame.primaryOffering,
    valueProp: frame.valueProp || frame.valueProposition,
  };
}

/**
 * Strategy Tradeoffs - explicit choices
 */
export interface StrategyTradeoffs {
  optimizesFor?: string[];
  sacrifices?: string[];
  risks?: string[];
}

/**
 * Engagement type for strategy scoping
 * - 'company': Full company strategy (default, evergreen)
 * - 'project': Project-scoped strategy (tied to engagement)
 */
export type StrategyEngagementType = 'company' | 'project';

/**
 * Company marketing strategy
 */
export interface CompanyStrategy {
  id: string;
  companyId: string;

  // Engagement scoping (V8+)
  /** Type of engagement: 'company' (default) or 'project' */
  engagementType?: StrategyEngagementType;
  /** Engagement ID (only set for project strategies) */
  engagementId?: string;
  /** Project type (only set for project strategies) */
  projectType?: string;
  /** Project name (only set for project strategies) */
  projectName?: string;

  // Strategy identity
  title: string;
  summary: string;

  // Goal Statement (V9+)
  /** Plain-language goal statement describing what the user is trying to accomplish */
  goalStatement?: string;
  /** Timestamp when goalStatement was last updated */
  goalStatementUpdatedAt?: string;

  // Strategy Frame (inputs/parameters)
  strategyFrame?: StrategyFrame;

  // Strategy Tradeoffs (explicit choices)
  tradeoffs?: StrategyTradeoffs;

  // Objectives (structured, canonical - lives on Strategy, not Context)
  // Legacy: string[] for backwards compatibility
  // V5+: StrategyObjective[] for rich objectives with metrics
  objectives: string[] | StrategyObjective[];

  // Strategic pillars (priorities)
  pillars: StrategyPillar[];

  // Tactical plays (bridge between strategy and work)
  plays?: StrategyPlay[];

  // Status & lifecycle
  status: StrategyStatus;
  lockState?: StrategyLockState;
  version?: number;

  // Multi-Strategy support (V5+)
  /** Whether this is the active strategy for the company (only one can be active) */
  isActive?: boolean;
  /** Optional description of why this strategy was created (e.g., "Q1 2025 refresh") */
  description?: string;
  /** ID of strategy this was duplicated from (if any) */
  duplicatedFromId?: string;

  // Timeline
  startDate?: string;
  endDate?: string;
  quarterLabel?: string;

  // Version Metadata (for traceability)
  /** Context revision ID this strategy was generated from */
  baseContextRevisionId?: string;
  /** Hive Brain revision ID (hash) used for generation */
  hiveBrainRevisionId?: string;
  /** Competition source used: 'v3' | 'v4' | null */
  competitionSourceUsed?: 'v3' | 'v4' | null;
  /** Whether this strategy was generated with incomplete SRM fields */
  generatedWithIncompleteContext?: boolean;
  /** Missing SRM fields at generation time (for transparency) */
  missingSrmFields?: string[];

  // Artifact Lineage (for Strategy Workspace V4)
  /** IDs of artifacts that were promoted to create/update this strategy */
  sourceArtifactIds?: string[];
  /** Whether this strategy was created via promotion (vs direct generation) */
  promotedFromArtifacts?: boolean;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  /** Timestamp of last AI-driven update */
  lastAiUpdatedAt?: string;
  /** Timestamp of last human-driven update */
  lastHumanUpdatedAt?: string;
}

/**
 * Strategy list item for multi-strategy selector
 */
export interface StrategyListItem {
  id: string;
  title: string;
  summary: string;
  status: StrategyStatus;
  isActive: boolean;
  pillarCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert CompanyStrategy to StrategyListItem
 */
export function toStrategyListItem(strategy: CompanyStrategy): StrategyListItem {
  return {
    id: strategy.id,
    title: strategy.title,
    summary: strategy.summary,
    status: strategy.status,
    isActive: strategy.isActive ?? false,
    pillarCount: strategy.pillars.length,
    createdAt: strategy.createdAt,
    updatedAt: strategy.updatedAt,
  };
}

/**
 * Create strategy request
 */
export interface CreateStrategyRequest {
  companyId: string;
  title?: string;
  summary?: string;
  objectives?: string[];
  pillars?: Omit<StrategyPillar, 'id'>[];
  // Version metadata (for traceability)
  baseContextRevisionId?: string;
  hiveBrainRevisionId?: string;
  competitionSourceUsed?: 'v3' | 'v4' | null;
  generatedWithIncompleteContext?: boolean;
  missingSrmFields?: string[];
  // Artifact lineage (for promotion from workspace)
  sourceArtifactIds?: string[];
  promotedFromArtifacts?: boolean;
}

/**
 * Update strategy request
 */
export interface UpdateStrategyRequest {
  strategyId: string;
  updates: Partial<Omit<CompanyStrategy, 'id' | 'companyId' | 'createdAt'>>;
}

/**
 * Finalize strategy request
 */
export interface FinalizeStrategyRequest {
  strategyId: string;
  generateWork?: boolean;
}

// ============================================================================
// AI Strategy Proposal
// ============================================================================

/**
 * AI-proposed strategy (before saving)
 */
export interface AiStrategyProposal {
  title: string;
  summary: string;
  objectives: string[] | StrategyObjective[];
  pillars: Omit<StrategyPillar, 'id'>[];
  plays?: Omit<StrategyPlay, 'id' | 'createdAt' | 'updatedAt'>[];
  reasoning: string;
  generatedAt: string;
  /** Missing Inputs section (only present when SRM not ready) */
  missingInputs?: string;
  /** Explicit assumptions made due to missing context */
  assumptions?: string[];
  /** Whether this proposal was generated with incomplete SRM fields */
  generatedWithIncompleteContext?: boolean;
  /** Context fields that were confirmed and used */
  confirmedFieldsUsed?: string[];
}

/**
 * AI strategy propose request
 */
export interface AiStrategyProposeRequest {
  companyId: string;
  contextOverride?: Record<string, string>;
}

/**
 * AI strategy propose response
 */
export interface AiStrategyProposeResponse {
  proposal: AiStrategyProposal;
  confidence: number;
  sources: string[];
}

// ============================================================================
// Strategy Summary (for Overview and Reports)
// ============================================================================

/**
 * Lightweight strategy summary for display
 */
export interface StrategySummary {
  id: string;
  companyId: string;
  title: string;
  status: StrategyStatus;
  pillarCount: number;
  topPillars: Array<{ title: string; priority: string }>;
  lastUpdated: string;
}

/**
 * Create a strategy summary from full strategy
 */
export function createStrategySummary(strategy: CompanyStrategy): StrategySummary {
  return {
    id: strategy.id,
    companyId: strategy.companyId,
    title: strategy.title,
    status: strategy.status,
    pillarCount: strategy.pillars.length,
    topPillars: strategy.pillars
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 3)
      .map(p => ({ title: p.title, priority: p.priority })),
    lastUpdated: strategy.updatedAt,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for strategy items
 */
export function generateStrategyItemId(): string {
  return `si_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Service display labels
 */
export const SERVICE_LABELS: Record<StrategyService, string> = {
  website: 'Website',
  seo: 'SEO',
  content: 'Content',
  media: 'Media',
  brand: 'Brand',
  social: 'Social',
  email: 'Email',
  analytics: 'Analytics',
  conversion: 'Conversion',
  other: 'Other',
};

/**
 * Priority display colors (Tailwind classes)
 */
export const PRIORITY_COLORS: Record<StrategyPillar['priority'], string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

// ============================================================================
// Objective Helpers (V5+)
// ============================================================================

/**
 * Check if objectives are in the new structured format
 */
export function isStructuredObjectives(
  objectives: string[] | StrategyObjective[]
): objectives is StrategyObjective[] {
  if (!objectives || objectives.length === 0) return false;
  return typeof objectives[0] === 'object' && 'text' in objectives[0];
}

/**
 * Normalize objectives to structured format
 * Converts legacy string[] to StrategyObjective[]
 */
export function normalizeObjectives(
  objectives: string[] | StrategyObjective[] | undefined
): StrategyObjective[] {
  if (!objectives || objectives.length === 0) return [];

  if (isStructuredObjectives(objectives)) {
    return objectives;
  }

  // Convert string[] to StrategyObjective[]
  return (objectives as string[]).map((text, idx) => ({
    id: `obj_${Date.now()}_${idx}`,
    text,
  }));
}

/**
 * Get objective text for display (works with both formats)
 */
export function getObjectiveText(
  objective: string | StrategyObjective
): string {
  return typeof objective === 'string' ? objective : objective.text;
}

/**
 * Generate ID for new objective
 */
export function generateObjectiveId(): string {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate ID for new play
 */
export function generatePlayId(): string {
  return `play_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Evaluation Helpers (V6+)
// ============================================================================

/**
 * Normalize pillar risks to structured format
 * Handles legacy string format and new StrategyRisk[] format
 */
export function normalizePillarRisks(pillar: StrategyPillar): StrategyRisk[] {
  // If we have structured risks, use them
  if (pillar.risks && pillar.risks.length > 0) {
    return pillar.risks;
  }
  // Convert legacy string to single risk
  if (pillar.risksLegacy) {
    return [{ risk: pillar.risksLegacy }];
  }
  return [];
}

/**
 * Normalize pillar tradeoffs to array format
 * Handles legacy string format and new string[] format
 */
export function normalizePillarTradeoffs(pillar: StrategyPillar): string[] {
  // If we have structured tradeoffs, use them
  if (pillar.tradeoffs && pillar.tradeoffs.length > 0) {
    return pillar.tradeoffs;
  }
  // Convert legacy string to single tradeoff
  if (pillar.tradeoff) {
    return [pillar.tradeoff];
  }
  return [];
}

// ============================================================================
// Strategic Bet Helpers
// ============================================================================

/**
 * Convert legacy StrategyPillar to new StrategicBet format
 */
export function pillarToStrategicBet(pillar: StrategyPillar): StrategicBet {
  return {
    id: pillar.id,
    title: pillar.title,
    intent: pillar.description || pillar.rationale || '',
    linkedObjectives: [], // Legacy pillars don't have this - needs migration
    pros: pillar.pros || [],
    cons: pillar.cons || [],
    tradeoffs: normalizePillarTradeoffs(pillar),
    confidence: pillar.priority === 'high' ? 'high' : pillar.priority === 'medium' ? 'medium' : 'low',
    status: pillar.status === 'active' ? 'accepted' : pillar.status === 'completed' ? 'accepted' : 'draft',
    order: pillar.order,
    provenance: pillar.provenance,
  };
}

/**
 * Convert StrategicBet back to StrategyPillar format for persistence
 */
export function strategicBetToPillar(bet: StrategicBet): StrategyPillar {
  // Map status: accepted/rejected → active/draft, draft stays draft
  const status: 'draft' | 'active' | 'completed' =
    bet.status === 'accepted' ? 'active' :
    bet.status === 'rejected' ? 'draft' :
    'draft';

  // Map confidence back to priority
  const priority: 'low' | 'medium' | 'high' = bet.confidence || 'medium';

  return {
    id: bet.id,
    title: bet.title,
    description: bet.intent,
    pros: bet.pros,
    cons: bet.cons,
    tradeoffs: bet.tradeoffs,
    priority,
    status,
    order: bet.order,
    provenance: bet.provenance,
  };
}

/**
 * Generate ID for new Strategic Bet
 */
export function generateBetId(): string {
  return `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Tactic Types (V7+ - for Workspace 2.0)
// ============================================================================

/**
 * Tactic - derived execution idea from accepted Strategic Bets
 *
 * Tactics are the execution layer:
 * - Generated from accepted bets
 * - Can be manually added
 * - Supports pinning to preserve during regeneration
 */
export interface Tactic {
  id: string;
  /** Title of the tactic */
  title: string;
  /** Detailed description */
  description: string;
  /** Links to strategic bets this tactic executes */
  linkedBetIds: string[];
  /** Optional owner */
  owner?: string;
  /** Optional timeline */
  timeline?: string;
  /** Channel(s) for this tactic */
  channels?: TacticChannel[];
  /** Impact level */
  impact?: ImpactLevel;
  /** Effort level */
  effort?: EffortLevel;
  /** Whether this was AI-derived (vs manually created) */
  isDerived: boolean;
  /** Whether this tactic is pinned (preserved during regeneration) */
  isPinned?: boolean;
  /** Whether this has been manually customized after AI generation */
  isCustomized?: boolean;
  /** Status of the tactic */
  status?: 'proposed' | 'active' | 'completed' | 'rejected';
  /** Provenance for AI-generated tactics */
  provenance?: FieldProvenance;
}

/**
 * Generate ID for new Tactic
 */
export function generateTacticId(): string {
  return `tactic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert StrategyPlay to Tactic
 */
export function playToTactic(play: StrategyPlay, linkedBetIds: string[] = []): Tactic {
  return {
    id: play.id,
    title: play.title,
    description: play.description || '',
    linkedBetIds: linkedBetIds.length > 0 ? linkedBetIds : getPlayPriorityIds(play),
    owner: undefined,
    timeline: play.timeframe,
    channels: play.channels,
    impact: play.impact,
    effort: play.effort,
    isDerived: play.provenance?.generatedByAI ?? false,
    isPinned: false,
    isCustomized: false,
    status: play.status === 'proposed' ? 'proposed' : play.status === 'active' ? 'active' : 'proposed',
    provenance: play.provenance,
  };
}

/**
 * Convert Tactic to StrategyPlay (for persistence)
 */
export function tacticToPlay(tactic: Tactic): StrategyPlay {
  // Map Tactic status to StrategyPlayStatus
  // Tactic: 'proposed' | 'active' | 'completed' | 'rejected'
  // StrategyPlay: 'proposed' | 'active' | 'paused' | 'proven'
  const statusMap: Record<NonNullable<Tactic['status']>, StrategyPlayStatus> = {
    proposed: 'proposed',
    active: 'active',
    completed: 'proven',  // completed maps to proven
    rejected: 'paused',   // rejected maps to paused
  };

  return {
    id: tactic.id,
    title: tactic.title,
    description: tactic.description,
    priorityIds: tactic.linkedBetIds,
    channels: tactic.channels,
    impact: tactic.impact,
    effort: tactic.effort,
    timeframe: tactic.timeline,
    status: statusMap[tactic.status ?? 'proposed'],
    provenance: tactic.provenance,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get all linked objective IDs for a play (handles legacy single ID)
 */
export function getPlayObjectiveIds(play: StrategyPlay): string[] {
  if (play.objectiveIds && play.objectiveIds.length > 0) {
    return play.objectiveIds;
  }
  if (play.objectiveId) {
    return [play.objectiveId];
  }
  return [];
}

/**
 * Get all linked priority IDs for a play (handles legacy single ID)
 */
export function getPlayPriorityIds(play: StrategyPlay): string[] {
  if (play.priorityIds && play.priorityIds.length > 0) {
    return play.priorityIds;
  }
  if (play.priorityId) {
    return [play.priorityId];
  }
  return [];
}

/**
 * Check if an evaluation has any content
 */
export function hasEvaluationContent(item: StrategyEvaluation): boolean {
  return !!(
    (item.pros && item.pros.length > 0) ||
    (item.cons && item.cons.length > 0) ||
    (item.tradeoffs && item.tradeoffs.length > 0) ||
    (item.risks && item.risks.length > 0) ||
    (item.assumptions && item.assumptions.length > 0) ||
    (item.dependencies && item.dependencies.length > 0)
  );
}

/**
 * Count total evaluation items
 */
export function countEvaluationItems(item: StrategyEvaluation): number {
  return (
    (item.pros?.length || 0) +
    (item.cons?.length || 0) +
    (item.tradeoffs?.length || 0) +
    (item.risks?.length || 0) +
    (item.assumptions?.length || 0) +
    (item.dependencies?.length || 0)
  );
}
