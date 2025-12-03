// lib/mediaLab/storeAnalytics.ts
// Store-level analytics for Media Lab store drilldowns

import { getStoreScorecards } from '@/lib/media/analytics';
import { getMediaStoresByCompany, getMediaStoreById } from '@/lib/airtable/mediaStores';
import type { MediaStoreScorecardV2, MediaStore } from '@/lib/types/media';

// ============================================================================
// Types
// ============================================================================

export interface StoreOverview {
  storeId: string;
  storeName: string;
  storeCode?: string;
  marketName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  status?: string;
}

export interface StorePerformanceMetrics {
  visibilityScore: number;
  calls: number;
  directionRequests: number;
  websiteClicks: number;
  leads: number;
  lsaLeads: number;
  spend: number | null;
  cpl: number | null;
  impressions: number;
  clicks: number;
  overallScore: number;
  conversionRate: number;
}

export interface StoreCategoryMix {
  category: string;
  leads: number;
  spend: number | null;
  cpl: number | null;
  percentOfTotal: number;
}

export interface StoreCompetitor {
  name: string;
  rating: number;
  reviewCount: number;
  position: number;
  visibilityTrend: 'up' | 'down' | 'stable';
}

export interface StoreInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'opportunity' | 'warning';
  severity: 'info' | 'warning' | 'success' | 'critical';
  title: string;
  description: string;
  metric?: string;
  value?: number;
  actionable: boolean;
}

export interface StoreAnalyticsDetail {
  overview: StoreOverview;
  metrics: StorePerformanceMetrics;
  categoryMix: StoreCategoryMix[];
  competitors: StoreCompetitor[];
  insights: StoreInsight[];
  trends: {
    date: string;
    leads: number;
    calls: number;
    visibilityScore: number;
  }[];
  hasData: boolean;
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
 * Get detailed store analytics for a specific store
 */
export async function getStoreAnalyticsDetail(
  companyId: string,
  storeId: string,
  dateRangeDays: number = 30
): Promise<StoreAnalyticsDetail | null> {
  // Fetch store data and scorecards in parallel
  const [store, scorecards] = await Promise.all([
    getMediaStoreById(storeId).catch(() => null),
    getStoreScorecards(companyId).catch(() => []),
  ]);

  if (!store) {
    return null;
  }

  // Find the scorecard for this store
  const scorecard = scorecards.find((sc: MediaStoreScorecardV2) => sc.storeId === storeId);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - dateRangeDays * 24 * 60 * 60 * 1000);
  const dateRange = {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
    label: `Last ${dateRangeDays} days`,
  };

  // Build overview
  const overview: StoreOverview = {
    storeId: store.id,
    storeName: store.name,
    storeCode: store.storeCode,
    marketName: store.marketName,
    address: store.address,
    city: store.city,
    state: store.state,
    zipCode: store.zip,
    phone: store.callTrackingNumber,
    status: undefined, // Not available in MediaStore type
  };

  // Build metrics from scorecard
  const totalLeads = scorecard ? scorecard.calls + scorecard.lsaLeads : 0;
  const metrics: StorePerformanceMetrics = {
    visibilityScore: scorecard?.visibilityScore || 0,
    calls: scorecard?.calls || 0,
    directionRequests: scorecard?.directionRequests || 0,
    websiteClicks: scorecard?.websiteClicks || 0,
    leads: totalLeads,
    lsaLeads: scorecard?.lsaLeads || 0,
    spend: scorecard?.spend || null,
    cpl: scorecard?.spend && totalLeads > 0 ? scorecard.spend / totalLeads : null,
    impressions: scorecard?.impressions || 0,
    clicks: scorecard?.clicks || 0,
    overallScore: scorecard?.overallScore || 0,
    conversionRate: scorecard?.impressions
      ? (totalLeads / scorecard.impressions) * 100
      : 0,
  };

  // Placeholder category mix (would come from LSA or campaign data)
  const categoryMix: StoreCategoryMix[] = generatePlaceholderCategoryMix(metrics.leads);

  // Placeholder competitors (would come from GBP API)
  const competitors: StoreCompetitor[] = generatePlaceholderCompetitors();

  // Generate insights
  const insights = generateStoreInsights(metrics, store, scorecard);

  // Placeholder trends (would come from historical data)
  const trends = generatePlaceholderTrends(dateRangeDays);

  return {
    overview,
    metrics,
    categoryMix,
    competitors,
    insights,
    trends,
    hasData: !!scorecard,
    dateRange,
  };
}

/**
 * Get all stores for a company with basic metrics
 */
export async function getCompanyStoresWithMetrics(
  companyId: string
): Promise<{
  stores: (StoreOverview & { overallScore: number; leads: number })[];
  total: number;
}> {
  const [stores, scorecards] = await Promise.all([
    getMediaStoresByCompany(companyId).catch(() => []),
    getStoreScorecards(companyId).catch(() => []),
  ]);

  const scorecardMap = new Map(
    scorecards.map((sc: MediaStoreScorecardV2) => [sc.storeId, sc])
  );

  const storesWithMetrics = stores.map((store: MediaStore) => {
    const scorecard = scorecardMap.get(store.id);
    return {
      storeId: store.id,
      storeName: store.name,
      storeCode: store.storeCode,
      marketName: store.marketName,
      address: store.address,
      city: store.city,
      state: store.state,
      overallScore: scorecard?.overallScore || 0,
      leads: scorecard ? scorecard.calls + scorecard.lsaLeads : 0,
    };
  });

  return {
    stores: storesWithMetrics.sort((a, b) => b.overallScore - a.overallScore),
    total: stores.length,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function generatePlaceholderCategoryMix(totalLeads: number): StoreCategoryMix[] {
  if (totalLeads === 0) return [];

  // Common 12 Volt categories
  const categories = [
    { category: 'Remote Start', share: 0.35 },
    { category: 'CarPlay/Android Auto', share: 0.25 },
    { category: 'Audio', share: 0.20 },
    { category: 'Dash Cams', share: 0.12 },
    { category: 'Other', share: 0.08 },
  ];

  return categories.map((cat) => ({
    category: cat.category,
    leads: Math.round(totalLeads * cat.share),
    spend: null,
    cpl: null,
    percentOfTotal: cat.share * 100,
  }));
}

function generatePlaceholderCompetitors(): StoreCompetitor[] {
  // Placeholder - would come from GBP competitive data
  return [
    {
      name: 'Competitor A',
      rating: 4.5,
      reviewCount: 127,
      position: 1,
      visibilityTrend: 'stable',
    },
    {
      name: 'Competitor B',
      rating: 4.3,
      reviewCount: 89,
      position: 2,
      visibilityTrend: 'up',
    },
    {
      name: 'Competitor C',
      rating: 4.1,
      reviewCount: 64,
      position: 3,
      visibilityTrend: 'down',
    },
  ];
}

function generateStoreInsights(
  metrics: StorePerformanceMetrics,
  store: MediaStore,
  scorecard: MediaStoreScorecardV2 | undefined
): StoreInsight[] {
  const insights: StoreInsight[] = [];

  // Low visibility score
  if (metrics.visibilityScore < 50) {
    insights.push({
      id: 'low-visibility',
      type: 'warning',
      severity: metrics.visibilityScore < 30 ? 'critical' : 'warning',
      title: 'Low Visibility Score',
      description: `This store has a visibility score of ${metrics.visibilityScore}, which may be impacting lead generation. Check GBP listing for completeness, hours, and reviews.`,
      metric: 'visibilityScore',
      value: metrics.visibilityScore,
      actionable: true,
    });
  }

  // High CPL warning
  if (metrics.cpl && metrics.cpl > 100) {
    insights.push({
      id: 'high-cpl',
      type: 'anomaly',
      severity: metrics.cpl > 150 ? 'critical' : 'warning',
      title: 'High Cost Per Lead',
      description: `CPL of $${metrics.cpl.toFixed(2)} is above target. Consider reviewing campaign targeting or budget allocation.`,
      metric: 'cpl',
      value: metrics.cpl,
      actionable: true,
    });
  }

  // Good performance
  if (metrics.overallScore >= 80) {
    insights.push({
      id: 'strong-performer',
      type: 'opportunity',
      severity: 'success',
      title: 'Strong Performer',
      description: `This store is performing well with an overall score of ${metrics.overallScore}. Consider increasing budget allocation.`,
      metric: 'overallScore',
      value: metrics.overallScore,
      actionable: false,
    });
  }

  // Low call volume
  if (metrics.calls < 10 && metrics.leads > 0) {
    insights.push({
      id: 'low-calls',
      type: 'trend',
      severity: 'info',
      title: 'Low Call Volume',
      description: `Only ${metrics.calls} calls this period. LSA leads are driving most conversions.`,
      metric: 'calls',
      value: metrics.calls,
      actionable: false,
    });
  }

  // High direction requests but low conversions
  if (metrics.directionRequests > 50 && metrics.leads < 10) {
    insights.push({
      id: 'direction-conversion-gap',
      type: 'anomaly',
      severity: 'warning',
      title: 'Direction Request Gap',
      description: `${metrics.directionRequests} direction requests but only ${metrics.leads} leads. Potential in-store experience issue.`,
      actionable: true,
    });
  }

  return insights;
}

function generatePlaceholderTrends(
  days: number
): { date: string; leads: number; calls: number; visibilityScore: number }[] {
  // Generate placeholder trend data
  const trends = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    trends.push({
      date: date.toISOString().split('T')[0],
      leads: Math.floor(Math.random() * 5) + 1,
      calls: Math.floor(Math.random() * 3),
      visibilityScore: Math.floor(Math.random() * 20) + 60,
    });
  }

  return trends;
}
