// lib/diagnostics/content-lab/types.ts
// Content Lab Diagnostic Output Types
//
// These types define the structure of Content Lab diagnostic results that flow through:
// - Diagnostic runs
// - UI reports
// - Work item creation
// - Brain / Blueprint integration

// ============================================================================
// Maturity Stages
// ============================================================================

/**
 * Content maturity stages
 * - unproven: No meaningful content presence
 * - emerging: Some content exists, but limited depth or freshness
 * - scaling: Growing content library with regular updates
 * - established: Comprehensive, fresh, SEO-optimized content engine
 */
export type ContentMaturityStage = 'unproven' | 'emerging' | 'scaling' | 'established';

// ============================================================================
// Dimension Keys
// ============================================================================

/**
 * Content Lab dimension keys - camelCase for consistency
 */
export type ContentDimensionKey =
  | 'inventory'
  | 'quality'
  | 'depth'
  | 'freshness'
  | 'seoSignals';

export type ContentDimensionStatus = 'weak' | 'moderate' | 'strong' | 'not_evaluated';

// ============================================================================
// Evidence
// ============================================================================

/**
 * Evidence and findings that support a dimension score
 */
export interface ContentLabEvidence {
  /** What was found (positive signals) */
  found: string[];
  /** What was missing or problematic */
  missing: string[];
  /** Specific data points or metrics */
  dataPoints: Record<string, string | number | boolean>;
}

// ============================================================================
// Issues
// ============================================================================

export type ContentIssueCategory =
  | 'Inventory'
  | 'Quality'
  | 'Depth'
  | 'Freshness'
  | 'SEO Signals';

export type ContentIssueSeverity = 'low' | 'medium' | 'high';

export interface ContentLabIssue {
  id: string;
  category: ContentIssueCategory;
  severity: ContentIssueSeverity;
  title: string;
  description: string;
}

// ============================================================================
// Quick Wins
// ============================================================================

export interface ContentLabQuickWin {
  id: string;
  category: string;
  action: string;
  expectedImpact: 'low' | 'medium' | 'high';
  effortLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Projects
// ============================================================================

export interface ContentLabProject {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  timeHorizon: 'near-term' | 'mid-term' | 'long-term';
}

// ============================================================================
// Dimensions
// ============================================================================

export interface ContentLabDimension {
  key: ContentDimensionKey;
  label: string;
  score: number | null; // 0-100, null if not evaluated
  status: ContentDimensionStatus;
  summary: string;
  issues: ContentLabIssue[];
  evidence?: ContentLabEvidence;
}

// ============================================================================
// Data Confidence
// ============================================================================

export type DataConfidenceLevel = 'low' | 'medium' | 'high';

export interface ContentDataConfidence {
  score: number; // 0-100
  level: DataConfidenceLevel;
  reason: string;
}

// ============================================================================
// Analytics Snapshot
// ============================================================================

export interface ContentAnalyticsSnapshot {
  /** Clicks from content pages (from GSC) */
  clicks?: number;
  /** Impressions from content pages (from GSC) */
  impressions?: number;
  /** Average position for content queries */
  avgPosition?: number;
  /** Content CTR */
  ctr?: number;
}

// ============================================================================
// Analyzer Output
// ============================================================================

export interface ContentLabAnalysisOutput {
  /** URL analyzed */
  url: string;
  /** Company ID */
  companyId?: string;
  /** Company type for scoring context */
  companyType?: string | null;

  /** Number of articles/blog posts found */
  articleCount: number;
  /** Has a blog section */
  hasBlog: boolean;
  /** Has case studies */
  hasCaseStudies: boolean;
  /** Has resource pages (guides, whitepapers, etc.) */
  hasResourcePages: boolean;
  /** Has pricing content */
  hasPricingContent: boolean;
  /** Has FAQ or help content */
  hasFaqContent: boolean;

  /** Topics extracted from content */
  extractedTopics: string[];
  /** Article titles extracted */
  extractedArticleTitles: string[];
  /** Content URLs discovered */
  contentUrls: string[];

  /** Number of recently published articles (last 6 months) */
  recentArticlesCount: number;
  /** Last updated dates from articles */
  lastUpdatedDates: string[];

  /** GSC clicks for content pages */
  contentSearchClicks?: number;
  /** GSC impressions for content pages */
  contentSearchImpressions?: number;
  /** GSC CTR for content pages */
  contentSearchCtr?: number;

  /** Quality score from GPT heuristic (0-100) */
  qualityScore?: number;
  /** Quality assessment notes */
  qualityNotes?: string;

  /** Data confidence assessment */
  dataConfidence: ContentDataConfidence;
}

// ============================================================================
// Main Result Type
// ============================================================================

export interface ContentLabResult {
  /** Overall content score (0-100) */
  overallScore: number;

  /** Maturity stage assessment */
  maturityStage: ContentMaturityStage;

  /** Data confidence assessment */
  dataConfidence: ContentDataConfidence;

  /** Narrative summary (2-3 sentences from strategist perspective) */
  narrativeSummary: string;

  /** Dimension scores and analysis */
  dimensions: ContentLabDimension[];

  /** All issues found */
  issues: ContentLabIssue[];

  /** Quick wins (high impact, low effort) */
  quickWins: ContentLabQuickWin[];

  /** Strategic projects */
  projects: ContentLabProject[];

  /** Analytics snapshot (if available) */
  analyticsSnapshot?: ContentAnalyticsSnapshot;

  /** Detailed findings from the analysis */
  findings?: ContentLabFindings;

  /** Timestamp */
  generatedAt: string;

  /** URL analyzed */
  url: string;

  /** Company ID */
  companyId?: string;

  /** Company type */
  companyType?: string | null;
}

// ============================================================================
// Detailed Findings
// ============================================================================

export interface ContentLabFindings {
  /** Content URLs discovered */
  contentUrls: string[];
  /** Article titles found */
  articleTitles: string[];
  /** Topics identified */
  topics: string[];
  /** Content types present */
  contentTypes: ContentTypePresence[];
}

export interface ContentTypePresence {
  type: 'blog' | 'case_study' | 'resource' | 'faq' | 'pricing' | 'guide' | 'whitepaper';
  present: boolean;
  count?: number;
  urls?: string[];
}

// ============================================================================
// Engine Result Wrapper
// ============================================================================

export interface ContentLabEngineResult {
  success: boolean;
  score?: number;
  summary?: string;
  report?: ContentLabResult;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status from score
 */
export function getStatusFromScore(score: number): ContentDimensionStatus {
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'weak';
}

/**
 * Get maturity stage from overall score
 */
export function getMaturityFromScore(score: number): ContentMaturityStage {
  if (score >= 85) return 'established';
  if (score >= 70) return 'scaling';
  if (score >= 50) return 'emerging';
  return 'unproven';
}

/**
 * Get human-readable label for dimension key
 */
export function getDimensionLabel(key: ContentDimensionKey): string {
  const labels: Record<ContentDimensionKey, string> = {
    inventory: 'Content Inventory & Presence',
    quality: 'Quality & Messaging',
    depth: 'Depth & Coverage',
    freshness: 'Content Freshness',
    seoSignals: 'Content-Powered SEO',
  };
  return labels[key] || key;
}

/**
 * Map issue category to dimension key
 */
export function mapCategoryToDimensionKey(category: string): ContentDimensionKey | null {
  const c = category.toLowerCase();
  if (c.includes('inventory') || c.includes('presence')) return 'inventory';
  if (c.includes('quality') || c.includes('messaging')) return 'quality';
  if (c.includes('depth') || c.includes('coverage')) return 'depth';
  if (c.includes('fresh')) return 'freshness';
  if (c.includes('seo') || c.includes('search')) return 'seoSignals';
  return null;
}

/**
 * Generate a unique ID for an issue
 */
export function generateIssueId(category: ContentIssueCategory, index: number): string {
  const catKey = category.toLowerCase().replace(/\s+/g, '-');
  return `content-${catKey}-${index}-${Date.now().toString(36)}`;
}
