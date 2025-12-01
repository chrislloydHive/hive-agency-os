// lib/os/integrations/ga4Client.ts
// GA4 client using WorkspaceSettings for OAuth tokens

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { getWorkspaceSettings, type WorkspaceSettings } from '../workspaceSettings';

/**
 * Creates a GA4 Analytics Data API client using workspace settings
 * Falls back to environment variables if workspace settings not configured
 */
export async function getGa4ClientFromWorkspace(
  workspaceId?: string
): Promise<{ client: BetaAnalyticsDataClient; propertyId: string } | null> {
  // Get workspace settings
  let settings: WorkspaceSettings | null = null;
  try {
    settings = await getWorkspaceSettings(workspaceId);
  } catch (error) {
    console.warn('[GA4Client] Could not fetch workspace settings, falling back to env vars:', error);
  }

  // Check if we have workspace-level GA4 configuration
  const hasWorkspaceConfig = settings?.ga4RefreshToken && settings?.ga4PropertyId;

  // Get credentials (workspace settings take priority over env vars)
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = hasWorkspaceConfig
    ? settings!.ga4RefreshToken!
    : process.env.GOOGLE_REFRESH_TOKEN;
  const propertyId = hasWorkspaceConfig
    ? settings!.ga4PropertyId!
    : process.env.GA4_PROPERTY_ID;

  // Check for required credentials
  if (!clientId || !clientSecret || !refreshToken || !propertyId) {
    console.warn('[GA4Client] Missing required credentials', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
      hasPropertyId: !!propertyId,
      source: hasWorkspaceConfig ? 'workspace' : 'env',
    });
    return null;
  }

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
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  return { client, propertyId: formattedPropertyId };
}

/**
 * Check if GA4 is configured (either via workspace or env vars)
 */
export async function isGa4Configured(workspaceId?: string): Promise<boolean> {
  try {
    const settings = await getWorkspaceSettings(workspaceId);
    const hasWorkspaceConfig = settings?.ga4RefreshToken && settings?.ga4PropertyId;

    if (hasWorkspaceConfig) {
      return true;
    }

    // Fall back to env vars
    return !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GA4_PROPERTY_ID
    );
  } catch {
    // Fall back to env vars on error
    return !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GA4_PROPERTY_ID
    );
  }
}

/**
 * Get GA4 connection status
 */
export async function getGa4ConnectionStatus(workspaceId?: string): Promise<{
  connected: boolean;
  source: 'workspace' | 'env' | 'none';
  propertyId?: string;
  connectedAt?: string | null;
}> {
  try {
    const settings = await getWorkspaceSettings(workspaceId);
    const hasWorkspaceConfig = settings?.ga4RefreshToken && settings?.ga4PropertyId;

    if (hasWorkspaceConfig) {
      return {
        connected: true,
        source: 'workspace',
        propertyId: settings.ga4PropertyId!,
        connectedAt: settings.ga4ConnectedAt,
      };
    }

    // Check env vars
    const hasEnvConfig = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GA4_PROPERTY_ID
    );

    if (hasEnvConfig) {
      return {
        connected: true,
        source: 'env',
        propertyId: process.env.GA4_PROPERTY_ID,
      };
    }

    return { connected: false, source: 'none' };
  } catch {
    // Check env vars on error
    const hasEnvConfig = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GA4_PROPERTY_ID
    );

    if (hasEnvConfig) {
      return {
        connected: true,
        source: 'env',
        propertyId: process.env.GA4_PROPERTY_ID,
      };
    }

    return { connected: false, source: 'none' };
  }
}
