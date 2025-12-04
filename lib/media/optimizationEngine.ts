// lib/media/optimizationEngine.ts
// Optimization Engine - Continuous Performance Loops
//
// Analyzes performance data and generates actionable optimization recommendations:
// - Budget shifts between channels
// - Channel pause/increase suggestions
// - Store-level adjustments
// - Creative refresh triggers
// - Bid strategy changes

import type { MediaCockpitSnapshot, MediaKpiSnapshot } from './cockpit';
import type { MediaProfile } from './mediaProfile';
import type { MediaInsight } from './alerts';
import type { MediaChannel } from './types';
import type { MediaEventChannel, AggregatedMediaMetrics } from './performanceTypes';

// ============================================================================
// Types
// ============================================================================

export type OptimizationType =
  | 'budget-shift'
  | 'pause-channel'
  | 'increase-channel'
  | 'store-adjustment'
  | 'creative-refresh'
  | 'bid-adjustment'
  | 'audience-expansion'
  | 'dayparting'
  | 'geo-adjustment';

export type OptimizationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface OptimizationAction {
  type: 'shift' | 'pause' | 'increase' | 'decrease' | 'refresh' | 'expand' | 'contract';
  target: string; // channel, store, or campaign identifier
  currentValue?: number;
  recommendedValue?: number;
  percentChange?: number;
  reason: string;
}

export interface OptimizationRecommendation {
  id: string;
  type: OptimizationType;
  severity: OptimizationSeverity;
  title: string;
  summary: string;
  impact: {
    estimatedCpaSavings?: number;
    estimatedVolumeGain?: number;
    confidence: 'low' | 'medium' | 'high';
  };
  actions: OptimizationAction[];
  relatedInsightIds?: string[];
  createdAt: string;
}

export interface OptimizationEngineInput {
  snapshot: MediaCockpitSnapshot;
  history?: MediaCockpitSnapshot[];
  profile: MediaProfile;
  insights?: MediaInsight[];
  targetCpa?: number;
  minChannelBudget?: number;
}

export interface OptimizationSummary {
  totalRecommendations: number;
  bySeverity: Record<OptimizationSeverity, number>;
  estimatedSavings: number;
  topPriority: OptimizationRecommendation | null;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG = {
  /** CPA threshold above benchmark to trigger optimization (30%) */
  cpaThreshold: 0.30,
  /** CPA threshold for critical action (50%) */
  cpaCriticalThreshold: 0.50,
  /** CTR threshold below which creative refresh is suggested */
  ctrRefreshThreshold: 0.008,
  /** Minimum history periods for trend analysis */
  minHistoryPeriods: 3,
  /** Conversion rate drop threshold for alerts (20%) */
  conversionDropThreshold: 0.20,
  /** Spend threshold for budget shift consideration (15%) */
  budgetShiftThreshold: 0.15,
  /** Minimum channel spend share to consider pausing */
  minSpendShareToPause: 0.05,
};

// ============================================================================
// Main Engine
// ============================================================================

/**
 * Generate optimization recommendations based on performance data
 */
export function generateOptimizationRecommendations(
  input: OptimizationEngineInput
): OptimizationRecommendation[] {
  const { snapshot, history, profile, insights, targetCpa, minChannelBudget } = input;

  const recommendations: OptimizationRecommendation[] = [];

  // 1. Channel CPA Analysis
  const cpaRecommendations = analyzeChannelCpa(
    snapshot.kpiSnapshot,
    profile,
    targetCpa
  );
  recommendations.push(...cpaRecommendations);

  // 2. Budget Allocation Analysis
  const budgetRecommendations = analyzeBudgetAllocation(
    snapshot.kpiSnapshot,
    profile
  );
  recommendations.push(...budgetRecommendations);

  // 3. Creative Refresh Analysis
  const creativeRecommendations = analyzeCreativePerformance(
    snapshot.kpiSnapshot,
    history?.map(h => h.kpiSnapshot)
  );
  recommendations.push(...creativeRecommendations);

  // 4. Store-Level Analysis
  const storeRecommendations = analyzeStorePerformance(
    snapshot.kpiSnapshot,
    profile
  );
  recommendations.push(...storeRecommendations);

  // 5. Trend-Based Analysis (if history available)
  if (history && history.length >= DEFAULT_CONFIG.minHistoryPeriods) {
    const trendRecommendations = analyzeTrends(
      snapshot.kpiSnapshot,
      history.map(h => h.kpiSnapshot)
    );
    recommendations.push(...trendRecommendations);
  }

  // 6. Insight-Based Recommendations
  if (insights && insights.length > 0) {
    const insightRecommendations = processInsights(insights);
    recommendations.push(...insightRecommendations);
  }

  // Sort by severity and confidence
  return sortRecommendations(recommendations);
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyze channel CPA vs benchmarks
 */
function analyzeChannelCpa(
  kpi: MediaKpiSnapshot,
  profile: MediaProfile,
  targetCpa?: number
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const benchmarkCpa = targetCpa || profile.maxCpa || 100;

  for (const [channel, metrics] of kpi.byChannel) {
    if (!metrics.cpa || metrics.spend < 100) continue;

    const cpaRatio = metrics.cpa / benchmarkCpa;

    if (cpaRatio > 1 + DEFAULT_CONFIG.cpaCriticalThreshold) {
      // Critical - CPA 50%+ above target
      recommendations.push({
        id: generateId(),
        type: 'pause-channel',
        severity: 'critical',
        title: `Pause or reduce ${channel}`,
        summary: `${channel} CPA ($${metrics.cpa.toFixed(2)}) is ${Math.round((cpaRatio - 1) * 100)}% above target. Consider pausing or significantly reducing budget.`,
        impact: {
          estimatedCpaSavings: (metrics.cpa - benchmarkCpa) * (metrics.leads + metrics.calls),
          confidence: 'high',
        },
        actions: [
          {
            type: 'decrease',
            target: channel,
            currentValue: metrics.spend,
            recommendedValue: metrics.spend * 0.3,
            percentChange: -70,
            reason: 'CPA significantly above target',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    } else if (cpaRatio > 1 + DEFAULT_CONFIG.cpaThreshold) {
      // High - CPA 30-50% above target
      recommendations.push({
        id: generateId(),
        type: 'budget-shift',
        severity: 'high',
        title: `Optimize ${channel} spend`,
        summary: `${channel} CPA ($${metrics.cpa.toFixed(2)}) is ${Math.round((cpaRatio - 1) * 100)}% above target. Consider shifting budget to better-performing channels.`,
        impact: {
          estimatedCpaSavings: (metrics.cpa - benchmarkCpa) * (metrics.leads + metrics.calls) * 0.5,
          confidence: 'medium',
        },
        actions: [
          {
            type: 'shift',
            target: channel,
            currentValue: metrics.spend,
            recommendedValue: metrics.spend * 0.7,
            percentChange: -30,
            reason: 'CPA above benchmark',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    } else if (cpaRatio < 0.7) {
      // Opportunity - CPA 30%+ below target
      recommendations.push({
        id: generateId(),
        type: 'increase-channel',
        severity: 'low',
        title: `Scale ${channel} opportunity`,
        summary: `${channel} is performing well with CPA ($${metrics.cpa.toFixed(2)}) ${Math.round((1 - cpaRatio) * 100)}% below target. Consider increasing budget.`,
        impact: {
          estimatedVolumeGain: Math.round((metrics.leads + metrics.calls) * 0.3),
          confidence: 'medium',
        },
        actions: [
          {
            type: 'increase',
            target: channel,
            currentValue: metrics.spend,
            recommendedValue: metrics.spend * 1.3,
            percentChange: 30,
            reason: 'Strong CPA performance',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }
  }

  return recommendations;
}

/**
 * Analyze budget allocation efficiency
 */
function analyzeBudgetAllocation(
  kpi: MediaKpiSnapshot,
  profile: MediaProfile
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Calculate efficiency scores for each channel
  const channelEfficiency: Array<{
    channel: MediaEventChannel;
    efficiency: number;
    spend: number;
    volume: number;
  }> = [];

  for (const [channel, metrics] of kpi.byChannel) {
    const volume = metrics.leads + metrics.calls + metrics.installs;
    if (metrics.spend > 0 && volume > 0) {
      const efficiency = volume / metrics.spend; // Higher is better
      channelEfficiency.push({ channel, efficiency, spend: metrics.spend, volume });
    }
  }

  if (channelEfficiency.length < 2) return recommendations;

  // Sort by efficiency
  channelEfficiency.sort((a, b) => b.efficiency - a.efficiency);

  const topChannel = channelEfficiency[0];
  const bottomChannel = channelEfficiency[channelEfficiency.length - 1];

  // If significant efficiency gap exists, suggest reallocation
  if (topChannel.efficiency > bottomChannel.efficiency * 2) {
    const shiftAmount = Math.min(bottomChannel.spend * 0.3, topChannel.spend * 0.5);

    recommendations.push({
      id: generateId(),
      type: 'budget-shift',
      severity: 'medium',
      title: `Shift budget from ${bottomChannel.channel} to ${topChannel.channel}`,
      summary: `${topChannel.channel} is ${(topChannel.efficiency / bottomChannel.efficiency).toFixed(1)}x more efficient than ${bottomChannel.channel}. Consider reallocating budget.`,
      impact: {
        estimatedVolumeGain: Math.round(shiftAmount * topChannel.efficiency),
        confidence: 'medium',
      },
      actions: [
        {
          type: 'decrease',
          target: bottomChannel.channel,
          currentValue: bottomChannel.spend,
          recommendedValue: bottomChannel.spend - shiftAmount,
          percentChange: -30,
          reason: 'Lower efficiency',
        },
        {
          type: 'increase',
          target: topChannel.channel,
          currentValue: topChannel.spend,
          recommendedValue: topChannel.spend + shiftAmount,
          percentChange: Math.round((shiftAmount / topChannel.spend) * 100),
          reason: 'Higher efficiency',
        },
      ],
      createdAt: new Date().toISOString(),
    });
  }

  return recommendations;
}

/**
 * Analyze creative performance for refresh triggers
 */
function analyzeCreativePerformance(
  kpi: MediaKpiSnapshot,
  history?: MediaKpiSnapshot[]
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  for (const [channel, metrics] of kpi.byChannel) {
    // Check CTR for display/social channels
    if (['display', 'social', 'youtube'].includes(channel)) {
      if (metrics.ctr !== null && metrics.ctr < DEFAULT_CONFIG.ctrRefreshThreshold) {
        recommendations.push({
          id: generateId(),
          type: 'creative-refresh',
          severity: 'medium',
          title: `Refresh ${channel} creative`,
          summary: `${channel} CTR (${(metrics.ctr * 100).toFixed(2)}%) is below threshold. Creative may be fatigued or underperforming.`,
          impact: {
            estimatedVolumeGain: Math.round((metrics.clicks || 0) * 0.2),
            confidence: 'medium',
          },
          actions: [
            {
              type: 'refresh',
              target: channel,
              reason: 'Low CTR indicates creative fatigue',
            },
          ],
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Check for CTR decline over time
    if (history && history.length >= 3) {
      const historicalCtrs = history
        .map(h => h.byChannel.get(channel)?.ctr)
        .filter((ctr): ctr is number => ctr !== null && ctr !== undefined);

      if (historicalCtrs.length >= 3 && metrics.ctr !== null) {
        const avgHistoricalCtr = historicalCtrs.reduce((a, b) => a + b, 0) / historicalCtrs.length;
        const ctrDrop = (avgHistoricalCtr - metrics.ctr) / avgHistoricalCtr;

        if (ctrDrop > 0.2) {
          recommendations.push({
            id: generateId(),
            type: 'creative-refresh',
            severity: 'high',
            title: `${channel} CTR declining`,
            summary: `${channel} CTR has dropped ${Math.round(ctrDrop * 100)}% vs historical average. Strong signal for creative refresh.`,
            impact: {
              estimatedVolumeGain: Math.round((metrics.clicks || 0) * ctrDrop),
              confidence: 'high',
            },
            actions: [
              {
                type: 'refresh',
                target: channel,
                reason: 'Significant CTR decline detected',
              },
            ],
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  return recommendations;
}

/**
 * Analyze store-level performance
 */
function analyzeStorePerformance(
  kpi: MediaKpiSnapshot,
  profile: MediaProfile
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  if (kpi.byStore.size < 2) return recommendations;

  // Calculate store performance metrics
  const storeMetrics: Array<{
    storeId: string;
    volume: number;
    spend: number;
    cpa: number | null;
  }> = [];

  for (const [storeId, metrics] of kpi.byStore) {
    const volume = metrics.leads + metrics.calls + metrics.installs;
    storeMetrics.push({
      storeId,
      volume,
      spend: metrics.spend,
      cpa: metrics.cpa,
    });
  }

  // Find underperforming stores
  const avgVolume = storeMetrics.reduce((sum, s) => sum + s.volume, 0) / storeMetrics.length;
  const avgCpa = storeMetrics
    .filter(s => s.cpa !== null)
    .reduce((sum, s) => sum + (s.cpa || 0), 0) / storeMetrics.filter(s => s.cpa !== null).length;

  for (const store of storeMetrics) {
    if (store.volume < avgVolume * 0.5 && store.spend > 0) {
      recommendations.push({
        id: generateId(),
        type: 'store-adjustment',
        severity: 'medium',
        title: `Review store ${store.storeId} performance`,
        summary: `Store ${store.storeId} is generating ${Math.round((1 - store.volume / avgVolume) * 100)}% less volume than average. Consider adjusting geo-targeting or store-specific campaigns.`,
        impact: {
          estimatedVolumeGain: Math.round(avgVolume - store.volume),
          confidence: 'low',
        },
        actions: [
          {
            type: 'contract',
            target: store.storeId,
            reason: 'Below-average performance',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }

    if (store.cpa !== null && store.cpa > avgCpa * 1.5) {
      recommendations.push({
        id: generateId(),
        type: 'store-adjustment',
        severity: 'high',
        title: `High CPA at store ${store.storeId}`,
        summary: `Store ${store.storeId} CPA ($${store.cpa.toFixed(2)}) is ${Math.round((store.cpa / avgCpa - 1) * 100)}% above average. Review local competition and targeting.`,
        impact: {
          estimatedCpaSavings: (store.cpa - avgCpa) * store.volume,
          confidence: 'medium',
        },
        actions: [
          {
            type: 'decrease',
            target: store.storeId,
            currentValue: store.spend,
            percentChange: -30,
            reason: 'High CPA vs other stores',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }
  }

  return recommendations;
}

/**
 * Analyze performance trends
 */
function analyzeTrends(
  current: MediaKpiSnapshot,
  history: MediaKpiSnapshot[]
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Calculate trend metrics
  const recentHistory = history.slice(-3);

  // Overall CPA trend
  const historicalCpas = recentHistory
    .map(h => h.cpa)
    .filter((cpa): cpa is number => cpa !== null);

  if (historicalCpas.length >= 2 && current.cpa !== null) {
    const avgHistoricalCpa = historicalCpas.reduce((a, b) => a + b, 0) / historicalCpas.length;
    const cpaTrend = (current.cpa - avgHistoricalCpa) / avgHistoricalCpa;

    if (cpaTrend > 0.2) {
      recommendations.push({
        id: generateId(),
        type: 'bid-adjustment',
        severity: 'high',
        title: 'Rising CPA trend detected',
        summary: `Overall CPA has increased ${Math.round(cpaTrend * 100)}% compared to recent history. Review bid strategies and targeting.`,
        impact: {
          estimatedCpaSavings: (current.cpa - avgHistoricalCpa) * (current.leads + current.calls),
          confidence: 'high',
        },
        actions: [
          {
            type: 'decrease',
            target: 'all-channels',
            percentChange: -10,
            reason: 'Rising CPA trend',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Volume trend
  const historicalVolumes = recentHistory.map(h => h.leads + h.calls + h.installs);
  const currentVolume = current.leads + current.calls + current.installs;

  if (historicalVolumes.length >= 2) {
    const avgHistoricalVolume = historicalVolumes.reduce((a, b) => a + b, 0) / historicalVolumes.length;
    const volumeTrend = (currentVolume - avgHistoricalVolume) / avgHistoricalVolume;

    if (volumeTrend < -0.2) {
      recommendations.push({
        id: generateId(),
        type: 'audience-expansion',
        severity: 'high',
        title: 'Declining volume trend',
        summary: `Lead/call volume has dropped ${Math.round(Math.abs(volumeTrend) * 100)}% compared to recent history. Consider expanding targeting or increasing spend.`,
        impact: {
          estimatedVolumeGain: Math.round(avgHistoricalVolume - currentVolume),
          confidence: 'medium',
        },
        actions: [
          {
            type: 'expand',
            target: 'audience',
            reason: 'Declining volume trend',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }
  }

  return recommendations;
}

/**
 * Process existing insights into optimization recommendations
 */
function processInsights(insights: MediaInsight[]): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  for (const insight of insights) {
    // Skip info-level insights
    if (insight.severity === 'info') continue;

    // Map insight types to optimization types
    const typeMapping: Record<string, OptimizationType> = {
      underperforming_channel: 'budget-shift',
      store_dropoff: 'store-adjustment',
      spend_spike: 'budget-shift',
      spend_underspend: 'increase-channel',
      cpl_increase: 'bid-adjustment',
      low_impressions: 'audience-expansion',
      high_cpc: 'bid-adjustment',
    };

    const optType = typeMapping[insight.type];
    if (!optType) continue;

    recommendations.push({
      id: generateId(),
      type: optType,
      severity: insight.severity === 'critical' ? 'critical' : insight.severity === 'warning' ? 'high' : 'medium',
      title: insight.title,
      summary: insight.description,
      impact: {
        confidence: 'medium',
      },
      actions: [
        {
          type: insight.severity === 'critical' ? 'decrease' : 'shift',
          target: insight.channel || insight.storeId || 'program',
          reason: insight.recommendation || 'Based on alert analysis',
        },
      ],
      relatedInsightIds: [insight.id],
      createdAt: new Date().toISOString(),
    });
  }

  return recommendations;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sortRecommendations(recs: OptimizationRecommendation[]): OptimizationRecommendation[] {
  const severityOrder: Record<OptimizationSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const confidenceOrder: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return recs.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return confidenceOrder[a.impact.confidence] - confidenceOrder[b.impact.confidence];
  });
}

/**
 * Get optimization summary
 */
export function getOptimizationSummary(
  recommendations: OptimizationRecommendation[]
): OptimizationSummary {
  const bySeverity: Record<OptimizationSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  let estimatedSavings = 0;

  for (const rec of recommendations) {
    bySeverity[rec.severity]++;
    if (rec.impact.estimatedCpaSavings) {
      estimatedSavings += rec.impact.estimatedCpaSavings;
    }
  }

  return {
    totalRecommendations: recommendations.length,
    bySeverity,
    estimatedSavings: Math.round(estimatedSavings),
    topPriority: recommendations.length > 0 ? recommendations[0] : null,
  };
}

/**
 * Create work item suggestions from recommendations
 */
export function createWorkItemSuggestions(
  recommendations: OptimizationRecommendation[]
): Array<{
  title: string;
  area: string;
  severity: string;
  notes: string;
}> {
  return recommendations
    .filter(rec => rec.severity === 'critical' || rec.severity === 'high')
    .map(rec => ({
      title: rec.title,
      area: 'Media',
      severity: rec.severity === 'critical' ? 'Critical' : 'High',
      notes: `${rec.summary}\n\nActions:\n${rec.actions.map(a => `- ${a.type}: ${a.target} (${a.reason})`).join('\n')}`,
    }));
}
