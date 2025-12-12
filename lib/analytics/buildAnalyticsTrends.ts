// lib/analytics/buildAnalyticsTrends.ts
// Build 90-day trend series for Analytics Lab charts
//
// Fetches daily data from GA4 and GSC to create time series
// for visualization in the Analytics Lab.

import { getGa4DataClientForCompany } from '@/lib/os/integrations/companyGa4Client';
import { getGscClientForCompany } from '@/lib/os/integrations/companyGscClient';
import { getCompanyIntegrations } from '@/lib/airtable/companyIntegrations';
import type {
  AnalyticsTrendSeries,
  AnalyticsTimeSeriesPoint,
} from './analyticsTypes';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate array of dates for the last N days
 */
function generateDateRange(days: number): string[] {
  const dates: string[] = [];
  const endDate = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

/**
 * Create empty trend series with dates
 */
function createEmptyTrendSeries(dates: string[]): AnalyticsTrendSeries {
  const createEmptySeries = (): AnalyticsTimeSeriesPoint[] =>
    dates.map((date) => ({ date, value: null }));

  return {
    sessions: createEmptySeries(),
    conversions: createEmptySeries(),
    organicClicks: createEmptySeries(),
    organicImpressions: createEmptySeries(),
    gbpActions: createEmptySeries(),
    mediaSpend: createEmptySeries(),
    cpa: createEmptySeries(),
    roas: createEmptySeries(),
  };
}

// ============================================================================
// GA4 Daily Data Fetching
// ============================================================================

interface GA4DailyData {
  date: string;
  sessions: number;
  conversions: number;
}

async function fetchGa4DailyData(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<GA4DailyData[]> {
  const clientResult = await getGa4DataClientForCompany(companyId);
  if (!clientResult) return [];

  const { client, propertyId } = clientResult;

  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'conversions' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    });

    return (response.rows || []).map((row) => ({
      date: formatGa4Date(row.dimensionValues?.[0]?.value || ''),
      sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
      conversions: parseInt(row.metricValues?.[1]?.value || '0', 10),
    }));
  } catch (error) {
    console.error('[buildAnalyticsTrends] GA4 daily data error:', error);
    return [];
  }
}

/**
 * Convert GA4 date format (YYYYMMDD) to ISO format (YYYY-MM-DD)
 */
function formatGa4Date(ga4Date: string): string {
  if (ga4Date.length !== 8) return ga4Date;
  return `${ga4Date.slice(0, 4)}-${ga4Date.slice(4, 6)}-${ga4Date.slice(6, 8)}`;
}

// ============================================================================
// GSC Daily Data Fetching
// ============================================================================

interface GSCDailyData {
  date: string;
  clicks: number;
  impressions: number;
}

async function fetchGscDailyData(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<GSCDailyData[]> {
  const clientResult = await getGscClientForCompany(companyId);
  if (!clientResult || !clientResult.siteUrl) return [];

  const { client, siteUrl } = clientResult;

  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        rowLimit: 100,
      },
    });

    return (response.data.rows || []).map((row) => ({
      date: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
    }));
  } catch (error) {
    console.error('[buildAnalyticsTrends] GSC daily data error:', error);
    return [];
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build 90-day trend series for a company
 *
 * Fetches daily data from all connected analytics sources
 * and assembles them into time series for charting.
 */
export async function buildAnalyticsTrends(
  companyId: string
): Promise<AnalyticsTrendSeries> {
  console.log('[buildAnalyticsTrends] Building trends for company:', companyId);

  // Generate date range (90 days)
  const dates = generateDateRange(90);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  // Create base trend series
  const trends = createEmptyTrendSeries(dates);

  // Check integrations
  const integrations = await getCompanyIntegrations(companyId);
  const hasGa4 = integrations?.google?.ga4?.connected === true && !!integrations.google?.ga4?.propertyId;
  const hasGsc = integrations?.google?.gsc?.connected === true && !!integrations.google?.gsc?.siteUrl;

  // Fetch data in parallel
  const [ga4Data, gscData] = await Promise.all([
    hasGa4 ? fetchGa4DailyData(companyId, startDate, endDate) : Promise.resolve([]),
    hasGsc ? fetchGscDailyData(companyId, startDate, endDate) : Promise.resolve([]),
  ]);

  // Create lookup maps for faster processing
  const ga4Map = new Map(ga4Data.map((d) => [d.date, d]));
  const gscMap = new Map(gscData.map((d) => [d.date, d]));

  // Fill in trend series with actual data
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];

    // GA4 metrics
    const ga4 = ga4Map.get(date);
    if (ga4) {
      trends.sessions[i].value = ga4.sessions;
      trends.conversions[i].value = ga4.conversions;
    }

    // GSC metrics
    const gsc = gscMap.get(date);
    if (gsc) {
      trends.organicClicks[i].value = gsc.clicks;
      trends.organicImpressions[i].value = gsc.impressions;
    }

    // GBP and Media trends would be filled from their respective sources
    // Currently left as null since those integrations aren't fully implemented
  }

  console.log('[buildAnalyticsTrends] Complete:', {
    companyId,
    ga4DataPoints: ga4Data.length,
    gscDataPoints: gscData.length,
  });

  return trends;
}

/**
 * Calculate moving average for a time series
 * Useful for smoothing out daily fluctuations
 */
export function calculateMovingAverage(
  series: AnalyticsTimeSeriesPoint[],
  windowSize: number = 7
): AnalyticsTimeSeriesPoint[] {
  return series.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = series.slice(start, index + 1);
    const validValues = window
      .map((p) => p.value)
      .filter((v): v is number => v !== null);

    if (validValues.length === 0) {
      return { date: point.date, value: null };
    }

    const avg = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    return { date: point.date, value: Math.round(avg) };
  });
}

/**
 * Calculate period totals from daily series
 */
export function calculatePeriodTotal(
  series: AnalyticsTimeSeriesPoint[],
  periodDays: number
): number | null {
  const recentPoints = series.slice(-periodDays);
  const validValues = recentPoints
    .map((p) => p.value)
    .filter((v): v is number => v !== null);

  if (validValues.length === 0) return null;
  return validValues.reduce((sum, v) => sum + v, 0);
}

/**
 * Calculate trend direction from time series
 */
export function calculateTrendDirection(
  series: AnalyticsTimeSeriesPoint[]
): 'up' | 'down' | 'flat' {
  const recentHalf = series.slice(-Math.floor(series.length / 2));
  const olderHalf = series.slice(0, Math.floor(series.length / 2));

  const recentValid = recentHalf.filter((p) => p.value !== null);
  const olderValid = olderHalf.filter((p) => p.value !== null);

  if (recentValid.length === 0 || olderValid.length === 0) return 'flat';

  const recentAvg = recentValid.reduce((sum, p) => sum + (p.value ?? 0), 0) / recentValid.length;
  const olderAvg = olderValid.reduce((sum, p) => sum + (p.value ?? 0), 0) / olderValid.length;

  if (olderAvg === 0) return recentAvg > 0 ? 'up' : 'flat';

  const changePct = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (changePct > 10) return 'up';
  if (changePct < -10) return 'down';
  return 'flat';
}
