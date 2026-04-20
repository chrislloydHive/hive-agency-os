// lib/airtable/people.ts
// Airtable helpers for People table
//
// People table schema:
// - Primary field: "Person" (name)
// - Email: "Email"
// - Active flag: "Is Active" (checkbox)
//
// Used for resolving task owners to real People records.

import Airtable from 'airtable';

const PEOPLE_TABLE = process.env.AIRTABLE_PEOPLE_TABLE || 'People';

/**
 * The People table lives in the PM OS base, not the Hive DB base.
 * We need a separate Airtable base connection for cross-base reads.
 */
function getPeopleBase(): Airtable.Base {
  const apiKey = process.env.AIRTABLE_API_KEY ?? '';
  const baseId = process.env.AIRTABLE_PM_OS_BASE_ID?.trim() || 'appQLwoVH8JyGSTIo';
  if (!apiKey) {
    throw new Error('AIRTABLE_API_KEY is required for People table access');
  }
  return new Airtable({ apiKey }).base(baseId);
}

let _peopleBase: Airtable.Base | null = null;
function base(table: string) {
  if (!_peopleBase) _peopleBase = getPeopleBase();
  return _peopleBase(table);
}

// ============================================================================
// Types
// ============================================================================

export interface PersonRecord {
  id: string;       // Airtable record ID
  name: string;     // Person (primary field)
  email?: string;   // Email field
  role?: string;    // Role (Client, Media, Creative, Ops, etc.)
  isActive: boolean;
}

export interface ResolvedOwner {
  id: string;
  name: string;
}

// ============================================================================
// Helpers
// ============================================================================

function mapRecordToPerson(record: any): PersonRecord {
  const fields = record.fields || {};
  return {
    id: record.id,
    name: fields['Person'] || fields['Name'] || '',
    email: fields['Email'] || undefined,
    role: fields['Role'] || undefined,
    isActive: fields['Is Active'] === true,
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Find a person by email address
 * Returns {id, name} ONLY if exactly one active match exists
 *
 * @param email - Email address to search for
 * @returns Person record or null if not found / multiple matches
 */
export async function findPersonByEmail(email: string): Promise<ResolvedOwner | null> {
  if (!email || !email.trim()) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Search for active people with matching email
    const records = await base(PEOPLE_TABLE)
      .select({
        filterByFormula: `AND({Email} = "${normalizedEmail}", {Is Active} = TRUE())`,
        maxRecords: 2, // Get 2 to detect ambiguity
      })
      .firstPage();

    // Must be exactly one match
    if (records.length !== 1) {
      if (records.length > 1) {
        console.warn(`[People] Multiple active matches for email: ${normalizedEmail}`);
      }
      return null;
    }

    const person = mapRecordToPerson(records[0]);
    console.log(`[People] Found person by email: ${person.name} (${person.id})`);

    return {
      id: person.id,
      name: person.name,
    };
  } catch (error) {
    console.error('[People] Error finding person by email:', error);
    return null;
  }
}

/**
 * Find a person by name
 * Returns {id, name} ONLY if exactly one active match exists
 *
 * Uses case-insensitive matching via LOWER()
 *
 * @param name - Name to search for
 * @returns Person record or null if not found / multiple matches
 */
export async function findPersonByName(name: string): Promise<ResolvedOwner | null> {
  if (!name || !name.trim()) {
    return null;
  }

  const normalizedName = name.trim().toLowerCase();

  try {
    // Search for active people with matching name (case-insensitive)
    const records = await base(PEOPLE_TABLE)
      .select({
        filterByFormula: `AND(LOWER({Person}) = "${normalizedName}", {Is Active} = TRUE())`,
        maxRecords: 2, // Get 2 to detect ambiguity
      })
      .firstPage();

    // Must be exactly one match
    if (records.length !== 1) {
      if (records.length > 1) {
        console.warn(`[People] Multiple active matches for name: ${name}`);
      }
      return null;
    }

    const person = mapRecordToPerson(records[0]);
    console.log(`[People] Found person by name: ${person.name} (${person.id})`);

    return {
      id: person.id,
      name: person.name,
    };
  } catch (error) {
    console.error('[People] Error finding person by name:', error);
    return null;
  }
}

/**
 * Safe resolver for task owners
 * Tries email first, then falls back to name
 *
 * NEVER invents People records - returns null if no match
 *
 * @param params - Object with optional email and/or name
 * @returns Resolved owner {id, name} or null
 */
export async function resolveOwnerPerson(params: {
  email?: string;
  name?: string;
}): Promise<ResolvedOwner | null> {
  const { email, name } = params;

  // Try email first (most reliable)
  if (email) {
    const byEmail = await findPersonByEmail(email);
    if (byEmail) {
      return byEmail;
    }
  }

  // Fall back to name
  if (name) {
    const byName = await findPersonByName(name);
    if (byName) {
      return byName;
    }
  }

  // No match found
  console.log('[People] Could not resolve owner:', { email, name });
  return null;
}

/**
 * Get all active people (for dropdowns, etc.)
 *
 * @returns Array of active person records
 */
export async function getAllActivePeople(): Promise<PersonRecord[]> {
  try {
    const records = await base(PEOPLE_TABLE)
      .select({
        filterByFormula: '{Is Active} = TRUE()',
        sort: [{ field: 'Person', direction: 'asc' }],
      })
      .all();

    return records.map(mapRecordToPerson);
  } catch (error) {
    console.error('[People] Error fetching active people:', error);
    return [];
  }
}

/**
 * Get a person by their Airtable record ID
 *
 * @param recordId - Airtable record ID
 * @returns Person record or null if not found
 */
export async function getPersonById(recordId: string): Promise<PersonRecord | null> {
  if (!recordId) {
    return null;
  }

  try {
    const record = await base(PEOPLE_TABLE).find(recordId);
    return mapRecordToPerson(record);
  } catch (error) {
    console.error(`[People] Error fetching person ${recordId}:`, error);
    return null;
  }
}
