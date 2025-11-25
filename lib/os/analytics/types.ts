// lib/os/analytics/types.ts
// Workspace Analytics Types for Hive OS

// ============================================================================
// Date Ranges
// ============================================================================

export type DateRangePreset = '7d' | '30d' | '90d';

export interface WorkspaceDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  preset: DateRangePreset;
}

// ============================================================================
// GA4 Types
// ============================================================================

export interface Ga4TrafficSummary {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number | null;
  avgSessionDurationSeconds: number | null;
}

export interface Ga4ChannelBreakdownItem {
  channel: string;
  sessions: number;
  users: number;
  conversions: number | null;
}

export interface Ga4LandingPageItem {
  path: string;
  sessions: number;
  users: number;
  conversions: number | null;
  bounceRate: number | null;
}

// ============================================================================
// GSC Types
// ============================================================================

export interface GscQueryItem {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}

export interface GscPageItem {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}

// ============================================================================
// Funnel Types
// ============================================================================

export interface FunnelStageMetrics {
  label: string; // e.g., "Sessions", "Audits Started"
  value: number;
  prevValue: number | null; // for comparison, if available
}

export interface WorkspaceFunnelSummary {
  stages: FunnelStageMetrics[];
}

// ============================================================================
// Alerts Types
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertCategory =
  | 'traffic'
  | 'search'
  | 'funnel'
  | 'clientHealth'
  | 'other';

export interface AnalyticsAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  detail: string;
  hint?: string;
  linkHref?: string | null;
}

// ============================================================================
// AI Insights Types
// ============================================================================

export interface HeadlineMetric {
  label: string;
  value: string;
  changeVsPrevious: string | null;
}

export interface KeyIssue {
  category: 'traffic' | 'search' | 'funnel' | 'conversion' | 'other';
  title: string;
  detail: string;
}

export interface Opportunity {
  title: string;
  detail: string;
}

export interface Experiment {
  name: string;
  hypothesis: string;
  steps: string[];
  successMetric: string;
}

export interface SuggestedWorkItem {
  title: string;
  area: 'website' | 'content' | 'seo' | 'demand' | 'ops' | 'other';
  description: string;
  priority: 'low' | 'medium' | 'high';
}

export interface WorkspaceAIInsights {
  summary: string;
  headlineMetrics: HeadlineMetric[];
  keyIssues: KeyIssue[];
  opportunities: Opportunity[];
  quickWins: string[];
  experiments: Experiment[];
  suggestedWorkItems: SuggestedWorkItem[];
}

// ============================================================================
// Overview Aggregate Type
// ============================================================================

export interface WorkspaceAnalyticsOverview {
  range: WorkspaceDateRange;
  ga4: {
    traffic: Ga4TrafficSummary | null;
    channels: Ga4ChannelBreakdownItem[];
    landingPages: Ga4LandingPageItem[];
  };
  gsc: {
    queries: GscQueryItem[];
    pages: GscPageItem[];
  };
  funnel: WorkspaceFunnelSummary | null;
  alerts: AnalyticsAlert[];
  meta: {
    hasGa4: boolean;
    hasGsc: boolean;
    generatedAt: string;
  };
}
