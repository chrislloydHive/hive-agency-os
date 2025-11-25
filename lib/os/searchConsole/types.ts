// lib/os/searchConsole/types.ts
// Search Console Snapshot Types for Hive OS

// ============================================================================
// Date Range
// ============================================================================

export type SearchConsoleDateRange = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

// ============================================================================
// Summary Metrics
// ============================================================================

export type SearchConsoleSummaryMetrics = {
  clicks: number;
  impressions: number;
  ctr: number; // 0–1 decimal
  avgPosition: number | null;
};

// ============================================================================
// Dimension-Specific Items
// ============================================================================

export type SearchConsoleTopQuery = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0–1 decimal
  avgPosition: number | null;
};

export type SearchConsoleTopPage = {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0–1 decimal
  avgPosition: number | null;
};

export type SearchConsoleTopCountry = {
  country: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0–1 decimal
  avgPosition: number | null;
};

export type SearchConsoleTopDevice = {
  device: string; // DESKTOP, MOBILE, TABLET
  clicks: number;
  impressions: number;
  ctr: number; // 0–1 decimal
  avgPosition: number | null;
};

// ============================================================================
// Main Snapshot
// ============================================================================

export type SearchConsoleSnapshot = {
  siteUrl: string;
  range: SearchConsoleDateRange;
  generatedAt: string;

  summary: SearchConsoleSummaryMetrics;

  topQueries: SearchConsoleTopQuery[];
  topPages: SearchConsoleTopPage[];
  topCountries: SearchConsoleTopCountry[];
  topDevices: SearchConsoleTopDevice[];

  // Future additions:
  // urlIssues?: SearchConsoleUrlIssue[];
};

// ============================================================================
// AI Insights Types
// ============================================================================

export type SearchInsightType = 'opportunity' | 'warning' | 'neutral';

export type SearchConsoleKeyInsight = {
  type: SearchInsightType;
  title: string;
  detail: string;
  evidence: string;
};

export type SearchConsoleExperiment = {
  name: string;
  hypothesis: string;
  steps: string[];
  successMetric: string;
};

export type SearchConsoleHeadlineMetric = {
  label: string;
  value: string;
  changeVsPreviousPeriod: string | null;
};

export type SearchConsoleAIInsights = {
  summary: string;
  headlineMetrics: SearchConsoleHeadlineMetric[];
  keyInsights: SearchConsoleKeyInsight[];
  quickWins: string[];
  experiments: SearchConsoleExperiment[];
};
