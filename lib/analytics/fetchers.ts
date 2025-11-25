// lib/analytics/fetchers.ts
// GA4 and GSC fetch helpers with normalized data output
//
// This module provides functions to fetch analytics data from GA4 and GSC APIs,
// returning normalized AnalyticsMetricData objects ready for charting.

import { google } from 'googleapis';
import type {
  AnalyticsMetricConfig,
  AnalyticsMetricData,
  AnalyticsSeriesPoint,
} from './blueprintTypes';
import {
  getMetricDefinition,
  type MetricDefinition,
  type SupportedMetricId,
} from './metricCatalog';
import {
  generateCacheKey,
  getCached,
  setCache,
} from './cache';

// ============================================================================
// Types
// ============================================================================

export interface FetchOptions {
  /** GA4 property ID (e.g., "properties/123456789") */
  ga4PropertyId?: string;
  /** Search Console site URL (e.g., "https://example.com/") */
  gscSiteUrl?: string;
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
  /** OAuth2 client (if not provided, will create one) */
  auth?: any;
  /** Skip cache lookup */
  skipCache?: boolean;
}

export interface FetchResult {
  data: AnalyticsMetricData;
  fromCache: boolean;
  error?: string;
}

// ============================================================================
// OAuth2 Client
// ============================================================================

let sharedAuth: any = null;

/**
 * Get or create a shared OAuth2 client
 */
export function getOAuth2Client(): any {
  if (sharedAuth) return sharedAuth;

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN
  ) {
    return null;
  }

  sharedAuth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );

  sharedAuth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return sharedAuth;
}

// ============================================================================
// Main Fetch Function
// ============================================================================

/**
 * Fetch data for a single metric
 */
export async function fetchMetric(
  companyId: string,
  metricId: SupportedMetricId,
  options: FetchOptions
): Promise<FetchResult> {
  const definition = getMetricDefinition(metricId);

  if (!definition) {
    return {
      data: createEmptyMetricData(metricId),
      fromCache: false,
      error: `Unknown metric ID: ${metricId}`,
    };
  }

  // Check cache first (unless skipped)
  if (!options.skipCache) {
    const cacheKey = generateCacheKey(companyId, metricId, options.startDate, options.endDate);
    const cached = getCached(cacheKey);

    if (cached) {
      return { data: cached, fromCache: true };
    }
  }

  // Determine which fetcher to use
  const auth = options.auth || getOAuth2Client();

  if (!auth) {
    return {
      data: createEmptyMetricData(metricId, definition),
      fromCache: false,
      error: 'No OAuth credentials configured',
    };
  }

  try {
    let data: AnalyticsMetricData;

    if (definition.source === 'ga4') {
      if (!options.ga4PropertyId) {
        return {
          data: createEmptyMetricData(metricId, definition),
          fromCache: false,
          error: 'No GA4 property ID configured',
        };
      }
      data = await fetchGA4Metric(definition, auth, options.ga4PropertyId, options.startDate, options.endDate);
    } else if (definition.source === 'gsc') {
      if (!options.gscSiteUrl) {
        return {
          data: createEmptyMetricData(metricId, definition),
          fromCache: false,
          error: 'No Search Console site URL configured',
        };
      }
      data = await fetchGSCMetric(definition, auth, options.gscSiteUrl, options.startDate, options.endDate);
    } else {
      return {
        data: createEmptyMetricData(metricId, definition),
        fromCache: false,
        error: `Unknown source: ${definition.source}`,
      };
    }

    // Cache the result
    const cacheKey = generateCacheKey(companyId, metricId, options.startDate, options.endDate);
    setCache(cacheKey, data);

    return { data, fromCache: false };
  } catch (error) {
    console.error(`[Fetchers] Error fetching ${metricId}:`, error);
    return {
      data: createEmptyMetricData(metricId, definition),
      fromCache: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch data for multiple metrics in parallel
 */
export async function fetchMetrics(
  companyId: string,
  metricIds: SupportedMetricId[],
  options: FetchOptions
): Promise<Map<SupportedMetricId, FetchResult>> {
  const results = new Map<SupportedMetricId, FetchResult>();

  // Fetch all metrics in parallel
  const promises = metricIds.map(async (metricId) => {
    const result = await fetchMetric(companyId, metricId, options);
    return { metricId, result };
  });

  const resolved = await Promise.all(promises);

  for (const { metricId, result } of resolved) {
    results.set(metricId, result);
  }

  return results;
}

/**
 * Fetch data for metrics based on AnalyticsMetricConfig (from blueprint)
 */
export async function fetchMetricFromConfig(
  companyId: string,
  config: AnalyticsMetricConfig,
  options: FetchOptions
): Promise<FetchResult> {
  // The config.id should be a SupportedMetricId
  return fetchMetric(companyId, config.id as SupportedMetricId, options);
}

// ============================================================================
// GA4 Fetching
// ============================================================================

async function fetchGA4Metric(
  definition: MetricDefinition,
  auth: any,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsMetricData> {
  const client = google.analyticsdata({ version: 'v1beta', auth });

  // Build the request
  const request: any = {
    property: propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: definition.ga4Metric }],
  };

  // Add dimension if this is a dimensional metric
  if (definition.ga4Dimension) {
    request.dimensions = [{ name: definition.ga4Dimension }];
    request.orderBys = [{ metric: { metricName: definition.ga4Metric }, desc: true }];
    request.limit = definition.defaultChartType === 'timeseries' ? 90 : 20;
  } else if (definition.defaultChartType === 'timeseries') {
    // For timeseries without explicit dimension, use date
    request.dimensions = [{ name: 'date' }];
    request.orderBys = [{ dimension: { dimensionName: 'date' } }];
    request.limit = 90;
  }

  const response = await client.properties.runReport(request);
  const points = parseGA4Response(response.data, definition);

  // Calculate current value
  const currentValue = calculateCurrentValue(points, definition);

  return {
    metric: createMetricConfig(definition),
    points,
    currentValue,
  };
}

function parseGA4Response(
  data: any,
  definition: MetricDefinition
): AnalyticsSeriesPoint[] {
  if (!data?.rows) return [];

  return data.rows.map((row: any) => {
    let value = parseFloat(row.metricValues?.[0]?.value || '0');

    // Handle percentage values from GA4 (they come as decimals)
    if (definition.format === 'percent' && value <= 1) {
      value = value * 100;
    }

    const dimensionValue = row.dimensionValues?.[0]?.value;

    // Handle date dimension
    if (definition.ga4Dimension === 'date' || (!definition.ga4Dimension && definition.defaultChartType === 'timeseries')) {
      // Format YYYYMMDD to YYYY-MM-DD
      const rawDate = dimensionValue || '';
      const date = rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
      return { date, value };
    }

    // Handle other dimensions
    if (definition.ga4Dimension) {
      return { label: dimensionValue || 'Unknown', value };
    }

    return { value };
  });
}

// ============================================================================
// GSC Fetching
// ============================================================================

async function fetchGSCMetric(
  definition: MetricDefinition,
  auth: any,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsMetricData> {
  const client = google.searchconsole({ version: 'v1', auth });

  // Build the request
  const requestBody: any = {
    startDate,
    endDate,
    rowLimit: definition.defaultChartType === 'timeseries' ? 90 : 25,
  };

  // Add dimension if specified
  if (definition.gscDimension) {
    requestBody.dimensions = [definition.gscDimension];
  }

  const response = await client.searchanalytics.query({
    siteUrl,
    requestBody,
  });

  const points = parseGSCResponse(response.data, definition);

  // Calculate current value
  const currentValue = calculateCurrentValue(points, definition);

  return {
    metric: createMetricConfig(definition),
    points,
    currentValue,
  };
}

function parseGSCResponse(
  data: any,
  definition: MetricDefinition
): AnalyticsSeriesPoint[] {
  if (!data?.rows) return [];

  return data.rows.map((row: any) => {
    let value = 0;

    // Get the appropriate metric value
    switch (definition.gscMetric) {
      case 'clicks':
        value = row.clicks || 0;
        break;
      case 'impressions':
        value = row.impressions || 0;
        break;
      case 'ctr':
        value = (row.ctr || 0) * 100; // Convert to percentage
        break;
      case 'position':
        value = row.position || 0;
        break;
    }

    const dimensionValue = row.keys?.[0];

    // Handle date dimension
    if (definition.gscDimension === 'date') {
      return { date: dimensionValue || '', value };
    }

    // Handle other dimensions
    if (definition.gscDimension) {
      return { label: dimensionValue || 'Unknown', value };
    }

    return { value };
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty AnalyticsMetricData object
 */
function createEmptyMetricData(
  metricId: string,
  definition?: MetricDefinition | null
): AnalyticsMetricData {
  return {
    metric: definition
      ? createMetricConfig(definition)
      : {
          id: metricId,
          label: metricId,
          source: 'ga4' as const,
          chartType: 'singleValue' as const,
          description: 'Unknown metric',
          importance: 'secondary' as const,
          group: 'traffic' as const,
          targetDirection: 'up' as const,
        },
    points: [],
    currentValue: undefined,
  };
}

/**
 * Create an AnalyticsMetricConfig from a MetricDefinition
 */
function createMetricConfig(definition: MetricDefinition): AnalyticsMetricConfig {
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    source: definition.source,
    chartType: definition.defaultChartType,
    importance: 'primary' as const,
    group: getMetricGroup(definition),
    targetDirection: getTargetDirection(definition),
  };
}

/**
 * Determine the metric group based on the definition
 */
function getMetricGroup(definition: MetricDefinition): 'traffic' | 'seo' | 'conversion' | 'engagement' | 'local' | 'ecommerce' | 'brand' {
  const id = definition.id;

  // SEO metrics (all GSC metrics)
  if (definition.source === 'gsc') return 'seo';

  // Engagement metrics
  if (id.includes('engagement') || id.includes('bounce') || id.includes('Duration') || id.includes('pagesPerSession')) {
    return 'engagement';
  }

  // Conversion metrics
  if (id.includes('conversion')) return 'conversion';

  // Default to traffic
  return 'traffic';
}

/**
 * Determine the target direction based on the metric
 */
function getTargetDirection(definition: MetricDefinition): 'up' | 'down' {
  const id = definition.id;

  // Metrics where lower is better
  if (id.includes('bounce') || id.includes('position')) {
    return 'down';
  }

  // Default: higher is better
  return 'up';
}

/**
 * Calculate the current/aggregate value from points
 */
function calculateCurrentValue(
  points: AnalyticsSeriesPoint[],
  definition: MetricDefinition
): number | undefined {
  if (points.length === 0) return undefined;

  // For timeseries, sum all values
  if (definition.defaultChartType === 'timeseries') {
    return points.reduce((sum, p) => sum + p.value, 0);
  }

  // For averages (like position, engagement rate), calculate mean
  if (definition.format === 'percent' || definition.gscMetric === 'position') {
    return points.reduce((sum, p) => sum + p.value, 0) / points.length;
  }

  // For dimensional charts, return the top value
  return points[0]?.value;
}

// ============================================================================
// Batch Fetching for Blueprints
// ============================================================================

/**
 * Fetch all metrics defined in a set of AnalyticsMetricConfig objects
 * (Used by the blueprint data API)
 */
export async function fetchMetricsFromConfigs(
  companyId: string,
  configs: AnalyticsMetricConfig[],
  options: FetchOptions
): Promise<AnalyticsMetricData[]> {
  const results: AnalyticsMetricData[] = [];

  // Fetch all in parallel
  const promises = configs.map(async (config) => {
    const result = await fetchMetricFromConfig(companyId, config, options);
    return result.data;
  });

  const resolved = await Promise.all(promises);

  for (const data of resolved) {
    results.push(data);
  }

  return results;
}
