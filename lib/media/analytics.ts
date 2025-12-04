// lib/media/analytics.ts
// Media analytics aggregation helpers
//
// This module provides functions to compute scorecards and aggregated metrics
// from the raw MediaPerformance data for stores, markets, and programs.
//
// SCORECARD COMPUTATION:
// - Visibility Score: Based on impressions (Maps + Search) relative to benchmarks
// - Demand Score: Based on clicks, calls, direction requests
// - Conversion Score: Based on leads, installs, bookings relative to engagement
//
// SCORING METHODOLOGY (0-100 scale):
// - 80-100: Excellent (emerald)
// - 60-79: Good (amber)
// - 0-59: Needs Improvement (red)
//
// Scores are computed by comparing store/market performance to company averages
// or predefined benchmarks.

import type {
  MediaDateRange,
  MediaStoreScorecardV2,
  MediaMarketScorecard,
  MediaProgramOverview,
  MediaChannelPerformance,
  MediaChannel,
  MediaCategory,
} from '@/lib/types/media';
import { getDateRangeFromPreset, calculateOverallScore, parseCategoryMix } from '@/lib/types/media';
import {
  getMediaPerformanceByCompany,
  getPerformanceByStore,
  getPerformanceByChannel,
} from '@/lib/airtable/mediaPerformance';
import { getMediaStoresByCompany } from '@/lib/airtable/mediaStores';
import { getMediaMarketsByCompany } from '@/lib/airtable/mediaMarkets';
import { getMediaProgramsByCompany } from '@/lib/airtable/mediaPrograms';
import { getMediaCampaignsByCompany } from '@/lib/airtable/mediaCampaigns';

// ============================================================================
// Types
// ============================================================================

/**
 * Raw aggregated metrics for score computation
 */
interface AggregatedMetrics {
  impressions: number;
  mapsImpressions: number;
  searchImpressions: number;
  clicks: number;
  calls: number;
  directionRequests: number;
  websiteClicks: number;
  lsaLeads: number;
  installs: number;
  bookings: number;
  spend: number;
  reviews: number;
  reviewRating?: number;
}

// ============================================================================
// Store Scorecards
// ============================================================================

/**
 * Get store scorecards for a company with computed scores
 *
 * @param companyId - Company record ID
 * @param range - Date range for metrics (default: last 30 days)
 * @returns Array of store scorecards with computed metrics
 */
export async function getStoreScorecards(
  companyId: string,
  range?: MediaDateRange
): Promise<MediaStoreScorecardV2[]> {
  const dateRange = range || getDateRangeFromPreset('last30');

  // Fetch stores and performance data in parallel
  const [stores, performanceByStore] = await Promise.all([
    getMediaStoresByCompany(companyId),
    getPerformanceByStore(companyId, dateRange),
  ]);

  if (stores.length === 0) {
    return [];
  }

  // Compute metrics for each store
  const storeMetrics: Record<string, AggregatedMetrics> = {};

  for (const store of stores) {
    const storePoints = performanceByStore[store.id] || [];
    storeMetrics[store.id] = aggregateMetrics(storePoints);
  }

  // Compute company-wide averages for benchmarking
  const companyAverages = computeAverages(Object.values(storeMetrics));

  // Build scorecards
  const scorecards: MediaStoreScorecardV2[] = stores.map((store) => {
    const metrics = storeMetrics[store.id] || createEmptyMetrics();
    const scores = computeScores(metrics, companyAverages);

    return {
      storeId: store.id,
      storeName: store.name,
      storeCode: store.storeCode,
      marketId: store.marketId,
      marketName: store.marketName,
      // Scores
      visibilityScore: scores.visibility,
      demandScore: scores.demand,
      conversionScore: scores.conversion,
      overallScore: calculateOverallScore(scores.visibility, scores.demand, scores.conversion),
      // Raw metrics
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      calls: metrics.calls,
      directionRequests: metrics.directionRequests,
      websiteClicks: metrics.websiteClicks,
      lsaLeads: metrics.lsaLeads,
      installs: metrics.installs,
      spend: metrics.spend,
      reviews: metrics.reviews,
      reviewRating: metrics.reviewRating,
      // Derived
      ctr: metrics.impressions > 0 ? metrics.clicks / metrics.impressions : undefined,
      cpl: computeCostPerLead(metrics),
      // Category
      categoryMix: parseCategoryMix(store.categoryMix),
    };
  });

  // Sort by overall score descending
  scorecards.sort((a, b) => b.overallScore - a.overallScore);

  return scorecards;
}

// ============================================================================
// Market Scorecards
// ============================================================================

/**
 * Get market scorecards for a company with aggregated store metrics
 *
 * @param companyId - Company record ID
 * @param range - Date range for metrics
 * @returns Array of market scorecards
 */
export async function getMarketScorecards(
  companyId: string,
  range?: MediaDateRange
): Promise<MediaMarketScorecard[]> {
  const dateRange = range || getDateRangeFromPreset('last30');

  // Get markets, stores, and store scorecards
  const [markets, storeScorecards] = await Promise.all([
    getMediaMarketsByCompany(companyId),
    getStoreScorecards(companyId, dateRange),
  ]);

  if (markets.length === 0) {
    return [];
  }

  // Group store scorecards by market
  const storesByMarket: Record<string, MediaStoreScorecardV2[]> = {};
  for (const scorecard of storeScorecards) {
    const marketId = scorecard.marketId || '_unassigned_';
    if (!storesByMarket[marketId]) {
      storesByMarket[marketId] = [];
    }
    storesByMarket[marketId].push(scorecard);
  }

  // Build market scorecards
  const marketScorecards: MediaMarketScorecard[] = markets.map((market) => {
    const marketStores = storesByMarket[market.id] || [];

    // Aggregate metrics across stores
    const aggregated = aggregateStoreScorecards(marketStores);

    // Average scores across stores
    const avgScores = averageStoreScorecards(marketStores);

    return {
      marketId: market.id,
      marketName: market.name,
      region: market.region,
      storeCount: marketStores.length,
      // Averaged scores
      visibilityScore: avgScores.visibility,
      demandScore: avgScores.demand,
      conversionScore: avgScores.conversion,
      overallScore: calculateOverallScore(avgScores.visibility, avgScores.demand, avgScores.conversion),
      // Aggregated metrics
      impressions: aggregated.impressions,
      clicks: aggregated.clicks,
      calls: aggregated.calls,
      directionRequests: aggregated.directionRequests,
      lsaLeads: aggregated.lsaLeads,
      installs: aggregated.installs,
      spend: aggregated.spend,
      // Derived
      ctr: aggregated.impressions > 0 ? aggregated.clicks / aggregated.impressions : undefined,
      cpl: computeCostPerLead(aggregated as AggregatedMetrics),
    };
  });

  // Sort by overall score descending
  marketScorecards.sort((a, b) => b.overallScore - a.overallScore);

  return marketScorecards;
}

// ============================================================================
// Program Overviews
// ============================================================================

/**
 * Get program performance overviews for a company
 *
 * @param companyId - Company record ID
 * @param range - Date range for metrics
 * @returns Array of program overviews with performance data
 */
export async function getProgramOverviews(
  companyId: string,
  range?: MediaDateRange
): Promise<MediaProgramOverview[]> {
  const dateRange = range || getDateRangeFromPreset('last30');

  // Fetch programs, campaigns, and performance data
  const [programs, campaigns, performance] = await Promise.all([
    getMediaProgramsByCompany(companyId),
    getMediaCampaignsByCompany(companyId),
    getMediaPerformanceByCompany(companyId, { range: dateRange }),
  ]);

  if (programs.length === 0) {
    return [];
  }

  // Group campaigns by program
  const campaignsByProgram: Record<string, typeof campaigns> = {};
  for (const campaign of campaigns) {
    const programId = campaign.programId || '_unassigned_';
    if (!campaignsByProgram[programId]) {
      campaignsByProgram[programId] = [];
    }
    campaignsByProgram[programId].push(campaign);
  }

  // Group performance by program (via campaign linkage or directly)
  const metricsByProgram: Record<string, AggregatedMetrics> = {};
  for (const program of programs) {
    const programCampaignIds = new Set(
      (campaignsByProgram[program.id] || []).map((c) => c.id)
    );

    // Filter performance points for this program
    const programPoints = performance.filter(
      (p) =>
        p.programId === program.id ||
        (p.campaignId && programCampaignIds.has(p.campaignId))
    );

    metricsByProgram[program.id] = aggregateMetrics(programPoints);
  }

  // Build program overviews
  const overviews: MediaProgramOverview[] = programs.map((program) => {
    const programCampaigns = campaignsByProgram[program.id] || [];
    const metrics = metricsByProgram[program.id] || createEmptyMetrics();

    // Count unique markets and stores from campaigns
    const marketIds = new Set(programCampaigns.map((c) => c.marketId).filter(Boolean));
    const storeIds = new Set(programCampaigns.flatMap((c) => c.storeIds || []));

    return {
      programId: program.id,
      programName: program.name,
      status: program.status,
      objective: program.objective,
      channels: program.primaryChannels,
      // Counts
      campaignCount: programCampaigns.length,
      marketCount: marketIds.size || program.marketIds.length,
      storeCount: storeIds.size,
      // Budget
      monthlyBudget: program.monthlyBudget || 0,
      // Performance
      spend: metrics.spend,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      ctr: metrics.impressions > 0 ? metrics.clicks / metrics.impressions : undefined,
      calls: metrics.calls,
      lsaLeads: metrics.lsaLeads,
      installs: metrics.installs,
      // Cost metrics
      cpc: metrics.clicks > 0 ? metrics.spend / metrics.clicks : undefined,
      cpl: computeCostPerLead(metrics),
      cpBooking: metrics.installs > 0 ? metrics.spend / metrics.installs : undefined,
    };
  });

  // Sort by spend descending (active programs first)
  overviews.sort((a, b) => b.spend - a.spend);

  return overviews;
}

// ============================================================================
// Channel Performance
// ============================================================================

/**
 * Get performance breakdown by channel for a company
 *
 * @param companyId - Company record ID
 * @param range - Date range for metrics
 * @returns Array of channel performance breakdowns
 */
export async function getChannelPerformanceBreakdown(
  companyId: string,
  range?: MediaDateRange
): Promise<MediaChannelPerformance[]> {
  const dateRange = range || getDateRangeFromPreset('last30');

  const performance = await getMediaPerformanceByCompany(companyId, {
    range: dateRange,
  });

  // Group by channel (dynamically populate as data comes in)
  const byChannel: Partial<Record<MediaChannel, AggregatedMetrics>> = {};

  for (const point of performance) {
    const channel = point.channel || 'Other';
    if (!byChannel[channel]) {
      byChannel[channel] = createEmptyMetrics();
    }

    accumulateMetric(byChannel[channel]!, point.metricName, point.metricValue);
  }

  // Build channel performance array
  const channels: MediaChannelPerformance[] = Object.entries(byChannel)
    .filter(([, metrics]) => metrics.spend > 0 || metrics.impressions > 0)
    .map(([channel, metrics]) => ({
      channel: channel as MediaChannel,
      spend: metrics.spend,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      calls: metrics.calls,
      lsaLeads: metrics.lsaLeads,
      installs: metrics.installs,
      ctr: metrics.impressions > 0 ? metrics.clicks / metrics.impressions : undefined,
      cpc: metrics.clicks > 0 ? metrics.spend / metrics.clicks : undefined,
      cpl: computeCostPerLead(metrics),
    }));

  // Sort by spend descending
  channels.sort((a, b) => b.spend - a.spend);

  return channels;
}

// ============================================================================
// Top Performers
// ============================================================================

/**
 * Get top performing stores by a specific metric
 *
 * @param companyId - Company record ID
 * @param metric - Metric to rank by ('calls' | 'leads' | 'installs' | 'visibility' | 'demand')
 * @param limit - Number of stores to return (default: 10)
 * @param range - Date range for metrics
 */
export async function getTopStores(
  companyId: string,
  metric: 'calls' | 'leads' | 'installs' | 'visibility' | 'demand' | 'conversion',
  limit = 10,
  range?: MediaDateRange
): Promise<MediaStoreScorecardV2[]> {
  const scorecards = await getStoreScorecards(companyId, range);

  // Sort by the specified metric
  const sorted = [...scorecards].sort((a, b) => {
    switch (metric) {
      case 'calls':
        return b.calls - a.calls;
      case 'leads':
        return b.lsaLeads - a.lsaLeads;
      case 'installs':
        return b.installs - a.installs;
      case 'visibility':
        return b.visibilityScore - a.visibilityScore;
      case 'demand':
        return b.demandScore - a.demandScore;
      case 'conversion':
        return b.conversionScore - a.conversionScore;
      default:
        return b.overallScore - a.overallScore;
    }
  });

  return sorted.slice(0, limit);
}

/**
 * Get top performing markets by a specific metric
 */
export async function getTopMarkets(
  companyId: string,
  metric: 'calls' | 'leads' | 'installs' | 'visibility' | 'demand',
  limit = 5,
  range?: MediaDateRange
): Promise<MediaMarketScorecard[]> {
  const scorecards = await getMarketScorecards(companyId, range);

  const sorted = [...scorecards].sort((a, b) => {
    switch (metric) {
      case 'calls':
        return b.calls - a.calls;
      case 'leads':
        return b.lsaLeads - a.lsaLeads;
      case 'installs':
        return b.installs - a.installs;
      case 'visibility':
        return b.visibilityScore - a.visibilityScore;
      case 'demand':
        return b.demandScore - a.demandScore;
      default:
        return b.overallScore - a.overallScore;
    }
  });

  return sorted.slice(0, limit);
}

// ============================================================================
// Summary Stats
// ============================================================================

/**
 * Get high-level KPI summary for a company
 */
export async function getMediaKpiSummary(
  companyId: string,
  range?: MediaDateRange
): Promise<{
  totalSpend: number;
  totalCalls: number;
  totalLsaLeads: number;
  totalInstalls: number;
  totalImpressions: number;
  totalClicks: number;
  avgCpl: number | undefined;
  avgCpc: number | undefined;
  activeStores: number;
  channelBreakdown: MediaChannelPerformance[];
}> {
  const dateRange = range || getDateRangeFromPreset('last30');

  const [performance, channelBreakdown, stores] = await Promise.all([
    getMediaPerformanceByCompany(companyId, { range: dateRange }),
    getChannelPerformanceBreakdown(companyId, dateRange),
    getMediaStoresByCompany(companyId),
  ]);

  const metrics = aggregateMetrics(performance);
  const leads = metrics.lsaLeads + metrics.calls;

  return {
    totalSpend: metrics.spend,
    totalCalls: metrics.calls,
    totalLsaLeads: metrics.lsaLeads,
    totalInstalls: metrics.installs,
    totalImpressions: metrics.impressions,
    totalClicks: metrics.clicks,
    avgCpl: leads > 0 ? metrics.spend / leads : undefined,
    avgCpc: metrics.clicks > 0 ? metrics.spend / metrics.clicks : undefined,
    activeStores: stores.length,
    channelBreakdown,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function createEmptyMetrics(): AggregatedMetrics {
  return {
    impressions: 0,
    mapsImpressions: 0,
    searchImpressions: 0,
    clicks: 0,
    calls: 0,
    directionRequests: 0,
    websiteClicks: 0,
    lsaLeads: 0,
    installs: 0,
    bookings: 0,
    spend: 0,
    reviews: 0,
    reviewRating: undefined,
  };
}

function aggregateMetrics(
  points: Array<{ metricName: string; metricValue: number }>
): AggregatedMetrics {
  const metrics = createEmptyMetrics();

  for (const point of points) {
    accumulateMetric(metrics, point.metricName, point.metricValue);
  }

  return metrics;
}

function accumulateMetric(
  metrics: AggregatedMetrics,
  metricName: string,
  value: number
): void {
  switch (metricName) {
    case 'Impressions':
      metrics.impressions += value;
      break;
    case 'Maps Impressions':
      metrics.mapsImpressions += value;
      metrics.impressions += value;
      break;
    case 'Search Impressions':
      metrics.searchImpressions += value;
      metrics.impressions += value;
      break;
    case 'Clicks':
      metrics.clicks += value;
      break;
    case 'Calls':
    case 'Qualified Calls':
      metrics.calls += value;
      break;
    case 'Direction Requests':
      metrics.directionRequests += value;
      break;
    case 'Website Clicks':
      metrics.websiteClicks += value;
      break;
    case 'LSAs Leads':
      metrics.lsaLeads += value;
      break;
    case 'Installs':
      metrics.installs += value;
      break;
    case 'Bookings':
      metrics.bookings += value;
      break;
    case 'Spend':
      metrics.spend += value;
      break;
    case 'Reviews':
      metrics.reviews += value;
      break;
    case 'Review Rating':
      // Store the latest rating (or could average)
      metrics.reviewRating = value;
      break;
  }
}

function computeAverages(metricsArray: AggregatedMetrics[]): AggregatedMetrics {
  if (metricsArray.length === 0) return createEmptyMetrics();

  const sum = createEmptyMetrics();
  for (const m of metricsArray) {
    sum.impressions += m.impressions;
    sum.clicks += m.clicks;
    sum.calls += m.calls;
    sum.directionRequests += m.directionRequests;
    sum.websiteClicks += m.websiteClicks;
    sum.lsaLeads += m.lsaLeads;
    sum.installs += m.installs;
    sum.spend += m.spend;
  }

  const n = metricsArray.length;
  return {
    impressions: sum.impressions / n,
    mapsImpressions: sum.mapsImpressions / n,
    searchImpressions: sum.searchImpressions / n,
    clicks: sum.clicks / n,
    calls: sum.calls / n,
    directionRequests: sum.directionRequests / n,
    websiteClicks: sum.websiteClicks / n,
    lsaLeads: sum.lsaLeads / n,
    installs: sum.installs / n,
    bookings: sum.bookings / n,
    spend: sum.spend / n,
    reviews: sum.reviews / n,
    reviewRating: undefined,
  };
}

/**
 * Compute visibility, demand, and conversion scores
 *
 * VISIBILITY SCORE (0-100):
 * Based on impressions relative to company average
 * 100 = 2x the average, 50 = at average, 0 = no impressions
 *
 * DEMAND SCORE (0-100):
 * Based on engagement actions (clicks, calls, directions)
 * Weighted: clicks (0.4), calls (0.4), direction requests (0.2)
 *
 * CONVERSION SCORE (0-100):
 * Based on leads/installs relative to engagement
 * Conversion = (leads + installs) / (clicks + calls + directions)
 */
function computeScores(
  metrics: AggregatedMetrics,
  averages: AggregatedMetrics
): { visibility: number; demand: number; conversion: number } {
  // Visibility: compare impressions to average
  let visibility = 50;
  if (averages.impressions > 0) {
    const ratio = metrics.impressions / averages.impressions;
    visibility = Math.min(100, Math.round(ratio * 50));
  } else if (metrics.impressions > 0) {
    visibility = 80; // Above average if we have data but no comparison
  }

  // Demand: weighted engagement score
  let demand = 0;
  if (averages.clicks > 0 || averages.calls > 0 || averages.directionRequests > 0) {
    const clickScore = averages.clicks > 0 ? (metrics.clicks / averages.clicks) * 50 : 50;
    const callScore = averages.calls > 0 ? (metrics.calls / averages.calls) * 50 : 50;
    const dirScore = averages.directionRequests > 0 ? (metrics.directionRequests / averages.directionRequests) * 50 : 50;

    demand = Math.min(100, Math.round(clickScore * 0.4 + callScore * 0.4 + dirScore * 0.2));
  } else if (metrics.clicks > 0 || metrics.calls > 0) {
    demand = 75;
  }

  // Conversion: leads+installs relative to engagement
  const engagement = metrics.clicks + metrics.calls + metrics.directionRequests;
  const conversions = metrics.lsaLeads + metrics.installs;
  let conversion = 0;

  if (engagement > 0 && conversions > 0) {
    const convRate = conversions / engagement;
    // Assume 10% conversion is excellent (100), 5% is good (75), 2% is average (50)
    if (convRate >= 0.10) conversion = 100;
    else if (convRate >= 0.05) conversion = 75 + (convRate - 0.05) / 0.05 * 25;
    else if (convRate >= 0.02) conversion = 50 + (convRate - 0.02) / 0.03 * 25;
    else conversion = Math.round(convRate / 0.02 * 50);
  } else if (conversions > 0) {
    conversion = 70;
  }

  return {
    visibility: Math.max(0, Math.min(100, visibility)),
    demand: Math.max(0, Math.min(100, demand)),
    conversion: Math.max(0, Math.min(100, conversion)),
  };
}

function computeCostPerLead(metrics: AggregatedMetrics): number | undefined {
  const leads = metrics.lsaLeads + metrics.calls;
  if (leads === 0 || metrics.spend === 0) return undefined;
  return metrics.spend / leads;
}

function aggregateStoreScorecards(scorecards: MediaStoreScorecardV2[]): {
  impressions: number;
  clicks: number;
  calls: number;
  directionRequests: number;
  lsaLeads: number;
  installs: number;
  spend: number;
} {
  return scorecards.reduce(
    (acc, s) => ({
      impressions: acc.impressions + s.impressions,
      clicks: acc.clicks + s.clicks,
      calls: acc.calls + s.calls,
      directionRequests: acc.directionRequests + s.directionRequests,
      lsaLeads: acc.lsaLeads + s.lsaLeads,
      installs: acc.installs + s.installs,
      spend: acc.spend + s.spend,
    }),
    { impressions: 0, clicks: 0, calls: 0, directionRequests: 0, lsaLeads: 0, installs: 0, spend: 0 }
  );
}

function averageStoreScorecards(scorecards: MediaStoreScorecardV2[]): {
  visibility: number;
  demand: number;
  conversion: number;
} {
  if (scorecards.length === 0) {
    return { visibility: 0, demand: 0, conversion: 0 };
  }

  const sum = scorecards.reduce(
    (acc, s) => ({
      visibility: acc.visibility + s.visibilityScore,
      demand: acc.demand + s.demandScore,
      conversion: acc.conversion + s.conversionScore,
    }),
    { visibility: 0, demand: 0, conversion: 0 }
  );

  return {
    visibility: Math.round(sum.visibility / scorecards.length),
    demand: Math.round(sum.demand / scorecards.length),
    conversion: Math.round(sum.conversion / scorecards.length),
  };
}
