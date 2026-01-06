// lib/airtable/companies.ts
// Helper functions for fetching company data from Airtable
//
// NOTE: Companies is a lean identity + CRM table.
// All diagnostics, scores, priorities, plans, and evidence live in the Full Reports table.
// Gap Runs tracks pipeline execution; Work Items tracks initiatives.

import { getBase } from '@/lib/airtable';
import { randomUUID } from 'crypto';
import type { AnalyticsBlueprint } from '@/lib/analytics/blueprintTypes';

// Re-export shared types and utilities from client-safe types file
export {
  type CompanyStage,
  type MediaProgramStatus,
  stageLabelToSlug,
  stageSlugToLabel,
  COMPANY_STAGE_OPTIONS,
  parseCompanyStage,
  getStageLabel,
  isMediaProgramActive,
} from '@/lib/types/company';

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

  // Media Program Status mapping
  const mediaProgramStatusRaw = (fields['Media Program Status'] as string | undefined) ?? 'none';
  const mediaProgramStatus: import('@/lib/types/company').MediaProgramStatus =
    mediaProgramStatusRaw === 'active' ? 'active' : 'none';
  const hasMediaProgram = mediaProgramStatus === 'active';

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
    icpFitScore: (fields['ICP Fit Score'] as string) as CompanyRecord['icpFitScore'] | undefined,
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

    // Health override fields
    healthOverride: (fields['Health Override'] as 'Healthy' | 'At Risk' | null) || undefined,
    atRiskFlag: (fields['At Risk Flag'] as boolean) || undefined,
    // Drive eligibility flags (optional)
    isClient: (fields['Is Client'] as boolean) || undefined,
    driveEligible: (fields['Drive Eligible'] as boolean) || undefined,
    driveProvisioningAllowed: (fields['Drive Provisioning Allowed'] as boolean) || undefined,

    // Analytics Blueprint (stored as JSON string in Airtable)
    analyticsBlueprint: parseAnalyticsBlueprint(fields['Analytics Blueprint JSON'] as string),

    // Media Program fields
    mediaProgramStatus,
    hasMediaProgram,

    // Media Lab fields (strategic planning)
    mediaLabStatus: parseMediaLabStatus(fields['Media Status'] as string | undefined),
    mediaPrimaryObjective: parseMediaObjective(fields['Media Primary Objective'] as string | undefined),
    mediaLabNotes: (fields['Media Notes'] as string) || undefined,

    // DMA Integration fields (Phase 3 - optional)
    primaryDomain: domain, // Alias for domain
    isFromDMA: (fields['Is From DMA'] as boolean) || undefined,
    firstLeadSource: (fields['First Lead Source'] as string) || undefined,
    firstLeadAt: (fields['First Lead At'] as string) || undefined,

    // Jobs Integration fields
    clientCode: (fields['Client Code'] as string) || undefined,
    driveClientFolderId: (fields['Drive Client Folder ID'] as string) || undefined,
    driveProjectsFolderId: (fields['Drive Projects Folder ID'] as string) || undefined,

    // MSA fields
    msaDriveFileId: (fields['MSA Drive File ID'] as string) || undefined,
    msaDriveUrl: (fields['MSA Drive URL'] as string) || undefined,
    msaFolderId: (fields['MSA Folder ID'] as string) || undefined,
  };
}

/**
 * Parse Media Lab status from Airtable
 */
function parseMediaLabStatus(raw: string | undefined): 'none' | 'planning' | 'running' | 'paused' | undefined {
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  const valid = ['none', 'planning', 'running', 'paused'];
  return valid.includes(normalized) ? (normalized as 'none' | 'planning' | 'running' | 'paused') : undefined;
}

/**
 * Parse Media objective from Airtable
 */
function parseMediaObjective(raw: string | undefined): 'installs' | 'leads' | 'store_visits' | 'calls' | 'awareness' | undefined {
  if (!raw) return undefined;
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  const valid = ['installs', 'leads', 'store_visits', 'calls', 'awareness'];
  return valid.includes(normalized) ? (normalized as 'installs' | 'leads' | 'store_visits' | 'calls' | 'awareness') : undefined;
}

/**
 * Parse Analytics Blueprint JSON from Airtable
 */
function parseAnalyticsBlueprint(json: string | undefined | null): AnalyticsBlueprint | null {
  if (!json || typeof json !== 'string') return null;
  try {
    return JSON.parse(json) as AnalyticsBlueprint;
  } catch (error) {
    console.warn('[Companies] Failed to parse Analytics Blueprint JSON:', error);
    return null;
  }
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
  sizeBand?: '1-10' | '11-50' | '51-200' | '200+';
  region?: string;
  owner?: string;
  tags?: string[];
  source?: 'Referral' | 'Inbound' | 'Outbound' | 'Internal' | 'Other' | 'Full GAP' | 'GAP IA' | 'Manual Entry' | 'DMA';
  icpFitScore?: 'A' | 'B' | 'C'; // ICP Fit Score from wizard
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactRole?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  internalNotes?: string;

  // DMA Integration Fields (Phase 3)
  /** Normalized primary domain for deduplication (alias for domain) */
  primaryDomain?: string;
  /** True if company was originally created from a DMA lead */
  isFromDMA?: boolean;
  /** Source of the first lead that created/touched this company */
  firstLeadSource?: string;
  /** Timestamp of the first lead that created/touched this company */
  firstLeadAt?: string;

  // Telemetry integration fields
  ga4PropertyId?: string;
  ga4Linked?: boolean; // true if we should attempt to query GA4
  primaryConversionEvents?: string[]; // e.g., ["generate_lead", "form_submit"]
  searchConsoleSiteUrl?: string;

  // Health override fields (for manual health management)
  healthOverride?: 'Healthy' | 'At Risk' | null; // Manual health override - takes precedence over computed health
  atRiskFlag?: boolean; // Manual "At Risk" flag - forces At Risk status when true

  // Drive eligibility flags
  isClient?: boolean; // Whether company is a client (eligible for Drive provisioning)
  driveEligible?: boolean; // Whether company is eligible for Drive folder provisioning
  driveProvisioningAllowed?: boolean; // Manual override - allows provisioning when true

  // Analytics Blueprint (AI-generated configuration for which metrics to show)
  analyticsBlueprint?: AnalyticsBlueprint | null;

  // Media Program fields (operational - from Media tables)
  mediaProgramStatus: import('@/lib/types/company').MediaProgramStatus; // "none" | "active"
  hasMediaProgram: boolean; // Convenience boolean derived from mediaProgramStatus

  // Media Lab fields (strategic planning - from Companies table)
  mediaLabStatus?: 'none' | 'planning' | 'running' | 'paused'; // Media Lab status
  mediaPrimaryObjective?: 'installs' | 'leads' | 'store_visits' | 'calls' | 'awareness'; // Primary media objective
  mediaLabNotes?: string; // Freeform notes for media planning

  // Jobs Integration Fields
  /** 3-letter client code for job numbering (e.g., "CAR" for Car Toys) */
  clientCode?: string;
  /** Google Drive folder ID for client root folder: WORK/{Client Name} */
  driveClientFolderId?: string;
  /** Google Drive folder ID for projects folder: WORK/{Client Name}/*Projects */
  driveProjectsFolderId?: string;

  // MSA Fields (Master Services Agreement)
  /** Google Drive file ID for the company's MSA document */
  msaDriveFileId?: string;
  /** Google Drive URL for the company's MSA document */
  msaDriveUrl?: string;
  /** Google Drive folder ID for MSA storage: WORK/{Client Name}/MSA */
  msaFolderId?: string;
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
    let base;
    try {
      base = getBase();
    } catch (baseError: any) {
      console.error(`[Airtable] Failed to initialize base for company ${companyId}:`, baseError?.message || baseError);
      return null;
    }
    const record = await base(COMPANIES_TABLE).find(companyId);

    if (!record) {
      return null;
    }

    return mapFieldsToCompanyRecord(record);
  } catch (error: any) {
    // Airtable SDK errors have statusCode, error, and message properties
    // Common errors: 404 (not found), 401 (auth), 403 (forbidden)
    const statusCode = error?.statusCode;
    const message = error?.message || error?.error || 'Unknown error';

    // Silent return for expected errors (not found, auth issues)
    if (statusCode === 404 || statusCode === 401 || statusCode === 403) {
      return null;
    }

    // Only log unexpected errors
    console.warn(`[Airtable] Failed to fetch company ${companyId}: ${message} (status: ${statusCode || 'unknown'})`);
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
// Analytics Blueprint Updates
// ============================================================================

/**
 * Update a company's Analytics Blueprint
 *
 * @param companyId - Airtable record ID
 * @param blueprint - The AnalyticsBlueprint to save
 * @returns Updated company record or null on failure
 */
export async function updateCompanyAnalyticsBlueprint(
  companyId: string,
  blueprint: AnalyticsBlueprint
): Promise<CompanyRecord | null> {
  try {
    const base = getBase();

    await base(COMPANIES_TABLE).update(companyId, {
      'Analytics Blueprint JSON': JSON.stringify(blueprint),
    } as any);

    console.log(`[Companies] Updated Analytics Blueprint for company ${companyId}`);

    // Return the updated record
    return getCompanyById(companyId);
  } catch (error) {
    console.error(`[Companies] Failed to update Analytics Blueprint for ${companyId}:`, error);
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
 * Find company by domain only (without creating)
 *
 * @param domain - Domain to search for (will be normalized)
 * @returns Company record or null if not found
 */
export async function findCompanyByDomain(
  domain: string
): Promise<CompanyRecord | null> {
  try {
    const base = getBase();
    const normalizedDomain = normalizeDomain(domain);

    const records = await base(COMPANIES_TABLE)
      .select({
        filterByFormula: `{Domain} = "${normalizedDomain}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapFieldsToCompanyRecord(records[0]);
  } catch (error) {
    console.error(`[Companies] Failed to find company by domain ${domain}:`, error);
    return null;
  }
}

/**
 * Find company by name (exact or fuzzy match)
 *
 * @param name - Company name to search for
 * @param fuzzy - If true, uses SEARCH for partial matching
 * @returns Company record or null if not found
 */
export async function findCompanyByName(
  name: string,
  fuzzy: boolean = false
): Promise<CompanyRecord | null> {
  try {
    const base = getBase();

    // Normalize for comparison
    const searchName = name.trim();
    const formula = fuzzy
      ? `SEARCH(LOWER("${searchName}"), LOWER({Company Name}))`
      : `LOWER({Company Name}) = LOWER("${searchName}")`;

    const records = await base(COMPANIES_TABLE)
      .select({
        filterByFormula: formula,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapFieldsToCompanyRecord(records[0]);
  } catch (error) {
    console.error(`[Companies] Failed to find company by name ${name}:`, error);
    return null;
  }
}

/**
 * Create a new company
 *
 * @param data - Company data to create
 * @returns Created company record or null on error
 */
export async function createCompany(data: {
  name: string;
  website?: string;
  domain?: string;
  industry?: string;
  companyType?: CompanyRecord['companyType'];
  stage?: CompanyRecord['stage'];
  sizeBand?: CompanyRecord['sizeBand'];
  source?: CompanyRecord['source'];
  icpFitScore?: CompanyRecord['icpFitScore'];
  owner?: string;
  notes?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
}): Promise<CompanyRecord | null> {
  try {
    const base = getBase();
    const newCompanyId = randomUUID();

    // Normalize domain from website if not provided
    const normalizedDomain = data.domain
      ? normalizeDomain(data.domain)
      : data.website
        ? normalizeDomain(data.website)
        : 'unknown.com';

    const fields: Record<string, unknown> = {
      'Company ID': newCompanyId,
      'Company Name': data.name,
      'Domain': normalizedDomain,
    };

    if (data.website) fields['Website'] = data.website;
    if (data.industry) fields['Industry'] = data.industry;
    if (data.companyType) fields['Company Type'] = data.companyType;
    if (data.stage) fields['Stage'] = data.stage;
    if (data.sizeBand) fields['Size Band'] = data.sizeBand;
    if (data.source) fields['Source'] = data.source;
    if (data.icpFitScore) fields['ICP Fit Score'] = data.icpFitScore;
    if (data.owner) fields['Owner'] = data.owner;
    if (data.notes) fields['Notes'] = data.notes;
    if (data.primaryContactName) fields['Primary Contact Name'] = data.primaryContactName;
    if (data.primaryContactEmail) fields['Primary Contact Email'] = data.primaryContactEmail;

    console.log(`[Companies] Creating new company: ${data.name} (${normalizedDomain})`);

    const createdRecords = await base(COMPANIES_TABLE).create([{ fields: fields as any }]);
    const createdRecord = createdRecords[0];
    const companyRecord = mapFieldsToCompanyRecord(createdRecord);

    console.log(`[Companies] ✅ Created company: ${companyRecord.name} (ID: ${companyRecord.id})`);

    return companyRecord;
  } catch (error) {
    console.error(`[Companies] Failed to create company ${data.name}:`, error);
    return null;
  }
}

/**
 * Update company fields
 *
 * @param companyId - Airtable record ID
 * @param data - Fields to update
 * @returns Updated company record or null on error
 */
export async function updateCompany(
  companyId: string,
  data: {
    // Identity
    name?: string;
    website?: string;
    domain?: string;
    // Classification
    industry?: string;
    companyType?: CompanyRecord['companyType'];
    stage?: CompanyRecord['stage'];
    tier?: CompanyRecord['tier'];
    sizeBand?: CompanyRecord['sizeBand'];
    region?: string;
    source?: CompanyRecord['source'];
    lifecycleStatus?: string;
    // Contact
    owner?: string;
    primaryContactName?: string;
    primaryContactEmail?: string;
    primaryContactRole?: string;
    notes?: string;
    internalNotes?: string;
    tags?: string[];
    // ICP
    icpFitScore?: CompanyRecord['icpFitScore'];
    // Analytics
    ga4PropertyId?: string;
    ga4Linked?: boolean;
    primaryConversionEvents?: string[];
    searchConsoleSiteUrl?: string;
    // Health
    healthOverride?: CompanyRecord['healthOverride'];
    atRiskFlag?: boolean;
    // Drive/Jobs
    driveEligible?: boolean;
    driveProvisioningAllowed?: boolean;
    clientCode?: string;
    // Media
    mediaProgramStatus?: 'none' | 'active';
    mediaLabStatus?: 'none' | 'planning' | 'running' | 'paused';
    mediaPrimaryObjective?: 'installs' | 'leads' | 'store_visits' | 'calls' | 'awareness';
    mediaLabNotes?: string;
  }
): Promise<CompanyRecord | null> {
  try {
    // Debug: Log incoming data to help identify problematic values
    console.log(`[Companies] updateCompany called with data:`, JSON.stringify(data, null, 2));

    const base = getBase();
    const fields: Record<string, unknown> = {};

    // Helper: For select fields, convert empty string to null (clears selection)
    // Airtable rejects "" for select fields with "INVALID_MULTIPLE_CHOICE_OPTIONS"
    const selectValue = <T>(val: T | undefined): T | null | undefined => {
      if (val === undefined) return undefined;
      // Handle empty string - convert to null to clear the selection
      if (val === '' || val === '""') return null;
      // Handle any string that looks like it might be double-quoted
      if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
        const unquoted = val.slice(1, -1);
        return unquoted === '' ? null : unquoted as T;
      }
      return val;
    };

    // Identity (text fields - allow empty strings)
    if (data.name !== undefined) fields['Company Name'] = data.name;
    if (data.website !== undefined) fields['Website'] = data.website;
    if (data.domain !== undefined) fields['Domain'] = normalizeDomain(data.domain);

    // Classification - select fields need empty string → null conversion
    // Note: Using selectValue defensively for fields that might be select fields in Airtable
    if (data.industry !== undefined) fields['Industry'] = data.industry; // text field
    if (data.companyType !== undefined) fields['Company Type'] = selectValue(data.companyType);
    if (data.stage !== undefined) fields['Stage'] = selectValue(data.stage);
    if (data.tier !== undefined) fields['Tier'] = selectValue(data.tier);
    if (data.sizeBand !== undefined) fields['Size Band'] = selectValue(data.sizeBand);
    // Note: 'Region' field doesn't exist in Airtable - skipping
    if (data.source !== undefined) fields['Source'] = selectValue(data.source);
    if (data.lifecycleStatus !== undefined) fields['Lifecycle Status'] = selectValue(data.lifecycleStatus); // might be select

    // Contact
    if (data.owner !== undefined) fields['Owner'] = data.owner;
    if (data.primaryContactName !== undefined) fields['Primary Contact Name'] = data.primaryContactName;
    if (data.primaryContactEmail !== undefined) fields['Primary Contact Email'] = data.primaryContactEmail;
    // Note: 'Primary Contact Role' field doesn't exist in Airtable - skipping
    if (data.notes !== undefined) fields['Notes'] = data.notes;
    if (data.internalNotes !== undefined) fields['Internal Notes'] = data.internalNotes;
    if (data.tags !== undefined) fields['Tags'] = data.tags;

    // ICP - select field
    if (data.icpFitScore !== undefined) fields['ICP Fit Score'] = selectValue(data.icpFitScore);

    // Analytics - these fields may not exist, wrap in try/catch at API level
    if (data.ga4PropertyId !== undefined) fields['GA4 Property ID'] = data.ga4PropertyId;
    if (data.ga4Linked !== undefined) fields['GA4 Linked'] = data.ga4Linked;
    // Note: 'Primary Conversion Events' and 'Search Console Site URL' may not exist - skipping

    // Health - these fields may not exist
    // if (data.healthOverride !== undefined) fields['Health Override'] = data.healthOverride;
    // if (data.atRiskFlag !== undefined) fields['At Risk Flag'] = data.atRiskFlag;

    // Drive/Jobs
    if (data.driveEligible !== undefined) fields['Drive Eligible'] = data.driveEligible;
    if (data.driveProvisioningAllowed !== undefined) fields['Drive Provisioning Allowed'] = data.driveProvisioningAllowed;
    if (data.clientCode !== undefined) fields['Client Code'] = data.clientCode;

    // Media - select fields need empty string → null conversion
    if (data.mediaProgramStatus !== undefined) fields['Media Program Status'] = selectValue(data.mediaProgramStatus);
    if (data.mediaLabStatus !== undefined) fields['Media Status'] = selectValue(data.mediaLabStatus);
    if (data.mediaPrimaryObjective !== undefined) fields['Media Primary Objective'] = selectValue(data.mediaPrimaryObjective);
    if (data.mediaLabNotes !== undefined) fields['Media Notes'] = data.mediaLabNotes; // text field

    if (Object.keys(fields).length === 0) {
      return getCompanyById(companyId);
    }

    // Debug: Log field values to identify problematic empty strings
    console.log(`[Companies] Attempting to update company ${companyId}`);
    console.log(`[Companies] Field values being sent:`, JSON.stringify(fields, null, 2));
    console.log(`[Companies] Using table: ${COMPANIES_TABLE}`);
    console.log(`[Companies] AIRTABLE_COMPANIES_TABLE env:`, process.env.AIRTABLE_COMPANIES_TABLE || '(not set, using default)');

    // Debug: Check what API key is being used (first/last 4 chars only for security)
    const apiKeyFromEnv = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN || '';
    const keyPreview = apiKeyFromEnv ? `${apiKeyFromEnv.slice(0, 4)}...${apiKeyFromEnv.slice(-4)}` : '(empty)';
    console.log(`[Companies] API key preview: ${keyPreview}, length: ${apiKeyFromEnv.length}`);
    console.log(`[Companies] Base ID: ${process.env.AIRTABLE_BASE_ID || '(not set)'}`);

    // WORKAROUND: Create fresh Airtable instance to bypass potentially stale getBase() cache
    const Airtable = require('airtable');
    const freshBase = new Airtable({ apiKey: apiKeyFromEnv }).base(process.env.AIRTABLE_BASE_ID || '');
    console.log(`[Companies] Using fresh Airtable instance instead of cached getBase()`);

    // Try update with fresh instance
    try {
      await freshBase(COMPANIES_TABLE).update(companyId, fields as any);
      console.log(`[Companies] Updated company ${companyId}`);
    } catch (updateError: any) {
      if (updateError?.error === 'NOT_AUTHORIZED' || updateError?.statusCode === 403) {
        console.error(`[Companies] NOT_AUTHORIZED error - trying fields individually to isolate issue...`);
        const problematicFields: string[] = [];
        const successfulFields: string[] = [];

        // Try each field individually (using fresh instance)
        for (const [fieldName, fieldValue] of Object.entries(fields)) {
          try {
            await freshBase(COMPANIES_TABLE).update(companyId, { [fieldName]: fieldValue } as any);
            successfulFields.push(fieldName);
          } catch (fieldError: any) {
            const errMsg = fieldError?.message || fieldError?.error || JSON.stringify(fieldError);
            console.error(`[Companies] Field '${fieldName}' failed:`, errMsg);
            console.error(`[Companies] Full error:`, JSON.stringify(fieldError, null, 2));
            problematicFields.push(fieldName);
          }
        }

        // Log the base/table info for debugging
        console.error(`[Companies] Table: ${COMPANIES_TABLE}, Record: ${companyId}`);

        console.log(`[Companies] Successful fields:`, successfulFields);
        console.error(`[Companies] Problematic fields:`, problematicFields);

        if (problematicFields.length > 0) {
          throw new Error(`NOT_AUTHORIZED for fields: ${problematicFields.join(', ')}. These fields may not exist in Airtable or require different permissions.`);
        }
      }
      console.error(`[Companies] Failed to update company ${companyId}:`, updateError);
      throw updateError;
    }
    return getCompanyById(companyId);
  } catch (error) {
    console.error(`[Companies] Failed to update company ${companyId}:`, error);
    return null;
  }
}

/**
 * Upsert company by domain - finds existing or creates new
 *
 * Idempotency key: normalized domain
 *
 * @param domain - Domain or URL to normalize
 * @param name - Optional company name (uses domainToCompanyName if not provided)
 * @param website - Optional full website URL
 * @param source - Optional source tracking (e.g., "DMA")
 * @returns Company record (existing or newly created)
 */
export async function upsertCompanyByDomain(
  domain: string,
  name?: string,
  website?: string,
  source?: CompanyRecord['source']
): Promise<{ company: CompanyRecord; isNew: boolean }> {
  const normalizedDomain = normalizeDomain(domain);

  // Try to find existing company
  const existing = await findCompanyByDomain(normalizedDomain);
  if (existing) {
    console.log(`[Companies] Found existing company for domain ${normalizedDomain}: ${existing.id}`);
    return { company: existing, isNew: false };
  }

  // Create new company
  const companyName = name || domainToCompanyName(normalizedDomain);
  const newCompany = await createCompany({
    name: companyName,
    domain: normalizedDomain,
    website: website || `https://${normalizedDomain}`,
    source: source,
    stage: 'Prospect',
  });

  if (!newCompany) {
    throw new Error(`Failed to create company for domain ${normalizedDomain}`);
  }

  console.log(`[Companies] Created new company for domain ${normalizedDomain}: ${newCompany.id}`);
  return { company: newCompany, isNew: true };
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
  } catch (error: any) {
    // Silently fall back for NOT_AUTHORIZED or TABLE_NOT_FOUND errors
    // Full Reports table is optional/legacy
    if (error?.statusCode !== 403 && error?.statusCode !== 404 &&
        error?.error !== 'NOT_AUTHORIZED' && error?.error !== 'TABLE_NOT_FOUND') {
      console.error('[Companies] Failed to fetch companies with OS summaries:', error);
    }
    // Return companies without OS summaries on error
    const companies = await getAllCompanies();
    return companies.map((company) => ({ ...company }));
  }
}

// ============================================================================
// Jobs Integration (Drive Folder Management)
// ============================================================================

/**
 * Update company Drive folder IDs
 *
 * Used during job provisioning to cache folder IDs.
 *
 * @param companyId - Airtable record ID
 * @param data - Drive folder IDs to update
 * @returns Updated company record or null on error
 */
export async function updateCompanyDriveFolders(
  companyId: string,
  data: {
    driveClientFolderId?: string;
    driveProjectsFolderId?: string;
    driveStructureVersion?: string;
    driveFolderMap?: Record<string, unknown>;
  }
): Promise<CompanyRecord | null> {
  try {
    const base = getBase();
    const fields: Record<string, unknown> = {};

    if (data.driveClientFolderId !== undefined) {
      fields['Drive Client Folder ID'] = data.driveClientFolderId;
    }
    if (data.driveProjectsFolderId !== undefined) {
      fields['Drive Projects Folder ID'] = data.driveProjectsFolderId;
    }
    if (data.driveStructureVersion !== undefined) {
      fields['Drive Structure Version'] = data.driveStructureVersion;
    }
    if (data.driveFolderMap !== undefined) {
      fields['Drive Folder Map'] = JSON.stringify(data.driveFolderMap);
    }

    if (Object.keys(fields).length === 0) {
      return getCompanyById(companyId);
    }

    await base(COMPANIES_TABLE).update(companyId, fields as any);
    console.log(`[Companies] Updated Drive folders for company ${companyId}`);
    return getCompanyById(companyId);
  } catch (error) {
    console.error(`[Companies] Failed to update Drive folders for ${companyId}:`, error);
    return null;
  }
}

/**
 * Get companies that have clientCode set (eligible for job creation)
 */
export async function getCompaniesWithClientCode(): Promise<CompanyRecord[]> {
  try {
    const base = getBase();
    const records = await base(COMPANIES_TABLE)
      .select({
        filterByFormula: `AND({Client Code} != "", {Client Code} != BLANK())`,
        sort: [{ field: 'Company Name', direction: 'asc' }],
      })
      .all();

    return records.map(mapFieldsToCompanyRecord);
  } catch (error) {
    console.error('[Companies] Failed to get companies with client code:', error);
    return [];
  }
}

// ============================================================================
// MSA (Master Services Agreement) Management
// ============================================================================

/**
 * Update company MSA fields
 *
 * Used when provisioning MSA documents for a client.
 *
 * @param companyId - Airtable record ID
 * @param data - MSA field data to update
 * @returns Updated company record or null on error
 */
export async function updateCompanyMsa(
  companyId: string,
  data: {
    msaDriveFileId?: string;
    msaDriveUrl?: string;
    msaFolderId?: string;
  }
): Promise<CompanyRecord | null> {
  try {
    const base = getBase();
    const fields: Record<string, unknown> = {};

    if (data.msaDriveFileId !== undefined) {
      fields['MSA Drive File ID'] = data.msaDriveFileId;
    }
    if (data.msaDriveUrl !== undefined) {
      fields['MSA Drive URL'] = data.msaDriveUrl;
    }
    if (data.msaFolderId !== undefined) {
      fields['MSA Folder ID'] = data.msaFolderId;
    }

    if (Object.keys(fields).length === 0) {
      return getCompanyById(companyId);
    }

    await base(COMPANIES_TABLE).update(companyId, fields as any);
    console.log(`[Companies] Updated MSA fields for company ${companyId}`);
    return getCompanyById(companyId);
  } catch (error) {
    console.error(`[Companies] Failed to update MSA fields for ${companyId}:`, error);
    return null;
  }
}

/**
 * Get companies that have MSA provisioned
 */
export async function getCompaniesWithMsa(): Promise<CompanyRecord[]> {
  try {
    const base = getBase();
    const records = await base(COMPANIES_TABLE)
      .select({
        filterByFormula: `AND({MSA Drive File ID} != "", {MSA Drive File ID} != BLANK())`,
        sort: [{ field: 'Company Name', direction: 'asc' }],
      })
      .all();

    return records.map(mapFieldsToCompanyRecord);
  } catch (error) {
    console.error('[Companies] Failed to get companies with MSA:', error);
    return [];
  }
}
