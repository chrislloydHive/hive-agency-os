// lib/hiveBrain/index.ts
// Hive Brain - Central Intelligence Layer
//
// The Hive Brain is the meta-reasoning layer that sits on top of
// all company context graphs and provides:
// - Cross-company reasoning and pattern detection
// - Causal modeling (not just correlation)
// - Strategy simulation before execution
// - Multi-agent orchestration
// - Vertical playbook generation
// - Policy enforcement
// - Self-assessment and learning

// ============================================================================
// Re-exports
// ============================================================================

// Types
export * from './types';

// Reasoner - Central thinking engine
export {
  reason,
  askAboutVertical,
  compareVerticals,
  identifyAttentionNeeded,
  getHiveSummary,
} from './reasoner';

// Causal Model - Causal reasoning (not just correlation)
export {
  createBaseCausalGraph,
  inferCausalRelationshipsForVertical,
  explainObservedChange,
  predictInterventionEffect,
  findBestIntervention,
} from './causalModel';

// Simulation Engine - Strategy "what if" scenarios
export {
  simulateStrategy,
} from './simulationEngine';

// Agent Orchestrator - Multi-agent coordination
export {
  decomposeGoal,
  createOrchestration,
  getReadyTasks,
  updateTaskState,
  getOrchestrationProgress,
  runOrchestration,
  getAgentCapabilities,
  listAgents,
  findAgentsForTask,
} from './agentOrchestrator';

// Playbook Engine - Vertical playbooks
export {
  generatePlaybook,
  updatePlaybook,
  getPlaybookRecommendationsForCompany,
  listVerticals,
  detectVertical,
  getSeasonalInsights,
} from './playbookEngine';

// Policy Engine - Governance constraints
export {
  getAllPolicies,
  getPoliciesForScope,
  addPolicy,
  removePolicy,
  evaluatePolicies,
  checkBudgetChange,
  checkCreativeCompliance,
  checkAutopilotAction,
  getPolicySummary,
  createPolicy,
} from './policyEngine';
export type { PolicyContext } from './policyEngine';

// Meta-Evaluator - Self-assessment
export {
  recordPrediction,
  evaluatePrediction,
  getPredictionAccuracy,
  recordDecision,
  rateDecision,
  getAutopilotQuality,
  recordPlaybookUsage,
  getPlaybookEffectiveness,
  runMetaEvaluation,
  clearTrackingData,
  getTrackingStats,
  exportData,
} from './metaEvaluator';
export type {
  RecordedPrediction,
  AutopilotDecision,
  PlaybookUsage,
} from './metaEvaluator';
