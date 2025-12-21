// lib/contextGraph/importers/types.ts
// Domain Importer Interface for Context Graph Hydration
//
// This module defines the interface for importers that extract data from
// historical diagnostic runs and import it into the Company Context Graph.

import type { CompanyContextGraph } from '../companyContextGraph';

/**
 * Proof data for a single candidate write
 */
export interface CandidateWrite {
  path: string;
  valuePreview: string;
  source: string;
  confidence: number;
}

/**
 * Proof data for debugging import issues
 * Only populated when DEBUG_CONTEXT_PROOF=1 or options.proof=true
 */
export interface ImportProof {
  /** How data was extracted (e.g., 'rawEvidence.labResultV4', 'legacy', 'findings') */
  extractionPath: string | null;
  /** Number of keys found in raw data */
  rawKeysFound: number;
  /** Candidate writes before filtering */
  candidateWrites: CandidateWrite[];
  /** Count of fields skipped by reason */
  droppedByReason: {
    /** Value was empty/null/undefined */
    emptyValue: number;
    /** Source not authorized for target domain (blocked by domain authority) */
    domainAuthority: number;
    /** Field belongs to a different domain than the writer is authorized for */
    wrongDomainForField: number;
    /** Higher priority source already wrote this field */
    sourcePriority: number;
    /** User has confirmed this field, cannot overwrite */
    humanConfirmed: number;
    /** Field is not in the canonical schema */
    notCanonical: number;
    /** Other/unknown reason */
    other: number;
  };
  /** Paths that were successfully persisted */
  persistedWrites: string[];
  /** Top offending field keys that were skipped (for debugging) */
  offendingFields?: Array<{ path: string; reason: string }>;
}

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
  /** Proof data for debugging (only present in proof mode) */
  proof?: ImportProof;
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
 * Domain-level telemetry for hydration
 */
export interface DomainTelemetry {
  brand: number;
  audience: number;
  identity: number;
  productOffer: number;
  competitive: number;
  objectives: number;
  website: number;
  content: number;
  seo: number;
  other: number;
}

/**
 * Hydration telemetry for debugging and dashboards
 */
export interface HydrationTelemetry {
  /** Completeness percentage before hydration (0-100) */
  completenessBefore: number;
  /** Completeness percentage after hydration (0-100) */
  completenessAfter: number;
  /** Change in completeness (positive = improvement) */
  completenessChange: number;
  /** Fields written per domain by all importers */
  fieldsWrittenByDomain: DomainTelemetry;
  /** Duration of hydration in milliseconds */
  durationMs: number;
}

/**
 * Aggregated proof data from all importers
 * Only present when proofMode=true or DEBUG_CONTEXT_PROOF=1
 */
export interface AggregatedProof {
  /** Per-importer proof data */
  perImporter: Array<{
    importerId: string;
    proof: ImportProof | undefined;
  }>;
  /** Total candidate writes across all importers */
  totalCandidateWrites: number;
  /** Total persisted writes across all importers */
  totalPersistedWrites: number;
  /** Aggregated skip reasons across all importers */
  aggregatedDroppedByReason: {
    emptyValue: number;
    domainAuthority: number;
    wrongDomainForField: number;
    sourcePriority: number;
    humanConfirmed: number;
    notCanonical: number;
    other: number;
  };
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
  /** Telemetry for debugging and dashboards */
  telemetry?: HydrationTelemetry;
  /** Aggregated proof data (only present in proof mode) */
  proof?: AggregatedProof;
}
