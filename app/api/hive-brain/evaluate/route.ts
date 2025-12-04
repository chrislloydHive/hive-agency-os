// app/api/hive-brain/evaluate/route.ts
// Hive Brain Meta-Evaluation API
//
// Endpoints:
// GET /api/hive-brain/evaluate - Get evaluation stats
// POST /api/hive-brain/evaluate - Record predictions/decisions or run evaluation

import { NextRequest, NextResponse } from 'next/server';
import {
  recordPrediction,
  evaluatePrediction,
  getPredictionAccuracy,
  recordDecision,
  rateDecision,
  getAutopilotQuality,
  recordPlaybookUsage,
  getPlaybookEffectiveness,
  runMetaEvaluation,
  getTrackingStats,
} from '@/lib/hiveBrain';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'predictionAccuracy': {
        const accuracy = getPredictionAccuracy();
        return NextResponse.json(accuracy);
      }

      case 'autopilotQuality': {
        const quality = getAutopilotQuality();
        return NextResponse.json(quality);
      }

      case 'playbookEffectiveness': {
        const effectiveness = getPlaybookEffectiveness();
        return NextResponse.json(effectiveness);
      }

      case 'stats': {
        const stats = getTrackingStats();
        return NextResponse.json(stats);
      }

      default: {
        // Return all stats
        return NextResponse.json({
          predictionAccuracy: getPredictionAccuracy(),
          autopilotQuality: getAutopilotQuality(),
          playbookEffectiveness: getPlaybookEffectiveness(),
          trackingStats: getTrackingStats(),
        });
      }
    }
  } catch (error) {
    console.error('Hive Brain evaluate GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get evaluation stats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body as { action: string };

    switch (action) {
      case 'recordPrediction': {
        const { prediction } = body as {
          prediction: {
            evaluateAfter: string;
            companyId?: string;
            verticalId?: string;
            metric: string;
            predictedValue: number;
            confidence: number;
            reasoning: string;
          };
        };

        if (!prediction?.metric || prediction?.predictedValue === undefined) {
          return NextResponse.json(
            { error: 'prediction.metric and prediction.predictedValue required' },
            { status: 400 }
          );
        }

        const recorded = recordPrediction(prediction);
        return NextResponse.json(recorded);
      }

      case 'evaluatePrediction': {
        const { predictionId, actualValue } = body as {
          predictionId: string;
          actualValue: number;
        };

        if (!predictionId || actualValue === undefined) {
          return NextResponse.json(
            { error: 'predictionId and actualValue required' },
            { status: 400 }
          );
        }

        const result = evaluatePrediction(predictionId, actualValue);
        if (!result) {
          return NextResponse.json(
            { error: 'Prediction not found' },
            { status: 404 }
          );
        }

        return NextResponse.json(result);
      }

      case 'recordDecision': {
        const { decision } = body as {
          decision: {
            companyId: string;
            decisionType: 'budget' | 'creative' | 'targeting' | 'bidding' | 'pause' | 'other';
            description: string;
            expectedOutcome: string;
          };
        };

        if (!decision?.companyId || !decision?.description) {
          return NextResponse.json(
            { error: 'decision.companyId and decision.description required' },
            { status: 400 }
          );
        }

        const recorded = recordDecision(decision);
        return NextResponse.json(recorded);
      }

      case 'rateDecision': {
        const { decisionId, actualOutcome, qualityRating, reasoning } = body as {
          decisionId: string;
          actualOutcome: string;
          qualityRating: -1 | 0 | 1;
          reasoning: string;
        };

        if (!decisionId || qualityRating === undefined) {
          return NextResponse.json(
            { error: 'decisionId and qualityRating required' },
            { status: 400 }
          );
        }

        const result = rateDecision(
          decisionId,
          actualOutcome,
          qualityRating,
          reasoning
        );

        if (!result) {
          return NextResponse.json(
            { error: 'Decision not found' },
            { status: 404 }
          );
        }

        return NextResponse.json(result);
      }

      case 'recordPlaybookUsage': {
        const { playbookId, verticalId, followed, positiveOutcome } = body as {
          playbookId: string;
          verticalId: string;
          followed: boolean;
          positiveOutcome: boolean;
        };

        if (!playbookId || !verticalId || followed === undefined || positiveOutcome === undefined) {
          return NextResponse.json(
            { error: 'playbookId, verticalId, followed, and positiveOutcome required' },
            { status: 400 }
          );
        }

        recordPlaybookUsage(playbookId, verticalId, followed, positiveOutcome);
        return NextResponse.json({ success: true });
      }

      case 'runEvaluation': {
        const { periodStart, periodEnd } = body as {
          periodStart: string;
          periodEnd: string;
        };

        if (!periodStart || !periodEnd) {
          return NextResponse.json(
            { error: 'periodStart and periodEnd required' },
            { status: 400 }
          );
        }

        const evaluation = runMetaEvaluation(periodStart, periodEnd);
        return NextResponse.json(evaluation);
      }

      default: {
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Hive Brain evaluate POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process evaluation request' },
      { status: 500 }
    );
  }
}
