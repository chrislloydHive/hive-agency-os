// lib/airtable/companyStrategySnapshot.ts
// Airtable CRUD for Company Strategy Snapshots
//
// Each company has ONE strategic snapshot that represents the current
// AI-synthesized strategic assessment. This is updated whenever new
// diagnostic runs complete.

import {
  createRecord,
  updateRecord,
  getAirtableConfig,
} from './client';
import { AIRTABLE_TABLES } from './tables';

// ============================================================================
// Types
// ============================================================================

/**
 * A company's strategic snapshot - the synthesized view from all diagnostics
 */
export interface CompanyStrategicSnapshot {
  id?: string;
  companyId: string;
  overallScore: number | null;
  maturityStage?: string;
  updatedAt: string;
  keyStrengths: string[];
  keyGaps: string[];
  focusAreas: string[];
  narrative90DayPlan: string;
  // Headline recommendation - derived from top focus area
  headlineRecommendation?: string | null;
  // Metadata
  sourceToolIds?: string[];
  lastDiagnosticRunId?: string;
}

/**
 * Input for creating/updating a snapshot
 */
export type UpsertSnapshotInput = Omit<CompanyStrategicSnapshot, 'id'>;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

const TABLE = AIRTABLE_TABLES.COMPANY_STRATEGY_SNAPSHOTS;

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function mapRecordToSnapshot(record: AirtableRecord): CompanyStrategicSnapshot {
  const fields = record.fields;

  // Handle Company field - linked record format
  let companyId = '';
  if (Array.isArray(fields['Company'])) {
    companyId = fields['Company'][0] as string;
  } else if (typeof fields['Company'] === 'string') {
    companyId = fields['Company'];
  } else if (typeof fields['Company ID'] === 'string') {
    companyId = fields['Company ID'];
  }

  // Parse JSON arrays
  let keyStrengths: string[] = [];
  let keyGaps: string[] = [];
  let focusAreas: string[] = [];
  let sourceToolIds: string[] = [];

  try {
    if (typeof fields['Key Strengths JSON'] === 'string') {
      keyStrengths = JSON.parse(fields['Key Strengths JSON']);
    }
  } catch { /* ignore */ }

  try {
    if (typeof fields['Key Gaps JSON'] === 'string') {
      keyGaps = JSON.parse(fields['Key Gaps JSON']);
    }
  } catch { /* ignore */ }

  try {
    if (typeof fields['Focus Areas JSON'] === 'string') {
      focusAreas = JSON.parse(fields['Focus Areas JSON']);
    }
  } catch { /* ignore */ }

  try {
    if (typeof fields['Source Tool IDs JSON'] === 'string') {
      sourceToolIds = JSON.parse(fields['Source Tool IDs JSON']);
    }
  } catch { /* ignore */ }

  return {
    id: record.id,
    companyId,
    overallScore: typeof fields['Overall Score'] === 'number' ? fields['Overall Score'] : null,
    maturityStage: fields['Maturity Stage'] as string | undefined,
    updatedAt: (fields['Updated At'] as string) || new Date().toISOString(),
    keyStrengths,
    keyGaps,
    focusAreas,
    narrative90DayPlan: (fields['90 Day Narrative'] as string) || '',
    headlineRecommendation: (fields['Headline Recommendation'] as string) || null,
    sourceToolIds,
    lastDiagnosticRunId: fields['Last Diagnostic Run ID'] as string | undefined,
  };
}

function snapshotToAirtableFields(
  snapshot: UpsertSnapshotInput
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  // Company reference - store as text for flexibility
  if (snapshot.companyId) {
    fields['Company ID'] = snapshot.companyId;
  }

  if (snapshot.overallScore !== null && snapshot.overallScore !== undefined) {
    fields['Overall Score'] = snapshot.overallScore;
  }

  if (snapshot.maturityStage) {
    fields['Maturity Stage'] = snapshot.maturityStage;
  }

  fields['Updated At'] = snapshot.updatedAt;
  fields['90 Day Narrative'] = snapshot.narrative90DayPlan;

  if (snapshot.headlineRecommendation) {
    fields['Headline Recommendation'] = snapshot.headlineRecommendation;
  }

  // Store arrays as JSON
  fields['Key Strengths JSON'] = JSON.stringify(snapshot.keyStrengths);
  fields['Key Gaps JSON'] = JSON.stringify(snapshot.keyGaps);
  fields['Focus Areas JSON'] = JSON.stringify(snapshot.focusAreas);

  if (snapshot.sourceToolIds) {
    fields['Source Tool IDs JSON'] = JSON.stringify(snapshot.sourceToolIds);
  }

  if (snapshot.lastDiagnosticRunId) {
    fields['Last Diagnostic Run ID'] = snapshot.lastDiagnosticRunId;
  }

  return fields;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get the strategic snapshot for a company
 */
export async function getCompanyStrategySnapshot(
  companyId: string
): Promise<CompanyStrategicSnapshot | null> {
  console.log('[StrategySnapshot] Getting snapshot for company:', companyId);

  const config = getAirtableConfig();

  // Simple filter on Company ID text field
  const filterFormula = `{Company ID} = "${companyId}"`;

  const url = new URL(
    `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE)}`
  );
  url.searchParams.set('filterByFormula', filterFormula);
  url.searchParams.set('maxRecords', '1');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[StrategySnapshot] API error:', response.status, errorText);

      // Handle common "table doesn't exist" errors gracefully
      if (response.status === 404 || response.status === 403) {
        console.log('[StrategySnapshot] Table not found or no access, returning null');
        return null;
      }
      // Check if the error is a permissions/model not found error (table doesn't exist)
      if (errorText.includes('INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND') ||
          errorText.includes('NOT_FOUND') ||
          errorText.includes('Could not find table')) {
        console.log('[StrategySnapshot] Table not found, returning null. Create the "Company Strategy Snapshots" table in Airtable to enable this feature.');
        return null;
      }
      console.error('[StrategySnapshot] Airtable error:', errorText);
      return null;
    }

    const result = await response.json();
    if (!result.records || result.records.length === 0) {
      console.log('[StrategySnapshot] No snapshot found for company:', companyId);
      return null;
    }

    return mapRecordToSnapshot(result.records[0]);
  } catch (error) {
    console.error('[StrategySnapshot] Failed to get snapshot:', error);
    return null;
  }
}

/**
 * Create or update the strategic snapshot for a company
 */
export async function upsertCompanyStrategySnapshot(
  snapshot: UpsertSnapshotInput
): Promise<CompanyStrategicSnapshot> {
  console.log('[StrategySnapshot] Upserting snapshot:', {
    companyId: snapshot.companyId,
    score: snapshot.overallScore,
    focusAreas: snapshot.focusAreas.length,
  });

  // Check for existing snapshot
  const existing = await getCompanyStrategySnapshot(snapshot.companyId);

  const fields = snapshotToAirtableFields(snapshot);

  try {
    let result: AirtableRecord;

    if (existing?.id) {
      // Update existing
      result = await updateRecord(TABLE, existing.id, fields);
      console.log('[StrategySnapshot] Updated existing snapshot:', result.id);
    } else {
      // Create new
      result = await createRecord(TABLE, fields);
      console.log('[StrategySnapshot] Created new snapshot:', result.id);
    }

    return mapRecordToSnapshot(result);
  } catch (error) {
    console.error('[StrategySnapshot] Failed to upsert snapshot:', error);
    throw error;
  }
}

/**
 * Delete the strategic snapshot for a company
 */
export async function deleteCompanyStrategySnapshot(
  companyId: string
): Promise<boolean> {
  const existing = await getCompanyStrategySnapshot(companyId);

  if (!existing?.id) {
    console.log('[StrategySnapshot] No snapshot to delete for:', companyId);
    return false;
  }

  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(TABLE)}/${existing.id}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      console.error('[StrategySnapshot] Failed to delete snapshot');
      return false;
    }

    console.log('[StrategySnapshot] Deleted snapshot:', existing.id);
    return true;
  } catch (error) {
    console.error('[StrategySnapshot] Delete error:', error);
    return false;
  }
}
