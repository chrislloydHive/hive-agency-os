// lib/gap-heavy/modules/websiteActionPlan.ts
// Website Diagnostic Action Plan - Action-First Types & Schemas
//
// This module defines the **synthesis layer** that transforms Website Lab
// analysis into a structured, prioritized action plan for Hive strategists.
//
// Core Principle:
// - Website Lab = INTERNAL DIAGNOSTIC TOOL (not a client report)
// - Goal = Tell us WHAT WORK NEEDS TO BE DONE
// - Output = Structured actions feeding the Work queue

import { z } from 'zod';
import type { WebsiteUxDimensionKey } from './websiteLab';

// ============================================================================
// SERVICE AREAS (Hive's Service Taxonomy)
// ============================================================================

export const ServiceAreaSchema = z.enum([
  'brand',
  'content',
  'website',
  'seo',
  'authority',
  'analytics',
  'cross_cutting',
]);

export type ServiceArea = z.infer<typeof ServiceAreaSchema>;

// ============================================================================
// PRIORITY BUCKETS (Time Horizons)
// ============================================================================

export const PriorityBucketSchema = z.enum(['now', 'next', 'later']);
export type PriorityBucket = z.infer<typeof PriorityBucketSchema>;

// ============================================================================
// WORK ITEM (Core Action Unit)
// ============================================================================

/**
 * A single actionable work item synthesized from Website Lab analysis.
 * This is the atomic unit that flows into Hive's Work queue.
 */
export const WebsiteWorkItemSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Concise title (action-oriented) */
  title: z.string(),

  /** Detailed description of what to do */
  description: z.string(),

  /** Why this matters (rationale) */
  rationale: z.string(),

  /** References back into lab result (issue IDs, persona IDs, page paths, etc.) */
  evidenceRefs: z.array(z.string()).optional(),

  /** Which UX dimension this improves */
  dimension: z.enum([
    'overall_experience',
    'hero_and_value_prop',
    'navigation_and_structure',
    'trust_and_social_proof',
    'conversion_flow',
    'content_and_clarity',
    'visual_and_mobile',
    'intent_alignment',
    'analytics',
  ]),

  /** Which Hive service area owns this */
  serviceArea: ServiceAreaSchema,

  /** Impact score (1-5, higher = bigger impact) */
  impactScore: z.number().min(1).max(5),

  /** Effort score (1-5, higher = more effort) */
  effortScore: z.number().min(1).max(5),

  /** Estimated conversion/UX lift (percentage) */
  estimatedLift: z.number().optional(),

  /** Priority bucket */
  priority: PriorityBucketSchema,

  /** Recommended assignee role */
  recommendedAssigneeRole: z.string().optional(),

  /** Recommended timebox (e.g., "1-2 days", "1 week") */
  recommendedTimebox: z.string().optional(),

  /** Current status (for Work queue integration) */
  status: z.enum(['backlog', 'planned', 'in_progress', 'done']).default('backlog'),

  /** Tags for filtering (e.g., "cta", "trust", "pricing", "hero") */
  tags: z.array(z.string()).optional(),
});

export type WebsiteWorkItem = z.infer<typeof WebsiteWorkItemSchema>;

// ============================================================================
// ACTION THEME (Grouping Mechanism)
// ============================================================================

/**
 * A thematic grouping of related work items.
 * Helps strategists understand the "big picture" problems.
 */
export const WebsiteActionThemeSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Theme label (e.g., "Trust Signals", "Value Proposition") */
  label: z.string(),

  /** Description of the theme */
  description: z.string(),

  /** Priority level */
  priority: z.enum(['critical', 'important', 'nice_to_have']),

  /** Linked UX dimensions */
  linkedDimensions: z
    .array(
      z.enum([
        'overall_experience',
        'hero_and_value_prop',
        'navigation_and_structure',
        'trust_and_social_proof',
        'conversion_flow',
        'content_and_clarity',
        'visual_and_mobile',
        'intent_alignment',
      ])
    )
    .optional(),

  /** Linked persona IDs */
  linkedPersonas: z.array(z.string()).optional(),

  /** Linked page paths */
  linkedPages: z.array(z.string()).optional(),

  /** Expected impact summary */
  expectedImpactSummary: z.string().optional(),
});

export type WebsiteActionTheme = z.infer<typeof WebsiteActionThemeSchema>;

// ============================================================================
// EXPERIMENT (A/B Test Recommendation)
// ============================================================================

/**
 * A proposed experiment/test to validate hypotheses.
 */
export const WebsiteExperimentSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Hypothesis statement */
  hypothesis: z.string(),

  /** Test description */
  description: z.string(),

  /** Success metric */
  metric: z.string(),

  /** Pages to run test on */
  pages: z.array(z.string()).optional(),

  /** Expected lift (percentage) */
  expectedLift: z.number().optional(),

  /** Effort score (1-5) */
  effortScore: z.number().min(1).max(5),
});

export type WebsiteExperiment = z.infer<typeof WebsiteExperimentSchema>;

// ============================================================================
// STRATEGY CHANGE (Broader Strategic Recommendation)
// ============================================================================

/**
 * A strategic change recommendation (not a tactical work item).
 * E.g., "Shift from product-first to outcome-first messaging"
 */
export const StrategyChangeSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Title of the strategic change */
  title: z.string(),

  /** Detailed description */
  description: z.string(),

  /** Reasoning/rationale */
  reasoning: z.string(),

  /** Linked findings (issue IDs, section analysis IDs, etc.) */
  linkedFindings: z.array(z.string()).optional(),
});

export type StrategyChange = z.infer<typeof StrategyChangeSchema>;

// ============================================================================
// WEBSITE ACTION PLAN (Top-Level Structure)
// ============================================================================

/**
 * The complete action-first diagnostic output.
 * This is what the Website diagnostics UI renders.
 */
export const WebsiteActionPlanSchema = z.object({
  /** Short, action-focused summary (2-3 paragraphs) */
  summary: z.string(),

  /** Overall diagnostic grade (0-100) */
  overallScore: z.number().min(0).max(100),

  /** Benchmark label */
  benchmarkLabel: z.enum(['elite', 'strong', 'average', 'weak']).optional(),

  /** Key themes identified */
  keyThemes: z.array(WebsiteActionThemeSchema),

  /** NOW bucket: do these immediately (0-30 days) */
  now: z.array(WebsiteWorkItemSchema),

  /** NEXT bucket: do these soon (30-90 days) */
  next: z.array(WebsiteWorkItemSchema),

  /** LATER bucket: do these eventually (90+ days) */
  later: z.array(WebsiteWorkItemSchema),

  /** Proposed experiments/tests */
  experiments: z.array(WebsiteExperimentSchema).optional(),

  /** Strategic changes recommended */
  strategicChanges: z.array(StrategyChangeSchema).optional(),

  /** Supporting narrative (optional, for full report view) */
  supportingNarrative: z.string().optional(),
});

export type WebsiteActionPlan = z.infer<typeof WebsiteActionPlanSchema>;

// ============================================================================
// FILTERING & GROUPING HELPERS
// ============================================================================

/**
 * Filter criteria for work items
 */
export type WorkItemFilters = {
  serviceArea?: ServiceArea;
  dimension?: WebsiteUxDimensionKey | 'analytics';
  persona?: string;
  page?: string;
  tags?: string[];
};

/**
 * Helper: Filter work items by criteria
 */
export function filterWorkItems(
  items: WebsiteWorkItem[],
  filters: WorkItemFilters
): WebsiteWorkItem[] {
  return items.filter((item) => {
    if (filters.serviceArea && item.serviceArea !== filters.serviceArea) {
      return false;
    }
    if (filters.dimension && item.dimension !== filters.dimension) {
      return false;
    }
    if (filters.tags && filters.tags.length > 0) {
      const itemTags = item.tags || [];
      if (!filters.tags.some((tag) => itemTags.includes(tag))) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Helper: Group work items by service area
 */
export function groupByServiceArea(
  items: WebsiteWorkItem[]
): Record<ServiceArea, WebsiteWorkItem[]> {
  const groups: Record<ServiceArea, WebsiteWorkItem[]> = {
    brand: [],
    content: [],
    website: [],
    seo: [],
    authority: [],
    analytics: [],
    cross_cutting: [],
  };

  for (const item of items) {
    groups[item.serviceArea].push(item);
  }

  return groups;
}

/**
 * Helper: Group work items by dimension
 */
export function groupByDimension(
  items: WebsiteWorkItem[]
): Record<string, WebsiteWorkItem[]> {
  const groups: Record<string, WebsiteWorkItem[]> = {};

  for (const item of items) {
    if (!groups[item.dimension]) {
      groups[item.dimension] = [];
    }
    groups[item.dimension].push(item);
  }

  return groups;
}

// ============================================================================
// SERVICE AREA & DIMENSION MAPPING
// ============================================================================

/**
 * Map a UX dimension to its primary service area
 */
export function dimensionToServiceArea(
  dimension: WebsiteUxDimensionKey | 'analytics'
): ServiceArea {
  const mapping: Record<string, ServiceArea> = {
    hero_and_value_prop: 'brand',
    trust_and_social_proof: 'authority',
    navigation_and_structure: 'website',
    conversion_flow: 'website',
    content_and_clarity: 'content',
    visual_and_mobile: 'website',
    intent_alignment: 'content',
    analytics: 'analytics',
    overall_experience: 'cross_cutting',
  };

  return mapping[dimension] || 'cross_cutting';
}

/**
 * Get human-readable label for service area
 */
export function getServiceAreaLabel(area: ServiceArea): string {
  const labels: Record<ServiceArea, string> = {
    brand: 'Brand',
    content: 'Content',
    website: 'Website',
    seo: 'SEO',
    authority: 'Authority',
    analytics: 'Analytics',
    cross_cutting: 'Cross-Cutting',
  };
  return labels[area];
}

/**
 * Get human-readable label for dimension
 */
export function getDimensionLabel(dimension: string): string {
  const labels: Record<string, string> = {
    overall_experience: 'Overall Experience',
    hero_and_value_prop: 'Hero & Value Prop',
    navigation_and_structure: 'Navigation & Structure',
    trust_and_social_proof: 'Trust & Social Proof',
    conversion_flow: 'Conversion Flow',
    content_and_clarity: 'Content & Clarity',
    visual_and_mobile: 'Visual & Mobile',
    intent_alignment: 'Intent Alignment',
    analytics: 'Analytics',
  };
  return labels[dimension] || dimension;
}
