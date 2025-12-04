// lib/media/alerts.ts
// Media Alerts & Anomalies Rules Engine
//
// Detects performance anomalies and generates actionable insights:
// - Underperforming channels (vs plan or history)
// - Store-level dropoffs
// - Spend spikes/anomalies
// - Lead/conversion rate changes

import type { MediaCockpitSnapshot, MediaKpiSnapshot } from './cockpit';
import type { MediaEventChannel, AggregatedMediaMetrics } from './performanceTypes';

// ============================================================================
// Types
// ============================================================================

export type MediaAlertSeverity = 'info' | 'warning' | 'critical';

export type MediaAlertType =
  | 'underperforming_channel'
  | 'store_dropoff'
  | 'spend_spike'
  | 'spend_underspend'
  | 'conversion_drop'
  | 'cpl_increase'
  | 'low_impressions'
  | 'high_cpc';

export interface MediaInsight {
  id: string;
  type: MediaAlertType;
  severity: MediaAlertSeverity;
  title: string;
  description: string;
  channel?: MediaEventChannel;
  storeId?: string;
  metric?: string;
  currentValue?: number;
  expectedValue?: number;
  deltaPct?: number;
  recommendation?: string;
  detectedAt: string;
}

export interface MediaAlertRule {
  id: string;
  name: string;
  type: MediaAlertType;
  enabled: boolean;
  evaluate: (context: AlertEvaluationContext) => MediaInsight[];
}

export interface AlertEvaluationContext {
  snapshot: MediaKpiSnapshot;
  history?: MediaKpiSnapshot[];
  plan?: {
    totalBudget: number;
    channels: Array<{
      channel: string;
      budget: number;
      expectedVolume?: number;
    }>;
  };
  thresholds?: AlertThresholds;
}

export interface AlertThresholds {
  /** % below expected to trigger underperformance (default: 0.2 = 20%) */
  underperformanceThreshold: number;
  /** % above expected to trigger spend spike (default: 0.3 = 30%) */
  spendSpikeThreshold: number;
  /** % below expected to trigger underspend (default: 0.25 = 25%) */
  underspendThreshold: number;
  /** % drop to trigger store dropoff (default: 0.4 = 40%) */
  storeDropoffThreshold: number;
  /** % increase in CPL to trigger alert (default: 0.25 = 25%) */
  cplIncreaseThreshold: number;
  /** % drop in conversion rate to trigger alert (default: 0.2 = 20%) */
  conversionDropThreshold: number;
  /** Min impressions per day to avoid low impressions alert */
  minDailyImpressions: number;
  /** Max acceptable CPC before alert */
  maxCpc: number;
}

// ============================================================================
// Default Thresholds
// ============================================================================

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  underperformanceThreshold: 0.2,
  spendSpikeThreshold: 0.3,
  underspendThreshold: 0.25,
  storeDropoffThreshold: 0.4,
  cplIncreaseThreshold: 0.25,
  conversionDropThreshold: 0.2,
  minDailyImpressions: 100,
  maxCpc: 50,
};

// ============================================================================
// Utility Functions
// ============================================================================

function generateInsightId(): string {
  return `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================================
// Alert Detection Functions
// ============================================================================

/**
 * Detect channels performing significantly below plan expectations
 */
export function detectUnderperformingChannels(
  context: AlertEvaluationContext
): MediaInsight[] {
  const insights: MediaInsight[] = [];
  const { snapshot, plan, thresholds = DEFAULT_ALERT_THRESHOLDS } = context;

  if (!plan?.channels) return insights;

  for (const plannedChannel of plan.channels) {
    const channelKey = plannedChannel.channel as MediaEventChannel;
    const actualMetrics = snapshot.byChannel.get(channelKey);

    if (!actualMetrics) continue;

    // Check leads/volume underperformance
    if (plannedChannel.expectedVolume && plannedChannel.expectedVolume > 0) {
      const actualVolume = actualMetrics.leads + actualMetrics.calls;
      const volumeRatio = actualVolume / plannedChannel.expectedVolume;

      if (volumeRatio < (1 - thresholds.underperformanceThreshold)) {
        insights.push({
          id: generateInsightId(),
          type: 'underperforming_channel',
          severity: volumeRatio < 0.5 ? 'critical' : 'warning',
          title: `${channelKey} underperforming`,
          description: `${channelKey} is generating ${formatPct(1 - volumeRatio)} fewer leads than expected.`,
          channel: channelKey,
          metric: 'volume',
          currentValue: actualVolume,
          expectedValue: plannedChannel.expectedVolume,
          deltaPct: volumeRatio - 1,
          recommendation: `Review ${channelKey} targeting, bids, and creative. Consider reallocating budget to higher-performing channels.`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return insights;
}

/**
 * Detect stores with significant performance drops compared to history
 */
export function detectStoreDropoffs(
  context: AlertEvaluationContext
): MediaInsight[] {
  const insights: MediaInsight[] = [];
  const { snapshot, history, thresholds = DEFAULT_ALERT_THRESHOLDS } = context;

  if (!history || history.length === 0) return insights;

  // Calculate average store performance from history
  const historicalStoreMetrics = new Map<string, { avgLeads: number; avgCalls: number }>();

  for (const historicalSnapshot of history) {
    for (const [storeId, metrics] of historicalSnapshot.byStore) {
      const existing = historicalStoreMetrics.get(storeId) || { avgLeads: 0, avgCalls: 0 };
      existing.avgLeads += metrics.leads / history.length;
      existing.avgCalls += metrics.calls / history.length;
      historicalStoreMetrics.set(storeId, existing);
    }
  }

  // Compare current to historical
  for (const [storeId, currentMetrics] of snapshot.byStore) {
    const historical = historicalStoreMetrics.get(storeId);
    if (!historical) continue;

    const historicalVolume = historical.avgLeads + historical.avgCalls;
    const currentVolume = currentMetrics.leads + currentMetrics.calls;

    if (historicalVolume > 0) {
      const dropPct = (historicalVolume - currentVolume) / historicalVolume;

      if (dropPct >= thresholds.storeDropoffThreshold) {
        insights.push({
          id: generateInsightId(),
          type: 'store_dropoff',
          severity: dropPct >= 0.6 ? 'critical' : 'warning',
          title: `Store ${storeId} volume drop`,
          description: `Store ${storeId} has ${formatPct(dropPct)} fewer leads/calls than historical average.`,
          storeId,
          metric: 'volume',
          currentValue: currentVolume,
          expectedValue: historicalVolume,
          deltaPct: -dropPct,
          recommendation: `Investigate store ${storeId} for local market changes, tracking issues, or competitive pressure.`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return insights;
}

/**
 * Detect spend significantly above plan
 */
export function detectSpendSpike(
  context: AlertEvaluationContext
): MediaInsight[] {
  const insights: MediaInsight[] = [];
  const { snapshot, plan, thresholds = DEFAULT_ALERT_THRESHOLDS } = context;

  if (!plan) return insights;

  // Overall spend spike
  if (plan.totalBudget > 0) {
    const spendRatio = snapshot.spend / plan.totalBudget;

    if (spendRatio > (1 + thresholds.spendSpikeThreshold)) {
      insights.push({
        id: generateInsightId(),
        type: 'spend_spike',
        severity: spendRatio > 1.5 ? 'critical' : 'warning',
        title: 'Spend over budget',
        description: `Total spend is ${formatPct(spendRatio - 1)} over the planned budget.`,
        metric: 'spend',
        currentValue: snapshot.spend,
        expectedValue: plan.totalBudget,
        deltaPct: spendRatio - 1,
        recommendation: 'Review campaign budgets and daily caps. Consider pausing lower-performing campaigns.',
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // Per-channel spend spikes
  for (const plannedChannel of plan.channels || []) {
    const channelKey = plannedChannel.channel as MediaEventChannel;
    const actualMetrics = snapshot.byChannel.get(channelKey);

    if (!actualMetrics || plannedChannel.budget <= 0) continue;

    const channelSpendRatio = actualMetrics.spend / plannedChannel.budget;

    if (channelSpendRatio > (1 + thresholds.spendSpikeThreshold)) {
      insights.push({
        id: generateInsightId(),
        type: 'spend_spike',
        severity: channelSpendRatio > 1.5 ? 'critical' : 'warning',
        title: `${channelKey} over budget`,
        description: `${channelKey} spend is ${formatPct(channelSpendRatio - 1)} over budget.`,
        channel: channelKey,
        metric: 'spend',
        currentValue: actualMetrics.spend,
        expectedValue: plannedChannel.budget,
        deltaPct: channelSpendRatio - 1,
        recommendation: `Review ${channelKey} bid strategies and daily budget caps.`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return insights;
}

/**
 * Detect significant underspend (missed opportunity)
 */
export function detectUnderspend(
  context: AlertEvaluationContext
): MediaInsight[] {
  const insights: MediaInsight[] = [];
  const { snapshot, plan, thresholds = DEFAULT_ALERT_THRESHOLDS } = context;

  if (!plan) return insights;

  // Overall underspend
  if (plan.totalBudget > 0) {
    const spendRatio = snapshot.spend / plan.totalBudget;

    if (spendRatio < (1 - thresholds.underspendThreshold)) {
      insights.push({
        id: generateInsightId(),
        type: 'spend_underspend',
        severity: 'info',
        title: 'Budget underutilized',
        description: `Only ${formatPct(spendRatio)} of planned budget has been spent.`,
        metric: 'spend',
        currentValue: snapshot.spend,
        expectedValue: plan.totalBudget,
        deltaPct: spendRatio - 1,
        recommendation: 'Consider expanding targeting, increasing bids, or reallocating budget to maximize reach.',
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return insights;
}

/**
 * Detect significant CPL increases compared to history
 */
export function detectCplIncrease(
  context: AlertEvaluationContext
): MediaInsight[] {
  const insights: MediaInsight[] = [];
  const { snapshot, history, thresholds = DEFAULT_ALERT_THRESHOLDS } = context;

  if (!history || history.length === 0 || snapshot.cpl === null) return insights;

  // Calculate average historical CPL
  const historicalCpls = history
    .map(h => h.cpl)
    .filter((cpl): cpl is number => cpl !== null);

  if (historicalCpls.length === 0) return insights;

  const avgHistoricalCpl = historicalCpls.reduce((a, b) => a + b, 0) / historicalCpls.length;

  if (avgHistoricalCpl > 0) {
    const cplIncrease = (snapshot.cpl - avgHistoricalCpl) / avgHistoricalCpl;

    if (cplIncrease >= thresholds.cplIncreaseThreshold) {
      insights.push({
        id: generateInsightId(),
        type: 'cpl_increase',
        severity: cplIncrease >= 0.5 ? 'critical' : 'warning',
        title: 'Cost per lead increasing',
        description: `CPL is ${formatPct(cplIncrease)} higher than historical average (${formatCurrency(snapshot.cpl)} vs ${formatCurrency(avgHistoricalCpl)}).`,
        metric: 'cpl',
        currentValue: snapshot.cpl,
        expectedValue: avgHistoricalCpl,
        deltaPct: cplIncrease,
        recommendation: 'Review bid strategies, audience targeting, and landing page conversion rates.',
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return insights;
}

/**
 * Detect channels with very low impressions
 */
export function detectLowImpressions(
  context: AlertEvaluationContext
): MediaInsight[] {
  const insights: MediaInsight[] = [];
  const { snapshot, thresholds = DEFAULT_ALERT_THRESHOLDS } = context;

  for (const [channelKey, metrics] of snapshot.byChannel) {
    // Skip if no spend (channel not active)
    if (metrics.spend <= 0) continue;

    if (metrics.impressions < thresholds.minDailyImpressions) {
      insights.push({
        id: generateInsightId(),
        type: 'low_impressions',
        severity: 'info',
        title: `Low ${channelKey} visibility`,
        description: `${channelKey} has only ${metrics.impressions.toLocaleString()} impressions despite active spend.`,
        channel: channelKey,
        metric: 'impressions',
        currentValue: metrics.impressions,
        expectedValue: thresholds.minDailyImpressions,
        recommendation: `Check ${channelKey} ad approval status, targeting settings, and bid competitiveness.`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return insights;
}

/**
 * Detect channels with unusually high CPC
 */
export function detectHighCpc(
  context: AlertEvaluationContext
): MediaInsight[] {
  const insights: MediaInsight[] = [];
  const { snapshot, thresholds = DEFAULT_ALERT_THRESHOLDS } = context;

  for (const [channelKey, metrics] of snapshot.byChannel) {
    if (metrics.clicks <= 0) continue;

    const cpc = metrics.spend / metrics.clicks;

    if (cpc > thresholds.maxCpc) {
      insights.push({
        id: generateInsightId(),
        type: 'high_cpc',
        severity: cpc > thresholds.maxCpc * 2 ? 'critical' : 'warning',
        title: `High ${channelKey} CPC`,
        description: `${channelKey} CPC is ${formatCurrency(cpc)}, significantly above ${formatCurrency(thresholds.maxCpc)} threshold.`,
        channel: channelKey,
        metric: 'cpc',
        currentValue: cpc,
        expectedValue: thresholds.maxCpc,
        recommendation: `Review ${channelKey} keyword quality scores, ad relevance, and competitive landscape.`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return insights;
}

// ============================================================================
// Alert Rules Registry
// ============================================================================

export const MEDIA_ALERT_RULES: MediaAlertRule[] = [
  {
    id: 'underperforming_channels',
    name: 'Underperforming Channels',
    type: 'underperforming_channel',
    enabled: true,
    evaluate: detectUnderperformingChannels,
  },
  {
    id: 'store_dropoffs',
    name: 'Store Performance Dropoffs',
    type: 'store_dropoff',
    enabled: true,
    evaluate: detectStoreDropoffs,
  },
  {
    id: 'spend_spike',
    name: 'Spend Over Budget',
    type: 'spend_spike',
    enabled: true,
    evaluate: detectSpendSpike,
  },
  {
    id: 'underspend',
    name: 'Budget Underutilized',
    type: 'spend_underspend',
    enabled: true,
    evaluate: detectUnderspend,
  },
  {
    id: 'cpl_increase',
    name: 'CPL Increase',
    type: 'cpl_increase',
    enabled: true,
    evaluate: detectCplIncrease,
  },
  {
    id: 'low_impressions',
    name: 'Low Impressions',
    type: 'low_impressions',
    enabled: true,
    evaluate: detectLowImpressions,
  },
  {
    id: 'high_cpc',
    name: 'High CPC',
    type: 'high_cpc',
    enabled: true,
    evaluate: detectHighCpc,
  },
];

// ============================================================================
// Main Evaluation Function
// ============================================================================

/**
 * Evaluate all alert rules and return insights
 */
export function evaluateMediaAlerts(input: {
  snapshot: MediaCockpitSnapshot;
  history?: MediaCockpitSnapshot[];
  plan?: AlertEvaluationContext['plan'];
  thresholds?: Partial<AlertThresholds>;
  enabledRules?: string[];
}): MediaInsight[] {
  const {
    snapshot: fullSnapshot,
    history: fullHistory,
    plan,
    thresholds: customThresholds,
    enabledRules,
  } = input;

  const thresholds: AlertThresholds = {
    ...DEFAULT_ALERT_THRESHOLDS,
    ...customThresholds,
  };

  // Extract kpiSnapshot from MediaCockpitSnapshot for evaluation
  const context: AlertEvaluationContext = {
    snapshot: fullSnapshot.kpiSnapshot,
    history: fullHistory?.map(h => h.kpiSnapshot),
    plan,
    thresholds,
  };

  const insights: MediaInsight[] = [];

  for (const rule of MEDIA_ALERT_RULES) {
    // Skip disabled rules
    if (!rule.enabled) continue;

    // Skip if not in enabled list (when list is provided)
    if (enabledRules && !enabledRules.includes(rule.id)) continue;

    try {
      const ruleInsights = rule.evaluate(context);
      insights.push(...ruleInsights);
    } catch (error) {
      console.error(`[MediaAlerts] Rule ${rule.id} failed:`, error);
    }
  }

  // Sort by severity (critical > warning > info)
  const severityOrder: Record<MediaAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Get a summary of alerts by severity
 */
export function getAlertsSummary(insights: MediaInsight[]): {
  total: number;
  critical: number;
  warning: number;
  info: number;
} {
  return {
    total: insights.length,
    critical: insights.filter(i => i.severity === 'critical').length,
    warning: insights.filter(i => i.severity === 'warning').length,
    info: insights.filter(i => i.severity === 'info').length,
  };
}

/**
 * Filter insights by channel
 */
export function getInsightsForChannel(
  insights: MediaInsight[],
  channel: MediaEventChannel
): MediaInsight[] {
  return insights.filter(i => i.channel === channel || !i.channel);
}

/**
 * Filter insights by store
 */
export function getInsightsForStore(
  insights: MediaInsight[],
  storeId: string
): MediaInsight[] {
  return insights.filter(i => i.storeId === storeId || !i.storeId);
}
