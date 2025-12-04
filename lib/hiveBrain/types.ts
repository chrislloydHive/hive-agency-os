// lib/hiveBrain/types.ts
// Core types for the Hive Brain system
//
// The Hive Brain is a meta-reasoning layer that:
// - Thinks across ALL companies and verticals
// - Performs causal reasoning (not just correlation)
// - Simulates strategies before applying them
// - Orchestrates multiple agents across Labs & Autopilot
// - Generates evolving vertical playbooks

// ============================================================================
// Reasoning Types
// ============================================================================

/**
 * A structured conclusion from the Hive Reasoner
 */
export interface ReasonerConclusion {
  /** The question that was asked */
  question: string;
  /** Key findings from the analysis */
  findings: string[];
  /** Hypotheses about causal relationships */
  causalHypotheses: string[];
  /** Recommended actions based on findings */
  recommendedActions: string[];
  /** Verticals affected by this conclusion */
  affectedVerticals: string[];
  /** Confidence in the conclusion (0-1) */
  confidence: number;
  /** Evidence supporting the conclusion */
  evidence: ReasonerEvidence[];
  /** Timestamp of analysis */
  analyzedAt: string;
  /** Companies analyzed */
  companiesAnalyzed: number;
}

/**
 * Evidence supporting a reasoner conclusion
 */
export interface ReasonerEvidence {
  type: 'metric' | 'pattern' | 'experiment' | 'benchmark' | 'correlation';
  description: string;
  companyIds?: string[];
  verticalId?: string;
  strength: 'strong' | 'moderate' | 'weak';
  dataPoints?: number;
}

/**
 * Input for a reasoning query
 */
export interface ReasonerQuery {
  /** The question to answer */
  question: string;
  /** Optional focus on specific verticals */
  verticalFilter?: string[];
  /** Optional focus on specific companies */
  companyFilter?: string[];
  /** Time range for analysis */
  timeRange?: '30d' | '90d' | '1y' | 'all';
  /** Depth of analysis */
  depth?: 'quick' | 'standard' | 'deep';
}

// ============================================================================
// Causal Model Types
// ============================================================================

/**
 * A node in the causal graph
 */
export interface CausalNode {
  id: string;
  name: string;
  type: 'metric' | 'action' | 'external' | 'state';
  domain: string;
  /** Current value or state */
  currentValue?: number | string;
  /** Historical values for trend analysis */
  history?: Array<{ date: string; value: number | string }>;
}

/**
 * An edge in the causal graph representing a causal relationship
 */
export interface CausalEdge {
  from: string;
  to: string;
  /** Strength of causal relationship (-1 to 1) */
  strength: number;
  /** Confidence in this relationship */
  confidence: number;
  /** Source of this relationship knowledge */
  source: 'learned' | 'domain_knowledge' | 'experiment' | 'inferred';
  /** Lag in days between cause and effect */
  lagDays?: number;
  /** Direction of effect */
  direction: 'positive' | 'negative';
}

/**
 * A causal graph for a vertical or company
 */
export interface CausalGraph {
  id: string;
  verticalId: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * Explanation of an observed change
 */
export interface CausalExplanation {
  /** The metric that changed */
  metric: string;
  /** Root causes identified */
  rootCauses: string[];
  /** Contributing factors (not primary causes) */
  contributingFactors: string[];
  /** Counterfactual scenarios */
  counterfactuals: string[];
  /** Confidence in explanation */
  confidence: number;
  /** Evidence trail */
  evidenceChain: Array<{
    node: string;
    contribution: number;
    explanation: string;
  }>;
}

// ============================================================================
// Simulation Types
// ============================================================================

/**
 * Input for a strategy simulation
 */
export interface SimulationInput {
  /** Target scope */
  target: 'single_company' | 'vertical' | 'cluster';
  /** Company IDs (for single_company or cluster) */
  companyIds?: string[];
  /** Vertical ID (for vertical target) */
  verticalId?: string;
  /** Time horizon for simulation */
  timeHorizon: '30d' | '90d' | '1y';
  /** Strategy changes to simulate */
  changes: StrategyChanges;
  /** Number of simulations to run (for Monte Carlo) */
  iterations?: number;
}

/**
 * Strategy changes to simulate
 */
export interface StrategyChanges {
  /** Channel mix changes (percentage shifts) */
  channelMix?: Record<string, number>;
  /** Creative mix changes (percentage shifts) */
  creativeMix?: Record<string, number>;
  /** Persona focus changes */
  personaFocus?: string[];
  /** Site/UX changes */
  siteChanges?: string[];
  /** Budget changes (percentage) */
  budgetChange?: number;
  /** Custom changes */
  custom?: Record<string, unknown>;
}

/**
 * Result of a strategy simulation
 */
export interface SimulationResult {
  /** Input that was simulated */
  input: SimulationInput;
  /** Projected impact */
  projectedImpact: {
    installsDelta: number;
    revenueDelta: number;
    cpaDelta: number;
    leadsDelta: number;
    roasDelta: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  /** Best case scenario description */
  bestCase: string;
  /** Worst case scenario description */
  worstCase: string;
  /** Narrative summary of simulation */
  narrativeSummary: string;
  /** Confidence intervals */
  confidenceIntervals: {
    installsDelta: [number, number];
    revenueDelta: [number, number];
    cpaDelta: [number, number];
  };
  /** Key assumptions made */
  assumptions: string[];
  /** Risks identified */
  risks: string[];
  /** When simulation was run */
  simulatedAt: string;
}

// ============================================================================
// Agent Orchestration Types
// ============================================================================

/**
 * Available agent types
 */
export type AgentType =
  | 'media'
  | 'creative'
  | 'audience'
  | 'seo'
  | 'website'
  | 'brand'
  | 'executive'
  | 'diagnostics';

/**
 * Agent state
 */
export type AgentState = 'idle' | 'pending' | 'planning' | 'executing' | 'waiting' | 'completed' | 'failed';

/**
 * A task assigned to an agent
 */
export interface AgentTask {
  id: string;
  agentType: AgentType;
  /** Parent orchestration ID */
  orchestrationId: string;
  /** Task description */
  description: string;
  /** Task priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Current state */
  state: AgentState;
  /** Dependencies (other task IDs that must complete first) */
  dependencies: string[];
  /** Input data for the task */
  input: Record<string, unknown>;
  /** Output from the task */
  output?: Record<string, unknown>;
  /** Company IDs this task affects */
  companyIds: string[];
  /** Error if failed */
  error?: string;
  /** Timestamps */
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * A multi-agent orchestration
 */
export interface Orchestration {
  id: string;
  /** High-level goal */
  goal: string;
  /** Source of the orchestration */
  source: 'reasoner' | 'autopilot' | 'human' | 'playbook';
  /** Current state */
  state: 'planning' | 'executing' | 'completed' | 'failed' | 'paused';
  /** All tasks in this orchestration */
  tasks: AgentTask[];
  /** Company IDs involved */
  companyIds: string[];
  /** Vertical ID if applicable */
  verticalId?: string;
  /** Results summary */
  resultsSummary?: string;
  /** Human who initiated (if applicable) */
  initiatedBy?: string;
  /** Timestamps */
  createdAt: string;
  completedAt?: string;
}

// ============================================================================
// Playbook Types
// ============================================================================

/**
 * Benchmark ranges for a metric
 */
export interface BenchmarkRange {
  metric: string;
  good: number;
  elite: number;
  unit?: string;
  description?: string;
}

/**
 * A vertical playbook
 */
export interface VerticalPlaybook {
  id: string;
  verticalId: string;
  verticalName: string;
  version: number;
  lastUpdated: string;
  /** Core narrative/positioning for this vertical */
  coreNarrative: string;
  /** Audience archetypes that work for this vertical */
  archetypes: string[];
  /** Media mix guidelines */
  mediaGuidelines: string[];
  /** Creative guidelines */
  creativeGuidelines: string[];
  /** Diagnostic checklist when things go wrong */
  diagnosticChecklist: string[];
  /** Benchmark ranges for key metrics */
  benchmarkRanges: BenchmarkRange[];
  /** Anti-patterns to avoid */
  antiPatterns: string[];
  /** Seasonal patterns and key dates */
  seasonalPatterns: Array<{
    name: string;
    months: number[];
    impact: 'high' | 'medium' | 'low';
    recommendations: string[];
  }>;
  /** Risk and compliance constraints */
  riskConstraints: string[];
  /** Success stories/case studies */
  successStories: Array<{
    companyId: string;
    summary: string;
    keyFactors: string[];
  }>;
  /** Generated from how many companies */
  sampleSize: number;
  /** Confidence in playbook */
  confidence: number;
}

// ============================================================================
// Policy Types
// ============================================================================

/**
 * A global policy that constrains Hive Brain behavior
 */
export interface HivePolicy {
  id: string;
  name: string;
  description: string;
  type: 'forbidden' | 'required' | 'limit' | 'priority';
  /** Scope of the policy */
  scope: 'global' | 'vertical' | 'company';
  /** Vertical ID if scope is 'vertical' */
  verticalId?: string;
  /** Company ID if scope is 'company' */
  companyId?: string;
  /** Policy rules */
  rules: PolicyRule[];
  /** Whether policy is active */
  active: boolean;
  /** Who created this policy */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A single rule within a policy
 */
export interface PolicyRule {
  id: string;
  condition: string;
  action: 'block' | 'warn' | 'require_approval' | 'log';
  message: string;
  /** Severity of violation */
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Result of a policy evaluation
 */
export interface PolicyEvaluationResult {
  allowed: boolean;
  violations: Array<{
    policyId: string;
    policyName: string;
    ruleId: string;
    message: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    action: 'block' | 'warn' | 'require_approval' | 'log';
  }>;
  warnings: string[];
  requiredApprovals: string[];
}

// ============================================================================
// Meta-Evaluation Types
// ============================================================================

/**
 * Self-assessment of Hive Brain performance
 */
export interface MetaEvaluation {
  /** Overall intelligence score (0-100) */
  overallIntelligenceScore: number;
  /** Scores by vertical */
  verticalScores: Record<string, number>;
  /** Key wins to celebrate */
  keyWins: string[];
  /** Key failures to learn from */
  keyFailures: string[];
  /** Actions to take based on evaluation */
  learningActions: string[];
  /** Prediction accuracy metrics */
  predictionAccuracy: {
    overall: number;
    byMetric: Record<string, number>;
  };
  /** Autopilot decision quality */
  autopilotQuality: {
    decisionsEvaluated: number;
    goodDecisions: number;
    badDecisions: number;
    neutralDecisions: number;
  };
  /** Playbook effectiveness */
  playbookEffectiveness: Record<string, number>;
  /** When evaluation was performed */
  evaluatedAt: string;
  /** Time period evaluated */
  periodStart: string;
  periodEnd: string;
}

// ============================================================================
// Sandbox Types
// ============================================================================

/**
 * A sandbox session for safe experimentation
 */
export interface SandboxSession {
  id: string;
  /** User who created the sandbox */
  createdBy: string;
  /** Current state */
  state: 'active' | 'completed' | 'abandoned';
  /** Proposals generated in this session */
  proposals: SandboxProposal[];
  /** Notes/observations */
  notes: string[];
  createdAt: string;
  completedAt?: string;
}

/**
 * A proposal generated in sandbox mode
 */
export interface SandboxProposal {
  id: string;
  type: 'strategy' | 'playbook' | 'policy' | 'schema';
  title: string;
  description: string;
  /** The actual proposed changes */
  changes: Record<string, unknown>;
  /** Simulation results if applicable */
  simulationResult?: SimulationResult;
  /** Whether proposal was approved */
  approved?: boolean;
  /** Who approved (if approved) */
  approvedBy?: string;
  approvedAt?: string;
}
