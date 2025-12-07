// lib/contextGraph/contextGraphV3Types.ts
// Context Graph v3 Type Definitions
//
// Enhanced types for the strategic Context Graph engine that provides:
// - Semantic clustering by domain
// - Importance-weighted nodes
// - Conflict detection and resolution
// - Delta tracking between snapshots
// - Dependency mapping

import type { DomainName } from './companyContextGraph';
import type { ContextSource, ProvenanceTag } from './types';

// ============================================================================
// Node Status & Domain Types
// ============================================================================

/**
 * Node status indicating the health/state of a context field
 */
export type ContextNodeStatus =
  | 'ok'              // Field is healthy, recent, and confident
  | 'conflicted'      // Multiple high-confidence sources disagree
  | 'low_confidence'  // Confidence below threshold
  | 'stale'           // Freshness has decayed significantly
  | 'missing';        // No value present

/**
 * Change type for snapshot comparison
 */
export type ContextChangeType = 'added' | 'removed' | 'updated';

// ============================================================================
// Graph Node Definition
// ============================================================================

/**
 * A node in the Context Graph v3 visualization
 *
 * Represents a single context field with all its metadata for:
 * - Visualization (domain clustering, importance sizing)
 * - Status indication (conflicts, staleness, confidence)
 * - Delta tracking (changes since snapshot)
 * - Dependency mapping (what this field affects/is affected by)
 */
export interface ContextGraphNode {
  /** Unique identifier (same as field path, e.g., "identity.icpDescription") */
  id: string;

  /** Dot-path key to the field */
  key: string;

  /** Human-readable label for display */
  label: string;

  /** Domain this field belongs to (for clustering) */
  domain: DomainName;

  /** Strategic importance weight (1-5, where 5 is critical) */
  importance: number;

  /** Current status of the field */
  status: ContextNodeStatus;

  /** Confidence score (0-100) */
  confidence: number;

  /** Freshness score (0-100) */
  freshness: number;

  /** Whether this field has a human override (manual/user source) */
  isHumanOverride: boolean;

  /** Whether this field has changed since comparison snapshot */
  hasChangedSinceSnapshot: boolean;

  /** Type of change if hasChangedSinceSnapshot is true */
  changeType?: ContextChangeType;

  /** IDs of related/dependent nodes */
  neighbors: string[];

  /** Current value (stringified for display) */
  value?: string | null;

  /** Provenance tracking */
  provenance?: {
    sources: Array<{
      source: ContextSource;
      confidence: number;
      timestamp: string;
      notes?: string;
    }>;
  };
}

// ============================================================================
// Graph Edge Definition
// ============================================================================

/**
 * Edge kind describing the relationship between nodes
 */
export type ContextEdgeKind =
  | 'dependency'   // Target depends on source (source must be set for target to be meaningful)
  | 'correlation'  // Fields are correlated (changes in one often accompany changes in other)
  | 'derived';     // Target is derived/calculated from source

/**
 * An edge in the Context Graph v3 connecting two nodes
 */
export interface ContextGraphEdge {
  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Type of relationship */
  kind: ContextEdgeKind;

  /** Relationship strength (0-1) */
  weight: number;
}

// ============================================================================
// Graph Snapshot Definition
// ============================================================================

/**
 * A complete snapshot of the Context Graph at a point in time
 */
export interface ContextGraphV3Snapshot {
  /** Company identifier */
  companyId: string;

  /** Snapshot identifier ("live" for current, or snapshot ID like "2025-Q3") */
  snapshotId: string;

  /** When this snapshot was created */
  createdAt: string;

  /** All nodes in the graph */
  nodes: ContextGraphNode[];

  /** All edges connecting nodes */
  edges: ContextGraphEdge[];

  /** Summary statistics */
  summary: {
    totalNodes: number;
    byStatus: Record<ContextNodeStatus, number>;
    byDomain: Record<string, number>;
    changedNodes: number;
    humanOverrides: number;
    averageConfidence: number;
    averageFreshness: number;
  };
}

// ============================================================================
// Domain Cluster Layout
// ============================================================================

/**
 * Layout configuration for domain clustering in visualization
 */
export interface DomainClusterConfig {
  /** Center position for this domain cluster */
  center: { x: number; y: number };

  /** Color for nodes in this domain */
  color: string;

  /** Human-readable label */
  label: string;

  /** Angle offset for the cluster (radians) */
  angle: number;
}

/**
 * Domain cluster layout map
 */
export type DomainClusterLayout = Record<DomainName, DomainClusterConfig>;

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request parameters for fetching Context Graph v3
 */
export interface ContextGraphV3Request {
  companyId: string;
  snapshotId?: string;       // "live" or specific snapshot ID
  compareToSnapshotId?: string; // Optional snapshot to compare against
}

/**
 * Health summary for integration with other systems
 */
export interface ContextHealthSummary {
  total: number;
  ok: number;
  conflicted: number;
  stale: number;
  lowConfidence: number;
  missing: number;
  humanOverrides: number;
  healthScore: number;  // 0-100 overall health
}
