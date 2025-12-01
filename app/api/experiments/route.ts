// app/api/experiments/route.ts
// API routes for experiments - list and create

import { NextResponse } from 'next/server';
import {
  getExperiments,
  createExperiment,
  type ExperimentStatus,
  type ExperimentArea,
  type ExperimentSource,
} from '@/lib/airtable/experiments';

/**
 * GET /api/experiments
 * List experiments with optional filters
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || undefined;
    const statusParam = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let status: ExperimentStatus | ExperimentStatus[] | undefined;
    if (statusParam) {
      if (statusParam.includes(',')) {
        status = statusParam.split(',') as ExperimentStatus[];
      } else {
        status = statusParam as ExperimentStatus;
      }
    }

    const experiments = await getExperiments({ companyId, status, limit });

    return NextResponse.json({
      ok: true,
      experiments,
      count: experiments.length,
    });
  } catch (error) {
    console.error('[API Experiments] Error listing experiments:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch experiments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/experiments
 * Create a new experiment
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { ok: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!body.hypothesis) {
      return NextResponse.json(
        { ok: false, error: 'Hypothesis is required' },
        { status: 400 }
      );
    }

    if (!body.successMetric) {
      return NextResponse.json(
        { ok: false, error: 'Success metric is required' },
        { status: 400 }
      );
    }

    const experiment = await createExperiment({
      name: body.name,
      companyId: body.companyId,
      hypothesis: body.hypothesis,
      successMetric: body.successMetric,
      expectedLift: body.expectedLift,
      status: body.status as ExperimentStatus,
      area: body.area as ExperimentArea,
      source: body.source as ExperimentSource,
      sourceJson: body.sourceJson,
      notes: body.notes,
    });

    if (!experiment) {
      return NextResponse.json(
        { ok: false, error: 'Failed to create experiment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      experiment,
    });
  } catch (error) {
    console.error('[API Experiments] Error creating experiment:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create experiment' },
      { status: 500 }
    );
  }
}
