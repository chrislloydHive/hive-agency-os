// app/api/oauth/google/callback/route.ts
// Google OAuth callback — exchanges code, stores tokens in Airtable, redirects.

import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  getAppBaseUrl,
  getGoogleAccountEmail,
  GOOGLE_OAUTH_SCOPE_VERSION,
} from '@/lib/google/oauth';
import { verifyState } from '@/lib/oauth/state';
import { upsertCompanyGoogleTokens } from '@/lib/airtable/companyIntegrations';

const CALLBACK_PATH = '/api/oauth/google/callback';

function redirectTo(path: string): NextResponse {
  const base = getAppBaseUrl();
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

    // Build redirect_uri from APP_URL (must match consent URL)
    const redirectUri = getAppBaseUrl() + CALLBACK_PATH;

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

    const grantedScopes = tokens.grantedScope?.split(/\s+/).filter(Boolean) ?? [];
    const scopeVersionFromState =
      typeof scopeVersion === 'string' && scopeVersion.trim().length > 0
        ? scopeVersion.trim()
        : null;
    const resolvedScopeVersion = scopeVersionFromState ?? GOOGLE_OAUTH_SCOPE_VERSION;

    console.log('[google-callback]', {
      route: '/api/oauth/google/callback',
      grantedScopesFromGoogle: grantedScopes,
      scopeVersionFromState: scopeVersionFromState ?? '(missing — using required constant)',
      requiredVersion: GOOGLE_OAUTH_SCOPE_VERSION,
      writingScopeVersion: resolvedScopeVersion,
      recordKey: { companyId },
    });

    // Gmail profile email (OAuth2 userinfo needs openid/userinfo scopes we do not request)
    let connectedEmail: string | undefined;
    try {
      connectedEmail = (await getGoogleAccountEmail(tokens.accessToken)) ?? undefined;
    } catch {
      console.warn('[OAuth Google Callback] Could not fetch user email');
    }

    // Persist tokens to Airtable CompanyIntegrations (DB base)
    try {
      const writeResult = await upsertCompanyGoogleTokens(companyId, {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        connectedEmail: connectedEmail ?? null,
        scopeVersion: resolvedScopeVersion,
      });

      console.log('[google-callback] write result =', {
        route: '/api/oauth/google/callback',
        ok: true,
        companyId,
        scopeVersionWritten: resolvedScopeVersion,
        airtableResponseKeys: writeResult && typeof writeResult === 'object' ? Object.keys(writeResult as object) : typeof writeResult,
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
