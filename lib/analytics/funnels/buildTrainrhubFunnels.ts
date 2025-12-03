// lib/analytics/funnels/buildTrainrhubFunnels.ts
// ============================================================================
// TrainrHub Funnel Metrics Builder
// ============================================================================
//
// Converts GA4 data from CompanyAnalyticsSnapshot into TrainrHub funnel metrics.
// Uses page view data and estimated event data to build funnel steps.

import type { FunnelStep } from '@/components/analytics/StandardFunnelPanel';
import type { CompanyAnalyticsSnapshot } from '@/lib/analytics/types';
import {
  TRAINRHUB_FUNNELS,
  type TrainrhubFunnelDefinition,
  type TrainrhubFunnelMetrics,
} from './trainrhub';

// ============================================================================
// Types
// ============================================================================

interface PageViewData {
  path: string;
  pageviews: number;
}

// ============================================================================
// Path Matching Helpers
// ============================================================================

/**
 * Check if a page path matches any of the given patterns
 */
function matchesPathPattern(path: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return false;

  const normalizedPath = path.toLowerCase();
  return patterns.some(pattern => {
    const normalizedPattern = pattern.toLowerCase();
    // Support both exact matches and prefix matches (ending with /)
    if (normalizedPattern.endsWith('/')) {
      return normalizedPath.startsWith(normalizedPattern) ||
             normalizedPath === normalizedPattern.slice(0, -1);
    }
    return normalizedPath === normalizedPattern ||
           normalizedPath.startsWith(normalizedPattern + '/');
  });
}

/**
 * Count page views matching path patterns
 */
function countPageViewsForPatterns(
  pages: PageViewData[],
  patterns?: string[]
): number {
  if (!patterns || patterns.length === 0) return 0;

  return pages
    .filter(p => matchesPathPattern(p.path, patterns))
    .reduce((sum, p) => sum + p.pageviews, 0);
}

// ============================================================================
// Funnel Building
// ============================================================================

/**
 * Build TrainrHub funnel metrics from a CompanyAnalyticsSnapshot
 *
 * Since we don't have direct access to GA4 events, we estimate funnel steps from:
 * - Page view data (for landing/browse/profile steps)
 * - Conversion metrics (for CTA/signup steps)
 */
export function buildTrainrhubFunnelsFromSnapshot(
  snapshot: CompanyAnalyticsSnapshot | null
): TrainrhubFunnelMetrics[] {
  if (!snapshot || !snapshot.ga4) {
    return getEmptyTrainrhubFunnels();
  }

  const ga4 = snapshot.ga4;
  const topPages = (ga4.topPages || []) as PageViewData[];
  const metrics = ga4.metrics;

  const sessions = metrics?.sessions || 0;
  const conversions = metrics?.conversions || 0;
  const engagementRate = metrics?.engagementRate || 0.5;

  const results: TrainrhubFunnelMetrics[] = [];

  for (const funnelDef of TRAINRHUB_FUNNELS) {
    const funnelMetrics = buildSingleFunnel(
      funnelDef,
      topPages,
      sessions,
      conversions,
      engagementRate
    );
    results.push(funnelMetrics);
  }

  return results;
}

/**
 * Build a single funnel from page data and metrics
 */
function buildSingleFunnel(
  definition: TrainrhubFunnelDefinition,
  pages: PageViewData[],
  totalSessions: number,
  totalConversions: number,
  engagementRate: number
): TrainrhubFunnelMetrics {
  const steps: FunnelStep[] = [];
  let prevCount: number | null = null;

  for (let i = 0; i < definition.steps.length; i++) {
    const stepDef = definition.steps[i];
    let count: number;

    // Determine count based on step type
    if (stepDef.pathPatterns && stepDef.pathPatterns.length > 0) {
      // For steps with path patterns, count matching page views
      count = countPageViewsForPatterns(pages, stepDef.pathPatterns);

      // If no matching pages found, estimate from sessions
      if (count === 0 && i === 0) {
        count = Math.round(totalSessions * 0.3); // ~30% of sessions reach landing
      }
    } else {
      // For action steps, estimate based on funnel position and conversions
      count = estimateActionStepCount(
        definition.key,
        stepDef.id,
        i,
        definition.steps.length,
        prevCount || totalSessions,
        totalConversions,
        engagementRate
      );
    }

    // Calculate conversion rate from previous step
    let rate: number | null = null;
    if (prevCount !== null && prevCount > 0 && count !== null) {
      rate = count / prevCount;
    }

    // Calculate drop-off rate
    let dropoffRate: number | null = null;
    if (rate !== null) {
      dropoffRate = 1 - rate;
    }

    steps.push({
      id: stepDef.id,
      label: stepDef.label,
      count,
      rate,
      dropoffRate,
      isPrimary: stepDef.isPrimary,
    });

    prevCount = count;
  }

  // Calculate overall conversion
  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];
  const firstCount = firstStep?.count ?? 0;
  const lastCount = lastStep?.count ?? 0;

  let overallConversionRate: number | null = null;
  if (firstCount > 0 && lastCount !== null) {
    overallConversionRate = lastCount / firstCount;
  }

  const hasData = steps.some(s => s.count !== null && s.count > 0);

  return {
    key: definition.key,
    name: definition.name,
    description: definition.description,
    steps,
    overallConversionRate,
    totalSessions: firstCount,
    hasData,
  };
}

/**
 * Estimate count for action steps (CTA clicks, signups, etc.)
 * Based on typical conversion rates for each step type
 */
function estimateActionStepCount(
  funnelKey: string,
  stepId: string,
  stepIndex: number,
  totalSteps: number,
  previousCount: number,
  totalConversions: number,
  engagementRate: number
): number {
  // For the last step (goal), use actual conversions or estimate
  if (stepIndex === totalSteps - 1) {
    if (totalConversions > 0) {
      // Distribute conversions between funnels
      return Math.round(totalConversions * 0.5);
    }
    // Estimate based on typical conversion rate
    return Math.round(previousCount * 0.02);
  }

  // For middle steps, apply progressive drop-off
  const baseDropoff = funnelKey === 'trainer_acquisition'
    ? 0.4  // 40% drop-off per step for acquisition
    : 0.35; // 35% drop-off per step for demand

  // Adjust drop-off based on engagement rate
  const adjustedDropoff = baseDropoff * (1 - engagementRate * 0.3);

  return Math.round(previousCount * (1 - adjustedDropoff));
}

/**
 * Return empty TrainrHub funnels when no data is available
 */
export function getEmptyTrainrhubFunnels(): TrainrhubFunnelMetrics[] {
  return TRAINRHUB_FUNNELS.map(def => ({
    key: def.key,
    name: def.name,
    description: def.description,
    steps: def.steps.map(s => ({
      id: s.id,
      label: s.label,
      count: null,
      rate: null,
      dropoffRate: null,
      isPrimary: s.isPrimary,
    })),
    overallConversionRate: null,
    totalSessions: null,
    hasData: false,
  }));
}
