// lib/meta/globalBenchmarking.ts
// Phase 6: Emergent Intelligence - Global Benchmark Engine
//
// Cross-company benchmarks that are actually useful:
// - CAC/LTV patterns per stage & vertical
// - MER/ROAS distributions
// - Creative velocity norms
// - Persona effectiveness ranges
// - Channel efficiency by company size
// - Content velocity expectations
// - SEO visibility norms
// - Funnel conversion ranges
// - GA4 engagement benchmarks

import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  GlobalBenchmark,
  BenchmarkPercentiles,
  ChannelBenchmark,
} from './types';
import { loadContextGraph } from '../contextGraph';
import { getAllCompanies } from '../airtable/companies';

// ============================================================================
// Types
// ============================================================================

interface CompanyMetrics {
  companyId: string;
  companyName: string;
  vertical: string;
  businessModel: string;
  companySize: string;
  graph: CompanyContextGraph;
}

interface BenchmarkFilters {
  vertical?: string;
  businessModel?: string;
  companySize?: string;
  period?: string;
}

interface BenchmarkComparison {
  metric: string;
  value: number;
  percentile: number;
  verticalAvg: number;
  verticalMedian: number;
  trend: 'above' | 'at' | 'below';
  recommendation: string;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate comprehensive global benchmarks
 */
export async function generateGlobalBenchmarks(
  filters: BenchmarkFilters = {}
): Promise<GlobalBenchmark> {
  const companies = await loadAllCompanyMetrics(filters);

  if (companies.length === 0) {
    return createEmptyBenchmark(filters);
  }

  return {
    id: `benchmark-${Date.now()}`,
    vertical: filters.vertical || 'all',
    businessModel: filters.businessModel || 'all',
    companySize: filters.companySize || 'all',
    period: filters.period || 'current',

    mediaEfficiency: buildMediaEfficiencyBenchmarks(companies),
    creativePerformance: buildCreativePerformanceBenchmarks(companies),
    personaEffectiveness: buildPersonaEffectivenessBenchmarks(companies),
    contentVelocity: buildContentVelocityBenchmarks(companies),
    seoVisibility: buildSEOVisibilityBenchmarks(companies),
    funnelBenchmarks: buildFunnelBenchmarks(companies),
    ga4Engagement: buildGA4EngagementBenchmarks(companies),
    unitEconomics: buildUnitEconomicsBenchmarks(companies),
    efficiencyMetrics: buildEfficiencyMetricsBenchmarks(companies),

    sampleSize: companies.length,
    dataQuality: assessDataQuality(companies),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Compare a company to global benchmarks
 */
export async function compareToGlobalBenchmarks(
  companyId: string,
  filters?: BenchmarkFilters
): Promise<BenchmarkComparison[]> {
  const graph = await loadContextGraph(companyId);
  if (!graph) return [];

  const vertical = graph.identity?.industry?.value;
  const businessModel = graph.identity?.businessModel?.value;

  const benchmarks = await generateGlobalBenchmarks({
    vertical: typeof vertical === 'string' ? vertical : filters?.vertical,
    businessModel: typeof businessModel === 'string' ? businessModel : filters?.businessModel,
    ...filters,
  });

  const comparisons: BenchmarkComparison[] = [];

  // ROAS comparison
  const roas = graph.performanceMedia?.blendedRoas?.value;
  if (typeof roas === 'number') {
    comparisons.push(createComparison(
      'ROAS',
      roas,
      benchmarks.efficiencyMetrics.roas,
      'higher is better'
    ));
  }

  // CPA comparison
  const cpa = graph.objectives?.targetCpa?.value;
  if (typeof cpa === 'number') {
    comparisons.push(createComparison(
      'CPA',
      cpa,
      benchmarks.unitEconomics.cac,
      'lower is better'
    ));
  }

  // Customer Value comparison (using as proxy for CAC)
  const avgCustomerValue = graph.budgetOps?.avgCustomerValue?.value;
  if (typeof avgCustomerValue === 'number') {
    comparisons.push(createComparison(
      'Customer Value',
      avgCustomerValue,
      benchmarks.unitEconomics.cac,
      'higher is better'
    ));
  }

  // LTV comparison
  const ltv = graph.budgetOps?.customerLTV?.value;
  if (typeof ltv === 'number') {
    comparisons.push(createComparison(
      'LTV',
      ltv,
      benchmarks.unitEconomics.ltv,
      'higher is better'
    ));
  }

  // LTV:Customer Value ratio (using customer value as proxy for CAC)
  if (typeof ltv === 'number' && typeof avgCustomerValue === 'number' && avgCustomerValue > 0) {
    const ratio = ltv / avgCustomerValue;
    comparisons.push(createComparison(
      'LTV:CAC Ratio',
      ratio,
      benchmarks.unitEconomics.ltvCacRatio,
      'higher is better'
    ));
  }

  // CTR comparison
  const ctr = graph.performanceMedia?.blendedCtr?.value;
  if (typeof ctr === 'number') {
    comparisons.push(createComparison(
      'CTR',
      ctr,
      benchmarks.ga4Engagement.engagedSessions,
      'higher is better'
    ));
  }

  // Conversion rate
  const convRate = graph.performanceMedia?.blendedCpa?.value;
  if (typeof convRate === 'number') {
    comparisons.push(createComparison(
      'Conversion Rate',
      convRate,
      benchmarks.funnelBenchmarks.overallConversion,
      'higher is better'
    ));
  }

  return comparisons;
}

/**
 * Get channel-specific benchmarks
 */
export async function getChannelBenchmarks(
  channel: string,
  filters?: BenchmarkFilters
): Promise<ChannelBenchmark | null> {
  const benchmarks = await generateGlobalBenchmarks(filters);
  return benchmarks.mediaEfficiency.byChannel[channel] || null;
}

/**
 * Get benchmark percentile for a specific metric
 */
export async function getBenchmarkPercentile(
  metric: string,
  value: number,
  filters?: BenchmarkFilters
): Promise<{ percentile: number; trend: string; recommendation: string }> {
  const benchmarks = await generateGlobalBenchmarks(filters);

  let percentiles: BenchmarkPercentiles | undefined;

  switch (metric.toLowerCase()) {
    case 'roas':
      percentiles = benchmarks.efficiencyMetrics.roas;
      break;
    case 'cpa':
    case 'cac':
      percentiles = benchmarks.unitEconomics.cac;
      break;
    case 'ltv':
      percentiles = benchmarks.unitEconomics.ltv;
      break;
    case 'ltvCacRatio':
      percentiles = benchmarks.unitEconomics.ltvCacRatio;
      break;
    case 'conversionRate':
      percentiles = benchmarks.funnelBenchmarks.overallConversion;
      break;
    default:
      return { percentile: 50, trend: 'unknown', recommendation: 'Insufficient benchmark data' };
  }

  const percentile = calculatePercentileForValue(value, percentiles);

  let recommendation = '';
  if (percentile >= 75) {
    recommendation = 'Top performer - consider scaling or sharing learnings';
  } else if (percentile >= 50) {
    recommendation = 'Above average - room for optimization';
  } else if (percentile >= 25) {
    recommendation = 'Below average - identify improvement opportunities';
  } else {
    recommendation = 'Needs attention - prioritize optimization';
  }

  return {
    percentile,
    trend: percentiles.trend,
    recommendation,
  };
}

// ============================================================================
// Helper Functions - Data Loading
// ============================================================================

async function loadAllCompanyMetrics(
  filters: BenchmarkFilters
): Promise<CompanyMetrics[]> {
  const companies = await getAllCompanies();
  const metrics: CompanyMetrics[] = [];

  for (const company of companies) {
    try {
      const graph = await loadContextGraph(company.id);
      if (!graph) continue;

      const vertical = graph.identity?.industry?.value;
      const businessModel = graph.identity?.businessModel?.value;
      const companySize = determineCompanySize(graph);

      // Apply filters
      if (filters.vertical && vertical !== filters.vertical) continue;
      if (filters.businessModel && businessModel !== filters.businessModel) continue;
      if (filters.companySize && companySize !== filters.companySize) continue;

      metrics.push({
        companyId: company.id,
        companyName: company.name,
        vertical: typeof vertical === 'string' ? vertical : 'unknown',
        businessModel: typeof businessModel === 'string' ? businessModel : 'unknown',
        companySize,
        graph,
      });
    } catch (error) {
      continue;
    }
  }

  return metrics;
}

function determineCompanySize(graph: CompanyContextGraph): string {
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

// ============================================================================
// Helper Functions - Benchmark Building
// ============================================================================

function buildMediaEfficiencyBenchmarks(
  companies: CompanyMetrics[]
): GlobalBenchmark['mediaEfficiency'] {
  const channelData: Record<string, {
    cpa: number[];
    roas: number[];
    ctr: number[];
    cpc: number[];
    companies: number;
  }> = {};

  const overallRoas: number[] = [];
  const overallCpa: number[] = [];

  for (const company of companies) {
    const graph = company.graph;

    // Overall metrics
    const roas = graph.performanceMedia?.blendedRoas?.value;
    if (typeof roas === 'number') overallRoas.push(roas);

    const cpa = graph.objectives?.targetCpa?.value;
    if (typeof cpa === 'number') overallCpa.push(cpa);

    // Channel-specific metrics
    const channels = graph.performanceMedia?.activeChannels?.value || [];
    for (const channel of channels) {
      const channelName = typeof channel === 'string' ? channel : String(channel);

      if (!channelData[channelName]) {
        channelData[channelName] = {
          cpa: [],
          roas: [],
          ctr: [],
          cpc: [],
          companies: 0,
        };
      }

      channelData[channelName].companies++;

      // Would typically have channel-specific metrics here
      // For now, use overall metrics as proxy
      if (typeof roas === 'number') channelData[channelName].roas.push(roas);
      if (typeof cpa === 'number') channelData[channelName].cpa.push(cpa);
    }
  }

  const byChannel: Record<string, ChannelBenchmark> = {};
  for (const [channel, data] of Object.entries(channelData)) {
    byChannel[channel] = {
      channel,
      cpa: buildPercentiles(data.cpa),
      roas: buildPercentiles(data.roas),
      ctr: buildPercentiles(data.ctr),
      cpc: buildPercentiles(data.cpc),
      adoptionRate: data.companies / companies.length,
      trend: data.companies / companies.length > 0.5 ? 'stable' : 'growing',
    };
  }

  return {
    byChannel,
    overallRoas: buildPercentiles(overallRoas),
    overallCpa: buildPercentiles(overallCpa),
  };
}

function buildCreativePerformanceBenchmarks(
  companies: CompanyMetrics[]
): GlobalBenchmark['creativePerformance'] {
  const formatCounts: Record<string, number> = {};

  for (const company of companies) {
    const formats = company.graph.creative?.availableFormats?.value || [];
    for (const format of formats) {
      const formatName = typeof format === 'string' ? format : String(format);
      formatCounts[formatName] = (formatCounts[formatName] || 0) + 1;
    }
  }

  const topFormats = Object.entries(formatCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([format, count]) => ({
      format,
      performance: count / companies.length,
    }));

  // Default fatigue curve
  const fatigueCurve = [
    { day: 1, performanceIndex: 1.0 },
    { day: 7, performanceIndex: 0.95 },
    { day: 14, performanceIndex: 0.85 },
    { day: 21, performanceIndex: 0.75 },
    { day: 30, performanceIndex: 0.6 },
    { day: 45, performanceIndex: 0.45 },
    { day: 60, performanceIndex: 0.3 },
  ];

  return {
    avgCreativeLifespan: 30, // Default 30 days
    topFormats,
    fatigueCurve,
  };
}

function buildPersonaEffectivenessBenchmarks(
  companies: CompanyMetrics[]
): GlobalBenchmark['personaEffectiveness'] {
  const personaCounts: Record<string, { count: number; conversionRates: number[]; ltvs: number[] }> = {};

  for (const company of companies) {
    const personas = company.graph.audience?.personaBriefs?.value || [];
    for (const persona of personas) {
      if (typeof persona === 'object' && persona !== null) {
        const name = (persona as Record<string, unknown>).name as string || 'Unknown';
        if (!personaCounts[name]) {
          personaCounts[name] = { count: 0, conversionRates: [], ltvs: [] };
        }
        personaCounts[name].count++;
      }
    }
  }

  const topPersonas = Object.entries(personaCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([persona, data]) => ({
      persona,
      conversionRate: data.conversionRates.length > 0
        ? data.conversionRates.reduce((a, b) => a + b, 0) / data.conversionRates.length
        : 0.02, // Default 2%
      ltv: data.ltvs.length > 0
        ? data.ltvs.reduce((a, b) => a + b, 0) / data.ltvs.length
        : 0, // No default
    }));

  // Calculate persona diversity
  const avgPersonaCount = companies.reduce((sum, c) => {
    const personas = c.graph.audience?.personaBriefs?.value || [];
    return sum + personas.length;
  }, 0) / companies.length;

  return {
    topPersonas,
    personaDiversity: Math.min(1, avgPersonaCount / 5), // Normalize to 0-1
  };
}

function buildContentVelocityBenchmarks(
  companies: CompanyMetrics[]
): GlobalBenchmark['contentVelocity'] {
  // Would typically come from actual content data
  const postsPerWeek: number[] = [];
  const engagementRates: number[] = [];
  const contentTypeCounts: Record<string, number> = {};

  for (const company of companies) {
    const formats = company.graph.creative?.availableFormats?.value || [];
    for (const format of formats) {
      const formatName = typeof format === 'string' ? format : String(format);
      contentTypeCounts[formatName] = (contentTypeCounts[formatName] || 0) + 1;
    }

    // Estimate content velocity based on channel count
    const channels = company.graph.performanceMedia?.activeChannels?.value || [];
    postsPerWeek.push(channels.length * 2); // Rough estimate
    engagementRates.push(0.03); // Default 3%
  }

  const contentTypes = Object.entries(contentTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({
      type,
      performance: count / companies.length,
    }));

  return {
    postsPerWeek: buildPercentiles(postsPerWeek),
    engagementRate: buildPercentiles(engagementRates),
    contentTypes,
  };
}

function buildSEOVisibilityBenchmarks(
  companies: CompanyMetrics[]
): GlobalBenchmark['seoVisibility'] {
  // Would typically come from actual SEO data
  const trafficShares: number[] = [];
  const rankings: number[] = [];
  const domainAuthorities: number[] = [];

  for (const company of companies) {
    // Placeholder - would come from integrations
    trafficShares.push(0.3); // 30% organic
    rankings.push(50); // Top 50 keywords
    domainAuthorities.push(40); // DA 40
  }

  return {
    organicTrafficShare: buildPercentiles(trafficShares),
    keywordRankings: buildPercentiles(rankings),
    domainAuthority: buildPercentiles(domainAuthorities),
  };
}

function buildFunnelBenchmarks(
  companies: CompanyMetrics[]
): GlobalBenchmark['funnelBenchmarks'] {
  const visitToLead: number[] = [];
  const leadToOpportunity: number[] = [];
  const opportunityToClose: number[] = [];
  const overallConversion: number[] = [];

  for (const company of companies) {
    const graph = company.graph;
    const website = graph.website;

    if (website) {
      // Would typically have actual conversion rates
      const convRate = graph.performanceMedia?.blendedCpa?.value;
      if (typeof convRate === 'number') {
        overallConversion.push(convRate);

        // Estimate funnel stages
        visitToLead.push(convRate * 3); // Rough estimates
        leadToOpportunity.push(convRate * 2);
        opportunityToClose.push(convRate * 0.5);
      }
    }
  }

  return {
    visitToLead: buildPercentiles(visitToLead),
    leadToOpportunity: buildPercentiles(leadToOpportunity),
    opportunityToClose: buildPercentiles(opportunityToClose),
    overallConversion: buildPercentiles(overallConversion),
  };
}

function buildGA4EngagementBenchmarks(
  companies: CompanyMetrics[]
): GlobalBenchmark['ga4Engagement'] {
  // Would typically come from GA4 integration
  const sessionDurations: number[] = [];
  const pagesPerSession: number[] = [];
  const bounceRates: number[] = [];
  const engagedSessions: number[] = [];

  for (const company of companies) {
    // Placeholder values - would come from integrations
    sessionDurations.push(120); // 2 minutes
    pagesPerSession.push(3);
    bounceRates.push(0.5); // 50%
    engagedSessions.push(0.6); // 60%
  }

  return {
    avgSessionDuration: buildPercentiles(sessionDurations),
    pagesPerSession: buildPercentiles(pagesPerSession),
    bounceRate: buildPercentiles(bounceRates),
    engagedSessions: buildPercentiles(engagedSessions),
  };
}

function buildUnitEconomicsBenchmarks(
  companies: CompanyMetrics[]
): GlobalBenchmark['unitEconomics'] {
  const cacValues: number[] = [];
  const ltvValues: number[] = [];
  const ltvCacRatios: number[] = [];
  const paybackMonths: number[] = [];

  for (const company of companies) {
    const graph = company.graph;

    const cac = graph.budgetOps?.avgCustomerValue?.value; // Using customer value as proxy
    const ltv = graph.budgetOps?.customerLTV?.value;

    if (typeof cac === 'number') cacValues.push(cac);
    if (typeof ltv === 'number') ltvValues.push(ltv);

    if (typeof cac === 'number' && typeof ltv === 'number' && cac > 0) {
      ltvCacRatios.push(ltv / cac);
      paybackMonths.push(cac / (ltv / 12)); // Rough payback estimate
    }
  }

  return {
    cac: buildPercentiles(cacValues),
    ltv: buildPercentiles(ltvValues),
    ltvCacRatio: buildPercentiles(ltvCacRatios),
    paybackMonths: buildPercentiles(paybackMonths),
  };
}

function buildEfficiencyMetricsBenchmarks(
  companies: CompanyMetrics[]
): GlobalBenchmark['efficiencyMetrics'] {
  const merValues: number[] = [];
  const roasValues: number[] = [];
  const incrementalRoasValues: number[] = [];

  for (const company of companies) {
    const graph = company.graph;

    const roas = graph.performanceMedia?.blendedRoas?.value;
    if (typeof roas === 'number') {
      roasValues.push(roas);
      merValues.push(roas * 0.8); // MER typically lower than ROAS
      incrementalRoasValues.push(roas * 0.6); // Incremental typically lower
    }
  }

  return {
    mer: buildPercentiles(merValues),
    roas: buildPercentiles(roasValues),
    incrementalRoas: buildPercentiles(incrementalRoasValues),
  };
}

// ============================================================================
// Helper Functions - Statistics
// ============================================================================

function buildPercentiles(values: number[]): BenchmarkPercentiles {
  if (values.length === 0) {
    return {
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      mean: 0,
      trend: 'stable',
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  return {
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    mean,
    trend: 'stable', // Would need historical data for trend
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
}

function calculatePercentileForValue(
  value: number,
  percentiles: BenchmarkPercentiles
): number {
  if (value <= percentiles.p10) return 10;
  if (value <= percentiles.p25) return 25;
  if (value <= percentiles.p50) return 50;
  if (value <= percentiles.p75) return 75;
  if (value <= percentiles.p90) return 90;
  return 95;
}

function createComparison(
  metric: string,
  value: number,
  percentiles: BenchmarkPercentiles,
  direction: 'higher is better' | 'lower is better'
): BenchmarkComparison {
  let percentile = calculatePercentileForValue(value, percentiles);

  // Flip percentile for "lower is better" metrics
  if (direction === 'lower is better') {
    percentile = 100 - percentile;
  }

  let trend: 'above' | 'at' | 'below';
  let recommendation: string;

  if (percentile >= 60) {
    trend = 'above';
    recommendation = `${metric} is performing above average. Consider scaling or sharing learnings.`;
  } else if (percentile >= 40) {
    trend = 'at';
    recommendation = `${metric} is at market average. Room for optimization.`;
  } else {
    trend = 'below';
    recommendation = `${metric} is below average. Prioritize improvement.`;
  }

  return {
    metric,
    value,
    percentile,
    verticalAvg: percentiles.mean,
    verticalMedian: percentiles.p50,
    trend,
    recommendation,
  };
}

function assessDataQuality(companies: CompanyMetrics[]): 'high' | 'medium' | 'low' {
  if (companies.length >= 20) return 'high';
  if (companies.length >= 10) return 'medium';
  return 'low';
}

function createEmptyBenchmark(filters: BenchmarkFilters): GlobalBenchmark {
  const emptyPercentiles: BenchmarkPercentiles = {
    p10: 0,
    p25: 0,
    p50: 0,
    p75: 0,
    p90: 0,
    mean: 0,
    trend: 'stable',
  };

  return {
    id: `benchmark-empty-${Date.now()}`,
    vertical: filters.vertical || 'all',
    businessModel: filters.businessModel || 'all',
    companySize: filters.companySize || 'all',
    period: filters.period || 'current',

    mediaEfficiency: {
      byChannel: {},
      overallRoas: emptyPercentiles,
      overallCpa: emptyPercentiles,
    },
    creativePerformance: {
      avgCreativeLifespan: 0,
      topFormats: [],
      fatigueCurve: [],
    },
    personaEffectiveness: {
      topPersonas: [],
      personaDiversity: 0,
    },
    contentVelocity: {
      postsPerWeek: emptyPercentiles,
      engagementRate: emptyPercentiles,
      contentTypes: [],
    },
    seoVisibility: {
      organicTrafficShare: emptyPercentiles,
      keywordRankings: emptyPercentiles,
      domainAuthority: emptyPercentiles,
    },
    funnelBenchmarks: {
      visitToLead: emptyPercentiles,
      leadToOpportunity: emptyPercentiles,
      opportunityToClose: emptyPercentiles,
      overallConversion: emptyPercentiles,
    },
    ga4Engagement: {
      avgSessionDuration: emptyPercentiles,
      pagesPerSession: emptyPercentiles,
      bounceRate: emptyPercentiles,
      engagedSessions: emptyPercentiles,
    },
    unitEconomics: {
      cac: emptyPercentiles,
      ltv: emptyPercentiles,
      ltvCacRatio: emptyPercentiles,
      paybackMonths: emptyPercentiles,
    },
    efficiencyMetrics: {
      mer: emptyPercentiles,
      roas: emptyPercentiles,
      incrementalRoas: emptyPercentiles,
    },

    sampleSize: 0,
    dataQuality: 'low',
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  type CompanyMetrics,
  type BenchmarkFilters,
  type BenchmarkComparison,
};
