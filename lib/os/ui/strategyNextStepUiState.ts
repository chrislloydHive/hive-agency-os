// lib/os/ui/strategyNextStepUiState.ts
// Strategy Next Step UI State Selector
//
// Guides users from completed Decide phase to creating plans in Deliver.
// Provides recommendations for which plans to create based on context.

import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import type { MediaPlan, ContentPlan, PlanStatus } from '@/lib/types/plan';

// ============================================================================
// Types
// ============================================================================

/**
 * Discrete states for the strategy next step experience
 */
export type StrategyNextStepState =
  | 'context_incomplete'     // Need more confirmed fields
  | 'strategy_incomplete'    // Strategy not complete (no bets accepted)
  | 'ready_for_plans'        // Can create plans
  | 'plans_in_progress'      // Has draft/in_review plans
  | 'plans_complete';        // All plans approved

/**
 * Plan recommendation with reason
 */
export interface PlanRecommendation {
  recommended: boolean;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * CTA configuration
 */
export interface NextStepCTA {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

/**
 * Debug info for development
 */
export interface NextStepDebugInfo {
  confirmedCount: number;
  hasStrategy: boolean;
  strategyLocked: boolean;
  acceptedBetsCount: number;
  hasMediaPlan: boolean;
  hasContentPlan: boolean;
  mediaPlanStatus: PlanStatus | null;
  contentPlanStatus: PlanStatus | null;
}

/**
 * Full UI state derived from data
 */
export interface StrategyNextStepUIState {
  state: StrategyNextStepState;
  isDecideComplete: boolean;
  recommendedPlans: {
    media: PlanRecommendation | null;
    content: PlanRecommendation | null;
  };
  primaryCTA: NextStepCTA;
  secondaryCTAs: NextStepCTA[];
  blockingReasons: string[];
  showNextStepPanel: boolean;
  debug: NextStepDebugInfo;
}

/**
 * Raw data inputs for state derivation
 */
export interface StrategyNextStepDataInput {
  contextHealth: V4HealthResponse | null;
  strategyId: string | null;
  strategyLocked?: boolean;
  acceptedBetsCount: number;
  objectivesCount: number;
  mediaPlan: MediaPlan | null;
  contentPlan: ContentPlan | null;
  // Context hints for recommendations
  hasBudgetInContext?: boolean;
  hasChannelsInContext?: boolean;
  hasSEOLabRun?: boolean;
  hasContentBets?: boolean;
  hasPaidChannelBets?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum confirmed fields to consider "context complete"
 */
const CONTEXT_CONFIRMED_THRESHOLD = 3;

/**
 * Minimum accepted bets to consider "strategy complete"
 */
const ACCEPTED_BETS_THRESHOLD = 1;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if context is sufficiently confirmed
 */
function isContextComplete(contextHealth: V4HealthResponse | null): boolean {
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  return confirmedCount >= CONTEXT_CONFIRMED_THRESHOLD;
}

/**
 * Check if strategy is complete (has accepted bets)
 */
function isStrategyComplete(
  strategyId: string | null,
  acceptedBetsCount: number
): boolean {
  return !!strategyId && acceptedBetsCount >= ACCEPTED_BETS_THRESHOLD;
}

/**
 * Get plan recommendation for Media Plan
 */
function getMediaPlanRecommendation(
  input: StrategyNextStepDataInput
): PlanRecommendation | null {
  // Don't recommend if already have one
  if (input.mediaPlan) return null;

  // High priority if budget or paid channels mentioned
  if (input.hasBudgetInContext || input.hasPaidChannelBets) {
    return {
      recommended: true,
      reason: 'You have budget or paid channel strategies defined',
      priority: 'high',
    };
  }

  // Medium priority if channels mentioned
  if (input.hasChannelsInContext) {
    return {
      recommended: true,
      reason: 'You have marketing channels defined in context',
      priority: 'medium',
    };
  }

  // Low priority - always allow creation
  return {
    recommended: false,
    reason: 'Optional: Plan paid media campaigns',
    priority: 'low',
  };
}

/**
 * Get plan recommendation for Content Plan
 */
function getContentPlanRecommendation(
  input: StrategyNextStepDataInput
): PlanRecommendation | null {
  // Don't recommend if already have one
  if (input.contentPlan) return null;

  // High priority if SEO lab run or content bets
  if (input.hasSEOLabRun || input.hasContentBets) {
    return {
      recommended: true,
      reason: 'You have SEO/content strategies defined',
      priority: 'high',
    };
  }

  // Low priority - always allow creation
  return {
    recommended: false,
    reason: 'Optional: Plan content strategy and calendar',
    priority: 'low',
  };
}

/**
 * Check if any plans are in progress (draft or in_review)
 */
function hasPlansInProgress(
  mediaPlan: MediaPlan | null,
  contentPlan: ContentPlan | null
): boolean {
  const inProgressStatuses: PlanStatus[] = ['draft', 'in_review'];
  return (
    (mediaPlan && inProgressStatuses.includes(mediaPlan.status)) ||
    (contentPlan && inProgressStatuses.includes(contentPlan.status))
  ) ?? false;
}

/**
 * Check if all existing plans are approved
 */
function arePlansComplete(
  mediaPlan: MediaPlan | null,
  contentPlan: ContentPlan | null
): boolean {
  // If no plans exist, not complete
  if (!mediaPlan && !contentPlan) return false;

  // Check each existing plan
  if (mediaPlan && mediaPlan.status !== 'approved') return false;
  if (contentPlan && contentPlan.status !== 'approved') return false;

  return true;
}

// ============================================================================
// State Derivation
// ============================================================================

/**
 * Derive the discrete state from raw data
 */
export function deriveStrategyNextStepState(
  input: StrategyNextStepDataInput
): StrategyNextStepState {
  const { contextHealth, strategyId, acceptedBetsCount, mediaPlan, contentPlan } = input;

  // Check context completeness
  if (!isContextComplete(contextHealth)) {
    return 'context_incomplete';
  }

  // Check strategy completeness
  if (!isStrategyComplete(strategyId, acceptedBetsCount)) {
    return 'strategy_incomplete';
  }

  // Check plan states
  if (arePlansComplete(mediaPlan, contentPlan)) {
    return 'plans_complete';
  }

  if (hasPlansInProgress(mediaPlan, contentPlan)) {
    return 'plans_in_progress';
  }

  return 'ready_for_plans';
}

// ============================================================================
// CTA Configuration
// ============================================================================

/**
 * Get primary CTA based on state
 */
function getPrimaryCTA(
  state: StrategyNextStepState,
  companyId: string,
  input: StrategyNextStepDataInput
): NextStepCTA {
  switch (state) {
    case 'context_incomplete':
      return {
        label: 'Confirm Context',
        href: `/c/${companyId}/decide`,
        variant: 'primary',
      };

    case 'strategy_incomplete':
      return {
        label: 'Complete Strategy',
        href: `/c/${companyId}/strategy`,
        variant: 'primary',
      };

    case 'ready_for_plans': {
      // Recommend the higher priority plan
      const mediaRec = getMediaPlanRecommendation(input);
      const contentRec = getContentPlanRecommendation(input);

      if (mediaRec?.priority === 'high') {
        return {
          label: 'Create Media Plan',
          href: `/c/${companyId}/deliver/media-plan`,
          variant: 'primary',
        };
      }
      if (contentRec?.priority === 'high') {
        return {
          label: 'Create Content Plan',
          href: `/c/${companyId}/deliver/content-plan`,
          variant: 'primary',
        };
      }
      return {
        label: 'Go to Deliver',
        href: `/c/${companyId}/deliver`,
        variant: 'primary',
      };
    }

    case 'plans_in_progress':
      return {
        label: 'Continue Plans',
        href: `/c/${companyId}/deliver`,
        variant: 'primary',
      };

    case 'plans_complete':
      return {
        label: 'View Deliverables',
        href: `/c/${companyId}/deliver`,
        variant: 'secondary',
      };
  }
}

/**
 * Get secondary CTAs based on state
 */
function getSecondaryCTAs(
  state: StrategyNextStepState,
  companyId: string,
  input: StrategyNextStepDataInput
): NextStepCTA[] {
  const ctas: NextStepCTA[] = [];

  if (state !== 'ready_for_plans' && state !== 'plans_in_progress') {
    return ctas;
  }

  // Add Media Plan CTA if not created yet
  if (!input.mediaPlan) {
    ctas.push({
      label: 'Create Media Plan',
      href: `/c/${companyId}/deliver/media-plan`,
      variant: 'secondary',
    });
  }

  // Add Content Plan CTA if not created yet
  if (!input.contentPlan) {
    ctas.push({
      label: 'Create Content Plan',
      href: `/c/${companyId}/deliver/content-plan`,
      variant: 'secondary',
    });
  }

  return ctas;
}

/**
 * Get blocking reasons for current state
 */
function getBlockingReasons(
  state: StrategyNextStepState,
  input: StrategyNextStepDataInput
): string[] {
  const reasons: string[] = [];
  const confirmedCount = input.contextHealth?.store?.confirmed ?? 0;

  switch (state) {
    case 'context_incomplete':
      reasons.push(
        `Confirm at least ${CONTEXT_CONFIRMED_THRESHOLD} context fields (${confirmedCount} confirmed)`
      );
      break;

    case 'strategy_incomplete':
      if (!input.strategyId) {
        reasons.push('Create a strategy');
      } else if (input.acceptedBetsCount < ACCEPTED_BETS_THRESHOLD) {
        reasons.push('Accept at least 1 strategic bet');
      }
      break;
  }

  return reasons;
}

// ============================================================================
// Main Selector
// ============================================================================

/**
 * Get the complete Strategy Next Step UI state from raw data
 *
 * This selector guides users from Decide completion to plan creation in Deliver.
 *
 * @param input - Raw data from APIs
 * @param companyId - Company ID for building URLs
 * @returns Complete UI state configuration
 */
export function getStrategyNextStepUIState(
  input: StrategyNextStepDataInput,
  companyId: string
): StrategyNextStepUIState {
  const state = deriveStrategyNextStepState(input);

  const isDecideComplete =
    state !== 'context_incomplete' && state !== 'strategy_incomplete';

  const recommendedPlans = {
    media: getMediaPlanRecommendation(input),
    content: getContentPlanRecommendation(input),
  };

  const primaryCTA = getPrimaryCTA(state, companyId, input);
  const secondaryCTAs = getSecondaryCTAs(state, companyId, input);
  const blockingReasons = getBlockingReasons(state, input);

  // Only show panel when Decide is complete
  const showNextStepPanel = isDecideComplete;

  const debug: NextStepDebugInfo = {
    confirmedCount: input.contextHealth?.store?.confirmed ?? 0,
    hasStrategy: !!input.strategyId,
    strategyLocked: input.strategyLocked ?? false,
    acceptedBetsCount: input.acceptedBetsCount,
    hasMediaPlan: !!input.mediaPlan,
    hasContentPlan: !!input.contentPlan,
    mediaPlanStatus: input.mediaPlan?.status ?? null,
    contentPlanStatus: input.contentPlan?.status ?? null,
  };

  return {
    state,
    isDecideComplete,
    recommendedPlans,
    primaryCTA,
    secondaryCTAs,
    blockingReasons,
    showNextStepPanel,
    debug,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if ready to create plans
 */
export function canCreatePlans(input: StrategyNextStepDataInput): boolean {
  const state = deriveStrategyNextStepState(input);
  return (
    state === 'ready_for_plans' ||
    state === 'plans_in_progress' ||
    state === 'plans_complete'
  );
}

/**
 * Get human-readable status summary
 */
export function getNextStepStatusSummary(
  uiState: StrategyNextStepUIState
): string {
  switch (uiState.state) {
    case 'context_incomplete':
      return 'Complete context confirmation';
    case 'strategy_incomplete':
      return 'Complete strategy';
    case 'ready_for_plans':
      return 'Ready to create plans';
    case 'plans_in_progress':
      return 'Plans in progress';
    case 'plans_complete':
      return 'Plans approved';
  }
}
