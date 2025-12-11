// lib/os/context/graphModel.ts
// Canonical Context Graph Model
//
// This file provides the unified model for the Company Context Graph
// that integrates with:
// - Graph visualization (ContextGraphV3Panel, ContextNodeGraph)
// - Integrity engine (freshness, conflicts, provenance)
// - Brain Context page (list and graph views)
// - QBR Data Confidence Score
// - Insights Engine (context health patterns)
//
// The model supports:
// - Nodes grouped by category (identity, audience, brand, etc.)
// - Edge relationships between dependent fields
// - Provenance tracking with confidence scores
// - Freshness decay and staleness detection
// - Human override (lock) support

import type { DomainName } from '@/lib/contextGraph/companyContextGraph';
import type { ContextSource, FreshnessStatus } from './types';

// ============================================================================
// Node Categories (maps to domains)
// ============================================================================

/**
 * Context node categories for graph visualization
 * Maps directly to DomainName from companyContextGraph
 */
export type ContextNodeCategory =
  | 'identity'      // Core business info (name, industry, size, etc.)
  | 'audience'      // ICP, segments, demographics
  | 'offer'         // Products, services, pricing
  | 'brand'         // Voice, tone, values, positioning
  | 'content'       // Content strategy, topics, keywords
  | 'ops'           // Business operations, hours, locations
  | 'demand'        // Marketing, lead gen, sales pipeline
  | 'channel'       // Marketing channels, social profiles
  | 'competitive'   // Competitors, market positioning
  | 'other';        // Uncategorized fields

/**
 * Map domain names to category colors for visualization
 */
export const CATEGORY_COLORS: Record<ContextNodeCategory, string> = {
  identity: '#60a5fa',    // blue-400
  audience: '#34d399',    // emerald-400
  offer: '#a78bfa',       // violet-400
  brand: '#f472b6',       // pink-400
  content: '#fbbf24',     // amber-400
  ops: '#94a3b8',         // slate-400
  demand: '#fb923c',      // orange-400
  channel: '#22d3ee',     // cyan-400
  competitive: '#f87171', // red-400
  other: '#6b7280',       // gray-500
};

/**
 * Category display labels
 */
export const CATEGORY_LABELS: Record<ContextNodeCategory, string> = {
  identity: 'Identity',
  audience: 'Audience',
  offer: 'Offer',
  brand: 'Brand',
  content: 'Content',
  ops: 'Operations',
  demand: 'Demand',
  channel: 'Channels',
  competitive: 'Competitive',
  other: 'Other',
};

// ============================================================================
// Context Node
// ============================================================================

/**
 * Node status indicating health/state
 */
export type ContextNodeStatus =
  | 'ok'              // Field is healthy, recent, and confident
  | 'conflicted'      // Multiple sources disagree
  | 'low_confidence'  // Confidence below threshold
  | 'stale'           // Freshness has decayed
  | 'missing';        // No value present

/**
 * A single node in the Context Graph
 */
export interface ContextNode {
  /** Unique identifier (same as field path, e.g., "identity.industry") */
  id: string;

  /** Category for grouping in visualization */
  category: ContextNodeCategory;

  /** Dot-path key to the field */
  key: string;

  /** Human-readable label */
  label: string;

  /** Current value (can be any type) */
  value: unknown;

  /** Stringified value for display */
  displayValue: string | null;

  /** Provenance tracking */
  provenance: NodeProvenance;

  /** Confidence score (0-100) */
  confidence: number;

  /** Freshness score (0-100) */
  freshness: number;

  /** Freshness status */
  freshnessStatus: FreshnessStatus;

  /** Current status */
  status: ContextNodeStatus;

  /** Strategic importance weight (1-5, where 5 is critical) */
  importance: number;

  /** Whether this field is locked (won't be auto-updated) */
  locked: boolean;

  /** User ID who locked the field */
  lockedBy?: string;

  /** Reason for lock */
  lockReason?: string;

  /** IDs of connected nodes (edges) */
  neighbors: string[];

  /** Whether value has changed since comparison snapshot */
  hasChanged?: boolean;

  /** Type of change if hasChanged is true */
  changeType?: 'added' | 'removed' | 'updated';
}

/**
 * Provenance information for a node
 */
export interface NodeProvenance {
  /** Primary source of current value */
  source: ContextSource;

  /** When value was set */
  setAt: string;

  /** When value was last verified */
  verifiedAt?: string;

  /** Full provenance history */
  history: ProvenanceEntry[];
}

/**
 * Single entry in provenance history
 */
export interface ProvenanceEntry {
  source: ContextSource;
  confidence: number;
  timestamp: string;
  value?: unknown;
  notes?: string;
}

// ============================================================================
// Context Edge
// ============================================================================

/**
 * Edge relationship types
 */
export type ContextEdgeRelationship =
  | 'dependency'    // Target depends on source (source must be set for target)
  | 'correlation'   // Fields are correlated (changes often accompany each other)
  | 'derived';      // Target is derived/calculated from source

/**
 * An edge connecting two nodes
 */
export interface ContextEdge {
  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Type of relationship */
  relationship: ContextEdgeRelationship;

  /** Relationship strength (0-1) */
  weight: number;
}

// ============================================================================
// Context Graph Snapshot
// ============================================================================

/**
 * Health summary for the entire graph
 */
export interface ContextGraphHealth {
  /** Overall health score (0-100) */
  overallScore: number;

  /** Completeness score (% of fields filled) */
  completenessScore: number;

  /** Freshness score (average freshness) */
  freshnessScore: number;

  /** Consistency score (no conflicts) */
  consistencyScore: number;

  /** Confidence score (average confidence) */
  confidenceScore: number;

  /** Count by status */
  byStatus: Record<ContextNodeStatus, number>;

  /** Count by category */
  byCategory: Record<ContextNodeCategory, number>;

  /** Number of conflicts */
  conflictCount: number;

  /** Number of stale fields */
  staleCount: number;

  /** Number of missing critical fields */
  missingCriticalCount: number;

  /** Number of human overrides/locks */
  humanOverrideCount: number;

  /** When health was calculated */
  calculatedAt: string;
}

/**
 * A complete snapshot of the Context Graph at a point in time
 */
export interface ContextGraphSnapshot {
  /** Company identifier */
  companyId: string;

  /** Snapshot identifier ("live" for current, or snapshot ID like "2025-Q4") */
  snapshotId: string;

  /** When this snapshot was created */
  createdAt: string;

  /** Version number (for tracking) */
  version: string;

  /** All nodes in the graph */
  nodes: ContextNode[];

  /** All edges connecting nodes */
  edges: ContextEdge[];

  /** Health summary */
  health: ContextGraphHealth;

  /** Optional: Snapshot being compared against */
  comparedToSnapshotId?: string;

  /** Optional: Number of nodes that changed since comparison */
  changedNodesCount?: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request parameters for fetching Context Graph
 */
export interface ContextGraphRequest {
  companyId: string;
  snapshotId?: string;           // "live" or specific snapshot ID
  compareToSnapshotId?: string;  // Optional snapshot to compare against
  includeEdges?: boolean;        // Include dependency edges (default: true)
  categories?: ContextNodeCategory[]; // Filter by categories
}

/**
 * Response from Context Graph API
 */
export interface ContextGraphResponse {
  snapshot: ContextGraphSnapshot;
  availableSnapshots: SnapshotSummary[];
}

/**
 * Summary of available snapshot for selection
 */
export interface SnapshotSummary {
  id: string;
  label: string;
  createdAt: string;
  description?: string;
  nodeCount: number;
  healthScore: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert DomainName to ContextNodeCategory
 */
export function domainToCategory(domain: DomainName): ContextNodeCategory {
  // Direct mapping - domains and categories are aligned
  const validCategories: ContextNodeCategory[] = [
    'identity', 'audience', 'offer', 'brand', 'content',
    'ops', 'demand', 'channel', 'competitive',
  ];

  if (validCategories.includes(domain as ContextNodeCategory)) {
    return domain as ContextNodeCategory;
  }

  return 'other';
}

/**
 * Compute node status from freshness and confidence
 */
export function computeNodeStatus(
  hasValue: boolean,
  freshness: number,
  confidence: number,
  hasConflict: boolean
): ContextNodeStatus {
  if (!hasValue) return 'missing';
  if (hasConflict) return 'conflicted';
  if (freshness < 30) return 'stale';
  if (confidence < 60) return 'low_confidence';
  return 'ok';
}

/**
 * Calculate health score from nodes
 */
export function calculateGraphHealth(nodes: ContextNode[]): ContextGraphHealth {
  if (nodes.length === 0) {
    return {
      overallScore: 0,
      completenessScore: 0,
      freshnessScore: 0,
      consistencyScore: 100,
      confidenceScore: 0,
      byStatus: { ok: 0, conflicted: 0, low_confidence: 0, stale: 0, missing: 0 },
      byCategory: {} as Record<ContextNodeCategory, number>,
      conflictCount: 0,
      staleCount: 0,
      missingCriticalCount: 0,
      humanOverrideCount: 0,
      calculatedAt: new Date().toISOString(),
    };
  }

  // Count by status
  const byStatus: Record<ContextNodeStatus, number> = {
    ok: 0,
    conflicted: 0,
    low_confidence: 0,
    stale: 0,
    missing: 0,
  };

  // Count by category
  const byCategory: Record<ContextNodeCategory, number> = {
    identity: 0,
    audience: 0,
    offer: 0,
    brand: 0,
    content: 0,
    ops: 0,
    demand: 0,
    channel: 0,
    competitive: 0,
    other: 0,
  };

  let totalFreshness = 0;
  let totalConfidence = 0;
  let humanOverrideCount = 0;
  let conflictCount = 0;
  let staleCount = 0;
  let missingCriticalCount = 0;

  for (const node of nodes) {
    byStatus[node.status]++;
    byCategory[node.category]++;
    totalFreshness += node.freshness;
    totalConfidence += node.confidence;

    if (node.locked) humanOverrideCount++;
    if (node.status === 'conflicted') conflictCount++;
    if (node.status === 'stale') staleCount++;
    if (node.status === 'missing' && node.importance >= 4) missingCriticalCount++;
  }

  const totalNodes = nodes.length;
  const nodesWithValue = totalNodes - byStatus.missing;

  // Calculate component scores
  const completenessScore = Math.round((nodesWithValue / totalNodes) * 100);
  const freshnessScore = totalNodes > 0 ? Math.round(totalFreshness / totalNodes) : 0;
  const consistencyScore = conflictCount === 0 ? 100 : Math.max(0, 100 - (conflictCount * 20));
  const confidenceScore = nodesWithValue > 0 ? Math.round(totalConfidence / nodesWithValue) : 0;

  // Overall score: weighted average
  // Weights: completeness 30%, freshness 25%, consistency 25%, confidence 20%
  const overallScore = Math.round(
    completenessScore * 0.30 +
    freshnessScore * 0.25 +
    consistencyScore * 0.25 +
    confidenceScore * 0.20
  );

  return {
    overallScore,
    completenessScore,
    freshnessScore,
    consistencyScore,
    confidenceScore,
    byStatus,
    byCategory,
    conflictCount,
    staleCount,
    missingCriticalCount,
    humanOverrideCount,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Filter nodes by categories
 */
export function filterNodesByCategories(
  nodes: ContextNode[],
  categories: ContextNodeCategory[]
): ContextNode[] {
  if (categories.length === 0) return nodes;
  return nodes.filter(n => categories.includes(n.category));
}

/**
 * Group nodes by category for visualization
 */
export function groupNodesByCategory(
  nodes: ContextNode[]
): Map<ContextNodeCategory, ContextNode[]> {
  const groups = new Map<ContextNodeCategory, ContextNode[]>();

  for (const category of Object.keys(CATEGORY_LABELS) as ContextNodeCategory[]) {
    groups.set(category, []);
  }

  for (const node of nodes) {
    const categoryNodes = groups.get(node.category);
    if (categoryNodes) {
      categoryNodes.push(node);
    }
  }

  return groups;
}

/**
 * Get nodes that need attention (stale, conflicted, low confidence)
 */
export function getNodesNeedingAttention(nodes: ContextNode[]): ContextNode[] {
  return nodes.filter(n =>
    n.status === 'stale' ||
    n.status === 'conflicted' ||
    n.status === 'low_confidence' ||
    (n.status === 'missing' && n.importance >= 4)
  );
}

/**
 * Get quick wins (missing nodes that are easy to fill)
 */
export function getQuickWinNodes(nodes: ContextNode[]): ContextNode[] {
  return nodes.filter(n =>
    n.status === 'missing' &&
    n.importance <= 3
  );
}
