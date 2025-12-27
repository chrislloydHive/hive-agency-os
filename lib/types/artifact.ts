// lib/types/artifact.ts
// Workspace Artifacts - First-class document artifacts with Google Drive integration
//
// Design principle: Artifacts are the tangible outputs of Hive OS work.
// They live in Google Drive but are tracked and managed in Airtable.

// ============================================================================
// Usage & Feedback Types
// ============================================================================

/**
 * Usage metadata for artifact impact tracking
 * Automatically updated when artifacts are attached/detached from work items
 */
export interface ArtifactUsage {
  /** Number of work items this artifact is currently attached to */
  attachedWorkCount: number;
  /** First time this artifact was attached to any work item */
  firstAttachedAt: string | null;
  /** Most recent time this artifact was attached to a work item */
  lastAttachedAt: string | null;
  /** Number of attached work items that have been completed */
  completedWorkCount: number;
}

/**
 * Reference to the last entity that referenced this artifact
 */
export interface ArtifactReference {
  type: 'work';
  id: string;
  at: string;
}

/**
 * Feedback rating options
 */
export type ArtifactFeedbackRating = 'helpful' | 'neutral' | 'not_helpful';

/**
 * A single feedback entry from a user
 */
export interface ArtifactFeedbackEntry {
  /** Rating given by the user */
  rating: ArtifactFeedbackRating;
  /** Optional comment from the user */
  comment?: string;
  /** When the feedback was submitted */
  submittedAt: string;
  /** Who submitted the feedback (user ID or session ID) */
  submittedBy?: string;
}

// ============================================================================
// Core Types
// ============================================================================

/**
 * Type of artifact - determines template and behavior
 * Note: Generated artifacts use registry IDs (e.g., 'creative_brief', 'media_brief')
 */
export type ArtifactType =
  | 'strategy_doc'      // Strategy document (Google Docs)
  | 'qbr_slides'        // QBR presentation (Google Slides)
  | 'brief_doc'         // Brief document (Google Docs)
  | 'media_plan'        // Media plan spreadsheet (Google Sheets)
  | 'rfp_response_doc'  // RFP Response document (Google Docs)
  | 'proposal_slides'   // Proposal presentation (Google Slides)
  | 'pricing_sheet'     // Pricing spreadsheet (Google Sheets)
  | 'custom'            // Custom artifact type
  // Generated artifact types (from registry)
  | 'creative_brief'
  | 'media_brief'
  | 'content_brief'
  | 'campaign_brief'
  | 'seo_brief'
  | 'strategy_summary'
  | 'stakeholder_summary'
  | 'acquisition_plan_summary'
  | 'execution_playbook'
  | 'experiment_roadmap'
  | 'channel_analysis'
  | 'competitive_positioning';

/**
 * Lifecycle status of the artifact
 * Transitions: draft → final → archived (or draft → archived)
 */
export type ArtifactStatus =
  | 'draft'      // Being edited, not yet shared
  | 'final'      // Finalized and shared (immutable)
  | 'archived';  // No longer active (immutable)

/**
 * How the artifact was created - determines source linking
 */
export type ArtifactSource =
  | 'strategy_handoff'  // Created from strategy completion
  | 'qbr_export'        // Created from QBR story export
  | 'brief_export'      // Created from brief export
  | 'media_plan_export' // Created from media plan export
  | 'rfp_export'        // Created from RFP/proposal workflow
  | 'ai_generated'      // Created by AI artifact generator
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

  /** Snapshot ID at time of artifact creation (for RFP artifacts) */
  snapshotId: string | null;

  /** Is the artifact potentially stale based on context/strategy changes? */
  isStale: boolean;

  /** Reason for staleness (if isStale=true) */
  stalenessReason: string | null;

  /** Last time staleness was checked */
  stalenessCheckedAt: string | null;

  /** Last time the artifact was synced/updated with context */
  lastSyncedAt: string | null;

  // ---------------------------------------------------------------------------
  // Generated Content (for AI-generated artifacts)
  // ---------------------------------------------------------------------------

  /** Generated content as JSON (structured or hybrid format) */
  generatedContent: unknown | null;

  /** Generated content as markdown (for markdown format) */
  generatedMarkdown: string | null;

  /** Output format of generated content */
  generatedFormat: 'structured' | 'markdown' | 'hybrid' | null;

  /** Hash of inputs used for generation (for staleness detection) */
  inputsUsedHash: string | null;

  /** Tactic IDs included in generation */
  includedTacticIds: string[] | null;

  /** Content plan ID if generated from content plan */
  sourceContentPlanId: string | null;

  // ---------------------------------------------------------------------------
  // Lifecycle Timestamps
  // ---------------------------------------------------------------------------

  /** When the artifact was finalized (status changed to 'final') */
  finalizedAt: string | null;

  /** User who finalized the artifact */
  finalizedBy: string | null;

  /** When the artifact was archived (status changed to 'archived') */
  archivedAt: string | null;

  /** User who archived the artifact */
  archivedBy: string | null;

  /** Reason for archiving (optional) */
  archivedReason: string | null;

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

  /** Last time content was edited (for edit tracking) */
  lastEditedAt: string | null;

  /** User who last edited the content */
  lastEditedBy: string | null;

  /** Optional description/notes */
  description: string | null;

  /** Tags for organization */
  tags: string[];

  // ---------------------------------------------------------------------------
  // Usage & Impact Tracking
  // ---------------------------------------------------------------------------

  /** Usage metadata (work item attachments, completions) */
  usage: ArtifactUsage;

  /** Last time the artifact was viewed */
  lastViewedAt: string | null;

  /** Last entity that referenced this artifact */
  lastReferencedBy: ArtifactReference | null;

  // ---------------------------------------------------------------------------
  // Feedback
  // ---------------------------------------------------------------------------

  /** User feedback entries */
  feedback: ArtifactFeedbackEntry[];
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
  sourceContentPlanId?: string;
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
  snapshotId?: string;
  lastSyncedAt?: string;

  // Generated content (for AI-generated artifacts)
  generatedContent?: unknown;
  generatedMarkdown?: string;
  generatedFormat?: 'structured' | 'markdown' | 'hybrid';
  inputsUsedHash?: string;
  includedTacticIds?: string[];
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
  snapshotId?: string;
  lastSyncedAt?: string;

  // Lifecycle updates
  finalizedAt?: string;
  finalizedBy?: string;
  archivedAt?: string;
  archivedBy?: string;
  archivedReason?: string | null;
  lastEditedAt?: string;
  lastEditedBy?: string;

  // Generated content updates
  generatedContent?: unknown;
  generatedMarkdown?: string;
  generatedFormat?: 'structured' | 'markdown' | 'hybrid';
  inputsUsedHash?: string;
  includedTacticIds?: string[];

  // Usage tracking updates (metadata only, never mutates content)
  usage?: Partial<ArtifactUsage>;
  lastViewedAt?: string;
  lastReferencedBy?: ArtifactReference | null;

  // Feedback updates
  feedback?: ArtifactFeedbackEntry[];
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
    // RFP artifact staleness details
    artifactSnapshotId?: string;
    latestSnapshotId?: string;
    lastSyncedAt?: string;
    latestSnapshotCreatedAt?: string;
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
    case 'rfp_response_doc':
    case 'custom':
      return 'document';
    case 'qbr_slides':
    case 'proposal_slides':
      return 'presentation';
    case 'media_plan':
    case 'pricing_sheet':
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
    case 'rfp_response_doc':
      return 'RFP Response';
    case 'proposal_slides':
      return 'Proposal Slides';
    case 'pricing_sheet':
      return 'Pricing Sheet';
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
    case 'final':
      return 'Final';
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
    case 'rfp_export':
      return 'RFP Export';
    case 'ai_generated':
      return 'AI Generated';
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
    sourceContentPlanId: null,
    engagementId: null,
    projectId: null,
    contextVersionAtCreation: null,
    strategyVersionAtCreation: null,
    snapshotId: null,
    isStale: false,
    stalenessReason: null,
    stalenessCheckedAt: null,
    lastSyncedAt: null,
    generatedContent: null,
    generatedMarkdown: null,
    generatedFormat: null,
    inputsUsedHash: null,
    includedTacticIds: null,
    finalizedAt: null,
    finalizedBy: null,
    archivedAt: null,
    archivedBy: null,
    archivedReason: null,
    createdBy: null,
    updatedBy: null,
    lastEditedAt: null,
    lastEditedBy: null,
    description: null,
    tags: [],
    // Usage tracking defaults
    usage: {
      attachedWorkCount: 0,
      firstAttachedAt: null,
      lastAttachedAt: null,
      completedWorkCount: 0,
    },
    lastViewedAt: null,
    lastReferencedBy: null,
    // Feedback defaults
    feedback: [],
  };
}

/**
 * Create default usage metadata
 */
export function createDefaultUsage(): ArtifactUsage {
  return {
    attachedWorkCount: 0,
    firstAttachedAt: null,
    lastAttachedAt: null,
    completedWorkCount: 0,
  };
}
