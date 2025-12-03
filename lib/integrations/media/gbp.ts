// lib/integrations/media/gbp.ts
// Google Business Profile (GBP) / Maps connector for Media performance metrics
//
// This connector fetches GBP metrics (impressions, actions, reviews)
// and translates them into MediaPerformancePoint[] for ingestion.
//
// SETUP REQUIREMENTS:
// 1. Set environment variables:
//    - GOOGLE_MY_BUSINESS_CLIENT_ID: OAuth client ID
//    - GOOGLE_MY_BUSINESS_CLIENT_SECRET: OAuth client secret
//    - GOOGLE_MY_BUSINESS_REFRESH_TOKEN: OAuth refresh token
// 2. Store the GBP Account ID in MediaIntegrationConfig
// 3. Map GBP Location IDs to MediaStore IDs in the config
//
// DATA MODEL:
// - GBP provides insights at the location (store) level
// - Metrics include: impressions, calls, direction requests, website clicks
// - Reviews are fetched separately via Places API or GMB API
//
// TODO: Implement actual Google My Business API calls when OAuth is configured.

import type {
  MediaPerformancePoint,
  MediaGbpConfig,
  MetricName,
} from '@/lib/types/media';
import { METRIC_UNIT_MAP } from '@/lib/types/media';

// ============================================================================
// GBP API Types (shapes from Google My Business API v4)
// ============================================================================

/**
 * GBP Location Insights response
 */
interface GbpInsightsResponse {
  locationMetrics: Array<{
    locationName: string; // Format: 'accounts/{accountId}/locations/{locationId}'
    timeZone: string;
    metricValues: Array<{
      metric: GbpMetricType;
      totalValue?: {
        value: string;
      };
      dimensionalValues?: Array<{
        value: string;
        metricOption?: string;
        timeDimension?: {
          timeRange: {
            startTime: string;
            endTime: string;
          };
        };
      }>;
    }>;
  }>;
}

type GbpMetricType =
  | 'QUERIES_DIRECT' // Direct searches
  | 'QUERIES_INDIRECT' // Discovery searches
  | 'QUERIES_CHAIN' // Chain searches
  | 'VIEWS_MAPS' // Views on Maps
  | 'VIEWS_SEARCH' // Views on Search
  | 'ACTIONS_WEBSITE' // Website clicks
  | 'ACTIONS_PHONE' // Calls
  | 'ACTIONS_DRIVING_DIRECTIONS' // Direction requests
  | 'PHOTOS_VIEWS_MERCHANT' // Photo views (merchant)
  | 'PHOTOS_VIEWS_CUSTOMERS' // Photo views (customers)
  | 'PHOTOS_COUNT_MERCHANT'
  | 'PHOTOS_COUNT_CUSTOMERS';

/**
 * GBP Location review summary
 */
interface GbpReviewSummary {
  locationName: string;
  reviewCount: number;
  averageRating: number; // 1-5 scale
}

// ============================================================================
// Metric Mapping
// ============================================================================

/**
 * Map GBP metric types to our normalized MetricName
 */
const GBP_METRIC_MAP: Record<GbpMetricType, MetricName | null> = {
  QUERIES_DIRECT: 'Search Impressions',
  QUERIES_INDIRECT: 'Search Impressions',
  QUERIES_CHAIN: 'Search Impressions',
  VIEWS_MAPS: 'Maps Impressions',
  VIEWS_SEARCH: 'Search Impressions',
  ACTIONS_WEBSITE: 'Website Clicks',
  ACTIONS_PHONE: 'Calls',
  ACTIONS_DRIVING_DIRECTIONS: 'Direction Requests',
  PHOTOS_VIEWS_MERCHANT: 'Photo Views',
  PHOTOS_VIEWS_CUSTOMERS: 'Photo Views',
  PHOTOS_COUNT_MERCHANT: null, // Don't sync photo counts
  PHOTOS_COUNT_CUSTOMERS: null,
};

// ============================================================================
// Connector Functions
// ============================================================================

export interface GbpFetchParams {
  companyId: string;
  config: MediaGbpConfig;
  startDate: Date;
  endDate: Date;
}

/**
 * Fetch GBP location insights for a company
 *
 * Retrieves impressions, actions, and engagement metrics from GBP
 * and transforms them into MediaPerformancePoint[] format.
 *
 * @param params - Fetch parameters including company ID, config, and date range
 * @returns Array of MediaPerformancePoint ready for upsert
 *
 * TODO: Implement actual Google My Business API call when OAuth is configured.
 */
export async function fetchGbpMetrics(
  params: GbpFetchParams
): Promise<MediaPerformancePoint[]> {
  const { companyId, config, startDate, endDate } = params;

  console.log('[GBP Connector] Fetching location insights:', {
    companyId,
    accountId: config.accountId,
    locationCount: Object.keys(config.locationMappings || {}).length,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
  });

  // Build the intended API request for documentation/debugging
  const intendedRequest = {
    locationNames: Object.keys(config.locationMappings || {}).map(
      (locId) => `accounts/${config.accountId}/locations/${locId}`
    ),
    basicRequest: {
      metricRequests: [
        { metric: 'QUERIES_DIRECT' },
        { metric: 'QUERIES_INDIRECT' },
        { metric: 'VIEWS_MAPS' },
        { metric: 'VIEWS_SEARCH' },
        { metric: 'ACTIONS_WEBSITE' },
        { metric: 'ACTIONS_PHONE' },
        { metric: 'ACTIONS_DRIVING_DIRECTIONS' },
        { metric: 'PHOTOS_VIEWS_MERCHANT' },
        { metric: 'PHOTOS_VIEWS_CUSTOMERS' },
      ],
      timeRange: {
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      },
    },
  };

  console.log('[GBP Connector] TODO: Implement Google My Business API call');
  console.log('[GBP Connector] Intended request:', JSON.stringify(intendedRequest, null, 2));

  // TODO: Implement actual API call
  // const response = await callGbpApi(intendedRequest);
  // return transformGbpResponse(response, companyId, config.locationMappings);

  return [];
}

/**
 * Fetch GBP reviews for a company's locations
 *
 * Retrieves review counts and average ratings for each location.
 *
 * @param params - Fetch parameters
 * @returns Array of MediaPerformancePoint for review metrics
 */
export async function fetchGbpReviews(
  params: GbpFetchParams
): Promise<MediaPerformancePoint[]> {
  const { companyId, config } = params;

  console.log('[GBP Connector] Fetching reviews:', {
    companyId,
    accountId: config.accountId,
    locationCount: Object.keys(config.locationMappings || {}).length,
  });

  console.log('[GBP Connector] TODO: Implement reviews fetch');

  // TODO: Implement review fetch
  // For each location, fetch:
  // - Total review count
  // - Average rating
  // Create points with metricName = 'Reviews' and 'Review Rating'

  return [];
}

// ============================================================================
// Transform Helpers
// ============================================================================

/**
 * Transform GBP API response to MediaPerformancePoint[]
 *
 * @param response - Raw GBP API response
 * @param companyId - Company ID to associate with points
 * @param locationMappings - Map from GBP location ID to MediaStore ID
 * @returns Transformed MediaPerformancePoint[]
 */
function transformGbpResponse(
  response: GbpInsightsResponse,
  companyId: string,
  locationMappings?: Record<string, string>
): MediaPerformancePoint[] {
  const points: Omit<MediaPerformancePoint, 'id' | 'createdAt'>[] = [];

  for (const locationMetric of response.locationMetrics) {
    // Extract location ID from location name
    const locationIdMatch = locationMetric.locationName.match(/locations\/(.+)$/);
    const gbpLocationId = locationIdMatch ? locationIdMatch[1] : null;
    const storeId = gbpLocationId && locationMappings ? locationMappings[gbpLocationId] : undefined;

    for (const metricValue of locationMetric.metricValues) {
      const metricName = GBP_METRIC_MAP[metricValue.metric];
      if (!metricName) continue;

      // Handle dimensional values (daily breakdown)
      if (metricValue.dimensionalValues) {
        for (const dimValue of metricValue.dimensionalValues) {
          const value = parseFloat(dimValue.value) || 0;
          if (value === 0) continue;

          // Extract date from time dimension
          const date = dimValue.timeDimension?.timeRange?.startTime?.split('T')[0] || '';

          points.push({
            companyId,
            storeId,
            date,
            channel: 'Maps',
            metricName,
            metricValue: value,
            metricUnit: METRIC_UNIT_MAP[metricName] || 'Count',
            sourceSystem: 'GBP',
            notes: `GBP Location: ${gbpLocationId}`,
          });
        }
      } else if (metricValue.totalValue) {
        // Aggregate value (no daily breakdown)
        const value = parseFloat(metricValue.totalValue.value) || 0;
        if (value === 0) continue;

        // Use current date for aggregate metrics
        const date = new Date().toISOString().split('T')[0];

        points.push({
          companyId,
          storeId,
          date,
          channel: 'Maps',
          metricName,
          metricValue: value,
          metricUnit: METRIC_UNIT_MAP[metricName] || 'Count',
          sourceSystem: 'GBP',
          notes: `GBP Location: ${gbpLocationId} (aggregate)`,
        });
      }
    }
  }

  return points as MediaPerformancePoint[];
}

/**
 * Transform review summaries to MediaPerformancePoint[]
 */
function transformReviewsToPoints(
  reviews: GbpReviewSummary[],
  companyId: string,
  locationMappings?: Record<string, string>
): MediaPerformancePoint[] {
  const points: Omit<MediaPerformancePoint, 'id' | 'createdAt'>[] = [];
  const date = new Date().toISOString().split('T')[0];

  for (const review of reviews) {
    const locationIdMatch = review.locationName.match(/locations\/(.+)$/);
    const gbpLocationId = locationIdMatch ? locationIdMatch[1] : null;
    const storeId = gbpLocationId && locationMappings ? locationMappings[gbpLocationId] : undefined;

    // Review count
    points.push({
      companyId,
      storeId,
      date,
      channel: 'Maps',
      metricName: 'Reviews',
      metricValue: review.reviewCount,
      metricUnit: 'Count',
      sourceSystem: 'GBP',
    });

    // Average rating
    points.push({
      companyId,
      storeId,
      date,
      channel: 'Maps',
      metricName: 'Review Rating',
      metricValue: review.averageRating,
      metricUnit: 'Rating',
      sourceSystem: 'GBP',
    });
  }

  return points as MediaPerformancePoint[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if GBP is configured for a company
 */
export function isGbpConfigured(config?: MediaGbpConfig): boolean {
  return !!config?.accountId;
}

/**
 * Validate GBP configuration
 */
export function validateGbpConfig(config: MediaGbpConfig): string[] {
  const errors: string[] = [];

  if (!config.accountId) {
    errors.push('GBP Account ID is required');
  }

  if (!config.locationMappings || Object.keys(config.locationMappings).length === 0) {
    errors.push('At least one location mapping is required');
  }

  return errors;
}

/**
 * Extract location ID from full GBP resource name
 */
export function extractLocationId(resourceName: string): string | null {
  const match = resourceName.match(/locations\/(.+)$/);
  return match ? match[1] : null;
}
