// app/api/delivery/check-credentials/route.ts
// GET: Check what Google Drive credentials are available
// Useful for debugging authentication issues

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest) {
  try {
    // Check for service account credentials (used by project folder creation)
    const hasServiceAccountJson = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const hasServiceAccountEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const hasServiceAccountKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const hasServiceAccount = hasServiceAccountJson || (hasServiceAccountEmail && hasServiceAccountKey);
    
    // Check for WIF credentials
    const hasWifJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const hasWifFile = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasVercelOidcToken = !!process.env.VERCEL_OIDC_TOKEN;
    
    // Check for OIDC token file
    let oidcTokenFileExists = false;
    try {
      const fs = require('fs');
      oidcTokenFileExists = fs.existsSync('/var/run/secrets/vercel-oidc/token');
    } catch {
      // Ignore errors
    }
    
    // Check for impersonation email
    const impersonateEmail = process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT_EMAIL || 
                             process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT || 
                             null;
    
    return NextResponse.json(
      {
        serviceAccount: {
          hasJson: hasServiceAccountJson,
          hasEmail: hasServiceAccountEmail,
          hasKey: hasServiceAccountKey,
          available: hasServiceAccount,
        },
        wif: {
          hasJson: hasWifJson,
          hasFile: hasWifFile,
          hasVercelOidcToken,
          oidcTokenFileExists,
          impersonateEmail: impersonateEmail ? 'set' : 'not set',
        },
        summary: {
          canUseServiceAccount: hasServiceAccount,
          canUseWif: hasWifJson || hasWifFile || hasVercelOidcToken || oidcTokenFileExists,
          recommended: hasServiceAccount ? 'service_account' : (hasWifJson ? 'wif' : 'none'),
        },
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error('[delivery/check-credentials] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check credentials' },
      { status: 500, headers: NO_STORE }
    );
  }
}
