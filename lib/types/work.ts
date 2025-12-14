// lib/types/work.ts
// Shared Work types for work items from various sources
// This file should NOT import any server-only code (Airtable, etc.)

import type { CompanyStage } from '@/lib/types/company';

// ============================================================================
// PM-Focused Work Enums
// ============================================================================

/**
 * Work item status - PM workflow stages
 */
export type WorkStatus = 'backlog' | 'in_progress' | 'blocked' | 'in_review' | 'done';

/**
 * Work priority levels (P0 = highest)
 */
export type WorkPriority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * T-shirt sizing for effort estimation
 */
export type WorkEffort = 'S' | 'M' | 'L';

/**
 * Work category/area (lowercase slugs)
 */
export type WorkCategory = 'brand' | 'content' | 'seo' | 'website' | 'analytics' | 'demand' | 'ops' | 'other';

/**
 * Status display configuration
 */
export const WORK_STATUS_CONFIG: Record<WorkStatus, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: 'gray' },
  in_progress: { label: 'In Progress', color: 'blue' },
  blocked: { label: 'Blocked', color: 'red' },
  in_review: { label: 'In Review', color: 'yellow' },
  done: { label: 'Done', color: 'green' },
};

/**
 * Priority display configuration
 */
export const WORK_PRIORITY_CONFIG: Record<WorkPriority, { label: string; color: string }> = {
  P0: { label: 'P0 - Critical', color: 'red' },
  P1: { label: 'P1 - High', color: 'orange' },
  P2: { label: 'P2 - Medium', color: 'yellow' },
  P3: { label: 'P3 - Low', color: 'gray' },
};

/**
 * Effort display configuration
 */
export const WORK_EFFORT_CONFIG: Record<WorkEffort, { label: string; hours: string }> = {
  S: { label: 'Small', hours: '< 2 hours' },
  M: { label: 'Medium', hours: '2-8 hours' },
  L: { label: 'Large', hours: '> 8 hours' },
};

/**
 * Category display configuration
 */
export const WORK_CATEGORY_CONFIG: Record<WorkCategory, { label: string; icon: string }> = {
  brand: { label: 'Brand', icon: '🎨' },
  content: { label: 'Content', icon: '📝' },
  seo: { label: 'SEO', icon: '🔍' },
  website: { label: 'Website', icon: '🌐' },
  analytics: { label: 'Analytics', icon: '📊' },
  demand: { label: 'Demand Gen', icon: '📈' },
  ops: { label: 'Operations', icon: '⚙️' },
  other: { label: 'Other', icon: '📋' },
};

// ============================================================================
// Work Source Types
// ============================================================================

/**
 * Types of sources that can create Work items
 */
export type WorkSourceType =
  | 'manual'
  | 'analytics_metric'
  | 'gap_insight'
  | 'diagnostics'
  | 'tool_run'
  | 'priority'
  | 'plan_initiative'
  | 'client_brain_insight'
  | 'dma_funnel'
  | 'funnel_insight'
  | 'media_scorecard'
  | 'setup_wizard'
  | 'creative_lab'
  | 'program';

/**
 * Analytics metric source - when work is created from an analytics insight
 */
export interface WorkSourceAnalytics {
  sourceType: 'analytics_metric';
  companyId: string;
  metricId: string; // e.g., "ga4_sessions", "gsc_clicks"
  metricLabel: string; // Human-readable label
  metricGroup: string; // "traffic" | "seo" | "conversion" | etc.
}

/**
 * Manual source - manually created work items
 */
export interface WorkSourceManual {
  sourceType: 'manual';
}

/**
 * GAP insight source - from GAP analysis
 */
export interface WorkSourceGapInsight {
  sourceType: 'gap_insight';
  gapRunId?: string;
  insightId?: string;
}

/**
 * Diagnostics source - from diagnostic tools (legacy)
 */
export interface WorkSourceDiagnostics {
  sourceType: 'diagnostics';
  toolId: string;
  diagnosticRunId?: string;
}

/**
 * Tool Run source - from unified Tool Run system
 */
export interface WorkSourceToolRun {
  sourceType: 'tool_run';
  toolSlug: string;
  toolRunId: string;
  companyId: string;
}

/**
 * Priority source - from priority items
 */
export interface WorkSourcePriority {
  sourceType: 'priority';
  priorityId: string;
  fullReportId?: string;
}

/**
 * Plan initiative source - from plan initiatives
 */
export interface WorkSourcePlanInitiative {
  sourceType: 'plan_initiative';
  planInitiativeId: string;
  fullReportId?: string;
}

/**
 * Client Brain insight source - from Client Brain insights
 */
export interface WorkSourceClientBrainInsight {
  sourceType: 'client_brain_insight';
  insightId: string;
  insightTitle?: string;
}

/**
 * DMA funnel source - from DMA funnel insights/quick wins/blueprint
 */
export interface WorkSourceDmaFunnel {
  sourceType: 'dma_funnel';
  itemType: 'quick_win' | 'experiment' | 'blueprint_action';
  insightText?: string;
  dateRange?: string;
}

/**
 * Funnel insight source - from any funnel AI insights (DMA, Company, Workspace)
 */
export interface WorkSourceFunnelInsight {
  sourceType: 'funnel_insight';
  funnelContext: 'dma' | 'company' | 'workspace';
  companyId?: string;
  companyName?: string;
  itemType: 'quick_win' | 'experiment' | 'recommendation';
  insightText?: string;
  dateRange?: string;
}

/**
 * Media scorecard source - from Media performance scorecards
 */
export interface WorkSourceMediaScorecard {
  sourceType: 'media_scorecard';
  storeId?: string;
  marketId?: string;
  scoreType: 'visibility' | 'demand' | 'conversion';
  score: number;
  generatedAt: string;
}

/**
 * Setup wizard source - from Strategic Setup Mode
 */
export interface WorkSourceSetupWizard {
  sourceType: 'setup_wizard';
}

/**
 * Creative Lab source - from Creative Lab experiments, asset briefs, or concepts
 */
export interface WorkSourceCreativeLab {
  sourceType: 'creative_lab';
  runId?: string;
  itemType: 'experiment' | 'asset_brief' | 'campaign_concept';
  itemId?: string;
}

/**
 * Program source - when work is created from a Program
 */
export interface WorkSourceProgram {
  sourceType: 'program';
  programId: string;
  programType: 'website' | 'content';
  phaseIndex: number;
  phaseName: string;
  itemIndex: number;
}

/**
 * Union of all work source types
 */
export type WorkSource =
  | WorkSourceManual
  | WorkSourceAnalytics
  | WorkSourceGapInsight
  | WorkSourceDiagnostics
  | WorkSourceToolRun
  | WorkSourcePriority
  | WorkSourcePlanInitiative
  | WorkSourceClientBrainInsight
  | WorkSourceDmaFunnel
  | WorkSourceFunnelInsight
  | WorkSourceMediaScorecard
  | WorkSourceSetupWizard
  | WorkSourceCreativeLab
  | WorkSourceProgram;

// ============================================================================
// Work Item Types
// ============================================================================

/**
 * Work item status (legacy Airtable values)
 */
export type WorkItemStatus = 'Backlog' | 'Planned' | 'In Progress' | 'Done';

/**
 * Work item area/category (legacy Airtable values)
 */
export type WorkItemArea =
  | 'Brand'
  | 'Content'
  | 'SEO'
  | 'Website UX'
  | 'Funnel'
  | 'Analytics'
  | 'Strategy'
  | 'Operations'
  | 'Other';

/**
 * Work item severity/priority (legacy Airtable values)
 */
export type WorkItemSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

/**
 * Complete Work Item interface with PM-focused fields
 */
export interface WorkItem {
  id: string;
  title: string;
  status: WorkItemStatus;
  companyId?: string;
  companyName?: string;
  companyStage?: CompanyStage;
  area?: WorkItemArea;
  severity?: WorkItemSeverity;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  aiAdditionalInfo?: string; // Long-form "how to implement" guide
  source?: WorkSource; // Where this work item came from
  priorityId?: string;
  planInitiativeId?: string;
  fullReportId?: string;

  // PM-focused fields
  priority?: WorkPriority; // P0-P3 priority level
  ownerName?: string; // Owner display name
  dueDate?: string; // ISO date string
  lastTouchedAt?: string; // ISO datetime - last activity
  effort?: WorkEffort | string; // S/M/L effort estimate (or free text from Airtable)
  impact?: 'high' | 'medium' | 'low' | string; // Expected impact
  category?: WorkCategory; // Normalized category slug
}

/**
 * Map legacy WorkItemArea to WorkCategory
 */
export function areaToCategory(area?: WorkItemArea): WorkCategory {
  if (!area) return 'other';
  const mapping: Record<WorkItemArea, WorkCategory> = {
    'Brand': 'brand',
    'Content': 'content',
    'SEO': 'seo',
    'Website UX': 'website',
    'Funnel': 'analytics',
    'Analytics': 'analytics',
    'Strategy': 'ops',
    'Operations': 'ops',
    'Other': 'other',
  };
  return mapping[area] || 'other';
}

/**
 * Map legacy WorkItemSeverity to WorkPriority
 */
export function severityToPriority(severity?: WorkItemSeverity): WorkPriority {
  if (!severity) return 'P2';
  const mapping: Record<WorkItemSeverity, WorkPriority> = {
    'Critical': 'P0',
    'High': 'P1',
    'Medium': 'P2',
    'Low': 'P3',
    'Info': 'P3',
  };
  return mapping[severity] || 'P2';
}

/**
 * Map legacy WorkItemStatus to WorkStatus
 */
export function statusToWorkStatus(status?: WorkItemStatus): WorkStatus {
  if (!status) return 'backlog';
  const mapping: Record<WorkItemStatus, WorkStatus> = {
    'Backlog': 'backlog',
    'Planned': 'backlog',
    'In Progress': 'in_progress',
    'Done': 'done',
  };
  return mapping[status] || 'backlog';
}

// ============================================================================
// AI Suggestion Types
// ============================================================================

/**
 * AI-generated work suggestion from a metric
 */
export interface MetricWorkSuggestion {
  /** Short title for the work item (6-10 words) */
  title: string;
  /** High-level description of the problem/opportunity (2-3 sentences) */
  summary: string;
  /** Detailed, step-by-step implementation guide */
  howToImplement: string;
  /** Description of expected impact */
  expectedImpact: string;
  /** Suggested status (defaults to "Backlog") */
  suggestedStatus?: WorkItemStatus;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a work source is from analytics
 */
export function isAnalyticsSource(source?: WorkSource): source is WorkSourceAnalytics {
  return source?.sourceType === 'analytics_metric';
}

/**
 * Get a human-readable source label
 */
export function getSourceLabel(source?: WorkSource): string {
  if (!source) return 'Manual';

  switch (source.sourceType) {
    case 'manual':
      return 'Manual';
    case 'analytics_metric':
      return `Analytics → ${source.metricLabel}`;
    case 'gap_insight':
      return 'GAP Insight';
    case 'diagnostics':
      return `Diagnostics (${source.toolId})`;
    case 'tool_run':
      return `Tool Run → ${source.toolSlug}`;
    case 'priority':
      return 'Priority';
    case 'plan_initiative':
      return 'Plan Initiative';
    case 'client_brain_insight':
      return `Client Brain → ${source.insightTitle || 'Insight'}`;
    case 'dma_funnel':
      return `DMA Funnel → ${source.itemType.replace('_', ' ')}`;
    case 'funnel_insight':
      return `${source.funnelContext.charAt(0).toUpperCase() + source.funnelContext.slice(1)} Funnel → ${source.itemType.replace('_', ' ')}`;
    case 'media_scorecard':
      return `Media Scorecard → ${source.scoreType}`;
    case 'setup_wizard':
      return 'Strategic Setup';
    case 'creative_lab':
      return `Creative Lab → ${source.itemType.replace('_', ' ')}`;
    default:
      return 'Unknown';
  }
}

/**
 * Check if a work source is from a tool run
 */
export function isToolRunSource(source?: WorkSource): source is WorkSourceToolRun {
  return source?.sourceType === 'tool_run';
}
