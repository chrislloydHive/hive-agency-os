// lib/analytics/blueprintDataFetcher.ts
// Fetches GA4 and GSC data based on an Analytics Blueprint configuration
//
// This module takes a blueprint's metric configurations and fetches the
// appropriate data from GA4 Data API and Google Search Console API.
// Now uses the centralized fetchers with caching.

import type {
  AnalyticsBlueprint,
  AnalyticsMetricData,
} from './blueprintTypes';
import { fetchMetricsFromConfigs } from './fetchers';

// ============================================================================
// Types
// ============================================================================

export interface BlueprintDataFetchOptions {
  /** GA4 property ID (e.g., "properties/123456789") */
  ga4PropertyId?: string;
  /** Search Console site URL (e.g., "https://example.com/") */
  gscSiteUrl?: string;
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
  /** Company ID for caching */
  companyId?: string;
  /** Skip cache lookup */
  skipCache?: boolean;
}

export interface BlueprintDataResult {
  /** Data for primary metrics */
  primaryMetrics: AnalyticsMetricData[];
  /** Data for secondary metrics */
  secondaryMetrics: AnalyticsMetricData[];
  /** Any errors encountered */
  errors: string[];
}

// ============================================================================
// Main Fetch Function
// ============================================================================

/**
 * Fetch all data for an Analytics Blueprint
 */
export async function fetchBlueprintData(
  blueprint: AnalyticsBlueprint,
  options: BlueprintDataFetchOptions
): Promise<BlueprintDataResult> {
  const errors: string[] = [];
  const companyId = options.companyId || 'default';

  console.log('[BlueprintDataFetcher] Fetching data for blueprint:', {
    primaryMetrics: blueprint.primaryMetrics.length,
    secondaryMetrics: blueprint.secondaryMetrics.length,
    dateRange: `${options.startDate} to ${options.endDate}`,
  });

  try {
    // Fetch primary metrics
    const primaryMetrics = await fetchMetricsFromConfigs(
      companyId,
      blueprint.primaryMetrics,
      {
        ga4PropertyId: options.ga4PropertyId,
        gscSiteUrl: options.gscSiteUrl,
        startDate: options.startDate,
        endDate: options.endDate,
        skipCache: options.skipCache,
      }
    );

    // Fetch secondary metrics
    const secondaryMetrics = await fetchMetricsFromConfigs(
      companyId,
      blueprint.secondaryMetrics,
      {
        ga4PropertyId: options.ga4PropertyId,
        gscSiteUrl: options.gscSiteUrl,
        startDate: options.startDate,
        endDate: options.endDate,
        skipCache: options.skipCache,
      }
    );

    // Collect any metrics that returned empty (might indicate errors)
    for (const metric of [...primaryMetrics, ...secondaryMetrics]) {
      if (metric.points.length === 0 && metric.currentValue === undefined) {
        // This might be due to an error or no data
        console.warn(`[BlueprintDataFetcher] No data for metric: ${metric.metric.id}`);
      }
    }

    console.log('[BlueprintDataFetcher] Data fetched successfully:', {
      primaryMetrics: primaryMetrics.length,
      secondaryMetrics: secondaryMetrics.length,
    });

    return {
      primaryMetrics,
      secondaryMetrics,
      errors,
    };
  } catch (error) {
    console.error('[BlueprintDataFetcher] Error fetching data:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');

    return {
      primaryMetrics: [],
      secondaryMetrics: [],
      errors,
    };
  }
}

// ============================================================================
// API Route Helper
// ============================================================================

/**
 * Create an API route handler for fetching blueprint data
 */
export async function createBlueprintDataApiHandler(
  companyId: string,
  blueprint: AnalyticsBlueprint,
  ga4PropertyId: string | undefined,
  gscSiteUrl: string | undefined,
  dateRange: { startDate: string; endDate: string }
): Promise<BlueprintDataResult> {
  return fetchBlueprintData(blueprint, {
    companyId,
    ga4PropertyId,
    gscSiteUrl,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
}
