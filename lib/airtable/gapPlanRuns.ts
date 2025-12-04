// lib/airtable/gapPlanRuns.ts
// GAP-Plan Run logging to Airtable

import { createRecord, getAirtableConfig } from './client';
import { AIRTABLE_TABLES, getTableName } from './tables';
import type { GapPlanRun } from '@/lib/gap/types';

/**
 * GAP Plan Run Payload for Airtable logging
 */
export interface GapPlanRunPayload {
  planId: string;
  snapshotId?: string;
  url: string;
  maturityStage?: 'Early' | 'Emerging' | 'Scaling' | 'Leading';
  scores: {
    overall?: number;
    brand?: number;
    content?: number;
    website?: number;
    technical?: number;
    authority?: number;
    seo?: number;
    digitalFootprint?: number;
  };
  quickWinsCount: number;
  initiativesCount: number;
  createdAt: string;
  modelVersion?: string;
  warnings?: string[];
  rawPlan?: unknown;
  // Enrichment fields
  ctaClarity?: 'clear' | 'moderate' | 'unclear';
  ctaProminence?: 'prominent' | 'buried' | 'missing';
  socialPresenceLevel?: 'strong' | 'moderate' | 'weak' | 'missing';
  competitorCount?: number;
  // Benchmark cohort fields
  companyId?: string;
  benchmarkCohort?: string | null;
  companyType?: string | null;
  tier?: string | null;
}

/**
 * Log a GAP Plan Run to Airtable
 *
 * This function MUST NOT throw - it catches all errors and logs them to console.
 * GAP API responses should never fail due to Airtable logging issues.
 *
 * @param payload - GAP Plan Run data to log
 * @returns The Airtable record ID if successful, or null if failed
 */
export async function logGapPlanRunToAirtable(
  payload: GapPlanRunPayload
): Promise<string | null> {
  try {
    // Get table name from environment or use default
    const tableName = getTableName(
      'GAP_PLAN_RUN',
      'AIRTABLE_GAP_PLAN_RUN_TABLE'
    );

    console.log('[GAP-Plan Run] Logging to Airtable:', {
      tableName,
      planId: payload.planId,
      url: payload.url,
    });

    // Extract company name from rawPlan
    const companyName =
      payload.rawPlan &&
      typeof payload.rawPlan === 'object' &&
      'companyName' in payload.rawPlan
        ? (payload.rawPlan as any).companyName
        : 'Unknown Company';

    // First, check what fields exist in the table by fetching a sample record
    let availableFields: Set<string> = new Set();
    try {
      const { base } = await import('./client');
      const sampleRecords = await base(tableName).select({ maxRecords: 1 }).firstPage();
      if (sampleRecords.length > 0) {
        availableFields = new Set(Object.keys(sampleRecords[0].fields));
        console.log('[GAP-Plan Run] Available fields:', Array.from(availableFields));
      } else {
        // Table is empty - we'll use minimal required fields only
        console.log('[GAP-Plan Run] Table is empty, will use minimal fields');
        // Common fields that likely exist: URL, Status, ID, Data JSON
        availableFields = new Set(['URL', 'Status', 'Company Name', 'ID', 'Data JSON']);
      }
    } catch (e) {
      console.warn('[GAP-Plan Run] Could not check available fields, proceeding with minimal fields:', e);
      // Fallback to minimal fields if we can't check - but always include ID and Data JSON
      availableFields = new Set(['URL', 'Status', 'Company Name', 'ID', 'Data JSON']);
    }

    // Map payload to Airtable field names (only set fields that exist)
    const fields: Record<string, unknown> = {};

    // CRITICAL FIELDS - Always try to set Data JSON
    // NOTE: Data JSON MUST exist in your Airtable table or you'll get a 422 error
    // Company ID will be set later from payload.companyId if provided (OS company UUID)

    if (payload.rawPlan) {
      const dataJson = JSON.stringify(payload.rawPlan);
      const AIRTABLE_LONG_TEXT_LIMIT = 100000; // Airtable's limit for long text fields

      if (dataJson.length > AIRTABLE_LONG_TEXT_LIMIT) {
        console.warn(
          `[GAP-Plan Run] ⚠️ Data JSON exceeds Airtable limit (${dataJson.length} > ${AIRTABLE_LONG_TEXT_LIMIT} chars)`
        );
        console.warn('[GAP-Plan Run] Truncating Data JSON to fit within Airtable limits');

        // Truncate and add a marker that data was truncated
        const truncatedJson = dataJson.substring(0, AIRTABLE_LONG_TEXT_LIMIT - 100) + '...[TRUNCATED]"}';
        fields['Data JSON'] = truncatedJson;
        console.log('[GAP-Plan Run] ✅ Setting Data JSON field (TRUNCATED):', truncatedJson.length, 'characters');
      } else {
        fields['Data JSON'] = dataJson;
        console.log('[GAP-Plan Run] ✅ Setting Data JSON field (length):', dataJson.length, 'characters');
      }
    } else {
      console.warn('[GAP-Plan Run] ⚠️ No rawPlan provided - Data JSON will not be set');
    }

    // Ensure Data JSON is ALWAYS in availableFields so it doesn't get filtered out
    availableFields.add('Data JSON');

    // Also always include score fields - they exist but may be empty in sample records
    availableFields.add('Overall Score');
    availableFields.add('Brand Score');
    availableFields.add('Content Score');
    availableFields.add('Website Score');
    availableFields.add('SEO Score');
    availableFields.add('Authority Score');
    availableFields.add('Digital Footprint'); // Note: Field is "Digital Footprint" not "Digital Footprint Score" for consistency
    availableFields.add('Technical Score');
    availableFields.add('Maturity Stage');

    // Also always include benchmark cohort fields
    availableFields.add('Benchmark Cohort');
    availableFields.add('Company Type');
    availableFields.add('Tier');
    
    // Only set fields that exist in the table (or if we couldn't check, try common ones)
    const fieldMappings: Array<[string, unknown]> = [
      ['Company Name', `${companyName} - Plan Run`],
      ['Plan ID', payload.planId], // Keep for backward compatibility
      ['URL', payload.url],
      ['Status', 'completed'],
      ['Progress', 100],
      ['Stage', 'done'],
      ['Error', null],
      ['Current Finding', null],
      ['Business Name', companyName],
      ['Quick Wins Count', payload.quickWinsCount],
      ['Initiatives Count', payload.initiativesCount],
      ['Created At', payload.createdAt],
      ['Updated At', payload.createdAt],
    ];

    for (const [fieldName, value] of fieldMappings) {
      // If we checked available fields, only set if it exists
      // If we couldn't check (empty set), try setting it anyway
      if (availableFields.size === 0 || availableFields.has(fieldName)) {
        fields[fieldName] = value;
      }
      // Don't log warnings for optional fields - reduces noise in production logs
    }

    // Helper function to safely set a field only if it exists
    const setFieldIfExists = (fieldName: string, value: unknown) => {
      if (availableFields.size === 0 || availableFields.has(fieldName)) {
        fields[fieldName] = value;
      }
      // Don't log warnings for optional fields - reduces noise in production logs
    }

    // Optional fields
    if (payload.snapshotId) {
      setFieldIfExists('Snapshot ID', payload.snapshotId);
    }

    // Maturity Stage - map to Airtable allowed options (uppercase)
    // Airtable options: FOUNDATION, EMERGING, SCALING, LEADING
    if (payload.maturityStage) {
      const maturityStageMap: Record<string, string> = {
        Early: 'FOUNDATION',
        'Early-stage': 'FOUNDATION',
        Developing: 'FOUNDATION', // Map Developing to FOUNDATION
        Emerging: 'EMERGING',
        Scaling: 'SCALING',
        Leading: 'LEADING',
        'Category leader': 'LEADING',
      };

      const mappedStage =
        maturityStageMap[payload.maturityStage] ||
        payload.maturityStage.toUpperCase();
      const allowedStages = ['FOUNDATION', 'EMERGING', 'SCALING', 'LEADING'];

      if (allowedStages.includes(mappedStage)) {
        setFieldIfExists('Maturity Stage', mappedStage);
      } else {
        console.warn(
          `[GAP-Plan Run] Maturity Stage "${payload.maturityStage}" (mapped to "${mappedStage}") not in allowed values: ${allowedStages.join(', ')}`
        );
      }
    }

    // Scores
    if (payload.scores.overall !== undefined) {
      setFieldIfExists('Overall Score', payload.scores.overall);
    }
    if (payload.scores.brand !== undefined) {
      setFieldIfExists('Brand Score', payload.scores.brand);
    }
    if (payload.scores.content !== undefined) {
      setFieldIfExists('Content Score', payload.scores.content);
    }
    if (payload.scores.website !== undefined) {
      setFieldIfExists('Website Score', payload.scores.website);
    }
    // Technical Score and Authority Score
    if (payload.scores.technical !== undefined) {
      setFieldIfExists('Technical Score', payload.scores.technical);
    }
    if (payload.scores.authority !== undefined) {
      setFieldIfExists('Authority Score', payload.scores.authority);
    }
    if (payload.scores.seo !== undefined) {
      setFieldIfExists('SEO Score', payload.scores.seo);
    }
    if (payload.scores.digitalFootprint !== undefined) {
      setFieldIfExists('Digital Footprint', payload.scores.digitalFootprint);
    }

    // CTA fields (single select - map to exact values)
    if (payload.ctaClarity) {
      // Map to Airtable options: Clear / Moderate / Unclear
      const clarityMap: Record<string, string> = {
        clear: 'Clear',
        moderate: 'Moderate',
        unclear: 'Unclear',
      };
      const mappedClarity = clarityMap[payload.ctaClarity];
      if (mappedClarity) {
        setFieldIfExists('CTA Clarity', mappedClarity);
      }
    }

    if (payload.ctaProminence) {
      // Map to Airtable options: Prominent / Buried / Missing
      const prominenceMap: Record<string, string> = {
        prominent: 'Prominent',
        buried: 'Buried',
        missing: 'Missing',
      };
      const mappedProminence = prominenceMap[payload.ctaProminence];
      if (mappedProminence) {
        setFieldIfExists('CTA Prominence', mappedProminence);
      }
    }

    // Social Presence Level (single select)
    if (payload.socialPresenceLevel) {
      // Map to Airtable options: Strong / Moderate / Weak / Missing
      const socialMap: Record<string, string> = {
        strong: 'Strong',
        moderate: 'Moderate',
        weak: 'Weak',
        missing: 'Missing',
      };
      const mappedSocial = socialMap[payload.socialPresenceLevel];
      if (mappedSocial) {
        setFieldIfExists('Social Presence Level', mappedSocial);
      }
    }

    // Competitor Count (number)
    if (payload.competitorCount !== undefined) {
      setFieldIfExists('Competitor Count', payload.competitorCount);
    }

    // Benchmark Cohort fields
    if (payload.benchmarkCohort) {
      setFieldIfExists('Benchmark Cohort', payload.benchmarkCohort);
    }
    if (payload.companyType) {
      setFieldIfExists('Company Type', payload.companyType);
    }
    if (payload.tier) {
      setFieldIfExists('Tier', payload.tier);
    }
    if (payload.companyId) {
      setFieldIfExists('Company ID', payload.companyId);
    }

    // Create the record
    console.log(
      '[GAP-Plan Run] Creating Airtable record with fields:',
      Object.keys(fields)
    );
    console.log('[GAP-Plan Run] Field values preview:', {
      'Company ID': fields['Company ID'],
      'Data JSON': fields['Data JSON'] ? `${(fields['Data JSON'] as string).substring(0, 50)}...` : 'not set',
      'Plan ID': fields['Plan ID'],
      URL: fields['URL'],
      Status: fields['Status'],
      'Business Name': fields['Business Name'],
      'Overall Score': fields['Overall Score'],
    });

    const startTime = Date.now();
    
    // Log exactly what we're sending
    console.log('[GAP-Plan Run] 📤 Sending to Airtable:', {
      tableName,
      fieldCount: Object.keys(fields).length,
      fields: Object.keys(fields),
      hasCompanyID: !!fields['Company ID'],
      hasDataJSON: !!fields['Data JSON'],
      CompanyIDValue: fields['Company ID'],
      DataJSONLength: fields['Data JSON'] ? (fields['Data JSON'] as string).length : 0,
    });
    
    try {
      const result = await createRecord(tableName, fields);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      const recordId = result?.id || result?.records?.[0]?.id;
      console.log(
        `[GAP-Plan Run] ✅ Successfully logged run to Airtable: ${payload.planId}`
      );
      console.log('[GAP-Plan Run] Airtable record ID:', recordId);
      console.log('[GAP-Plan Run] Save completed in', elapsed, 'seconds');
      return recordId || null;
    } catch (createError) {
      // If we get a 422 error, it might be because Company ID or Data JSON fields don't exist
      // Try again with just URL and Status, then log the error
      if (createError instanceof Error && createError.message.includes('422')) {
        console.error('[GAP-Plan Run] ❌ 422 Error - Field validation failed');
        console.error('[GAP-Plan Run] This usually means "Company ID" or "Data JSON" fields don\'t exist in your Airtable table');
        console.error('[GAP-Plan Run] Please add these fields to your GAP-Plan Run table:');
        console.error('[GAP-Plan Run]   - "Company ID" (Single line text)');
        console.error('[GAP-Plan Run]   - "Data JSON" (Long text)');

        // Try to save with minimal fields as fallback
        const minimalFields: Record<string, unknown> = {
          'URL': payload.url,
          'Status': 'completed',
        };

        // Only add Company ID and Data JSON if they're in availableFields
        if (availableFields.has('Company ID')) {
          minimalFields['Company ID'] = payload.planId;
        }
        if (availableFields.has('Data JSON') && payload.rawPlan) {
          minimalFields['Data JSON'] = JSON.stringify(payload.rawPlan);
        }
        
        console.log('[GAP-Plan Run] 🔄 Attempting fallback save with minimal fields:', Object.keys(minimalFields));
        try {
          const fallbackResult = await createRecord(tableName, minimalFields);
          const fallbackRecordId = fallbackResult?.id || fallbackResult?.records?.[0]?.id;
          console.log('[GAP-Plan Run] ✅ Fallback save succeeded:', fallbackRecordId);
          return fallbackRecordId || null;
        } catch (fallbackError) {
          console.error('[GAP-Plan Run] ❌ Fallback save also failed:', fallbackError);
          return null;
        }
      } else {
        console.error('[GAP-Plan Run] ❌ Create error (not 422):', createError);
        return null;
      }
    }
  } catch (error) {
    // CRITICAL: Never throw from this function
    // Logging failures should not break the GAP API
    console.error('[GAP-Plan Run] ❌ Failed to log run to Airtable:', error);
    if (error instanceof Error) {
      console.error('[GAP-Plan Run] Error details:', error.message);
      console.error('[GAP-Plan Run] Error stack:', error.stack);
    }
    if (error && typeof error === 'object' && 'statusCode' in error) {
      console.error('[GAP-Plan Run] Error status code:', (error as any).statusCode);
    }
    return null;
  }
}

/**
 * List recent GAP-Plan Runs for Hive OS dashboard
 * Returns most recent runs sorted by creation time
 */
export async function listRecentGapPlanRuns(limit: number = 20): Promise<GapPlanRun[]> {
  try {
    const tableName = getTableName('GAP_PLAN_RUN', 'AIRTABLE_GAP_PLAN_RUN_TABLE');
    console.log('[GAP-Plan Run] Listing recent runs, limit:', limit, 'table:', tableName);

    const config = getAirtableConfig();
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      tableName
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

    console.log(`[GAP-Plan Run] Retrieved ${records.length} plan runs`);

    return records.map((record: any) => {
      const fields = record.fields || {};
      return {
        id: record.id,
        companyId: Array.isArray(fields['Company']) ? fields['Company'][0] : undefined,
        url: fields['Website URL'] || fields['URL'] || '',
        domain: fields['Domain'] || '',
        status: (fields['Status'] || 'pending') as 'pending' | 'processing' | 'completed' | 'error',
        overallScore: fields['Overall Score'] as number | undefined,
        brandScore: fields['Brand Score'] as number | undefined,
        contentScore: fields['Content Score'] as number | undefined,
        websiteScore: fields['Website Score'] as number | undefined,
        seoScore: fields['SEO Score'] as number | undefined,
        authorityScore: fields['Authority Score'] as number | undefined,
        maturityStage: fields['Maturity Stage'] as string | undefined,
        createdAt: fields['Created At'] || new Date().toISOString(),
        completedAt: fields['Completed At'] as string | undefined,
        errorMessage: fields['Error Message'] as string | undefined,
      } as GapPlanRun;
    });
  } catch (error) {
    console.error('[GAP-Plan Run] Failed to list recent runs:', error);
    return [];
  }
}

/**
 * Get GAP Plan Runs for a specific company
 * Returns runs sorted by creation time (newest first)
 */
export async function getGapPlanRunsForCompany(
  companyId: string,
  limit: number = 20
): Promise<GapPlanRun[]> {
  try {
    const tableName = getTableName('GAP_PLAN_RUN', 'AIRTABLE_GAP_PLAN_RUN_TABLE');
    console.log('[GAP-Plan Run] Fetching runs for company:', companyId, 'table:', tableName);

    // Use Airtable SDK for better linked record support
    const { base } = await import('./client');

    // Fetch more records than needed and filter client-side
    // since Airtable's ARRAYJOIN doesn't work reliably with linked records
    const allRecords = await base(tableName)
      .select({
        maxRecords: 100,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .firstPage();

    // Filter client-side for matching company
    const records = allRecords
      .filter((record) => {
        const companyField = record.fields['Company'];
        return Array.isArray(companyField) && companyField.includes(companyId);
      })
      .slice(0, limit);

    console.log(`[GAP-Plan Run] Retrieved ${records.length} plan runs for company ${companyId}`);

    return records.map((record: any) => {
      const fields = record.fields || {};
      return {
        id: record.id,
        companyId: Array.isArray(fields['Company']) ? fields['Company'][0] : undefined,
        url: fields['Website URL'] || fields['URL'] || '',
        domain: fields['Domain'] || '',
        status: (fields['Status'] || 'pending') as 'pending' | 'processing' | 'completed' | 'error',
        overallScore: fields['Overall Score'] as number | undefined,
        brandScore: fields['Brand Score'] as number | undefined,
        contentScore: fields['Content Score'] as number | undefined,
        websiteScore: fields['Website Score'] as number | undefined,
        seoScore: fields['SEO Score'] as number | undefined,
        authorityScore: fields['Authority Score'] as number | undefined,
        maturityStage: fields['Maturity Stage'] as string | undefined,
        createdAt: fields['Created At'] || new Date().toISOString(),
        completedAt: fields['Completed At'] as string | undefined,
        errorMessage: fields['Error Message'] as string | undefined,
      } as GapPlanRun;
    });
  } catch (error) {
    console.error('[GAP-Plan Run] Failed to fetch runs for company:', error);
    return [];
  }
}

/**
 * Get GAP Plan Runs for a specific company by ID or domain
 * First tries to match by Company linked record, then falls back to domain/URL matching
 * Returns runs sorted by creation time (newest first)
 */
export async function getGapPlanRunsForCompanyOrDomain(
  companyId: string,
  domain: string,
  limit: number = 20
): Promise<GapPlanRun[]> {
  try {
    const tableName = getTableName('GAP_PLAN_RUN', 'AIRTABLE_GAP_PLAN_RUN_TABLE');
    console.log('[GAP-Plan Run] Fetching runs for company/domain:', { companyId, domain, table: tableName });

    // Use Airtable SDK for better linked record support
    const { base } = await import('./client');

    // Fetch recent records
    const allRecords = await base(tableName)
      .select({
        maxRecords: 100,
        sort: [{ field: 'Created At', direction: 'desc' }],
      })
      .firstPage();

    // Normalize domain for matching
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

    // Filter client-side for matching company OR domain
    const records = allRecords
      .filter((record) => {
        const fields = record.fields;

        // Match by Company linked record
        const companyField = fields['Company'];
        if (Array.isArray(companyField) && companyField.includes(companyId)) {
          return true;
        }

        // Match by domain in URL field
        const url = (fields['Website URL'] || fields['URL'] || '') as string;
        const recordDomain = (fields['Domain'] || '') as string;

        const urlDomain = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        const normalizedRecordDomain = recordDomain.toLowerCase().replace(/^www\./, '');

        return urlDomain === normalizedDomain ||
               normalizedRecordDomain === normalizedDomain ||
               urlDomain.includes(normalizedDomain) ||
               normalizedDomain.includes(urlDomain);
      })
      .slice(0, limit);

    console.log(`[GAP-Plan Run] Retrieved ${records.length} plan runs for company/domain ${companyId}/${domain}`);

    return records.map((record: any) => {
      const fields = record.fields || {};
      return {
        id: record.id,
        companyId: Array.isArray(fields['Company']) ? fields['Company'][0] : undefined,
        url: fields['Website URL'] || fields['URL'] || '',
        domain: fields['Domain'] || '',
        status: (fields['Status'] || 'pending') as 'pending' | 'processing' | 'completed' | 'error',
        overallScore: fields['Overall Score'] as number | undefined,
        brandScore: fields['Brand Score'] as number | undefined,
        contentScore: fields['Content Score'] as number | undefined,
        websiteScore: fields['Website Score'] as number | undefined,
        seoScore: fields['SEO Score'] as number | undefined,
        authorityScore: fields['Authority Score'] as number | undefined,
        maturityStage: fields['Maturity Stage'] as string | undefined,
        createdAt: fields['Created At'] || new Date().toISOString(),
        completedAt: fields['Completed At'] as string | undefined,
        errorMessage: fields['Error Message'] as string | undefined,
      } as GapPlanRun;
    });
  } catch (error) {
    console.error('[GAP-Plan Run] Failed to fetch runs for company/domain:', error);
    return [];
  }
}

// Export alias for backward compatibility during migration
export const logGapRunToAirtable = logGapPlanRunToAirtable;
export type GapRunPayload = GapPlanRunPayload;
