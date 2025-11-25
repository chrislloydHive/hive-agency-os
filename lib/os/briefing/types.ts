// lib/os/briefing/types.ts
// Comprehensive types for Hive OS Briefing Engine
// Defines both the input shape (normalized data) and output shape (AI-generated briefing)

// ============================================================================
// Input Types (data we collect and pass to AI)
// ============================================================================

/**
 * Client health summary for the briefing input
 */
export type BriefingInputClientHealth = {
  totalCompanies: number;
  clientCount: number;
  prospectCount: number;
  atRiskClients: {
    id: string;
    name: string;
    stage: string;
    domain?: string | null;
    reason: string; // e.g. "No GAP in last 90 days", "Traffic down 30%"
    lastGapDate?: string | null;
  }[];
  newClientsLast7d: {
    id: string;
    name: string;
    addedAt: string;
  }[];
};

/**
 * Work items summary for the briefing input
 */
export type BriefingInputWorkSummary = {
  totalActive: number;
  dueToday: number;
  overdue: number;
  mineToday?: number;
  backlogItems: {
    id: string;
    companyId?: string | null;
    companyName?: string | null;
    title: string;
    status: string;
    area?: string | null;
    dueDate?: string | null;
  }[];
};

/**
 * Pipeline summary for the briefing input
 */
export type BriefingInputPipelineSummary = {
  newLeadsLast30d: number;
  activeOpportunities: number;
  recentLeads?: {
    id: string;
    companyName: string;
    createdAt: string;
    stage?: string;
  }[];
};

/**
 * GAP activity summary for the briefing input
 */
export type BriefingInputGapSummary = {
  assessmentsLast30d: number;
  plansLast30d: number;
  recentAssessments: {
    companyName: string;
    createdAt: string;
  }[];
  recentPlans: {
    companyName: string;
    createdAt: string;
  }[];
};

/**
 * Growth analytics summary for the briefing input
 */
export type BriefingInputGrowthAnalyticsSummary = {
  ga4?: {
    sessions30d?: number | null;
    users30d?: number | null;
    dmaAudits30d?: number | null;
    searchClicks30d?: number | null;
    trendLabel?: string; // e.g. "Sessions up 18% vs prior 30 days"
  };
  searchConsole?: {
    clicks: number;
    impressions: number;
    ctr: number;
    avgPosition: number | null;
    notableQueries?: {
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      avgPosition: number | null;
    }[];
    notablePages?: {
      url: string;
      clicks: number;
      impressions: number;
      ctr: number;
      avgPosition: number | null;
    }[];
  };
};

/**
 * Complete input for the Hive OS Briefing AI
 * This is built from various data sources (Airtable, GA4, GSC)
 */
export type HiveOsBriefingInput = {
  date: string; // ISO timestamp
  timezone: string; // e.g. "America/Los_Angeles"
  clientHealth: BriefingInputClientHealth;
  workSummary: BriefingInputWorkSummary;
  pipelineSummary: BriefingInputPipelineSummary;
  gapSummary: BriefingInputGapSummary;
  growthAnalytics: BriefingInputGrowthAnalyticsSummary;
};

// ============================================================================
// Output Types (what the AI returns and the UI renders)
// ============================================================================

/**
 * Focus item type categories
 */
export type HiveOsBriefingFocusType =
  | 'client'
  | 'work'
  | 'pipeline'
  | 'growth'
  | 'risk';

/**
 * Focus item priority levels
 */
export type HiveOsBriefingPriority = 'high' | 'medium' | 'low';

/**
 * Individual focus item for today's briefing
 */
export type HiveOsBriefingFocusItem = {
  type: HiveOsBriefingFocusType;
  title: string;
  description: string;
  companyId?: string | null;
  companyName?: string | null;
  priority?: HiveOsBriefingPriority;
};

/**
 * Risk severity levels
 */
export type HiveOsBriefingRiskSeverity = 'high' | 'medium' | 'low';

/**
 * Risk item to watch
 */
export type HiveOsBriefingRisk = {
  title: string;
  description: string;
  severity: HiveOsBriefingRiskSeverity;
};

/**
 * Complete AI-generated briefing output
 * This is what the dashboard renders
 */
export type HiveOsBriefing = {
  date: string; // ISO timestamp
  summary: string; // 1–2 paragraphs executive summary
  todayFocus: HiveOsBriefingFocusItem[];
  clientHealthNotes: string[];
  workAndDeliveryNotes: string[];
  growthAnalyticsNotes: string[];
  risksToWatch: HiveOsBriefingRisk[];
};

// ============================================================================
// API Response Types
// ============================================================================

/**
 * API response shape for /api/os/briefing
 */
export type HiveOsBriefingApiResponse = {
  ok: boolean;
  error?: string;
  input?: HiveOsBriefingInput;
  briefing?: HiveOsBriefing;
  generatedAt?: string;
};
