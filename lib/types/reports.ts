// lib/types/reports.ts
// MVP Report types for Monthly Report and QBR Lite
//
// These types define the structure of generated reports that
// combine analytics, context, strategy, and work data.

import type { AnalyticsSnapshotLite } from './analyticsLite';

// ============================================================================
// Monthly Report Types
// ============================================================================

/**
 * Monthly report - a comprehensive monthly review
 */
export interface MonthlyReport {
  id?: string;
  companyId: string;

  // Period
  periodLabel: string; // e.g., "November 2025"
  periodStart: string;
  periodEnd: string;

  // AI-generated content
  executiveSummary: string;
  summary: string; // Alias for executiveSummary for UI compatibility
  analyticsNarrative: string;

  // KPIs
  kpis: AnalyticsSnapshotLite;
  metrics?: Array<{
    label: string;
    value: string | number;
    change?: string;
  }>;

  // Insights and risks
  topInsights: string[];
  highlights: string[]; // Alias for topInsights for UI compatibility
  topRisks: string[];
  concerns: string[]; // Alias for topRisks for UI compatibility

  // Recommendations
  recommendedNextSteps: string[];

  // Work summary
  workSummary?: {
    completedTasks: number;
    totalTasks: number;
    completed: number; // Alias for completedTasks
    inProgress: number;
    planned: number;
    highlights?: string[];
    keyDeliverables?: string[];
    notes?: string;
  };

  // Metadata
  generatedAt: string;
  version?: number;
}

/**
 * Monthly report generation request
 */
export interface GenerateMonthlyReportRequest {
  companyId: string;
  month?: number;
  year?: number;
  period?: {
    start: string; // ISO date
    end: string;   // ISO date
  };
  regenerate?: boolean;
}

// ============================================================================
// QBR Lite Types
// ============================================================================

/**
 * QBR Lite report - a lightweight quarterly business review
 */
export interface QbrLiteReport {
  id?: string;
  companyId: string;

  // Period
  periodLabel: string; // e.g., "Q1 2026"
  periodStart: string;
  periodEnd: string;

  // AI-generated content
  executiveSummary: string;
  summary: string; // Alias for executiveSummary for UI compatibility
  strategyReview: string; // What was the plan, what happened

  // KPIs
  kpiSummary: AnalyticsSnapshotLite;

  // Overall score (0-100)
  overallScore: number;
  scoreBreakdown?: Array<{
    area: string;
    score: number;
    notes?: string;
  }>;

  // Learnings and recommendations
  keyLearnings: string[];

  // Wins and challenges
  wins: string[];
  challenges: string[];
  opportunities: string[];

  // Recommendations
  recommendations: Array<{
    text: string;
    priority: 'high' | 'medium' | 'low';
  }>;

  // Forward-looking
  nextQuarterStrategySummary: string;
  ninetyDayPlanSummary: string;

  // Metadata
  generatedAt: string;
  version?: number;
}

/**
 * QBR Lite generation request
 */
export interface GenerateQbrLiteRequest {
  companyId: string;
  quarter?: number;
  year?: number;
  period?: {
    start: string;
    end: string;
  };
  quarterLabel?: string; // e.g., "Q1 2026"
  regenerate?: boolean;
}

// ============================================================================
// Report Section Types
// ============================================================================

/**
 * Report section for flexible rendering
 */
export interface ReportSection {
  id: string;
  type: 'text' | 'kpis' | 'list' | 'work_summary';
  title: string;
  content: string | string[] | AnalyticsSnapshotLite | MonthlyReport['workSummary'];
  order: number;
}

/**
 * Transform a monthly report into sections for rendering
 */
export function monthlyReportToSections(report: MonthlyReport): ReportSection[] {
  const sections: ReportSection[] = [
    {
      id: 'executive_summary',
      type: 'text',
      title: 'Executive Summary',
      content: report.executiveSummary,
      order: 1,
    },
    {
      id: 'kpis',
      type: 'kpis',
      title: 'Key Performance Indicators',
      content: report.kpis,
      order: 2,
    },
    {
      id: 'analytics_narrative',
      type: 'text',
      title: 'Performance Analysis',
      content: report.analyticsNarrative,
      order: 3,
    },
    {
      id: 'top_insights',
      type: 'list',
      title: 'Top Insights',
      content: report.topInsights,
      order: 4,
    },
    {
      id: 'top_risks',
      type: 'list',
      title: 'Risks & Concerns',
      content: report.topRisks,
      order: 5,
    },
    {
      id: 'recommended_next_steps',
      type: 'list',
      title: 'Recommended Next Steps',
      content: report.recommendedNextSteps,
      order: 6,
    },
  ];

  if (report.workSummary) {
    sections.push({
      id: 'work_summary',
      type: 'work_summary',
      title: 'Work Progress',
      content: report.workSummary,
      order: 7,
    });
  }

  return sections.sort((a, b) => a.order - b.order);
}

/**
 * Transform a QBR Lite report into sections for rendering
 */
export function qbrLiteToSections(report: QbrLiteReport): ReportSection[] {
  const sections: ReportSection[] = [
    {
      id: 'executive_summary',
      type: 'text' as const,
      title: 'Executive Summary',
      content: report.executiveSummary,
      order: 1,
    },
    {
      id: 'kpis',
      type: 'kpis' as const,
      title: 'Quarterly KPIs',
      content: report.kpiSummary,
      order: 2,
    },
    {
      id: 'strategy_review',
      type: 'text' as const,
      title: 'Strategy Review',
      content: report.strategyReview,
      order: 3,
    },
    {
      id: 'key_learnings',
      type: 'list' as const,
      title: 'Key Learnings',
      content: report.keyLearnings,
      order: 4,
    },
    {
      id: 'next_quarter_strategy',
      type: 'text' as const,
      title: 'Next Quarter Strategy',
      content: report.nextQuarterStrategySummary,
      order: 5,
    },
    {
      id: 'ninety_day_plan',
      type: 'text' as const,
      title: '90-Day Plan',
      content: report.ninetyDayPlanSummary,
      order: 6,
    },
  ];
  return sections.sort((a, b) => a.order - b.order);
}

// ============================================================================
// Report Helpers
// ============================================================================

/**
 * Get period label for a date range
 */
export function getPeriodLabel(start: string, end: string, type: 'monthly' | 'quarterly'): string {
  const startDate = new Date(start);

  if (type === 'monthly') {
    return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // Quarterly
  const quarter = Math.floor(startDate.getMonth() / 3) + 1;
  const year = startDate.getFullYear();
  return `Q${quarter} ${year}`;
}

/**
 * Get default period for monthly report (last full month)
 */
export function getLastMonthPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * Get default period for QBR (last full quarter)
 */
export function getLastQuarterPeriod(): { start: string; end: string; quarterLabel: string } {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
  const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const start = new Date(year, lastQuarter * 3, 1);
  const end = new Date(year, lastQuarter * 3 + 3, 0);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    quarterLabel: `Q${lastQuarter + 1} ${year}`,
  };
}
