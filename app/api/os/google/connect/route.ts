// app/api/os/google/connect/route.ts
// Returns the Google OAuth consent URL for a given company.
//
// GET /api/os/google/connect?companyId=recXXX
// → { ok: true, url: "https://accounts.google.com/o/oauth2/v2/auth?..." }

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthUrl } from '@/lib/google/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: 'companyId query parameter is required' },
      { status: 400 },
    );
  }

  try {
    const url = getGoogleOAuthUrl(companyId);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate OAuth URL';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
