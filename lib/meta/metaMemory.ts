// lib/meta/metaMemory.ts
// Phase 6: Emergent Intelligence - Meta Memory System
//
// A global intelligence store that:
// - Remembers what worked across companies
// - Recalls relevant historical context for new tasks
// - Surfaces "last time we tried X, Y happened"
// - Stores learned patterns, anomalies, and insights

import type {
  MetaMemoryEntry,
  MetaMemoryType,
  MetaMemorySource,
  MetaPattern,
  GlobalAnomaly,
  EmergentInsight,
  SchemaEvolutionProposal,
} from './types';

// ============================================================================
// In-Memory Store (would be backed by database in production)
// ============================================================================

const memoryStore: Map<string, MetaMemoryEntry> = new Map();

// ============================================================================
// Types
// ============================================================================

interface MemoryQuery {
  type?: MetaMemoryType;
  vertical?: string;
  companyStage?: string;
  businessModel?: string;
  minConfidence?: number;
  limit?: number;
  status?: MetaMemoryEntry['status'];
}

interface MemoryRecallResult {
  entry: MetaMemoryEntry;
  relevanceScore: number;
  reasoning: string;
}

interface LearningRecord {
  action: string;
  context: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'partial';
  metrics?: Record<string, number>;
  learnings: string[];
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Store a new memory entry
 */
export async function storeMemory(
  entry: Omit<MetaMemoryEntry, 'id' | 'createdAt' | 'lastUsedAt' | 'status'>
): Promise<MetaMemoryEntry> {
  const id = `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const fullEntry: MetaMemoryEntry = {
    ...entry,
    id,
    createdAt: now,
    lastUsedAt: now,
    status: 'active',
  };

  memoryStore.set(id, fullEntry);
  return fullEntry;
}

/**
 * Store a pattern as memory
 */
export async function storePatternMemory(pattern: MetaPattern): Promise<MetaMemoryEntry> {
  return storeMemory({
    type: 'pattern',
    key: `pattern:${pattern.type}:${pattern.vertical}`,
    value: pattern,
    description: pattern.description,
    vertical: pattern.vertical,
    applicableCompanyStages: pattern.applicableCompanyStages,
    applicableBusinessModels: pattern.businessModels,
    source: 'pattern_discovery',
    sourceId: pattern.id,
    confidence: pattern.crossCompanyConfidence,
    validationCount: pattern.validationCount,
    successfulApplications: 0,
  });
}

/**
 * Store an anomaly as memory
 */
export async function storeAnomalyMemory(anomaly: GlobalAnomaly): Promise<MetaMemoryEntry> {
  return storeMemory({
    type: 'anomaly_record',
    key: `anomaly:${anomaly.type}:${anomaly.metric}`,
    value: anomaly,
    description: anomaly.description,
    vertical: anomaly.affectedVerticals[0],
    source: 'anomaly_detection',
    sourceId: anomaly.id,
    confidence: 1 - (anomaly.deviationPercent / 100),
    validationCount: 1,
    successfulApplications: 0,
  });
}

/**
 * Store an insight as memory
 */
export async function storeInsightMemory(insight: EmergentInsight): Promise<MetaMemoryEntry> {
  return storeMemory({
    type: 'strategic_memory',
    key: `insight:${insight.type}`,
    value: insight,
    description: insight.insight,
    vertical: insight.applicableVerticals[0],
    source: 'performance_analysis',
    sourceId: insight.id,
    confidence: insight.confidence,
    validationCount: 1,
    successfulApplications: 0,
  });
}

/**
 * Store a schema proposal as memory
 */
export async function storeSchemaMemory(
  proposal: SchemaEvolutionProposal
): Promise<MetaMemoryEntry> {
  return storeMemory({
    type: 'schema_proposal',
    key: `schema:${proposal.type}:${proposal.domain}.${proposal.fieldName}`,
    value: proposal,
    description: `${proposal.type} proposal for ${proposal.domain}.${proposal.fieldName}`,
    source: 'schema_evolution',
    sourceId: proposal.id,
    confidence: proposal.evidence.reduce((sum, e) => sum + e.confidence, 0) /
      Math.max(proposal.evidence.length, 1),
    validationCount: 0,
    successfulApplications: 0,
  });
}

/**
 * Store a learning from an action
 */
export async function storeLearning(record: LearningRecord): Promise<MetaMemoryEntry> {
  return storeMemory({
    type: 'experiment_learning',
    key: `learning:${record.action}:${Date.now()}`,
    value: record,
    description: `${record.outcome} outcome for "${record.action}": ${record.learnings.join('; ')}`,
    source: 'experiment_analysis',
    confidence: record.outcome === 'success' ? 0.9 : record.outcome === 'partial' ? 0.6 : 0.3,
    validationCount: 1,
    successfulApplications: record.outcome === 'success' ? 1 : 0,
  });
}

/**
 * Store a best practice
 */
export async function storeBestPractice(
  practice: string,
  context: {
    vertical?: string;
    companyStages?: string[];
    businessModels?: string[];
    evidence: string;
  }
): Promise<MetaMemoryEntry> {
  return storeMemory({
    type: 'best_practice',
    key: `practice:${practice.slice(0, 50).replace(/\s+/g, '_')}`,
    value: { practice, context },
    description: practice,
    vertical: context.vertical,
    applicableCompanyStages: context.companyStages,
    applicableBusinessModels: context.businessModels,
    source: 'performance_analysis',
    confidence: 0.8,
    validationCount: 1,
    successfulApplications: 0,
  });
}

/**
 * Recall relevant memories for a context
 */
export async function recallMemories(
  context: {
    vertical?: string;
    companyStage?: string;
    businessModel?: string;
    query?: string;
    taskType?: string;
  },
  options: { limit?: number; minRelevance?: number } = {}
): Promise<MemoryRecallResult[]> {
  const { limit = 10, minRelevance = 0.3 } = options;
  const results: MemoryRecallResult[] = [];

  for (const entry of memoryStore.values()) {
    if (entry.status === 'expired' || entry.status === 'deprecated') {
      continue;
    }

    const relevance = calculateRelevance(entry, context);
    if (relevance >= minRelevance) {
      results.push({
        entry,
        relevanceScore: relevance,
        reasoning: generateRelevanceReasoning(entry, context, relevance),
      });
    }
  }

  // Sort by relevance and limit
  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

/**
 * Query memories by criteria
 */
export async function queryMemories(query: MemoryQuery): Promise<MetaMemoryEntry[]> {
  const results: MetaMemoryEntry[] = [];

  for (const entry of memoryStore.values()) {
    // Apply filters
    if (query.type && entry.type !== query.type) continue;
    if (query.vertical && entry.vertical !== query.vertical) continue;
    if (query.status && entry.status !== query.status) continue;
    if (query.minConfidence && entry.confidence < query.minConfidence) continue;

    if (query.companyStage && entry.applicableCompanyStages) {
      if (!entry.applicableCompanyStages.includes(query.companyStage)) continue;
    }

    if (query.businessModel && entry.applicableBusinessModels) {
      if (!entry.applicableBusinessModels.includes(query.businessModel)) continue;
    }

    results.push(entry);
  }

  // Sort by confidence and limit
  const sorted = results.sort((a, b) => b.confidence - a.confidence);
  return query.limit ? sorted.slice(0, query.limit) : sorted;
}

/**
 * Get a specific memory by ID
 */
export async function getMemory(id: string): Promise<MetaMemoryEntry | null> {
  return memoryStore.get(id) || null;
}

/**
 * Update memory status and usage
 */
export async function recordMemoryUsage(
  id: string,
  outcome: 'success' | 'failure' | 'neutral'
): Promise<MetaMemoryEntry | null> {
  const entry = memoryStore.get(id);
  if (!entry) return null;

  const updated: MetaMemoryEntry = {
    ...entry,
    lastUsedAt: new Date().toISOString(),
    successfulApplications: outcome === 'success'
      ? entry.successfulApplications + 1
      : entry.successfulApplications,
  };

  // Update confidence based on outcome
  if (outcome === 'success') {
    updated.confidence = Math.min(0.99, entry.confidence + 0.02);
  } else if (outcome === 'failure') {
    updated.confidence = Math.max(0.1, entry.confidence - 0.05);
  }

  // Check if should be validated
  if (updated.successfulApplications >= 5 && updated.status === 'active') {
    updated.status = 'validated';
  }

  memoryStore.set(id, updated);
  return updated;
}

/**
 * Validate a memory entry
 */
export async function validateMemory(
  id: string,
  validationResult: { valid: boolean; notes?: string }
): Promise<MetaMemoryEntry | null> {
  const entry = memoryStore.get(id);
  if (!entry) return null;

  const updated: MetaMemoryEntry = {
    ...entry,
    validationCount: entry.validationCount + 1,
    confidence: validationResult.valid
      ? Math.min(0.99, entry.confidence + 0.05)
      : Math.max(0.1, entry.confidence - 0.1),
    status: validationResult.valid ? 'validated' : entry.status,
  };

  memoryStore.set(id, updated);
  return updated;
}

/**
 * Deprecate a memory entry
 */
export async function deprecateMemory(
  id: string,
  reason: string
): Promise<MetaMemoryEntry | null> {
  const entry = memoryStore.get(id);
  if (!entry) return null;

  const updated: MetaMemoryEntry = {
    ...entry,
    status: 'deprecated',
    description: `${entry.description} [DEPRECATED: ${reason}]`,
  };

  memoryStore.set(id, updated);
  return updated;
}

/**
 * Find memories similar to a given context
 */
export async function findSimilarMemories(
  context: string,
  options: { limit?: number; types?: MetaMemoryType[] } = {}
): Promise<MemoryRecallResult[]> {
  const { limit = 5, types } = options;
  const results: MemoryRecallResult[] = [];

  const contextWords = new Set(
    context.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );

  for (const entry of memoryStore.values()) {
    if (entry.status === 'expired' || entry.status === 'deprecated') continue;
    if (types && !types.includes(entry.type)) continue;

    // Calculate text similarity
    const descWords = new Set(
      entry.description.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    const intersection = [...contextWords].filter(w => descWords.has(w)).length;
    const union = new Set([...contextWords, ...descWords]).size;
    const similarity = union > 0 ? intersection / union : 0;

    if (similarity > 0.1) {
      results.push({
        entry,
        relevanceScore: similarity * entry.confidence,
        reasoning: `Matched on: ${[...contextWords].filter(w => descWords.has(w)).join(', ')}`,
      });
    }
  }

  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(): Promise<{
  totalMemories: number;
  byType: Record<MetaMemoryType, number>;
  byStatus: Record<string, number>;
  avgConfidence: number;
  topVerticals: Array<{ vertical: string; count: number }>;
}> {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byVertical: Record<string, number> = {};
  let totalConfidence = 0;

  for (const entry of memoryStore.values()) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    totalConfidence += entry.confidence;

    if (entry.vertical) {
      byVertical[entry.vertical] = (byVertical[entry.vertical] || 0) + 1;
    }
  }

  const topVerticals = Object.entries(byVertical)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([vertical, count]) => ({ vertical, count }));

  return {
    totalMemories: memoryStore.size,
    byType: byType as Record<MetaMemoryType, number>,
    byStatus,
    avgConfidence: memoryStore.size > 0 ? totalConfidence / memoryStore.size : 0,
    topVerticals,
  };
}

/**
 * Clean up expired memories
 */
export async function cleanupMemories(): Promise<{ removed: number; deprecated: number }> {
  let removed = 0;
  let deprecated = 0;
  const now = new Date();

  for (const [id, entry] of memoryStore.entries()) {
    // Check expiration
    if (entry.expiresAt && new Date(entry.expiresAt) < now) {
      memoryStore.delete(id);
      removed++;
      continue;
    }

    // Check for stale memories (not used in 90 days with low confidence)
    const lastUsed = new Date(entry.lastUsedAt);
    const daysSinceUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUse > 90 && entry.confidence < 0.5 && entry.status === 'active') {
      entry.status = 'deprecated';
      deprecated++;
    }
  }

  return { removed, deprecated };
}

/**
 * Export all memories
 */
export async function exportMemories(): Promise<MetaMemoryEntry[]> {
  return [...memoryStore.values()];
}

/**
 * Import memories (for restoration)
 */
export async function importMemories(memories: MetaMemoryEntry[]): Promise<number> {
  let imported = 0;
  for (const memory of memories) {
    if (!memoryStore.has(memory.id)) {
      memoryStore.set(memory.id, memory);
      imported++;
    }
  }
  return imported;
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateRelevance(
  entry: MetaMemoryEntry,
  context: {
    vertical?: string;
    companyStage?: string;
    businessModel?: string;
    query?: string;
    taskType?: string;
  }
): number {
  let score = entry.confidence * 0.3; // Base score from confidence

  // Vertical match
  if (context.vertical && entry.vertical === context.vertical) {
    score += 0.25;
  }

  // Company stage match
  if (context.companyStage && entry.applicableCompanyStages?.includes(context.companyStage)) {
    score += 0.15;
  }

  // Business model match
  if (context.businessModel && entry.applicableBusinessModels?.includes(context.businessModel)) {
    score += 0.15;
  }

  // Query text match
  if (context.query) {
    const queryWords = new Set(context.query.toLowerCase().split(/\s+/));
    const descWords = entry.description.toLowerCase().split(/\s+/);
    const matches = descWords.filter(w => queryWords.has(w)).length;
    score += Math.min(0.15, matches * 0.03);
  }

  // Task type match
  if (context.taskType && entry.key.includes(context.taskType)) {
    score += 0.1;
  }

  // Bonus for validated memories
  if (entry.status === 'validated') {
    score += 0.1;
  }

  // Bonus for successful applications
  if (entry.successfulApplications > 0) {
    score += Math.min(0.1, entry.successfulApplications * 0.02);
  }

  return Math.min(1, score);
}

function generateRelevanceReasoning(
  entry: MetaMemoryEntry,
  context: {
    vertical?: string;
    companyStage?: string;
    businessModel?: string;
    query?: string;
  },
  relevance: number
): string {
  const reasons: string[] = [];

  if (context.vertical && entry.vertical === context.vertical) {
    reasons.push(`Same vertical (${context.vertical})`);
  }

  if (context.companyStage && entry.applicableCompanyStages?.includes(context.companyStage)) {
    reasons.push(`Applicable to ${context.companyStage} stage`);
  }

  if (entry.status === 'validated') {
    reasons.push('Validated pattern');
  }

  if (entry.successfulApplications > 0) {
    reasons.push(`Applied successfully ${entry.successfulApplications} times`);
  }

  if (reasons.length === 0) {
    reasons.push('General relevance based on context');
  }

  return reasons.join('; ');
}

// ============================================================================
// Exports
// ============================================================================

export {
  type MemoryQuery,
  type MemoryRecallResult,
  type LearningRecord,
};
