// lib/autopilot/optimizationEngine.ts
// Phase 5: Optimization Engine
//
// Converts hypotheses into actionable experiments and manages experiment lifecycle

import { randomUUID } from 'crypto';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  ExperimentPlan,
  ExperimentType,
  ExperimentResults,
  Hypothesis,
  BudgetChange,
  TargetingChange,
  CreativeTestCell,
  BiddingChange,
} from './types';

// ============================================================================
// In-Memory Experiment Store
// ============================================================================

const activeExperiments = new Map<string, ExperimentPlan>();
const completedExperiments = new Map<string, ExperimentPlan[]>();

// ============================================================================
// Experiment Creation
// ============================================================================

/**
 * Create a detailed experiment plan from a hypothesis
 */
export function createDetailedExperimentPlan(
  hypothesis: Hypothesis,
  graph: CompanyContextGraph,
  options: {
    duration?: number;
    budgetPercent?: number;
    channels?: string[];
    testType?: 'ab' | 'multivariate' | 'incremental';
  } = {}
): ExperimentPlan {
  const {
    duration = 14,
    budgetPercent = 10,
    channels = [],
    testType = 'ab',
  } = options;

  const now = new Date().toISOString();

  // Determine experiment type from hypothesis
  const experimentType = inferExperimentType(hypothesis);

  // Build experiment-specific configuration
  const experimentConfig = buildExperimentConfig(experimentType, hypothesis, graph, budgetPercent);

  const plan: ExperimentPlan = {
    id: `exp_${randomUUID()}`,
    companyId: hypothesis.companyId,
    name: generateExperimentName(hypothesis),
    hypothesisId: hypothesis.id,
    type: experimentType,
    description: hypothesis.hypothesis,

    // Scope
    channels: channels.length > 0 ? channels : inferChannels(hypothesis, graph),
    geos: inferGeos(hypothesis, graph),
    audiences: inferAudiences(hypothesis, graph),

    // Changes
    budgetChange: experimentConfig.budgetChange,
    targetingChange: experimentConfig.targetingChange,
    creativeTestCells: experimentConfig.creativeTestCells,
    biddingChange: experimentConfig.biddingChange,

    // Expectations
    expectedLift: hypothesis.expectedImpact * 100,
    minDetectableEffect: calculateMDE(hypothesis, experimentType),
    statisticalPower: 0.8,

    // Timeline
    duration,
    startDate: undefined,
    endDate: undefined,

    // Metrics
    metrics: {
      primary: getPrimaryMetric(experimentType),
      secondary: getSecondaryMetrics(experimentType),
      guardrails: getGuardrailMetrics(experimentType),
    },

    // Status
    status: 'draft',
    results: undefined,

    createdAt: now,
    updatedAt: now,
  };

  return plan;
}

/**
 * Infer experiment type from hypothesis category
 */
function inferExperimentType(hypothesis: Hypothesis): ExperimentType {
  const typeMap: Record<string, ExperimentType> = {
    budget_reallocation: 'budget_test',
    channel_expansion: 'channel_test',
    channel_reduction: 'channel_test',
    creative_refresh: 'creative_test',
    audience_refinement: 'audience_test',
    geo_targeting: 'geo_test',
    seasonal_adjustment: 'budget_test',
    competitive_response: 'creative_test',
    performance_optimization: 'bidding_test',
    brand_alignment: 'creative_test',
    funnel_optimization: 'landing_page_test',
  };

  return typeMap[hypothesis.category] || 'budget_test';
}

/**
 * Build experiment-specific configuration
 */
function buildExperimentConfig(
  type: ExperimentType,
  hypothesis: Hypothesis,
  graph: CompanyContextGraph,
  budgetPercent: number
): {
  budgetChange?: BudgetChange;
  targetingChange?: TargetingChange;
  creativeTestCells?: CreativeTestCell[];
  biddingChange?: BiddingChange;
} {
  switch (type) {
    case 'budget_test':
      return {
        budgetChange: {
          type: hypothesis.category === 'channel_reduction' ? 'decrease' : 'increase',
          channels: {},
          totalDelta: budgetPercent,
        },
      };

    case 'creative_test':
      return {
        creativeTestCells: [
          {
            id: `cell_control`,
            name: 'Control',
            variant: 'control',
            allocation: 50,
            creative: {
              format: 'existing',
              angle: 'current messaging',
            },
          },
          {
            id: `cell_test`,
            name: 'Test',
            variant: 'test',
            allocation: 50,
            creative: {
              format: 'new',
              angle: extractCreativeAngle(hypothesis),
            },
          },
        ],
      };

    case 'audience_test':
      return {
        targetingChange: {
          type: 'modify',
          segments: extractAudienceSegments(hypothesis, graph),
        },
      };

    case 'geo_test':
      return {
        targetingChange: {
          type: 'modify',
          segments: [],
          geos: extractGeoTargets(hypothesis, graph),
        },
      };

    case 'bidding_test':
      return {
        biddingChange: {
          strategy: 'maximize_conversions',
          targetCpa: undefined,
        },
      };

    case 'landing_page_test':
      return {
        creativeTestCells: [
          {
            id: `lp_control`,
            name: 'Control LP',
            variant: 'control',
            allocation: 50,
            creative: {
              format: 'landing_page',
              angle: 'current',
            },
          },
          {
            id: `lp_test`,
            name: 'Test LP',
            variant: 'test',
            allocation: 50,
            creative: {
              format: 'landing_page',
              angle: 'optimized',
            },
          },
        ],
      };

    default:
      return {};
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateExperimentName(hypothesis: Hypothesis): string {
  const prefix = hypothesis.category.replace(/_/g, ' ');
  const summary = hypothesis.hypothesis.slice(0, 40);
  return `${prefix}: ${summary}...`;
}

function inferChannels(hypothesis: Hypothesis, graph: CompanyContextGraph): string[] {
  // Try to extract channels from hypothesis text
  const channels: string[] = [];
  const text = hypothesis.hypothesis.toLowerCase();

  const channelMap: Record<string, string> = {
    'google': 'google_ads',
    'search': 'google_ads',
    'meta': 'meta_ads',
    'facebook': 'meta_ads',
    'instagram': 'meta_ads',
    'tiktok': 'tiktok_ads',
    'linkedin': 'linkedin_ads',
    'display': 'display',
    'programmatic': 'programmatic',
    'youtube': 'youtube',
  };

  for (const [keyword, channel] of Object.entries(channelMap)) {
    if (text.includes(keyword)) {
      channels.push(channel);
    }
  }

  // Fallback to active channels from graph
  if (channels.length === 0) {
    const activeChannels = graph.performanceMedia?.activeChannels?.value as string[] | undefined;
    if (activeChannels) {
      return activeChannels.slice(0, 3);
    }
  }

  return channels;
}

function inferGeos(hypothesis: Hypothesis, graph: CompanyContextGraph): string[] {
  if (hypothesis.category === 'geo_targeting') {
    return (graph.audience?.primaryMarkets?.value as string[]) || [];
  }
  return [];
}

function inferAudiences(hypothesis: Hypothesis, graph: CompanyContextGraph): string[] {
  if (hypothesis.category === 'audience_refinement') {
    return (graph.audience?.coreSegments?.value as string[]) || [];
  }
  return [];
}

function extractCreativeAngle(hypothesis: Hypothesis): string {
  // Extract creative angle from hypothesis
  const text = hypothesis.hypothesis;

  // Look for common patterns
  if (text.toLowerCase().includes('ugc')) return 'UGC-style content';
  if (text.toLowerCase().includes('testimonial')) return 'Customer testimonials';
  if (text.toLowerCase().includes('product')) return 'Product-focused';
  if (text.toLowerCase().includes('benefit')) return 'Benefit-led messaging';
  if (text.toLowerCase().includes('emotional')) return 'Emotional appeal';

  return 'Alternative messaging approach';
}

function extractAudienceSegments(hypothesis: Hypothesis, graph: CompanyContextGraph): string[] {
  const segments = graph.audience?.coreSegments?.value as string[] | undefined;
  return segments?.slice(0, 3) || [];
}

function extractGeoTargets(hypothesis: Hypothesis, graph: CompanyContextGraph): string[] {
  const markets = graph.audience?.primaryMarkets?.value as string[] | undefined;
  return markets?.slice(0, 5) || [];
}

function calculateMDE(hypothesis: Hypothesis, type: ExperimentType): number {
  // Minimum Detectable Effect based on experiment type
  const mdeMap: Record<ExperimentType, number> = {
    budget_test: 10,
    channel_test: 15,
    creative_test: 5,
    audience_test: 10,
    geo_test: 15,
    bidding_test: 8,
    landing_page_test: 5,
  };

  return mdeMap[type] || 10;
}

function getPrimaryMetric(type: ExperimentType): string {
  const metricMap: Record<ExperimentType, string> = {
    budget_test: 'roas',
    channel_test: 'conversions',
    creative_test: 'ctr',
    audience_test: 'conversion_rate',
    geo_test: 'cpa',
    bidding_test: 'cpa',
    landing_page_test: 'conversion_rate',
  };

  return metricMap[type] || 'conversions';
}

function getSecondaryMetrics(type: ExperimentType): string[] {
  const metricsMap: Record<ExperimentType, string[]> = {
    budget_test: ['cpa', 'conversions', 'revenue'],
    channel_test: ['cpa', 'roas', 'ctr'],
    creative_test: ['conversion_rate', 'engagement', 'cpa'],
    audience_test: ['cpa', 'reach', 'frequency'],
    geo_test: ['conversions', 'roas', 'impression_share'],
    bidding_test: ['conversions', 'impression_share', 'position'],
    landing_page_test: ['bounce_rate', 'time_on_page', 'cpa'],
  };

  return metricsMap[type] || ['cpa', 'conversions'];
}

function getGuardrailMetrics(type: ExperimentType): string[] {
  return ['spend', 'cpa_cap', 'conversion_volume'];
}

// ============================================================================
// Experiment Lifecycle
// ============================================================================

/**
 * Start an experiment
 */
export function startExperiment(experimentId: string): ExperimentPlan | null {
  const experiment = activeExperiments.get(experimentId);
  if (!experiment || experiment.status !== 'draft') {
    return null;
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + experiment.duration * 24 * 60 * 60 * 1000);

  const updated: ExperimentPlan = {
    ...experiment,
    status: 'running',
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    updatedAt: now.toISOString(),
  };

  activeExperiments.set(experimentId, updated);
  return updated;
}

/**
 * Pause an experiment
 */
export function pauseExperiment(experimentId: string): ExperimentPlan | null {
  const experiment = activeExperiments.get(experimentId);
  if (!experiment || experiment.status !== 'running') {
    return null;
  }

  const updated: ExperimentPlan = {
    ...experiment,
    status: 'paused',
    updatedAt: new Date().toISOString(),
  };

  activeExperiments.set(experimentId, updated);
  return updated;
}

/**
 * Complete an experiment with results
 */
export function completeExperiment(
  experimentId: string,
  results: ExperimentResults
): ExperimentPlan | null {
  const experiment = activeExperiments.get(experimentId);
  if (!experiment) {
    return null;
  }

  const completed: ExperimentPlan = {
    ...experiment,
    status: 'completed',
    results,
    updatedAt: new Date().toISOString(),
  };

  // Move to completed store
  activeExperiments.delete(experimentId);
  const companyCompleted = completedExperiments.get(experiment.companyId) || [];
  companyCompleted.push(completed);
  completedExperiments.set(experiment.companyId, companyCompleted);

  return completed;
}

/**
 * Cancel an experiment
 */
export function cancelExperiment(experimentId: string, reason: string): ExperimentPlan | null {
  const experiment = activeExperiments.get(experimentId);
  if (!experiment) {
    return null;
  }

  const cancelled: ExperimentPlan = {
    ...experiment,
    status: 'cancelled',
    results: {
      completedAt: new Date().toISOString(),
      lift: 0,
      confidence: 0,
      primaryMetric: { control: 0, treatment: 0, lift: 0, pValue: 1 },
      secondaryMetrics: {},
      recommendations: [`Experiment cancelled: ${reason}`],
      shouldScale: false,
    },
    updatedAt: new Date().toISOString(),
  };

  activeExperiments.delete(experimentId);
  const companyCompleted = completedExperiments.get(experiment.companyId) || [];
  companyCompleted.push(cancelled);
  completedExperiments.set(experiment.companyId, companyCompleted);

  return cancelled;
}

// ============================================================================
// Experiment Analysis
// ============================================================================

/**
 * Analyze experiment results and generate recommendations
 */
export function analyzeExperimentResults(
  experiment: ExperimentPlan,
  rawResults: {
    control: Record<string, number>;
    treatment: Record<string, number>;
    sampleSize: { control: number; treatment: number };
  }
): ExperimentResults {
  const primaryMetric = experiment.metrics.primary;

  // Calculate lift for primary metric
  const controlValue = rawResults.control[primaryMetric] || 0;
  const treatmentValue = rawResults.treatment[primaryMetric] || 0;
  const lift = controlValue > 0 ? ((treatmentValue - controlValue) / controlValue) * 100 : 0;

  // Calculate statistical significance (simplified)
  const totalSample = rawResults.sampleSize.control + rawResults.sampleSize.treatment;
  const confidence = Math.min(0.99, 0.5 + (totalSample / 10000) * 0.49);

  // Determine winner
  const isSignificant = confidence > 0.95 && Math.abs(lift) > experiment.minDetectableEffect;
  const winner = isSignificant ? (lift > 0 ? 'treatment' : 'control') : undefined;

  // Calculate secondary metrics
  const secondaryMetrics: Record<string, { control: number; treatment: number; lift: number }> = {};
  for (const metric of experiment.metrics.secondary) {
    const c = rawResults.control[metric] || 0;
    const t = rawResults.treatment[metric] || 0;
    secondaryMetrics[metric] = {
      control: c,
      treatment: t,
      lift: c > 0 ? ((t - c) / c) * 100 : 0,
    };
  }

  // Generate recommendations
  const recommendations = generateExperimentRecommendations(experiment, lift, confidence, winner);

  return {
    completedAt: new Date().toISOString(),
    winner,
    lift,
    confidence,
    primaryMetric: {
      control: controlValue,
      treatment: treatmentValue,
      lift,
      pValue: 1 - confidence,
    },
    secondaryMetrics,
    recommendations,
    shouldScale: winner === 'treatment' && lift > experiment.minDetectableEffect,
  };
}

function generateExperimentRecommendations(
  experiment: ExperimentPlan,
  lift: number,
  confidence: number,
  winner?: string
): string[] {
  const recommendations: string[] = [];

  if (!winner) {
    recommendations.push('No statistically significant winner detected');
    recommendations.push('Consider extending test duration or increasing sample size');
  } else if (winner === 'treatment') {
    recommendations.push(`Treatment won with ${lift.toFixed(1)}% lift`);
    recommendations.push('Recommend scaling treatment to full traffic');

    if (experiment.type === 'creative_test') {
      recommendations.push('Create additional variations of winning creative');
    } else if (experiment.type === 'budget_test') {
      recommendations.push('Apply budget changes to all applicable campaigns');
    }
  } else {
    recommendations.push('Control performed better than treatment');
    recommendations.push('Consider revisiting hypothesis and testing alternative approach');
  }

  if (confidence < 0.95) {
    recommendations.push(`Confidence level (${(confidence * 100).toFixed(0)}%) below threshold`);
  }

  return recommendations;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get active experiments for a company
 */
export function getActiveExperiments(companyId: string): ExperimentPlan[] {
  return Array.from(activeExperiments.values())
    .filter(e => e.companyId === companyId);
}

/**
 * Get completed experiments for a company
 */
export function getCompletedExperiments(companyId: string): ExperimentPlan[] {
  return completedExperiments.get(companyId) || [];
}

/**
 * Get experiment by ID
 */
export function getExperiment(experimentId: string): ExperimentPlan | null {
  return activeExperiments.get(experimentId) || null;
}

/**
 * Store a new experiment
 */
export function storeExperiment(experiment: ExperimentPlan): void {
  activeExperiments.set(experiment.id, experiment);
}
