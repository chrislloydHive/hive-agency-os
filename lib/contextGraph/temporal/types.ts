// lib/contextGraph/temporal/types.ts
// Temporal storage types for Context Graph
//
// Phase 4: Time-series storage per field

import type { DomainName } from '../companyContextGraph';
import type { ContextSource } from '../types';

// ============================================================================
// Field History Types
// ============================================================================

/**
 * A single historical entry for a field value
 */
export interface FieldHistoryEntry {
  id: string;
  companyId: string;
  path: string;
  domain: DomainName;
  value: unknown;
  previousValue: unknown;
  updatedBy: 'human' | 'ai' | 'system';
  sourceTool?: ContextSource;
  sourceRunId?: string;
  confidence?: number;
  timestamp: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Field history with aggregated statistics
 */
export interface FieldHistory {
  path: string;
  domain: DomainName;
  currentValue: unknown;
  entries: FieldHistoryEntry[];
  stats: FieldHistoryStats;
}

/**
 * Statistics about a field's history
 */
export interface FieldHistoryStats {
  totalChanges: number;
  firstChangeAt: string | null;
  lastChangeAt: string | null;
  averageChangeIntervalDays: number | null;
  changesBySource: Record<string, number>;
  changesByUpdater: {
    human: number;
    ai: number;
    system: number;
  };
  volatility: 'stable' | 'moderate' | 'volatile';
}

// ============================================================================
// Velocity & Trend Types
// ============================================================================

/**
 * Change velocity for a field
 */
export interface ChangeVelocity {
  path: string;
  domain: DomainName;
  changesPerMonth: number;
  lastChangeDays: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  recentChanges: Array<{
    timestamp: string;
    type: 'value_change' | 'source_change';
  }>;
}

/**
 * Staleness trend for a field
 */
export interface StalenessTrend {
  path: string;
  domain: DomainName;
  daysSinceLastUpdate: number;
  expectedRefreshDays: number;
  stalenessRatio: number;  // daysSinceUpdate / expectedRefreshDays
  trend: 'fresh' | 'aging' | 'stale' | 'expired';
  predictedStaleDate: string | null;
}

// ============================================================================
// Domain History Types
// ============================================================================

/**
 * History summary for an entire domain
 */
export interface DomainHistorySummary {
  domain: DomainName;
  totalFields: number;
  fieldsWithHistory: number;
  totalChanges: number;
  recentChanges: FieldHistoryEntry[];
  mostVolatileFields: Array<{ path: string; changesPerMonth: number }>;
  stalestFields: Array<{ path: string; daysSinceUpdate: number }>;
  lastUpdateAt: string | null;
  averageFieldAge: number;  // Days since last update
}

// ============================================================================
// Time-Series Query Types
// ============================================================================

/**
 * Query options for field history
 */
export interface HistoryQueryOptions {
  companyId: string;
  path?: string;
  domain?: DomainName;
  startDate?: string;
  endDate?: string;
  updatedBy?: 'human' | 'ai' | 'system';
  sourceTool?: ContextSource;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp_asc' | 'timestamp_desc';
}

/**
 * Paginated history result
 */
export interface HistoryQueryResult {
  entries: FieldHistoryEntry[];
  total: number;
  hasMore: boolean;
  query: HistoryQueryOptions;
}

// ============================================================================
// Strategic Narrative Types
// ============================================================================

/**
 * Time period for narrative generation
 */
export type NarrativePeriod = 'week' | 'month' | 'quarter' | 'year';

/**
 * A strategic narrative about changes over time
 */
export interface StrategicNarrative {
  id: string;
  companyId: string;
  period: NarrativePeriod;
  startDate: string;
  endDate: string;
  generatedAt: string;

  // Narrative content
  summary: string;
  keyChanges: Array<{
    domain: DomainName;
    description: string;
    impact: 'high' | 'medium' | 'low';
    fields: string[];
  }>;

  // Insights
  learnings: string[];
  recommendations: string[];

  // Performance correlation
  performanceImpact?: {
    description: string;
    metrics: Array<{
      name: string;
      before: number;
      after: number;
      change: number;
    }>;
  };

  // Evolution story
  evolutionStory: string;
}

// ============================================================================
// Temporal Snapshot Types
// ============================================================================

/**
 * A snapshot of the entire graph at a point in time
 * (References existing history.ts ContextGraphVersion)
 */
export interface TemporalSnapshot {
  snapshotId: string;
  companyId: string;
  timestamp: string;
  reason: string;
  completenessScore: number;
  domainsChanged: DomainName[];
  fieldsChanged: number;
}

/**
 * Comparison between two temporal snapshots
 */
export interface TemporalComparison {
  fromSnapshot: TemporalSnapshot;
  toSnapshot: TemporalSnapshot;
  daysBetween: number;
  changes: {
    added: Array<{ path: string; value: unknown }>;
    removed: Array<{ path: string; previousValue: unknown }>;
    modified: Array<{ path: string; oldValue: unknown; newValue: unknown }>;
  };
  summary: string;
}
