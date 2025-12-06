// lib/insights/model.ts
// Brain Insights - Core types and model definitions

// ============================================================================
// Category Types
// ============================================================================

export type InsightCategory =
  | 'growth_opportunity'
  | 'conversion'
  | 'audience'
  | 'brand'
  | 'creative'
  | 'media'
  | 'seo_content'
  | 'competitive'
  | 'kpi_risk'
  | 'ops'
  | 'other';

export type InsightSeverity = 'low' | 'medium' | 'high' | 'critical';

export type InsightStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export type InsightSourceType =
  | 'gap'
  | 'gap_plan'
  | 'lab_website'
  | 'lab_audience'
  | 'lab_brand'
  | 'lab_media'
  | 'lab_creative'
  | 'lab_seo'
  | 'lab_content'
  | 'lab_demand'
  | 'lab_ops'
  | 'lab_competitor'
  | 'qbr'
  | 'performance_snapshot'
  | 'manual';

// ============================================================================
// Core Insight Type
// ============================================================================

export interface Insight {
  id: string;
  companyId: string;
  category: InsightCategory;
  severity: InsightSeverity;
  status: InsightStatus;
  sourceType: InsightSourceType;
  sourceRunId?: string;        // GAP run, Lab run, QBR id, etc.
  title: string;
  summary: string;             // 1–2 sentence explanation
  recommendation: string;      // concrete "do this" guidance
  rationale?: string;          // why this matters
  contextPaths?: string[];     // related Context Graph field paths
  metrics?: Record<string, unknown>; // optional numeric context (e.g. CTR drop, score)
  linkedWorkItemId?: string;   // if converted to work item
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Input Types
// ============================================================================

export interface InsightInput {
  companyId: string;
  category: InsightCategory;
  severity: InsightSeverity;
  sourceType: InsightSourceType;
  sourceRunId?: string;
  title: string;
  summary: string;
  recommendation: string;
  rationale?: string;
  contextPaths?: string[];
  metrics?: Record<string, unknown>;
}

export interface InsightFilters {
  category?: InsightCategory;
  severity?: InsightSeverity;
  status?: InsightStatus;
  sourceType?: InsightSourceType;
  limit?: number;
}

// ============================================================================
// UI Groupings
// ============================================================================

/**
 * Map detailed categories to high-level UI groups
 */
export type InsightUIGroup =
  | 'growth_opportunities'
  | 'competitive_signals'
  | 'strategic_recommendations';

export function getInsightUIGroup(category: InsightCategory): InsightUIGroup {
  switch (category) {
    case 'growth_opportunity':
    case 'conversion':
    case 'kpi_risk':
      return 'growth_opportunities';
    case 'competitive':
    case 'audience':
      return 'competitive_signals';
    case 'brand':
    case 'creative':
    case 'media':
    case 'seo_content':
    case 'ops':
    case 'other':
    default:
      return 'strategic_recommendations';
  }
}

export const UI_GROUP_LABELS: Record<InsightUIGroup, string> = {
  growth_opportunities: 'Growth Opportunities',
  competitive_signals: 'Competitive Signals',
  strategic_recommendations: 'Strategic Recommendations',
};

// ============================================================================
// Category Labels & Icons
// ============================================================================

export const CATEGORY_LABELS: Record<InsightCategory, string> = {
  growth_opportunity: 'Growth',
  conversion: 'Conversion',
  audience: 'Audience',
  brand: 'Brand',
  creative: 'Creative',
  media: 'Media',
  seo_content: 'SEO & Content',
  competitive: 'Competitive',
  kpi_risk: 'KPI Risk',
  ops: 'Operations',
  other: 'Strategy',
};

export const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ============================================================================
// Source Type Labels
// ============================================================================

export const SOURCE_TYPE_LABELS: Record<InsightSourceType, string> = {
  gap: 'GAP IA',
  gap_plan: 'Full GAP',
  lab_website: 'Website Lab',
  lab_audience: 'Audience Lab',
  lab_brand: 'Brand Lab',
  lab_media: 'Media Lab',
  lab_creative: 'Creative Lab',
  lab_seo: 'SEO Lab',
  lab_content: 'Content Lab',
  lab_demand: 'Demand Lab',
  lab_ops: 'Ops Lab',
  lab_competitor: 'Competitor Lab',
  qbr: 'QBR',
  performance_snapshot: 'Performance',
  manual: 'Manual',
};

/**
 * Map diagnostic tool IDs to insight source types
 */
export function diagnosticToolIdToSourceType(toolId: string): InsightSourceType {
  const mapping: Record<string, InsightSourceType> = {
    gapSnapshot: 'gap',
    gapPlan: 'gap_plan',
    gapHeavy: 'gap_plan',
    websiteLab: 'lab_website',
    brandLab: 'lab_brand',
    contentLab: 'lab_content',
    seoLab: 'lab_seo',
    demandLab: 'lab_demand',
    opsLab: 'lab_ops',
    creativeLab: 'lab_creative',
    mediaLab: 'lab_media',
    audienceLab: 'lab_audience',
    competitorLab: 'lab_competitor',
  };
  return mapping[toolId] || 'manual';
}
