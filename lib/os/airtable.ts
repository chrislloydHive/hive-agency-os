// lib/os/airtable.ts
// Read-only Airtable data access layer for Hive OS
// Integrates with existing GAP tables: Companies, Snapshots, Full Reports, Gap Runs

import { getBase } from '../airtable';
import type {
  Company,
  CompanyId,
  CompanyStage,
  CompanyType,
  CompanySizeBand,
  CompanySource,
  Diagnostics,
  PriorityItem,
  GrowthPlan,
  CompanyScorecard,
  ScorecardPoint,
} from './types';

// Table names - using existing GAP tables
const COMPANIES_TABLE = process.env.AIRTABLE_COMPANIES_TABLE || 'Companies';
const SNAPSHOTS_TABLE = process.env.AIRTABLE_SNAPSHOTS_TABLE || 'Snapshots';
const FULL_REPORTS_TABLE =
  process.env.AIRTABLE_FULL_REPORTS_TABLE || 'Full Reports';
const GAP_RUNS_TABLE = process.env.AIRTABLE_GAP_RUNS_TABLE || 'Gap Runs';

/**
 * Map Airtable Status field to OS status
 */
function mapStatus(airtableStatus: string | undefined): Company['status'] {
  if (!airtableStatus) return 'new';

  const normalized = airtableStatus.toLowerCase().trim();

  if (normalized === 'active') return 'active';
  if (normalized.includes('progress')) return 'in_progress';
  if (normalized === 'paused') return 'paused';
  if (normalized === 'closed') return 'closed';

  return 'new';
}

/**
 * Map Airtable Stage field to CompanyStage type
 */
function mapStage(airtableStage: string | undefined): CompanyStage | undefined {
  if (!airtableStage) return undefined;

  const normalized = airtableStage.toLowerCase().trim();

  if (normalized === 'lead') return 'Lead';
  if (normalized === 'prospect') return 'Prospect';
  if (normalized === 'client') return 'Client';
  if (normalized === 'churned') return 'Churned';
  if (normalized === 'partner') return 'Partner';

  return undefined;
}

/**
 * Map Airtable Company Type field to CompanyType type
 */
function mapCompanyType(airtableType: string | undefined): CompanyType | undefined {
  if (!airtableType) return undefined;

  const normalized = airtableType.toLowerCase().trim();

  if (normalized === 'saas') return 'SaaS';
  if (normalized === 'services') return 'Services';
  if (normalized === 'marketplace') return 'Marketplace';
  if (normalized === 'ecommerce' || normalized === 'e-commerce' || normalized === 'ecom') return 'eCom';
  if (normalized === 'local') return 'Local';
  if (normalized === 'other') return 'Other';

  return undefined;
}

/**
 * Map Airtable Size Band field to CompanySizeBand type
 * Note: Types use en-dashes (–) not hyphens (-)
 */
function mapSizeBand(airtableSize: string | undefined): CompanySizeBand | undefined {
  if (!airtableSize) return undefined;

  const normalized = airtableSize.toLowerCase().trim();

  if (normalized.includes('1') && normalized.includes('10')) return '1–10';
  if (normalized.includes('11') && normalized.includes('50')) return '11–50';
  if (normalized.includes('51') && normalized.includes('200')) return '51–200';
  if (normalized.includes('200+') || normalized.includes('201') || normalized === 'large' || normalized === 'enterprise') return '200+';
  if (normalized === 'startup' || normalized === 'small') return '1–10';
  if (normalized === 'medium') return '51–200';

  return undefined;
}

/**
 * Map Airtable Source field to CompanySource type
 */
function mapSource(airtableSource: string | undefined): CompanySource | undefined {
  if (!airtableSource) return undefined;

  const normalized = airtableSource.toLowerCase().trim();

  if (normalized === 'inbound') return 'Inbound';
  if (normalized === 'outbound') return 'Outbound';
  if (normalized === 'referral') return 'Referral';
  if (normalized === 'internal') return 'Internal';
  if (normalized === 'other') return 'Other';

  return undefined;
}

/**
 * Fetch all companies from Companies table.
 * Scores and diagnostics are derived from Full Reports, not Companies.
 */
export async function fetchCompaniesFromAirtable(): Promise<Company[]> {
  try {
    const base = getBase();
    const records = await base(COMPANIES_TABLE)
      .select({
        pageSize: 100,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    // Fetch latest Full Reports for each company to derive scores/status
    const companies: Company[] = await Promise.all(
      records.map(async (record) => {
        const fields = record.fields;
        const companyId = record.id;

        // Get latest OS Full Report for this company
        let latestReport: any = null;
        try {
          // Fetch all OS reports and filter by company in JS (linked fields are arrays)
          const reportRecords = await base(FULL_REPORTS_TABLE)
            .select({
              filterByFormula: `{Report Type} = 'OS'`,
              sort: [{ field: 'Report Date', direction: 'desc' }],
            })
            .all();

          // Filter by company ID (linked field is an array)
          const companyReports = reportRecords.filter((record) => {
            const companyIds = record.fields['Company'] as string[] | undefined;
            return companyIds && companyIds.includes(companyId);
          });

          if (companyReports.length > 0) {
            latestReport = companyReports[0];
          }
        } catch (e) {
          // Ignore errors fetching reports
        }

        const reportFields = latestReport?.fields || {};

        return {
          id: companyId,
          name: (fields['Name'] as string) || (fields['Company Name'] as string) || 'Unknown Company',
          websiteUrl: (fields['Website'] as string) || (fields['URL'] as string) || '',
          industry: (fields['Industry'] as string) || undefined,
          stage: mapStage(fields['Stage'] as string | undefined),
          companyType: mapCompanyType(fields['Company Type'] as string | undefined),
          sizeBand: mapSizeBand(fields['Size Band'] as string | undefined),
          region: (fields['Region'] as string) || undefined,
          owner: (fields['Owner'] as string) || undefined,
          source: mapSource(fields['Source'] as string | undefined),
          primaryContactName: (fields['Primary Contact Name'] as string) || undefined,
          primaryContactEmail: (fields['Primary Contact Email'] as string) || undefined,
          primaryContactRole: (fields['Primary Contact Role'] as string) || undefined,
          notes: (fields['Notes'] as string) || undefined,
          // Derived from Full Reports (not stored on Companies)
          latestOverallScore:
            typeof reportFields['Overall Score'] === 'number'
              ? reportFields['Overall Score']
              : undefined,
          status: mapStatus(reportFields['Status'] as string) || 'new',
          fullReportId: latestReport?.id || undefined,
          fullReportDate: (reportFields['Report Date'] as string) || undefined,
          lastSnapshotAt: (reportFields['Report Date'] as string) || undefined,
          // Legacy fields
          leadId: (fields['Lead ID'] as string) || undefined,
          email: (fields['Email'] as string) || (fields['Primary Contact Email'] as string) || undefined,
        };
      })
    );

    console.log(
      `[Hive OS] Loaded ${companies.length} companies from Airtable`
    );
    return companies;
  } catch (error) {
    console.warn('[Hive OS] Failed to fetch companies from Airtable:', error);
    return [];
  }
}

/**
 * Fetch a single company by ID from Companies table.
 * Scores and diagnostics are derived from Full Reports, not Companies.
 */
export async function fetchCompanyByIdFromAirtable(
  id: CompanyId
): Promise<Company | null> {
  try {
    const base = getBase();
    const record = await base(COMPANIES_TABLE).find(id);

    if (!record) {
      return null;
    }

    const fields = record.fields;

    // Get latest OS Full Report for this company
    let latestReport: any = null;
    try {
      // Fetch all OS reports and filter by company in JS (linked fields are arrays)
      const reportRecords = await base(FULL_REPORTS_TABLE)
        .select({
          filterByFormula: `{Report Type} = 'OS'`,
          sort: [{ field: 'Report Date', direction: 'desc' }],
        })
        .all();

      // Filter by company ID (linked field is an array)
      const companyReports = reportRecords.filter((record) => {
        const companyIds = record.fields['Company'] as string[] | undefined;
        return companyIds && companyIds.includes(id);
      });

      if (companyReports.length > 0) {
        latestReport = companyReports[0];
      }
    } catch (e) {
      // Ignore errors fetching reports
    }

    const reportFields = latestReport?.fields || {};

    return {
      id: record.id,
      name: (fields['Name'] as string) || (fields['Company Name'] as string) || 'Unknown Company',
      websiteUrl: (fields['Website'] as string) || (fields['URL'] as string) || '',
      industry: (fields['Industry'] as string) || undefined,
      stage: mapStage(fields['Stage'] as string | undefined),
      companyType: mapCompanyType(fields['Company Type'] as string | undefined),
      sizeBand: mapSizeBand(fields['Size Band'] as string | undefined),
      region: (fields['Region'] as string) || undefined,
      owner: (fields['Owner'] as string) || undefined,
      source: mapSource(fields['Source'] as string | undefined),
      primaryContactName: (fields['Primary Contact Name'] as string) || undefined,
      primaryContactEmail: (fields['Primary Contact Email'] as string) || undefined,
      primaryContactRole: (fields['Primary Contact Role'] as string) || undefined,
      notes: (fields['Notes'] as string) || undefined,
      // Derived from Full Reports (not stored on Companies)
      latestOverallScore:
        typeof reportFields['Overall Score'] === 'number'
          ? reportFields['Overall Score']
          : undefined,
      status: mapStatus(reportFields['Status'] as string) || 'new',
      fullReportId: latestReport?.id || undefined,
      fullReportDate: (reportFields['Report Date'] as string) || undefined,
      lastSnapshotAt: (reportFields['Report Date'] as string) || undefined,
      // Legacy fields
      leadId: (fields['Lead ID'] as string) || undefined,
      email: (fields['Email'] as string) || (fields['Primary Contact Email'] as string) || undefined,
    };
  } catch (error) {
    console.warn(`[Hive OS] Failed to fetch company ${id}:`, error);
    return null;
  }
}

/**
 * Fetch latest Snapshot for a company (optional, for context)
 */
export async function fetchLatestSnapshotForCompanyFromAirtable(
  companyRecordId: CompanyId
): Promise<any | null> {
  try {
    const base = getBase();
    const records = await base(SNAPSHOTS_TABLE)
      .select({
        filterByFormula: `OR({Lead} = '${companyRecordId}', {Linked Lead} = '${companyRecordId}')`,
        maxRecords: 1,
        sort: [{ field: 'Created Time', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    const fields = record.fields;

    return {
      id: record.id,
      overallScore: (fields['Overall Score'] as number) || 0,
      seoScore: (fields['SEO Score'] as number) || 0,
      contentScore: (fields['Content Score'] as number) || 0,
      conversionScore: (fields['Conversion Score'] as number) || 0,
      performanceScore: (fields['PageSpeed Lighthouse Perf'] as number) || 0,
      strengths: (fields['3 Strengths'] as string)?.split('\n') || [],
      quickWins: (fields['3 Quick Wins'] as string)?.split('\n') || [],
      snapshotUrl: (fields['Snapshot URL'] as string) || undefined,
      rawJson: (fields['Raw JSON'] as string) || undefined,
    };
  } catch (error) {
    console.warn(
      `[Hive OS] Failed to fetch snapshot for company ${companyRecordId}:`,
      error
    );
    return null;
  }
}

/**
 * Parse key issues from text fields
 * Splits by newlines, bullets, or semicolons
 */
function parseKeyIssues(text: string): string[] {
  if (!text) return [];

  return text
    .split(/\n|;/)
    .map((line) => line.trim().replace(/^[•\-*]\s*/, ''))
    .filter((line) => line.length > 0);
}

/**
 * Fetch diagnostics for a company from Full Reports table
 */
export async function fetchDiagnosticsFromAirtable(
  companyRecordId: CompanyId
): Promise<Diagnostics | null> {
  try {
    const base = getBase();

    // Find the latest Full Report for this company
    const records = await base(FULL_REPORTS_TABLE)
      .select({
        filterByFormula: `{Lead} = '${companyRecordId}'`,
        maxRecords: 1,
        sort: [{ field: 'Generated Date', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    const fields = record.fields;

    // Extract scores
    const overallScore = (fields['Overall Score'] as number) || 0;
    const brandScore = (fields['Brand Score'] as number) || 0;
    const contentScore = (fields['Content Score'] as number) || 0;
    const websiteScore = (fields['Website Score'] as number) || 0;
    const seoScore = (fields['SEO Score'] as number) || brandScore; // Fallback to brand score

    // Extract key issues from "Opportunities (Short)" and "Emerging Risks"
    const opportunitiesText = (fields['Opportunities (Short)'] as string) || '';
    const risksText = (fields['Emerging Risks'] as string) || '';

    const keyIssues = [
      ...parseKeyIssues(opportunitiesText),
      ...parseKeyIssues(risksText),
    ].slice(0, 10); // Limit to top 10

    return {
      companyId: companyRecordId,
      snapshotId: record.id, // Using Full Report ID as snapshotId
      overallScore,
      websiteScore,
      brandScore,
      contentScore,
      seoScore,
      keyIssues,
    };
  } catch (error: any) {
    // Silently return null for NOT_AUTHORIZED or TABLE_NOT_FOUND errors
    // Full Reports table is optional/legacy
    if (error?.statusCode !== 403 && error?.statusCode !== 404 &&
        error?.error !== 'NOT_AUTHORIZED' && error?.error !== 'TABLE_NOT_FOUND') {
      console.warn(
        `[Hive OS] Failed to fetch diagnostics for company ${companyRecordId}:`,
        error
      );
    }
    return null;
  }
}

/**
 * Categorize a priority based on keywords
 */
function categorizePriority(text: string): PriorityItem['category'] {
  const lower = text.toLowerCase();

  if (lower.includes('seo') || lower.includes('search')) return 'seo';
  if (lower.includes('content') || lower.includes('blog')) return 'content';
  if (
    lower.includes('homepage') ||
    lower.includes('navigation') ||
    lower.includes('ux') ||
    lower.includes('website')
  )
    return 'website';
  if (lower.includes('brand') || lower.includes('identity')) return 'brand';
  if (lower.includes('funnel') || lower.includes('conversion'))
    return 'funnel';

  return 'strategy';
}

/**
 * Fetch priorities for a company from Full Reports table
 */
export async function fetchPrioritiesFromAirtable(
  companyRecordId: CompanyId
): Promise<PriorityItem[]> {
  try {
    const base = getBase();

    // Find the latest Full Report for this company
    const records = await base(FULL_REPORTS_TABLE)
      .select({
        filterByFormula: `{Lead} = '${companyRecordId}'`,
        maxRecords: 1,
        sort: [{ field: 'Generated Date', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return [];
    }

    const record = records[0];
    const fields = record.fields;

    // Extract opportunities from "Opportunities (Short)"
    const opportunitiesText = (fields['Opportunities (Short)'] as string) || '';
    const opportunities = parseKeyIssues(opportunitiesText);

    // Try to parse Raw JSON for quick wins
    let quickWins: string[] = [];
    try {
      const rawJson = fields['Raw JSON'] as string;
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        quickWins = parsed.quickWins || [];
      }
    } catch (e) {
      // Ignore parse errors
    }

    // Combine opportunities and quick wins into priorities
    const allItems = [...opportunities, ...quickWins];

    const priorities: PriorityItem[] = allItems.map((item, index) => {
      // Earlier items have higher impact
      const impact = Math.max(10 - index, 5);
      const effort = 5; // Default medium effort

      return {
        id: `pri-${companyRecordId}-${index}`,
        companyId: companyRecordId,
        title: item.length > 80 ? item.substring(0, 77) + '...' : item,
        description: item,
        impact,
        effort,
        category: categorizePriority(item),
        status: 'not_started',
      };
    });

    return priorities;
  } catch (error) {
    // Silently return empty for NOT_AUTHORIZED or TABLE_NOT_FOUND errors
    // Full Reports table is optional/legacy
    if ((error as any)?.statusCode !== 403 && (error as any)?.statusCode !== 404 &&
        (error as any)?.error !== 'NOT_AUTHORIZED' && (error as any)?.error !== 'TABLE_NOT_FOUND') {
      console.warn(
        `[Hive OS] Failed to fetch priorities for company ${companyRecordId}:`,
        error
      );
    }
    return [];
  }
}

/**
 * Fetch growth plan for a company from Full Reports table
 */
export async function fetchGrowthPlanFromAirtable(
  companyRecordId: CompanyId
): Promise<GrowthPlan | null> {
  try {
    const base = getBase();

    // Find the latest Full Report for this company
    const records = await base(FULL_REPORTS_TABLE)
      .select({
        filterByFormula: `{Lead} = '${companyRecordId}'`,
        maxRecords: 1,
        sort: [{ field: 'Generated Date', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    const fields = record.fields;

    // Extract plan data
    const headlineSummary =
      (fields['One Sentence Summary'] as string) ||
      'Growth plan analysis available.';

    // Build recommended focus areas from multiple sources
    const recommendedFocusAreas: string[] = [];

    if (fields['90-Say Priority Theme']) {
      recommendedFocusAreas.push(fields['90-Say Priority Theme'] as string);
    }
    if (fields['Maturity Stage']) {
      recommendedFocusAreas.push(
        `Stage: ${fields['Maturity Stage'] as string}`
      );
    }

    // Create plan sections from available data
    const planSections: GrowthPlan['planSections'] = [];

    // Section 1: Strengths
    if (fields['Strengths (Short)']) {
      const strengthsText = fields['Strengths (Short)'] as string;
      planSections.push({
        id: 'strengths',
        title: 'Strengths',
        summary: strengthsText,
        recommendedActions: parseKeyIssues(strengthsText).slice(0, 3),
      });
    }

    // Section 2: Opportunities
    if (fields['Opportunities (Short)']) {
      const oppsText = fields['Opportunities (Short)'] as string;
      planSections.push({
        id: 'opportunities',
        title: 'Opportunities',
        summary: oppsText,
        recommendedActions: parseKeyIssues(oppsText).slice(0, 5),
      });
    }

    // Section 3: Emerging Risks
    if (fields['Emerging Risks']) {
      const risksText = fields['Emerging Risks'] as string;
      planSections.push({
        id: 'risks',
        title: 'Emerging Risks',
        summary: risksText,
        recommendedActions: parseKeyIssues(risksText),
      });
    }

    // Section 4: Competitive Positioning
    if (fields['Competitor Teaser']) {
      const compText = fields['Competitor Teaser'] as string;
      planSections.push({
        id: 'competitive',
        title: 'Competitive Positioning',
        summary: compText,
        recommendedActions: parseKeyIssues(compText),
      });
    }

    return {
      companyId: companyRecordId,
      snapshotId: record.id,
      headlineSummary,
      recommendedFocusAreas,
      planSections,
    };
  } catch (error: any) {
    // Silently return null for NOT_AUTHORIZED or TABLE_NOT_FOUND errors
    // Full Reports table is optional/legacy
    if (error?.statusCode !== 403 && error?.statusCode !== 404 &&
        error?.error !== 'NOT_AUTHORIZED' && error?.error !== 'TABLE_NOT_FOUND') {
      console.warn(
        `[Hive OS] Failed to fetch growth plan for company ${companyRecordId}:`,
        error
      );
    }
    return null;
  }
}

/**
 * Fetch latest Gap Run for a company (by website URL)
 */
export async function fetchLatestGapRunForCompanyFromAirtable(
  websiteUrl: string
): Promise<{
  status: string;
  stage?: string;
  updatedAt?: string;
  currentFinding?: string;
} | null> {
  try {
    const base = getBase();

    const records = await base(GAP_RUNS_TABLE)
      .select({
        filterByFormula: `{Website URL} = '${websiteUrl}'`,
        maxRecords: 1,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    const fields = record.fields;

    return {
      status: (fields['Status'] as string) || 'unknown',
      stage: (fields['Stage'] as string) || undefined,
      updatedAt: (fields['Updated At'] as string) || undefined,
      currentFinding: (fields['Current Finding'] as string) || undefined,
    };
  } catch (error) {
    console.warn(
      `[Hive OS] Failed to fetch gap run for ${websiteUrl}:`,
      error
    );
    return null;
  }
}

/**
 * Fetch scorecard for a company
 * For v1: creates a minimal scorecard from Companies + Full Reports dates/scores
 */
export async function fetchScorecardFromAirtable(
  companyRecordId: CompanyId
): Promise<CompanyScorecard | null> {
  try {
    const base = getBase();

    // Get all Full Reports for this company to build history
    const records = await base(FULL_REPORTS_TABLE)
      .select({
        filterByFormula: `{Lead} = '${companyRecordId}'`,
        sort: [{ field: 'Generated Date', direction: 'asc' }],
      })
      .all();

    if (records.length === 0) {
      return null;
    }

    const history: ScorecardPoint[] = records.map((record) => {
      const fields = record.fields;

      return {
        date: (fields['Generated Date'] as string) || new Date().toISOString(),
        overallScore: (fields['Overall Score'] as number) || undefined,
        notes: `Report generated`,
      };
    });

    return {
      companyId: companyRecordId,
      history,
    };
  } catch (error) {
    console.warn(
      `[Hive OS] Failed to fetch scorecard for company ${companyRecordId}:`,
      error
    );
    return null;
  }
}
