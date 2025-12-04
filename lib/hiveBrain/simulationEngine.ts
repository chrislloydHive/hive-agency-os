// lib/hiveBrain/simulationEngine.ts
// Simulation Engine for Hive Brain
//
// Simulates strategies before deployment:
// - "If we shift 20% of search budget to paid social for companies like X…"
// - "If we prioritize UGC over polished creative for Persona A…"
// - "If we decouple brand campaigns from performance campaigns…"

import type {
  SimulationInput,
  SimulationResult,
  StrategyChanges,
  CausalGraph,
} from './types';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { predictInterventionEffect, createBaseCausalGraph } from './causalModel';

// ============================================================================
// Simulation Parameters
// ============================================================================

/**
 * Default parameters for simulations
 */
const SIMULATION_DEFAULTS = {
  iterations: 1000, // Monte Carlo iterations
  confidenceLevel: 0.95,
  riskThresholds: {
    low: 0.15,
    medium: 0.30,
    high: 0.50,
  },
};

/**
 * Channel efficiency benchmarks (placeholder - would come from actual data)
 */
const CHANNEL_BENCHMARKS: Record<string, { cpa: number; roas: number; conversionRate: number }> = {
  paid_search: { cpa: 45, roas: 4.2, conversionRate: 0.035 },
  paid_social: { cpa: 55, roas: 3.5, conversionRate: 0.025 },
  display: { cpa: 75, roas: 2.8, conversionRate: 0.015 },
  video: { cpa: 65, roas: 3.2, conversionRate: 0.018 },
  native: { cpa: 60, roas: 3.4, conversionRate: 0.022 },
  email: { cpa: 25, roas: 6.0, conversionRate: 0.045 },
  organic_social: { cpa: 35, roas: 5.0, conversionRate: 0.028 },
};

/**
 * Creative type effectiveness multipliers
 */
const CREATIVE_MULTIPLIERS: Record<string, number> = {
  ugc: 1.15,
  polished: 1.0,
  testimonial: 1.12,
  product_focus: 0.95,
  lifestyle: 1.08,
  educational: 1.05,
  promotional: 0.90,
};

// ============================================================================
// Main Simulation Function
// ============================================================================

/**
 * Run a strategy simulation
 */
export async function simulateStrategy(
  input: SimulationInput,
  companyGraphs: CompanyContextGraph[],
  causalGraph?: CausalGraph
): Promise<SimulationResult> {
  const startTime = Date.now();

  // Validate input
  validateSimulationInput(input);

  // Get or create causal graph
  const graph = causalGraph || createBaseCausalGraph(input.verticalId || 'general');

  // Filter to target companies
  const targetCompanies = filterTargetCompanies(input, companyGraphs);

  if (targetCompanies.length === 0) {
    return createEmptyResult(input, 'No companies match the target criteria');
  }

  // Run Monte Carlo simulation
  const iterations = input.iterations || SIMULATION_DEFAULTS.iterations;
  const results = runMonteCarloSimulation(input, targetCompanies, graph, iterations);

  // Calculate aggregate results
  const aggregatedResult = aggregateSimulationResults(results);

  // Generate narrative
  const narrative = generateNarrative(input, aggregatedResult, targetCompanies.length);

  // Identify risks
  const risks = identifyRisks(input, aggregatedResult);

  // Identify assumptions
  const assumptions = identifyAssumptions(input);

  return {
    input,
    projectedImpact: aggregatedResult,
    bestCase: narrative.bestCase,
    worstCase: narrative.worstCase,
    narrativeSummary: narrative.summary,
    confidenceIntervals: {
      installsDelta: [results.installsP5, results.installsP95],
      revenueDelta: [results.revenueP5, results.revenueP95],
      cpaDelta: [results.cpaP5, results.cpaP95],
    },
    assumptions,
    risks,
    simulatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Input Validation
// ============================================================================

function validateSimulationInput(input: SimulationInput): void {
  if (!input.target) {
    throw new Error('Simulation target is required');
  }

  if (input.target === 'single_company' && (!input.companyIds || input.companyIds.length === 0)) {
    throw new Error('Company IDs required for single_company target');
  }

  if (input.target === 'vertical' && !input.verticalId) {
    throw new Error('Vertical ID required for vertical target');
  }

  if (!input.changes || Object.keys(input.changes).length === 0) {
    throw new Error('At least one strategy change is required');
  }
}

// ============================================================================
// Company Filtering
// ============================================================================

function filterTargetCompanies(
  input: SimulationInput,
  allCompanies: CompanyContextGraph[]
): CompanyContextGraph[] {
  switch (input.target) {
    case 'single_company':
      return allCompanies.filter(c => input.companyIds?.includes(c.companyId));

    case 'vertical':
      return allCompanies.filter(c => {
        const industry = c.identity?.industry?.value;
        return industry && industry.toLowerCase().includes(input.verticalId?.toLowerCase() || '');
      });

    case 'cluster':
      return allCompanies.filter(c => input.companyIds?.includes(c.companyId));

    default:
      return allCompanies;
  }
}

// ============================================================================
// Monte Carlo Simulation
// ============================================================================

interface MonteCarloResults {
  installsDelta: number[];
  revenueDelta: number[];
  cpaDelta: number[];
  leadsDelta: number[];
  roasDelta: number[];
  installsP5: number;
  installsP95: number;
  revenueP5: number;
  revenueP95: number;
  cpaP5: number;
  cpaP95: number;
}

function runMonteCarloSimulation(
  input: SimulationInput,
  companies: CompanyContextGraph[],
  graph: CausalGraph,
  iterations: number
): MonteCarloResults {
  const installsDeltas: number[] = [];
  const revenueDeltas: number[] = [];
  const cpaDeltas: number[] = [];
  const leadsDeltas: number[] = [];
  const roasDeltas: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Add noise to simulate uncertainty
    const noiseMultiplier = 1 + (Math.random() - 0.5) * 0.4; // ±20% noise

    // Calculate effects for each company
    let totalInstallsDelta = 0;
    let totalRevenueDelta = 0;
    let totalCpaDelta = 0;
    let totalLeadsDelta = 0;
    let totalRoasDelta = 0;

    for (const company of companies) {
      const companyEffects = simulateCompanyEffects(input.changes, company, graph, noiseMultiplier);
      totalInstallsDelta += companyEffects.installsDelta;
      totalRevenueDelta += companyEffects.revenueDelta;
      totalCpaDelta += companyEffects.cpaDelta;
      totalLeadsDelta += companyEffects.leadsDelta;
      totalRoasDelta += companyEffects.roasDelta;
    }

    // Average across companies
    const companyCount = companies.length;
    installsDeltas.push(totalInstallsDelta / companyCount);
    revenueDeltas.push(totalRevenueDelta / companyCount);
    cpaDeltas.push(totalCpaDelta / companyCount);
    leadsDeltas.push(totalLeadsDelta / companyCount);
    roasDeltas.push(totalRoasDelta / companyCount);
  }

  // Calculate percentiles
  const sorted = {
    installs: [...installsDeltas].sort((a, b) => a - b),
    revenue: [...revenueDeltas].sort((a, b) => a - b),
    cpa: [...cpaDeltas].sort((a, b) => a - b),
  };

  const p5Index = Math.floor(iterations * 0.05);
  const p95Index = Math.floor(iterations * 0.95);

  return {
    installsDelta: installsDeltas,
    revenueDelta: revenueDeltas,
    cpaDelta: cpaDeltas,
    leadsDelta: leadsDeltas,
    roasDelta: roasDeltas,
    installsP5: sorted.installs[p5Index],
    installsP95: sorted.installs[p95Index],
    revenueP5: sorted.revenue[p5Index],
    revenueP95: sorted.revenue[p95Index],
    cpaP5: sorted.cpa[p5Index],
    cpaP95: sorted.cpa[p95Index],
  };
}

/**
 * Simulate effects of strategy changes on a single company
 */
function simulateCompanyEffects(
  changes: StrategyChanges,
  company: CompanyContextGraph,
  graph: CausalGraph,
  noiseMultiplier: number
): { installsDelta: number; revenueDelta: number; cpaDelta: number; leadsDelta: number; roasDelta: number } {
  let installsDelta = 0;
  let revenueDelta = 0;
  let cpaDelta = 0;
  let leadsDelta = 0;
  let roasDelta = 0;

  // Channel mix changes
  if (changes.channelMix) {
    const channelEffects = simulateChannelMixChange(changes.channelMix, company, graph);
    installsDelta += channelEffects.installsDelta * noiseMultiplier;
    revenueDelta += channelEffects.revenueDelta * noiseMultiplier;
    cpaDelta += channelEffects.cpaDelta * noiseMultiplier;
    leadsDelta += channelEffects.leadsDelta * noiseMultiplier;
    roasDelta += channelEffects.roasDelta * noiseMultiplier;
  }

  // Creative mix changes
  if (changes.creativeMix) {
    const creativeEffects = simulateCreativeMixChange(changes.creativeMix, company);
    installsDelta += creativeEffects.installsDelta * noiseMultiplier;
    revenueDelta += creativeEffects.revenueDelta * noiseMultiplier;
    cpaDelta += creativeEffects.cpaDelta * noiseMultiplier;
  }

  // Persona focus changes
  if (changes.personaFocus && changes.personaFocus.length > 0) {
    const personaEffects = simulatePersonaFocusChange(changes.personaFocus, company);
    installsDelta += personaEffects.installsDelta * noiseMultiplier;
    revenueDelta += personaEffects.revenueDelta * noiseMultiplier;
  }

  // Site changes
  if (changes.siteChanges && changes.siteChanges.length > 0) {
    const siteEffects = simulateSiteChanges(changes.siteChanges, company, graph);
    installsDelta += siteEffects.conversionRateDelta * 0.5 * noiseMultiplier;
    revenueDelta += siteEffects.conversionRateDelta * 0.4 * noiseMultiplier;
  }

  // Budget changes
  if (changes.budgetChange) {
    const budgetEffects = simulateBudgetChange(changes.budgetChange);
    installsDelta += budgetEffects.installsDelta * noiseMultiplier;
    revenueDelta += budgetEffects.revenueDelta * noiseMultiplier;
  }

  return { installsDelta, revenueDelta, cpaDelta, leadsDelta, roasDelta };
}

/**
 * Simulate channel mix changes
 */
function simulateChannelMixChange(
  channelMix: Record<string, number>,
  company: CompanyContextGraph,
  graph: CausalGraph
): { installsDelta: number; revenueDelta: number; cpaDelta: number; leadsDelta: number; roasDelta: number } {
  let installsDelta = 0;
  let revenueDelta = 0;
  let cpaDelta = 0;
  let leadsDelta = 0;
  let roasDelta = 0;

  const currentBlendedCpa = company.performanceMedia?.blendedCpa?.value || 50;
  const currentRoas = company.performanceMedia?.blendedRoas?.value || 3.5;

  for (const [channel, changePercent] of Object.entries(channelMix)) {
    const benchmark = CHANNEL_BENCHMARKS[channel.toLowerCase().replace(/\s+/g, '_')] || CHANNEL_BENCHMARKS.display;

    // Estimate effect of shifting spend to/from this channel
    const efficiency = benchmark.cpa / currentBlendedCpa;
    const roasEfficiency = benchmark.roas / currentRoas;

    installsDelta += changePercent * (1 / efficiency - 1) * 0.3;
    revenueDelta += changePercent * (roasEfficiency - 1) * 0.25;
    cpaDelta += changePercent * (efficiency - 1) * 0.4;
    leadsDelta += changePercent * (1 / efficiency - 1) * 0.25;
    roasDelta += changePercent * (roasEfficiency - 1) * 0.3;
  }

  return { installsDelta, revenueDelta, cpaDelta, leadsDelta, roasDelta };
}

/**
 * Simulate creative mix changes
 */
function simulateCreativeMixChange(
  creativeMix: Record<string, number>,
  company: CompanyContextGraph
): { installsDelta: number; revenueDelta: number; cpaDelta: number } {
  let effectivenessMultiplier = 1;

  for (const [creativeType, weight] of Object.entries(creativeMix)) {
    const multiplier = CREATIVE_MULTIPLIERS[creativeType.toLowerCase()] || 1.0;
    effectivenessMultiplier += (multiplier - 1) * (weight / 100);
  }

  const installsDelta = (effectivenessMultiplier - 1) * 100 * 0.4;
  const revenueDelta = (effectivenessMultiplier - 1) * 100 * 0.35;
  const cpaDelta = -(effectivenessMultiplier - 1) * 100 * 0.3;

  return { installsDelta, revenueDelta, cpaDelta };
}

/**
 * Simulate persona focus changes
 */
function simulatePersonaFocusChange(
  personaFocus: string[],
  company: CompanyContextGraph
): { installsDelta: number; revenueDelta: number } {
  // Tighter persona focus generally improves efficiency but may limit scale
  const focusIntensity = personaFocus.length <= 2 ? 1.1 : personaFocus.length <= 4 ? 1.0 : 0.95;

  const installsDelta = (focusIntensity - 1) * 100 * 0.5;
  const revenueDelta = (focusIntensity - 1) * 100 * 0.4;

  return { installsDelta, revenueDelta };
}

/**
 * Simulate site/UX changes
 */
function simulateSiteChanges(
  siteChanges: string[],
  company: CompanyContextGraph,
  graph: CausalGraph
): { conversionRateDelta: number } {
  let conversionRateDelta = 0;

  for (const change of siteChanges) {
    const lowerChange = change.toLowerCase();

    if (lowerChange.includes('speed')) {
      // Use causal model to predict effect
      const effects = predictInterventionEffect(graph, { nodeId: 'site_speed', change: 10 });
      conversionRateDelta += effects.conversion_rate || 2;
    }

    if (lowerChange.includes('mobile')) {
      const effects = predictInterventionEffect(graph, { nodeId: 'mobile_ux_score', change: 15 });
      conversionRateDelta += effects.conversion_rate || 3;
    }

    if (lowerChange.includes('cta') || lowerChange.includes('button')) {
      conversionRateDelta += 4;
    }

    if (lowerChange.includes('form')) {
      conversionRateDelta += 3;
    }

    if (lowerChange.includes('landing')) {
      conversionRateDelta += 5;
    }
  }

  return { conversionRateDelta };
}

/**
 * Simulate budget changes
 */
function simulateBudgetChange(
  budgetChange: number
): { installsDelta: number; revenueDelta: number } {
  // Diminishing returns on budget increases
  const efficiency = budgetChange > 0
    ? Math.log(1 + budgetChange / 100) / Math.log(2) * 100
    : budgetChange;

  return {
    installsDelta: efficiency * 0.7,
    revenueDelta: efficiency * 0.65,
  };
}

// ============================================================================
// Result Aggregation
// ============================================================================

interface AggregatedResult {
  installsDelta: number;
  revenueDelta: number;
  cpaDelta: number;
  leadsDelta: number;
  roasDelta: number;
  riskLevel: 'low' | 'medium' | 'high';
}

function aggregateSimulationResults(results: MonteCarloResults): AggregatedResult {
  // Calculate median values
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const installsDelta = median(results.installsDelta);
  const revenueDelta = median(results.revenueDelta);
  const cpaDelta = median(results.cpaDelta);
  const leadsDelta = median(results.leadsDelta);
  const roasDelta = median(results.roasDelta);

  // Calculate risk level based on variance and negative outcomes
  const negativeOutcomes = results.installsDelta.filter(d => d < 0).length / results.installsDelta.length;

  let riskLevel: 'low' | 'medium' | 'high';
  if (negativeOutcomes > SIMULATION_DEFAULTS.riskThresholds.high) {
    riskLevel = 'high';
  } else if (negativeOutcomes > SIMULATION_DEFAULTS.riskThresholds.medium) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    installsDelta,
    revenueDelta,
    cpaDelta,
    leadsDelta,
    roasDelta,
    riskLevel,
  };
}

// ============================================================================
// Narrative Generation
// ============================================================================

function generateNarrative(
  input: SimulationInput,
  result: AggregatedResult,
  companyCount: number
): { summary: string; bestCase: string; worstCase: string } {
  const changes = describeChanges(input.changes);
  const timeframe = input.timeHorizon === '30d' ? '30 days' : input.timeHorizon === '90d' ? '90 days' : '1 year';

  const summary = `Based on simulation of ${changes} across ${companyCount} ${input.target === 'vertical' ? `companies in the ${input.verticalId} vertical` : 'companies'}, ` +
    `over ${timeframe} we project: ` +
    `installs ${result.installsDelta >= 0 ? '+' : ''}${result.installsDelta.toFixed(1)}%, ` +
    `revenue ${result.revenueDelta >= 0 ? '+' : ''}${result.revenueDelta.toFixed(1)}%, ` +
    `CPA ${result.cpaDelta >= 0 ? '+' : ''}${result.cpaDelta.toFixed(1)}%. ` +
    `Risk level: ${result.riskLevel}.`;

  const bestCase = `In the best scenario (+2σ), installs could increase by ${(result.installsDelta * 1.5).toFixed(1)}% ` +
    `with revenue up ${(result.revenueDelta * 1.4).toFixed(1)}% and improved efficiency.`;

  const worstCase = `In the worst scenario (-2σ), installs could ${result.installsDelta > 0 ? `only increase by ${(result.installsDelta * 0.3).toFixed(1)}%` : `decrease by ${Math.abs(result.installsDelta * 0.5).toFixed(1)}%`} ` +
    `with potential revenue impact of ${(result.revenueDelta * 0.4).toFixed(1)}%.`;

  return { summary, bestCase, worstCase };
}

function describeChanges(changes: StrategyChanges): string {
  const descriptions: string[] = [];

  if (changes.channelMix) {
    const shifts = Object.entries(changes.channelMix)
      .filter(([_, v]) => Math.abs(v) > 5)
      .map(([k, v]) => `${v > 0 ? '+' : ''}${v}% ${k}`)
      .join(', ');
    if (shifts) descriptions.push(`channel mix shifts (${shifts})`);
  }

  if (changes.creativeMix) {
    descriptions.push('creative strategy changes');
  }

  if (changes.personaFocus) {
    descriptions.push(`persona focus on ${changes.personaFocus.join(', ')}`);
  }

  if (changes.siteChanges) {
    descriptions.push(`site improvements (${changes.siteChanges.join(', ')})`);
  }

  if (changes.budgetChange) {
    descriptions.push(`${changes.budgetChange > 0 ? '+' : ''}${changes.budgetChange}% budget`);
  }

  return descriptions.join(', ') || 'proposed changes';
}

// ============================================================================
// Risk and Assumption Analysis
// ============================================================================

function identifyRisks(input: SimulationInput, result: AggregatedResult): string[] {
  const risks: string[] = [];

  if (result.riskLevel === 'high') {
    risks.push('High probability of negative outcomes in at least one key metric');
  }

  if (input.changes.channelMix) {
    const totalShift = Object.values(input.changes.channelMix).reduce((a, b) => Math.abs(a) + Math.abs(b), 0);
    if (totalShift > 30) {
      risks.push('Large channel mix shifts may cause temporary performance instability');
    }
  }

  if (input.changes.budgetChange && Math.abs(input.changes.budgetChange) > 25) {
    risks.push('Significant budget changes may trigger learning periods in ad platforms');
  }

  if (input.target === 'vertical' || (input.companyIds && input.companyIds.length > 5)) {
    risks.push('Applying uniform strategy across diverse companies may not account for individual differences');
  }

  if (result.cpaDelta > 10) {
    risks.push('Projected CPA increase could impact profitability');
  }

  return risks;
}

function identifyAssumptions(input: SimulationInput): string[] {
  const assumptions: string[] = [
    'Market conditions remain relatively stable during the simulation period',
    'Competitor behavior does not significantly change',
    'Ad platform algorithms adapt normally to changes',
  ];

  if (input.changes.channelMix) {
    assumptions.push('Channel performance benchmarks are representative of expected outcomes');
  }

  if (input.changes.creativeMix) {
    assumptions.push('Creative effectiveness follows historical patterns');
  }

  if (input.changes.siteChanges) {
    assumptions.push('Site changes are implemented correctly and fully');
  }

  if (input.timeHorizon === '1y') {
    assumptions.push('Long-term projections have higher uncertainty');
  }

  return assumptions;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createEmptyResult(input: SimulationInput, message: string): SimulationResult {
  return {
    input,
    projectedImpact: {
      installsDelta: 0,
      revenueDelta: 0,
      cpaDelta: 0,
      leadsDelta: 0,
      roasDelta: 0,
      riskLevel: 'high',
    },
    bestCase: message,
    worstCase: message,
    narrativeSummary: message,
    confidenceIntervals: {
      installsDelta: [0, 0],
      revenueDelta: [0, 0],
      cpaDelta: [0, 0],
    },
    assumptions: [],
    risks: [message],
    simulatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Exports
// ============================================================================

export { CHANNEL_BENCHMARKS, CREATIVE_MULTIPLIERS };
