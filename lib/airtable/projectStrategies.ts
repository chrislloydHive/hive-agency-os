// lib/airtable/projectStrategies.ts
// Airtable integration for ProjectStrategies table
//
// Project strategies are stored as JSON blobs in Airtable.
// They are project-scoped and collapse into Creative Briefs.

import { getBase } from '../airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  ProjectStrategy,
  ProjectStrategyStatus,
  ProjectStrategicFrame,
  CreateProjectStrategyInput,
  CompanyStrategySnapshot,
} from '@/lib/types/projectStrategy';
import type { StrategyObjective, StrategicBet, StrategyPlay } from '@/lib/types/strategy';

const PROJECT_STRATEGIES_TABLE = AIRTABLE_TABLES.PROJECT_STRATEGIES;

// ============================================================================
// Airtable Field Mapping
// ============================================================================

/**
 * Map Airtable record to ProjectStrategy
 */
function mapAirtableRecord(record: {
  id: string;
  fields: Record<string, unknown>;
}): ProjectStrategy | null {
  try {
    const fields = record.fields;

    // Get linked company ID
    const companyLinks = fields['Company'] as string[] | undefined;
    const companyId = companyLinks?.[0] || (fields['Company ID'] as string) || '';

    // Parse JSON blobs
    const frameJson = fields['Strategic Frame JSON'] as string | undefined;
    const objectivesJson = fields['Objectives JSON'] as string | undefined;
    const betsJson = fields['Strategic Bets JSON'] as string | undefined;
    const tacticsJson = fields['Tactics JSON'] as string | undefined;
    const snapshotJson = fields['Inherited Snapshot JSON'] as string | undefined;

    const strategicFrame: ProjectStrategicFrame = frameJson
      ? JSON.parse(frameJson)
      : {};

    const objectives: StrategyObjective[] = objectivesJson
      ? JSON.parse(objectivesJson)
      : [];

    const strategicBets: StrategicBet[] = betsJson
      ? JSON.parse(betsJson)
      : [];

    const tactics: StrategyPlay[] = tacticsJson
      ? JSON.parse(tacticsJson)
      : [];

    const inheritedSnapshot: CompanyStrategySnapshot | undefined = snapshotJson
      ? JSON.parse(snapshotJson)
      : undefined;

    return {
      id: record.id,
      companyId,
      projectId: (fields['Project ID'] as string) || '',
      inheritedSnapshot,
      strategicFrame,
      objectives,
      strategicBets,
      tactics,
      status: (fields['Status'] as ProjectStrategyStatus) || 'draft',
      isLocked: (fields['Is Locked'] as boolean) || false,
      lockedAt: (fields['Locked At'] as string) || undefined,
      lockedReason: (fields['Locked Reason'] as string) || undefined,
      createdAt: (fields['Created At'] as string) || new Date().toISOString(),
      updatedAt: (fields['Updated At'] as string) || new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[ProjectStrategies] Failed to map record ${record.id}:`, error);
    return null;
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get a project strategy by ID
 */
export async function getProjectStrategyById(strategyId: string): Promise<ProjectStrategy | null> {
  try {
    const base = getBase();
    const record = await base(PROJECT_STRATEGIES_TABLE).find(strategyId);
    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[ProjectStrategies] Failed to get strategy ${strategyId}:`, error);
    return null;
  }
}

/**
 * Get project strategy by project ID
 */
export async function getProjectStrategyByProjectId(projectId: string): Promise<ProjectStrategy | null> {
  try {
    const base = getBase();

    const records = await base(PROJECT_STRATEGIES_TABLE)
      .select({
        filterByFormula: `{Project ID} = "${projectId}"`,
        maxRecords: 1,
      })
      .all();

    if (records.length === 0) return null;

    return mapAirtableRecord(records[0] as { id: string; fields: Record<string, unknown> });
  } catch (error: unknown) {
    const airtableError = error as { statusCode?: number; error?: string };
    if (airtableError?.statusCode === 404 || airtableError?.error === 'NOT_FOUND') {
      console.warn(`[ProjectStrategies] Table "${PROJECT_STRATEGIES_TABLE}" not found in Airtable.`);
      return null;
    }
    console.error(`[ProjectStrategies] Failed to get strategy for project ${projectId}:`, error);
    return null;
  }
}

/**
 * Get all project strategies for a company
 */
export async function getProjectStrategiesForCompany(companyId: string): Promise<ProjectStrategy[]> {
  try {
    const base = getBase();

    const filterFormula = `OR(FIND("${companyId}", ARRAYJOIN({Company})) > 0, {Company ID} = "${companyId}")`;

    const records = await base(PROJECT_STRATEGIES_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .all();

    const strategies = records
      .map(record => mapAirtableRecord(record as { id: string; fields: Record<string, unknown> }))
      .filter((s): s is ProjectStrategy => s !== null);

    return strategies;
  } catch (error) {
    console.error(`[ProjectStrategies] Failed to get strategies for company ${companyId}:`, error);
    return [];
  }
}

/**
 * Create a new project strategy
 */
export async function createProjectStrategy(
  input: CreateProjectStrategyInput,
  inheritedSnapshot?: CompanyStrategySnapshot,
  initialFrame?: Partial<ProjectStrategicFrame>
): Promise<ProjectStrategy | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const strategicFrame: ProjectStrategicFrame = {
      // Pre-populate from inherited snapshot if available
      targetAudience: inheritedSnapshot?.audience,
      ...initialFrame,
    };

    const record = await base(PROJECT_STRATEGIES_TABLE).create({
      'Company': [input.companyId],
      'Company ID': input.companyId,
      'Project ID': input.projectId,
      'Strategic Frame JSON': JSON.stringify(strategicFrame),
      'Objectives JSON': JSON.stringify([]),
      'Strategic Bets JSON': JSON.stringify([]),
      'Tactics JSON': JSON.stringify([]),
      'Inherited Snapshot JSON': inheritedSnapshot ? JSON.stringify(inheritedSnapshot) : undefined,
      'Status': 'draft' as ProjectStrategyStatus,
      'Is Locked': false,
      'Created At': now,
      'Updated At': now,
    });

    return mapAirtableRecord(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[ProjectStrategies] Failed to create strategy:`, error);
    return null;
  }
}

/**
 * Update a project strategy
 */
export async function updateProjectStrategy(
  strategyId: string,
  updates: {
    strategicFrame?: ProjectStrategicFrame;
    objectives?: StrategyObjective[];
    strategicBets?: StrategicBet[];
    tactics?: StrategyPlay[];
    status?: ProjectStrategyStatus;
    isLocked?: boolean;
    lockedAt?: string;
    lockedReason?: string;
  }
): Promise<ProjectStrategy | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields: Record<string, unknown> = {
      'Updated At': now,
    };

    if (updates.strategicFrame !== undefined) {
      fields['Strategic Frame JSON'] = JSON.stringify(updates.strategicFrame);
    }
    if (updates.objectives !== undefined) {
      fields['Objectives JSON'] = JSON.stringify(updates.objectives);
    }
    if (updates.strategicBets !== undefined) {
      fields['Strategic Bets JSON'] = JSON.stringify(updates.strategicBets);
      // Also update accepted bets count for querying
      fields['Accepted Bets Count'] = updates.strategicBets.filter(b => b.status === 'accepted').length;
    }
    if (updates.tactics !== undefined) {
      fields['Tactics JSON'] = JSON.stringify(updates.tactics);
    }
    if (updates.status !== undefined) {
      fields['Status'] = updates.status;
    }
    if (updates.isLocked !== undefined) {
      fields['Is Locked'] = updates.isLocked;
    }
    if (updates.lockedAt !== undefined) {
      fields['Locked At'] = updates.lockedAt;
    }
    if (updates.lockedReason !== undefined) {
      fields['Locked Reason'] = updates.lockedReason;
    }

    const record = await base(PROJECT_STRATEGIES_TABLE).update(strategyId, fields as any);

    return mapAirtableRecord(record as unknown as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    console.error(`[ProjectStrategies] Failed to update strategy ${strategyId}:`, error);
    return null;
  }
}

/**
 * Update just the strategic frame
 */
export async function updateStrategicFrame(
  strategyId: string,
  frame: ProjectStrategicFrame
): Promise<ProjectStrategy | null> {
  return updateProjectStrategy(strategyId, { strategicFrame: frame });
}

/**
 * Update objectives
 */
export async function updateObjectives(
  strategyId: string,
  objectives: StrategyObjective[]
): Promise<ProjectStrategy | null> {
  return updateProjectStrategy(strategyId, { objectives });
}

/**
 * Update strategic bets
 */
export async function updateStrategicBets(
  strategyId: string,
  bets: StrategicBet[]
): Promise<ProjectStrategy | null> {
  return updateProjectStrategy(strategyId, { strategicBets: bets });
}

/**
 * Accept a strategic bet
 */
export async function acceptStrategicBet(
  strategyId: string,
  betId: string
): Promise<ProjectStrategy | null> {
  const strategy = await getProjectStrategyById(strategyId);
  if (!strategy) return null;

  const updatedBets = strategy.strategicBets.map(bet =>
    bet.id === betId ? { ...bet, status: 'accepted' as const } : bet
  );

  return updateStrategicBets(strategyId, updatedBets);
}

/**
 * Reject a strategic bet
 */
export async function rejectStrategicBet(
  strategyId: string,
  betId: string
): Promise<ProjectStrategy | null> {
  const strategy = await getProjectStrategyById(strategyId);
  if (!strategy) return null;

  const updatedBets = strategy.strategicBets.map(bet =>
    bet.id === betId ? { ...bet, status: 'rejected' as const } : bet
  );

  return updateStrategicBets(strategyId, updatedBets);
}

/**
 * Update tactics
 */
export async function updateTactics(
  strategyId: string,
  tactics: StrategyPlay[]
): Promise<ProjectStrategy | null> {
  return updateProjectStrategy(strategyId, { tactics });
}

/**
 * Lock a project strategy (after brief approval)
 */
export async function lockProjectStrategy(
  strategyId: string,
  reason: string
): Promise<ProjectStrategy | null> {
  const now = new Date().toISOString();
  return updateProjectStrategy(strategyId, {
    status: 'locked',
    isLocked: true,
    lockedAt: now,
    lockedReason: reason,
  });
}

/**
 * Update strategy status
 */
export async function updateProjectStrategyStatus(
  strategyId: string,
  status: ProjectStrategyStatus
): Promise<ProjectStrategy | null> {
  return updateProjectStrategy(strategyId, { status });
}

/**
 * Delete a project strategy
 */
export async function deleteProjectStrategy(strategyId: string): Promise<boolean> {
  try {
    const base = getBase();
    await base(PROJECT_STRATEGIES_TABLE).destroy(strategyId);
    return true;
  } catch (error) {
    console.error(`[ProjectStrategies] Failed to delete strategy ${strategyId}:`, error);
    return false;
  }
}
