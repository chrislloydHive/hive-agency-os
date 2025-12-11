// lib/os/insights/insightTypes.client.ts
// Client-safe types for the Insight Engine
// Import these in client components to avoid server-side code bundling

export type InsightType =
  | 'score_regression'
  | 'score_improvement'
  | 'emerging_risk'
  | 'opportunity'
  | 'trend'
  | 'anomaly'
  | 'milestone'
  | 'stale_data'
  | 'competitive_shift'
  | 'seasonal_pattern';

export type InsightTheme =
  | 'performance'
  | 'visibility'
  | 'brand'
  | 'content'
  | 'local'
  | 'social'
  | 'competition'
  | 'overall';

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive';

export type InsightTimeframe = 'immediate' | 'this_week' | 'this_month' | 'this_quarter';

export interface InsightEvidence {
  type: 'metric' | 'comparison' | 'trend' | 'external';
  label: string;
  currentValue: string | number;
  previousValue?: string | number;
  changePercent?: number;
  comparisonPeriod?: string;
  source?: string;
}

export interface InsightAction {
  title: string;
  description: string;
  effort: 'quick' | 'moderate' | 'significant';
  linkPath?: string;
  labSlug?: string;
}

export interface Insight {
  id: string;
  type: InsightType;
  theme: InsightTheme;
  severity: InsightSeverity;
  title: string;
  message: string;
  evidence: InsightEvidence[];
  recommendedActions: InsightAction[];
  generatedAt: string;
  timeframe: InsightTimeframe;
  confidence: number;
  relatedLabs?: string[];
  metadata?: Record<string, unknown>;
}

export interface DigestStat {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface DigestSummary {
  headline: string;
  keyStats: DigestStat[];
  sentiment: 'positive' | 'neutral' | 'concerning';
  criticalCount: number;
  opportunityCount: number;
}

export interface DimensionTrend {
  dimension: string;
  currentScore: number | null;
  previousScore: number | null;
  change: number | null;
  direction: 'improving' | 'declining' | 'stable' | 'unknown';
}

export interface HealthTrend {
  currentScore: number | null;
  previousScore: number | null;
  change: number | null;
  direction: 'improving' | 'declining' | 'stable' | 'unknown';
  dimensions: DimensionTrend[];
}

export interface WeeklyInsightDigest {
  companyId: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  summary: DigestSummary;
  insights: Insight[];
  byTheme: Record<InsightTheme, Insight[]>;
  topPriority: Insight[];
  quickWins: Insight[];
  healthTrend: HealthTrend;
}

// ============================================================================
// UI Helper Functions
// ============================================================================

export function getSeverityColorClasses(severity: InsightSeverity): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-300',
        border: 'border-red-500/30',
        icon: 'text-red-400',
      };
    case 'warning':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-300',
        border: 'border-amber-500/30',
        icon: 'text-amber-400',
      };
    case 'positive':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-300',
        border: 'border-emerald-500/30',
        icon: 'text-emerald-400',
      };
    case 'info':
    default:
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-300',
        border: 'border-blue-500/30',
        icon: 'text-blue-400',
      };
  }
}

export function getThemeLabel(theme: InsightTheme): string {
  const labels: Record<InsightTheme, string> = {
    performance: 'Performance',
    visibility: 'Visibility',
    brand: 'Brand',
    content: 'Content',
    local: 'Local',
    social: 'Social',
    competition: 'Competition',
    overall: 'Overall',
  };
  return labels[theme] || theme;
}

export function getTypeLabel(type: InsightType): string {
  const labels: Record<InsightType, string> = {
    score_regression: 'Score Drop',
    score_improvement: 'Score Gain',
    emerging_risk: 'Emerging Risk',
    opportunity: 'Opportunity',
    trend: 'Trend',
    anomaly: 'Anomaly',
    milestone: 'Milestone',
    stale_data: 'Stale Data',
    competitive_shift: 'Competitive Shift',
    seasonal_pattern: 'Seasonal Pattern',
  };
  return labels[type] || type;
}

export function getTimeframeLabel(timeframe: InsightTimeframe): string {
  const labels: Record<InsightTimeframe, string> = {
    immediate: 'Act Now',
    this_week: 'This Week',
    this_month: 'This Month',
    this_quarter: 'This Quarter',
  };
  return labels[timeframe] || timeframe;
}

export function getSeverityIcon(severity: InsightSeverity): string {
  switch (severity) {
    case 'critical':
      return '🚨';
    case 'warning':
      return '⚠️';
    case 'positive':
      return '✅';
    case 'info':
    default:
      return 'ℹ️';
  }
}
