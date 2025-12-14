// app/api/os/hive-brain/route.ts
// Hive Brain API - Global Context Graph Management
//
// GET: Load the Hive Brain global context graph
// PUT: Update the Hive Brain (human sources only)

import { NextRequest, NextResponse } from 'next/server';
import {
  getHiveGlobalContextGraph,
  updateHiveGlobalContextGraph,
  isValidHiveBrainSource,
  HIVE_GLOBAL_ID,
} from '@/lib/contextGraph/globalGraph';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// GET - Load Hive Brain
// ============================================================================

export async function GET() {
  try {
    const graph = await getHiveGlobalContextGraph();

    return NextResponse.json({
      success: true,
      graph,
    });
  } catch (error) {
    console.error('[HiveBrain API] Error loading Hive Brain:', error);
    return NextResponse.json(
      { error: 'Failed to load Hive Brain' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update Hive Brain
// ============================================================================

interface UpdateRequest {
  graph: CompanyContextGraph;
  source?: string;
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as UpdateRequest;
    const { graph, source = 'manual' } = body;

    // Validate the graph has the correct ID
    if (graph.companyId !== HIVE_GLOBAL_ID) {
      return NextResponse.json(
        { error: 'Invalid graph - must be Hive Global graph' },
        { status: 400 }
      );
    }

    // Validate source is human-only
    if (!isValidHiveBrainSource(source)) {
      return NextResponse.json(
        { error: `Invalid source "${source}" - Hive Brain only accepts human sources (manual, user, brain)` },
        { status: 400 }
      );
    }

    // Update the graph
    const updated = await updateHiveGlobalContextGraph(graph, source as 'manual' | 'user' | 'brain');

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to save Hive Brain' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      graph: updated,
    });
  } catch (error) {
    console.error('[HiveBrain API] Error updating Hive Brain:', error);
    return NextResponse.json(
      { error: 'Failed to update Hive Brain' },
      { status: 500 }
    );
  }
}
