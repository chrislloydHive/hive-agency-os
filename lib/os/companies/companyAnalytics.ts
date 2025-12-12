// lib/os/companies/companyAnalytics.ts
// Company Analytics Snapshot computation helper
//
// This module computes the CompanyAnalyticsSnapshot for the Status View.
// It integrates with existing GA4/GSC helpers where available.

import type {
  CompanyAnalyticsSnapshot,
  AnalyticsRange,
  AnalyticsTrend,
} from '@/lib/types/companyAnalytics';
import { getCompanyPerformancePulse } from '@/lib/os/analytics/companyPerformancePulse';
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';

// ============================================================================
// Types
// ============================================================================

export interface GetCompanyAnalyticsParams {
  companyId: string;
  range?: AnalyticsRange;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine overall trend from metrics
 */
function computeTrend(params: {
  sessionsChangePct?: number | null;
  conversionsChangePct?: number | null;
  organicClicksChangePct?: number | null;
}): AnalyticsTrend {
  const { sessionsChangePct, conversionsChangePct, organicClicksChangePct } = params;

  // Count significant positive and negative changes
  let positiveSignals = 0;
  let negativeSignals = 0;

  if (sessionsChangePct !== null && sessionsChangePct !== undefined) {
    if (sessionsChangePct >= 15) positiveSignals++;
    else if (sessionsChangePct <= -15) negativeSignals++;
  }

  if (conversionsChangePct !== null && conversionsChangePct !== undefined) {
    if (conversionsChangePct >= 15) positiveSignals++;
    else if (conversionsChangePct <= -15) negativeSignals++;
  }

  if (organicClicksChangePct !== null && organicClicksChangePct !== undefined) {
    if (organicClicksChangePct >= 15) positiveSignals++;
    else if (organicClicksChangePct <= -15) negativeSignals++;
  }

  // Determine overall trend
  if (positiveSignals > negativeSignals) return 'up';
  if (negativeSignals > positiveSignals) return 'down';
  return 'flat';
}

/**
 * Generate key alerts from metrics
 */
function generateKeyAlerts(params: {
  sessionsChangePct?: number | null;
  conversionsChangePct?: number | null;
  organicClicksChangePct?: number | null;
  cplChangePct?: number | null;
}): string[] {
  const alerts: string[] = [];
  const { sessionsChangePct, conversionsChangePct, organicClicksChangePct, cplChangePct } = params;

  // Session changes
  if (sessionsChangePct !== null && sessionsChangePct !== undefined) {
    if (sessionsChangePct <= -15) {
      alerts.push(`Sessions down ${Math.abs(sessionsChangePct)}% vs prior period`);
    } else if (sessionsChangePct >= 15) {
      alerts.push(`Sessions up ${sessionsChangePct}% vs prior period`);
    }
  }

  // Conversion changes
  if (conversionsChangePct !== null && conversionsChangePct !== undefined) {
    if (conversionsChangePct <= -15) {
      alerts.push(`Conversions down ${Math.abs(conversionsChangePct)}% vs prior period`);
    } else if (conversionsChangePct >= 15) {
      alerts.push(`Conversions up ${conversionsChangePct}% vs prior period`);
    }
  }

  // Organic click changes
  if (organicClicksChangePct !== null && organicClicksChangePct !== undefined) {
    if (organicClicksChangePct <= -15) {
      alerts.push(`Organic clicks down ${Math.abs(organicClicksChangePct)}% vs prior period`);
    } else if (organicClicksChangePct >= 15) {
      alerts.push(`Organic clicks up ${organicClicksChangePct}% vs prior period`);
    }
  }

  // CPL changes (inverted - decrease is good)
  if (cplChangePct !== null && cplChangePct !== undefined) {
    if (cplChangePct <= -10) {
      alerts.push(`CPL improved ${Math.abs(cplChangePct)}% vs prior period`);
    } else if (cplChangePct >= 10) {
      alerts.push(`CPL increased ${cplChangePct}% vs prior period`);
    }
  }

  return alerts;
}

/**
 * Calculate conversion rate
 */
function calculateConversionRate(
  conversions: number | null | undefined,
  sessions: number | null | undefined
): number | null {
  if (
    conversions === null ||
    conversions === undefined ||
    sessions === null ||
    sessions === undefined ||
    sessions === 0
  ) {
    return null;
  }
  return Math.round((conversions / sessions) * 10000) / 100; // Two decimal places
}

/**
 * Get date range for period
 */
function getDateRange(range: AnalyticsRange): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();

  const daysMap: Record<AnalyticsRange, number> = {
    '7d': 7,
    '28d': 28,
    '90d': 90,
  };

  startDate.setDate(startDate.getDate() - daysMap[range]);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get Company Analytics Snapshot
 *
 * Computes a comprehensive analytics snapshot for a company including:
 * - Sessions and conversions from GA4
 * - Organic clicks from GSC
 * - Percent changes vs prior period
 * - Key alerts and trend direction
 *
 * @param params - companyId and optional range
 * @returns CompanyAnalyticsSnapshot
 */
export async function getCompanyAnalyticsSnapshot(
  params: GetCompanyAnalyticsParams
): Promise<CompanyAnalyticsSnapshot> {
  const { companyId, range = '28d' } = params;

  console.log('[companyAnalytics] Computing analytics for company:', { companyId, range });

  // Initialize with defaults
  const now = new Date().toISOString();
  const { startDate, endDate } = getDateRange(range);

  const snapshot: CompanyAnalyticsSnapshot = {
    companyId,
    range,
    comparedTo: 'prev_period',
    hasAnalytics: false,
    analyticsStatusMessage: 'Analytics not connected for this company.',
    hasGa4: false,
    hasGsc: false,
    hasMedia: false,
    keyAlerts: [],
    startDate,
    endDate,
    updatedAt: now,
  };

  try {
    // Get performance pulse data (uses existing company-level integrations)
    // Note: Current implementation is 7d - we'll use what's available
    const pulse = await getCompanyPerformancePulse(companyId);

    if (pulse) {
      // Set integration status
      snapshot.hasGa4 = pulse.hasGa4;
      snapshot.hasGsc = pulse.hasGsc;
      snapshot.hasAnalytics = pulse.hasGa4 || pulse.hasGsc;

      // Update status message based on what's connected
      if (snapshot.hasAnalytics) {
        const connectedSources: string[] = [];
        if (pulse.hasGa4) connectedSources.push('GA4');
        if (pulse.hasGsc) connectedSources.push('Search Console');
        snapshot.analyticsStatusMessage = undefined; // Clear the "not connected" message
      } else {
        snapshot.analyticsStatusMessage = 'Analytics not connected. Connect GA4 or Search Console to see performance data.';
      }

      // GA4 metrics
      if (pulse.hasGa4) {
        snapshot.sessions = pulse.currentSessions;
        snapshot.sessionsChangePct = pulse.trafficChange7d;
        snapshot.conversions = pulse.currentConversions;
        snapshot.conversionsChangePct = pulse.conversionsChange7d;
        snapshot.conversionRate = calculateConversionRate(
          pulse.currentConversions,
          pulse.currentSessions
        );
      }

      // GSC metrics
      if (pulse.hasGsc) {
        snapshot.organicClicks = pulse.currentClicks;
        snapshot.organicClicksChangePct = pulse.seoVisibilityChange7d;
      }

      // Compute trend
      snapshot.trend = computeTrend({
        sessionsChangePct: snapshot.sessionsChangePct,
        conversionsChangePct: snapshot.conversionsChangePct,
        organicClicksChangePct: snapshot.organicClicksChangePct,
      });

      // Generate alerts
      snapshot.keyAlerts = generateKeyAlerts({
        sessionsChangePct: snapshot.sessionsChangePct,
        conversionsChangePct: snapshot.conversionsChangePct,
        organicClicksChangePct: snapshot.organicClicksChangePct,
        cplChangePct: snapshot.cplChangePct,
      });
    }

    console.log('[companyAnalytics] Analytics computed:', {
      companyId,
      hasGa4: snapshot.hasGa4,
      hasGsc: snapshot.hasGsc,
      sessions: snapshot.sessions,
      conversions: snapshot.conversions,
      trend: snapshot.trend,
      alertCount: snapshot.keyAlerts.length,
    });

    return snapshot;
  } catch (error) {
    console.error('[companyAnalytics] Error computing analytics:', error);
    return snapshot;
  }
}
