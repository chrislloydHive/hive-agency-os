// app/api/os/reports/monthly/generate/route.ts
// Generate monthly report

import { NextRequest, NextResponse } from 'next/server';
import { generateMonthlyReport } from '@/lib/os/reportsMvp';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, month, year } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Use current month/year if not specified
    const now = new Date();
    const reportMonth = month ?? now.getMonth() + 1;
    const reportYear = year ?? now.getFullYear();

    const report = await generateMonthlyReport({
      companyId,
      month: reportMonth,
      year: reportYear,
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error('[API] reports/monthly/generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate monthly report' },
      { status: 500 }
    );
  }
}
