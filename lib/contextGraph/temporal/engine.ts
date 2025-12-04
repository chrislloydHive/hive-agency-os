// lib/contextGraph/temporal/engine.ts
// Temporal storage engine for Context Graph
//
// Phase 4: Time-series storage and querying per field

import { randomUUID } from 'crypto';
import type { DomainName, CompanyContextGraph } from '../companyContextGraph';
import type { ContextSource } from '../types';
import type {
  FieldHistoryEntry,
  FieldHistory,
  FieldHistoryStats,
  ChangeVelocity,
  StalenessTrend,
  DomainHistorySummary,
  HistoryQueryOptions,
  HistoryQueryResult,
} from './types';
import { DEFAULT_VALIDITY_DAYS } from '../types';

// ============================================================================
// In-Memory Storage (can be replaced with Airtable/Postgres for persistence)
// ============================================================================

/** Field history entries by companyId */
const historyStore = new Map<string, FieldHistoryEntry[]>();

// ============================================================================
// History Recording
// ============================================================================

/**
 * Record a field value change in the temporal store
 */
export async function recordFieldChange(
  companyId: string,
  path: string,
  domain: DomainName,
  newValue: unknown,
  previousValue: unknown,
  options: {
    updatedBy: 'human' | 'ai' | 'system';
    sourceTool?: ContextSource;
    sourceRunId?: string;
    confidence?: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<FieldHistoryEntry> {
  const entry: FieldHistoryEntry = {
    id: `hist_${randomUUID()}`,
    companyId,
    path,
    domain,
    value: newValue,
    previousValue,
    updatedBy: options.updatedBy,
    sourceTool: options.sourceTool,
    sourceRunId: options.sourceRunId,
    confidence: options.confidence,
    timestamp: new Date().toISOString(),
    reason: options.reason,
    metadata: options.metadata,
  };

  // Store in memory (replace with DB call)
  if (!historyStore.has(companyId)) {
    historyStore.set(companyId, []);
  }
  historyStore.get(companyId)!.push(entry);

  // Keep only last 1000 entries per company in memory
  const entries = historyStore.get(companyId)!;
  if (entries.length > 1000) {
    historyStore.set(companyId, entries.slice(-1000));
  }

  return entry;
}

// ============================================================================
// History Querying
// ============================================================================

/**
 * Get history for a specific field
 */
export async function getFieldHistory(
  companyId: string,
  path: string,
  options?: { limit?: number; startDate?: string; endDate?: string }
): Promise<FieldHistory> {
  const allEntries = historyStore.get(companyId) || [];
  let entries = allEntries.filter(e => e.path === path);

  // Apply date filters
  if (options?.startDate) {
    entries = entries.filter(e => e.timestamp >= options.startDate!);
  }
  if (options?.endDate) {
    entries = entries.filter(e => e.timestamp <= options.endDate!);
  }

  // Sort by timestamp desc
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Apply limit
  if (options?.limit) {
    entries = entries.slice(0, options.limit);
  }

  const domain = entries[0]?.domain || path.split('.')[0] as DomainName;
  const currentValue = entries[0]?.value || null;

  return {
    path,
    domain,
    currentValue,
    entries,
    stats: calculateFieldStats(entries),
  };
}

/**
 * Get history for an entire domain
 */
export async function getDomainHistory(
  companyId: string,
  domain: DomainName,
  options?: { limit?: number; startDate?: string; endDate?: string }
): Promise<DomainHistorySummary> {
  const allEntries = historyStore.get(companyId) || [];
  let entries = allEntries.filter(e => e.domain === domain);

  // Apply date filters
  if (options?.startDate) {
    entries = entries.filter(e => e.timestamp >= options.startDate!);
  }
  if (options?.endDate) {
    entries = entries.filter(e => e.timestamp <= options.endDate!);
  }

  // Sort by timestamp desc
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Get unique fields
  const fieldPaths = new Set(entries.map(e => e.path));

  // Calculate changes per field
  const fieldChangeCounts = new Map<string, number>();
  const fieldLastUpdates = new Map<string, string>();

  for (const entry of entries) {
    fieldChangeCounts.set(entry.path, (fieldChangeCounts.get(entry.path) || 0) + 1);
    if (!fieldLastUpdates.has(entry.path) || entry.timestamp > fieldLastUpdates.get(entry.path)!) {
      fieldLastUpdates.set(entry.path, entry.timestamp);
    }
  }

  // Calculate average field age
  const now = Date.now();
  let totalAgeDays = 0;
  for (const lastUpdate of fieldLastUpdates.values()) {
    totalAgeDays += (now - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24);
  }
  const averageFieldAge = fieldLastUpdates.size > 0 ? totalAgeDays / fieldLastUpdates.size : 0;

  // Get most volatile fields
  const volatileFields = Array.from(fieldChangeCounts.entries())
    .map(([path, count]) => ({ path, changesPerMonth: count })) // Simplified
    .sort((a, b) => b.changesPerMonth - a.changesPerMonth)
    .slice(0, 5);

  // Get stalest fields
  const stalestFields = Array.from(fieldLastUpdates.entries())
    .map(([path, lastUpdate]) => ({
      path,
      daysSinceUpdate: Math.floor((now - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
    .slice(0, 5);

  return {
    domain,
    totalFields: fieldPaths.size,
    fieldsWithHistory: fieldPaths.size,
    totalChanges: entries.length,
    recentChanges: entries.slice(0, options?.limit || 10),
    mostVolatileFields: volatileFields,
    stalestFields,
    lastUpdateAt: entries[0]?.timestamp || null,
    averageFieldAge: Math.round(averageFieldAge),
  };
}

/**
 * Query history with flexible options
 */
export async function queryHistory(options: HistoryQueryOptions): Promise<HistoryQueryResult> {
  const allEntries = historyStore.get(options.companyId) || [];
  let entries = [...allEntries];

  // Apply filters
  if (options.path) {
    entries = entries.filter(e => e.path === options.path);
  }
  if (options.domain) {
    entries = entries.filter(e => e.domain === options.domain);
  }
  if (options.startDate) {
    entries = entries.filter(e => e.timestamp >= options.startDate!);
  }
  if (options.endDate) {
    entries = entries.filter(e => e.timestamp <= options.endDate!);
  }
  if (options.updatedBy) {
    entries = entries.filter(e => e.updatedBy === options.updatedBy);
  }
  if (options.sourceTool) {
    entries = entries.filter(e => e.sourceTool === options.sourceTool);
  }

  // Sort
  if (options.orderBy === 'timestamp_asc') {
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  } else {
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  const total = entries.length;

  // Apply pagination
  if (options.offset) {
    entries = entries.slice(options.offset);
  }
  if (options.limit) {
    entries = entries.slice(0, options.limit);
  }

  return {
    entries,
    total,
    hasMore: (options.offset || 0) + entries.length < total,
    query: options,
  };
}

// ============================================================================
// Velocity & Trends
// ============================================================================

/**
 * Get change velocity for a field
 */
export async function getChangeVelocity(
  companyId: string,
  path: string
): Promise<ChangeVelocity> {
  const history = await getFieldHistory(companyId, path);
  const entries = history.entries;
  const domain = history.domain;

  if (entries.length === 0) {
    return {
      path,
      domain,
      changesPerMonth: 0,
      lastChangeDays: Infinity,
      trend: 'stable',
      recentChanges: [],
    };
  }

  const now = Date.now();
  const lastChange = new Date(entries[0].timestamp).getTime();
  const lastChangeDays = Math.floor((now - lastChange) / (1000 * 60 * 60 * 24));

  // Calculate changes per month over the last 90 days
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
  const recentEntries = entries.filter(e => new Date(e.timestamp).getTime() > ninetyDaysAgo);
  const changesPerMonth = recentEntries.length * (30 / 90);

  // Determine trend
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

  const last30Days = entries.filter(e => new Date(e.timestamp).getTime() > thirtyDaysAgo).length;
  const prev30Days = entries.filter(e => {
    const time = new Date(e.timestamp).getTime();
    return time > sixtyDaysAgo && time <= thirtyDaysAgo;
  }).length;

  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (last30Days > prev30Days * 1.5) trend = 'increasing';
  else if (last30Days < prev30Days * 0.5) trend = 'decreasing';

  return {
    path,
    domain,
    changesPerMonth: Math.round(changesPerMonth * 10) / 10,
    lastChangeDays,
    trend,
    recentChanges: entries.slice(0, 10).map(e => ({
      timestamp: e.timestamp,
      type: 'value_change' as const,
    })),
  };
}

/**
 * Get staleness trend for a field
 */
export async function getStalenessTrend(
  companyId: string,
  path: string,
  sourceTool?: ContextSource
): Promise<StalenessTrend> {
  const history = await getFieldHistory(companyId, path);
  const domain = history.domain;

  const now = Date.now();
  const lastEntry = history.entries[0];
  const lastUpdateTime = lastEntry ? new Date(lastEntry.timestamp).getTime() : 0;
  const daysSinceLastUpdate = lastEntry
    ? Math.floor((now - lastUpdateTime) / (1000 * 60 * 60 * 24))
    : Infinity;

  // Get expected refresh days from source
  const source = sourceTool || lastEntry?.sourceTool || 'manual';
  const expectedRefreshDays = DEFAULT_VALIDITY_DAYS[source] || 90;

  const stalenessRatio = daysSinceLastUpdate / expectedRefreshDays;

  let trend: 'fresh' | 'aging' | 'stale' | 'expired';
  if (stalenessRatio < 0.5) trend = 'fresh';
  else if (stalenessRatio < 0.8) trend = 'aging';
  else if (stalenessRatio < 1.0) trend = 'stale';
  else trend = 'expired';

  // Predict when field will become stale
  const daysUntilStale = Math.max(0, expectedRefreshDays - daysSinceLastUpdate);
  const predictedStaleDate = daysUntilStale > 0
    ? new Date(now + daysUntilStale * 24 * 60 * 60 * 1000).toISOString()
    : null;

  return {
    path,
    domain,
    daysSinceLastUpdate,
    expectedRefreshDays,
    stalenessRatio: Math.round(stalenessRatio * 100) / 100,
    trend,
    predictedStaleDate,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateFieldStats(entries: FieldHistoryEntry[]): FieldHistoryStats {
  if (entries.length === 0) {
    return {
      totalChanges: 0,
      firstChangeAt: null,
      lastChangeAt: null,
      averageChangeIntervalDays: null,
      changesBySource: {},
      changesByUpdater: { human: 0, ai: 0, system: 0 },
      volatility: 'stable',
    };
  }

  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const firstChangeAt = sorted[0].timestamp;
  const lastChangeAt = sorted[sorted.length - 1].timestamp;

  // Calculate average change interval
  let totalIntervalMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].timestamp).getTime();
    const curr = new Date(sorted[i].timestamp).getTime();
    totalIntervalMs += curr - prev;
  }
  const averageChangeIntervalDays = sorted.length > 1
    ? Math.round((totalIntervalMs / (sorted.length - 1)) / (1000 * 60 * 60 * 24))
    : null;

  // Count by source
  const changesBySource: Record<string, number> = {};
  for (const entry of entries) {
    const source = entry.sourceTool || 'unknown';
    changesBySource[source] = (changesBySource[source] || 0) + 1;
  }

  // Count by updater
  const changesByUpdater = { human: 0, ai: 0, system: 0 };
  for (const entry of entries) {
    changesByUpdater[entry.updatedBy]++;
  }

  // Determine volatility
  let volatility: 'stable' | 'moderate' | 'volatile' = 'stable';
  if (averageChangeIntervalDays !== null) {
    if (averageChangeIntervalDays < 7) volatility = 'volatile';
    else if (averageChangeIntervalDays < 30) volatility = 'moderate';
  }

  return {
    totalChanges: entries.length,
    firstChangeAt,
    lastChangeAt,
    averageChangeIntervalDays,
    changesBySource,
    changesByUpdater,
    volatility,
  };
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Record multiple field changes at once (for batch updates)
 */
export async function recordBatchChanges(
  companyId: string,
  changes: Array<{
    path: string;
    domain: DomainName;
    newValue: unknown;
    previousValue: unknown;
  }>,
  options: {
    updatedBy: 'human' | 'ai' | 'system';
    sourceTool?: ContextSource;
    sourceRunId?: string;
    reason?: string;
  }
): Promise<FieldHistoryEntry[]> {
  const entries: FieldHistoryEntry[] = [];

  for (const change of changes) {
    const entry = await recordFieldChange(
      companyId,
      change.path,
      change.domain,
      change.newValue,
      change.previousValue,
      options
    );
    entries.push(entry);
  }

  return entries;
}

/**
 * Get summary of all changes for a company in a time period
 */
export async function getCompanyChangeSummary(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<{
  totalChanges: number;
  changesByDomain: Record<DomainName, number>;
  changesByUpdater: { human: number; ai: number; system: number };
  topChangedFields: Array<{ path: string; count: number }>;
}> {
  const result = await queryHistory({
    companyId,
    startDate,
    endDate,
    limit: 10000,
  });

  const changesByDomain: Record<string, number> = {};
  const changesByUpdater = { human: 0, ai: 0, system: 0 };
  const fieldCounts = new Map<string, number>();

  for (const entry of result.entries) {
    changesByDomain[entry.domain] = (changesByDomain[entry.domain] || 0) + 1;
    changesByUpdater[entry.updatedBy]++;
    fieldCounts.set(entry.path, (fieldCounts.get(entry.path) || 0) + 1);
  }

  const topChangedFields = Array.from(fieldCounts.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalChanges: result.total,
    changesByDomain: changesByDomain as Record<DomainName, number>,
    changesByUpdater,
    topChangedFields,
  };
}
