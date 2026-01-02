// lib/competition-v3/store.ts
// Competition Lab V3 - Airtable Storage Layer
//
// Stores and retrieves V3 competition runs from Airtable.
// Full run data stored in "Competition Runs" table with "Run Data" field.

import {
  createRecord,
  updateRecord,
  getRecord,
  getAirtableConfig,
} from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  CompetitionRunV3,
  CompetitorProfileV3,
  LandscapeInsight,
  StrategicRecommendation,
  ScoringDebug,
} from './types';

const TABLE = AIRTABLE_TABLES.COMPETITION_RUNS;

// ============================================================================
// Types
// ============================================================================

/**
 * Structured error types for Competition V3 runs
 */
export type CompetitionV3ErrorType =
  | 'LOW_CONFIDENCE_CONTEXT'  // Insufficient context to identify business type
  | 'DISCOVERY_FAILED'        // Discovery phase failed
  | 'ENRICHMENT_FAILED'       // Enrichment phase failed
  | 'CLASSIFICATION_FAILED'   // Classification phase failed
  | 'UNKNOWN_ERROR';          // Catch-all for unexpected errors

/**
 * Structured error with type and debug info
 */
export interface CompetitionV3Error {
  type: CompetitionV3ErrorType;
  message: string;
  debug?: {
    confidence?: number;
    inferredCategory?: string;
    missingFields?: string[];
    warnings?: string[];
  };
}

/**
 * Full V3 run payload for storage
 */
export interface CompetitionRunV3Payload {
  runId: string;
  companyId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt: string | null;
  competitors: CompetitorProfileV3[];
  insights: LandscapeInsight[];
  recommendations: StrategicRecommendation[];
  summary: {
    totalCandidates: number;
    totalCompetitors: number;
    byType: {
      direct: number;
      partial: number;
      fractional: number;
      platform: number;
      internal: number;
    };
    avgThreatScore: number;
    quadrantDistribution: Record<string, number>;
    /** V3.1: Scoring strategy and debug info */
    scoring?: ScoringDebug;
  };
  /** Simple error string (for backwards compatibility) */
  error: string | null;
  /** Structured error with type and debug info */
  errorInfo?: CompetitionV3Error | null;
}

// ============================================================================
// Save
// ============================================================================

/**
 * Save a V3 competition run to Airtable
 */
export async function saveCompetitionRunV3(
  payload: CompetitionRunV3Payload
): Promise<string> {
  try {
    console.log(`[competition-v3/store] Saving run ${payload.runId} for company ${payload.companyId}`);

    const record = await createRecord(TABLE, {
      'Run ID': payload.runId,
      'Company ID': payload.companyId,
      'Status': payload.status,
      'Run Data': JSON.stringify(payload),
      // Note: 'Created At' is auto-populated by Airtable (computed field)
    });

    console.log(`[competition-v3/store] Saved run with record ID: ${record.id}`);
    return record.id;
  } catch (error) {
    console.error('[competition-v3/store] Failed to save run:', error);
    throw error;
  }
}

/**
 * Update an existing V3 competition run
 */
export async function updateCompetitionRunV3(
  recordId: string,
  payload: Partial<CompetitionRunV3Payload>
): Promise<void> {
  try {
    // Fetch current run data
    const current = await getRecord(TABLE, recordId);
    if (!current) {
      throw new Error(`Run not found: ${recordId}`);
    }

    const currentData: CompetitionRunV3Payload = JSON.parse(
      (current.fields['Run Data'] as string) || '{}'
    );

    // Merge updates
    const updatedData: CompetitionRunV3Payload = {
      ...currentData,
      ...payload,
    };

    await updateRecord(TABLE, recordId, {
      'Status': updatedData.status,
      'Run Data': JSON.stringify(updatedData),
    });

    console.log(`[competition-v3/store] Updated run ${recordId}`);
  } catch (error) {
    console.error('[competition-v3/store] Failed to update run:', error);
    throw error;
  }
}

// ============================================================================
// Read
// ============================================================================

/**
 * Get a V3 competition run by record ID
 */
export async function getCompetitionRunV3(
  recordId: string
): Promise<CompetitionRunV3Payload | null> {
  try {
    const record = await getRecord(TABLE, recordId);
    if (!record) return null;

    const runData: CompetitionRunV3Payload = JSON.parse(
      (record.fields['Run Data'] as string) || '{}'
    );
    return runData;
  } catch (error) {
    console.error('[competition-v3/store] Failed to get run:', error);
    return null;
  }
}

/**
 * Get the latest V3 competition run for a company
 */
export async function getLatestCompetitionRunV3(
  companyId: string
): Promise<CompetitionRunV3Payload | null> {
  try {
    const config = getAirtableConfig();
    const filterFormula = `{Company ID} = '${companyId.replace(/'/g, "\\'")}'`;
    // Sort by "Created At" field to get the most recent run
    // Fetch more records to debug which one is newest
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE)}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=5&sort%5B0%5D%5Bfield%5D=Created%20At&sort%5B0%5D%5Bdirection%5D=desc`;

    console.log('[competition-v3/store] Fetching latest run:', { companyId, table: TABLE });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      // Disable caching to ensure fresh results
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const result = await response.json();
    const records = result.records || [];

    console.log('[competition-v3/store] Query result:', {
      recordCount: records.length,
      companyId,
      // Log ALL record IDs and Created At values for debugging
      allRecords: records.map((r: { id: string; fields: Record<string, unknown> }) => ({
        id: r.id,
        createdAt: r.fields['Created At'],
        runId: (r.fields['Run ID'] as string)?.slice(0, 20),
      })),
    });

    if (records.length === 0) return null;

    const record = records[0];
    const runData: CompetitionRunV3Payload = JSON.parse(
      (record.fields['Run Data'] as string) || '{}'
    );

    // Check if this is a V3 run (has the V3 data structure)
    // competitors must be an array (not object or other type)
    if (!runData.runId || !Array.isArray(runData.competitors)) {
      console.log('[competition-v3/store] Latest run is not V3 format');
      return null;
    }

    console.log('[competition-v3/store] Latest run found:', {
      runId: runData.runId,
      competitorCount: runData.competitors.length,
      topDomains: runData.competitors.slice(0, 3).map(c => c.domain),
      createdAt: runData.createdAt,
      airtableRecordId: record.id,
      airtableCreatedAt: record.fields['Created At'],
    });

    return runData;
  } catch (error) {
    console.error('[competition-v3/store] Failed to get latest run:', error);
    return null;
  }
}

/**
 * List V3 competition runs for a company
 */
export async function listCompetitionRunsV3(
  companyId: string,
  options?: { limit?: number }
): Promise<CompetitionRunV3Payload[]> {
  const limit = options?.limit ?? 10;

  try {
    const config = getAirtableConfig();
    const filterFormula = `{Company ID} = '${companyId.replace(/'/g, "\\'")}'`;
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE)}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=${limit}&sort%5B0%5D%5Bfield%5D=Created%20At&sort%5B0%5D%5Bdirection%5D=desc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const result = await response.json();
    const records = result.records || [];

    return records
      .map((record: { id: string; fields: Record<string, unknown> }) => {
        try {
          const runData: CompetitionRunV3Payload = JSON.parse(
            (record.fields['Run Data'] as string) || '{}'
          );
          // Only return V3 runs
          if (runData.runId && runData.competitors) {
            return runData;
          }
          return null;
        } catch {
          return null;
        }
      })
      .filter((r: CompetitionRunV3Payload | null): r is CompetitionRunV3Payload => r !== null);
  } catch (error) {
    console.error('[competition-v3/store] Failed to list runs:', error);
    return [];
  }
}
