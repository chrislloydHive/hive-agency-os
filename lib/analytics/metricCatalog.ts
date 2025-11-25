// lib/analytics/metricCatalog.ts
// Canonical catalog of supported analytics metrics
//
// This module defines which metric IDs we support and how to fetch them.
// The blueprint system references these IDs, and the fetchers use
// these definitions to make the appropriate API calls.

import type { AnalyticsChartType, AnalyticsDataSource } from './blueprintTypes';

// ============================================================================
// Supported Metric IDs
// ============================================================================

/**
 * All supported metric IDs that can be used in Analytics Blueprints
 */
export type SupportedMetricId =
  // GA4 Core Metrics
  | 'ga4_sessions'
  | 'ga4_users'
  | 'ga4_newUsers'
  | 'ga4_pageviews'
  | 'ga4_engagedSessions'
  | 'ga4_engagementRate'
  | 'ga4_avgSessionDuration'
  | 'ga4_bounceRate'
  | 'ga4_pagesPerSession'
  | 'ga4_conversions'
  | 'ga4_conversionRate'
  // GA4 Dimensional Metrics
  | 'ga4_sessionsByChannel'
  | 'ga4_sessionsByCountry'
  | 'ga4_sessionsByCity'
  | 'ga4_sessionsByDevice'
  | 'ga4_pageviewsByPage'
  | 'ga4_sessionsByLandingPage'
  // GSC Metrics
  | 'gsc_clicks'
  | 'gsc_impressions'
  | 'gsc_ctr'
  | 'gsc_avgPosition'
  | 'gsc_clicksByQuery'
  | 'gsc_clicksByPage'
  | 'gsc_clicksByCountry'
  | 'gsc_clicksByDevice'
  | 'gsc_clicksOverTime'
  | 'gsc_impressionsOverTime';

// ============================================================================
// Metric Definition Types
// ============================================================================

export interface MetricDefinition {
  /** Unique metric ID */
  id: SupportedMetricId;
  /** Display name for the metric */
  label: string;
  /** Short description */
  description: string;
  /** Data source (ga4 or gsc) */
  source: AnalyticsDataSource;
  /** Default chart type for visualization */
  defaultChartType: AnalyticsChartType;
  /** GA4 API metric name (if source is ga4) */
  ga4Metric?: string;
  /** GA4 dimension for breakdown (if applicable) */
  ga4Dimension?: string;
  /** GSC metric key (clicks, impressions, ctr, position) */
  gscMetric?: 'clicks' | 'impressions' | 'ctr' | 'position';
  /** GSC dimension for breakdown (if applicable) */
  gscDimension?: 'date' | 'query' | 'page' | 'country' | 'device';
  /** Format type for display */
  format: 'number' | 'percent' | 'duration' | 'decimal';
  /** Color for charts (CSS color or tailwind class) */
  color?: string;
}

// ============================================================================
// GA4 Metric Definitions
// ============================================================================

const GA4_METRICS: Record<string, MetricDefinition> = {
  ga4_sessions: {
    id: 'ga4_sessions',
    label: 'Sessions',
    description: 'Total number of sessions',
    source: 'ga4',
    defaultChartType: 'timeseries',
    ga4Metric: 'sessions',
    format: 'number',
    color: '#f59e0b', // amber-500
  },
  ga4_users: {
    id: 'ga4_users',
    label: 'Users',
    description: 'Total number of unique users',
    source: 'ga4',
    defaultChartType: 'timeseries',
    ga4Metric: 'totalUsers',
    format: 'number',
    color: '#3b82f6', // blue-500
  },
  ga4_newUsers: {
    id: 'ga4_newUsers',
    label: 'New Users',
    description: 'Number of first-time users',
    source: 'ga4',
    defaultChartType: 'timeseries',
    ga4Metric: 'newUsers',
    format: 'number',
    color: '#10b981', // emerald-500
  },
  ga4_pageviews: {
    id: 'ga4_pageviews',
    label: 'Pageviews',
    description: 'Total number of page views',
    source: 'ga4',
    defaultChartType: 'timeseries',
    ga4Metric: 'screenPageViews',
    format: 'number',
    color: '#8b5cf6', // violet-500
  },
  ga4_engagedSessions: {
    id: 'ga4_engagedSessions',
    label: 'Engaged Sessions',
    description: 'Sessions that lasted longer than 10 seconds or had conversions',
    source: 'ga4',
    defaultChartType: 'timeseries',
    ga4Metric: 'engagedSessions',
    format: 'number',
    color: '#06b6d4', // cyan-500
  },
  ga4_engagementRate: {
    id: 'ga4_engagementRate',
    label: 'Engagement Rate',
    description: 'Percentage of engaged sessions',
    source: 'ga4',
    defaultChartType: 'singleValue',
    ga4Metric: 'engagementRate',
    format: 'percent',
    color: '#22c55e', // green-500
  },
  ga4_avgSessionDuration: {
    id: 'ga4_avgSessionDuration',
    label: 'Avg Session Duration',
    description: 'Average time spent per session',
    source: 'ga4',
    defaultChartType: 'singleValue',
    ga4Metric: 'averageSessionDuration',
    format: 'duration',
    color: '#f97316', // orange-500
  },
  ga4_bounceRate: {
    id: 'ga4_bounceRate',
    label: 'Bounce Rate',
    description: 'Percentage of sessions that were not engaged',
    source: 'ga4',
    defaultChartType: 'singleValue',
    ga4Metric: 'bounceRate',
    format: 'percent',
    color: '#ef4444', // red-500
  },
  ga4_pagesPerSession: {
    id: 'ga4_pagesPerSession',
    label: 'Pages / Session',
    description: 'Average number of pages viewed per session',
    source: 'ga4',
    defaultChartType: 'singleValue',
    ga4Metric: 'screenPageViewsPerSession',
    format: 'decimal',
    color: '#a855f7', // purple-500
  },
  ga4_conversions: {
    id: 'ga4_conversions',
    label: 'Conversions',
    description: 'Total number of conversion events',
    source: 'ga4',
    defaultChartType: 'timeseries',
    ga4Metric: 'conversions',
    format: 'number',
    color: '#14b8a6', // teal-500
  },
  ga4_conversionRate: {
    id: 'ga4_conversionRate',
    label: 'Conversion Rate',
    description: 'Percentage of sessions that converted',
    source: 'ga4',
    defaultChartType: 'singleValue',
    ga4Metric: 'sessionConversionRate',
    format: 'percent',
    color: '#84cc16', // lime-500
  },
  // Dimensional GA4 Metrics
  ga4_sessionsByChannel: {
    id: 'ga4_sessionsByChannel',
    label: 'Sessions by Channel',
    description: 'Sessions broken down by traffic channel',
    source: 'ga4',
    defaultChartType: 'bar',
    ga4Metric: 'sessions',
    ga4Dimension: 'sessionDefaultChannelGroup',
    format: 'number',
    color: '#f59e0b',
  },
  ga4_sessionsByCountry: {
    id: 'ga4_sessionsByCountry',
    label: 'Sessions by Country',
    description: 'Sessions broken down by country',
    source: 'ga4',
    defaultChartType: 'horizontalBar',
    ga4Metric: 'sessions',
    ga4Dimension: 'country',
    format: 'number',
    color: '#3b82f6',
  },
  ga4_sessionsByCity: {
    id: 'ga4_sessionsByCity',
    label: 'Sessions by City',
    description: 'Sessions broken down by city',
    source: 'ga4',
    defaultChartType: 'horizontalBar',
    ga4Metric: 'sessions',
    ga4Dimension: 'city',
    format: 'number',
    color: '#10b981',
  },
  ga4_sessionsByDevice: {
    id: 'ga4_sessionsByDevice',
    label: 'Sessions by Device',
    description: 'Sessions broken down by device category',
    source: 'ga4',
    defaultChartType: 'pie',
    ga4Metric: 'sessions',
    ga4Dimension: 'deviceCategory',
    format: 'number',
    color: '#8b5cf6',
  },
  ga4_pageviewsByPage: {
    id: 'ga4_pageviewsByPage',
    label: 'Top Pages',
    description: 'Pages with the most views',
    source: 'ga4',
    defaultChartType: 'horizontalBar',
    ga4Metric: 'screenPageViews',
    ga4Dimension: 'pagePath',
    format: 'number',
    color: '#06b6d4',
  },
  ga4_sessionsByLandingPage: {
    id: 'ga4_sessionsByLandingPage',
    label: 'Top Landing Pages',
    description: 'Landing pages with the most sessions',
    source: 'ga4',
    defaultChartType: 'horizontalBar',
    ga4Metric: 'sessions',
    ga4Dimension: 'landingPagePlusQueryString',
    format: 'number',
    color: '#f97316',
  },
};

// ============================================================================
// GSC Metric Definitions
// ============================================================================

const GSC_METRICS: Record<string, MetricDefinition> = {
  gsc_clicks: {
    id: 'gsc_clicks',
    label: 'Search Clicks',
    description: 'Total clicks from Google Search',
    source: 'gsc',
    defaultChartType: 'timeseries',
    gscMetric: 'clicks',
    gscDimension: 'date',
    format: 'number',
    color: '#f59e0b',
  },
  gsc_impressions: {
    id: 'gsc_impressions',
    label: 'Search Impressions',
    description: 'Total impressions in Google Search',
    source: 'gsc',
    defaultChartType: 'timeseries',
    gscMetric: 'impressions',
    gscDimension: 'date',
    format: 'number',
    color: '#3b82f6',
  },
  gsc_ctr: {
    id: 'gsc_ctr',
    label: 'Click-Through Rate',
    description: 'Percentage of impressions that resulted in clicks',
    source: 'gsc',
    defaultChartType: 'singleValue',
    gscMetric: 'ctr',
    format: 'percent',
    color: '#10b981',
  },
  gsc_avgPosition: {
    id: 'gsc_avgPosition',
    label: 'Average Position',
    description: 'Average ranking position in search results',
    source: 'gsc',
    defaultChartType: 'singleValue',
    gscMetric: 'position',
    format: 'decimal',
    color: '#8b5cf6',
  },
  gsc_clicksByQuery: {
    id: 'gsc_clicksByQuery',
    label: 'Top Search Queries',
    description: 'Queries driving the most clicks',
    source: 'gsc',
    defaultChartType: 'horizontalBar',
    gscMetric: 'clicks',
    gscDimension: 'query',
    format: 'number',
    color: '#f59e0b',
  },
  gsc_clicksByPage: {
    id: 'gsc_clicksByPage',
    label: 'Top Pages (Search)',
    description: 'Pages receiving the most search clicks',
    source: 'gsc',
    defaultChartType: 'horizontalBar',
    gscMetric: 'clicks',
    gscDimension: 'page',
    format: 'number',
    color: '#06b6d4',
  },
  gsc_clicksByCountry: {
    id: 'gsc_clicksByCountry',
    label: 'Clicks by Country',
    description: 'Search clicks broken down by country',
    source: 'gsc',
    defaultChartType: 'horizontalBar',
    gscMetric: 'clicks',
    gscDimension: 'country',
    format: 'number',
    color: '#10b981',
  },
  gsc_clicksByDevice: {
    id: 'gsc_clicksByDevice',
    label: 'Clicks by Device',
    description: 'Search clicks broken down by device type',
    source: 'gsc',
    defaultChartType: 'pie',
    gscMetric: 'clicks',
    gscDimension: 'device',
    format: 'number',
    color: '#8b5cf6',
  },
  gsc_clicksOverTime: {
    id: 'gsc_clicksOverTime',
    label: 'Clicks Over Time',
    description: 'Search clicks trend over time',
    source: 'gsc',
    defaultChartType: 'timeseries',
    gscMetric: 'clicks',
    gscDimension: 'date',
    format: 'number',
    color: '#f59e0b',
  },
  gsc_impressionsOverTime: {
    id: 'gsc_impressionsOverTime',
    label: 'Impressions Over Time',
    description: 'Search impressions trend over time',
    source: 'gsc',
    defaultChartType: 'timeseries',
    gscMetric: 'impressions',
    gscDimension: 'date',
    format: 'number',
    color: '#3b82f6',
  },
};

// ============================================================================
// Combined Metric Definitions
// ============================================================================

/**
 * All supported metric definitions
 */
export const METRIC_DEFINITIONS: Record<SupportedMetricId, MetricDefinition> = {
  ...GA4_METRICS,
  ...GSC_METRICS,
} as Record<SupportedMetricId, MetricDefinition>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a metric definition by ID
 */
export function getMetricDefinition(metricId: string): MetricDefinition | null {
  return METRIC_DEFINITIONS[metricId as SupportedMetricId] || null;
}

/**
 * Check if a metric ID is supported
 */
export function isSupportedMetric(metricId: string): metricId is SupportedMetricId {
  return metricId in METRIC_DEFINITIONS;
}

/**
 * Get all metrics for a specific source
 */
export function getMetricsBySource(source: AnalyticsDataSource): MetricDefinition[] {
  return Object.values(METRIC_DEFINITIONS).filter((m) => m.source === source);
}

/**
 * Get all GA4 metrics
 */
export function getGA4Metrics(): MetricDefinition[] {
  return getMetricsBySource('ga4');
}

/**
 * Get all GSC metrics
 */
export function getGSCMetrics(): MetricDefinition[] {
  return getMetricsBySource('gsc');
}

/**
 * Get metric IDs by chart type
 */
export function getMetricsByChartType(chartType: AnalyticsChartType): MetricDefinition[] {
  return Object.values(METRIC_DEFINITIONS).filter((m) => m.defaultChartType === chartType);
}

/**
 * Format a metric value based on its format type
 */
export function formatMetricValue(value: number | undefined, format: MetricDefinition['format']): string {
  if (value === undefined || value === null) return '—';

  switch (format) {
    case 'number':
      return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
    case 'percent':
      // Values from GA4/GSC might already be in percentage form or decimal
      const percentValue = value > 1 ? value : value * 100;
      return `${percentValue.toFixed(1)}%`;
    case 'duration':
      // Assume value is in seconds
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    case 'decimal':
      return value.toFixed(2);
    default:
      return String(value);
  }
}
