// lib/media/mediaMemory.ts
// Media Memory - Long-Term Learning Layer
//
// Tracks and learns from media performance over time:
// - Top/weak performing channels
// - Winning/losing creative themes
// - Baseline CPA adjustments
// - Seasonal patterns
//
// Memory feeds back into AI Planner, Creative Lab, and Optimization Engine
// to create a brand-specific intelligence loop.

import type { MediaCockpitSnapshot, MediaKpiSnapshot } from './cockpit';
import type { MediaInsight } from './alerts';
import type { CreativeBrief } from './creativeLab';

// ============================================================================
// Types
// ============================================================================

export interface ChannelPerformanceMemory {
  channel: string;
  avgCpa: number;
  avgCtr: number;
  totalSpend: number;
  totalVolume: number;
  trend: 'improving' | 'stable' | 'declining';
  confidenceLevel: 'low' | 'medium' | 'high';
}

export interface CreativeThemeMemory {
  theme: string;
  objective: string;
  channels: string[];
  performance: 'winning' | 'losing' | 'neutral';
  usageCount: number;
  avgCtrLift?: number;
  avgCpaImpact?: number;
  lastUsed: string;
}

export interface SeasonalPatternMemory {
  month: string;
  historicalMultiplier: number;
  channelVariance: Record<string, number>;
  confidence: 'low' | 'medium' | 'high';
}

export interface MediaMemoryEntry {
  id: string;
  companyId: string;
  period: string; // e.g., "2025-Q1", "2025-01"
  periodType: 'monthly' | 'quarterly' | 'annual';

  // Channel performance
  topPerformingChannels: ChannelPerformanceMemory[];
  weakChannels: ChannelPerformanceMemory[];

  // Creative insights
  winningCreativeThemes: CreativeThemeMemory[];
  losingCreativeThemes: CreativeThemeMemory[];

  // Adjustments
  baselineAdjustments: Record<string, number>; // channel → multiplier
  seasonalPatterns?: SeasonalPatternMemory[];

  // Aggregate metrics
  aggregateMetrics: {
    totalSpend: number;
    totalVolume: number;
    avgCpa: number;
    avgCtr: number;
    topChannel: string;
    weakestChannel: string;
  };

  // Insights summary
  keyLearnings: string[];
  recommendations: string[];

  // Metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaMemoryContext {
  recentEntries: MediaMemoryEntry[];
  channelTrends: Map<string, 'improving' | 'stable' | 'declining'>;
  baselineMultipliers: Record<string, number>;
  winningThemes: string[];
  losingThemes: string[];
}

// ============================================================================
// Memory Update Functions
// ============================================================================

/**
 * Update media memory based on current performance data
 */
export async function updateMediaMemory(params: {
  companyId: string;
  snapshot: MediaCockpitSnapshot;
  history?: MediaCockpitSnapshot[];
  insights?: MediaInsight[];
  creativeBriefs?: CreativeBrief[];
  period?: string;
}): Promise<MediaMemoryEntry> {
  const {
    companyId,
    snapshot,
    history,
    insights,
    creativeBriefs,
    period,
  } = params;

  const now = new Date();
  const periodStr = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Analyze channel performance
  const { topChannels, weakChannels } = analyzeChannelPerformance(
    snapshot.kpiSnapshot,
    history?.map(h => h.kpiSnapshot)
  );

  // Analyze creative themes
  const { winningThemes, losingThemes } = analyzeCreativeThemes(
    creativeBriefs,
    snapshot.kpiSnapshot
  );

  // Calculate baseline adjustments
  const baselineAdjustments = calculateBaselineAdjustments(
    snapshot.kpiSnapshot,
    history?.map(h => h.kpiSnapshot)
  );

  // Generate key learnings
  const keyLearnings = generateKeyLearnings(
    topChannels,
    weakChannels,
    winningThemes,
    losingThemes,
    insights
  );

  // Generate recommendations
  const recommendations = generateMemoryRecommendations(
    topChannels,
    weakChannels,
    baselineAdjustments
  );

  // Calculate aggregate metrics
  const kpi = snapshot.kpiSnapshot;
  const volume = kpi.leads + kpi.calls + kpi.installs;

  const entry: MediaMemoryEntry = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyId,
    period: periodStr,
    periodType: 'monthly',
    topPerformingChannels: topChannels,
    weakChannels,
    winningCreativeThemes: winningThemes,
    losingCreativeThemes: losingThemes,
    baselineAdjustments,
    aggregateMetrics: {
      totalSpend: kpi.spend,
      totalVolume: volume,
      avgCpa: kpi.cpa || 0,
      avgCtr: kpi.ctr || 0,
      topChannel: topChannels[0]?.channel || 'none',
      weakestChannel: weakChannels[0]?.channel || 'none',
    },
    keyLearnings,
    recommendations,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // TODO: Save to Airtable MediaMemory table
  // await saveMediaMemoryToAirtable(entry);

  return entry;
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyze channel performance to identify top and weak performers
 */
function analyzeChannelPerformance(
  kpi: MediaKpiSnapshot,
  history?: MediaKpiSnapshot[]
): {
  topChannels: ChannelPerformanceMemory[];
  weakChannels: ChannelPerformanceMemory[];
} {
  const channelMetrics: Map<string, {
    cpas: number[];
    ctrs: number[];
    spends: number[];
    volumes: number[];
  }> = new Map();

  // Aggregate current data
  for (const [channel, metrics] of kpi.byChannel) {
    const data = channelMetrics.get(channel) || { cpas: [], ctrs: [], spends: [], volumes: [] };
    if (metrics.cpa !== null) data.cpas.push(metrics.cpa);
    if (metrics.ctr !== null) data.ctrs.push(metrics.ctr);
    data.spends.push(metrics.spend);
    data.volumes.push(metrics.leads + metrics.calls + metrics.installs);
    channelMetrics.set(channel, data);
  }

  // Add historical data
  if (history) {
    for (const snapshot of history) {
      for (const [channel, metrics] of snapshot.byChannel) {
        const data = channelMetrics.get(channel) || { cpas: [], ctrs: [], spends: [], volumes: [] };
        if (metrics.cpa !== null) data.cpas.push(metrics.cpa);
        if (metrics.ctr !== null) data.ctrs.push(metrics.ctr);
        data.spends.push(metrics.spend);
        data.volumes.push(metrics.leads + metrics.calls + metrics.installs);
        channelMetrics.set(channel, data);
      }
    }
  }

  // Calculate averages and trends
  const channelMemories: ChannelPerformanceMemory[] = [];

  for (const [channel, data] of channelMetrics) {
    if (data.cpas.length === 0) continue;

    const avgCpa = data.cpas.reduce((a, b) => a + b, 0) / data.cpas.length;
    const avgCtr = data.ctrs.length > 0
      ? data.ctrs.reduce((a, b) => a + b, 0) / data.ctrs.length
      : 0;
    const totalSpend = data.spends.reduce((a, b) => a + b, 0);
    const totalVolume = data.volumes.reduce((a, b) => a + b, 0);

    // Calculate trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (data.cpas.length >= 3) {
      const recentAvg = data.cpas.slice(-2).reduce((a, b) => a + b, 0) / 2;
      const olderAvg = data.cpas.slice(0, -2).reduce((a, b) => a + b, 0) / Math.max(1, data.cpas.length - 2);
      const change = (recentAvg - olderAvg) / olderAvg;

      if (change < -0.1) trend = 'improving'; // CPA decreasing is good
      else if (change > 0.1) trend = 'declining';
    }

    channelMemories.push({
      channel,
      avgCpa,
      avgCtr,
      totalSpend,
      totalVolume,
      trend,
      confidenceLevel: data.cpas.length >= 5 ? 'high' : data.cpas.length >= 3 ? 'medium' : 'low',
    });
  }

  // Sort by efficiency (volume / spend)
  const sorted = [...channelMemories].sort((a, b) => {
    const effA = a.totalSpend > 0 ? a.totalVolume / a.totalSpend : 0;
    const effB = b.totalSpend > 0 ? b.totalVolume / b.totalSpend : 0;
    return effB - effA;
  });

  const midpoint = Math.ceil(sorted.length / 2);

  return {
    topChannels: sorted.slice(0, midpoint),
    weakChannels: sorted.slice(midpoint).reverse(),
  };
}

/**
 * Analyze creative themes from briefs and performance
 */
function analyzeCreativeThemes(
  briefs?: CreativeBrief[],
  _kpi?: MediaKpiSnapshot
): {
  winningThemes: CreativeThemeMemory[];
  losingThemes: CreativeThemeMemory[];
} {
  if (!briefs || briefs.length === 0) {
    return { winningThemes: [], losingThemes: [] };
  }

  const themeMap: Map<string, {
    usages: number;
    channels: Set<string>;
    objectives: Set<string>;
  }> = new Map();

  // Aggregate theme usage
  for (const brief of briefs) {
    const theme = brief.package.overallTheme;
    const data = themeMap.get(theme) || {
      usages: 0,
      channels: new Set(),
      objectives: new Set(),
    };

    data.usages++;
    data.objectives.add(brief.objective);
    brief.channels.forEach(ch => data.channels.add(ch));
    themeMap.set(theme, data);
  }

  // Convert to memory entries
  // TODO: Correlate with actual performance data
  const themes: CreativeThemeMemory[] = [];

  for (const [theme, data] of themeMap) {
    themes.push({
      theme,
      objective: Array.from(data.objectives)[0] || 'conversion',
      channels: Array.from(data.channels),
      performance: 'neutral', // Would be determined by actual performance correlation
      usageCount: data.usages,
      lastUsed: new Date().toISOString(),
    });
  }

  // For MVP, split arbitrarily - in production this would use performance correlation
  const midpoint = Math.ceil(themes.length / 2);

  return {
    winningThemes: themes.slice(0, midpoint).map(t => ({ ...t, performance: 'winning' as const })),
    losingThemes: themes.slice(midpoint).map(t => ({ ...t, performance: 'losing' as const })),
  };
}

/**
 * Calculate baseline CPA adjustments based on performance
 */
function calculateBaselineAdjustments(
  kpi: MediaKpiSnapshot,
  _history?: MediaKpiSnapshot[]
): Record<string, number> {
  const adjustments: Record<string, number> = {};

  // Calculate overall average CPA
  const allCpas: number[] = [];
  for (const [, metrics] of kpi.byChannel) {
    if (metrics.cpa !== null) allCpas.push(metrics.cpa);
  }

  if (allCpas.length === 0) return adjustments;

  const overallAvgCpa = allCpas.reduce((a, b) => a + b, 0) / allCpas.length;

  // Calculate per-channel multiplier
  for (const [channel, metrics] of kpi.byChannel) {
    if (metrics.cpa === null || metrics.spend < 100) continue;

    // Multiplier > 1 means channel is more expensive than average
    const multiplier = metrics.cpa / overallAvgCpa;
    adjustments[channel] = Math.round(multiplier * 100) / 100;
  }

  return adjustments;
}

// ============================================================================
// Learning Generation
// ============================================================================

/**
 * Generate key learnings from analysis
 */
function generateKeyLearnings(
  topChannels: ChannelPerformanceMemory[],
  weakChannels: ChannelPerformanceMemory[],
  winningThemes: CreativeThemeMemory[],
  losingThemes: CreativeThemeMemory[],
  insights?: MediaInsight[]
): string[] {
  const learnings: string[] = [];

  // Channel learnings
  if (topChannels.length > 0) {
    const top = topChannels[0];
    learnings.push(
      `${top.channel} is the top performer with ${top.avgCpa.toFixed(2)} CPA and ${top.trend} trend`
    );
  }

  if (weakChannels.length > 0) {
    const weak = weakChannels[0];
    learnings.push(
      `${weak.channel} underperforms with ${weak.avgCpa.toFixed(2)} CPA - consider optimization or budget shift`
    );
  }

  // Trend learnings
  const improvingChannels = topChannels.filter(c => c.trend === 'improving');
  if (improvingChannels.length > 0) {
    learnings.push(
      `Improving channels: ${improvingChannels.map(c => c.channel).join(', ')}`
    );
  }

  const decliningChannels = [...topChannels, ...weakChannels].filter(c => c.trend === 'declining');
  if (decliningChannels.length > 0) {
    learnings.push(
      `Declining channels need attention: ${decliningChannels.map(c => c.channel).join(', ')}`
    );
  }

  // Creative learnings
  if (winningThemes.length > 0) {
    learnings.push(
      `Winning creative themes: ${winningThemes.map(t => t.theme).slice(0, 2).join(', ')}`
    );
  }

  // Insight-based learnings
  if (insights && insights.length > 0) {
    const criticalInsights = insights.filter(i => i.severity === 'critical');
    if (criticalInsights.length > 0) {
      learnings.push(
        `${criticalInsights.length} critical issues identified requiring immediate attention`
      );
    }
  }

  return learnings;
}

/**
 * Generate recommendations based on memory analysis
 */
function generateMemoryRecommendations(
  topChannels: ChannelPerformanceMemory[],
  weakChannels: ChannelPerformanceMemory[],
  baselineAdjustments: Record<string, number>
): string[] {
  const recommendations: string[] = [];

  // Budget allocation
  if (topChannels.length > 0 && weakChannels.length > 0) {
    const top = topChannels[0];
    const weak = weakChannels[0];

    if (baselineAdjustments[weak.channel] > 1.3) {
      recommendations.push(
        `Shift budget from ${weak.channel} (${Math.round((baselineAdjustments[weak.channel] - 1) * 100)}% above avg CPA) to ${top.channel}`
      );
    }
  }

  // Scaling recommendations
  const scalableChannels = topChannels.filter(
    c => c.trend !== 'declining' && c.confidenceLevel !== 'low'
  );
  if (scalableChannels.length > 0) {
    recommendations.push(
      `Consider scaling: ${scalableChannels.map(c => c.channel).join(', ')}`
    );
  }

  // Creative recommendations
  const staleChannels = [...topChannels, ...weakChannels].filter(
    c => c.trend === 'declining' && c.avgCtr < 0.02
  );
  if (staleChannels.length > 0) {
    recommendations.push(
      `Creative refresh needed for: ${staleChannels.map(c => c.channel).join(', ')}`
    );
  }

  return recommendations;
}

// ============================================================================
// Memory Query Functions
// ============================================================================

/**
 * Get memory context for planning
 */
export async function getMediaMemoryContext(
  companyId: string,
  _lookbackPeriods: number = 6
): Promise<MediaMemoryContext> {
  // TODO: Fetch from Airtable
  // const entries = await getMediaMemoryEntries(companyId, lookbackPeriods);

  // For now, return empty context
  return {
    recentEntries: [],
    channelTrends: new Map(),
    baselineMultipliers: {},
    winningThemes: [],
    losingThemes: [],
  };
}

/**
 * Get channel recommendation based on memory
 */
export function getChannelRecommendationFromMemory(
  memory: MediaMemoryContext,
  channel: string
): {
  recommendation: 'scale' | 'maintain' | 'optimize' | 'reduce';
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
} {
  const trend = memory.channelTrends.get(channel);
  const multiplier = memory.baselineMultipliers[channel];

  if (!trend && !multiplier) {
    return {
      recommendation: 'maintain',
      confidence: 'low',
      reasoning: 'Insufficient historical data for this channel',
    };
  }

  if (trend === 'improving' && (!multiplier || multiplier <= 1)) {
    return {
      recommendation: 'scale',
      confidence: 'high',
      reasoning: 'Channel showing improving trend with competitive CPA',
    };
  }

  if (trend === 'declining' || (multiplier && multiplier > 1.3)) {
    return {
      recommendation: multiplier && multiplier > 1.5 ? 'reduce' : 'optimize',
      confidence: 'medium',
      reasoning: trend === 'declining'
        ? 'Channel performance declining over time'
        : 'CPA significantly above average',
    };
  }

  return {
    recommendation: 'maintain',
    confidence: 'medium',
    reasoning: 'Channel performing at expected levels',
  };
}

/**
 * Get creative theme recommendation based on memory
 */
export function getCreativeThemeRecommendation(
  memory: MediaMemoryContext,
  _objective: string
): {
  recommendedThemes: string[];
  avoidThemes: string[];
} {
  return {
    recommendedThemes: memory.winningThemes.slice(0, 3),
    avoidThemes: memory.losingThemes.slice(0, 2),
  };
}

// ============================================================================
// Airtable Integration (Stubs)
// ============================================================================

/**
 * Save memory entry to Airtable
 * TODO: Implement with actual Airtable integration
 */
async function _saveMediaMemoryToAirtable(entry: MediaMemoryEntry): Promise<void> {
  console.log('[MediaMemory] Would save entry:', entry.id, entry.period);
  // Implementation will use getBase() and create record in MediaMemory table
}

/**
 * Get memory entries from Airtable
 * TODO: Implement with actual Airtable integration
 */
async function _getMediaMemoryEntries(
  companyId: string,
  limit: number
): Promise<MediaMemoryEntry[]> {
  console.log('[MediaMemory] Would fetch entries for:', companyId, 'limit:', limit);
  // Implementation will query MediaMemory table
  return [];
}
