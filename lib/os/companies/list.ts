// lib/os/companies/list.ts
// Companies Directory Helper for Hive OS
// Fetches companies with enriched fields for the OS directory/CRM view

import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { listRecentGapIaRuns } from '@/lib/airtable/gapIaRuns';
import { base } from '@/lib/airtable/client';
import {
  evaluateCompanyHealth,
  type CompanyHealth,
  type CompanyActivitySnapshot,
} from './health';
import { formatLastActivityLabel } from './activity';

// ============================================================================
// Types
// ============================================================================

export type CompanyStage = 'Prospect' | 'Client' | 'Internal' | 'Dormant' | 'Lost';

// Re-export CompanyHealth from health module
export type { CompanyHealth } from './health';

export interface CompanyListItem {
  id: string;
  name: string;
  website?: string | null;
  domain?: string | null;
  stage: CompanyStage;
  tier?: string | null;
  owner?: string | null;
  health: CompanyHealth;
  healthReasons: string[];
  lastActivityAt?: string | null;
  lastActivityLabel: string; // e.g. "No activity", "Nov 24, 2025", "3 days ago"
  nextStep?: string | null;
  openWorkCount: number;
  openOpportunitiesCount: number;
  latestGapScore?: number | null;
  latestDiagnosticsSummary?: string | null;
  industry?: string | null;
  createdAt?: string;
}

export interface CompanyListFilter {
  stage?: CompanyStage | 'All';
  health?: CompanyHealth;
  search?: string;
  atRiskOnly?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Airtable stage to CompanyStage type
 */
function mapStage(stage?: string): CompanyStage {
  if (!stage) return 'Prospect';

  const normalizedStage = stage.trim();
  if (['Prospect', 'Client', 'Internal', 'Dormant', 'Lost'].includes(normalizedStage)) {
    return normalizedStage as CompanyStage;
  }

  // Map legacy stages
  if (normalizedStage === 'Lead') return 'Prospect';
  if (normalizedStage === 'Churned') return 'Lost';
  if (normalizedStage === 'Partner') return 'Client';

  return 'Prospect';
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * List companies for OS directory with enriched fields
 *
 * Fetches:
 * - All companies from Airtable
 * - Recent GAP runs to determine last activity and scores
 * - Work item counts per company
 * - Opportunity counts per company (TODO)
 *
 * Then:
 * - Derives health status
 * - Applies filters
 * - Returns enriched company list items
 */
export async function listCompaniesForOsDirectory(
  filter: CompanyListFilter = {}
): Promise<CompanyListItem[]> {
  console.log('[Companies Directory] Fetching companies with filter:', filter);

  try {
    // Fetch all data in parallel
    const [companies, gapRuns, workItemCounts] = await Promise.all([
      getAllCompanies(),
      listRecentGapIaRuns(500), // Get enough runs to find last activity per company
      fetchWorkItemCountsByCompany(),
    ]);

    console.log(`[Companies Directory] Fetched ${companies.length} companies, ${gapRuns.length} GAP runs`);

    // Build map: companyId -> { lastDate, score }
    const gapDataByCompany = new Map<string, { date: Date; score: number | null }>();
    for (const run of gapRuns) {
      if (run.companyId && run.createdAt) {
        const runDate = new Date(run.createdAt);
        const existing = gapDataByCompany.get(run.companyId);
        if (!existing || runDate > existing.date) {
          // Get score from summary (v2+) - cast run to access optional fields
          const runAny = run as any;
          const score = runAny.summary?.overallScore ?? runAny.overallScore ?? null;
          gapDataByCompany.set(run.companyId, { date: runDate, score });
        }
      }
    }

    // Enrich companies
    const enrichedCompanies: CompanyListItem[] = companies.map((company) => {
      const gapData = gapDataByCompany.get(company.id);
      const lastActivityDate = gapData?.date || null;
      const latestScore = gapData?.score ?? null;
      const stage = mapStage(company.stage);
      const lastActivityAt = lastActivityDate?.toISOString() || null;

      // Build a simplified activity snapshot for list view
      // TODO: For full accuracy, fetch work items and diagnostics per company
      // For now, use GAP run date as primary activity indicator
      const activitySnapshot: CompanyActivitySnapshot = {
        lastGapAssessmentAt: lastActivityAt,
        lastGapPlanAt: null, // TODO: Wire this when efficient
        lastDiagnosticAt: null, // TODO: Wire this when efficient
        lastWorkActivityAt: null, // TODO: Wire this when efficient
        lastAnyActivityAt: lastActivityAt,
      };

      // Evaluate health using the central model (includes manual override support)
      const { health, reasons: healthReasons } = evaluateCompanyHealth({
        stage,
        activity: activitySnapshot,
        latestGapScore: latestScore,
        // TODO: Wire hasOverdueWork and hasBacklogWork when we have efficient access
        hasOverdueWork: false,
        hasBacklogWork: false,
        // Manual override fields from Airtable
        healthOverride: company.healthOverride,
        atRiskFlag: company.atRiskFlag,
      });

      return {
        id: company.id,
        name: company.name,
        website: company.website || null,
        domain: company.domain || null,
        stage,
        tier: company.tier || null,
        owner: company.owner || null,
        health,
        healthReasons,
        lastActivityAt,
        lastActivityLabel: formatLastActivityLabel(lastActivityAt),
        nextStep: null, // TODO: Derive from work items or opportunities
        openWorkCount: workItemCounts.get(company.id) || 0,
        openOpportunitiesCount: 0, // TODO: Implement opportunity counting
        latestGapScore: latestScore,
        latestDiagnosticsSummary: null, // TODO: Get from latest diagnostic run
        industry: company.industry || null,
        createdAt: company.createdAt,
      };
    });

    // Apply filters
    let filtered = enrichedCompanies;

    // Stage filter
    if (filter.stage && filter.stage !== 'All') {
      filtered = filtered.filter((c) => c.stage === filter.stage);
    }

    // Health filter
    if (filter.health) {
      filtered = filtered.filter((c) => c.health === filter.health);
    }

    // At Risk only filter
    if (filter.atRiskOnly) {
      filtered = filtered.filter((c) => c.health === 'At Risk');
    }

    // Search filter (case-insensitive, matches name or domain)
    if (filter.search && filter.search.trim()) {
      const query = filter.search.toLowerCase().trim();
      filtered = filtered.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(query);
        const domainMatch = c.domain?.toLowerCase().includes(query) || false;
        const websiteMatch = c.website?.toLowerCase().includes(query) || false;
        return nameMatch || domainMatch || websiteMatch;
      });
    }

    // Sort: At Risk first (for Clients), then by name
    filtered.sort((a, b) => {
      // At Risk companies first
      if (a.health === 'At Risk' && b.health !== 'At Risk') return -1;
      if (a.health !== 'At Risk' && b.health === 'At Risk') return 1;

      // Then by name
      return a.name.localeCompare(b.name);
    });

    console.log(`[Companies Directory] Returning ${filtered.length} companies after filtering`);

    return filtered;
  } catch (error) {
    console.error('[Companies Directory] Error fetching companies:', error);
    throw error;
  }
}

/**
 * Fetch open work item counts per company
 * Returns Map<companyId, count>
 */
async function fetchWorkItemCountsByCompany(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  try {
    // Fetch all non-Done work items
    const records = await base('Work Items')
      .select({
        filterByFormula: `NOT({Status} = 'Done')`,
        fields: ['Company'],
      })
      .all();

    for (const record of records) {
      const companyIds = record.fields['Company'] as string[] | undefined;
      if (companyIds && companyIds.length > 0) {
        const companyId = companyIds[0];
        counts.set(companyId, (counts.get(companyId) || 0) + 1);
      }
    }

    console.log(`[Companies Directory] Counted work items for ${counts.size} companies`);
  } catch (error) {
    console.warn('[Companies Directory] Failed to fetch work item counts:', error);
  }

  return counts;
}

/**
 * Get count of companies by stage
 */
export async function getCompanyCounts(): Promise<{
  all: number;
  clients: number;
  prospects: number;
  atRisk: number;
}> {
  const companies = await listCompaniesForOsDirectory();

  return {
    all: companies.length,
    clients: companies.filter((c) => c.stage === 'Client').length,
    prospects: companies.filter((c) => c.stage === 'Prospect').length,
    atRisk: companies.filter((c) => c.health === 'At Risk').length,
  };
}

/**
 * Get a single enriched company by ID
 */
export async function getEnrichedCompanyById(
  companyId: string
): Promise<CompanyListItem | null> {
  const companies = await listCompaniesForOsDirectory();
  return companies.find((c) => c.id === companyId) || null;
}
