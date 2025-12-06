// app/api/os/companies/[companyId]/map/route.ts
// Strategic Map 2.0 API - Returns enriched map data with full metadata
//
// Provides:
// - Complete node metadata (scores, conflicts, criticality)
// - Semantic edge data (styles, strengths)
// - Map-level statistics
// - Insight counts per node

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { buildStrategicMapGraph } from '@/lib/contextGraph/strategicMap';
import { getInsightsForCompany } from '@/lib/insights/repo';
import type { StrategicMapGraph } from '@/lib/contextGraph/strategicMap';

// ============================================================================
// GET Handler - Fetch map data
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    // Load all data in parallel
    const [graph, health, insights] = await Promise.all([
      loadContextGraph(companyId),
      computeContextHealthScore(companyId),
      getInsightsForCompany(companyId).catch(() => []),
    ]);

    if (!graph) {
      return NextResponse.json(
        { error: 'No context graph found', hasData: false },
        { status: 404 }
      );
    }

    // Build the strategic map with full insight data for rich metadata
    const mapGraph = buildStrategicMapGraph(graph, health, insights);

    // Compute insight counts for API response summary
    const insightCounts: Record<string, number> = {};
    for (const node of mapGraph.nodes) {
      if (node.insightCount > 0) {
        insightCounts[node.id] = node.insightCount;
      }
    }

    return NextResponse.json({
      ...mapGraph,
      companyId,
      insights: {
        total: insights.length,
        byNode: insightCounts,
      },
    });

  } catch (error) {
    console.error('[Map API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load map' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Map domain to node suffix
// ============================================================================

function getNodeSuffix(domain: string): string {
  const suffixes: Record<string, string> = {
    identity: 'core',
    audience: 'icp',
    brand: 'positioning',
    productOffer: 'coreOffers',
    competitive: 'landscape',
    website: 'conversionFlow',
    seo: 'overall',
    content: 'strategy',
    media: 'strategy',
    ops: 'analytics',
    objectives: 'primary',
    performanceMedia: 'strategy', // Alias for media
    digitalInfra: 'analytics', // Alias for ops
  };
  return suffixes[domain] || 'core';
}
