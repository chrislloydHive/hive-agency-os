// lib/os/integrations/companyGa4Client.ts
// Per-company GA4 client using CompanyIntegrations for OAuth tokens

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { AnalyticsAdminServiceClient } from '@google-analytics/admin';
import { google } from 'googleapis';
import {
  getCompanyIntegrations,
  updateGA4Integration,
  type GA4Integration,
} from '@/lib/airtable/companyIntegrations';

/**
 * Creates OAuth2 client from company integrations
 */
async function getOAuth2ClientForCompany(companyId: string) {
  const integrations = await getCompanyIntegrations(companyId);

  if (!integrations?.google?.connected || !integrations.google.refreshToken) {
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[CompanyGA4Client] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    refresh_token: integrations.google.refreshToken,
  });

  return { oauth2Client, integrations };
}

/**
 * Creates a GA4 Analytics Data API client for a specific company
 */
export async function getGa4DataClientForCompany(
  companyId: string
): Promise<{ client: BetaAnalyticsDataClient; propertyId: string } | null> {
  const result = await getOAuth2ClientForCompany(companyId);
  if (!result) return null;

  const { integrations } = result;
  const propertyId = integrations.google?.ga4?.propertyId;

  if (!propertyId) {
    console.warn('[CompanyGA4Client] No GA4 property configured for company:', companyId);
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const refreshToken = integrations.google!.refreshToken!;

  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      type: 'authorized_user',
    },
  });

  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  return { client, propertyId: formattedPropertyId };
}

/**
 * Creates a GA4 Analytics Admin API client for a specific company
 */
export async function getGa4AdminClientForCompany(
  companyId: string
): Promise<AnalyticsAdminServiceClient | null> {
  const result = await getOAuth2ClientForCompany(companyId);
  if (!result) return null;

  const { integrations } = result;

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const refreshToken = integrations.google!.refreshToken!;

  const client = new AnalyticsAdminServiceClient({
    credentials: {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      type: 'authorized_user',
    },
  });

  return client;
}

/**
 * List all GA4 accounts and properties accessible to the connected Google account
 */
export async function listGa4Properties(companyId: string): Promise<{
  accounts: Array<{
    name: string;
    displayName: string;
    properties: Array<{
      name: string;
      displayName: string;
      createTime?: string;
      updateTime?: string;
    }>;
  }>;
} | null> {
  const adminClient = await getGa4AdminClientForCompany(companyId);
  if (!adminClient) return null;

  try {
    // List all accounts
    const [accounts] = await adminClient.listAccounts();

    const result: {
      accounts: Array<{
        name: string;
        displayName: string;
        properties: Array<{
          name: string;
          displayName: string;
          createTime?: string;
          updateTime?: string;
        }>;
      }>;
    } = { accounts: [] };

    for (const account of accounts) {
      if (!account.name) continue;

      // List properties for this account
      const [properties] = await adminClient.listProperties({
        filter: `parent:${account.name}`,
      });

      result.accounts.push({
        name: account.name,
        displayName: account.displayName || account.name,
        properties: properties.map((prop) => ({
          name: prop.name || '',
          displayName: prop.displayName || prop.name || '',
          createTime: prop.createTime?.seconds?.toString(),
          updateTime: prop.updateTime?.seconds?.toString(),
        })),
      });
    }

    return result;
  } catch (error) {
    console.error('[CompanyGA4Client] Error listing properties:', error);
    throw error;
  }
}

/**
 * List data streams for a GA4 property
 */
export async function listGa4DataStreams(
  companyId: string,
  propertyId: string
): Promise<Array<{
  name: string;
  type: string;
  displayName: string;
  webStreamData?: {
    measurementId: string;
    defaultUri: string;
  };
}> | null> {
  const adminClient = await getGa4AdminClientForCompany(companyId);
  if (!adminClient) return null;

  try {
    const formattedPropertyId = propertyId.startsWith('properties/')
      ? propertyId
      : `properties/${propertyId}`;

    const [streams] = await adminClient.listDataStreams({
      parent: formattedPropertyId,
    });

    return streams.map((stream) => ({
      name: stream.name || '',
      type: String(stream.type || 'UNKNOWN'),
      displayName: stream.displayName || '',
      webStreamData: stream.webStreamData
        ? {
            measurementId: stream.webStreamData.measurementId || '',
            defaultUri: stream.webStreamData.defaultUri || '',
          }
        : undefined,
    }));
  } catch (error) {
    console.error('[CompanyGA4Client] Error listing data streams:', error);
    throw error;
  }
}

/**
 * List conversion events for a GA4 property
 */
export async function listGa4ConversionEvents(
  companyId: string,
  propertyId: string
): Promise<Array<{
  name: string;
  eventName: string;
  createTime?: string;
  deletable: boolean;
  custom: boolean;
}> | null> {
  const adminClient = await getGa4AdminClientForCompany(companyId);
  if (!adminClient) return null;

  try {
    const formattedPropertyId = propertyId.startsWith('properties/')
      ? propertyId
      : `properties/${propertyId}`;

    const [conversionEvents] = await adminClient.listConversionEvents({
      parent: formattedPropertyId,
    });

    return conversionEvents.map((event) => ({
      name: event.name || '',
      eventName: event.eventName || '',
      createTime: event.createTime?.seconds?.toString(),
      deletable: event.deletable ?? true,
      custom: event.custom ?? false,
    }));
  } catch (error) {
    console.error('[CompanyGA4Client] Error listing conversion events:', error);
    throw error;
  }
}

/**
 * Get attribution settings for a GA4 property
 */
export async function getGa4AttributionSettings(
  companyId: string,
  propertyId: string
): Promise<{
  acquisitionConversionEventLookbackWindow?: string;
  otherConversionEventLookbackWindow?: string;
  reportingAttributionModel?: string;
} | null> {
  const adminClient = await getGa4AdminClientForCompany(companyId);
  if (!adminClient) return null;

  try {
    const formattedPropertyId = propertyId.startsWith('properties/')
      ? propertyId
      : `properties/${propertyId}`;

    const [settings] = await adminClient.getAttributionSettings({
      name: `${formattedPropertyId}/attributionSettings`,
    });

    return {
      acquisitionConversionEventLookbackWindow:
        settings.acquisitionConversionEventLookbackWindow?.toString() || undefined,
      otherConversionEventLookbackWindow:
        settings.otherConversionEventLookbackWindow?.toString() || undefined,
      reportingAttributionModel:
        settings.reportingAttributionModel?.toString() || undefined,
    };
  } catch (error) {
    console.error('[CompanyGA4Client] Error getting attribution settings:', error);
    // Attribution settings may not be available for all properties
    return null;
  }
}

/**
 * Discover all events tracked by the property (from reporting metadata)
 */
export async function discoverGa4Events(
  companyId: string,
  propertyId: string
): Promise<string[] | null> {
  const dataClient = await getGa4DataClientForCompany(companyId);
  if (!dataClient) return null;

  try {
    const formattedPropertyId = propertyId.startsWith('properties/')
      ? propertyId
      : `properties/${propertyId}`;

    // Run a report to get unique event names from the last 30 days
    const [response] = await dataClient.client.runReport({
      property: formattedPropertyId,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      limit: 500,
    });

    const events: string[] = [];
    if (response.rows) {
      for (const row of response.rows) {
        const eventName = row.dimensionValues?.[0]?.value;
        if (eventName) {
          events.push(eventName);
        }
      }
    }

    return events.sort();
  } catch (error) {
    console.error('[CompanyGA4Client] Error discovering events:', error);
    return null;
  }
}

/**
 * Full GA4 sync - fetches all data and updates CompanyIntegrations
 */
export async function syncGa4Data(
  companyId: string,
  propertyId: string
): Promise<GA4Integration | null> {
  try {
    const formattedPropertyId = propertyId.startsWith('properties/')
      ? propertyId
      : `properties/${propertyId}`;

    console.log(`[CompanyGA4Client] Starting sync for company ${companyId}, property ${formattedPropertyId}`);

    // Fetch all data in parallel
    const [streams, conversionEvents, attributionSettings, allEvents] = await Promise.all([
      listGa4DataStreams(companyId, formattedPropertyId),
      listGa4ConversionEvents(companyId, formattedPropertyId),
      getGa4AttributionSettings(companyId, formattedPropertyId),
      discoverGa4Events(companyId, formattedPropertyId),
    ]);

    // Find web stream for measurement ID
    const webStream = streams?.find((s) => s.webStreamData?.measurementId);
    const measurementId = webStream?.webStreamData?.measurementId;
    const webStreamId = webStream?.name;

    // Extract conversion event names
    const conversionEventNames = conversionEvents?.map((e) => e.eventName) || [];

    // Update CompanyIntegrations
    const updated = await updateGA4Integration(companyId, {
      propertyId: formattedPropertyId,
      webStreamId,
      measurementId,
      conversionEvents: conversionEventNames,
      allEvents: allEvents || [],
      attributionSettings: attributionSettings || undefined,
    });

    console.log(`[CompanyGA4Client] Sync complete for company ${companyId}:`, {
      propertyId: formattedPropertyId,
      measurementId,
      conversionEventsCount: conversionEventNames.length,
      allEventsCount: allEvents?.length || 0,
    });

    return updated.google?.ga4 || null;
  } catch (error) {
    console.error('[CompanyGA4Client] Error syncing GA4 data:', error);
    throw error;
  }
}
