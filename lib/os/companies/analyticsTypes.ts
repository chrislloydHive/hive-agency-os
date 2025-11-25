// lib/os/companies/analyticsTypes.ts
// Types for per-company analytics AI input and output

// ============================================================================
// Date Range Types
// ============================================================================

export type CompanyAnalyticsDateRangePreset = '7d' | '30d' | '90d';

export interface CompanyAnalyticsRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  preset: CompanyAnalyticsDateRangePreset;
}

// ============================================================================
// Input Types (data we collect for a company)
// ============================================================================

export interface CompanyGa4Summary {
  sessions: number;
  users: number;
  conversions?: number | null;
  bounceRate?: number | null;
  avgSessionDuration?: number | null;
}

export interface CompanySearchConsoleSummary {
  clicks: number;
  impressions: number;
  ctr: number; // 0–1
  avgPosition: number | null;
  topQueries?: {
    query: string;
    clicks: number;
    impressions: number;
  }[];
}

export interface CompanyGapDiagnosticsSummary {
  lastGapAssessmentAt?: string | null;
  lastGapPlanAt?: string | null;
  lastGapScore?: number | null;
  lastDiagnosticsAt?: string | null;
  diagnosticsSummary?: string | null; // short text summary if available
  recentDiagnosticsCount?: number;
}

export interface CompanyWorkSummary {
  activeCount: number;
  dueToday: number;
  overdue: number;
  recentItems?: {
    title: string;
    status: string;
    area?: string | null;
    dueDate?: string | null;
  }[];
}

/**
 * Complete analytics input for a company
 * Passed to the AI for generating insights
 */
export interface CompanyAnalyticsInput {
  companyId: string;
  companyName: string;
  domain?: string | null;
  stage?: string | null;
  range: CompanyAnalyticsRange;

  ga4?: CompanyGa4Summary | null;
  searchConsole?: CompanySearchConsoleSummary | null;
  gapDiagnostics: CompanyGapDiagnosticsSummary;
  work: CompanyWorkSummary;
}

// ============================================================================
// Output Types (what the AI returns)
// ============================================================================

export type CompanyAnalyticsInsightType =
  | 'traffic'
  | 'search'
  | 'conversion'
  | 'funnel'
  | 'content'
  | 'technical'
  | 'engagement'
  | 'general'
  | 'other';

export type CompanyAnalyticsWorkArea =
  | 'website'
  | 'content'
  | 'seo'
  | 'demand'
  | 'ops'
  | 'general'
  | 'other';

export type CompanyAnalyticsPriority = 'high' | 'medium' | 'low';

export type CompanyAnalyticsImpact = 'high' | 'medium' | 'low';

export interface CompanyAnalyticsKeyInsight {
  type: CompanyAnalyticsInsightType;
  title: string;
  detail: string;
  evidence?: string;
  category?: 'engagement' | 'search' | 'traffic' | 'conversion' | 'general';
}

export interface CompanyAnalyticsWorkSuggestion {
  title: string;
  area: CompanyAnalyticsWorkArea;
  description: string;
  priority: CompanyAnalyticsPriority;
  reason?: string;
  impact?: CompanyAnalyticsImpact;
  recommendedPriority?: number; // 1-5, where 1 = highest
  implementationGuide?: string; // long-form "how to" instructions (markdown or bullet list)
}

export interface CompanyAnalyticsExperiment {
  name: string;
  hypothesis: string;
  steps: string[];
  successMetric: string;
  expectedImpact?: CompanyAnalyticsImpact;
}

/**
 * AI-generated insights for a company
 * This is what the UI renders
 */
export interface CompanyAnalyticsAiInsight {
  summary: string;
  keyInsights: CompanyAnalyticsKeyInsight[];
  quickWins: string[];
  workSuggestions: CompanyAnalyticsWorkSuggestion[];
  experiments: CompanyAnalyticsExperiment[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface CompanyAnalyticsApiResponse {
  ok: boolean;
  error?: string;
  input?: CompanyAnalyticsInput;
  insights?: CompanyAnalyticsAiInsight;
  generatedAt?: string;
}
