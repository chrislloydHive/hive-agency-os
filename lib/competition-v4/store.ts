// lib/competition-v4/store.ts
// Competition V4 - Airtable Storage Layer
//
// Stores and retrieves V4 competition runs from Airtable.
// Uses the same "Competition Runs" table as V3, with version field to distinguish.

import {
  createRecord,
  updateRecord,
  getAirtableConfig,
} from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import Airtable from 'airtable';
import type { CompetitionV4Result } from './types';

const TABLE = AIRTABLE_TABLES.COMPETITION_RUNS;

// ============================================================================
// Types
// ============================================================================

export interface CompetitionV4RunRecord {
  recordId: string;
  payload: CompetitionV4Result;
}

// ============================================================================
// Save V4 Run
// ============================================================================

export async function saveCompetitionRunV4(payload: CompetitionV4Result): Promise<string> {
  const record = await createRecord(TABLE, {
    'Run ID': payload.runId,
    'Company ID': payload.companyId,
    'Status': payload.execution.status,
    'Run Data': JSON.stringify({ ...payload, modelVersion: 'v4' }),
  });
  return record.id;
}

// ============================================================================
// Update V4 Run
// ============================================================================

export async function updateCompetitionRunV4(
  recordId: string,
  payload: CompetitionV4Result
): Promise<void> {
  await updateRecord(TABLE, recordId, {
    'Status': payload.execution.status,
    'Run Data': JSON.stringify({ ...payload, modelVersion: 'v4' }),
  });
}

// ============================================================================
// Get Latest V4 Run
// ============================================================================

export async function getLatestCompetitionRunV4(
  companyId: string
): Promise<CompetitionV4RunRecord | null> {
  const config = getAirtableConfig();
  const base = new Airtable({ apiKey: config.apiKey }).base(config.baseId);

  // Find most recent V4 run for this company
  const records = await base(TABLE)
    .select({
      filterByFormula: `{Company ID} = '${companyId}'`,
      maxRecords: 20,
    })
    .firstPage();

  // Sort by createdTime descending (built-in Airtable metadata)
  const sortedRecords = [...records].sort((a, b) => {
    const aTime = new Date(a._rawJson?.createdTime || 0).getTime();
    const bTime = new Date(b._rawJson?.createdTime || 0).getTime();
    return bTime - aTime;
  });

  // Find the most recent V4 run
  for (const record of sortedRecords) {
    const runDataStr = record.fields['Run Data'];
    if (!runDataStr || typeof runDataStr !== 'string') continue;

    try {
      const runData = JSON.parse(runDataStr);
      // Check if this is a V4 run
      if (runData.version === 4 || runData.modelVersion === 'v4') {
        return {
          recordId: record.id,
          payload: runData as CompetitionV4Result,
        };
      }
    } catch {
      // Skip malformed records
      continue;
    }
  }

  return null;
}
