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
 * Airtable record structure for Context Graph storage
 *
 * Expected Airtable columns:
 * - Company ID (text) - Links to Companies table by canonical ID
 * - Company Name (text) - Denormalized for easy viewing
 * - Graph JSON (long text) - The full context graph as JSON
 * - Version (text) - Schema version
 * - Completeness Score (number) - 0-100 percentage
 * - Last Fusion At (date) - When AI fusion last ran
 * - Last Fusion Run ID (text) - Run ID of last fusion
 * - Created At (date)
 * - Updated At (date)
 */

export interface ContextGraphRecord {
  id: string; // Airtable record ID
  companyId: string;
  companyName: string;
  graph: CompanyContextGraph;
  version: string;
  completenessScore: number | null;
  lastFusionAt: string | null;
  lastFusionRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map Airtable record to ContextGraphRecord
 */
function mapAirtableRecord(record: any): ContextGraphRecord | null {
  try {
    const fields = record.fields;
    const graphJson = fields['Graph JSON'] as string | undefined;

    if (!graphJson) {
      console.warn(`[ContextGraph] Record ${record.id} has no Graph JSON`);
      return null;
    }

    const graph = JSON.parse(graphJson) as CompanyContextGraph;

    return {
      id: record.id,
      companyId: (fields['Company ID'] as string) || '',
      companyName: (fields['Company Name'] as string) || '',
      graph,
      version: (fields['Version'] as string) || '1.0.0',
      completenessScore: (fields['Completeness Score'] as number) || null,
      lastFusionAt: (fields['Last Fusion At'] as string) || null,
      lastFusionRunId: (fields['Last Fusion Run ID'] as string) || null,
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
 * @returns Saved record or null on error
 */
export async function saveContextGraph(
  graph: CompanyContextGraph
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

    const fields = {
      'Company ID': graph.companyId,
      'Company Name': graph.companyName,
      'Graph JSON': JSON.stringify(graph),
      'Version': graph.meta.version,
      'Completeness Score': completenessScore,
      'Last Fusion At': graph.meta.lastFusionAt,
      'Last Fusion Run ID': graph.meta.lastFusionRunId,
      'Updated At': now,
    };

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
