// lib/os/integrations/companyGscClient.ts
// Per-company Google Search Console client using CompanyIntegrations for OAuth tokens

import { google } from 'googleapis';
import {
  getCompanyIntegrations,
  updateGSCIntegration,
  type GSCIntegration,
} from '@/lib/airtable/companyIntegrations';

/**
 * Creates a GSC client for a specific company
 */
export async function getGscClientForCompany(
  companyId: string
): Promise<{ client: ReturnType<typeof google.searchconsole>; siteUrl?: string } | null> {
  const integrations = await getCompanyIntegrations(companyId);

  if (!integrations?.google?.connected || !integrations.google.refreshToken) {
    console.warn('[CompanyGSCClient] Google not connected for company:', companyId);
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[CompanyGSCClient] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    return null;
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    refresh_token: integrations.google.refreshToken,
  });

  // Create Search Console client
  const client = google.searchconsole({ version: 'v1', auth: oauth2Client });

  return {
    client,
    siteUrl: integrations.google.gsc?.siteUrl,
  };
}

/**
 * List available Search Console sites for a company's connected Google account
 */
export async function listGscSites(companyId: string): Promise<Array<{
  siteUrl: string;
  permissionLevel: string;
}> | null> {
  const clientResult = await getGscClientForCompany(companyId);
  if (!clientResult) return null;

  try {
    const { client } = clientResult;
    const response = await client.sites.list();

    const sites = (response.data.siteEntry || [])
      .filter((site: any) => site.permissionLevel !== 'siteUnverifiedUser')
      .map((site: any) => ({
        siteUrl: site.siteUrl,
        permissionLevel: site.permissionLevel,
      }));

    return sites;
  } catch (error) {
    console.error('[CompanyGSCClient] Error listing sites:', error);
    throw error;
  }
}

/**
 * Get sample metrics from Search Console for a site
 */
export async function getGscSampleMetrics(
  companyId: string,
  siteUrl: string
): Promise<{
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
} | null> {
  const clientResult = await getGscClientForCompany(companyId);
  if (!clientResult) return null;

  try {
    const { client } = clientResult;

    // Get data from the last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: [],
        rowLimit: 1,
      },
    });

    // Get totals from the response
    const rows = response.data.rows || [];
    if (rows.length === 0) {
      // No data, return zeros
      return {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
      };
    }

    // Sum up the metrics
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalCtr = 0;
    let totalPosition = 0;

    for (const row of rows) {
      totalClicks += row.clicks || 0;
      totalImpressions += row.impressions || 0;
      totalCtr = row.ctr || 0;
      totalPosition = row.position || 0;
    }

    return {
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: Math.round(totalCtr * 10000) / 100, // Convert to percentage
      position: Math.round(totalPosition * 10) / 10,
    };
  } catch (error) {
    console.error('[CompanyGSCClient] Error getting sample metrics:', error);
    return null;
  }
}

/**
 * Full GSC sync - fetches data and updates CompanyIntegrations
 */
export async function syncGscData(
  companyId: string,
  siteUrl: string
): Promise<GSCIntegration | null> {
  try {
    console.log(`[CompanyGSCClient] Starting sync for company ${companyId}, site ${siteUrl}`);

    // Get sample metrics
    const sampleMetrics = await getGscSampleMetrics(companyId, siteUrl);

    // Update CompanyIntegrations
    const updated = await updateGSCIntegration(companyId, {
      siteUrl,
      sampleMetrics: sampleMetrics || undefined,
    });

    console.log(`[CompanyGSCClient] Sync complete for company ${companyId}:`, {
      siteUrl,
      clicks: sampleMetrics?.clicks,
      impressions: sampleMetrics?.impressions,
    });

    return updated.google?.gsc || null;
  } catch (error) {
    console.error('[CompanyGSCClient] Error syncing GSC data:', error);
    throw error;
  }
}
