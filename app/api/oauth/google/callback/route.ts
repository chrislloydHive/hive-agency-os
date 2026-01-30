// app/api/oauth/google/callback/route.ts
// Google OAuth callback — exchanges code, stores tokens, returns JSON.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { exchangeCodeForTokens } from '@/lib/google/oauth';
import { updateGoogleTokens } from '@/lib/airtable/companyIntegrations';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle user denial
    if (error) {
      return NextResponse.json(
        { ok: false, error: 'access_denied', detail: error },
        { status: 400 },
      );
    }

    if (!code) {
      return NextResponse.json(
        { ok: false, error: 'missing_code' },
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
          { ok: false, error: 'invalid_state', detail: 'Could not decode state parameter' },
          { status: 400 },
        );
      }
    }

    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'missing_company_id', detail: 'state must contain companyId' },
        { status: 400 },
      );
    }

    // Exchange code for tokens
    let tokens;
    try {
      tokens = await exchangeCodeForTokens(code);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      console.error('[OAuth Google Callback] Token exchange failed:', message);
      return NextResponse.json(
        { ok: false, error: 'token_exchange_failed', detail: message },
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
      console.warn('[OAuth Google Callback] Could not fetch user email:', e);
    }

    // Store tokens
    await updateGoogleTokens(companyId, {
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.expiresAt,
      connectedEmail,
    });

    console.log(`[OAuth Google Callback] Tokens stored for company ${companyId}`);

    return NextResponse.json({
      ok: true,
      companyId,
      connectedEmail: connectedEmail ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[OAuth Google Callback] Unhandled error:', message);
    return NextResponse.json(
      { ok: false, error: 'internal_error', detail: message },
      { status: 500 },
    );
  }
}
