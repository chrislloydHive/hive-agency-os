// lib/qbr/qbrTypes.ts
// QBR Story View - Core Type Definitions
//
// Defines the data model for the QBR Story narrative dashboard,
// including story blocks, chapters, and metadata.

import { z } from 'zod';

// ============================================================================
// Basic Types
// ============================================================================

export type QuarterId = string; // e.g. "2025-Q4"

export const QbrDomainSchema = z.enum([
  'strategy',
  'website',
  'seo',
  'content',
  'brand',
  'audience',
  'media',
  'analytics',
  'competitive',
]);

export type QbrDomain = z.infer<typeof QbrDomainSchema>;

export const QBR_DOMAINS: QbrDomain[] = [
  'strategy',
  'website',
  'seo',
  'content',
  'brand',
  'audience',
  'media',
  'analytics',
  'competitive',
];

// ============================================================================
// Story Metadata
// ============================================================================

export const RegenerationModeSchema = z.enum([
  'full_rewrite',
  'clarity',
  'shorter',
  'longer',
]);

export type RegenerationMode = z.infer<typeof RegenerationModeSchema>;

export interface RegenerationHistoryEntry {
  id: string;
  timestamp: string;
  mode: RegenerationMode;
  domain?: QbrDomain | 'all';
  requestedBy: string; // userId
}

export interface QbrStoryMeta {
  companyId: string;
  quarter: QuarterId;
  generatedAt: string;
  generatedBy: 'ai' | 'human' | 'hybrid';
  modelVersion: string;
  dataConfidenceScore: number; // 0-100
  status: 'draft' | 'finalized';
  regenerationHistory: RegenerationHistoryEntry[];
}

// ============================================================================
// Story Block Types
// ============================================================================

export const StoryBlockKindSchema = z.enum([
  'section_intro',
  'node_deltas',
  'insight_cluster',
  'kpi_chart',
  'ai_paragraph',
  'recommendations',
  'meta_callout',
  'context_integrity',
  'global_context_health',
]);

export type StoryBlockKind = z.infer<typeof StoryBlockKindSchema>;

export interface StoryBlockProvenance {
  source: 'ai' | 'human' | 'system';
  insightSourceIds?: string[];
  contextSnapshotIds?: string[];
  kpiSnapshotIds?: string[];
}

export interface StoryBlockBase {
  id: string;
  kind: StoryBlockKind;
  domain: QbrDomain | 'global';
  order: number;
  lockedByUser?: boolean;
  provenance: StoryBlockProvenance;
}

// ============================================================================
// Specific Block Types
// ============================================================================

export interface SectionIntroBlock extends StoryBlockBase {
  kind: 'section_intro';
  title: string;
  subtitle?: string;
  summaryBullets: string[];
}

export interface GraphDeltaItem {
  nodeId: string;
  label: string;
  category: string;
  changeType: 'added' | 'removed' | 'strengthened' | 'weakened';
  beforeScore?: number;
  afterScore?: number;
  delta?: number;
  comment?: string;
}

export interface NodeDeltasBlock extends StoryBlockBase {
  kind: 'node_deltas';
  graphDeltas: GraphDeltaItem[];
}

export interface InsightItem {
  id: string;
  title: string;
  summary: string;
  severity?: 'low' | 'medium' | 'high';
  impactArea: QbrDomain;
  whyItMatters: string;
}

export interface InsightClusterBlock extends StoryBlockBase {
  kind: 'insight_cluster';
  clusterLabel: string;
  clusterType: 'win' | 'regression' | 'risk' | 'opportunity';
  insights: InsightItem[];
}

export interface KpiValue {
  ts: string;
  value: number;
}

export interface KpiComparative {
  baselineRange?: { start: string; end: string };
  baselineAvg?: number;
  deltaPct?: number;
}

export interface KpiChartBlock extends StoryBlockBase {
  kind: 'kpi_chart';
  chartType: 'line' | 'bar' | 'sparkline' | 'bullet';
  metricKey: string;
  label: string;
  timeRange: { start: string; end: string };
  values: KpiValue[];
  comparative?: KpiComparative;
}

export interface AiParagraphBlock extends StoryBlockBase {
  kind: 'ai_paragraph';
  title?: string;
  body: string; // markdown text
}

export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  linkedWorkItemId?: string;
  estimatedImpact?: 'low' | 'medium' | 'high';
  effort?: 'low' | 'medium' | 'high';
}

export interface RecommendationsBlock extends StoryBlockBase {
  kind: 'recommendations';
  headline: string;
  priority: 'now' | 'next' | 'later';
  items: RecommendationItem[];
}

export interface MetaCalloutBlock extends StoryBlockBase {
  kind: 'meta_callout';
  title: string;
  body: string;
  tone: 'info' | 'warning' | 'success';
}

// ============================================================================
// Context Integrity Block Types (Context Graph Integration)
// ============================================================================

export interface ContextIntegrityItem {
  key: string;
  label: string;
  status: string;
  confidence: number;
  freshness: number;
  isHumanOverride: boolean;
}

export interface ContextIntegrityBlock extends StoryBlockBase {
  kind: 'context_integrity';
  conflicted: number;
  overrides: number;
  stale: number;
  lowConfidence: number;
  items: ContextIntegrityItem[];
}

export interface GlobalContextHealthBlock extends StoryBlockBase {
  kind: 'global_context_health';
  totals: {
    conflicted: number;
    overrides: number;
    stale: number;
    lowConfidence: number;
  };
}

export type StoryBlock =
  | SectionIntroBlock
  | NodeDeltasBlock
  | InsightClusterBlock
  | KpiChartBlock
  | AiParagraphBlock
  | RecommendationsBlock
  | MetaCalloutBlock
  | ContextIntegrityBlock
  | GlobalContextHealthBlock;

// ============================================================================
// Story Chapters
// ============================================================================

export interface ChapterScoreDelta {
  before: number;
  after: number;
  change: number;
}

export interface ChapterAutoDetectedState {
  win?: boolean;
  regression?: boolean;
  mixed?: boolean;
}

export interface QbrStoryChapter {
  id: string;
  domain: QbrDomain;
  title: string;
  scoreDelta?: ChapterScoreDelta;
  autoDetectedState?: ChapterAutoDetectedState;
  blocks: StoryBlock[];
}

// ============================================================================
// Complete Story
// ============================================================================

export interface QbrStory {
  meta: QbrStoryMeta;
  globalBlocks: StoryBlock[];
  chapters: QbrStoryChapter[];
}

// ============================================================================
// Domain Bundle (for AI generation)
// ============================================================================

export interface DomainKpiMetric {
  metricKey: string;
  label: string;
  thisQuarter: number;
  prevQuarter: number;
  deltaPct: number;
  trend: 'up' | 'down' | 'flat';
}

export interface DomainWorkItem {
  id: string;
  title: string;
  status: 'done' | 'in_progress' | 'planned';
}

export interface ContextIntegritySummary {
  conflicted: number;
  overrides: number;
  stale: number;
  lowConfidence: number;
  problematicFields: ContextIntegrityItem[];
}

export interface DomainBundle {
  domain: QbrDomain;
  strategicRole: string;
  scoreBefore?: number;
  scoreAfter?: number;
  contextDeltas: GraphDeltaItem[];
  topInsights: InsightItem[];
  kpiSummary: {
    keyMetrics: DomainKpiMetric[];
  };
  workSummary: {
    completed: number;
    created: number;
    keyWorkItems: DomainWorkItem[];
  };
  gapAndLabsSummary: {
    runs: Array<{
      id: string;
      toolSlug: string;
      completedAt: string;
      summary?: string;
    }>;
  };
  /** Context Graph integrity data for this domain */
  contextIntegrity?: ContextIntegritySummary;
}

export interface GlobalContextSummary {
  totalConflicted: number;
  totalOverrides: number;
  totalStale: number;
  totalLowConfidence: number;
}

export interface GlobalSummary {
  topWins: string[];
  topRisks: string[];
  headlineMetrics: DomainKpiMetric[];
  /** Global context integrity summary */
  globalContextSummary?: GlobalContextSummary;
}

export interface DomainBundleRoot {
  global: GlobalSummary;
  domains: DomainBundle[];
}

// ============================================================================
// Helper Functions
// ============================================================================

export function domainToTitle(domain: QbrDomain): string {
  switch (domain) {
    case 'strategy':
      return 'Strategy & Direction';
    case 'website':
      return 'Website & Conversion';
    case 'seo':
      return 'SEO & Visibility';
    case 'content':
      return 'Content & Messaging';
    case 'brand':
      return 'Brand & Identity';
    case 'audience':
      return 'Audience & Segments';
    case 'media':
      return 'Media & Demand';
    case 'analytics':
      return 'Analytics & Measurement';
    case 'competitive':
      return 'Competitive Landscape';
    default:
      return domain;
  }
}

export function domainToStrategicRole(domain: QbrDomain): string {
  switch (domain) {
    case 'strategy':
      return 'Overall marketing direction & strategic focus';
    case 'website':
      return 'Owned web experience and conversion funnel';
    case 'seo':
      return 'Organic visibility and search demand capture';
    case 'content':
      return 'Narrative, messaging, and content system';
    case 'brand':
      return 'Positioning, identity, and trust signals';
    case 'audience':
      return 'Segments, personas, and ICP alignment';
    case 'media':
      return 'Paid media and demand generation performance';
    case 'analytics':
      return 'Measurement, tracking, and decision support';
    case 'competitive':
      return 'Competitive intelligence and market positioning';
    default:
      return domain;
  }
}

/**
 * Parse a quarter string like "2025-Q4" into year and quarter number
 */
export function parseQuarter(quarter: QuarterId): { year: number; q: number } {
  const match = quarter.match(/^(\d{4})-Q([1-4])$/);
  if (!match) {
    throw new Error(`Invalid quarter format: ${quarter}`);
  }
  return {
    year: parseInt(match[1], 10),
    q: parseInt(match[2], 10),
  };
}

/**
 * Get the date range for a quarter
 */
export function getQuarterDateRange(quarter: QuarterId): { start: Date; end: Date } {
  const { year, q } = parseQuarter(quarter);
  const startMonth = (q - 1) * 3; // 0, 3, 6, 9
  const endMonth = startMonth + 3;

  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, endMonth, 0, 23, 59, 59, 999), // Last day of end month
  };
}

/**
 * Get the current quarter ID
 */
export function getCurrentQuarter(): QuarterId {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const q = Math.floor(month / 3) + 1;
  return `${year}-Q${q}`;
}

/**
 * Get the previous quarter ID
 */
export function getPreviousQuarter(quarter: QuarterId): QuarterId {
  const { year, q } = parseQuarter(quarter);
  if (q === 1) {
    return `${year - 1}-Q4`;
  }
  return `${year}-Q${q - 1}`;
}
