// lib/analytics/blueprintTypes.ts
// Analytics Blueprint Types - AI-driven configuration for company analytics dashboards

// ============================================================================
// Core Types
// ============================================================================

export type AnalyticsDataSource = 'ga4' | 'gsc';

export type AnalyticsChartType =
  | 'timeseries'
  | 'bar'
  | 'horizontalBar'
  | 'pie'
  | 'singleValue';

export type AnalyticsMetricImportance = 'primary' | 'secondary';

export type AnalyticsMetricGroup =
  | 'traffic'
  | 'seo'
  | 'conversion'
  | 'engagement'
  | 'local'
  | 'ecommerce'
  | 'brand';

export type AnalyticsTargetDirection = 'up' | 'down';

export type AnalyticsDimension =
  | 'date'
  | 'page'
  | 'country'
  | 'city'
  | 'query'
  | 'device'
  | 'channel';

// ============================================================================
// Metric Configuration
// ============================================================================

export interface AnalyticsMetricConfig {
  /** Internal metric key, e.g. "ga4_sessions" or "gsc_clicks" */
  id: string;
  /** Data source: GA4 or Google Search Console */
  source: AnalyticsDataSource;
  /** Human-friendly label for display */
  label: string;
  /** Why this metric matters for this company */
  description: string;
  /** Primary metrics are shown prominently; secondary are supportive */
  importance: AnalyticsMetricImportance;
  /** How to visualize this metric */
  chartType: AnalyticsChartType;
  /** Category grouping for organization */
  group: AnalyticsMetricGroup;
  /** What direction indicates improvement */
  targetDirection: AnalyticsTargetDirection;
  /** Optional dimension for breakdown (e.g., by date, page, query) */
  dimension?: AnalyticsDimension;
  /** Optional GA4 metric name for API calls */
  ga4Metric?: string;
  /** Optional GA4 dimension name for API calls */
  ga4Dimension?: string;
}

// ============================================================================
// Blueprint
// ============================================================================

export interface AnalyticsBlueprint {
  /** High-level objectives for this company's analytics (e.g., "Increase local visibility") */
  objectives: string[];
  /** Short narrative explaining how to interpret these metrics together */
  notesForStrategist: string;
  /** Primary metrics - the most important 3-5 metrics to track */
  primaryMetrics: AnalyticsMetricConfig[];
  /** Secondary metrics - supporting metrics for deeper analysis */
  secondaryMetrics: AnalyticsMetricConfig[];
  /** ISO timestamp when this blueprint was generated */
  generatedAt: string;
}

// ============================================================================
// Data Types for Charting
// ============================================================================

export interface AnalyticsSeriesPoint {
  /** For timeseries charts - ISO date string */
  date?: string;
  /** For categorical charts - dimension label (page, query, country, etc.) */
  label?: string;
  /** The metric value */
  value: number;
}

export interface AnalyticsMetricData {
  /** The metric configuration */
  metric: AnalyticsMetricConfig;
  /** Data points for visualization */
  points: AnalyticsSeriesPoint[];
  /** Optional current period total/summary value */
  currentValue?: number;
  /** Optional previous period total/summary for comparison */
  previousValue?: number;
  /** Optional percentage change from previous period */
  changePercent?: number;
}

// ============================================================================
// Known Metric IDs
// ============================================================================

/**
 * Standard GA4 metric IDs that we know how to fetch
 */
export const GA4_METRIC_IDS = {
  // Traffic metrics
  sessions: 'ga4_sessions',
  users: 'ga4_users',
  newUsers: 'ga4_newUsers',
  pageviews: 'ga4_pageviews',

  // Engagement metrics
  engagedSessions: 'ga4_engagedSessions',
  engagementRate: 'ga4_engagementRate',
  avgSessionDuration: 'ga4_avgSessionDuration',
  bounceRate: 'ga4_bounceRate',
  pagesPerSession: 'ga4_pagesPerSession',

  // Conversion metrics
  conversions: 'ga4_conversions',
  conversionRate: 'ga4_conversionRate',

  // Channel breakdown
  sessionsByChannel: 'ga4_sessionsByChannel',

  // Geographic
  sessionsByCountry: 'ga4_sessionsByCountry',
  sessionsByCity: 'ga4_sessionsByCity',

  // Device
  sessionsByDevice: 'ga4_sessionsByDevice',

  // Content
  pageviewsByPage: 'ga4_pageviewsByPage',
  sessionsByLandingPage: 'ga4_sessionsByLandingPage',
} as const;

/**
 * Standard GSC metric IDs that we know how to fetch
 */
export const GSC_METRIC_IDS = {
  // Summary metrics
  clicks: 'gsc_clicks',
  impressions: 'gsc_impressions',
  ctr: 'gsc_ctr',
  avgPosition: 'gsc_avgPosition',

  // Dimension breakdowns
  clicksByQuery: 'gsc_clicksByQuery',
  clicksByPage: 'gsc_clicksByPage',
  clicksByCountry: 'gsc_clicksByCountry',
  clicksByDevice: 'gsc_clicksByDevice',

  // Timeseries
  clicksOverTime: 'gsc_clicksOverTime',
  impressionsOverTime: 'gsc_impressionsOverTime',
} as const;

/**
 * Map metric ID to GA4 API metric name
 */
export const GA4_METRIC_MAP: Record<string, string> = {
  [GA4_METRIC_IDS.sessions]: 'sessions',
  [GA4_METRIC_IDS.users]: 'totalUsers',
  [GA4_METRIC_IDS.newUsers]: 'newUsers',
  [GA4_METRIC_IDS.pageviews]: 'screenPageViews',
  [GA4_METRIC_IDS.engagedSessions]: 'engagedSessions',
  [GA4_METRIC_IDS.engagementRate]: 'engagementRate',
  [GA4_METRIC_IDS.avgSessionDuration]: 'averageSessionDuration',
  [GA4_METRIC_IDS.bounceRate]: 'bounceRate',
  [GA4_METRIC_IDS.pagesPerSession]: 'screenPageViewsPerSession',
  [GA4_METRIC_IDS.conversions]: 'conversions',
  [GA4_METRIC_IDS.conversionRate]: 'sessionConversionRate',
};

/**
 * Map metric ID to GA4 dimension name (for dimensional breakdowns)
 */
export const GA4_DIMENSION_MAP: Record<string, string> = {
  channel: 'sessionDefaultChannelGroup',
  country: 'country',
  city: 'city',
  device: 'deviceCategory',
  page: 'pagePath',
  landingPage: 'landingPagePlusQueryString',
  date: 'date',
};
