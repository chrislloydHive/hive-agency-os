// lib/os/analytics/companyGa4.ts
// Per-company GA4 data fetching using company-specific property IDs

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import type {
  CompanyGa4Summary,
  CompanyAnalyticsRange,
} from '../companies/analyticsTypes';

/**
 * Fetch GA4 summary for a specific company's property
 */
export async function fetchCompanyGa4Summary(
  ga4PropertyId: string,
  range: CompanyAnalyticsRange
): Promise<CompanyGa4Summary | null> {
  // Get OAuth credentials from env
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('[CompanyGA4] Missing Google OAuth credentials');
    return null;
  }

  if (!ga4PropertyId) {
    console.warn('[CompanyGA4] No GA4 property ID provided');
    return null;
  }

  try {
    // Create GA4 client with OAuth credentials
    const client = new BetaAnalyticsDataClient({
      credentials: {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        type: 'authorized_user',
      },
    });

    // Ensure property ID has correct format
    const formattedPropertyId = ga4PropertyId.startsWith('properties/')
      ? ga4PropertyId
      : `properties/${ga4PropertyId}`;

    console.log('[CompanyGA4] Fetching data for property:', formattedPropertyId, range);

    // Fetch basic metrics
    const [response] = await client.runReport({
      property: formattedPropertyId,
      dateRanges: [
        {
          startDate: range.startDate,
          endDate: range.endDate,
        },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' },
      ],
    });

    const row = response.rows?.[0];
    if (!row?.metricValues) {
      console.log('[CompanyGA4] No data returned for property');
      return {
        sessions: 0,
        users: 0,
        conversions: null,
        bounceRate: null,
        avgSessionDuration: null,
      };
    }

    const sessions = parseInt(row.metricValues[0]?.value || '0', 10);
    const users = parseInt(row.metricValues[1]?.value || '0', 10);
    const bounceRate = parseFloat(row.metricValues[2]?.value || '0');
    const avgSessionDuration = parseFloat(row.metricValues[3]?.value || '0');
    const conversions = parseInt(row.metricValues[4]?.value || '0', 10);

    console.log('[CompanyGA4] Data fetched:', { sessions, users, conversions });

    return {
      sessions,
      users,
      conversions: conversions || null,
      bounceRate: bounceRate || null,
      avgSessionDuration: avgSessionDuration || null,
    };
  } catch (error: any) {
    console.error('[CompanyGA4] Error fetching data:', error?.message || error);

    // Check for common error types
    if (error?.code === 403 || error?.message?.includes('permission')) {
      console.warn('[CompanyGA4] Permission denied for property:', ga4PropertyId);
    }
    if (error?.code === 404 || error?.message?.includes('not found')) {
      console.warn('[CompanyGA4] Property not found:', ga4PropertyId);
    }

    return null;
  }
}
