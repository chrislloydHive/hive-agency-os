// app/api/integrations/google/callback/route.ts
// Google OAuth Callback Endpoint
//
// GET - Handles OAuth callback from Google, exchanges code for tokens

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { updateGoogleTokens } from '@/lib/airtable/companyIntegrations';
import { getAppBaseUrl } from '@/lib/google/oauth';

/**
 * GET /api/integrations/google/callback
 *
 * Handles OAuth callback from Google.
 * Exchanges authorization code for tokens and stores them.
 *
 * Query params (from Google):
 * - code: Authorization code to exchange
 * - state: Base64-encoded JSON with companyId and redirect
 * - error: Error message if user denied access
 *
 * Returns: Redirect to the specified redirect URL or setup page
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');

    // Decode state to get companyId and redirect URL
    let companyId: string | null = null;
    let redirectUrl: string | null = null;

    if (stateParam) {
      try {
        const state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'));
        companyId = state.companyId;
        redirectUrl = state.redirect;
      } catch (e) {
        console.error('[Google OAuth Callback] Failed to parse state:', e);
      }
    }

    // Determine base URL for redirects from canonical APP_URL
    const baseUrl = getAppBaseUrl();
    const defaultRedirect = companyId ? `/c/${companyId}/brain/setup?step=9` : '/';
    const finalRedirectBase = redirectUrl || defaultRedirect;

    // Handle user denial
    if (error) {
      console.log(`[Google OAuth Callback] User denied access: ${error}`);
      const errorRedirect = new URL(finalRedirectBase, baseUrl);
      errorRedirect.searchParams.set('google_error', error);
      return NextResponse.redirect(errorRedirect.toString());
    }

    // Validate required params
    if (!code) {
      console.error('[Google OAuth Callback] Missing authorization code');
      const errorRedirect = new URL(finalRedirectBase, baseUrl);
      errorRedirect.searchParams.set('google_error', 'missing_code');
      return NextResponse.redirect(errorRedirect.toString());
    }

    if (!companyId) {
      console.error('[Google OAuth Callback] Missing companyId in state');
      return NextResponse.json(
        { error: 'Invalid OAuth state: missing companyId' },
        { status: 400 }
      );
    }

    // Check for required env vars
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[Google OAuth Callback] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      const errorRedirect = new URL(finalRedirectBase, baseUrl);
      errorRedirect.searchParams.set('google_error', 'config_error');
      return NextResponse.redirect(errorRedirect.toString());
    }

    // Create OAuth client with same callback URL used during authorization
    const callbackUrl = `${getAppBaseUrl()}/api/integrations/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      callbackUrl
    );

    // Exchange code for tokens
    console.log(`[Google OAuth Callback] Exchanging code for tokens for company ${companyId}`);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.warn('[Google OAuth Callback] No refresh token returned. User may have already authorized.');
      // Still proceed - we may have an access token we can use short-term
    }

    // Get user email from token info
    let connectedEmail: string | undefined;
    if (tokens.access_token) {
      try {
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        connectedEmail = userInfo.data.email || undefined;
        console.log(`[Google OAuth Callback] Connected as ${connectedEmail}`);
      } catch (e) {
        console.warn('[Google OAuth Callback] Could not fetch user email:', e);
      }
    }

    // Store tokens in CompanyIntegrations
    await updateGoogleTokens(companyId, {
      refreshToken: tokens.refresh_token || '',
      accessToken: tokens.access_token || undefined,
      accessTokenExpiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : undefined,
      connectedEmail,
    });

    console.log(`[Google OAuth Callback] Successfully stored tokens for company ${companyId}`);

    // Redirect back to setup with success indicator
    const successRedirect = new URL(finalRedirectBase, baseUrl);
    successRedirect.searchParams.set('google_connected', 'true');
    return NextResponse.redirect(successRedirect.toString());
  } catch (error) {
    console.error('[Google OAuth Callback] Error:', error);

    // Try to redirect with error, or return JSON if we can't determine redirect
    const baseUrl = getAppBaseUrl();
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';

    // If we have any state, try to redirect
    const stateParam = request.nextUrl.searchParams.get('state');
    if (stateParam) {
      try {
        const state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'));
        const redirectUrl = state.redirect || (state.companyId ? `/c/${state.companyId}/brain/setup?step=9` : '/');
        const errorRedirect = new URL(redirectUrl, baseUrl);
        errorRedirect.searchParams.set('google_error', errorMessage);
        return NextResponse.redirect(errorRedirect.toString());
      } catch {
        // Fall through to JSON response
      }
    }

    return NextResponse.json(
      { error: 'Failed to complete Google OAuth', details: errorMessage },
      { status: 500 }
    );
  }
}
