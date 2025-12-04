// app/api/dev/context-graph/[companyId]/route.ts
// Dev-only API for inspecting a company's Context Graph
//
// Returns the full graph, recent snapshots, and needs-refresh flags.
// Only available in development mode.

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import { listSnapshotSummaries } from '@/lib/contextGraph/history';
import { calculateCompleteness, calculateDomainCoverage } from '@/lib/contextGraph/companyContextGraph';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    console.log(`[Dev API] Loading context graph for: ${companyId}`);

    // Load the graph
    const graph = await loadContextGraph(companyId);

    if (!graph) {
      return NextResponse.json({
        exists: false,
        companyId,
        message: 'No context graph found for this company. Run diagnostics or fusion to create one.',
      });
    }

    // Get refresh report
    const needsRefresh = getNeedsRefreshReport(graph);

    // Get recent snapshots
    const snapshots = await listSnapshotSummaries(companyId, 5);

    // Calculate stats
    const completenessScore = calculateCompleteness(graph);
    const domainCoverage = calculateDomainCoverage(graph);

    return NextResponse.json({
      exists: true,
      companyId: graph.companyId,
      companyName: graph.companyName,
      meta: graph.meta,
      stats: {
        completenessScore,
        domainCoverage,
      },
      needsRefresh: {
        overallStatus: needsRefresh.overallStatus,
        totalStaleFields: needsRefresh.totalStaleFields,
        topPriorityFields: needsRefresh.topPriorityFields,
        domains: needsRefresh.domains,
      },
      snapshots,
      // Include the full graph for inspection
      graph,
    });
  } catch (error) {
    console.error('[Dev API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load context graph' },
      { status: 500 }
    );
  }
}
