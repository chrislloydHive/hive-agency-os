// app/api/oauth/google/callback/route.ts
// Google OAuth callback — exchanges code, stores tokens in Airtable, redirects.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { exchangeCodeForTokens, getCanonicalBaseUrl } from '@/lib/google/oauth';
import { verifyState } from '@/lib/oauth/state';
import { upsertCompanyGoogleTokens } from '@/lib/airtable/companyIntegrations';

const CALLBACK_PATH = '/api/oauth/google/callback';

function redirectTo(path: string): NextResponse {
  const base = getCanonicalBaseUrl();
  return NextResponse.redirect(`${base}${path}`);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle user denial
    if (error) {
      return redirectTo(
        `/settings/integrations?google_error=${encodeURIComponent(`Google returned error: ${error}`)}`,
      );
    }

    if (!code) {
      return redirectTo(
        `/settings/integrations?google_error=${encodeURIComponent('No authorization code received')}`,
      );
    }

    // Verify HMAC-signed state
    if (!stateParam) {
      return redirectTo(
        `/settings/integrations?google_error=${encodeURIComponent('Missing state parameter')}`,
      );
    }

    const stateResult = verifyState(stateParam);
    if (!stateResult.ok) {
      console.error('[OAuth Google Callback] State verification failed:', stateResult.error);
      return NextResponse.json(
        { ok: false, error: 'invalid_state', hint: stateResult.error },
        { status: 400 },
      );
    }

    const { companyId, scopeVersion } = stateResult.payload as {
      companyId?: string;
      scopeVersion?: string;
    };

    if (!companyId) {
      return redirectTo(
        `/settings/integrations?google_error=${encodeURIComponent('State missing companyId')}`,
      );
    }

    // Build redirect_uri from canonical base URL (must match consent URL)
    const redirectUri = getCanonicalBaseUrl() + CALLBACK_PATH;

    // Exchange code for tokens
    let tokens;
    try {
      tokens = await exchangeCodeForTokens(code, redirectUri);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      console.error('[OAuth Google Callback] Token exchange failed:', message);
      return redirectTo(
        `/settings/integrations?google_error=${encodeURIComponent(message)}`,
      );
    }

    // Fetch connected email via userinfo
    let connectedEmail: string | undefined;
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ access_token: tokens.accessToken });

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      connectedEmail = userInfo.data.email || undefined;
    } catch {
      console.warn('[OAuth Google Callback] Could not fetch user email');
    }

    // Persist tokens to Airtable CompanyIntegrations (DB base)
    try {
      await upsertCompanyGoogleTokens(companyId, {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        connectedEmail: connectedEmail ?? null,
        scopeVersion: scopeVersion ?? null,
      });

      console.log(`[OAuth Google Callback] Tokens persisted for companyId=${companyId}`);
    } catch (storeErr) {
      const message = storeErr instanceof Error ? storeErr.message : 'Token storage failed';
      console.error('[OAuth Google Callback] Airtable write failed:', message);
      return redirectTo(
        `/settings/integrations?google_error=${encodeURIComponent(message)}`,
      );
    }

    return redirectTo(
      `/settings/integrations?google=connected&companyId=${encodeURIComponent(companyId)}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[OAuth Google Callback] Unhandled error:', message);
    return redirectTo(
      `/settings/integrations?google_error=${encodeURIComponent(message)}`,
    );
  }
}
