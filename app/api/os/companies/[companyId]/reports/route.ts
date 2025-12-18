// app/api/os/companies/[companyId]/reports/route.ts
// API route for listing diagnostic reports for a company

import { NextRequest, NextResponse } from 'next/server';
import { listCompanyReports, type ReportListOptions } from '@/lib/reports/diagnosticReports';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);

    const options: ReportListOptions = {};

    // Parse filter options
    const kind = searchParams.get('kind');
    if (kind === 'lab' || kind === 'gap_ia' || kind === 'gap_full') {
      options.kind = kind;
    }

    const status = searchParams.get('status');
    if (status === 'pending' || status === 'running' || status === 'complete' || status === 'failed') {
      options.status = status;
    }

    const labKey = searchParams.get('labKey');
    if (labKey) {
      options.labKey = labKey;
    }

    const limit = searchParams.get('limit');
    if (limit) {
      options.limit = parseInt(limit, 10);
    }

    const reports = await listCompanyReports(companyId, options);

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('[ReportsAPI] Error listing reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
