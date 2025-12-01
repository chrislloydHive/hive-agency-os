// lib/analytics/service.ts
// Unified Analytics Service for Hive OS
//
// This service orchestrates fetching and combining all analytics data sources
// into a unified CompanyAnalyticsSnapshot.

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type {
  CompanyAnalyticsSnapshot,
  AnalyticsDateRange,
  AnalyticsDateRangePreset,
  Ga4CoreMetrics,
  Ga4TrafficSource,
  Ga4ChannelTraffic,
  Ga4TopPage,
  Ga4DeviceBreakdown,
  Ga4TimeSeriesPoint,
  SearchConsoleMetrics,
  SearchConsoleQuery,
  SearchConsolePage,
  SearchConsoleTimeSeriesPoint,
  FunnelMetrics,
  FunnelTimeSeriesPoint,
  FunnelBySource,
  DmaFunnelMetrics,
  GapIaFunnelMetrics,
  GapFullFunnelMetrics,
  CompanyActivityItem,
  CompanyActivityEventType,
} from './types';

// ============================================================================
// Date Range Helpers
// ============================================================================

/**
 * Convert preset to date range
 */
export function presetToDateRange(preset: AnalyticsDateRangePreset): AnalyticsDateRange {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1); // Yesterday to ensure complete data

  let days: number;
  switch (preset) {
    case '7d':
      days = 7;
      break;
    case '90d':
      days = 90;
      break;
    case '30d':
    default:
      days = 30;
      break;
  }

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    preset,
  };
}

/**
 * Get previous period date range for comparison
 */
export function getPreviousPeriodRange(range: AnalyticsDateRange): AnalyticsDateRange {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff + 1);

  return {
    startDate: formatDate(prevStart),
    endDate: formatDate(prevEnd),
    preset: 'custom',
  };
}

/**
 * Get GSC-adjusted date range (accounts for 2-3 day data delay)
 */
function getGscDateRange(range: AnalyticsDateRange): AnalyticsDateRange {
  const endDate = new Date(range.endDate);
  endDate.setDate(endDate.getDate() - 3);

  const startDate = new Date(range.startDate);
  startDate.setDate(startDate.getDate() - 3);

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    preset: range.preset,
  };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================================================
// GA4 Client Factory
// ============================================================================

function getGa4Client(): BetaAnalyticsDataClient | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('[AnalyticsService] Missing Google OAuth credentials');
    return null;
  }

  return new BetaAnalyticsDataClient({
    credentials: {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      type: 'authorized_user',
    },
  });
}

function formatPropertyId(propertyId: string): string {
  return propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
}

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Build complete analytics snapshot for a company
 */
export async function buildCompanyAnalyticsSnapshot(
  company: CompanyRecord,
  preset: AnalyticsDateRangePreset = '30d'
): Promise<CompanyAnalyticsSnapshot> {
  console.log('[AnalyticsService] Building snapshot for:', company.name, preset);

  const range = presetToDateRange(preset);
  const previousRange = getPreviousPeriodRange(range);

  const ga4Connected = !!company.ga4PropertyId;
  const gscConnected = !!company.searchConsoleSiteUrl;

  // Fetch all data in parallel
  const [
    ga4Data,
    ga4PrevData,
    gscData,
    gscPrevData,
    funnelData,
    funnelPrevData,
  ] = await Promise.all([
    ga4Connected ? fetchGa4Data(company.ga4PropertyId!, range) : Promise.resolve(null),
    ga4Connected ? fetchGa4CoreMetrics(company.ga4PropertyId!, previousRange) : Promise.resolve(null),
    gscConnected ? fetchSearchConsoleData(company.searchConsoleSiteUrl!, getGscDateRange(range)) : Promise.resolve(null),
    gscConnected ? fetchSearchConsoleMetrics(company.searchConsoleSiteUrl!, getGscDateRange(previousRange)) : Promise.resolve(null),
    ga4Connected ? fetchFunnelData(company.ga4PropertyId!, range) : Promise.resolve(null),
    ga4Connected ? fetchFunnelMetrics(company.ga4PropertyId!, previousRange) : Promise.resolve(null),
  ]);

  // Build comparison data
  const comparison = buildComparison(ga4Data?.metrics, ga4PrevData, gscData?.metrics, gscPrevData, funnelData?.metrics, funnelPrevData);

  const snapshot: CompanyAnalyticsSnapshot = {
    companyId: company.id,
    companyName: company.name,
    domain: company.domain,
    range,
    generatedAt: new Date().toISOString(),
    ga4Connected,
    gscConnected,
    ga4PropertyId: company.ga4PropertyId,
    gscSiteUrl: company.searchConsoleSiteUrl,
    ga4: ga4Data,
    searchConsole: gscData,
    funnels: funnelData,
    comparison,
  };

  console.log('[AnalyticsService] Snapshot built:', {
    hasGa4: !!ga4Data,
    hasGsc: !!gscData,
    hasFunnels: !!funnelData,
    hasComparison: !!comparison,
  });

  return snapshot;
}

// ============================================================================
// GA4 Data Fetchers
// ============================================================================

interface Ga4DataResult {
  metrics: Ga4CoreMetrics;
  trafficSources: Ga4TrafficSource[];
  channelTraffic: Ga4ChannelTraffic[];
  topPages: Ga4TopPage[];
  deviceBreakdown: Ga4DeviceBreakdown[];
  timeSeries: Ga4TimeSeriesPoint[];
}

async function fetchGa4Data(
  propertyId: string,
  range: AnalyticsDateRange
): Promise<Ga4DataResult | null> {
  const client = getGa4Client();
  if (!client) return null;

  const formattedPropertyId = formatPropertyId(propertyId);

  try {
    // Fetch all GA4 data in parallel
    const [metrics, trafficSources, topPages, deviceBreakdown, timeSeries] = await Promise.all([
      fetchGa4CoreMetrics(propertyId, range),
      fetchGa4TrafficSources(client, formattedPropertyId, range),
      fetchGa4TopPages(client, formattedPropertyId, range),
      fetchGa4DeviceBreakdown(client, formattedPropertyId, range),
      fetchGa4TimeSeries(client, formattedPropertyId, range),
    ]);

    if (!metrics) return null;

    // Derive channel traffic from traffic sources
    const channelTraffic = deriveChannelTraffic(trafficSources, metrics.sessions);

    return {
      metrics,
      trafficSources,
      channelTraffic,
      topPages,
      deviceBreakdown,
      timeSeries,
    };
  } catch (error) {
    console.error('[AnalyticsService] GA4 fetch error:', error);
    return null;
  }
}

async function fetchGa4CoreMetrics(
  propertyId: string,
  range: AnalyticsDateRange
): Promise<Ga4CoreMetrics | null> {
  const client = getGa4Client();
  if (!client) return null;

  const formattedPropertyId = formatPropertyId(propertyId);

  try {
    const [response] = await client.runReport({
      property: formattedPropertyId,
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'engagementRate' },
        { name: 'conversions' },
      ],
    });

    const row = response.rows?.[0];
    if (!row?.metricValues) {
      return {
        sessions: 0,
        users: 0,
        newUsers: 0,
        pageviews: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
        engagementRate: 0,
        conversions: 0,
        conversionRate: 0,
      };
    }

    const sessions = parseInt(row.metricValues[0]?.value || '0', 10);
    const users = parseInt(row.metricValues[1]?.value || '0', 10);
    const conversions = parseInt(row.metricValues[7]?.value || '0', 10);

    return {
      sessions,
      users,
      newUsers: parseInt(row.metricValues[2]?.value || '0', 10),
      pageviews: parseInt(row.metricValues[3]?.value || '0', 10),
      bounceRate: parseFloat(row.metricValues[4]?.value || '0'),
      avgSessionDuration: parseFloat(row.metricValues[5]?.value || '0'),
      engagementRate: parseFloat(row.metricValues[6]?.value || '0'),
      conversions,
      conversionRate: sessions > 0 ? conversions / sessions : 0,
    };
  } catch (error) {
    console.error('[AnalyticsService] GA4 core metrics error:', error);
    return null;
  }
}

async function fetchGa4TrafficSources(
  client: BetaAnalyticsDataClient,
  propertyId: string,
  range: AnalyticsDateRange
): Promise<Ga4TrafficSource[]> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' },
        { name: 'bounceRate' },
      ],
      limit: 20,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    });

    return (response.rows || []).map((row) => ({
      source: row.dimensionValues?.[0]?.value || '(direct)',
      medium: row.dimensionValues?.[1]?.value || '(none)',
      sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
      users: parseInt(row.metricValues?.[1]?.value || '0', 10),
      conversions: parseInt(row.metricValues?.[2]?.value || '0', 10),
      bounceRate: parseFloat(row.metricValues?.[3]?.value || '0'),
    }));
  } catch (error) {
    console.warn('[AnalyticsService] Traffic sources fetch error:', error);
    return [];
  }
}

/**
 * Derive channel traffic from traffic sources
 * Maps source/medium combinations to marketing channels
 */
function deriveChannelTraffic(
  trafficSources: Ga4TrafficSource[],
  totalSessions: number
): Ga4ChannelTraffic[] {
  type Channel = Ga4ChannelTraffic['channel'];

  const channelMap = new Map<Channel, {
    sessions: number;
    users: number;
    conversions: number;
    bounceRates: number[];
  }>();

  // Initialize all channels
  const channels: Channel[] = ['organic', 'paid', 'social', 'email', 'referral', 'direct', 'other'];
  for (const channel of channels) {
    channelMap.set(channel, { sessions: 0, users: 0, conversions: 0, bounceRates: [] });
  }

  // Classify each traffic source into a channel
  for (const source of trafficSources) {
    const channel = classifyChannel(source.source, source.medium);
    const data = channelMap.get(channel)!;
    data.sessions += source.sessions;
    data.users += source.users;
    data.conversions += source.conversions;
    if (source.sessions > 0) {
      data.bounceRates.push(source.bounceRate);
    }
  }

  // Convert to array and calculate percentages
  return channels
    .map((channel) => {
      const data = channelMap.get(channel)!;
      const avgBounceRate = data.bounceRates.length > 0
        ? data.bounceRates.reduce((a, b) => a + b, 0) / data.bounceRates.length
        : 0;
      return {
        channel,
        sessions: data.sessions,
        users: data.users,
        conversions: data.conversions,
        bounceRate: avgBounceRate,
        percentOfTotal: totalSessions > 0 ? data.sessions / totalSessions : 0,
      };
    })
    .filter((c) => c.sessions > 0) // Only include channels with traffic
    .sort((a, b) => b.sessions - a.sessions); // Sort by sessions descending
}

/**
 * Classify source/medium into a marketing channel
 */
function classifyChannel(source: string, medium: string): Ga4ChannelTraffic['channel'] {
  const sourceLower = source.toLowerCase();
  const mediumLower = medium.toLowerCase();

  // Direct traffic
  if (sourceLower === '(direct)' || mediumLower === '(none)' || mediumLower === '(not set)') {
    return 'direct';
  }

  // Organic search
  if (mediumLower === 'organic' || mediumLower.includes('organic')) {
    return 'organic';
  }

  // Paid traffic (CPC, PPC, paid, etc.)
  if (
    mediumLower === 'cpc' ||
    mediumLower === 'ppc' ||
    mediumLower === 'paid' ||
    mediumLower.includes('paid') ||
    mediumLower.includes('cpm') ||
    mediumLower.includes('banner')
  ) {
    return 'paid';
  }

  // Social media
  const socialSources = ['facebook', 'instagram', 'twitter', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'reddit', 'snapchat'];
  if (
    socialSources.some((s) => sourceLower.includes(s)) ||
    mediumLower === 'social' ||
    mediumLower.includes('social')
  ) {
    return 'social';
  }

  // Email
  if (mediumLower === 'email' || mediumLower.includes('email') || mediumLower.includes('newsletter')) {
    return 'email';
  }

  // Referral
  if (mediumLower === 'referral' || mediumLower.includes('referral')) {
    return 'referral';
  }

  // Default to other
  return 'other';
}

async function fetchGa4TopPages(
  client: BetaAnalyticsDataClient,
  propertyId: string,
  range: AnalyticsDateRange
): Promise<Ga4TopPage[]> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'userEngagementDuration' },
        { name: 'bounceRate' },
        { name: 'entrances' },
        { name: 'exits' },
      ],
      limit: 20,
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    });

    return (response.rows || []).map((row) => {
      const pageviews = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const engagementDuration = parseFloat(row.metricValues?.[2]?.value || '0');

      return {
        path: row.dimensionValues?.[0]?.value || '/',
        pageviews,
        users,
        avgTimeOnPage: users > 0 ? engagementDuration / users : 0,
        bounceRate: parseFloat(row.metricValues?.[3]?.value || '0'),
        entrances: parseInt(row.metricValues?.[4]?.value || '0', 10),
        exits: parseInt(row.metricValues?.[5]?.value || '0', 10),
      };
    });
  } catch (error) {
    console.warn('[AnalyticsService] Top pages fetch error:', error);
    return [];
  }
}

async function fetchGa4DeviceBreakdown(
  client: BetaAnalyticsDataClient,
  propertyId: string,
  range: AnalyticsDateRange
): Promise<Ga4DeviceBreakdown[]> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'bounceRate' },
        { name: 'conversions' },
      ],
    });

    return (response.rows || []).map((row) => {
      const device = (row.dimensionValues?.[0]?.value || 'desktop').toLowerCase() as 'desktop' | 'mobile' | 'tablet';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const conversions = parseInt(row.metricValues?.[3]?.value || '0', 10);

      return {
        device,
        sessions,
        users: parseInt(row.metricValues?.[1]?.value || '0', 10),
        bounceRate: parseFloat(row.metricValues?.[2]?.value || '0'),
        conversionRate: sessions > 0 ? conversions / sessions : 0,
      };
    });
  } catch (error) {
    console.warn('[AnalyticsService] Device breakdown fetch error:', error);
    return [];
  }
}

async function fetchGa4TimeSeries(
  client: BetaAnalyticsDataClient,
  propertyId: string,
  range: AnalyticsDateRange
): Promise<Ga4TimeSeriesPoint[]> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'conversions' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    return (response.rows || []).map((row) => {
      const dateStr = row.dimensionValues?.[0]?.value || '';
      // Convert YYYYMMDD to YYYY-MM-DD
      const formattedDate = dateStr.length === 8
        ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
        : dateStr;

      return {
        date: formattedDate,
        sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
        users: parseInt(row.metricValues?.[1]?.value || '0', 10),
        pageviews: parseInt(row.metricValues?.[2]?.value || '0', 10),
        conversions: parseInt(row.metricValues?.[3]?.value || '0', 10),
      };
    });
  } catch (error) {
    console.warn('[AnalyticsService] Time series fetch error:', error);
    return [];
  }
}

// ============================================================================
// Search Console Data Fetchers
// ============================================================================

interface SearchConsoleDataResult {
  metrics: SearchConsoleMetrics;
  topQueries: SearchConsoleQuery[];
  topPages: SearchConsolePage[];
  countries: { country: string; clicks: number; impressions: number; ctr: number; position: number }[];
  devices: { device: 'DESKTOP' | 'MOBILE' | 'TABLET'; clicks: number; impressions: number; ctr: number; position: number }[];
  timeSeries: SearchConsoleTimeSeriesPoint[];
}

async function fetchSearchConsoleData(
  siteUrl: string,
  range: AnalyticsDateRange
): Promise<SearchConsoleDataResult | null> {
  // Import GSC client dynamically to avoid circular deps
  const { getGscClientFromWorkspace } = await import('@/lib/os/integrations/gscClient');

  console.log('[AnalyticsService] Fetching GSC data for:', siteUrl);

  try {
    const result = await getGscClientFromWorkspace();
    if (!result) {
      console.warn('[AnalyticsService] GSC client not available');
      return null;
    }

    const { client } = result;

    // Fetch all GSC data in parallel
    const [metrics, topQueries, topPages, timeSeries] = await Promise.all([
      fetchSearchConsoleMetrics(siteUrl, range),
      fetchGscTopQueries(client, siteUrl, range),
      fetchGscTopPages(client, siteUrl, range),
      fetchGscTimeSeries(client, siteUrl, range),
    ]);

    if (!metrics) return null;

    return {
      metrics,
      topQueries,
      topPages,
      countries: [], // Can be added later
      devices: [], // Can be added later
      timeSeries,
    };
  } catch (error) {
    console.error('[AnalyticsService] GSC fetch error:', error);
    return null;
  }
}

async function fetchSearchConsoleMetrics(
  siteUrl: string,
  range: AnalyticsDateRange
): Promise<SearchConsoleMetrics | null> {
  const { getGscClientFromWorkspace } = await import('@/lib/os/integrations/gscClient');

  try {
    const result = await getGscClientFromWorkspace();
    if (!result) return null;

    const { client } = result;

    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: [],
      },
    });

    const row = response.data.rows?.[0];
    if (!row) {
      return { clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 };
    }

    return {
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      avgPosition: row.position || 0,
    };
  } catch (error) {
    console.warn('[AnalyticsService] GSC metrics fetch error:', error);
    return null;
  }
}

async function fetchGscTopQueries(
  client: ReturnType<typeof import('googleapis').google.searchconsole>,
  siteUrl: string,
  range: AnalyticsDateRange
): Promise<SearchConsoleQuery[]> {
  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ['query'],
        rowLimit: 20,
      },
    });

    return (response.data.rows || []).map((row) => ({
      query: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  } catch (error) {
    console.warn('[AnalyticsService] GSC queries fetch error:', error);
    return [];
  }
}

async function fetchGscTopPages(
  client: ReturnType<typeof import('googleapis').google.searchconsole>,
  siteUrl: string,
  range: AnalyticsDateRange
): Promise<SearchConsolePage[]> {
  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ['page'],
        rowLimit: 20,
      },
    });

    return (response.data.rows || []).map((row) => ({
      page: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  } catch (error) {
    console.warn('[AnalyticsService] GSC pages fetch error:', error);
    return [];
  }
}

async function fetchGscTimeSeries(
  client: ReturnType<typeof import('googleapis').google.searchconsole>,
  siteUrl: string,
  range: AnalyticsDateRange
): Promise<SearchConsoleTimeSeriesPoint[]> {
  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ['date'],
      },
    });

    return (response.data.rows || [])
      .map((row) => ({
        date: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.warn('[AnalyticsService] GSC time series fetch error:', error);
    return [];
  }
}

// ============================================================================
// Funnel Data Fetchers (DMA & GAP-IA)
// ============================================================================

interface FunnelDataResult {
  metrics: FunnelMetrics;
  timeSeries: FunnelTimeSeriesPoint[];
  bySource: FunnelBySource[];
}

async function fetchFunnelData(
  propertyId: string,
  range: AnalyticsDateRange
): Promise<FunnelDataResult | null> {
  const client = getGa4Client();
  if (!client) return null;

  const formattedPropertyId = formatPropertyId(propertyId);

  try {
    const [metrics, timeSeries, bySource] = await Promise.all([
      fetchFunnelMetrics(propertyId, range),
      fetchFunnelTimeSeries(client, formattedPropertyId, range),
      fetchFunnelBySource(client, formattedPropertyId, range),
    ]);

    if (!metrics) return null;

    return { metrics, timeSeries, bySource };
  } catch (error) {
    console.error('[AnalyticsService] Funnel fetch error:', error);
    return null;
  }
}

async function fetchFunnelMetrics(
  propertyId: string,
  range: AnalyticsDateRange
): Promise<FunnelMetrics | null> {
  const client = getGa4Client();
  if (!client) return null;

  const formattedPropertyId = formatPropertyId(propertyId);

  try {
    // Fetch DMA events
    const [dmaResponse] = await client.runReport({
      property: formattedPropertyId,
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['audit_started', 'dma_audit_complete', 'audit_completed'],
          },
        },
      },
    });

    // Fetch GAP-IA events
    const [gapIaResponse] = await client.runReport({
      property: formattedPropertyId,
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['gap_ia_started', 'gap_ia_complete', 'gap_ia_report_viewed', 'gap_ia_cta_clicked'],
          },
        },
      },
    });

    // Fetch Full GAP events
    const [gapFullResponse] = await client.runReport({
      property: formattedPropertyId,
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: [
              'gap_started',
              'gap_processing_started',
              'gap_complete',
              'gap_error',
              'gap_review_cta_clicked',
            ],
          },
        },
      },
    });

    // Parse DMA metrics
    const dmaMetrics: DmaFunnelMetrics = {
      auditsStarted: 0,
      auditsCompleted: 0,
      completionRate: 0,
    };

    for (const row of dmaResponse.rows || []) {
      const eventName = row.dimensionValues?.[0]?.value || '';
      const count = parseInt(row.metricValues?.[0]?.value || '0', 10);

      if (eventName === 'audit_started') {
        dmaMetrics.auditsStarted = count;
      } else if (eventName === 'dma_audit_complete' || eventName === 'audit_completed') {
        dmaMetrics.auditsCompleted += count;
      }
    }
    dmaMetrics.completionRate = dmaMetrics.auditsStarted > 0
      ? dmaMetrics.auditsCompleted / dmaMetrics.auditsStarted
      : 0;

    // Parse GAP-IA metrics
    const gapIaMetrics: GapIaFunnelMetrics = {
      started: 0,
      completed: 0,
      reportViewed: 0,
      ctaClicked: 0,
      startToCompleteRate: 0,
      viewToCtaRate: 0,
    };

    for (const row of gapIaResponse.rows || []) {
      const eventName = row.dimensionValues?.[0]?.value || '';
      const count = parseInt(row.metricValues?.[0]?.value || '0', 10);

      switch (eventName) {
        case 'gap_ia_started':
          gapIaMetrics.started = count;
          break;
        case 'gap_ia_complete':
          gapIaMetrics.completed = count;
          break;
        case 'gap_ia_report_viewed':
          gapIaMetrics.reportViewed = count;
          break;
        case 'gap_ia_cta_clicked':
          gapIaMetrics.ctaClicked = count;
          break;
      }
    }
    gapIaMetrics.startToCompleteRate = gapIaMetrics.started > 0
      ? gapIaMetrics.completed / gapIaMetrics.started
      : 0;
    gapIaMetrics.viewToCtaRate = gapIaMetrics.reportViewed > 0
      ? gapIaMetrics.ctaClicked / gapIaMetrics.reportViewed
      : 0;

    // Parse Full GAP metrics
    const gapFullMetrics: GapFullFunnelMetrics = {
      gapStarted: 0,
      gapProcessingStarted: 0,
      gapComplete: 0,
      gapError: 0,
      gapReviewCtaClicked: 0,
      startToCompleteRate: 0,
      completeToReviewRate: 0,
    };

    for (const row of gapFullResponse.rows || []) {
      const eventName = row.dimensionValues?.[0]?.value || '';
      const count = parseInt(row.metricValues?.[0]?.value || '0', 10);

      switch (eventName) {
        case 'gap_started':
          gapFullMetrics.gapStarted = count;
          break;
        case 'gap_processing_started':
          gapFullMetrics.gapProcessingStarted = count;
          break;
        case 'gap_complete':
          gapFullMetrics.gapComplete = count;
          break;
        case 'gap_error':
          gapFullMetrics.gapError = count;
          break;
        case 'gap_review_cta_clicked':
          gapFullMetrics.gapReviewCtaClicked = count;
          break;
      }
    }
    gapFullMetrics.startToCompleteRate = gapFullMetrics.gapStarted > 0
      ? gapFullMetrics.gapComplete / gapFullMetrics.gapStarted
      : 0;
    gapFullMetrics.completeToReviewRate = gapFullMetrics.gapComplete > 0
      ? gapFullMetrics.gapReviewCtaClicked / gapFullMetrics.gapComplete
      : 0;

    return { dma: dmaMetrics, gapIa: gapIaMetrics, gapFull: gapFullMetrics };
  } catch (error) {
    console.warn('[AnalyticsService] Funnel metrics fetch error:', error);
    return null;
  }
}

async function fetchFunnelTimeSeries(
  client: BetaAnalyticsDataClient,
  propertyId: string,
  range: AnalyticsDateRange
): Promise<FunnelTimeSeriesPoint[]> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'date' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: [
              // DMA events
              'audit_started',
              'dma_audit_complete',
              'audit_completed',
              // GAP-IA events
              'gap_ia_started',
              'gap_ia_complete',
              'gap_ia_report_viewed',
              'gap_ia_cta_clicked',
              // Full GAP events
              'gap_started',
              'gap_processing_started',
              'gap_complete',
              'gap_review_cta_clicked',
            ],
          },
        },
      },
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    // Group by date
    const dateMap = new Map<string, FunnelTimeSeriesPoint>();

    for (const row of response.rows || []) {
      const dateStr = row.dimensionValues?.[0]?.value || '';
      const eventName = row.dimensionValues?.[1]?.value || '';
      const count = parseInt(row.metricValues?.[0]?.value || '0', 10);

      // Convert YYYYMMDD to YYYY-MM-DD
      const formattedDate = dateStr.length === 8
        ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
        : dateStr;

      if (!dateMap.has(formattedDate)) {
        dateMap.set(formattedDate, {
          date: formattedDate,
          // DMA
          dmaStarted: 0,
          dmaCompleted: 0,
          // GAP-IA
          gapIaStarted: 0,
          gapIaCompleted: 0,
          gapIaReportViewed: 0,
          gapIaCtaClicked: 0,
          // Full GAP
          gapFullStarted: 0,
          gapFullProcessingStarted: 0,
          gapFullComplete: 0,
          gapFullReviewCtaClicked: 0,
        });
      }

      const point = dateMap.get(formattedDate)!;
      switch (eventName) {
        // DMA events
        case 'audit_started':
          point.dmaStarted += count;
          break;
        case 'dma_audit_complete':
        case 'audit_completed':
          point.dmaCompleted += count;
          break;
        // GAP-IA events
        case 'gap_ia_started':
          point.gapIaStarted += count;
          break;
        case 'gap_ia_complete':
          point.gapIaCompleted += count;
          break;
        case 'gap_ia_report_viewed':
          point.gapIaReportViewed += count;
          break;
        case 'gap_ia_cta_clicked':
          point.gapIaCtaClicked += count;
          break;
        // Full GAP events
        case 'gap_started':
          point.gapFullStarted += count;
          break;
        case 'gap_processing_started':
          point.gapFullProcessingStarted += count;
          break;
        case 'gap_complete':
          point.gapFullComplete += count;
          break;
        case 'gap_review_cta_clicked':
          point.gapFullReviewCtaClicked += count;
          break;
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.warn('[AnalyticsService] Funnel time series fetch error:', error);
    return [];
  }
}

async function fetchFunnelBySource(
  client: BetaAnalyticsDataClient,
  propertyId: string,
  range: AnalyticsDateRange
): Promise<FunnelBySource[]> {
  try {
    const [response] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: [
              // DMA events
              'audit_started',
              'dma_audit_complete',
              'audit_completed',
              // GAP-IA events
              'gap_ia_started',
              'gap_ia_complete',
              'gap_ia_cta_clicked',
              // Full GAP events
              'gap_started',
              'gap_complete',
              'gap_review_cta_clicked',
            ],
          },
        },
      },
      limit: 200,
    });

    // Group by source/medium
    const sourceMap = new Map<string, FunnelBySource>();

    for (const row of response.rows || []) {
      const source = row.dimensionValues?.[0]?.value || '(direct)';
      const medium = row.dimensionValues?.[1]?.value || '(none)';
      const eventName = row.dimensionValues?.[2]?.value || '';
      const count = parseInt(row.metricValues?.[0]?.value || '0', 10);

      const key = `${source}|||${medium}`;
      if (!sourceMap.has(key)) {
        sourceMap.set(key, {
          source,
          medium,
          // DMA
          dmaStarted: 0,
          dmaCompleted: 0,
          // GAP-IA
          gapIaStarted: 0,
          gapIaCompleted: 0,
          gapIaCtaClicked: 0,
          // Full GAP
          gapFullStarted: 0,
          gapFullComplete: 0,
          gapFullReviewCtaClicked: 0,
        });
      }

      const entry = sourceMap.get(key)!;
      switch (eventName) {
        // DMA events
        case 'audit_started':
          entry.dmaStarted += count;
          break;
        case 'dma_audit_complete':
        case 'audit_completed':
          entry.dmaCompleted += count;
          break;
        // GAP-IA events
        case 'gap_ia_started':
          entry.gapIaStarted += count;
          break;
        case 'gap_ia_complete':
          entry.gapIaCompleted += count;
          break;
        case 'gap_ia_cta_clicked':
          entry.gapIaCtaClicked += count;
          break;
        // Full GAP events
        case 'gap_started':
          entry.gapFullStarted += count;
          break;
        case 'gap_complete':
          entry.gapFullComplete += count;
          break;
        case 'gap_review_cta_clicked':
          entry.gapFullReviewCtaClicked += count;
          break;
      }
    }

    return Array.from(sourceMap.values())
      .sort((a, b) => (b.dmaStarted + b.gapIaStarted + b.gapFullStarted) - (a.dmaStarted + a.gapIaStarted + a.gapFullStarted))
      .slice(0, 20);
  } catch (error) {
    console.warn('[AnalyticsService] Funnel by source fetch error:', error);
    return [];
  }
}

// ============================================================================
// Comparison Builder
// ============================================================================

function buildComparison(
  currentGa4: Ga4CoreMetrics | null | undefined,
  prevGa4: Ga4CoreMetrics | null | undefined,
  currentGsc: SearchConsoleMetrics | null | undefined,
  prevGsc: SearchConsoleMetrics | null | undefined,
  currentFunnel: FunnelMetrics | null | undefined,
  prevFunnel: FunnelMetrics | null | undefined
): CompanyAnalyticsSnapshot['comparison'] {
  const comparison: CompanyAnalyticsSnapshot['comparison'] = {};

  // GA4 comparison
  if (currentGa4 && prevGa4) {
    comparison.ga4 = {
      sessionsChange: calcPercentChange(prevGa4.sessions, currentGa4.sessions),
      usersChange: calcPercentChange(prevGa4.users, currentGa4.users),
      conversionsChange: calcPercentChange(prevGa4.conversions, currentGa4.conversions),
      bounceRateChange: calcPercentChange(prevGa4.bounceRate, currentGa4.bounceRate),
    };
  }

  // GSC comparison
  if (currentGsc && prevGsc) {
    comparison.searchConsole = {
      clicksChange: calcPercentChange(prevGsc.clicks, currentGsc.clicks),
      impressionsChange: calcPercentChange(prevGsc.impressions, currentGsc.impressions),
      ctrChange: calcPercentChange(prevGsc.ctr, currentGsc.ctr),
      positionChange: calcPercentChange(prevGsc.avgPosition, currentGsc.avgPosition),
    };
  }

  // Funnel comparison
  if (currentFunnel && prevFunnel) {
    comparison.funnels = {
      dmaCompletionRateChange: calcPercentChange(prevFunnel.dma.completionRate, currentFunnel.dma.completionRate),
      gapIaCtaRateChange: calcPercentChange(prevFunnel.gapIa.viewToCtaRate, currentFunnel.gapIa.viewToCtaRate),
    };
  }

  // Return null if no comparisons were made
  if (!comparison.ga4 && !comparison.searchConsole && !comparison.funnels) {
    return null;
  }

  return comparison;
}

function calcPercentChange(prev: number, current: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}
