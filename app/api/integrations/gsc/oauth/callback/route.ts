// app/api/integrations/gsc/oauth/callback/route.ts
// Google Search Console OAuth callback handler

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { updateWorkspaceSettings } from '@/lib/os/workspaceSettings';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[GSC OAuth Callback] Authorization error:', error);
      return NextResponse.redirect(
        new URL(`/settings?gsc_error=${encodeURIComponent(error)}`, request.nextUrl.origin)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?gsc_error=no_code', request.nextUrl.origin)
      );
    }

    // Parse state
    let workspaceId = 'hive-os';
    if (state) {
      try {
        const stateData = JSON.parse(state);
        workspaceId = stateData.workspaceId || 'hive-os';
      } catch {
        console.warn('[GSC OAuth Callback] Could not parse state');
      }
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/settings?gsc_error=missing_credentials', request.nextUrl.origin)
      );
    }

    // Get the callback URL from the request origin
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/integrations/gsc/oauth/callback`;

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('[GSC OAuth Callback] No refresh token received');
      return NextResponse.redirect(
        new URL('/settings?gsc_error=no_refresh_token', request.nextUrl.origin)
      );
    }

    // Set credentials to fetch available sites
    oauth2Client.setCredentials(tokens);

    // Get available Search Console sites to let user pick
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });
    let sites: string[] = [];

    try {
      const sitesResponse = await searchconsole.sites.list();
      sites = (sitesResponse.data.siteEntry || [])
        .filter((site) => site.permissionLevel !== 'siteUnverifiedUser')
        .map((site) => site.siteUrl || '');
    } catch (sitesError) {
      console.error('[GSC OAuth Callback] Error fetching sites:', sitesError);
    }

    // Store the refresh token in workspace settings
    // For now, store first site if available, otherwise user needs to select
    const selectedSite = sites.length > 0 ? sites[0] : null;

    await updateWorkspaceSettings({
      gscRefreshToken: tokens.refresh_token,
      gscPropertyUri: selectedSite,
      gscConnectedAt: new Date().toISOString(),
      gscScopes: tokens.scope ? tokens.scope.split(' ') : [],
    }, workspaceId);

    console.log('[GSC OAuth Callback] Successfully connected GSC', {
      workspaceId,
      sitesCount: sites.length,
      selectedSite,
    });

    // Redirect back to settings with success
    const successUrl = new URL('/settings', origin);
    successUrl.searchParams.set('gsc_connected', 'true');
    if (sites.length > 1) {
      // Let user know they can select a different site
      successUrl.searchParams.set('gsc_sites', sites.join(','));
    }

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('[GSC OAuth Callback] Error:', error);
    return NextResponse.redirect(
      new URL(
        `/settings?gsc_error=${encodeURIComponent(
          error instanceof Error ? error.message : 'callback_failed'
        )}`,
        request.nextUrl.origin
      )
    );
  }
}
