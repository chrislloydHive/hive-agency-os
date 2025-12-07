// lib/reports/types.ts
// Report Types & Schema for Hive OS Reports Module
//
// Supports:
// - Annual Plan: Yearly strategic and marketing plan
// - QBR: Quarterly Business Review
// - Future report types (extensible)

import { z } from 'zod';

// ============================================================================
// Report Types
// ============================================================================

export const ReportTypeSchema = z.enum(['annual', 'qbr']);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const REPORT_TYPE_CONFIG: Record<ReportType, {
  name: string;
  description: string;
  icon: string;
  color: string;
}> = {
  annual: {
    name: 'Annual Plan',
    description: 'High-level yearly strategic and marketing plan for the company.',
    icon: 'calendar',
    color: 'emerald',
  },
  qbr: {
    name: 'Quarterly Business Review',
    description: 'AI narrative summarizing performance, insights, deltas, and recommended next moves.',
    icon: 'bar-chart',
    color: 'cyan',
  },
};

// ============================================================================
// Report Block Types
// ============================================================================

export const ReportBlockKindSchema = z.enum([
  'section_heading',
  'paragraph',
  'insight',
  'kpi_chart',
  'delta',
  'recommendation',
  'list',
  'quote',
  'metric_block',
  'swot',
  'pillar',
  'initiative',
  'risk',
  'budget_mix',
]);

export type ReportBlockKind = z.infer<typeof ReportBlockKindSchema>;

// ============================================================================
// Report Block Definitions
// ============================================================================

export interface ReportBlockBase {
  id: string;
  kind: ReportBlockKind;
  order: number;
}

export interface SectionHeadingBlock extends ReportBlockBase {
  kind: 'section_heading';
  title: string;
  subtitle?: string;
  level: 1 | 2 | 3;
}

export interface ParagraphBlock extends ReportBlockBase {
  kind: 'paragraph';
  title?: string;
  body: string; // markdown
}

export interface InsightBlock extends ReportBlockBase {
  kind: 'insight';
  title: string;
  body: string;
  severity: 'low' | 'medium' | 'high';
  category: 'win' | 'risk' | 'opportunity' | 'regression';
  domain?: string;
}

export interface KpiChartBlock extends ReportBlockBase {
  kind: 'kpi_chart';
  metricKey: string;
  label: string;
  chartType: 'line' | 'bar' | 'sparkline' | 'bullet';
  values: Array<{ ts: string; value: number }>;
  target?: number;
  comparative?: {
    baselineAvg?: number;
    deltaPct?: number;
  };
}

export interface DeltaBlock extends ReportBlockBase {
  kind: 'delta';
  label: string;
  changeType: 'added' | 'removed' | 'strengthened' | 'weakened';
  beforeValue?: string | number;
  afterValue?: string | number;
  delta?: number;
  comment?: string;
}

export interface RecommendationBlock extends ReportBlockBase {
  kind: 'recommendation';
  headline: string;
  priority: 'now' | 'next' | 'later';
  items: Array<{
    id: string;
    title: string;
    description: string;
    estimatedImpact?: 'low' | 'medium' | 'high';
    effort?: 'low' | 'medium' | 'high';
    linkedWorkItemId?: string;
  }>;
}

export interface ListBlock extends ReportBlockBase {
  kind: 'list';
  title?: string;
  style: 'bullet' | 'numbered' | 'checklist';
  items: string[];
}

export interface QuoteBlock extends ReportBlockBase {
  kind: 'quote';
  text: string;
  attribution?: string;
}

export interface MetricBlockItem {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'flat';
  delta?: string;
}

export interface MetricBlock extends ReportBlockBase {
  kind: 'metric_block';
  title?: string;
  metrics: MetricBlockItem[];
}

// Annual Plan specific blocks
export interface SwotBlock extends ReportBlockBase {
  kind: 'swot';
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface PillarBlock extends ReportBlockBase {
  kind: 'pillar';
  name: string;
  description: string;
  objectives: string[];
  keyResults: string[];
}

export interface InitiativeBlock extends ReportBlockBase {
  kind: 'initiative';
  name: string;
  description: string;
  quarter: string;
  owner?: string;
  dependencies?: string[];
  expectedOutcome: string;
}

export interface RiskBlock extends ReportBlockBase {
  kind: 'risk';
  risks: Array<{
    id: string;
    title: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
}

export interface BudgetMixBlock extends ReportBlockBase {
  kind: 'budget_mix';
  allocations: Array<{
    channel: string;
    percentage: number;
    amount?: number;
    rationale?: string;
  }>;
  totalBudget?: number;
}

export type ReportBlock =
  | SectionHeadingBlock
  | ParagraphBlock
  | InsightBlock
  | KpiChartBlock
  | DeltaBlock
  | RecommendationBlock
  | ListBlock
  | QuoteBlock
  | MetricBlock
  | SwotBlock
  | PillarBlock
  | InitiativeBlock
  | RiskBlock
  | BudgetMixBlock;

// ============================================================================
// Report Section (grouping of blocks)
// ============================================================================

export interface ReportSection {
  id: string;
  title: string;
  order: number;
  blocks: ReportBlock[];
}

// ============================================================================
// Complete Report
// ============================================================================

export type ReportStatus = 'draft' | 'finalized' | 'archived';

export interface ReportMeta {
  id: string;
  companyId: string;
  type: ReportType;
  title: string;
  period?: string; // e.g., "2025" for annual, "2025-Q4" for QBR
  createdAt: string;
  updatedAt: string;
  generatedBy: 'ai' | 'human' | 'hybrid';
  status: ReportStatus;
  version: number;
  modelVersion?: string;
  dataConfidenceScore?: number; // 0-100
}

export interface CompanyReport {
  meta: ReportMeta;
  sections: ReportSection[];
  // Flattened blocks for simple rendering
  content: ReportBlock[];
}

// ============================================================================
// Report List Item (for hub view)
// ============================================================================

export interface ReportListItem {
  id: string;
  companyId: string;
  type: ReportType;
  title: string;
  period?: string;
  createdAt: string;
  status: ReportStatus;
  version: number;
}

// ============================================================================
// Generation Options
// ============================================================================

export interface ReportGenerationOptions {
  companyId: string;
  type: ReportType;
  period?: string;
  force?: boolean; // Force regeneration even if recent report exists
  regenerationMode?: 'full_rewrite' | 'clarity' | 'shorter' | 'longer';
  sectionToRegenerate?: string; // Only regenerate a specific section
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getReportTypeConfig(type: ReportType) {
  return REPORT_TYPE_CONFIG[type];
}

export function getCurrentYear(): string {
  return new Date().getFullYear().toString();
}

export function getCurrentQuarter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${year}-Q${q}`;
}

export function getPeriodForType(type: ReportType): string {
  switch (type) {
    case 'annual':
      return getCurrentYear();
    case 'qbr':
      return getCurrentQuarter();
    default:
      return getCurrentYear();
  }
}

export function formatPeriod(period: string, type: ReportType): string {
  if (type === 'annual') {
    return period; // Just the year
  }
  if (type === 'qbr') {
    // Convert "2025-Q4" to "Q4 2025"
    const match = period.match(/^(\d{4})-Q([1-4])$/);
    if (match) {
      return `Q${match[2]} ${match[1]}`;
    }
  }
  return period;
}

export function createEmptyReport(
  companyId: string,
  type: ReportType,
  period?: string
): CompanyReport {
  const now = new Date().toISOString();
  const actualPeriod = period || getPeriodForType(type);
  const config = getReportTypeConfig(type);

  return {
    meta: {
      id: `${companyId}-${type}-${actualPeriod}-${Date.now()}`,
      companyId,
      type,
      title: `${config.name} - ${formatPeriod(actualPeriod, type)}`,
      period: actualPeriod,
      createdAt: now,
      updatedAt: now,
      generatedBy: 'ai',
      status: 'draft',
      version: 1,
    },
    sections: [],
    content: [],
  };
}
