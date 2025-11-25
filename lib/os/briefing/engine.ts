// lib/os/briefing/engine.ts
// AI Briefing Engine v2
// Aggregates real data sources and generates intelligent daily briefings

import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { listRecentGapIaRuns } from '@/lib/airtable/gapIaRuns';
import { listRecentGapPlanRuns } from '@/lib/airtable/gapPlanRuns';
import { base } from '@/lib/airtable/client';
import { getDefaultDateRange, getGrowthAnalyticsSnapshot } from '@/lib/analytics/growthAnalytics';
import type {
  Briefing,
  BriefingFocusItem,
  BriefingRisk,
  BriefingOpportunity,
  CompanyId,
  Company,
} from '@/lib/os/types';

// ============================================================================
// Types
// ============================================================================

export interface BriefingDataSources {
  companies: CompanyRecord[];
  atRiskClients: AtRiskClient[];
  newClients: NewClient[];
  workItems: WorkItemData[];
  diagnosticRuns: DiagnosticRunData[];
  gapIaRuns: GapRunData[];
  gapPlanRuns: GapPlanData[];
  analytics: AnalyticsData | null;
  opportunities: OpportunityData[];
}

export interface AtRiskClient {
  companyId: string;
  name: string;
  domain?: string;
  reasons: string[];
  stage: string;
  owner?: string | null;
  daysSinceLastGap?: number;
  overdueWorkCount?: number;
}

export interface NewClient {
  companyId: string;
  name: string;
  stage: string;
  createdAt: string;
  daysOld: number;
}

export interface WorkItemData {
  id: string;
  title: string;
  companyId?: string;
  companyName?: string;
  status: string;
  dueDate?: string;
  isDueToday: boolean;
  isOverdue: boolean;
  severity?: string;
  area?: string;
}

export interface DiagnosticRunData {
  id: string;
  companyId: string;
  companyName?: string;
  toolId: string;
  status: string;
  score?: number;
  createdAt: string;
  daysOld: number;
}

export interface GapRunData {
  id: string;
  companyId?: string;
  companyName?: string;
  domain?: string;
  score?: number;
  createdAt: string;
  daysOld: number;
}

export interface GapPlanData {
  id: string;
  companyId?: string;
  companyName?: string;
  theme?: string;
  status?: string;
  createdAt: string;
  daysOld: number;
}

export interface AnalyticsData {
  sessions30d: number | null;
  users30d: number | null;
  searchClicks30d: number | null;
  bounceRate: number | null;
  avgSessionDuration: number | null;
  // Trends (vs previous 30 days)
  sessionsTrend?: number; // percentage change
  usersTrend?: number;
  // Anomalies detected
  anomalies: AnalyticsAnomaly[];
}

export interface AnalyticsAnomaly {
  type: 'spike' | 'drop' | 'high-bounce' | 'low-engagement';
  metric: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  value: number;
  threshold?: number;
}

export interface OpportunityData {
  id: string;
  companyId?: string;
  companyName?: string;
  title: string;
  source: string;
  status: string;
  priority: string;
  createdAt: string;
}

// ============================================================================
// Date Helpers
// ============================================================================

function isWithinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

function getDaysAgo(dateStr: string | undefined): number {
  if (!dateStr) return 999;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

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

function isPast(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchWorkItems(): Promise<WorkItemData[]> {
  try {
    const records = await base('Work Items')
      .select({
        sort: [{ field: 'Due Date', direction: 'asc' }],
        maxRecords: 200,
      })
      .all();

    return records.map((record) => {
      const dueDate = record.fields['Due Date'] as string | undefined;
      const status = record.fields['Status'] as string || 'Backlog';

      return {
        id: record.id,
        title: record.fields['Title'] as string,
        companyId: (record.fields['Company'] as string[])?.[0],
        status,
        dueDate,
        isDueToday: isToday(dueDate),
        isOverdue: status !== 'Done' && !!dueDate && isPast(dueDate) && !isToday(dueDate),
        severity: record.fields['Severity'] as string,
        area: record.fields['Area'] as string,
      };
    });
  } catch (error) {
    console.warn('[Briefing] Work items fetch failed:', error);
    return [];
  }
}

async function fetchDiagnosticRuns(companyLookup: Map<string, CompanyRecord>): Promise<DiagnosticRunData[]> {
  try {
    const records = await base('Diagnostic Runs')
      .select({
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: 100,
        filterByFormula: 'IS_AFTER({Created At}, DATEADD(NOW(), -30, "days"))',
      })
      .all();

    return records.map((record) => {
      const companyId = (record.fields['Company'] as string[])?.[0] || '';
      const company = companyId ? companyLookup.get(companyId) : undefined;
      const createdAt = record.fields['Created At'] as string || '';

      return {
        id: record.id,
        companyId,
        companyName: company?.name,
        toolId: record.fields['Tool ID'] as string || '',
        status: record.fields['Status'] as string || 'pending',
        score: record.fields['Score'] as number | undefined,
        createdAt,
        daysOld: getDaysAgo(createdAt),
      };
    });
  } catch (error) {
    console.warn('[Briefing] Diagnostic runs fetch failed:', error);
    return [];
  }
}

async function fetchOpportunities(companyLookup: Map<string, CompanyRecord>): Promise<OpportunityData[]> {
  try {
    const records = await base('Opportunities')
      .select({
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: 100,
      })
      .all();

    return records.map((record) => {
      const companyId = (record.fields['Company'] as string[])?.[0];
      const company = companyId ? companyLookup.get(companyId) : undefined;

      return {
        id: record.id,
        companyId,
        companyName: company?.name,
        title: record.fields['Name'] as string || 'Untitled',
        source: record.fields['Source'] as string || 'manual',
        status: record.fields['Stage'] as string || 'new',
        priority: record.fields['Priority'] as string || 'medium',
        createdAt: record.fields['Created At'] as string || '',
      };
    });
  } catch (error) {
    console.warn('[Briefing] Opportunities fetch failed:', error);
    return [];
  }
}

async function fetchAnalytics(): Promise<AnalyticsData | null> {
  try {
    const { startDate, endDate } = getDefaultDateRange(30);
    const snapshot = await getGrowthAnalyticsSnapshot(startDate, endDate);

    const anomalies: AnalyticsAnomaly[] = [];

    // Detect high bounce rate
    if (snapshot.traffic.bounceRate !== null && snapshot.traffic.bounceRate > 0.65) {
      anomalies.push({
        type: 'high-bounce',
        metric: 'bounceRate',
        severity: snapshot.traffic.bounceRate > 0.75 ? 'high' : 'medium',
        description: `Bounce rate is ${(snapshot.traffic.bounceRate * 100).toFixed(1)}% - above healthy threshold`,
        value: snapshot.traffic.bounceRate,
        threshold: 0.65,
      });
    }

    // Detect low engagement
    if (
      snapshot.traffic.avgSessionDurationSeconds !== null &&
      snapshot.traffic.avgSessionDurationSeconds < 60
    ) {
      anomalies.push({
        type: 'low-engagement',
        metric: 'avgSessionDuration',
        severity: snapshot.traffic.avgSessionDurationSeconds < 30 ? 'high' : 'medium',
        description: `Average session duration is ${snapshot.traffic.avgSessionDurationSeconds}s - users leaving quickly`,
        value: snapshot.traffic.avgSessionDurationSeconds,
        threshold: 60,
      });
    }

    return {
      sessions30d: snapshot.traffic.sessions,
      users30d: snapshot.traffic.users,
      searchClicks30d: snapshot.searchQueries.reduce((sum, q) => sum + q.clicks, 0) || null,
      bounceRate: snapshot.traffic.bounceRate,
      avgSessionDuration: snapshot.traffic.avgSessionDurationSeconds,
      anomalies,
    };
  } catch (error) {
    console.warn('[Briefing] Analytics fetch failed:', error);
    return null;
  }
}

// ============================================================================
// At-Risk Detection
// ============================================================================

function detectAtRiskClients(
  companies: CompanyRecord[],
  gapIaRuns: GapRunData[],
  gapPlanRuns: GapPlanData[],
  workItems: WorkItemData[]
): AtRiskClient[] {
  const atRisk: AtRiskClient[] = [];

  // Build lookup maps
  const lastGapByCompany = new Map<string, number>(); // company -> days since last GAP
  const overdueByCompany = new Map<string, number>(); // company -> overdue work count
  const hasRecentPlan = new Set<string>();

  // Find last GAP for each company
  for (const run of gapIaRuns) {
    if (!run.companyId) continue;
    const existing = lastGapByCompany.get(run.companyId);
    if (existing === undefined || run.daysOld < existing) {
      lastGapByCompany.set(run.companyId, run.daysOld);
    }
  }

  // Check recent plans
  for (const plan of gapPlanRuns) {
    if (plan.companyId && plan.daysOld < 90) {
      hasRecentPlan.add(plan.companyId);
    }
  }

  // Count overdue work
  for (const item of workItems) {
    if (item.companyId && item.isOverdue) {
      overdueByCompany.set(
        item.companyId,
        (overdueByCompany.get(item.companyId) || 0) + 1
      );
    }
  }

  // Evaluate each Client-stage company
  for (const company of companies) {
    if (company.stage !== 'Client') continue;

    const reasons: string[] = [];
    const daysSinceLastGap = lastGapByCompany.get(company.id);
    const overdueCount = overdueByCompany.get(company.id) || 0;

    // No GAP in 90 days
    if (daysSinceLastGap === undefined || daysSinceLastGap > 90) {
      reasons.push(
        daysSinceLastGap === undefined
          ? 'No GAP assessment on record'
          : `No GAP in ${daysSinceLastGap} days`
      );
    }

    // No active plan
    if (!hasRecentPlan.has(company.id)) {
      reasons.push('No active growth plan');
    }

    // Overdue work items
    if (overdueCount > 0) {
      reasons.push(`${overdueCount} overdue work item${overdueCount > 1 ? 's' : ''}`);
    }

    if (reasons.length > 0) {
      atRisk.push({
        companyId: company.id,
        name: company.name,
        domain: company.domain,
        reasons,
        stage: company.stage,
        owner: company.owner,
        daysSinceLastGap,
        overdueWorkCount: overdueCount,
      });
    }
  }

  // Sort by severity (more reasons = more at risk)
  atRisk.sort((a, b) => b.reasons.length - a.reasons.length);

  return atRisk.slice(0, 10);
}

// ============================================================================
// Main Data Collection
// ============================================================================

export async function collectBriefingData(
  companyId?: CompanyId
): Promise<BriefingDataSources> {
  console.log('[Briefing] Collecting data sources...', companyId ? `for company ${companyId}` : 'workspace-wide');

  // Fetch all base data in parallel
  const [companies, gapIaRuns, gapPlanRuns, workItemsRaw] = await Promise.all([
    getAllCompanies(),
    listRecentGapIaRuns(100),
    listRecentGapPlanRuns(100),
    fetchWorkItems(),
  ]);

  // Build company lookup
  const companyLookup = new Map<string, CompanyRecord>();
  for (const company of companies) {
    companyLookup.set(company.id, company);
  }

  // Fetch additional data with company context
  const [diagnosticRuns, opportunitiesRaw, analytics] = await Promise.all([
    fetchDiagnosticRuns(companyLookup),
    fetchOpportunities(companyLookup),
    fetchAnalytics(),
  ]);

  // Enrich work items with company names
  const workItems = workItemsRaw.map((item) => ({
    ...item,
    companyName: item.companyId ? companyLookup.get(item.companyId)?.name : undefined,
  }));

  // Process GAP runs
  const processedGapIaRuns: GapRunData[] = gapIaRuns.map((run) => ({
    id: run.id,
    companyId: run.companyId,
    companyName: run.companyId ? companyLookup.get(run.companyId)?.name : undefined,
    domain: run.domain,
    score: run.core?.overallScore || undefined,
    createdAt: run.createdAt,
    daysOld: getDaysAgo(run.createdAt),
  }));

  const processedGapPlanRuns: GapPlanData[] = gapPlanRuns.map((plan) => ({
    id: plan.id,
    companyId: plan.companyId,
    companyName: plan.companyId ? companyLookup.get(plan.companyId)?.name : undefined,
    theme: plan.maturityStage,
    status: plan.status,
    createdAt: plan.createdAt,
    daysOld: getDaysAgo(plan.createdAt),
  }));

  // Detect at-risk clients
  const atRiskClients = detectAtRiskClients(
    companies,
    processedGapIaRuns,
    processedGapPlanRuns,
    workItems
  );

  // Find new clients (last 7 days)
  const newClients: NewClient[] = companies
    .filter((c) => c.stage === 'Client' && c.createdAt && isWithinDays(c.createdAt, 7))
    .map((c) => ({
      companyId: c.id,
      name: c.name,
      stage: c.stage || 'Unknown',
      createdAt: c.createdAt || '',
      daysOld: getDaysAgo(c.createdAt),
    }))
    .sort((a, b) => a.daysOld - b.daysOld)
    .slice(0, 5);

  // Filter by company if specified
  let filteredData: BriefingDataSources = {
    companies,
    atRiskClients,
    newClients,
    workItems,
    diagnosticRuns,
    gapIaRuns: processedGapIaRuns,
    gapPlanRuns: processedGapPlanRuns,
    analytics,
    opportunities: opportunitiesRaw,
  };

  if (companyId) {
    filteredData = {
      ...filteredData,
      atRiskClients: atRiskClients.filter((c) => c.companyId === companyId),
      newClients: newClients.filter((c) => c.companyId === companyId),
      workItems: workItems.filter((w) => w.companyId === companyId),
      diagnosticRuns: diagnosticRuns.filter((d) => d.companyId === companyId),
      gapIaRuns: processedGapIaRuns.filter((r) => r.companyId === companyId),
      gapPlanRuns: processedGapPlanRuns.filter((p) => p.companyId === companyId),
      opportunities: opportunitiesRaw.filter((o) => o.companyId === companyId),
    };
  }

  console.log('[Briefing] Data collected:', {
    companies: filteredData.companies.length,
    atRisk: filteredData.atRiskClients.length,
    workItems: filteredData.workItems.length,
    diagnosticRuns: filteredData.diagnosticRuns.length,
    gapRuns: filteredData.gapIaRuns.length,
    opportunities: filteredData.opportunities.length,
    hasAnalytics: !!filteredData.analytics,
  });

  return filteredData;
}

// ============================================================================
// Briefing Generation (Data-Driven)
// ============================================================================

export function generateBriefingFocusItems(data: BriefingDataSources): BriefingFocusItem[] {
  const items: BriefingFocusItem[] = [];

  // 1. Overdue work items (highest priority)
  const overdueWork = data.workItems.filter((w) => w.isOverdue);
  if (overdueWork.length > 0) {
    items.push({
      area: 'work',
      title: `${overdueWork.length} overdue work item${overdueWork.length > 1 ? 's' : ''} need attention`,
      detail: overdueWork
        .slice(0, 3)
        .map((w) => `"${w.title}"${w.companyName ? ` (${w.companyName})` : ''}`)
        .join(', '),
      priority: 'high',
      linkType: 'work',
      linkHref: '/work?filter=overdue',
    });
  }

  // 2. At-risk clients
  for (const client of data.atRiskClients.slice(0, 2)) {
    items.push({
      area: 'clients',
      title: `${client.name} needs attention`,
      detail: client.reasons.join('. ') + '.',
      priority: client.reasons.length >= 2 ? 'high' : 'medium',
      linkType: 'company',
      linkHref: `/c/${client.companyId}`,
      companyId: client.companyId,
      companyName: client.name,
    });
  }

  // 3. Work due today
  const dueToday = data.workItems.filter((w) => w.isDueToday && w.status !== 'Done');
  if (dueToday.length > 0) {
    items.push({
      area: 'work',
      title: `${dueToday.length} work item${dueToday.length > 1 ? 's' : ''} due today`,
      detail: dueToday
        .slice(0, 2)
        .map((w) => `"${w.title}"${w.companyName ? ` for ${w.companyName}` : ''}`)
        .join(', '),
      priority: 'medium',
      linkType: 'work',
      linkHref: '/work?filter=today',
    });
  }

  // 4. Analytics anomalies
  if (data.analytics?.anomalies.length) {
    for (const anomaly of data.analytics.anomalies.slice(0, 2)) {
      items.push({
        area: 'analytics',
        title: anomaly.description,
        detail: `${anomaly.metric} is at ${typeof anomaly.value === 'number' ? anomaly.value.toFixed(2) : anomaly.value}`,
        priority: anomaly.severity === 'high' ? 'high' : 'medium',
        linkType: 'analytics',
        linkHref: '/analytics',
      });
    }
  }

  // 5. New clients to onboard
  for (const client of data.newClients.slice(0, 1)) {
    items.push({
      area: 'clients',
      title: `Welcome ${client.name} - new client`,
      detail: `Added ${client.daysOld === 0 ? 'today' : `${client.daysOld} days ago`}. Consider running initial GAP assessment.`,
      priority: 'medium',
      linkType: 'company',
      linkHref: `/c/${client.companyId}`,
      companyId: client.companyId,
      companyName: client.name,
    });
  }

  // 6. Recent diagnostic runs with issues
  const lowScoreDiagnostics = data.diagnosticRuns
    .filter((d) => d.score !== undefined && d.score < 60 && d.daysOld < 7)
    .slice(0, 2);

  for (const diag of lowScoreDiagnostics) {
    items.push({
      area: 'diagnostics',
      title: `${diag.toolId} flagged issues for ${diag.companyName || 'a client'}`,
      detail: `Score: ${diag.score}/100. Review findings and create action items.`,
      priority: diag.score && diag.score < 40 ? 'high' : 'medium',
      linkType: 'company',
      linkHref: `/c/${diag.companyId}/diagnostics`,
      companyId: diag.companyId,
      companyName: diag.companyName,
    });
  }

  // 7. Active opportunities
  const newOpportunities = data.opportunities.filter(
    (o) => o.status === 'new' || o.status === 'qualified'
  );
  if (newOpportunities.length > 0) {
    items.push({
      area: 'pipeline',
      title: `${newOpportunities.length} active opportunit${newOpportunities.length > 1 ? 'ies' : 'y'} in pipeline`,
      detail: newOpportunities
        .slice(0, 2)
        .map((o) => o.title)
        .join(', '),
      priority: 'medium',
      linkType: 'opportunity',
      linkHref: '/pipeline/opportunities',
    });
  }

  // Sort by priority and return top items
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return items.slice(0, 7);
}

export function generateBriefingRisks(data: BriefingDataSources): BriefingRisk[] {
  const risks: BriefingRisk[] = [];

  // At-risk clients
  for (const client of data.atRiskClients.slice(0, 3)) {
    if (client.reasons.length >= 2) {
      risks.push({
        title: `${client.name} may churn`,
        detail: client.reasons.join('. ') + '. Schedule a check-in call.',
        severity: client.reasons.length >= 3 ? 'critical' : 'high',
        companyId: client.companyId,
        companyName: client.name,
      });
    }
  }

  // High overdue count
  const overdueCount = data.workItems.filter((w) => w.isOverdue).length;
  if (overdueCount >= 5) {
    risks.push({
      title: 'Work backlog is building up',
      detail: `${overdueCount} overdue items. This may affect client delivery timelines.`,
      severity: overdueCount >= 10 ? 'critical' : 'high',
    });
  }

  // Analytics risks
  if (data.analytics?.anomalies.some((a) => a.severity === 'high')) {
    const highAnomaly = data.analytics.anomalies.find((a) => a.severity === 'high');
    if (highAnomaly) {
      risks.push({
        title: 'Traffic performance concern',
        detail: highAnomaly.description,
        severity: 'high',
      });
    }
  }

  return risks.slice(0, 3);
}

export function generateBriefingOpportunities(data: BriefingDataSources): BriefingOpportunity[] {
  const opportunities: BriefingOpportunity[] = [];

  // New clients to upsell
  if (data.newClients.length > 0) {
    opportunities.push({
      title: 'New client onboarding',
      detail: `${data.newClients.length} new client${data.newClients.length > 1 ? 's' : ''} ready for initial assessment and planning.`,
      potentialValue: 'Service expansion opportunity',
    });
  }

  // Clients without recent diagnostics
  const clientsWithoutDiagnostics = data.companies.filter((c) => {
    if (c.stage !== 'Client') return false;
    const hasDiag = data.diagnosticRuns.some(
      (d) => d.companyId === c.id && d.daysOld < 30
    );
    return !hasDiag;
  });

  if (clientsWithoutDiagnostics.length > 0) {
    opportunities.push({
      title: `${clientsWithoutDiagnostics.length} clients need diagnostics`,
      detail: 'Running diagnostics can uncover actionable improvements and expansion opportunities.',
      potentialValue: 'Service delivery and upsell',
    });
  }

  // Successful GAP runs
  const successfulGaps = data.gapIaRuns.filter(
    (r) => r.score !== undefined && r.score >= 70 && r.daysOld < 14
  );
  if (successfulGaps.length > 0) {
    const gap = successfulGaps[0];
    opportunities.push({
      title: `${gap.companyName || 'A client'} scored ${gap.score}/100`,
      detail: 'Strong assessment result - good candidate for case study or referral request.',
      companyId: gap.companyId,
      companyName: gap.companyName,
    });
  }

  return opportunities.slice(0, 3);
}

// ============================================================================
// Export Main Function
// ============================================================================

export async function generateBriefing(companyId?: CompanyId): Promise<{
  data: BriefingDataSources;
  focusItems: BriefingFocusItem[];
  risks: BriefingRisk[];
  opportunities: BriefingOpportunity[];
  snapshot: Briefing['dataSnapshot'];
}> {
  const data = await collectBriefingData(companyId);

  const focusItems = generateBriefingFocusItems(data);
  const risks = generateBriefingRisks(data);
  const opportunities = generateBriefingOpportunities(data);

  const snapshot: Briefing['dataSnapshot'] = {
    companiesCount: data.companies.length,
    atRiskCount: data.atRiskClients.length,
    workOverdue: data.workItems.filter((w) => w.isOverdue).length,
    workDueToday: data.workItems.filter((w) => w.isDueToday).length,
    activeOpportunities: data.opportunities.filter(
      (o) => o.status !== 'won' && o.status !== 'lost' && o.status !== 'dismissed'
    ).length,
    recentDiagnostics: data.diagnosticRuns.filter((d) => d.daysOld < 7).length,
  };

  return { data, focusItems, risks, opportunities, snapshot };
}
