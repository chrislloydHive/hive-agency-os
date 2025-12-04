// lib/contextGraph/governance/adaptiveRules.ts
// Adaptive update rules for context graph evolution
//
// Phase 4: Rules that evolve based on performance and usage patterns

import { randomUUID } from 'crypto';
import type { CompanyContextGraph, DomainName } from '../companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Rule trigger types
 */
export type RuleTrigger =
  | 'time_elapsed'        // After a certain time period
  | 'value_changed'       // When a related field changes
  | 'performance_delta'   // When performance deviates from target
  | 'user_activity'       // Based on user behavior
  | 'external_signal'     // From external data source
  | 'ai_recommendation';  // AI suggests update

/**
 * Rule action types
 */
export type RuleAction =
  | 'suggest_update'      // Suggest human review
  | 'auto_update'         // Automatically update
  | 'flag_for_review'     // Mark for review
  | 'notify'              // Send notification
  | 'trigger_agent'       // Trigger an agent
  | 'archive';            // Archive old value

/**
 * An adaptive rule
 */
export interface AdaptiveRule {
  id: string;
  name: string;
  description: string;

  // Target
  targetDomain: DomainName;
  targetPath: string;

  // Trigger
  trigger: RuleTrigger;
  triggerConfig: Record<string, unknown>;

  // Conditions
  conditions: RuleCondition[];

  // Action
  action: RuleAction;
  actionConfig: Record<string, unknown>;

  // Learning
  isLearned: boolean;        // Was this rule learned from patterns?
  learningSource?: string;   // Pattern ID if learned

  // Performance
  executionCount: number;
  successRate: number;       // How often action was helpful
  lastExecutedAt?: string;

  // State
  enabled: boolean;
  priority: number;          // Higher = executes first
  createdAt: string;
  updatedAt: string;
}

/**
 * A condition for rule execution
 */
export interface RuleCondition {
  type: 'field_value' | 'field_age' | 'field_confidence' | 'user_role' | 'custom';
  field?: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'is_empty' | 'is_stale';
  value?: unknown;
  customFn?: string;  // Function name for custom conditions
}

/**
 * Rule execution result
 */
export interface RuleExecutionResult {
  ruleId: string;
  executed: boolean;
  success: boolean;
  action: RuleAction;
  result?: unknown;
  error?: string;
  executedAt: string;
}

/**
 * Rule performance metrics
 */
export interface RulePerformance {
  ruleId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageLatencyMs: number;
  userOverrideRate: number;  // How often users override the action
  lastEvaluated: string;
}

// ============================================================================
// Rule Storage (In-memory for now, replace with DB)
// ============================================================================

/** Store of adaptive rules */
const ruleStore = new Map<string, AdaptiveRule>();

/** Store of rule performance */
const performanceStore = new Map<string, RulePerformance>();

/** Store of rule execution history */
const executionHistory: RuleExecutionResult[] = [];

// ============================================================================
// Default Rules
// ============================================================================

const DEFAULT_RULES: Omit<AdaptiveRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Staleness rules
  {
    name: 'Audience data staleness',
    description: 'Flag audience data for review after 90 days',
    targetDomain: 'audience',
    targetPath: 'primaryAudience',
    trigger: 'time_elapsed',
    triggerConfig: { days: 90 },
    conditions: [
      { type: 'field_age', operator: 'greater', value: 90 },
    ],
    action: 'flag_for_review',
    actionConfig: { message: 'Audience data may be outdated' },
    isLearned: false,
    executionCount: 0,
    successRate: 0,
    enabled: true,
    priority: 5,
  },
  {
    name: 'Budget update on new quarter',
    description: 'Suggest budget review at start of each quarter',
    targetDomain: 'budgetOps',
    targetPath: 'monthlyBudget',
    trigger: 'time_elapsed',
    triggerConfig: { quarterStart: true },
    conditions: [],
    action: 'suggest_update',
    actionConfig: { message: 'New quarter - review budget allocation' },
    isLearned: false,
    executionCount: 0,
    successRate: 0,
    enabled: true,
    priority: 8,
  },

  // Performance delta rules
  {
    name: 'CPA deviation alert',
    description: 'Alert when actual CPA deviates significantly from target',
    targetDomain: 'performanceMedia',
    targetPath: 'targetCpa',
    trigger: 'performance_delta',
    triggerConfig: { threshold: 0.2 },  // 20% deviation
    conditions: [],
    action: 'trigger_agent',
    actionConfig: { agentType: 'media_agent', intent: 'diagnose_media_performance' },
    isLearned: false,
    executionCount: 0,
    successRate: 0,
    enabled: true,
    priority: 9,
  },

  // Value change cascades
  {
    name: 'Update creative on brand change',
    description: 'Suggest creative review when brand positioning changes',
    targetDomain: 'creative',
    targetPath: 'messagingAngles',
    trigger: 'value_changed',
    triggerConfig: { watchField: 'brand.positioning' },
    conditions: [],
    action: 'suggest_update',
    actionConfig: { message: 'Brand positioning changed - review messaging angles' },
    isLearned: false,
    executionCount: 0,
    successRate: 0,
    enabled: true,
    priority: 7,
  },
  {
    name: 'Update SEO on product change',
    description: 'Review keywords when product offering changes',
    targetDomain: 'seo',
    targetPath: 'primaryKeywords',
    trigger: 'value_changed',
    triggerConfig: { watchField: 'productOffer.valueProps' },
    conditions: [],
    action: 'flag_for_review',
    actionConfig: { message: 'Product changed - keywords may need update' },
    isLearned: false,
    executionCount: 0,
    successRate: 0,
    enabled: true,
    priority: 6,
  },

  // AI recommendation rules
  {
    name: 'AI-suggested field fill',
    description: 'Trigger prediction when high-confidence field is empty',
    targetDomain: 'brand',
    targetPath: 'differentiators',
    trigger: 'ai_recommendation',
    triggerConfig: { minConfidence: 0.8 },
    conditions: [
      { type: 'field_value', operator: 'is_empty' },
    ],
    action: 'suggest_update',
    actionConfig: { usePredictor: true },
    isLearned: false,
    executionCount: 0,
    successRate: 0,
    enabled: true,
    priority: 4,
  },
];

// ============================================================================
// Rule Management
// ============================================================================

/**
 * Initialize default rules
 */
export function initializeDefaultRules(): void {
  for (const rule of DEFAULT_RULES) {
    const id = `rule_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    ruleStore.set(id, {
      ...rule,
      id,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Create a new rule
 */
export function createRule(
  rule: Omit<AdaptiveRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'successRate'>
): AdaptiveRule {
  const id = `rule_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const newRule: AdaptiveRule = {
    ...rule,
    id,
    executionCount: 0,
    successRate: 0,
    createdAt: now,
    updatedAt: now,
  };

  ruleStore.set(id, newRule);
  return newRule;
}

/**
 * Update a rule
 */
export function updateRule(
  ruleId: string,
  updates: Partial<AdaptiveRule>
): AdaptiveRule | null {
  const rule = ruleStore.get(ruleId);
  if (!rule) return null;

  const updatedRule: AdaptiveRule = {
    ...rule,
    ...updates,
    id: rule.id,
    createdAt: rule.createdAt,
    updatedAt: new Date().toISOString(),
  };

  ruleStore.set(ruleId, updatedRule);
  return updatedRule;
}

/**
 * Delete a rule
 */
export function deleteRule(ruleId: string): boolean {
  return ruleStore.delete(ruleId);
}

/**
 * Get all rules
 */
export function getAllRules(): AdaptiveRule[] {
  return Array.from(ruleStore.values())
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Get rules for a domain
 */
export function getRulesForDomain(domain: DomainName): AdaptiveRule[] {
  return getAllRules().filter(r => r.targetDomain === domain);
}

/**
 * Get rules by trigger type
 */
export function getRulesByTrigger(trigger: RuleTrigger): AdaptiveRule[] {
  return getAllRules().filter(r => r.trigger === trigger);
}

// ============================================================================
// Rule Evaluation
// ============================================================================

/**
 * Evaluate all rules for a company
 */
export function evaluateRules(
  companyId: string,
  graph: CompanyContextGraph,
  context?: {
    changedField?: string;
    performanceData?: Record<string, number>;
    userRole?: string;
  }
): RuleExecutionResult[] {
  const results: RuleExecutionResult[] = [];
  const rules = getAllRules().filter(r => r.enabled);

  for (const rule of rules) {
    const shouldExecute = checkRuleTrigger(rule, graph, context);
    if (!shouldExecute) continue;

    const conditionsMet = checkRuleConditions(rule, graph);
    if (!conditionsMet) continue;

    const result = executeRuleAction(rule, companyId, graph);
    results.push(result);

    // Update execution history
    executionHistory.push(result);
    if (executionHistory.length > 1000) {
      executionHistory.shift();  // Keep last 1000
    }

    // Update rule stats
    rule.executionCount++;
    rule.lastExecutedAt = result.executedAt;
    if (result.success) {
      rule.successRate = (rule.successRate * (rule.executionCount - 1) + 1) / rule.executionCount;
    } else {
      rule.successRate = (rule.successRate * (rule.executionCount - 1)) / rule.executionCount;
    }
  }

  return results;
}

function checkRuleTrigger(
  rule: AdaptiveRule,
  graph: CompanyContextGraph,
  context?: {
    changedField?: string;
    performanceData?: Record<string, number>;
  }
): boolean {
  switch (rule.trigger) {
    case 'time_elapsed':
      return checkTimeElapsedTrigger(rule, graph);

    case 'value_changed':
      const watchField = rule.triggerConfig.watchField as string;
      return context?.changedField === watchField;

    case 'performance_delta':
      return checkPerformanceDeltaTrigger(rule, graph, context?.performanceData);

    case 'ai_recommendation':
      return checkAIRecommendationTrigger(rule, graph);

    case 'user_activity':
    case 'external_signal':
      // These require external triggers
      return false;

    default:
      return false;
  }
}

function checkTimeElapsedTrigger(
  rule: AdaptiveRule,
  graph: CompanyContextGraph
): boolean {
  const domain = graph[rule.targetDomain];
  if (!domain) return false;

  const field = (domain as Record<string, unknown>)[rule.targetPath];
  if (!field || typeof field !== 'object') return false;

  const updatedAt = (field as { updatedAt?: string }).updatedAt;
  if (!updatedAt) return true;  // No update time = stale

  const daysSinceUpdate = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  const thresholdDays = (rule.triggerConfig.days as number) || 90;

  return daysSinceUpdate >= thresholdDays;
}

function checkPerformanceDeltaTrigger(
  rule: AdaptiveRule,
  graph: CompanyContextGraph,
  performanceData?: Record<string, number>
): boolean {
  if (!performanceData) return false;

  const domain = graph[rule.targetDomain];
  if (!domain) return false;

  const field = (domain as Record<string, unknown>)[rule.targetPath];
  if (!field || typeof field !== 'object' || !('value' in field)) return false;

  const targetValue = (field as { value: unknown }).value;
  if (typeof targetValue !== 'number') return false;

  const actualKey = `${rule.targetDomain}.${rule.targetPath}`;
  const actualValue = performanceData[actualKey];
  if (typeof actualValue !== 'number') return false;

  const threshold = (rule.triggerConfig.threshold as number) || 0.2;
  const deviation = Math.abs(actualValue - targetValue) / targetValue;

  return deviation >= threshold;
}

function checkAIRecommendationTrigger(
  rule: AdaptiveRule,
  graph: CompanyContextGraph
): boolean {
  // Check if field is empty and would benefit from AI fill
  const domain = graph[rule.targetDomain];
  if (!domain) return true;  // Empty domain = opportunity

  const field = (domain as Record<string, unknown>)[rule.targetPath];
  if (!field || typeof field !== 'object') return true;

  const value = (field as { value?: unknown }).value;
  return value === null || value === undefined;
}

function checkRuleConditions(
  rule: AdaptiveRule,
  graph: CompanyContextGraph
): boolean {
  for (const condition of rule.conditions) {
    if (!checkCondition(condition, graph, rule.targetDomain, rule.targetPath)) {
      return false;
    }
  }
  return true;
}

function checkCondition(
  condition: RuleCondition,
  graph: CompanyContextGraph,
  targetDomain: DomainName,
  targetPath: string
): boolean {
  const domain = graph[targetDomain];
  const field = domain ? (domain as Record<string, unknown>)[targetPath] : null;

  switch (condition.type) {
    case 'field_value':
      if (!field || typeof field !== 'object' || !('value' in field)) {
        return condition.operator === 'is_empty';
      }
      const value = (field as { value: unknown }).value;
      return evaluateOperator(value, condition.operator, condition.value);

    case 'field_age':
      if (!field || typeof field !== 'object') return false;
      const updatedAt = (field as { updatedAt?: string }).updatedAt;
      if (!updatedAt) return true;
      const ageDays = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      return evaluateOperator(ageDays, condition.operator, condition.value);

    case 'field_confidence':
      if (!field || typeof field !== 'object') return false;
      const confidence = (field as { confidence?: number }).confidence || 0;
      return evaluateOperator(confidence, condition.operator, condition.value);

    default:
      return true;
  }
}

function evaluateOperator(
  value: unknown,
  operator: string,
  target: unknown
): boolean {
  switch (operator) {
    case 'equals':
      return value === target;
    case 'not_equals':
      return value !== target;
    case 'greater':
      return typeof value === 'number' && typeof target === 'number' && value > target;
    case 'less':
      return typeof value === 'number' && typeof target === 'number' && value < target;
    case 'contains':
      if (typeof value === 'string') return value.includes(String(target));
      if (Array.isArray(value)) return value.includes(target);
      return false;
    case 'is_empty':
      return value === null || value === undefined ||
        (Array.isArray(value) && value.length === 0) ||
        value === '';
    case 'is_stale':
      // Staleness is checked in field_age condition
      return false;
    default:
      return false;
  }
}

// ============================================================================
// Rule Actions
// ============================================================================

function executeRuleAction(
  rule: AdaptiveRule,
  companyId: string,
  graph: CompanyContextGraph
): RuleExecutionResult {
  const now = new Date().toISOString();

  try {
    let result: unknown;

    switch (rule.action) {
      case 'suggest_update':
        result = {
          type: 'suggestion',
          field: `${rule.targetDomain}.${rule.targetPath}`,
          message: rule.actionConfig.message || 'Consider updating this field',
          usePredictor: rule.actionConfig.usePredictor || false,
        };
        break;

      case 'flag_for_review':
        result = {
          type: 'flag',
          field: `${rule.targetDomain}.${rule.targetPath}`,
          message: rule.actionConfig.message || 'Flagged for review',
          severity: rule.actionConfig.severity || 'medium',
        };
        break;

      case 'notify':
        result = {
          type: 'notification',
          channel: rule.actionConfig.channel || 'in_app',
          message: rule.actionConfig.message,
          recipients: rule.actionConfig.recipients || ['admin'],
        };
        break;

      case 'trigger_agent':
        result = {
          type: 'agent_trigger',
          agentType: rule.actionConfig.agentType,
          intent: rule.actionConfig.intent,
          companyId,
        };
        break;

      case 'auto_update':
        // Auto-update requires additional safety checks
        result = {
          type: 'auto_update_blocked',
          reason: 'Auto-update requires explicit approval',
        };
        break;

      case 'archive':
        result = {
          type: 'archive',
          field: `${rule.targetDomain}.${rule.targetPath}`,
        };
        break;

      default:
        result = { type: 'unknown_action' };
    }

    return {
      ruleId: rule.id,
      executed: true,
      success: true,
      action: rule.action,
      result,
      executedAt: now,
    };
  } catch (error) {
    return {
      ruleId: rule.id,
      executed: true,
      success: false,
      action: rule.action,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: now,
    };
  }
}

// ============================================================================
// Rule Learning
// ============================================================================

/**
 * Learn a new rule from observed patterns
 */
export function learnRuleFromPattern(
  patternId: string,
  pattern: {
    condition: { domain: DomainName; path: string; operator: string; value: unknown };
    outcome: { domain: DomainName; path: string };
    confidence: number;
  }
): AdaptiveRule {
  return createRule({
    name: `Learned: ${pattern.condition.path} → ${pattern.outcome.path}`,
    description: `Automatically learned rule: When ${pattern.condition.path} matches, update ${pattern.outcome.path}`,
    targetDomain: pattern.outcome.domain,
    targetPath: pattern.outcome.path,
    trigger: 'value_changed',
    triggerConfig: { watchField: `${pattern.condition.domain}.${pattern.condition.path}` },
    conditions: [{
      type: 'field_value',
      field: `${pattern.condition.domain}.${pattern.condition.path}`,
      operator: pattern.condition.operator as RuleCondition['operator'],
      value: pattern.condition.value,
    }],
    action: 'suggest_update',
    actionConfig: { confidence: pattern.confidence },
    isLearned: true,
    learningSource: patternId,
    enabled: pattern.confidence >= 0.7,
    priority: Math.round(pattern.confidence * 5),
  });
}

/**
 * Adapt rules based on performance
 */
export function adaptRules(): Array<{ ruleId: string; change: string }> {
  const changes: Array<{ ruleId: string; change: string }> = [];

  for (const rule of getAllRules()) {
    if (rule.executionCount < 10) continue;  // Need enough data

    // Disable poorly performing rules
    if (rule.successRate < 0.3 && rule.enabled) {
      updateRule(rule.id, { enabled: false });
      changes.push({
        ruleId: rule.id,
        change: `Disabled due to low success rate (${Math.round(rule.successRate * 100)}%)`,
      });
    }

    // Increase priority of high-performing rules
    if (rule.successRate > 0.8 && rule.priority < 10) {
      updateRule(rule.id, { priority: Math.min(10, rule.priority + 1) });
      changes.push({
        ruleId: rule.id,
        change: `Increased priority due to high success rate`,
      });
    }

    // Decrease priority of moderate-performing rules
    if (rule.successRate < 0.5 && rule.successRate >= 0.3 && rule.priority > 1) {
      updateRule(rule.id, { priority: Math.max(1, rule.priority - 1) });
      changes.push({
        ruleId: rule.id,
        change: `Decreased priority due to moderate success rate`,
      });
    }
  }

  return changes;
}

// ============================================================================
// Stats & History
// ============================================================================

/**
 * Get rule performance stats
 */
export function getRulePerformance(ruleId: string): RulePerformance | null {
  const rule = ruleStore.get(ruleId);
  if (!rule) return null;

  const ruleExecutions = executionHistory.filter(e => e.ruleId === ruleId);
  const successful = ruleExecutions.filter(e => e.success).length;
  const failed = ruleExecutions.filter(e => !e.success).length;

  return {
    ruleId,
    totalExecutions: rule.executionCount,
    successfulExecutions: successful,
    failedExecutions: failed,
    averageLatencyMs: 0,  // Would need timing data
    userOverrideRate: 0,  // Would need user feedback data
    lastEvaluated: rule.lastExecutedAt || rule.createdAt,
  };
}

/**
 * Get execution history
 */
export function getExecutionHistory(
  limit: number = 100,
  ruleId?: string
): RuleExecutionResult[] {
  let history = [...executionHistory].reverse();

  if (ruleId) {
    history = history.filter(e => e.ruleId === ruleId);
  }

  return history.slice(0, limit);
}

/**
 * Get adaptive rules stats
 */
export function getAdaptiveRulesStats(): {
  totalRules: number;
  enabledRules: number;
  learnedRules: number;
  totalExecutions: number;
  averageSuccessRate: number;
} {
  const rules = getAllRules();
  const enabled = rules.filter(r => r.enabled);
  const learned = rules.filter(r => r.isLearned);

  const totalExecutions = rules.reduce((sum, r) => sum + r.executionCount, 0);
  const avgSuccessRate = rules.length > 0
    ? rules.reduce((sum, r) => sum + r.successRate, 0) / rules.length
    : 0;

  return {
    totalRules: rules.length,
    enabledRules: enabled.length,
    learnedRules: learned.length,
    totalExecutions,
    averageSuccessRate: avgSuccessRate,
  };
}
