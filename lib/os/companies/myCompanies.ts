// lib/os/companies/myCompanies.ts
// "My Companies" feature - personalized company dashboard with activity context

import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { listRecentGapIaRuns } from '@/lib/airtable/gapIaRuns';
import { base } from '@/lib/airtable/client';
import { listDiagnosticRunsForCompany, getToolLabel, type DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { evaluateCompanyHealth, type CompanyHealth, type CompanyActivitySnapshot } from './health';
import { formatLastActivityLabel } from './activity';
import type { CompanyStage } from './list';

// ============================================================================
// Types
// ============================================================================

export interface LastActivityContext {
  type: 'diagnostic' | 'work_item' | 'gap_assessment' | 'gap_plan' | 'none';
  label: string; // e.g., "Ran Website Lab", "Working on: Fix homepage CTA"
  detail?: string; // Additional context like score or status
  date: string | null;
  relativeTime: string; // "2 days ago", "Today"
  linkTo?: string; // URL to continue/view the activity
}

export interface MyCompanyItem {
  id: string;
  name: string;
  website?: string | null;
  domain?: string | null;
  stage: CompanyStage;
  tier?: string | null;
  health: CompanyHealth;
  healthReasons: string[];
  latestGapScore?: number | null;

  // Activity context
  lastActivity: LastActivityContext;

  // Work context
  openWorkCount: number;
  inProgressWorkItem?: {
    id: string;
    title: string;
    area?: string;
  } | null;

  // Quick stats
  daysSinceLastActivity: number | null;

  // For pinning
  isPinned: boolean;
}

export interface MyCompaniesFilter {
  includeStages?: CompanyStage[];
  pinnedIds?: string[];
  maxDaysSinceActivity?: number;
  ownerFilter?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapStage(stage?: string): CompanyStage {
  if (!stage) return 'Prospect';
  const normalizedStage = stage.trim();
  if (['Prospect', 'Client', 'Internal', 'Dormant', 'Lost'].includes(normalizedStage)) {
    return normalizedStage as CompanyStage;
  }
  if (normalizedStage === 'Lead') return 'Prospect';
  if (normalizedStage === 'Churned') return 'Lost';
  if (normalizedStage === 'Partner') return 'Client';
  return 'Prospect';
}

function getDaysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

// ============================================================================
// Activity Context Builder
// ============================================================================

interface ActivityData {
  diagnosticRuns: DiagnosticRun[];
  workItems: WorkItemData[];
  gapIaRun?: { date: string; score: number | null } | null;
}

interface WorkItemData {
  id: string;
  title: string;
  status: string;
  area?: string;
  updatedAt?: string;
  createdAt?: string;
}

function buildLastActivityContext(
  companyId: string,
  data: ActivityData
): LastActivityContext {
  const activities: Array<{
    type: LastActivityContext['type'];
    label: string;
    detail?: string;
    date: string;
    linkTo?: string;
  }> = [];

  // Add diagnostic runs
  for (const run of data.diagnosticRuns) {
    if (run.status === 'complete' && run.updatedAt) {
      const toolLabel = getToolLabel(run.toolId);
      activities.push({
        type: 'diagnostic',
        label: `Ran ${toolLabel}`,
        detail: run.score !== null ? `Score: ${run.score}` : undefined,
        date: run.updatedAt,
        linkTo: `/c/${companyId}/diagnostics/${run.toolId}/${run.id}`,
      });
    }
  }

  // Add GAP assessment
  if (data.gapIaRun?.date) {
    activities.push({
      type: 'gap_assessment',
      label: 'Ran GAP Assessment',
      detail: data.gapIaRun.score !== null ? `Score: ${data.gapIaRun.score}` : undefined,
      date: data.gapIaRun.date,
      linkTo: `/c/${companyId}/blueprint`,
    });
  }

  // Add work items (prioritize In Progress)
  const inProgressWork = data.workItems.find(w => w.status === 'In Progress');
  if (inProgressWork) {
    const workDate = inProgressWork.updatedAt || inProgressWork.createdAt;
    if (workDate) {
      activities.push({
        type: 'work_item',
        label: `Working on: ${inProgressWork.title}`,
        detail: inProgressWork.area ? `Area: ${inProgressWork.area}` : undefined,
        date: workDate,
        linkTo: `/c/${companyId}/work`,
      });
    }
  }

  // Sort by date descending
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const latest = activities[0];
  if (!latest) {
    return {
      type: 'none',
      label: 'No recent activity',
      date: null,
      relativeTime: 'Never',
    };
  }

  return {
    type: latest.type,
    label: latest.label,
    detail: latest.detail,
    date: latest.date,
    relativeTime: formatLastActivityLabel(latest.date),
    linkTo: latest.linkTo,
  };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Fetch companies for "My Companies" view with rich activity context
 */
export async function getMyCompanies(
  filter: MyCompaniesFilter = {}
): Promise<MyCompanyItem[]> {
  console.log('[My Companies] Fetching with filter:', filter);

  const {
    includeStages = ['Client', 'Prospect'],
    pinnedIds = [],
    maxDaysSinceActivity = 60,
    ownerFilter,
  } = filter;

  try {
    // Fetch base data
    const [companies, gapRuns] = await Promise.all([
      getAllCompanies(),
      listRecentGapIaRuns(500),
    ]);

    // Build GAP data map
    const gapDataByCompany = new Map<string, { date: string; score: number | null }>();
    for (const run of gapRuns) {
      if (run.companyId && run.createdAt) {
        const existing = gapDataByCompany.get(run.companyId);
        if (!existing || new Date(run.createdAt) > new Date(existing.date)) {
          const runAny = run as any;
          const score = runAny.summary?.overallScore ?? runAny.overallScore ?? null;
          gapDataByCompany.set(run.companyId, { date: run.createdAt, score });
        }
      }
    }

    // Fetch work items for all companies
    const workItemsByCompany = await fetchWorkItemsByCompany();

    // Filter to relevant companies first
    const relevantCompanies = companies.filter(company => {
      const stage = mapStage(company.stage);

      // Always include pinned
      if (pinnedIds.includes(company.id)) return true;

      // Stage filter
      if (!includeStages.includes(stage)) return false;

      // Owner filter
      if (ownerFilter && company.owner !== ownerFilter) return false;

      return true;
    });

    // Fetch diagnostic runs for relevant companies (in batches to avoid too many requests)
    const diagnosticRunsByCompany = new Map<string, DiagnosticRun[]>();
    const batchSize = 10;
    for (let i = 0; i < relevantCompanies.length; i += batchSize) {
      const batch = relevantCompanies.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (company) => {
          try {
            const runs = await listDiagnosticRunsForCompany(company.id, { limit: 5 });
            return { companyId: company.id, runs };
          } catch {
            return { companyId: company.id, runs: [] };
          }
        })
      );
      for (const { companyId, runs } of batchResults) {
        diagnosticRunsByCompany.set(companyId, runs);
      }
    }

    // Enrich companies
    const enrichedCompanies: MyCompanyItem[] = relevantCompanies.map(company => {
      const stage = mapStage(company.stage);
      const gapData = gapDataByCompany.get(company.id) || null;
      const workItems = workItemsByCompany.get(company.id) || [];
      const diagnosticRuns = diagnosticRunsByCompany.get(company.id) || [];
      const isPinned = pinnedIds.includes(company.id);

      // Build activity context
      const lastActivity = buildLastActivityContext(company.id, {
        diagnosticRuns,
        workItems,
        gapIaRun: gapData,
      });

      // Build activity snapshot for health evaluation
      const activitySnapshot: CompanyActivitySnapshot = {
        lastGapAssessmentAt: gapData?.date || null,
        lastGapPlanAt: null,
        lastDiagnosticAt: diagnosticRuns[0]?.updatedAt || null,
        lastWorkActivityAt: workItems[0]?.updatedAt || workItems[0]?.createdAt || null,
        lastAnyActivityAt: lastActivity.date,
      };

      const { health, reasons: healthReasons } = evaluateCompanyHealth({
        stage,
        activity: activitySnapshot,
        latestGapScore: gapData?.score ?? null,
        hasOverdueWork: false,
        hasBacklogWork: workItems.some(w => w.status === 'Backlog'),
        healthOverride: company.healthOverride,
        atRiskFlag: company.atRiskFlag,
      });

      const openWorkCount = workItems.filter(w => w.status !== 'Done').length;
      const inProgressWork = workItems.find(w => w.status === 'In Progress');

      return {
        id: company.id,
        name: company.name,
        website: company.website || null,
        domain: company.domain || null,
        stage,
        tier: company.tier || null,
        health,
        healthReasons,
        latestGapScore: gapData?.score ?? null,
        lastActivity,
        openWorkCount,
        inProgressWorkItem: inProgressWork ? {
          id: inProgressWork.id,
          title: inProgressWork.title,
          area: inProgressWork.area,
        } : null,
        daysSinceLastActivity: getDaysSince(lastActivity.date),
        isPinned,
      };
    });

    // Filter by activity recency (unless pinned)
    let filtered = enrichedCompanies.filter(company => {
      if (company.isPinned) return true;
      if (company.daysSinceLastActivity === null) return false;
      return company.daysSinceLastActivity <= maxDaysSinceActivity;
    });

    // Sort: Pinned first, then by last activity (most recent first)
    filtered.sort((a, b) => {
      // Pinned first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      // Then by last activity date (most recent first)
      if (a.lastActivity.date && b.lastActivity.date) {
        return new Date(b.lastActivity.date).getTime() - new Date(a.lastActivity.date).getTime();
      }
      if (a.lastActivity.date && !b.lastActivity.date) return -1;
      if (!a.lastActivity.date && b.lastActivity.date) return 1;

      // Finally by name
      return a.name.localeCompare(b.name);
    });

    console.log(`[My Companies] Returning ${filtered.length} companies`);
    return filtered;
  } catch (error) {
    console.error('[My Companies] Error:', error);
    throw error;
  }
}

/**
 * Fetch work items grouped by company
 */
async function fetchWorkItemsByCompany(): Promise<Map<string, WorkItemData[]>> {
  const byCompany = new Map<string, WorkItemData[]>();

  try {
    const records = await base('Work Items')
      .select({
        filterByFormula: `NOT({Status} = 'Done')`,
        fields: ['Title', 'Company', 'Status', 'Area', 'Updated At', 'Created At'],
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .all();

    for (const record of records) {
      const companyIds = record.fields['Company'] as string[] | undefined;
      if (!companyIds || companyIds.length === 0) continue;

      const companyId = companyIds[0];
      const item: WorkItemData = {
        id: record.id,
        title: (record.fields['Title'] as string) || 'Untitled',
        status: (record.fields['Status'] as string) || 'Backlog',
        area: record.fields['Area'] as string | undefined,
        updatedAt: record.fields['Updated At'] as string | undefined,
        createdAt: record.fields['Created At'] as string | undefined,
      };

      const existing = byCompany.get(companyId) || [];
      existing.push(item);
      byCompany.set(companyId, existing);
    }

    console.log(`[My Companies] Fetched work items for ${byCompany.size} companies`);
  } catch (error) {
    console.warn('[My Companies] Failed to fetch work items:', error);
  }

  return byCompany;
}
