// app/api/debug/company-summary/[companyId]/route.ts
// Debug endpoint for testing CompanySummary
//
// Usage: GET /api/debug/company-summary/[companyId]
// Returns the full CompanySummary for a company
//
// DEV ONLY - this should be protected in production

import { NextRequest, NextResponse } from 'next/server';
import { getCompanySummary } from '@/lib/os/companySummary';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoint not available in production' },
      { status: 403 }
    );
  }

  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json(
      { error: 'companyId is required' },
      { status: 400 }
    );
  }

  console.log('[Debug] Fetching CompanySummary for:', companyId);

  try {
    const summary = await getCompanySummary(companyId);

    if (!summary) {
      return NextResponse.json(
        { error: 'Company not found', companyId },
        { status: 404 }
      );
    }

    // Return pretty-printed JSON for easier debugging
    return new NextResponse(JSON.stringify(summary, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[Debug] Error fetching CompanySummary:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch company summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
