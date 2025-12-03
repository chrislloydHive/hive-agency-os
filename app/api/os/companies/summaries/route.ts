// app/api/os/companies/summaries/route.ts
// Fetch company summaries for multiple company IDs
// Used by My Companies page to load pinned companies

import { NextRequest, NextResponse } from 'next/server';
import { getCompanySummaries } from '@/lib/os/companySummary';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyIds } = body;

    if (!companyIds || !Array.isArray(companyIds)) {
      return NextResponse.json(
        { error: 'companyIds array is required' },
        { status: 400 }
      );
    }

    // Limit to prevent abuse
    if (companyIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 companies per request' },
        { status: 400 }
      );
    }

    // Filter out invalid IDs
    const validIds = companyIds.filter(
      (id): id is string => typeof id === 'string' && id.startsWith('rec')
    );

    if (validIds.length === 0) {
      return NextResponse.json({ summaries: [] });
    }

    const summaries = await getCompanySummaries(validIds);

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error('[API] Error fetching company summaries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company summaries' },
      { status: 500 }
    );
  }
}
