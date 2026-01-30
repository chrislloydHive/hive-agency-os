// app/api/os/google/whoami/route.ts
// TEMPORARY debug endpoint – remove after verifying Drive identity
//
// Returns which Google identity the server uses for Drive/Sheets calls
// across all three auth approaches in the codebase.

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

export async function GET() {
  // ── Dev-only guard ──────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production.' },
      { status: 403 }
    );
  }

  const result: Record<string, unknown> = {};

  // ── 1. JWT service account (lib/google/driveClient.ts) ─────────────
  try {
    const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let saEmail: string | null = null;
    let saProjectId: string | null = null;

    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      saEmail = parsed.client_email ?? null;
      saProjectId = parsed.project_id ?? null;
    } else {
      saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null;
    }

    result.jwtServiceAccount = {
      clientEmail: saEmail,
      projectId: saProjectId ?? process.env.GOOGLE_CLOUD_PROJECT ?? null,
      subjectImpersonation: null, // no "subject" is set in getDriveClient()
      source: jsonStr
        ? 'GOOGLE_SERVICE_ACCOUNT_JSON'
        : saEmail
          ? 'GOOGLE_SERVICE_ACCOUNT_EMAIL env var'
          : 'NOT CONFIGURED',
    };
  } catch (err: any) {
    result.jwtServiceAccount = { error: err.message };
  }

  // ── 2. ADC – Application Default Credentials ──────────────────────
  try {
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || undefined;

    const authClient = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      projectId,
    });

    const credentials = await authClient.getCredentials();

    result.adcCredentials = {
      clientEmail: credentials.client_email ?? null,
      projectId: projectId ?? null,
      type: credentials.client_email ? 'service_account' : 'user_credentials',
      hint: credentials.client_email
        ? 'This SA email is the actor for ADC-based Drive calls.'
        : 'Running with user credentials (gcloud auth). The actor is YOUR Google account.',
    };
  } catch (err: any) {
    result.adcCredentials = {
      error: err.message,
      hint: 'ADC not configured. Run: gcloud auth application-default login',
    };
  }

  // ── 3. Per-company OAuth2 ─────────────────────────────────────────
  result.oauthPerCompany = {
    clientId: process.env.GOOGLE_CLIENT_ID
      ? `${process.env.GOOGLE_CLIENT_ID.slice(0, 12)}…`
      : null,
    note: 'Actor is whichever Google user authorized the OAuth flow for each company. Check CompanyIntegrations in Airtable for the specific user.',
  };

  // ── 4. Impersonation check ────────────────────────────────────────
  result.impersonation = {
    GOOGLE_IMPERSONATE_USER_EMAIL: process.env.GOOGLE_IMPERSONATE_USER_EMAIL ?? 'NOT SET',
    verdict:
      'No impersonation (domain-wide delegation) is configured anywhere in the codebase. ' +
      'The JWT auth in lib/google/driveClient.ts does NOT pass a "subject" field.',
  };

  // ── 5. Summary / action items ─────────────────────────────────────
  const actingEmail =
    (result.jwtServiceAccount as any)?.clientEmail ??
    (result.adcCredentials as any)?.clientEmail ??
    null;

  result.summary = {
    actingIdentityHint: actingEmail
      ? `Share the Creative Review Sheet template AND the Car Toys folder tree (root: 1HYFW0QWtcf2GBP56LWxAxuyOm8fKzcns) with: ${actingEmail}`
      : 'Could not determine acting identity. Check the sections above for errors.',
    sharingInstructions: [
      '1. Open the Creative Review Sheet template → Share → add the email above as Editor.',
      '2. Open the Car Toys Production Assets folder → Share → add the email above as Editor (or Content Manager on a Shared Drive).',
      '3. Re-run this endpoint to confirm access.',
    ],
  };

  // Server-side debug log
  console.log('[Google whoami]', JSON.stringify(result, null, 2));

  return NextResponse.json(result, { status: 200 });
}
