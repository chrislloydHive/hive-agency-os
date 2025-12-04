// lib/media/cockpit.ts
// Media Cockpit data aggregation service
//
// Provides data for the Media Lab cockpit view including:
// - Plan vs Actual summary
// - Provider breakdown
// - Time-range-aware metrics

import type {
  MediaChannel,
  MediaProvider,
  MediaDateRange,
  MediaChannelPerformance,
} from '@/lib/types/media';
import type {
  MediaPlan,
  MediaPlanChannel,
  MediaPlanFlight,
} from '@/lib/types/mediaLab';
import { getDateRangeFromPreset } from '@/lib/types/media';
import {
  getMediaPerformanceByCompany,
} from '@/lib/airtable/mediaPerformance';
import {
  getActiveMediaPlansForCompany,
  getChannelsForMediaPlans,
  getFlightsForMediaPlans,
} from '@/lib/airtable/mediaLab';
import { getMediaStoresByCompany } from '@/lib/airtable/mediaStores';

// ============================================================================
// Types
// ============================================================================

export interface PlanVsActualSummary {
  // Plan totals
  plannedBudget: number;
  plannedLeads: number;
  plannedInstalls: number;
  plannedCpl: number | null;
  // Actual totals
  actualSpend: number;
  actualLeads: number;
  actualInstalls: number;
  actualCpl: number | null;
  // Variance
  budgetVariance: number; // actual - planned
  budgetVariancePct: number | null;
  leadsVariance: number;
  leadsVariancePct: number | null;
  // Has data flags
  hasPlanData: boolean;
  hasActualData: boolean;
}

export interface ProviderBreakdown {
  provider: MediaProvider;
  providerLabel: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  installs: number;
  calls: number;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  spendShare: number; // 0-1
}

export interface ChannelBreakdown {
  channel: MediaChannel;
  channelLabel: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  installs: number;
  calls: number;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  spendShare: number; // 0-1
}

export interface MediaCockpitData {
  // Summary KPIs
  totalSpend: number;
  totalLeads: number;
  totalInstalls: number;
  totalCalls: number;
  totalImpressions: number;
  totalClicks: number;
  avgCpl: number | null;
  avgCpc: number | null;
  // Plan vs Actual
  planVsActual: PlanVsActualSummary;
  // Breakdowns
  byProvider: ProviderBreakdown[];
  byChannel: ChannelBreakdown[];
  // Store count for multi-location
  storeCount: number;
  // Active plans info
  activePlanCount: number;
  activeFlightCount: number;
}

// ============================================================================
// Time Range Presets
// ============================================================================

export type TimeRangePreset = 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'thisQuarter';

export interface TimeRangeOption {
  key: TimeRangePreset;
  label: string;
  shortLabel: string;
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { key: 'last7', label: 'Last 7 Days', shortLabel: '7D' },
  { key: 'last30', label: 'Last 30 Days', shortLabel: '30D' },
  { key: 'last90', label: 'Last 90 Days', shortLabel: '90D' },
  { key: 'thisMonth', label: 'This Month', shortLabel: 'MTD' },
  { key: 'lastMonth', label: 'Last Month', shortLabel: 'LM' },
  { key: 'thisQuarter', label: 'This Quarter', shortLabel: 'QTD' },
];

export function getTimeRange(preset: TimeRangePreset): MediaDateRange {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  switch (preset) {
    case 'last7':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last30':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last90':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'thisQuarter':
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterStart, 1);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

// ============================================================================
// Main Cockpit Data Function
// ============================================================================

/**
 * Get comprehensive media cockpit data for a company
 */
export async function getMediaCockpitData(
  companyId: string,
  range?: MediaDateRange,
  storeId?: string | null
): Promise<MediaCockpitData> {
  const dateRange = range || getDateRangeFromPreset('last30');

  // Fetch all data in parallel
  const [
    performance,
    stores,
    activePlans,
  ] = await Promise.all([
    getMediaPerformanceByCompany(companyId, {
      range: dateRange,
      storeId: storeId || undefined,
    }),
    getMediaStoresByCompany(companyId),
    getActiveMediaPlansForCompany(companyId),
  ]);

  // Get channels and flights for active plans
  const planIds = activePlans.map(p => p.id);
  const [channelsByPlan, flightsByPlan] = await Promise.all([
    getChannelsForMediaPlans(planIds),
    getFlightsForMediaPlans(planIds),
  ]);

  // Aggregate actuals from performance data
  const actuals = aggregatePerformance(performance);

  // Aggregate planned values from active plans
  const planned = aggregatePlannedValues(activePlans, channelsByPlan, flightsByPlan, dateRange);

  // Build plan vs actual summary
  const planVsActual = buildPlanVsActual(planned, actuals);

  // Build provider breakdown
  const byProvider = buildProviderBreakdown(performance);

  // Build channel breakdown
  const byChannel = buildChannelBreakdown(performance);

  // Count active flights (within date range)
  const activeFlightCount = countActiveFlights(flightsByPlan, dateRange);

  return {
    // Summary KPIs
    totalSpend: actuals.spend,
    totalLeads: actuals.lsaLeads,
    totalInstalls: actuals.installs,
    totalCalls: actuals.calls,
    totalImpressions: actuals.impressions,
    totalClicks: actuals.clicks,
    avgCpl: actuals.lsaLeads + actuals.calls > 0
      ? actuals.spend / (actuals.lsaLeads + actuals.calls)
      : null,
    avgCpc: actuals.clicks > 0 ? actuals.spend / actuals.clicks : null,
    // Plan vs Actual
    planVsActual,
    // Breakdowns
    byProvider,
    byChannel,
    // Counts
    storeCount: stores.length,
    activePlanCount: activePlans.length,
    activeFlightCount,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface AggregatedActuals {
  spend: number;
  impressions: number;
  clicks: number;
  calls: number;
  lsaLeads: number;
  installs: number;
}

function aggregatePerformance(
  points: Array<{ metricName: string; metricValue: number; provider?: MediaProvider | null; channel?: MediaChannel | null }>
): AggregatedActuals {
  const result: AggregatedActuals = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    calls: 0,
    lsaLeads: 0,
    installs: 0,
  };

  for (const point of points) {
    switch (point.metricName) {
      case 'Spend':
        result.spend += point.metricValue;
        break;
      case 'Impressions':
      case 'Maps Impressions':
      case 'Search Impressions':
        result.impressions += point.metricValue;
        break;
      case 'Clicks':
        result.clicks += point.metricValue;
        break;
      case 'Calls':
      case 'Qualified Calls':
        result.calls += point.metricValue;
        break;
      case 'LSAs Leads':
      case 'Leads':
        result.lsaLeads += point.metricValue;
        break;
      case 'Installs':
        result.installs += point.metricValue;
        break;
    }
  }

  return result;
}

interface PlannedValues {
  budget: number;
  leads: number;
  installs: number;
}

function aggregatePlannedValues(
  plans: MediaPlan[],
  channelsByPlan: Map<string, MediaPlanChannel[]>,
  flightsByPlan: Map<string, MediaPlanFlight[]>,
  dateRange: MediaDateRange
): PlannedValues {
  let totalBudget = 0;
  let totalLeads = 0;
  let totalInstalls = 0;

  for (const plan of plans) {
    // Check if plan overlaps with date range
    const planStart = plan.timeframeStart ? new Date(plan.timeframeStart) : null;
    const planEnd = plan.timeframeEnd ? new Date(plan.timeframeEnd) : null;

    // Simple overlap check - plan active during range
    const overlaps = (!planStart || planStart <= dateRange.end) &&
                     (!planEnd || planEnd >= dateRange.start);

    if (!overlaps) continue;

    // Get flights for this plan that are active in the date range
    const flights = flightsByPlan.get(plan.id) || [];
    const activeFlights = flights.filter(f => {
      const fStart = f.startDate ? new Date(f.startDate) : null;
      const fEnd = f.endDate ? new Date(f.endDate) : null;
      return (!fStart || fStart <= dateRange.end) && (!fEnd || fEnd >= dateRange.start);
    });

    if (activeFlights.length > 0) {
      // Use flight budgets
      for (const flight of activeFlights) {
        totalBudget += flight.budget || 0;
        totalLeads += flight.leadGoal || 0;
        totalInstalls += flight.installGoal || 0;
      }
    } else {
      // Use plan budget (prorated to date range if needed)
      // For simplicity, assume monthly budget and prorate
      const rangeDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
      const dailyBudget = (plan.totalBudget || 0) / 30;
      totalBudget += dailyBudget * rangeDays;

      // Estimate leads from channel expected volumes
      const channels = channelsByPlan.get(plan.id) || [];
      for (const ch of channels) {
        const dailyVolume = (ch.expectedVolume || 0) / 30;
        totalLeads += dailyVolume * rangeDays;
      }
    }
  }

  return {
    budget: totalBudget,
    leads: totalLeads,
    installs: totalInstalls,
  };
}

function buildPlanVsActual(
  planned: PlannedValues,
  actuals: AggregatedActuals
): PlanVsActualSummary {
  const hasPlanData = planned.budget > 0;
  const hasActualData = actuals.spend > 0;

  const actualLeads = actuals.lsaLeads + actuals.calls;

  return {
    // Plan
    plannedBudget: Math.round(planned.budget),
    plannedLeads: Math.round(planned.leads),
    plannedInstalls: Math.round(planned.installs),
    plannedCpl: planned.leads > 0 ? planned.budget / planned.leads : null,
    // Actual
    actualSpend: Math.round(actuals.spend),
    actualLeads: Math.round(actualLeads),
    actualInstalls: Math.round(actuals.installs),
    actualCpl: actualLeads > 0 ? actuals.spend / actualLeads : null,
    // Variance
    budgetVariance: actuals.spend - planned.budget,
    budgetVariancePct: planned.budget > 0
      ? ((actuals.spend - planned.budget) / planned.budget) * 100
      : null,
    leadsVariance: actualLeads - planned.leads,
    leadsVariancePct: planned.leads > 0
      ? ((actualLeads - planned.leads) / planned.leads) * 100
      : null,
    // Flags
    hasPlanData,
    hasActualData,
  };
}

function buildProviderBreakdown(
  performance: Array<{ metricName: string; metricValue: number; provider?: MediaProvider | null; channel?: MediaChannel | null }>
): ProviderBreakdown[] {
  const byProvider: Record<string, {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    installs: number;
    calls: number;
  }> = {};

  for (const point of performance) {
    const provider = point.provider || 'other';
    if (!byProvider[provider]) {
      byProvider[provider] = { spend: 0, impressions: 0, clicks: 0, leads: 0, installs: 0, calls: 0 };
    }

    switch (point.metricName) {
      case 'Spend':
        byProvider[provider].spend += point.metricValue;
        break;
      case 'Impressions':
      case 'Maps Impressions':
      case 'Search Impressions':
        byProvider[provider].impressions += point.metricValue;
        break;
      case 'Clicks':
        byProvider[provider].clicks += point.metricValue;
        break;
      case 'Calls':
      case 'Qualified Calls':
        byProvider[provider].calls += point.metricValue;
        break;
      case 'LSAs Leads':
      case 'Leads':
        byProvider[provider].leads += point.metricValue;
        break;
      case 'Installs':
        byProvider[provider].installs += point.metricValue;
        break;
    }
  }

  const totalSpend = Object.values(byProvider).reduce((sum, p) => sum + p.spend, 0);

  const providerLabels: Record<string, string> = {
    google_ads: 'Google Ads',
    meta_ads: 'Meta Ads',
    microsoft_ads: 'Microsoft Ads',
    tiktok_ads: 'TikTok',
    youtube_ads: 'YouTube',
    dv360: 'DV360',
    ga4: 'GA4',
    lsa: 'LSAs',
    gbp: 'GBP',
    radio_vendor: 'Radio',
    tv_vendor: 'TV',
    ooh_vendor: 'OOH',
    streaming_audio_vendor: 'Streaming Audio',
    print_vendor: 'Print',
    direct_mail_vendor: 'Direct Mail',
    other: 'Other',
  };

  return Object.entries(byProvider)
    .filter(([, m]) => m.spend > 0 || m.impressions > 0)
    .map(([provider, m]) => {
      const leads = m.leads + m.calls;
      return {
        provider: provider as MediaProvider,
        providerLabel: providerLabels[provider] || provider,
        spend: m.spend,
        impressions: m.impressions,
        clicks: m.clicks,
        leads: m.leads,
        installs: m.installs,
        calls: m.calls,
        ctr: m.impressions > 0 ? m.clicks / m.impressions : null,
        cpc: m.clicks > 0 ? m.spend / m.clicks : null,
        cpl: leads > 0 ? m.spend / leads : null,
        spendShare: totalSpend > 0 ? m.spend / totalSpend : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

function buildChannelBreakdown(
  performance: Array<{ metricName: string; metricValue: number; provider?: MediaProvider | null; channel?: MediaChannel | null }>
): ChannelBreakdown[] {
  const byChannel: Record<string, {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    installs: number;
    calls: number;
  }> = {};

  for (const point of performance) {
    const channel = point.channel || 'Other';
    if (!byChannel[channel]) {
      byChannel[channel] = { spend: 0, impressions: 0, clicks: 0, leads: 0, installs: 0, calls: 0 };
    }

    switch (point.metricName) {
      case 'Spend':
        byChannel[channel].spend += point.metricValue;
        break;
      case 'Impressions':
      case 'Maps Impressions':
      case 'Search Impressions':
        byChannel[channel].impressions += point.metricValue;
        break;
      case 'Clicks':
        byChannel[channel].clicks += point.metricValue;
        break;
      case 'Calls':
      case 'Qualified Calls':
        byChannel[channel].calls += point.metricValue;
        break;
      case 'LSAs Leads':
      case 'Leads':
        byChannel[channel].leads += point.metricValue;
        break;
      case 'Installs':
        byChannel[channel].installs += point.metricValue;
        break;
    }
  }

  const totalSpend = Object.values(byChannel).reduce((sum, c) => sum + c.spend, 0);

  return Object.entries(byChannel)
    .filter(([, m]) => m.spend > 0 || m.impressions > 0)
    .map(([channel, m]) => {
      const leads = m.leads + m.calls;
      return {
        channel: channel as MediaChannel,
        channelLabel: channel,
        spend: m.spend,
        impressions: m.impressions,
        clicks: m.clicks,
        leads: m.leads,
        installs: m.installs,
        calls: m.calls,
        ctr: m.impressions > 0 ? m.clicks / m.impressions : null,
        cpc: m.clicks > 0 ? m.spend / m.clicks : null,
        cpl: leads > 0 ? m.spend / leads : null,
        spendShare: totalSpend > 0 ? m.spend / totalSpend : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

function countActiveFlights(
  flightsByPlan: Map<string, MediaPlanFlight[]>,
  dateRange: MediaDateRange
): number {
  let count = 0;

  for (const flights of flightsByPlan.values()) {
    for (const flight of flights) {
      const fStart = flight.startDate ? new Date(flight.startDate) : null;
      const fEnd = flight.endDate ? new Date(flight.endDate) : null;

      // Check if flight overlaps with date range and is active
      const overlaps = (!fStart || fStart <= dateRange.end) && (!fEnd || fEnd >= dateRange.start);
      const isActive = flight.status === 'active' || flight.status === undefined;

      if (overlaps && isActive) {
        count++;
      }
    }
  }

  return count;
}

// ============================================================================
// Store List Helper
// ============================================================================

export interface MediaStoreOption {
  id: string;
  name: string;
  market: string | null;
  storeCode: string | null;
}

/**
 * Get list of stores for the store selector
 */
export async function getMediaStoreOptions(companyId: string): Promise<MediaStoreOption[]> {
  const stores = await getMediaStoresByCompany(companyId);

  return stores.map(s => ({
    id: s.id,
    name: s.name,
    market: s.marketName ?? null,
    storeCode: s.storeCode ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name));
}
