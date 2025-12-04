// lib/contextGraph/benchmarks/benchmarkEngine.ts
// Cross-company benchmarking engine
//
// Phase 4: Benchmark company performance against peers

import { randomUUID } from 'crypto';
import type { CompanyContextGraph, DomainName } from '../companyContextGraph';
import type {
  BenchmarkMetric,
  BenchmarkPosition,
  BenchmarkReport,
  IndustryCategory,
  ScaleCategory,
} from './types';
import {
  getCompanyClassification,
  getAllEmbeddings,
  findSimilarCompanies,
} from './embeddingEngine';

// ============================================================================
// Benchmark Storage (In-memory for now, replace with DB)
// ============================================================================

/** Store of benchmark metrics */
const benchmarkStore = new Map<string, BenchmarkMetric>();

/** Store of company values for benchmarking */
const companyValuesStore = new Map<string, Map<string, number | null>>();

// ============================================================================
// Benchmark Definitions
// ============================================================================

/**
 * Predefined benchmark metrics
 */
const BENCHMARK_DEFINITIONS: Array<{
  id: string;
  name: string;
  description: string;
  domain: DomainName;
  path: string;
  transform?: (value: unknown) => number | null;
}> = [
  {
    id: 'cpa_target',
    name: 'Target CPA',
    description: 'Target cost per acquisition',
    domain: 'performanceMedia',
    path: 'targetCpa',
    transform: (v) => typeof v === 'number' ? v : null,
  },
  {
    id: 'monthly_budget',
    name: 'Monthly Budget',
    description: 'Monthly media budget',
    domain: 'budgetOps',
    path: 'monthlyBudget',
    transform: (v) => typeof v === 'number' ? v : null,
  },
  {
    id: 'channel_count',
    name: 'Active Channels',
    description: 'Number of active media channels',
    domain: 'performanceMedia',
    path: 'channels',
    transform: (v) => Array.isArray(v) ? v.length : null,
  },
  {
    id: 'keyword_count',
    name: 'Target Keywords',
    description: 'Number of primary SEO keywords',
    domain: 'seo',
    path: 'primaryKeywords',
    transform: (v) => Array.isArray(v) ? v.length : null,
  },
  {
    id: 'content_pillars',
    name: 'Content Pillars',
    description: 'Number of content pillars',
    domain: 'content',
    path: 'contentPillars',
    transform: (v) => Array.isArray(v) ? v.length : null,
  },
  {
    id: 'audience_segments',
    name: 'Audience Segments',
    description: 'Number of defined audience segments',
    domain: 'audience',
    path: 'secondaryAudiences',
    transform: (v) => Array.isArray(v) ? v.length + 1 : 1,  // +1 for primary
  },
];

// ============================================================================
// Benchmark Computation
// ============================================================================

/**
 * Record a company's values for benchmarking
 */
export function recordCompanyValues(
  companyId: string,
  graph: CompanyContextGraph
): void {
  const values = new Map<string, number | null>();

  for (const def of BENCHMARK_DEFINITIONS) {
    const domain = graph[def.domain];
    if (!domain) {
      values.set(def.id, null);
      continue;
    }

    const field = (domain as Record<string, unknown>)[def.path];
    if (!field || typeof field !== 'object' || !('value' in field)) {
      values.set(def.id, null);
      continue;
    }

    const rawValue = (field as { value: unknown }).value;
    const transformedValue = def.transform
      ? def.transform(rawValue)
      : (typeof rawValue === 'number' ? rawValue : null);

    values.set(def.id, transformedValue);
  }

  companyValuesStore.set(companyId, values);
}

/**
 * Compute benchmark metrics across all companies
 */
export function computeBenchmarks(): BenchmarkMetric[] {
  const metrics: BenchmarkMetric[] = [];

  for (const def of BENCHMARK_DEFINITIONS) {
    const values: number[] = [];
    const byIndustry: Record<string, number[]> = {};
    const byScale: Record<string, number[]> = {};

    // Collect values
    for (const [companyId, companyValues] of companyValuesStore) {
      const value = companyValues.get(def.id);
      if (value === null || value === undefined) continue;

      values.push(value);

      // Group by industry
      const classification = getCompanyClassification(companyId);
      if (classification) {
        if (!byIndustry[classification.industry]) {
          byIndustry[classification.industry] = [];
        }
        byIndustry[classification.industry].push(value);

        if (!byScale[classification.scale]) {
          byScale[classification.scale] = [];
        }
        byScale[classification.scale].push(value);
      }
    }

    if (values.length === 0) continue;

    // Compute statistics
    const sorted = values.sort((a, b) => a - b);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    const metric: BenchmarkMetric = {
      id: def.id,
      name: def.name,
      description: def.description,
      domain: def.domain,
      path: def.path,
      aggregation: 'percentile',
      values: {
        overall: average,
        byIndustry: Object.fromEntries(
          Object.entries(byIndustry).map(([k, v]) => [
            k,
            v.reduce((a, b) => a + b, 0) / v.length,
          ])
        ),
        byScale: Object.fromEntries(
          Object.entries(byScale).map(([k, v]) => [
            k,
            v.reduce((a, b) => a + b, 0) / v.length,
          ])
        ),
        percentiles: {
          10: sorted[Math.floor(sorted.length * 0.1)],
          25: sorted[Math.floor(sorted.length * 0.25)],
          50: median,
          75: sorted[Math.floor(sorted.length * 0.75)],
          90: sorted[Math.floor(sorted.length * 0.9)],
        },
      },
      sampleSize: values.length,
      lastUpdated: new Date().toISOString(),
    };

    benchmarkStore.set(def.id, metric);
    metrics.push(metric);
  }

  return metrics;
}

// ============================================================================
// Company Benchmarking
// ============================================================================

/**
 * Get benchmark position for a company
 */
export function getBenchmarkPosition(
  companyId: string,
  metricId: string
): BenchmarkPosition | null {
  const metric = benchmarkStore.get(metricId);
  if (!metric) return null;

  const companyValues = companyValuesStore.get(companyId);
  const value = companyValues?.get(metricId) ?? null;

  // Collect all values for this metric
  const allValues: Array<{ companyId: string; value: number }> = [];
  for (const [cId, values] of companyValuesStore) {
    const v = values.get(metricId);
    if (v !== null && v !== undefined) {
      allValues.push({ companyId: cId, value: v });
    }
  }

  if (allValues.length === 0) return null;

  // Sort and find position
  const sorted = allValues.sort((a, b) => a.value - b.value);
  const rank = value !== null
    ? sorted.findIndex(v => v.companyId === companyId) + 1
    : allValues.length;

  const percentile = value !== null
    ? Math.round((rank / allValues.length) * 100)
    : 0;

  const average = metric.values.overall || 0;
  const median = metric.values.percentiles?.[50] || 0;
  const best = sorted[sorted.length - 1]?.value || 0;

  const vsAverage = value !== null && average !== 0
    ? Math.round(((value - average) / average) * 100)
    : 0;

  const vsMedian = value !== null && median !== 0
    ? Math.round(((value - median) / median) * 100)
    : 0;

  const vsBest = value !== null && best !== 0
    ? Math.round(((value - best) / best) * 100)
    : 0;

  // Determine status
  let status: BenchmarkPosition['status'];
  if (percentile >= 90) status = 'leading';
  else if (percentile >= 70) status = 'above_average';
  else if (percentile >= 30) status = 'average';
  else if (percentile >= 10) status = 'below_average';
  else status = 'lagging';

  // Generate insight
  const insight = generateInsight(metric, value, status, vsAverage);

  return {
    companyId,
    metric,
    value,
    percentile,
    rank,
    totalInGroup: allValues.length,
    vsAverage,
    vsMedian,
    vsBest,
    status,
    insight,
  };
}

function generateInsight(
  metric: BenchmarkMetric,
  value: number | null,
  status: BenchmarkPosition['status'],
  vsAverage: number
): string {
  if (value === null) {
    return `No data available for ${metric.name}. Consider adding this information.`;
  }

  switch (status) {
    case 'leading':
      return `Your ${metric.name} is in the top 10% of companies. This is a competitive advantage.`;
    case 'above_average':
      return `Your ${metric.name} is ${vsAverage}% above average. Good positioning.`;
    case 'average':
      return `Your ${metric.name} is in line with industry averages.`;
    case 'below_average':
      return `Your ${metric.name} is ${Math.abs(vsAverage)}% below average. Consider improving.`;
    case 'lagging':
      return `Your ${metric.name} is significantly below peers. This may be a priority area.`;
  }
}

// ============================================================================
// Benchmark Reports
// ============================================================================

/**
 * Generate full benchmark report for a company
 */
export function generateBenchmarkReport(
  companyId: string,
  companyName: string,
  comparisonType: 'industry' | 'scale' | 'similar' | 'all' = 'all'
): BenchmarkReport {
  const positions: BenchmarkPosition[] = [];

  // Get all benchmark positions
  for (const metricId of benchmarkStore.keys()) {
    const position = getBenchmarkPosition(companyId, metricId);
    if (position) {
      positions.push(position);
    }
  }

  // Calculate summary
  const scores = positions
    .filter(p => p.value !== null)
    .map(p => p.percentile);

  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const strengths = positions
    .filter(p => p.status === 'leading' || p.status === 'above_average')
    .map(p => p.metric.name);

  const weaknesses = positions
    .filter(p => p.status === 'lagging' || p.status === 'below_average')
    .map(p => p.metric.name);

  const opportunities = positions
    .filter(p => p.value === null)
    .map(p => `Add ${p.metric.name} data to unlock benchmarking`);

  // Get comparison group info
  const classification = getCompanyClassification(companyId);
  let groupName = 'All Companies';
  let groupSize = companyValuesStore.size;

  if (comparisonType === 'industry' && classification) {
    groupName = `${classification.industry} Industry`;
  } else if (comparisonType === 'scale' && classification) {
    groupName = `${classification.scale} Scale`;
  } else if (comparisonType === 'similar') {
    const similar = findSimilarCompanies(companyId, { limit: 20 });
    groupName = 'Similar Companies';
    groupSize = similar.length;
  }

  return {
    companyId,
    companyName,
    comparisonGroup: {
      type: comparisonType,
      name: groupName,
      size: groupSize,
    },
    positions,
    summary: {
      overallScore,
      strengths,
      weaknesses,
      opportunities,
    },
    generatedAt: new Date().toISOString(),
    dataFreshness: new Date().toISOString(),
  };
}

// ============================================================================
// Comparison Methods
// ============================================================================

/**
 * Compare two companies
 */
export function compareCompanies(
  companyId1: string,
  companyId2: string
): Array<{
  metric: BenchmarkMetric;
  company1Value: number | null;
  company2Value: number | null;
  difference: number | null;
  winner: string | null;
}> {
  const results: Array<{
    metric: BenchmarkMetric;
    company1Value: number | null;
    company2Value: number | null;
    difference: number | null;
    winner: string | null;
  }> = [];

  const values1 = companyValuesStore.get(companyId1);
  const values2 = companyValuesStore.get(companyId2);

  for (const [metricId, metric] of benchmarkStore) {
    const v1 = values1?.get(metricId) ?? null;
    const v2 = values2?.get(metricId) ?? null;

    let difference: number | null = null;
    let winner: string | null = null;

    if (v1 !== null && v2 !== null) {
      difference = v1 - v2;
      winner = v1 > v2 ? companyId1 : (v2 > v1 ? companyId2 : null);
    } else if (v1 !== null) {
      winner = companyId1;
    } else if (v2 !== null) {
      winner = companyId2;
    }

    results.push({
      metric,
      company1Value: v1,
      company2Value: v2,
      difference,
      winner,
    });
  }

  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all benchmark metrics
 */
export function getAllBenchmarks(): BenchmarkMetric[] {
  return Array.from(benchmarkStore.values());
}

/**
 * Get benchmark by ID
 */
export function getBenchmark(metricId: string): BenchmarkMetric | undefined {
  return benchmarkStore.get(metricId);
}

/**
 * Get benchmark stats
 */
export function getBenchmarkStats(): {
  totalMetrics: number;
  totalCompanies: number;
  averageCoverage: number;
} {
  const totalMetrics = benchmarkStore.size;
  const totalCompanies = companyValuesStore.size;

  let totalValues = 0;
  let nonNullValues = 0;

  for (const values of companyValuesStore.values()) {
    for (const value of values.values()) {
      totalValues++;
      if (value !== null) nonNullValues++;
    }
  }

  return {
    totalMetrics,
    totalCompanies,
    averageCoverage: totalValues > 0 ? nonNullValues / totalValues : 0,
  };
}
