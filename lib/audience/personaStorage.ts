// lib/audience/personaStorage.ts
// Airtable persistence layer for Persona Sets
//
// Stores persona sets linked to audience models for companies.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { PersonaSet, createEmptyPersonaSet } from './personas';

const AUDIENCE_PERSONAS_TABLE = AIRTABLE_TABLES.AUDIENCE_PERSONAS;

/**
 * Airtable record structure for Persona Set storage
 *
 * Expected Airtable columns:
 * - Set ID (text) - Unique set identifier
 * - Company ID (text) - Links to Companies table by canonical ID
 * - Company Name (text) - Denormalized for easy viewing
 * - Audience Model ID (text) - Links to the parent audience model
 * - Set JSON (long text) - The full persona set as JSON
 * - Version (number) - Set version number
 * - Persona Count (number) - Number of personas
 * - Source (single select) - ai_seeded, manual, mixed
 * - Created At (date)
 * - Updated At (date)
 */

export interface PersonaSetRecord {
  recordId: string; // Airtable record ID
  personaSet: PersonaSet;
}

/**
 * Map Airtable record to PersonaSetRecord
 */
function mapAirtableRecord(record: any): PersonaSetRecord | null {
  try {
    const fields = record.fields;
    const setJson = fields['Set JSON'] as string | undefined;

    if (!setJson) {
      console.warn(`[PersonaStorage] Record ${record.id} has no Set JSON`);
      return null;
    }

    const personaSet = JSON.parse(setJson) as PersonaSet;

    return {
      recordId: record.id,
      personaSet,
    };
  } catch (error) {
    console.error(`[PersonaStorage] Failed to parse record ${record.id}:`, error);
    return null;
  }
}

/**
 * Get the persona set for a company
 *
 * @param companyId - Canonical company ID (UUID)
 * @returns The persona set or null if none exists
 */
export async function getPersonaSet(
  companyId: string
): Promise<PersonaSet | null> {
  try {
    const base = getBase();
    const records = await base(AUDIENCE_PERSONAS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: 1,
        sort: [{ field: 'Version', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      // Normal - company may not have personas yet
      return null;
    }

    const mapped = mapAirtableRecord(records[0]);
    return mapped?.personaSet || null;
  } catch (error: any) {
    // Handle case where table doesn't exist yet
    if (error?.statusCode === 404 || error?.error === 'NOT_FOUND') {
      console.warn(`[PersonaStorage] Table "${AUDIENCE_PERSONAS_TABLE}" not found in Airtable.`);
      return null;
    }
    console.warn(`[PersonaStorage] Could not load persona set for ${companyId}:`, error?.message || 'Unknown error');
    return null;
  }
}

/**
 * Get a persona set by its ID
 *
 * @param setId - The persona set ID
 * @returns The persona set or null if not found
 */
export async function getPersonaSetById(
  setId: string
): Promise<PersonaSet | null> {
  try {
    const base = getBase();
    const records = await base(AUDIENCE_PERSONAS_TABLE)
      .select({
        filterByFormula: `{Set ID} = "${setId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const mapped = mapAirtableRecord(records[0]);
    return mapped?.personaSet || null;
  } catch (error) {
    console.error(`[PersonaStorage] Failed to load persona set ${setId}:`, error);
    return null;
  }
}

/**
 * Save a persona set (create or update)
 *
 * @param personaSet - The persona set to save
 * @param companyName - Company name for denormalization
 * @returns Saved persona set or null on error
 */
export async function savePersonaSet(
  personaSet: PersonaSet,
  companyName: string
): Promise<PersonaSet | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Update timestamp
    personaSet.updatedAt = now;

    const fields = {
      'Set ID': personaSet.id,
      'Company ID': personaSet.companyId,
      'Company Name': companyName,
      'Audience Model ID': personaSet.audienceModelId,
      'Set JSON': JSON.stringify(personaSet),
      'Version': personaSet.version,
      'Persona Count': personaSet.personas.length,
      'Source': personaSet.source,
      'Updated At': now,
    };

    // Check if record already exists
    const existingRecords = await base(AUDIENCE_PERSONAS_TABLE)
      .select({
        filterByFormula: `{Set ID} = "${personaSet.id}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingRecords.length > 0) {
      // Update existing record
      await base(AUDIENCE_PERSONAS_TABLE).update(
        existingRecords[0].id,
        fields as any
      );
      console.log(`[PersonaStorage] Updated persona set ${personaSet.id} (v${personaSet.version})`);
    } else {
      // Create new record
      const createFields = {
        ...fields,
        'Created At': personaSet.createdAt || now,
      };
      await base(AUDIENCE_PERSONAS_TABLE).create([
        { fields: createFields as any },
      ]);
      console.log(`[PersonaStorage] Created persona set ${personaSet.id} (v${personaSet.version})`);
    }

    return personaSet;
  } catch (error) {
    console.error(`[PersonaStorage] Failed to save persona set ${personaSet.id}:`, error);
    return null;
  }
}

/**
 * Get or create persona set for a company
 *
 * If no set exists, creates a new empty set linked to the audience model.
 *
 * @param companyId - Canonical company ID
 * @param audienceModelId - The audience model to link to
 * @param companyName - Company name
 * @returns The persona set
 */
export async function getOrCreatePersonaSet(
  companyId: string,
  audienceModelId: string,
  companyName: string
): Promise<PersonaSet> {
  // Try to load existing
  const existing = await getPersonaSet(companyId);
  if (existing) {
    // Update audience model ID if different
    if (existing.audienceModelId !== audienceModelId) {
      existing.audienceModelId = audienceModelId;
      await savePersonaSet(existing, companyName);
    }
    return existing;
  }

  // Create new empty set
  const newSet = createEmptyPersonaSet(companyId, audienceModelId);
  await savePersonaSet(newSet, companyName);
  return newSet;
}

/**
 * List persona set history for a company
 *
 * @param companyId - Canonical company ID
 * @param limit - Maximum records to return
 * @returns Array of persona sets, newest first
 */
export async function listPersonaSets(
  companyId: string,
  limit: number = 10
): Promise<PersonaSet[]> {
  try {
    const base = getBase();
    const records = await base(AUDIENCE_PERSONAS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: limit,
        sort: [{ field: 'Version', direction: 'desc' }],
      })
      .all();

    return records
      .map(mapAirtableRecord)
      .filter((r): r is PersonaSetRecord => r !== null)
      .map(r => r.personaSet);
  } catch (error) {
    console.error(`[PersonaStorage] Failed to list persona sets for ${companyId}:`, error);
    return [];
  }
}

/**
 * Create a new version of a persona set
 *
 * @param personaSet - The set to version
 * @param companyName - Company name for storage
 * @returns The new versioned set
 */
export async function createPersonaSetVersion(
  personaSet: PersonaSet,
  companyName: string
): Promise<PersonaSet | null> {
  const now = new Date().toISOString();

  const newSet: PersonaSet = {
    ...personaSet,
    id: `pset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: personaSet.version + 1,
    createdAt: now,
    updatedAt: now,
    source: 'mixed',
  };

  return savePersonaSet(newSet, companyName);
}

/**
 * Delete a persona set
 *
 * @param setId - The set ID to delete
 * @returns true on success, false on error
 */
export async function deletePersonaSet(setId: string): Promise<boolean> {
  try {
    const base = getBase();
    const records = await base(AUDIENCE_PERSONAS_TABLE)
      .select({
        filterByFormula: `{Set ID} = "${setId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return false;
    }

    await base(AUDIENCE_PERSONAS_TABLE).destroy([records[0].id]);
    console.log(`[PersonaStorage] Deleted persona set ${setId}`);
    return true;
  } catch (error) {
    console.error(`[PersonaStorage] Failed to delete persona set ${setId}:`, error);
    return false;
  }
}
