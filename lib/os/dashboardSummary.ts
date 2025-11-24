// lib/os/dashboardSummary.ts
// Dashboard Summary helper for the "Today View" in Hive OS
// Aggregates data from Companies, GAP runs, Work Items, Pipeline, and Growth Analytics

import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { listRecentGapIaRuns } from '@/lib/airtable/gapIaRuns';
import { listRecentGapPlanRuns } from '@/lib/airtable/gapPlanRuns';
import { base } from '@/lib/airtable/client';
import { getDefaultDateRange, getGrowthAnalyticsSnapshot } from '@/lib/analytics/growthAnalytics';

// ============================================================================
// Types
// ============================================================================

export type DashboardClientHealth = {
  atRisk: Array<{
    companyId: string;
    name: string;
    domain?: string;
    reason: string;
    stage: string;
    owner?: string | null;
  }>;
  newClients: Array<{
    companyId: string;
    name: string;
    stage: string;
    createdAt: string;
  }>;
};

export type DashboardWorkSummary = {
  today: number;
  overdue: number;
  mineToday: number;
  items: Array<{
    id: string;
    title: string;
    companyId?: string;
    companyName?: string;
    dueDate?: string;
    status: string;
    owner?: string | null;
  }>;
};

export type DashboardPipelineSummary = {
  newLeads30d: number;
  activeOpportunities: number;
  pipelineValue?: number | null;
  byStage: Array<{
    stage: string;
    count: number;
    value?: number | null;
  }>;
};

export type DashboardGrowthSummary = {
  sessions30d: number | null;
  users30d: number | null;
  dmaAuditsStarted30d: number | null;
  searchClicks30d: number | null;
};

export type DashboardSummary = {
  companiesCount: number;
  gapAssessments30d: number;
  gapPlans30d: number;

  clientHealth: DashboardClientHealth;
  work: DashboardWorkSummary;
  pipeline: DashboardPipelineSummary;
  growth: DashboardGrowthSummary;

  recentGap: {
    assessments: Array<{
      id: string;
      companyId?: string;
      companyName?: string;
      domain?: string;
      score?: number | null;
      createdAt: string;
    }>;
    plans: Array<{
      id: string;
      companyId?: string;
      companyName?: string;
      theme?: string | null;
      createdAt: string;
      status?: string | null;
    }>;
  };
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a date is within the last N days
 */
function isWithinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

/**
 * Check if a date is today
 */
function isToday(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Check if a date is in the past
 */
function isPast(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Build at-risk heuristics for companies
 * - Client with no active plan
 * - Client with no GAP in last 90 days
 * - Client with overdue work items
 */
function buildAtRiskClients(
  companies: CompanyRecord[],
  gapIaRuns: any[],
  gapPlanRuns: any[],
  workItems: any[]
): DashboardClientHealth['atRisk'] {
  const atRisk: DashboardClientHealth['atRisk'] = [];

  // Build lookup maps
  const companiesWithRecentGap = new Set<string>();
  const companiesWithRecentPlan = new Set<string>();
  const companiesWithOverdueWork = new Set<string>();

  // Check recent GAP assessments (last 90 days)
  for (const run of gapIaRuns) {
    if (run.companyId && isWithinDays(run.createdAt, 90)) {
      companiesWithRecentGap.add(run.companyId);
    }
  }

  // Check recent plans
  for (const plan of gapPlanRuns) {
    if (plan.companyId && isWithinDays(plan.createdAt, 90)) {
      companiesWithRecentPlan.add(plan.companyId);
    }
  }

  // Check overdue work items
  for (const item of workItems) {
    if (item.companyId && item.dueDate && isPast(item.dueDate) && item.status !== 'Done') {
      companiesWithOverdueWork.add(item.companyId);
    }
  }

  // Evaluate each Client-stage company
  for (const company of companies) {
    if (company.stage !== 'Client') continue;

    const reasons: string[] = [];

    if (!companiesWithRecentGap.has(company.id)) {
      reasons.push('No GAP in last 90 days');
    }

    if (!companiesWithRecentPlan.has(company.id)) {
      reasons.push('No active plan');
    }

    if (companiesWithOverdueWork.has(company.id)) {
      reasons.push('Overdue work items');
    }

    if (reasons.length > 0) {
      atRisk.push({
        companyId: company.id,
        name: company.name,
        domain: company.domain,
        reason: reasons[0], // Primary reason
        stage: company.stage,
        owner: company.owner,
      });
    }
  }

  return atRisk.slice(0, 5); // Limit to top 5
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get comprehensive dashboard summary for Today View
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  console.log('[Dashboard] Fetching dashboard summary...');

  try {
    // Fetch all data in parallel
    const [
      companies,
      gapIaRuns,
      gapPlanRuns,
      workItemsRaw,
      // Pipeline data
      leadsRaw,
      opportunitiesRaw,
    ] = await Promise.all([
      getAllCompanies(),
      listRecentGapIaRuns(50),
      listRecentGapPlanRuns(50),
      fetchWorkItems(),
      fetchLeads(),
      fetchOpportunities(),
    ]);

    // Growth analytics - fetch separately to handle errors gracefully
    let growthData: DashboardGrowthSummary = {
      sessions30d: null,
      users30d: null,
      dmaAuditsStarted30d: null,
      searchClicks30d: null,
    };

    try {
      const { startDate, endDate } = getDefaultDateRange(30);
      const snapshot = await getGrowthAnalyticsSnapshot(startDate, endDate);
      growthData = {
        sessions30d: snapshot.traffic.sessions,
        users30d: snapshot.traffic.users,
        dmaAuditsStarted30d: null, // TODO: Add DMA audit tracking
        searchClicks30d: snapshot.searchQueries.reduce((sum, q) => sum + q.clicks, 0) || null,
      };
    } catch (error) {
      console.warn('[Dashboard] Growth analytics unavailable:', error);
    }

    // Build company lookup
    const companyLookup = new Map<string, CompanyRecord>();
    for (const company of companies) {
      companyLookup.set(company.id, company);
    }

    // Filter data for last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const assessments30d = gapIaRuns.filter(
      (r) => r.createdAt && new Date(r.createdAt) >= thirtyDaysAgo
    );
    const plans30d = gapPlanRuns.filter(
      (r) => r.createdAt && new Date(r.createdAt) >= thirtyDaysAgo
    );

    // New clients (last 7 days)
    const newClients = companies
      .filter(
        (c) =>
          c.stage === 'Client' &&
          c.createdAt &&
          isWithinDays(c.createdAt, 7)
      )
      .map((c) => ({
        companyId: c.id,
        name: c.name,
        stage: c.stage || 'Unknown',
        createdAt: c.createdAt || '',
      }))
      .slice(0, 5);

    // At-risk clients
    const atRiskClients = buildAtRiskClients(
      companies,
      gapIaRuns,
      gapPlanRuns,
      workItemsRaw
    );

    // Work items
    const workDueToday = workItemsRaw.filter(
      (w) => w.status !== 'Done' && isToday(w.dueDate)
    );
    const workOverdue = workItemsRaw.filter(
      (w) => w.status !== 'Done' && isPast(w.dueDate) && !isToday(w.dueDate)
    );

    const workItems = workItemsRaw
      .filter((w) => w.status !== 'Done')
      .slice(0, 5)
      .map((w) => {
        const company = w.companyId ? companyLookup.get(w.companyId) : undefined;
        return {
          id: w.id,
          title: w.title,
          companyId: w.companyId,
          companyName: company?.name,
          dueDate: w.dueDate,
          status: w.status || 'Backlog',
          owner: w.owner,
        };
      });

    // Pipeline data
    const leads30d = leadsRaw.filter(
      (l) => l.createdAt && isWithinDays(l.createdAt, 30)
    );
    const activeOpportunities = opportunitiesRaw.filter(
      (o) => o.stage && !['Won', 'Lost'].includes(o.stage)
    );

    // Group opportunities by stage
    const opportunityStages = new Map<string, { count: number; value: number }>();
    for (const opp of activeOpportunities) {
      const stage = opp.stage || 'Unknown';
      const existing = opportunityStages.get(stage) || { count: 0, value: 0 };
      existing.count++;
      existing.value += opp.value || 0;
      opportunityStages.set(stage, existing);
    }

    const byStage = Array.from(opportunityStages.entries()).map(([stage, data]) => ({
      stage,
      count: data.count,
      value: data.value || null,
    }));

    const totalPipelineValue = activeOpportunities.reduce(
      (sum, o) => sum + (o.value || 0),
      0
    );

    // Recent GAP activity
    const recentAssessments = assessments30d.slice(0, 5).map((r) => {
      const company = r.companyId ? companyLookup.get(r.companyId) : undefined;
      return {
        id: r.id,
        companyId: r.companyId,
        companyName: company?.name,
        domain: r.domain,
        score: r.core?.overallScore || null,
        createdAt: r.createdAt,
      };
    });

    const recentPlans = plans30d.slice(0, 5).map((p) => {
      const company = p.companyId ? companyLookup.get(p.companyId) : undefined;
      return {
        id: p.id,
        companyId: p.companyId,
        companyName: company?.name,
        theme: p.maturityStage || null,
        createdAt: p.createdAt,
        status: p.status,
      };
    });

    const summary: DashboardSummary = {
      companiesCount: companies.length,
      gapAssessments30d: assessments30d.length,
      gapPlans30d: plans30d.length,

      clientHealth: {
        atRisk: atRiskClients,
        newClients,
      },

      work: {
        today: workDueToday.length,
        overdue: workOverdue.length,
        mineToday: 0, // TODO: Filter by current user when auth is available
        items: workItems,
      },

      pipeline: {
        newLeads30d: leads30d.length,
        activeOpportunities: activeOpportunities.length,
        pipelineValue: totalPipelineValue > 0 ? totalPipelineValue : null,
        byStage,
      },

      growth: growthData,

      recentGap: {
        assessments: recentAssessments,
        plans: recentPlans,
      },
    };

    console.log('[Dashboard] Summary generated:', {
      companies: summary.companiesCount,
      assessments30d: summary.gapAssessments30d,
      plans30d: summary.gapPlans30d,
      atRiskCount: summary.clientHealth.atRisk.length,
      workToday: summary.work.today,
      activeOpportunities: summary.pipeline.activeOpportunities,
    });

    return summary;
  } catch (error) {
    console.error('[Dashboard] Error generating summary:', error);
    throw error;
  }
}

// ============================================================================
// Data Fetching Helpers
// ============================================================================

/**
 * Fetch work items from Airtable
 */
async function fetchWorkItems(): Promise<any[]> {
  try {
    const records = await base('Work Items')
      .select({
        sort: [{ field: 'Due Date', direction: 'asc' }],
        maxRecords: 100,
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      title: record.fields['Title'] as string,
      companyId: (record.fields['Company'] as string[])?.[0],
      dueDate: record.fields['Due Date'] as string,
      status: record.fields['Status'] as string,
      owner: record.fields['Owner'] as string,
    }));
  } catch (error) {
    console.warn('[Dashboard] Work items fetch failed:', error);
    return [];
  }
}

/**
 * Fetch leads from Airtable
 * Note: If no Leads table exists yet, returns empty array
 */
async function fetchLeads(): Promise<any[]> {
  try {
    const records = await base('Leads')
      .select({
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: 100,
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      name: record.fields['Name'] as string,
      domain: record.fields['Domain'] as string,
      source: record.fields['Source'] as string,
      status: record.fields['Status'] as string,
      createdAt: record.fields['Created At'] as string,
    }));
  } catch (error) {
    // Leads table may not exist yet
    console.warn('[Dashboard] Leads fetch failed (table may not exist):', error);
    return [];
  }
}

/**
 * Fetch opportunities from Airtable
 * Note: If no Opportunities table exists yet, returns empty array
 */
async function fetchOpportunities(): Promise<any[]> {
  try {
    const records = await base('Opportunities')
      .select({
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: 100,
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      name: record.fields['Name'] as string,
      companyId: (record.fields['Company'] as string[])?.[0],
      stage: record.fields['Stage'] as string,
      value: record.fields['Value'] as number,
      closeDate: record.fields['Close Date'] as string,
      owner: record.fields['Owner'] as string,
      createdAt: record.fields['Created At'] as string,
    }));
  } catch (error) {
    // Opportunities table may not exist yet
    console.warn('[Dashboard] Opportunities fetch failed (table may not exist):', error);
    return [];
  }
}
