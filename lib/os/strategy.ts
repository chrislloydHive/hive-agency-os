// lib/os/strategy.ts
// Strategy management for MVP Strategy Workspace
//
// Provides CRUD operations for company marketing strategies.

import { getBase } from '@/lib/airtable';
import type {
  CompanyStrategy,
  StrategyPillar,
  CreateStrategyRequest,
  UpdateStrategyRequest,
  FinalizeStrategyRequest,
  StrategySummary,
} from '@/lib/types/strategy';
import {
  createStrategySummary,
  generateStrategyItemId,
} from '@/lib/types/strategy';

// ============================================================================
// Configuration
// ============================================================================

const STRATEGY_TABLE = 'Company Strategies';

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get the active (most recent non-archived) strategy for a company
 */
export async function getActiveStrategy(companyId: string): Promise<CompanyStrategy | null> {
  try {
    const base = getBase();
    const records = await base(STRATEGY_TABLE)
      .select({
        filterByFormula: `AND({companyId} = '${companyId}', {status} != 'archived')`,
        sort: [{ field: 'updatedAt', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapRecordToStrategy(records[0]);
  } catch (error) {
    console.error('[getActiveStrategy] Error:', error);
    return null;
  }
}

/**
 * Get strategy by ID
 */
export async function getStrategyById(strategyId: string): Promise<CompanyStrategy | null> {
  try {
    const base = getBase();
    const record = await base(STRATEGY_TABLE).find(strategyId);
    return mapRecordToStrategy(record);
  } catch (error) {
    console.error('[getStrategyById] Error:', error);
    return null;
  }
}

/**
 * Get all strategies for a company
 */
export async function getStrategiesForCompany(companyId: string): Promise<CompanyStrategy[]> {
  try {
    const base = getBase();
    const records = await base(STRATEGY_TABLE)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToStrategy);
  } catch (error) {
    console.error('[getStrategiesForCompany] Error:', error);
    return [];
  }
}

/**
 * Get strategy summary for overview display
 */
export async function getStrategySummary(companyId: string): Promise<StrategySummary | null> {
  const strategy = await getActiveStrategy(companyId);
  if (!strategy) return null;
  return createStrategySummary(strategy);
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Create a new draft strategy
 */
export async function createDraftStrategy(request: CreateStrategyRequest): Promise<CompanyStrategy> {
  const { companyId, title, summary, objectives, pillars } = request;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Generate IDs for pillars
    const pillarsWithIds: StrategyPillar[] = (pillars || []).map((p, index) => ({
      ...p,
      id: generateStrategyItemId(),
      order: index,
      priority: p.priority || 'medium',
    }));

    const fields = {
      companyId,
      title: title || 'Untitled Strategy',
      summary: summary || '',
      objectives: JSON.stringify(objectives || []),
      pillars: JSON.stringify(pillarsWithIds),
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const record = await base(STRATEGY_TABLE).create(fields);
    return mapRecordToStrategy(record);
  } catch (error: unknown) {
    console.error('[createDraftStrategy] Error:', error);
    // Extract message from Airtable error format
    const errorMessage = extractAirtableError(error);
    throw new Error(`Failed to create strategy: ${errorMessage}`);
  }
}

/**
 * Extract error message from Airtable error format
 */
function extractAirtableError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    // Airtable error format
    if (err.error && typeof err.error === 'string') {
      return `${err.error}${err.message ? `: ${err.message}` : ''}`;
    }
    if (err.message && typeof err.message === 'string') {
      return err.message;
    }
    // Check for nested error
    if (err.error && typeof err.error === 'object') {
      const nestedErr = err.error as Record<string, unknown>;
      if (nestedErr.message) {
        return String(nestedErr.message);
      }
    }
  }
  // Check if it's a table not found error
  const errorStr = String(error);
  if (errorStr.includes('NOT_FOUND') || errorStr.includes('Could not find table')) {
    return 'Table "Company Strategies" not found. Please create it in Airtable.';
  }
  return 'Unknown error - check server logs';
}

/**
 * Update an existing strategy
 */
export async function updateStrategy(request: UpdateStrategyRequest): Promise<CompanyStrategy> {
  const { strategyId, updates } = request;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields: Record<string, unknown> = {
      updatedAt: now,
    };

    // Handle each field update
    if (updates.title !== undefined) fields.title = updates.title;
    if (updates.summary !== undefined) fields.summary = updates.summary;
    if (updates.status !== undefined) fields.status = updates.status;
    if (updates.objectives !== undefined) fields.objectives = JSON.stringify(updates.objectives);
    if (updates.pillars !== undefined) fields.pillars = JSON.stringify(updates.pillars);
    if (updates.startDate !== undefined) fields.startDate = updates.startDate;
    if (updates.endDate !== undefined) fields.endDate = updates.endDate;
    if (updates.quarterLabel !== undefined) fields.quarterLabel = updates.quarterLabel;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (base(STRATEGY_TABLE) as any).update([
      { id: strategyId, fields },
    ]);
    // Cast Airtable record to expected shape
    const record = results[0] as { id: string; fields: Record<string, unknown> };
    return mapRecordToStrategy(record);
  } catch (error) {
    console.error('[updateStrategy] Error:', error);
    throw new Error(`Failed to update strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Finalize a strategy (marks it as ready for execution)
 */
export async function finalizeStrategy(request: FinalizeStrategyRequest): Promise<CompanyStrategy> {
  const { strategyId } = request;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    const record = await base(STRATEGY_TABLE).update(strategyId, {
      status: 'finalized',
      finalizedAt: now,
      updatedAt: now,
    });

    return mapRecordToStrategy(record);
  } catch (error) {
    console.error('[finalizeStrategy] Error:', error);
    throw new Error(`Failed to finalize strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Archive a strategy
 */
export async function archiveStrategy(strategyId: string): Promise<CompanyStrategy> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const record = await base(STRATEGY_TABLE).update(strategyId, {
      status: 'archived',
      updatedAt: now,
    });

    return mapRecordToStrategy(record);
  } catch (error) {
    console.error('[archiveStrategy] Error:', error);
    throw new Error(`Failed to archive strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Pillar Operations
// ============================================================================

/**
 * Add a pillar to a strategy
 */
export async function addPillarToStrategy(
  strategyId: string,
  pillar: Omit<StrategyPillar, 'id'>
): Promise<CompanyStrategy> {
  const strategy = await getStrategyById(strategyId);
  if (!strategy) {
    throw new Error('Strategy not found');
  }

  const newPillar: StrategyPillar = {
    ...pillar,
    id: generateStrategyItemId(),
    order: strategy.pillars.length,
  };

  return updateStrategy({
    strategyId,
    updates: {
      pillars: [...strategy.pillars, newPillar],
    },
  });
}

/**
 * Update a pillar within a strategy
 */
export async function updatePillarInStrategy(
  strategyId: string,
  pillarId: string,
  updates: Partial<Omit<StrategyPillar, 'id'>>
): Promise<CompanyStrategy> {
  const strategy = await getStrategyById(strategyId);
  if (!strategy) {
    throw new Error('Strategy not found');
  }

  const pillars = strategy.pillars.map(p =>
    p.id === pillarId ? { ...p, ...updates } : p
  );

  return updateStrategy({
    strategyId,
    updates: { pillars },
  });
}

/**
 * Remove a pillar from a strategy
 */
export async function removePillarFromStrategy(
  strategyId: string,
  pillarId: string
): Promise<CompanyStrategy> {
  const strategy = await getStrategyById(strategyId);
  if (!strategy) {
    throw new Error('Strategy not found');
  }

  const pillars = strategy.pillars.filter(p => p.id !== pillarId);

  return updateStrategy({
    strategyId,
    updates: { pillars },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Airtable record to CompanyStrategy
 */
function mapRecordToStrategy(record: {
  id: string;
  fields: Record<string, unknown>;
}): CompanyStrategy {
  const fields = record.fields;

  return {
    id: record.id,
    companyId: fields.companyId as string,
    title: (fields.title as string) || 'Untitled Strategy',
    summary: (fields.summary as string) || '',
    objectives: parseJsonArray(fields.objectives),
    pillars: parseJsonPillars(fields.pillars),
    status: (fields.status as CompanyStrategy['status']) || 'draft',
    version: (fields.version as number) || 1,
    startDate: fields.startDate as string | undefined,
    endDate: fields.endDate as string | undefined,
    quarterLabel: fields.quarterLabel as string | undefined,
    createdAt: (fields.createdAt as string) || new Date().toISOString(),
    updatedAt: (fields.updatedAt as string) || new Date().toISOString(),
    createdBy: fields.createdBy as string | undefined,
    finalizedAt: fields.finalizedAt as string | undefined,
    finalizedBy: fields.finalizedBy as string | undefined,
  };
}

/**
 * Parse JSON array from Airtable field
 */
function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Parse JSON pillars from Airtable field
 */
function parseJsonPillars(value: unknown): StrategyPillar[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
