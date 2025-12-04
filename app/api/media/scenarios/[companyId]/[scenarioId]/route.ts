// app/api/media/scenarios/[companyId]/[scenarioId]/route.ts
// API routes for individual scenario operations
//
// GET /api/media/scenarios/[companyId]/[scenarioId] - Get scenario details
// PATCH /api/media/scenarios/[companyId]/[scenarioId] - Update scenario
// DELETE /api/media/scenarios/[companyId]/[scenarioId] - Delete scenario

import { NextRequest, NextResponse } from 'next/server';
import {
  getMediaScenarioById,
  updateMediaScenario,
  deleteMediaScenario,
  duplicateMediaScenario,
  setRecommendedScenario,
} from '@/lib/media/scenarios';
import type { UpdateMediaScenarioInput } from '@/lib/media/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; scenarioId: string }> }
) {
  const { companyId, scenarioId } = await params;

  if (!companyId || !scenarioId) {
    return NextResponse.json({ error: 'Company ID and Scenario ID required' }, { status: 400 });
  }

  try {
    const scenario = await getMediaScenarioById(companyId, scenarioId);
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }
    return NextResponse.json({ scenario });
  } catch (error) {
    console.error('Error fetching scenario:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scenario' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; scenarioId: string }> }
) {
  const { companyId, scenarioId } = await params;

  if (!companyId || !scenarioId) {
    return NextResponse.json({ error: 'Company ID and Scenario ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Handle special actions
    if (body.action === 'duplicate') {
      const duplicated = await duplicateMediaScenario(companyId, scenarioId, body.name);
      return NextResponse.json({ scenario: duplicated });
    }

    if (body.action === 'setRecommended') {
      await setRecommendedScenario(companyId, body.recommended ? scenarioId : null);
      const updated = await getMediaScenarioById(companyId, scenarioId);
      return NextResponse.json({ scenario: updated });
    }

    // Regular update
    const patch: UpdateMediaScenarioInput = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.timeHorizon !== undefined) patch.timeHorizon = body.timeHorizon;
    if (body.periodLabel !== undefined) patch.periodLabel = body.periodLabel;
    if (body.totalBudget !== undefined) patch.totalBudget = body.totalBudget;
    if (body.allocations !== undefined) patch.allocations = body.allocations;
    if (body.goal !== undefined) patch.goal = body.goal;
    if (body.forecastSummary !== undefined) patch.forecastSummary = body.forecastSummary;

    const scenario = await updateMediaScenario(companyId, scenarioId, patch);
    return NextResponse.json({ scenario });
  } catch (error) {
    console.error('Error updating scenario:', error);
    return NextResponse.json(
      { error: 'Failed to update scenario' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; scenarioId: string }> }
) {
  const { companyId, scenarioId } = await params;

  if (!companyId || !scenarioId) {
    return NextResponse.json({ error: 'Company ID and Scenario ID required' }, { status: 400 });
  }

  try {
    await deleteMediaScenario(companyId, scenarioId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    return NextResponse.json(
      { error: 'Failed to delete scenario' },
      { status: 500 }
    );
  }
}
