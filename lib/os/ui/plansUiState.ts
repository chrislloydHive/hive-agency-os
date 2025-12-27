// lib/os/ui/plansUiState.ts
// Plans UI State Selector for Deliver Page
//
// Single source of truth for plan cards and CTAs on the Deliver page.
// Maps raw plan data → discrete UI state → visibility rules.

import type { MediaPlan, ContentPlan, PlanStatus, PlanType } from '@/lib/types/plan';

// ============================================================================
// Types
// ============================================================================

/**
 * Discrete states for the plans experience on Deliver page
 */
export type PlansState =
  | 'blocked_no_strategy'     // No strategy exists
  | 'ready_no_plans'          // Can create plans but none exist
  | 'plans_drafting'          // Has at least one draft plan
  | 'plans_in_review'         // Has at least one plan in review
  | 'plans_approved'          // All existing plans are approved
  | 'plans_stale';            // Has approved plans that are stale

/**
 * Banner tone for the current state
 */
export type BannerTone = 'blocked' | 'ready' | 'warning' | 'status';

/**
 * Banner configuration
 */
export interface PlansBanner {
  tone: BannerTone;
  title: string;
  body: string;
}

/**
 * CTA configuration
 */
export interface PlansCTA {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

/**
 * Summary of a plan for display
 */
export interface PlanSummary {
  type: PlanType;
  id: string;
  status: PlanStatus;
  version: number;
  isStale: boolean;
  stalenessReason: string | null;
  pendingProposalCount: number;
  updatedAt: string;
  /** When this plan was archived (if archived) */
  archivedAt?: string;
  /** Reason for archiving (if archived) */
  archivedReason?: string;
  /** ID of the plan that superseded this one */
  supersededByPlanId?: string;
  /** ID of the plan this one supersedes */
  supersedesPlanId?: string;
}

/**
 * Debug info for development
 */
export interface PlansDebugInfo {
  hasStrategy: boolean;
  hasMediaPlan: boolean;
  hasContentPlan: boolean;
  mediaPlanStatus: PlanStatus | null;
  contentPlanStatus: PlanStatus | null;
  anyPlansStale: boolean;
}

/**
 * Full UI state derived from data
 */
export interface PlansUIState {
  state: PlansState;
  mediaPlan: PlanSummary | null;
  contentPlan: PlanSummary | null;
  showCreateMediaPlan: boolean;
  showCreateContentPlan: boolean;
  showPlanCards: boolean;
  primaryCTA: PlansCTA;
  secondaryCTA: PlansCTA | null;
  banner: PlansBanner;
  debug: PlansDebugInfo;
}

/**
 * Raw data inputs for state derivation
 */
export interface PlansDataInput {
  strategyId: string | null;
  mediaPlan: MediaPlan | null;
  contentPlan: ContentPlan | null;
  mediaPlanStale?: boolean;
  contentPlanStale?: boolean;
  mediaPlanStalenessReason?: string | null;
  contentPlanStalenessReason?: string | null;
  mediaPlanPendingProposals?: number;
  contentPlanPendingProposals?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create PlanSummary from a plan
 */
function createPlanSummary(
  plan: MediaPlan | ContentPlan,
  type: PlanType,
  isStale: boolean,
  stalenessReason: string | null,
  pendingProposalCount: number
): PlanSummary {
  return {
    type,
    id: plan.id,
    status: plan.status,
    version: plan.version,
    isStale,
    stalenessReason,
    pendingProposalCount,
    updatedAt: plan.updatedAt,
    archivedAt: plan.archivedAt,
    archivedReason: plan.archivedReason,
    supersededByPlanId: plan.supersededByPlanId,
    supersedesPlanId: plan.supersedesPlanId,
  };
}

/**
 * Get the highest priority status from plans
 */
function getHighestPriorityStatus(
  mediaPlan: MediaPlan | null,
  contentPlan: ContentPlan | null
): PlanStatus | null {
  const statuses: PlanStatus[] = [];
  if (mediaPlan && mediaPlan.status !== 'archived') statuses.push(mediaPlan.status);
  if (contentPlan && contentPlan.status !== 'archived') statuses.push(contentPlan.status);

  if (statuses.length === 0) return null;

  // Priority: draft > in_review > approved
  if (statuses.includes('draft')) return 'draft';
  if (statuses.includes('in_review')) return 'in_review';
  if (statuses.includes('approved')) return 'approved';

  return null;
}

// ============================================================================
// State Derivation
// ============================================================================

/**
 * Derive the discrete PlansState from raw data
 */
export function derivePlansState(input: PlansDataInput): PlansState {
  const { strategyId, mediaPlan, contentPlan, mediaPlanStale, contentPlanStale } = input;

  // Check for strategy
  if (!strategyId) {
    return 'blocked_no_strategy';
  }

  // Check if any plans exist (non-archived)
  const hasMediaPlan = mediaPlan && mediaPlan.status !== 'archived';
  const hasContentPlan = contentPlan && contentPlan.status !== 'archived';
  const hasAnyPlan = hasMediaPlan || hasContentPlan;

  if (!hasAnyPlan) {
    return 'ready_no_plans';
  }

  // Check staleness (only for approved plans)
  const isMediaPlanStale = hasMediaPlan && mediaPlan!.status === 'approved' && mediaPlanStale;
  const isContentPlanStale = hasContentPlan && contentPlan!.status === 'approved' && contentPlanStale;

  if (isMediaPlanStale || isContentPlanStale) {
    return 'plans_stale';
  }

  // Check status priority
  const highestStatus = getHighestPriorityStatus(mediaPlan, contentPlan);

  switch (highestStatus) {
    case 'draft':
      return 'plans_drafting';
    case 'in_review':
      return 'plans_in_review';
    case 'approved':
      return 'plans_approved';
    default:
      return 'ready_no_plans';
  }
}

// ============================================================================
// Banner Configuration
// ============================================================================

/**
 * Get banner configuration for a state
 */
function getBanner(state: PlansState): PlansBanner {
  switch (state) {
    case 'blocked_no_strategy':
      return {
        tone: 'blocked',
        title: 'Create a strategy first',
        body: 'Complete your strategy in the Decide phase before creating plans.',
      };

    case 'ready_no_plans':
      return {
        tone: 'ready',
        title: 'Ready to create plans',
        body: 'Create a Media Plan or Content Plan to bridge your strategy to execution.',
      };

    case 'plans_drafting':
      return {
        tone: 'status',
        title: 'Plans in progress',
        body: 'Continue editing your draft plans and submit for review when ready.',
      };

    case 'plans_in_review':
      return {
        tone: 'warning',
        title: 'Plans awaiting approval',
        body: 'Review and approve your plans to start generating work items.',
      };

    case 'plans_approved':
      return {
        tone: 'status',
        title: 'Plans approved',
        body: 'Your plans are approved and ready to generate execution programs.',
      };

    case 'plans_stale':
      return {
        tone: 'warning',
        title: 'Plans need updates',
        body: 'Strategy or context has changed. Review and apply updates to keep plans aligned.',
      };
  }
}

// ============================================================================
// CTA Configuration
// ============================================================================

/**
 * Get primary CTA based on state
 */
function getPrimaryCTA(
  state: PlansState,
  companyId: string,
  input: PlansDataInput
): PlansCTA {
  switch (state) {
    case 'blocked_no_strategy':
      return {
        label: 'Go to Strategy',
        href: `/c/${companyId}/strategy`,
        variant: 'primary',
      };

    case 'ready_no_plans':
      return {
        label: 'Create Media Plan',
        href: `/c/${companyId}/deliver/media-plan`,
        variant: 'primary',
      };

    case 'plans_drafting': {
      // Link to the draft plan
      if (input.mediaPlan?.status === 'draft') {
        return {
          label: 'Continue Media Plan',
          href: `/c/${companyId}/deliver/media-plan`,
          variant: 'primary',
        };
      }
      if (input.contentPlan?.status === 'draft') {
        return {
          label: 'Continue Content Plan',
          href: `/c/${companyId}/deliver/content-plan`,
          variant: 'primary',
        };
      }
      return {
        label: 'Continue Plans',
        href: `/c/${companyId}/deliver`,
        variant: 'primary',
      };
    }

    case 'plans_in_review': {
      // Link to the plan in review
      if (input.mediaPlan?.status === 'in_review') {
        return {
          label: 'Review Media Plan',
          href: `/c/${companyId}/deliver/media-plan`,
          variant: 'primary',
        };
      }
      if (input.contentPlan?.status === 'in_review') {
        return {
          label: 'Review Content Plan',
          href: `/c/${companyId}/deliver/content-plan`,
          variant: 'primary',
        };
      }
      return {
        label: 'Review Plans',
        href: `/c/${companyId}/deliver`,
        variant: 'primary',
      };
    }

    case 'plans_approved':
      return {
        label: 'View Plans',
        href: `/c/${companyId}/deliver`,
        variant: 'secondary',
      };

    case 'plans_stale': {
      // Link to the stale plan
      if (input.mediaPlanStale) {
        return {
          label: 'Update Media Plan',
          href: `/c/${companyId}/deliver/media-plan`,
          variant: 'primary',
        };
      }
      if (input.contentPlanStale) {
        return {
          label: 'Update Content Plan',
          href: `/c/${companyId}/deliver/content-plan`,
          variant: 'primary',
        };
      }
      return {
        label: 'Update Plans',
        href: `/c/${companyId}/deliver`,
        variant: 'primary',
      };
    }
  }
}

/**
 * Get secondary CTA if applicable
 */
function getSecondaryCTA(
  state: PlansState,
  companyId: string,
  input: PlansDataInput
): PlansCTA | null {
  // Show "Create Content Plan" as secondary when Media Plan exists but not Content
  if (state === 'ready_no_plans') {
    return {
      label: 'Create Content Plan',
      href: `/c/${companyId}/deliver/content-plan`,
      variant: 'secondary',
    };
  }

  // If only one plan exists, offer to create the other
  if (
    state === 'plans_drafting' ||
    state === 'plans_in_review' ||
    state === 'plans_approved'
  ) {
    if (!input.mediaPlan) {
      return {
        label: 'Create Media Plan',
        href: `/c/${companyId}/deliver/media-plan`,
        variant: 'secondary',
      };
    }
    if (!input.contentPlan) {
      return {
        label: 'Create Content Plan',
        href: `/c/${companyId}/deliver/content-plan`,
        variant: 'secondary',
      };
    }
  }

  return null;
}

// ============================================================================
// Main Selector
// ============================================================================

/**
 * Get the complete Plans UI state from raw data
 *
 * This is the single source of truth for all plan-related UI decisions on Deliver.
 *
 * @param input - Raw data from APIs
 * @param companyId - Company ID for building URLs
 * @returns Complete UI state configuration
 */
export function getPlansUIState(
  input: PlansDataInput,
  companyId: string
): PlansUIState {
  const state = derivePlansState(input);

  // Create plan summaries
  const mediaPlanSummary = input.mediaPlan
    ? createPlanSummary(
        input.mediaPlan,
        'media',
        input.mediaPlanStale ?? false,
        input.mediaPlanStalenessReason ?? null,
        input.mediaPlanPendingProposals ?? 0
      )
    : null;

  const contentPlanSummary = input.contentPlan
    ? createPlanSummary(
        input.contentPlan,
        'content',
        input.contentPlanStale ?? false,
        input.contentPlanStalenessReason ?? null,
        input.contentPlanPendingProposals ?? 0
      )
    : null;

  // Visibility rules
  const isBlocked = state === 'blocked_no_strategy';
  const showPlanCards = !isBlocked;
  const showCreateMediaPlan = !isBlocked && !input.mediaPlan;
  const showCreateContentPlan = !isBlocked && !input.contentPlan;

  // CTAs and banner
  const banner = getBanner(state);
  const primaryCTA = getPrimaryCTA(state, companyId, input);
  const secondaryCTA = getSecondaryCTA(state, companyId, input);

  // Debug info
  const debug: PlansDebugInfo = {
    hasStrategy: !!input.strategyId,
    hasMediaPlan: !!input.mediaPlan,
    hasContentPlan: !!input.contentPlan,
    mediaPlanStatus: input.mediaPlan?.status ?? null,
    contentPlanStatus: input.contentPlan?.status ?? null,
    anyPlansStale: (input.mediaPlanStale ?? false) || (input.contentPlanStale ?? false),
  };

  return {
    state,
    mediaPlan: mediaPlanSummary,
    contentPlan: contentPlanSummary,
    showCreateMediaPlan,
    showCreateContentPlan,
    showPlanCards,
    primaryCTA,
    secondaryCTA,
    banner,
    debug,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if plans section should be visible
 */
export function shouldShowPlansSection(input: PlansDataInput): boolean {
  return !!input.strategyId;
}

/**
 * Get human-readable status summary
 */
export function getPlansStatusSummary(uiState: PlansUIState): string {
  switch (uiState.state) {
    case 'blocked_no_strategy':
      return 'Requires strategy';
    case 'ready_no_plans':
      return 'No plans created';
    case 'plans_drafting':
      return 'Drafts in progress';
    case 'plans_in_review':
      return 'Awaiting approval';
    case 'plans_approved':
      return 'All plans approved';
    case 'plans_stale':
      return 'Updates available';
  }
}
