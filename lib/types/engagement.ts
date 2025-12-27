// lib/types/engagement.ts
// Company Engagement Types - Two-Path Model
//
// Engagements represent a company's current focus mode:
// - strategy: Full business transformation (Strategy -> Blueprint -> Programs -> Work)
// - project: Scoped delivery (Project Definition -> Tactics -> Project Work)
//
// Both paths REQUIRE Full GAP. No engagement can bypass context gathering.

import type { LabId } from '@/lib/contextGraph/labContext';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Engagement type - determines the primary path and workflow
 */
export type EngagementType = 'strategy' | 'project';

/**
 * Project type for project engagements
 * Note: print_ad is the MVP project type for Creative Brief workflow
 */
export type ProjectType = 'print_ad' | 'website' | 'campaign' | 'content' | 'other';

/**
 * Engagement status lifecycle
 */
export type EngagementStatus =
  | 'draft'              // Created but labs not started
  | 'context_gathering'  // GAP/Labs running
  | 'context_approved'   // Context reviewed and approved
  | 'in_progress'        // Active work underway
  | 'completed';         // Engagement finished

/**
 * Company Engagement entity
 * Persisted to Airtable COMPANY_ENGAGEMENTS table
 */
export interface CompanyEngagement {
  id: string;
  companyId: string;

  // Path selection
  type: EngagementType;
  projectType?: ProjectType;  // Only set when type === 'project'
  projectName?: string;       // Optional custom project name

  // Labs configuration
  selectedLabs: LabId[];      // All labs selected (required + optional)
  requiredLabs: LabId[];      // Auto-selected based on engagement type
  optionalLabs: LabId[];      // User-selected additional labs

  // Status
  status: EngagementStatus;
  gapRunId?: string;          // ID of the Full GAP run
  labsCompletedAt?: string;   // When labs/GAP finished running
  contextApprovedAt?: string;

  // Routing
  targetRoute: string;        // Where to route after context approval

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Input for creating a new engagement
 */
export interface CreateEngagementInput {
  companyId: string;
  type: EngagementType;
  projectType?: ProjectType;
  projectName?: string;
  selectedLabs?: LabId[];
}

/**
 * Input for updating an engagement
 */
export interface UpdateEngagementInput {
  type?: EngagementType;
  projectType?: ProjectType;
  projectName?: string;
  selectedLabs?: LabId[];
  status?: EngagementStatus;
  gapRunId?: string;
  labsCompletedAt?: string;
  contextApprovedAt?: string;
}

// ============================================================================
// Display Configuration
// ============================================================================

export interface EngagementTypeDisplayConfig {
  label: string;
  description: string;
  detailedDescription: string;
  icon: string;  // Lucide icon name
  color: string; // Tailwind color prefix (e.g., 'purple', 'blue')
  badge: string;
  targetRoute: (companyId: string) => string;
}

export const ENGAGEMENT_TYPE_CONFIG: Record<EngagementType, EngagementTypeDisplayConfig> = {
  strategy: {
    label: 'Grow the Business',
    description: 'Solve business-level growth or performance problems',
    detailedDescription: 'Full strategic transformation with objectives, strategic bets, and programs. Best for when you need to rethink how you go to market.',
    icon: 'TrendingUp',
    color: 'purple',
    badge: 'Strategy-led',
    targetRoute: (companyId) => `/c/${companyId}/strategy`,
  },
  project: {
    label: 'Deliver a Project',
    description: 'Create a specific asset or initiative',
    detailedDescription: 'Scoped delivery focused on a single deliverable. Best for when you know what you need to build.',
    icon: 'Briefcase',
    color: 'blue',
    badge: 'Project-led',
    // TODO: Route to /projects/new when project workflow is built
    targetRoute: (companyId) => `/c/${companyId}/strategy`,
  },
};

export interface ProjectTypeDisplayConfig {
  label: string;
  description: string;
  icon: string;  // Lucide icon name
  suggestedLabs: LabId[];
}

export const PROJECT_TYPE_CONFIG: Record<ProjectType, ProjectTypeDisplayConfig> = {
  print_ad: {
    label: 'Print Ad',
    description: 'Print advertisement with creative brief',
    icon: 'Newspaper',
    suggestedLabs: ['brand', 'audience', 'creative'],
  },
  website: {
    label: 'Website',
    description: 'New site, redesign, or major overhaul',
    icon: 'Globe',
    suggestedLabs: ['website', 'ux', 'content', 'seo'],
  },
  campaign: {
    label: 'Campaign',
    description: 'Marketing campaign or launch initiative',
    icon: 'Megaphone',
    suggestedLabs: ['media', 'creative', 'audience', 'demand'],
  },
  content: {
    label: 'Content',
    description: 'Content strategy or production project',
    icon: 'FileText',
    suggestedLabs: ['content', 'seo', 'brand'],
  },
  other: {
    label: 'Other',
    description: 'Custom project type',
    icon: 'Layers',
    suggestedLabs: [],
  },
};

// ============================================================================
// Labs Configuration by Engagement Type
// ============================================================================

/**
 * Labs that are ALWAYS required for an engagement type
 * Full GAP is the orchestrator - brand and audience are always run
 */
export const REQUIRED_LABS_BY_TYPE: Record<EngagementType, LabId[]> = {
  strategy: ['brand', 'audience'],
  project: [],  // Only Full GAP core, specific labs from project type
};

/**
 * Labs that are AI-suggested based on engagement type
 */
export const SUGGESTED_LABS_BY_TYPE: Record<EngagementType, LabId[]> = {
  strategy: ['competitor', 'content', 'website', 'seo'],
  project: [],  // Suggestions come from project type
};

/**
 * All available labs for manual selection
 */
export const ALL_AVAILABLE_LABS: LabId[] = [
  'brand',
  'audience',
  'website',
  'seo',
  'content',
  'creative',
  'media',
  'demand',
  'ux',
  'ops',
  'competitor',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate engagement ID
 */
export function generateEngagementId(): string {
  return `eng_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get required labs for a new engagement
 */
export function getRequiredLabs(type: EngagementType): LabId[] {
  return REQUIRED_LABS_BY_TYPE[type];
}

/**
 * Get suggested labs for a new engagement based on type and project type
 */
export function getSuggestedLabs(type: EngagementType, projectType?: ProjectType): LabId[] {
  if (type === 'project' && projectType) {
    return PROJECT_TYPE_CONFIG[projectType].suggestedLabs;
  }
  return SUGGESTED_LABS_BY_TYPE[type];
}

/**
 * Get all labs for an engagement (required + selected)
 */
export function getEngagementLabs(engagement: CompanyEngagement): LabId[] {
  return [...new Set([...engagement.requiredLabs, ...engagement.selectedLabs])];
}

/**
 * Compute target route based on engagement type and project type
 */
export function computeTargetRoute(
  companyId: string,
  type: EngagementType,
  projectType?: ProjectType
): string {
  if (type === 'project' && projectType) {
    return `/c/${companyId}/projects/new?type=${projectType}`;
  }
  return ENGAGEMENT_TYPE_CONFIG[type].targetRoute(companyId);
}

/**
 * Create a new engagement with defaults
 */
export function createEngagementDefaults(input: CreateEngagementInput): CompanyEngagement {
  const now = new Date().toISOString();
  const requiredLabs = getRequiredLabs(input.type);
  const suggestedLabs = getSuggestedLabs(input.type, input.projectType);

  // Combine required labs with any user-selected labs
  const allSelectedLabs = [
    ...requiredLabs,
    ...(input.selectedLabs ?? suggestedLabs),
  ];

  return {
    id: generateEngagementId(),
    companyId: input.companyId,
    type: input.type,
    projectType: input.projectType,
    projectName: input.projectName,
    selectedLabs: [...new Set(allSelectedLabs)],
    requiredLabs,
    optionalLabs: allSelectedLabs.filter(lab => !requiredLabs.includes(lab)),
    status: 'draft',
    targetRoute: computeTargetRoute(input.companyId, input.type, input.projectType),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Check if an engagement can transition to a new status
 */
export function canTransitionStatus(
  currentStatus: EngagementStatus,
  newStatus: EngagementStatus
): boolean {
  const transitions: Record<EngagementStatus, EngagementStatus[]> = {
    draft: ['context_gathering'],
    context_gathering: ['context_approved', 'draft'],  // Can cancel back to draft
    context_approved: ['in_progress', 'draft'],        // Can reset if needed
    in_progress: ['completed', 'context_approved'],    // Can go back if needed
    completed: ['in_progress'],                         // Can reopen
  };

  return transitions[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Get display label for engagement status
 */
export function getStatusLabel(status: EngagementStatus): string {
  const labels: Record<EngagementStatus, string> = {
    draft: 'Draft',
    context_gathering: 'Gathering Context',
    context_approved: 'Inputs Confirmed',
    in_progress: 'In Progress',
    completed: 'Completed',
  };
  return labels[status];
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: EngagementStatus): string {
  const colors: Record<EngagementStatus, string> = {
    draft: 'slate',
    context_gathering: 'amber',
    context_approved: 'emerald',
    in_progress: 'blue',
    completed: 'purple',
  };
  return colors[status];
}

// ============================================================================
// Project Start Mode (Universal Decision Point)
// ============================================================================
//
// All project types share a single decision:
// - use_existing: Start immediately with current context (default)
// - refresh_context: Re-run labs before starting
//
// This replaces per-project hacks and ensures projects are execution-first.

/**
 * Universal project start mode - determines whether to use existing context or refresh
 */
export type ProjectStartMode = 'use_existing' | 'refresh_context';

/**
 * Flow type identifier for readiness checks
 */
export type ProjectFlowType =
  | 'website_optimization'
  | 'website_new'
  | 'content_project'
  | 'campaign'
  | 'print_ad'
  | 'custom';

/**
 * Configuration for each project type's execution flow
 */
export interface ProjectFlowConfig {
  /** Internal flow type identifier */
  flowType: ProjectFlowType;
  /** Context domains required for this flow (for readiness checks) */
  requiredDomains: string[];
  /** Labs recommended if user chooses to refresh context */
  recommendedLabs: LabId[];
  /** Route for direct execution (use_existing path) */
  executionRoute: (companyId: string) => string;
}

/**
 * Central configuration for all project types
 * Single source of truth for readiness checks and lab preselection
 */
export const PROJECT_FLOW_CONFIG: Record<ProjectType, ProjectFlowConfig> = {
  website: {
    flowType: 'website_optimization',
    requiredDomains: ['website', 'brand', 'audience'],
    recommendedLabs: ['website', 'seo', 'content', 'ux'],
    executionRoute: (companyId) => `/c/${companyId}/projects/website-optimize/setup`,
  },
  content: {
    flowType: 'content_project',
    requiredDomains: ['content', 'brand', 'audience'],
    recommendedLabs: ['content', 'seo', 'brand'],
    executionRoute: (companyId) => `/c/${companyId}/projects/new?type=content`,
  },
  campaign: {
    flowType: 'campaign',
    requiredDomains: ['audience', 'brand'],
    recommendedLabs: ['demand', 'audience', 'media'],
    executionRoute: (companyId) => `/c/${companyId}/projects/new?type=campaign`,
  },
  print_ad: {
    flowType: 'print_ad',
    requiredDomains: ['brand', 'audience'],
    recommendedLabs: ['brand', 'audience', 'creative'],
    executionRoute: (companyId) => `/c/${companyId}/projects/new?type=print_ad`,
  },
  other: {
    flowType: 'custom',
    requiredDomains: ['brand'],
    recommendedLabs: [],
    executionRoute: (companyId) => `/c/${companyId}/projects/new?type=other`,
  },
};

/**
 * Get the flow configuration for a project type
 */
export function getProjectFlowConfig(projectType: ProjectType): ProjectFlowConfig {
  return PROJECT_FLOW_CONFIG[projectType];
}

/**
 * Get recommended labs for refresh_context path
 */
export function getRefreshContextLabs(projectType: ProjectType): LabId[] {
  const config = PROJECT_FLOW_CONFIG[projectType];
  // Always include brand and audience as required, plus recommended
  const baseLabs: LabId[] = ['brand', 'audience'];
  return [...new Set([...baseLabs, ...config.recommendedLabs])];
}

/**
 * Get execution route for use_existing path
 */
export function getExecutionRoute(companyId: string, projectType: ProjectType): string {
  return PROJECT_FLOW_CONFIG[projectType].executionRoute(companyId);
}
