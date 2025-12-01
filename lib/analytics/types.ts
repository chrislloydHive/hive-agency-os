// lib/analytics/types.ts
// Unified Analytics Types for Hive OS
//
// This module defines the core analytics types used across the system.
// It unifies GA4, Search Console, DMA/GAP funnel data into a cohesive structure.

// ============================================================================
// Date Range Types
// ============================================================================

export type AnalyticsDateRangePreset = '7d' | '30d' | '90d' | 'custom';

export interface AnalyticsDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  preset: AnalyticsDateRangePreset;
}

// ============================================================================
// GA4 Core Metrics
// ============================================================================

export interface Ga4CoreMetrics {
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  bounceRate: number; // 0-1
  avgSessionDuration: number; // seconds
  engagementRate: number; // 0-1
  conversions: number;
  conversionRate: number; // 0-1
}

export interface Ga4TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  conversions: number;
  bounceRate: number;
}

/**
 * Traffic aggregated by marketing channel (organic, paid, social, etc.)
 */
export interface Ga4ChannelTraffic {
  channel: 'organic' | 'paid' | 'social' | 'email' | 'referral' | 'direct' | 'other';
  sessions: number;
  users: number;
  conversions: number;
  bounceRate: number;
  percentOfTotal: number; // 0-1
}

export interface Ga4TopPage {
  path: string;
  pageviews: number;
  users: number;
  avgTimeOnPage: number;
  bounceRate: number;
  entrances: number;
  exits: number;
}

export interface Ga4DeviceBreakdown {
  device: 'desktop' | 'mobile' | 'tablet';
  sessions: number;
  users: number;
  bounceRate: number;
  conversionRate: number;
}

export interface Ga4TimeSeriesPoint {
  date: string; // YYYY-MM-DD
  sessions: number;
  users: number;
  pageviews: number;
  conversions: number;
}

// ============================================================================
// Search Console Types
// ============================================================================

export interface SearchConsoleMetrics {
  clicks: number;
  impressions: number;
  ctr: number; // 0-1
  avgPosition: number;
}

export interface SearchConsoleQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsolePage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleCountry {
  country: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleDevice {
  device: 'DESKTOP' | 'MOBILE' | 'TABLET';
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleTimeSeriesPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// ============================================================================
// DMA/GAP Funnel Types
// ============================================================================

/**
 * DMA Funnel - Digital Marketing Assessment
 * Tracks: audit_started → dma_audit_complete
 */
export interface DmaFunnelMetrics {
  auditsStarted: number;
  auditsCompleted: number;
  completionRate: number; // 0-1
}

/**
 * GAP-IA Funnel - GAP Instant Assessment
 * Tracks: gap_ia_started → gap_ia_complete → gap_ia_report_viewed → gap_ia_cta_clicked
 */
export interface GapIaFunnelMetrics {
  started: number;
  completed: number;
  reportViewed: number;
  ctaClicked: number;
  startToCompleteRate: number; // 0-1
  viewToCtaRate: number; // 0-1
}

/**
 * Full GAP Funnel - Complete GAP Assessment
 * Tracks: gap_started → gap_processing_started → gap_complete → gap_review_cta_clicked
 */
export interface GapFullFunnelMetrics {
  gapStarted: number;
  gapProcessingStarted: number;
  gapComplete: number;
  gapError: number;
  gapReviewCtaClicked: number;
  // Computed rates
  startToCompleteRate: number; // 0-1 (gapComplete / gapStarted)
  completeToReviewRate: number; // 0-1 (gapReviewCtaClicked / gapComplete)
}

/**
 * Combined funnel metrics for a company
 */
export interface FunnelMetrics {
  dma: DmaFunnelMetrics;
  gapIa: GapIaFunnelMetrics;
  gapFull: GapFullFunnelMetrics;
}

export interface FunnelTimeSeriesPoint {
  date: string;
  // DMA events
  dmaStarted: number;
  dmaCompleted: number;
  // GAP-IA events
  gapIaStarted: number;
  gapIaCompleted: number;
  gapIaReportViewed: number;
  gapIaCtaClicked: number;
  // Full GAP events
  gapFullStarted: number;
  gapFullProcessingStarted: number;
  gapFullComplete: number;
  gapFullReviewCtaClicked: number;
}

export interface FunnelBySource {
  source: string;
  medium: string;
  // DMA events
  dmaStarted: number;
  dmaCompleted: number;
  // GAP-IA events
  gapIaStarted: number;
  gapIaCompleted: number;
  gapIaCtaClicked: number;
  // Full GAP events
  gapFullStarted: number;
  gapFullComplete: number;
  gapFullReviewCtaClicked: number;
}

// ============================================================================
// Unified Company Analytics Snapshot
// ============================================================================

/**
 * Complete analytics snapshot for a company
 * This is the primary type used for rendering company analytics dashboards
 */
export interface CompanyAnalyticsSnapshot {
  // Metadata
  companyId: string;
  companyName: string;
  domain: string;
  range: AnalyticsDateRange;
  generatedAt: string;

  // Connection status
  ga4Connected: boolean;
  gscConnected: boolean;
  ga4PropertyId?: string;
  gscSiteUrl?: string;

  // Core GA4 metrics
  ga4?: {
    metrics: Ga4CoreMetrics;
    trafficSources: Ga4TrafficSource[];
    channelTraffic: Ga4ChannelTraffic[];
    topPages: Ga4TopPage[];
    deviceBreakdown: Ga4DeviceBreakdown[];
    timeSeries: Ga4TimeSeriesPoint[];
  } | null;

  // Search Console metrics
  searchConsole?: {
    metrics: SearchConsoleMetrics;
    topQueries: SearchConsoleQuery[];
    topPages: SearchConsolePage[];
    countries: SearchConsoleCountry[];
    devices: SearchConsoleDevice[];
    timeSeries: SearchConsoleTimeSeriesPoint[];
  } | null;

  // DMA/GAP funnel metrics (from GA4 custom events)
  funnels?: {
    metrics: FunnelMetrics;
    timeSeries: FunnelTimeSeriesPoint[];
    bySource: FunnelBySource[];
  } | null;

  // Period-over-period comparison (vs previous period)
  comparison?: {
    ga4?: {
      sessionsChange: number; // percentage change
      usersChange: number;
      conversionsChange: number;
      bounceRateChange: number;
    };
    searchConsole?: {
      clicksChange: number;
      impressionsChange: number;
      ctrChange: number;
      positionChange: number; // negative is improvement
    };
    funnels?: {
      dmaCompletionRateChange: number;
      gapIaCtaRateChange: number;
      gapFullCompleteRateChange?: number;
      gapFullReviewRateChange?: number;
    };
  } | null;

  // Activity timeline synthesized from GA4 events and other sources
  activityTimeline?: CompanyActivityItem[];
}

// ============================================================================
// AI Insights Types
// ============================================================================

export type InsightCategory =
  | 'traffic'
  | 'search'
  | 'conversion'
  | 'funnel'
  | 'content'
  | 'technical'
  | 'engagement'
  | 'opportunity'
  | 'risk';

export type InsightPriority = 'high' | 'medium' | 'low';

export type WorkArea =
  | 'website'
  | 'content'
  | 'seo'
  | 'demand'
  | 'ops'
  | 'brand'
  | 'general';

export interface AnalyticsInsight {
  id: string;
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  summary: string;
  detail: string;
  evidence?: string;
  metric?: {
    name: string;
    value: number | string;
    change?: number;
    benchmark?: number | string;
  };
}

export interface WorkRecommendation {
  title: string;
  area: WorkArea;
  description: string;
  priority: InsightPriority;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  reason: string;
  implementationGuide?: string;
}

export interface AnalyticsExperiment {
  name: string;
  hypothesis: string;
  steps: string[];
  successMetric: string;
  expectedImpact: 'high' | 'medium' | 'low';
  timeframe?: string;
}

/**
 * AI-generated insights from analytics data
 */
export interface AnalyticsAiInsights {
  generatedAt: string;
  summary: string;
  healthScore: number; // 0-100
  healthStatus: 'healthy' | 'attention' | 'critical';

  insights: AnalyticsInsight[];
  quickWins: string[];
  recommendations: WorkRecommendation[];
  experiments: AnalyticsExperiment[];

  // Highlighted metrics for dashboard display
  highlights: {
    metric: string;
    value: string;
    trend: 'up' | 'down' | 'flat';
    context: string;
  }[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface CompanyAnalyticsApiResponse {
  ok: boolean;
  error?: string;
  snapshot?: CompanyAnalyticsSnapshot;
  insights?: AnalyticsAiInsights;
}

// ============================================================================
// Blueprint Types (for customizing analytics display)
// ============================================================================

export type MetricType =
  | 'sessions'
  | 'users'
  | 'pageviews'
  | 'bounceRate'
  | 'avgSessionDuration'
  | 'conversions'
  | 'conversionRate'
  | 'clicks'
  | 'impressions'
  | 'ctr'
  | 'avgPosition'
  | 'dmaStarted'
  | 'dmaCompleted'
  | 'gapIaStarted'
  | 'gapIaCompleted'
  | 'gapIaCtaClicked'
  | 'custom';

export interface MetricConfig {
  type: MetricType;
  label: string;
  description?: string;
  format: 'number' | 'percentage' | 'duration' | 'position';
  showComparison?: boolean;
  customEventName?: string; // for custom metrics
}

export interface ChartConfig {
  id: string;
  type: 'line' | 'bar' | 'area' | 'pie' | 'funnel';
  title: string;
  metrics: MetricType[];
  timeGranularity?: 'day' | 'week' | 'month';
}

export interface AnalyticsDashboardBlueprint {
  companyId: string;
  version: number;
  updatedAt: string;

  // Which sections to show
  sections: {
    overview: boolean;
    traffic: boolean;
    search: boolean;
    funnels: boolean;
    content: boolean;
    conversions: boolean;
  };

  // Primary metrics to highlight
  primaryMetrics: MetricConfig[];

  // Charts to display
  charts: ChartConfig[];

  // Custom conversion events to track
  customConversions?: string[];
}

// ============================================================================
// Company Activity Timeline Types
// ============================================================================

export type CompanyActivityEventType =
  | 'dma_audit'
  | 'gap_ia'
  | 'gap_full'
  | 'gap_review_cta'
  | 'snapshot'
  | 'work_item'
  | 'experiment'
  | 'diagnostic'
  | 'note';

export interface CompanyActivityItem {
  id: string;
  timestamp: string; // ISO timestamp
  type: CompanyActivityEventType;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Traffic & UTM Types (unified)
// ============================================================================

export interface TrafficByChannel {
  channel: string;
  sessions: number;
  users?: number;
  conversions?: number;
  bounceRate?: number;
}

export interface TrafficBySourceMedium {
  source: string;
  medium: string;
  campaign?: string;
  sessions: number;
  users?: number;
  conversions?: number;
}

export interface LandingPagePerformance {
  path: string;
  title?: string;
  sessions: number;
  conversions?: number;
  bounceRate?: number;
  avgEngagementTime?: number;
}

// ============================================================================
// Workspace-level Analytics Types (for global OS dashboard)
// ============================================================================

export interface WorkspaceAnalyticsSummary {
  workspaceId: string;
  range: AnalyticsDateRange;
  generatedAt: string;

  // Aggregated metrics across all companies
  totals: {
    companies: number;
    companiesWithGa4: number;
    companiesWithGsc: number;
    totalSessions: number;
    totalUsers: number;
    totalConversions: number;
    totalClicks: number;
    totalImpressions: number;
    // DMA funnel
    totalDmaStarted: number;
    totalDmaCompleted: number;
    // GAP-IA funnel
    totalGapIaStarted: number;
    totalGapIaCompleted: number;
    // Full GAP funnel
    totalGapFullStarted: number;
    totalGapFullProcessingStarted: number;
    totalGapFullComplete: number;
    totalGapFullReviewCtaClicked: number;
  };

  // Top performing companies
  topCompanies: {
    bySessions: { companyId: string; companyName: string; value: number }[];
    byConversions: { companyId: string; companyName: string; value: number }[];
    bySearchClicks: { companyId: string; companyName: string; value: number }[];
    byDmaCompletions: { companyId: string; companyName: string; value: number }[];
    byGapReviewCtaClicks: { companyId: string; companyName: string; value: number }[];
  };

  // Per-company funnel breakdown for dashboard table
  companyFunnelBreakdown: {
    companyId: string;
    companyName: string;
    dmaStarted: number;
    dmaCompleted: number;
    dmaCompletionRate: number;
    gapFullStarted: number;
    gapFullComplete: number;
    gapFullReviewCtaClicked: number;
    gapFullCompleteRate: number;
    gapReviewCtaRate: number;
  }[];

  // Companies needing attention
  attentionNeeded: {
    companyId: string;
    companyName: string;
    reason: string;
    metric: string;
    value: number;
    threshold: number;
  }[];

  // Time series for workspace totals
  timeSeries: {
    date: string;
    sessions: number;
    conversions: number;
    clicks: number;
    dmaCompleted: number;
  }[];
}
