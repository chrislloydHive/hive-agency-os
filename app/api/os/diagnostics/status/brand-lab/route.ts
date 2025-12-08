// app/api/os/diagnostics/status/brand-lab/route.ts
// API endpoint for polling Brand Lab diagnostic status

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

    const statusKey = makeStatusKey('brandLab', companyId);
    const status = getDiagnosticStatus(statusKey);

    // If we have in-memory status, return it
    if (status) {
      return NextResponse.json({
        status: status.status,
        currentStep: status.currentStep,
        percent: status.percent,
        error: status.error,
        runId: status.runId,
        score: (status as any).score,
        benchmarkLabel: (status as any).benchmarkLabel,
      });
    }

    // Fallback: Check database for latest run status
    const latestRun = await getLatestRunForCompanyAndTool(companyId, 'brandLab');

    if (latestRun) {
      // Extract benchmarkLabel from rawJson if available
      let benchmarkLabel: string | undefined;
      if (latestRun.rawJson) {
        try {
          const parsed = typeof latestRun.rawJson === 'string'
            ? JSON.parse(latestRun.rawJson)
            : latestRun.rawJson;
          benchmarkLabel = parsed?.benchmarkLabel || parsed?.maturityStage || parsed?.diagnostic?.benchmarkLabel;
        } catch {}
      }

      return NextResponse.json({
        status: latestRun.status, // Return actual status (complete/failed/running)
        currentStep: latestRun.status === 'running' ? 'Processing...' : '',
        percent: latestRun.status === 'complete' ? 100 : latestRun.status === 'running' ? 50 : 0,
        error: latestRun.metadata?.error as string | undefined,
        runId: latestRun.id,
        score: latestRun.score,
        benchmarkLabel,
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
    console.error('[Brand Lab Status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
