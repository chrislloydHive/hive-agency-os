// lib/autopilot/signalMonitor.ts
// Phase 5: Signal Monitor
//
// Real-time watchdog service that continuously monitors performance anomalies
// and generates alerts for: CPA spikes, CTR collapse, tracking failures,
// budget exhaustion, seasonal anomalies, and more.

import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  Signal,
  SignalType,
  SignalSeverity,
  SignalCategory,
  AlertConfig,
  SignalThresholds,
} from './types';

// ============================================================================
// Default Thresholds
// ============================================================================

const DEFAULT_THRESHOLDS: SignalThresholds = {
  cpa_spike: {
    warning: 20, // 20% increase
    critical: 50, // 50% increase
    lookbackDays: 7,
  },
  ctr_collapse: {
    warning: 15, // 15% decrease
    critical: 30, // 30% decrease
    lookbackDays: 7,
  },
  conversion_drop: {
    warning: 20,
    critical: 40,
    lookbackDays: 7,
  },
  budget_exhaustion: {
    warning: 80, // 80% spent
    critical: 95, // 95% spent
    lookbackDays: 30,
  },
  roas_decline: {
    warning: 15,
    critical: 30,
    lookbackDays: 14,
  },
  tracking_failure: {
    warning: 5, // 5% discrepancy
    critical: 15, // 15% discrepancy
    lookbackDays: 3,
  },
  seasonal_anomaly: {
    warning: 25,
    critical: 50,
    lookbackDays: 365,
  },
  competitive_threat: {
    warning: 10, // 10% impression share loss
    critical: 25, // 25% impression share loss
    lookbackDays: 14,
  },
  negative_roi: {
    warning: 0, // Break-even
    critical: -20, // 20% negative
    lookbackDays: 7,
  },
  quality_score_drop: {
    warning: 1, // 1 point drop
    critical: 2, // 2 point drop
    lookbackDays: 14,
  },
};

// ============================================================================
// Signal Store (In-Memory)
// ============================================================================

const activeSignals = new Map<string, Signal[]>();
const signalHistory = new Map<string, Signal[]>();
const alertConfigs = new Map<string, AlertConfig>();

// ============================================================================
// Signal Detection Functions
// ============================================================================

/**
 * Run full signal monitoring scan for a company
 */
export function runSignalScan(
  companyId: string,
  graph: CompanyContextGraph,
  performanceData?: PerformanceSnapshot,
  customThresholds?: Partial<SignalThresholds>
): Signal[] {
  // Unused variable but keeping for future custom threshold support
  const _customThresholds = customThresholds;
  const signals: Signal[] = [];
  const now = new Date().toISOString();

  // Performance-based signals
  if (performanceData) {
    signals.push(...detectCPASpike(companyId, performanceData, DEFAULT_THRESHOLDS, now));
    signals.push(...detectCTRCollapse(companyId, performanceData, DEFAULT_THRESHOLDS, now));
    signals.push(...detectConversionDrop(companyId, performanceData, DEFAULT_THRESHOLDS, now));
    signals.push(...detectROASDecline(companyId, performanceData, DEFAULT_THRESHOLDS, now));
    signals.push(...detectNegativeROI(companyId, performanceData, DEFAULT_THRESHOLDS, now));
    signals.push(...detectBudgetExhaustion(companyId, performanceData, DEFAULT_THRESHOLDS, now));
    signals.push(...detectTrackingFailure(companyId, performanceData, DEFAULT_THRESHOLDS, now));
    signals.push(...detectQualityScoreDrop(companyId, performanceData, DEFAULT_THRESHOLDS, now));
    signals.push(...detectCompetitiveThreat(companyId, performanceData, DEFAULT_THRESHOLDS, now));
  }

  // Context Graph-based signals
  signals.push(...detectSeasonalAnomaly(companyId, graph, DEFAULT_THRESHOLDS, now));
  signals.push(...detectContextGaps(companyId, graph, now));
  signals.push(...detectStrategyMisalignment(companyId, graph, now));

  // Store active signals
  const criticalAndWarning = signals.filter(s => s.severity !== 'info');
  activeSignals.set(companyId, criticalAndWarning);

  // Add to history
  const history = signalHistory.get(companyId) || [];
  history.push(...signals);
  // Keep last 1000 signals
  if (history.length > 1000) {
    signalHistory.set(companyId, history.slice(-1000));
  } else {
    signalHistory.set(companyId, history);
  }

  return signals;
}

// ============================================================================
// Individual Signal Detectors
// ============================================================================

interface PerformanceSnapshot {
  current: PerformancePeriod;
  previous: PerformancePeriod;
  channels?: Record<string, ChannelPerformance>;
  yearOverYear?: PerformancePeriod;
}

interface PerformancePeriod {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cpa: number;
  ctr: number;
  roas: number;
  cpc: number;
}

interface ChannelPerformance extends PerformancePeriod {
  channel: string;
  impressionShare?: number;
  qualityScore?: number;
  budgetUtilization?: number;
  trackingDiscrepancy?: number;
}

function detectCPASpike(
  companyId: string,
  data: PerformanceSnapshot,
  thresholds: SignalThresholds,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];
  const threshold = thresholds.cpa_spike;

  const change = data.previous.cpa > 0
    ? ((data.current.cpa - data.previous.cpa) / data.previous.cpa) * 100
    : 0;

  if (change >= threshold.critical) {
    signals.push({
      id: `signal_cpa_${Date.now()}`,
      companyId,
      type: 'cpa_spike',
      category: 'performance',
      severity: 'critical',
      title: 'Critical CPA Spike Detected',
      description: `CPA increased by ${change.toFixed(1)}% from $${data.previous.cpa.toFixed(2)} to $${data.current.cpa.toFixed(2)}`,
      metric: 'cpa',
      currentValue: data.current.cpa,
      previousValue: data.previous.cpa,
      changePercent: change,
      threshold: threshold.critical,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Review recent campaign changes',
        'Check for audience saturation',
        'Analyze creative performance',
        'Review bid strategy settings',
      ],
    });
  } else if (change >= threshold.warning) {
    signals.push({
      id: `signal_cpa_${Date.now()}`,
      companyId,
      type: 'cpa_spike',
      category: 'performance',
      severity: 'warning',
      title: 'CPA Increase Warning',
      description: `CPA increased by ${change.toFixed(1)}% from $${data.previous.cpa.toFixed(2)} to $${data.current.cpa.toFixed(2)}`,
      metric: 'cpa',
      currentValue: data.current.cpa,
      previousValue: data.previous.cpa,
      changePercent: change,
      threshold: threshold.warning,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Monitor CPA trend over next 48 hours',
        'Review recent targeting changes',
      ],
    });
  }

  return signals;
}

function detectCTRCollapse(
  companyId: string,
  data: PerformanceSnapshot,
  thresholds: SignalThresholds,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];
  const threshold = thresholds.ctr_collapse;

  const change = data.previous.ctr > 0
    ? ((data.current.ctr - data.previous.ctr) / data.previous.ctr) * 100
    : 0;

  // CTR collapse is a decrease, so we check for negative change
  if (change <= -threshold.critical) {
    signals.push({
      id: `signal_ctr_${Date.now()}`,
      companyId,
      type: 'ctr_collapse',
      category: 'performance',
      severity: 'critical',
      title: 'Critical CTR Collapse',
      description: `CTR dropped by ${Math.abs(change).toFixed(1)}% from ${(data.previous.ctr * 100).toFixed(2)}% to ${(data.current.ctr * 100).toFixed(2)}%`,
      metric: 'ctr',
      currentValue: data.current.ctr,
      previousValue: data.previous.ctr,
      changePercent: change,
      threshold: -threshold.critical,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Check for creative fatigue',
        'Review ad relevance scores',
        'Analyze competitor activity',
        'Consider creative refresh',
      ],
    });
  } else if (change <= -threshold.warning) {
    signals.push({
      id: `signal_ctr_${Date.now()}`,
      companyId,
      type: 'ctr_collapse',
      category: 'performance',
      severity: 'warning',
      title: 'CTR Decline Warning',
      description: `CTR dropped by ${Math.abs(change).toFixed(1)}% from ${(data.previous.ctr * 100).toFixed(2)}% to ${(data.current.ctr * 100).toFixed(2)}%`,
      metric: 'ctr',
      currentValue: data.current.ctr,
      previousValue: data.previous.ctr,
      changePercent: change,
      threshold: -threshold.warning,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Monitor creative performance',
        'Review audience targeting',
      ],
    });
  }

  return signals;
}

function detectConversionDrop(
  companyId: string,
  data: PerformanceSnapshot,
  thresholds: SignalThresholds,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];
  const threshold = thresholds.conversion_drop;

  const change = data.previous.conversions > 0
    ? ((data.current.conversions - data.previous.conversions) / data.previous.conversions) * 100
    : 0;

  if (change <= -threshold.critical) {
    signals.push({
      id: `signal_conv_${Date.now()}`,
      companyId,
      type: 'conversion_drop',
      category: 'performance',
      severity: 'critical',
      title: 'Critical Conversion Drop',
      description: `Conversions dropped by ${Math.abs(change).toFixed(1)}% from ${data.previous.conversions} to ${data.current.conversions}`,
      metric: 'conversions',
      currentValue: data.current.conversions,
      previousValue: data.previous.conversions,
      changePercent: change,
      threshold: -threshold.critical,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Check landing page functionality',
        'Review conversion tracking setup',
        'Analyze funnel drop-off points',
        'Verify tracking pixels are firing',
      ],
    });
  } else if (change <= -threshold.warning) {
    signals.push({
      id: `signal_conv_${Date.now()}`,
      companyId,
      type: 'conversion_drop',
      category: 'performance',
      severity: 'warning',
      title: 'Conversion Decline Warning',
      description: `Conversions dropped by ${Math.abs(change).toFixed(1)}% from ${data.previous.conversions} to ${data.current.conversions}`,
      metric: 'conversions',
      currentValue: data.current.conversions,
      previousValue: data.previous.conversions,
      changePercent: change,
      threshold: -threshold.warning,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Monitor conversion trend',
        'Review recent campaign changes',
      ],
    });
  }

  return signals;
}

function detectROASDecline(
  companyId: string,
  data: PerformanceSnapshot,
  thresholds: SignalThresholds,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];
  const threshold = thresholds.roas_decline;

  const change = data.previous.roas > 0
    ? ((data.current.roas - data.previous.roas) / data.previous.roas) * 100
    : 0;

  if (change <= -threshold.critical) {
    signals.push({
      id: `signal_roas_${Date.now()}`,
      companyId,
      type: 'roas_decline',
      category: 'performance',
      severity: 'critical',
      title: 'Critical ROAS Decline',
      description: `ROAS dropped by ${Math.abs(change).toFixed(1)}% from ${data.previous.roas.toFixed(2)}x to ${data.current.roas.toFixed(2)}x`,
      metric: 'roas',
      currentValue: data.current.roas,
      previousValue: data.previous.roas,
      changePercent: change,
      threshold: -threshold.critical,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Review revenue attribution',
        'Analyze channel efficiency',
        'Consider budget reallocation',
        'Review bid strategies',
      ],
    });
  } else if (change <= -threshold.warning) {
    signals.push({
      id: `signal_roas_${Date.now()}`,
      companyId,
      type: 'roas_decline',
      category: 'performance',
      severity: 'warning',
      title: 'ROAS Decline Warning',
      description: `ROAS dropped by ${Math.abs(change).toFixed(1)}% from ${data.previous.roas.toFixed(2)}x to ${data.current.roas.toFixed(2)}x`,
      metric: 'roas',
      currentValue: data.current.roas,
      previousValue: data.previous.roas,
      changePercent: change,
      threshold: -threshold.warning,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Monitor ROAS trend',
        'Review campaign performance by channel',
      ],
    });
  }

  return signals;
}

function detectNegativeROI(
  companyId: string,
  data: PerformanceSnapshot,
  thresholds: SignalThresholds,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];
  const threshold = thresholds.negative_roi;

  const roi = data.current.spend > 0
    ? ((data.current.revenue - data.current.spend) / data.current.spend) * 100
    : 0;

  if (roi <= threshold.critical) {
    signals.push({
      id: `signal_roi_${Date.now()}`,
      companyId,
      type: 'negative_roi',
      category: 'financial',
      severity: 'critical',
      title: 'Critical Negative ROI',
      description: `ROI is ${roi.toFixed(1)}% - spending $${data.current.spend.toFixed(0)} to generate $${data.current.revenue.toFixed(0)} revenue`,
      metric: 'roi',
      currentValue: roi,
      previousValue: 0,
      changePercent: roi,
      threshold: threshold.critical,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Consider pausing underperforming campaigns',
        'Review channel ROI breakdown',
        'Analyze cost structure',
        'Evaluate pricing strategy',
      ],
    });
  } else if (roi <= threshold.warning) {
    signals.push({
      id: `signal_roi_${Date.now()}`,
      companyId,
      type: 'negative_roi',
      category: 'financial',
      severity: 'warning',
      title: 'Break-even ROI Warning',
      description: `ROI is at break-even (${roi.toFixed(1)}%) - monitor closely`,
      metric: 'roi',
      currentValue: roi,
      previousValue: 0,
      changePercent: roi,
      threshold: threshold.warning,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Review campaign efficiency',
        'Identify optimization opportunities',
      ],
    });
  }

  return signals;
}

function detectBudgetExhaustion(
  companyId: string,
  data: PerformanceSnapshot,
  thresholds: SignalThresholds,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];

  if (!data.channels) return signals;

  for (const [channelName, channelData] of Object.entries(data.channels)) {
    const utilization = channelData.budgetUtilization || 0;
    const threshold = thresholds.budget_exhaustion;

    if (utilization >= threshold.critical) {
      signals.push({
        id: `signal_budget_${channelName}_${Date.now()}`,
        companyId,
        type: 'budget_exhaustion',
        category: 'budget',
        severity: 'critical',
        title: `Budget Nearly Exhausted: ${channelName}`,
        description: `${channelName} has used ${utilization.toFixed(0)}% of monthly budget`,
        metric: 'budget_utilization',
        currentValue: utilization,
        previousValue: 0,
        changePercent: 0,
        threshold: threshold.critical,
        channel: channelName,
        detectedAt: timestamp,
        status: 'active',
        suggestedActions: [
          `Review ${channelName} budget allocation`,
          'Consider budget reallocation from other channels',
          'Evaluate campaign pacing settings',
        ],
      });
    } else if (utilization >= threshold.warning) {
      signals.push({
        id: `signal_budget_${channelName}_${Date.now()}`,
        companyId,
        type: 'budget_exhaustion',
        category: 'budget',
        severity: 'warning',
        title: `High Budget Utilization: ${channelName}`,
        description: `${channelName} has used ${utilization.toFixed(0)}% of monthly budget`,
        metric: 'budget_utilization',
        currentValue: utilization,
        previousValue: 0,
        changePercent: 0,
        threshold: threshold.warning,
        channel: channelName,
        detectedAt: timestamp,
        status: 'active',
        suggestedActions: [
          `Monitor ${channelName} spend rate`,
          'Plan for potential budget increase',
        ],
      });
    }
  }

  return signals;
}

function detectTrackingFailure(
  companyId: string,
  data: PerformanceSnapshot,
  thresholds: SignalThresholds,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];

  if (!data.channels) return signals;

  for (const [channelName, channelData] of Object.entries(data.channels)) {
    const discrepancy = channelData.trackingDiscrepancy || 0;
    const threshold = thresholds.tracking_failure;

    if (Math.abs(discrepancy) >= threshold.critical) {
      signals.push({
        id: `signal_tracking_${channelName}_${Date.now()}`,
        companyId,
        type: 'tracking_failure',
        category: 'technical',
        severity: 'critical',
        title: `Tracking Discrepancy: ${channelName}`,
        description: `${channelName} shows ${discrepancy.toFixed(1)}% discrepancy between platform and analytics`,
        metric: 'tracking_discrepancy',
        currentValue: discrepancy,
        previousValue: 0,
        changePercent: 0,
        threshold: threshold.critical,
        channel: channelName,
        detectedAt: timestamp,
        status: 'active',
        suggestedActions: [
          'Verify tracking pixel implementation',
          'Check conversion tag configuration',
          'Review attribution settings',
          'Test conversion tracking',
        ],
      });
    } else if (Math.abs(discrepancy) >= threshold.warning) {
      signals.push({
        id: `signal_tracking_${channelName}_${Date.now()}`,
        companyId,
        type: 'tracking_failure',
        category: 'technical',
        severity: 'warning',
        title: `Tracking Variance: ${channelName}`,
        description: `${channelName} shows ${discrepancy.toFixed(1)}% variance between platform and analytics`,
        metric: 'tracking_discrepancy',
        currentValue: discrepancy,
        previousValue: 0,
        changePercent: 0,
        threshold: threshold.warning,
        channel: channelName,
        detectedAt: timestamp,
        status: 'active',
        suggestedActions: [
          'Monitor tracking discrepancy',
          'Review attribution window settings',
        ],
      });
    }
  }

  return signals;
}

function detectQualityScoreDrop(
  companyId: string,
  data: PerformanceSnapshot,
  thresholds: SignalThresholds,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];

  if (!data.channels) return signals;

  // Only applicable to channels with quality scores (primarily Google Ads)
  const googleData = data.channels['google_ads'];
  if (!googleData?.qualityScore) return signals;

  const threshold = thresholds.quality_score_drop;
  const previousQS = 7; // Baseline assumption, would normally come from historical data
  const currentQS = googleData.qualityScore;
  const drop = previousQS - currentQS;

  if (drop >= threshold.critical) {
    signals.push({
      id: `signal_qs_${Date.now()}`,
      companyId,
      type: 'quality_score_drop',
      category: 'performance',
      severity: 'critical',
      title: 'Quality Score Drop',
      description: `Average Quality Score dropped to ${currentQS}/10 (down ${drop} points)`,
      metric: 'quality_score',
      currentValue: currentQS,
      previousValue: previousQS,
      changePercent: (drop / previousQS) * 100,
      threshold: threshold.critical,
      channel: 'google_ads',
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Review ad relevance',
        'Improve landing page experience',
        'Optimize expected CTR',
        'Review keyword-ad alignment',
      ],
    });
  } else if (drop >= threshold.warning) {
    signals.push({
      id: `signal_qs_${Date.now()}`,
      companyId,
      type: 'quality_score_drop',
      category: 'performance',
      severity: 'warning',
      title: 'Quality Score Decline',
      description: `Average Quality Score at ${currentQS}/10 (down ${drop} points)`,
      metric: 'quality_score',
      currentValue: currentQS,
      previousValue: previousQS,
      changePercent: (drop / previousQS) * 100,
      threshold: threshold.warning,
      channel: 'google_ads',
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Monitor Quality Score trends',
        'Review ad copy relevance',
      ],
    });
  }

  return signals;
}

function detectCompetitiveThreat(
  companyId: string,
  data: PerformanceSnapshot,
  thresholds: SignalThresholds,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];

  if (!data.channels) return signals;

  for (const [channelName, channelData] of Object.entries(data.channels)) {
    if (!channelData.impressionShare) continue;

    const threshold = thresholds.competitive_threat;
    const previousIS = 50; // Baseline assumption
    const currentIS = channelData.impressionShare;
    const loss = previousIS - currentIS;

    if (loss >= threshold.critical) {
      signals.push({
        id: `signal_competitive_${channelName}_${Date.now()}`,
        companyId,
        type: 'competitive_threat',
        category: 'competitive',
        severity: 'critical',
        title: `Impression Share Loss: ${channelName}`,
        description: `Impression share dropped to ${currentIS.toFixed(0)}% (lost ${loss.toFixed(0)} points)`,
        metric: 'impression_share',
        currentValue: currentIS,
        previousValue: previousIS,
        changePercent: -(loss / previousIS) * 100,
        threshold: threshold.critical,
        channel: channelName,
        detectedAt: timestamp,
        status: 'active',
        suggestedActions: [
          'Analyze competitor activity',
          'Review bid competitiveness',
          'Consider budget increase',
          'Evaluate targeting overlap',
        ],
      });
    } else if (loss >= threshold.warning) {
      signals.push({
        id: `signal_competitive_${channelName}_${Date.now()}`,
        companyId,
        type: 'competitive_threat',
        category: 'competitive',
        severity: 'warning',
        title: `Impression Share Decline: ${channelName}`,
        description: `Impression share at ${currentIS.toFixed(0)}% (lost ${loss.toFixed(0)} points)`,
        metric: 'impression_share',
        currentValue: currentIS,
        previousValue: previousIS,
        changePercent: -(loss / previousIS) * 100,
        threshold: threshold.warning,
        channel: channelName,
        detectedAt: timestamp,
        status: 'active',
        suggestedActions: [
          'Monitor competitive landscape',
          'Review bid strategy',
        ],
      });
    }
  }

  return signals;
}

function detectSeasonalAnomaly(
  companyId: string,
  graph: CompanyContextGraph,
  thresholds: SignalThresholds,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];

  // Check for seasonal context
  const seasonalPatterns = graph.identity?.seasonalityNotes?.value as string | undefined;
  const peakSeasons = graph.identity?.peakSeasons?.value as string[] | undefined;

  if (!seasonalPatterns && !peakSeasons) {
    return signals;
  }

  // Detect if we're in a peak season but performance is below expected
  const currentMonth = new Date().toLocaleString('default', { month: 'long' }).toLowerCase();
  const isInPeakSeason = peakSeasons?.some(s => s.toLowerCase().includes(currentMonth));

  if (isInPeakSeason) {
    signals.push({
      id: `signal_season_${Date.now()}`,
      companyId,
      type: 'seasonal_anomaly',
      category: 'seasonal',
      severity: 'info',
      title: 'Peak Season Active',
      description: `Currently in peak season. Ensure campaigns are optimized for increased demand.`,
      metric: 'seasonal_indicator',
      currentValue: 1,
      previousValue: 0,
      changePercent: 0,
      threshold: 0,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Review budget allocation for peak season',
        'Ensure creative assets are season-appropriate',
        'Monitor competitor activity closely',
      ],
    });
  }

  return signals;
}

function detectContextGaps(
  companyId: string,
  graph: CompanyContextGraph,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];

  // Check for critical missing context
  const criticalFields = [
    { path: 'brand.valueProposition', name: 'Value Proposition' },
    { path: 'audience.coreSegments', name: 'Core Audience Segments' },
    { path: 'performanceMedia.activeChannels', name: 'Active Channels' },
    { path: 'performanceMedia.monthlyBudget', name: 'Monthly Budget' },
  ];

  const missingFields: string[] = [];

  for (const field of criticalFields) {
    const [domain, key] = field.path.split('.');
    const domainData = graph[domain as keyof CompanyContextGraph];
    if (!domainData || !(domainData as Record<string, unknown>)[key]) {
      missingFields.push(field.name);
    }
  }

  if (missingFields.length > 0) {
    signals.push({
      id: `signal_context_${Date.now()}`,
      companyId,
      type: 'context_gap',
      category: 'data_quality',
      severity: missingFields.length >= 3 ? 'critical' : 'warning',
      title: 'Context Graph Gaps Detected',
      description: `Missing critical context: ${missingFields.join(', ')}`,
      metric: 'context_completeness',
      currentValue: ((criticalFields.length - missingFields.length) / criticalFields.length) * 100,
      previousValue: 100,
      changePercent: 0,
      threshold: 75,
      detectedAt: timestamp,
      status: 'active',
      suggestedActions: [
        'Complete company context setup',
        'Run context enrichment',
        ...missingFields.map(f => `Add ${f} to context`),
      ],
    });
  }

  return signals;
}

function detectStrategyMisalignment(
  companyId: string,
  graph: CompanyContextGraph,
  timestamp: string
): Signal[] {
  const signals: Signal[] = [];

  // Check for strategy misalignment indicators
  const objectives = graph.objectives;
  const performance = graph.performanceMedia;

  if (!objectives || !performance) {
    return signals;
  }

  // Check if primary goal aligns with channel setup
  const primaryGoal = objectives.primaryObjective?.value as string | undefined;
  const activeChannels = performance.activeChannels?.value as string[] | undefined;

  if (primaryGoal && activeChannels) {
    // E-commerce goals should have shopping channels
    if (primaryGoal.toLowerCase().includes('ecommerce') || primaryGoal.toLowerCase().includes('sales')) {
      const hasShoppingChannels = activeChannels.some(c =>
        c.toLowerCase().includes('shopping') || c.toLowerCase().includes('google')
      );
      if (!hasShoppingChannels) {
        signals.push({
          id: `signal_alignment_${Date.now()}`,
          companyId,
          type: 'strategy_misalignment',
          category: 'strategic',
          severity: 'warning',
          title: 'Strategy-Channel Misalignment',
          description: 'E-commerce goals detected but no shopping channels active',
          metric: 'strategy_alignment',
          currentValue: 0,
          previousValue: 1,
          changePercent: -100,
          threshold: 1,
          detectedAt: timestamp,
          status: 'active',
          suggestedActions: [
            'Consider adding Google Shopping',
            'Review channel strategy for goal alignment',
          ],
        });
      }
    }

    // Brand awareness goals should have upper-funnel channels
    if (primaryGoal.toLowerCase().includes('awareness') || primaryGoal.toLowerCase().includes('brand')) {
      const hasAwarenessChannels = activeChannels.some(c =>
        c.toLowerCase().includes('display') ||
        c.toLowerCase().includes('youtube') ||
        c.toLowerCase().includes('video')
      );
      if (!hasAwarenessChannels) {
        signals.push({
          id: `signal_alignment_${Date.now()}`,
          companyId,
          type: 'strategy_misalignment',
          category: 'strategic',
          severity: 'warning',
          title: 'Strategy-Channel Misalignment',
          description: 'Brand awareness goals detected but no awareness channels active',
          metric: 'strategy_alignment',
          currentValue: 0,
          previousValue: 1,
          changePercent: -100,
          threshold: 1,
          detectedAt: timestamp,
          status: 'active',
          suggestedActions: [
            'Consider adding YouTube or Display channels',
            'Review channel mix for brand awareness',
          ],
        });
      }
    }
  }

  return signals;
}

// ============================================================================
// Signal Management Functions
// ============================================================================

/**
 * Get active signals for a company
 */
export function getActiveSignals(companyId: string): Signal[] {
  return activeSignals.get(companyId) || [];
}

/**
 * Get signal history for a company
 */
export function getSignalHistory(
  companyId: string,
  options?: {
    limit?: number;
    type?: SignalType;
    severity?: SignalSeverity;
    since?: string;
  }
): Signal[] {
  let history = signalHistory.get(companyId) || [];

  if (options?.type) {
    history = history.filter(s => s.type === options.type);
  }

  if (options?.severity) {
    history = history.filter(s => s.severity === options.severity);
  }

  if (options?.since) {
    const sinceDate = new Date(options.since);
    history = history.filter(s => new Date(s.detectedAt) >= sinceDate);
  }

  if (options?.limit) {
    history = history.slice(-options.limit);
  }

  return history;
}

/**
 * Acknowledge a signal
 */
export function acknowledgeSignal(
  companyId: string,
  signalId: string,
  acknowledgedBy: string
): Signal | null {
  const signals = activeSignals.get(companyId) || [];
  const signalIndex = signals.findIndex(s => s.id === signalId);

  if (signalIndex === -1) return null;

  const updated: Signal = {
    ...signals[signalIndex],
    status: 'acknowledged',
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy,
  };

  signals[signalIndex] = updated;
  activeSignals.set(companyId, signals);

  return updated;
}

/**
 * Resolve a signal
 */
export function resolveSignal(
  companyId: string,
  signalId: string,
  resolution: string
): Signal | null {
  const signals = activeSignals.get(companyId) || [];
  const signalIndex = signals.findIndex(s => s.id === signalId);

  if (signalIndex === -1) return null;

  const resolved: Signal = {
    ...signals[signalIndex],
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolution,
  };

  // Move to history
  signals.splice(signalIndex, 1);
  activeSignals.set(companyId, signals);

  const history = signalHistory.get(companyId) || [];
  history.push(resolved);
  signalHistory.set(companyId, history);

  return resolved;
}

/**
 * Get signal summary for a company
 */
export function getSignalSummary(companyId: string): {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byCategory: Record<string, number>;
  topIssues: Signal[];
} {
  const signals = activeSignals.get(companyId) || [];

  const critical = signals.filter(s => s.severity === 'critical').length;
  const warning = signals.filter(s => s.severity === 'warning').length;
  const info = signals.filter(s => s.severity === 'info').length;

  const byCategory: Record<string, number> = {};
  for (const signal of signals) {
    byCategory[signal.category] = (byCategory[signal.category] || 0) + 1;
  }

  // Top issues sorted by severity
  const severityOrder: Record<SignalSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  const topIssues = [...signals]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 5);

  return {
    total: signals.length,
    critical,
    warning,
    info,
    byCategory,
    topIssues,
  };
}

// ============================================================================
// Alert Configuration
// ============================================================================

/**
 * Set alert configuration for a company
 */
export function setAlertConfig(companyId: string, config: AlertConfig): void {
  alertConfigs.set(companyId, config);
}

/**
 * Get alert configuration for a company
 */
export function getAlertConfig(companyId: string): AlertConfig | null {
  return alertConfigs.get(companyId) || null;
}

/**
 * Check if a signal should trigger an alert
 */
export function shouldTriggerAlert(companyId: string, signal: Signal): boolean {
  const config = alertConfigs.get(companyId);

  if (!config?.enabled) return false;

  // Check severity threshold
  const severityPriority: Record<SignalSeverity, number> = {
    critical: 2,
    warning: 1,
    info: 0,
  };

  const minSeverity = config.minSeverity || 'warning';
  if (severityPriority[signal.severity] < severityPriority[minSeverity]) {
    return false;
  }

  // Check if signal type is in enabled types
  if (config.enabledTypes && !config.enabledTypes.includes(signal.type)) {
    return false;
  }

  // Check quiet hours
  if (config.quietHours) {
    const now = new Date();
    const currentHour = now.getHours();
    const { start, end } = config.quietHours;

    if (start < end) {
      // Simple case: quiet hours don't span midnight
      if (currentHour >= start && currentHour < end) {
        return false;
      }
    } else {
      // Quiet hours span midnight
      if (currentHour >= start || currentHour < end) {
        return false;
      }
    }
  }

  return true;
}

// ============================================================================
// Exports for Types
// ============================================================================

export type { PerformanceSnapshot, PerformancePeriod, ChannelPerformance };
