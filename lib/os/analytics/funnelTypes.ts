// lib/os/analytics/funnelTypes.ts
// Client-safe Funnel types and pure transformation functions
//
// This file contains ONLY types and pure functions that can be safely
// imported in client components. No server-side code (GA4, Airtable, etc.)
//
// For server-side funnel functions, use lib/os/analytics/funnel.ts directly

import type { AuditFunnelSnapshot } from '@/lib/ga4Client';

// ============================================================================
// Unified Funnel Types
// ============================================================================

/**
 * Canonical funnel stage identifiers
 * Used consistently across DMA, Company, and Workspace funnels
 */
export type FunnelStageId =
  | 'sessions'
  | 'audits_started'
  | 'audits_completed'
  | 'leads'
  | 'gap_assessments'
  | 'gap_plans'
  | 'custom';

/**
 * A single funnel stage with current and comparison values
 */
export interface FunnelStageSummary {
  id: FunnelStageId;
  label: string;
  value: number;
  prevValue: number | null;
  conversionFromPrevious: number | null; // rate 0-1
}

/**
 * Time series data point for funnel visualization
 */
export interface FunnelTimePoint {
  date: string; // YYYY-MM-DD
  values: Record<FunnelStageId, number>;
}

/**
 * Channel/source performance for funnel breakdown
 */
export interface FunnelChannelPerformance {
  channel: string;
  sessions: number;
  conversions: number;
  conversionRate: number; // 0-1
  values: Partial<Record<FunnelStageId, number>>;
}

/**
 * Campaign performance for funnel breakdown
 */
export interface FunnelCampaignPerformance {
  campaign: string;
  sourceMedium: string;
  sessions: number;
  conversions: number;
  conversionRate: number; // 0-1
  values: Partial<Record<FunnelStageId, number>>;
}

/**
 * High-level funnel summary
 */
export interface FunnelSummary {
  totalSessions: number;
  totalConversions: number;
  overallConversionRate: number; // 0-1
  topChannel: string | null;
  topCampaign: string | null;
  periodChange: number | null; // % change vs previous period
}

/**
 * Complete funnel dataset - the unified shape for all funnel views
 */
export interface FunnelDataset {
  context: 'dma' | 'company' | 'workspace';
  contextId?: string; // companyId for company context
  range: {
    startDate: string;
    endDate: string;
    preset?: '7d' | '30d' | '90d';
  };
  generatedAt: string;
  summary: FunnelSummary;
  stages: FunnelStageSummary[];
  timeSeries: FunnelTimePoint[];
  channels: FunnelChannelPerformance[];
  campaigns: FunnelCampaignPerformance[];
}

// ============================================================================
// Pure Helper Functions (client-safe)
// ============================================================================

/**
 * Calculate conversion rate between two values
 */
export function calculateConversionRate(from: number, to: number): number | null {
  if (from === 0) return null;
  return to / from;
}

/**
 * Get conversion rates between stages
 */
export function getFunnelConversionRates(
  stages: FunnelStageSummary[]
): Array<{ from: string; to: string; rate: number | null }> {
  const rates: Array<{ from: string; to: string; rate: number | null }> = [];

  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i];
    const to = stages[i + 1];
    rates.push({
      from: from.label,
      to: to.label,
      rate: calculateConversionRate(from.value, to.value),
    });
  }

  return rates;
}

/**
 * Get conversion rates from a dataset
 */
export function getDatasetConversionRates(
  dataset: FunnelDataset
): Array<{ from: string; to: string; rate: number | null }> {
  return getFunnelConversionRates(dataset.stages);
}

// ============================================================================
// Transform Functions (client-safe, pure)
// ============================================================================

/**
 * Transform a DMA AuditFunnelSnapshot to a unified FunnelDataset
 * This is a pure function that can be used in client components
 */
export function transformDmaSnapshotToDataset(
  snapshot: AuditFunnelSnapshot,
  range: { startDate: string; endDate: string },
  preset?: '7d' | '30d' | '90d'
): FunnelDataset {
  // Build stages
  const stages: FunnelStageSummary[] = [
    {
      id: 'audits_started',
      label: 'Audits Started',
      value: snapshot.totals.auditsStarted,
      prevValue: null,
      conversionFromPrevious: null,
    },
    {
      id: 'audits_completed',
      label: 'Audits Completed',
      value: snapshot.totals.auditsCompleted,
      prevValue: null,
      conversionFromPrevious: snapshot.totals.completionRate,
    },
  ];

  // Add unique users as sessions if available
  if (snapshot.totals.uniqueUsers !== null) {
    stages.unshift({
      id: 'sessions',
      label: 'Unique Users',
      value: snapshot.totals.uniqueUsers,
      prevValue: null,
      conversionFromPrevious: null,
    });
    // Update audits_started conversion
    stages[1].conversionFromPrevious = calculateConversionRate(
      snapshot.totals.uniqueUsers,
      snapshot.totals.auditsStarted
    );
  }

  // Build time series
  const timeSeries: FunnelTimePoint[] = snapshot.timeSeries.map((point) => ({
    date: point.date,
    values: {
      sessions: 0,
      audits_started: point.auditsStarted,
      audits_completed: point.auditsCompleted,
      leads: 0,
      gap_assessments: 0,
      gap_plans: 0,
      custom: 0,
    },
  }));

  // Build channels
  const channels: FunnelChannelPerformance[] = snapshot.byChannel.map((ch) => ({
    channel: ch.channel,
    sessions: ch.auditsStarted,
    conversions: ch.auditsCompleted,
    conversionRate: ch.completionRate,
    values: {
      audits_started: ch.auditsStarted,
      audits_completed: ch.auditsCompleted,
    },
  }));

  // Build campaigns
  const campaigns: FunnelCampaignPerformance[] = snapshot.byCampaign.map((camp) => ({
    campaign: camp.campaign,
    sourceMedium: camp.sourceMedium,
    sessions: camp.auditsStarted,
    conversions: camp.auditsCompleted,
    conversionRate: camp.completionRate,
    values: {
      audits_started: camp.auditsStarted,
      audits_completed: camp.auditsCompleted,
    },
  }));

  // Find top channel and campaign
  const topChannel = channels.length > 0
    ? channels.reduce((max, ch) => ch.sessions > max.sessions ? ch : max).channel
    : null;

  const topCampaign = campaigns.length > 0
    ? campaigns.reduce((max, c) => c.sessions > max.sessions ? c : max).campaign
    : null;

  return {
    context: 'dma',
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      preset,
    },
    generatedAt: new Date().toISOString(),
    summary: {
      totalSessions: snapshot.totals.auditsStarted,
      totalConversions: snapshot.totals.auditsCompleted,
      overallConversionRate: snapshot.totals.completionRate,
      topChannel,
      topCampaign,
      periodChange: null,
    },
    stages,
    timeSeries,
    channels,
    campaigns,
  };
}
