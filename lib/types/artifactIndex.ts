// lib/types/artifactIndex.ts
// CompanyArtifactIndex: Canonical index of ALL artifacts for a company
//
// This provides a unified view of artifacts across all sources:
// - Diagnostic runs (labs, GAP)
// - Strategy outputs
// - Google Drive documents
// - RFP/Proposal documents
// - Work item outputs
//
// The Documents UI queries ONLY this index to display artifacts.
//
// IMPORTANT: This file uses canonical enums from artifactTaxonomy.ts.
// Do not add new artifact types without updating the taxonomy.

import {
  ArtifactPhase,
  ArtifactType,
  ArtifactSource,
  ArtifactStorage,
  ArtifactStatus,
  ArtifactFileType,
} from './artifactTaxonomy';

// Re-export canonical enums for convenience
export {
  ArtifactPhase,
  ArtifactType,
  ArtifactSource,
  ArtifactStorage,
  ArtifactStatus,
  ArtifactFileType,
} from './artifactTaxonomy';

// ============================================================================
// Legacy Type Aliases (for backwards compatibility)
// ============================================================================

/**
 * @deprecated Use ArtifactType from artifactTaxonomy.ts
 */
export type IndexedArtifactType = ArtifactType | string;

/**
 * @deprecated Use ArtifactSource from artifactTaxonomy.ts
 */
export type ArtifactSourceModule = ArtifactSource | string;

/**
 * @deprecated Use ArtifactStatus from artifactTaxonomy.ts
 */
export type IndexedArtifactStatus = ArtifactStatus;

// ============================================================================
// CompanyArtifactIndex Record
// ============================================================================

/**
 * CompanyArtifactIndex: The canonical artifact index record
 *
 * Every artifact in the system should have a corresponding index record.
 * This enables the Documents UI to show ALL artifacts in one query.
 *
 * REQUIRED FIELDS for indexing (enforced by validateIndexInput):
 * - phase: Client lifecycle phase
 * - artifactType: Canonical artifact type
 * - source: How the artifact was created
 * - storage: Where content is stored
 * - groupKey: Grouping key for versioning
 */
export interface CompanyArtifactIndex {
  /** Unique index record ID */
  id: string;

  /** Company this artifact belongs to */
  companyId: string;

  /** Display title */
  title: string;

  /** Artifact type classification (canonical) */
  artifactType: ArtifactType | string;

  /** Phase in client lifecycle (canonical) */
  phase: ArtifactPhase;

  /** Source that created this artifact (canonical) */
  source: ArtifactSource | string;

  /** Storage location (canonical) */
  storage: ArtifactStorage;

  /** Grouping key for version grouping (REQUIRED) */
  groupKey: string;

  /** Optional run ID if from a diagnostic run */
  sourceRunId: string | null;

  /** Optional artifact ID if this indexes an existing Artifact record */
  sourceArtifactId: string | null;

  /** Optional strategy ID if strategy-related */
  sourceStrategyId: string | null;

  /** Deep link URL to view/open the artifact */
  url: string;

  /** Google Drive file ID if applicable */
  googleFileId: string | null;

  /** Artifact status */
  status: ArtifactStatus;

  /** Whether this is the primary artifact for its type */
  primary: boolean;

  /** Brief description or summary */
  description: string | null;

  /** File type for icon display (canonical) */
  fileType: ArtifactFileType;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;

  // ---------------------------------------------------------------------------
  // Legacy field (deprecated, use 'source' instead)
  // ---------------------------------------------------------------------------
  /** @deprecated Use 'source' field instead */
  sourceModule?: ArtifactSourceModule;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating a new index record
 *
 * ALL REQUIRED FIELDS must be provided:
 * - phase, artifactType, source, storage, groupKey
 */
export interface CreateArtifactIndexInput {
  companyId: string;
  title: string;

  // REQUIRED canonical fields
  phase: ArtifactPhase;
  artifactType: ArtifactType | string;
  source: ArtifactSource | string;
  storage: ArtifactStorage;
  groupKey: string;

  // Source linking
  sourceRunId?: string | null;
  sourceArtifactId?: string | null;
  sourceStrategyId?: string | null;

  // Content location
  url: string;
  googleFileId?: string | null;

  // Status and display
  status?: ArtifactStatus;
  primary?: boolean;
  description?: string | null;
  fileType?: ArtifactFileType;

  // Legacy field (deprecated)
  /** @deprecated Use 'source' field instead */
  sourceModule?: ArtifactSourceModule;
}

/**
 * Input for updating an index record
 */
export interface UpdateArtifactIndexInput {
  title?: string;
  status?: ArtifactStatus;
  primary?: boolean;
  url?: string;
  description?: string | null;
  updatedAt?: string;
}

/**
 * Upsert key for idempotent writes
 * Records are unique by: companyId + artifactType + groupKey + url
 */
export interface ArtifactIndexUpsertKey {
  companyId: string;
  artifactType: ArtifactType | string;
  groupKey: string;
  url: string;
}

// ============================================================================
// Helper Functions
// Re-export canonical helpers from artifactTaxonomy.ts
// ============================================================================

// Import and re-export canonical helper functions
import {
  getPhaseForArtifactType,
  getFileTypeForArtifactType,
  getArtifactTypeForDiagnostic,
  getSourceForDiagnostic,
  getArtifactTypeLabel,
  getPhaseLabel,
  getStatusLabel,
  getSourceLabel,
  validateIndexInput,
  generateGroupKey as generateGroupKeyCanonical,
} from './artifactTaxonomy';

export {
  getPhaseForArtifactType,
  getFileTypeForArtifactType,
  getArtifactTypeForDiagnostic,
  getSourceForDiagnostic,
  getArtifactTypeLabel,
  getPhaseLabel,
  getStatusLabel,
  getSourceLabel,
  validateIndexInput,
};

/**
 * Map diagnostic tool ID to artifact type, phase, and source
 * @deprecated Use getArtifactTypeForDiagnostic and getSourceForDiagnostic from artifactTaxonomy
 */
export function mapDiagnosticToolToArtifact(toolId: string): {
  artifactType: ArtifactType | string;
  phase: ArtifactPhase;
  source: ArtifactSource | string;
  /** @deprecated */
  sourceModule?: string;
} {
  const artifactType = getArtifactTypeForDiagnostic(toolId);
  const phase = getPhaseForArtifactType(artifactType);
  const source = getSourceForDiagnostic(toolId);
  return { artifactType, phase, source, sourceModule: source };
}

/**
 * Map artifact type to phase
 * @deprecated Use getPhaseForArtifactType from artifactTaxonomy
 */
export function mapArtifactTypeToPhase(artifactType: ArtifactType | string): ArtifactPhase {
  if (typeof artifactType === 'string' && !Object.values(ArtifactType).includes(artifactType as ArtifactType)) {
    // Legacy string type - map to appropriate phase
    if (artifactType.includes('lab_report') || artifactType.includes('gap_report')) {
      return ArtifactPhase.Discover;
    }
    if (artifactType.includes('strategy')) {
      return ArtifactPhase.Decide;
    }
    if (artifactType.includes('qbr')) {
      return ArtifactPhase.Report;
    }
    return ArtifactPhase.Deliver;
  }
  return getPhaseForArtifactType(artifactType as ArtifactType);
}

/**
 * Generate a group key for an artifact
 * @deprecated Use generateGroupKey from artifactTaxonomy
 */
export function generateGroupKey(
  sourceModule: ArtifactSourceModule,
  artifactType: ArtifactType | string,
  sourceId?: string
): string {
  return generateGroupKeyCanonical({
    artifactType: artifactType as ArtifactType,
    sourceId,
  });
}

/**
 * Generate a deep link URL for an artifact
 */
export function generateArtifactUrl(
  companyId: string,
  artifactType: ArtifactType | string,
  sourceId?: string,
  googleFileId?: string | null
): string {
  // If Google Drive file, use Google Docs/Sheets/Slides URL
  if (googleFileId) {
    const fileType = typeof artifactType === 'string'
      ? getFileTypeForArtifactType(artifactType as ArtifactType)
      : getFileTypeForArtifactType(artifactType);

    if (fileType === ArtifactFileType.Doc) {
      return `https://docs.google.com/document/d/${googleFileId}/edit`;
    }
    if (fileType === ArtifactFileType.Slides) {
      return `https://docs.google.com/presentation/d/${googleFileId}/edit`;
    }
    if (fileType === ArtifactFileType.Sheet) {
      return `https://docs.google.com/spreadsheets/d/${googleFileId}/edit`;
    }
    return `https://drive.google.com/file/d/${googleFileId}/view`;
  }

  // For internal artifacts, link to the Hive OS Documents page with artifact selected
  if (sourceId) {
    return `/c/${companyId}/documents?artifact=${sourceId}`;
  }

  return `/c/${companyId}/documents`;
}

/**
 * Determine file type from artifact type
 * @deprecated Use getFileTypeForArtifactType from artifactTaxonomy
 */
export function getFileTypeForArtifact(artifactType: ArtifactType | string): ArtifactFileType {
  return getFileTypeForArtifactType(artifactType as ArtifactType);
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from listing artifacts for a company
 */
export interface CompanyArtifactIndexResponse {
  ok: boolean;
  companyId: string;

  /** All indexed artifacts */
  artifacts: CompanyArtifactIndex[];

  /** Artifacts grouped by phase (using all ArtifactPhase values) */
  byPhase: { [K in ArtifactPhase]: CompanyArtifactIndex[] };

  /** Artifacts grouped by type */
  byType: Record<string, CompanyArtifactIndex[]>;

  /** Count of artifacts by status */
  statusCounts: {
    draft: number;
    final: number;
    archived: number;
    stale: number;
  };

  /** Total count */
  totalCount: number;

  /** Last indexed timestamp */
  lastIndexedAt: string | null;

  /** Error if any */
  error?: string;
}

/**
 * Result from indexing artifacts for a run
 */
export interface IndexArtifactsResult {
  ok: boolean;
  indexed: number;
  skipped: number;
  errors: string[];
}
