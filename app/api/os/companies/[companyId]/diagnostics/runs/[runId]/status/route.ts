// app/api/os/companies/[companyId]/diagnostics/runs/[runId]/status/route.ts
// Quick status check for diagnostic runs (used for polling)

import { NextRequest, NextResponse } from 'next/server';
import { getDiagnosticRun } from '@/lib/os/diagnostics/runs';

interface RouteContext {
  params: Promise<{ companyId: string; runId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { companyId, runId } = await context.params;

  try {
    const run = await getDiagnosticRun(runId);

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Verify the run belongs to the company
    if (run.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Run not found for this company' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: run.status,
      score: run.score,
      updatedAt: run.updatedAt,
    });
  } catch (error) {
    console.error('[Run Status API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch run status' },
      { status: 500 }
    );
  }
}
