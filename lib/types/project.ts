// lib/types/project.ts
// Project types for project-scoped strategy work
//
// Projects represent specific deliverables within an engagement:
// - Each project has a type (print_ad, website, campaign, etc.)
// - Projects flow: GAP → Project Strategy → Creative Brief → Work Items
// - After brief approval, strategy is locked and brief becomes canonical

// Import and re-export ProjectType from engagement to maintain single source of truth
import { PROJECT_TYPE_CONFIG } from './engagement';
import type { ProjectType } from './engagement';
export type { ProjectType };

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project lifecycle status
 */
export type ProjectStatus =
  | 'draft'              // Initial setup, needs GAP
  | 'in_progress'        // Active work
  | 'delivered'          // Deliverables complete
  | 'archived';          // Archived

/**
 * Project entity
 */
export interface Project {
  id: string;
  companyId: string;
  engagementId: string;        // Required link to Engagement

  // Identity
  name: string;
  type: ProjectType;
  description?: string;

  // Status
  status: ProjectStatus;

  // Readiness gates
  gapReportId?: string;        // Required GAP report reference
  gapReady: boolean;           // Full GAP completed
  gapScore?: number;           // Score from GAP

  // Strategy link
  projectStrategyId?: string;
  hasAcceptedBets: boolean;    // At least 1 accepted bet

  // Brief link
  creativeBriefId?: string;
  briefApproved: boolean;
  briefApprovedAt?: string;
  briefApprovedBy?: string;

  // Lock state
  isLocked: boolean;           // Locked after brief approval
  lockedAt?: string;
  lockedReason?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Create project request
 */
export interface CreateProjectInput {
  companyId: string;
  engagementId: string;
  name: string;
  type: ProjectType;
  description?: string;
}

/**
 * Project list item for display
 */
export interface ProjectListItem {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  engagementId: string;
  engagementName?: string;
  gapReady: boolean;
  hasAcceptedBets: boolean;
  briefApproved: boolean;
  isLocked: boolean;
  updatedAt: string;
}

/**
 * Project readiness state for UI gating
 */
export interface ProjectReadiness {
  gapComplete: boolean;
  gapReportId?: string;
  gapScore?: number;
  strategyExists: boolean;
  frameComplete: boolean;
  hasObjectives: boolean;
  hasAcceptedBets: boolean;
  canGenerateBrief: boolean;
  briefExists: boolean;
  briefApproved: boolean;
  blockedReason?: string;
}

// ============================================================================
// Display Constants
// ============================================================================

// Derive labels and descriptions from PROJECT_TYPE_CONFIG
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = Object.fromEntries(
  Object.entries(PROJECT_TYPE_CONFIG).map(([key, config]) => [key, config.label])
) as Record<ProjectType, string>;

export const PROJECT_TYPE_DESCRIPTIONS: Record<ProjectType, string> = Object.fromEntries(
  Object.entries(PROJECT_TYPE_CONFIG).map(([key, config]) => [key, config.description])
) as Record<ProjectType, string>;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  archived: 'Archived',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  archived: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

// Derive icons from PROJECT_TYPE_CONFIG
export const PROJECT_TYPE_ICONS: Record<ProjectType, string> = Object.fromEntries(
  Object.entries(PROJECT_TYPE_CONFIG).map(([key, config]) => [key, config.icon])
) as Record<ProjectType, string>;
