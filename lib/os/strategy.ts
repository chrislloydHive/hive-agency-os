// lib/os/strategy.ts
// Strategy management for MVP Strategy Workspace
//
// Provides CRUD operations for company marketing strategies.

import { getBase } from '@/lib/airtable';
import type {
  CompanyStrategy,
  StrategyPillar,
  StrategyObjective,
  StrategyPlay,
  CreateStrategyRequest,
  UpdateStrategyRequest,
  FinalizeStrategyRequest,
  StrategySummary,
  StrategyListItem,
  StrategyFrame,
  StrategyEngagementType,
  StrategyOrigin,
} from '@/lib/types/strategy';
import {
  createStrategySummary,
  generateStrategyItemId,
  toStrategyListItem,
} from '@/lib/types/strategy';
import { loadContextForStrategy, mapContextToFrame } from '@/lib/os/strategy/contextLoader';
import type { CompanyEngagement } from '@/lib/types/engagement';

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
  const { companyId, title, summary, objectives, pillars, origin, strategyFrame, status } = request;

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

    // Build fields object
    const fields = {
      companyId,
      title: title || 'Untitled Strategy',
      summary: summary || '',
      objectives: JSON.stringify(objectives || []),
      pillars: JSON.stringify(pillarsWithIds),
      status: status || 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
      // Optional fields
      ...(origin && { origin }),
      ...(strategyFrame && { strategyFrame: JSON.stringify(strategyFrame) }),
      ...(origin === 'imported' && { isActive: true }),
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
 *
 * NOTE: strategyFrame updates are MERGED with existing frame values.
 * This ensures partial updates (e.g., { audience: "new value" }) don't
 * overwrite other frame fields. The strategy frame is the canonical
 * storage for user-defined strategy decisions.
 */
export async function updateStrategy(request: UpdateStrategyRequest): Promise<CompanyStrategy> {
  const { strategyId, updates } = request;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Fetch existing strategy to merge strategyFrame
    let existingStrategyFrame: Record<string, unknown> = {};
    if (updates.strategyFrame !== undefined) {
      const existingRecord = await base(STRATEGY_TABLE).find(strategyId);
      const existingFrameJson = existingRecord?.fields?.strategyFrame;
      if (typeof existingFrameJson === 'string') {
        try {
          existingStrategyFrame = JSON.parse(existingFrameJson);
        } catch {
          // Invalid JSON, start fresh
          existingStrategyFrame = {};
        }
      }
    }

    const fields: Record<string, unknown> = {
      updatedAt: now,
    };

    // Handle each field update
    if (updates.title !== undefined) fields.title = updates.title;
    if (updates.summary !== undefined) fields.summary = updates.summary;
    if (updates.status !== undefined) fields.status = updates.status;
    if (updates.objectives !== undefined) fields.objectives = JSON.stringify(updates.objectives);
    if (updates.pillars !== undefined) fields.pillars = JSON.stringify(updates.pillars);
    if (updates.plays !== undefined) fields.plays = JSON.stringify(updates.plays);
    if (updates.startDate !== undefined) fields.startDate = updates.startDate;
    if (updates.endDate !== undefined) fields.endDate = updates.endDate;
    if (updates.quarterLabel !== undefined) fields.quarterLabel = updates.quarterLabel;
    // New V5 fields - strategyFrame is MERGED with existing values
    if (updates.strategyFrame !== undefined) {
      const mergedFrame = { ...existingStrategyFrame, ...updates.strategyFrame };
      fields.strategyFrame = JSON.stringify(mergedFrame);
    }
    if (updates.tradeoffs !== undefined) fields.tradeoffs = JSON.stringify(updates.tradeoffs);
    if (updates.lockState !== undefined) fields.lockState = updates.lockState;
    if (updates.lastAiUpdatedAt !== undefined) fields.lastAiUpdatedAt = updates.lastAiUpdatedAt;
    if (updates.lastHumanUpdatedAt !== undefined) fields.lastHumanUpdatedAt = updates.lastHumanUpdatedAt;
    // Goal Statement (V9+) - auto-set goalStatementUpdatedAt when goalStatement changes
    if (updates.goalStatement !== undefined) {
      fields.goalStatement = updates.goalStatement;
      fields.goalStatementUpdatedAt = now;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (base(STRATEGY_TABLE) as any).update([
      { id: strategyId, fields },
    ]);
    // Cast Airtable record to expected shape
    const record = results[0] as { id: string; fields: Record<string, unknown> };
    return mapRecordToStrategy(record);
  } catch (error) {
    console.error('[updateStrategy] Error:', error);
    const errorMessage = extractAirtableError(error);
    throw new Error(`Failed to update strategy: ${errorMessage}`);
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
    throw new Error(`Failed to finalize strategy: ${extractAirtableError(error)}`);
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
    throw new Error(`Failed to archive strategy: ${extractAirtableError(error)}`);
  }
}

// ============================================================================
// Multi-Strategy Operations
// ============================================================================

/**
 * Get strategy list items for multi-strategy selector
 */
export async function getStrategyListItems(companyId: string): Promise<StrategyListItem[]> {
  const strategies = await getStrategiesForCompany(companyId);
  return strategies.map(toStrategyListItem);
}

/**
 * Set a strategy as the active strategy (unsets all others)
 */
export async function setActiveStrategy(
  companyId: string,
  strategyId: string
): Promise<CompanyStrategy> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Get all strategies for this company
    const allStrategies = await getStrategiesForCompany(companyId);

    // Unset isActive on all other strategies
    const updatePromises = allStrategies
      .filter(s => s.id !== strategyId && s.isActive)
      .map(s =>
        base(STRATEGY_TABLE).update(s.id, {
          isActive: false,
          updatedAt: now,
        })
      );

    // Set isActive on the target strategy
    updatePromises.push(
      base(STRATEGY_TABLE).update(strategyId, {
        isActive: true,
        updatedAt: now,
      })
    );

    await Promise.all(updatePromises);

    // Return the newly active strategy
    const activeStrategy = await getStrategyById(strategyId);
    if (!activeStrategy) {
      throw new Error('Strategy not found after setting active');
    }

    return activeStrategy;
  } catch (error) {
    console.error('[setActiveStrategy] Error:', error);
    throw new Error(`Failed to set active strategy: ${extractAirtableError(error)}`);
  }
}

/**
 * Duplicate a strategy (for creating variations or new versions)
 */
export async function duplicateStrategy(
  strategyId: string,
  options?: {
    title?: string;
    setAsActive?: boolean;
  }
): Promise<CompanyStrategy> {
  try {
    const source = await getStrategyById(strategyId);
    if (!source) {
      throw new Error('Source strategy not found');
    }

    const base = getBase();
    const now = new Date().toISOString();

    // Generate new IDs for pillars
    const newPillars: StrategyPillar[] = source.pillars.map((p, index) => ({
      ...p,
      id: generateStrategyItemId(),
      order: index,
    }));

    // Generate new IDs for plays
    const newPlays: StrategyPlay[] = (source.plays || []).map(p => ({
      ...p,
      id: generateStrategyItemId(),
    }));

    const fields = {
      companyId: source.companyId,
      title: options?.title || `${source.title} (Copy)`,
      summary: source.summary,
      description: `Duplicated from "${source.title}"`,
      // Goal Statement (V9+) - copy from source
      goalStatement: source.goalStatement || undefined,
      goalStatementUpdatedAt: source.goalStatementUpdatedAt || undefined,
      objectives: JSON.stringify(source.objectives),
      pillars: JSON.stringify(newPillars),
      plays: JSON.stringify(newPlays),
      strategyFrame: source.strategyFrame ? JSON.stringify(source.strategyFrame) : undefined,
      tradeoffs: source.tradeoffs ? JSON.stringify(source.tradeoffs) : undefined,
      status: 'draft',
      isActive: options?.setAsActive ?? false,
      duplicatedFromId: strategyId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Remove undefined fields
    const cleanFields = Object.fromEntries(
      Object.entries(fields).filter(([_, v]) => v !== undefined)
    );

    const record = await base(STRATEGY_TABLE).create(cleanFields);
    const newStrategy = mapRecordToStrategy(record);

    // If setting as active, unset all others
    if (options?.setAsActive) {
      await setActiveStrategy(source.companyId, newStrategy.id);
    }

    return newStrategy;
  } catch (error) {
    console.error('[duplicateStrategy] Error:', error);
    throw new Error(`Failed to duplicate strategy: ${extractAirtableError(error)}`);
  }
}

/**
 * Create a new blank strategy for a company
 */
export async function createNewStrategy(
  companyId: string,
  options?: {
    title?: string;
    setAsActive?: boolean;
  }
): Promise<CompanyStrategy> {
  const strategy = await createDraftStrategy({
    companyId,
    title: options?.title || 'New Strategy',
    summary: '',
    objectives: [],
    pillars: [],
  });

  if (options?.setAsActive) {
    return setActiveStrategy(companyId, strategy.id);
  }

  return strategy;
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
    // Origin tracking (V10+)
    origin: (fields.origin as CompanyStrategy['origin']) || undefined,
    // Engagement scoping (V8+)
    engagementType: (fields.engagementType as CompanyStrategy['engagementType']) || undefined,
    engagementId: fields.engagementId as string | undefined,
    projectType: fields.projectType as string | undefined,
    projectName: fields.projectName as string | undefined,
    title: (fields.title as string) || 'Untitled Strategy',
    summary: (fields.summary as string) || '',
    // Goal Statement (V9+)
    goalStatement: fields.goalStatement as string | undefined,
    goalStatementUpdatedAt: fields.goalStatementUpdatedAt as string | undefined,
    objectives: parseJsonObjectives(fields.objectives),
    pillars: parseJsonPillars(fields.pillars),
    plays: parseJsonPlays(fields.plays),
    status: (fields.status as CompanyStrategy['status']) || 'draft',
    version: (fields.version as number) || 1,
    // Multi-Strategy fields
    isActive: (fields.isActive as boolean) ?? false,
    description: fields.description as string | undefined,
    duplicatedFromId: fields.duplicatedFromId as string | undefined,
    // Timeline
    startDate: fields.startDate as string | undefined,
    endDate: fields.endDate as string | undefined,
    quarterLabel: fields.quarterLabel as string | undefined,
    // V5 fields
    strategyFrame: parseJsonObject(fields.strategyFrame),
    tradeoffs: parseJsonObject(fields.tradeoffs),
    lockState: (fields.lockState as CompanyStrategy['lockState']) || undefined,
    lastAiUpdatedAt: fields.lastAiUpdatedAt as string | undefined,
    lastHumanUpdatedAt: fields.lastHumanUpdatedAt as string | undefined,
    createdAt: (fields.createdAt as string) || new Date().toISOString(),
    updatedAt: (fields.updatedAt as string) || new Date().toISOString(),
    createdBy: fields.createdBy as string | undefined,
    finalizedAt: fields.finalizedAt as string | undefined,
    finalizedBy: fields.finalizedBy as string | undefined,
  };
}

/**
 * Parse JSON object from Airtable field
 */
function parseJsonObject<T>(value: unknown): T | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
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

/**
 * Parse JSON objectives from Airtable field
 * Supports both legacy string[] and new StrategyObjective[] formats
 */
function parseJsonObjectives(value: unknown): string[] | StrategyObjective[] {
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
 * Parse JSON plays from Airtable field
 */
function parseJsonPlays(value: unknown): StrategyPlay[] {
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

// ============================================================================
// Project Strategy Operations
// ============================================================================

/**
 * Create a ProjectStrategy from an approved engagement
 *
 * This is called when context is approved for a project engagement.
 * It creates a project-scoped strategy with:
 * - engagementType: 'project'
 * - engagementId linking to the source engagement
 * - strategyFrame populated from approved context
 * - isActive: true (becomes the active strategy)
 */
export async function createProjectStrategy(
  engagement: CompanyEngagement
): Promise<CompanyStrategy> {
  const { companyId, id: engagementId, projectType, projectName } = engagement;

  console.log('[createProjectStrategy] Creating for engagement:', {
    engagementId,
    companyId,
    projectType,
    projectName,
  });

  // Load context and map to strategy frame using canonical mapper
  const contextResult = await loadContextForStrategy(companyId);
  const { frame: strategyFrame, report } = mapContextToFrame(
    contextResult.context,
    companyId
  );

  console.log('[createProjectStrategy] Extracted frame from context:', {
    hasAudience: !!strategyFrame.audience,
    hasValueProp: !!strategyFrame.valueProp,
    hasPositioning: !!strategyFrame.positioning,
    hasOffering: !!strategyFrame.offering,
    missingFields: report.missingFields,
  });

  // Build title based on project type
  const projectLabel = projectName ||
    (projectType ? `${projectType.charAt(0).toUpperCase() + projectType.slice(1).replace('_', ' ')} Project` : 'Project');
  const title = `${projectLabel} Strategy`;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields = {
      companyId,
      engagementType: 'project' as StrategyEngagementType,
      engagementId,
      projectType: projectType || undefined,
      projectName: projectName || undefined,
      title,
      summary: `Project strategy for ${projectLabel}`,
      objectives: JSON.stringify([]),
      pillars: JSON.stringify([]),
      plays: JSON.stringify([]),
      strategyFrame: JSON.stringify(strategyFrame),
      status: 'draft',
      isActive: true, // Set as active immediately
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Remove undefined fields
    const cleanFields = Object.fromEntries(
      Object.entries(fields).filter(([_, v]) => v !== undefined)
    );

    console.log('[createProjectStrategy] Creating with fields:', Object.keys(cleanFields));
    const record = await base(STRATEGY_TABLE).create(cleanFields);
    const newStrategy = mapRecordToStrategy(record);

    // Unset isActive on other strategies for this company
    const allStrategies = await getStrategiesForCompany(companyId);
    const updatePromises = allStrategies
      .filter(s => s.id !== newStrategy.id && s.isActive)
      .map(s =>
        base(STRATEGY_TABLE).update(s.id, {
          isActive: false,
          updatedAt: now,
        })
      );
    await Promise.all(updatePromises);

    console.log('[createProjectStrategy] Created strategy:', {
      strategyId: newStrategy.id,
      title: newStrategy.title,
      engagementType: newStrategy.engagementType,
    });

    return newStrategy;
  } catch (error) {
    console.error('[createProjectStrategy] Error:', error);
    const errorMessage = extractAirtableError(error);
    throw new Error(`Failed to create project strategy: ${errorMessage}`);
  }
}

/**
 * Get strategy for an engagement (by engagementId)
 */
export async function getStrategyByEngagementId(
  engagementId: string
): Promise<CompanyStrategy | null> {
  try {
    const base = getBase();
    const records = await base(STRATEGY_TABLE)
      .select({
        filterByFormula: `{engagementId} = '${engagementId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapRecordToStrategy(records[0]);
  } catch (error) {
    console.error('[getStrategyByEngagementId] Error:', error);
    return null;
  }
}
