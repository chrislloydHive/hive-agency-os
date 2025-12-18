// lib/contextGraph/storage.ts
// Airtable persistence layer for Company Context Graph

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  CompanyContextGraph,
  createEmptyContextGraph,
  calculateCompleteness,
  calculateDomainCoverage,
} from './companyContextGraph';

const CONTEXT_GRAPHS_TABLE = AIRTABLE_TABLES.CONTEXT_GRAPHS;

/**
 * Calculate total number of populated fields (nodes) in a context graph
 * Returns the count of fields with non-null, non-empty values
 */
function calculateNodeCount(graph: CompanyContextGraph): number {
  let populatedFields = 0;

  function countNodes(obj: unknown, depth = 0): void {
    if (depth > 10) return;

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const record = obj as Record<string, unknown>;

      if ('value' in record && 'provenance' in record) {
        if (record.value !== null && record.value !== undefined) {
          if (Array.isArray(record.value) && record.value.length === 0) {
            // Empty arrays don't count
          } else {
            populatedFields++;
          }
        }
      } else {
        for (const value of Object.values(record)) {
          countNodes(value, depth + 1);
        }
      }
    }
  }

  // Count populated fields in each domain
  const domainNames = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive',
    'budgetOps', 'operationalConstraints', 'storeRisk', 'historyRefs', 'social',
  ] as const;

  for (const domain of domainNames) {
    if ((graph as any)[domain]) {
      countNodes((graph as any)[domain]);
    }
  }

  return populatedFields;
}

/**
 * Check if a value is "empty" (should be stripped from storage)
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return true;
  return false;
}

/**
 * Check if a field object represents a missing/empty field
 * A field is empty if: value is null/undefined, value is empty array, or the whole object is {}
 */
function isEmptyField(field: unknown): boolean {
  if (!field || typeof field !== 'object') return false;

  const obj = field as Record<string, unknown>;

  // Empty object {} → empty
  if (Object.keys(obj).length === 0) return true;

  // Has value key
  if ('value' in obj) {
    const val = obj.value;
    // value is null/undefined → empty
    if (val === null || val === undefined) return true;
    // value is empty array → empty
    if (Array.isArray(val) && val.length === 0) return true;
    // value is empty string → empty
    if (val === '') return true;
  }

  return false;
}

/**
 * Recursively strip empty fields from an object
 * Removes:
 * - null, undefined, '', [] values
 * - {} empty objects
 * - Fields with { value: null } or { value: [] }
 *
 * This prevents {} pollution in stored JSON.
 */
function stripEmptyFields(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 20) return obj;

  // Handle non-objects
  if (obj === null || obj === undefined) return undefined;
  if (typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    const filtered = obj
      .map(item => stripEmptyFields(item, depth + 1))
      .filter(item => item !== undefined && !isEmptyValue(item));
    return filtered.length === 0 ? undefined : filtered;
  }

  // Handle objects
  const result: Record<string, unknown> = {};
  let hasContent = false;

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Skip meta fields in domains (keep them)
    if (key === 'meta' && depth === 0) {
      result[key] = value;
      hasContent = true;
      continue;
    }

    // Skip companyId/companyName at root
    if ((key === 'companyId' || key === 'companyName') && depth === 0) {
      result[key] = value;
      hasContent = true;
      continue;
    }

    // Check if this is a "field" object with value/provenance structure
    if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
      // This is a field - check if it's empty
      if (isEmptyField(value)) {
        continue; // Skip empty fields entirely
      }
      // Keep non-empty fields
      result[key] = value;
      hasContent = true;
      continue;
    }

    // Recursively process nested objects
    const stripped = stripEmptyFields(value, depth + 1);

    // Skip if result is undefined or empty
    if (stripped === undefined) continue;
    if (isEmptyValue(stripped)) continue;

    result[key] = stripped;
    hasContent = true;
  }

  return hasContent ? result : undefined;
}

/**
 * Compress a graph for storage by removing redundant data
 * - Keeps only the first provenance entry per field
 * - Removes detailed provenance from competitor profiles
 */
function compressGraphForStorage(graph: any): any {
  const compressed = JSON.parse(JSON.stringify(graph));

  // Helper to trim provenance arrays to just the first entry
  const trimProvenance = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;

    for (const key of Object.keys(obj)) {
      const value = obj[key];

      // If this is a field with provenance, trim it
      if (value && typeof value === 'object' && 'provenance' in value && Array.isArray(value.provenance)) {
        value.provenance = value.provenance.slice(0, 1);
      }

      // If this is an array of competitor profiles, trim their provenance
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && 'provenance' in item && Array.isArray(item.provenance)) {
            item.provenance = item.provenance.slice(0, 1);
          }
        }
      }

      // Recurse into nested objects (domains)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        trimProvenance(value);
      }
    }
  };

  // Process each domain
  for (const domainKey of Object.keys(compressed)) {
    if (domainKey !== 'meta' && compressed[domainKey] && typeof compressed[domainKey] === 'object') {
      trimProvenance(compressed[domainKey]);
    }
  }

  return compressed;
}

/**
 * Save a compressed graph to Airtable
 */
async function saveCompressedGraph(
  originalGraph: CompanyContextGraph,
  compressedJson: string,
  base: ReturnType<typeof getBase>,
  existingRecords: readonly any[],
  now: string,
  completenessScore: number,
  source?: string
): Promise<ContextGraphRecord | null> {
  const fields: Record<string, unknown> = {
    'Company ID': originalGraph.companyId,
    'Company Name': originalGraph.companyName,
    'Graph JSON': compressedJson,
    'Version': originalGraph.meta.version,
    'Completeness Score': completenessScore,
    'Updated At': now,
  };

  if (source) {
    fields['Last Updated By'] = 'user';
  }

  let savedRecord: any;

  if (existingRecords.length > 0) {
    savedRecord = await base(CONTEXT_GRAPHS_TABLE).update(
      existingRecords[0].id,
      fields as any
    );
    console.log(`[ContextGraph] Updated compressed graph for ${originalGraph.companyName}`);
  } else {
    const createFields = { ...fields, 'Created At': now };
    const created = await base(CONTEXT_GRAPHS_TABLE).create([
      { fields: createFields as any },
    ]);
    savedRecord = created[0];
    console.log(`[ContextGraph] Created compressed graph for ${originalGraph.companyName}`);
  }

  return mapAirtableRecord(savedRecord);
}

/**
 * Airtable record structure for Context Graph storage
 *
 * Actual Airtable columns (from ContextGraphs table):
 * - Company ID (text) - Links to Companies table by canonical ID
 * - Company Name (text) - Denormalized for easy viewing
 * - Graph JSON (long text) - The full context graph as JSON
 * - Version (text) - Schema version
 * - Completeness Score (number) - 0-100 percentage
 * - Last Updated By (text) - Source that last updated (e.g., "audience_lab")
 * - Created At (date)
 * - Updated At (date)
 * - Company (link) - Link to Companies table
 * - ContextGraphHistory (link) - Link to history table
 */

export interface ContextGraphRecord {
  id: string; // Airtable record ID
  companyId: string;
  companyName: string;
  graph: CompanyContextGraph;
  version: string;
  completenessScore: number | null;
  lastUpdatedBy: string | null;
  createdAt: string;
  updatedAt: string;

  // =========================================================================
  // Extracted Fields (Phase 3 - optional fields extracted from Graph JSON)
  // These provide queryable/sortable access to key data points
  // =========================================================================

  /** Total number of fields with values in the graph */
  nodeCount?: number;
  /** Number of domains with >0% coverage */
  domainCount?: number;
  /** When the graph was last fused with new data */
  lastFusionAt?: string | null;
  /** Whether baseline context has been initialized */
  contextInitialized?: boolean;

  /** Business type from identity domain */
  businessType?: string;
  /** Industry classification from identity domain */
  industry?: string;

  /** Whether competitor data exists */
  hasCompetitors?: boolean;
  /** Number of competitors tracked */
  competitorCount?: number;
  /** Whether audience segment data exists */
  hasAudienceData?: boolean;

  /** Individual domain coverage percentages (optional) */
  identityCoverage?: number;
  brandCoverage?: number;
  audienceCoverage?: number;
  contentCoverage?: number;
  seoCoverage?: number;
}

/**
 * Normalize a field to canonical format: { value, provenance }
 * Converts:
 * - {} → { value: null, provenance: [] }
 * - { value: null } → { value: null, provenance: [] }
 * - undefined → { value: null, provenance: [] }
 */
function normalizeField(field: unknown): { value: unknown; provenance: unknown[] } {
  // Null/undefined → missing field
  if (field === null || field === undefined) {
    return { value: null, provenance: [] };
  }

  // Not an object → wrap as value
  if (typeof field !== 'object') {
    return { value: field, provenance: [] };
  }

  // Empty object {} → missing field
  if (Object.keys(field as object).length === 0) {
    return { value: null, provenance: [] };
  }

  // Already has value/provenance structure
  const obj = field as Record<string, unknown>;
  if ('value' in obj) {
    return {
      value: obj.value ?? null,
      provenance: Array.isArray(obj.provenance) ? obj.provenance : [],
    };
  }

  // Unknown structure → treat as value
  return { value: field, provenance: [] };
}

/**
 * Recursively normalize all fields in a domain to canonical format
 */
function normalizeDomainFields(domain: unknown): Record<string, unknown> {
  if (!domain || typeof domain !== 'object') {
    return {};
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(domain as Record<string, unknown>)) {
    // Check if this is a WithMeta field (has value and provenance)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;

      // If it looks like a field (has 'value' key or is empty), normalize it
      if ('value' in obj || Object.keys(obj).length === 0) {
        normalized[key] = normalizeField(value);
      } else {
        // Nested object - recurse
        normalized[key] = normalizeDomainFields(value);
      }
    } else {
      // Primitive or array - keep as is
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Map Airtable record to ContextGraphRecord
 */
/**
 * Deep merge loaded graph with empty template to ensure all fields exist.
 * This handles schema evolution - new fields added to the schema will be
 * initialized with empty values when loading older graphs.
 * Also normalizes all fields to canonical format: { value, provenance }
 */
function mergeWithEmptyGraph(loaded: CompanyContextGraph): CompanyContextGraph {
  const empty = createEmptyContextGraph('', '');

  // Helper to deep merge domain objects and normalize fields
  const mergeDomain = <T extends object>(emptyDomain: T, loadedDomain: T | undefined): T => {
    if (!loadedDomain) return emptyDomain;

    // First normalize the loaded domain fields
    const normalizedLoaded = normalizeDomainFields(loadedDomain);

    const merged = { ...emptyDomain };
    for (const key of Object.keys(normalizedLoaded) as (keyof T)[]) {
      if (key in emptyDomain) {
        (merged as any)[key] = normalizedLoaded[key as string];
      }
    }
    // Also include any extra fields from loaded that aren't in empty
    for (const key of Object.keys(normalizedLoaded) as (keyof T)[]) {
      if (!(key in merged)) {
        (merged as any)[key] = normalizedLoaded[key as string];
      }
    }
    return merged;
  };

  return {
    ...loaded,
    meta: { ...empty.meta, ...loaded.meta },
    identity: mergeDomain(empty.identity, loaded.identity),
    brand: mergeDomain(empty.brand, loaded.brand),
    objectives: mergeDomain(empty.objectives, loaded.objectives),
    audience: mergeDomain(empty.audience, loaded.audience),
    productOffer: mergeDomain(empty.productOffer, loaded.productOffer),
    digitalInfra: mergeDomain(empty.digitalInfra, loaded.digitalInfra),
    website: mergeDomain(empty.website, loaded.website),
    content: mergeDomain(empty.content, loaded.content),
    seo: mergeDomain(empty.seo, loaded.seo),
    ops: mergeDomain(empty.ops, loaded.ops),
    performanceMedia: mergeDomain(empty.performanceMedia, loaded.performanceMedia),
    historical: mergeDomain(empty.historical, loaded.historical),
    creative: mergeDomain(empty.creative, loaded.creative),
    competitive: mergeDomain(empty.competitive, loaded.competitive),
    budgetOps: mergeDomain(empty.budgetOps, loaded.budgetOps),
    operationalConstraints: mergeDomain(empty.operationalConstraints, loaded.operationalConstraints),
    storeRisk: mergeDomain(empty.storeRisk, loaded.storeRisk),
    historyRefs: mergeDomain(empty.historyRefs, loaded.historyRefs),
    social: mergeDomain(empty.social, loaded.social),
    capabilities: mergeDomain(empty.capabilities, loaded.capabilities),
  };
}

function mapAirtableRecord(record: any): ContextGraphRecord | null {
  try {
    const fields = record.fields;
    const graphJson = fields['Graph JSON'] as string | undefined;

    if (!graphJson) {
      console.warn(`[ContextGraph] Record ${record.id} has no Graph JSON`);
      return null;
    }

    const loadedGraph = JSON.parse(graphJson) as CompanyContextGraph;
    // Merge with empty graph to ensure all fields exist (handles schema evolution)
    const mergedGraph = mergeWithEmptyGraph(loadedGraph);

    // STRIP EMPTY FIELDS ON LOAD: Clean up {} and { value: null } pollution
    // from older stored graphs (migration behavior)
    const graph = stripEmptyFields(mergedGraph) as CompanyContextGraph;

    // Ensure core identifiers survive stripping
    if (!graph.companyId) graph.companyId = loadedGraph.companyId;
    if (!graph.companyName) graph.companyName = loadedGraph.companyName;

    return {
      id: record.id,
      companyId: (fields['Company ID'] as string) || '',
      companyName: (fields['Company Name'] as string) || '',
      graph,
      version: (fields['Version'] as string) || '1.0.0',
      completenessScore: (fields['Completeness Score'] as number) || null,
      lastUpdatedBy: (fields['Last Updated By'] as string) || null,
      createdAt: (fields['Created At'] as string) || new Date().toISOString(),
      updatedAt: (fields['Updated At'] as string) || new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[ContextGraph] Failed to parse record ${record.id}:`, error);
    return null;
  }
}

/**
 * Load context graph for a company
 *
 * @param companyId - Canonical company ID (UUID)
 * @returns Context graph or null if not found
 */
export async function loadContextGraph(
  companyId: string
): Promise<CompanyContextGraph | null> {
  try {
    const base = getBase();
    // CRITICAL: Order by Updated At DESC to get the most recent record
    // This prevents returning stale data when multiple records exist
    const records = await base(CONTEXT_GRAPHS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: 1,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      // Normal - company may not have a context graph yet
      return null;
    }

    const mapped = mapAirtableRecord(records[0]);
    console.log(`[ContextGraph] Loaded graph for ${companyId}:`, {
      recordId: records[0].id,
      updatedAt: records[0].fields['Updated At'],
      completeness: records[0].fields['Completeness Score'],
    });
    return mapped?.graph || null;
  } catch (error: any) {
    // Handle case where table doesn't exist yet
    if (error?.statusCode === 404 || error?.error === 'NOT_FOUND') {
      console.warn(`[ContextGraph] Table "${CONTEXT_GRAPHS_TABLE}" not found in Airtable.`);
      return null;
    }
    console.warn(`[ContextGraph] Could not load graph for ${companyId}:`, error?.message || 'Unknown error');
    return null;
  }
}

/**
 * Load context graph with full record metadata
 *
 * @param companyId - Canonical company ID (UUID)
 * @returns Full record or null if not found
 */
export async function loadContextGraphRecord(
  companyId: string
): Promise<ContextGraphRecord | null> {
  try {
    const base = getBase();
    // CRITICAL: Order by Updated At DESC to get the most recent record
    const records = await base(CONTEXT_GRAPHS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: 1,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return mapAirtableRecord(records[0]);
  } catch (error) {
    console.error(`[ContextGraph] Failed to load graph record for ${companyId}:`, error);
    return null;
  }
}

/**
 * Save context graph for a company (create or update)
 *
 * @param graph - The context graph to save
 * @param source - Optional source identifier for Last Updated By field
 * @returns Saved record or null on error
 */
export async function saveContextGraph(
  graph: CompanyContextGraph,
  source?: string
): Promise<ContextGraphRecord | null> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Calculate scores
    const completenessScore = calculateCompleteness(graph);
    const domainCoverage = calculateDomainCoverage(graph);

    // Update graph metadata
    graph.meta.updatedAt = now;
    graph.meta.completenessScore = completenessScore;
    graph.meta.domainCoverage = domainCoverage;

    // Check if record already exists
    // CRITICAL: Order by Updated At DESC to update the most recent record if duplicates exist
    const existingRecords = await base(CONTEXT_GRAPHS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${graph.companyId}"`,
        maxRecords: 1,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .firstPage();

    if (existingRecords.length > 0) {
      console.log(`[ContextGraph] Found existing record ${existingRecords[0].id} for ${graph.companyId}`);
    }

    // Minify the graph by removing null values, empty arrays, and empty field objects
    // This prevents {} pollution in the stored JSON
    const minifiedGraph = stripEmptyFields(JSON.parse(JSON.stringify(graph)));

    const graphJson = JSON.stringify(minifiedGraph);
    const jsonSize = graphJson.length;

    // Airtable Long Text field has a 100,000 character limit
    if (jsonSize > 100000) {
      console.warn(`[ContextGraph] Graph JSON is ${jsonSize} chars (limit: 100,000). May fail to save.`);
      // Try more aggressive compression - remove provenance history beyond first entry
      const compressedGraph = compressGraphForStorage(minifiedGraph);
      const compressedJson = JSON.stringify(compressedGraph);
      console.log(`[ContextGraph] Compressed to ${compressedJson.length} chars`);
      if (compressedJson.length <= 100000) {
        console.log(`[ContextGraph] Using compressed graph`);
        return saveCompressedGraph(graph, compressedJson, base, existingRecords, now, completenessScore, source);
      }
    }

    console.log(`[ContextGraph] Saving graph for ${graph.companyName} (${jsonSize} chars, ${completenessScore}% complete)`);

    const fields: Record<string, unknown> = {
      'Company ID': graph.companyId,
      'Company Name': graph.companyName,
      'Graph JSON': graphJson,
      'Version': graph.meta.version,
      'Completeness Score': completenessScore,
      'Updated At': now,
    };

    // Set Last Updated By - map to valid Airtable select options
    // Valid options in Airtable: 'user' (add more as needed: 'fusion', 'diagnostic', 'import', 'api')
    if (source) {
      // Map various source names to 'user' for now
      fields['Last Updated By'] = 'user';
    }

    // =========================================================================
    // Extract queryable fields from Graph JSON for easier Airtable queries
    // =========================================================================

    // Node count (estimated from completeness calculation)
    const nodeCount = calculateNodeCount(graph);
    fields['Node Count'] = nodeCount;

    // Domain count (domains with >0% coverage)
    const domainCountValue = Object.values(domainCoverage).filter((v) => v > 0).length;
    fields['Domain Count'] = domainCountValue;

    // Last fusion timestamp
    fields['Last Fusion At'] = graph.meta.lastFusionAt;

    // Context initialized flag
    fields['Context Initialized'] = graph.meta.contextInitializedAt !== null;

    // Business type from identity domain
    const businessType = (graph.identity as any)?.businessType?.value;
    if (businessType) {
      fields['Business Type'] = businessType;
    }

    // Industry from identity domain
    const industry = (graph.identity as any)?.industry?.value;
    if (industry) {
      fields['Industry'] = industry;
    }

    // Competitor data
    const topCompetitors = (graph.competitive as any)?.topCompetitors?.value;
    fields['Has Competitors'] = Array.isArray(topCompetitors) && topCompetitors.length > 0;
    fields['Competitor Count'] = Array.isArray(topCompetitors) ? topCompetitors.length : 0;

    // Audience data
    const primarySegments = (graph.audience as any)?.primarySegments?.value;
    fields['Has Audience Data'] = Array.isArray(primarySegments) && primarySegments.length > 0;

    // Individual domain coverages
    fields['Identity Coverage'] = domainCoverage.identity ?? 0;
    fields['Brand Coverage'] = domainCoverage.brand ?? 0;
    fields['Audience Coverage'] = domainCoverage.audience ?? 0;
    fields['Content Coverage'] = domainCoverage.content ?? 0;
    fields['SEO Coverage'] = domainCoverage.seo ?? 0;

    let savedRecord: any;

    if (existingRecords.length > 0) {
      // Update existing record
      savedRecord = await base(CONTEXT_GRAPHS_TABLE).update(
        existingRecords[0].id,
        fields as any
      );
      console.log(`[ContextGraph] Updated graph for ${graph.companyName} (${completenessScore}% complete)`);
    } else {
      // Create new record
      const createFields = {
        ...fields,
        'Created At': now,
      };
      const created = await base(CONTEXT_GRAPHS_TABLE).create([
        { fields: createFields as any },
      ]);
      savedRecord = created[0];
      console.log(`[ContextGraph] Created graph for ${graph.companyName} (${completenessScore}% complete)`);
    }

    return mapAirtableRecord(savedRecord);
  } catch (error) {
    console.error(`[ContextGraph] Failed to save graph for ${graph.companyId}:`, error);
    return null;
  }
}

/**
 * Get or create context graph for a company
 *
 * @param companyId - Canonical company ID
 * @param companyName - Company name (used if creating new)
 * @returns Context graph (existing or newly created)
 */
export async function getOrCreateContextGraph(
  companyId: string,
  companyName: string
): Promise<CompanyContextGraph> {
  // Try to load existing
  const existing = await loadContextGraph(companyId);
  if (existing) {
    return existing;
  }

  // Create new empty graph
  const newGraph = createEmptyContextGraph(companyId, companyName);

  // Save to Airtable
  await saveContextGraph(newGraph);

  return newGraph;
}

/**
 * Delete context graph for a company
 *
 * @param companyId - Canonical company ID
 * @returns true if deleted, false if not found or error
 */
export async function deleteContextGraph(companyId: string): Promise<boolean> {
  try {
    const base = getBase();
    const records = await base(CONTEXT_GRAPHS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return false;
    }

    await base(CONTEXT_GRAPHS_TABLE).destroy([records[0].id]);
    console.log(`[ContextGraph] Deleted graph for ${companyId}`);
    return true;
  } catch (error) {
    console.error(`[ContextGraph] Failed to delete graph for ${companyId}:`, error);
    return false;
  }
}

/**
 * List all context graphs (for admin/debugging)
 *
 * @param limit - Maximum records to return
 * @returns Array of context graph records
 */
export async function listContextGraphs(
  limit: number = 100
): Promise<ContextGraphRecord[]> {
  try {
    const base = getBase();
    const records = await base(CONTEXT_GRAPHS_TABLE)
      .select({
        maxRecords: limit,
        sort: [{ field: 'Updated At', direction: 'desc' }],
      })
      .all();

    return records
      .map(mapAirtableRecord)
      .filter((r): r is ContextGraphRecord => r !== null);
  } catch (error) {
    console.error('[ContextGraph] Failed to list graphs:', error);
    return [];
  }
}

/**
 * Get context graph completeness stats for a company
 *
 * @param companyId - Canonical company ID
 * @returns Completeness data or null if not found
 */
export async function getContextGraphStats(
  companyId: string
): Promise<{
  completenessScore: number;
  domainCoverage: Record<string, number>;
  lastFusionAt: string | null;
  version: string;
} | null> {
  const graph = await loadContextGraph(companyId);
  if (!graph) {
    return null;
  }

  return {
    completenessScore: graph.meta.completenessScore || calculateCompleteness(graph),
    domainCoverage: graph.meta.domainCoverage || calculateDomainCoverage(graph),
    lastFusionAt: graph.meta.lastFusionAt,
    version: graph.meta.version,
  };
}
