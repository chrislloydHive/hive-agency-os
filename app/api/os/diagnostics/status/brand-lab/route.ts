// app/api/os/diagnostics/status/brand-lab/route.ts
// API endpoint for polling Brand Lab diagnostic status

import { NextRequest, NextResponse } from 'next/server';
import { getDiagnosticStatus, makeStatusKey, clearDiagnosticStatus } from '@/lib/os/diagnostics/statusStore';
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
    const inMemoryStatus = getDiagnosticStatus(statusKey);

    // Always check database for authoritative status
    // (Inngest runs on different serverless instance, so in-memory may be stale)
    const latestRun = await getLatestRunForCompanyAndTool(companyId, 'brandLab');

    // If database shows complete/failed, that's authoritative - clear stale in-memory status
    if (latestRun && (latestRun.status === 'complete' || latestRun.status === 'failed')) {
      // Clear stale in-memory status if it exists
      if (inMemoryStatus && inMemoryStatus.status === 'running') {
        clearDiagnosticStatus(statusKey);
      }
    }

    // If in-memory status is NOT 'running', return it (pending/completed/failed are set locally)
    // But if it's 'running', prefer database since Inngest updates database, not in-memory
    if (inMemoryStatus && inMemoryStatus.status !== 'running') {
      return NextResponse.json({
        status: inMemoryStatus.status,
        currentStep: inMemoryStatus.currentStep,
        percent: inMemoryStatus.percent,
        error: inMemoryStatus.error,
        runId: inMemoryStatus.runId,
        score: (inMemoryStatus as any).score,
        benchmarkLabel: (inMemoryStatus as any).benchmarkLabel,
      });
    }

    if (latestRun) {
      // Extract benchmarkLabel from rawJson if available
      let benchmarkLabel: string | undefined;
      if (latestRun.rawJson) {
        try {
          const parsed = typeof latestRun.rawJson === 'string'
            ? JSON.parse(latestRun.rawJson)
            : latestRun.rawJson;
          benchmarkLabel = parsed?.benchmarkLabel || parsed?.maturityStage || parsed?.diagnostic?.benchmarkLabel;
        } catch {
          // Ignore parse errors - benchmarkLabel remains undefined
        }
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
