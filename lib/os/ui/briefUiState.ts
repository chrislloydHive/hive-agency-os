// lib/os/ui/briefUiState.ts
// Brief Generation UI State Selector
//
// Single source of truth for Creative Brief generation gating.
// Maps strategy readiness → discrete UI state → button behavior.
//
// Gating Rules (in priority order):
// 1. Strategy must exist
// 2. Strategic Frame must be complete (all 4 fields: audience, valueProp, positioning, constraints)
// 3. At least 1 Strategic Bet must be accepted
//
// NOTE: Full GAP is NOT required. The new flow is Decide-driven.

import type { StrategyFrame } from '@/lib/types/strategy';
import type { StrategyPillar } from '@/lib/types/strategy';
import { computeFrameCompleteness, type FrameCompleteness } from '@/lib/os/strategy/frameValidation';

// ============================================================================
// Types
// ============================================================================

/**
 * Discrete states for Brief generation
 */
export type BriefState =
  | 'blocked_no_strategy'        // No strategy exists
  | 'blocked_frame_incomplete'   // Frame has missing required fields
  | 'blocked_no_accepted_bets'   // No Strategic Bets are accepted
  | 'ready';                     // All requirements met

/**
 * Raw data inputs for state derivation
 */
export interface BriefDataInput {
  /** Whether a strategy exists for this company */
  strategyExists: boolean;
  /** The Strategic Frame (or undefined if no strategy) */
  frame?: StrategyFrame;
  /** All Strategic Bets (pillars with status) */
  bets: Array<{ status?: string }>;
  /** Pre-computed frame completeness (optional - will be computed if not provided) */
  frameCompleteness?: FrameCompleteness;
}

/**
 * Full UI state derived from data
 */
export interface BriefUIState {
  /** Current discrete state */
  state: BriefState;
  /** Whether brief generation is allowed */
  canGenerate: boolean;
  /** Human-readable reason when blocked (null if ready) */
  disabledReason: string | null;
  /** CTA button label */
  ctaLabel: string;
  /** CTA href when blocked (for navigation to fix issues), null when ready */
  ctaHref: string | null;
  /** Missing frame field keys (empty if frame is complete) */
  missingFrameKeys: string[];
  /** Count of accepted Strategic Bets */
  acceptedBetsCount: number;
  /** Frame completeness details */
  frameCompleteness: FrameCompleteness;
}

// ============================================================================
// State Derivation
// ============================================================================

/**
 * Derive Brief UI state from raw data
 *
 * Priority order (first match wins):
 * 1. No strategy → blocked_no_strategy
 * 2. Frame incomplete → blocked_frame_incomplete
 * 3. No accepted bets → blocked_no_accepted_bets
 * 4. All requirements met → ready
 */
export function getBriefUIState(input: BriefDataInput, companyId?: string): BriefUIState {
  const { strategyExists, frame, bets, frameCompleteness: providedFrameCompleteness } = input;

  // Compute frame completeness (use provided or compute)
  const frameCompleteness = providedFrameCompleteness ?? computeFrameCompleteness(frame);

  // Count accepted bets
  const acceptedBetsCount = bets.filter(b => b.status === 'accepted').length;

  // Base href for navigation
  const baseHref = companyId ? `/c/${companyId}` : '';

  // Check gates in priority order

  // 1. No strategy
  if (!strategyExists) {
    return {
      state: 'blocked_no_strategy',
      canGenerate: false,
      disabledReason: 'Create a strategy first',
      ctaLabel: 'Create Strategy',
      ctaHref: baseHref ? `${baseHref}/strategy` : null,
      missingFrameKeys: frameCompleteness.missingFields,
      acceptedBetsCount,
      frameCompleteness,
    };
  }

  // 2. Frame incomplete
  if (!frameCompleteness.isComplete) {
    const missingCount = frameCompleteness.missingFields.length;
    const missingLabels = frameCompleteness.missingLabels.join(', ');
    return {
      state: 'blocked_frame_incomplete',
      canGenerate: false,
      disabledReason: `Complete your Strategic Frame (${missingCount} field${missingCount > 1 ? 's' : ''} missing: ${missingLabels})`,
      ctaLabel: 'Fix Frame',
      ctaHref: baseHref ? `${baseHref}/strategy` : null,
      missingFrameKeys: frameCompleteness.missingFields,
      acceptedBetsCount,
      frameCompleteness,
    };
  }

  // 3. No accepted bets
  if (acceptedBetsCount === 0) {
    return {
      state: 'blocked_no_accepted_bets',
      canGenerate: false,
      disabledReason: 'Accept at least 1 Strategic Bet',
      ctaLabel: 'Accept Bets',
      ctaHref: baseHref ? `${baseHref}/strategy` : null,
      missingFrameKeys: [],
      acceptedBetsCount,
      frameCompleteness,
    };
  }

  // 4. Ready
  return {
    state: 'ready',
    canGenerate: true,
    disabledReason: null,
    ctaLabel: 'Generate Brief',
    ctaHref: null,
    missingFrameKeys: [],
    acceptedBetsCount,
    frameCompleteness,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if Brief can be generated (convenience function)
 */
export function canGenerateBrief(input: BriefDataInput): boolean {
  return getBriefUIState(input).canGenerate;
}

/**
 * Get a short status summary for display
 */
export function getBriefStatusSummary(uiState: BriefUIState): string {
  switch (uiState.state) {
    case 'blocked_no_strategy':
      return 'No strategy';
    case 'blocked_frame_incomplete':
      return `${uiState.missingFrameKeys.length} frame field${uiState.missingFrameKeys.length > 1 ? 's' : ''} missing`;
    case 'blocked_no_accepted_bets':
      return 'No accepted bets';
    case 'ready':
      return `Ready (${uiState.acceptedBetsCount} bet${uiState.acceptedBetsCount > 1 ? 's' : ''} accepted)`;
  }
}
