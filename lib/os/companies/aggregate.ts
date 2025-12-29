// lib/os/companies/aggregate.ts
// Aggregation logic for Companies directory
// Fetches data from multiple sources and builds enriched company view models

import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { listRecentGapIaRuns } from '@/lib/airtable/gapIaRuns';
import { listRecentGapPlanRuns } from '@/lib/airtable/gapPlanRuns';
import { base } from '@/lib/airtable/client';
import type {
  CompanyRowVM,
  CompaniesPageSummaryVM,
  CompanyListFilterV2,
  CompaniesAggregationResponse,
  CompanyStage,
  CompanyHealthStatus,
  GapRunType,
  ActivitySource,
  SortField,
  SortDirection,
} from './types';
import {
  normalizeDomainForDedup,
  formatLastActivity,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const HIGH_INTENT_DAYS_FULL_GAP = 7;
const HIGH_INTENT_DAYS_MULTIPLE_RUNS = 14;
const HIGH_INTENT_LOW_SCORE_THRESHOLD = 55;
const HIGH_INTENT_LOW_SCORE_DAYS = 7;

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Fetch work item counts grouped by company
 * Returns both open count and overdue count per company
 */
async function fetchWorkItemCountsByCompany(): Promise<Map<string, { open: number; overdue: number }>> {
  const counts = new Map<string, { open: number; overdue: number }>();
  const today = new Date().toISOString().split('T')[0];

  try {
    const records = await base('Work Items')
      .select({
        filterByFormula: `NOT({Status} = 'Done')`,
        fields: ['Company', 'Status', 'Due Date'],
      })
      .all();

    for (const record of records) {
      const companyIds = record.fields['Company'] as string[] | undefined;
      if (!companyIds || companyIds.length === 0) continue;

      const companyId = companyIds[0];
      const dueDate = record.fields['Due Date'] as string | undefined;
      const isOverdue = dueDate ? dueDate < today : false;

      const existing = counts.get(companyId) || { open: 0, overdue: 0 };
      existing.open++;
      if (isOverdue) existing.overdue++;
      counts.set(companyId, existing);
    }

    console.log(`[Companies Aggregate] Counted work items for ${counts.size} companies`);
  } catch (error) {
    console.warn('[Companies Aggregate] Failed to fetch work item counts:', error);
  }

  return counts;
}

/**
 * Fetch latest diagnostic run per company
 */
async function fetchLatestDiagnosticByCompany(): Promise<Map<string, { date: string; tool: string }>> {
  const diagnostics = new Map<string, { date: string; tool: string }>();

  try {
    const records = await base('Diagnostic Runs')
      .select({
        fields: ['Company', 'Tool ID', 'Created'],
        sort: [{ field: 'Created', direction: 'desc' }],
        maxRecords: 500,
      })
      .all();

    for (const record of records) {
      const companyIds = record.fields['Company'] as string[] | undefined;
      if (!companyIds || companyIds.length === 0) continue;

      const companyId = companyIds[0];
      const createdAt = record.fields['Created'] as string | undefined;
      const toolId = record.fields['Tool ID'] as string | undefined;

      // Only keep the first (most recent) for each company
      if (!diagnostics.has(companyId) && createdAt) {
        diagnostics.set(companyId, {
          date: createdAt,
          tool: toolId || 'diagnostic',
        });
      }
    }

    console.log(`[Companies Aggregate] Found diagnostics for ${diagnostics.size} companies`);
  } catch (error) {
    console.warn('[Companies Aggregate] Failed to fetch diagnostic runs:', error);
  }

  return diagnostics;
}

// ============================================================================
// Derivation Logic
// ============================================================================

/**
 * Map raw stage to CompanyStage type
 */
function mapStage(stage?: string | null): CompanyStage {
  if (!stage) return 'Prospect';

  const normalized = stage.trim();
  if (['Prospect', 'Client', 'Internal', 'Dormant', 'Lost'].includes(normalized)) {
    return normalized as CompanyStage;
  }

  // Map legacy stages
  if (normalized === 'Lead') return 'Prospect';
  if (normalized === 'Churned') return 'Lost';
  if (normalized === 'Partner') return 'Client';

  return 'Prospect';
}

/**
 * Derive health status from GAP score and work items
 *
 * Rules:
 * - If latestGapScore >= 75 => Good
 * - If latestGapScore 55-74 => Okay
 * - If latestGapScore < 55 => AtRisk
 * - Else if overdueWorkCount > 0 => AtRisk
 * - Else => Unknown
 */
export function deriveHealthStatus(
  latestGapScore: number | null,
  overdueWorkCount: number,
  stage: CompanyStage
): { health: CompanyHealthStatus; reasons: string[] } {
  const reasons: string[] = [];

  // Internal/Dormant/Lost don't have meaningful health
  if (stage === 'Internal' || stage === 'Dormant' || stage === 'Lost') {
    return { health: 'Unknown', reasons: ['Health not tracked for this stage'] };
  }

  // Score-based health
  if (latestGapScore !== null) {
    if (latestGapScore >= 75) {
      reasons.push(`Strong GAP score (${latestGapScore})`);
      return { health: 'Good', reasons };
    }
    if (latestGapScore >= 55) {
      reasons.push(`Moderate GAP score (${latestGapScore})`);
      return { health: 'Okay', reasons };
    }
    // Score < 55
    reasons.push(`Low GAP score (${latestGapScore})`);
    return { health: 'AtRisk', reasons };
  }

  // No score but has overdue work
  if (overdueWorkCount > 0) {
    reasons.push(`${overdueWorkCount} overdue work items`);
    return { health: 'AtRisk', reasons };
  }

  // Unknown
  reasons.push('No GAP assessment on record');
  return { health: 'Unknown', reasons };
}

/**
 * Determine if a company is high intent
 *
 * Rules:
 * - Full GAP run in last 7 days
 * - 2+ GAP runs (any type) in last 14 days
 * - Low score (<55) with run in last 7 days
 */
export function deriveHighIntent(
  gapRuns: { type: GapRunType; score: number | null; createdAt: string }[]
): { isHighIntent: boolean; reasons: string[] } {
  if (gapRuns.length === 0) {
    return { isHighIntent: false, reasons: [] };
  }

  const reasons: string[] = [];
  const now = new Date();

  // Sort by date desc
  const sortedRuns = [...gapRuns].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const latestRun = sortedRuns[0];
  const latestRunDaysAgo = Math.floor(
    (now.getTime() - new Date(latestRun.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Rule 1: Full GAP in last 7 days
  if (latestRun.type === 'FULL' && latestRunDaysAgo <= HIGH_INTENT_DAYS_FULL_GAP) {
    reasons.push('Full GAP run');
    return { isHighIntent: true, reasons };
  }

  // Rule 2: 2+ runs in last 14 days
  const runsInLast14Days = sortedRuns.filter((r) => {
    const daysAgo = Math.floor(
      (now.getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysAgo <= HIGH_INTENT_DAYS_MULTIPLE_RUNS;
  });

  if (runsInLast14Days.length >= 2) {
    reasons.push(`${runsInLast14Days.length} runs in 14 days`);
    return { isHighIntent: true, reasons };
  }

  // Rule 3: Low score with recent run
  if (
    latestRun.score !== null &&
    latestRun.score < HIGH_INTENT_LOW_SCORE_THRESHOLD &&
    latestRunDaysAgo <= HIGH_INTENT_LOW_SCORE_DAYS
  ) {
    reasons.push('Low score with recent activity');
    return { isHighIntent: true, reasons };
  }

  return { isHighIntent: false, reasons: [] };
}

/**
 * Determine if a company has no baseline data
 * No baseline = no GAP runs AND no diagnostic runs
 */
export function hasNoBaseline(
  gapRunCount: number,
  hasDiagnostics: boolean
): boolean {
  return gapRunCount === 0 && !hasDiagnostics;
}

/**
 * Detect duplicate companies by normalized domain
 * Returns a map of domain -> list of company IDs
 */
export function detectDuplicates(
  companies: { id: string; domain: string | null }[]
): Map<string, string[]> {
  const domainToCompanies = new Map<string, string[]>();

  for (const company of companies) {
    const normalizedDomain = normalizeDomainForDedup(company.domain);
    if (!normalizedDomain) continue;

    const existing = domainToCompanies.get(normalizedDomain) || [];
    existing.push(company.id);
    domainToCompanies.set(normalizedDomain, existing);
  }

  // Filter to only domains with multiple companies
  const duplicates = new Map<string, string[]>();
  for (const [domain, ids] of domainToCompanies) {
    if (ids.length > 1) {
      duplicates.set(domain, ids);
    }
  }

  return duplicates;
}

// ============================================================================
// Main Aggregation Function
// ============================================================================

/**
 * Aggregate company data from multiple sources
 * Returns enriched company rows and summary stats
 */
export async function aggregateCompaniesData(
  filter: CompanyListFilterV2 = {}
): Promise<CompaniesAggregationResponse> {
  console.log('[Companies Aggregate] Starting aggregation with filter:', filter);

  const { stage, search, attention, sortBy = 'name', sortDirection = 'asc' } = filter;

  // Fetch all data in parallel
  const [companies, gapIaRuns, gapPlanRuns, workItemCounts, diagnosticsByCompany] =
    await Promise.all([
      getAllCompanies(),
      listRecentGapIaRuns(500),
      listRecentGapPlanRuns(500),
      fetchWorkItemCountsByCompany(),
      fetchLatestDiagnosticByCompany(),
    ]);

  console.log(
    `[Companies Aggregate] Fetched ${companies.length} companies, ` +
      `${gapIaRuns.length} GAP-IA runs, ${gapPlanRuns.length} GAP-Plan runs`
  );

  // Build GAP data lookup by company
  // Structure: companyId -> { runs: [], latestScore, latestType, latestDate }
  const gapDataByCompany = new Map<
    string,
    {
      runs: { type: GapRunType; score: number | null; createdAt: string }[];
      latestScore: number | null;
      latestType: GapRunType | null;
      latestDate: string | null;
    }
  >();

  // Process GAP-IA runs
  for (const run of gapIaRuns) {
    if (!run.companyId || !run.createdAt) continue;

    const score = (run as any).summary?.overallScore ?? (run as any).overallScore ?? null;
    const existing = gapDataByCompany.get(run.companyId) || {
      runs: [],
      latestScore: null,
      latestType: null,
      latestDate: null,
    };

    existing.runs.push({
      type: 'IA',
      score,
      createdAt: run.createdAt,
    });

    // Update latest if this is newer
    if (!existing.latestDate || run.createdAt > existing.latestDate) {
      existing.latestScore = score;
      existing.latestType = 'IA';
      existing.latestDate = run.createdAt;
    }

    gapDataByCompany.set(run.companyId, existing);
  }

  // Process GAP-Plan runs (Full GAP)
  for (const run of gapPlanRuns) {
    if (!run.companyId || !run.createdAt) continue;

    const score = run.overallScore ?? null;
    const existing = gapDataByCompany.get(run.companyId) || {
      runs: [],
      latestScore: null,
      latestType: null,
      latestDate: null,
    };

    existing.runs.push({
      type: 'FULL',
      score,
      createdAt: run.createdAt,
    });

    // Full GAP takes precedence for latest score if newer or equal date
    if (!existing.latestDate || run.createdAt >= existing.latestDate) {
      existing.latestScore = score;
      existing.latestType = 'FULL';
      existing.latestDate = run.createdAt;
    }

    gapDataByCompany.set(run.companyId, existing);
  }

  // Detect duplicates
  const duplicateDomains = detectDuplicates(
    companies.map((c) => ({ id: c.id, domain: c.domain || c.website || null }))
  );

  // Build duplicate lookup: companyId -> primary company ID (first one)
  const duplicateLookup = new Map<string, string>();
  for (const [, ids] of duplicateDomains) {
    const primary = ids[0];
    for (let i = 1; i < ids.length; i++) {
      duplicateLookup.set(ids[i], primary);
    }
  }

  // Build company rows
  const companyRows: CompanyRowVM[] = [];

  for (const company of companies) {
    const companyStage = mapStage(company.stage);
    const gapData = gapDataByCompany.get(company.id);
    const workCounts = workItemCounts.get(company.id) || { open: 0, overdue: 0 };
    const diagnostic = diagnosticsByCompany.get(company.id);

    // Determine last activity
    let lastActivityAt: string | null = null;
    let lastActivitySource: ActivitySource = 'None';

    const activityDates: { date: string; source: ActivitySource }[] = [];

    if (gapData?.latestDate) {
      activityDates.push({
        date: gapData.latestDate,
        source: gapData.latestType === 'FULL' ? 'Full GAP Run' : 'GAP Run',
      });
    }

    if (diagnostic?.date) {
      activityDates.push({
        date: diagnostic.date,
        source: 'Lab Run',
      });
    }

    // Sort and take most recent
    if (activityDates.length > 0) {
      activityDates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      lastActivityAt = activityDates[0].date;
      lastActivitySource = activityDates[0].source;
    }

    // Derive health
    const { health, reasons: healthReasons } = deriveHealthStatus(
      gapData?.latestScore ?? null,
      workCounts.overdue,
      companyStage
    );

    // Derive high intent
    const { isHighIntent, reasons: highIntentReasons } = deriveHighIntent(
      gapData?.runs || []
    );

    // Check no baseline
    const noBaseline = hasNoBaseline(
      gapData?.runs.length || 0,
      diagnostic !== undefined
    );

    // Check duplicate status
    const isDuplicate = duplicateLookup.has(company.id);
    const duplicateOf = duplicateLookup.get(company.id) || null;

    companyRows.push({
      id: company.id,
      name: company.name,
      domain: company.domain || null,
      website: company.website || null,
      stage: companyStage,
      ownerName: company.owner || null,
      tier: company.tier || null,
      health,
      healthReasons,
      lastActivityAt,
      lastActivityLabel: formatLastActivity(lastActivityAt),
      lastActivitySource,
      openWorkCount: workCounts.open,
      overdueWorkCount: workCounts.overdue,
      latestGap: {
        type: gapData?.latestType || null,
        score: gapData?.latestScore ?? null,
        runAt: gapData?.latestDate || null,
      },
      isHighIntent,
      highIntentReasons,
      hasNoBaseline: noBaseline,
      isDuplicate,
      duplicateOf,
      createdAt: company.createdAt || null,
    });
  }

  // Build summary
  const summary: CompaniesPageSummaryVM = {
    countsByStage: {
      all: companyRows.length,
      client: companyRows.filter((c) => c.stage === 'Client').length,
      prospect: companyRows.filter((c) => c.stage === 'Prospect').length,
      internal: companyRows.filter((c) => c.stage === 'Internal').length,
      dormant: companyRows.filter((c) => c.stage === 'Dormant').length,
      lost: companyRows.filter((c) => c.stage === 'Lost').length,
    },
    needsAttention: {
      highIntentCount: companyRows.filter((c) => c.isHighIntent).length,
      overdueWorkCount: companyRows.filter((c) => c.overdueWorkCount > 0).length,
      noBaselineCount: companyRows.filter((c) => c.hasNoBaseline).length,
      duplicatesCount: companyRows.filter((c) => c.isDuplicate).length,
      atRiskCount: companyRows.filter((c) => c.health === 'AtRisk').length,
    },
    highIntentIds: companyRows.filter((c) => c.isHighIntent).map((c) => c.id),
    duplicateIds: companyRows.filter((c) => c.isDuplicate).map((c) => c.id),
    noBaselineIds: companyRows.filter((c) => c.hasNoBaseline).map((c) => c.id),
  };

  // Apply filters
  let filtered = [...companyRows];

  // Stage filter
  if (stage && stage !== 'All') {
    filtered = filtered.filter((c) => c.stage === stage);
  }

  // Search filter
  if (search && search.trim()) {
    const query = search.toLowerCase().trim();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.domain?.toLowerCase().includes(query) ||
        c.website?.toLowerCase().includes(query) ||
        c.ownerName?.toLowerCase().includes(query)
    );
  }

  // Attention filter
  if (attention) {
    switch (attention) {
      case 'highIntent':
        filtered = filtered.filter((c) => c.isHighIntent);
        break;
      case 'overdueWork':
        filtered = filtered.filter((c) => c.overdueWorkCount > 0);
        break;
      case 'noBaseline':
        filtered = filtered.filter((c) => c.hasNoBaseline);
        break;
      case 'duplicates':
        filtered = filtered.filter((c) => c.isDuplicate);
        break;
      case 'atRisk':
        filtered = filtered.filter((c) => c.health === 'AtRisk');
        break;
    }
  }

  // Apply sorting
  filtered = sortCompanies(filtered, sortBy, sortDirection);

  console.log(
    `[Companies Aggregate] Returning ${filtered.length} companies after filtering`
  );

  return {
    companies: filtered,
    summary,
  };
}

/**
 * Sort companies by the specified field
 */
function sortCompanies(
  companies: CompanyRowVM[],
  sortBy: SortField,
  direction: SortDirection
): CompanyRowVM[] {
  const multiplier = direction === 'asc' ? 1 : -1;

  return companies.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return multiplier * a.name.localeCompare(b.name);

      case 'lastActivity':
        if (!a.lastActivityAt && !b.lastActivityAt) return 0;
        if (!a.lastActivityAt) return multiplier;
        if (!b.lastActivityAt) return -multiplier;
        return (
          multiplier *
          (new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
        );

      case 'gapScore':
        if (a.latestGap.score === null && b.latestGap.score === null) return 0;
        if (a.latestGap.score === null) return multiplier;
        if (b.latestGap.score === null) return -multiplier;
        return multiplier * (a.latestGap.score - b.latestGap.score);

      case 'openWork':
        return multiplier * (b.openWorkCount - a.openWorkCount);

      case 'health': {
        const healthOrder: Record<CompanyHealthStatus, number> = {
          AtRisk: 0,
          Unknown: 1,
          Okay: 2,
          Good: 3,
        };
        return multiplier * (healthOrder[a.health] - healthOrder[b.health]);
      }

      default:
        return 0;
    }
  });
}
