// lib/os/integrations/gscClient.ts
// Google Search Console client using WorkspaceSettings for OAuth tokens

import { google } from 'googleapis';
import { getWorkspaceSettings, type WorkspaceSettings } from '../workspaceSettings';

/**
 * Creates a Google Search Console client using workspace settings
 * Falls back to environment variables if workspace settings not configured
 */
export async function getGscClientFromWorkspace(
  workspaceId?: string
): Promise<{ client: ReturnType<typeof google.searchconsole>; siteUrl: string } | null> {
  // Get workspace settings
  let settings: WorkspaceSettings | null = null;
  try {
    settings = await getWorkspaceSettings(workspaceId);
  } catch (error) {
    console.warn('[GSCClient] Could not fetch workspace settings, falling back to env vars:', error);
  }

  // Check if we have workspace-level GSC configuration
  const hasWorkspaceConfig = settings?.gscRefreshToken && settings?.gscPropertyUri;

  // Get credentials (workspace settings take priority over env vars)
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = hasWorkspaceConfig
    ? settings!.gscRefreshToken!
    : process.env.GOOGLE_REFRESH_TOKEN;
  const siteUrl = hasWorkspaceConfig
    ? settings!.gscPropertyUri!
    : process.env.SEARCH_CONSOLE_SITE_URL;

  // Check for required credentials
  if (!clientId || !clientSecret || !refreshToken || !siteUrl) {
    console.warn('[GSCClient] Missing required credentials', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
      hasSiteUrl: !!siteUrl,
      source: hasWorkspaceConfig ? 'workspace' : 'env',
    });
    return null;
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob'
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  // Create Search Console client
  const client = google.searchconsole({ version: 'v1', auth: oauth2Client });

  return { client, siteUrl };
}

/**
 * Check if GSC is configured (either via workspace or env vars)
 */
export async function isGscConfigured(workspaceId?: string): Promise<boolean> {
  try {
    const settings = await getWorkspaceSettings(workspaceId);
    const hasWorkspaceConfig = settings?.gscRefreshToken && settings?.gscPropertyUri;

    if (hasWorkspaceConfig) {
      return true;
    }

    // Fall back to env vars
    return !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.SEARCH_CONSOLE_SITE_URL
    );
  } catch {
    // Fall back to env vars on error
    return !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.SEARCH_CONSOLE_SITE_URL
    );
  }
}

/**
 * Get GSC connection status
 */
export async function getGscConnectionStatus(workspaceId?: string): Promise<{
  connected: boolean;
  source: 'workspace' | 'env' | 'none';
  siteUrl?: string;
  connectedAt?: string | null;
}> {
  try {
    const settings = await getWorkspaceSettings(workspaceId);
    const hasWorkspaceConfig = settings?.gscRefreshToken && settings?.gscPropertyUri;

    if (hasWorkspaceConfig) {
      return {
        connected: true,
        source: 'workspace',
        siteUrl: settings.gscPropertyUri!,
        connectedAt: settings.gscConnectedAt,
      };
    }

    // Check env vars
    const hasEnvConfig = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.SEARCH_CONSOLE_SITE_URL
    );

    if (hasEnvConfig) {
      return {
        connected: true,
        source: 'env',
        siteUrl: process.env.SEARCH_CONSOLE_SITE_URL,
      };
    }

    return { connected: false, source: 'none' };
  } catch {
    // Check env vars on error
    const hasEnvConfig = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.SEARCH_CONSOLE_SITE_URL
    );

    if (hasEnvConfig) {
      return {
        connected: true,
        source: 'env',
        siteUrl: process.env.SEARCH_CONSOLE_SITE_URL,
      };
    }

    return { connected: false, source: 'none' };
  }
}

/**
 * List available Search Console sites for the authenticated user
 */
export async function listGscSites(workspaceId?: string): Promise<string[]> {
  const clientResult = await getGscClientFromWorkspace(workspaceId);
  if (!clientResult) {
    return [];
  }

  try {
    const { client } = clientResult;
    const response = await client.sites.list();

    return (response.data.siteEntry || [])
      .filter((site: any) => site.permissionLevel !== 'siteUnverifiedUser')
      .map((site: any) => site.siteUrl);
  } catch (error) {
    console.error('[GSCClient] Error listing sites:', error);
    return [];
  }
}
