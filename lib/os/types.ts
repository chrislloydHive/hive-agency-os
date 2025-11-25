// lib/os/types.ts
// Comprehensive shared types for Hive OS
// All core data models used across the agency operating system

// ============================================================================
// Core Identifiers
// ============================================================================

export type CompanyId = string;
export type WorkItemId = string;
export type OpportunityId = string;
export type DiagnosticRunId = string;

// ============================================================================
// Company
// ============================================================================

/**
 * Company interface for OS views.
 * NOTE: Companies is a lean identity + CRM table.
 * All diagnostics, scores, priorities, plans, and evidence live in the Full Reports table.
 * Gap Runs tracks pipeline execution; Work Items tracks initiatives.
 */
export interface Company {
  id: CompanyId;
  name: string;
  websiteUrl: string;
  domain?: string;
  industry?: string;
  stage?: CompanyStage;
  companyType?: CompanyType;
  sizeBand?: CompanySizeBand;
  region?: string;
  owner?: string;
  source?: CompanySource;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactRole?: string;
  notes?: string;
  health?: CompanyHealth;
  createdAt?: string;
  updatedAt?: string;
  // Derived fields from Full Reports
  latestOverallScore?: number;
  lastSnapshotAt?: string;
  snapshotId?: string;
  fullReportId?: string;
  snapshotReportUrl?: string;
  fullReportUrl?: string;
  // Legacy fields (deprecated)
  leadId?: string;
  email?: string;
  status?: 'new' | 'in_progress' | 'active' | 'paused' | 'closed';
  submissionDate?: string;
  fullReportDate?: string;
}

export type CompanyStage =
  | 'Lead'
  | 'Prospect'
  | 'Client'
  | 'Churned'
  | 'Partner';

export type CompanyType =
  | 'SaaS'
  | 'Services'
  | 'Marketplace'
  | 'eCom'
  | 'Local'
  | 'Other';

export type CompanySizeBand =
  | '1–10'
  | '11–50'
  | '51–200'
  | '200+';

export type CompanySource =
  | 'Referral'
  | 'Inbound'
  | 'Outbound'
  | 'Internal'
  | 'Other';

export type CompanyHealth =
  | 'healthy'
  | 'at-risk'
  | 'critical'
  | 'unknown';

// ============================================================================
// Company Overview (for company detail pages)
// ============================================================================

export interface CompanyOverview {
  company: Company;
  health: CompanyHealth;
  healthReasons: string[];

  // Scores
  scores: {
    overall: number | null;
    brand: number | null;
    content: number | null;
    seo: number | null;
    websiteUx: number | null;
    funnel: number | null;
  };
  scoreTrend: 'up' | 'down' | 'stable' | 'unknown';

  // Activity summary (last 30 days)
  activity: {
    lastGapAssessment: string | null;
    lastGapPlan: string | null;
    lastDiagnostic: string | null;
    workItemsCompleted: number;
    workItemsInProgress: number;
    workItemsOverdue: number;
  };

  // Counts
  counts: {
    totalWorkItems: number;
    totalDiagnosticRuns: number;
    totalGapRuns: number;
    totalOpportunities: number;
  };
}

// ============================================================================
// Work Items
// ============================================================================

export interface WorkItem {
  id: WorkItemId;
  companyId: CompanyId;
  companyName?: string;
  fullReportId?: string;
  title: string;
  description?: string;
  area: WorkItemArea;
  status: WorkItemStatus;
  severity: WorkItemSeverity;
  owner?: string;
  dueDate?: string;
  notes?: string;
  priorityId?: string;
  planInitiativeId?: string;
  effort?: WorkItemEffort;
  impact?: WorkItemImpact;
  createdAt?: string;
  updatedAt?: string;
}

export type WorkItemArea =
  | 'Brand'
  | 'Content'
  | 'SEO'
  | 'Website UX'
  | 'Funnel'
  | 'Other';

export type WorkItemStatus =
  | 'Backlog'
  | 'Planned'
  | 'In Progress'
  | 'Done';

export type WorkItemSeverity =
  | 'Critical'
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Info';

export type WorkItemEffort = 'Low' | 'Medium' | 'High';
export type WorkItemImpact = 'Low' | 'Medium' | 'High';

// ============================================================================
// Opportunities (Pipeline)
// ============================================================================

export interface Opportunity {
  id: OpportunityId;
  companyId?: CompanyId;
  companyName?: string;
  title: string;
  description: string;
  source: OpportunitySource;
  sourceDetail?: string;
  area: OpportunityArea;
  status: OpportunityStatus;
  priority: OpportunityPriority;
  estimatedValue?: number;
  estimatedEffort?: WorkItemEffort;
  estimatedImpact?: WorkItemImpact;
  dueDate?: string;
  owner?: string;
  linkedWorkItemId?: WorkItemId;
  linkedDiagnosticRunId?: DiagnosticRunId;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export type OpportunitySource =
  | 'diagnostics'          // From diagnostic findings
  | 'analytics'            // From GA4/GSC anomalies
  | 'client-health'        // From at-risk detection
  | 'content-gap'          // Missing content opportunities
  | 'seo-weakness'         // SEO issues found
  | 'website-ux'           // UX problems
  | 'brand-consistency'    // Brand issues
  | 'expired-plan'         // Client with expired/old plan
  | 'manual'               // Manually created
  | 'ai-suggested';        // AI recommended

export type OpportunityArea =
  | 'Brand'
  | 'Content'
  | 'SEO'
  | 'Website UX'
  | 'Funnel'
  | 'Analytics'
  | 'Strategy'
  | 'Operations';

export type OpportunityStatus =
  | 'new'
  | 'qualified'
  | 'in-progress'
  | 'converted'      // Converted to work item
  | 'dismissed'
  | 'won'
  | 'lost';

export type OpportunityPriority = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Diagnostics
// ============================================================================

export interface DiagnosticRun {
  id: DiagnosticRunId;
  companyId: CompanyId;
  companyName?: string;
  toolId: DiagnosticToolId;
  status: DiagnosticStatus;
  summary?: string;
  score?: number;
  findings?: DiagnosticFinding[];
  rawJson?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export type DiagnosticToolId =
  | 'gapSnapshot'
  | 'gapPlan'
  | 'websiteLab'
  | 'brandLab'
  | 'contentLab'
  | 'seoLab'
  | 'demandLab'
  | 'opsLab';

export type DiagnosticStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed';

export interface DiagnosticFinding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  area: string;
  evidence?: string;
  recommendation?: string;
}

export interface DiagnosticSummary {
  companyId: CompanyId;
  lastRunAt?: string;
  totalRuns: number;
  byTool: Record<DiagnosticToolId, {
    lastRun?: DiagnosticRun;
    totalRuns: number;
    latestScore?: number;
  }>;
  recentFindings: DiagnosticFinding[];
  issueCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ============================================================================
// AI Briefing
// ============================================================================

export interface Briefing {
  id: string;
  generatedAt: string;
  companyId?: CompanyId; // If scoped to a company

  headline: string;
  summary: string;

  todayFocus: BriefingFocusItem[];
  risks: BriefingRisk[];
  opportunities: BriefingOpportunity[];

  dataSnapshot: {
    companiesCount: number;
    atRiskCount: number;
    workOverdue: number;
    workDueToday: number;
    activeOpportunities: number;
    recentDiagnostics: number;
  };
}

export interface BriefingFocusItem {
  area: BriefingArea;
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  linkType: BriefingLinkType;
  linkHref: string | null;
  companyId?: CompanyId;
  companyName?: string;
}

export interface BriefingRisk {
  title: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium';
  companyId?: CompanyId;
  companyName?: string;
}

export interface BriefingOpportunity {
  title: string;
  detail: string;
  potentialValue?: string;
  companyId?: CompanyId;
  companyName?: string;
}

export type BriefingArea =
  | 'clients'
  | 'work'
  | 'pipeline'
  | 'analytics'
  | 'diagnostics'
  | 'strategy';

export type BriefingLinkType =
  | 'company'
  | 'work'
  | 'opportunity'
  | 'analytics'
  | 'diagnostic'
  | 'none';

// ============================================================================
// Analytics
// ============================================================================

export interface WorkspaceAnalytics {
  period: {
    startDate: string;
    endDate: string;
  };
  generatedAt: string;

  traffic: TrafficMetrics;
  trafficTrend: MetricTrend;

  channels: ChannelMetrics[];
  channelTrends: Record<string, MetricTrend>;

  topPages: PageMetrics[];

  searchMetrics: SearchMetrics;
  searchTrend: MetricTrend;

  anomalies: AnalyticsAnomaly[];
  insights: AnalyticsInsight[];
}

export interface TrafficMetrics {
  users: number | null;
  sessions: number | null;
  pageviews: number | null;
  avgSessionDuration: number | null;
  bounceRate: number | null;
  newUserRate: number | null;
}

export interface ChannelMetrics {
  channel: string;
  users: number;
  sessions: number;
  conversions: number | null;
  conversionRate: number | null;
}

export interface PageMetrics {
  path: string;
  title?: string;
  sessions: number;
  users: number;
  avgEngagementTime: number | null;
  bounceRate: number | null;
  conversions: number | null;
}

export interface SearchMetrics {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: SearchQueryMetrics[];
  topPages: SearchPageMetrics[];
}

export interface SearchQueryMetrics {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

export interface SearchPageMetrics {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

export type MetricTrend = {
  direction: 'up' | 'down' | 'stable';
  percentChange: number;
  previousValue: number | null;
  currentValue: number | null;
};

export interface AnalyticsAnomaly {
  id: string;
  type: 'spike' | 'drop' | 'trend-change' | 'threshold-breach';
  metric: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  detectedAt: string;
  value: number;
  expectedValue: number;
  percentDeviation: number;
}

export interface AnalyticsInsight {
  id: string;
  title: string;
  description: string;
  area: 'traffic' | 'conversion' | 'content' | 'seo' | 'technical';
  impact: 'high' | 'medium' | 'low';
  recommendation?: string;
  linkedAnomaly?: string;
}

// ============================================================================
// GA4 Analytics (Raw Data)
// ============================================================================

export interface GA4Analytics {
  propertyId: string;
  period: { startDate: string; endDate: string };

  traffic: TrafficMetrics;
  channels: ChannelMetrics[];
  landingPages: PageMetrics[];

  // Event tracking
  events?: GA4Event[];
  conversions?: GA4Conversion[];

  // Comparison data
  previousPeriod?: {
    traffic: TrafficMetrics;
    channels: ChannelMetrics[];
  };
}

export interface GA4Event {
  name: string;
  count: number;
  users: number;
}

export interface GA4Conversion {
  name: string;
  count: number;
  value: number | null;
}

// ============================================================================
// GSC Analytics (Raw Data)
// ============================================================================

export interface GSCAnalytics {
  siteUrl: string;
  period: { startDate: string; endDate: string };

  summary: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
  };

  queries: SearchQueryMetrics[];
  pages: SearchPageMetrics[];

  // By dimension
  byDevice?: { device: string; clicks: number; impressions: number }[];
  byCountry?: { country: string; clicks: number; impressions: number }[];

  // Comparison data
  previousPeriod?: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
  };
}

// ============================================================================
// Legacy Types (for backward compatibility)
// ============================================================================

export interface Snapshot {
  id: string;
  companyId: CompanyId;
  createdAt: string;
  source: 'snapshot_form' | 'manual' | 'import';
  notes?: string;
}

export interface Diagnostics {
  companyId: CompanyId;
  snapshotId: string;
  overallScore: number;
  websiteScore: number;
  brandScore: number;
  contentScore: number;
  seoScore: number;
  keyIssues: string[];
}

export interface PriorityItem {
  id: string;
  companyId: CompanyId;
  title: string;
  description: string;
  summary?: string;
  rationale?: string;
  impact: number | string;
  effort: number | string;
  severity?: string;
  category: 'website' | 'brand' | 'content' | 'seo' | 'funnel' | 'strategy';
  area?: string;
  pillar?: string;
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface GrowthPlan {
  companyId: CompanyId;
  snapshotId: string;
  headlineSummary: string;
  recommendedFocusAreas: string[];
  planSections: Array<{
    id: string;
    title: string;
    summary: string;
    recommendedActions: string[];
  }>;
}

export interface ScorecardPoint {
  date: string;
  overallScore?: number;
  traffic?: number;
  leads?: number;
  notes?: string;
}

export interface CompanyScorecard {
  companyId: CompanyId;
  history: ScorecardPoint[];
}

// ============================================================================
// Dashboard Summary Types (re-exported for convenience)
// ============================================================================

export interface DashboardClientHealth {
  atRisk: Array<{
    companyId: string;
    name: string;
    domain?: string;
    reason: string;
    stage: string;
    owner?: string | null;
  }>;
  newClients: Array<{
    companyId: string;
    name: string;
    stage: string;
    createdAt: string;
  }>;
}

export interface DashboardWorkSummary {
  today: number;
  overdue: number;
  mineToday: number;
  items: Array<{
    id: string;
    title: string;
    companyId?: string;
    companyName?: string;
    dueDate?: string;
    status: string;
    owner?: string | null;
  }>;
}

export interface DashboardPipelineSummary {
  newLeads30d: number;
  activeOpportunities: number;
  pipelineValue?: number | null;
  byStage: Array<{
    stage: string;
    count: number;
    value?: number | null;
  }>;
}

export interface DashboardGrowthSummary {
  sessions30d: number | null;
  users30d: number | null;
  dmaAuditsStarted30d: number | null;
  searchClicks30d: number | null;
}

export interface DashboardSummary {
  companiesCount: number;
  gapAssessments30d: number;
  gapPlans30d: number;
  clientHealth: DashboardClientHealth;
  work: DashboardWorkSummary;
  pipeline: DashboardPipelineSummary;
  growth: DashboardGrowthSummary;
  recentGap: {
    assessments: Array<{
      id: string;
      companyId?: string;
      companyName?: string;
      domain?: string;
      score?: number | null;
      createdAt: string;
    }>;
    plans: Array<{
      id: string;
      companyId?: string;
      companyName?: string;
      theme?: string | null;
      createdAt: string;
      status?: string | null;
    }>;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export type SortDirection = 'asc' | 'desc';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface FilterParams {
  companyId?: CompanyId;
  status?: string[];
  area?: string[];
  owner?: string;
  dateRange?: DateRange;
  search?: string;
}
