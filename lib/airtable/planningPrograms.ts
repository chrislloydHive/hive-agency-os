// lib/airtable/planningPrograms.ts
// Airtable integration for PlanningPrograms table
//
// Planning Programs are the Strategy→Deliver→Work planning units.
// They translate Strategy Tactics into executable Work Items.

import { getBase } from '../airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  PlanningProgram,
  PlanningProgramInput,
  PlanningProgramPatch,
  PlanningProgramStatus,
  PlanningProgramOrigin,
  PlanningProgramScope,
  PlanningProgramSuccess,
  PlanningProgramPlanDetails,
  PlanningProgramCommitment,
  ProgramArtifactLink,
  WorkstreamType,
} from '@/lib/types/program';
import { generatePlanningProgramId, stablePlanningProgramKey } from '@/lib/types/program';
import type { ProgramDomain, IntensityLevel } from '@/lib/types/programTemplate';

const PLANNING_PROGRAMS_TABLE = AIRTABLE_TABLES.PLANNING_PROGRAMS;

// ============================================================================
// Airtable Field Constants
// ============================================================================

const FIELDS = {
  COMPANY: 'Company',
  COMPANY_ID: 'Company ID',
  STRATEGY_ID: 'Strategy ID',
  PROGRAM_ID: 'Program ID',
  TITLE: 'Title',
  STATUS: 'Status',
  STABLE_KEY: 'Stable Key',
  ORIGIN_JSON: 'Origin JSON',
  SCOPE_JSON: 'Scope JSON',
  SUCCESS_JSON: 'Success JSON',
  PLAN_JSON: 'Plan JSON',
  COMMITMENT_JSON: 'Commitment JSON',
  ARTIFACTS_JSON: 'Artifacts JSON',
  WORK_PLAN_JSON: 'Work Plan JSON', // JSON-encoded work plan for materialization
  WORK_PLAN_VERSION: 'Work Plan Version', // Incremented on each materialization
  // Template fields (for bundle instantiation)
  TEMPLATE_ID: 'Template ID',
  DOMAIN: 'Domain',
  INTENSITY: 'Intensity',
  BUNDLE_ID: 'Bundle ID',
  SCOPE_ENFORCED: 'Scope Enforced',
  MAX_CONCURRENT_WORK: 'Max Concurrent Work',
  ALLOWED_WORK_TYPES_JSON: 'Allowed Work Types JSON',
  CREATED_AT: 'Created At',
  UPDATED_AT: 'Updated At',
} as const;

// ============================================================================
// Airtable Record Mapping
// ============================================================================

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

/**
 * Map Airtable record to PlanningProgram
 */
function mapAirtableRecord(record: AirtableRecord): PlanningProgram | null {
  try {
    const fields = record.fields;

    // Get linked company ID
    const companyLinks = fields[FIELDS.COMPANY] as string[] | undefined;
    const companyId = companyLinks?.[0] || (fields[FIELDS.COMPANY_ID] as string) || '';

    // Parse JSON fields
    const originJson = fields[FIELDS.ORIGIN_JSON] as string | undefined;
    const scopeJson = fields[FIELDS.SCOPE_JSON] as string | undefined;
    const successJson = fields[FIELDS.SUCCESS_JSON] as string | undefined;
    const planJson = fields[FIELDS.PLAN_JSON] as string | undefined;
    const commitmentJson = fields[FIELDS.COMMITMENT_JSON] as string | undefined;
    const artifactsJson = fields[FIELDS.ARTIFACTS_JSON] as string | undefined;

    const origin: PlanningProgramOrigin = originJson
      ? JSON.parse(originJson)
      : { strategyId: fields[FIELDS.STRATEGY_ID] as string || '' };

    const scope: PlanningProgramScope = scopeJson
      ? JSON.parse(scopeJson)
      : { summary: '', deliverables: [], workstreams: [], channels: [], constraints: [], assumptions: [], unknowns: [], dependencies: [] };

    const success: PlanningProgramSuccess = successJson
      ? JSON.parse(successJson)
      : { kpis: [] };

    const planDetails: PlanningProgramPlanDetails = planJson
      ? JSON.parse(planJson)
      : { horizonDays: 30, milestones: [] };

    const commitment: PlanningProgramCommitment = commitmentJson
      ? JSON.parse(commitmentJson)
      : { workItemIds: [] };

    const linkedArtifacts: ProgramArtifactLink[] = artifactsJson
      ? JSON.parse(artifactsJson)
      : [];

    // Parse template fields
    const allowedWorkTypesJson = fields[FIELDS.ALLOWED_WORK_TYPES_JSON] as string | undefined;
    const allowedWorkTypes: WorkstreamType[] | undefined = allowedWorkTypesJson
      ? JSON.parse(allowedWorkTypesJson)
      : undefined;

    return {
      id: (fields[FIELDS.PROGRAM_ID] as string) || record.id,
      companyId,
      strategyId: (fields[FIELDS.STRATEGY_ID] as string) || origin.strategyId || '',
      title: (fields[FIELDS.TITLE] as string) || '',
      status: (fields[FIELDS.STATUS] as PlanningProgramStatus) || 'draft',
      stableKey: (fields[FIELDS.STABLE_KEY] as string) || undefined,
      origin,
      scope,
      success,
      planDetails,
      commitment,
      linkedArtifacts,
      workPlanJson: (fields[FIELDS.WORK_PLAN_JSON] as string) || null,
      workPlanVersion: (fields[FIELDS.WORK_PLAN_VERSION] as number) || 0,
      // Template fields
      templateId: (fields[FIELDS.TEMPLATE_ID] as string) || undefined,
      domain: (fields[FIELDS.DOMAIN] as ProgramDomain) || undefined,
      intensity: (fields[FIELDS.INTENSITY] as IntensityLevel) || undefined,
      bundleId: (fields[FIELDS.BUNDLE_ID] as string) || undefined,
      scopeEnforced: (fields[FIELDS.SCOPE_ENFORCED] as boolean) || false,
      maxConcurrentWork: (fields[FIELDS.MAX_CONCURRENT_WORK] as number) || undefined,
      allowedWorkTypes,
      createdAt: (fields[FIELDS.CREATED_AT] as string) || null,
      updatedAt: (fields[FIELDS.UPDATED_AT] as string) || null,
    };
  } catch (error) {
    console.error(`[PlanningPrograms] Failed to map record ${record.id}:`, error);
    return null;
  }
}

/**
 * Map PlanningProgram to Airtable fields
 */
function toAirtableFields(program: PlanningProgramInput, includeId: boolean = false): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    [FIELDS.COMPANY]: [program.companyId], // Link field
    [FIELDS.COMPANY_ID]: program.companyId,
    [FIELDS.STRATEGY_ID]: program.strategyId,
    [FIELDS.TITLE]: program.title,
    [FIELDS.STATUS]: program.status,
    [FIELDS.STABLE_KEY]: program.stableKey || null,
    [FIELDS.ORIGIN_JSON]: JSON.stringify(program.origin),
    [FIELDS.SCOPE_JSON]: JSON.stringify(program.scope),
    [FIELDS.SUCCESS_JSON]: JSON.stringify(program.success),
    [FIELDS.PLAN_JSON]: JSON.stringify(program.planDetails),
    [FIELDS.COMMITMENT_JSON]: JSON.stringify(program.commitment),
    [FIELDS.ARTIFACTS_JSON]: JSON.stringify(program.linkedArtifacts || []),
    [FIELDS.WORK_PLAN_JSON]: program.workPlanJson || null,
    [FIELDS.WORK_PLAN_VERSION]: program.workPlanVersion || 0,
    // Template fields (only include if set)
    ...(program.templateId && { [FIELDS.TEMPLATE_ID]: program.templateId }),
    ...(program.domain && { [FIELDS.DOMAIN]: program.domain }),
    ...(program.intensity && { [FIELDS.INTENSITY]: program.intensity }),
    ...(program.bundleId && { [FIELDS.BUNDLE_ID]: program.bundleId }),
    [FIELDS.SCOPE_ENFORCED]: program.scopeEnforced || false,
    ...(program.maxConcurrentWork !== undefined && { [FIELDS.MAX_CONCURRENT_WORK]: program.maxConcurrentWork }),
    ...(program.allowedWorkTypes && { [FIELDS.ALLOWED_WORK_TYPES_JSON]: JSON.stringify(program.allowedWorkTypes) }),
    // Note: Created At and Updated At are computed fields in Airtable - don't set them
  };

  if (includeId) {
    fields[FIELDS.PROGRAM_ID] = generatePlanningProgramId();
  }

  return fields;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * List all planning programs for a company
 */
export async function listPlanningPrograms(
  companyId: string,
  strategyId?: string
): Promise<PlanningProgram[]> {
  try {
    const base = getBase();

    // Build filter formula
    let filterFormula = `{${FIELDS.COMPANY_ID}} = "${companyId}"`;
    if (strategyId) {
      filterFormula = `AND(${filterFormula}, {${FIELDS.STRATEGY_ID}} = "${strategyId}")`;
    }

    const records = await base(PLANNING_PROGRAMS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: FIELDS.UPDATED_AT, direction: 'desc' }],
      })
      .all();

    const programs = records
      .map(record => mapAirtableRecord(record as AirtableRecord))
      .filter((p): p is PlanningProgram => p !== null);

    return programs;
  } catch (error: unknown) {
    // Handle case where table doesn't exist yet
    const airtableError = error as { statusCode?: number; error?: string };
    if (airtableError?.statusCode === 404 || airtableError?.error === 'NOT_FOUND') {
      console.warn(`[PlanningPrograms] Table "${PLANNING_PROGRAMS_TABLE}" not found in Airtable.`);
      return [];
    }
    console.error(`[PlanningPrograms] Failed to list programs for ${companyId}:`, error);
    return [];
  }
}

/**
 * Get a single planning program by ID
 */
export async function getPlanningProgram(programId: string): Promise<PlanningProgram | null> {
  try {
    const base = getBase();

    // Try to find by Program ID field first
    const records = await base(PLANNING_PROGRAMS_TABLE)
      .select({
        filterByFormula: `{${FIELDS.PROGRAM_ID}} = "${programId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length > 0) {
      return mapAirtableRecord(records[0] as AirtableRecord);
    }

    // Fallback to Airtable record ID
    try {
      const record = await base(PLANNING_PROGRAMS_TABLE).find(programId);
      return mapAirtableRecord(record as AirtableRecord);
    } catch {
      return null;
    }
  } catch (error) {
    console.error(`[PlanningPrograms] Failed to get program ${programId}:`, error);
    return null;
  }
}

/**
 * Find a planning program by stable key (for idempotent creation)
 */
export async function findPlanningProgramByStableKey(
  stableKey: string
): Promise<PlanningProgram | null> {
  try {
    const base = getBase();

    const records = await base(PLANNING_PROGRAMS_TABLE)
      .select({
        filterByFormula: `{${FIELDS.STABLE_KEY}} = "${stableKey}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length > 0) {
      return mapAirtableRecord(records[0] as AirtableRecord);
    }

    return null;
  } catch (error: unknown) {
    const airtableError = error as { statusCode?: number; error?: string };
    if (airtableError?.statusCode === 404 || airtableError?.error === 'NOT_FOUND') {
      return null;
    }
    console.error(`[PlanningPrograms] Failed to find by stable key ${stableKey}:`, error);
    return null;
  }
}

/**
 * Create a new planning program
 */
export async function createPlanningProgram(
  input: PlanningProgramInput
): Promise<PlanningProgram | null> {
  try {
    const base = getBase();

    const fields = toAirtableFields(input, true);

    const records = await base(PLANNING_PROGRAMS_TABLE).create([{ fields: fields as never }]);

    if (!records || records.length === 0) {
      return null;
    }

    return mapAirtableRecord(records[0] as AirtableRecord);
  } catch (error) {
    console.error(`[PlanningPrograms] Failed to create program:`, error);
    return null;
  }
}

/**
 * Create a planning program from a tactic (idempotent)
 * If a program with the same stable key exists, return it instead
 */
export async function createPlanningProgramFromTactic(
  companyId: string,
  strategyId: string,
  tacticId: string,
  tacticTitle: string,
  tacticDescription: string,
  options?: {
    objectiveId?: string;
    betId?: string;
    workstreams?: PlanningProgramScope['workstreams'];
    channels?: string[];
  }
): Promise<{ program: PlanningProgram; created: boolean } | null> {
  try {
    const stableKey = stablePlanningProgramKey(strategyId, tacticId);

    // Check if program already exists
    const existing = await findPlanningProgramByStableKey(stableKey);
    if (existing) {
      return { program: existing, created: false };
    }

    // Create new program
    const input: PlanningProgramInput = {
      companyId,
      strategyId,
      title: tacticTitle,
      status: 'draft',
      stableKey,
      origin: {
        strategyId,
        objectiveId: options?.objectiveId,
        betId: options?.betId,
        tacticId,
        tacticTitle,
      },
      scope: {
        summary: tacticDescription,
        deliverables: [],
        workstreams: options?.workstreams || [],
        channels: options?.channels || [],
        constraints: [],
        assumptions: [],
        unknowns: [],
        dependencies: [],
      },
      success: { kpis: [] },
      planDetails: { horizonDays: 30, milestones: [] },
      commitment: { workItemIds: [] },
      linkedArtifacts: [],
      workPlanVersion: 0,
      scopeEnforced: false, // Tactic-based programs don't enforce scope by default
    };

    const created = await createPlanningProgram(input);
    if (!created) return null;

    return { program: created, created: true };
  } catch (error) {
    console.error(`[PlanningPrograms] Failed to create from tactic ${tacticId}:`, error);
    return null;
  }
}

/**
 * Update a planning program
 */
export async function updatePlanningProgram(
  programId: string,
  patch: PlanningProgramPatch
): Promise<PlanningProgram | null> {
  try {
    const base = getBase();

    // Get existing program to merge with patch
    const existing = await getPlanningProgram(programId);
    if (!existing) {
      console.error(`[PlanningPrograms] Program ${programId} not found`);
      return null;
    }

    // Build update fields
    // Note: Updated At is a computed field in Airtable - don't set it
    const updateFields: Record<string, unknown> = {};

    if (patch.title !== undefined) {
      updateFields[FIELDS.TITLE] = patch.title;
    }

    if (patch.status !== undefined) {
      updateFields[FIELDS.STATUS] = patch.status;
    }

    if (patch.origin !== undefined) {
      updateFields[FIELDS.ORIGIN_JSON] = JSON.stringify(patch.origin);
    }

    if (patch.scope !== undefined) {
      updateFields[FIELDS.SCOPE_JSON] = JSON.stringify(patch.scope);
    }

    if (patch.success !== undefined) {
      updateFields[FIELDS.SUCCESS_JSON] = JSON.stringify(patch.success);
    }

    if (patch.planDetails !== undefined) {
      updateFields[FIELDS.PLAN_JSON] = JSON.stringify(patch.planDetails);
    }

    if (patch.commitment !== undefined) {
      updateFields[FIELDS.COMMITMENT_JSON] = JSON.stringify(patch.commitment);
    }

    if (patch.linkedArtifacts !== undefined) {
      updateFields[FIELDS.ARTIFACTS_JSON] = JSON.stringify(patch.linkedArtifacts);
    }

    // Template fields
    if (patch.templateId !== undefined) {
      updateFields[FIELDS.TEMPLATE_ID] = patch.templateId;
    }

    if (patch.domain !== undefined) {
      updateFields[FIELDS.DOMAIN] = patch.domain;
    }

    if (patch.intensity !== undefined) {
      updateFields[FIELDS.INTENSITY] = patch.intensity;
    }

    if (patch.bundleId !== undefined) {
      updateFields[FIELDS.BUNDLE_ID] = patch.bundleId;
    }

    if (patch.scopeEnforced !== undefined) {
      updateFields[FIELDS.SCOPE_ENFORCED] = patch.scopeEnforced;
    }

    if (patch.maxConcurrentWork !== undefined) {
      updateFields[FIELDS.MAX_CONCURRENT_WORK] = patch.maxConcurrentWork;
    }

    if (patch.allowedWorkTypes !== undefined) {
      updateFields[FIELDS.ALLOWED_WORK_TYPES_JSON] = JSON.stringify(patch.allowedWorkTypes);
    }

    // Find Airtable record ID from program ID
    const records = await base(PLANNING_PROGRAMS_TABLE)
      .select({
        filterByFormula: `{${FIELDS.PROGRAM_ID}} = "${programId}"`,
        maxRecords: 1,
      })
      .firstPage();

    let airtableRecordId = programId;
    if (records.length > 0) {
      airtableRecordId = records[0].id;
    }

     
    const updatedRecords = await base(PLANNING_PROGRAMS_TABLE).update([
      {
        id: airtableRecordId,
        fields: updateFields as any,
      },
    ]);

    if (!updatedRecords || updatedRecords.length === 0) {
      return null;
    }

    return mapAirtableRecord(updatedRecords[0] as AirtableRecord);
  } catch (error) {
    console.error(`[PlanningPrograms] Failed to update program ${programId}:`, error);
    return null;
  }
}

/**
 * Update program status
 */
export async function updatePlanningProgramStatus(
  programId: string,
  status: PlanningProgramStatus
): Promise<PlanningProgram | null> {
  return updatePlanningProgram(programId, { status });
}

/**
 * Archive a planning program (soft delete)
 */
export async function archivePlanningProgram(programId: string): Promise<PlanningProgram | null> {
  return updatePlanningProgramStatus(programId, 'archived');
}

/**
 * Commit a program (set status to committed and record commitment details)
 */
export async function commitPlanningProgram(
  programId: string,
  workItemIds: string[],
  committedBy?: string,
  commitmentNotes?: string
): Promise<PlanningProgram | null> {
  const commitment: PlanningProgramCommitment = {
    committedAt: new Date().toISOString(),
    committedBy,
    commitmentNotes,
    workItemIds,
  };

  return updatePlanningProgram(programId, {
    status: 'committed',
    commitment,
  });
}

/**
 * Get committed programs for a company
 */
export async function getCommittedPlanningPrograms(
  companyId: string,
  strategyId?: string
): Promise<PlanningProgram[]> {
  const programs = await listPlanningPrograms(companyId, strategyId);
  return programs.filter(p => p.status === 'committed');
}

/**
 * Get programs by status
 */
export async function getPlanningProgramsByStatus(
  companyId: string,
  status: PlanningProgramStatus
): Promise<PlanningProgram[]> {
  const programs = await listPlanningPrograms(companyId);
  return programs.filter(p => p.status === status);
}
