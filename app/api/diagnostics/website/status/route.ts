// app/api/diagnostics/website/status/route.ts
// API endpoint for polling Website Diagnostic status

import { NextRequest, NextResponse } from 'next/server';
import { getDiagnosticStatus, makeStatusKey } from '@/lib/os/diagnostics/statusStore';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId' },
        { status: 400 }
      );
    }

    const statusKey = makeStatusKey('websiteLab', companyId);
    const status = getDiagnosticStatus(statusKey);

    // If we have in-memory status, return it
    if (status) {
      return NextResponse.json({
        status: status.status,
        currentStep: status.currentStep,
        percent: status.percent,
        error: status.error,
        runId: status.runId,
      });
    }

    // Fallback: Check database for latest run status
    const latestRun = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');

    if (latestRun) {
      // Map database status to polling status
      const mappedStatus =
        latestRun.status === 'complete' ? 'completed' :
        latestRun.status === 'failed' ? 'failed' :
        latestRun.status === 'running' ? 'running' :
        'pending';

      return NextResponse.json({
        status: mappedStatus,
        currentStep: latestRun.status === 'running' ? 'Processing...' : '',
        percent: latestRun.status === 'complete' ? 100 : latestRun.status === 'running' ? 50 : 0,
        error: latestRun.metadata?.error as string | undefined,
        runId: latestRun.id,
      });
    }

    // No status found
    return NextResponse.json({
      status: 'not_started',
      currentStep: '',
      percent: 0,
    });
  } catch (error) {
    console.error('[Website Diagnostic Status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
