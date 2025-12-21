// app/api/os/companies/[companyId]/diagnostics/runs/route.ts
// API endpoint for fetching diagnostic runs for a company
//
// Returns the latest run per toolId with status, createdAt, and score.
// Used by the Diagnostics page to show tool launcher state.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  listDiagnosticRunsForCompany,
  getToolLabel,
  type DiagnosticRun,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// Tool IDs we care about for the diagnostics page
const TOOL_IDS: DiagnosticToolId[] = [
  'gapSnapshot',
  'gapPlan',
  'websiteLab',
  'brandLab',
  'seoLab',
  'contentLab',
  'demandLab',
  'opsLab',
  'audienceLab',
  'competitionLab',
];

interface ToolRunSummary {
  toolId: DiagnosticToolId;
  toolLabel: string;
  runId: string | null;
  status: 'idle' | 'running' | 'complete' | 'failed';
  createdAt: string | null;
  score: number | null;
  summary: string | null;
  /** Error message if the run failed */
  error: string | null;
}

/**
 * GET /api/os/companies/[companyId]/diagnostics/runs
 * Returns latest run per toolId
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Fetch all runs for this company (limit 100 to cover all tools)
    const allRuns = await listDiagnosticRunsForCompany(companyId, { limit: 100 });

    // Group by tool and get latest run for each
    const latestByTool = new Map<DiagnosticToolId, DiagnosticRun>();
    for (const run of allRuns) {
      const existing = latestByTool.get(run.toolId);
      if (!existing || new Date(run.createdAt) > new Date(existing.createdAt)) {
        latestByTool.set(run.toolId, run);
      }
    }

    // Build response with all tools (including those without runs)
    const toolRuns: ToolRunSummary[] = TOOL_IDS.map(toolId => {
      const run = latestByTool.get(toolId);

      if (!run) {
        return {
          toolId,
          toolLabel: getToolLabel(toolId),
          runId: null,
          status: 'idle' as const,
          createdAt: null,
          score: null,
          summary: null,
          error: null,
        };
      }

      // Normalize status
      const rawStatus = run.status;
      let status: 'idle' | 'running' | 'complete' | 'failed';
      if (rawStatus === 'complete' || (rawStatus as string) === 'completed') {
        status = 'complete';
      } else if (rawStatus === 'running' || rawStatus === 'pending') {
        status = 'running';
      } else if (rawStatus === 'failed') {
        status = 'failed';
      } else {
        status = 'idle';
      }

      // Extract error message from metadata if run failed
      let error: string | null = null;
      if (status === 'failed' && run.metadata) {
        error = (run.metadata as { error?: string }).error || null;
      }

      return {
        toolId,
        toolLabel: getToolLabel(toolId),
        runId: run.id,
        status,
        createdAt: run.createdAt,
        score: run.score,
        summary: run.summary,
        error,
      };
    });

    return NextResponse.json({
      ok: true,
      companyId,
      companyName: company.name,
      website: company.website,
      runs: toolRuns,
    });
  } catch (error) {
    console.error('[Diagnostics Runs API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
