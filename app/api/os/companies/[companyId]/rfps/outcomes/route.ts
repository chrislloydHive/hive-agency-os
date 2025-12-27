// app/api/os/companies/[companyId]/rfps/outcomes/route.ts
// RFP Outcome Analysis API
//
// Returns correlation analysis between bid readiness signals and RFP outcomes.

import { NextResponse } from 'next/server';
import { getRfpsForCompany } from '@/lib/airtable/rfp';
import {
  analyzeOutcomes,
  getTopInsights,
  getInsightsByCategory,
  isReadinessPredictive,
  getAnalysisSummary,
  type RfpOutcomeRecord,
} from '@/lib/os/rfp/analyzeOutcomes';
import type { SubmissionSnapshot } from '@/components/os/rfp/SubmissionReadinessModal';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/rfps/outcomes
 * Get outcome correlation analysis for RFPs
 *
 * Query params:
 * - topInsightsLimit?: number (default 5) - Limit for top insights
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const url = new URL(request.url);
    const topInsightsLimit = parseInt(url.searchParams.get('topInsightsLimit') || '5', 10);

    // Fetch all RFPs for the company
    const rfps = await getRfpsForCompany(companyId);

    // Map to RfpOutcomeRecord format
    // Only include RFPs that have been through submission (have snapshot or outcome)
    const outcomeRecords: RfpOutcomeRecord[] = rfps
      .filter(rfp =>
        // Include if has outcome OR has submission snapshot
        rfp.status === 'won' || rfp.status === 'lost' || rfp.submissionSnapshot
      )
      .map(rfp => ({
        id: rfp.id,
        submissionSnapshot: rfp.submissionSnapshot as SubmissionSnapshot | null,
        outcome: rfp.status === 'won' ? 'won' : rfp.status === 'lost' ? 'lost' : null,
        // lossReasonTags would come from rfp.lossReasonTags if it existed
        lossReasonTags: undefined,
      }));

    // Run analysis
    const analysis = analyzeOutcomes(outcomeRecords);

    // Add convenience fields
    const topInsights = getTopInsights(analysis, topInsightsLimit);
    const predictive = isReadinessPredictive(analysis);
    const summary = getAnalysisSummary(analysis);

    // Group insights by category for UI
    const insightsByCategory = {
      score_threshold: getInsightsByCategory(analysis, 'score_threshold'),
      recommendation: getInsightsByCategory(analysis, 'recommendation'),
      acknowledgement: getInsightsByCategory(analysis, 'acknowledgement'),
      risk: getInsightsByCategory(analysis, 'risk'),
    };

    return NextResponse.json({
      analysis,
      topInsights,
      isPredictive: predictive,
      summary,
      insightsByCategory,
      meta: {
        totalRfps: rfps.length,
        analyzedRfps: outcomeRecords.length,
        completeRecords: analysis.completeRecords,
      },
    });
  } catch (error) {
    console.error('[rfp-outcomes] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze RFP outcomes' },
      { status: 500 }
    );
  }
}
