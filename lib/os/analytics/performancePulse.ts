// lib/os/analytics/performancePulse.ts
// Performance Pulse - 7-day analytics summary for Overview page
//
// Computes week-over-week changes in traffic, conversions, and SEO visibility.

import { getWorkspaceGa4Summary, createDateRange, createPreviousPeriodRange } from './ga4';
import { getWorkspaceGscSummary } from './gsc';
import { isGa4Configured } from '@/lib/os/integrations/ga4Client';
import { isGscConfigured } from '@/lib/os/integrations/gscClient';

// ============================================================================
// Types
// ============================================================================

export interface PerformancePulse {
  trafficChange7d: number | null;       // Percent change in sessions
  conversionsChange7d: number | null;   // Percent change in conversions
  seoVisibilityChange7d: number | null; // Percent change in GSC clicks
  hasAnomalies: boolean;
  anomalySummary: string | null;
  // Raw values for display
  currentSessions: number | null;
  previousSessions: number | null;
  currentConversions: number | null;
  previousConversions: number | null;
  currentClicks: number | null;
  previousClicks: number | null;
  // Meta
  hasGa4: boolean;
  hasGsc: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percent change between two values
 */
function calculatePercentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Detect anomalies in the data
 */
function detectAnomalies(
  trafficChange: number | null,
  conversionsChange: number | null,
  seoChange: number | null
): { hasAnomalies: boolean; anomalySummary: string | null } {
  const anomalies: string[] = [];

  // Significant traffic drop (> 30%)
  if (trafficChange !== null && trafficChange < -30) {
    anomalies.push(`Traffic dropped ${Math.abs(trafficChange)}%`);
  }

  // Significant conversion drop (> 40%)
  if (conversionsChange !== null && conversionsChange < -40) {
    anomalies.push(`Conversions dropped ${Math.abs(conversionsChange)}%`);
  }

  // Significant SEO visibility drop (> 25%)
  if (seoChange !== null && seoChange < -25) {
    anomalies.push(`SEO visibility dropped ${Math.abs(seoChange)}%`);
  }

  // Large spikes could also be anomalies (potential bot traffic)
  if (trafficChange !== null && trafficChange > 200) {
    anomalies.push(`Unusual traffic spike (+${trafficChange}%)`);
  }

  if (anomalies.length === 0) {
    return { hasAnomalies: false, anomalySummary: null };
  }

  return {
    hasAnomalies: true,
    anomalySummary: anomalies.join('. '),
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get Performance Pulse for a workspace
 *
 * Computes week-over-week changes in key metrics:
 * - Traffic (GA4 sessions)
 * - Conversions (GA4)
 * - SEO visibility (GSC clicks)
 */
export async function getPerformancePulse(workspaceId?: string): Promise<PerformancePulse> {
  console.log('[PerformancePulse] Fetching 7-day analytics...');

  // Check which integrations are configured
  const [hasGa4, hasGsc] = await Promise.all([
    isGa4Configured(workspaceId),
    isGscConfigured(workspaceId),
  ]);

  console.log('[PerformancePulse] Integration status:', { hasGa4, hasGsc });

  // Default result
  const result: PerformancePulse = {
    trafficChange7d: null,
    conversionsChange7d: null,
    seoVisibilityChange7d: null,
    hasAnomalies: false,
    anomalySummary: null,
    currentSessions: null,
    previousSessions: null,
    currentConversions: null,
    previousConversions: null,
    currentClicks: null,
    previousClicks: null,
    hasGa4,
    hasGsc,
  };

  // If no integrations, return early
  if (!hasGa4 && !hasGsc) {
    console.log('[PerformancePulse] No integrations configured');
    return result;
  }

  try {
    // Create date ranges for current and previous 7 days
    const currentRange = createDateRange('7d');
    const previousRange = createPreviousPeriodRange(currentRange);

    // Fetch data in parallel
    const [
      currentGa4,
      previousGa4,
      currentGsc,
      previousGsc,
    ] = await Promise.all([
      hasGa4 ? getWorkspaceGa4Summary(currentRange, workspaceId) : Promise.resolve(null),
      hasGa4 ? getWorkspaceGa4Summary(previousRange, workspaceId) : Promise.resolve(null),
      hasGsc ? getWorkspaceGscSummary(currentRange, workspaceId) : Promise.resolve(null),
      hasGsc ? getWorkspaceGscSummary(previousRange, workspaceId) : Promise.resolve(null),
    ]);

    // Extract GA4 metrics
    // Handle current period
    if (currentGa4?.traffic) {
      result.currentSessions = currentGa4.traffic.sessions;
      result.currentConversions = currentGa4.channels.reduce(
        (sum, c) => sum + (c.conversions ?? 0),
        0
      );
    }

    // Handle previous period
    if (previousGa4?.traffic) {
      result.previousSessions = previousGa4.traffic.sessions;
      result.previousConversions = previousGa4.channels.reduce(
        (sum, c) => sum + (c.conversions ?? 0),
        0
      );
    }

    // Calculate changes only if both periods have data
    if (result.currentSessions !== null && result.previousSessions !== null) {
      result.trafficChange7d = calculatePercentChange(
        result.currentSessions,
        result.previousSessions
      );
    }

    if (result.currentConversions !== null && result.previousConversions !== null) {
      result.conversionsChange7d = calculatePercentChange(
        result.currentConversions,
        result.previousConversions
      );
    }

    // Extract GSC metrics
    if (currentGsc && previousGsc) {
      const currentClicks = currentGsc.queries.reduce((sum, q) => sum + q.clicks, 0);
      const previousClicks = previousGsc.queries.reduce((sum, q) => sum + q.clicks, 0);

      result.currentClicks = currentClicks;
      result.previousClicks = previousClicks;
      result.seoVisibilityChange7d = calculatePercentChange(currentClicks, previousClicks);
    }

    // Detect anomalies
    const anomalyResult = detectAnomalies(
      result.trafficChange7d,
      result.conversionsChange7d,
      result.seoVisibilityChange7d
    );
    result.hasAnomalies = anomalyResult.hasAnomalies;
    result.anomalySummary = anomalyResult.anomalySummary;

    console.log('[PerformancePulse] Complete:', {
      trafficChange: result.trafficChange7d,
      conversionsChange: result.conversionsChange7d,
      seoChange: result.seoVisibilityChange7d,
      hasAnomalies: result.hasAnomalies,
    });

    return result;
  } catch (error) {
    console.error('[PerformancePulse] Error fetching analytics:', error);
    return result;
  }
}

// Re-export utility functions for convenience
export { formatPercentChange, getChangeColorClass, getChangeArrow } from './pulseUtils';
