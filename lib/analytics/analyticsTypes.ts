// lib/analytics/analyticsTypes.ts
// Extended analytics types for the Analytics Lab
//
// These types extend CompanyAnalyticsSnapshot with more granular source data
// and 90-day trend series for the Analytics Lab visualization.

// ============================================================================
// Source-Specific Data Types
// ============================================================================

/**
 * GA4 source data
 */
export interface AnalyticsSourceGa4 {
  totalSessions: number;
  newUsers: number;
  returningUsers: number;
  conversions: number;
  conversionRate: number;
  bounceRate?: number;
  avgSessionDuration?: number;
  channelBreakdown: Record<string, number>;
}

/**
 * Search Console source data
 */
export interface AnalyticsSourceSearchConsole {
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages?: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

/**
 * Google Business Profile source data
 */
export interface AnalyticsSourceGbp {
  views: number;
  calls: number;
  directionRequests: number;
  websiteClicks: number;
  photoViews: number;
  messagesSent?: number;
  bookings?: number;
}

/**
 * Paid Media source data
 */
export interface AnalyticsSourcePaidMedia {
  spend: number;
  conversions: number;
  cpa: number;
  roas: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  channelContribution: Record<string, number>;
}

/**
 * Period-over-period deltas
 */
export interface AnalyticsDeltas {
  sessionsMoM: number | null;
  conversionsMoM: number | null;
  organicClicksMoM: number | null;
  gbpActionsMoM: number | null;
  spendMoM?: number | null;
  cpaMoM?: number | null;
  roasMoM?: number | null;
}

// ============================================================================
// Extended Analytics Snapshot
// ============================================================================

/**
 * Extended analytics snapshot for the Analytics Lab
 *
 * This extends the base CompanyAnalyticsSnapshot with more granular
 * source-specific data and computed deltas.
 */
export interface AnalyticsLabSnapshot {
  companyId: string;
  date: string; // ISO date
  range: '7d' | '28d' | '90d';

  // Connection status
  hasGa4: boolean;
  hasGsc: boolean;
  hasGbp: boolean;
  hasMedia: boolean;

  // Source-specific data (undefined if source not connected)
  sourceGa4?: AnalyticsSourceGa4;
  sourceSearchConsole?: AnalyticsSourceSearchConsole;
  sourceGbp?: AnalyticsSourceGbp;
  sourcePaidMedia?: AnalyticsSourcePaidMedia;

  // Period-over-period deltas
  delta: AnalyticsDeltas;

  // Computed metrics
  totalActions?: number; // Sum of all conversion-like actions
  primaryChannelSource?: string; // Dominant traffic channel

  // Meta
  updatedAt: string;
  dataQualityScore?: number; // 0-100, how complete the data is
}

// ============================================================================
// Time Series Types
// ============================================================================

/**
 * Single data point in a time series
 */
export interface AnalyticsTimeSeriesPoint {
  date: string; // ISO date
  value: number | null;
}

/**
 * 90-day trend data for charting
 */
export interface AnalyticsTrendSeries {
  sessions: AnalyticsTimeSeriesPoint[];
  conversions: AnalyticsTimeSeriesPoint[];
  organicClicks: AnalyticsTimeSeriesPoint[];
  organicImpressions: AnalyticsTimeSeriesPoint[];
  gbpActions: AnalyticsTimeSeriesPoint[];
  mediaSpend: AnalyticsTimeSeriesPoint[];
  cpa: AnalyticsTimeSeriesPoint[];
  roas: AnalyticsTimeSeriesPoint[];
}

// ============================================================================
// Analytics Lab Response Types
// ============================================================================

/**
 * Response from the Analytics Lab get endpoint
 */
export interface AnalyticsLabResponse {
  snapshot: AnalyticsLabSnapshot;
  trends: AnalyticsTrendSeries;
  narrative?: AnalyticsNarrative;
  findings: AnalyticsLabFinding[];
}

/**
 * AI-generated narrative for analytics
 */
export interface AnalyticsNarrative {
  summary: string; // 2-3 sentences
  topOpportunities: string[]; // 2-4 bullets
  topRisks: string[]; // 2-4 bullets
  executiveSummary: string; // 1 sentence headline
  updatedAt: string;
  isAiGenerated: boolean;
}

/**
 * Analytics finding with lab categorization
 */
export interface AnalyticsLabFinding {
  id?: string;
  labSlug: 'analytics' | 'media' | 'seo' | 'gbp';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendedAction: string;
  metric?: string;
  currentValue?: number | string;
  previousValue?: number | string;
  changePercent?: number;
  source: 'analytics_ai' | 'rule_based';
  createdAt?: string;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Trend classification
 */
export type TrendSlope = 'strong_up' | 'up' | 'flat' | 'down' | 'strong_down';

/**
 * Data quality level
 */
export type DataQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'none';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Merge multiple analytics snapshots into one
 * Used for aggregating daily snapshots into period summaries
 */
export function mergeAnalyticsSnapshots(
  snapshots: AnalyticsLabSnapshot[]
): Partial<AnalyticsLabSnapshot> | null {
  if (!snapshots.length) return null;

  const latest = snapshots[snapshots.length - 1];

  // For now, just return the latest snapshot
  // More sophisticated merging could be added later
  return {
    companyId: latest.companyId,
    date: latest.date,
    range: latest.range,
    hasGa4: latest.hasGa4,
    hasGsc: latest.hasGsc,
    hasGbp: latest.hasGbp,
    hasMedia: latest.hasMedia,
    sourceGa4: latest.sourceGa4,
    sourceSearchConsole: latest.sourceSearchConsole,
    sourceGbp: latest.sourceGbp,
    sourcePaidMedia: latest.sourcePaidMedia,
    delta: latest.delta,
    updatedAt: latest.updatedAt,
  };
}

/**
 * Compare two snapshots and compute deltas
 */
export function compareSnapshotsForDeltas(
  current: AnalyticsLabSnapshot,
  previous: AnalyticsLabSnapshot
): AnalyticsDeltas {
  const calcChange = (curr: number | undefined, prev: number | undefined): number | null => {
    if (curr === undefined || prev === undefined) return null;
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    sessionsMoM: calcChange(
      current.sourceGa4?.totalSessions,
      previous.sourceGa4?.totalSessions
    ),
    conversionsMoM: calcChange(
      current.sourceGa4?.conversions,
      previous.sourceGa4?.conversions
    ),
    organicClicksMoM: calcChange(
      current.sourceSearchConsole?.clicks,
      previous.sourceSearchConsole?.clicks
    ),
    gbpActionsMoM: calcChange(
      (current.sourceGbp?.calls ?? 0) + (current.sourceGbp?.directionRequests ?? 0) + (current.sourceGbp?.websiteClicks ?? 0),
      (previous.sourceGbp?.calls ?? 0) + (previous.sourceGbp?.directionRequests ?? 0) + (previous.sourceGbp?.websiteClicks ?? 0)
    ),
    spendMoM: calcChange(
      current.sourcePaidMedia?.spend,
      previous.sourcePaidMedia?.spend
    ),
    cpaMoM: calcChange(
      current.sourcePaidMedia?.cpa,
      previous.sourcePaidMedia?.cpa
    ),
    roasMoM: calcChange(
      current.sourcePaidMedia?.roas,
      previous.sourcePaidMedia?.roas
    ),
  };
}

/**
 * Classify trend slope based on percent change
 */
export function classifyTrendSlope(changePct: number | null): TrendSlope {
  if (changePct === null) return 'flat';
  if (changePct >= 25) return 'strong_up';
  if (changePct >= 10) return 'up';
  if (changePct <= -25) return 'strong_down';
  if (changePct <= -10) return 'down';
  return 'flat';
}

/**
 * Get data quality level based on score
 */
export function getDataQualityLevel(score: number | undefined): DataQualityLevel {
  if (score === undefined || score === 0) return 'none';
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/**
 * Calculate data quality score based on connected sources
 */
export function calculateDataQualityScore(snapshot: AnalyticsLabSnapshot): number {
  let score = 0;
  let maxScore = 0;

  // GA4 contributes 40 points
  maxScore += 40;
  if (snapshot.hasGa4 && snapshot.sourceGa4) {
    score += 20; // Connected
    if (snapshot.sourceGa4.totalSessions > 0) score += 10;
    if (snapshot.sourceGa4.conversions > 0) score += 10;
  }

  // GSC contributes 30 points
  maxScore += 30;
  if (snapshot.hasGsc && snapshot.sourceSearchConsole) {
    score += 15; // Connected
    if (snapshot.sourceSearchConsole.impressions > 0) score += 8;
    if (snapshot.sourceSearchConsole.clicks > 0) score += 7;
  }

  // GBP contributes 15 points
  maxScore += 15;
  if (snapshot.hasGbp && snapshot.sourceGbp) {
    score += 8; // Connected
    if (snapshot.sourceGbp.views > 0) score += 7;
  }

  // Media contributes 15 points
  maxScore += 15;
  if (snapshot.hasMedia && snapshot.sourcePaidMedia) {
    score += 8; // Connected
    if (snapshot.sourcePaidMedia.conversions > 0) score += 7;
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * Get trend color class for UI
 */
export function getTrendColorClass(slope: TrendSlope, invert = false): string {
  const colors: Record<TrendSlope, string> = invert
    ? {
        strong_up: 'text-red-400',
        up: 'text-red-300',
        flat: 'text-slate-400',
        down: 'text-emerald-300',
        strong_down: 'text-emerald-400',
      }
    : {
        strong_up: 'text-emerald-400',
        up: 'text-emerald-300',
        flat: 'text-slate-400',
        down: 'text-red-300',
        strong_down: 'text-red-400',
      };
  return colors[slope];
}

/**
 * Get severity color class
 */
export function getSeverityColorClass(severity: AnalyticsLabFinding['severity']): string {
  const colors: Record<AnalyticsLabFinding['severity'], string> = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/30',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };
  return colors[severity];
}
