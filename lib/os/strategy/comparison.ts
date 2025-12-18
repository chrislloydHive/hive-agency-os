// lib/os/strategy/comparison.ts
// Strategy Comparison Storage and Operations
//
// Provides CRUD operations for strategy comparison artifacts.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  StrategyComparison,
  ComparisonBasedOnHashes,
  ComparisonSourcesUsed,
  ObjectiveCoverageItem,
  DecisionMatrixRow,
  StrategyProsCons,
  StrategyTradeoffs,
  RiskItem,
  KPIImpactPrediction,
  ComparisonRecommendation,
} from '@/lib/types/strategyComparison';
import type { ConfidenceLevel } from '@/lib/types/strategy';

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get comparison by ID
 */
export async function getComparisonById(comparisonId: string): Promise<StrategyComparison | null> {
  try {
    const base = getBase();
    const record = await base(AIRTABLE_TABLES.STRATEGY_COMPARISONS).find(comparisonId);
    return mapRecordToComparison(record);
  } catch (error) {
    console.error('[getComparisonById] Error:', error);
    return null;
  }
}

/**
 * Get comparisons for a company
 */
export async function getComparisonsForCompany(companyId: string): Promise<StrategyComparison[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.STRATEGY_COMPARISONS)
      .select({
        filterByFormula: `{CompanyId} = '${companyId}'`,
        sort: [{ field: 'CreatedAt', direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToComparison);
  } catch (error) {
    console.error('[getComparisonsForCompany] Error:', error);
    return [];
  }
}

/**
 * Find an existing comparison for the given strategy IDs
 * Returns null if no match found
 */
export async function findComparisonByStrategyIds(
  companyId: string,
  strategyIds: string[]
): Promise<StrategyComparison | null> {
  try {
    const base = getBase();

    // Sort IDs for consistent matching
    const sortedIds = [...strategyIds].sort();
    const idsJson = JSON.stringify(sortedIds);

    const records = await base(AIRTABLE_TABLES.STRATEGY_COMPARISONS)
      .select({
        filterByFormula: `AND({CompanyId} = '${companyId}', {Status} != 'archived')`,
        sort: [{ field: 'CreatedAt', direction: 'desc' }],
      })
      .all();

    // Find comparison with matching strategy IDs
    for (const record of records) {
      const comparison = mapRecordToComparison(record);
      const comparisonSortedIds = [...comparison.strategyIds].sort();
      if (JSON.stringify(comparisonSortedIds) === idsJson) {
        return comparison;
      }
    }

    return null;
  } catch (error) {
    console.error('[findComparisonByStrategyIds] Error:', error);
    return null;
  }
}

/**
 * Check if a comparison is stale based on hashes
 */
export function isComparisonStale(
  comparison: StrategyComparison,
  currentHashes: ComparisonBasedOnHashes
): { isStale: boolean; reason: string | null } {
  // Check context hash
  if (comparison.basedOnHashes.contextHash !== currentHashes.contextHash) {
    return { isStale: true, reason: 'Context has been updated since this comparison was generated' };
  }

  // Check objectives hash
  if (comparison.basedOnHashes.objectivesHash !== currentHashes.objectivesHash) {
    return { isStale: true, reason: 'Objectives have changed since this comparison was generated' };
  }

  // Check strategy hashes
  for (const strategyId of comparison.strategyIds) {
    const oldHash = comparison.basedOnHashes.strategyHashes[strategyId];
    const newHash = currentHashes.strategyHashes[strategyId];
    if (oldHash !== newHash) {
      return {
        isStale: true,
        reason: `Strategy "${comparison.strategyTitles[strategyId] || strategyId}" has been modified`
      };
    }
  }

  return { isStale: false, reason: null };
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Create a new comparison (as draft)
 */
export async function createComparison(
  data: Omit<StrategyComparison, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<StrategyComparison> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields = {
      CompanyId: data.companyId,
      StrategyIds: JSON.stringify(data.strategyIds),
      StrategyTitles: JSON.stringify(data.strategyTitles),
      ObjectiveCoverage: JSON.stringify(data.objectiveCoverage),
      DecisionMatrix: JSON.stringify(data.decisionMatrix),
      ProsCons: JSON.stringify(data.prosCons),
      Tradeoffs: JSON.stringify(data.tradeoffs),
      Risks: JSON.stringify(data.risks),
      KPIImpacts: data.kpiImpacts ? JSON.stringify(data.kpiImpacts) : undefined,
      Recommendation: JSON.stringify(data.recommendation),
      BasedOnHashes: JSON.stringify(data.basedOnHashes),
      SourcesUsed: JSON.stringify(data.sourcesUsed),
      GeneratedByAI: data.generatedByAI,
      AIModel: data.aiModel,
      Confidence: data.confidence,
      Status: 'draft' as const,
      CreatedAt: now,
      UpdatedAt: now,
    };

    // Remove undefined fields
    const cleanFields = Object.fromEntries(
      Object.entries(fields).filter(([_, v]) => v !== undefined)
    );

    const record = await base(AIRTABLE_TABLES.STRATEGY_COMPARISONS).create(cleanFields);
    return mapRecordToComparison(record);
  } catch (error) {
    console.error('[createComparison] Error:', error);
    throw new Error(`Failed to create comparison: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update an existing comparison
 */
export async function updateComparison(
  comparisonId: string,
  updates: Partial<Omit<StrategyComparison, 'id' | 'companyId' | 'createdAt'>>
): Promise<StrategyComparison> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const fields: Record<string, unknown> = {
      UpdatedAt: now,
    };

    if (updates.strategyIds !== undefined) fields.StrategyIds = JSON.stringify(updates.strategyIds);
    if (updates.strategyTitles !== undefined) fields.StrategyTitles = JSON.stringify(updates.strategyTitles);
    if (updates.objectiveCoverage !== undefined) fields.ObjectiveCoverage = JSON.stringify(updates.objectiveCoverage);
    if (updates.decisionMatrix !== undefined) fields.DecisionMatrix = JSON.stringify(updates.decisionMatrix);
    if (updates.prosCons !== undefined) fields.ProsCons = JSON.stringify(updates.prosCons);
    if (updates.tradeoffs !== undefined) fields.Tradeoffs = JSON.stringify(updates.tradeoffs);
    if (updates.risks !== undefined) fields.Risks = JSON.stringify(updates.risks);
    if (updates.kpiImpacts !== undefined) fields.KPIImpacts = JSON.stringify(updates.kpiImpacts);
    if (updates.recommendation !== undefined) fields.Recommendation = JSON.stringify(updates.recommendation);
    if (updates.basedOnHashes !== undefined) fields.BasedOnHashes = JSON.stringify(updates.basedOnHashes);
    if (updates.sourcesUsed !== undefined) fields.SourcesUsed = JSON.stringify(updates.sourcesUsed);
    if (updates.status !== undefined) fields.Status = updates.status;
    if (updates.confidence !== undefined) fields.Confidence = updates.confidence;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (base(AIRTABLE_TABLES.STRATEGY_COMPARISONS) as any).update([
      { id: comparisonId, fields },
    ]);
    // Cast Airtable record to expected shape
    const record = results[0] as { id: string; fields: Record<string, unknown> };
    return mapRecordToComparison(record);
  } catch (error) {
    console.error('[updateComparison] Error:', error);
    throw new Error(`Failed to update comparison: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Apply a draft comparison (mark as canonical)
 */
export async function applyComparison(comparisonId: string): Promise<StrategyComparison> {
  return updateComparison(comparisonId, { status: 'applied' });
}

/**
 * Archive a comparison
 */
export async function archiveComparison(comparisonId: string): Promise<StrategyComparison> {
  return updateComparison(comparisonId, { status: 'archived' });
}

/**
 * Delete a comparison
 */
export async function deleteComparison(comparisonId: string): Promise<void> {
  try {
    const base = getBase();
    await base(AIRTABLE_TABLES.STRATEGY_COMPARISONS).destroy(comparisonId);
  } catch (error) {
    console.error('[deleteComparison] Error:', error);
    throw new Error(`Failed to delete comparison: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Airtable record to StrategyComparison
 */
function mapRecordToComparison(record: {
  id: string;
  fields: Record<string, unknown>;
}): StrategyComparison {
  const fields = record.fields;

  return {
    id: record.id,
    companyId: fields.CompanyId as string,
    strategyIds: parseJsonArray(fields.StrategyIds) as string[],
    strategyTitles: parseJsonObject<Record<string, string>>(fields.StrategyTitles) || {},
    objectiveCoverage: parseJsonArray(fields.ObjectiveCoverage) as ObjectiveCoverageItem[],
    decisionMatrix: parseJsonArray(fields.DecisionMatrix) as DecisionMatrixRow[],
    prosCons: parseJsonObject<Record<string, StrategyProsCons>>(fields.ProsCons) || {},
    tradeoffs: parseJsonObject<Record<string, StrategyTradeoffs>>(fields.Tradeoffs) || {},
    risks: parseJsonObject<Record<string, RiskItem[]>>(fields.Risks) || {},
    kpiImpacts: parseJsonObject<Record<string, KPIImpactPrediction[]>>(fields.KPIImpacts),
    recommendation: parseJsonObject<ComparisonRecommendation>(fields.Recommendation) || {
      recommendedStrategyId: '',
      rationale: [],
      ifThenNotes: [],
      caveats: [],
      alternativeFor: {},
    },
    basedOnHashes: parseJsonObject<ComparisonBasedOnHashes>(fields.BasedOnHashes) || {
      contextHash: '',
      objectivesHash: '',
      strategyHashes: {},
    },
    sourcesUsed: parseJsonObject<ComparisonSourcesUsed>(fields.SourcesUsed) || {
      contextFields: [],
      objectiveIds: [],
      strategyFields: [],
    },
    createdAt: (fields.CreatedAt as string) || new Date().toISOString(),
    updatedAt: (fields.UpdatedAt as string) || new Date().toISOString(),
    generatedByAI: (fields.GeneratedByAI as boolean) ?? true,
    aiModel: fields.AIModel as string | undefined,
    confidence: (fields.Confidence as ConfidenceLevel) || 'medium',
    status: (fields.Status as StrategyComparison['status']) || 'draft',
  };
}

/**
 * Parse JSON array from Airtable field
 */
function parseJsonArray(value: unknown): unknown[] {
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
