// lib/autopilot/autopilotRules.ts
// Phase 5: Autopilot Rules Engine
//
// Business rules that govern autopilot behavior:
// - Safety guardrails
// - Budget limits
// - Change thresholds
// - Approval requirements
// - Emergency stop conditions

import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  AutonomyLevel,
  AutopilotConfig,
  BudgetChange,
  TargetingChange,
  CreativeRecommendation,
  Signal,
  ExperimentPlan,
} from './types';

// ============================================================================
// Rule Types
// ============================================================================

export interface Rule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  condition: (context: RuleContext) => boolean;
  action: RuleAction;
  escalation?: EscalationConfig;
}

export type RuleCategory =
  | 'safety'
  | 'budget'
  | 'performance'
  | 'creative'
  | 'audience'
  | 'timing'
  | 'approval';

export type RuleAction =
  | 'block'       // Prevent the action
  | 'warn'        // Allow but flag
  | 'require_approval' // Queue for human approval
  | 'modify'      // Adjust the action
  | 'escalate';   // Trigger escalation

export interface EscalationConfig {
  notifyRoles: string[];
  slackChannel?: string;
  emailTo?: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface RuleContext {
  companyId: string;
  config: AutopilotConfig;
  graph: CompanyContextGraph;
  proposedChange?: {
    type: 'budget' | 'creative' | 'audience' | 'experiment' | 'channel';
    details: BudgetChange | TargetingChange | CreativeRecommendation | ExperimentPlan;
  };
  currentSignals?: Signal[];
  performanceData?: {
    currentCpa: number;
    targetCpa: number;
    currentRoas: number;
    targetRoas: number;
    budgetUtilization: number;
    daysSinceLastCreative: number;
  };
}

export interface RuleEvaluation {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  action: RuleAction;
  reason: string;
  timestamp: string;
}

// ============================================================================
// Default Rules
// ============================================================================

export const DEFAULT_RULES: Rule[] = [
  // ============================================
  // SAFETY RULES (Critical)
  // ============================================
  {
    id: 'rule_emergency_stop',
    name: 'Emergency Performance Stop',
    description: 'Stop all automation if performance drops critically',
    category: 'safety',
    priority: 'critical',
    enabled: true,
    condition: (ctx) => {
      if (!ctx.performanceData || !ctx.config) return false;
      const cpaDrop = ctx.performanceData.currentCpa / ctx.performanceData.targetCpa;
      return cpaDrop > (1 + ctx.config.emergencyStopThreshold / 100);
    },
    action: 'block',
    escalation: {
      notifyRoles: ['admin', 'account_manager'],
      urgency: 'critical',
    },
  },
  {
    id: 'rule_negative_roi_stop',
    name: 'Negative ROI Stop',
    description: 'Halt changes when ROI is negative',
    category: 'safety',
    priority: 'critical',
    enabled: true,
    condition: (ctx) => {
      if (!ctx.performanceData) return false;
      return ctx.performanceData.currentRoas < 0.5; // Less than 0.5x ROAS
    },
    action: 'block',
    escalation: {
      notifyRoles: ['admin'],
      urgency: 'critical',
    },
  },
  {
    id: 'rule_tracking_failure_stop',
    name: 'Tracking Failure Stop',
    description: 'Stop automation if tracking is broken',
    category: 'safety',
    priority: 'critical',
    enabled: true,
    condition: (ctx) => {
      if (!ctx.currentSignals) return false;
      return ctx.currentSignals.some(
        s => s.type === 'tracking_failure' && s.severity === 'critical'
      );
    },
    action: 'block',
    escalation: {
      notifyRoles: ['admin', 'tech_lead'],
      urgency: 'critical',
    },
  },

  // ============================================
  // BUDGET RULES (High)
  // ============================================
  {
    id: 'rule_budget_increase_limit',
    name: 'Budget Increase Limit',
    description: 'Limit single budget increases to 25%',
    category: 'budget',
    priority: 'high',
    enabled: true,
    condition: (ctx) => {
      if (ctx.proposedChange?.type !== 'budget') return false;
      const change = ctx.proposedChange.details as BudgetChange;
      return change.type === 'increase' && change.totalDelta > 25;
    },
    action: 'require_approval',
  },
  {
    id: 'rule_budget_decrease_limit',
    name: 'Budget Decrease Limit',
    description: 'Limit single budget decreases to 30%',
    category: 'budget',
    priority: 'high',
    enabled: true,
    condition: (ctx) => {
      if (ctx.proposedChange?.type !== 'budget') return false;
      const change = ctx.proposedChange.details as BudgetChange;
      return change.type === 'decrease' && Math.abs(change.totalDelta) > 30;
    },
    action: 'require_approval',
  },
  {
    id: 'rule_budget_exhaustion_pause',
    name: 'Budget Exhaustion Pause',
    description: 'Pause budget increases when near exhaustion',
    category: 'budget',
    priority: 'high',
    enabled: true,
    condition: (ctx) => {
      if (!ctx.performanceData) return false;
      if (ctx.proposedChange?.type !== 'budget') return false;
      const change = ctx.proposedChange.details as BudgetChange;
      return ctx.performanceData.budgetUtilization > 90 && change.type === 'increase';
    },
    action: 'block',
  },
  {
    id: 'rule_channel_concentration',
    name: 'Channel Concentration Limit',
    description: 'Prevent over-concentration in single channel',
    category: 'budget',
    priority: 'medium',
    enabled: true,
    condition: (ctx) => {
      if (ctx.proposedChange?.type !== 'budget') return false;
      const change = ctx.proposedChange.details as BudgetChange;
      // Check if any channel would exceed 60% of total
      for (const channel of Object.keys(change.channels)) {
        const channelData = change.channels[channel];
        if (channelData && channelData.proposed > 60) {
          return true;
        }
      }
      return false;
    },
    action: 'warn',
  },

  // ============================================
  // PERFORMANCE RULES (High)
  // ============================================
  {
    id: 'rule_cpa_threshold',
    name: 'CPA Threshold Guard',
    description: 'Require approval for changes when CPA is elevated',
    category: 'performance',
    priority: 'high',
    enabled: true,
    condition: (ctx) => {
      if (!ctx.performanceData) return false;
      const cpaDelta = (ctx.performanceData.currentCpa - ctx.performanceData.targetCpa) / ctx.performanceData.targetCpa;
      return cpaDelta > 0.2; // CPA 20% above target
    },
    action: 'require_approval',
  },
  {
    id: 'rule_roas_minimum',
    name: 'ROAS Minimum Guard',
    description: 'Block expansion when ROAS is below threshold',
    category: 'performance',
    priority: 'high',
    enabled: true,
    condition: (ctx) => {
      if (!ctx.performanceData) return false;
      if (ctx.proposedChange?.type !== 'budget') return false;
      const change = ctx.proposedChange.details as BudgetChange;
      return ctx.performanceData.currentRoas < ctx.performanceData.targetRoas * 0.7 && change.type === 'increase';
    },
    action: 'block',
  },

  // ============================================
  // CREATIVE RULES (Medium)
  // ============================================
  {
    id: 'rule_creative_fatigue',
    name: 'Creative Fatigue Alert',
    description: 'Flag when creative hasnt been refreshed in 30 days',
    category: 'creative',
    priority: 'medium',
    enabled: true,
    condition: (ctx) => {
      if (!ctx.performanceData) return false;
      return ctx.performanceData.daysSinceLastCreative > 30;
    },
    action: 'warn',
  },
  {
    id: 'rule_creative_approval',
    name: 'Creative Change Approval',
    description: 'Require approval for significant creative changes',
    category: 'creative',
    priority: 'medium',
    enabled: true,
    condition: (ctx) => {
      if (ctx.proposedChange?.type !== 'creative') return false;
      // Check if config requires creative approval
      return ctx.config.requireApprovalFor.includes('creative');
    },
    action: 'require_approval',
  },

  // ============================================
  // AUDIENCE RULES (Medium)
  // ============================================
  {
    id: 'rule_audience_approval',
    name: 'Audience Change Approval',
    description: 'Require approval for audience targeting changes',
    category: 'audience',
    priority: 'medium',
    enabled: true,
    condition: (ctx) => {
      if (ctx.proposedChange?.type !== 'audience') return false;
      return ctx.config.requireApprovalFor.includes('audience');
    },
    action: 'require_approval',
  },
  {
    id: 'rule_audience_exclusion',
    name: 'Audience Exclusion Guard',
    description: 'Block audience exclusions that would remove core segments',
    category: 'audience',
    priority: 'high',
    enabled: true,
    condition: (ctx) => {
      if (ctx.proposedChange?.type !== 'audience') return false;
      const change = ctx.proposedChange.details as TargetingChange;
      if (change.type !== 'remove') return false;
      // Check if removing core segments
      const coreSegments = ctx.graph.audience?.coreSegments?.value as string[] | undefined;
      if (!coreSegments) return false;
      return change.segments.some(s => coreSegments.includes(s));
    },
    action: 'block',
  },

  // ============================================
  // TIMING RULES (Low)
  // ============================================
  {
    id: 'rule_weekend_pause',
    name: 'Weekend Change Pause',
    description: 'Avoid significant changes on weekends',
    category: 'timing',
    priority: 'low',
    enabled: false, // Disabled by default
    condition: () => {
      const dayOfWeek = new Date().getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    },
    action: 'warn',
  },
  {
    id: 'rule_holiday_pause',
    name: 'Holiday Period Caution',
    description: 'Extra caution during major holiday periods',
    category: 'timing',
    priority: 'medium',
    enabled: true,
    condition: (ctx) => {
      const seasonalNotes = ctx.graph.identity?.seasonalityNotes?.value as string | undefined;
      const peakSeasons = ctx.graph.identity?.peakSeasons?.value as string[] | undefined;
      if (!seasonalNotes && !peakSeasons) return false;
      const currentMonth = new Date().toLocaleString('default', { month: 'long' }).toLowerCase();
      const isHolidaySeason = currentMonth === 'november' || currentMonth === 'december';
      const hasHolidayPattern = (seasonalNotes?.toLowerCase().includes('holiday') ?? false) ||
        (peakSeasons?.some(p => p.toLowerCase().includes('holiday')) ?? false);
      return isHolidaySeason && hasHolidayPattern;
    },
    action: 'require_approval',
  },

  // ============================================
  // EXPERIMENT RULES (Medium)
  // ============================================
  {
    id: 'rule_experiment_budget',
    name: 'Experiment Budget Limit',
    description: 'Limit experiment budget to configured percentage',
    category: 'budget',
    priority: 'medium',
    enabled: true,
    condition: (ctx) => {
      if (ctx.proposedChange?.type !== 'experiment') return false;
      // Would need to track total experiment spend vs limit
      // Simplified: always allow within configured limit
      return false;
    },
    action: 'block',
  },
  {
    id: 'rule_concurrent_experiments',
    name: 'Concurrent Experiment Limit',
    description: 'Limit number of concurrent experiments',
    category: 'safety',
    priority: 'medium',
    enabled: true,
    condition: () => {
      // Would check against active experiment count
      // Placeholder - would need experiment store integration
      return false;
    },
    action: 'warn',
  },
];

// ============================================================================
// Rule Engine
// ============================================================================

/**
 * Evaluate all rules against a context
 */
export function evaluateRules(
  context: RuleContext,
  customRules?: Rule[]
): RuleEvaluation[] {
  const rules = [...DEFAULT_RULES, ...(customRules || [])];
  const evaluations: RuleEvaluation[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    try {
      const triggered = rule.condition(context);

      evaluations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggered,
        action: triggered ? rule.action : 'warn', // Default non-triggered to warn
        reason: triggered ? rule.description : 'Rule not triggered',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }

  return evaluations;
}

/**
 * Check if any blocking rules are triggered
 */
export function hasBlockingRules(evaluations: RuleEvaluation[]): boolean {
  return evaluations.some(e => e.triggered && e.action === 'block');
}

/**
 * Check if approval is required
 */
export function requiresApproval(evaluations: RuleEvaluation[]): boolean {
  return evaluations.some(e => e.triggered && e.action === 'require_approval');
}

/**
 * Get all triggered warnings
 */
export function getWarnings(evaluations: RuleEvaluation[]): RuleEvaluation[] {
  return evaluations.filter(e => e.triggered && e.action === 'warn');
}

/**
 * Get rules that need escalation
 */
export function getEscalations(evaluations: RuleEvaluation[]): Rule[] {
  const triggeredIds = new Set(
    evaluations
      .filter(e => e.triggered && e.action === 'escalate')
      .map(e => e.ruleId)
  );

  return DEFAULT_RULES.filter(r => triggeredIds.has(r.id) && r.escalation);
}

// ============================================================================
// Rule-Based Decision Making
// ============================================================================

export interface RuleDecision {
  allowed: boolean;
  requiresApproval: boolean;
  warnings: string[];
  blockReasons: string[];
  escalations: EscalationConfig[];
}

/**
 * Make a decision based on rule evaluations
 */
export function makeRuleDecision(
  context: RuleContext,
  customRules?: Rule[]
): RuleDecision {
  const evaluations = evaluateRules(context, customRules);

  const blockReasons = evaluations
    .filter(e => e.triggered && e.action === 'block')
    .map(e => e.reason);

  const warnings = evaluations
    .filter(e => e.triggered && e.action === 'warn')
    .map(e => e.reason);

  const needsApproval = evaluations.some(
    e => e.triggered && e.action === 'require_approval'
  );

  const escalations = getEscalations(evaluations)
    .map(r => r.escalation!)
    .filter(Boolean);

  return {
    allowed: blockReasons.length === 0,
    requiresApproval: needsApproval,
    warnings,
    blockReasons,
    escalations,
  };
}

// ============================================================================
// Autonomy Level Guards
// ============================================================================

/**
 * Check if an action is allowed at the current autonomy level
 */
export function isActionAllowedAtLevel(
  action: 'budget' | 'creative' | 'audience' | 'channel' | 'experiment',
  level: AutonomyLevel
): { allowed: boolean; reason?: string } {
  const permissions: Record<AutonomyLevel, Set<string>> = {
    manual_only: new Set([]), // Nothing automated
    ai_assisted: new Set([]), // Only suggestions
    semi_autonomous: new Set(['budget', 'creative']), // Safe changes
    full_autonomous: new Set(['budget', 'creative', 'audience', 'channel', 'experiment']),
  };

  const allowed = permissions[level].has(action);

  if (!allowed) {
    return {
      allowed: false,
      reason: `Action '${action}' not allowed at autonomy level '${level}'`,
    };
  }

  return { allowed: true };
}

/**
 * Get available actions for an autonomy level
 */
export function getAvailableActions(level: AutonomyLevel): string[] {
  const actions: Record<AutonomyLevel, string[]> = {
    manual_only: [
      'View recommendations',
      'View diagnostics',
    ],
    ai_assisted: [
      'View recommendations',
      'View diagnostics',
      'Generate hypotheses',
      'Generate plans',
    ],
    semi_autonomous: [
      'View recommendations',
      'View diagnostics',
      'Generate hypotheses',
      'Generate plans',
      'Auto-adjust budgets (within limits)',
      'Auto-refresh creative (safe changes)',
      'Run experiments',
    ],
    full_autonomous: [
      'View recommendations',
      'View diagnostics',
      'Generate hypotheses',
      'Generate plans',
      'Auto-adjust budgets',
      'Auto-refresh creative',
      'Auto-adjust audiences',
      'Auto-expand channels',
      'Run experiments',
      'Write to context graph',
    ],
  };

  return actions[level] || [];
}

// ============================================================================
// Rule Configuration Management
// ============================================================================

const companyRuleOverrides = new Map<string, Partial<Rule>[]>();

/**
 * Set custom rule overrides for a company
 */
export function setCompanyRuleOverrides(
  companyId: string,
  overrides: Partial<Rule>[]
): void {
  companyRuleOverrides.set(companyId, overrides);
}

/**
 * Get rules with company overrides applied
 */
export function getCompanyRules(companyId: string): Rule[] {
  const overrides = companyRuleOverrides.get(companyId) || [];

  return DEFAULT_RULES.map(rule => {
    const override = overrides.find(o => o.id === rule.id);
    if (override) {
      return { ...rule, ...override };
    }
    return rule;
  });
}

/**
 * Enable or disable a specific rule for a company
 */
export function setRuleEnabled(
  companyId: string,
  ruleId: string,
  enabled: boolean
): void {
  const overrides = companyRuleOverrides.get(companyId) || [];
  const existingIndex = overrides.findIndex(o => o.id === ruleId);

  if (existingIndex >= 0) {
    overrides[existingIndex] = { ...overrides[existingIndex], enabled };
  } else {
    overrides.push({ id: ruleId, enabled });
  }

  companyRuleOverrides.set(companyId, overrides);
}
