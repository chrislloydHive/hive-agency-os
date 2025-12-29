// lib/dma/normalize.ts
// Normalization layer for DMA Activity
// Fetches GAP-IA and GAP-Plan runs and normalizes them into unified DMARun format

import { listRecentGapIaRuns, getGapIaRunsForCompanyOrDomain } from '@/lib/airtable/gapIaRuns';
import { listRecentGapPlanRuns, getGapPlanRunsForCompanyOrDomain } from '@/lib/airtable/gapPlanRuns';
import { getAllCompanies } from '@/lib/airtable/companies';
import type { GapIaRun, GapPlanRun } from '@/lib/gap/types';
import type {
  DMARun,
  DMARunType,
  DMASource,
  DMACompanySummary,
  DMAActivityFilter,
} from '@/lib/types/dma';
import { getScoreBand, deriveIntentLevel, isRecentRun } from './intentLevel';

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalize a GAP-IA run into DMARun format
 */
function normalizeGapIaRun(run: GapIaRun, isRerunFlag: boolean = false, daysSincePrev: number | null = null): DMARun {
  // Determine source - check if from DMA based on source field
  // GapIaSource: 'lead-magnet' | 'internal' | 'imported' | 'os_baseline' | 'os_diagnostic'
  let source: DMASource = 'Unknown';
  if (run.source === 'lead-magnet' || run.source === 'imported') {
    source = 'DMA';
  } else if (run.source === 'internal' || run.source === 'os_baseline' || run.source === 'os_diagnostic') {
    source = 'HiveOS';
  }

  // Get score - prefer overallScore, then compute from other scores
  const score = (run as any).overallScore ?? null;

  // Build run URL if we have an ID
  const runUrl = run.id ? `/diagnostics/gap-ia/${run.id}` : null;

  // Get company name from core context if available
  const companyName = run.core?.businessName || null;

  return {
    id: run.id,
    companyId: run.companyId || null,
    companyName,
    domain: run.domain || null,
    runType: 'GAP_IA',
    score,
    createdAt: run.createdAt || new Date().toISOString(),
    source,
    runUrl,
    notes: run.core?.quickSummary || null,
    websiteUrl: run.url || null,
    scoreBand: getScoreBand(score),
    isRerun: isRerunFlag,
    daysSincePreviousRun: daysSincePrev,
  };
}

/**
 * Normalize a GAP-Plan run into DMARun format
 */
function normalizeGapPlanRun(run: GapPlanRun, isRerunFlag: boolean = false, daysSincePrev: number | null = null): DMARun {
  // GAP-Plan runs are typically from DMA or HiveOS
  // Check dataJson for source hints
  let source: DMASource = 'Unknown';
  const dataJson = run.dataJson as Record<string, unknown> | undefined;
  if (dataJson) {
    const djSource = (dataJson as any).source;
    if (djSource === 'dma' || djSource === 'dma_audit') {
      source = 'DMA';
    } else if (djSource === 'hive_os' || djSource === 'internal') {
      source = 'HiveOS';
    }
  }

  // Get score
  const score = run.overallScore ?? null;

  // Build run URL
  const runUrl = run.id ? `/diagnostics/gap-plan/${run.id}` : null;

  // Get company name from dataJson
  const companyName = dataJson?.companyName as string || null;

  // Get domain from URL
  let domain: string | null = null;
  if (run.url) {
    try {
      const urlObj = new URL(run.url.startsWith('http') ? run.url : `https://${run.url}`);
      domain = urlObj.hostname.replace(/^www\./, '');
    } catch {
      domain = run.domain || null;
    }
  }

  return {
    id: run.id,
    companyId: run.companyId || null,
    companyName,
    domain,
    runType: 'GAP_FULL',
    score,
    createdAt: run.createdAt || new Date().toISOString(),
    source,
    runUrl,
    notes: null,
    websiteUrl: run.url || null,
    scoreBand: getScoreBand(score),
    isRerun: isRerunFlag,
    daysSincePreviousRun: daysSincePrev,
  };
}

/**
 * Calculate days between two ISO date strings
 */
function daysBetweenDates(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / msPerDay);
}

/**
 * Enrich runs with isRerun and daysSincePreviousRun
 * Assumes runs are sorted by createdAt desc
 */
function enrichRunsWithRerunData(runs: DMARun[]): DMARun[] {
  if (runs.length <= 1) {
    return runs.map(r => ({ ...r, isRerun: false, daysSincePreviousRun: null }));
  }

  // Group by companyId (or domain if no companyId)
  const grouped = new Map<string, DMARun[]>();
  for (const run of runs) {
    const key = run.companyId || run.domain || run.id;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(run);
  }

  // Enrich each group
  const enriched: DMARun[] = [];
  for (const [, groupRuns] of grouped) {
    // Sort by createdAt desc within group
    const sorted = [...groupRuns].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      const run = sorted[i];
      const isRerun = sorted.length > 1 && i < sorted.length - 1;
      const daysSincePrev = i < sorted.length - 1
        ? daysBetweenDates(run.createdAt, sorted[i + 1].createdAt)
        : null;

      enriched.push({
        ...run,
        isRerun,
        daysSincePreviousRun: daysSincePrev,
      });
    }
  }

  // Re-sort by createdAt desc
  return enriched.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * Fetch recent DMA runs across all companies
 * Combines GAP-IA and GAP-Plan runs
 */
export async function fetchRecentDMARuns(filter: DMAActivityFilter = {}): Promise<DMARun[]> {
  const { days = 7, runType = 'all', limit = 50 } = filter;

  console.log('[DMA] Fetching recent runs:', { days, runType, limit });

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Fetch both types in parallel
  const [gapIaRuns, gapPlanRuns] = await Promise.all([
    runType === 'GAP_FULL' ? [] : listRecentGapIaRuns(100),
    runType === 'GAP_IA' ? [] : listRecentGapPlanRuns(100),
  ]);

  console.log('[DMA] Raw fetch results:', {
    gapIaCount: gapIaRuns.length,
    gapPlanCount: gapPlanRuns.length,
  });

  // Normalize all runs
  const normalizedIa = gapIaRuns.map(r => normalizeGapIaRun(r));
  const normalizedPlan = gapPlanRuns.map(r => normalizeGapPlanRun(r));

  // Combine and filter by date
  let combined = [...normalizedIa, ...normalizedPlan]
    .filter(run => new Date(run.createdAt) >= cutoffDate);

  // Sort by createdAt desc
  combined.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Enrich with rerun data
  combined = enrichRunsWithRerunData(combined);

  // Apply limit
  const result = combined.slice(0, limit);

  console.log('[DMA] Normalized runs:', {
    totalBeforeFilter: normalizedIa.length + normalizedPlan.length,
    afterDateFilter: combined.length,
    afterLimit: result.length,
  });

  return result;
}

/**
 * Fetch DMA runs for a specific company
 */
export async function fetchDMARunsForCompany(
  companyId: string,
  domain: string,
  limit: number = 50
): Promise<DMARun[]> {
  console.log('[DMA] Fetching runs for company:', { companyId, domain });

  // Fetch both types in parallel
  const [gapIaRuns, gapPlanRuns] = await Promise.all([
    getGapIaRunsForCompanyOrDomain(companyId, domain, limit),
    getGapPlanRunsForCompanyOrDomain(companyId, domain, limit),
  ]);

  console.log('[DMA] Company runs fetched:', {
    gapIaCount: gapIaRuns.length,
    gapPlanCount: gapPlanRuns.length,
  });

  // Normalize all runs
  const normalizedIa = gapIaRuns.map(r => normalizeGapIaRun(r));
  const normalizedPlan = gapPlanRuns.map(r => normalizeGapPlanRun(r));

  // Combine
  let combined = [...normalizedIa, ...normalizedPlan];

  // Sort by createdAt desc
  combined.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Enrich with rerun data
  combined = enrichRunsWithRerunData(combined);

  return combined.slice(0, limit);
}

/**
 * Build company summaries from runs
 * Enriches with company names from Companies table
 */
export async function buildCompanySummaries(runs: DMARun[]): Promise<DMACompanySummary[]> {
  if (runs.length === 0) {
    return [];
  }

  // Group runs by companyId or domain
  const grouped = new Map<string, DMARun[]>();
  const unlinkedRuns: DMARun[] = [];

  for (const run of runs) {
    if (run.companyId) {
      const key = run.companyId;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(run);
    } else if (run.domain) {
      // Group by domain for unlinked runs
      const key = `domain:${run.domain}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(run);
    } else {
      unlinkedRuns.push(run);
    }
  }

  // Fetch company names in batch
  const companiesMap = new Map<string, { name: string; domain: string | null }>();
  try {
    const companies = await getAllCompanies();
    for (const company of companies) {
      companiesMap.set(company.id, {
        name: company.name,
        domain: company.domain || null,
      });
    }
  } catch (error) {
    console.error('[DMA] Failed to fetch companies for name enrichment:', error);
  }

  // Build summaries
  const summaries: DMACompanySummary[] = [];

  for (const [key, companyRuns] of grouped) {
    // Sort runs by createdAt desc
    const sortedRuns = [...companyRuns].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const latestRun = sortedRuns[0];
    const isUnlinked = key.startsWith('domain:');
    const companyId = isUnlinked ? key : key;

    // Get company name
    let companyName = latestRun.companyName || 'Unknown';
    let domain = latestRun.domain;

    if (!isUnlinked && companiesMap.has(companyId)) {
      const company = companiesMap.get(companyId)!;
      companyName = company.name;
      domain = company.domain || domain;
    }

    // Derive intent
    const { level: intentLevel, reasons: intentReasons } = deriveIntentLevel(sortedRuns);

    summaries.push({
      companyId,
      companyName,
      domain,
      lastRunAt: latestRun.createdAt,
      lastRunType: latestRun.runType,
      totalRuns: sortedRuns.length,
      latestScore: latestRun.score,
      latestScoreBand: latestRun.scoreBand,
      intentLevel,
      intentReasons,
      hasRecentRun: isRecentRun(latestRun.createdAt),
      runs: sortedRuns,
    });
  }

  // Sort summaries by lastRunAt desc
  summaries.sort((a, b) => {
    if (!a.lastRunAt) return 1;
    if (!b.lastRunAt) return -1;
    return new Date(b.lastRunAt).getTime() - new Date(a.lastRunAt).getTime();
  });

  return summaries;
}

/**
 * Build a single company summary from runs
 */
export function buildSingleCompanySummary(
  companyId: string,
  companyName: string,
  domain: string | null,
  runs: DMARun[]
): DMACompanySummary {
  if (runs.length === 0) {
    return {
      companyId,
      companyName,
      domain,
      lastRunAt: null,
      lastRunType: null,
      totalRuns: 0,
      latestScore: null,
      latestScoreBand: 'NA',
      intentLevel: 'None',
      intentReasons: [],
      hasRecentRun: false,
      runs: [],
    };
  }

  // Sort runs by createdAt desc
  const sortedRuns = [...runs].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const latestRun = sortedRuns[0];
  const { level: intentLevel, reasons: intentReasons } = deriveIntentLevel(sortedRuns);

  return {
    companyId,
    companyName,
    domain,
    lastRunAt: latestRun.createdAt,
    lastRunType: latestRun.runType,
    totalRuns: sortedRuns.length,
    latestScore: latestRun.score,
    latestScoreBand: latestRun.scoreBand,
    intentLevel,
    intentReasons,
    hasRecentRun: isRecentRun(latestRun.createdAt),
    runs: sortedRuns,
  };
}

/**
 * Get DMA activity stats
 */
export function getDMAActivityStats(runs: DMARun[], summaries: DMACompanySummary[]) {
  const countByType = {
    GAP_IA: runs.filter(r => r.runType === 'GAP_IA').length,
    GAP_FULL: runs.filter(r => r.runType === 'GAP_FULL').length,
  };

  const countByIntent = {
    High: summaries.filter(s => s.intentLevel === 'High').length,
    Medium: summaries.filter(s => s.intentLevel === 'Medium').length,
    Low: summaries.filter(s => s.intentLevel === 'Low').length,
    None: summaries.filter(s => s.intentLevel === 'None').length,
  };

  return { countByType, countByIntent };
}
