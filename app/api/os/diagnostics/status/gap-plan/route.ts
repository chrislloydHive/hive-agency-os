// app/api/os/diagnostics/status/gap-plan/route.ts
// API endpoint for polling Full GAP Plan diagnostic status

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

    const statusKey = makeStatusKey('gapPlan', companyId);
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
    const latestRun = await getLatestRunForCompanyAndTool(companyId, 'gapPlan');

    if (latestRun) {
      // Map database status to polling status
      const mappedStatus =
        latestRun.status === 'complete' ? 'completed' :
        latestRun.status === 'failed' ? 'failed' :
        latestRun.status === 'running' ? 'running' :
        'pending';

      // Get current step description from metadata or summary
      const stage = (latestRun.metadata as any)?.stage;
      let currentStep = '';
      if (latestRun.status === 'running') {
        if (stage === 'full-gap-processing') {
          currentStep = 'Generating Full GAP analysis... This may take 1-2 minutes.';
        } else {
          currentStep = 'Processing...';
        }
      } else if (latestRun.status === 'complete') {
        currentStep = 'Complete!';
      }

      return NextResponse.json({
        status: mappedStatus,
        currentStep,
        percent: latestRun.status === 'complete' ? 100 : latestRun.status === 'running' ? 50 : 0,
        error: latestRun.metadata?.error as string | undefined,
        runId: latestRun.id,
        score: latestRun.score,
        summary: latestRun.summary,
      });
    }

    // No status found
    return NextResponse.json({
      status: 'not_started',
      currentStep: '',
      percent: 0,
    });
  } catch (error) {
    console.error('[GAP Plan Status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
