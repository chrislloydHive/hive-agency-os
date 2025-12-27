// app/api/os/rfp/outcomes/analysis/route.ts
// Firm-Scoped RFP Outcome Analysis API
//
// Returns correlation analysis between bid readiness signals and RFP outcomes
// across all companies (institutional learning).

import { NextResponse } from 'next/server';
import {
  listFirmRfpsForOutcomeAnalysis,
  type OutcomeTimeRange,
} from '@/lib/airtable/rfp';
import {
  analyzeOutcomes,
  getTopInsights,
  getInsightsByCategory,
  isReadinessPredictive,
  getAnalysisSummary,
  type RfpOutcomeRecord,
} from '@/lib/os/rfp/analyzeOutcomes';

export const dynamic = 'force-dynamic';

type MinConfidence = 'low' | 'medium' | 'high';

/**
 * Filter insights by minimum confidence
 */
function filterByConfidence<T extends { confidence: 'low' | 'medium' | 'high' }>(
  insights: T[],
  minConfidence: MinConfidence
): T[] {
  const confidenceOrder: Record<MinConfidence, number> = {
    low: 1,
    medium: 2,
    high: 3,
  };
  const minLevel = confidenceOrder[minConfidence];
  return insights.filter(i => confidenceOrder[i.confidence] >= minLevel);
}

/**
 * GET /api/os/rfp/outcomes/analysis
 * Get firm-wide outcome correlation analysis for RFPs
 *
 * Query params:
 * - timeRange?: '90d' | '180d' | '365d' | 'all' (default '365d')
 * - minConfidence?: 'low' | 'medium' | 'high' (default 'low')
 * - topInsightsLimit?: number (default 5)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const timeRange = (url.searchParams.get('timeRange') || '365d') as OutcomeTimeRange;
    const minConfidence = (url.searchParams.get('minConfidence') || 'low') as MinConfidence;
    const topInsightsLimit = parseInt(url.searchParams.get('topInsightsLimit') || '5', 10);

    // Validate timeRange
    if (!['90d', '180d', '365d', 'all'].includes(timeRange)) {
      return NextResponse.json(
        { error: 'Invalid timeRange. Must be one of: 90d, 180d, 365d, all' },
        { status: 400 }
      );
    }

    // Validate minConfidence
    if (!['low', 'medium', 'high'].includes(minConfidence)) {
      return NextResponse.json(
        { error: 'Invalid minConfidence. Must be one of: low, medium, high' },
        { status: 400 }
      );
    }

    // Fetch all RFPs across the firm with outcomes
    const rfps = await listFirmRfpsForOutcomeAnalysis({ timeRange });

    // Map to RfpOutcomeRecord format
    const outcomeRecords: RfpOutcomeRecord[] = rfps.map(rfp => ({
      id: rfp.id,
      submissionSnapshot: rfp.submissionSnapshot,
      outcome: rfp.status,
    }));

    // Run analysis
    const analysis = analyzeOutcomes(outcomeRecords);

    // Get top insights and filter by confidence
    const allTopInsights = getTopInsights(analysis, topInsightsLimit * 2); // Get more to filter
    const topInsights = filterByConfidence(allTopInsights, minConfidence).slice(0, topInsightsLimit);

    const predictive = isReadinessPredictive(analysis);
    const summary = getAnalysisSummary(analysis);

    // Group insights by category and filter by confidence
    const insightsByCategory = {
      score_threshold: filterByConfidence(getInsightsByCategory(analysis, 'score_threshold'), minConfidence),
      recommendation: filterByConfidence(getInsightsByCategory(analysis, 'recommendation'), minConfidence),
      acknowledgement: filterByConfidence(getInsightsByCategory(analysis, 'acknowledgement'), minConfidence),
      risk: filterByConfidence(getInsightsByCategory(analysis, 'risk'), minConfidence),
    };

    return NextResponse.json({
      analysis,
      topInsights,
      isPredictive: predictive,
      summary,
      insightsByCategory,
      meta: {
        sampleSize: analysis.completeRecords,
        timeRange,
        minConfidence,
        totalRfps: rfps.length,
      },
    });
  } catch (error) {
    console.error('[rfp-outcomes-firm] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze firm RFP outcomes' },
      { status: 500 }
    );
  }
}
