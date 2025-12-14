// lib/contextGraph/globalGraph.ts
// Hive Brain - Global Context Graph Storage
//
// Provides agency-wide defaults that can be overridden by company-specific values.
// Uses the same Context Graph schema but with a reserved companyId.
//
// IMPORTANT: Hive Brain is human-only edits. No AI auto-writes.

import {
  CompanyContextGraph,
  createEmptyContextGraph,
} from './companyContextGraph';
import { loadContextGraph, saveContextGraph } from './storage';
import type { SourceId } from './sourcePriority';

// ============================================================================
// Constants
// ============================================================================

/**
 * Reserved company ID for Hive Global Context Graph
 * This is the "Hive Brain" - agency-wide defaults
 */
export const HIVE_GLOBAL_ID = 'HIVE_GLOBAL';

/**
 * Display name for Hive Brain
 */
export const HIVE_GLOBAL_NAME = 'Hive Brain';

/**
 * Domains exposed in Hive Brain admin UI (v1)
 * These are the domains where agency-wide defaults make sense
 */
export const HIVE_BRAIN_DOMAINS = [
  'brand',
  'objectives',
  'operationalConstraints',
  'ops',
  'creative',
  'performanceMedia',
  'capabilities', // Hive Capabilities - service taxonomy
] as const;

export type HiveBrainDomain = typeof HIVE_BRAIN_DOMAINS[number];

/**
 * Valid sources for Hive Brain updates (human-only)
 */
export const HIVE_BRAIN_VALID_SOURCES: SourceId[] = ['manual', 'user', 'brain'];

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a source is valid for Hive Brain updates
 */
export function isValidHiveBrainSource(source: string): source is SourceId {
  return HIVE_BRAIN_VALID_SOURCES.includes(source as SourceId);
}

/**
 * Check if a graph is the Hive Global graph
 */
export function isHiveGlobalGraph(graph: CompanyContextGraph): boolean {
  return graph.companyId === HIVE_GLOBAL_ID;
}

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Get the Hive Global Context Graph
 * Creates an empty graph if none exists
 *
 * @returns The Hive Global context graph
 */
export async function getHiveGlobalContextGraph(): Promise<CompanyContextGraph> {
  const existing = await loadContextGraph(HIVE_GLOBAL_ID);

  if (existing) {
    console.log('[HiveBrain] Loaded existing Hive Brain graph');
    return existing;
  }

  // Create empty Hive Brain graph
  const newGraph = createEmptyContextGraph(HIVE_GLOBAL_ID, HIVE_GLOBAL_NAME);
  newGraph.meta.contextInitializedAt = new Date().toISOString();

  console.log('[HiveBrain] Created new Hive Brain graph');
  await saveContextGraph(newGraph, 'manual');

  return newGraph;
}

/**
 * Update the Hive Global Context Graph
 *
 * IMPORTANT: Only accepts human sources (manual, user, brain).
 * Rejects AI sources to maintain human control over agency-wide defaults.
 *
 * @param graph - The updated graph
 * @param source - Source identifier (must be human source)
 * @returns Updated graph or null on error
 */
export async function updateHiveGlobalContextGraph(
  graph: CompanyContextGraph,
  source: SourceId = 'manual'
): Promise<CompanyContextGraph | null> {
  // Validate this is the Hive Global graph
  if (graph.companyId !== HIVE_GLOBAL_ID) {
    console.error('[HiveBrain] Attempted to save non-Hive graph as Hive Brain');
    return null;
  }

  // Validate source is human-only
  if (!isValidHiveBrainSource(source)) {
    console.error(`[HiveBrain] Rejected AI source "${source}" - Hive Brain is human-only`);
    return null;
  }

  // Update metadata
  graph.meta.updatedAt = new Date().toISOString();

  // Save the graph
  const result = await saveContextGraph(graph, source);

  if (result) {
    console.log(`[HiveBrain] Updated Hive Brain (source: ${source})`);
    return graph;
  }

  console.error('[HiveBrain] Failed to save Hive Brain');
  return null;
}

/**
 * Check if Hive Brain has been initialized
 */
export async function hiveBrainExists(): Promise<boolean> {
  const graph = await loadContextGraph(HIVE_GLOBAL_ID);
  return graph !== null;
}

// ============================================================================
// Merge Utilities
// ============================================================================

/**
 * Merge Hive Brain defaults with company-specific values
 *
 * Precedence rules:
 * 1. If company has a human-confirmed value, use it
 * 2. If company has any value, use it
 * 3. Fall back to Hive Brain value (if present)
 *
 * @param companyGraph - The company's context graph
 * @param hiveGraph - The Hive Brain global graph
 * @returns Merged graph with company values taking precedence
 */
export function mergeWithHiveBrain(
  companyGraph: CompanyContextGraph,
  hiveGraph: CompanyContextGraph
): CompanyContextGraph {
  // Deep clone company graph as the base
  const merged = JSON.parse(JSON.stringify(companyGraph)) as CompanyContextGraph;

  // Merge each Hive Brain domain
  for (const domain of HIVE_BRAIN_DOMAINS) {
    const companyDomain = merged[domain] as Record<string, unknown>;
    const hiveDomain = hiveGraph[domain] as Record<string, unknown>;

    if (!hiveDomain) continue;

    // Merge fields within the domain
    for (const fieldKey of Object.keys(hiveDomain)) {
      const hiveField = hiveDomain[fieldKey] as { value?: unknown; provenance?: unknown[] } | undefined;
      const companyField = companyDomain?.[fieldKey] as { value?: unknown; provenance?: unknown[] } | undefined;

      // Skip if Hive Brain doesn't have a value
      if (!hiveField?.value) continue;
      if (Array.isArray(hiveField.value) && hiveField.value.length === 0) continue;

      // Skip if company already has a value
      if (companyField?.value) {
        if (Array.isArray(companyField.value) && companyField.value.length === 0) {
          // Company has empty array - fall through to use Hive Brain
        } else {
          continue; // Company has a value, keep it
        }
      }

      // Use Hive Brain value as default
      if (!companyDomain[fieldKey]) {
        companyDomain[fieldKey] = hiveField;
      } else {
        // Merge the field, keeping company provenance if any
        (companyDomain[fieldKey] as { value: unknown }).value = hiveField.value;
        // Add hive provenance if company has none
        if (!(companyDomain[fieldKey] as { provenance?: unknown[] }).provenance?.length) {
          (companyDomain[fieldKey] as { provenance: unknown[] }).provenance = [
            ...(hiveField.provenance || []),
          ].map(p => ({
            ...(p as object),
            source: `hive:${(p as { source?: string }).source || 'default'}`,
          }));
        }
      }
    }
  }

  return merged;
}

/**
 * Get value provenance info for display
 * Returns whether value comes from company or Hive Brain
 */
export interface ValueSource {
  source: 'company' | 'hive' | 'none';
  isHumanConfirmed: boolean;
}

export function getValueSource(
  companyGraph: CompanyContextGraph,
  hiveGraph: CompanyContextGraph | null,
  domain: string,
  field: string
): ValueSource {
  const companyDomain = companyGraph[domain as keyof CompanyContextGraph] as Record<string, unknown> | undefined;
  const companyField = companyDomain?.[field] as { value?: unknown; provenance?: unknown[] } | undefined;

  // Check if company has a value
  const companyHasValue = companyField?.value !== undefined && companyField?.value !== null &&
    !(Array.isArray(companyField.value) && companyField.value.length === 0);

  if (companyHasValue) {
    // Check if human-confirmed
    const latestProvenance = companyField?.provenance?.[0] as { source?: string } | undefined;
    const source = latestProvenance?.source?.toLowerCase() || '';
    const isHumanConfirmed = source.includes('user') || source.includes('manual') || source.includes('brain');

    return {
      source: 'company',
      isHumanConfirmed,
    };
  }

  // Check Hive Brain
  if (hiveGraph) {
    const hiveDomain = hiveGraph[domain as keyof CompanyContextGraph] as Record<string, unknown> | undefined;
    const hiveField = hiveDomain?.[field] as { value?: unknown } | undefined;

    const hiveHasValue = hiveField?.value !== undefined && hiveField?.value !== null &&
      !(Array.isArray(hiveField.value) && hiveField.value.length === 0);

    if (hiveHasValue) {
      return {
        source: 'hive',
        isHumanConfirmed: true, // Hive Brain is always human-confirmed
      };
    }
  }

  return {
    source: 'none',
    isHumanConfirmed: false,
  };
}
