// lib/types/clientBrain.ts
// Types for the Client Brain system - durable strategic memory per company

// ============================================================================
// Insight Source Types
// ============================================================================

export type InsightSourceType = 'tool_run' | 'document' | 'manual';

export type InsightCategory =
  | 'brand'
  | 'content'
  | 'seo'
  | 'seo_content'  // Combined SEO/content category
  | 'website'
  | 'analytics'
  | 'demand'
  | 'ops'
  | 'competitive'
  | 'structural'
  | 'product'
  | 'growth_opportunity'
  | 'conversion'
  | 'audience'
  | 'creative'
  | 'media'
  | 'kpi_risk'
  | 'other';

export type InsightStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export type InsightSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface InsightSourceToolRun {
  type: 'tool_run';
  toolSlug?: string;
  toolRunId?: string;
  // Legacy aliases
  toolId?: string;
  toolName?: string;
  runId?: string;
}

export interface InsightSourceDocument {
  type: 'document';
  documentId: string;
  documentName?: string;
}

export interface InsightSourceManual {
  type: 'manual';
  createdBy?: string;
}

export type InsightSource =
  | InsightSourceToolRun
  | InsightSourceDocument
  | InsightSourceManual;

// ============================================================================
// Client Insight
// ============================================================================

export interface ClientInsight {
  id: string;
  companyId: string;
  title: string;
  body: string;
  category: InsightCategory;
  severity?: InsightSeverity;
  status?: InsightStatus;
  createdAt: string;
  updatedAt?: string;
  source: InsightSource;
  // Strategic insight fields
  recommendation?: string;       // concrete "do this" guidance
  rationale?: string;            // why this matters
  contextPaths?: string[];       // related Context Graph field paths
  metrics?: Record<string, unknown>; // optional numeric context
  // Work linking
  linkedWorkItemId?: string;
  relatedWorkCount?: number;
  lastUsedInWorkAt?: string | null;
  // Extended fields
  tags?: string[];
  workItemCount?: number;
}

export interface CreateClientInsightInput {
  title: string;
  body: string;
  category: InsightCategory;
  severity?: InsightSeverity;
  status?: InsightStatus;
  source: InsightSource;
  companyId?: string;
  tags?: string[];
  recommendation?: string;
  rationale?: string;
  contextPaths?: string[];
  metrics?: Record<string, unknown>;
}

// Alias for backwards compatibility
export type CreateClientInsightPayload = CreateClientInsightInput;

export interface UpdateClientInsightPayload {
  title?: string;
  body?: string;
  category?: InsightCategory;
  severity?: InsightSeverity;
  status?: InsightStatus;
  tags?: string[];
  linkedWorkItemId?: string;
}

export interface ListClientInsightsOptions {
  category?: InsightCategory;
  severity?: InsightSeverity;
  sourceType?: InsightSourceType;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Client Document
// ============================================================================

export type DocumentType =
  | 'brief'
  | 'contract'
  | 'deck'
  | 'research'
  | 'transcript'
  | 'report'
  | 'other';

export interface ClientDocument {
  id: string;
  companyId: string;
  name: string;
  type?: DocumentType | null;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy?: string | null;
  storageUrl: string;
  textExtracted?: boolean;
  textPreview?: string | null;
  notes?: string | null;
}

export interface CreateClientDocumentInput {
  companyId: string;
  name: string;
  type?: DocumentType | null;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  uploadedBy?: string | null;
  textExtracted?: boolean;
  textPreview?: string | null;
  notes?: string | null;
}

// ============================================================================
// Category & Severity Config
// ============================================================================

export const INSIGHT_CATEGORY_CONFIG: Record<InsightCategory, { label: string; icon: string; color: string }> = {
  brand: { label: 'Brand', icon: 'Sparkles', color: 'purple' },
  content: { label: 'Content', icon: 'FileText', color: 'emerald' },
  seo: { label: 'SEO', icon: 'Search', color: 'cyan' },
  seo_content: { label: 'SEO & Content', icon: 'Search', color: 'cyan' },
  website: { label: 'Website', icon: 'Globe', color: 'blue' },
  analytics: { label: 'Analytics', icon: 'BarChart2', color: 'indigo' },
  demand: { label: 'Demand', icon: 'TrendingUp', color: 'pink' },
  ops: { label: 'Ops', icon: 'Settings', color: 'orange' },
  competitive: { label: 'Competitive', icon: 'Users', color: 'red' },
  structural: { label: 'Structural', icon: 'Layers', color: 'slate' },
  product: { label: 'Product', icon: 'Package', color: 'amber' },
  growth_opportunity: { label: 'Growth', icon: 'TrendingUp', color: 'emerald' },
  conversion: { label: 'Conversion', icon: 'Target', color: 'blue' },
  audience: { label: 'Audience', icon: 'Users', color: 'violet' },
  creative: { label: 'Creative', icon: 'Palette', color: 'pink' },
  media: { label: 'Media', icon: 'Tv', color: 'sky' },
  kpi_risk: { label: 'KPI Risk', icon: 'AlertTriangle', color: 'red' },
  other: { label: 'Other', icon: 'Circle', color: 'slate' },
};

export const INSIGHT_STATUS_CONFIG: Record<InsightStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'blue' },
  in_progress: { label: 'In Progress', color: 'amber' },
  resolved: { label: 'Resolved', color: 'emerald' },
  dismissed: { label: 'Dismissed', color: 'slate' },
};

// ============================================================================
// UI Groupings for Brain Insights
// ============================================================================

export type InsightUIGroup =
  | 'growth_opportunities'
  | 'competitive_signals'
  | 'strategic_recommendations';

export function getInsightUIGroup(category: InsightCategory): InsightUIGroup {
  switch (category) {
    case 'growth_opportunity':
    case 'conversion':
    case 'kpi_risk':
    case 'demand':
    case 'media':
      return 'growth_opportunities';
    case 'competitive':
    case 'audience':
    case 'seo_content':  // SEO/content when competitive in nature
      return 'competitive_signals';
    case 'brand':
    case 'creative':
    case 'seo':
    case 'content':
    case 'website':
    case 'analytics':
    case 'ops':
    case 'structural':
    case 'product':
    case 'other':
    default:
      return 'strategic_recommendations';
  }
}

export const UI_GROUP_CONFIG: Record<InsightUIGroup, { label: string; icon: string; color: string }> = {
  growth_opportunities: { label: 'Growth Opportunities', icon: 'TrendingUp', color: 'emerald' },
  competitive_signals: { label: 'Competitive Signals', icon: 'Radar', color: 'blue' },
  strategic_recommendations: { label: 'Strategic Recommendations', icon: 'Target', color: 'amber' },
};

export const INSIGHT_SEVERITY_CONFIG: Record<InsightSeverity, { label: string; color: string }> = {
  low: { label: 'Low', color: 'slate' },
  medium: { label: 'Medium', color: 'amber' },
  high: { label: 'High', color: 'orange' },
  critical: { label: 'Critical', color: 'red' },
};

export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, { label: string; icon: string }> = {
  brief: { label: 'Brief', icon: 'FileText' },
  contract: { label: 'Contract', icon: 'FileCheck' },
  deck: { label: 'Deck', icon: 'Presentation' },
  research: { label: 'Research', icon: 'BookOpen' },
  transcript: { label: 'Transcript', icon: 'MessageSquare' },
  report: { label: 'Report', icon: 'ClipboardList' },
  other: { label: 'Other', icon: 'File' },
};

// ============================================================================
// Type Guards
// ============================================================================

export function isToolRunSource(source: InsightSource): source is InsightSourceToolRun {
  return source.type === 'tool_run';
}

export function isDocumentSource(source: InsightSource): source is InsightSourceDocument {
  return source.type === 'document';
}

export function isManualSource(source: InsightSource): source is InsightSourceManual {
  return source.type === 'manual';
}

// ============================================================================
// Normalization Helpers
// ============================================================================

const CATEGORY_ALIASES: Record<string, InsightCategory> = {
  brand: 'brand',
  branding: 'brand',
  content: 'content',
  messaging: 'content',
  seo: 'seo',
  search: 'seo',
  website: 'website',
  ux: 'website',
  'user experience': 'website',
  analytics: 'analytics',
  tracking: 'analytics',
  demand: 'demand',
  'demand gen': 'demand',
  'demand generation': 'demand',
  funnel: 'demand',
  ops: 'ops',
  operations: 'ops',
  competitive: 'competitive',
  competitors: 'competitive',
  competition: 'competitive',
  structural: 'structural',
  architecture: 'structural',
  product: 'product',
  other: 'other',
};

export function normalizeInsightCategory(raw: string): InsightCategory {
  const normalized = raw.toLowerCase().trim();
  return CATEGORY_ALIASES[normalized] || 'other';
}

export function normalizeInsightSeverity(raw: string): InsightSeverity {
  const normalized = raw.toLowerCase().trim();
  if (['low', 'minor'].includes(normalized)) return 'low';
  if (['medium', 'moderate', 'med'].includes(normalized)) return 'medium';
  if (['high', 'major'].includes(normalized)) return 'high';
  if (['critical', 'urgent', 'severe'].includes(normalized)) return 'critical';
  return 'medium';
}

export function normalizeDocumentType(raw: string | null | undefined): DocumentType | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim();
  if (['brief', 'creative brief', 'project brief'].includes(normalized)) return 'brief';
  if (['contract', 'agreement', 'sow', 'msa'].includes(normalized)) return 'contract';
  if (['deck', 'presentation', 'slides', 'ppt', 'pptx'].includes(normalized)) return 'deck';
  if (['research', 'study', 'analysis'].includes(normalized)) return 'research';
  if (['transcript', 'call notes', 'meeting notes', 'interview'].includes(normalized)) return 'transcript';
  if (['report', 'audit', 'assessment'].includes(normalized)) return 'report';
  return 'other';
}

// ============================================================================
// Display Helper Functions
// ============================================================================

export function getInsightSourceLabel(source: InsightSource): string {
  switch (source.type) {
    case 'tool_run':
      return `Tool: ${source.toolSlug}`;
    case 'document':
      return 'Document';
    case 'manual':
      return source.createdBy ? `Added by ${source.createdBy}` : 'Manual';
    default:
      return 'Unknown';
  }
}

export function getInsightSeverityColor(severity: InsightSeverity | undefined): string {
  if (!severity) return 'slate';
  return INSIGHT_SEVERITY_CONFIG[severity]?.color || 'slate';
}

export function getInsightCategoryColor(category: InsightCategory): string {
  return INSIGHT_CATEGORY_CONFIG[category]?.color || 'slate';
}
