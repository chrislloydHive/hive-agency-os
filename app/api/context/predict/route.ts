// app/api/context/predict/route.ts
// Predictive inference API for context graph fields
//
// Phase 4: Probabilistic inference engine

import { NextRequest, NextResponse } from 'next/server';
import {
  generatePredictions,
  predictFieldValue,
  predictFutureChanges,
  detectEvolutionPatterns,
} from '@/lib/contextGraph/predictive';
import { loadContextGraphRecord } from '@/lib/contextGraph/storage';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

export const runtime = 'nodejs';

/**
 * POST /api/context/predict
 *
 * Generate predictions for empty or stale fields.
 *
 * Body:
 * - companyId: Company ID
 * - mode: 'fill_empty' | 'predict_changes' | 'detect_patterns' | 'field_value'
 * - domain?: Target domain (for field_value mode)
 * - path?: Target field path (for field_value mode)
 * - limit?: Max predictions to return
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      mode = 'fill_empty',
      domain,
      path,
      limit = 10,
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Get company context graph
    const graphRecord = await loadContextGraphRecord(companyId);
    if (!graphRecord) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    let result: Record<string, unknown>;

    switch (mode) {
      case 'fill_empty':
        // Generate predictions for empty fields
        const predictionResult = await generatePredictions(graphRecord.graph, {
          companyId,
          predictAll: true,
          maxPredictions: limit,
        });
        result = {
          predictions: predictionResult.predictions,
          totalPredictions: predictionResult.predictionsGenerated,
          averageConfidence: predictionResult.averageConfidence,
        };
        break;

      case 'field_value':
        // Predict a specific field value
        if (!path) {
          return NextResponse.json(
            { error: 'path is required for field_value mode' },
            { status: 400 }
          );
        }
        const fieldPrediction = await predictFieldValue(graphRecord.graph, path);
        result = { prediction: fieldPrediction };
        break;

      case 'predict_changes':
        // Predict future field changes
        const targetDomains = domain ? [domain as DomainName] : undefined;
        const futureChanges = await predictFutureChanges(graphRecord.graph, targetDomains);
        result = {
          predictions: futureChanges.slice(0, limit),
          totalPredictions: futureChanges.length,
        };
        break;

      case 'detect_patterns':
        // Detect evolution patterns
        const patterns = await detectEvolutionPatterns(companyId, graphRecord.graph);
        result = {
          patterns: patterns.slice(0, limit),
          totalPatterns: patterns.length,
        };
        break;

      default:
        return NextResponse.json(
          { error: `Invalid mode: ${mode}. Use fill_empty, field_value, predict_changes, or detect_patterns` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      ...result,
      mode,
      companyId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[predict] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/context/predict
 *
 * Get prediction methods and capabilities.
 */
export async function GET() {
  return NextResponse.json({
    modes: [
      {
        mode: 'fill_empty',
        description: 'Generate predictions for empty fields',
        requiredParams: ['companyId'],
        optionalParams: ['limit'],
      },
      {
        mode: 'field_value',
        description: 'Predict a specific field value',
        requiredParams: ['companyId', 'path'],
      },
      {
        mode: 'predict_changes',
        description: 'Predict which fields will change soon',
        requiredParams: ['companyId'],
        optionalParams: ['limit', 'domain'],
      },
      {
        mode: 'detect_patterns',
        description: 'Detect evolution patterns in field changes',
        requiredParams: ['companyId'],
        optionalParams: ['limit'],
      },
    ],
    predictionMethods: [
      { method: 'historical_pattern', description: 'Based on historical changes' },
      { method: 'similar_company', description: 'From similar companies' },
      { method: 'domain_prior', description: 'Industry/domain defaults' },
      { method: 'cross_field_inference', description: 'Inferred from related fields' },
      { method: 'ai_synthesis', description: 'AI-generated prediction' },
    ],
  });
}
