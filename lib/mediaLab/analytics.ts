// lib/mediaLab/analytics.ts
// Media Analytics V1 - Performance and Insights layer for Media Lab
//
// Fetches and aggregates data for:
// - Channel Performance Overview (GA4 + placeholder spend)
// - Store-Level Performance (from MediaPerformance + MediaStores)
// - Seasonal Performance (from MediaPlanFlights)
// - KPI Alerts + AI Insights

import {
  getStoreScorecards,
  getMarketScorecards,
  getMediaKpiSummary,
} from '@/lib/media/analytics';
import { getMediaStoresByCompany } from '@/lib/airtable/mediaStores';
import { getMediaPlansWithDetailsForCompany } from '@/lib/airtable/mediaLab';
import type {
  MediaStoreScorecardV2,
  MediaMarketScorecard,
  MediaChannelPerformance,
  MediaStore,
} from '@/lib/types/media';
import type {
  MediaPlanWithDetails,
  MediaPlanFlight,
  MediaChannelKey,
} from '@/lib/types/mediaLab';

// ============================================================================
// Types
// ============================================================================

export interface ChannelPerformanceMetrics {
  channel: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number | null;
  spend: number | null;
  leads: number;
  cpl: number | null;
  trend?: 'up' | 'down' | 'stable';
  trendPct?: number;
}

export interface StorePerformanceRow {
  storeId: string;
  storeName: string;
  storeCode?: string;
  marketName?: string;
  visibilityScore: number;
  calls: number;
  directionRequests: number;
  websiteClicks: number;
  leads: number;
  cpl: number | null;
  overallScore: number;
}

export interface SeasonalFlightPerformance {
  flightId: string;
  flightName: string;
  season: string | null;
  startDate: string | null;
  endDate: string | null;
  plannedBudget: number | null;
  actualSpend: number | null;
  conversions: number | null;
  cpl: number | null;
  liftVsPrevious: number | null;
  status: 'upcoming' | 'active' | 'completed' | 'unknown';
}

export interface MediaInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'comparison' | 'recommendation';
  severity: 'info' | 'warning' | 'success' | 'critical';
  title: string;
  description: string;
  metric?: string;
  value?: number;
  previousValue?: number;
  change?: number;
  actionable: boolean;
}

export interface MediaAnalyticsSummary {
  // Channel Performance
  channelPerformance: ChannelPerformanceMetrics[];
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number | null;
  totalLeads: number;
  overallCtr: number;
  overallCpl: number | null;

  // Store Performance
  storePerformance: StorePerformanceRow[];
  storeCount: number;
  storesNeedingAttention: number;

  // Seasonal Performance
  seasonalFlights: SeasonalFlightPerformance[];
  activePlans: MediaPlanWithDetails[];

  // Insights
  insights: MediaInsight[];

  // Meta
  hasData: boolean;
  hasMediaPlans: boolean;
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Get complete media analytics summary for a company
 */
export async function getMediaAnalyticsSummary(
  companyId: string,
  dateRangeDays: number = 30
): Promise<MediaAnalyticsSummary> {
  // Fetch all data in parallel
  const [
    kpiSummary,
    storeScorecardsV2,
    marketScorecards,
    stores,
    plansWithDetails,
  ] = await Promise.all([
    getMediaKpiSummary(companyId).catch(() => null),
    getStoreScorecards(companyId).catch(() => []),
    getMarketScorecards(companyId).catch(() => []),
    getMediaStoresByCompany(companyId).catch(() => []),
    getMediaPlansWithDetailsForCompany(companyId).catch(() => []),
  ]);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - dateRangeDays * 24 * 60 * 60 * 1000);
  const dateRange = {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
    label: `Last ${dateRangeDays} days`,
  };

  // Build channel performance from KPI summary
  const channelPerformance = buildChannelPerformance(kpiSummary?.channelBreakdown || []);

  // Build store performance from scorecards
  const storePerformance = buildStorePerformance(storeScorecardsV2, stores);

  // Build seasonal flight performance from plans
  const seasonalFlights = buildSeasonalFlights(plansWithDetails);

  // Generate insights
  const insights = generateInsights(
    channelPerformance,
    storePerformance,
    seasonalFlights,
    kpiSummary
  );

  // Calculate totals
  const totalImpressions = kpiSummary?.totalImpressions || 0;
  const totalClicks = kpiSummary?.totalClicks || 0;
  const totalSpend = kpiSummary?.totalSpend || null;
  const totalLeads = (kpiSummary?.totalCalls || 0) + (kpiSummary?.totalLsaLeads || 0);
  const overallCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const overallCpl = totalSpend && totalLeads > 0 ? totalSpend / totalLeads : null;

  const hasData = storeScorecardsV2.length > 0 || (kpiSummary?.totalImpressions || 0) > 0;
  const hasMediaPlans = plansWithDetails.length > 0;

  return {
    channelPerformance,
    totalImpressions,
    totalClicks,
    totalSpend,
    totalLeads,
    overallCtr,
    overallCpl,
    storePerformance,
    storeCount: storePerformance.length,
    storesNeedingAttention: storePerformance.filter(s => s.overallScore < 50).length,
    seasonalFlights,
    activePlans: plansWithDetails.filter(p => p.status === 'active'),
    insights,
    hasData,
    hasMediaPlans,
    dateRange,
  };
}

// ============================================================================
// Data Transformation
// ============================================================================

function buildChannelPerformance(
  breakdown: MediaChannelPerformance[]
): ChannelPerformanceMetrics[] {
  return breakdown.map(ch => ({
    channel: ch.channel,
    impressions: ch.impressions || 0,
    clicks: ch.clicks || 0,
    ctr: ch.ctr || (ch.impressions > 0 ? ch.clicks / ch.impressions : 0),
    cpc: ch.cpc || (ch.spend && ch.clicks > 0 ? ch.spend / ch.clicks : null),
    spend: ch.spend || null,
    leads: (ch.calls || 0) + (ch.lsaLeads || 0),
    cpl: ch.cpl || null,
  }));
}

function buildStorePerformance(
  scorecards: MediaStoreScorecardV2[],
  stores: MediaStore[]
): StorePerformanceRow[] {
  // Create a map of stores for additional data
  const storeMap = new Map(stores.map(s => [s.id, s]));

  return scorecards
    .map(sc => {
      const store = storeMap.get(sc.storeId);
      const leads = sc.calls + sc.lsaLeads;
      return {
        storeId: sc.storeId,
        storeName: sc.storeName,
        storeCode: sc.storeCode || store?.storeCode,
        marketName: sc.marketName || store?.marketName,
        visibilityScore: sc.visibilityScore,
        calls: sc.calls,
        directionRequests: sc.directionRequests,
        websiteClicks: sc.websiteClicks,
        leads,
        cpl: sc.spend && leads > 0 ? sc.spend / leads : null,
        overallScore: sc.overallScore,
      };
    })
    .sort((a, b) => b.overallScore - a.overallScore);
}

function buildSeasonalFlights(
  plans: MediaPlanWithDetails[]
): SeasonalFlightPerformance[] {
  const now = new Date();
  const flights: SeasonalFlightPerformance[] = [];

  for (const plan of plans) {
    for (const flight of plan.flights) {
      const startDate = flight.startDate ? new Date(flight.startDate) : null;
      const endDate = flight.endDate ? new Date(flight.endDate) : null;

      let status: SeasonalFlightPerformance['status'] = 'unknown';
      if (startDate && endDate) {
        if (now < startDate) {
          status = 'upcoming';
        } else if (now > endDate) {
          status = 'completed';
        } else {
          status = 'active';
        }
      }

      flights.push({
        flightId: flight.id,
        flightName: flight.name,
        season: flight.season,
        startDate: flight.startDate,
        endDate: flight.endDate,
        plannedBudget: flight.budget,
        actualSpend: null, // TODO: Calculate from MediaPerformance
        conversions: null, // TODO: Calculate from MediaPerformance
        cpl: null,
        liftVsPrevious: null, // TODO: Compare to previous period
        status,
      });
    }
  }

  // Sort by status priority (active first, then upcoming, then completed)
  const statusOrder = { active: 0, upcoming: 1, completed: 2, unknown: 3 };
  return flights.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}

// ============================================================================
// Insight Generation
// ============================================================================

function generateInsights(
  channelPerformance: ChannelPerformanceMetrics[],
  storePerformance: StorePerformanceRow[],
  seasonalFlights: SeasonalFlightPerformance[],
  kpiSummary: any
): MediaInsight[] {
  const insights: MediaInsight[] = [];

  // 1. Low-performing stores insight
  const lowPerformingStores = storePerformance.filter(s => s.overallScore < 50);
  if (lowPerformingStores.length > 0) {
    insights.push({
      id: 'low-performing-stores',
      type: 'anomaly',
      severity: lowPerformingStores.length > 3 ? 'critical' : 'warning',
      title: `${lowPerformingStores.length} store${lowPerformingStores.length > 1 ? 's' : ''} need attention`,
      description: `Store${lowPerformingStores.length > 1 ? 's' : ''} with overall score below 50: ${lowPerformingStores.slice(0, 3).map(s => s.storeName).join(', ')}${lowPerformingStores.length > 3 ? ` and ${lowPerformingStores.length - 3} more` : ''}`,
      metric: 'overallScore',
      value: Math.min(...lowPerformingStores.map(s => s.overallScore)),
      actionable: true,
    });
  }

  // 2. Top channel insight
  const topChannel = channelPerformance.sort((a, b) => b.leads - a.leads)[0];
  if (topChannel && topChannel.leads > 0) {
    insights.push({
      id: 'top-channel',
      type: 'trend',
      severity: 'success',
      title: `${topChannel.channel} is your top lead source`,
      description: `${topChannel.channel} generated ${topChannel.leads.toLocaleString()} leads${topChannel.cpl ? ` at $${topChannel.cpl.toFixed(2)} CPL` : ''}`,
      metric: 'leads',
      value: topChannel.leads,
      actionable: false,
    });
  }

  // 3. High CPL channel warning
  const highCplChannel = channelPerformance
    .filter(c => c.cpl !== null && c.leads >= 10)
    .sort((a, b) => (b.cpl || 0) - (a.cpl || 0))[0];
  if (highCplChannel && highCplChannel.cpl && highCplChannel.cpl > 100) {
    insights.push({
      id: 'high-cpl-channel',
      type: 'anomaly',
      severity: 'warning',
      title: `High CPL on ${highCplChannel.channel}`,
      description: `${highCplChannel.channel} has a CPL of $${highCplChannel.cpl.toFixed(2)}, which may be above target`,
      metric: 'cpl',
      value: highCplChannel.cpl,
      actionable: true,
    });
  }

  // 4. Active seasonal flights
  const activeFlights = seasonalFlights.filter(f => f.status === 'active');
  if (activeFlights.length > 0) {
    insights.push({
      id: 'active-flights',
      type: 'trend',
      severity: 'info',
      title: `${activeFlights.length} seasonal flight${activeFlights.length > 1 ? 's' : ''} active`,
      description: `Currently running: ${activeFlights.map(f => f.flightName).join(', ')}`,
      actionable: false,
    });
  }

  // 5. Upcoming flights reminder
  const upcomingFlights = seasonalFlights.filter(f => f.status === 'upcoming');
  if (upcomingFlights.length > 0) {
    const nextFlight = upcomingFlights[0];
    const daysUntil = nextFlight.startDate
      ? Math.ceil((new Date(nextFlight.startDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;

    if (daysUntil !== null && daysUntil <= 14) {
      insights.push({
        id: 'upcoming-flight',
        type: 'recommendation',
        severity: daysUntil <= 7 ? 'warning' : 'info',
        title: `${nextFlight.flightName} starts in ${daysUntil} days`,
        description: nextFlight.plannedBudget
          ? `Budget: $${nextFlight.plannedBudget.toLocaleString()} - Ensure campaigns are ready`
          : 'Review campaign setup before launch',
        actionable: true,
      });
    }
  }

  // 6. Overall performance summary
  if (kpiSummary?.totalLeads && kpiSummary.totalLeads > 0) {
    insights.push({
      id: 'performance-summary',
      type: 'trend',
      severity: 'info',
      title: 'Last 30 days performance',
      description: `Generated ${kpiSummary.totalLeads?.toLocaleString() || 0} leads from ${kpiSummary.activeStores || 0} active stores`,
      metric: 'leads',
      value: kpiSummary.totalLeads,
      actionable: false,
    });
  }

  return insights;
}

// ============================================================================
// Performance Snapshot for Media Lab
// ============================================================================

export interface PerformanceSnapshot {
  totalLeads: number;
  totalSpend: number | null;
  cpl: number | null;
  topChannel: string | null;
  storeCount: number;
  lowPerformingStores: number;
  hasData: boolean;
}

/**
 * Get a compact performance snapshot for the Media Lab page
 */
export async function getPerformanceSnapshot(
  companyId: string
): Promise<PerformanceSnapshot> {
  const [kpiSummary, storeScorecardsV2] = await Promise.all([
    getMediaKpiSummary(companyId).catch(() => null),
    getStoreScorecards(companyId).catch(() => []),
  ]);

  const totalLeads = (kpiSummary?.totalCalls || 0) + (kpiSummary?.totalLsaLeads || 0);
  const totalSpend = kpiSummary?.totalSpend || null;
  const cpl = totalSpend && totalLeads > 0 ? totalSpend / totalLeads : null;

  // Find top channel
  const topChannel = kpiSummary?.channelBreakdown
    ?.sort((a: any, b: any) => ((a.calls || 0) + (a.lsaLeads || 0)) - ((b.calls || 0) + (b.lsaLeads || 0)))
    .reverse()[0]?.channel || null;

  const lowPerformingStores = storeScorecardsV2.filter((s: any) => s.overallScore < 50).length;

  return {
    totalLeads,
    totalSpend,
    cpl,
    topChannel,
    storeCount: storeScorecardsV2.length,
    lowPerformingStores,
    hasData: totalLeads > 0 || storeScorecardsV2.length > 0,
  };
}
