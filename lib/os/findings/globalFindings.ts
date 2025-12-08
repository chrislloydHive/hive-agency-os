// lib/os/findings/globalFindings.ts
// Global Findings Service
//
// Provides functions to query and aggregate diagnostic findings across ALL companies.
// Used by the Global Findings Dashboard to surface:
// - Where are the biggest problems right now?
// - Which companies have the highest number of critical/high issues?
// - Which Labs are producing the most severe findings?
// - Which issues haven't been converted to Work Items?

import Airtable from 'airtable';
import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import type {
  DiagnosticDetailFinding,
  DiagnosticFindingCategory,
  DiagnosticFindingSeverity,
} from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Lazy Airtable Initialization
// ============================================================================

let _base: Airtable.Base | null = null;
function getBase(): Airtable.Base {
  if (!_base) {
    const apiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!apiKey || !baseId) {
      throw new Error('Airtable credentials not configured');
    }
    _base = new Airtable({ apiKey }).base(baseId);
  }
  return _base;
}

const DIAGNOSTIC_DETAILS_TABLE = 'Diagnostic Details';

// ============================================================================
// Types
// ============================================================================

export interface GlobalFindingsFilter {
  /** Filter by specific company IDs */
  companyIds?: string[];
  /** Filter by lab slugs (e.g., ['website', 'brand']) */
  labs?: string[];
  /** Filter by severities (e.g., ['high', 'critical']) */
  severities?: string[];
  /** Filter by categories (e.g., ['Technical', 'UX']) */
  categories?: string[];
  /** Filter by converted status */
  converted?: 'all' | 'converted' | 'not_converted';
  /** Filter by created date (findings created after this date) */
  since?: Date;
  /** Maximum number of findings to return (default 200) */
  limit?: number;
}

export interface CompanyFindingCount {
  companyId: string;
  companyName: string;
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface GlobalFindingsSummary {
  /** Total number of findings (filtered) */
  total: number;
  /** Count by severity */
  bySeverity: Record<string, number>;
  /** Count by lab slug */
  byLab: Record<string, number>;
  /** Count by category */
  byCategory: Record<string, number>;
  /** Count of converted findings */
  converted: number;
  /** Count of unconverted findings */
  unconverted: number;
  /** Top companies by critical+high count */
  topCompanies: CompanyFindingCount[];
  /** Total company count with findings */
  companyCount: number;
}

export interface GlobalFindingsResult {
  findings: DiagnosticDetailFindingWithCompany[];
  summary: GlobalFindingsSummary;
}

export interface DiagnosticDetailFindingWithCompany extends DiagnosticDetailFinding {
  companyName?: string;
}

// ============================================================================
// Airtable Field Mappings
// ============================================================================

const FINDING_FIELDS = {
  LAB_RUN: 'Lab Run',
  COMPANY: 'Company',
  LAB_SLUG: 'Lab Slug',
  CATEGORY: 'Category',
  DIMENSION: 'Dimension',
  SEVERITY: 'Severity',
  LOCATION: 'Location',
  ISSUE_KEY: 'Issue Key',
  DESCRIPTION: 'Description',
  RECOMMENDATION: 'Recommendation',
  ESTIMATED_IMPACT: 'Estimated Impact',
  IS_CONVERTED: 'Is Converted to Work Item',
  WORK_ITEM: 'Work Item',
  RECORD_TYPE: 'Record Type',
} as const;

/**
 * Convert Airtable record to DiagnosticDetailFinding
 */
function airtableRecordToFinding(record: { id: string; fields: Record<string, unknown> }): DiagnosticDetailFinding {
  const f = record.fields;

  return {
    id: record.id,
    labRunId: Array.isArray(f[FINDING_FIELDS.LAB_RUN]) ? (f[FINDING_FIELDS.LAB_RUN] as string[])[0] : '',
    companyId: Array.isArray(f[FINDING_FIELDS.COMPANY]) ? (f[FINDING_FIELDS.COMPANY] as string[])[0] : '',
    labSlug: f[FINDING_FIELDS.LAB_SLUG] as string | undefined,
    category: f[FINDING_FIELDS.CATEGORY] as DiagnosticFindingCategory | undefined,
    dimension: f[FINDING_FIELDS.DIMENSION] as string | undefined,
    severity: f[FINDING_FIELDS.SEVERITY] as DiagnosticFindingSeverity | undefined,
    location: f[FINDING_FIELDS.LOCATION] as string | undefined,
    issueKey: f[FINDING_FIELDS.ISSUE_KEY] as string | undefined,
    description: f[FINDING_FIELDS.DESCRIPTION] as string | undefined,
    recommendation: f[FINDING_FIELDS.RECOMMENDATION] as string | undefined,
    estimatedImpact: f[FINDING_FIELDS.ESTIMATED_IMPACT] as string | undefined,
    isConvertedToWorkItem: f[FINDING_FIELDS.IS_CONVERTED] as boolean | undefined,
    workItemId: Array.isArray(f[FINDING_FIELDS.WORK_ITEM]) ? (f[FINDING_FIELDS.WORK_ITEM] as string[])[0] : undefined,
    createdAt: f['Created'] as string | undefined,
    updatedAt: f['Last Modified'] as string | undefined,
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get all findings globally with optional filtering
 *
 * @param filters - Optional filters for companies, labs, severities, etc.
 * @returns Array of findings with company names
 */
export async function getGlobalFindings(
  filters?: GlobalFindingsFilter
): Promise<DiagnosticDetailFindingWithCompany[]> {
  console.log('[globalFindings] getGlobalFindings:', filters);

  const limit = filters?.limit || 200;

  try {
    // Build Airtable filter formula
    const formulaParts: string[] = [
      `{Record Type} = 'finding'`,
    ];

    // Filter by company IDs
    if (filters?.companyIds && filters.companyIds.length > 0) {
      const companyFilter = filters.companyIds
        .map(id => `FIND('${id}', ARRAYJOIN({Company}))`)
        .join(', ');
      formulaParts.push(`OR(${companyFilter})`);
    }

    // Filter by lab slugs
    if (filters?.labs && filters.labs.length > 0) {
      const labFilter = filters.labs
        .map(lab => `{Lab Slug} = '${lab}'`)
        .join(', ');
      formulaParts.push(`OR(${labFilter})`);
    }

    // Filter by severities
    if (filters?.severities && filters.severities.length > 0) {
      const sevFilter = filters.severities
        .map(sev => `{Severity} = '${sev}'`)
        .join(', ');
      formulaParts.push(`OR(${sevFilter})`);
    }

    // Filter by categories
    if (filters?.categories && filters.categories.length > 0) {
      const catFilter = filters.categories
        .map(cat => `{Category} = '${cat}'`)
        .join(', ');
      formulaParts.push(`OR(${catFilter})`);
    }

    // Filter by converted status
    if (filters?.converted === 'converted') {
      formulaParts.push(`{Is Converted to Work Item} = TRUE()`);
    } else if (filters?.converted === 'not_converted') {
      formulaParts.push(`OR({Is Converted to Work Item} = FALSE(), {Is Converted to Work Item} = BLANK())`);
    }

    // Filter by date (created after)
    if (filters?.since) {
      const isoDate = filters.since.toISOString().split('T')[0];
      formulaParts.push(`IS_AFTER({Created}, '${isoDate}')`);
    }

    const filterFormula = `AND(${formulaParts.join(', ')})`;

    console.log('[globalFindings] Filter formula:', filterFormula);

    // Fetch findings from Airtable
    const records = await getBase()(DIAGNOSTIC_DETAILS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Created', direction: 'desc' }],
        maxRecords: limit,
      })
      .all();

    console.log('[globalFindings] Fetched', records.length, 'findings from Airtable');

    // Convert to findings
    const findings = records.map(r =>
      airtableRecordToFinding({ id: r.id, fields: r.fields as Record<string, unknown> })
    );

    // Get company names for enrichment
    const companyMap = await getCompanyNameMap();

    // Enrich with company names
    const enrichedFindings: DiagnosticDetailFindingWithCompany[] = findings.map(f => ({
      ...f,
      companyName: f.companyId ? companyMap.get(f.companyId) || 'Unknown Company' : undefined,
    }));

    console.log('[globalFindings] Returning', enrichedFindings.length, 'enriched findings');
    return enrichedFindings;
  } catch (error) {
    console.error('[globalFindings] Error fetching global findings:', error);
    return [];
  }
}

/**
 * Get a summary of all findings globally
 *
 * @param filters - Optional filters
 * @returns Summary with counts and top companies
 */
export async function getGlobalFindingsSummary(
  filters?: Omit<GlobalFindingsFilter, 'limit'>
): Promise<GlobalFindingsSummary> {
  console.log('[globalFindings] getGlobalFindingsSummary:', filters);

  try {
    // Build filter formula (same as getGlobalFindings but no limit)
    const formulaParts: string[] = [
      `{Record Type} = 'finding'`,
    ];

    if (filters?.companyIds && filters.companyIds.length > 0) {
      const companyFilter = filters.companyIds
        .map(id => `FIND('${id}', ARRAYJOIN({Company}))`)
        .join(', ');
      formulaParts.push(`OR(${companyFilter})`);
    }

    if (filters?.labs && filters.labs.length > 0) {
      const labFilter = filters.labs
        .map(lab => `{Lab Slug} = '${lab}'`)
        .join(', ');
      formulaParts.push(`OR(${labFilter})`);
    }

    if (filters?.severities && filters.severities.length > 0) {
      const sevFilter = filters.severities
        .map(sev => `{Severity} = '${sev}'`)
        .join(', ');
      formulaParts.push(`OR(${sevFilter})`);
    }

    if (filters?.categories && filters.categories.length > 0) {
      const catFilter = filters.categories
        .map(cat => `{Category} = '${cat}'`)
        .join(', ');
      formulaParts.push(`OR(${catFilter})`);
    }

    if (filters?.converted === 'converted') {
      formulaParts.push(`{Is Converted to Work Item} = TRUE()`);
    } else if (filters?.converted === 'not_converted') {
      formulaParts.push(`OR({Is Converted to Work Item} = FALSE(), {Is Converted to Work Item} = BLANK())`);
    }

    if (filters?.since) {
      const isoDate = filters.since.toISOString().split('T')[0];
      formulaParts.push(`IS_AFTER({Created}, '${isoDate}')`);
    }

    const filterFormula = `AND(${formulaParts.join(', ')})`;

    // Fetch ALL findings for summary (no limit)
    // Note: For large datasets, consider caching or pagination
    const records = await getBase()(DIAGNOSTIC_DETAILS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Created', direction: 'desc' }],
        maxRecords: 1000, // Cap at 1000 for summary
      })
      .all();

    const findings = records.map(r =>
      airtableRecordToFinding({ id: r.id, fields: r.fields as Record<string, unknown> })
    );

    // Build summary
    const summary: GlobalFindingsSummary = {
      total: findings.length,
      bySeverity: {},
      byLab: {},
      byCategory: {},
      converted: 0,
      unconverted: 0,
      topCompanies: [],
      companyCount: 0,
    };

    // Aggregate by company for leaderboard
    const companyAggregates = new Map<string, {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    }>();

    for (const finding of findings) {
      // Count by severity
      const severity = finding.severity || 'unknown';
      summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;

      // Count by lab
      const lab = finding.labSlug || 'unknown';
      summary.byLab[lab] = (summary.byLab[lab] || 0) + 1;

      // Count by category
      const category = finding.category || 'unknown';
      summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;

      // Count converted
      if (finding.isConvertedToWorkItem) {
        summary.converted++;
      } else {
        summary.unconverted++;
      }

      // Aggregate by company
      if (finding.companyId) {
        let companyData = companyAggregates.get(finding.companyId);
        if (!companyData) {
          companyData = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
          companyAggregates.set(finding.companyId, companyData);
        }
        companyData.total++;
        if (severity === 'critical') companyData.critical++;
        else if (severity === 'high') companyData.high++;
        else if (severity === 'medium') companyData.medium++;
        else if (severity === 'low') companyData.low++;
      }
    }

    // Get company names
    const companyMap = await getCompanyNameMap();

    // Build top companies leaderboard (sorted by critical, then high, then total)
    const sortedCompanies = Array.from(companyAggregates.entries())
      .map(([companyId, data]) => ({
        companyId,
        companyName: companyMap.get(companyId) || 'Unknown Company',
        totalFindings: data.total,
        critical: data.critical,
        high: data.high,
        medium: data.medium,
        low: data.low,
      }))
      .sort((a, b) => {
        // Sort by critical first
        if (b.critical !== a.critical) return b.critical - a.critical;
        // Then by high
        if (b.high !== a.high) return b.high - a.high;
        // Then by total
        return b.totalFindings - a.totalFindings;
      })
      .slice(0, 10); // Top 10 companies

    summary.topCompanies = sortedCompanies;
    summary.companyCount = companyAggregates.size;

    console.log('[globalFindings] Summary:', {
      total: summary.total,
      companyCount: summary.companyCount,
      topCompaniesCount: summary.topCompanies.length,
    });

    return summary;
  } catch (error) {
    console.error('[globalFindings] Error building summary:', error);
    return {
      total: 0,
      bySeverity: {},
      byLab: {},
      byCategory: {},
      converted: 0,
      unconverted: 0,
      topCompanies: [],
      companyCount: 0,
    };
  }
}

/**
 * Get global findings with summary in a single call
 *
 * @param filters - Optional filters
 * @returns Combined result with findings and summary
 */
export async function getGlobalFindingsWithSummary(
  filters?: GlobalFindingsFilter
): Promise<GlobalFindingsResult> {
  // Fetch both in parallel
  const [findings, summary] = await Promise.all([
    getGlobalFindings(filters),
    getGlobalFindingsSummary(filters),
  ]);

  return { findings, summary };
}

// ============================================================================
// Helper Functions
// ============================================================================

// Cache for company names (refreshed per request lifecycle)
let companyNameCache: Map<string, string> | null = null;
let companyNameCacheTime: number = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Get a map of company IDs to names
 */
async function getCompanyNameMap(): Promise<Map<string, string>> {
  const now = Date.now();

  // Return cached if fresh
  if (companyNameCache && (now - companyNameCacheTime) < CACHE_TTL) {
    return companyNameCache;
  }

  try {
    const companies = await getAllCompanies();
    companyNameCache = new Map(companies.map(c => [c.id, c.name]));
    companyNameCacheTime = now;
    return companyNameCache;
  } catch (error) {
    console.error('[globalFindings] Error fetching companies:', error);
    return new Map();
  }
}

/**
 * Get all companies for filter dropdown
 */
export async function getCompaniesForFilter(): Promise<Array<{ id: string; name: string }>> {
  try {
    const companies = await getAllCompanies();
    return companies
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('[globalFindings] Error fetching companies for filter:', error);
    return [];
  }
}

// ============================================================================
// Filter Options (for UI)
// ============================================================================

/**
 * Get known lab slugs for filtering
 */
export function getKnownLabSlugs(): { value: string; label: string }[] {
  return [
    { value: 'website', label: 'Website Lab' },
    { value: 'brand', label: 'Brand Lab' },
    { value: 'seo', label: 'SEO Lab' },
    { value: 'content', label: 'Content Lab' },
    { value: 'demand', label: 'Demand Lab' },
    { value: 'ops', label: 'Ops Lab' },
    { value: 'gap', label: 'GAP-IA' },
    { value: 'gap-plan', label: 'GAP Plan' },
  ];
}

/**
 * Get known severities for filtering
 */
export function getKnownSeverities(): { value: string; label: string; color: string }[] {
  return [
    { value: 'critical', label: 'Critical', color: 'red' },
    { value: 'high', label: 'High', color: 'orange' },
    { value: 'medium', label: 'Medium', color: 'yellow' },
    { value: 'low', label: 'Low', color: 'slate' },
  ];
}

/**
 * Get known categories for filtering
 */
export function getKnownCategories(): { value: string; label: string }[] {
  return [
    { value: 'Technical', label: 'Technical' },
    { value: 'UX', label: 'UX' },
    { value: 'Brand', label: 'Brand' },
    { value: 'Content', label: 'Content' },
    { value: 'SEO', label: 'SEO' },
    { value: 'Analytics', label: 'Analytics' },
    { value: 'Media', label: 'Media' },
    { value: 'Demand', label: 'Demand' },
    { value: 'Ops', label: 'Operations' },
  ];
}

/**
 * Get time range presets
 */
export function getTimeRangePresets(): { value: string; label: string; days: number | null }[] {
  return [
    { value: '7d', label: 'Last 7 days', days: 7 },
    { value: '30d', label: 'Last 30 days', days: 30 },
    { value: '90d', label: 'Last 90 days', days: 90 },
    { value: 'all', label: 'All time', days: null },
  ];
}
