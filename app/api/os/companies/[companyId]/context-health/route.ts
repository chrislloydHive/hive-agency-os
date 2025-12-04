// app/api/os/companies/[companyId]/context-health/route.ts
// Context Graph Health API endpoint
//
// GET /api/os/companies/[companyId]/context-health
// Returns the health/completeness status of a company's context graph

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { calculateCompleteness, calculateDomainCoverage } from '@/lib/contextGraph/companyContextGraph';
import { getStaleFields } from '@/lib/contextGraph/freshness';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import {
  computeContextHealthScoreFromCompleteness,
  convertNeedsRefreshReport,
  getHealthStatus,
} from '@/lib/contextGraph/contextHealth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    console.log('[API] Context health request for company:', companyId);

    // Load the context graph
    const graph = await loadContextGraph(companyId);

    if (!graph) {
      return NextResponse.json(
        { error: 'Context graph not found' },
        { status: 404 }
      );
    }

    // Calculate completeness and coverage
    const completenessScore = calculateCompleteness(graph);
    const domainCoverage = calculateDomainCoverage(graph);

    // Get stale fields
    const staleFields = getStaleFields(graph);

    // Get needs-refresh report for freshness info
    const refreshReport = getNeedsRefreshReport(graph);
    const needsRefreshFlags = convertNeedsRefreshReport(refreshReport);

    // Health score is now based on completeness (more intuitive for users)
    const healthScore = computeContextHealthScoreFromCompleteness(completenessScore);
    const healthStatus = getHealthStatus(healthScore);

    // Build response
    const healthData = {
      completenessScore,
      domainCoverage,
      lastUpdated: graph.meta.updatedAt,
      lastFusionAt: graph.meta.lastFusionAt,
      fieldCount: {
        total: Object.keys(domainCoverage).length * 10, // Approximate
        populated: Math.round((completenessScore / 100) * Object.keys(domainCoverage).length * 10),
      },
      staleFields: staleFields.length,
      staleFieldPaths: staleFields.slice(0, 10).map(f => f.path),
      // New fields from contextHealth module
      healthScore,
      healthStatus,
      needsRefresh: needsRefreshFlags.slice(0, 10),
    };

    console.log('[API] Context health:', {
      companyId,
      completeness: completenessScore,
      healthScore,
      healthStatus,
      stale: staleFields.length,
    });

    return NextResponse.json(healthData);
  } catch (error) {
    console.error('[API] Context health error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
