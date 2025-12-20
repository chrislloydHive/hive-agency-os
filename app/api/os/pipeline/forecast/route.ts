/**
 * GET /api/os/pipeline/forecast
 *
 * Returns pipeline forecast data grouped by:
 * - Forecast bucket (likely/possible/unlikely/dormant)
 * - Time window (next30/days31to90/days91plus/noCloseDate)
 * - Stage
 *
 * Bucket Logic:
 * - Likely: stage in (proposal_submitted, decision) AND dealHealth = on_track
 *           AND nextStepDue exists and is within 21 days
 * - Possible: stage in (solution_shaping, proposal_submitted, decision)
 *             AND dealHealth in (on_track, at_risk)
 * - Unlikely: dealHealth = stalled OR daysSinceLastActivity >= 30 OR nextStep missing
 * - Dormant: stage = dormant (separate bucket)
 *
 * Open opportunities = stage NOT IN (won, lost)
 */

import { NextResponse } from 'next/server';
import { getAllOpportunities } from '@/lib/airtable/opportunities';
import type {
  OpportunityItem,
  PipelineForecastData,
  ForecastBucket,
  ForecastTimeWindow,
  ForecastBucketSummary,
  ForecastTimeWindowBreakdown,
  ForecastStageBreakdown,
  PipelineStage,
} from '@/lib/types/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Calculate days since a date
 */
function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days until a date
 */
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine forecast bucket for an opportunity
 *
 * Bucket rules (applied in order, first match wins):
 * - Dormant: stage = dormant
 * - Likely: stage in (proposal_submitted, decision) AND dealHealth = on_track
 *           AND nextStepDue within 21 days
 * - Unlikely: dealHealth = stalled OR daysSinceActivity >= 30 OR nextStep missing
 * - Possible: stage in (solution_shaping, proposal_submitted, decision)
 *             AND dealHealth in (on_track, at_risk)
 * - Default to unlikely
 */
function determineBucket(opp: OpportunityItem): ForecastBucket {
  const stage = opp.stage;
  const dealHealth = opp.dealHealth;
  const daysSinceActivity = daysSince(opp.lastActivityAt);
  const daysUntilDue = daysUntil(opp.nextStepDue);
  const hasNextStep = !!opp.nextStep?.trim();

  // Dormant bucket
  if (stage === 'dormant') {
    return 'dormant';
  }

  // Unlikely: dealHealth = stalled OR daysSinceActivity >= 30 OR nextStep missing
  if (
    dealHealth === 'stalled' ||
    (daysSinceActivity !== null && daysSinceActivity >= 30) ||
    !hasNextStep
  ) {
    return 'unlikely';
  }

  // Likely: late-stage + on_track + nextStepDue within 21 days
  const lateStages: (PipelineStage | 'other')[] = ['proposal_submitted', 'decision'];
  if (
    lateStages.includes(stage) &&
    dealHealth === 'on_track' &&
    daysUntilDue !== null &&
    daysUntilDue >= 0 &&
    daysUntilDue <= 21
  ) {
    return 'likely';
  }

  // Possible: mid-to-late stage + healthy-ish
  const midLateStages: (PipelineStage | 'other')[] = ['solution_shaping', 'proposal_submitted', 'decision'];
  if (
    midLateStages.includes(stage) &&
    (dealHealth === 'on_track' || dealHealth === 'at_risk')
  ) {
    return 'possible';
  }

  // Default to unlikely
  return 'unlikely';
}

/**
 * Determine time window based on close date
 */
function determineTimeWindow(closeDate: string | null | undefined): ForecastTimeWindow {
  if (!closeDate) return 'noCloseDate';

  const daysToClose = daysUntil(closeDate);
  if (daysToClose === null) return 'noCloseDate';

  if (daysToClose <= 30) return 'next30';
  if (daysToClose <= 90) return 'days31to90';
  return 'days91plus';
}

export async function GET() {
  try {
    const opportunities = await getAllOpportunities();

    // Filter to open opportunities (not won, not lost)
    const openOpps = opportunities.filter(
      (opp) => opp.stage !== 'won' && opp.stage !== 'lost'
    );

    // Separate dormant from truly open
    const dormantOpps = openOpps.filter((opp) => opp.stage === 'dormant');
    const activeOpenOpps = openOpps.filter((opp) => opp.stage !== 'dormant');

    // Initialize bucket accumulators
    const bucketMap: Record<ForecastBucket, { count: number; totalValue: number; ids: string[] }> = {
      likely: { count: 0, totalValue: 0, ids: [] },
      possible: { count: 0, totalValue: 0, ids: [] },
      unlikely: { count: 0, totalValue: 0, ids: [] },
      dormant: { count: 0, totalValue: 0, ids: [] },
    };

    // Initialize time window accumulators
    const timeWindowMap: Record<ForecastTimeWindow, { count: number; totalValue: number }> = {
      next30: { count: 0, totalValue: 0 },
      days31to90: { count: 0, totalValue: 0 },
      days91plus: { count: 0, totalValue: 0 },
      noCloseDate: { count: 0, totalValue: 0 },
    };

    // Initialize stage breakdown accumulator
    const stageBreakdownMap: Map<string, ForecastStageBreakdown> = new Map();

    // Process active open opportunities
    let totalOpenValue = 0;
    let totalOpenCount = 0;

    for (const opp of activeOpenOpps) {
      const bucket = determineBucket(opp);
      const timeWindow = determineTimeWindow(opp.closeDate);
      const value = opp.value || 0;

      totalOpenValue += value;
      totalOpenCount += 1;

      // Update bucket
      bucketMap[bucket].count += 1;
      bucketMap[bucket].totalValue += value;
      bucketMap[bucket].ids.push(opp.id);

      // Update time window
      timeWindowMap[timeWindow].count += 1;
      timeWindowMap[timeWindow].totalValue += value;

      // Update stage breakdown
      const stageKey = `${opp.stage}:${bucket}`;
      if (!stageBreakdownMap.has(stageKey)) {
        stageBreakdownMap.set(stageKey, {
          stage: opp.stage,
          bucket,
          count: 0,
          totalValue: 0,
        });
      }
      const stageBucket = stageBreakdownMap.get(stageKey)!;
      stageBucket.count += 1;
      stageBucket.totalValue += value;
    }

    // Process dormant opportunities
    for (const opp of dormantOpps) {
      const value = opp.value || 0;
      bucketMap.dormant.count += 1;
      bucketMap.dormant.totalValue += value;
      bucketMap.dormant.ids.push(opp.id);
    }

    // Build response
    const buckets: ForecastBucketSummary[] = (['likely', 'possible', 'unlikely'] as ForecastBucket[]).map(
      (bucket) => ({
        bucket,
        count: bucketMap[bucket].count,
        totalValue: bucketMap[bucket].totalValue,
        opportunityIds: bucketMap[bucket].ids,
      })
    );

    const byTimeWindow: ForecastTimeWindowBreakdown[] = (
      ['next30', 'days31to90', 'days91plus', 'noCloseDate'] as ForecastTimeWindow[]
    ).map((tw) => ({
      timeWindow: tw,
      count: timeWindowMap[tw].count,
      totalValue: timeWindowMap[tw].totalValue,
    }));

    const byStage: ForecastStageBreakdown[] = Array.from(stageBreakdownMap.values()).sort(
      (a, b) => b.totalValue - a.totalValue
    );

    const forecastData: PipelineForecastData = {
      totalOpenValue,
      totalOpenCount,
      buckets,
      byTimeWindow,
      byStage,
      dormant: {
        count: bucketMap.dormant.count,
        totalValue: bucketMap.dormant.totalValue,
        opportunityIds: bucketMap.dormant.ids,
      },
    };

    return NextResponse.json({
      ok: true,
      forecast: forecastData,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Forecast API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
