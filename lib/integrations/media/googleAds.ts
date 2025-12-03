// lib/integrations/media/googleAds.ts
// Google Ads API connector for Media performance metrics
//
// This connector fetches Google Ads campaign metrics including LSAs
// and translates them into MediaPerformancePoint[] for ingestion.
//
// SETUP REQUIREMENTS:
// 1. Set environment variables:
//    - GOOGLE_ADS_CLIENT_ID: OAuth client ID
//    - GOOGLE_ADS_CLIENT_SECRET: OAuth client secret
//    - GOOGLE_ADS_DEVELOPER_TOKEN: Google Ads developer token
//    - GOOGLE_ADS_REFRESH_TOKEN: OAuth refresh token
// 2. Store the Google Ads Customer ID in MediaIntegrationConfig
//
// LSA HANDLING:
// Local Service Ads are treated as channel = 'LSAs' and mapped separately
// from standard Search campaigns (channel = 'Search').
//
// CAMPAIGN NAMING CONVENTION:
// To map campaigns to markets/stores, use a naming convention like:
// "[Market] - [Channel] - [Objective]" e.g., "Seattle - Search - Installs"
// The connector will parse this pattern if configured.
//
// TODO: Implement actual Google Ads API calls when OAuth is configured.

import type {
  MediaPerformancePoint,
  MediaGoogleAdsConfig,
  MediaChannel,
  MetricName,
} from '@/lib/types/media';
import { METRIC_UNIT_MAP } from '@/lib/types/media';

// ============================================================================
// Google Ads API Types (shapes from Google Ads API v15)
// ============================================================================

/**
 * Google Ads campaign performance row
 */
interface GoogleAdsCampaignRow {
  campaign: {
    id: string;
    name: string;
    advertisingChannelType: 'SEARCH' | 'DISPLAY' | 'LOCAL_SERVICES' | 'VIDEO' | 'SHOPPING' | 'PERFORMANCE_MAX';
    status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  };
  segments: {
    date: string;
  };
  metrics: {
    impressions: string;
    clicks: string;
    costMicros: string; // Cost in micros (divide by 1,000,000)
    conversions: string;
    allConversions: string;
    ctr: string; // As decimal
    averageCpc: string; // In micros
  };
}

/**
 * Google Ads LSA lead row
 */
interface GoogleAdsLsaLeadRow {
  localServicesLead: {
    id: string;
    categoryId: string;
    serviceName: string;
    contactDetails: {
      phoneNumber?: string;
    };
    leadType: 'PHONE_CALL' | 'MESSAGE';
    leadStatus: 'NEW' | 'ACTIVE' | 'BOOKED' | 'DECLINED' | 'EXPIRED';
    creationDateTime: string;
    locale: string;
  };
}

// ============================================================================
// Metric Mapping
// ============================================================================

/**
 * Map Google Ads channel type to our MediaChannel
 */
function mapGoogleAdsChannelType(channelType: string): MediaChannel {
  switch (channelType) {
    case 'SEARCH':
      return 'Search';
    case 'LOCAL_SERVICES':
      return 'LSAs';
    case 'DISPLAY':
      return 'Display';
    case 'VIDEO':
    case 'SHOPPING':
    case 'PERFORMANCE_MAX':
    default:
      return 'Other';
  }
}

// ============================================================================
// Connector Functions
// ============================================================================

export interface GoogleAdsFetchParams {
  companyId: string;
  config: MediaGoogleAdsConfig;
  startDate: Date;
  endDate: Date;
  marketNameMap?: Record<string, string>; // Campaign name pattern -> market ID
}

/**
 * Fetch Google Ads campaign metrics for a company
 *
 * Retrieves impressions, clicks, cost, and conversions from Google Ads
 * and transforms them into MediaPerformancePoint[] format.
 *
 * @param params - Fetch parameters including company ID, config, and date range
 * @returns Array of MediaPerformancePoint ready for upsert
 *
 * TODO: Implement actual Google Ads API call when OAuth is configured.
 */
export async function fetchGoogleAdsMediaMetrics(
  params: GoogleAdsFetchParams
): Promise<MediaPerformancePoint[]> {
  const { companyId, config, startDate, endDate } = params;

  console.log('[Google Ads Connector] Fetching campaign metrics:', {
    companyId,
    customerId: config.customerId,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
  });

  // Build the intended GAQL query for documentation/debugging
  const gaqlQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.advertising_channel_type,
      campaign.status,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.all_conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date DESC
  `;

  console.log('[Google Ads Connector] TODO: Implement Google Ads API call');
  console.log('[Google Ads Connector] Intended GAQL query:', gaqlQuery);

  // TODO: Implement actual API call
  // const response = await callGoogleAdsApi(config.customerId, gaqlQuery);
  // return transformGoogleAdsResponse(response, companyId, params.marketNameMap);

  return [];
}

/**
 * Fetch LSA (Local Service Ads) leads for a company
 *
 * Retrieves LSA lead data and transforms to MediaPerformancePoint[].
 * LSAs are unique - they're lead-based rather than click-based.
 *
 * @param params - Fetch parameters
 * @returns Array of MediaPerformancePoint for LSA leads
 */
export async function fetchGoogleAdsLsaMetrics(
  params: GoogleAdsFetchParams
): Promise<MediaPerformancePoint[]> {
  const { companyId, config, startDate, endDate } = params;

  console.log('[Google Ads Connector] Fetching LSA leads:', {
    companyId,
    customerId: config.customerId,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
  });

  // LSA leads query
  const gaqlQuery = `
    SELECT
      local_services_lead.id,
      local_services_lead.category_id,
      local_services_lead.service_name,
      local_services_lead.lead_type,
      local_services_lead.lead_status,
      local_services_lead.creation_date_time
    FROM local_services_lead
    WHERE local_services_lead.creation_date_time >= '${startDate.toISOString()}'
      AND local_services_lead.creation_date_time <= '${endDate.toISOString()}'
  `;

  console.log('[Google Ads Connector] TODO: Implement LSA leads fetch');
  console.log('[Google Ads Connector] Intended query:', gaqlQuery);

  return [];
}

// ============================================================================
// Transform Helpers
// ============================================================================

/**
 * Transform Google Ads API response to MediaPerformancePoint[]
 *
 * @param rows - Raw Google Ads API response rows
 * @param companyId - Company ID to associate with points
 * @param marketNameMap - Optional map from campaign name patterns to market IDs
 * @returns Transformed MediaPerformancePoint[]
 */
function transformGoogleAdsResponse(
  rows: GoogleAdsCampaignRow[],
  companyId: string,
  marketNameMap?: Record<string, string>
): MediaPerformancePoint[] {
  const points: Omit<MediaPerformancePoint, 'id' | 'createdAt'>[] = [];

  for (const row of rows) {
    const date = row.segments.date;
    const channel = mapGoogleAdsChannelType(row.campaign.advertisingChannelType);
    const marketId = extractMarketFromCampaignName(row.campaign.name, marketNameMap);

    // Create points for each metric
    const metricsToCreate: Array<{
      metricName: MetricName;
      value: number;
    }> = [
      { metricName: 'Impressions', value: parseInt(row.metrics.impressions) || 0 },
      { metricName: 'Clicks', value: parseInt(row.metrics.clicks) || 0 },
      { metricName: 'Spend', value: parseInt(row.metrics.costMicros) / 1_000_000 }, // Convert micros to dollars
      { metricName: 'Installs', value: parseFloat(row.metrics.conversions) || 0 },
      { metricName: 'CTR', value: parseFloat(row.metrics.ctr) || 0 },
      { metricName: 'CPC', value: parseInt(row.metrics.averageCpc) / 1_000_000 },
    ];

    for (const metric of metricsToCreate) {
      if (metric.value === 0 && metric.metricName !== 'Spend') continue; // Skip zero values except spend

      points.push({
        companyId,
        date,
        channel,
        metricName: metric.metricName,
        metricValue: metric.value,
        metricUnit: METRIC_UNIT_MAP[metric.metricName] || 'Count',
        sourceSystem: 'Google Ads',
        marketId,
        campaignId: row.campaign.id,
        notes: `Campaign: ${row.campaign.name}`,
      });
    }
  }

  return points as MediaPerformancePoint[];
}

/**
 * Extract market ID from campaign name using naming convention
 *
 * Expected format: "[Market] - [Channel] - [Objective]"
 * Example: "Seattle - Search - Installs" -> looks up "Seattle" in map
 */
function extractMarketFromCampaignName(
  campaignName: string,
  marketNameMap?: Record<string, string>
): string | undefined {
  if (!marketNameMap) return undefined;

  // Try to extract market from campaign name
  const parts = campaignName.split(' - ');
  if (parts.length > 0) {
    const potentialMarket = parts[0].trim();
    if (marketNameMap[potentialMarket]) {
      return marketNameMap[potentialMarket];
    }
  }

  // Try partial matching
  for (const [marketName, marketId] of Object.entries(marketNameMap)) {
    if (campaignName.toLowerCase().includes(marketName.toLowerCase())) {
      return marketId;
    }
  }

  return undefined;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if Google Ads is configured for a company
 */
export function isGoogleAdsConfigured(config?: MediaGoogleAdsConfig): boolean {
  return !!config?.customerId;
}

/**
 * Validate Google Ads configuration
 */
export function validateGoogleAdsConfig(config: MediaGoogleAdsConfig): string[] {
  const errors: string[] = [];

  if (!config.customerId) {
    errors.push('Google Ads Customer ID is required');
  } else if (!/^\d{3}-\d{3}-\d{4}$|^\d{10}$/.test(config.customerId.replace(/-/g, ''))) {
    errors.push('Google Ads Customer ID must be in format XXX-XXX-XXXX');
  }

  return errors;
}

/**
 * Format customer ID to standard format (XXX-XXX-XXXX)
 */
export function formatCustomerId(customerId: string): string {
  const digits = customerId.replace(/\D/g, '');
  if (digits.length !== 10) return customerId;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
