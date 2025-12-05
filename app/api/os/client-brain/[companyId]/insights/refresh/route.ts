// app/api/os/client-brain/[companyId]/insights/refresh/route.ts
// Refresh insights by re-extracting from recent diagnostic runs

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { processCompletedDiagnostic } from '@/lib/insights/engine';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// POST - Refresh insights from recent diagnostic runs
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    console.log('[InsightsRefresh] Starting refresh for company:', companyId);

    // Get recent completed diagnostic runs (limit 20)
    const recentRuns = await listDiagnosticRunsForCompany(companyId, {
      status: 'complete',
      limit: 20,
    });

    console.log('[InsightsRefresh] Found', recentRuns.length, 'recent runs');

    // Process each run to extract insights
    let totalCreated = 0;
    let totalSkipped = 0;
    const processedRuns: string[] = [];

    for (const run of recentRuns) {
      try {
        const result = await processCompletedDiagnostic(companyId, run);
        if (result.success) {
          totalCreated += result.insightsCreated;
          totalSkipped += result.insightsSkipped;
          if (result.insightsCreated > 0) {
            processedRuns.push(run.toolId);
          }
        }
      } catch (error) {
        console.error('[InsightsRefresh] Failed to process run:', run.id, error);
      }
    }

    console.log('[InsightsRefresh] Complete:', {
      runsProcessed: recentRuns.length,
      insightsCreated: totalCreated,
      insightsSkipped: totalSkipped,
    });

    return NextResponse.json({
      success: true,
      runsProcessed: recentRuns.length,
      insightsCreated: totalCreated,
      insightsSkipped: totalSkipped,
      processedTools: [...new Set(processedRuns)],
    });
  } catch (error) {
    console.error('[InsightsRefresh] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh insights' },
      { status: 500 }
    );
  }
}
