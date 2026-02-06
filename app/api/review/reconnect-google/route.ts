// app/api/review/reconnect-google/route.ts
// One-URL Google reconnect for the review portal: pass the same token from the review URL.
// Resolves project → company → CompanyIntegrations, then redirects to Google OAuth.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getReviewCompanyFromToken } from '@/lib/review/resolveProject';
import { findCompanyIntegration } from '@/lib/airtable/companyIntegrations';
import { getAppBaseUrl } from '@/lib/google/oauth';

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
];

export const dynamic = 'force-dynamic';

/**
 * GET /api/review/reconnect-google?token=REVIEW_PORTAL_TOKEN
 *
 * Simplest reconnect: use the same token that’s in the review URL.
 * Optionally set REVIEW_INTEGRATIONS_BASE_ID in env to the base where CompanyIntegrations lives (e.g. Client PM base).
 */
/** If the user pasted the full reconnect URL, extract the token from ?token= or #token= */
function normalizeTokenParam(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const asUrl = trimmed.startsWith('http') ? trimmed : `https://x/?token=${trimmed}`;
    const url = new URL(asUrl);
    const fromQuery = url.searchParams.get('token');
    if (fromQuery && fromQuery.length > 10) return fromQuery.trim();
    const fromHash = url.hash ? new URLSearchParams(url.hash.slice(1)).get('token') : null;
    if (fromHash && fromHash.length > 10) return fromHash.trim();
  } catch {
    // not a URL, use as-is
  }
  return trimmed.length > 10 ? trimmed : null;
}

export async function GET(request: NextRequest) {
  const debug = request.nextUrl.searchParams.get('debug') === '1';

  try {
    const raw = request.nextUrl.searchParams.get('token');
    const token = normalizeTokenParam(raw);
    if (!token) {
      return NextResponse.json(
        { error: 'Missing token', hint: 'Add ?token= to the URL with the same token from your review portal link (the part after /review/). You can paste the full reconnect URL and we’ll extract the token.' },
        { status: 400 }
      );
    }

    const company = await getReviewCompanyFromToken(token);
    if (!company) {
      const body: Record<string, unknown> = {
        error: 'No project found for this token',
        code: 'TOKEN_NOT_FOUND',
        hint: 'The token was not found on any Project (Client Review Portal Token) in the base this app uses. Check that the token matches the review URL and that Projects are in the same Airtable base as AIRTABLE_BASE_ID / AIRTABLE_OS_BASE_ID.',
      };
      if (debug) body.debug = { step: 'getReviewCompanyFromToken', tokenLength: token.length };
      return NextResponse.json(body, { status: 404 });
    }

    const baseIdOverride = process.env.REVIEW_INTEGRATIONS_BASE_ID?.trim() || undefined;
    const result = await findCompanyIntegration({
      companyId: company.companyId,
      clientCode: company.clientCode ?? null,
      baseIdOverride: baseIdOverride ?? null,
    });

    if (!result.record) {
      const body: Record<string, unknown> = {
        error: 'No CompanyIntegrations row found for this project’s company',
        code: 'NO_INTEGRATION_ROW',
        hint: 'Set REVIEW_INTEGRATIONS_BASE_ID in Vercel to the base ID where CompanyIntegrations lives (e.g. appVLDjqK2q4IJhGz), then redeploy.',
        companyId: company.companyId,
      };
      if (debug) body.debug = { step: 'findCompanyIntegration', baseIdOverride: baseIdOverride ?? null, attempts: result.debug?.attempts };
      return NextResponse.json(body, { status: 404 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    const baseUrl = getAppBaseUrl();
    const callbackUrl = `${baseUrl}/api/integrations/google/callback`;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, callbackUrl);

    const state = JSON.stringify({
      companyId: result.record.id,
      redirect: `${baseUrl}/review/${token}`,
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: Buffer.from(state).toString('base64'),
    });

    console.log(
      `[review/reconnect-google] token→companyId=${company.companyId} integrationRecordId=${result.record.id}`
    );

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[review/reconnect-google] error:', error);
    return NextResponse.json(
      { error: 'Reconnect failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
