// lib/os/searchConsole/snapshot.ts
// Search Console Snapshot Fetcher
// Fetches comprehensive GSC data for analysis and AI insights

import { google } from 'googleapis';
import { getGscClientFromWorkspace } from './client';
import type {
  SearchConsoleSnapshot,
  SearchConsoleDateRange,
  SearchConsoleSummaryMetrics,
  SearchConsoleTopQuery,
  SearchConsoleTopPage,
  SearchConsoleTopCountry,
  SearchConsoleTopDevice,
} from './types';

// ============================================================================
// Types
// ============================================================================

type SnapshotOptions = {
  siteUrl: string; // exact GSC property URL, e.g. "https://www.example.com/"
  range: SearchConsoleDateRange;
  maxRows?: number; // default 25
  workspaceId?: string;
};

type SearchConsoleClient = ReturnType<typeof google.searchconsole>;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Fetch a comprehensive Search Console snapshot for a given site.
 * Includes summary metrics, top queries, pages, countries, and devices.
 */
export async function fetchSearchConsoleSnapshot(
  options: SnapshotOptions
): Promise<SearchConsoleSnapshot> {
  const { siteUrl, range, maxRows = 25, workspaceId } = options;

  console.log('[SearchConsole Snapshot] Fetching data...', {
    siteUrl,
    range,
    maxRows,
  });

  // Get client from workspace settings or env
  const clientConfig = await getGscClientFromWorkspace(workspaceId);

  if (!clientConfig) {
    throw new Error(
      'Google Search Console not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, and SEARCH_CONSOLE_SITE_URL.'
    );
  }

  const { client } = clientConfig;

  try {
    // Fetch all dimension data in parallel
    const [summaryData, queriesData, pagesData, countriesData, devicesData] =
      await Promise.all([
        fetchSummary(client, siteUrl, range),
        fetchTopQueries(client, siteUrl, range, maxRows),
        fetchTopPages(client, siteUrl, range, maxRows),
        fetchTopCountries(client, siteUrl, range, maxRows),
        fetchTopDevices(client, siteUrl, range),
      ]);

    console.log('[SearchConsole Snapshot] Data fetched successfully', {
      clicks: summaryData.clicks,
      impressions: summaryData.impressions,
      queryCount: queriesData.length,
      pageCount: pagesData.length,
    });

    return {
      siteUrl,
      range,
      generatedAt: new Date().toISOString(),
      summary: summaryData,
      topQueries: queriesData,
      topPages: pagesData,
      topCountries: countriesData,
      topDevices: devicesData,
    };
  } catch (error: any) {
    // Handle common GSC errors
    if (error?.code === 403) {
      throw new Error(
        `Permission denied for Search Console site: ${siteUrl}. Ensure the site is verified and the service account has access.`
      );
    }
    if (error?.code === 404) {
      throw new Error(
        `Search Console site not found: ${siteUrl}. Verify the site URL matches exactly with what's in Search Console.`
      );
    }
    console.error('[SearchConsole Snapshot] Error:', error);
    throw error;
  }
}

/**
 * Fetch snapshot for a specific company's site URL using workspace credentials
 */
export async function fetchCompanySearchConsoleSnapshot(
  companySiteUrl: string,
  range: SearchConsoleDateRange,
  maxRows: number = 25
): Promise<SearchConsoleSnapshot> {
  // Use direct OAuth client with env vars for company-specific sites
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google OAuth credentials not configured. Cannot fetch company Search Console data.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob'
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const client = google.searchconsole({ version: 'v1', auth: oauth2Client });

  console.log('[SearchConsole Snapshot] Fetching company data...', {
    siteUrl: companySiteUrl,
    range,
    maxRows,
  });

  try {
    const [summaryData, queriesData, pagesData, countriesData, devicesData] =
      await Promise.all([
        fetchSummary(client, companySiteUrl, range),
        fetchTopQueries(client, companySiteUrl, range, maxRows),
        fetchTopPages(client, companySiteUrl, range, maxRows),
        fetchTopCountries(client, companySiteUrl, range, maxRows),
        fetchTopDevices(client, companySiteUrl, range),
      ]);

    return {
      siteUrl: companySiteUrl,
      range,
      generatedAt: new Date().toISOString(),
      summary: summaryData,
      topQueries: queriesData,
      topPages: pagesData,
      topCountries: countriesData,
      topDevices: devicesData,
    };
  } catch (error: any) {
    if (error?.code === 403) {
      throw new Error(
        `Permission denied for Search Console site: ${companySiteUrl}. Ensure the site is verified and accessible.`
      );
    }
    if (error?.code === 404) {
      throw new Error(
        `Search Console site not found: ${companySiteUrl}. Verify the site URL matches exactly.`
      );
    }
    throw error;
  }
}

// ============================================================================
// Data Fetching Helpers
// ============================================================================

/**
 * Fetch summary metrics (no dimensions)
 */
async function fetchSummary(
  client: SearchConsoleClient,
  siteUrl: string,
  range: SearchConsoleDateRange
): Promise<SearchConsoleSummaryMetrics> {
  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: [], // No dimensions = aggregated summary
      },
    });

    const row = response.data.rows?.[0];
    if (!row) {
      return { clicks: 0, impressions: 0, ctr: 0, avgPosition: null };
    }

    return {
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0, // Already 0-1 decimal
      avgPosition: row.position || null,
    };
  } catch (error) {
    console.warn('[SearchConsole] Error fetching summary:', error);
    return { clicks: 0, impressions: 0, ctr: 0, avgPosition: null };
  }
}

/**
 * Fetch top queries
 */
async function fetchTopQueries(
  client: SearchConsoleClient,
  siteUrl: string,
  range: SearchConsoleDateRange,
  maxRows: number
): Promise<SearchConsoleTopQuery[]> {
  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ['query'],
        rowLimit: maxRows,
      },
    });

    if (!response.data.rows?.length) {
      return [];
    }

    return response.data.rows.map((row: any) => ({
      query: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      avgPosition: row.position || null,
    }));
  } catch (error) {
    console.warn('[SearchConsole] Error fetching queries:', error);
    return [];
  }
}

/**
 * Fetch top pages
 */
async function fetchTopPages(
  client: SearchConsoleClient,
  siteUrl: string,
  range: SearchConsoleDateRange,
  maxRows: number
): Promise<SearchConsoleTopPage[]> {
  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ['page'],
        rowLimit: maxRows,
      },
    });

    if (!response.data.rows?.length) {
      return [];
    }

    return response.data.rows.map((row: any) => ({
      url: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      avgPosition: row.position || null,
    }));
  } catch (error) {
    console.warn('[SearchConsole] Error fetching pages:', error);
    return [];
  }
}

/**
 * Fetch top countries
 */
async function fetchTopCountries(
  client: SearchConsoleClient,
  siteUrl: string,
  range: SearchConsoleDateRange,
  maxRows: number
): Promise<SearchConsoleTopCountry[]> {
  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ['country'],
        rowLimit: maxRows,
      },
    });

    if (!response.data.rows?.length) {
      return [];
    }

    return response.data.rows.map((row: any) => ({
      country: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      avgPosition: row.position || null,
    }));
  } catch (error) {
    console.warn('[SearchConsole] Error fetching countries:', error);
    return [];
  }
}

/**
 * Fetch device breakdown
 */
async function fetchTopDevices(
  client: SearchConsoleClient,
  siteUrl: string,
  range: SearchConsoleDateRange
): Promise<SearchConsoleTopDevice[]> {
  try {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ['device'],
        rowLimit: 10,
      },
    });

    if (!response.data.rows?.length) {
      return [];
    }

    return response.data.rows.map((row: any) => ({
      device: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      avgPosition: row.position || null,
    }));
  } catch (error) {
    console.warn('[SearchConsole] Error fetching devices:', error);
    return [];
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a date range for the last N days
 */
export function createDateRangeLastNDays(days: number): SearchConsoleDateRange {
  const endDate = new Date();
  // GSC data has a 2-3 day delay, so end date should be 3 days ago
  endDate.setDate(endDate.getDate() - 3);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Resolve date range from optional start/end params
 * Defaults to last 30 days if not provided
 */
export function resolveDateRange(
  start: string | null,
  end: string | null,
  defaultDays: number = 30
): SearchConsoleDateRange {
  if (start && end) {
    return { startDate: start, endDate: end };
  }
  return createDateRangeLastNDays(defaultDays);
}
