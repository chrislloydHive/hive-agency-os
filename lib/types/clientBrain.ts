// lib/types/clientBrain.ts
// Client Brain (Strategic Insights) Types
//
// IMPORTANT: Client Brain stores DURABLE, CONDITION-BASED INSIGHTS about a client.
// These are factual observations that remain true for 6-12 weeks, NOT tasks or actions.
//
// Examples of GOOD insights:
// - "The homepage does not communicate a clear value proposition."
// - "The site does not have a blog, so there is no ongoing SEO content engine."
// - "Homepage CTAs are weak, inconsistent, or hard to see."
//
// Examples of BAD insights (these are tasks, not insights):
// - "Create a pricing page with clear tiers." (task)
// - "Develop a blog content plan." (task)
// - "Improve homepage CTAs." (task)
//
// Work items (tasks) should be generated FROM insights, not stored in Client Brain.

// ============================================================================
// Insight Categories
// ============================================================================

/**
 * Categories for classifying strategic insights
 */
export type InsightCategory =
  | 'brand'       // Brand clarity, positioning, messaging
  | 'content'     // Content strategy, blog, resources
  | 'seo'         // Search engine optimization
  | 'website'     // Website UX, conversion, technical
  | 'analytics'   // Measurement, tracking, data
  | 'demand'      // Demand generation, paid, funnel
  | 'ops'         // Marketing operations, processes
  | 'competitive' // Competitive positioning
  | 'structural'  // Business/organizational structure
  | 'product'     // Product-related insights
  | 'other';      // Uncategorized

/**
 * Severity/priority of an insight
 */
export type InsightSeverity = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Insight Source Types
// ============================================================================

/**
 * Source type identifiers for where an insight originated
 */
export type InsightSourceType =
  | 'tool_run'    // From a diagnostic tool run (GAP Snapshot, Website Lab, etc.)
  | 'document'    // From an uploaded document
  | 'manual'      // Manually entered by user
  | 'analytics'   // From analytics data analysis
  | 'conversation'; // From AI conversation

/**
 * Source from a diagnostic tool run
 */
export interface InsightSourceToolRun {
  type: 'tool_run';
  toolId: string;        // e.g., 'gapSnapshot', 'websiteLab'
  toolName: string;      // e.g., 'GAP Snapshot', 'Website Lab'
  runId: string;         // Diagnostic run record ID
}

/**
 * Source from an uploaded document
 */
export interface InsightSourceDocument {
  type: 'document';
  documentId: string;
  documentName: string;
}

/**
 * Manually entered insight
 */
export interface InsightSourceManual {
  type: 'manual';
  createdBy?: string;
}

/**
 * Source from analytics analysis
 */
export interface InsightSourceAnalytics {
  type: 'analytics';
  metricId?: string;
  metricLabel?: string;
}

/**
 * Source from AI conversation
 */
export interface InsightSourceConversation {
  type: 'conversation';
  conversationId?: string;
}

/**
 * Union type for all insight sources
 */
export type InsightSource =
  | InsightSourceToolRun
  | InsightSourceDocument
  | InsightSourceManual
  | InsightSourceAnalytics
  | InsightSourceConversation;

// ============================================================================
// Client Insight Interface
// ============================================================================

/**
 * A strategic insight about a client stored in Client Brain.
 *
 * IMPORTANT: The title and body must be DESCRIPTIVE OBSERVATIONS, not imperative tasks.
 * - Describe what IS true or IS missing
 * - Do NOT use verbs like "Create", "Add", "Develop", "Implement"
 * - Phrase as conditions/facts, not instructions
 */
export interface ClientInsight {
  /** Unique identifier (Airtable record ID) */
  id: string;

  /** Company this insight belongs to */
  companyId: string;

  /**
   * Short summary of the insight (condition-based, NOT a task)
   *
   * GOOD: "The homepage lacks a clear value proposition"
   * BAD: "Add a clear value proposition to the homepage"
   */
  title: string;

  /**
   * Detailed explanation and supporting evidence
   *
   * Should explain WHY this is true and provide context.
   * NOT implementation steps or how to fix it.
   */
  body: string;

  /** Category for grouping related insights */
  category: InsightCategory;

  /** Severity/importance of this insight */
  severity: InsightSeverity;

  /** When the insight was created */
  createdAt: string;

  /** When the insight was last updated */
  updatedAt?: string;

  /** Where this insight came from */
  source: InsightSource;

  /** Optional tags for additional categorization */
  tags?: string[];

  /** Count of work items generated from this insight */
  workItemCount?: number;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Payload for creating a new insight
 */
export interface CreateClientInsightPayload {
  companyId: string;
  title: string;
  body: string;
  category: InsightCategory;
  severity: InsightSeverity;
  source: InsightSource;
  tags?: string[];
}

/**
 * Payload for updating an existing insight
 */
export interface UpdateClientInsightPayload {
  title?: string;
  body?: string;
  category?: InsightCategory;
  severity?: InsightSeverity;
  tags?: string[];
}

/**
 * Options for listing insights
 */
export interface ListClientInsightsOptions {
  limit?: number;
  category?: InsightCategory;
  severity?: InsightSeverity;
  sourceType?: InsightSourceType;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a raw category string to InsightCategory
 */
export function normalizeInsightCategory(raw: string | undefined): InsightCategory {
  const v = (raw ?? '').toLowerCase().trim();
  if (['brand', 'branding', 'positioning'].includes(v)) return 'brand';
  if (['content', 'blog', 'resources'].includes(v)) return 'content';
  if (['seo', 'search'].includes(v)) return 'seo';
  if (['website', 'ux', 'conversion', 'web'].includes(v)) return 'website';
  if (['analytics', 'measurement', 'tracking', 'data'].includes(v)) return 'analytics';
  if (['demand', 'paid', 'funnel', 'lead'].includes(v)) return 'demand';
  if (['ops', 'operations', 'process'].includes(v)) return 'ops';
  if (['competitive', 'competition', 'competitor'].includes(v)) return 'competitive';
  if (['structural', 'structure', 'organization'].includes(v)) return 'structural';
  if (['product'].includes(v)) return 'product';
  return 'other';
}

/**
 * Normalize a raw severity string to InsightSeverity
 */
export function normalizeInsightSeverity(raw: string | undefined): InsightSeverity {
  const v = (raw ?? '').toLowerCase().trim();
  if (v === 'critical') return 'critical';
  if (v === 'high') return 'high';
  if (v === 'medium') return 'medium';
  return 'low';
}

/**
 * Get a human-readable label for an insight source
 */
export function getInsightSourceLabel(source: InsightSource): string {
  switch (source.type) {
    case 'tool_run':
      return `From: ${source.toolName}`;
    case 'document':
      return `From: ${source.documentName}`;
    case 'manual':
      return 'Manually Added';
    case 'analytics':
      return source.metricLabel ? `From Analytics: ${source.metricLabel}` : 'From Analytics';
    case 'conversation':
      return 'From AI Conversation';
    default:
      return 'Unknown Source';
  }
}

/**
 * Get severity color classes for UI display
 */
export function getInsightSeverityColor(severity: InsightSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'medium':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'low':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

/**
 * Get category color classes for UI display
 */
export function getInsightCategoryColor(category: InsightCategory): string {
  const colors: Record<InsightCategory, string> = {
    brand: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    content: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    seo: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    website: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    analytics: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    demand: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    ops: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    competitive: 'bg-red-500/20 text-red-400 border-red-500/30',
    structural: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    product: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    other: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  return colors[category] || colors.other;
}
