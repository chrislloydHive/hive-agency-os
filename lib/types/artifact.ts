// lib/types/artifact.ts
// Workspace Artifacts - First-class document artifacts with Google Drive integration
//
// Design principle: Artifacts are the tangible outputs of Hive OS work.
// They live in Google Drive but are tracked and managed in Airtable.

// ============================================================================
// Core Types
// ============================================================================

/**
 * Type of artifact - determines template and behavior
 */
export type ArtifactType =
  | 'strategy_doc'   // Strategy document (Google Docs)
  | 'qbr_slides'     // QBR presentation (Google Slides)
  | 'brief_doc'      // Brief document (Google Docs)
  | 'media_plan'     // Media plan spreadsheet (Google Sheets)
  | 'custom';        // Custom artifact type

/**
 * Lifecycle status of the artifact
 */
export type ArtifactStatus =
  | 'draft'      // Being edited, not yet shared
  | 'published'  // Finalized and shared
  | 'archived';  // No longer active

/**
 * How the artifact was created - determines source linking
 */
export type ArtifactSource =
  | 'strategy_handoff'  // Created from strategy completion
  | 'qbr_export'        // Created from QBR story export
  | 'brief_export'      // Created from brief export
  | 'media_plan_export' // Created from media plan export
  | 'manual';           // Manually created by user

/**
 * Google Drive file type
 */
export type GoogleFileType =
  | 'document'     // Google Docs
  | 'spreadsheet'  // Google Sheets
  | 'presentation' // Google Slides
  | 'folder';      // Google Drive folder

// ============================================================================
// Artifact Record
// ============================================================================

/**
 * Core artifact record - stored in Airtable, linked to Google Drive
 */
export interface Artifact {
  /** Airtable record ID */
  id: string;

  /** Company this artifact belongs to */
  companyId: string;

  /** Human-readable title */
  title: string;

  /** Type of artifact */
  type: ArtifactType;

  /** Current status */
  status: ArtifactStatus;

  /** How this artifact was created */
  source: ArtifactSource;

  // ---------------------------------------------------------------------------
  // Google Drive Integration
  // ---------------------------------------------------------------------------

  /** Google Drive file ID (null if not yet created in Drive) */
  googleFileId: string | null;

  /** Google Drive file type */
  googleFileType: GoogleFileType | null;

  /** Direct URL to the Google file */
  googleFileUrl: string | null;

  /** Google Drive folder ID where file is stored */
  googleFolderId: string | null;

  /** Last time the Google file was modified (from Drive API) */
  googleModifiedAt: string | null;

  // ---------------------------------------------------------------------------
  // Source Linking (traceability)
  // ---------------------------------------------------------------------------

  /** Strategy ID this artifact was created from (if source=strategy_handoff) */
  sourceStrategyId: string | null;

  /** QBR Story ID this artifact was created from (if source=qbr_export) */
  sourceQbrStoryId: string | null;

  /** Brief ID this artifact was created from (if source=brief_export) */
  sourceBriefId: string | null;

  /** Media Plan ID this artifact was created from (if source=media_plan_export) */
  sourceMediaPlanId: string | null;

  /** Engagement ID for scoping */
  engagementId: string | null;

  /** Project ID for scoping */
  projectId: string | null;

  // ---------------------------------------------------------------------------
  // Staleness Detection
  // ---------------------------------------------------------------------------

  /** Context graph version at time of artifact creation */
  contextVersionAtCreation: number | null;

  /** Strategy version at time of artifact creation (for strategy_doc) */
  strategyVersionAtCreation: number | null;

  /** Is the artifact potentially stale based on context/strategy changes? */
  isStale: boolean;

  /** Reason for staleness (if isStale=true) */
  stalenessReason: string | null;

  /** Last time staleness was checked */
  stalenessCheckedAt: string | null;

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  /** User who created the artifact */
  createdBy: string | null;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp (in Hive OS, not Google) */
  updatedAt: string;

  /** User who last updated the artifact in Hive OS */
  updatedBy: string | null;

  /** Optional description/notes */
  description: string | null;

  /** Tags for organization */
  tags: string[];
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating a new artifact
 */
export interface CreateArtifactInput {
  companyId: string;
  title: string;
  type: ArtifactType;
  source: ArtifactSource;

  // Optional source linking
  sourceStrategyId?: string;
  sourceQbrStoryId?: string;
  sourceBriefId?: string;
  sourceMediaPlanId?: string;
  engagementId?: string;
  projectId?: string;

  // Optional Google Drive fields (if file already exists)
  googleFileId?: string;
  googleFileType?: GoogleFileType;
  googleFileUrl?: string;
  googleFolderId?: string;

  // Optional metadata
  description?: string;
  tags?: string[];
  createdBy?: string;

  // Version tracking for staleness
  contextVersionAtCreation?: number;
  strategyVersionAtCreation?: number;
}

/**
 * Input for updating an artifact
 */
export interface UpdateArtifactInput {
  title?: string;
  status?: ArtifactStatus;
  description?: string;
  tags?: string[];
  updatedBy?: string;

  // Google Drive updates (from sync)
  googleFileId?: string;
  googleFileType?: GoogleFileType;
  googleFileUrl?: string;
  googleFolderId?: string;
  googleModifiedAt?: string;

  // Staleness updates
  isStale?: boolean;
  stalenessReason?: string | null;
  stalenessCheckedAt?: string;
}

// ============================================================================
// Google Drive Types
// ============================================================================

/**
 * Google Drive file metadata (from Drive API)
 */
export interface GoogleDriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
  createdTime: string;
  parents?: string[];
  owners?: Array<{
    emailAddress: string;
    displayName: string;
  }>;
}

/**
 * Result of creating a Google Drive file
 */
export interface GoogleDriveCreateResult {
  success: boolean;
  fileId?: string;
  fileUrl?: string;
  fileType?: GoogleFileType;
  error?: string;
}

// ============================================================================
// Staleness Types
// ============================================================================

/**
 * Result of checking artifact staleness
 */
export interface StalenessCheckResult {
  isStale: boolean;
  reason: string | null;
  checkedAt: string;
  details?: {
    currentContextVersion?: number;
    artifactContextVersion?: number;
    currentStrategyVersion?: number;
    artifactStrategyVersion?: number;
    contextFieldsChanged?: string[];
    strategyFieldsChanged?: string[];
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map artifact type to Google file type
 */
export function getGoogleFileTypeForArtifact(artifactType: ArtifactType): GoogleFileType {
  switch (artifactType) {
    case 'strategy_doc':
    case 'brief_doc':
    case 'custom':
      return 'document';
    case 'qbr_slides':
      return 'presentation';
    case 'media_plan':
      return 'spreadsheet';
    default:
      return 'document';
  }
}

/**
 * Get human-readable label for artifact type
 */
export function getArtifactTypeLabel(type: ArtifactType): string {
  switch (type) {
    case 'strategy_doc':
      return 'Strategy Document';
    case 'qbr_slides':
      return 'QBR Slides';
    case 'brief_doc':
      return 'Brief Document';
    case 'media_plan':
      return 'Media Plan';
    case 'custom':
      return 'Custom Document';
    default:
      return 'Document';
  }
}

/**
 * Get human-readable label for artifact status
 */
export function getArtifactStatusLabel(status: ArtifactStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'published':
      return 'Published';
    case 'archived':
      return 'Archived';
    default:
      return 'Unknown';
  }
}

/**
 * Get human-readable label for artifact source
 */
export function getArtifactSourceLabel(source: ArtifactSource): string {
  switch (source) {
    case 'strategy_handoff':
      return 'Strategy Handoff';
    case 'qbr_export':
      return 'QBR Export';
    case 'brief_export':
      return 'Brief Export';
    case 'media_plan_export':
      return 'Media Plan Export';
    case 'manual':
      return 'Manual Creation';
    default:
      return 'Unknown';
  }
}

/**
 * Create an empty artifact (for initialization)
 */
export function createEmptyArtifact(companyId: string, type: ArtifactType): Partial<Artifact> {
  return {
    companyId,
    title: '',
    type,
    status: 'draft',
    source: 'manual',
    googleFileId: null,
    googleFileType: null,
    googleFileUrl: null,
    googleFolderId: null,
    googleModifiedAt: null,
    sourceStrategyId: null,
    sourceQbrStoryId: null,
    sourceBriefId: null,
    sourceMediaPlanId: null,
    engagementId: null,
    projectId: null,
    contextVersionAtCreation: null,
    strategyVersionAtCreation: null,
    isStale: false,
    stalenessReason: null,
    stalenessCheckedAt: null,
    createdBy: null,
    updatedBy: null,
    description: null,
    tags: [],
  };
}
