// lib/hiveBrain/policyEngine.ts
// Policy Engine - Governance Constraints
//
// Defines and enforces policies that constrain Hive Brain behavior.
// Policies can be:
// - Global: Apply to all companies/verticals
// - Vertical-specific: Apply to companies in a vertical
// - Company-specific: Apply to a single company
//
// Policy types:
// - Forbidden: Actions that must never happen
// - Required: Actions that must always happen
// - Limit: Numerical constraints
// - Priority: Ordering of actions

import type {
  HivePolicy,
  PolicyRule,
  PolicyEvaluationResult,
} from './types';

// ============================================================================
// Built-in Policies
// ============================================================================

/**
 * Default global policies
 */
const GLOBAL_POLICIES: HivePolicy[] = [
  {
    id: 'global-budget-safety',
    name: 'Budget Safety',
    description: 'Prevent excessive budget changes',
    type: 'limit',
    scope: 'global',
    rules: [
      {
        id: 'budget-increase-limit',
        condition: 'budget_change_percent > 50',
        action: 'require_approval',
        message: 'Budget increases over 50% require human approval',
        severity: 'high',
      },
      {
        id: 'budget-decrease-limit',
        condition: 'budget_change_percent < -30',
        action: 'warn',
        message: 'Significant budget decrease detected (>30%)',
        severity: 'medium',
      },
    ],
    active: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'global-channel-diversity',
    name: 'Channel Diversity',
    description: 'Prevent over-reliance on single channel',
    type: 'limit',
    scope: 'global',
    rules: [
      {
        id: 'single-channel-concentration',
        condition: 'single_channel_share > 0.8',
        action: 'warn',
        message: 'Over 80% of budget in single channel - consider diversification',
        severity: 'medium',
      },
    ],
    active: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'global-tracking-required',
    name: 'Tracking Required',
    description: 'Ensure proper tracking before scaling',
    type: 'required',
    scope: 'global',
    rules: [
      {
        id: 'conversion-tracking',
        condition: 'has_conversion_tracking == false && budget > 5000',
        action: 'block',
        message: 'Cannot scale budget above $5000 without conversion tracking',
        severity: 'critical',
      },
      {
        id: 'analytics-tracking',
        condition: 'has_analytics == false',
        action: 'warn',
        message: 'Analytics not properly configured',
        severity: 'medium',
      },
    ],
    active: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'global-brand-safety',
    name: 'Brand Safety',
    description: 'Protect brand reputation',
    type: 'forbidden',
    scope: 'global',
    rules: [
      {
        id: 'competitor-targeting',
        condition: 'targeting_competitor_brand == true && explicit_approval == false',
        action: 'require_approval',
        message: 'Competitor brand targeting requires explicit client approval',
        severity: 'high',
      },
      {
        id: 'sensitive-topics',
        condition: 'uses_sensitive_topics == true',
        action: 'block',
        message: 'Content touches sensitive topics - manual review required',
        severity: 'critical',
      },
    ],
    active: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'global-autopilot-limits',
    name: 'Autopilot Limits',
    description: 'Constrain autonomous actions',
    type: 'limit',
    scope: 'global',
    rules: [
      {
        id: 'autopilot-pause-limit',
        condition: 'autopilot_action == "pause" && campaign_spend > 1000',
        action: 'require_approval',
        message: 'Pausing high-spend campaigns requires approval',
        severity: 'high',
      },
      {
        id: 'autopilot-frequency',
        condition: 'autopilot_actions_today > 10',
        action: 'warn',
        message: 'High autopilot activity today - consider review',
        severity: 'medium',
      },
    ],
    active: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Vertical-specific policies
 */
const VERTICAL_POLICIES: HivePolicy[] = [
  {
    id: 'healthcare-compliance',
    name: 'Healthcare Compliance',
    description: 'HIPAA and healthcare advertising compliance',
    type: 'forbidden',
    scope: 'vertical',
    verticalId: 'healthcare',
    rules: [
      {
        id: 'no-medical-claims',
        condition: 'makes_medical_claims == true',
        action: 'block',
        message: 'Medical claims in advertising are prohibited',
        severity: 'critical',
      },
      {
        id: 'no-before-after',
        condition: 'uses_before_after_images == true && platform == "Meta"',
        action: 'block',
        message: 'Before/after images prohibited on Meta for healthcare',
        severity: 'critical',
      },
    ],
    active: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'finance-compliance',
    name: 'Financial Services Compliance',
    description: 'Financial advertising compliance',
    type: 'required',
    scope: 'vertical',
    verticalId: 'professional_services',
    rules: [
      {
        id: 'disclosure-required',
        condition: 'mentions_returns == true && has_disclosure == false',
        action: 'block',
        message: 'Financial returns claims require disclosure',
        severity: 'critical',
      },
    ],
    active: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ============================================================================
// Policy Storage (In-Memory)
// ============================================================================

// In production, this would be backed by a database
let customPolicies: HivePolicy[] = [];

/**
 * Get all active policies
 */
export function getAllPolicies(): HivePolicy[] {
  return [...GLOBAL_POLICIES, ...VERTICAL_POLICIES, ...customPolicies].filter(
    (p) => p.active
  );
}

/**
 * Get policies for a specific scope
 */
export function getPoliciesForScope(
  scope: 'global' | 'vertical' | 'company',
  scopeId?: string
): HivePolicy[] {
  return getAllPolicies().filter((p) => {
    if (p.scope === 'global') return true;
    if (p.scope === scope) {
      if (scope === 'vertical' && p.verticalId === scopeId) return true;
      if (scope === 'company' && p.companyId === scopeId) return true;
    }
    return false;
  });
}

/**
 * Add a custom policy
 */
export function addPolicy(policy: HivePolicy): void {
  customPolicies.push(policy);
}

/**
 * Remove a custom policy
 */
export function removePolicy(policyId: string): boolean {
  const index = customPolicies.findIndex((p) => p.id === policyId);
  if (index >= 0) {
    customPolicies.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Update a policy's active status
 */
export function setPolcyActive(policyId: string, active: boolean): boolean {
  const policy = customPolicies.find((p) => p.id === policyId);
  if (policy) {
    policy.active = active;
    policy.updatedAt = new Date().toISOString();
    return true;
  }
  return false;
}

// ============================================================================
// Policy Evaluation
// ============================================================================

/**
 * Context for policy evaluation
 */
export interface PolicyContext {
  // Budget
  budget?: number;
  budget_change_percent?: number;

  // Channel
  single_channel_share?: number;
  channels?: string[];

  // Tracking
  has_conversion_tracking?: boolean;
  has_analytics?: boolean;

  // Content
  targeting_competitor_brand?: boolean;
  explicit_approval?: boolean;
  uses_sensitive_topics?: boolean;
  makes_medical_claims?: boolean;
  uses_before_after_images?: boolean;
  mentions_returns?: boolean;
  has_disclosure?: boolean;

  // Autopilot
  autopilot_action?: string;
  campaign_spend?: number;
  autopilot_actions_today?: number;

  // Platform
  platform?: string;

  // Scope identifiers
  companyId?: string;
  verticalId?: string;

  // Custom
  [key: string]: unknown;
}

/**
 * Evaluate a condition string against context
 */
function evaluateCondition(condition: string, context: PolicyContext): boolean {
  // Simple condition parser
  // Supports: ==, !=, >, <, >=, <=, &&, ||

  try {
    // Replace variable references with context values
    let evalString = condition;

    // Extract all variable names (word characters before operators)
    const varMatches = condition.match(/\b[a-z_][a-z0-9_]*\b/gi) || [];
    const uniqueVars = [...new Set(varMatches)].filter(
      (v) => !['true', 'false', 'null', 'undefined'].includes(v)
    );

    for (const varName of uniqueVars) {
      const value = context[varName];
      let replacement: string;

      if (value === undefined) {
        replacement = 'undefined';
      } else if (value === null) {
        replacement = 'null';
      } else if (typeof value === 'string') {
        replacement = `"${value}"`;
      } else if (typeof value === 'boolean') {
        replacement = value ? 'true' : 'false';
      } else if (typeof value === 'number') {
        replacement = value.toString();
      } else {
        replacement = 'undefined';
      }

      // Use word boundary replacement to avoid partial matches
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      evalString = evalString.replace(regex, replacement);
    }

    // Safely evaluate the condition
    // Note: In production, use a proper expression parser instead of eval
    const result = safeEvaluate(evalString);
    return result === true;
  } catch {
    console.warn(`Failed to evaluate condition: ${condition}`);
    return false;
  }
}

/**
 * Safe expression evaluator (simplified)
 */
function safeEvaluate(expr: string): boolean {
  // Handle simple comparisons
  const comparisons = [
    { op: '==', fn: (a: unknown, b: unknown) => a === b },
    { op: '!=', fn: (a: unknown, b: unknown) => a !== b },
    { op: '>=', fn: (a: unknown, b: unknown) => Number(a) >= Number(b) },
    { op: '<=', fn: (a: unknown, b: unknown) => Number(a) <= Number(b) },
    { op: '>', fn: (a: unknown, b: unknown) => Number(a) > Number(b) },
    { op: '<', fn: (a: unknown, b: unknown) => Number(a) < Number(b) },
  ];

  // Handle && and ||
  if (expr.includes('&&')) {
    const parts = expr.split('&&').map((p) => p.trim());
    return parts.every((p) => safeEvaluate(p));
  }

  if (expr.includes('||')) {
    const parts = expr.split('||').map((p) => p.trim());
    return parts.some((p) => safeEvaluate(p));
  }

  // Handle single comparison
  for (const { op, fn } of comparisons) {
    if (expr.includes(op)) {
      const [left, right] = expr.split(op).map((s) => s.trim());
      const leftVal = parseValue(left);
      const rightVal = parseValue(right);
      return fn(leftVal, rightVal);
    }
  }

  // Handle boolean literals
  if (expr.trim() === 'true') return true;
  if (expr.trim() === 'false') return false;

  return false;
}

/**
 * Parse a string value to its proper type
 */
function parseValue(str: string): unknown {
  str = str.trim();

  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  if (str === 'undefined') return undefined;

  // Handle quoted strings
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }

  // Handle numbers
  const num = Number(str);
  if (!isNaN(num)) return num;

  return str;
}

/**
 * Evaluate all applicable policies against a context
 */
export function evaluatePolicies(context: PolicyContext): PolicyEvaluationResult {
  const applicablePolicies = getPoliciesForScope(
    context.companyId ? 'company' : context.verticalId ? 'vertical' : 'global',
    context.companyId ?? context.verticalId
  );

  const violations: PolicyEvaluationResult['violations'] = [];
  const warnings: string[] = [];
  const requiredApprovals: string[] = [];

  for (const policy of applicablePolicies) {
    for (const rule of policy.rules) {
      const triggered = evaluateCondition(rule.condition, context);

      if (triggered) {
        violations.push({
          policyId: policy.id,
          policyName: policy.name,
          ruleId: rule.id,
          message: rule.message,
          severity: rule.severity,
          action: rule.action,
        });

        if (rule.action === 'warn') {
          warnings.push(rule.message);
        } else if (rule.action === 'require_approval') {
          requiredApprovals.push(`${policy.name}: ${rule.message}`);
        }
      }
    }
  }

  // Action is allowed if no blocking violations
  const hasBlockingViolation = violations.some((v) => v.action === 'block');

  return {
    allowed: !hasBlockingViolation,
    violations,
    warnings,
    requiredApprovals,
  };
}

// ============================================================================
// Policy Helpers
// ============================================================================

/**
 * Check if a budget change is allowed
 */
export function checkBudgetChange(
  currentBudget: number,
  newBudget: number,
  companyId?: string,
  verticalId?: string
): PolicyEvaluationResult {
  const changePercent = ((newBudget - currentBudget) / currentBudget) * 100;

  return evaluatePolicies({
    budget: newBudget,
    budget_change_percent: changePercent,
    companyId,
    verticalId,
  });
}

/**
 * Check if a creative is compliant
 */
export function checkCreativeCompliance(
  creative: {
    content: string;
    images?: string[];
    platform: string;
  },
  companyId?: string,
  verticalId?: string
): PolicyEvaluationResult {
  // Simple content analysis (in production, use ML)
  const contentLower = creative.content.toLowerCase();

  const makesMedicalClaims =
    contentLower.includes('cure') ||
    contentLower.includes('treat') ||
    contentLower.includes('diagnose');

  const usesBeforeAfter =
    contentLower.includes('before') && contentLower.includes('after');

  const mentionsReturns =
    contentLower.includes('return') ||
    contentLower.includes('roi') ||
    contentLower.includes('profit');

  const hasDisclosure =
    contentLower.includes('disclaimer') ||
    contentLower.includes('terms apply') ||
    contentLower.includes('results may vary');

  return evaluatePolicies({
    makes_medical_claims: makesMedicalClaims,
    uses_before_after_images: usesBeforeAfter,
    mentions_returns: mentionsReturns,
    has_disclosure: hasDisclosure,
    platform: creative.platform,
    companyId,
    verticalId,
  });
}

/**
 * Check if an autopilot action is allowed
 */
export function checkAutopilotAction(
  action: string,
  campaignSpend: number,
  actionsToday: number,
  companyId?: string
): PolicyEvaluationResult {
  return evaluatePolicies({
    autopilot_action: action,
    campaign_spend: campaignSpend,
    autopilot_actions_today: actionsToday,
    companyId,
  });
}

/**
 * Get policy summary for display
 */
export function getPolicySummary(): {
  total: number;
  byScope: Record<string, number>;
  byType: Record<string, number>;
} {
  const policies = getAllPolicies();

  const byScope: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const policy of policies) {
    byScope[policy.scope] = (byScope[policy.scope] || 0) + 1;
    byType[policy.type] = (byType[policy.type] || 0) + 1;
  }

  return {
    total: policies.length,
    byScope,
    byType,
  };
}

/**
 * Create a custom policy
 */
export function createPolicy(params: {
  name: string;
  description: string;
  type: HivePolicy['type'];
  scope: HivePolicy['scope'];
  verticalId?: string;
  companyId?: string;
  rules: Array<{
    condition: string;
    action: PolicyRule['action'];
    message: string;
    severity: PolicyRule['severity'];
  }>;
  createdBy: string;
}): HivePolicy {
  const now = new Date().toISOString();
  const id = `policy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const policy: HivePolicy = {
    id,
    name: params.name,
    description: params.description,
    type: params.type,
    scope: params.scope,
    verticalId: params.verticalId,
    companyId: params.companyId,
    rules: params.rules.map((r, i) => ({
      id: `${id}-rule-${i}`,
      ...r,
    })),
    active: true,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  addPolicy(policy);
  return policy;
}
