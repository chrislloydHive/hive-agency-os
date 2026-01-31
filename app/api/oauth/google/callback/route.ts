// app/api/oauth/google/callback/route.ts
// Google OAuth callback — exchanges code, stores tokens in Airtable, returns JSON.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { exchangeCodeForTokens } from '@/lib/google/oauth';
import { upsertCompanyGoogleTokens } from '@/lib/airtable/companyIntegrations';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle user denial
    if (error) {
      return NextResponse.json(
        { ok: false, error: 'access_denied', hint: `Google returned error: ${error}` },
        { status: 400 },
      );
    }

    if (!code) {
      return NextResponse.json(
        { ok: false, error: 'missing_code', hint: 'No authorization code in query params' },
        { status: 400 },
      );
    }

    // Decode state to extract companyId
    let companyId: string | null = null;
    if (stateParam) {
      try {
        const state = JSON.parse(
          Buffer.from(stateParam, 'base64').toString('utf-8'),
        );
        companyId = state.companyId ?? null;
      } catch {
        return NextResponse.json(
          { ok: false, error: 'invalid_state', hint: 'Could not decode base64 state parameter' },
          { status: 400 },
        );
      }
    }

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'missing_company_id', hint: 'state must contain companyId' },
        { status: 400 },
      );
    }

    // Build redirect_uri from the actual request origin so it matches what
    // was used during consent URL generation.
    const origin = new URL(request.url).origin;
    const redirectUri = origin + '/api/oauth/google/callback';

    // Exchange code for tokens
    let tokens;
    try {
      tokens = await exchangeCodeForTokens(code, redirectUri);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      console.error('[OAuth Google Callback] Token exchange failed:', message);
      return NextResponse.json(
        { ok: false, error: 'token_exchange_failed', hint: message },
        { status: 502 },
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
    } catch (e) {
      console.warn('[OAuth Google Callback] Could not fetch user email');
    }

    // Persist tokens to Airtable CompanyIntegrations (DB base)
    try {
      await upsertCompanyGoogleTokens(companyId, {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        connectedEmail: connectedEmail ?? null,
      });

      console.log(`[OAuth Google Callback] Tokens persisted for companyId=${companyId}`);
    } catch (storeErr) {
      const message = storeErr instanceof Error ? storeErr.message : 'Token storage failed';
      console.error('[OAuth Google Callback] Airtable write failed:', message);
      return NextResponse.json(
        { ok: false, error: 'airtable_write_failed', hint: message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      companyId,
      connectedEmail: connectedEmail ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[OAuth Google Callback] Unhandled error:', message);
    return NextResponse.json(
      { ok: false, error: 'internal_error', hint: message },
      { status: 500 },
    );
  }
}
