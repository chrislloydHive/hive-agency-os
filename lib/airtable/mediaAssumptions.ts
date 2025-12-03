// lib/airtable/mediaAssumptions.ts
// Airtable helpers for MediaAssumptions table
//
// MediaAssumptions stores company-specific forecast assumptions as JSON.
// Each company can have one set of assumptions.
//
// Table Structure:
// - Company (link to Companies table)
// - AssumptionsJSON (long text - serialized MediaAssumptions)
// - CreatedAt (created time)
// - UpdatedAt (last modified time)
// - UpdatedBy (text - user identifier)
// - Notes (long text)

import Airtable from 'airtable';
import type { FieldSet } from 'airtable';
import {
  type MediaAssumptions,
  type MediaAssumptionsRecord,
  createDefaultAssumptions,
  serializeAssumptions,
  deserializeAssumptions,
  validateAssumptions,
} from '@/lib/media/assumptions';

// Use a simpler record type that works with Airtable's generic FieldSet
type AirtableRecordGeneric = {
  id: string;
  fields: FieldSet;
  _rawJson?: { createdTime?: string };
};

// ============================================================================
// Configuration
// ============================================================================

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID!
);

const TABLE_NAME = 'MediaAssumptions';

// ============================================================================
// Airtable Field Mapping
// ============================================================================

// ============================================================================
// Mapping Functions
// ============================================================================

function mapRecordToAssumptions(
  record: AirtableRecordGeneric
): MediaAssumptionsRecord | null {
  const fields = record.fields;
  const companyArray = fields['Company'] as string[] | undefined;
  const companyId = companyArray?.[0];

  if (!companyId) {
    console.warn('[MediaAssumptions] Record missing Company link:', record.id);
    return null;
  }

  return {
    id: record.id,
    companyId,
    assumptionsJson: (fields['AssumptionsJSON'] as string) || '{}',
    createdAt: record._rawJson?.createdTime || new Date().toISOString(),
    updatedAt: new Date().toISOString(), // Airtable doesn't track this automatically
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get assumptions for a company
 */
export async function getMediaAssumptions(
  companyId: string
): Promise<MediaAssumptions | null> {
  try {
    const records = await base(TABLE_NAME)
      .select({
        filterByFormula: `FIND("${companyId}", ARRAYJOIN(Company, ","))`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const record = mapRecordToAssumptions(
      records[0] as unknown as AirtableRecordGeneric
    );

    if (!record) {
      return null;
    }

    const assumptions = deserializeAssumptions(record.assumptionsJson);

    if (!assumptions) {
      console.warn('[MediaAssumptions] Failed to deserialize assumptions for company:', companyId);
      return null;
    }

    // Ensure companyId matches
    assumptions.companyId = companyId;

    return assumptions;
  } catch (error) {
    console.error('[MediaAssumptions] Error fetching assumptions:', error);
    return null;
  }
}

/**
 * Get assumptions with fallback to defaults
 */
export async function getMediaAssumptionsWithDefaults(
  companyId: string
): Promise<MediaAssumptions> {
  const existing = await getMediaAssumptions(companyId);

  if (existing) {
    return existing;
  }

  return createDefaultAssumptions(companyId);
}

/**
 * Create assumptions for a company
 */
export async function createMediaAssumptions(
  assumptions: MediaAssumptions
): Promise<MediaAssumptionsRecord | null> {
  try {
    // Validate assumptions
    const validation = validateAssumptions(assumptions);
    if (!validation.success) {
      console.error('[MediaAssumptions] Validation failed:', validation.errors);
      return null;
    }

    const records = await base(TABLE_NAME).create([
      {
        fields: {
          Company: [assumptions.companyId],
          AssumptionsJSON: serializeAssumptions(assumptions),
          Notes: assumptions.notes || '',
          UpdatedBy: assumptions.updatedBy || '',
        } as FieldSet,
      },
    ]);

    if (records.length === 0) {
      return null;
    }

    return mapRecordToAssumptions(
      records[0] as unknown as AirtableRecordGeneric
    );
  } catch (error) {
    console.error('[MediaAssumptions] Error creating assumptions:', error);
    return null;
  }
}

/**
 * Update assumptions for a company
 */
export async function updateMediaAssumptions(
  companyId: string,
  assumptions: MediaAssumptions
): Promise<MediaAssumptionsRecord | null> {
  try {
    // Validate assumptions
    const validation = validateAssumptions(assumptions);
    if (!validation.success) {
      console.error('[MediaAssumptions] Validation failed:', validation.errors);
      return null;
    }

    // Find existing record
    const existingRecords = await base(TABLE_NAME)
      .select({
        filterByFormula: `FIND("${companyId}", ARRAYJOIN(Company, ","))`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingRecords.length === 0) {
      // No existing record, create new one
      return await createMediaAssumptions(assumptions);
    }

    const recordId = existingRecords[0].id;

    // Update with lastUpdated timestamp
    const updatedAssumptions: MediaAssumptions = {
      ...assumptions,
      lastUpdated: new Date().toISOString(),
    };

    const records = await base(TABLE_NAME).update([
      {
        id: recordId,
        fields: {
          AssumptionsJSON: serializeAssumptions(updatedAssumptions),
          Notes: updatedAssumptions.notes || '',
          UpdatedBy: updatedAssumptions.updatedBy || '',
        } as FieldSet,
      },
    ]);

    if (records.length === 0) {
      return null;
    }

    return mapRecordToAssumptions(
      records[0] as unknown as AirtableRecordGeneric
    );
  } catch (error) {
    console.error('[MediaAssumptions] Error updating assumptions:', error);
    return null;
  }
}

/**
 * Upsert assumptions (create or update)
 */
export async function upsertMediaAssumptions(
  assumptions: MediaAssumptions
): Promise<MediaAssumptionsRecord | null> {
  return updateMediaAssumptions(assumptions.companyId, assumptions);
}

/**
 * Delete assumptions for a company
 */
export async function deleteMediaAssumptions(
  companyId: string
): Promise<boolean> {
  try {
    const existingRecords = await base(TABLE_NAME)
      .select({
        filterByFormula: `FIND("${companyId}", ARRAYJOIN(Company, ","))`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingRecords.length === 0) {
      return true; // Nothing to delete
    }

    await base(TABLE_NAME).destroy([existingRecords[0].id]);

    return true;
  } catch (error) {
    console.error('[MediaAssumptions] Error deleting assumptions:', error);
    return false;
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get assumptions for multiple companies
 */
export async function getMediaAssumptionsBatch(
  companyIds: string[]
): Promise<Map<string, MediaAssumptions>> {
  const result = new Map<string, MediaAssumptions>();

  if (companyIds.length === 0) {
    return result;
  }

  try {
    // Build OR formula for multiple companies
    const orConditions = companyIds
      .map(id => `FIND("${id}", ARRAYJOIN(Company, ","))`)
      .join(', ');

    const records = await base(TABLE_NAME)
      .select({
        filterByFormula: `OR(${orConditions})`,
      })
      .all();

    for (const record of records) {
      const mapped = mapRecordToAssumptions(
        record as unknown as AirtableRecordGeneric
      );

      if (mapped) {
        const assumptions = deserializeAssumptions(mapped.assumptionsJson);
        if (assumptions) {
          result.set(mapped.companyId, assumptions);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('[MediaAssumptions] Error fetching batch:', error);
    return result;
  }
}

// ============================================================================
// API Route Helpers
// ============================================================================

/**
 * Save assumptions from API request
 */
export async function saveMediaAssumptionsFromAPI(
  companyId: string,
  data: unknown,
  updatedBy?: string
): Promise<{ success: boolean; error?: string; assumptions?: MediaAssumptions }> {
  try {
    // Validate incoming data
    const validation = validateAssumptions(data);

    if (!validation.success || !validation.data) {
      return {
        success: false,
        error: 'Invalid assumptions data: ' + validation.errors?.message,
      };
    }

    // Ensure companyId matches
    const assumptions: MediaAssumptions = {
      ...validation.data,
      companyId,
      lastUpdated: new Date().toISOString(),
      updatedBy,
    };

    const record = await upsertMediaAssumptions(assumptions);

    if (!record) {
      return { success: false, error: 'Failed to save to database' };
    }

    return { success: true, assumptions };
  } catch (error) {
    console.error('[MediaAssumptions] Error in saveFromAPI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
