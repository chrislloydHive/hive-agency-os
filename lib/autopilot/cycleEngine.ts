// lib/autopilot/cycleEngine.ts
// Phase 5: Autopilot Cycle Engine - The Heart of Hive Autopilot
//
// Runs the autonomous strategy cycle: read context, generate hypotheses,
// run optimizations, propose updates, and log outcomes

import { randomUUID } from 'crypto';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import { loadContextGraph } from '../contextGraph';
import { computeContextHealth, convertNeedsRefreshReport } from '../contextGraph/contextHealth';
import { getNeedsRefreshReport } from '../contextGraph/needsRefresh';
import { generateHypotheses, createExperimentPlan } from './hypothesisEngine';
import { generateBudgetAllocation } from './budgetAllocator';
import { generateCreativeRecommendations } from './creativeOptimizer';
import { runSignalScan } from './signalMonitor';
import { evaluateRules } from './autopilotRules';
import type {
  AutopilotConfig,
  AutonomyLevel,
  CycleResult,
  Hypothesis,
  ExperimentPlan,
  BudgetAllocation,
  CreativeRecommendation,
  Signal,
  AutopilotLogEntry,
  AutopilotAction,
} from './types';

// ============================================================================
// In-Memory Stores (replace with database in production)
// ============================================================================

const configStore = new Map<string, AutopilotConfig>();
const cycleResultStore = new Map<string, CycleResult[]>();
const logStore: AutopilotLogEntry[] = [];
const experimentStore = new Map<string, ExperimentPlan[]>();

// Global kill switch
let globalAutopilotEnabled = true;

// ============================================================================
// Configuration Management
// ============================================================================

/**
 * Get autopilot configuration for a company
 */
export function getAutopilotConfig(companyId: string): AutopilotConfig | null {
  return configStore.get(companyId) || null;
}

/**
 * Set autopilot configuration for a company
 */
export function setAutopilotConfig(config: AutopilotConfig): void {
  configStore.set(config.companyId, {
    ...config,
    updatedAt: new Date().toISOString(),
  });

  logAutopilotAction(config.companyId, 'config_changed', 'autopilot', {
    description: 'Autopilot configuration updated',
    details: { autonomyLevel: config.autonomyLevel, enabled: config.enabled },
  });
}

/**
 * Create default autopilot config for a company
 */
export function createDefaultConfig(companyId: string): AutopilotConfig {
  const now = new Date().toISOString();
  return {
    companyId,
    enabled: false,
    autonomyLevel: 'ai_assisted',
    cycleFrequency: 'weekly',
    allowedDomains: ['performanceMedia', 'creative', 'audience'],
    budgetFlexibility: 0.2,
    experimentBudgetPercent: 10,
    riskTolerance: 'moderate',
    requireApprovalFor: ['budget', 'channel'],
    notifyOnChanges: true,
    emergencyStopThreshold: 30,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Set global autopilot enabled state (kill switch)
 */
export function setGlobalAutopilotEnabled(enabled: boolean): void {
  globalAutopilotEnabled = enabled;
}

/**
 * Check if global autopilot is enabled
 */
export function isGlobalAutopilotEnabled(): boolean {
  return globalAutopilotEnabled;
}

// ============================================================================
// Cycle Execution
// ============================================================================

/**
 * Check if autopilot is ready to run for a company
 */
export async function checkAutopilotReadiness(
  companyId: string
): Promise<{
  ready: boolean;
  reasons: string[];
  score: number;
}> {
  const reasons: string[] = [];
  let score = 100;

  // Check global kill switch
  if (!globalAutopilotEnabled) {
    reasons.push('Global autopilot is disabled');
    score -= 100;
    return { ready: false, reasons, score: 0 };
  }

  // Check company config
  const config = getAutopilotConfig(companyId);
  if (!config || !config.enabled) {
    reasons.push('Company autopilot is not enabled');
    score -= 100;
    return { ready: false, reasons, score: 0 };
  }

  // Check context graph exists
  const graph = await loadContextGraph(companyId);
  if (!graph) {
    reasons.push('No context graph available');
    score -= 50;
  }

  // Check context health
  if (graph) {
    const refreshReport = getNeedsRefreshReport(graph);
    const flags = convertNeedsRefreshReport(refreshReport);
    const health = computeContextHealth(flags);
    if (health.score < 40) {
      reasons.push(`Context health too low: ${health.score}%`);
      score -= 30;
    }
  }

  return {
    ready: score >= 50 && reasons.length === 0,
    reasons,
    score: Math.max(0, score),
  };
}

/**
 * Run a full autopilot cycle for a company
 */
export async function runAutopilotCycle(
  companyId: string,
  options: {
    dryRun?: boolean;
    forcedAutonomyLevel?: AutonomyLevel;
  } = {}
): Promise<CycleResult> {
  const { dryRun = false, forcedAutonomyLevel } = options;
  const startTime = Date.now();
  const cycleId = `cycle_${randomUUID()}`;
  const now = new Date().toISOString();

  // Log cycle start
  logAutopilotAction(companyId, 'cycle_started', 'schedule', {
    description: 'Autopilot cycle started',
    details: { cycleId, dryRun },
  });

  // Get configuration
  const config = getAutopilotConfig(companyId) || createDefaultConfig(companyId);
  const autonomyLevel = forcedAutonomyLevel || config.autonomyLevel;

  // Initialize result
  const result: CycleResult = {
    id: cycleId,
    companyId,
    cycleNumber: (cycleResultStore.get(companyId)?.length || 0) + 1,
    startedAt: now,
    completedAt: now,
    durationMs: 0,
    contextHealthScore: 0,
    performanceScore: 0,
    readinessScore: 0,
    hypothesesGenerated: 0,
    hypothesesSelected: 0,
    experimentsCreated: 0,
    optimizationsApplied: 0,
    updatesProposed: 0,
    updatesApplied: 0,
    budgetChanges: [],
    creativeChanges: [],
    audienceChanges: [],
    signalsDetected: 0,
    alertsTriggered: 0,
    summary: '',
    highlights: [],
    concerns: [],
    nextActions: [],
    status: 'success',
    autonomyLevel,
    humanOverrides: 0,
  };

  try {
    // Step 1: Read Context Graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      throw new Error('No context graph available');
    }
    const companyName = graph.identity?.businessName?.value || graph.companyName || 'Unknown';

    // Step 2: Compute context health
    const refreshReport = getNeedsRefreshReport(graph);
    const healthFlags = convertNeedsRefreshReport(refreshReport);
    const contextHealth = computeContextHealth(healthFlags);
    result.contextHealthScore = contextHealth.score;

    // Step 3: Check readiness
    const readiness = await checkAutopilotReadiness(companyId);
    result.readinessScore = readiness.score;

    if (!readiness.ready && !dryRun) {
      result.status = 'skipped';
      result.summary = `Cycle skipped: ${readiness.reasons.join(', ')}`;
      result.concerns = readiness.reasons;
      return finalizeResult(result, startTime, companyId);
    }

    // Step 4: Check signals
    const signals = runSignalScan(companyId, graph);
    result.signalsDetected = signals.length;
    result.alertsTriggered = signals.filter((s: Signal) => s.severity === 'critical').length;

    // Handle critical signals (highest severity)
    const criticalSignals = signals.filter((s: Signal) => s.severity === 'critical');
    if (criticalSignals.length > 0 && !dryRun) {
      await handleEmergencySignals(companyId, criticalSignals, config);
      result.concerns.push(`${criticalSignals.length} critical signal(s) detected`);
    }

    // Step 5: Generate hypotheses
    const hypotheses = await generateHypotheses({
      companyId,
      companyName,
      graph,
    }, {
      maxHypotheses: 15,
      focusDomains: config.allowedDomains as string[],
    });
    result.hypothesesGenerated = hypotheses.length;

    // Log hypotheses
    for (const h of hypotheses) {
      logAutopilotAction(companyId, 'hypothesis_generated', 'autopilot', {
        description: h.hypothesis,
        details: { hypothesisId: h.id, domain: h.domain, confidence: h.confidence },
      });
    }

    // Step 6: Score and select hypotheses
    const selectedHypotheses = selectHypotheses(hypotheses, config);
    result.hypothesesSelected = selectedHypotheses.length;

    // Step 7: Create experiment plans
    const experiments: ExperimentPlan[] = [];
    for (const hypothesis of selectedHypotheses.slice(0, 3)) {
      const experiment = createExperimentPlan(hypothesis, {
        budgetPercent: config.experimentBudgetPercent,
      });
      experiments.push(experiment);

      logAutopilotAction(companyId, 'experiment_created', 'autopilot', {
        description: `Created experiment: ${experiment.name}`,
        details: { experimentId: experiment.id, hypothesisId: hypothesis.id },
      });
    }
    result.experimentsCreated = experiments.length;

    // Store experiments
    const existingExperiments = experimentStore.get(companyId) || [];
    experimentStore.set(companyId, [...existingExperiments, ...experiments]);

    // Step 8: Generate optimizations based on autonomy level
    if (autonomyLevel !== 'manual_only') {
      // Budget allocation
      const budgetAllocation = await generateBudgetAllocation(companyId, graph);
      if (budgetAllocation && Object.keys(budgetAllocation.vsCurrentAllocation).length > 0) {
        result.budgetChanges.push({
          type: 'reallocation',
          channels: budgetAllocation.vsCurrentAllocation as Record<string, { current: number; proposed: number }>,
          totalDelta: 0,
        });
      }

      // Creative recommendations
      const creativeRecs = await generateCreativeRecommendations(companyId, graph);
      result.creativeChanges = creativeRecs;

      // Apply changes based on autonomy level
      if (autonomyLevel === 'semi_autonomous' || autonomyLevel === 'full_autonomous') {
        if (!dryRun) {
          const appliedCount = await applyOptimizations(companyId, config, {
            budgetAllocation,
            creativeRecommendations: creativeRecs,
            signals,
          });
          result.optimizationsApplied = appliedCount;
        }
      }

      // Propose updates
      result.updatesProposed = result.budgetChanges.length + result.creativeChanges.length;

      // Auto-apply in full autonomous mode
      if (autonomyLevel === 'full_autonomous' && !dryRun) {
        result.updatesApplied = result.updatesProposed;
      }
    }

    // Step 9: Generate summary
    result.summary = generateCycleSummary(result, hypotheses, signals);
    result.highlights = generateHighlights(result, hypotheses);
    result.nextActions = generateNextActions(result, selectedHypotheses, experiments);

    return finalizeResult(result, startTime, companyId);

  } catch (error) {
    result.status = 'failed';
    result.errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logAutopilotAction(companyId, 'cycle_completed', 'autopilot', {
      description: `Cycle failed: ${result.errorMessage}`,
      details: { cycleId, error: result.errorMessage },
      outcome: 'failure',
    });

    return finalizeResult(result, startTime, companyId);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function finalizeResult(
  result: CycleResult,
  startTime: number,
  companyId: string
): CycleResult {
  const endTime = Date.now();
  result.completedAt = new Date().toISOString();
  result.durationMs = endTime - startTime;

  // Store result
  const existing = cycleResultStore.get(companyId) || [];
  existing.push(result);
  cycleResultStore.set(companyId, existing.slice(-100)); // Keep last 100

  // Update config last cycle time
  const config = getAutopilotConfig(companyId);
  if (config) {
    config.lastCycleAt = result.completedAt;
    configStore.set(companyId, config);
  }

  // Log completion
  logAutopilotAction(companyId, 'cycle_completed', 'autopilot', {
    description: `Cycle ${result.status}: ${result.summary}`,
    details: {
      cycleId: result.id,
      durationMs: result.durationMs,
      hypothesesGenerated: result.hypothesesGenerated,
      experimentsCreated: result.experimentsCreated,
    },
    outcome: result.status === 'success' ? 'success' : 'failure',
  });

  return result;
}

function selectHypotheses(
  hypotheses: Hypothesis[],
  config: AutopilotConfig
): Hypothesis[] {
  // Filter by allowed domains
  let filtered = hypotheses.filter(h =>
    config.allowedDomains.includes(h.domain as typeof config.allowedDomains[number])
  );

  // Sort by confidence * impact
  filtered.sort((a, b) => (b.confidence * b.expectedImpact) - (a.confidence * a.expectedImpact));

  // Select based on risk tolerance
  const maxSelect = config.riskTolerance === 'aggressive' ? 5 :
                    config.riskTolerance === 'moderate' ? 3 : 2;

  return filtered.slice(0, maxSelect);
}

async function handleEmergencySignals(
  companyId: string,
  signals: Signal[],
  config: AutopilotConfig
): Promise<void> {
  for (const signal of signals) {
    logAutopilotAction(companyId, 'alert_triggered', 'signal', {
      description: `Emergency: ${signal.title}`,
      details: { signalId: signal.id, type: signal.type, severity: signal.severity },
    });

    // Check if we should trigger emergency stop
    const deviation = signal.changePercent || 0;
    if (Math.abs(deviation) > config.emergencyStopThreshold) {
      logAutopilotAction(companyId, 'emergency_stop', 'signal', {
        description: `Emergency stop triggered: ${signal.title}`,
        details: { signalId: signal.id, deviation },
      });

      // Disable autopilot for this company
      const currentConfig = getAutopilotConfig(companyId);
      if (currentConfig) {
        currentConfig.enabled = false;
        setAutopilotConfig(currentConfig);
      }
    }
  }
}

async function applyOptimizations(
  companyId: string,
  config: AutopilotConfig,
  optimizations: {
    budgetAllocation?: BudgetAllocation;
    creativeRecommendations?: CreativeRecommendation[];
    signals?: Signal[];
  }
): Promise<number> {
  let appliedCount = 0;

  // Apply budget changes if allowed
  if (optimizations.budgetAllocation && !config.requireApprovalFor.includes('budget')) {
    // Would apply budget changes via API
    appliedCount++;

    logAutopilotAction(companyId, 'budget_reallocated', 'autopilot', {
      description: 'Budget reallocation applied',
      details: { allocation: optimizations.budgetAllocation.channels },
    });
  }

  // Apply creative changes if allowed
  if (optimizations.creativeRecommendations && !config.requireApprovalFor.includes('creative')) {
    for (const rec of optimizations.creativeRecommendations) {
      if (rec.priority === 'high') {
        appliedCount++;

        logAutopilotAction(companyId, 'creative_optimized', 'autopilot', {
          description: `Creative recommendation applied: ${rec.recommendation}`,
          details: { recommendationId: rec.id },
        });
      }
    }
  }

  return appliedCount;
}

function generateCycleSummary(
  result: CycleResult,
  hypotheses: Hypothesis[],
  signals: Signal[]
): string {
  const parts: string[] = [];

  parts.push(`Generated ${result.hypothesesGenerated} hypotheses`);

  if (result.experimentsCreated > 0) {
    parts.push(`created ${result.experimentsCreated} experiments`);
  }

  if (result.optimizationsApplied > 0) {
    parts.push(`applied ${result.optimizationsApplied} optimizations`);
  }

  if (result.signalsDetected > 0) {
    parts.push(`detected ${result.signalsDetected} signals`);
  }

  return parts.join(', ') + '.';
}

function generateHighlights(
  result: CycleResult,
  hypotheses: Hypothesis[]
): string[] {
  const highlights: string[] = [];

  // Top hypothesis
  if (hypotheses.length > 0) {
    const top = hypotheses[0];
    highlights.push(`Top opportunity: ${top.hypothesis}`);
  }

  // Health status
  if (result.contextHealthScore >= 80) {
    highlights.push('Context health is excellent');
  } else if (result.contextHealthScore >= 60) {
    highlights.push('Context health is good');
  }

  // Experiments
  if (result.experimentsCreated > 0) {
    highlights.push(`${result.experimentsCreated} new experiments queued`);
  }

  return highlights;
}

function generateNextActions(
  result: CycleResult,
  hypotheses: Hypothesis[],
  experiments: ExperimentPlan[]
): string[] {
  const actions: string[] = [];

  // Review experiments
  if (experiments.length > 0) {
    actions.push(`Review ${experiments.length} experiment proposals`);
  }

  // Address low context health
  if (result.contextHealthScore < 60) {
    actions.push('Improve context health by filling missing fields');
  }

  // Handle alerts
  if (result.alertsTriggered > 0) {
    actions.push(`Address ${result.alertsTriggered} critical alerts`);
  }

  // Top hypothesis action
  if (hypotheses.length > 0) {
    const top = hypotheses[0];
    actions.push(`Consider: ${top.hypothesis}`);
  }

  return actions;
}

// ============================================================================
// Logging
// ============================================================================

function logAutopilotAction(
  companyId: string,
  action: AutopilotAction,
  triggeredBy: 'autopilot' | 'human' | 'signal' | 'schedule',
  data: {
    description: string;
    details?: Record<string, unknown>;
    outcome?: 'success' | 'failure' | 'pending';
  }
): void {
  const entry: AutopilotLogEntry = {
    id: `log_${randomUUID()}`,
    companyId,
    timestamp: new Date().toISOString(),
    action,
    category: getActionCategory(action),
    description: data.description,
    details: data.details || {},
    triggeredBy,
    impactedDomains: [],
    impactedFields: [],
    outcome: data.outcome || 'success',
  };

  logStore.push(entry);

  // Keep only last 1000 entries per company
  const companyLogs = logStore.filter(l => l.companyId === companyId);
  if (companyLogs.length > 1000) {
    const toRemove = companyLogs.slice(0, companyLogs.length - 1000);
    for (const log of toRemove) {
      const idx = logStore.indexOf(log);
      if (idx >= 0) logStore.splice(idx, 1);
    }
  }
}

function getActionCategory(action: AutopilotAction): AutopilotLogEntry['category'] {
  const categoryMap: Record<AutopilotAction, AutopilotLogEntry['category']> = {
    cycle_started: 'cycle',
    cycle_completed: 'cycle',
    hypothesis_generated: 'hypothesis',
    hypothesis_validated: 'hypothesis',
    experiment_created: 'experiment',
    experiment_started: 'experiment',
    experiment_completed: 'experiment',
    budget_reallocated: 'optimization',
    creative_optimized: 'optimization',
    audience_refined: 'optimization',
    signal_detected: 'signal',
    alert_triggered: 'signal',
    emergency_stop: 'signal',
    human_override: 'override',
    config_changed: 'cycle',
    quarter_plan_generated: 'cycle',
  };
  return categoryMap[action] || 'cycle';
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get cycle history for a company
 */
export function getCycleHistory(
  companyId: string,
  limit: number = 20
): CycleResult[] {
  const results = cycleResultStore.get(companyId) || [];
  return results.slice(-limit).reverse();
}

/**
 * Get autopilot logs for a company
 */
export function getAutopilotLogs(
  companyId: string,
  options: {
    limit?: number;
    category?: AutopilotLogEntry['category'];
    since?: string;
  } = {}
): AutopilotLogEntry[] {
  const { limit = 50, category, since } = options;

  let logs = logStore.filter(l => l.companyId === companyId);

  if (category) {
    logs = logs.filter(l => l.category === category);
  }

  if (since) {
    logs = logs.filter(l => l.timestamp >= since);
  }

  return logs.slice(-limit).reverse();
}

/**
 * Get experiments for a company
 */
export function getExperiments(
  companyId: string,
  status?: ExperimentPlan['status']
): ExperimentPlan[] {
  const experiments = experimentStore.get(companyId) || [];
  if (status) {
    return experiments.filter(e => e.status === status);
  }
  return experiments;
}

// ============================================================================
// Exports
// ============================================================================

export {
  logAutopilotAction,
};
