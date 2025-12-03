// lib/media/sync.ts
// Media sync orchestration layer
//
// This module coordinates syncing media performance data from all external sources
// (GA4, Google Ads, GBP, Call Tracking) into the MediaPerformance Airtable table.
//
// USAGE:
// 1. Configure MediaIntegrationConfig for the company (stored in Airtable or env)
// 2. Call syncMediaForCompany(companyId, dateRange) to trigger a full sync
// 3. Each configured source will be fetched and data upserted
//
// ERROR HANDLING:
// - Each source is processed independently; one source failing won't block others
// - Errors are collected and returned in the sync result
// - Missing configurations are logged as warnings, not errors

import type {
  MediaSyncResult,
  MediaDateRange,
  MediaIntegrationConfig,
  MediaPerformancePoint,
  SourceSystem,
} from '@/lib/types/media';
import { getDateRangeFromPreset } from '@/lib/types/media';
import {
  fetchGa4MediaMetrics,
  fetchGa4ConversionEvents,
  isGa4Configured,
} from '@/lib/integrations/media/ga4';
import {
  fetchGoogleAdsMediaMetrics,
  fetchGoogleAdsLsaMetrics,
  isGoogleAdsConfigured,
} from '@/lib/integrations/media/googleAds';
import { fetchGbpMetrics, fetchGbpReviews, isGbpConfigured } from '@/lib/integrations/media/gbp';
import {
  fetchCallTrackingMetrics,
  isCallTrackingConfigured,
} from '@/lib/integrations/media/callTracking';
import { upsertMediaPerformancePoints } from '@/lib/airtable/mediaPerformance';

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Get media integration config for a company
 *
 * TODO: This should eventually load from Airtable (Companies table or dedicated config table)
 * For now, returns a stub config that can be extended.
 */
export async function getMediaIntegrationConfig(
  companyId: string
): Promise<MediaIntegrationConfig | null> {
  console.log('[Media Sync] Loading integration config for company:', companyId);

  // TODO: Load from Airtable
  // For now, return a placeholder that will skip all integrations

  // Example of what the config structure looks like:
  // return {
  //   companyId,
  //   ga4: {
  //     propertyId: '123456789',
  //     dimensionMappings: {
  //       storeIdDimension: 'customEvent:store_id',
  //     },
  //   },
  //   googleAds: {
  //     customerId: '123-456-7890',
  //     campaignNamingPattern: '[Market] - [Channel] - [Objective]',
  //   },
  //   gbp: {
  //     accountId: '123456789',
  //     locationMappings: {
  //       'locations/123': 'rec_store_seattle',
  //       'locations/456': 'rec_store_denver',
  //     },
  //   },
  //   callTracking: {
  //     provider: 'CallRail',
  //     accountId: '123456',
  //     numberMappings: {
  //       '+12065551234': 'rec_store_seattle',
  //     },
  //   },
  // };

  return {
    companyId,
    // No integrations configured by default
  };
}

// ============================================================================
// Sync Functions
// ============================================================================

export interface SyncOptions {
  /** Only sync specific sources */
  sources?: SourceSystem[];
  /** Force refresh even if data exists */
  forceRefresh?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Sync all media data for a company within a date range
 *
 * This is the main entry point for media data ingestion. It:
 * 1. Loads the company's integration configuration
 * 2. Fetches data from each configured source
 * 3. Upserts all data into MediaPerformance table
 * 4. Returns a summary of the sync operation
 *
 * @param companyId - Airtable Company record ID
 * @param range - Date range to sync (default: last 30 days)
 * @param options - Optional sync configuration
 * @returns Sync result with counts and any errors
 */
export async function syncMediaForCompany(
  companyId: string,
  range?: MediaDateRange,
  options?: SyncOptions
): Promise<MediaSyncResult> {
  const startTime = Date.now();
  const dateRange = range || getDateRangeFromPreset('last30');
  const verbose = options?.verbose ?? false;

  console.log('[Media Sync] Starting sync:', {
    companyId,
    dateRange: {
      start: dateRange.start.toISOString().split('T')[0],
      end: dateRange.end.toISOString().split('T')[0],
    },
    options,
  });

  const result: MediaSyncResult = {
    success: false,
    companyId,
    dateRange,
    pointsCreated: 0,
    pointsUpdated: 0,
    errors: [],
    sourcesProcessed: [],
    duration: 0,
  };

  // Load integration config
  const config = await getMediaIntegrationConfig(companyId);
  if (!config) {
    result.errors.push('Failed to load integration config');
    result.duration = Date.now() - startTime;
    return result;
  }

  // Collect all points from all sources
  const allPoints: Omit<MediaPerformancePoint, 'id' | 'createdAt'>[] = [];
  const filterSources = options?.sources;

  // -------------------------------------------------------------------------
  // GA4
  // -------------------------------------------------------------------------
  if (
    isGa4Configured(config.ga4) &&
    (!filterSources || filterSources.includes('GA4'))
  ) {
    try {
      if (verbose) console.log('[Media Sync] Fetching GA4 metrics...');

      const ga4Points = await fetchGa4MediaMetrics({
        companyId,
        config: config.ga4!,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      allPoints.push(...ga4Points);

      const ga4Conversions = await fetchGa4ConversionEvents({
        companyId,
        config: config.ga4!,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      allPoints.push(...ga4Conversions);

      result.sourcesProcessed.push('GA4');
      if (verbose) console.log(`[Media Sync] GA4: ${ga4Points.length + ga4Conversions.length} points`);
    } catch (error) {
      const msg = `GA4 fetch failed: ${error}`;
      console.error('[Media Sync]', msg);
      result.errors.push(msg);
    }
  } else if (verbose && (!filterSources || filterSources.includes('GA4'))) {
    console.log('[Media Sync] GA4 not configured, skipping');
  }

  // -------------------------------------------------------------------------
  // Google Ads
  // -------------------------------------------------------------------------
  if (
    isGoogleAdsConfigured(config.googleAds) &&
    (!filterSources || filterSources.includes('Google Ads'))
  ) {
    try {
      if (verbose) console.log('[Media Sync] Fetching Google Ads metrics...');

      const adsPoints = await fetchGoogleAdsMediaMetrics({
        companyId,
        config: config.googleAds!,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      allPoints.push(...adsPoints);

      result.sourcesProcessed.push('Google Ads');
      if (verbose) console.log(`[Media Sync] Google Ads: ${adsPoints.length} points`);
    } catch (error) {
      const msg = `Google Ads fetch failed: ${error}`;
      console.error('[Media Sync]', msg);
      result.errors.push(msg);
    }
  } else if (verbose && (!filterSources || filterSources.includes('Google Ads'))) {
    console.log('[Media Sync] Google Ads not configured, skipping');
  }

  // -------------------------------------------------------------------------
  // LSAs (via Google Ads)
  // -------------------------------------------------------------------------
  if (
    isGoogleAdsConfigured(config.googleAds) &&
    (!filterSources || filterSources.includes('LSAs'))
  ) {
    try {
      if (verbose) console.log('[Media Sync] Fetching LSA metrics...');

      const lsaPoints = await fetchGoogleAdsLsaMetrics({
        companyId,
        config: config.googleAds!,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      allPoints.push(...lsaPoints);

      if (lsaPoints.length > 0) {
        result.sourcesProcessed.push('LSAs');
      }
      if (verbose) console.log(`[Media Sync] LSAs: ${lsaPoints.length} points`);
    } catch (error) {
      const msg = `LSAs fetch failed: ${error}`;
      console.error('[Media Sync]', msg);
      result.errors.push(msg);
    }
  }

  // -------------------------------------------------------------------------
  // GBP / Maps
  // -------------------------------------------------------------------------
  if (
    isGbpConfigured(config.gbp) &&
    (!filterSources || filterSources.includes('GBP'))
  ) {
    try {
      if (verbose) console.log('[Media Sync] Fetching GBP metrics...');

      const gbpPoints = await fetchGbpMetrics({
        companyId,
        config: config.gbp!,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      allPoints.push(...gbpPoints);

      const reviewPoints = await fetchGbpReviews({
        companyId,
        config: config.gbp!,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      allPoints.push(...reviewPoints);

      result.sourcesProcessed.push('GBP');
      if (verbose) console.log(`[Media Sync] GBP: ${gbpPoints.length + reviewPoints.length} points`);
    } catch (error) {
      const msg = `GBP fetch failed: ${error}`;
      console.error('[Media Sync]', msg);
      result.errors.push(msg);
    }
  } else if (verbose && (!filterSources || filterSources.includes('GBP'))) {
    console.log('[Media Sync] GBP not configured, skipping');
  }

  // -------------------------------------------------------------------------
  // Call Tracking
  // -------------------------------------------------------------------------
  if (
    isCallTrackingConfigured(config.callTracking) &&
    (!filterSources || filterSources.includes('CallRail') || filterSources.includes('CTM'))
  ) {
    try {
      if (verbose) console.log('[Media Sync] Fetching call tracking metrics...');

      const callPoints = await fetchCallTrackingMetrics({
        companyId,
        config: config.callTracking!,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      allPoints.push(...callPoints);

      result.sourcesProcessed.push(config.callTracking!.provider as SourceSystem);
      if (verbose) console.log(`[Media Sync] Call Tracking: ${callPoints.length} points`);
    } catch (error) {
      const msg = `Call tracking fetch failed: ${error}`;
      console.error('[Media Sync]', msg);
      result.errors.push(msg);
    }
  } else if (verbose) {
    console.log('[Media Sync] Call tracking not configured, skipping');
  }

  // -------------------------------------------------------------------------
  // Upsert all collected points
  // -------------------------------------------------------------------------
  if (allPoints.length > 0) {
    console.log(`[Media Sync] Upserting ${allPoints.length} performance points...`);

    try {
      const upsertResult = await upsertMediaPerformancePoints(allPoints);
      result.pointsCreated = upsertResult.created;
      result.pointsUpdated = upsertResult.updated;
      result.errors.push(...upsertResult.errors);
    } catch (error) {
      const msg = `Upsert failed: ${error}`;
      console.error('[Media Sync]', msg);
      result.errors.push(msg);
    }
  } else {
    console.log('[Media Sync] No data points to upsert');
  }

  // Finalize result
  result.success = result.errors.length === 0;
  result.duration = Date.now() - startTime;

  console.log('[Media Sync] Sync complete:', {
    success: result.success,
    pointsCreated: result.pointsCreated,
    pointsUpdated: result.pointsUpdated,
    sourcesProcessed: result.sourcesProcessed,
    errorCount: result.errors.length,
    duration: `${result.duration}ms`,
  });

  return result;
}

/**
 * Sync media data for multiple companies
 *
 * @param companyIds - Array of company IDs to sync
 * @param range - Date range to sync
 * @param options - Sync options
 * @returns Array of sync results, one per company
 */
export async function syncMediaForCompanies(
  companyIds: string[],
  range?: MediaDateRange,
  options?: SyncOptions
): Promise<MediaSyncResult[]> {
  console.log(`[Media Sync] Starting batch sync for ${companyIds.length} companies`);

  const results: MediaSyncResult[] = [];

  // Process sequentially to avoid rate limits
  for (const companyId of companyIds) {
    const result = await syncMediaForCompany(companyId, range, options);
    results.push(result);

    // Small delay between companies
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const successful = results.filter((r) => r.success).length;
  console.log(`[Media Sync] Batch sync complete: ${successful}/${companyIds.length} successful`);

  return results;
}
