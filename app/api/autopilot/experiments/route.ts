// app/api/autopilot/experiments/route.ts
// Manage experiments (create, start, pause, complete)

import { NextRequest, NextResponse } from 'next/server';
import {
  createDetailedExperimentPlan,
  startExperiment,
  pauseExperiment,
  completeExperiment,
  cancelExperiment,
  getActiveExperiments,
  getCompletedExperiments,
  getExperiment,
  storeExperiment,
  analyzeExperimentResults,
} from '@/lib/autopilot/optimizationEngine';
import { loadContextGraph } from '@/lib/contextGraph';
import type { Hypothesis } from '@/lib/autopilot/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      action, // 'create' | 'start' | 'pause' | 'complete' | 'cancel'
      experimentId,
      hypothesis,
      results,
      reason,
      options = {},
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'action is required (create, start, pause, complete, cancel)' },
        { status: 400 }
      );
    }

    // Load company context for create action
    let graph;
    if (action === 'create') {
      graph = await loadContextGraph(companyId);
      if (!graph) {
        return NextResponse.json(
          { error: 'Company context not found' },
          { status: 404 }
        );
      }
    }

    switch (action) {
      case 'create': {
        if (!hypothesis) {
          return NextResponse.json(
            { error: 'hypothesis is required for create action' },
            { status: 400 }
          );
        }

        const experiment = createDetailedExperimentPlan(
          hypothesis as Hypothesis,
          graph!,
          {
            duration: options.duration,
            budgetPercent: options.budgetPercent,
            channels: options.channels,
            testType: options.testType,
          }
        );

        // Store the experiment
        storeExperiment(experiment);

        return NextResponse.json({
          success: true,
          experiment,
        });
      }

      case 'start': {
        if (!experimentId) {
          return NextResponse.json(
            { error: 'experimentId is required for start action' },
            { status: 400 }
          );
        }

        const started = startExperiment(experimentId);
        if (!started) {
          return NextResponse.json(
            { error: 'Experiment not found or not in draft status' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          experiment: started,
        });
      }

      case 'pause': {
        if (!experimentId) {
          return NextResponse.json(
            { error: 'experimentId is required for pause action' },
            { status: 400 }
          );
        }

        const paused = pauseExperiment(experimentId);
        if (!paused) {
          return NextResponse.json(
            { error: 'Experiment not found or not running' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          experiment: paused,
        });
      }

      case 'complete': {
        if (!experimentId) {
          return NextResponse.json(
            { error: 'experimentId is required for complete action' },
            { status: 400 }
          );
        }

        if (!results) {
          return NextResponse.json(
            { error: 'results is required for complete action' },
            { status: 400 }
          );
        }

        const experiment = getExperiment(experimentId);
        if (!experiment) {
          return NextResponse.json(
            { error: 'Experiment not found' },
            { status: 404 }
          );
        }

        // Analyze results
        const analyzedResults = analyzeExperimentResults(experiment, results);

        const completed = completeExperiment(experimentId, analyzedResults);
        if (!completed) {
          return NextResponse.json(
            { error: 'Failed to complete experiment' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          experiment: completed,
        });
      }

      case 'cancel': {
        if (!experimentId) {
          return NextResponse.json(
            { error: 'experimentId is required for cancel action' },
            { status: 400 }
          );
        }

        const cancelled = cancelExperiment(experimentId, reason || 'Cancelled by user');
        if (!cancelled) {
          return NextResponse.json(
            { error: 'Experiment not found' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          experiment: cancelled,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error managing experiment:', error);
    return NextResponse.json(
      { error: 'Failed to manage experiment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const experimentId = searchParams.get('experimentId');
    const status = searchParams.get('status'); // 'active' | 'completed' | 'all'

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Get specific experiment
    if (experimentId) {
      const experiment = getExperiment(experimentId);
      if (!experiment) {
        // Check completed experiments
        const completed = getCompletedExperiments(companyId);
        const found = completed.find(e => e.id === experimentId);
        if (!found) {
          return NextResponse.json(
            { error: 'Experiment not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ experiment: found });
      }
      return NextResponse.json({ experiment });
    }

    // Get experiments by status
    const active = getActiveExperiments(companyId);
    const completed = getCompletedExperiments(companyId);

    if (status === 'active') {
      return NextResponse.json({ experiments: active });
    }

    if (status === 'completed') {
      return NextResponse.json({ experiments: completed });
    }

    // Return all
    return NextResponse.json({
      active,
      completed,
      total: active.length + completed.length,
    });
  } catch (error) {
    console.error('Error fetching experiments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch experiments' },
      { status: 500 }
    );
  }
}
