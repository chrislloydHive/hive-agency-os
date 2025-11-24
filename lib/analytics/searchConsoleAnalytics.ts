// lib/analytics/searchConsoleAnalytics.ts
// Google Search Console API integration for Growth Analytics

import { google } from 'googleapis';
import { SearchQuerySummary, SearchPageSummary } from './models';
import { getGoogleOAuthClient, getSearchConsoleSiteUrl } from './googleAuth';

/**
 * Fetches Search Console data for the specified date range
 * Returns top queries and pages
 */
export async function getSearchConsoleSnapshot(
  startDate: string,
  endDate: string
): Promise<{
  queries: SearchQuerySummary[];
  pages: SearchPageSummary[];
}> {
  try {
    const auth = getGoogleOAuthClient();
    const siteUrl = getSearchConsoleSiteUrl();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    console.log('[Search Console] Fetching data for', { startDate, endDate, siteUrl });

    // Fetch queries and pages in parallel
    const [queriesData, pagesData] = await Promise.all([
      fetchTopQueries(searchconsole, siteUrl, startDate, endDate),
      fetchTopPages(searchconsole, siteUrl, startDate, endDate),
    ]);

    return {
      queries: queriesData,
      pages: pagesData,
    };
  } catch (error) {
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
