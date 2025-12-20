/**
 * GET /api/os/pipeline/alerts
 *
 * Returns pipeline alerts for opportunities that need attention:
 * - Overdue Next Steps: nextStepDue < today (open stages only)
 * - Stalled Deals: dealHealth = "Stalled" OR daysSinceLastActivity >= 30 OR nextStep missing
 * - RFP Due Soon: opportunityType contains "RFP" AND rfpDueDate within next 14 days
 *
 * Read-only aggregation, no writes.
 */

import { NextResponse } from 'next/server';
import { getAllOpportunities } from '@/lib/airtable/opportunities';
import type {
  OpportunityItem,
  PipelineAlertsData,
  PipelineAlertSummary,
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
 * Check if opportunity is in an open stage (not won/lost/dormant)
 */
function isOpenStage(stage: string): boolean {
  return !['won', 'lost', 'dormant'].includes(stage);
}

/**
 * Check if opportunity has overdue next step
 */
function isOverdueNextStep(opp: OpportunityItem): boolean {
  if (!isOpenStage(opp.stage)) return false;
  if (!opp.nextStepDue) return false;
  const daysUntilDue = daysUntil(opp.nextStepDue);
  return daysUntilDue !== null && daysUntilDue < 0;
}

/**
 * Check if opportunity is stalled
 * - dealHealth = "stalled" OR
 * - daysSinceLastActivity >= 30 OR
 * - nextStep missing
 */
function isStalled(opp: OpportunityItem): boolean {
  if (!isOpenStage(opp.stage)) return false;

  // Explicitly stalled
  if (opp.dealHealth === 'stalled') return true;

  // Inactive for 30+ days
  const daysSinceActivity = daysSince(opp.lastActivityAt);
  if (daysSinceActivity !== null && daysSinceActivity >= 30) return true;

  // Missing next step
  if (!opp.nextStep?.trim()) return true;

  return false;
}

/**
 * Check if RFP is due soon (within 14 days)
 */
function isRfpDueSoon(opp: OpportunityItem): boolean {
  if (!isOpenStage(opp.stage)) return false;

  // Check if it's an RFP opportunity (case-insensitive)
  const isRfp = opp.opportunityType?.toLowerCase().includes('rfp');
  if (!isRfp) return false;

  // Check if rfpDueDate is within next 14 days
  if (!opp.rfpDueDate) return false;
  const daysUntilDue = daysUntil(opp.rfpDueDate);
  return daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 14;
}

/**
 * Aggregate opportunities into an alert summary
 */
function aggregateAlert(opps: OpportunityItem[]): PipelineAlertSummary {
  return {
    count: opps.length,
    totalValue: opps.reduce((sum, opp) => sum + (opp.value || 0), 0),
    opportunityIds: opps.map((opp) => opp.id),
  };
}

export async function GET() {
  try {
    const opportunities = await getAllOpportunities();

    // Filter into alert categories
    const overdueOpps = opportunities.filter(isOverdueNextStep);
    const stalledOpps = opportunities.filter(isStalled);
    const rfpDueSoonOpps = opportunities.filter(isRfpDueSoon);

    const alertsData: PipelineAlertsData = {
      overdueNextSteps: aggregateAlert(overdueOpps),
      stalledDeals: aggregateAlert(stalledOpps),
      rfpDueSoon: aggregateAlert(rfpDueSoonOpps),
    };

    return NextResponse.json({
      ok: true,
      alerts: alertsData,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Alerts API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
