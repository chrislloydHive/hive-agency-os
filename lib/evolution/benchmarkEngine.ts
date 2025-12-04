// lib/evolution/benchmarkEngine.ts
// Phase 6: Benchmark Engine
//
// Calculates and maintains industry benchmarks from cross-company data

import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type { IndustryBenchmark, BenchmarkMetric } from './types';

// ============================================================================
// In-Memory Store
// ============================================================================

const benchmarks = new Map<string, IndustryBenchmark>();

// ============================================================================
// Benchmark Calculation
// ============================================================================

/**
 * Calculate benchmarks from company data
 */
export function calculateBenchmarks(
  companyData: Array<{
    companyId: string;
    graph: CompanyContextGraph;
    performance: {
      cpa: number;
      ctr: number;
      conversionRate: number;
      roas: number;
      cpc: number;
      impressionShare?: number;
      spend: number;
    };
    channelMix?: Record<string, number>;
    creativeStats?: {
      avgLifespan: number;
      topFormats: string[];
      testsPerMonth: number;
    };
  }>,
  period: string
): IndustryBenchmark[] {
  const calculatedBenchmarks: IndustryBenchmark[] = [];

  // Group by industry
  const industryGroups = groupByIndustry(companyData);

  for (const [industry, companies] of industryGroups) {
    if (companies.length < 3) continue; // Need minimum sample size

    // Extract business model groups within industry
    const businessModelGroups = groupByBusinessModel(companies);

    for (const [businessModel, modelCompanies] of businessModelGroups) {
      if (modelCompanies.length < 3) continue;

      const benchmark = createBenchmark(
        industry,
        businessModel,
        modelCompanies,
        period
      );

      benchmarks.set(benchmark.id, benchmark);
      calculatedBenchmarks.push(benchmark);
    }
  }

  return calculatedBenchmarks;
}

function createBenchmark(
  industry: string,
  businessModel: string,
  companies: Array<{
    performance: {
      cpa: number;
      ctr: number;
      conversionRate: number;
      roas: number;
      cpc: number;
      impressionShare?: number;
    };
    channelMix?: Record<string, number>;
    creativeStats?: {
      avgLifespan: number;
      topFormats: string[];
      testsPerMonth: number;
    };
  }>,
  period: string
): IndustryBenchmark {
  const performances = companies.map(c => c.performance);

  return {
    id: `benchmark_${industry}_${businessModel}_${period}`.replace(/\s+/g, '_'),
    industry,
    businessModel,
    period,

    metrics: {
      cpa: calculateBenchmarkMetric(performances.map(p => p.cpa)),
      ctr: calculateBenchmarkMetric(performances.map(p => p.ctr)),
      conversionRate: calculateBenchmarkMetric(performances.map(p => p.conversionRate)),
      roas: calculateBenchmarkMetric(performances.map(p => p.roas)),
      cpc: calculateBenchmarkMetric(performances.map(p => p.cpc)),
      impressionShare: calculateBenchmarkMetric(
        performances.map(p => p.impressionShare || 0).filter(v => v > 0)
      ),
    },

    channelMix: calculateChannelBenchmarks(companies),

    creativeBenchmarks: {
      avgCreativeLifespan: calculateMean(
        companies.map(c => c.creativeStats?.avgLifespan || 30)
      ),
      topFormats: findTopFormats(companies),
      avgTestsPerMonth: calculateMean(
        companies.map(c => c.creativeStats?.testsPerMonth || 2)
      ),
    },

    sampleSize: companies.length,
    dataQuality: companies.length >= 10 ? 'high' : companies.length >= 5 ? 'medium' : 'low',

    updatedAt: new Date().toISOString(),
  };
}

function calculateBenchmarkMetric(values: number[]): BenchmarkMetric {
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

  return {
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    mean: calculateMean(values),
    trend: 'stable', // Would need historical data to calculate
  };
}

function percentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateChannelBenchmarks(
  companies: Array<{ channelMix?: Record<string, number>; performance: { roas: number } }>
): Record<string, { avgAllocation: number; topPerformerAllocation: number; avgRoas: number }> {
  const channelData: Record<string, { allocations: number[]; roasValues: number[] }> = {};

  for (const company of companies) {
    if (!company.channelMix) continue;

    for (const [channel, allocation] of Object.entries(company.channelMix)) {
      if (!channelData[channel]) {
        channelData[channel] = { allocations: [], roasValues: [] };
      }
      channelData[channel].allocations.push(allocation);
      channelData[channel].roasValues.push(company.performance.roas);
    }
  }

  const result: Record<string, { avgAllocation: number; topPerformerAllocation: number; avgRoas: number }> = {};

  // Sort companies by ROAS to find top performers
  const sortedByRoas = [...companies].sort((a, b) => b.performance.roas - a.performance.roas);
  const topPerformers = sortedByRoas.slice(0, Math.ceil(companies.length * 0.25));

  for (const [channel, data] of Object.entries(channelData)) {
    const topPerformerAllocations = topPerformers
      .filter(c => c.channelMix?.[channel])
      .map(c => c.channelMix![channel]);

    result[channel] = {
      avgAllocation: calculateMean(data.allocations),
      topPerformerAllocation: calculateMean(topPerformerAllocations),
      avgRoas: calculateMean(data.roasValues),
    };
  }

  return result;
}

function findTopFormats(
  companies: Array<{ creativeStats?: { topFormats: string[] } }>
): string[] {
  const formatCounts: Record<string, number> = {};

  for (const company of companies) {
    if (!company.creativeStats?.topFormats) continue;

    for (const format of company.creativeStats.topFormats) {
      formatCounts[format] = (formatCounts[format] || 0) + 1;
    }
  }

  return Object.entries(formatCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([format]) => format);
}

// ============================================================================
// Benchmark Queries
// ============================================================================

/**
 * Get benchmark for an industry
 */
export function getBenchmark(
  industry: string,
  businessModel?: string,
  period?: string
): IndustryBenchmark | null {
  // Try exact match first
  if (businessModel && period) {
    const exactId = `benchmark_${industry}_${businessModel}_${period}`.replace(/\s+/g, '_');
    const exact = benchmarks.get(exactId);
    if (exact) return exact;
  }

  // Find best match
  for (const [id, benchmark] of benchmarks) {
    if (benchmark.industry === industry) {
      if (!businessModel || benchmark.businessModel === businessModel) {
        if (!period || benchmark.period === period) {
          return benchmark;
        }
      }
    }
  }

  return null;
}

/**
 * Get all benchmarks
 */
export function getAllBenchmarks(): IndustryBenchmark[] {
  return Array.from(benchmarks.values());
}

/**
 * Get benchmarks by industry
 */
export function getBenchmarksByIndustry(industry: string): IndustryBenchmark[] {
  return Array.from(benchmarks.values()).filter(b => b.industry === industry);
}

// ============================================================================
// Company Comparison
// ============================================================================

export interface BenchmarkComparison {
  companyId: string;
  industry: string;
  businessModel: string;
  metrics: Record<string, {
    value: number;
    percentile: number;
    vsMedian: number;
    status: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  }>;
  overallRank: 'top_10' | 'top_25' | 'top_50' | 'bottom_50' | 'bottom_25';
  strengths: string[];
  opportunities: string[];
}

/**
 * Compare a company to benchmarks
 */
export function compareCompanyToBenchmarks(
  companyId: string,
  industry: string,
  businessModel: string,
  performance: {
    cpa: number;
    ctr: number;
    conversionRate: number;
    roas: number;
    cpc: number;
  }
): BenchmarkComparison | null {
  const benchmark = getBenchmark(industry, businessModel);
  if (!benchmark) return null;

  const metricComparisons: BenchmarkComparison['metrics'] = {};
  const strengths: string[] = [];
  const opportunities: string[] = [];

  // Compare each metric
  const metricConfigs = [
    { key: 'cpa', lower_is_better: true, name: 'Cost per Acquisition' },
    { key: 'ctr', lower_is_better: false, name: 'Click-Through Rate' },
    { key: 'conversionRate', lower_is_better: false, name: 'Conversion Rate' },
    { key: 'roas', lower_is_better: false, name: 'Return on Ad Spend' },
    { key: 'cpc', lower_is_better: true, name: 'Cost per Click' },
  ];

  let totalPercentile = 0;

  for (const config of metricConfigs) {
    const benchmarkMetric = benchmark.metrics[config.key as keyof typeof benchmark.metrics];
    const companyValue = performance[config.key as keyof typeof performance];

    // Calculate percentile (simplified)
    let percentile: number;
    if (config.lower_is_better) {
      if (companyValue <= benchmarkMetric.p10) percentile = 90;
      else if (companyValue <= benchmarkMetric.p25) percentile = 75;
      else if (companyValue <= benchmarkMetric.p50) percentile = 50;
      else if (companyValue <= benchmarkMetric.p75) percentile = 25;
      else percentile = 10;
    } else {
      if (companyValue >= benchmarkMetric.p90) percentile = 90;
      else if (companyValue >= benchmarkMetric.p75) percentile = 75;
      else if (companyValue >= benchmarkMetric.p50) percentile = 50;
      else if (companyValue >= benchmarkMetric.p25) percentile = 25;
      else percentile = 10;
    }

    const vsMedian = ((companyValue - benchmarkMetric.p50) / benchmarkMetric.p50) * 100;

    let status: BenchmarkComparison['metrics'][string]['status'];
    if (percentile >= 90) status = 'excellent';
    else if (percentile >= 75) status = 'good';
    else if (percentile >= 50) status = 'average';
    else if (percentile >= 25) status = 'below_average';
    else status = 'poor';

    metricComparisons[config.key] = {
      value: companyValue,
      percentile,
      vsMedian,
      status,
    };

    totalPercentile += percentile;

    // Identify strengths and opportunities
    if (status === 'excellent' || status === 'good') {
      strengths.push(`Strong ${config.name} (top ${100 - percentile}%)`);
    } else if (status === 'below_average' || status === 'poor') {
      opportunities.push(`Improve ${config.name} (currently bottom ${percentile}%)`);
    }
  }

  // Calculate overall rank
  const avgPercentile = totalPercentile / metricConfigs.length;
  let overallRank: BenchmarkComparison['overallRank'];
  if (avgPercentile >= 90) overallRank = 'top_10';
  else if (avgPercentile >= 75) overallRank = 'top_25';
  else if (avgPercentile >= 50) overallRank = 'top_50';
  else if (avgPercentile >= 25) overallRank = 'bottom_50';
  else overallRank = 'bottom_25';

  return {
    companyId,
    industry,
    businessModel,
    metrics: metricComparisons,
    overallRank,
    strengths,
    opportunities,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function groupByIndustry<T extends { graph: CompanyContextGraph }>(
  data: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of data) {
    const industry = item.graph.identity?.industry?.value as string || 'Other';
    const group = groups.get(industry) || [];
    group.push(item);
    groups.set(industry, group);
  }

  return groups;
}

function groupByBusinessModel<T extends { graph: CompanyContextGraph }>(
  data: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of data) {
    const model = item.graph.identity?.businessModel?.value as string || 'General';
    const group = groups.get(model) || [];
    group.push(item);
    groups.set(model, group);
  }

  return groups;
}

// ============================================================================
// Default Benchmarks (Seed Data)
// ============================================================================

/**
 * Initialize with default benchmark data
 */
export function initializeDefaultBenchmarks(): void {
  const defaultBenchmarks: IndustryBenchmark[] = [
    {
      id: 'benchmark_ecommerce_dtc_2025-Q1',
      industry: 'E-commerce',
      subIndustry: 'Fashion',
      businessModel: 'DTC',
      period: '2025-Q1',
      metrics: {
        cpa: { p10: 15, p25: 25, p50: 45, p75: 75, p90: 120, mean: 50, trend: 'stable' },
        ctr: { p10: 0.5, p25: 0.8, p50: 1.2, p75: 1.8, p90: 2.5, mean: 1.3, trend: 'stable' },
        conversionRate: { p10: 1.0, p25: 1.5, p50: 2.5, p75: 4.0, p90: 6.0, mean: 2.8, trend: 'improving' },
        roas: { p10: 1.5, p25: 2.0, p50: 3.0, p75: 4.5, p90: 7.0, mean: 3.2, trend: 'stable' },
        cpc: { p10: 0.5, p25: 0.8, p50: 1.2, p75: 2.0, p90: 3.5, mean: 1.4, trend: 'stable' },
        impressionShare: { p10: 15, p25: 25, p50: 40, p75: 55, p90: 70, mean: 38, trend: 'stable' },
      },
      channelMix: {
        meta_ads: { avgAllocation: 35, topPerformerAllocation: 40, avgRoas: 3.5 },
        google_ads: { avgAllocation: 30, topPerformerAllocation: 35, avgRoas: 4.0 },
        tiktok_ads: { avgAllocation: 15, topPerformerAllocation: 15, avgRoas: 2.5 },
        email: { avgAllocation: 10, topPerformerAllocation: 5, avgRoas: 8.0 },
      },
      creativeBenchmarks: {
        avgCreativeLifespan: 21,
        topFormats: ['Video 15s', 'Carousel', 'UGC', 'Static'],
        avgTestsPerMonth: 4,
      },
      sampleSize: 150,
      dataQuality: 'high',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'benchmark_saas_b2b_2025-Q1',
      industry: 'SaaS',
      businessModel: 'B2B',
      period: '2025-Q1',
      metrics: {
        cpa: { p10: 50, p25: 100, p50: 200, p75: 350, p90: 600, mean: 220, trend: 'stable' },
        ctr: { p10: 0.3, p25: 0.5, p50: 0.8, p75: 1.2, p90: 2.0, mean: 0.9, trend: 'stable' },
        conversionRate: { p10: 0.5, p25: 1.0, p50: 2.0, p75: 3.5, p90: 5.0, mean: 2.2, trend: 'stable' },
        roas: { p10: 2.0, p25: 3.0, p50: 5.0, p75: 8.0, p90: 15.0, mean: 5.5, trend: 'stable' },
        cpc: { p10: 2.0, p25: 4.0, p50: 7.0, p75: 12.0, p90: 20.0, mean: 8.0, trend: 'stable' },
        impressionShare: { p10: 10, p25: 20, p50: 35, p75: 50, p90: 65, mean: 35, trend: 'stable' },
      },
      channelMix: {
        google_ads: { avgAllocation: 40, topPerformerAllocation: 45, avgRoas: 5.0 },
        linkedin_ads: { avgAllocation: 25, topPerformerAllocation: 30, avgRoas: 3.5 },
        meta_ads: { avgAllocation: 15, topPerformerAllocation: 10, avgRoas: 2.5 },
        content: { avgAllocation: 15, topPerformerAllocation: 15, avgRoas: 6.0 },
      },
      creativeBenchmarks: {
        avgCreativeLifespan: 45,
        topFormats: ['Whitepaper', 'Demo Video', 'Case Study', 'Webinar'],
        avgTestsPerMonth: 2,
      },
      sampleSize: 80,
      dataQuality: 'high',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'benchmark_local_services_2025-Q1',
      industry: 'Local Services',
      businessModel: 'Lead Generation',
      period: '2025-Q1',
      metrics: {
        cpa: { p10: 20, p25: 35, p50: 60, p75: 100, p90: 180, mean: 70, trend: 'stable' },
        ctr: { p10: 2.0, p25: 3.5, p50: 5.0, p75: 7.0, p90: 10.0, mean: 5.2, trend: 'improving' },
        conversionRate: { p10: 3.0, p25: 5.0, p50: 8.0, p75: 12.0, p90: 18.0, mean: 8.5, trend: 'stable' },
        roas: { p10: 2.0, p25: 3.5, p50: 5.0, p75: 8.0, p90: 12.0, mean: 5.5, trend: 'stable' },
        cpc: { p10: 1.0, p25: 2.0, p50: 3.5, p75: 6.0, p90: 10.0, mean: 4.0, trend: 'stable' },
        impressionShare: { p10: 20, p25: 35, p50: 50, p75: 65, p90: 80, mean: 48, trend: 'stable' },
      },
      channelMix: {
        google_ads: { avgAllocation: 50, topPerformerAllocation: 55, avgRoas: 6.0 },
        google_lsa: { avgAllocation: 25, topPerformerAllocation: 30, avgRoas: 8.0 },
        meta_ads: { avgAllocation: 15, topPerformerAllocation: 10, avgRoas: 3.0 },
        yelp: { avgAllocation: 10, topPerformerAllocation: 5, avgRoas: 4.0 },
      },
      creativeBenchmarks: {
        avgCreativeLifespan: 60,
        topFormats: ['Search Ads', 'Local Ads', 'Reviews', 'Before/After'],
        avgTestsPerMonth: 1,
      },
      sampleSize: 200,
      dataQuality: 'high',
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const benchmark of defaultBenchmarks) {
    benchmarks.set(benchmark.id, benchmark);
  }
}

// Initialize defaults
initializeDefaultBenchmarks();
