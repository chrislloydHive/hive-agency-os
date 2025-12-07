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
}

/**
 * Map Airtable record to ContextGraphRecord
 */
/**
 * Deep merge loaded graph with empty template to ensure all fields exist.
 * This handles schema evolution - new fields added to the schema will be
 * initialized with empty values when loading older graphs.
 */
function mergeWithEmptyGraph(loaded: CompanyContextGraph): CompanyContextGraph {
  const empty = createEmptyContextGraph('', '');

  // Helper to deep merge domain objects
  const mergeDomain = <T extends object>(emptyDomain: T, loadedDomain: T | undefined): T => {
    if (!loadedDomain) return emptyDomain;

    const merged = { ...emptyDomain };
    for (const key of Object.keys(loadedDomain) as (keyof T)[]) {
      if (key in emptyDomain) {
        (merged as any)[key] = loadedDomain[key];
      }
    }
    // Also include any extra fields from loaded that aren't in empty
    for (const key of Object.keys(loadedDomain) as (keyof T)[]) {
      if (!(key in merged)) {
        (merged as any)[key] = loadedDomain[key];
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
    const graph = mergeWithEmptyGraph(loadedGraph);

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
    const records = await base(CONTEXT_GRAPHS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      // Normal - company may not have a context graph yet
      return null;
    }

    const mapped = mapAirtableRecord(records[0]);
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
    const records = await base(CONTEXT_GRAPHS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${companyId}"`,
        maxRecords: 1,
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
    const existingRecords = await base(CONTEXT_GRAPHS_TABLE)
      .select({
        filterByFormula: `{Company ID} = "${graph.companyId}"`,
        maxRecords: 1,
      })
      .firstPage();

    // Minify the graph by removing null values and empty arrays to reduce size
    const minifiedGraph = JSON.parse(JSON.stringify(graph, (key, value) => {
      // Remove null values
      if (value === null) return undefined;
      // Remove empty arrays (but keep arrays with content)
      if (Array.isArray(value) && value.length === 0) return undefined;
      // Remove empty strings
      if (value === '') return undefined;
      return value;
    }));

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
