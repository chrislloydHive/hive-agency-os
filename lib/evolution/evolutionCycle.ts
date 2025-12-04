// lib/evolution/evolutionCycle.ts
// Phase 6: Evolution Cycle Engine
//
// Orchestrates the cross-company learning cycle:
// 1. Collect learnings from all companies
// 2. Discover and validate patterns
// 3. Update benchmarks
// 4. Generate insights
// 5. Distribute recommendations

import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type { ExperimentPlan } from '../autopilot/types';
import type {
  EvolutionCycleResult,
  EvolutionAnalytics,
  Pattern,
  CrossCompanyInsight,
} from './types';
import {
  discoverPatterns,
  getPatterns,
  getAllLearnings,
  updatePatternStatus,
  analyzePatternsTrends,
} from './patternDiscovery';
import {
  calculateBenchmarks,
  getAllBenchmarks,
} from './benchmarkEngine';
import {
  generateInsights,
  getInsights,
  generatePatternRecommendations,
} from './insightGenerator';

// ============================================================================
// In-Memory Store
// ============================================================================

const cycleHistory: EvolutionCycleResult[] = [];
let lastCycleAt: string | null = null;

// ============================================================================
// Evolution Cycle
// ============================================================================

/**
 * Run a complete evolution cycle
 */
export async function runEvolutionCycle(
  companyData: Array<{
    companyId: string;
    graph: CompanyContextGraph;
    experiments: ExperimentPlan[];
    performance: {
      cpa: number;
      ctr: number;
      conversionRate: number;
      roas: number;
      cpc: number;
      spend: number;
      conversions: number;
    };
  }>,
  options: {
    discoverPatterns?: boolean;
    updateBenchmarks?: boolean;
    generateInsights?: boolean;
    distributeRecommendations?: boolean;
  } = {}
): Promise<EvolutionCycleResult> {
  const {
    discoverPatterns: shouldDiscoverPatterns = true,
    updateBenchmarks: shouldUpdateBenchmarks = true,
    generateInsights: shouldGenerateInsights = true,
    distributeRecommendations: shouldDistributeRecommendations = true,
  } = options;

  const startTime = Date.now();
  const cycleId = `cycle_${startTime}`;

  const result: EvolutionCycleResult = {
    id: cycleId,
    runAt: new Date(startTime).toISOString(),
    duration: 0,
    companiesAnalyzed: companyData.length,
    experimentsAnalyzed: 0,
    learningsProcessed: 0,
    newPatterns: 0,
    updatedPatterns: 0,
    deprecatedPatterns: 0,
    newInsights: 0,
    benchmarksUpdated: 0,
    dataQuality: 0,
    confidenceLevel: 0,
    patternIds: [],
    insightIds: [],
    status: 'success',
    errors: [],
  };

  try {
    // Count experiments
    result.experimentsAnalyzed = companyData.reduce(
      (sum, c) => sum + c.experiments.length,
      0
    );

    // Count learnings
    const learnings = getAllLearnings();
    result.learningsProcessed = learnings.length;

    // Step 1: Discover patterns
    if (shouldDiscoverPatterns) {
      const hypotheses = companyData.flatMap(c =>
        c.experiments
          .filter(e => e.status === 'completed')
          .map(e => ({ hypothesis: e.description, id: e.hypothesisId }))
      );

      const patterns = await discoverPatterns(
        companyData.map(c => ({
          ...c,
          hypotheses: hypotheses as any,
        })),
        { minSampleSize: 3, minConfidence: 0.6 }
      );

      result.newPatterns = patterns.length;
      result.patternIds = patterns.map(p => p.id);

      // Validate existing patterns
      const existingPatterns = getPatterns({ status: 'emerging' });
      for (const pattern of existingPatterns) {
        const validation = validatePattern(pattern, companyData);
        if (validation.validated) {
          updatePatternStatus(pattern.id, 'validated', validation);
          result.updatedPatterns++;
        } else if (validation.shouldDeprecate) {
          updatePatternStatus(pattern.id, 'deprecated');
          result.deprecatedPatterns++;
        }
      }
    }

    // Step 2: Update benchmarks
    if (shouldUpdateBenchmarks) {
      const period = getCurrentPeriod();
      const benchmarks = calculateBenchmarks(
        companyData.map(c => ({
          ...c,
          channelMix: extractChannelMix(c.graph),
          creativeStats: extractCreativeStats(c.graph),
        })),
        period
      );
      result.benchmarksUpdated = benchmarks.length;
    }

    // Step 3: Generate insights
    if (shouldGenerateInsights) {
      const insights = await generateInsights(companyData, {
        useAI: true,
        minConfidence: 0.7,
      });
      result.newInsights = insights.length;
      result.insightIds = insights.map(i => i.id);
    }

    // Step 4: Distribute recommendations
    if (shouldDistributeRecommendations) {
      for (const company of companyData) {
        generatePatternRecommendations(
          company.companyId,
          company.graph,
          company.performance
        );
      }
    }

    // Calculate data quality
    result.dataQuality = calculateDataQuality(companyData);
    result.confidenceLevel = calculateConfidenceLevel(result);

  } catch (error) {
    result.status = 'failed';
    result.errors = [error instanceof Error ? error.message : 'Unknown error'];
  }

  result.duration = Date.now() - startTime;
  lastCycleAt = result.runAt;

  // Store cycle result
  cycleHistory.push(result);
  if (cycleHistory.length > 100) {
    cycleHistory.shift();
  }

  return result;
}

// ============================================================================
// Pattern Validation
// ============================================================================

function validatePattern(
  pattern: Pattern,
  companyData: Array<{
    companyId: string;
    graph: CompanyContextGraph;
    performance: { cpa: number; roas: number; ctr: number };
  }>
): { validated: boolean; successRate: number; confidence: number; shouldDeprecate: boolean } {
  // Find companies that match pattern conditions
  const matchingCompanies = companyData.filter(c =>
    patternConditionsMatch(pattern, c.graph)
  );

  if (matchingCompanies.length < 3) {
    return { validated: false, successRate: 0, confidence: 0, shouldDeprecate: false };
  }

  // Check if outcome is achieved
  const successCount = matchingCompanies.filter(c =>
    patternOutcomeAchieved(pattern, c.performance)
  ).length;

  const successRate = successCount / matchingCompanies.length;
  const confidence = Math.min(0.95, 0.5 + (matchingCompanies.length / 20) * 0.45);

  return {
    validated: successRate >= 0.6 && confidence >= 0.7,
    successRate,
    confidence,
    shouldDeprecate: successRate < 0.3 && matchingCompanies.length >= 10,
  };
}

function patternConditionsMatch(pattern: Pattern, graph: CompanyContextGraph): boolean {
  for (const condition of pattern.conditions) {
    const value = getNestedValue(graph, condition.field);

    switch (condition.operator) {
      case 'equals':
        if (value !== condition.value) return false;
        break;
      case 'contains':
        if (!String(value).includes(String(condition.value))) return false;
        break;
      case 'greater_than':
        if (Number(value) <= Number(condition.value)) return false;
        break;
      case 'less_than':
        if (Number(value) >= Number(condition.value)) return false;
        break;
      case 'in_list':
        if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false;
        break;
    }
  }
  return true;
}

function patternOutcomeAchieved(
  pattern: Pattern,
  performance: { cpa: number; roas: number; ctr: number }
): boolean {
  const metric = pattern.effect.metric;
  const value = performance[metric as keyof typeof performance];

  if (value === undefined) return false;

  // Check if performance is in good range based on direction
  if (pattern.effect.direction === 'increase') {
    return value > 0; // Simplified - would compare to benchmark
  } else {
    return value < 100; // Simplified - would compare to benchmark
  }
}

function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part]?.value ?? current[part];
  }

  return current;
}

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get evolution analytics
 */
export function getEvolutionAnalytics(): EvolutionAnalytics {
  const patterns = getPatterns();
  const insights = getInsights();
  const learnings = getAllLearnings();
  const benchmarks = getAllBenchmarks();

  // Count patterns by type
  const patternsByType: Record<string, number> = {};
  for (const pattern of patterns) {
    patternsByType[pattern.type] = (patternsByType[pattern.type] || 0) + 1;
  }

  // Count insights by type
  const insightsByType: Record<string, number> = {};
  for (const insight of insights) {
    insightsByType[insight.type] = (insightsByType[insight.type] || 0) + 1;
  }

  // Count learnings by type
  const learningsByType: Record<string, number> = {};
  for (const learning of learnings) {
    learningsByType[learning.type] = (learningsByType[learning.type] || 0) + 1;
  }

  // Calculate success rates
  const validatedPatterns = patterns.filter(p => p.status === 'validated' || p.status === 'stable');
  const patternSuccessRate = patterns.length > 0
    ? validatedPatterns.length / patterns.length
    : 0;

  const actionableInsights = insights.filter(i => i.actionable);
  const actionableInsightsRate = insights.length > 0
    ? actionableInsights.length / insights.length
    : 0;

  const sharedLearnings = learnings.filter(l => l.status === 'shared');
  const learningsSharedRate = learnings.length > 0
    ? sharedLearnings.length / learnings.length
    : 0;

  // Calculate health scores
  const evolutionHealth = Math.round(
    (patternSuccessRate * 30 +
      actionableInsightsRate * 30 +
      (benchmarks.length > 0 ? 20 : 0) +
      (learnings.length > 10 ? 20 : learnings.length * 2))
  );

  const dataQuality = Math.round(
    (benchmarks.reduce((sum, b) => sum + (b.dataQuality === 'high' ? 100 : b.dataQuality === 'medium' ? 70 : 40), 0) / Math.max(benchmarks.length, 1))
  );

  // Get unique industries from benchmarks
  const industries = new Set(benchmarks.map(b => b.industry));

  // Calculate next cycle (weekly)
  const nextCycleAt = lastCycleAt
    ? new Date(new Date(lastCycleAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : new Date().toISOString();

  return {
    totalPatterns: patterns.length,
    activePatterns: patterns.filter(p => p.status !== 'deprecated').length,
    patternsByType: patternsByType as any,
    patternSuccessRate,

    totalInsights: insights.length,
    insightsByType: insightsByType as any,
    actionableInsightsRate,

    totalLearnings: learnings.length,
    learningsByType: learningsByType as any,
    learningsSharedRate,

    benchmarkCoverage: {
      industries: industries.size,
      totalCompanies: benchmarks.reduce((sum, b) => sum + b.sampleSize, 0),
      lastUpdated: benchmarks[0]?.updatedAt || new Date().toISOString(),
    },

    evolutionHealth,
    dataQuality,

    lastCycleAt: lastCycleAt || 'Never',
    nextCycleAt,
  };
}

/**
 * Get cycle history
 */
export function getCycleHistory(limit?: number): EvolutionCycleResult[] {
  const results = [...cycleHistory].reverse();
  return limit ? results.slice(0, limit) : results;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getCurrentPeriod(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${quarter}`;
}

function extractChannelMix(graph: CompanyContextGraph): Record<string, number> {
  const channels = graph.performanceMedia?.activeChannels?.value as string[] || [];
  const mix: Record<string, number> = {};
  const perChannel = 100 / (channels.length || 1);
  for (const channel of channels) {
    mix[channel] = perChannel;
  }
  return mix;
}

function extractCreativeStats(graph: CompanyContextGraph): {
  avgLifespan: number;
  topFormats: string[];
  testsPerMonth: number;
} {
  return {
    avgLifespan: 30, // Default
    topFormats: ['Video', 'Static', 'Carousel'],
    testsPerMonth: 2,
  };
}

function calculateDataQuality(
  companyData: Array<{
    graph: CompanyContextGraph;
    experiments: ExperimentPlan[];
  }>
): number {
  let totalScore = 0;

  for (const company of companyData) {
    let companyScore = 0;

    // Check context completeness
    if (company.graph.brand?.valueProps?.value) companyScore += 20;
    if (company.graph.audience?.coreSegments?.value) companyScore += 20;
    if (company.graph.performanceMedia?.activeChannels?.value) companyScore += 20;
    if (company.graph.objectives?.primaryObjective?.value) companyScore += 20;

    // Check experiment data
    if (company.experiments.length > 0) companyScore += 10;
    if (company.experiments.some(e => e.status === 'completed')) companyScore += 10;

    totalScore += companyScore;
  }

  return Math.round(totalScore / companyData.length);
}

function calculateConfidenceLevel(result: EvolutionCycleResult): number {
  let confidence = 50;

  // More companies = higher confidence
  confidence += Math.min(20, result.companiesAnalyzed * 2);

  // More experiments = higher confidence
  confidence += Math.min(15, result.experimentsAnalyzed * 0.5);

  // More patterns discovered = higher confidence
  confidence += Math.min(10, result.newPatterns * 2);

  // Higher data quality = higher confidence
  confidence += (result.dataQuality / 100) * 5;

  return Math.round(Math.min(95, confidence));
}

// ============================================================================
// Trend Analysis
// ============================================================================

/**
 * Get overall evolution trends
 */
export async function getEvolutionTrends(): Promise<{
  trends: string[];
  recommendations: string[];
  warnings: string[];
}> {
  const patterns = getPatterns({ minConfidence: 0.6 });
  return analyzePatternsTrends(patterns);
}
