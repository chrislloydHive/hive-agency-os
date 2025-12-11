// lib/os/recommendations/types.ts
// Core types for the Unified Recommendations Engine

import type { Finding, FindingCategory, FindingSeverity } from '../findings/types';

/**
 * Action priority levels
 */
export type ActionPriority = 'p0' | 'p1' | 'p2' | 'p3';

/**
 * Action effort levels
 */
export type ActionEffort = 'quick-win' | 'moderate' | 'significant' | 'project';

/**
 * Action status
 */
export type ActionStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'deferred';

/**
 * Quarterly assignment
 */
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

/**
 * Strategic theme for grouping actions
 */
export type StrategicTheme =
  | 'foundation'       // Core infrastructure fixes
  | 'visibility'       // Improve discoverability
  | 'trust'            // Build credibility
  | 'engagement'       // Increase interaction
  | 'conversion'       // Drive business results
  | 'competitive'      // Outpace competitors
  | 'maintenance';     // Ongoing upkeep

/**
 * Action dependency
 */
export interface ActionDependency {
  /** ID of the action this depends on */
  actionId: string;
  /** Type of dependency */
  type: 'blocks' | 'enables' | 'enhances';
  /** Whether this is a hard dependency (must be completed first) */
  required: boolean;
}

/**
 * A Next Best Action derived from findings
 */
export interface Action {
  /** Unique action ID */
  id: string;
  /** Short action title */
  title: string;
  /** Detailed description of what to do */
  description: string;
  /** Priority level */
  priority: ActionPriority;
  /** Estimated effort */
  effort: ActionEffort;
  /** Strategic theme */
  theme: StrategicTheme;
  /** Category (inherited from finding) */
  category: FindingCategory;
  /** Assigned quarter */
  quarter: Quarter | null;
  /** Current status */
  status: ActionStatus;
  /** Dependencies on other actions */
  dependencies: ActionDependency[];
  /** IDs of findings this action addresses */
  findingIds: string[];
  /** Expected impact description */
  expectedImpact: string;
  /** Success metrics to track */
  successMetrics: string[];
  /** Estimated hours (rough) */
  estimatedHours?: number;
  /** Owner/assignee */
  assignee?: string;
  /** Due date if set */
  dueDate?: string;
  /** Tags for filtering */
  tags?: string[];
  /** When this action was created */
  createdAt: string;
  /** When this action was last updated */
  updatedAt: string;
}

/**
 * Action sequence - ordered list of related actions
 */
export interface ActionSequence {
  /** Sequence ID */
  id: string;
  /** Sequence name */
  name: string;
  /** Description of this sequence */
  description: string;
  /** Strategic theme */
  theme: StrategicTheme;
  /** Actions in this sequence (ordered) */
  actions: Action[];
  /** Total estimated hours */
  totalEstimatedHours: number;
  /** Overall priority */
  priority: ActionPriority;
}

/**
 * Quarterly plan
 */
export interface QuarterlyPlan {
  /** Quarter identifier */
  quarter: Quarter;
  /** Year */
  year: number;
  /** Actions assigned to this quarter */
  actions: Action[];
  /** Grouped by theme */
  byTheme: Map<StrategicTheme, Action[]>;
  /** Total estimated hours */
  totalHours: number;
  /** Summary */
  summary: string;
}

/**
 * Annual roadmap
 */
export interface AnnualRoadmap {
  /** Year */
  year: number;
  /** Quarterly plans */
  quarters: QuarterlyPlan[];
  /** All actions */
  allActions: Action[];
  /** Sequences */
  sequences: ActionSequence[];
  /** Statistics */
  stats: {
    totalActions: number;
    byPriority: Record<ActionPriority, number>;
    byTheme: Record<StrategicTheme, number>;
    byEffort: Record<ActionEffort, number>;
    totalHours: number;
  };
}

/**
 * Result of generating recommendations
 */
export interface RecommendationResult {
  /** Generated actions */
  actions: Action[];
  /** Organized sequences */
  sequences: ActionSequence[];
  /** Quarterly distribution */
  quarterlyPlans: QuarterlyPlan[];
  /** Warnings/notes */
  warnings: string[];
  /** Generation metadata */
  metadata: {
    findingsProcessed: number;
    actionsGenerated: number;
    sequencesCreated: number;
    generatedAt: string;
  };
}

/**
 * Theme descriptions for UI
 */
export const THEME_DESCRIPTIONS: Record<StrategicTheme, { title: string; description: string }> = {
  foundation: {
    title: 'Foundation',
    description: 'Core infrastructure and technical fixes that enable everything else',
  },
  visibility: {
    title: 'Visibility',
    description: 'Improve discoverability and presence across search and platforms',
  },
  trust: {
    title: 'Trust & Credibility',
    description: 'Build authority and social proof through reviews and reputation',
  },
  engagement: {
    title: 'Engagement',
    description: 'Increase interaction and connection with your audience',
  },
  conversion: {
    title: 'Conversion',
    description: 'Optimize paths to drive business results and customer action',
  },
  competitive: {
    title: 'Competitive Edge',
    description: 'Strategic moves to outpace competitors in key areas',
  },
  maintenance: {
    title: 'Maintenance',
    description: 'Ongoing upkeep and optimization of existing assets',
  },
};

/**
 * Priority descriptions
 */
export const PRIORITY_DESCRIPTIONS: Record<ActionPriority, { label: string; description: string }> = {
  p0: {
    label: 'Critical',
    description: 'Must be done immediately - blocking issues or major risks',
  },
  p1: {
    label: 'High',
    description: 'Should be done soon - significant impact on goals',
  },
  p2: {
    label: 'Medium',
    description: 'Important but not urgent - good improvements',
  },
  p3: {
    label: 'Low',
    description: 'Nice to have - minor improvements or optimizations',
  },
};

/**
 * Effort estimates in hours
 */
export const EFFORT_HOURS: Record<ActionEffort, { min: number; max: number; typical: number }> = {
  'quick-win': { min: 0.5, max: 2, typical: 1 },
  'moderate': { min: 2, max: 8, typical: 4 },
  'significant': { min: 8, max: 24, typical: 16 },
  'project': { min: 24, max: 80, typical: 40 },
};
