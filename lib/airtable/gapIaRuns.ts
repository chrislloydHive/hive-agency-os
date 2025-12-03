// lib/airtable/gapIaRuns.ts
// Airtable storage for GAP-IA Run (Initial Assessment)

import {
  createRecord,
  updateRecord,
  getAirtableConfig,
} from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  GapIaRun,
  GapIaStatus,
  GapIaSource,
  CoreMarketingContext,
  MarketingMaturityStage,
} from '@/lib/gap/types';

const GAP_IA_RUN_TABLE = AIRTABLE_TABLES.GAP_IA_RUN;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

/**
 * Airtable fields for GAP-IA Run table:
 *
 * Core fields (always written):
 * - Website URL (url) - The website being analyzed
 * - Domain (text) - Normalized domain name
 * - Created At (date/time) - When the run was created
 * - Data JSON (long text) - ALL run data including:
 *   - source, status, updatedAt
 *   - core (CoreMarketingContext)
 *   - insights (GAP-IA insights)
 *   - scores (overall, brand, content, seo, website)
 *   - maturityStage, readinessScore
 *   - errorMessage
 *   - Link field IDs (companyId, inboundLeadId, gapPlanRunId, etc.)
 *
 * Note: All other fields (if they exist in the table) are not written by this code.
 * Everything is stored in Data JSON for consistency with other GAP tables.
 */

/**
 * Airtable record shape for GAP-IA Run
 */
export interface GapIaRunRecord {
  id: string;
  companyId?: string;
  inboundLeadId?: string;
  gapPlanRunId?: string;
  gapFullReportId?: string;
  gapHeavyRunId?: string;

  websiteUrl: string;
  domain: string;

  source: GapIaSource;
  status: GapIaStatus;

  overallScore?: number;
  brandScore?: number;
  contentScore?: number;
  seoScore?: number;
  websiteScore?: number;
  digitalFootprintScore?: number;
  authorityScore?: number;
  maturityStage?: MarketingMaturityStage;
  readinessScore?: number;

  coreJson?: string;
  insightsJson?: string;
  errorMessage?: string;

  createdAt: string;
  updatedAt: string;
}

function gapIaRunToAirtableFields(
  run: Partial<GapIaRun>
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  console.log('[gapIaRunToAirtableFields] Input run:', {
    hasCore: !!run.core,
    hasInsights: !!run.insights,
    runKeys: Object.keys(run),
  });

  // Basic fields
  if (run.url) fields['Website URL'] = run.url;
  if (run.domain) fields['Domain'] = run.domain;

  // Timestamps
  if (run.createdAt) fields['Created At'] = run.createdAt;

  // Store full run data in Data JSON field
  // This includes core, insights, scores, status, etc.
  const dataJson: Record<string, unknown> = {};

  if (run.source) dataJson.source = run.source;
  if (run.status) dataJson.status = run.status;
  if (run.updatedAt) dataJson.updatedAt = run.updatedAt;
  // V2 enhanced fields
  if ((run as any).summary) {
    console.log('[gapIaRunToAirtableFields] Adding V2 summary to dataJson');
    dataJson.summary = (run as any).summary;
  }
  if ((run as any).dimensions) {
    console.log('[gapIaRunToAirtableFields] Adding V2 dimensions to dataJson');
    dataJson.dimensions = (run as any).dimensions;
  }
  if ((run as any).breakdown) {
    console.log('[gapIaRunToAirtableFields] Adding V2 breakdown to dataJson');
    dataJson.breakdown = (run as any).breakdown;
  }
  if ((run as any).quickWins) {
    console.log('[gapIaRunToAirtableFields] Adding V2 quickWins to dataJson');
    dataJson.quickWins = (run as any).quickWins;
  }
  if ((run as any).benchmarks) {
    console.log('[gapIaRunToAirtableFields] Adding V2 benchmarks to dataJson');
    dataJson.benchmarks = (run as any).benchmarks;
  }

  // Legacy fields
  if (run.core) {
    console.log('[gapIaRunToAirtableFields] Adding core to dataJson');
    dataJson.core = run.core;
  }
  if (run.insights) {
    console.log('[gapIaRunToAirtableFields] Adding insights to dataJson');
    dataJson.insights = run.insights;
  }
  if ((run as any).overallScore !== undefined) dataJson.overallScore = (run as any).overallScore;
  if ((run as any).brandScore !== undefined) dataJson.brandScore = (run as any).brandScore;
  if ((run as any).contentScore !== undefined) dataJson.contentScore = (run as any).contentScore;
  if ((run as any).seoScore !== undefined) dataJson.seoScore = (run as any).seoScore;
  if ((run as any).websiteScore !== undefined) dataJson.websiteScore = (run as any).websiteScore;
  if ((run as any).digitalFootprintScore !== undefined) dataJson.digitalFootprintScore = (run as any).digitalFootprintScore;
  if ((run as any).businessContext) dataJson.businessContext = (run as any).businessContext;
  if ((run as any).digitalFootprint) dataJson.digitalFootprint = (run as any).digitalFootprint;
  if ((run as any).authorityScore !== undefined) dataJson.authorityScore = (run as any).authorityScore;
  if ((run as any).maturityStage) dataJson.maturityStage = (run as any).maturityStage;
  if ((run as any).readinessScore !== undefined) dataJson.readinessScore = (run as any).readinessScore;
  if ((run as any).dataConfidence) dataJson.dataConfidence = (run as any).dataConfidence;
  if (run.errorMessage) dataJson.errorMessage = run.errorMessage;

  // Caching fields
  if (run.normalizedUrl) dataJson.normalizedUrl = run.normalizedUrl;
  if (run.iaPromptVersion) dataJson.iaPromptVersion = run.iaPromptVersion;

  // Link fields
  if (run.companyId) dataJson.companyId = run.companyId;
  if (run.inboundLeadId) dataJson.inboundLeadId = run.inboundLeadId;
  if (run.gapPlanRunId) dataJson.gapPlanRunId = run.gapPlanRunId;
  if (run.gapFullReportId) dataJson.gapFullReportId = run.gapFullReportId;
  if (run.gapHeavyRunId) dataJson.gapHeavyRunId = run.gapHeavyRunId;

  // Consultant Report fields
  if (run.iaReportMarkdown) dataJson.iaReportMarkdown = run.iaReportMarkdown;
  if (run.iaReportVersion) dataJson.iaReportVersion = run.iaReportVersion;

  console.log('[gapIaRunToAirtableFields] Built dataJson with keys:', Object.keys(dataJson));

  if (Object.keys(dataJson).length > 0) {
    fields['Data JSON'] = JSON.stringify(dataJson);
    console.log('[gapIaRunToAirtableFields] Data JSON length:', (fields['Data JSON'] as string).length);
  }

  console.log('[gapIaRunToAirtableFields] Returning fields with keys:', Object.keys(fields));

  return fields;
}

function airtableRecordToGapIaRun(record: any): any {
  const fields = record.fields || {};

  // Log record ID to debug UUID issue
  console.log('[gapIaRuns] Converting Airtable record:', {
    recordId: record.id,
    hasIdField: !!fields['ID'],
    idFieldValue: fields['ID'],
  });

  // Helper to safely parse JSON with fallback
  const parseJson = <T>(value: string | undefined, fallback: T): T => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('[gapIaRuns] Failed to parse JSON field:', error);
      return fallback;
    }
  };

  // Parse Data JSON (contains all run data including core, insights, scores, etc.)
  const dataJson = parseJson<Record<string, any>>(fields['Data JSON'], {});

  // Default core context if not in Data JSON
  const defaultCore: CoreMarketingContext = {
    url: fields['Website URL'] || '',
    domain: fields['Domain'] || '',
    brand: {},
    content: {},
    seo: {},
    website: {},
    quickSummary: '',
    topOpportunities: [],
  };

  // Default insights if not in Data JSON
  const defaultInsights = {
    overallSummary: '',
    brandInsights: [],
    contentInsights: [],
    seoInsights: [],
    websiteInsights: [],
  };

  // CRITICAL: Always use record.id (the Airtable record ID), never fields['ID']
  // fields['ID'] might be a custom UUID formula field
  return {
    id: record.id,
    companyId: dataJson.companyId,
    inboundLeadId: dataJson.inboundLeadId,
    gapPlanRunId: dataJson.gapPlanRunId,
    gapFullReportId: dataJson.gapFullReportId,
    gapHeavyRunId: dataJson.gapHeavyRunId,

    url: (fields['Website URL'] as string) || '',
    domain: (fields['Domain'] as string) || '',

    source: (dataJson.source as GapIaSource) || 'internal',
    status: (dataJson.status as GapIaStatus) || 'pending',

    createdAt: (fields['Created At'] as string) || new Date().toISOString(),
    updatedAt: dataJson.updatedAt || (fields['Created At'] as string) || new Date().toISOString(),

    // Legacy fields
    core: (() => {
      const core = dataJson.core || defaultCore;
      // Ensure businessName is populated - infer from domain if missing
      if (!core.businessName && core.domain) {
        const domainWithoutTld = core.domain.replace(/\.(com|org|net|io|co|ai|dev|uk|ca|au)$/i, '');
        if (domainWithoutTld.includes('-') || domainWithoutTld.includes('.')) {
          core.businessName = domainWithoutTld
            .split(/[.-]/)
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        } else {
          core.businessName = domainWithoutTld.charAt(0).toUpperCase() + domainWithoutTld.slice(1);
        }
        console.log('[gapIaRuns] Inferred businessName from domain:', {
          domain: core.domain,
          inferredName: core.businessName,
        });
      }
      return core;
    })(),
    insights: dataJson.insights || defaultInsights,

    // V2 enhanced fields (optional for backward compatibility)
    summary: dataJson.summary,
    dimensions: dataJson.dimensions,
    breakdown: dataJson.breakdown,
    quickWins: dataJson.quickWins,
    benchmarks: dataJson.benchmarks,

    // Individual score fields (legacy support)
    overallScore: dataJson.overallScore,
    brandScore: dataJson.brandScore,
    contentScore: dataJson.contentScore,
    seoScore: dataJson.seoScore,
    websiteScore: dataJson.websiteScore,
    digitalFootprintScore: dataJson.digitalFootprintScore,
    businessContext: dataJson.businessContext,
    digitalFootprint: dataJson.digitalFootprint,
    authorityScore: dataJson.authorityScore,
    maturityStage: dataJson.maturityStage,
    readinessScore: dataJson.readinessScore,
    dataConfidence: dataJson.dataConfidence,

    errorMessage: dataJson.errorMessage,

    // Caching fields
    normalizedUrl: dataJson.normalizedUrl,
    iaPromptVersion: dataJson.iaPromptVersion,

    // Consultant Report fields
    iaReportMarkdown: dataJson.iaReportMarkdown,
    iaReportVersion: dataJson.iaReportVersion,
  };
}

// ============================================================================
// CRUD Functions
// ============================================================================

/**
 * Create a new GAP-IA Run in Airtable
 *
 * @param params - Initial parameters
 * @returns Created GapIaRun (with Airtable record ID)
 */
export async function createGapIaRun(params: {
  url: string;
  domain: string;
  source?: GapIaSource;
  companyId?: string;
  inboundLeadId?: string;
}): Promise<GapIaRun> {
  try {
    console.log('[gapIaRuns] Creating GAP-IA Run:', {
      url: params.url,
      domain: params.domain,
      source: params.source,
    });

    const now = new Date().toISOString();

    // Create initial GAP-IA Run object
    const initialRun: Partial<GapIaRun> = {
      url: params.url,
      domain: params.domain,
      source: params.source || 'internal',
      status: 'pending',
      companyId: params.companyId,
      inboundLeadId: params.inboundLeadId,
      createdAt: now,
      updatedAt: now,
    };

    // Map to Airtable fields
    const fields = gapIaRunToAirtableFields(initialRun);

    console.log('[gapIaRuns] About to create record with fields:', {
      table: GAP_IA_RUN_TABLE,
      fieldKeys: Object.keys(fields),
      websiteUrl: fields['Website URL'],
      domain: fields['Domain'],
    });

    // Create record
    const result = await createRecord(GAP_IA_RUN_TABLE, fields);

    console.log('[gapIaRuns] createRecord response:', {
      result,
      hasId: !!result?.id,
      hasFields: !!result?.fields,
    });

    const recordId = result?.id;

    if (!recordId) {
      console.error('[gapIaRuns] No record ID in result:', result);
      throw new Error('Failed to create GAP-IA Run: no record ID returned');
    }

    console.log('[gapIaRuns] ✅ Created GAP-IA Run:', {
      id: recordId,
      domain: params.domain,
    });

    // Return the created run (fetch it back to get full data)
    const createdRun = await getGapIaRunById(recordId);
    if (!createdRun) {
      throw new Error(`Failed to fetch created GAP-IA run ${recordId}`);
    }
    return createdRun;
  } catch (error) {
    console.error('[gapIaRuns] Failed to create GAP-IA Run:', error);
    throw error;
  }
}

/**
 * Get a GAP-IA Run by its Airtable record ID
 *
 * @param id - Airtable record ID
 * @returns GapIaRun or null if not found
 */
export async function getGapIaRunById(
  id: string
): Promise<GapIaRun | null> {
  try {
    console.log('[gapIaRuns] Fetching GAP-IA Run:', id);

    const config = getAirtableConfig();

    const url = `https://api.airtable.com/v0/${
      config.baseId
    }/${encodeURIComponent(GAP_IA_RUN_TABLE)}/${id}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[gapIaRuns] GAP-IA Run not found:', id);
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const record = await response.json();
    const run = airtableRecordToGapIaRun(record);

    console.log('[gapIaRuns] Retrieved GAP-IA Run:', {
      id: run.id,
      status: run.status,
      domain: run.domain,
    });

    return run;
  } catch (error) {
    console.error('[gapIaRuns] Failed to get GAP-IA Run:', error);
    throw error;
  }
}

/**
 * Update a GAP-IA Run in Airtable
 *
 * @param id - Airtable record ID
 * @param updates - Partial updates to apply
 * @returns Updated GapIaRun
 */
export async function updateGapIaRun(
  id: string,
  updates: Partial<GapIaRun>
): Promise<GapIaRun> {
  try {
    console.log('[gapIaRuns] Updating GAP-IA Run:', {
      id,
      status: updates.status,
      hasCore: !!updates.core,
      hasInsights: !!updates.insights,
      updateKeys: Object.keys(updates),
    });

    // Add updated timestamp
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    console.log('[gapIaRuns] Updates with timestamp:', {
      hasCore: !!updatesWithTimestamp.core,
      hasInsights: !!updatesWithTimestamp.insights,
      keys: Object.keys(updatesWithTimestamp),
    });

    // Map to Airtable fields
    const fields = gapIaRunToAirtableFields(updatesWithTimestamp);

    console.log('[gapIaRuns] Mapped Airtable fields:', {
      fieldKeys: Object.keys(fields),
      hasDataJson: !!fields['Data JSON'],
      dataJsonLength: fields['Data JSON'] ? (fields['Data JSON'] as string).length : 0,
    });

    // Update record
    await updateRecord(GAP_IA_RUN_TABLE, id, fields);

    console.log('[gapIaRuns] Updated GAP-IA Run:', id);

    // Fetch and return the updated run
    const fetchedRun = await getGapIaRunById(id);

    if (!fetchedRun) {
      throw new Error('Failed to fetch updated GAP-IA Run');
    }

    return fetchedRun;
  } catch (error) {
    console.error('[gapIaRuns] Failed to update GAP-IA Run:', error);
    throw error;
  }
}

/**
 * List recent GAP-IA Runs for Hive OS dashboard
 * Returns most recent runs sorted by creation time
 */
export async function listRecentGapIaRuns(limit: number = 20): Promise<GapIaRun[]> {
  try {
    console.log('[gapIaRuns] Listing recent GAP-IA Runs, limit:', limit);

    const config = getAirtableConfig();
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      GAP_IA_RUN_TABLE
    )}?maxRecords=${limit}&sort[0][field]=Created%20At&sort[0][direction]=desc&filterByFormula=${encodeURIComponent('NOT({Archived})')}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const records = result.records || [];

    console.log(`[gapIaRuns] Retrieved ${records.length} GAP-IA Runs`);

    return records.map((record: any) => airtableRecordToGapIaRun(record));
  } catch (error) {
    console.error('[gapIaRuns] Failed to list recent GAP-IA Runs:', error);
    return [];
  }
}

/**
 * Find an existing GAP-IA Run by normalized URL and prompt version
 * Returns the most recent successful run matching the criteria
 *
 * @param normalizedUrl - Normalized URL key (from normalizeWebsiteUrl)
 * @param promptVersion - IA prompt version (e.g., "ia-v4")
 * @returns Most recent matching GapIaRun or null
 */
export async function getGapIaRunByUrl(
  normalizedUrl: string,
  promptVersion: string
): Promise<GapIaRun | null> {
  try {
    console.log('[gapIaRuns] Looking up GAP-IA Run:', {
      normalizedUrl,
      promptVersion,
    });

    const config = getAirtableConfig();

    // Query for runs matching normalizedUrl in Data JSON
    // We'll filter client-side since Airtable formula string matching is complex
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      GAP_IA_RUN_TABLE
    )}?maxRecords=100&sort[0][field]=Created%20At&sort[0][direction]=desc&filterByFormula=${encodeURIComponent(
      'AND({Status}="completed", NOT({Archived}))'
    )}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const records = result.records || [];

    console.log(`[gapIaRuns] Retrieved ${records.length} completed runs for client-side filtering`);

    // Convert to GapIaRun objects and filter by normalizedUrl + promptVersion
    const runs = records
      .map((record: any) => airtableRecordToGapIaRun(record))
      .filter(
        (run: GapIaRun) =>
          run.normalizedUrl === normalizedUrl &&
          run.iaPromptVersion === promptVersion &&
          run.status === 'completed'
      );

    if (runs.length === 0) {
      console.log('[gapIaRuns] No matching run found');
      return null;
    }

    // Return the most recent (already sorted by Created At desc)
    const mostRecent = runs[0];
    console.log('[gapIaRuns] Found matching run:', {
      id: mostRecent.id,
      createdAt: mostRecent.createdAt,
      domain: mostRecent.domain,
    });

    return mostRecent;
  } catch (error) {
    console.error('[gapIaRuns] Failed to lookup GAP-IA Run by URL:', error);
    return null;
  }
}

/**
 * Get GAP-IA Runs for a specific company
 * Returns runs sorted by creation time (newest first)
 */
export async function getGapIaRunsForCompany(
  companyId: string,
  limit: number = 20
): Promise<GapIaRun[]> {
  try {
    console.log('[gapIaRuns] Fetching runs for company:', companyId);

    const config = getAirtableConfig();

    // Fetch recent runs and filter client-side
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      GAP_IA_RUN_TABLE
    )}?maxRecords=100&sort[0][field]=Created%20At&sort[0][direction]=desc&filterByFormula=${encodeURIComponent('NOT({Archived})')}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const records = result.records || [];

    // Convert to GapIaRun objects and filter by companyId
    const runs = records
      .map((record: any) => airtableRecordToGapIaRun(record))
      .filter((run: GapIaRun) => run.companyId === companyId)
      .slice(0, limit);

    console.log(`[gapIaRuns] Retrieved ${runs.length} GAP-IA runs for company ${companyId}`);

    return runs;
  } catch (error) {
    console.error('[gapIaRuns] Failed to fetch runs for company:', error);
    return [];
  }
}
