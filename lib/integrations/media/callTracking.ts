// lib/integrations/media/callTracking.ts
// Call tracking connector for Media performance metrics
//
// This connector supports multiple call tracking providers (CallRail, CTM, etc.)
// and translates call data into MediaPerformancePoint[] for ingestion.
//
// SUPPORTED PROVIDERS:
// - CallRail: Full integration with calls, qualified calls, call outcomes
// - CTM (CallTrackingMetrics): Basic call count integration
// - Other: Generic interface for custom providers
//
// SETUP REQUIREMENTS:
// For CallRail:
// 1. Set CALLRAIL_API_KEY environment variable
// 2. Store account ID in MediaIntegrationConfig.callTracking.accountId
// 3. Map tracking numbers to store IDs in numberMappings
//
// For CTM:
// 1. Set CTM_API_KEY environment variable
// 2. Store account ID in MediaIntegrationConfig.callTracking.accountId
//
// TODO: Implement actual API calls when credentials are configured.

import type {
  MediaPerformancePoint,
  MediaCallTrackingConfig,
  CallTrackingProvider,
} from '@/lib/types/media';
import { METRIC_UNIT_MAP } from '@/lib/types/media';

// ============================================================================
// Provider-Specific Types
// ============================================================================

/**
 * CallRail call record
 * @see https://apidocs.callrail.com/#calls
 */
interface CallRailCall {
  id: string;
  answered: boolean;
  business_phone_number: string;
  caller_id: string;
  caller_name: string | null;
  customer_city: string;
  customer_state: string;
  direction: 'inbound' | 'outbound';
  duration: number; // seconds
  first_call: boolean;
  formatted_business_phone_number: string;
  formatted_caller_id: string;
  formatted_tracking_phone_number: string;
  formatted_tracking_source: string;
  landing_page_url: string | null;
  lead_status: 'new_lead' | 'contacted' | 'qualified' | 'unqualified' | 'converted' | null;
  source: string;
  source_name: string;
  start_time: string; // ISO timestamp
  tags: string[];
  tracking_phone_number: string;
  user_defined: Record<string, string>;
  value: number | null; // Custom value if set
}

/**
 * CallRail API response for calls list
 */
interface CallRailCallsResponse {
  calls: CallRailCall[];
  page: number;
  per_page: number;
  total_pages: number;
  total_records: number;
}

/**
 * CTM call record
 */
interface CtmCall {
  id: string;
  start_time: string;
  duration: number;
  phone_number: string;
  tracking_number: string;
  caller_id: string;
  answered: boolean;
  status: string;
}

// ============================================================================
// Connector Functions
// ============================================================================

export interface CallTrackingFetchParams {
  companyId: string;
  config: MediaCallTrackingConfig;
  startDate: Date;
  endDate: Date;
}

/**
 * Fetch call tracking metrics for a company
 *
 * Routes to the appropriate provider-specific fetch function.
 *
 * @param params - Fetch parameters including company ID, config, and date range
 * @returns Array of MediaPerformancePoint ready for upsert
 */
export async function fetchCallTrackingMetrics(
  params: CallTrackingFetchParams
): Promise<MediaPerformancePoint[]> {
  const { config } = params;

  switch (config.provider) {
    case 'CallRail':
      return fetchCallRailMetrics(params);
    case 'CTM':
      return fetchCtmMetrics(params);
    default:
      console.warn(`[Call Tracking] Unknown provider: ${config.provider}`);
      return [];
  }
}

/**
 * Fetch CallRail call metrics
 *
 * @param params - Fetch parameters
 * @returns Array of MediaPerformancePoint
 */
async function fetchCallRailMetrics(
  params: CallTrackingFetchParams
): Promise<MediaPerformancePoint[]> {
  const { companyId, config, startDate, endDate } = params;

  console.log('[CallRail Connector] Fetching calls:', {
    companyId,
    accountId: config.accountId,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
  });

  // Check for API key
  const apiKey = config.apiKey || process.env.CALLRAIL_API_KEY;
  if (!apiKey) {
    console.warn('[CallRail Connector] No API key configured, skipping');
    return [];
  }

  // Build the intended API request
  const intendedRequest = {
    url: `https://api.callrail.com/v3/a/${config.accountId}/calls.json`,
    params: {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      per_page: 250,
      fields: 'id,answered,business_phone_number,direction,duration,first_call,lead_status,source,start_time,tracking_phone_number,value',
    },
    headers: {
      Authorization: `Token token=${apiKey}`,
    },
  };

  console.log('[CallRail Connector] TODO: Implement CallRail API call');
  console.log('[CallRail Connector] Intended request:', JSON.stringify(intendedRequest, null, 2));

  // TODO: Implement actual API call
  // const response = await fetch(intendedRequest.url, { ... });
  // return transformCallRailResponse(await response.json(), companyId, config.numberMappings);

  return [];
}

/**
 * Fetch CTM (CallTrackingMetrics) call metrics
 *
 * @param params - Fetch parameters
 * @returns Array of MediaPerformancePoint
 */
async function fetchCtmMetrics(
  params: CallTrackingFetchParams
): Promise<MediaPerformancePoint[]> {
  const { companyId, config, startDate, endDate } = params;

  console.log('[CTM Connector] Fetching calls:', {
    companyId,
    accountId: config.accountId,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
  });

  // Check for API key
  const apiKey = config.apiKey || process.env.CTM_API_KEY;
  if (!apiKey) {
    console.warn('[CTM Connector] No API key configured, skipping');
    return [];
  }

  console.log('[CTM Connector] TODO: Implement CTM API call');

  // TODO: Implement actual API call

  return [];
}

// ============================================================================
// Transform Helpers
// ============================================================================

/**
 * Transform CallRail API response to MediaPerformancePoint[]
 *
 * Aggregates calls by date and store, creating points for:
 * - Total calls
 * - Qualified calls (based on lead_status)
 * - First-time callers
 *
 * @param response - Raw CallRail API response
 * @param companyId - Company ID to associate with points
 * @param numberMappings - Map from tracking number to store ID
 * @returns Transformed MediaPerformancePoint[]
 */
function transformCallRailResponse(
  response: CallRailCallsResponse,
  companyId: string,
  numberMappings?: Record<string, string>
): MediaPerformancePoint[] {
  const points: Omit<MediaPerformancePoint, 'id' | 'createdAt'>[] = [];

  // Group calls by date and store
  const grouped: Record<
    string,
    {
      date: string;
      storeId?: string;
      totalCalls: number;
      qualifiedCalls: number;
      firstTimeCalls: number;
    }
  > = {};

  for (const call of response.calls) {
    // Only count inbound, answered calls
    if (call.direction !== 'inbound' || !call.answered) continue;

    const date = call.start_time.split('T')[0];
    const storeId = numberMappings?.[call.tracking_phone_number];
    const key = `${date}|${storeId || '_company_'}`;

    if (!grouped[key]) {
      grouped[key] = {
        date,
        storeId,
        totalCalls: 0,
        qualifiedCalls: 0,
        firstTimeCalls: 0,
      };
    }

    grouped[key].totalCalls++;

    // Count qualified calls
    if (call.lead_status === 'qualified' || call.lead_status === 'converted') {
      grouped[key].qualifiedCalls++;
    }

    // Count first-time callers
    if (call.first_call) {
      grouped[key].firstTimeCalls++;
    }
  }

  // Create points from grouped data
  for (const group of Object.values(grouped)) {
    // Total calls
    points.push({
      companyId,
      storeId: group.storeId,
      date: group.date,
      channel: 'Other', // Call tracking spans all channels
      metricName: 'Calls',
      metricValue: group.totalCalls,
      metricUnit: 'Count',
      sourceSystem: 'CallRail',
    });

    // Qualified calls
    if (group.qualifiedCalls > 0) {
      points.push({
        companyId,
        storeId: group.storeId,
        date: group.date,
        channel: 'Other',
        metricName: 'Qualified Calls',
        metricValue: group.qualifiedCalls,
        metricUnit: 'Count',
        sourceSystem: 'CallRail',
      });
    }
  }

  return points as MediaPerformancePoint[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if call tracking is configured for a company
 */
export function isCallTrackingConfigured(config?: MediaCallTrackingConfig): boolean {
  if (!config?.provider) return false;

  // Check for API key in config or environment
  switch (config.provider) {
    case 'CallRail':
      return !!(config.apiKey || process.env.CALLRAIL_API_KEY);
    case 'CTM':
      return !!(config.apiKey || process.env.CTM_API_KEY);
    default:
      return !!config.apiKey;
  }
}

/**
 * Validate call tracking configuration
 */
export function validateCallTrackingConfig(config: MediaCallTrackingConfig): string[] {
  const errors: string[] = [];

  if (!config.provider) {
    errors.push('Call tracking provider is required');
  }

  if (config.provider === 'CallRail' || config.provider === 'CTM') {
    if (!config.accountId) {
      errors.push('Account ID is required');
    }
    if (!config.apiKey && !process.env[`${config.provider.toUpperCase()}_API_KEY`]) {
      errors.push('API key is required (via config or environment variable)');
    }
  }

  return errors;
}

/**
 * Get a list of supported call tracking providers
 */
export function getSupportedProviders(): CallTrackingProvider[] {
  return ['CallRail', 'CTM', 'Other'];
}

/**
 * Normalize phone number for comparison
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Handle US numbers with or without country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  if (digits.length === 10) {
    return digits;
  }

  return phone; // Return original if can't normalize
}
