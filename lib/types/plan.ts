// lib/types/plan.ts
// Heavy Media Plan + Content Plan Type Definitions
//
// Structured planning objects that bridge Decide → Deliver → Work.
// Plans are first-class entities with lifecycle management, staleness detection,
// and proposal-based update workflows.

// ============================================================================
// Plan Status & Core Types
// ============================================================================

/**
 * Plan lifecycle status
 * - draft: Being edited, not yet submitted
 * - in_review: Submitted for approval
 * - approved: Approved and locked (version incremented)
 * - archived: No longer active
 */
export type PlanStatus = 'draft' | 'in_review' | 'approved' | 'archived';

/**
 * Plan type discriminator
 */
export type PlanType = 'media' | 'content';

/**
 * Plan proposal status for "Insert Updates" workflow
 */
export type PlanProposalStatus = 'pending' | 'applied' | 'discarded';

// ============================================================================
// Source Snapshot (Staleness Detection)
// ============================================================================

/**
 * Captures the context/strategy state when a plan was last updated.
 * Used to detect when upstream changes require plan updates.
 */
export interface PlanSourceSnapshot {
  /** Hash of relevant confirmed context fields */
  contextHash: string;
  /** Hash of strategy frame, objectives, and accepted bets */
  strategyHash: string;
  /** Timestamp when context was last confirmed (if known) */
  contextConfirmedAt: string | null;
  /** Timestamp when strategy was locked (if known) */
  strategyLockedAt: string | null;
}

// ============================================================================
// Shared Section Types
// ============================================================================

/**
 * Key Performance Indicator definition
 */
export interface PlanKPI {
  id: string;
  name: string;
  metric: string;
  target: string;
  timeframe?: string;
}

/**
 * Risk item with optional assessment
 */
export interface PlanRiskItem {
  id: string;
  description: string;
  likelihood?: 'low' | 'medium' | 'high';
  impact?: 'low' | 'medium' | 'high';
  mitigation?: string;
}

/**
 * Approval checklist item
 */
export interface ApprovalChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: string;
  checkedAt?: string;
}

/**
 * Approval section (shared by both plan types)
 */
export interface PlanApprovals {
  notes?: string;
  checklist: ApprovalChecklistItem[];
}

// ============================================================================
// Media Plan Sections
// ============================================================================

/**
 * Media Plan summary section
 */
export interface MediaPlanSummary {
  /** Primary goal from strategy */
  goalStatement?: string;
  /** Executive summary of the media approach */
  executiveSummary: string;
  /** Key assumptions underlying the plan */
  assumptions: string[];
}

/**
 * Media Plan budget section
 */
export interface MediaPlanBudget {
  totalMonthly?: number;
  totalQuarterly?: number;
  currency: string;
  constraintsText?: string;
}

/**
 * Media Plan markets/geo section
 */
export interface MediaPlanMarkets {
  /** Geographic targets */
  geo: string[];
  notes?: string;
}

/**
 * Media Plan KPIs section
 */
export interface MediaPlanKPIs {
  primary: PlanKPI[];
  secondary: PlanKPI[];
}

/**
 * Media Plan measurement section
 */
export interface MediaPlanMeasurement {
  /** Analytics stack description */
  trackingStack: string;
  /** Attribution model (e.g., "Last Click", "Data-Driven") */
  attributionModel: string;
  /** Key conversion events to track */
  conversionEvents: string[];
  /** Reporting frequency */
  reportingCadence: string;
}

/**
 * Channel allocation in the media mix
 */
export interface ChannelAllocation {
  id: string;
  channel: string;
  objective: string;
  audience: string;
  monthlyBudget: number;
  kpiTargets: Record<string, string>;
  rationale: string;
}

/**
 * Individual media campaign definition
 */
export interface MediaCampaign {
  id: string;
  name: string;
  channel: string;
  offer: string;
  landingPage?: string;
  targeting: string;
  creativeNeeds: string;
  flighting: {
    startDate: string;
    endDate: string;
  };
  budget: number;
  kpis: Record<string, string>;
  experiments?: string[];
}

/**
 * Media Plan operational cadence
 */
export interface MediaPlanCadence {
  weekly: string[];
  monthly: string[];
}

/**
 * Complete Media Plan sections structure
 */
export interface MediaPlanSections {
  summary: MediaPlanSummary;
  budget: MediaPlanBudget;
  markets: MediaPlanMarkets;
  kpis: MediaPlanKPIs;
  measurement: MediaPlanMeasurement;
  channelMix: ChannelAllocation[];
  campaigns: MediaCampaign[];
  cadence: MediaPlanCadence;
  risks: PlanRiskItem[];
  approvals: PlanApprovals;
}

// ============================================================================
// Content Plan Sections
// ============================================================================

/**
 * Content Plan summary section
 */
export interface ContentPlanSummary {
  /** Primary goal from strategy */
  goalStatement?: string;
  /** Central editorial thesis */
  editorialThesis: string;
  /** Voice and tone guidance */
  voiceGuidance: string;
  constraintsText?: string;
}

/**
 * Content audience segment
 */
export interface ContentSegment {
  id: string;
  segment: string;
  pains: string[];
  intents: string[];
  objections: string[];
}

/**
 * Content Plan audiences section
 */
export interface ContentAudiences {
  segments: ContentSegment[];
}

/**
 * Content pillar definition
 */
export interface ContentPillar {
  id: string;
  pillar: string;
  why: string;
  targetIntents: string[];
  proofPoints: string[];
}

/**
 * Content calendar item
 */
export interface ContentCalendarItem {
  id: string;
  date?: string;
  weekOf?: string;
  channel: string;
  format: string;
  title: string;
  pillar: string;
  objective: string;
  owner?: string;
  status: 'planned' | 'in_progress' | 'published' | 'archived';
  brief?: string;
}

/**
 * SEO strategy section
 */
export interface ContentSEO {
  keywordClusters: string[];
  onPageStandards: string[];
  internalLinkingRules: string[];
}

/**
 * Distribution channel definition
 */
export interface DistributionChannel {
  id: string;
  channel: string;
  frequency: string;
  audience: string;
  goals: string[];
}

/**
 * Content distribution section
 */
export interface ContentDistribution {
  channels: DistributionChannel[];
  partnerships?: string[];
}

/**
 * Content production section
 */
export interface ContentProduction {
  workflowSteps: string[];
  roles: string[];
  sla?: string;
}

/**
 * Content Plan measurement section
 */
export interface ContentPlanMeasurement {
  kpis: PlanKPI[];
  reportingCadence: string;
}

/**
 * Complete Content Plan sections structure
 */
export interface ContentPlanSections {
  summary: ContentPlanSummary;
  audiences: ContentAudiences;
  pillars: ContentPillar[];
  calendar: ContentCalendarItem[];
  seo: ContentSEO;
  distribution: ContentDistribution;
  production: ContentProduction;
  measurement: ContentPlanMeasurement;
  risks: PlanRiskItem[];
  approvals: PlanApprovals;
}

// ============================================================================
// Plan Entities
// ============================================================================

/**
 * Base plan fields shared by both plan types
 */
interface BasePlan {
  id: string;
  companyId: string;
  strategyId: string;
  status: PlanStatus;
  /** Incremented on each approval */
  version: number;
  /** Snapshot for staleness detection */
  sourceSnapshot: PlanSourceSnapshot;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  /** When this plan was archived */
  archivedAt?: string;
  /** Optional reason for archiving */
  archivedReason?: string;
  /** ID of the plan that superseded this one (set when auto-archived on new approval) */
  supersededByPlanId?: string;
  /** ID of the plan this one supersedes (set on the new approved plan) */
  supersedesPlanId?: string;
}

/**
 * Heavy Media Plan entity
 */
export interface MediaPlan extends BasePlan {
  sections: MediaPlanSections;
}

/**
 * Heavy Content Plan entity
 */
export interface ContentPlan extends BasePlan {
  sections: ContentPlanSections;
}

/**
 * Union type for any plan
 */
export type Plan = MediaPlan | ContentPlan;

// ============================================================================
// Plan Proposal (Insert Updates)
// ============================================================================

/**
 * Plan proposal for the "Insert Updates" workflow.
 * Generated by AI when upstream context/strategy changes.
 * Must be explicitly applied or discarded.
 *
 * Supports two modes:
 * 1. Patch-based: proposedPatch contains changes to apply to planId
 * 2. Plan-based: proposedPlanId references a draft plan to approve
 */
export interface PlanProposal {
  id: string;
  planType: PlanType;
  /** Target plan for patch-based proposals */
  planId: string;
  companyId: string;
  strategyId: string;
  /** JSON Patch format (RFC 6902) - for patch-based proposals */
  proposedPatch: unknown;
  /** AI-generated rationale for the changes */
  rationale: string;
  /** Warnings about potential issues */
  warnings: string[];
  /** Metadata about what was used to generate the proposal */
  generatedUsing: {
    /** Context keys that changed */
    contextKeysUsed: string[];
    /** Strategy keys that changed */
    strategyKeysUsed: string[];
    /** Whether goal statement was active */
    goalAlignmentActive: boolean;
    /** Whether business definition was missing */
    businessDefinitionMissing: boolean;
  };
  status: PlanProposalStatus;
  createdAt: string;
  appliedAt?: string;
  discardedAt?: string;

  // === Plan-based proposal fields ===
  /** The proposed plan ID (for plan-based proposals) */
  proposedPlanId?: string;
  /** The currently approved plan ID (for comparison/diff) */
  approvedPlanId?: string;
  /** Title/summary of the proposal */
  title?: string;
  /** Assumptions underlying the proposal */
  assumptions?: string[];
  /** Known unknowns or dependencies */
  unknowns?: string[];

  // === Resolution tracking ===
  /** When the proposal was resolved (accepted/rejected) */
  resolvedAt?: string;
  /** Who resolved the proposal */
  resolvedBy?: string;
  /** Reason for rejection (if discarded) */
  rejectionReason?: string;
  /** The plan that was approved as a result (if applied) */
  acceptedPlanId?: string;
  /** The plan that was superseded (if any) */
  previousApprovedPlanId?: string;
}

// ============================================================================
// Create/Update Input Types
// ============================================================================

/**
 * Input for creating a new Media Plan
 */
export interface CreateMediaPlanInput {
  companyId: string;
  strategyId: string;
  /** Optional initial sections (will use defaults if not provided) */
  sections?: Partial<MediaPlanSections>;
}

/**
 * Input for creating a new Content Plan
 */
export interface CreateContentPlanInput {
  companyId: string;
  strategyId: string;
  /** Optional initial sections (will use defaults if not provided) */
  sections?: Partial<ContentPlanSections>;
}

/**
 * Input for updating plan sections
 */
export interface UpdatePlanSectionsInput {
  sections: Partial<MediaPlanSections> | Partial<ContentPlanSections>;
}

/**
 * Input for creating a plan proposal
 */
export interface CreatePlanProposalInput {
  planType: PlanType;
  planId: string;
  companyId: string;
  strategyId: string;
  proposedPatch: unknown;
  rationale: string;
  warnings?: string[];
  generatedUsing: PlanProposal['generatedUsing'];
}

// ============================================================================
// Default Section Factories
// ============================================================================

/**
 * Create default Media Plan sections
 */
export function createDefaultMediaPlanSections(): MediaPlanSections {
  return {
    summary: {
      goalStatement: '',
      executiveSummary: '',
      assumptions: [],
    },
    budget: {
      totalMonthly: undefined,
      totalQuarterly: undefined,
      currency: 'USD',
      constraintsText: '',
    },
    markets: {
      geo: [],
      notes: '',
    },
    kpis: {
      primary: [],
      secondary: [],
    },
    measurement: {
      trackingStack: '',
      attributionModel: '',
      conversionEvents: [],
      reportingCadence: '',
    },
    channelMix: [],
    campaigns: [],
    cadence: {
      weekly: [],
      monthly: [],
    },
    risks: [],
    approvals: {
      notes: '',
      checklist: [],
    },
  };
}

/**
 * Create default Content Plan sections
 */
export function createDefaultContentPlanSections(): ContentPlanSections {
  return {
    summary: {
      goalStatement: '',
      editorialThesis: '',
      voiceGuidance: '',
      constraintsText: '',
    },
    audiences: {
      segments: [],
    },
    pillars: [],
    calendar: [],
    seo: {
      keywordClusters: [],
      onPageStandards: [],
      internalLinkingRules: [],
    },
    distribution: {
      channels: [],
      partnerships: [],
    },
    production: {
      workflowSteps: [],
      roles: [],
      sla: '',
    },
    measurement: {
      kpis: [],
      reportingCadence: '',
    },
    risks: [],
    approvals: {
      notes: '',
      checklist: [],
    },
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a plan is a Media Plan
 */
export function isMediaPlan(plan: Plan): plan is MediaPlan {
  return 'channelMix' in plan.sections;
}

/**
 * Check if a plan is a Content Plan
 */
export function isContentPlan(plan: Plan): plan is ContentPlan {
  return 'pillars' in plan.sections;
}
