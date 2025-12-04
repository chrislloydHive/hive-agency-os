// lib/meta/anomalyPatterns.ts
// Phase 6: Emergent Intelligence - Global Anomaly Detection
//
// Cross-company anomaly detection that surfaces:
// - Industry-wide conversion drops (is it us or the market?)
// - Emerging platform issues before they hit news
// - Seasonal deviations from expected patterns
// - Cross-vertical disruptions

import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  GlobalAnomaly,
  GlobalAnomalyType,
  AnomalyEvidence,
} from './types';
import { loadContextGraph } from '../contextGraph';
import { getAllCompanies } from '../airtable/companies';

// ============================================================================
// Types
// ============================================================================

interface CompanyMetricSnapshot {
  companyId: string;
  companyName: string;
  vertical: string;
  metrics: Record<string, number>;
  timestamp: string;
}

interface AnomalyThresholds {
  deviationMultiplier: number; // Standard deviations from mean
  minAffectedCompanies: number;
  minDeviationPercent: number;
}

interface DetectionOptions {
  thresholds?: Partial<AnomalyThresholds>;
  verticalFilter?: string;
  channelFilter?: string;
  types?: GlobalAnomalyType[];
}

interface MetricBaseline {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  sampleSize: number;
}

// ============================================================================
// Default Thresholds
// ============================================================================

const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  deviationMultiplier: 2,
  minAffectedCompanies: 2,
  minDeviationPercent: 20,
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Run global anomaly detection across all companies
 */
export async function detectGlobalAnomalies(
  options: DetectionOptions = {}
): Promise<GlobalAnomaly[]> {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
  const snapshots = await collectMetricSnapshots(options.verticalFilter);

  if (snapshots.length < thresholds.minAffectedCompanies) {
    return [];
  }

  const anomalies: GlobalAnomaly[] = [];
  const typesToCheck = options.types || [
    'conversion_drop',
    'media_cost_spike',
    'channel_emergence',
    'creative_fatigue',
    'regional_disruption',
    'tracking_issue',
    'platform_change',
    'competitive_shift',
    'seasonality_deviation',
  ];

  // Run detection for each type
  if (typesToCheck.includes('conversion_drop')) {
    anomalies.push(...detectConversionAnomalies(snapshots, thresholds));
  }

  if (typesToCheck.includes('media_cost_spike')) {
    anomalies.push(...detectCostAnomalies(snapshots, thresholds));
  }

  if (typesToCheck.includes('channel_emergence')) {
    anomalies.push(...detectChannelAnomalies(snapshots, thresholds));
  }

  if (typesToCheck.includes('creative_fatigue')) {
    anomalies.push(...detectCreativeFatigueAnomalies(snapshots, thresholds));
  }

  if (typesToCheck.includes('platform_change')) {
    anomalies.push(...detectPlatformAnomalies(snapshots, thresholds));
  }

  if (typesToCheck.includes('seasonality_deviation')) {
    anomalies.push(...detectSeasonalityAnomalies(snapshots, thresholds));
  }

  return anomalies;
}

/**
 * Detect anomalies for a specific vertical
 */
export async function detectVerticalAnomalies(
  vertical: string,
  options: Omit<DetectionOptions, 'verticalFilter'> = {}
): Promise<GlobalAnomaly[]> {
  return detectGlobalAnomalies({ ...options, verticalFilter: vertical });
}

/**
 * Detect anomalies for a specific channel
 */
export async function detectChannelSpecificAnomalies(
  channel: string
): Promise<GlobalAnomaly[]> {
  return detectGlobalAnomalies({ channelFilter: channel });
}

/**
 * Check if a company's metrics are anomalous compared to peers
 */
export async function checkCompanyForAnomalies(
  companyId: string
): Promise<{
  isAnomalous: boolean;
  anomalies: Array<{
    metric: string;
    value: number;
    baseline: MetricBaseline;
    deviationPercent: number;
    type: 'positive' | 'negative';
  }>;
}> {
  const graph = await loadContextGraph(companyId);
  if (!graph) {
    return { isAnomalous: false, anomalies: [] };
  }

  const vertical = graph.identity?.industry?.value;
  const verticalFilter = typeof vertical === 'string' ? vertical : undefined;

  const allSnapshots = await collectMetricSnapshots(verticalFilter);
  const companySnapshot = allSnapshots.find(s => s.companyId === companyId);

  if (!companySnapshot) {
    return { isAnomalous: false, anomalies: [] };
  }

  const otherSnapshots = allSnapshots.filter(s => s.companyId !== companyId);
  const anomalies: Array<{
    metric: string;
    value: number;
    baseline: MetricBaseline;
    deviationPercent: number;
    type: 'positive' | 'negative';
  }> = [];

  for (const [metric, value] of Object.entries(companySnapshot.metrics)) {
    const baseline = calculateBaseline(otherSnapshots, metric);
    if (baseline.sampleSize < 3) continue;

    const deviation = (value - baseline.mean) / (baseline.stdDev || 1);
    const deviationPercent = ((value - baseline.mean) / (baseline.mean || 1)) * 100;

    if (Math.abs(deviation) > 2) {
      anomalies.push({
        metric,
        value,
        baseline,
        deviationPercent: Math.abs(deviationPercent),
        type: deviation > 0 ? 'positive' : 'negative',
      });
    }
  }

  return {
    isAnomalous: anomalies.length > 0,
    anomalies,
  };
}

/**
 * Get historical anomalies for analysis
 */
export async function getAnomalyHistory(
  options: {
    vertical?: string;
    type?: GlobalAnomalyType;
    severity?: GlobalAnomaly['severity'];
    limit?: number;
  } = {}
): Promise<GlobalAnomaly[]> {
  // In a real implementation, this would query historical data
  // For now, detect current anomalies
  const currentAnomalies = await detectGlobalAnomalies({
    verticalFilter: options.vertical,
    types: options.type ? [options.type] : undefined,
  });

  let filtered = currentAnomalies;

  if (options.severity) {
    filtered = filtered.filter(a => a.severity === options.severity);
  }

  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

// ============================================================================
// Detection Functions
// ============================================================================

function detectConversionAnomalies(
  snapshots: CompanyMetricSnapshot[],
  thresholds: AnomalyThresholds
): GlobalAnomaly[] {
  const anomalies: GlobalAnomaly[] = [];
  const byVertical = groupByVertical(snapshots);

  for (const [vertical, verticalSnapshots] of Object.entries(byVertical)) {
    const baseline = calculateBaseline(verticalSnapshots, 'conversionRate');
    if (baseline.sampleSize < thresholds.minAffectedCompanies) continue;

    // Find companies significantly below baseline
    const affectedCompanies: AnomalyEvidence[] = [];

    for (const snapshot of verticalSnapshots) {
      const value = snapshot.metrics.conversionRate;
      if (value === undefined) continue;

      const deviation = (value - baseline.mean) / (baseline.stdDev || 1);

      if (deviation < -thresholds.deviationMultiplier) {
        affectedCompanies.push({
          companyId: snapshot.companyId,
          companyName: snapshot.companyName,
          metric: 'conversionRate',
          baseline: baseline.mean,
          current: value,
          deviation: deviation,
          timestamp: snapshot.timestamp,
        });
      }
    }

    if (affectedCompanies.length >= thresholds.minAffectedCompanies) {
      const avgDeviation = affectedCompanies.reduce((sum, e) => sum + e.deviation, 0) /
        affectedCompanies.length;

      anomalies.push({
        id: `anomaly-conversion-${vertical}-${Date.now()}`,
        type: 'conversion_drop',
        severity: determineSeverity(affectedCompanies.length, Math.abs(avgDeviation)),
        title: `Conversion Drop in ${vertical}`,
        description: `${affectedCompanies.length} ${vertical} companies experiencing below-average conversion rates`,
        affectedVerticals: [vertical],
        affectedCompanyIds: affectedCompanies.map(e => e.companyId),
        metric: 'conversionRate',
        expectedValue: baseline.mean,
        actualValue: affectedCompanies.reduce((sum, e) => sum + e.current, 0) /
          affectedCompanies.length,
        deviationPercent: Math.abs(avgDeviation * 100),
        evidence: affectedCompanies,
        possibleCauses: [
          'Market-wide change in consumer behavior',
          'Platform algorithm update',
          'Seasonal pattern shift',
          'Competitive pressure increase',
        ],
        recommendedActions: [
          'Review recent campaign changes',
          'Analyze competitor activity',
          'Check for tracking issues',
          'Review landing page performance',
        ],
        detectedAt: new Date().toISOString(),
        status: 'active',
      });
    }
  }

  return anomalies;
}

function detectCostAnomalies(
  snapshots: CompanyMetricSnapshot[],
  thresholds: AnomalyThresholds
): GlobalAnomaly[] {
  const anomalies: GlobalAnomaly[] = [];
  const byVertical = groupByVertical(snapshots);

  for (const [vertical, verticalSnapshots] of Object.entries(byVertical)) {
    // Check CPA
    const cpaBaseline = calculateBaseline(verticalSnapshots, 'cpa');
    if (cpaBaseline.sampleSize < thresholds.minAffectedCompanies) continue;

    const affectedCompanies: AnomalyEvidence[] = [];

    for (const snapshot of verticalSnapshots) {
      const value = snapshot.metrics.cpa;
      if (value === undefined) continue;

      const deviation = (value - cpaBaseline.mean) / (cpaBaseline.stdDev || 1);

      // Higher CPA is worse
      if (deviation > thresholds.deviationMultiplier) {
        affectedCompanies.push({
          companyId: snapshot.companyId,
          companyName: snapshot.companyName,
          metric: 'cpa',
          baseline: cpaBaseline.mean,
          current: value,
          deviation,
          timestamp: snapshot.timestamp,
        });
      }
    }

    if (affectedCompanies.length >= thresholds.minAffectedCompanies) {
      const avgDeviation = affectedCompanies.reduce((sum, e) => sum + e.deviation, 0) /
        affectedCompanies.length;

      anomalies.push({
        id: `anomaly-cost-${vertical}-${Date.now()}`,
        type: 'media_cost_spike',
        severity: determineSeverity(affectedCompanies.length, avgDeviation),
        title: `Media Cost Spike in ${vertical}`,
        description: `${affectedCompanies.length} ${vertical} companies seeing elevated CPAs`,
        affectedVerticals: [vertical],
        affectedCompanyIds: affectedCompanies.map(e => e.companyId),
        metric: 'cpa',
        expectedValue: cpaBaseline.mean,
        actualValue: affectedCompanies.reduce((sum, e) => sum + e.current, 0) /
          affectedCompanies.length,
        deviationPercent: avgDeviation * 100,
        evidence: affectedCompanies,
        possibleCauses: [
          'Increased competition for ad inventory',
          'Seasonal demand spike',
          'Platform auction changes',
          'Quality score degradation',
        ],
        recommendedActions: [
          'Review bid strategies',
          'Expand audience targeting',
          'Test new creative angles',
          'Consider alternative channels',
        ],
        detectedAt: new Date().toISOString(),
        status: 'active',
      });
    }
  }

  return anomalies;
}

function detectChannelAnomalies(
  snapshots: CompanyMetricSnapshot[],
  thresholds: AnomalyThresholds
): GlobalAnomaly[] {
  const anomalies: GlobalAnomaly[] = [];

  // Track channel adoption across all companies
  const channelAdoption: Record<string, {
    companies: string[];
    verticals: Set<string>;
  }> = {};

  for (const snapshot of snapshots) {
    const channels = snapshot.metrics.activeChannels;
    // This would need actual channel data - using placeholder
  }

  // Look for rapid adoption patterns
  // In a real implementation, would compare to historical data

  return anomalies;
}

function detectCreativeFatigueAnomalies(
  snapshots: CompanyMetricSnapshot[],
  thresholds: AnomalyThresholds
): GlobalAnomaly[] {
  const anomalies: GlobalAnomaly[] = [];
  const byVertical = groupByVertical(snapshots);

  for (const [vertical, verticalSnapshots] of Object.entries(byVertical)) {
    // Check CTR as proxy for creative fatigue
    const ctrBaseline = calculateBaseline(verticalSnapshots, 'ctr');
    if (ctrBaseline.sampleSize < thresholds.minAffectedCompanies) continue;

    const affectedCompanies: AnomalyEvidence[] = [];

    for (const snapshot of verticalSnapshots) {
      const value = snapshot.metrics.ctr;
      if (value === undefined) continue;

      const deviation = (value - ctrBaseline.mean) / (ctrBaseline.stdDev || 1);

      if (deviation < -thresholds.deviationMultiplier) {
        affectedCompanies.push({
          companyId: snapshot.companyId,
          companyName: snapshot.companyName,
          metric: 'ctr',
          baseline: ctrBaseline.mean,
          current: value,
          deviation,
          timestamp: snapshot.timestamp,
        });
      }
    }

    if (affectedCompanies.length >= thresholds.minAffectedCompanies) {
      const avgDeviation = affectedCompanies.reduce((sum, e) => sum + Math.abs(e.deviation), 0) /
        affectedCompanies.length;

      anomalies.push({
        id: `anomaly-fatigue-${vertical}-${Date.now()}`,
        type: 'creative_fatigue',
        severity: determineSeverity(affectedCompanies.length, avgDeviation),
        title: `Creative Fatigue Pattern in ${vertical}`,
        description: `${affectedCompanies.length} ${vertical} companies showing declining engagement metrics`,
        affectedVerticals: [vertical],
        affectedCompanyIds: affectedCompanies.map(e => e.companyId),
        metric: 'ctr',
        expectedValue: ctrBaseline.mean,
        actualValue: affectedCompanies.reduce((sum, e) => sum + e.current, 0) /
          affectedCompanies.length,
        deviationPercent: Math.abs(avgDeviation * 100),
        evidence: affectedCompanies,
        possibleCauses: [
          'Audience saturation',
          'Creative wear-out',
          'Messaging fatigue',
          'Format overexposure',
        ],
        recommendedActions: [
          'Refresh creative assets',
          'Test new messaging angles',
          'Expand audience segments',
          'Introduce new ad formats',
        ],
        detectedAt: new Date().toISOString(),
        status: 'active',
      });
    }
  }

  return anomalies;
}

function detectPlatformAnomalies(
  snapshots: CompanyMetricSnapshot[],
  thresholds: AnomalyThresholds
): GlobalAnomaly[] {
  const anomalies: GlobalAnomaly[] = [];

  // Look for widespread metrics drops that suggest platform issues
  const allMetrics = ['conversionRate', 'ctr', 'roas'];

  for (const metric of allMetrics) {
    const baseline = calculateBaseline(snapshots, metric);
    if (baseline.sampleSize < thresholds.minAffectedCompanies * 2) continue;

    const affectedCompanies: AnomalyEvidence[] = [];

    for (const snapshot of snapshots) {
      const value = snapshot.metrics[metric];
      if (value === undefined) continue;

      const deviation = (value - baseline.mean) / (baseline.stdDev || 1);

      // Check for significant negative deviation
      if (deviation < -thresholds.deviationMultiplier) {
        affectedCompanies.push({
          companyId: snapshot.companyId,
          companyName: snapshot.companyName,
          metric,
          baseline: baseline.mean,
          current: value,
          deviation,
          timestamp: snapshot.timestamp,
        });
      }
    }

    // Platform issue = affects large % of companies
    const affectionRate = affectedCompanies.length / snapshots.length;
    if (affectionRate > 0.3 && affectedCompanies.length >= 3) {
      const verticals = [...new Set(affectedCompanies.map(e =>
        snapshots.find(s => s.companyId === e.companyId)?.vertical || 'unknown'
      ))];

      anomalies.push({
        id: `anomaly-platform-${metric}-${Date.now()}`,
        type: 'platform_change',
        severity: 'critical',
        title: `Potential Platform Issue: ${metric}`,
        description: `${(affectionRate * 100).toFixed(0)}% of companies affected by ${metric} decline across verticals`,
        affectedVerticals: verticals,
        affectedCompanyIds: affectedCompanies.map(e => e.companyId),
        metric,
        expectedValue: baseline.mean,
        actualValue: affectedCompanies.reduce((sum, e) => sum + e.current, 0) /
          affectedCompanies.length,
        deviationPercent: affectionRate * 100,
        evidence: affectedCompanies,
        possibleCauses: [
          'Platform algorithm update',
          'Tracking/pixel issues',
          'API changes',
          'Attribution model changes',
        ],
        recommendedActions: [
          'Check platform status pages',
          'Review tracking implementation',
          'Compare data sources',
          'Monitor industry forums',
        ],
        detectedAt: new Date().toISOString(),
        status: 'active',
      });
    }
  }

  return anomalies;
}

function detectSeasonalityAnomalies(
  snapshots: CompanyMetricSnapshot[],
  thresholds: AnomalyThresholds
): GlobalAnomaly[] {
  const anomalies: GlobalAnomaly[] = [];
  const currentMonth = new Date().getMonth();

  // This would ideally compare to historical seasonal patterns
  // For now, look for unexpected uniformity or divergence

  const byVertical = groupByVertical(snapshots);

  for (const [vertical, verticalSnapshots] of Object.entries(byVertical)) {
    const metrics = ['conversionRate', 'cpa', 'roas'];

    for (const metric of metrics) {
      const baseline = calculateBaseline(verticalSnapshots, metric);
      if (baseline.sampleSize < 3) continue;

      // High variance might indicate seasonal disruption
      const coefficientOfVariation = (baseline.stdDev / baseline.mean) || 0;

      if (coefficientOfVariation > 0.5) {
        anomalies.push({
          id: `anomaly-seasonal-${vertical}-${metric}-${Date.now()}`,
          type: 'seasonality_deviation',
          severity: 'warning',
          title: `Unusual ${metric} Variance in ${vertical}`,
          description: `High variance in ${metric} across ${vertical} companies suggests seasonal disruption`,
          affectedVerticals: [vertical],
          affectedCompanyIds: verticalSnapshots.map(s => s.companyId),
          metric,
          expectedValue: baseline.mean,
          actualValue: baseline.stdDev,
          deviationPercent: coefficientOfVariation * 100,
          evidence: verticalSnapshots.map(s => ({
            companyId: s.companyId,
            companyName: s.companyName,
            metric,
            baseline: baseline.mean,
            current: s.metrics[metric] || 0,
            deviation: ((s.metrics[metric] || 0) - baseline.mean) / (baseline.stdDev || 1),
            timestamp: s.timestamp,
          })),
          possibleCauses: [
            'Unexpected seasonal pattern',
            'Market disruption',
            'Consumer behavior shift',
            'Competitive activity',
          ],
          recommendedActions: [
            'Review historical patterns',
            'Analyze market trends',
            'Adjust seasonal forecasts',
            'Monitor competitor activity',
          ],
          detectedAt: new Date().toISOString(),
          status: 'active',
        });
      }
    }
  }

  return anomalies;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function collectMetricSnapshots(
  verticalFilter?: string
): Promise<CompanyMetricSnapshot[]> {
  const companies = await getAllCompanies();
  const snapshots: CompanyMetricSnapshot[] = [];

  for (const company of companies) {
    try {
      const graph = await loadContextGraph(company.id);
      if (!graph) continue;

      const vertical = graph.identity?.industry?.value;
      if (verticalFilter && vertical !== verticalFilter) continue;

      const metrics: Record<string, number> = {};

      // Extract relevant metrics
      const conversionRate = graph.performanceMedia?.blendedCpa?.value;
      if (typeof conversionRate === 'number') metrics.conversionRate = conversionRate;

      const cpa = graph.objectives?.targetCpa?.value;
      if (typeof cpa === 'number') metrics.cpa = cpa;

      const roas = graph.performanceMedia?.blendedRoas?.value;
      if (typeof roas === 'number') metrics.roas = roas;

      const ctr = graph.performanceMedia?.blendedCtr?.value;
      if (typeof ctr === 'number') metrics.ctr = ctr;

      const avgCustomerValue = graph.budgetOps?.avgCustomerValue?.value;
      if (typeof avgCustomerValue === 'number') metrics.avgCustomerValue = avgCustomerValue;

      const ltv = graph.budgetOps?.customerLTV?.value;
      if (typeof ltv === 'number') metrics.ltv = ltv;

      if (Object.keys(metrics).length > 0) {
        snapshots.push({
          companyId: company.id,
          companyName: company.name,
          vertical: typeof vertical === 'string' ? vertical : 'unknown',
          metrics,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      continue;
    }
  }

  return snapshots;
}

function groupByVertical(
  snapshots: CompanyMetricSnapshot[]
): Record<string, CompanyMetricSnapshot[]> {
  const groups: Record<string, CompanyMetricSnapshot[]> = {};

  for (const snapshot of snapshots) {
    if (!groups[snapshot.vertical]) {
      groups[snapshot.vertical] = [];
    }
    groups[snapshot.vertical].push(snapshot);
  }

  return groups;
}

function calculateBaseline(
  snapshots: CompanyMetricSnapshot[],
  metric: string
): MetricBaseline {
  const values: number[] = [];

  for (const snapshot of snapshots) {
    const value = snapshot.metrics[metric];
    if (typeof value === 'number' && !isNaN(value)) {
      values.push(value);
    }
  }

  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, sampleSize: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
    sampleSize: values.length,
  };
}

function determineSeverity(
  affectedCount: number,
  deviation: number
): GlobalAnomaly['severity'] {
  if (affectedCount >= 10 || deviation > 4) return 'critical';
  if (affectedCount >= 5 || deviation > 3) return 'warning';
  return 'info';
}

// ============================================================================
// Exports
// ============================================================================

export {
  type CompanyMetricSnapshot,
  type AnomalyThresholds,
  type DetectionOptions,
  type MetricBaseline,
};
