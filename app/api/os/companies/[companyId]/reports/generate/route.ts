// app/api/os/companies/[companyId]/reports/generate/route.ts
// API Route for generating reports (Annual Plan, QBR)

import { NextRequest, NextResponse } from 'next/server';
import { generateAnnualPlan, generateQBR } from '@/lib/reports/ai/orchestrator';
import type { ReportType } from '@/lib/reports/types';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const body = await request.json();
    const { type, period } = body as { type: ReportType; period?: string };

    if (!type) {
      return NextResponse.json(
        { error: 'Report type is required' },
        { status: 400 }
      );
    }

    if (!['annual', 'qbr'].includes(type)) {
      return NextResponse.json(
        { error: `Invalid report type: ${type}` },
        { status: 400 }
      );
    }

    console.log(`[Reports API] Generating ${type} report for company ${companyId}`);

    let report;

    switch (type) {
      case 'annual':
        report = await generateAnnualPlan(companyId);
        break;
      case 'qbr':
        report = await generateQBR(companyId);
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported report type: ${type}` },
          { status: 400 }
        );
    }

    console.log(`[Reports API] Successfully generated ${type} report:`, report.meta.id);

    return NextResponse.json({ report });
  } catch (error) {
    console.error('[Reports API] Generation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 }
    );
  }
}
