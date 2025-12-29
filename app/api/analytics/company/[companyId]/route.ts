// app/api/analytics/company/[companyId]/route.ts
// API endpoint for fetching company-specific analytics

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getDefaultDateRange } from '@/lib/analytics/growthAnalytics';
import type { GrowthAnalyticsSnapshot } from '@/lib/analytics/models';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// Type for GA4 report row from the API
interface GA4ReportRow {
  dimensionValues?: Array<{ value?: string | null }> | null;
  metricValues?: Array<{ value?: string | null }> | null;
}

// Type for Search Console analytics row
interface SearchConsoleRow {
  keys: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

// Traffic metrics shape
interface TrafficMetrics {
  users: number | null;
  sessions: number | null;
  pageviews: number | null;
  avgSessionDurationSeconds: number | null;
  bounceRate: number | null;
}

// Channel data shape
interface ChannelData {
  channel: string;
  sessions: number;
  users: number | null;
  conversions: number | null;
}

// Landing page data shape
interface LandingPageData {
  path: string;
  sessions: number;
  users: number | null;
  conversions: number | null;
  avgEngagementTimeSeconds: number | null;
}

// Search query data shape
interface SearchQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

// Search page data shape
interface SearchPageData {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // Get company details
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Use provided dates or default to last 30 days
    let startDate: string;
    let endDate: string;

    if (start && end) {
      startDate = start;
      endDate = end;
    } else {
      const defaultRange = getDefaultDateRange(30);
      startDate = defaultRange.startDate;
      endDate = defaultRange.endDate;
    }

    console.log('[API /analytics/company] Fetching analytics for:', {
      companyId,
      companyName: company.name,
      ga4PropertyId: company.ga4PropertyId,
      searchConsoleSiteUrl: company.searchConsoleSiteUrl,
      startDate,
      endDate,
    });

    // Check if company has analytics configured
    const hasGa4 = !!company.ga4PropertyId;
    const hasSearchConsole = !!company.searchConsoleSiteUrl;

    if (!hasGa4 && !hasSearchConsole) {
      return NextResponse.json({
        snapshot: {
          range: { startDate, endDate },
          generatedAt: new Date().toISOString(),
          traffic: { users: null, sessions: null, pageviews: null, avgSessionDurationSeconds: null, bounceRate: null },
          channels: [],
          topLandingPages: [],
          searchQueries: [],
          searchPages: [],
          notes: ['No analytics configured for this company'],
        },
        company: {
          id: company.id,
          name: company.name,
        },
      });
    }

    // Fetch GA4 data if configured
    let ga4Data: {
      traffic: TrafficMetrics;
      channels: ChannelData[];
      topLandingPages: LandingPageData[];
    } = {
      traffic: { users: null, sessions: null, pageviews: null, avgSessionDurationSeconds: null, bounceRate: null },
      channels: [],
      topLandingPages: [],
    };

    if (hasGa4 && company.ga4PropertyId) {
      try {
        ga4Data = await getGa4AnalyticsSnapshotForProperty(
          company.ga4PropertyId,
          startDate,
          endDate
        );
      } catch (err) {
        console.error('[API /analytics/company] GA4 fetch failed:', err);
      }
    }

    // Fetch Search Console data if configured
    let searchConsoleData: {
      queries: SearchQueryData[];
      pages: SearchPageData[];
    } = {
      queries: [],
      pages: [],
    };

    if (hasSearchConsole && company.searchConsoleSiteUrl) {
      try {
        searchConsoleData = await getSearchConsoleSnapshotForSite(
          company.searchConsoleSiteUrl,
          startDate,
          endDate
        );
      } catch (err) {
        console.error('[API /analytics/company] Search Console fetch failed:', err);
      }
    }

    const snapshot: GrowthAnalyticsSnapshot = {
      range: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      traffic: ga4Data.traffic,
      channels: ga4Data.channels,
      topLandingPages: ga4Data.topLandingPages,
      searchQueries: searchConsoleData.queries,
      searchPages: searchConsoleData.pages,
      notes: [],
    };

    return NextResponse.json({
      snapshot,
      company: {
        id: company.id,
        name: company.name,
      },
    });
  } catch (error) {
    console.error('[API /analytics/company] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper to fetch GA4 data for a specific property
async function getGa4AnalyticsSnapshotForProperty(
  propertyId: string,
  startDate: string,
  endDate: string
) {
  const { BetaAnalyticsDataClient } = await import('@google-analytics/data');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('[GA4] Missing OAuth credentials');
    return {
      traffic: { users: null, sessions: null, pageviews: null, avgSessionDurationSeconds: null, bounceRate: null },
      channels: [],
      topLandingPages: [],
    };
  }

  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      type: 'authorized_user',
    },
  });

  // Ensure property ID has correct format
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  try {
    // Fetch traffic summary
    const [trafficResponse] = await client.runReport({
      property: formattedPropertyId,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    });

    const trafficRow = trafficResponse.rows?.[0];
    const trafficMetrics = trafficRow?.metricValues || [];

    const traffic = {
      users: trafficMetrics[0]?.value ? parseInt(trafficMetrics[0].value) : null,
      sessions: trafficMetrics[1]?.value ? parseInt(trafficMetrics[1].value) : null,
      pageviews: trafficMetrics[2]?.value ? parseInt(trafficMetrics[2].value) : null,
      avgSessionDurationSeconds: trafficMetrics[3]?.value ? parseFloat(trafficMetrics[3].value) : null,
      bounceRate: trafficMetrics[4]?.value ? parseFloat(trafficMetrics[4].value) : null,
    };

    // Fetch channels
    const [channelsResponse] = await client.runReport({
      property: formattedPropertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    });

    const channels: ChannelData[] = (channelsResponse.rows || []).map((row: GA4ReportRow) => ({
      channel: row.dimensionValues?.[0]?.value || 'Unattributed',
      sessions: row.metricValues?.[0]?.value ? parseInt(row.metricValues[0].value) : 0,
      users: row.metricValues?.[1]?.value ? parseInt(row.metricValues[1].value) : null,
      conversions: row.metricValues?.[2]?.value ? parseInt(row.metricValues[2].value) : null,
    }));

    // Fetch landing pages
    const [landingPagesResponse] = await client.runReport({
      property: formattedPropertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20,
    });

    const topLandingPages: LandingPageData[] = (landingPagesResponse.rows || []).map((row: GA4ReportRow) => ({
      path: row.dimensionValues?.[0]?.value || '/',
      sessions: row.metricValues?.[0]?.value ? parseInt(row.metricValues[0].value) : 0,
      users: row.metricValues?.[1]?.value ? parseInt(row.metricValues[1].value) : null,
      conversions: row.metricValues?.[2]?.value ? parseInt(row.metricValues[2].value) : null,
      avgEngagementTimeSeconds: null,
    }));

    return { traffic, channels, topLandingPages };
  } catch (err) {
    console.error('[GA4] Error fetching property data:', err);
    return {
      traffic: { users: null, sessions: null, pageviews: null, avgSessionDurationSeconds: null, bounceRate: null },
      channels: [],
      topLandingPages: [],
    };
  }
}

// Helper to fetch Search Console data for a specific site
async function getSearchConsoleSnapshotForSite(
  siteUrl: string,
  startDate: string,
  endDate: string
) {
  const { google } = await import('googleapis');
  const { getGoogleOAuthClient } = await import('@/lib/analytics/googleAuth');

  try {
    const auth = getGoogleOAuthClient();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // Fetch queries
    const queriesResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 50,
      },
    });

    const queries: SearchQueryData[] = ((queriesResponse.data.rows || []) as SearchConsoleRow[]).map((row) => ({
      query: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || null,
    }));

    // Fetch pages
    const pagesResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 50,
      },
    });

    const pages: SearchPageData[] = ((pagesResponse.data.rows || []) as SearchConsoleRow[]).map((row) => ({
      url: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || null,
    }));

    return { queries, pages };
  } catch (err: unknown) {
    const errorObj = err as { message?: string; code?: number };
    if (errorObj?.message?.includes('permission') || errorObj?.code === 403) {
      console.warn('[Search Console] Permission denied for site:', siteUrl);
    } else {
      console.error('[Search Console] Error fetching site data:', err);
    }
    return { queries: [], pages: [] };
  }
}
