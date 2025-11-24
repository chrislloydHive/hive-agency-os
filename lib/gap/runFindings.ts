/**
 * Helper functions for managing current finding messages in GAP runs
 */

import type { GapRunState } from '@/types/gap';

/**
 * Set the current finding message for a GAP run
 * This is displayed as a live teaser line in the loader
 */
export function setCurrentFinding(run: GapRunState, message: string): void {
  run.currentFinding = message;
  run.updatedAt = new Date().toISOString();
}

/**
 * Clear the current finding message
 */
export function clearCurrentFinding(run: GapRunState): void {
  run.currentFinding = undefined;
  run.updatedAt = new Date().toISOString();
}

