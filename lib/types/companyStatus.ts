// lib/types/companyStatus.ts
// Company Status types for the Status View feature
//
// This module defines types for the company status summary that powers
// the Status View on the Company Overview page.

import type { PipelineLeadStage } from './pipeline';

/**
 * Company lifecycle stage - represents where the company is in the relationship
 */
export type CompanyLifecycleStage =
  | 'lead'
  | 'qualified'
  | 'meeting_scheduled'
  | 'proposal'
  | 'active_client'
  | 'dormant'
  | 'lost';

/**
 * Overall company status indicator
 */
export type CompanyOverallStatus = 'red' | 'yellow' | 'green';

/**
 * Media program health indicator
 */
export type MediaProgramHealth = 'good' | 'neutral' | 'at_risk';

/**
 * Full Workup checklist state
 */
export interface WorkupChecklist {
  qbrReviewed?: boolean;
  mediaLabReviewed?: boolean;
  seoLabReviewed?: boolean;
  competitionLabReviewed?: boolean;
  workPlanDrafted?: boolean;
}

/**
 * Company Status Summary - computed model for the Status View
 */
export interface CompanyStatusSummary {
  companyId: string;

  // =========================================================================
  // Commercial / Pipeline
  // =========================================================================

  /** Current lifecycle stage */
  lifecycleStage: CompanyLifecycleStage;

  /** Pipeline stage if from pipeline (reuses existing PipelineLeadStage) */
  pipelineStage?: PipelineLeadStage | null;

  /** Lead source (e.g., "DMA Full GAP", "Site Contact") */
  leadSource?: string | null;

  /** Lead ID if applicable */
  leadId?: string | null;

  /** Owner/assignee user ID or name */
  ownerUserId?: string | null;

  // =========================================================================
  // Diagnostic / GAP
  // =========================================================================

  /** Latest GAP score (0-100) */
  gapScore?: number | null;

  /** GAP maturity stage */
  gapMaturity?: string | null;

  /** When the last GAP run was completed (ISO) */
  lastGapRunAt?: string | null;

  /** GAP run ID for linking */
  lastGapRunId?: string | null;

  // =========================================================================
  // Issue Signals
  // =========================================================================

  /** Number of high/critical severity issues */
  highSeverityIssuesCount?: number;

  /** Total issues count */
  totalIssuesCount?: number;

  // =========================================================================
  // Media / Program Status
  // =========================================================================

  /** Whether the company has an active media program */
  mediaProgramActive?: boolean;

  /** Media program health indicator */
  mediaProgramHealth?: MediaProgramHealth;

  // =========================================================================
  // Workup Checklist
  // =========================================================================

  /** Full Workup checklist state (reuses existing fields) */
  checklist?: WorkupChecklist;

  /** Number of checklist items completed */
  checklistCompleted?: number;

  /** Total number of checklist items */
  checklistTotal?: number;

  // =========================================================================
  // Overall Status
  // =========================================================================

  /** Computed overall status (red/yellow/green) */
  overallStatus: CompanyOverallStatus;

  /** Short explanation for the status */
  overallStatusReason?: string;

  // =========================================================================
  // Meta
  // =========================================================================

  /** When this summary was computed (ISO) */
  updatedAt: string;
}

/**
 * Get display label for lifecycle stage
 */
export function getLifecycleStageLabel(stage: CompanyLifecycleStage): string {
  const labels: Record<CompanyLifecycleStage, string> = {
    lead: 'Lead',
    qualified: 'Qualified Lead',
    meeting_scheduled: 'Meeting Scheduled',
    proposal: 'Proposal',
    active_client: 'Active Client',
    dormant: 'Dormant',
    lost: 'Lost',
  };
  return labels[stage] || 'Unknown';
}

/**
 * Get color classes for lifecycle stage
 */
export function getLifecycleStageColorClasses(stage: CompanyLifecycleStage): string {
  const colors: Record<CompanyLifecycleStage, string> = {
    lead: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    qualified: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    meeting_scheduled: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    proposal: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    active_client: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    dormant: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    lost: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return colors[stage] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}

/**
 * Get display label for overall status
 */
export function getOverallStatusLabel(status: CompanyOverallStatus): string {
  const labels: Record<CompanyOverallStatus, string> = {
    green: 'In Good Shape',
    yellow: 'Mixed',
    red: 'Needs Attention',
  };
  return labels[status] || 'Unknown';
}

/**
 * Get color classes for overall status
 */
export function getOverallStatusColorClasses(status: CompanyOverallStatus): string {
  const colors: Record<CompanyOverallStatus, string> = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    yellow: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return colors[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}
