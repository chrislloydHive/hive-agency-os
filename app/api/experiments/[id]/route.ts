// app/api/experiments/[id]/route.ts
// API routes for single experiment - get, update, delete

import { NextResponse } from 'next/server';
import {
  getExperiment,
  updateExperiment,
  deleteExperiment,
  type ExperimentStatus,
  type ExperimentOutcome,
} from '@/lib/airtable/experiments';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/experiments/[id]
 * Get a single experiment
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const experiment = await getExperiment(id);

    if (!experiment) {
      return NextResponse.json(
        { ok: false, error: 'Experiment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      experiment,
    });
  } catch (error) {
    console.error('[API Experiments] Error fetching experiment:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch experiment' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/experiments/[id]
 * Update an experiment
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const experiment = await updateExperiment(id, {
      name: body.name,
      hypothesis: body.hypothesis,
      successMetric: body.successMetric,
      expectedLift: body.expectedLift,
      status: body.status as ExperimentStatus,
      results: body.results,
      learnings: body.learnings,
      outcome: body.outcome as ExperimentOutcome,
      startDate: body.startDate,
      endDate: body.endDate,
      notes: body.notes,
    });

    if (!experiment) {
      return NextResponse.json(
        { ok: false, error: 'Failed to update experiment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      experiment,
    });
  } catch (error) {
    console.error('[API Experiments] Error updating experiment:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update experiment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/experiments/[id]
 * Delete an experiment
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const success = await deleteExperiment(id);

    if (!success) {
      return NextResponse.json(
        { ok: false, error: 'Failed to delete experiment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
    });
  } catch (error) {
    console.error('[API Experiments] Error deleting experiment:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to delete experiment' },
      { status: 500 }
    );
  }
}
