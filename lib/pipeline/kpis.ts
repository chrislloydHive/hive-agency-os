// lib/pipeline/kpis.ts
// KPI computation for Pipeline Dashboard

import type { OpportunityItem, InboundLeadItem, PipelineKpis } from '@/lib/types/pipeline';
import { ACTIVE_STAGES, getStageLabel } from '@/lib/types/pipeline';
import { parseISO, format } from 'date-fns';

/**
 * Compute all pipeline KPIs from opportunities and leads data
 */
export function computePipelineKpis(
  opportunities: OpportunityItem[],
  leads: InboundLeadItem[]
): PipelineKpis {
  let totalPipelineValue = 0;
  const stageMap: Record<string, { count: number; value: number }> = {};
  const ownerMap: Record<string, { count: number; value: number }> = {};
  const leadsStatusMap: Record<string, number> = {};
  const monthMap: Record<string, number> = {};

  // Process opportunities
  for (const opp of opportunities) {
    const val = opp.value ?? 0;

    // Only count active opportunities for pipeline value
    if (ACTIVE_STAGES.includes(opp.stage as any)) {
      totalPipelineValue += val;
    }

    // Stage breakdown - use display label
    const stageKey = getStageLabel(opp.stage);
    if (!stageMap[stageKey]) stageMap[stageKey] = { count: 0, value: 0 };
    stageMap[stageKey].count += 1;
    stageMap[stageKey].value += val;

    // Owner breakdown
    const ownerKey = opp.owner ?? 'Unassigned';
    if (!ownerMap[ownerKey]) ownerMap[ownerKey] = { count: 0, value: 0 };
    ownerMap[ownerKey].count += 1;
    ownerMap[ownerKey].value += val;

    // Monthly breakdown by close date
    if (opp.closeDate) {
      try {
        const d = parseISO(opp.closeDate);
        const monthKey = format(d, 'yyyy-MM');
        monthMap[monthKey] = (monthMap[monthKey] ?? 0) + val;
      } catch {
        // Ignore invalid dates
      }
    }
  }

  // Process leads by status
  for (const lead of leads) {
    const statusKey = lead.status || 'Unknown';
    leadsStatusMap[statusKey] = (leadsStatusMap[statusKey] ?? 0) + 1;
  }

  // Sort and format results
  const opportunitiesByStage = Object.entries(stageMap)
    .map(([stage, v]) => ({
      stage,
      count: v.count,
      value: v.value,
    }))
    .sort((a, b) => {
      // Custom sort order for stages
      const order = ['Discovery', 'Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Other'];
      return order.indexOf(a.stage) - order.indexOf(b.stage);
    });

  const opportunitiesByOwner = Object.entries(ownerMap)
    .map(([owner, v]) => ({
      owner,
      count: v.count,
      value: v.value,
    }))
    .sort((a, b) => b.value - a.value); // Sort by value descending

  const leadsByStatus = Object.entries(leadsStatusMap)
    .map(([status, count]) => ({
      status,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const pipelineByMonth = Object.entries(monthMap)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, value]) => ({
      month: formatMonthLabel(month),
      value,
    }));

  return {
    totalPipelineValue,
    openOpportunitiesCount: opportunities.filter(o =>
      ACTIVE_STAGES.includes(o.stage as any)
    ).length,
    opportunitiesByStage,
    opportunitiesByOwner,
    leadsByStatus,
    pipelineByMonth,
  };
}

/**
 * Format month key (yyyy-MM) to display label (Jan 2024)
 */
function formatMonthLabel(monthKey: string): string {
  try {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, 'MMM yyyy');
  } catch {
    return monthKey;
  }
}

/**
 * Calculate win rate from opportunities
 */
export function calculateWinRate(opportunities: OpportunityItem[]): number {
  const closed = opportunities.filter(
    o => o.stage === 'won' || o.stage === 'lost'
  );
  if (closed.length === 0) return 0;

  const won = opportunities.filter(o => o.stage === 'won').length;
  return (won / closed.length) * 100;
}

/**
 * Calculate average deal size
 */
export function calculateAverageDealSize(opportunities: OpportunityItem[]): number {
  const withValue = opportunities.filter(o => o.value && o.value > 0);
  if (withValue.length === 0) return 0;

  const total = withValue.reduce((sum, o) => sum + (o.value ?? 0), 0);
  return total / withValue.length;
}

/**
 * Calculate conversion rate from leads to opportunities
 */
export function calculateLeadConversionRate(
  leads: InboundLeadItem[],
  opportunities: OpportunityItem[]
): number {
  if (leads.length === 0) return 0;

  // Count leads that have been converted (have a companyId that matches an opportunity)
  const convertedLeads = leads.filter(lead =>
    lead.companyId && opportunities.some(opp => opp.companyId === lead.companyId)
  );

  return (convertedLeads.length / leads.length) * 100;
}
