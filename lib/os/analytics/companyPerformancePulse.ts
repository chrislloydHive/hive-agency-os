// lib/os/analytics/companyPerformancePulse.ts
// Company-specific Performance Pulse using per-company OAuth tokens from CompanyIntegrations
//
// Unlike getPerformancePulse() which uses workspace-level settings, this function
// uses the company's own OAuth tokens stored in CompanyIntegrations.

import { getGa4DataClientForCompany } from '@/lib/os/integrations/companyGa4Client';
import { getGscClientForCompany } from '@/lib/os/integrations/companyGscClient';
import { getCompanyIntegrations } from '@/lib/airtable/companyIntegrations';
import type { PerformancePulse } from './performancePulse';

// ============================================================================
// Types
// ============================================================================

interface DateRange {
  startDate: string;
  endDate: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create date range for the last N days
 */
function createDateRange(days: number): DateRange {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Create previous period date range
 */
function createPreviousPeriodRange(currentRange: DateRange): DateRange {
  const currentStart = new Date(currentRange.startDate);
  const currentEnd = new Date(currentRange.endDate);
  const daysDiff = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));

  const prevEnd = new Date(currentStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff);

  return {
    startDate: prevStart.toISOString().split('T')[0],
    endDate: prevEnd.toISOString().split('T')[0],
  };
}

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
// GA4 Data Fetching (Company-level)
// ============================================================================

interface GA4Summary {
  sessions: number;
  conversions: number;
}

async function fetchCompanyGa4Summary(
  companyId: string,
  dateRange: DateRange
): Promise<GA4Summary | null> {
  const clientResult = await getGa4DataClientForCompany(companyId);
  if (!clientResult) {
    return null;
  }

  const { client, propertyId } = clientResult;

  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'conversions' },
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return { sessions: 0, conversions: 0 };
    }

    const row = response.rows[0];
    return {
      sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
      conversions: parseInt(row.metricValues?.[1]?.value || '0', 10),
    };
  } catch (error) {
    console.error('[CompanyPerformancePulse] GA4 error:', error);
    return null;
  }
}

// ============================================================================
// GSC Data Fetching (Company-level)
// ============================================================================

interface GSCSummary {
  clicks: number;
  impressions: number;
}

async function fetchCompanyGscSummary(
  companyId: string,
  dateRange: DateRange
): Promise<GSCSummary | null> {
  const clientResult = await getGscClientForCompany(companyId);
  if (!clientResult || !clientResult.siteUrl) {
    return null;
  }

  const { client, siteUrl } = clientResult;

  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        dimensions: [],
        rowLimit: 1,
      },
    });

    const rows = response.data.rows || [];
    if (rows.length === 0) {
      return { clicks: 0, impressions: 0 };
    }

    let totalClicks = 0;
    let totalImpressions = 0;
    for (const row of rows) {
      totalClicks += row.clicks || 0;
      totalImpressions += row.impressions || 0;
    }

    return {
      clicks: totalClicks,
      impressions: totalImpressions,
    };
  } catch (error) {
    console.error('[CompanyPerformancePulse] GSC error:', error);
    return null;
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get Performance Pulse for a specific company using their OAuth tokens
 *
 * This function uses the company's own GA4/GSC credentials from CompanyIntegrations,
 * not the workspace-level settings.
 */
export async function getCompanyPerformancePulse(companyId: string): Promise<PerformancePulse> {
  console.log('[CompanyPerformancePulse] Fetching 7-day analytics for company:', companyId);

  // Check if company has integrations configured
  const integrations = await getCompanyIntegrations(companyId);
  const hasGa4 = integrations?.google?.ga4?.connected === true && !!integrations.google?.ga4?.propertyId;
  const hasGsc = integrations?.google?.gsc?.connected === true && !!integrations.google?.gsc?.siteUrl;

  console.log('[CompanyPerformancePulse] Integration status:', { companyId, hasGa4, hasGsc });

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
    console.log('[CompanyPerformancePulse] No integrations configured for company:', companyId);
    return result;
  }

  try {
    // Create date ranges for current and previous 7 days
    const currentRange = createDateRange(7);
    const previousRange = createPreviousPeriodRange(currentRange);

    // Fetch data in parallel
    const [currentGa4, previousGa4, currentGsc, previousGsc] = await Promise.all([
      hasGa4 ? fetchCompanyGa4Summary(companyId, currentRange) : Promise.resolve(null),
      hasGa4 ? fetchCompanyGa4Summary(companyId, previousRange) : Promise.resolve(null),
      hasGsc ? fetchCompanyGscSummary(companyId, currentRange) : Promise.resolve(null),
      hasGsc ? fetchCompanyGscSummary(companyId, previousRange) : Promise.resolve(null),
    ]);

    // Extract GA4 metrics
    if (currentGa4) {
      result.currentSessions = currentGa4.sessions;
      result.currentConversions = currentGa4.conversions;
    }
    if (previousGa4) {
      result.previousSessions = previousGa4.sessions;
      result.previousConversions = previousGa4.conversions;
    }

    // Calculate GA4 changes
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
      result.currentClicks = currentGsc.clicks;
      result.previousClicks = previousGsc.clicks;
      result.seoVisibilityChange7d = calculatePercentChange(
        currentGsc.clicks,
        previousGsc.clicks
      );
    }

    // Detect anomalies
    const anomalyResult = detectAnomalies(
      result.trafficChange7d,
      result.conversionsChange7d,
      result.seoVisibilityChange7d
    );
    result.hasAnomalies = anomalyResult.hasAnomalies;
    result.anomalySummary = anomalyResult.anomalySummary;

    console.log('[CompanyPerformancePulse] Complete:', {
      companyId,
      trafficChange: result.trafficChange7d,
      conversionsChange: result.conversionsChange7d,
      seoChange: result.seoVisibilityChange7d,
      hasAnomalies: result.hasAnomalies,
    });

    return result;
  } catch (error) {
    console.error('[CompanyPerformancePulse] Error fetching analytics:', error);
    return result;
  }
}
