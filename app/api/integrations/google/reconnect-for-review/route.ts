// app/api/integrations/google/reconnect-for-review/route.ts
// Starts Google OAuth for a company that is not in the OS (e.g. Car Toys).
// Looks up CompanyIntegrations by clientCode or companyName (DB base first), then
// redirects to Google consent. Callback stores the new token on that record (by RECORD_ID).

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { findCompanyIntegration } from '@/lib/airtable/companyIntegrations';
import { getAppBaseUrl } from '@/lib/google/oauth';

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/drive', // Full Drive for review portal (list/download)
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
];

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/google/reconnect-for-review
 *
 * Query params (use one of the first three):
 * - companyId: CompanyId from the CompanyIntegrations row (e.g. from CSV export).
 * - clientCode: e.g. CARTOYS (needs Client Code on the row)
 * - companyName: e.g. Car Toys (needs Company Name on the row)
 * - baseId (optional): Airtable base ID where CompanyIntegrations lives (e.g. Client PM base). Use when the table is not in Hive OS DB/OS bases.
 * - redirect (optional): URL after callback (default /)
 *
 * Finds the CompanyIntegrations record and starts OAuth; callback stores the new token on that record.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId')?.trim() || undefined;
    const clientCode = searchParams.get('clientCode')?.trim() || undefined;
    const companyName = searchParams.get('companyName')?.trim() || undefined;
    const baseId = searchParams.get('baseId')?.trim() || undefined;
    const redirectUrl = searchParams.get('redirect')?.trim() || undefined;

    if (!companyId && !clientCode && !companyName) {
      return NextResponse.json(
        {
          error: 'Provide one of companyId, clientCode, or companyName',
          hint: 'Use companyId from the CompanyId column of your CompanyIntegrations export. If the table lives in another base (e.g. Client PM), add &baseId=appXXXXX.',
        },
        { status: 400 }
      );
    }

    const result = await findCompanyIntegration({
      companyId: companyId ?? null,
      clientCode: clientCode ?? null,
      companyName: companyName ?? null,
      baseIdOverride: baseId || null,
    });

    if (!result.record) {
      return NextResponse.json(
        {
          error: 'No CompanyIntegrations record found for that client',
          hint: 'Create a row in CompanyIntegrations (Hive DB or OS base) with matching Client Code or Company Name.',
          debug: result.debug?.attempts?.length ? { attempts: result.debug.attempts.length } : undefined,
        },
        { status: 404 }
      );
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
      companyId: result.record.id, // Callback finds this record by RECORD_ID()
      redirect: redirectUrl || '/',
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: Buffer.from(state).toString('base64'),
    });

    console.log(
      `[Google OAuth] Reconnect-for-review: redirecting to consent (recordId=${result.record.id}, matchedBy=${result.matchedBy})`
    );

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[Google OAuth] reconnect-for-review error:', error);
    return NextResponse.json(
      { error: 'Failed to start reconnect', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
