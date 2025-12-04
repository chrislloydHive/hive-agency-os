// lib/audience/storage.ts
// Airtable persistence layer for Audience Models
//
// Stores versioned audience models for companies, supporting
// canonical model selection and history tracking.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { AudienceModel, createEmptyAudienceModel } from './model';

const AUDIENCE_MODELS_TABLE = AIRTABLE_TABLES.AUDIENCE_MODELS;

/**
 * Airtable record structure for Audience Model storage
 *
 * Expected Airtable columns:
 * - Model ID (text) - Unique model identifier
 * - Company ID (text) - Links to Companies table by canonical ID
 * - Company Name (text) - Denormalized for easy viewing
 * - Model JSON (long text) - The full audience model as JSON
 * - Version (number) - Model version number
 * - Is Canonical (checkbox) - Whether this is the current canonical model
 * - Source (single select) - ai_seeded, manual, mixed
 * - Segment Count (number) - Number of segments
 * - Created By (text) - User who created the model
 * - Created At (date)
 * - Updated At (date)
 */

export interface AudienceModelRecord {
  recordId: string; // Airtable record ID
  model: AudienceModel;
}

/**
 * Map Airtable record to AudienceModelRecord
 */
function mapAirtableRecord(record: any): AudienceModelRecord | null {
  try {
    const fields = record.fields;
    const modelJson = fields['Model JSON'] as string | undefined;

    if (!modelJson) {
      console.warn(`[AudienceModel] Record ${record.id} has no Model JSON`);
      return null;
    }

    const model = JSON.parse(modelJson) as AudienceModel;

    return {
      recordId: record.id,
      model,
    };
  } catch (error) {
    console.error(`[AudienceModel] Failed to parse record ${record.id}:`, error);
    return null;
  }
}

/**
 * Get the current canonical audience model for a company
 *
 * @param companyId - Canonical company ID (UUID)
 * @returns The canonical audience model or null if none exists
 */
export async function getCurrentAudienceModel(
  companyId: string
): Promise<AudienceModel | null> {
  try {
    const base = getBase();
    const records = await base(AUDIENCE_MODELS_TABLE)
      .select({
        filterByFormula: `AND({Company ID} = "${companyId}", {Is Canonical} = TRUE())`,
        maxRecords: 1,
        sort: [{ field: 'Version', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      // This is normal - company may not have an audience model yet
      return null;
    }

    const mapped = mapAirtableRecord(records[0]);
    return mapped?.model || null;
  } catch (error: any) {
    // Handle case where table doesn't exist yet
    if (error?.statusCode === 404 || error?.error === 'NOT_FOUND') {
      console.warn(`[AudienceModel] Table "${AUDIENCE_MODELS_TABLE}" not found in Airtable. Create it to use Audience Lab.`);
      return null;
    }
    console.error(`[AudienceModel] Failed to load canonical model for ${companyId}:`, error?.message || error);
    return null;
  }
}

/**
 * Get an audience model by its ID
 *
 * @param modelId - The model ID
 * @returns The audience model or null if not found
 */
export async function getAudienceModelById(
  modelId: string
): Promise<AudienceModel | null> {
  try {
    const base = getBase();
    const records = await base(AUDIENCE_MODELS_TABLE)
      .select({
        filterByFormula: `{Model ID} = "${modelId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const mapped = mapAirtableRecord(records[0]);
    return mapped?.model || null;
  } catch (error) {
    console.error(`[AudienceModel] Failed to load model ${modelId}:`, error);
    return null;
  }
}

/**
 * List all audience models for a company (for history/versioning)
 *
 * @param companyId - Canonical company ID
 * @param limit - Maximum records to return
 * @returns Array of audience models, newest first
 */
export async function listAudienceModels(
  companyId: string,
  limit: number = 20
): Promise<AudienceModel[]> {
  try {
    const base = getBase();
    const records = await base(AUDIENCE_MODELS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: limit,
        sort: [{ field: 'Version', direction: 'desc' }],
      })
      .all();

    return records
      .map(mapAirtableRecord)
      .filter((r): r is AudienceModelRecord => r !== null)
      .map(r => r.model);
  } catch (error) {
    console.error(`[AudienceModel] Failed to list models for ${companyId}:`, error);
    return [];
  }
}

/**
 * Save an audience model (create or update)
 *
 * @param model - The audience model to save
 * @param companyName - Company name for denormalization
 * @returns Saved model or null on error
 */
export async function saveAudienceModel(
  model: AudienceModel,
  companyName: string
): Promise<AudienceModel | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Update model timestamp
    model.updatedAt = now;

    // Check if this is the first model for the company - if so, make it canonical
    const existingModelsForCompany = await base(AUDIENCE_MODELS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${model.companyId}"`,
        maxRecords: 1,
      })
      .firstPage();

    const isFirstModel = existingModelsForCompany.length === 0;
    if (isFirstModel) {
      model.isCurrentCanonical = true;
    }

    const fields = {
      'Model ID': model.id,
      'Company ID': model.companyId,
      'Company Name': companyName,
      'Model JSON': JSON.stringify(model),
      'Version': model.version,
      'Is Canonical': model.isCurrentCanonical,
      'Source': model.source,
      'Segment Count': model.segments.length,
      'Created By': model.createdBy || '',
      'Updated At': now,
    };

    // Check if this specific model record already exists
    const existingRecords = await base(AUDIENCE_MODELS_TABLE)
      .select({
        filterByFormula: `{Model ID} = "${model.id}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingRecords.length > 0) {
      // Update existing record
      await base(AUDIENCE_MODELS_TABLE).update(
        existingRecords[0].id,
        fields as any
      );
      console.log(`[AudienceModel] Updated model ${model.id} (v${model.version})`);
    } else {
      // Create new record
      const createFields = {
        ...fields,
        'Created At': model.createdAt || now,
      };
      await base(AUDIENCE_MODELS_TABLE).create([
        { fields: createFields as any },
      ]);
      console.log(`[AudienceModel] Created model ${model.id} (v${model.version})`);
    }

    return model;
  } catch (error: any) {
    // Log detailed error for debugging
    console.error(`[AudienceModel] Failed to save model ${model.id}:`, {
      message: error?.message,
      statusCode: error?.statusCode,
      error: error?.error,
      details: error?.response?.data || error,
    });
    return null;
  }
}

/**
 * Set an audience model as the canonical model for its company
 *
 * This will:
 * 1. Mark all other models for the company as non-canonical
 * 2. Mark the specified model as canonical
 *
 * @param companyId - Canonical company ID
 * @param modelId - The model ID to make canonical
 * @returns true on success, false on error
 */
export async function setAudienceModelCanonical(
  companyId: string,
  modelId: string
): Promise<boolean> {
  try {
    const base = getBase();

    // First, get all models for the company that are currently canonical
    const canonicalRecords = await base(AUDIENCE_MODELS_TABLE)
      .select({
        filterByFormula: `AND({Company ID} = "${companyId}", {Is Canonical} = TRUE())`,
      })
      .all();

    // Unmark all as canonical
    for (const record of canonicalRecords) {
      const existing = mapAirtableRecord(record);
      if (existing) {
        existing.model.isCurrentCanonical = false;
        await base(AUDIENCE_MODELS_TABLE).update(record.id, {
          'Is Canonical': false,
          'Model JSON': JSON.stringify(existing.model),
        } as any);
      }
    }

    // Now mark the target model as canonical
    const targetRecords = await base(AUDIENCE_MODELS_TABLE)
      .select({
        filterByFormula: `{Model ID} = "${modelId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (targetRecords.length === 0) {
      console.error(`[AudienceModel] Model ${modelId} not found`);
      return false;
    }

    const target = mapAirtableRecord(targetRecords[0]);
    if (target) {
      target.model.isCurrentCanonical = true;
      await base(AUDIENCE_MODELS_TABLE).update(targetRecords[0].id, {
        'Is Canonical': true,
        'Model JSON': JSON.stringify(target.model),
      } as any);
    }

    console.log(`[AudienceModel] Set model ${modelId} as canonical for ${companyId}`);
    return true;
  } catch (error) {
    console.error(`[AudienceModel] Failed to set canonical:`, error);
    return false;
  }
}

/**
 * Get or create canonical audience model for a company
 *
 * If no model exists, creates a new empty model and marks it canonical.
 *
 * @param companyId - Canonical company ID
 * @param companyName - Company name
 * @param createdBy - Optional user identifier
 * @returns The canonical audience model
 */
export async function getOrCreateAudienceModel(
  companyId: string,
  companyName: string,
  createdBy?: string
): Promise<AudienceModel> {
  // Try to load existing canonical
  const existing = await getCurrentAudienceModel(companyId);
  if (existing) {
    return existing;
  }

  // Create new empty model and mark as canonical
  const newModel = createEmptyAudienceModel(companyId, createdBy);
  newModel.isCurrentCanonical = true;

  await saveAudienceModel(newModel, companyName);

  return newModel;
}

/**
 * Create a new version of an audience model
 *
 * Creates a copy of the model with incremented version number.
 *
 * @param model - The model to version
 * @param companyName - Company name for storage
 * @returns The new versioned model
 */
export async function createAudienceModelVersion(
  model: AudienceModel,
  companyName: string
): Promise<AudienceModel | null> {
  const now = new Date().toISOString();

  const newModel: AudienceModel = {
    ...model,
    id: `am_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: model.version + 1,
    createdAt: now,
    updatedAt: now,
    isCurrentCanonical: false, // New versions are not canonical by default
    source: 'mixed', // Versioned models are considered mixed
  };

  return saveAudienceModel(newModel, companyName);
}

/**
 * Delete an audience model
 *
 * Note: Cannot delete the canonical model unless it's the only one.
 *
 * @param modelId - The model ID to delete
 * @returns true on success, false on error
 */
export async function deleteAudienceModel(modelId: string): Promise<boolean> {
  try {
    const base = getBase();
    const records = await base(AUDIENCE_MODELS_TABLE)
      .select({
        filterByFormula: `{Model ID} = "${modelId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return false;
    }

    const model = mapAirtableRecord(records[0]);
    if (model?.model.isCurrentCanonical) {
      console.warn(`[AudienceModel] Cannot delete canonical model ${modelId}`);
      return false;
    }

    await base(AUDIENCE_MODELS_TABLE).destroy([records[0].id]);
    console.log(`[AudienceModel] Deleted model ${modelId}`);
    return true;
  } catch (error) {
    console.error(`[AudienceModel] Failed to delete model ${modelId}:`, error);
    return false;
  }
}

// ============================================================================
// Audience Lab Summary (for Blueprint)
// ============================================================================

/**
 * Summary of Audience Lab status for Blueprint display
 */
export interface AudienceLabSummary {
  /** Whether a canonical audience model exists */
  hasAudienceModel: boolean;
  /** Number of segments in the canonical model */
  segmentCount: number;
  /** Names of primary segments (first 3) */
  primarySegments: string[];
  /** Source of the model (ai_seeded, manual, mixed) */
  source: 'ai_seeded' | 'manual' | 'mixed' | null;
  /** Model version */
  version: number | null;
  /** When the model was last updated */
  updatedAt: string | null;
}

/**
 * Get a summary of Audience Lab status for a company
 * Used by Blueprint to show audience readiness at a glance
 *
 * @param companyId - Canonical company ID
 * @returns Summary of audience model status
 */
export async function getAudienceLabSummary(
  companyId: string
): Promise<AudienceLabSummary> {
  try {
    const model = await getCurrentAudienceModel(companyId);

    if (!model) {
      return {
        hasAudienceModel: false,
        segmentCount: 0,
        primarySegments: [],
        source: null,
        version: null,
        updatedAt: null,
      };
    }

    // Get primary segments (first 3 by priority or order)
    const sortedSegments = [...model.segments].sort((a, b) => {
      const priorityOrder = { primary: 0, secondary: 1, tertiary: 2 };
      const aPriority = a.priority ? priorityOrder[a.priority] ?? 3 : 3;
      const bPriority = b.priority ? priorityOrder[b.priority] ?? 3 : 3;
      return aPriority - bPriority;
    });

    return {
      hasAudienceModel: true,
      segmentCount: model.segments.length,
      primarySegments: sortedSegments.slice(0, 3).map(s => s.name),
      source: model.source,
      version: model.version,
      updatedAt: model.updatedAt,
    };
  } catch (error: any) {
    // Return empty summary on error - don't break the page
    console.warn(`[AudienceLabSummary] Could not load summary for ${companyId}:`, error?.message || 'Unknown error');
    return {
      hasAudienceModel: false,
      segmentCount: 0,
      primarySegments: [],
      source: null,
      version: null,
      updatedAt: null,
    };
  }
}
