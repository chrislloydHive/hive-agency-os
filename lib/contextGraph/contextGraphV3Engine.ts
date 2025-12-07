// lib/contextGraph/contextGraphV3Engine.ts
// Context Graph v3 Engine
//
// Builds structured, strategic snapshots of the Context Graph with:
// - Importance-weighted nodes
// - Status detection (conflicts, staleness, confidence)
// - Delta tracking between snapshots
// - Dependency mapping

import type { CompanyContextGraph, DomainName } from './companyContextGraph';
import { DOMAIN_NAMES } from './companyContextGraph';
import type { ProvenanceTag, ContextSource } from './types';
import { calculateFreshness } from './freshness';
import { loadContextGraph } from './storage';
import { getVersionById, listVersionSummaries } from './history';
import { CONTEXT_FIELDS, type ContextFieldDef } from './schema';
import {
  mapFieldKeyToImportance,
  deriveEdgesFromDependencies,
} from './contextGraphV3Mapping';
import type {
  ContextGraphV3Snapshot,
  ContextGraphNode,
  ContextGraphEdge,
  ContextNodeStatus,
  ContextChangeType,
  ContextHealthSummary,
} from './contextGraphV3Types';

// ============================================================================
// Field Extraction
// ============================================================================

interface ExtractedField {
  key: string;
  label: string;
  domain: DomainName;
  value: unknown;
  hasValue: boolean;
  provenance: ProvenanceTag[];
  confidence: number;
  freshness: number;
  isHumanOverride: boolean;
  conflicted: boolean;
}

/**
 * Check if an object is a WithMeta wrapper
 */
function isWithMetaNode(node: unknown): node is { value: unknown; provenance: ProvenanceTag[] } {
  return (
    node !== null &&
    typeof node === 'object' &&
    'value' in node &&
    'provenance' in node
  );
}

/**
 * Get the field definition from schema registry
 */
function getFieldDef(path: string): ContextFieldDef | undefined {
  return CONTEXT_FIELDS.find(f => f.path === path);
}

/**
 * Convert path to human-readable label
 */
function pathToLabel(path: string): string {
  const fieldDef = getFieldDef(path);
  if (fieldDef?.label) return fieldDef.label;

  const parts = path.split('.');
  const last = parts[parts.length - 1];
  return last
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Check if provenance includes human sources
 */
function hasHumanSource(provenance: ProvenanceTag[]): boolean {
  return provenance.some(p => p.source === 'manual' || p.source === 'user');
}

/**
 * Calculate highest confidence from provenance
 */
function getHighestConfidence(provenance: ProvenanceTag[]): number {
  if (!provenance || provenance.length === 0) return 0;
  return Math.max(...provenance.map(p => p.confidence ?? 0)) * 100;
}

/**
 * Calculate freshness score from provenance
 */
function getFreshnessScore(provenance: ProvenanceTag[]): number {
  if (!provenance || provenance.length === 0) return 0;
  try {
    const freshness = calculateFreshness(provenance[0]);
    return Math.round(freshness.score * 100);
  } catch {
    return 50;
  }
}

/**
 * Check if field has conflicting values
 */
function hasConflict(provenance: ProvenanceTag[]): boolean {
  // Multiple high-confidence sources could indicate potential conflict
  const highConfidenceSources = provenance.filter(p => p.confidence >= 0.7);
  return highConfidenceSources.length > 1;
}

/**
 * Extract all fields from a domain
 */
function extractFieldsFromDomain(
  domainData: unknown,
  domain: DomainName,
  pathPrefix: string
): ExtractedField[] {
  const fields: ExtractedField[] = [];

  function walk(obj: unknown, pathParts: string[]) {
    if (isWithMetaNode(obj)) {
      const path = pathParts.join('.');
      const hasValue = obj.value !== null &&
        obj.value !== undefined &&
        !(Array.isArray(obj.value) && obj.value.length === 0);

      fields.push({
        key: path,
        label: pathToLabel(path),
        domain,
        value: obj.value,
        hasValue,
        provenance: obj.provenance || [],
        confidence: getHighestConfidence(obj.provenance),
        freshness: getFreshnessScore(obj.provenance),
        isHumanOverride: hasHumanSource(obj.provenance),
        conflicted: hasConflict(obj.provenance),
      });
      return;
    }

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
        walk(value, [...pathParts, key]);
      });
    }
  }

  walk(domainData, [pathPrefix]);
  return fields;
}

/**
 * Extract all fields from a context graph
 */
function extractAllFields(graph: CompanyContextGraph): ExtractedField[] {
  const allFields: ExtractedField[] = [];

  for (const domain of DOMAIN_NAMES) {
    const domainData = graph[domain];
    if (domainData) {
      const fields = extractFieldsFromDomain(domainData, domain, domain);
      allFields.push(...fields);
    }
  }

  return allFields;
}

// ============================================================================
// Node Status Computation
// ============================================================================

/**
 * Compute the status for a field
 */
function computeNodeStatus(field: ExtractedField): ContextNodeStatus {
  if (!field.hasValue) return 'missing';
  if (field.conflicted) return 'conflicted';
  if (field.freshness < 30) return 'stale';
  if (field.confidence < 60) return 'low_confidence';
  return 'ok';
}

/**
 * Stringify a value for display
 */
function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================================================
// Snapshot Comparison
// ============================================================================

interface ComparisonResult {
  hasChanged: boolean;
  changeType?: ContextChangeType;
}

/**
 * Compare a field between current and previous snapshot
 */
function compareField(
  currentField: ExtractedField | undefined,
  previousField: ExtractedField | undefined
): ComparisonResult {
  if (!previousField && currentField?.hasValue) {
    return { hasChanged: true, changeType: 'added' };
  }

  if (previousField?.hasValue && !currentField?.hasValue) {
    return { hasChanged: true, changeType: 'removed' };
  }

  if (previousField && currentField) {
    const prevValue = stringifyValue(previousField.value);
    const currValue = stringifyValue(currentField.value);

    if (prevValue !== currValue) {
      return { hasChanged: true, changeType: 'updated' };
    }
  }

  return { hasChanged: false };
}

// ============================================================================
// Main Engine Function
// ============================================================================

export interface BuildContextGraphSnapshotArgs {
  companyId: string;
  snapshotId?: string;           // "live" or specific snapshot ID
  compareToSnapshotId?: string;  // Optional snapshot to compare against
}

/**
 * Build a Context Graph v3 snapshot
 *
 * This is the main engine function that:
 * 1. Loads the context graph (live or from snapshot)
 * 2. Optionally loads a comparison snapshot
 * 3. Extracts all fields with provenance
 * 4. Computes status, importance, and deltas
 * 5. Derives dependency edges
 * 6. Returns a complete v3 snapshot
 */
export async function buildContextGraphV3Snapshot(
  args: BuildContextGraphSnapshotArgs
): Promise<ContextGraphV3Snapshot> {
  const { companyId, snapshotId = 'live', compareToSnapshotId } = args;

  // 1. Load the target graph
  let graph: CompanyContextGraph | null = null;

  if (snapshotId === 'live') {
    graph = await loadContextGraph(companyId);
  } else {
    // Load from version history
    const version = await getVersionById(snapshotId);
    if (version) {
      graph = version.graph;
    }
  }

  if (!graph) {
    // Return empty snapshot
    return {
      companyId,
      snapshotId,
      createdAt: new Date().toISOString(),
      nodes: [],
      edges: [],
      summary: {
        totalNodes: 0,
        byStatus: { ok: 0, conflicted: 0, low_confidence: 0, stale: 0, missing: 0 },
        byDomain: {},
        changedNodes: 0,
        humanOverrides: 0,
        averageConfidence: 0,
        averageFreshness: 0,
      },
    };
  }

  // 2. Extract all fields from current graph
  const currentFields = extractAllFields(graph);
  const currentByKey = new Map(currentFields.map(f => [f.key, f]));

  // 3. Optionally load comparison snapshot
  let compareFields: ExtractedField[] = [];
  if (compareToSnapshotId) {
    let compareGraph: CompanyContextGraph | null = null;

    if (compareToSnapshotId === 'live') {
      compareGraph = await loadContextGraph(companyId);
    } else {
      const version = await getVersionById(compareToSnapshotId);
      if (version) {
        compareGraph = version.graph;
      }
    }

    if (compareGraph) {
      compareFields = extractAllFields(compareGraph);
    }
  }
  const compareByKey = new Map(compareFields.map(f => [f.key, f]));

  // 4. Build nodes
  const nodes: ContextGraphNode[] = [];
  const nodeIds = new Set<string>();

  for (const field of currentFields) {
    // Skip fields with no value and no comparison
    if (!field.hasValue && !compareByKey.has(field.key)) continue;

    const importance = mapFieldKeyToImportance(field.key);
    const status = computeNodeStatus(field);

    // Compare with previous snapshot
    const comparison = compareToSnapshotId
      ? compareField(field, compareByKey.get(field.key))
      : { hasChanged: false };

    const node: ContextGraphNode = {
      id: field.key,
      key: field.key,
      label: field.label,
      domain: field.domain,
      importance,
      status,
      confidence: Math.round(field.confidence),
      freshness: Math.round(field.freshness),
      isHumanOverride: field.isHumanOverride,
      hasChangedSinceSnapshot: comparison.hasChanged,
      changeType: comparison.changeType,
      neighbors: [], // Will be filled from edges
      value: stringifyValue(field.value),
      provenance: {
        sources: field.provenance.slice(0, 5).map(p => ({
          source: p.source,
          confidence: p.confidence,
          timestamp: p.updatedAt || (p as any).timestamp || new Date().toISOString(),
          notes: p.notes,
        })),
      },
    };

    nodes.push(node);
    nodeIds.add(field.key);
  }

  // 5. Derive edges from dependency mapping
  const edges = deriveEdgesFromDependencies(nodeIds);

  // 6. Link neighbors from edges
  const neighborsMap: Record<string, string[]> = {};
  for (const edge of edges) {
    if (!neighborsMap[edge.source]) neighborsMap[edge.source] = [];
    if (!neighborsMap[edge.target]) neighborsMap[edge.target] = [];
    neighborsMap[edge.source].push(edge.target);
    neighborsMap[edge.target].push(edge.source);
  }

  const nodesWithNeighbors = nodes.map(n => ({
    ...n,
    neighbors: neighborsMap[n.id] ?? [],
  }));

  // 7. Compute summary statistics
  const byStatus: Record<ContextNodeStatus, number> = {
    ok: 0,
    conflicted: 0,
    low_confidence: 0,
    stale: 0,
    missing: 0,
  };

  const byDomain: Record<string, number> = {};
  let changedNodes = 0;
  let humanOverrides = 0;
  let totalConfidence = 0;
  let totalFreshness = 0;

  for (const node of nodesWithNeighbors) {
    byStatus[node.status]++;
    byDomain[node.domain] = (byDomain[node.domain] || 0) + 1;
    if (node.hasChangedSinceSnapshot) changedNodes++;
    if (node.isHumanOverride) humanOverrides++;
    totalConfidence += node.confidence;
    totalFreshness += node.freshness;
  }

  const totalNodes = nodesWithNeighbors.length;

  return {
    companyId,
    snapshotId,
    createdAt: new Date().toISOString(),
    nodes: nodesWithNeighbors,
    edges,
    summary: {
      totalNodes,
      byStatus,
      byDomain,
      changedNodes,
      humanOverrides,
      averageConfidence: totalNodes > 0 ? Math.round(totalConfidence / totalNodes) : 0,
      averageFreshness: totalNodes > 0 ? Math.round(totalFreshness / totalNodes) : 0,
    },
  };
}

// ============================================================================
// Health Summary
// ============================================================================

/**
 * Summarize context health from a v3 snapshot
 *
 * This is used by:
 * - QBR Data Confidence Score
 * - Strategic Map "Context Health" header
 * - Insights "Context Issues" panel
 */
export function summarizeContextHealth(
  snapshot: ContextGraphV3Snapshot
): ContextHealthSummary {
  const { nodes, summary } = snapshot;

  // Calculate health score (weighted by importance)
  let weightedOk = 0;
  let totalWeight = 0;

  for (const node of nodes) {
    const weight = node.importance;
    totalWeight += weight;

    if (node.status === 'ok') {
      weightedOk += weight;
    } else if (node.status === 'low_confidence') {
      weightedOk += weight * 0.6; // Partial credit
    } else if (node.status === 'stale') {
      weightedOk += weight * 0.4; // Less credit
    }
    // conflicted and missing get 0 credit
  }

  const healthScore = totalWeight > 0
    ? Math.round((weightedOk / totalWeight) * 100)
    : 0;

  return {
    total: summary.totalNodes,
    ok: summary.byStatus.ok,
    conflicted: summary.byStatus.conflicted,
    stale: summary.byStatus.stale,
    lowConfidence: summary.byStatus.low_confidence,
    missing: summary.byStatus.missing,
    humanOverrides: summary.humanOverrides,
    healthScore,
  };
}

// ============================================================================
// Snapshot List Helper
// ============================================================================

export interface SnapshotListItem {
  id: string;
  label: string;
  createdAt: string;
  description?: string;
}

/**
 * List available snapshots for a company
 */
export async function listAvailableSnapshots(
  companyId: string
): Promise<SnapshotListItem[]> {
  const snapshots: SnapshotListItem[] = [
    { id: 'live', label: 'Current (Live)', createdAt: new Date().toISOString() },
  ];

  try {
    const versions = await listVersionSummaries(companyId, 20);

    for (const version of versions) {
      snapshots.push({
        id: version.versionId,
        label: version.description || `Snapshot ${version.versionAt.slice(0, 10)}`,
        createdAt: version.versionAt,
        description: version.description,
      });
    }
  } catch (error) {
    console.warn('[ContextGraphV3] Could not load version history:', error);
  }

  return snapshots;
}
