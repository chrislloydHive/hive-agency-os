// lib/types/analyticsLite.ts
// MVP Analytics Lite types for lightweight analytics snapshots
//
// These types provide a simplified analytics layer for use in
// Overview and Reports without requiring full analytics infrastructure.

// ============================================================================
// Core Analytics Lite Types
// ============================================================================

/**
 * Timeframe options for analytics
 */
export type AnalyticsTimeframe = 'last_7_days' | 'last_28_days' | 'last_90_days';

/**
 * Lightweight analytics snapshot for MVP
 */
export interface AnalyticsSnapshotLite {
  companyId: string;
  timeframe: AnalyticsTimeframe;

  // Traffic metrics (from GA4)
  sessions?: number;
  sessionsChangePct?: number;
  users?: number;
  usersChangePct?: number;

  // Conversion metrics
  conversions?: number;
  conversionsChangePct?: number;
  conversionRate?: number;

  // Paid media metrics
  spend?: number;
  spendChangePct?: number;
  roas?: number;
  roasChangePct?: number;
  cpa?: number;
  cpaChangePct?: number;

  // Organic metrics (from GSC)
  organicClicks?: number;
  organicClicksChangePct?: number;
  organicImpressions?: number;
  organicImpressionsChangePct?: number;
  avgPosition?: number;

  // Data quality
  dataCompleteness: number; // 0-100
  dataSources: AnalyticsDataSource[];

  // Metadata
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Data sources used in analytics
 */
export type AnalyticsDataSource = 'ga4' | 'gsc' | 'media' | 'manual';

/**
 * AI-generated analytics narrative
 */
export interface AnalyticsNarrative {
  summary: string; // 2-3 sentences
  topInsight?: string;
  topRisk?: string;
  generatedAt: string;
}

// ============================================================================
// KPI Tile Configuration
// ============================================================================

/**
 * KPI tile for display
 */
export interface AnalyticsKpiTile {
  id: string;
  label: string;
  value: string | number;
  changePct?: number;
  trend: 'up' | 'down' | 'neutral';
  trendIsGood: boolean;
  format: 'number' | 'currency' | 'percent' | 'decimal';
}

/**
 * Generate KPI tiles from snapshot
 */
export function generateKpiTiles(snapshot: AnalyticsSnapshotLite): AnalyticsKpiTile[] {
  const tiles: AnalyticsKpiTile[] = [];

  if (snapshot.sessions !== undefined) {
    tiles.push({
      id: 'sessions',
      label: 'Sessions',
      value: snapshot.sessions,
      changePct: snapshot.sessionsChangePct,
      trend: getTrend(snapshot.sessionsChangePct),
      trendIsGood: (snapshot.sessionsChangePct ?? 0) >= 0,
      format: 'number',
    });
  }

  if (snapshot.conversions !== undefined) {
    tiles.push({
      id: 'conversions',
      label: 'Conversions',
      value: snapshot.conversions,
      changePct: snapshot.conversionsChangePct,
      trend: getTrend(snapshot.conversionsChangePct),
      trendIsGood: (snapshot.conversionsChangePct ?? 0) >= 0,
      format: 'number',
    });
  }

  if (snapshot.spend !== undefined) {
    tiles.push({
      id: 'spend',
      label: 'Media Spend',
      value: snapshot.spend,
      changePct: snapshot.spendChangePct,
      trend: getTrend(snapshot.spendChangePct),
      trendIsGood: true, // Spend change is contextual
      format: 'currency',
    });
  }

  if (snapshot.roas !== undefined) {
    tiles.push({
      id: 'roas',
      label: 'ROAS',
      value: snapshot.roas,
      changePct: snapshot.roasChangePct,
      trend: getTrend(snapshot.roasChangePct),
      trendIsGood: (snapshot.roasChangePct ?? 0) >= 0,
      format: 'decimal',
    });
  }

  if (snapshot.organicClicks !== undefined) {
    tiles.push({
      id: 'organicClicks',
      label: 'Organic Clicks',
      value: snapshot.organicClicks,
      changePct: snapshot.organicClicksChangePct,
      trend: getTrend(snapshot.organicClicksChangePct),
      trendIsGood: (snapshot.organicClicksChangePct ?? 0) >= 0,
      format: 'number',
    });
  }

  return tiles;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get trend direction from percent change
 */
function getTrend(changePct?: number): 'up' | 'down' | 'neutral' {
  if (changePct === undefined || changePct === 0) return 'neutral';
  return changePct > 0 ? 'up' : 'down';
}

/**
 * Format number with appropriate suffix
 */
export function formatMetricValue(value: number, format: AnalyticsKpiTile['format']): string {
  switch (format) {
    case 'currency':
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
      }
      return `$${value.toFixed(0)}`;

    case 'percent':
      return `${value.toFixed(1)}%`;

    case 'decimal':
      return value.toFixed(2);

    case 'number':
    default:
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toLocaleString();
  }
}

/**
 * Format percent change for display
 */
export function formatChangePct(changePct: number): string {
  const sign = changePct >= 0 ? '+' : '';
  return `${sign}${changePct.toFixed(0)}%`;
}

/**
 * Calculate data completeness score
 */
export function calculateDataCompleteness(snapshot: Partial<AnalyticsSnapshotLite>): number {
  const fields = [
    'sessions',
    'conversions',
    'spend',
    'organicClicks',
  ];

  let filled = 0;
  for (const field of fields) {
    if (snapshot[field as keyof AnalyticsSnapshotLite] !== undefined) {
      filled++;
    }
  }

  return Math.round((filled / fields.length) * 100);
}
