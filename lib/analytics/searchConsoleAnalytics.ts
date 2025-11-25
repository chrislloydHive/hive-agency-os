// lib/analytics/searchConsoleAnalytics.ts
// Google Search Console API integration for Growth Analytics

import { google } from 'googleapis';
import { SearchQuerySummary, SearchPageSummary } from './models';
import { getGoogleOAuthClient } from './googleAuth';
import { getSiteConfig, getDefaultSite } from './sites';

/**
 * Fetches Search Console data for the specified date range
 * Returns top queries and pages
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param siteId - Optional site ID (defaults to first configured site)
 */
export async function getSearchConsoleSnapshot(
  startDate: string,
  endDate: string,
  siteId?: string
): Promise<{
  queries: SearchQuerySummary[];
  pages: SearchPageSummary[];
}> {
  // Get site config
  const site = siteId ? getSiteConfig(siteId) : getDefaultSite();
  const siteUrl = site?.searchConsoleSiteUrl || process.env.SEARCH_CONSOLE_SITE_URL;

  if (!siteUrl) {
    console.warn('[Search Console] No Search Console URL configured for site', { siteId });
    return { queries: [], pages: [] };
  }

  try {
    const auth = getGoogleOAuthClient();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    console.log('[Search Console] Fetching data for', { startDate, endDate, siteUrl, siteId: site?.id });

    // Fetch queries and pages in parallel, with individual error handling
    const [queriesData, pagesData] = await Promise.all([
      fetchTopQueries(searchconsole, siteUrl, startDate, endDate).catch((err) => {
        console.warn('[Search Console] Query fetch failed:', err?.message || err);
        return [] as SearchQuerySummary[];
      }),
      fetchTopPages(searchconsole, siteUrl, startDate, endDate).catch((err) => {
        console.warn('[Search Console] Pages fetch failed:', err?.message || err);
        return [] as SearchPageSummary[];
      }),
    ]);

    return {
      queries: queriesData,
      pages: pagesData,
    };
  } catch (error: any) {
    // Handle permission errors gracefully
    if (error?.message?.includes('permission') || error?.code === 403) {
      console.warn('[Search Console] Permission denied for site - check Google Search Console access');
      return { queries: [], pages: [] };
    }
    console.error('[Search Console] Error fetching data:', error);

    // Return empty arrays on failure
    return {
      queries: [],
      pages: [],
    };
  }
}

/**
 * Fetch top search queries
 */
async function fetchTopQueries(
  searchconsole: any,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<SearchQuerySummary[]> {
  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 50,
        orderBy: 'clicks',
      },
    });

    if (!response.data.rows || response.data.rows.length === 0) {
      console.log('[Search Console] No query data found');
      return [];
    }

    return response.data.rows.map((row: any) => ({
      query: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0, // Already a decimal (0-1)
      position: row.position || null,
    }));
  } catch (error) {
    console.error('[Search Console] Error fetching queries:', error);
    return [];
  }
}

/**
 * Fetch top pages
 */
async function fetchTopPages(
  searchconsole: any,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<SearchPageSummary[]> {
  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 50,
        orderBy: 'clicks',
      },
    });

    if (!response.data.rows || response.data.rows.length === 0) {
      console.log('[Search Console] No page data found');
      return [];
    }

    return response.data.rows.map((row: any) => ({
      url: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0, // Already a decimal (0-1)
      position: row.position || null,
    }));
  } catch (error) {
    console.error('[Search Console] Error fetching pages:', error);
    return [];
  }
}
