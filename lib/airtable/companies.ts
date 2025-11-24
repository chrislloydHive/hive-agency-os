// lib/airtable/companies.ts
// Helper functions for fetching company data from Airtable
//
// NOTE: Companies is a lean identity + CRM table.
// All diagnostics, scores, priorities, plans, and evidence live in the Full Reports table.
// Gap Runs tracks pipeline execution; Work Items tracks initiatives.

import { getBase } from '@/lib/airtable';
import { randomUUID } from 'crypto';

const COMPANIES_TABLE = process.env.AIRTABLE_COMPANIES_TABLE || 'Companies';
const FULL_REPORTS_TABLE = process.env.AIRTABLE_FULL_REPORTS_TABLE || 'Full Reports';

// ============================================================================
// Domain Normalization
// ============================================================================

/**
 * Normalize a URL/domain to a canonical form for deduplication
 *
 * Removes:
 * - Protocol (http://, https://)
 * - www. prefix
 * - Trailing slash
 * - Query params
 * - Port numbers
 *
 * Examples:
 * - "https://www.example.com/" → "example.com"
 * - "http://example.com/page?foo=bar" → "example.com"
 * - "www.example.com:8080" → "example.com"
 *
 * @param urlOrDomain - URL or domain string
 * @returns Normalized domain (e.g., "example.com")
 */
export function normalizeDomain(urlOrDomain: string): string {
  if (!urlOrDomain) {
    return 'unknown.com';
  }

  let domain = urlOrDomain.trim().toLowerCase();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove www. prefix
  domain = domain.replace(/^www\./, '');

  // Remove trailing slash
  domain = domain.replace(/\/$/, '');

  // Remove query params
  domain = domain.split('?')[0];

  // Remove port
  domain = domain.split(':')[0];

  // Extract just the domain (remove path)
  domain = domain.split('/')[0];

  // If empty after normalization, return unknown
  if (!domain) {
    return 'unknown.com';
  }

  return domain;
}

/**
 * Convert domain to proper company name
 *
 * Enriches domain names to be more readable:
 * - "bmw.com" → "BMW"
 * - "nike.com" → "Nike"
 * - "mobile-pack.com" → "Mobile Pack"
 *
 * @param domain - Normalized domain (e.g., "example.com")
 * @returns Enriched company name
 */
export function domainToCompanyName(domain: string): string {
  if (!domain) return 'Unknown Company';

  // Handle malformed domains
  if (domain.length <= 2 || domain === 'https' || domain === 'http') {
    return 'Unknown Company';
  }

  // Remove TLD (.com, .io, .co, etc.)
  let name = domain.split('.')[0];

  // Known acronyms (all caps)
  const acronyms = ['bmw', 'gm', 'nfl', 'nba', 'ibm', 'aws', 'hp', 'lg', 'ge', 'ca'];
  if (acronyms.includes(name.toLowerCase())) {
    return name.toUpperCase();
  }

  // Known brands with specific casing
  const knownBrands: Record<string, string> = {
    nike: 'Nike',
    ford: 'Ford',
    kia: 'Kia',
    microsoft: 'Microsoft',
    hubspot: 'HubSpot',
    trainrhub: 'TrainrHub',
    acmesaas: 'Acme SaaS',
    dummytest: 'Dummy Test',
    portagebank: 'Portage Bank',
  };
  if (knownBrands[name.toLowerCase()]) {
    return knownBrands[name.toLowerCase()];
  }

  // Replace hyphens with spaces
  name = name.replace(/-/g, ' ');

  // Detect compound words and add spaces
  const withSpaces = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/([a-z])(bank|test|hub|health|home|pack|mobile)/gi, '$1 $2')
    .replace(/(north|south|east|west|dummy|portage)([a-z])/gi, '$1 $2');

  // Capitalize first letter of each word
  const capitalized = withSpaces
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return capitalized || 'Unknown Company';
}

/**
 * Map Airtable record fields to CompanyRecord
 * Centralizes field mapping logic to ensure consistency
 */
function mapFieldsToCompanyRecord(record: any): CompanyRecord {
  const fields = record.fields;

  // Extract domain from website if not explicitly set
  const website = (fields['Website'] as string) || (fields['URL'] as string) || undefined;
  const domain = (fields['Domain'] as string) || (website ? normalizeDomain(website) : 'unknown.com');

  return {
    id: record.id,
    airtableRecordId: record.id, // Alias for clarity when linking
    companyId: (fields['Company ID'] as string) || record.id, // Fallback to record ID if Company ID not set
    name: (fields['Name'] as string) || (fields['Company Name'] as string) || 'Unknown Company',
    domain,
    website,
    industry: (fields['Industry'] as string) || undefined,
    companyType: (fields['Company Type'] as string) as CompanyRecord['companyType'] | undefined,
    stage: (fields['Stage'] as string) as CompanyRecord['stage'] | undefined,
    lifecycleStatus: (fields['Lifecycle Status'] as string) || undefined,
    tier: (fields['Tier'] as string) as CompanyRecord['tier'] | undefined,
    sizeBand: (fields['Size Band'] as string) as CompanyRecord['sizeBand'] | undefined,
    region: (fields['Region'] as string) || undefined,
    owner: (fields['Owner'] as string) || undefined,
    tags: (fields['Tags'] as string[]) || undefined,
    source: (fields['Source'] as string) as CompanyRecord['source'] | undefined,
    primaryContactName: (fields['Primary Contact Name'] as string) || undefined,
    primaryContactEmail: (fields['Primary Contact Email'] as string) || undefined,
    primaryContactRole: (fields['Primary Contact Role'] as string) || undefined,
    createdAt: (fields['Created At'] as string) || undefined,
    updatedAt: (fields['Updated At'] as string) || undefined,
    notes: (fields['Notes'] as string) || undefined,
    internalNotes: (fields['Internal Notes'] as string) || undefined,

    // Telemetry fields
    ga4PropertyId: (fields['GA4 Property ID'] as string) || undefined,
    ga4Linked: (fields['GA4 Linked'] as boolean) || undefined,
    primaryConversionEvents: (fields['Primary Conversion Events'] as string[]) || undefined,
    searchConsoleSiteUrl: (fields['Search Console Site URL'] as string) || undefined,
  };
}

/**
 * Company record matching the new Airtable schema.
 * Identity & CRM fields only - no scores or diagnostics.
 */
export type CompanyRecord = {
  id: string; // Airtable record ID (e.g., "recXXXXXXXXXXXXXX")
  airtableRecordId?: string; // Alias for id - for clarity when linking records
  companyId: string; // Canonical company identifier (UUID) - stable across all tables
  name: string;
  domain: string; // Normalized domain (e.g., "example.com") - used for deduplication
  website?: string; // Full URL (e.g., "https://example.com")
  industry?: string;
  companyType?: 'SaaS' | 'Services' | 'Marketplace' | 'eCom' | 'Local' | 'Other';
  stage?: 'Prospect' | 'Client' | 'Internal' | 'Dormant' | 'Lost';
  lifecycleStatus?: string;
  tier?: 'A' | 'B' | 'C';
  sizeBand?: '1–10' | '11–50' | '51–200' | '200+';
  region?: string;
  owner?: string;
  tags?: string[];
  source?: 'Referral' | 'Inbound' | 'Outbound' | 'Internal' | 'Other';
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactRole?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  internalNotes?: string;

  // Telemetry integration fields
  ga4PropertyId?: string;
  ga4Linked?: boolean; // true if we should attempt to query GA4
  primaryConversionEvents?: string[]; // e.g., ["generate_lead", "form_submit"]
  searchConsoleSiteUrl?: string;
};

/**
 * Fetch a company by its Airtable record ID
 *
 * @param companyId - Airtable record ID (e.g., "recXXXXXXXXXXXXXX")
 * @returns Company record or null if not found
 */
export async function getCompanyById(
  companyId: string
): Promise<CompanyRecord | null> {
  try {
    const base = getBase();
    const record = await base(COMPANIES_TABLE).find(companyId);

    if (!record) {
      return null;
    }

    return mapFieldsToCompanyRecord(record);
  } catch (error) {
    console.error(`[Airtable] Failed to fetch company ${companyId}:`, error);
    return null;
  }
}

/**
 * Fetch all companies from Airtable
 */
export async function getAllCompanies(): Promise<CompanyRecord[]> {
  try {
    const base = getBase();
    const records = await base(COMPANIES_TABLE)
      .select({
        pageSize: 100,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    return records.map(mapFieldsToCompanyRecord);
  } catch (error) {
    console.error('[Airtable] Failed to fetch companies:', error);
    return [];
  }
}

/**
 * List companies for Hive OS dashboard
 * Returns recent companies with proper sorting
 */
export async function listCompaniesForOs(limit: number = 50): Promise<CompanyRecord[]> {
  try {
    const base = getBase();
    const records = await base(COMPANIES_TABLE)
      .select({
        maxRecords: limit,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .all();

    return records.map(mapFieldsToCompanyRecord);
  } catch (error) {
    console.error('[Airtable] Failed to list companies for OS:', error);
    return [];
  }
}

/**
 * Update company meta fields (stage, lifecycle status, tier, owner, tags, internal notes)
 *
 * @param params - Object containing companyId and optional meta fields to update
 * @returns Updated company record or null on error
 */
export async function updateCompanyMeta(params: {
  companyId: string;
  stage?: CompanyRecord['stage'];
  lifecycleStatus?: CompanyRecord['lifecycleStatus'];
  tier?: CompanyRecord['tier'];
  owner?: string;
  tags?: string[];
  internalNotes?: string;
}): Promise<CompanyRecord | null> {
  try {
    const { companyId, ...metaFields } = params;

    // Build Airtable field mappings (only include defined fields)
    const fields: Record<string, unknown> = {};

    if (metaFields.stage !== undefined) {
      fields['Stage'] = metaFields.stage;
    }
    if (metaFields.lifecycleStatus !== undefined) {
      fields['Lifecycle Status'] = metaFields.lifecycleStatus;
    }
    if (metaFields.tier !== undefined) {
      fields['Tier'] = metaFields.tier;
    }
    if (metaFields.owner !== undefined) {
      fields['Owner'] = metaFields.owner;
    }
    if (metaFields.tags !== undefined) {
      fields['Tags'] = metaFields.tags;
    }
    if (metaFields.internalNotes !== undefined) {
      fields['Internal Notes'] = metaFields.internalNotes;
    }

    // If no fields to update, return current record
    if (Object.keys(fields).length === 0) {
      return getCompanyById(companyId);
    }

    const base = getBase();
    await base(COMPANIES_TABLE).update(companyId, fields as any);

    // Return the updated record in our format
    return getCompanyById(companyId);
  } catch (error) {
    console.error(`[Airtable] Failed to update company meta for ${params.companyId}:`, error);
    return null;
  }
}

// ============================================================================
// Find or Create Company (Master Deduplication Logic)
// ============================================================================

/**
 * Find or create a company by domain
 *
 * This is the MASTER function for ensuring company identity is stable across the system.
 * All pipelines (Snapshot → GAP → Heavy → Leads) MUST call this before creating new records.
 *
 * Steps:
 * 1. Normalize the domain (strip protocol, www, trailing slash, query params)
 * 2. Search for existing company by normalized domain
 * 3. If found → return existing { companyId, companyRecord }
 * 4. If not found → create new company with UUID companyId
 *
 * @param urlOrDomain - URL or domain string (e.g., "https://example.com", "example.com")
 * @param options - Optional company metadata to set on creation
 * @returns { companyId, companyRecord, isNew } - Company ID and record
 */
export async function findOrCreateCompanyByDomain(
  urlOrDomain: string,
  options?: {
    companyName?: string;
    companyType?: CompanyRecord['companyType'];
    tier?: CompanyRecord['tier'];
    lifecycleStatus?: string;
    stage?: CompanyRecord['stage'];
    source?: CompanyRecord['source'];
  }
): Promise<{ companyId: string; companyRecord: CompanyRecord; isNew: boolean }> {
  try {
    const base = getBase();

    // Step 1: Normalize domain
    const normalizedDomain = normalizeDomain(urlOrDomain);
    console.log(`[Companies] Finding or creating company for domain: ${normalizedDomain} (from: ${urlOrDomain})`);

    // Step 2: Search for existing company by domain
    const existingRecords = await base(COMPANIES_TABLE)
      .select({
        filterByFormula: `{Domain} = "${normalizedDomain}"`,
        maxRecords: 1,
      })
      .firstPage();

    // Step 3: If found, return existing
    if (existingRecords.length > 0) {
      const existingRecord = existingRecords[0];
      const companyRecord = mapFieldsToCompanyRecord(existingRecord);
      console.log(`[Companies] ✅ Found existing company: ${companyRecord.name} (${companyRecord.companyId})`);
      console.log(`[Companies] Airtable record ID: ${existingRecord.id}, Company ID (UUID): ${companyRecord.companyId}`);

      return {
        companyId: companyRecord.companyId,
        companyRecord,
        isNew: false,
      };
    }

    // Step 4: Not found → create new company
    const newCompanyId = randomUUID();
    const now = new Date().toISOString();

    const fields: Record<string, unknown> = {
      'Company ID': newCompanyId,
      'Domain': normalizedDomain,
      'Website': urlOrDomain, // Store original URL
      'Company Name': options?.companyName || domainToCompanyName(normalizedDomain),
    };

    // Optional metadata - only add fields that exist in Airtable
    if (options?.companyType) {
      fields['Company Type'] = options.companyType;
    }
    if (options?.stage) {
      fields['Stage'] = options.stage;
    }
    // Note: Tier, Source, Lifecycle Status fields don't exist in Companies table

    console.log(`[Companies] Creating new company:`, {
      companyId: newCompanyId,
      domain: normalizedDomain,
      name: fields['Company Name'],
    });

    const createdRecords = await base(COMPANIES_TABLE).create([{ fields: fields as any }]);
    const createdRecord = createdRecords[0];
    const companyRecord = mapFieldsToCompanyRecord(createdRecord);

    console.log(`[Companies] ✅ Created new company: ${companyRecord.name} (${companyRecord.companyId})`);
    console.log(`[Companies] Airtable record ID: ${createdRecord.id}, Company ID (UUID): ${newCompanyId}`);

    return {
      companyId: newCompanyId,
      companyRecord,
      isNew: true,
    };
  } catch (error) {
    console.error(`[Companies] ❌ Failed to find or create company for ${urlOrDomain}:`, error);
    throw error;
  }
}

/**
 * Get company by canonical companyId (UUID)
 *
 * This is different from getCompanyById which takes Airtable record ID.
 * This searches by the stable Company ID field.
 *
 * @param companyId - Canonical company ID (UUID)
 * @returns Company record or null if not found
 */
export async function getCompanyByCanonicalId(
  companyId: string
): Promise<CompanyRecord | null> {
  try {
    const base = getBase();
    const records = await base(COMPANIES_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapFieldsToCompanyRecord(records[0]);
  } catch (error) {
    console.error(`[Companies] Failed to fetch company by canonical ID ${companyId}:`, error);
    return null;
  }
}

// ============================================================================
// OS Summary (from Full Reports)
// ============================================================================

/**
 * OS summary data for a company (derived from latest OS Full Report)
 */
export type CompanyOsSummary = {
  companyId: string;
  overallScore?: number | null;
  status?: string | null; // OK / Needs Attention / Critical
  lastOsReportDate?: string | null; // ISO string / formatted date
};

/**
 * Company record enriched with latest OS summary
 */
export type CompanyWithOsSummary = CompanyRecord & {
  osSummary?: CompanyOsSummary;
};

/**
 * Fetch all companies with their latest OS summary (if available)
 *
 * This joins Companies with the latest OS Full Report per company.
 * Companies without any OS reports will have osSummary = undefined.
 *
 * @returns Array of companies with optional OS summary data
 */
export async function getCompaniesWithOsSummary(): Promise<CompanyWithOsSummary[]> {
  try {
    console.log('[Companies] Fetching companies with OS summaries...');
    const base = getBase();

    // 1. Fetch all companies
    const companies = await getAllCompanies();
    console.log(`[Companies] Found ${companies.length} companies`);

    // 2. Fetch all OS Full Reports
    const fullReports = await base(FULL_REPORTS_TABLE)
      .select({
        filterByFormula: `{Report Type} = 'OS'`,
        sort: [{ field: 'Report Date', direction: 'desc' }],
        fields: [
          'Company',
          'Overall Score',
          'Status',
          'Report Date',
          'Report Type',
        ],
      })
      .all();

    console.log(`[Companies] Found ${fullReports.length} OS Full Reports`);

    // 3. Build a map of companyId → latest OS summary
    const osSummaryMap = new Map<string, CompanyOsSummary>();

    for (const report of fullReports) {
      const fields = report.fields;

      // Extract company ID from link field (array of IDs)
      const companyIds = fields['Company'] as string[] | undefined;
      if (!companyIds || companyIds.length === 0) {
        continue;
      }

      const companyId = companyIds[0];

      // Only keep the latest report per company (since we're sorted by date desc)
      if (osSummaryMap.has(companyId)) {
        continue;
      }

      const overallScore = fields['Overall Score'] as number | undefined;
      const status = fields['Status'] as string | undefined;
      const reportDate = fields['Report Date'] as string | undefined;

      osSummaryMap.set(companyId, {
        companyId,
        overallScore: overallScore ?? null,
        status: status ?? null,
        lastOsReportDate: reportDate ?? null,
      });
    }

    console.log(`[Companies] Built OS summaries for ${osSummaryMap.size} companies`);

    // 4. Merge companies with their OS summaries
    const companiesWithSummaries: CompanyWithOsSummary[] = companies.map((company) => {
      const osSummary = osSummaryMap.get(company.id);
      return {
        ...company,
        osSummary,
      };
    });

    return companiesWithSummaries;
  } catch (error) {
    console.error('[Companies] Failed to fetch companies with OS summaries:', error);
    // Return companies without OS summaries on error
    const companies = await getAllCompanies();
    return companies.map((company) => ({ ...company }));
  }
}
