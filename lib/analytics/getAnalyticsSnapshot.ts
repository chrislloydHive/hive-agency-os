// lib/analytics/getAnalyticsSnapshot.ts
// Main analytics snapshot fetcher for the Analytics Lab
//
// Aggregates data from GA4, Search Console, GBP, and paid media
// into a unified AnalyticsLabSnapshot.

import { getGa4DataClientForCompany } from '@/lib/os/integrations/companyGa4Client';
import { getGscClientForCompany } from '@/lib/os/integrations/companyGscClient';
import { getCompanyIntegrations } from '@/lib/airtable/companyIntegrations';
import { getCompanyMediaProgramSummary } from '@/lib/os/analytics/getCompanyMediaProgramSummary';
import type {
  AnalyticsLabSnapshot,
  AnalyticsSourceGa4,
  AnalyticsSourceSearchConsole,
  AnalyticsSourceGbp,
  AnalyticsSourcePaidMedia,
  AnalyticsDeltas,
  AnalyticsTrendSeries,
} from './analyticsTypes';
import { calculateDataQualityScore } from './analyticsTypes';
import { buildAnalyticsTrends } from './buildAnalyticsTrends';

// ============================================================================
// Types
// ============================================================================

interface DateRange {
  startDate: string;
  endDate: string;
}

interface GetAnalyticsSnapshotOptions {
  companyId: string;
  range?: '7d' | '28d' | '90d';
  includeTrends?: boolean;
}

interface GetAnalyticsSnapshotResult {
  snapshot: AnalyticsLabSnapshot;
  trends: AnalyticsTrendSeries | null;
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
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ============================================================================
// GA4 Data Fetching
// ============================================================================

async function fetchGa4Data(
  companyId: string,
  dateRange: DateRange
): Promise<AnalyticsSourceGa4 | null> {
  const clientResult = await getGa4DataClientForCompany(companyId);
  if (!clientResult) return null;

  const { client, propertyId } = clientResult;

  try {
    // Fetch main metrics
    const [mainResponse] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'conversions' },
        { name: 'newUsers' },
        { name: 'totalUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
    });

    // Fetch channel breakdown
    const [channelResponse] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    });

    // Parse main metrics
    const mainRow = mainResponse.rows?.[0];
    const sessions = parseInt(mainRow?.metricValues?.[0]?.value || '0', 10);
    const conversions = parseInt(mainRow?.metricValues?.[1]?.value || '0', 10);
    const newUsers = parseInt(mainRow?.metricValues?.[2]?.value || '0', 10);
    const totalUsers = parseInt(mainRow?.metricValues?.[3]?.value || '0', 10);
    const bounceRate = parseFloat(mainRow?.metricValues?.[4]?.value || '0');
    const avgSessionDuration = parseFloat(mainRow?.metricValues?.[5]?.value || '0');

    // Parse channel breakdown
    const channelBreakdown: Record<string, number> = {};
    for (const row of channelResponse.rows || []) {
      const channel = row.dimensionValues?.[0]?.value || 'Unknown';
      const channelSessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      channelBreakdown[channel] = channelSessions;
    }

    return {
      totalSessions: sessions,
      newUsers,
      returningUsers: Math.max(0, totalUsers - newUsers),
      conversions,
      conversionRate: sessions > 0 ? Math.round((conversions / sessions) * 10000) / 100 : 0,
      bounceRate: Math.round(bounceRate * 100) / 100,
      avgSessionDuration: Math.round(avgSessionDuration),
      channelBreakdown,
    };
  } catch (error) {
    console.error('[getAnalyticsSnapshot] GA4 error:', error);
    return null;
  }
}

// ============================================================================
// GSC Data Fetching
// ============================================================================

async function fetchGscData(
  companyId: string,
  dateRange: DateRange
): Promise<AnalyticsSourceSearchConsole | null> {
  const clientResult = await getGscClientForCompany(companyId);
  if (!clientResult || !clientResult.siteUrl) return null;

  const { client, siteUrl } = clientResult;

  try {
    // Fetch aggregate metrics
    const aggregateResponse = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        dimensions: [],
      },
    });

    // Fetch top queries
    const queriesResponse = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        dimensions: ['query'],
        rowLimit: 20,
      },
    });

    // Fetch top pages
    const pagesResponse = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        dimensions: ['page'],
        rowLimit: 10,
      },
    });

    // Parse aggregate metrics
    const aggregateData = aggregateResponse.data;
    const aggregateRows = aggregateData?.rows || [];
    let totalClicks = 0;
    let totalImpressions = 0;
    let avgCtr = 0;
    let avgPosition = 0;

    if (aggregateRows.length > 0) {
      const row = aggregateRows[0];
      totalClicks = row.clicks || 0;
      totalImpressions = row.impressions || 0;
      avgCtr = row.ctr || 0;
      avgPosition = row.position || 0;
    }

    // Parse top queries
    const queriesData = queriesResponse.data;
    const topQueries = (queriesData?.rows || []).map((row) => ({
      query: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 10000) / 100,
      position: Math.round((row.position || 0) * 10) / 10,
    }));

    // Parse top pages
    const pagesData = pagesResponse.data;
    const topPages = (pagesData?.rows || []).map((row) => ({
      page: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 10000) / 100,
      position: Math.round((row.position || 0) * 10) / 10,
    }));

    return {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: Math.round(avgCtr * 10000) / 100,
      avgPosition: Math.round(avgPosition * 10) / 10,
      topQueries,
      topPages,
    };
  } catch (error) {
    console.error('[getAnalyticsSnapshot] GSC error:', error);
    return null;
  }
}

// ============================================================================
// GBP Data Fetching (Placeholder - requires GBP API integration)
// ============================================================================

async function fetchGbpData(
  _companyId: string,
  _dateRange: DateRange
): Promise<AnalyticsSourceGbp | null> {
  // GBP API integration not yet implemented
  // Return null for now - can be extended when GBP integration is added
  return null;
}

// ============================================================================
// Paid Media Data Fetching
// ============================================================================

async function fetchPaidMediaData(
  companyId: string,
  _dateRange: DateRange
): Promise<AnalyticsSourcePaidMedia | null> {
  try {
    const mediaSummary = await getCompanyMediaProgramSummary({ companyId });

    if (!mediaSummary || !mediaSummary.hasMediaProgram) {
      return null;
    }

    // Extract metrics from media summary's primaryKpis
    const kpis = mediaSummary.primaryKpis;
    const spend = kpis?.mediaSpend || 0;
    const conversions = (kpis?.installsOrLeads || 0) + (kpis?.calls || 0);
    const cpa = conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0;
    const roas = kpis?.roas || 0;

    return {
      spend,
      conversions,
      cpa,
      roas,
      clicks: undefined, // Not available in current media summary
      impressions: kpis?.impressions,
      ctr: undefined, // Would need to calculate if clicks were available
      channelContribution: {},
    };
  } catch (error) {
    console.error('[getAnalyticsSnapshot] Media data error:', error);
    return null;
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get analytics snapshot for a company
 *
 * Aggregates data from all connected analytics sources into a unified snapshot.
 * Optionally includes 90-day trend data for charting.
 */
export async function getAnalyticsSnapshot(
  options: GetAnalyticsSnapshotOptions
): Promise<GetAnalyticsSnapshotResult> {
  const { companyId, range = '28d', includeTrends = true } = options;

  console.log('[getAnalyticsSnapshot] Fetching analytics for company:', companyId, { range });

  // Check integrations
  const integrations = await getCompanyIntegrations(companyId);
  const hasGa4 = integrations?.google?.ga4?.connected === true && !!integrations.google?.ga4?.propertyId;
  const hasGsc = integrations?.google?.gsc?.connected === true && !!integrations.google?.gsc?.siteUrl;
  const hasGbp = false; // Not yet implemented
  const hasMedia = true; // Always check for media data

  // Create date ranges
  const rangeDays = range === '7d' ? 7 : range === '90d' ? 90 : 28;
  const currentRange = createDateRange(rangeDays);
  const previousRange = createPreviousPeriodRange(currentRange);

  // Fetch data in parallel for current and previous periods
  const [
    currentGa4,
    previousGa4,
    currentGsc,
    previousGsc,
    currentGbp,
    previousGbp,
    currentMedia,
    previousMedia,
  ] = await Promise.all([
    hasGa4 ? fetchGa4Data(companyId, currentRange) : Promise.resolve(null),
    hasGa4 ? fetchGa4Data(companyId, previousRange) : Promise.resolve(null),
    hasGsc ? fetchGscData(companyId, currentRange) : Promise.resolve(null),
    hasGsc ? fetchGscData(companyId, previousRange) : Promise.resolve(null),
    hasGbp ? fetchGbpData(companyId, currentRange) : Promise.resolve(null),
    hasGbp ? fetchGbpData(companyId, previousRange) : Promise.resolve(null),
    fetchPaidMediaData(companyId, currentRange),
    fetchPaidMediaData(companyId, previousRange),
  ]);

  // Calculate deltas
  const delta: AnalyticsDeltas = {
    sessionsMoM: calculatePercentChange(
      currentGa4?.totalSessions ?? null,
      previousGa4?.totalSessions ?? null
    ),
    conversionsMoM: calculatePercentChange(
      currentGa4?.conversions ?? null,
      previousGa4?.conversions ?? null
    ),
    organicClicksMoM: calculatePercentChange(
      currentGsc?.clicks ?? null,
      previousGsc?.clicks ?? null
    ),
    gbpActionsMoM: calculatePercentChange(
      currentGbp
        ? (currentGbp.calls + currentGbp.directionRequests + currentGbp.websiteClicks)
        : null,
      previousGbp
        ? (previousGbp.calls + previousGbp.directionRequests + previousGbp.websiteClicks)
        : null
    ),
    spendMoM: calculatePercentChange(
      currentMedia?.spend ?? null,
      previousMedia?.spend ?? null
    ),
    cpaMoM: calculatePercentChange(
      currentMedia?.cpa ?? null,
      previousMedia?.cpa ?? null
    ),
    roasMoM: calculatePercentChange(
      currentMedia?.roas ?? null,
      previousMedia?.roas ?? null
    ),
  };

  // Build snapshot
  const snapshot: AnalyticsLabSnapshot = {
    companyId,
    date: currentRange.endDate,
    range,
    hasGa4: hasGa4 && currentGa4 !== null,
    hasGsc: hasGsc && currentGsc !== null,
    hasGbp: hasGbp && currentGbp !== null,
    hasMedia: currentMedia !== null,
    sourceGa4: currentGa4 ?? undefined,
    sourceSearchConsole: currentGsc ?? undefined,
    sourceGbp: currentGbp ?? undefined,
    sourcePaidMedia: currentMedia ?? undefined,
    delta,
    updatedAt: new Date().toISOString(),
  };

  // Calculate derived metrics
  snapshot.totalActions = (currentGa4?.conversions ?? 0) +
    (currentGbp ? currentGbp.calls + currentGbp.directionRequests : 0);

  // Determine primary channel source
  if (currentGa4?.channelBreakdown) {
    const channels = Object.entries(currentGa4.channelBreakdown);
    if (channels.length > 0) {
      channels.sort((a, b) => b[1] - a[1]);
      snapshot.primaryChannelSource = channels[0][0];
    }
  }

  // Calculate data quality score
  snapshot.dataQualityScore = calculateDataQualityScore(snapshot);

  // Fetch trends if requested
  let trends: AnalyticsTrendSeries | null = null;
  if (includeTrends) {
    trends = await buildAnalyticsTrends(companyId);
  }

  console.log('[getAnalyticsSnapshot] Complete:', {
    companyId,
    hasGa4: snapshot.hasGa4,
    hasGsc: snapshot.hasGsc,
    hasGbp: snapshot.hasGbp,
    hasMedia: snapshot.hasMedia,
    dataQualityScore: snapshot.dataQualityScore,
  });

  return { snapshot, trends };
}
