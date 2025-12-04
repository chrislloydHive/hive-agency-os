// lib/meta/verticalModels.ts
// Phase 6: Emergent Intelligence - Vertical-Specific Intelligence Models
//
// Industry-specific intelligence that becomes more refined per vertical:
// - Vertical-specific audience expectations
// - Creative norms and anti-patterns
// - Expected KPI ranges per stage
// - Common pitfalls per vertical
// - Seasonality curves

import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type { VerticalModel, BenchmarkPercentiles } from './types';
import { loadContextGraph } from '../contextGraph';
import { getAllCompanies } from '../airtable/companies';

// ============================================================================
// Types
// ============================================================================

interface VerticalDataPoint {
  companyId: string;
  companyName: string;
  graph: CompanyContextGraph;
  businessModel: string;
  companySize: string;
  maturityStage: string;
}

interface VerticalStats {
  audiencePatterns: Record<string, number>;
  creativeFormats: Record<string, number>;
  messagingAngles: Record<string, number>;
  tonePreferences: Record<string, number>;
  channels: Record<string, number>;
  pitfalls: Record<string, number>;
  seasonalMonths: number[];
  kpis: {
    cpa: number[];
    roas: number[];
    ctr: number[];
    conversionRate: number[];
    cac: number[];
    ltv: number[];
  };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Build or update a vertical model from all companies in that vertical
 */
export async function buildVerticalModel(vertical: string): Promise<VerticalModel | null> {
  const companies = await getAllCompanies();
  const verticalCompanies: VerticalDataPoint[] = [];

  // Load all companies in this vertical
  for (const company of companies) {
    try {
      const graph = await loadContextGraph(company.id);
      if (graph) {
        const industry = graph.identity?.industry?.value;
        if (typeof industry === 'string' && industry.toLowerCase() === vertical.toLowerCase()) {
          verticalCompanies.push({
            companyId: company.id,
            companyName: company.name,
            graph,
            businessModel: (graph.identity?.businessModel?.value as string) || 'unknown',
            companySize: extractCompanySize(graph),
            maturityStage: extractMaturityStage(graph),
          });
        }
      }
    } catch (error) {
      continue;
    }
  }

  if (verticalCompanies.length < 2) {
    return null;
  }

  // Aggregate statistics
  const stats = aggregateVerticalStats(verticalCompanies);

  // Build the model
  return {
    id: `vertical-${vertical.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    vertical,
    subVerticals: extractSubVerticals(verticalCompanies),

    audienceExpectations: buildAudienceExpectations(stats, verticalCompanies),
    creativeNorms: buildCreativeNorms(stats, verticalCompanies),
    kpiRanges: buildKPIRanges(stats),
    commonPitfalls: buildCommonPitfalls(stats),
    seasonalityCurve: buildSeasonalityCurve(stats, verticalCompanies),
    competitiveIntensity: analyzeCompetitiveIntensity(verticalCompanies),

    sampleSize: verticalCompanies.length,
    confidence: calculateModelConfidence(verticalCompanies.length, stats),
    lastUpdated: new Date().toISOString(),
    version: '1.0.0',
  };
}

/**
 * Get all available vertical models
 */
export async function listVerticalModels(): Promise<VerticalModel[]> {
  const companies = await getAllCompanies();
  const verticals = new Set<string>();

  // Collect all verticals
  for (const company of companies) {
    try {
      const graph = await loadContextGraph(company.id);
      if (graph) {
        const industry = graph.identity?.industry?.value;
        if (typeof industry === 'string' && industry.length > 0) {
          verticals.add(industry);
        }
      }
    } catch (error) {
      continue;
    }
  }

  // Build models for each vertical
  const models: VerticalModel[] = [];
  for (const vertical of verticals) {
    const model = await buildVerticalModel(vertical);
    if (model) {
      models.push(model);
    }
  }

  return models;
}

/**
 * Get vertical-specific recommendations for a company
 */
export async function getVerticalRecommendations(
  companyId: string
): Promise<{
  audienceGaps: string[];
  creativeOpportunities: string[];
  kpiComparisons: Record<string, { value: number; percentile: number; recommendation: string }>;
  pitfallWarnings: string[];
  seasonalAdvice: string[];
} | null> {
  const graph = await loadContextGraph(companyId);
  if (!graph) return null;

  const vertical = graph.identity?.industry?.value;
  if (typeof vertical !== 'string') return null;

  const model = await buildVerticalModel(vertical);
  if (!model) return null;

  return {
    audienceGaps: findAudienceGaps(graph, model),
    creativeOpportunities: findCreativeOpportunities(graph, model),
    kpiComparisons: compareKPIs(graph, model),
    pitfallWarnings: checkForPitfalls(graph, model),
    seasonalAdvice: generateSeasonalAdvice(graph, model),
  };
}

/**
 * Compare a company to its vertical benchmarks
 */
export async function compareToVertical(
  companyId: string
): Promise<{
  vertical: string;
  percentileRanking: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
} | null> {
  const graph = await loadContextGraph(companyId);
  if (!graph) return null;

  const vertical = graph.identity?.industry?.value;
  if (typeof vertical !== 'string') return null;

  const model = await buildVerticalModel(vertical);
  if (!model) return null;

  const kpiComparisons = compareKPIs(graph, model);
  const avgPercentile = Object.values(kpiComparisons)
    .map(c => c.percentile)
    .reduce((a, b) => a + b, 0) / Object.keys(kpiComparisons).length || 50;

  return {
    vertical,
    percentileRanking: avgPercentile,
    strengths: findStrengths(graph, model, kpiComparisons),
    weaknesses: findWeaknesses(graph, model, kpiComparisons),
    opportunities: findOpportunities(graph, model),
  };
}

// ============================================================================
// Helper Functions - Data Aggregation
// ============================================================================

function aggregateVerticalStats(companies: VerticalDataPoint[]): VerticalStats {
  const stats: VerticalStats = {
    audiencePatterns: {},
    creativeFormats: {},
    messagingAngles: {},
    tonePreferences: {},
    channels: {},
    pitfalls: {},
    seasonalMonths: [],
    kpis: {
      cpa: [],
      roas: [],
      ctr: [],
      conversionRate: [],
      cac: [],
      ltv: [],
    },
  };

  for (const company of companies) {
    const graph = company.graph;

    // Audience patterns
    const demographics = graph.audience?.demographics?.value;
    if (typeof demographics === 'string') {
      incrementCount(stats.audiencePatterns, demographics);
    }

    const segments = graph.audience?.coreSegments?.value || [];
    for (const segment of segments) {
      if (typeof segment === 'string') {
        incrementCount(stats.audiencePatterns, segment);
      }
    }

    // Creative formats
    const formats = graph.creative?.availableFormats?.value || [];
    for (const format of formats) {
      if (typeof format === 'string') {
        incrementCount(stats.creativeFormats, format);
      }
    }

    // Messaging angles
    const messages = graph.creative?.coreMessages?.value || [];
    for (const message of messages) {
      if (typeof message === 'string') {
        incrementCount(stats.messagingAngles, message.slice(0, 50));
      }
    }

    // Tone preferences
    const tones = graph.audience?.toneGuidance?.value ? [graph.audience.toneGuidance.value] : [];
    for (const tone of tones) {
      if (typeof tone === 'string') {
        incrementCount(stats.tonePreferences, tone);
      }
    }

    // Channels
    const channels = graph.performanceMedia?.activeChannels?.value || [];
    for (const channel of channels) {
      if (typeof channel === 'string') {
        incrementCount(stats.channels, channel);
      }
    }

    // KPIs
    const cpa = graph.objectives?.targetCpa?.value;
    if (typeof cpa === 'number') stats.kpis.cpa.push(cpa);

    const roas = graph.objectives?.targetRoas?.value;
    if (typeof roas === 'number') stats.kpis.roas.push(roas);

    const ctr = graph.performanceMedia?.blendedCtr?.value;
    if (typeof ctr === 'number') stats.kpis.ctr.push(ctr);

    const conversionRate = graph.performanceMedia?.blendedCpa?.value; // Use CPA as proxy
    if (typeof conversionRate === 'number') stats.kpis.conversionRate.push(conversionRate);

    const customerValue = graph.budgetOps?.avgCustomerValue?.value;
    if (typeof customerValue === 'number') stats.kpis.cac.push(customerValue); // Using customer value as proxy

    const ltv = graph.budgetOps?.customerLTV?.value;
    if (typeof ltv === 'number') stats.kpis.ltv.push(ltv);

    // Seasonality
    const seasonalNotes = graph.identity?.seasonalityNotes?.value;
    if (typeof seasonalNotes === 'string') {
      const months = extractSeasonalMonths(seasonalNotes);
      stats.seasonalMonths.push(...months);
    }
  }

  return stats;
}

function incrementCount(record: Record<string, number>, key: string): void {
  if (!record[key]) {
    record[key] = 0;
  }
  record[key]++;
}

function extractCompanySize(graph: CompanyContextGraph): string {
  const revenue = graph.objectives?.revenueGoal?.value;
  const budget = graph.budgetOps?.mediaSpendBudget?.value;

  if (typeof revenue === 'number') {
    if (revenue > 100000000) return 'enterprise';
    if (revenue > 10000000) return 'large';
    if (revenue > 1000000) return 'medium';
    return 'small';
  }

  if (typeof budget === 'number') {
    if (budget > 1000000) return 'enterprise';
    if (budget > 100000) return 'large';
    if (budget > 10000) return 'medium';
    return 'small';
  }

  return 'unknown';
}

function extractMaturityStage(graph: CompanyContextGraph): string {
  // Use budget as proxy for maturity
  const budget = graph.budgetOps?.mediaSpendBudget?.value;

  if (typeof budget === 'number') {
    if (budget > 1000000) return 'enterprise';
    if (budget > 100000) return 'mature';
    if (budget > 10000) return 'growth';
    return 'startup';
  }

  return 'unknown';
}

function extractSubVerticals(companies: VerticalDataPoint[]): string[] {
  const subVerticals = new Set<string>();

  for (const company of companies) {
    const niche = company.graph.identity?.industry?.value;
    if (typeof niche === 'string') {
      subVerticals.add(niche);
    }
  }

  return [...subVerticals];
}

function extractSeasonalMonths(notes: string): number[] {
  const monthPatterns = [
    { pattern: /jan|january/i, month: 0 },
    { pattern: /feb|february/i, month: 1 },
    { pattern: /mar|march/i, month: 2 },
    { pattern: /apr|april/i, month: 3 },
    { pattern: /may/i, month: 4 },
    { pattern: /jun|june/i, month: 5 },
    { pattern: /jul|july/i, month: 6 },
    { pattern: /aug|august/i, month: 7 },
    { pattern: /sep|september/i, month: 8 },
    { pattern: /oct|october/i, month: 9 },
    { pattern: /nov|november/i, month: 10 },
    { pattern: /dec|december/i, month: 11 },
  ];

  const months: number[] = [];
  for (const { pattern, month } of monthPatterns) {
    if (pattern.test(notes)) {
      months.push(month);
    }
  }

  return months;
}

// ============================================================================
// Helper Functions - Model Building
// ============================================================================

function buildAudienceExpectations(
  stats: VerticalStats,
  companies: VerticalDataPoint[]
): VerticalModel['audienceExpectations'] {
  const topPatterns = getTopN(stats.audiencePatterns, 5);

  // Extract behavior patterns from personas
  const behaviors: string[] = [];
  const motivations: string[] = [];

  for (const company of companies) {
    const personas = company.graph.audience?.personaBriefs?.value || [];
    for (const persona of personas) {
      if (typeof persona === 'object' && persona !== null) {
        const p = persona as Record<string, unknown>;
        if (Array.isArray(p.behaviors)) {
          behaviors.push(...p.behaviors.map(b => String(b)));
        }
        if (Array.isArray(p.motivations)) {
          motivations.push(...p.motivations.map(m => String(m)));
        }
      }
    }
  }

  return {
    primaryDemographics: topPatterns,
    behaviorPatterns: getUniqueTopN(behaviors, 5),
    decisionFactors: getUniqueTopN(motivations, 5),
    contentPreferences: getTopN(stats.creativeFormats, 5),
  };
}

function buildCreativeNorms(
  stats: VerticalStats,
  companies: VerticalDataPoint[]
): VerticalModel['creativeNorms'] {
  return {
    topPerformingFormats: getTopN(stats.creativeFormats, 5),
    messagingAngles: getTopN(stats.messagingAngles, 5),
    visualStyles: extractVisualStyles(companies),
    tonePreferences: getTopN(stats.tonePreferences, 5),
    avoidPatterns: extractAvoidPatterns(companies),
  };
}

function buildKPIRanges(stats: VerticalStats): VerticalModel['kpiRanges'] {
  return {
    cpa: calculatePercentiles(stats.kpis.cpa),
    roas: calculatePercentiles(stats.kpis.roas),
    ctr: calculatePercentiles(stats.kpis.ctr),
    conversionRate: calculatePercentiles(stats.kpis.conversionRate),
    cac: calculatePercentiles(stats.kpis.cac),
    ltv: calculatePercentiles(stats.kpis.ltv),
  };
}

function buildCommonPitfalls(stats: VerticalStats): VerticalModel['commonPitfalls'] {
  // Derive pitfalls from patterns
  const pitfalls: VerticalModel['commonPitfalls'] = [];

  // Check for common issues based on KPI distributions
  const roasValues = stats.kpis.roas;
  if (roasValues.length > 0) {
    const lowRoasCount = roasValues.filter(r => r < 1).length;
    if (lowRoasCount / roasValues.length > 0.3) {
      pitfalls.push({
        pitfall: 'Low ROAS performance',
        frequency: lowRoasCount / roasValues.length,
        impact: 'high',
        prevention: 'Focus on audience targeting and creative optimization before scaling spend',
      });
    }
  }

  // Check for channel concentration
  const topChannel = getTopN(stats.channels, 1)[0];
  const topChannelShare = topChannel
    ? stats.channels[topChannel] / Object.values(stats.channels).reduce((a, b) => a + b, 0)
    : 0;

  if (topChannelShare > 0.7) {
    pitfalls.push({
      pitfall: 'Over-reliance on single channel',
      frequency: topChannelShare,
      impact: 'medium',
      prevention: 'Diversify channel mix to reduce platform dependency risk',
    });
  }

  return pitfalls;
}

function buildSeasonalityCurve(
  stats: VerticalStats,
  companies: VerticalDataPoint[]
): VerticalModel['seasonalityCurve'] {
  // Count peak months
  const monthCounts = new Array(12).fill(0);
  for (const month of stats.seasonalMonths) {
    monthCounts[month]++;
  }

  const maxCount = Math.max(...monthCounts, 1);

  return monthCounts.map((count, month) => ({
    month,
    demandIndex: 0.5 + (count / maxCount) * 0.5,
    competitionIndex: 0.5 + (count / maxCount) * 0.3,
    recommendedBudgetMultiplier: 0.8 + (count / maxCount) * 0.4,
  }));
}

function analyzeCompetitiveIntensity(
  companies: VerticalDataPoint[]
): VerticalModel['competitiveIntensity'] {
  const channelIntensity: Record<string, 'low' | 'medium' | 'high' | 'extreme'> = {};

  // Count channel usage
  const channelCounts: Record<string, number> = {};
  for (const company of companies) {
    const channels = company.graph.performanceMedia?.activeChannels?.value || [];
    for (const channel of channels) {
      if (typeof channel === 'string') {
        channelCounts[channel] = (channelCounts[channel] || 0) + 1;
      }
    }
  }

  // Convert to intensity
  const totalCompanies = companies.length;
  for (const [channel, count] of Object.entries(channelCounts)) {
    const share = count / totalCompanies;
    if (share > 0.8) channelIntensity[channel] = 'extreme';
    else if (share > 0.5) channelIntensity[channel] = 'high';
    else if (share > 0.2) channelIntensity[channel] = 'medium';
    else channelIntensity[channel] = 'low';
  }

  // Calculate overall intensity
  const avgShare = Object.values(channelCounts).reduce((a, b) => a + b, 0) /
    (Object.keys(channelCounts).length * totalCompanies);

  let overall: 'low' | 'medium' | 'high' | 'extreme' = 'medium';
  if (avgShare > 0.7) overall = 'extreme';
  else if (avgShare > 0.5) overall = 'high';
  else if (avgShare > 0.3) overall = 'medium';
  else overall = 'low';

  return {
    overall,
    byChannel: channelIntensity,
    trendDirection: 'stable',
  };
}

// ============================================================================
// Helper Functions - Percentiles & Statistics
// ============================================================================

function calculatePercentiles(values: number[]): {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
} {
  if (values.length === 0) {
    return { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);

  return {
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
  };
}

function percentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
}

function getTopN(record: Record<string, number>, n: number): string[] {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}

function getUniqueTopN(items: string[], n: number): string[] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item] = (counts[item] || 0) + 1;
  }
  return getTopN(counts, n);
}

function extractVisualStyles(companies: VerticalDataPoint[]): string[] {
  const styles: Record<string, number> = {};

  for (const company of companies) {
    const brandColors = company.graph.brand?.brandColors?.value;
    if (typeof brandColors === 'string') {
      incrementCount(styles, 'Branded colors');
    }

    const tone = company.graph.audience?.toneGuidance?.value ? [company.graph.audience.toneGuidance.value] : [];
    for (const t of tone) {
      if (typeof t === 'string') {
        if (/modern|minimal|clean/i.test(t)) incrementCount(styles, 'Modern/Minimal');
        if (/bold|vibrant|colorful/i.test(t)) incrementCount(styles, 'Bold/Vibrant');
        if (/professional|corporate/i.test(t)) incrementCount(styles, 'Professional');
        if (/playful|fun/i.test(t)) incrementCount(styles, 'Playful');
      }
    }
  }

  return getTopN(styles, 5);
}

function extractAvoidPatterns(companies: VerticalDataPoint[]): string[] {
  // Common anti-patterns based on vertical analysis
  const avoidPatterns = [
    'Generic stock imagery',
    'Overly promotional language',
    'Ignoring mobile-first design',
    'Complex messaging',
    'Inconsistent branding',
  ];

  return avoidPatterns.slice(0, 5);
}

function calculateModelConfidence(sampleSize: number, stats: VerticalStats): number {
  // Base confidence on sample size
  let confidence = Math.min(0.9, sampleSize / 20);

  // Adjust based on data completeness
  const hasKPIs = stats.kpis.roas.length > 0 || stats.kpis.cpa.length > 0;
  const hasAudience = Object.keys(stats.audiencePatterns).length > 0;
  const hasCreative = Object.keys(stats.creativeFormats).length > 0;

  if (!hasKPIs) confidence *= 0.7;
  if (!hasAudience) confidence *= 0.8;
  if (!hasCreative) confidence *= 0.9;

  return Math.min(0.95, Math.max(0.3, confidence));
}

// ============================================================================
// Helper Functions - Recommendations
// ============================================================================

function findAudienceGaps(
  graph: CompanyContextGraph,
  model: VerticalModel
): string[] {
  const gaps: string[] = [];

  const currentSegments = graph.audience?.coreSegments?.value || [];
  const expectedDemographics = model.audienceExpectations.primaryDemographics;

  for (const expected of expectedDemographics) {
    const hasMatch = currentSegments.some(
      s => typeof s === 'string' && s.toLowerCase().includes(expected.toLowerCase())
    );
    if (!hasMatch) {
      gaps.push(`Consider targeting "${expected}" audience common in ${model.vertical}`);
    }
  }

  return gaps.slice(0, 3);
}

function findCreativeOpportunities(
  graph: CompanyContextGraph,
  model: VerticalModel
): string[] {
  const opportunities: string[] = [];

  const currentFormats = graph.creative?.availableFormats?.value || [];
  const topFormats = model.creativeNorms.topPerformingFormats;

  for (const format of topFormats.slice(0, 3)) {
    const hasFormat = currentFormats.some(
      f => typeof f === 'string' && f.toLowerCase().includes(format.toLowerCase())
    );
    if (!hasFormat) {
      opportunities.push(`Test "${format}" format - top performer in ${model.vertical}`);
    }
  }

  return opportunities.slice(0, 3);
}

function compareKPIs(
  graph: CompanyContextGraph,
  model: VerticalModel
): Record<string, { value: number; percentile: number; recommendation: string }> {
  const comparisons: Record<string, { value: number; percentile: number; recommendation: string }> = {};

  // ROAS comparison
  const roas = graph.performanceMedia?.blendedRoas?.value;
  if (typeof roas === 'number') {
    const percentile = getPercentileRank(roas, model.kpiRanges.roas);
    comparisons.roas = {
      value: roas,
      percentile,
      recommendation: percentile < 25
        ? 'ROAS below 25th percentile - focus on efficiency'
        : percentile > 75
        ? 'ROAS above 75th percentile - consider scaling'
        : 'ROAS in healthy range',
    };
  }

  // CPA comparison
  const cpa = graph.objectives?.targetCpa?.value;
  if (typeof cpa === 'number') {
    const percentile = 100 - getPercentileRank(cpa, model.kpiRanges.cpa); // Lower is better
    comparisons.cpa = {
      value: cpa,
      percentile,
      recommendation: percentile < 25
        ? 'CPA higher than 75% of vertical - optimize targeting'
        : percentile > 75
        ? 'CPA better than 75% of vertical - well optimized'
        : 'CPA in typical range',
    };
  }

  return comparisons;
}

function getPercentileRank(
  value: number,
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number }
): number {
  if (value <= percentiles.p10) return 10;
  if (value <= percentiles.p25) return 25;
  if (value <= percentiles.p50) return 50;
  if (value <= percentiles.p75) return 75;
  if (value <= percentiles.p90) return 90;
  return 95;
}

function checkForPitfalls(
  graph: CompanyContextGraph,
  model: VerticalModel
): string[] {
  const warnings: string[] = [];

  for (const pitfall of model.commonPitfalls) {
    // Check for low ROAS
    if (pitfall.pitfall.includes('ROAS')) {
      const roas = graph.performanceMedia?.blendedRoas?.value;
      if (typeof roas === 'number' && roas < 1) {
        warnings.push(`Warning: ${pitfall.pitfall}. Prevention: ${pitfall.prevention}`);
      }
    }

    // Check for channel concentration
    if (pitfall.pitfall.includes('single channel')) {
      const channels = graph.performanceMedia?.activeChannels?.value || [];
      if (channels.length <= 1) {
        warnings.push(`Warning: ${pitfall.pitfall}. Prevention: ${pitfall.prevention}`);
      }
    }
  }

  return warnings;
}

function generateSeasonalAdvice(
  graph: CompanyContextGraph,
  model: VerticalModel
): string[] {
  const advice: string[] = [];
  const currentMonth = new Date().getMonth();

  const curve = model.seasonalityCurve[currentMonth];
  if (curve) {
    if (curve.demandIndex > 0.7) {
      advice.push(`Peak season for ${model.vertical} - consider increasing budget by ${((curve.recommendedBudgetMultiplier - 1) * 100).toFixed(0)}%`);
    } else if (curve.demandIndex < 0.4) {
      advice.push(`Low season for ${model.vertical} - focus on testing and optimization`);
    }
  }

  // Look ahead
  const nextMonth = (currentMonth + 1) % 12;
  const nextCurve = model.seasonalityCurve[nextMonth];
  if (nextCurve && nextCurve.demandIndex > curve.demandIndex + 0.2) {
    advice.push(`Prepare for demand increase next month`);
  }

  return advice;
}

function findStrengths(
  graph: CompanyContextGraph,
  model: VerticalModel,
  kpiComparisons: Record<string, { value: number; percentile: number; recommendation: string }>
): string[] {
  const strengths: string[] = [];

  for (const [kpi, data] of Object.entries(kpiComparisons)) {
    if (data.percentile >= 75) {
      strengths.push(`${kpi.toUpperCase()} in top 25% of ${model.vertical}`);
    }
  }

  // Check creative alignment
  const formats = graph.creative?.availableFormats?.value || [];
  const topFormats = model.creativeNorms.topPerformingFormats;
  const formatMatch = formats.filter(f =>
    topFormats.some(tf => String(f).toLowerCase().includes(tf.toLowerCase()))
  ).length;

  if (formatMatch >= 2) {
    strengths.push('Strong creative format alignment with vertical best practices');
  }

  return strengths;
}

function findWeaknesses(
  graph: CompanyContextGraph,
  model: VerticalModel,
  kpiComparisons: Record<string, { value: number; percentile: number; recommendation: string }>
): string[] {
  const weaknesses: string[] = [];

  for (const [kpi, data] of Object.entries(kpiComparisons)) {
    if (data.percentile <= 25) {
      weaknesses.push(`${kpi.toUpperCase()} in bottom 25% of ${model.vertical}`);
    }
  }

  // Check channel diversity
  const channels = graph.performanceMedia?.activeChannels?.value || [];
  if (channels.length <= 1) {
    weaknesses.push('Limited channel diversification');
  }

  return weaknesses;
}

function findOpportunities(
  graph: CompanyContextGraph,
  model: VerticalModel
): string[] {
  const opportunities: string[] = [];

  // Channel opportunities
  const currentChannels = new Set(
    (graph.performanceMedia?.activeChannels?.value || []).map(c => String(c).toLowerCase())
  );

  for (const [channel, intensity] of Object.entries(model.competitiveIntensity.byChannel)) {
    if (intensity === 'low' && !currentChannels.has(channel.toLowerCase())) {
      opportunities.push(`Low competition on ${channel} - potential early-mover advantage`);
    }
  }

  // Audience opportunities
  const gaps = findAudienceGaps(graph, model);
  opportunities.push(...gaps);

  return opportunities.slice(0, 5);
}

// ============================================================================
// Exports
// ============================================================================

export {
  type VerticalDataPoint,
  type VerticalStats,
};
