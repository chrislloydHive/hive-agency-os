// app/api/os/companies/[companyId]/projects/[projectId]/strategy/route.ts
// Project Strategy API - Get and update project strategy

import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/os/projects';
import {
  getProjectStrategyByProjectId,
  updateProjectStrategy,
  updateStrategicBets,
} from '@/lib/airtable/projectStrategies';
import { syncBetsStatusToProject } from '@/lib/os/projects';
import { calculateStrategyReadiness } from '@/lib/types/projectStrategy';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; projectId: string }> };

/**
 * GET /api/os/companies/[companyId]/projects/[projectId]/strategy
 * Get project strategy with readiness info
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { companyId, projectId } = await params;

  if (!companyId || !projectId) {
    return NextResponse.json(
      { error: 'Company ID and Project ID are required' },
      { status: 400 }
    );
  }

  try {
    // Verify project exists and belongs to company
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Project does not belong to this company' },
        { status: 403 }
      );
    }

    // Get strategy
    const strategy = await getProjectStrategyByProjectId(projectId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Project strategy not found' },
        { status: 404 }
      );
    }

    // Calculate readiness
    const readiness = calculateStrategyReadiness(strategy);

    return NextResponse.json({
      strategy,
      readiness,
      isLocked: strategy.isLocked,
    });
  } catch (error) {
    console.error('[GET /projects/[projectId]/strategy] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch strategy' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/os/companies/[companyId]/projects/[projectId]/strategy
 * Update project strategy (frame, objectives, bets, tactics)
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const { companyId, projectId } = await params;

  if (!companyId || !projectId) {
    return NextResponse.json(
      { error: 'Company ID and Project ID are required' },
      { status: 400 }
    );
  }

  try {
    // Verify project exists and belongs to company
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Project does not belong to this company' },
        { status: 403 }
      );
    }

    // Get current strategy
    const strategy = await getProjectStrategyByProjectId(projectId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Project strategy not found' },
        { status: 404 }
      );
    }

    // Check if locked
    if (strategy.isLocked) {
      return NextResponse.json(
        { error: 'Strategy is locked and cannot be modified' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { strategicFrame, objectives, strategicBets, tactics } = body;

    // Update strategy
    const updated = await updateProjectStrategy(strategy.id, {
      strategicFrame,
      objectives,
      strategicBets,
      tactics,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update strategy' },
        { status: 500 }
      );
    }

    // Sync bets status to project if bets were updated
    if (strategicBets) {
      await syncBetsStatusToProject(projectId);
    }

    // Calculate new readiness
    const readiness = calculateStrategyReadiness(updated);

    return NextResponse.json({
      success: true,
      strategy: updated,
      readiness,
    });
  } catch (error) {
    console.error('[PUT /projects/[projectId]/strategy] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update strategy' },
      { status: 500 }
    );
  }
}
