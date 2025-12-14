// lib/contextMap/nodeGrouping.ts
// Group context nodes by domain and zone
//
// CANONICALIZATION: All node lists are filtered through isCanonicalNode()
// to exclude removed fields and deprecated domains before rendering.

import type { HydratedContextNode, HydratedContextMap } from '@/lib/contextGraph/nodes';
import type { MapFilters, ZoneId } from '@/components/context-map/types';
import { DOMAIN_TO_ZONE, ALL_ZONES, getZoneForField } from '@/components/context-map/constants';
import {
  isCanonicalNode,
  filterCanonicalNodes,
  logFilterSummary,
} from '@/lib/contextGraph/canonicalFilter';

// Re-export canonical filter for backward compatibility
export { isCanonicalNode, filterCanonicalNodes };

// ============================================================================
// Node Grouping
// ============================================================================

/**
 * Group nodes by zone ID
 * CANONICALIZATION: Filters out removed fields and deprecated domains
 * Uses field-level zone mapping first (FIELD_TO_ZONE), then falls back to domain-level
 */
export function groupNodesByZone(
  nodes: HydratedContextNode[]
): Map<ZoneId, HydratedContextNode[]> {
  const grouped = new Map<ZoneId, HydratedContextNode[]>();

  // Initialize with empty arrays for all zones
  for (const zone of ALL_ZONES) {
    grouped.set(zone.id, []);
  }

  for (const node of nodes) {
    // CANONICALIZATION: Skip removed fields and deprecated domains
    if (!isCanonicalNode(node)) continue;

    // Use field-level mapping (checks FIELD_TO_ZONE first, then DOMAIN_TO_ZONE)
    const zoneId = getZoneForField(node.key);
    const zoneNodes = grouped.get(zoneId) || [];
    zoneNodes.push(node);
    grouped.set(zoneId, zoneNodes);
  }

  return grouped;
}

/**
 * Group nodes by domain (category)
 * CANONICALIZATION: Filters out removed fields and deprecated domains
 */
export function groupNodesByDomain(
  nodes: HydratedContextNode[]
): Map<string, HydratedContextNode[]> {
  const grouped = new Map<string, HydratedContextNode[]>();

  for (const node of nodes) {
    // CANONICALIZATION: Skip removed fields and deprecated domains
    if (!isCanonicalNode(node)) continue;

    const domain = node.category;
    const domainNodes = grouped.get(domain) || [];
    domainNodes.push(node);
    grouped.set(domain, domainNodes);
  }

  return grouped;
}

// ============================================================================
// Filtering
// ============================================================================

/**
 * Apply filters to a list of nodes
 * IMPORTANT: Canonical filtering is applied FIRST to exclude removed fields
 */
export function filterNodes(
  nodes: HydratedContextNode[],
  filters: MapFilters
): HydratedContextNode[] {
  return nodes.filter((node) => {
    // CANONICALIZATION: Skip removed fields and deprecated domains first
    if (!isCanonicalNode(node)) return false;

    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'confirmed' && node.status !== 'confirmed') return false;
      if (filters.status === 'proposed' && node.status !== 'proposed') return false;
    }

    // Source filter
    if (filters.sources.length > 0) {
      if (!filters.sources.includes(node.source as any)) return false;
    }

    // Confidence filter
    if (node.confidence < filters.minConfidence) return false;

    return true;
  });
}

/**
 * Search nodes by label or value
 */
export function searchNodes(
  nodes: HydratedContextNode[],
  query: string
): HydratedContextNode[] {
  if (!query.trim()) return nodes;

  const lowerQuery = query.toLowerCase();

  return nodes.filter((node) => {
    // Search in key/label
    if (node.key.toLowerCase().includes(lowerQuery)) return true;

    // Search in value
    if (node.value !== null && node.value !== undefined) {
      const valueStr = typeof node.value === 'string'
        ? node.value
        : JSON.stringify(node.value);
      if (valueStr.toLowerCase().includes(lowerQuery)) return true;
    }

    // Search in category
    if (node.category.toLowerCase().includes(lowerQuery)) return true;

    return false;
  });
}

// ============================================================================
// Sorting
// ============================================================================

export type SortField = 'label' | 'value' | 'status' | 'source' | 'confidence' | 'lastUpdated' | 'zone';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

/**
 * Sort nodes by a field
 */
export function sortNodes(
  nodes: HydratedContextNode[],
  sortConfig: SortConfig
): HydratedContextNode[] {
  const { field, direction } = sortConfig;
  const sorted = [...nodes].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'label':
        comparison = a.key.localeCompare(b.key);
        break;
      case 'value':
        const aVal = a.value?.toString() || '';
        const bVal = b.value?.toString() || '';
        comparison = aVal.localeCompare(bVal);
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      case 'source':
        comparison = a.source.localeCompare(b.source);
        break;
      case 'confidence':
        comparison = a.confidence - b.confidence;
        break;
      case 'lastUpdated':
        comparison = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
        break;
      case 'zone':
        const aZone = getZoneForField(a.key);
        const bZone = getZoneForField(b.key);
        comparison = aZone.localeCompare(bZone);
        break;
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Low confidence threshold for visual hierarchy sorting
 */
const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Sort nodes by visual hierarchy priority
 * Order: Confirmed (recent first) -> Proposed high conf -> Proposed low conf
 * This ensures the most important/reliable nodes appear first within each zone.
 */
export function sortNodesByVisualPriority(
  nodes: HydratedContextNode[]
): HydratedContextNode[] {
  return [...nodes].sort((a, b) => {
    // Priority 1: Confirmed vs Proposed
    const aConfirmed = a.status === 'confirmed';
    const bConfirmed = b.status === 'confirmed';

    if (aConfirmed && !bConfirmed) return -1;
    if (!aConfirmed && bConfirmed) return 1;

    // Priority 2: Within confirmed, sort by recency (newest first)
    if (aConfirmed && bConfirmed) {
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    }

    // Priority 3: Within proposed, high confidence before low confidence
    const aHighConf = a.confidence >= LOW_CONFIDENCE_THRESHOLD;
    const bHighConf = b.confidence >= LOW_CONFIDENCE_THRESHOLD;

    if (aHighConf && !bHighConf) return -1;
    if (!aHighConf && bHighConf) return 1;

    // Priority 4: Same confidence tier, sort by actual confidence (highest first)
    return b.confidence - a.confidence;
  });
}

// ============================================================================
// Statistics
// ============================================================================

export interface NodeStatistics {
  total: number;
  confirmed: number;
  proposed: number;
  bySource: Record<string, number>;
  byZone: Record<string, number>;
  avgConfidence: number;
  emptyFields: number;
}

/**
 * Calculate statistics for a set of nodes
 * CANONICALIZATION: Only counts canonical nodes
 */
export function calculateStatistics(nodes: HydratedContextNode[]): NodeStatistics {
  // Filter to canonical nodes only
  const canonicalNodes = nodes.filter(isCanonicalNode);

  const stats: NodeStatistics = {
    total: canonicalNodes.length,
    confirmed: 0,
    proposed: 0,
    bySource: {},
    byZone: {},
    avgConfidence: 0,
    emptyFields: 0,
  };

  let totalConfidence = 0;

  for (const node of canonicalNodes) {
    // Status
    if (node.status === 'confirmed') stats.confirmed++;
    else stats.proposed++;

    // Source
    stats.bySource[node.source] = (stats.bySource[node.source] || 0) + 1;

    // Zone - use field-level mapping
    const zoneId = getZoneForField(node.key);
    stats.byZone[zoneId] = (stats.byZone[zoneId] || 0) + 1;

    // Confidence
    totalConfidence += node.confidence;

    // Empty
    if (node.value === null || node.value === undefined) {
      stats.emptyFields++;
    }
  }

  stats.avgConfidence = canonicalNodes.length > 0 ? totalConfidence / canonicalNodes.length : 0;

  return stats;
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Convert HydratedContextMap to array of nodes
 */
export function mapToArray(nodeMap: HydratedContextMap): HydratedContextNode[] {
  return Array.from(nodeMap.values());
}

/**
 * Get nodes with pending proposals
 */
export function getNodesWithProposals(nodes: HydratedContextNode[]): HydratedContextNode[] {
  return nodes.filter((node) => node.pendingProposal !== undefined);
}

/**
 * Get nodes that need attention (proposed status or low confidence)
 */
export function getNodesNeedingAttention(
  nodes: HydratedContextNode[],
  confidenceThreshold: number = 0.7
): HydratedContextNode[] {
  return nodes.filter((node) => {
    if (node.status === 'proposed') return true;
    if (node.confidence < confidenceThreshold) return true;
    if (node.pendingProposal) return true;
    return false;
  });
}
