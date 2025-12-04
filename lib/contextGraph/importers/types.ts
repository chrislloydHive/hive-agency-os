// lib/contextGraph/importers/types.ts
// Domain Importer Interface for Context Graph Hydration
//
// This module defines the interface for importers that extract data from
// historical diagnostic runs and import it into the Company Context Graph.

import type { CompanyContextGraph } from '../companyContextGraph';

/**
 * Import Result - returned by importAll() to describe what was imported
 */
export interface ImportResult {
  /** Whether the import was successful */
  success: boolean;
  /** Number of fields that were updated */
  fieldsUpdated: number;
  /** Array of field paths that were updated (e.g., 'identity.businessName') */
  updatedPaths: string[];
  /** Any errors encountered during import */
  errors: string[];
  /** The source run IDs that were used */
  sourceRunIds: string[];
}

/**
 * Domain Importer Interface
 *
 * Implementers of this interface are responsible for:
 * 1. Determining if they support a given company (via supports())
 * 2. Fetching historical diagnostic data for that company
 * 3. Mapping the diagnostic data to context graph fields
 * 4. Using mergeField/setField to update the graph with provenance
 */
export interface DomainImporter {
  /** Unique identifier for this importer (e.g., 'gap', 'websiteLab') */
  id: string;

  /** Human-readable label for this importer */
  label: string;

  /**
   * Check if this importer has historical data for the given company
   *
   * @param companyId - The company ID to check
   * @param domain - The company's domain (for matching runs by URL)
   * @returns Promise<boolean> - true if importer has data to contribute
   */
  supports(companyId: string, domain: string): Promise<boolean>;

  /**
   * Import all available historical data into the context graph
   *
   * This method should:
   * 1. Fetch all relevant historical runs for the company
   * 2. Map the data to context graph fields
   * 3. Use setField/mergeField with appropriate provenance
   * 4. Return information about what was imported
   *
   * @param graph - The context graph to update (mutated in place)
   * @param companyId - The company ID
   * @param domain - The company's domain
   * @returns Promise<ImportResult> - Details about what was imported
   */
  importAll(
    graph: CompanyContextGraph,
    companyId: string,
    domain: string
  ): Promise<ImportResult>;
}

/**
 * Importer Registry Entry - wrapper for registered importers
 */
export interface ImporterRegistryEntry {
  /** The importer instance */
  importer: DomainImporter;
  /** Priority order (lower = runs first) */
  priority: number;
  /** Whether this importer is enabled */
  enabled: boolean;
}

/**
 * Hydration Result - returned by hydrateContextFromHistory()
 */
export interface HydrationResult {
  /** Whether the overall hydration was successful */
  success: boolean;
  /** Results from each importer that ran */
  importerResults: Array<{
    importerId: string;
    importerLabel: string;
    result: ImportResult;
  }>;
  /** Total fields updated across all importers */
  totalFieldsUpdated: number;
  /** Total errors across all importers */
  totalErrors: number;
  /** The updated context graph */
  graph: CompanyContextGraph;
}
