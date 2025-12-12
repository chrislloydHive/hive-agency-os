// app/api/os/reports/qbr-lite/generate/route.ts
// Generate QBR lite report

import { NextRequest, NextResponse } from 'next/server';
import { generateQbrLiteReport } from '@/lib/os/reportsMvp';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, quarter, year } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Use current quarter/year if not specified
    const now = new Date();
    const reportQuarter = quarter ?? Math.ceil((now.getMonth() + 1) / 3);
    const reportYear = year ?? now.getFullYear();

    const report = await generateQbrLiteReport({
      companyId,
      quarter: reportQuarter,
      year: reportYear,
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error('[API] reports/qbr-lite/generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate QBR lite report' },
      { status: 500 }
    );
  }
}
