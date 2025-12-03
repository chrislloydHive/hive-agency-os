// app/api/os/diagnostics/status/[toolId]/route.ts
// Generic API endpoint for polling any diagnostic tool status

import { NextRequest, NextResponse } from 'next/server';
import { getDiagnosticStatus, makeStatusKey } from '@/lib/os/diagnostics/statusStore';
import { getLatestRunForCompanyAndTool, isValidToolId, type DiagnosticToolId } from '@/lib/os/diagnostics/runs';

type RouteContext = {
  params: Promise<{ toolId: string }>;
};

// Tool-specific progress messages
const toolProgressMessages: Record<string, string> = {
  gapSnapshot: 'Running initial assessment...',
  gapPlan: 'Generating Full GAP plan...',
  websiteLab: 'Analyzing website...',
  brandLab: 'Analyzing brand...',
  contentLab: 'Analyzing content...',
  seoLab: 'Analyzing SEO...',
  demandLab: 'Analyzing demand generation...',
  opsLab: 'Analyzing marketing operations...',
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { toolId } = await context.params;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId' },
        { status: 400 }
      );
    }

    if (!isValidToolId(toolId)) {
      return NextResponse.json(
        { error: `Invalid toolId: ${toolId}` },
        { status: 400 }
      );
    }

    const statusKey = makeStatusKey(toolId as DiagnosticToolId, companyId);
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
    const latestRun = await getLatestRunForCompanyAndTool(companyId, toolId as DiagnosticToolId);

    if (latestRun) {
      // Map database status to polling status
      const mappedStatus =
        latestRun.status === 'complete' ? 'completed' :
        latestRun.status === 'failed' ? 'failed' :
        latestRun.status === 'running' ? 'running' :
        'pending';

      return NextResponse.json({
        status: mappedStatus,
        currentStep: latestRun.status === 'running' ? (toolProgressMessages[toolId] || 'Processing...') : '',
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
    console.error('[Diagnostic Status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
