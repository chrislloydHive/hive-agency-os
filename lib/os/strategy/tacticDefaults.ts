// lib/os/strategy/tacticDefaults.ts
// Helper to determine default selected tactics for artifact generation
// Active/completed tactics are selected by default; proposed/rejected are not

import type { Tactic } from '@/lib/types/strategy';

/**
 * Tactic statuses that should be selected by default for artifact generation.
 * These are "accepted" or "live" tactics that represent committed work.
 */
const DEFAULT_ON_STATUSES: Tactic['status'][] = ['active', 'completed'];

/**
 * Tactic statuses that should NOT be selected by default.
 * These are "proposed" or "draft" tactics still under consideration.
 */
const DEFAULT_OFF_STATUSES: Tactic['status'][] = ['proposed', 'rejected'];

/**
 * Get the default selected tactic IDs based on status.
 *
 * Rules:
 * - 'active' and 'completed' tactics are selected by default (ON)
 * - 'proposed' and 'rejected' tactics are NOT selected by default (OFF)
 * - Tactics without status default to OFF (treated as proposed)
 *
 * @param tactics - Array of tactics to filter
 * @returns Array of tactic IDs that should be selected by default
 */
export function getDefaultSelectedTacticIds(tactics: Tactic[]): string[] {
  if (!tactics || !Array.isArray(tactics)) {
    return [];
  }

  return tactics
    .filter(tactic => {
      const status = tactic.status;
      // If no status, treat as proposed (OFF)
      if (!status) return false;
      return DEFAULT_ON_STATUSES.includes(status);
    })
    .map(tactic => tactic.id);
}

/**
 * Check if a tactic should be selected by default based on its status.
 *
 * @param tactic - Single tactic to check
 * @returns true if tactic should be selected by default
 */
export function isTacticDefaultSelected(tactic: Tactic): boolean {
  const status = tactic.status;
  if (!status) return false;
  return DEFAULT_ON_STATUSES.includes(status);
}

/**
 * Group tactics by their default selection state.
 *
 * @param tactics - Array of tactics to group
 * @returns Object with 'defaultOn' and 'defaultOff' arrays
 */
export function groupTacticsByDefaultSelection(tactics: Tactic[]): {
  defaultOn: Tactic[];
  defaultOff: Tactic[];
} {
  if (!tactics || !Array.isArray(tactics)) {
    return { defaultOn: [], defaultOff: [] };
  }

  const defaultOn: Tactic[] = [];
  const defaultOff: Tactic[] = [];

  for (const tactic of tactics) {
    if (isTacticDefaultSelected(tactic)) {
      defaultOn.push(tactic);
    } else {
      defaultOff.push(tactic);
    }
  }

  return { defaultOn, defaultOff };
}

/**
 * Get a human-readable label for tactic status.
 *
 * @param status - Tactic status
 * @returns Human-readable label
 */
export function getTacticStatusLabel(status: Tactic['status']): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    case 'proposed':
      return 'Proposed';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Unknown';
  }
}

/**
 * Check if tactic status indicates it's "live" (active or completed).
 *
 * @param status - Tactic status
 * @returns true if status indicates tactic is live
 */
export function isTacticLive(status: Tactic['status']): boolean {
  return status === 'active' || status === 'completed';
}
