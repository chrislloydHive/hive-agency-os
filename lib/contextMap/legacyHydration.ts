// lib/contextMap/legacyHydration.ts
// Hydrate HydratedContextNode[] from legacy CompanyContext
//
// This ensures every form field with a value appears as a node in the Context Map.

import type { CompanyContext, Competitor } from '@/lib/types/context';
import type { HydratedContextNode } from '@/lib/contextGraph/nodes';
import type { ContextNodeSource, ContextNodeStatus } from '@/lib/contextGraph/nodes/types';
import { FIELD_REGISTRY, LEGACY_PATH_MAP, logUnmappedCategory, type FieldRegistryEntry } from './fieldRegistry';
import {
  REQUIRED_CONTEXT_KEYS,
  type RequiredContextKey,
  getAllKeysForRequirement,
} from '@/lib/os/context/requiredContextKeys';

// ============================================================================
// Types
// ============================================================================

export interface LegacyHydrationOptions {
  /** Include empty fields (fields with no value) */
  includeEmpty?: boolean;
  /** Override default source for all fields */
  sourceOverride?: ContextNodeSource;
  /** Existing nodes to merge with (for deduplication) */
  existingNodes?: HydratedContextNode[];
}

export interface HydrationResult {
  /** Hydrated nodes from legacy context */
  nodes: HydratedContextNode[];
  /** Fields that had values */
  populatedCount: number;
  /** Fields that were empty */
  emptyCount: number;
  /** Any warnings during hydration */
  warnings: string[];
}

// ============================================================================
// Value Extraction
// ============================================================================

/**
 * Get value from legacy context using dot-notation path
 */
function getValueFromPath(context: CompanyContext, path: string): unknown {
  // Direct property access (most common case)
  return (context as unknown as Record<string, unknown>)[path];
}

/**
 * Check if a value is considered "populated" (has meaningful content)
 */
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

/**
 * Format value for display (handle arrays, competitors, etc.)
 */
function formatValue(value: unknown, valueType?: string): unknown {
  if (value === null || value === undefined) return null;

  if (valueType === 'competitors' && Array.isArray(value)) {
    // Format competitor array for display
    const competitors = value as Competitor[];
    if (competitors.length === 0) return null;
    return `${competitors.length} competitors: ${competitors.slice(0, 3).map(c => c.domain || c.name).join(', ')}${competitors.length > 3 ? '...' : ''}`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value;
  }

  return value;
}

/**
 * Determine node status based on source and value state
 */
function determineStatus(
  entry: FieldRegistryEntry,
  value: unknown,
  isAiGenerated?: boolean
): ContextNodeStatus {
  // If context was AI-generated, most fields are proposed
  if (isAiGenerated) {
    // User-entered fields that look manually set remain confirmed
    if (entry.defaultSource === 'user' && isPopulated(value)) {
      return 'confirmed';
    }
    return 'proposed';
  }

  return entry.defaultStatus;
}

/**
 * Map field source to node source
 */
function mapSource(entry: FieldRegistryEntry, isAiGenerated?: boolean): ContextNodeSource {
  if (isAiGenerated && entry.defaultStatus === 'proposed') {
    return 'ai';
  }
  return entry.defaultSource as ContextNodeSource;
}

// ============================================================================
// Hydration Functions
// ============================================================================

/**
 * Hydrate a single field from legacy context into a node
 */
function hydrateField(
  entry: FieldRegistryEntry,
  context: CompanyContext,
  options: LegacyHydrationOptions
): HydratedContextNode | null {
  const rawValue = getValueFromPath(context, entry.legacyPath);
  const populated = isPopulated(rawValue);

  // Skip empty fields unless includeEmpty is true
  if (!populated && !options.includeEmpty) {
    return null;
  }

  const value = formatValue(rawValue, entry.valueType);
  const status = determineStatus(entry, value, context.isAiGenerated);
  const source = options.sourceOverride || mapSource(entry, context.isAiGenerated);

  // Calculate confidence based on source and status
  let confidence = 0.8; // Default
  if (status === 'confirmed') {
    confidence = 1.0;
  } else if (source === 'ai') {
    confidence = 0.7;
  } else if (!populated) {
    confidence = 0;
  }

  // Map field source to valid provenance source
  const provenanceSource = source === 'ai' ? 'inferred' : source === 'user' ? 'user' : 'manual';

  const node: HydratedContextNode = {
    key: entry.key,
    category: entry.category,
    value: value as any,
    status,
    source,
    confidence,
    lastUpdated: context.updatedAt || new Date().toISOString(),
    provenance: [{
      source: provenanceSource,
      confidence,
      updatedAt: context.updatedAt || new Date().toISOString(),
      notes: context.isAiGenerated ? 'Auto-generated from diagnostics' : undefined,
    }],
  };

  // Add confirmation details if confirmed
  if (status === 'confirmed') {
    node.confirmedBy = 'user';
    node.confirmedAt = context.updatedAt;
  }

  return node;
}

/**
 * Hydrate all fields from legacy context into nodes
 */
export function hydrateLegacyContext(
  context: CompanyContext,
  options: LegacyHydrationOptions = {}
): HydrationResult {
  const { existingNodes = [] } = options;
  const warnings: string[] = [];
  let populatedCount = 0;
  let emptyCount = 0;

  // Build set of existing node keys for deduplication
  const existingKeys = new Set(existingNodes.map(n => n.key));

  // Hydrate each field from registry
  const hydratedNodes: HydratedContextNode[] = [];

  for (const entry of FIELD_REGISTRY) {
    // Skip if node already exists (deduplication)
    if (existingKeys.has(entry.key)) {
      continue;
    }

    const rawValue = getValueFromPath(context, entry.legacyPath);
    const populated = isPopulated(rawValue);

    if (populated) {
      populatedCount++;
    } else {
      emptyCount++;
    }

    const node = hydrateField(entry, context, options);
    if (node) {
      hydratedNodes.push(node);
    }
  }

  // Check for any fields in context that aren't in registry
  const registeredPaths = new Set(FIELD_REGISTRY.map(e => e.legacyPath));
  const contextKeys = Object.keys(context) as (keyof CompanyContext)[];

  for (const key of contextKeys) {
    if (
      !registeredPaths.has(key) &&
      !['id', 'companyId', 'createdAt', 'updatedAt', 'updatedBy', 'isAiGenerated', 'confidenceNotes'].includes(key)
    ) {
      const value = context[key];
      if (isPopulated(value)) {
        warnings.push(`Unregistered field "${key}" has value but no registry entry`);
      }
    }
  }

  return {
    nodes: hydratedNodes,
    populatedCount,
    emptyCount,
    warnings,
  };
}

/**
 * Merge nodes from multiple sources, deduplicating by key
 * Priority: existing nodes > legacy nodes
 */
export function mergeNodes(
  existingNodes: HydratedContextNode[],
  legacyNodes: HydratedContextNode[]
): HydratedContextNode[] {
  const nodeMap = new Map<string, HydratedContextNode>();

  // Add existing nodes first (they take priority)
  for (const node of existingNodes) {
    nodeMap.set(node.key, node);
  }

  // Add legacy nodes only if not already present
  for (const node of legacyNodes) {
    if (!nodeMap.has(node.key)) {
      nodeMap.set(node.key, node);
    }
  }

  return Array.from(nodeMap.values());
}

/**
 * Get count of populated form fields (for verification)
 */
export function countPopulatedFormFields(context: CompanyContext): number {
  let count = 0;

  for (const entry of FIELD_REGISTRY) {
    const value = getValueFromPath(context, entry.legacyPath);
    if (isPopulated(value)) {
      count++;
    }
  }

  return count;
}

/**
 * Verify that all form fields appear in the node list
 */
export function verifyFieldCoverage(
  context: CompanyContext,
  nodes: HydratedContextNode[]
): { covered: string[]; missing: string[]; extra: string[] } {
  const nodeKeys = new Set(nodes.map(n => n.key));
  const covered: string[] = [];
  const missing: string[] = [];

  for (const entry of FIELD_REGISTRY) {
    const value = getValueFromPath(context, entry.legacyPath);
    if (isPopulated(value)) {
      if (nodeKeys.has(entry.key)) {
        covered.push(entry.key);
      } else {
        missing.push(entry.key);
      }
    }
  }

  // Find nodes not in registry
  const registryKeys = new Set(FIELD_REGISTRY.map(e => e.key));
  const extra = nodes
    .filter(n => !registryKeys.has(n.key))
    .map(n => n.key);

  return { covered, missing, extra };
}

// ============================================================================
// Ghost Node Functions
// ============================================================================

/**
 * Create a ghost node for a missing required field
 */
export function createGhostNode(requiredKey: RequiredContextKey): HydratedContextNode {
  return {
    key: requiredKey.key,
    category: requiredKey.domain,
    value: null,
    status: 'missing',
    source: 'system' as ContextNodeSource,
    confidence: 0,
    lastUpdated: new Date().toISOString(),
    provenance: [],
    proposalReason: requiredKey.reason,
    // Extended fields for display
    label: requiredKey.label,
    shortLabel: requiredKey.shortLabel,
    description: requiredKey.description,
    zoneId: requiredKey.zoneId,
    isGhost: true,
    ghostReason: requiredKey.reason,
    requiredFor: requiredKey.requiredFor,
  } as HydratedContextNode & {
    label: string;
    shortLabel?: string;
    description?: string;
    zoneId: string;
    isGhost: boolean;
    ghostReason: string;
    requiredFor: string[];
  };
}

/**
 * Get ghost nodes for all required keys that are missing from the node list
 */
export function getGhostNodesForMissingRequired(
  existingNodes: HydratedContextNode[]
): HydratedContextNode[] {
  const existingKeys = new Set(existingNodes.map(n => n.key));
  const ghostNodes: HydratedContextNode[] = [];

  for (const requiredKey of REQUIRED_CONTEXT_KEYS) {
    // Check if primary key or any alternative exists
    const allKeys = getAllKeysForRequirement(requiredKey.key);
    const hasValue = allKeys.some(key => {
      const node = existingNodes.find(n => n.key === key);
      return node && isPopulated(node.value);
    });

    if (!hasValue) {
      // Create ghost node for this missing required field
      ghostNodes.push(createGhostNode(requiredKey));
    }
  }

  return ghostNodes;
}

/**
 * Merge nodes with ghost nodes for missing required fields
 * This ensures all required fields appear in the Context Map,
 * even if they don't have values yet.
 *
 * @param existingNodes - Nodes from the context graph
 * @param includeGhosts - Whether to include ghost nodes (default: true)
 * @returns Merged node list with ghost nodes for missing required fields
 */
export function mergeNodesWithGhosts(
  existingNodes: HydratedContextNode[],
  includeGhosts: boolean = true
): HydratedContextNode[] {
  if (!includeGhosts) {
    return existingNodes;
  }

  const ghostNodes = getGhostNodesForMissingRequired(existingNodes);
  return [...existingNodes, ...ghostNodes];
}

/**
 * Get the blocked-by keys from a list of nodes
 * Returns keys that are either missing or not confirmed
 */
export function getBlockedByKeysFromNodes(
  nodes: HydratedContextNode[]
): { key: string; label: string; reason: 'missing' | 'not_confirmed' }[] {
  const blocked: { key: string; label: string; reason: 'missing' | 'not_confirmed' }[] = [];

  for (const requiredKey of REQUIRED_CONTEXT_KEYS) {
    // Only consider fields required for strategy
    if (!requiredKey.requiredFor.includes('strategy')) continue;

    const allKeys = getAllKeysForRequirement(requiredKey.key);
    let foundNode: HydratedContextNode | undefined;

    for (const key of allKeys) {
      const node = nodes.find(n => n.key === key);
      if (node && isPopulated(node.value)) {
        foundNode = node;
        break;
      }
    }

    if (!foundNode) {
      // Missing
      blocked.push({
        key: requiredKey.key,
        label: requiredKey.shortLabel || requiredKey.label,
        reason: 'missing',
      });
    } else if (foundNode.status !== 'confirmed') {
      // Present but not confirmed
      blocked.push({
        key: requiredKey.key,
        label: requiredKey.shortLabel || requiredKey.label,
        reason: 'not_confirmed',
      });
    }
  }

  return blocked;
}
