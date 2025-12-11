// lib/types/companyAnalytics.ts
// Company Analytics types for the Status View feature
//
// This module defines types for the analytics snapshot that powers
// the "Current Analytics" section in the Status View.

/**
 * Analytics date range
 */
export type AnalyticsRange = '7d' | '28d' | '90d';

/**
 * Overall trend direction
 */
export type AnalyticsTrend = 'up' | 'flat' | 'down';

/**
 * Company Analytics Snapshot - computed model for analytics display
 */
export interface CompanyAnalyticsSnapshot {
  companyId: string;

  /** Date range for the snapshot */
  range: AnalyticsRange;

  /** Comparison period */
  comparedTo?: 'prev_period';

  // =========================================================================
  // Web / Demand Metrics
  // =========================================================================

  /** Total sessions in the period */
  sessions?: number | null;

  /** Percent change in sessions vs prior period */
  sessionsChangePct?: number | null;

  /** Total conversions in the period */
  conversions?: number | null;

  /** Percent change in conversions vs prior period */
  conversionsChangePct?: number | null;

  /** Conversion rate (conversions / sessions) */
  conversionRate?: number | null;

  // =========================================================================
  // Media / Paid Metrics
  // =========================================================================

  /** Total media spend in the period */
  mediaSpend?: number | null;

  /** Percent change in media spend vs prior period */
  mediaSpendChangePct?: number | null;

  /** Cost per lead */
  cpl?: number | null;

  /** Percent change in CPL vs prior period */
  cplChangePct?: number | null;

  /** Return on ad spend */
  roas?: number | null;

  // =========================================================================
  // Local / GBP Metrics (optional)
  // =========================================================================

  /** Google Business Profile views */
  gbpViews?: number | null;

  /** Google Business Profile calls */
  gbpCalls?: number | null;

  /** Google Business Profile direction requests */
  gbpDirections?: number | null;

  // =========================================================================
  // SEO Metrics
  // =========================================================================

  /** Organic clicks from Search Console */
  organicClicks?: number | null;

  /** Percent change in organic clicks vs prior period */
  organicClicksChangePct?: number | null;

  /** Organic impressions */
  organicImpressions?: number | null;

  // =========================================================================
  // Trend Analysis
  // =========================================================================

  /** Overall trend direction */
  trend?: AnalyticsTrend;

  /** Key alerts/signals to highlight */
  keyAlerts: string[];

  // =========================================================================
  // Meta
  // =========================================================================

  /** Start date of the period (ISO) */
  startDate?: string;

  /** End date of the period (ISO) */
  endDate?: string;

  /** When this snapshot was computed (ISO) */
  updatedAt: string;

  /** Whether GA4 is connected */
  hasGa4?: boolean;

  /** Whether GSC is connected */
  hasGsc?: boolean;
}

/**
 * Get display label for analytics range
 */
export function getAnalyticsRangeLabel(range: AnalyticsRange): string {
  const labels: Record<AnalyticsRange, string> = {
    '7d': 'Last 7 days',
    '28d': 'Last 28 days',
    '90d': 'Last 90 days',
  };
  return labels[range] || range;
}

/**
 * Get trend arrow symbol
 */
export function getTrendArrow(trend: AnalyticsTrend | undefined): string {
  if (!trend) return '—';
  const arrows: Record<AnalyticsTrend, string> = {
    up: '↑',
    flat: '→',
    down: '↓',
  };
  return arrows[trend] || '—';
}

/**
 * Get color class for percent change
 */
export function getChangeColorClass(
  changePct: number | null | undefined,
  invertColors: boolean = false
): string {
  if (changePct === null || changePct === undefined) return 'text-slate-400';

  const isPositive = changePct > 0;
  const isNegative = changePct < 0;

  // For some metrics like CPL, negative is good
  if (invertColors) {
    if (isPositive) return 'text-red-400';
    if (isNegative) return 'text-emerald-400';
  } else {
    if (isPositive) return 'text-emerald-400';
    if (isNegative) return 'text-red-400';
  }

  return 'text-slate-400';
}

/**
 * Format percent change for display
 */
export function formatPercentChange(changePct: number | null | undefined): string {
  if (changePct === null || changePct === undefined) return '—';
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct}%`;
}

/**
 * Format number with K/M suffixes
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format currency
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
