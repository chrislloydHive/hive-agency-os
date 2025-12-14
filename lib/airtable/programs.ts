// lib/airtable/programs.ts
// Airtable integration for Programs table
//
// Programs are stored as JSON blobs in Airtable, similar to Context Graphs.
// MVP: Website Program only

import { getBase } from '../airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  ProgramRecord,
  ProgramType,
  ProgramStatus,
  WebsiteProgramPlan,
  WebsiteProgramPlanUpdate,
} from '@/lib/types/program';

const PROGRAMS_TABLE = AIRTABLE_TABLES.PROGRAMS;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

/**
 * Map Airtable record to ProgramRecord
 */
function mapAirtableRecord(record: {
  id: string;
  fields: Record<string, unknown>;
}): ProgramRecord | null {
  try {
    const fields = record.fields;

    // Parse plan JSON
    const planJson = fields['Plan JSON'] as string | undefined;
    if (!planJson) {
      console.warn(`[Programs] Record ${record.id} missing Plan JSON`);
      return null;
    }

    const plan = JSON.parse(planJson) as WebsiteProgramPlan;

    // Get linked company ID
    const companyLinks = fields['Company'] as string[] | undefined;
    const companyId = companyLinks?.[0] || (fields['Company ID'] as string) || '';

    return {
      id: record.id,
      companyId,
      type: (fields['Program Type'] as ProgramType) || 'website',
      status: (fields['Status'] as ProgramStatus) || 'draft',
      plan,
      createdAt: (fields['Created At'] as string) || new Date().toISOString(),
      updatedAt: (fields['Updated At'] as string) || new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[Programs] Failed to map record ${record.id}:`, error);
    return null;
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get all programs for a company
 * @param companyId - Company ID (Airtable record ID)
 * @param type - Optional filter by program type
 */
export async function getProgramsForCompany(
  companyId: string,
  type?: ProgramType
): Promise<ProgramRecord[]> {
  try {
    const base = getBase();

    // Build filter formula
    let filterFormula = `FIND("${companyId}", ARRAYJOIN({Company})) > 0`;
    if (type) {
      filterFormula = `AND(${filterFormula}, {Program Type} = "${type}")`;
    }

    const records = await base(PROGRAMS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .all();

    const programs = records
      .map(record => mapAirtableRecord(record as { id: string; fields: Record<string, unknown> }))
      .filter((p): p is ProgramRecord => p !== null);

    return programs;
  } catch (error: unknown) {
    // Handle case where table doesn't exist yet
    const airtableError = error as { statusCode?: number; error?: string };
    if (airtableError?.statusCode === 404 || airtableError?.error === 'NOT_FOUND') {
      console.warn(`[Programs] Table "${PROGRAMS_TABLE}" not found in Airtable.`);
      return [];
    }
    console.error(`[Programs] Failed to get programs for ${companyId}:`, error);
    return [];
  }
}

/**
 * Get a single program by ID
 */
export async function getProgramById(programId: string): Promise<ProgramRecord | null> {
  try {
    const base = getBase();
    const record = await base(PROGRAMS_TABLE).find(programId);
    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Programs] Failed to get program ${programId}:`, error);
    return null;
  }
}

/**
 * Create a new program
 */
export async function createProgram(
  companyId: string,
  type: ProgramType,
  plan: WebsiteProgramPlan
): Promise<ProgramRecord | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const record = await base(PROGRAMS_TABLE).create({
      'Company': [companyId], // Link to company
      'Company ID': companyId, // Also store as text for easier querying
      'Program Type': type,
      'Status': 'draft' as ProgramStatus,
      'Title': plan.title,
      'Summary': plan.summary,
      'Plan JSON': JSON.stringify(plan),
      'Created At': now,
      'Updated At': now,
    });

    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Programs] Failed to create program:`, error);
    return null;
  }
}

/**
 * Update a program's plan
 */
export async function updateProgramPlan(
  programId: string,
  planUpdate: WebsiteProgramPlanUpdate
): Promise<ProgramRecord | null> {
  try {
    const base = getBase();

    // First get existing record
    const existing = await getProgramById(programId);
    if (!existing) {
      console.error(`[Programs] Program ${programId} not found`);
      return null;
    }

    // Merge updates into existing plan
    const updatedPlan: WebsiteProgramPlan = {
      ...existing.plan,
      ...planUpdate,
    };

    const now = new Date().toISOString();

    const record = await base(PROGRAMS_TABLE).update(programId, {
      'Title': updatedPlan.title,
      'Summary': updatedPlan.summary,
      'Plan JSON': JSON.stringify(updatedPlan),
      'Updated At': now,
    });

    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Programs] Failed to update program ${programId}:`, error);
    return null;
  }
}

/**
 * Update a program's status
 */
export async function updateProgramStatus(
  programId: string,
  status: ProgramStatus
): Promise<ProgramRecord | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const record = await base(PROGRAMS_TABLE).update(programId, {
      'Status': status,
      'Updated At': now,
    });

    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[Programs] Failed to update program status ${programId}:`, error);
    return null;
  }
}

/**
 * Activate a program and archive other active programs of the same type
 */
export async function activateProgram(
  programId: string,
  companyId: string,
  type: ProgramType
): Promise<{ activated: ProgramRecord | null; archived: string[] }> {
  try {
    const base = getBase();

    // Get all active programs of this type for this company
    const activePrograms = await getProgramsForCompany(companyId, type);
    const toArchive = activePrograms.filter(
      p => p.status === 'active' && p.id !== programId
    );

    // Archive other active programs
    const archived: string[] = [];
    for (const program of toArchive) {
      await updateProgramStatus(program.id, 'archived');
      archived.push(program.id);
    }

    // Activate this program
    const activated = await updateProgramStatus(programId, 'active');

    return { activated, archived };
  } catch (error) {
    console.error(`[Programs] Failed to activate program ${programId}:`, error);
    return { activated: null, archived: [] };
  }
}

/**
 * Get active program for a company by type
 */
export async function getActiveProgramForCompany(
  companyId: string,
  type: ProgramType
): Promise<ProgramRecord | null> {
  try {
    const programs = await getProgramsForCompany(companyId, type);
    return programs.find(p => p.status === 'active') || null;
  } catch (error) {
    console.error(`[Programs] Failed to get active program:`, error);
    return null;
  }
}
