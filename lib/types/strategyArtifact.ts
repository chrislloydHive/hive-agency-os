// lib/types/strategyArtifact.ts
// Strategy Artifact types for Strategy Workspace V4
//
// Artifacts are working documents created during strategy development.
// They can be promoted to become part of the Canonical Strategy.

// ============================================================================
// Artifact Types
// ============================================================================

/**
 * Types of strategy artifacts that can be created
 */
export type StrategyArtifactType =
  | 'draft_strategy'   // Full draft strategy document
  | 'growth_option'    // Specific growth opportunity
  | 'channel_plan'     // Channel-specific plan
  | 'assumptions'      // Key assumptions document
  | 'risk_analysis'    // Risk assessment
  | 'synthesis';       // Synthesized insights from multiple sources

/**
 * Artifact lifecycle status
 */
export type StrategyArtifactStatus =
  | 'draft'      // Initial creation, being worked on
  | 'explored'   // Has been reviewed/explored
  | 'discarded'  // Explicitly rejected
  | 'candidate'  // Under consideration for promotion
  | 'promoted';  // Promoted to canonical strategy

/**
 * Source of the artifact
 */
export type StrategyArtifactSource = 'human' | 'ai_tool';

/**
 * How the artifact was generated (for AI artifacts)
 */
export type ArtifactGenerationType = 'ai_prefill' | 'ai_regenerate' | 'ai_tool';

/**
 * Metadata about AI generation inputs
 */
export interface ArtifactGenerationInputs {
  contextRevisionId?: string;
  competitionSource?: 'v3' | 'v4' | null;
  hiveBrainVersion?: string;
  artifactIdsUsed?: string[];
}

// ============================================================================
// Core Artifact Interface
// ============================================================================

/**
 * A strategy artifact - a working document in the strategy development process
 */
export interface StrategyArtifact {
  id: string;
  companyId: string;

  // Content
  type: StrategyArtifactType;
  title: string;
  content: string; // Markdown supported

  // Lifecycle
  status: StrategyArtifactStatus;
  source: StrategyArtifactSource;

  // Traceability - which context/data was used to create this
  linkedContextRevisionId?: string;
  linkedCompetitionSource?: 'v3' | 'v4' | null;

  // Relationships - artifacts can reference other artifacts
  linkedArtifactIds: string[];

  // If promoted, which canonical strategy element did this become?
  promotedToStrategyId?: string;
  promotedToPillarId?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  promotedAt?: string;
  promotedBy?: string;

  // AI Generation metadata (for source === 'ai_tool')
  generatedBy?: ArtifactGenerationType;
  generatedAt?: string;
  generationInputs?: ArtifactGenerationInputs;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Request to create a new artifact
 */
export interface CreateArtifactRequest {
  companyId: string;
  type: StrategyArtifactType;
  title: string;
  content: string;
  source: StrategyArtifactSource;
  linkedContextRevisionId?: string;
  linkedCompetitionSource?: 'v3' | 'v4' | null;
  linkedArtifactIds?: string[];
}

/**
 * Request to update an artifact
 */
export interface UpdateArtifactRequest {
  artifactId: string;
  updates: Partial<Pick<StrategyArtifact,
    | 'title'
    | 'content'
    | 'status'
    | 'linkedArtifactIds'
  >>;
}

/**
 * Request to promote an artifact to canonical strategy
 */
export interface PromoteArtifactRequest {
  artifactId: string;
  targetStrategyId?: string; // If promoting to existing strategy
  targetPillarId?: string;   // If promoting as a pillar
}

// ============================================================================
// View Models
// ============================================================================

/**
 * Lightweight artifact summary for lists
 */
export interface ArtifactSummary {
  id: string;
  type: StrategyArtifactType;
  title: string;
  status: StrategyArtifactStatus;
  source: StrategyArtifactSource;
  updatedAt: string;
  linkedArtifactCount: number;
}

/**
 * Convert full artifact to summary
 */
export function toArtifactSummary(artifact: StrategyArtifact): ArtifactSummary {
  return {
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
    status: artifact.status,
    source: artifact.source,
    updatedAt: artifact.updatedAt,
    linkedArtifactCount: artifact.linkedArtifactIds.length,
  };
}

// ============================================================================
// Type Labels
// ============================================================================

export const ARTIFACT_TYPE_LABELS: Record<StrategyArtifactType, string> = {
  draft_strategy: 'Draft Strategy',
  growth_option: 'Growth Option',
  channel_plan: 'Channel Plan',
  assumptions: 'Assumptions',
  risk_analysis: 'Risk Analysis',
  synthesis: 'Synthesis',
};

export const ARTIFACT_STATUS_LABELS: Record<StrategyArtifactStatus, string> = {
  draft: 'Draft',
  explored: 'Explored',
  discarded: 'Discarded',
  candidate: 'Candidate',
  promoted: 'Promoted',
};

export const ARTIFACT_SOURCE_LABELS: Record<StrategyArtifactSource, string> = {
  human: 'Human',
  ai_tool: 'AI Generated',
};

/**
 * Artifact status colors (Tailwind classes)
 */
export const ARTIFACT_STATUS_COLORS: Record<StrategyArtifactStatus, string> = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  explored: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  discarded: 'bg-red-500/10 text-red-400 border-red-500/30',
  candidate: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  promoted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

// ============================================================================
// Promotion Types
// ============================================================================

/**
 * Request to promote artifacts to canonical strategy
 */
export interface PromoteToCanonicalRequest {
  companyId: string;
  artifactIds: string[]; // At least one required
  title: string;
  summary?: string;
}

/**
 * Response from promotion
 */
export interface PromoteToCanonicalResponse {
  strategyId: string;
  promotedArtifactIds: string[];
  archivedPreviousStrategyId?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique artifact ID
 */
export function generateArtifactId(): string {
  return `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if artifact can be promoted
 */
export function canPromoteArtifact(artifact: StrategyArtifact): boolean {
  return artifact.status !== 'promoted' && artifact.status !== 'discarded';
}

/**
 * Check if artifact can be edited
 */
export function canEditArtifact(artifact: StrategyArtifact): boolean {
  return artifact.status !== 'promoted';
}
