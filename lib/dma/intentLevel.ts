// lib/dma/intentLevel.ts
// Intent level derivation logic for DMA Activity / Intent Radar
//
// Intent Level Rules (highest priority first):
//
// HIGH:
//   - Latest runType is GAP_FULL, OR
//   - 2+ runs within last 14 days, OR
//   - Latest score is Low band (<55) AND latest run is within 7 days
//
// MEDIUM:
//   - Latest run is GAP_IA within 7 days, OR
//   - 2+ GAP_IA runs total (even if older), OR
//   - Latest score is Mid band (55–74) and within 14 days
//
// LOW:
//   - Single GAP_IA run, score High band (>=75), or run older than 14 days
//
// NONE:
//   - No runs

import type { DMARun, IntentLevel, IntentResult, ScoreBand } from '@/lib/types/dma';

/**
 * Score band thresholds
 */
const SCORE_THRESHOLDS = {
  HIGH: 75,  // >= 75 is High
  MID: 55,   // 55-74 is Mid
  // < 55 is Low
} as const;

/**
 * Time thresholds in days
 */
const TIME_THRESHOLDS = {
  RECENT: 7,    // "Recent" run threshold
  MEDIUM: 14,   // Medium-term threshold
} as const;

/**
 * Classify a score into a band
 */
export function getScoreBand(score: number | null): ScoreBand {
  if (score === null || score === undefined || isNaN(score)) {
    return 'NA';
  }
  if (score >= SCORE_THRESHOLDS.HIGH) {
    return 'High';
  }
  if (score >= SCORE_THRESHOLDS.MID) {
    return 'Mid';
  }
  return 'Low';
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor(Math.abs(date2.getTime() - date1.getTime()) / msPerDay);
}

/**
 * Derive intent level from a list of DMA runs for a company
 *
 * @param runs - All runs for a company, will be sorted internally
 * @returns Intent level and reasons
 */
export function deriveIntentLevel(runs: DMARun[]): IntentResult {
  // No runs = None
  if (!runs || runs.length === 0) {
    return { level: 'None', reasons: [] };
  }

  // Sort runs by createdAt descending (most recent first)
  const sortedRuns = [...runs].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const now = new Date();
  const latestRun = sortedRuns[0];
  const latestRunDate = new Date(latestRun.createdAt);
  const daysSinceLatest = daysBetween(now, latestRunDate);
  const latestScoreBand = getScoreBand(latestRun.score);

  // Count runs within time windows
  const runsWithin14Days = sortedRuns.filter(run =>
    daysBetween(now, new Date(run.createdAt)) <= TIME_THRESHOLDS.MEDIUM
  );
  const runsWithin7Days = sortedRuns.filter(run =>
    daysBetween(now, new Date(run.createdAt)) <= TIME_THRESHOLDS.RECENT
  );

  // Count GAP_IA runs total
  const gapIaRuns = sortedRuns.filter(run => run.runType === 'GAP_IA');

  const reasons: string[] = [];

  // ========================================
  // HIGH INTENT CHECKS (highest priority)
  // ========================================

  // Rule: Latest runType is GAP_FULL
  if (latestRun.runType === 'GAP_FULL') {
    reasons.push('Full GAP run');
    return { level: 'High', reasons };
  }

  // Rule: 2+ runs within last 14 days
  if (runsWithin14Days.length >= 2) {
    reasons.push(`${runsWithin14Days.length} runs in last 14 days`);
    return { level: 'High', reasons };
  }

  // Rule: Low score (<55) AND latest run within 7 days
  if (latestScoreBand === 'Low' && daysSinceLatest <= TIME_THRESHOLDS.RECENT) {
    reasons.push('Low score (<55) with recent run');
    return { level: 'High', reasons };
  }

  // ========================================
  // MEDIUM INTENT CHECKS
  // ========================================

  // Rule: Latest run is GAP_IA within 7 days
  if (latestRun.runType === 'GAP_IA' && daysSinceLatest <= TIME_THRESHOLDS.RECENT) {
    reasons.push('Recent IA run (≤7d)');
    return { level: 'Medium', reasons };
  }

  // Rule: 2+ GAP_IA runs total (even if older)
  if (gapIaRuns.length >= 2) {
    reasons.push('Repeat IA runs');
    return { level: 'Medium', reasons };
  }

  // Rule: Mid score (55-74) and within 14 days
  if (latestScoreBand === 'Mid' && daysSinceLatest <= TIME_THRESHOLDS.MEDIUM) {
    reasons.push('Mid score (55-74) with recent activity');
    return { level: 'Medium', reasons };
  }

  // ========================================
  // LOW INTENT (default fallback)
  // ========================================

  // Single GAP_IA run, High score (>=75), or run older than 14 days
  if (sortedRuns.length === 1) {
    reasons.push('Single run only');
  }
  if (latestScoreBand === 'High') {
    reasons.push('High score (≥75)');
  }
  if (daysSinceLatest > TIME_THRESHOLDS.MEDIUM) {
    reasons.push(`Last run ${daysSinceLatest}d ago`);
  }

  // If no specific reason, add a generic one
  if (reasons.length === 0) {
    reasons.push('Low engagement signals');
  }

  return { level: 'Low', reasons };
}

/**
 * Check if a run is "recent" (within 7 days)
 */
export function isRecentRun(createdAt: string): boolean {
  const runDate = new Date(createdAt);
  const now = new Date();
  return daysBetween(now, runDate) <= TIME_THRESHOLDS.RECENT;
}

/**
 * Check if a run qualifies as high-intent alert
 * Used for "Needs Attention" queue
 */
export function isHighIntentAlert(runs: DMARun[]): { isAlert: boolean; reason: string | null } {
  if (!runs || runs.length === 0) {
    return { isAlert: false, reason: null };
  }

  const sortedRuns = [...runs].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const now = new Date();
  const latestRun = sortedRuns[0];
  const latestRunDate = new Date(latestRun.createdAt);
  const daysSinceLatest = daysBetween(now, latestRunDate);
  const latestScoreBand = getScoreBand(latestRun.score);

  // Trigger: New Full GAP in last 7 days
  if (latestRun.runType === 'GAP_FULL' && daysSinceLatest <= TIME_THRESHOLDS.RECENT) {
    return { isAlert: true, reason: 'New Full GAP run' };
  }

  // Trigger: 2+ runs in last 14 days
  const runsWithin14Days = sortedRuns.filter(run =>
    daysBetween(now, new Date(run.createdAt)) <= TIME_THRESHOLDS.MEDIUM
  );
  if (runsWithin14Days.length >= 2) {
    return { isAlert: true, reason: `${runsWithin14Days.length} runs in 14 days` };
  }

  // Trigger: Low score (<55) with run in last 7 days
  if (latestScoreBand === 'Low' && daysSinceLatest <= TIME_THRESHOLDS.RECENT) {
    return { isAlert: true, reason: 'Low score with recent activity' };
  }

  return { isAlert: false, reason: null };
}

/**
 * Export thresholds for testing
 */
export const INTENT_THRESHOLDS = {
  SCORE: SCORE_THRESHOLDS,
  TIME: TIME_THRESHOLDS,
} as const;
