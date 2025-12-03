// lib/integrations/media/ga4.ts
// GA4 Data API connector for Media performance metrics
//
// This connector fetches key GA4 metrics and translates them into
// MediaPerformancePoint[] for ingestion into Airtable.
//
// SETUP REQUIREMENTS:
// 1. Set environment variables:
//    - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON
//    - Or configure OAuth via WorkspaceSettings for per-company auth
// 2. Grant the service account "Viewer" role on the GA4 property
// 3. Store the GA4 Property ID in the company's MediaIntegrationConfig
//
// TODO: Implement actual Google Analytics Data API calls when credentials are ready.
// Current implementation returns type-safe stubs for development.

import type {
  MediaPerformancePoint,
  MediaGa4Config,
  MetricName,
  MetricUnit,
} from '@/lib/types/media';
import { METRIC_UNIT_MAP } from '@/lib/types/media';

// ============================================================================
// GA4 Data API Types (shapes from Google Analytics Data API v1beta)
// ============================================================================

/**
 * GA4 RunReportRequest shape
 * @see https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
 */
interface Ga4RunReportRequest {
  property: string; // Format: 'properties/{propertyId}'
  dateRanges: Array<{
    startDate: string; // YYYY-MM-DD
    endDate: string;
  }>;
  dimensions: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  dimensionFilter?: {
    filter?: {
      fieldName: string;
      stringFilter?: {
        matchType: 'EXACT' | 'BEGINS_WITH' | 'ENDS_WITH' | 'CONTAINS' | 'PARTIAL_REGEXP';
        value: string;
      };
    };
  };
}

/**
 * GA4 RunReportResponse shape
 */
interface Ga4RunReportResponse {
  dimensionHeaders: Array<{ name: string }>;
  metricHeaders: Array<{ name: string; type: string }>;
  rows: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
  rowCount: number;
}

// ============================================================================
// GA4 Metric Mapping
// ============================================================================

/**
 * Map GA4 metric names to our normalized MetricName
 */
const GA4_METRIC_MAP: Record<string, MetricName> = {
  sessions: 'Sessions',
  activeUsers: 'Users',
  newUsers: 'New Users',
  engagedSessions: 'Engaged Sessions',
  engagementRate: 'Engagement Rate',
  bounceRate: 'Bounce Rate',
  screenPageViewsPerSession: 'Pages Per Session',
  averageSessionDuration: 'Avg Session Duration',
  conversions: 'Installs', // Default mapping, can be customized per event
};

/**
 * GA4 conversion event to metric name mapping
 */
const GA4_CONVERSION_EVENT_MAP: Record<string, MetricName> = {
  book_install: 'Installs',
  book_appointment: 'Bookings',
  call_click: 'Calls',
  directions_click: 'Direction Requests',
  submit_lead_form: 'LSAs Leads',
  purchase: 'Installs',
};

// ============================================================================
// Connector Functions
// ============================================================================

export interface Ga4FetchParams {
  companyId: string;
  config: MediaGa4Config;
  startDate: Date;
  endDate: Date;
  storeIdMap?: Record<string, string>; // Optional: dimension value -> store ID
}

/**
 * Fetch GA4 media metrics for a company
 *
 * Retrieves sessions, users, engagement, and conversion metrics from GA4
 * and transforms them into MediaPerformancePoint[] format.
 *
 * @param params - Fetch parameters including company ID, config, and date range
 * @returns Array of MediaPerformancePoint ready for upsert
 *
 * TODO: Implement actual GA4 Data API HTTP calls when service account is configured.
 * The current implementation returns empty array and logs the intended request.
 */
export async function fetchGa4MediaMetrics(
  params: Ga4FetchParams
): Promise<MediaPerformancePoint[]> {
  const { companyId, config, startDate, endDate } = params;

  console.log('[GA4 Connector] Fetching metrics:', {
    companyId,
    propertyId: config.propertyId,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
  });

  // Build the intended request for documentation/debugging
  const intendedRequest: Ga4RunReportRequest = {
    property: `properties/${config.propertyId}`,
    dateRanges: [
      {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    ],
    dimensions: [
      { name: 'date' },
      // Include store dimension if configured
      ...(config.dimensionMappings?.storeIdDimension
        ? [{ name: config.dimensionMappings.storeIdDimension }]
        : []),
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'engagedSessions' },
      { name: 'engagementRate' },
      { name: 'bounceRate' },
      { name: 'screenPageViewsPerSession' },
      { name: 'averageSessionDuration' },
    ],
  };

  // TODO: Implement actual API call
  // const response = await callGa4Api(intendedRequest);
  // return transformGa4Response(response, companyId);

  console.log('[GA4 Connector] TODO: Implement GA4 Data API call');
  console.log('[GA4 Connector] Intended request:', JSON.stringify(intendedRequest, null, 2));

  // Return empty array until API is implemented
  return [];
}

/**
 * Fetch GA4 conversion events for a company
 *
 * Retrieves specific conversion events (book_install, call_click, etc.)
 * and transforms them into MediaPerformancePoint[] format.
 *
 * @param params - Fetch parameters
 * @returns Array of MediaPerformancePoint for conversion events
 */
export async function fetchGa4ConversionEvents(
  params: Ga4FetchParams
): Promise<MediaPerformancePoint[]> {
  const { companyId, config, startDate, endDate } = params;

  console.log('[GA4 Connector] Fetching conversion events:', {
    companyId,
    propertyId: config.propertyId,
    events: Object.keys(GA4_CONVERSION_EVENT_MAP),
  });

  // TODO: Implement actual GA4 conversion event fetch
  // Each conversion event needs a separate query or use eventName dimension

  console.log('[GA4 Connector] TODO: Implement GA4 conversion events fetch');

  return [];
}

// ============================================================================
// Transform Helpers
// ============================================================================

/**
 * Transform GA4 API response to MediaPerformancePoint[]
 *
 * @param response - Raw GA4 API response
 * @param companyId - Company ID to associate with points
 * @param storeIdMap - Optional map from dimension values to store IDs
 * @returns Transformed MediaPerformancePoint[]
 */
function transformGa4Response(
  response: Ga4RunReportResponse,
  companyId: string,
  storeIdMap?: Record<string, string>
): MediaPerformancePoint[] {
  const points: Omit<MediaPerformancePoint, 'id' | 'createdAt'>[] = [];

  if (!response.rows) return [];

  const dateIndex = response.dimensionHeaders.findIndex((h) => h.name === 'date');
  const storeIndex = response.dimensionHeaders.findIndex(
    (h) => h.name.includes('store') || h.name.includes('location')
  );

  for (const row of response.rows) {
    const date = dateIndex >= 0 ? formatGa4Date(row.dimensionValues[dateIndex].value) : '';
    const storeId =
      storeIndex >= 0 && storeIdMap
        ? storeIdMap[row.dimensionValues[storeIndex].value]
        : undefined;

    // Create a point for each metric
    response.metricHeaders.forEach((header, metricIndex) => {
      const metricName = GA4_METRIC_MAP[header.name];
      if (!metricName) return; // Skip unmapped metrics

      const rawValue = parseFloat(row.metricValues[metricIndex].value);
      if (isNaN(rawValue)) return;

      points.push({
        companyId,
        date,
        channel: 'Other', // GA4 is primarily organic/direct traffic
        metricName,
        metricValue: rawValue,
        metricUnit: METRIC_UNIT_MAP[metricName] || 'Count',
        sourceSystem: 'GA4',
        storeId,
      });
    });
  }

  return points as MediaPerformancePoint[];
}

/**
 * Format GA4 date (YYYYMMDD) to ISO date (YYYY-MM-DD)
 */
function formatGa4Date(ga4Date: string): string {
  if (ga4Date.length !== 8) return ga4Date;
  return `${ga4Date.slice(0, 4)}-${ga4Date.slice(4, 6)}-${ga4Date.slice(6, 8)}`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if GA4 is configured for a company
 */
export function isGa4Configured(config?: MediaGa4Config): boolean {
  return !!config?.propertyId;
}

/**
 * Validate GA4 configuration
 */
export function validateGa4Config(config: MediaGa4Config): string[] {
  const errors: string[] = [];

  if (!config.propertyId) {
    errors.push('GA4 Property ID is required');
  } else if (!/^\d+$/.test(config.propertyId)) {
    errors.push('GA4 Property ID must be numeric');
  }

  return errors;
}
