// lib/autopilot/autopilotGovernance.ts
// Phase 5: Autopilot Governance
//
// Manages:
// - Approval workflows
// - Audit logging
// - Change tracking
// - Emergency controls (kill switch)
// - Compliance and safety

import type { DomainName } from '../contextGraph/companyContextGraph';
import type {
  AutonomyLevel,
  AutopilotConfig,
  AutopilotLogEntry,
  AutopilotAction,
  BudgetChange,
  TargetingChange,
  CreativeRecommendation,
  ExperimentPlan,
} from './types';
import type { RuleDecision } from './autopilotRules';

// ============================================================================
// Approval Types
// ============================================================================

export interface ApprovalRequest {
  id: string;
  companyId: string;
  type: 'budget' | 'creative' | 'audience' | 'channel' | 'experiment' | 'autonomy_change';

  // What's being requested
  title: string;
  description: string;
  proposedChange: unknown;

  // Context
  reasoning: string;
  expectedImpact: string;
  risks: string[];
  rulesTrigggered: string[];

  // Workflow
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_approved';
  requestedBy: 'autopilot' | string;
  requestedAt: string;
  expiresAt: string;

  // Resolution
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;

  // Metadata
  priority: 'low' | 'medium' | 'high' | 'critical';
  cycleId?: string;
}

export interface ApprovalDecision {
  requestId: string;
  approved: boolean;
  reviewedBy: string;
  notes?: string;
  modifications?: unknown;
}

// ============================================================================
// Emergency Control Types
// ============================================================================

export interface EmergencyState {
  companyId: string;
  triggered: boolean;
  triggeredAt?: string;
  triggeredBy?: string;
  reason?: string;
  affectedChannels?: string[];
  autoResumeAt?: string;
  status: 'active' | 'resolved' | 'scheduled_resume';
}

// ============================================================================
// In-Memory Stores
// ============================================================================

const approvalQueue = new Map<string, ApprovalRequest[]>();
const auditLog = new Map<string, AutopilotLogEntry[]>();
const emergencyStates = new Map<string, EmergencyState>();
const changeHistory = new Map<string, ChangeRecord[]>();

interface ChangeRecord {
  id: string;
  companyId: string;
  timestamp: string;
  type: 'budget' | 'creative' | 'audience' | 'channel' | 'experiment' | 'config';
  before: unknown;
  after: unknown;
  appliedBy: 'autopilot' | string;
  approvalId?: string;
  reverted?: boolean;
  revertedAt?: string;
  revertedBy?: string;
}

// ============================================================================
// Approval Workflow
// ============================================================================

/**
 * Create an approval request
 */
export function createApprovalRequest(
  companyId: string,
  type: ApprovalRequest['type'],
  proposedChange: unknown,
  context: {
    reasoning: string;
    expectedImpact: string;
    risks?: string[];
    rulesTrigggered?: string[];
    cycleId?: string;
  }
): ApprovalRequest {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const request: ApprovalRequest = {
    id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyId,
    type,
    title: generateApprovalTitle(type, proposedChange),
    description: generateApprovalDescription(type, proposedChange),
    proposedChange,
    reasoning: context.reasoning,
    expectedImpact: context.expectedImpact,
    risks: context.risks || [],
    rulesTrigggered: context.rulesTrigggered || [],
    status: 'pending',
    requestedBy: 'autopilot',
    requestedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    priority: determinePriority(type, proposedChange),
    cycleId: context.cycleId,
  };

  // Add to queue
  const queue = approvalQueue.get(companyId) || [];
  queue.push(request);
  approvalQueue.set(companyId, queue);

  // Log the request
  logAction(companyId, 'approval_requested' as AutopilotAction, {
    requestId: request.id,
    type,
    title: request.title,
  });

  return request;
}

/**
 * Process an approval decision
 */
export function processApproval(
  companyId: string,
  decision: ApprovalDecision
): ApprovalRequest | null {
  const queue = approvalQueue.get(companyId) || [];
  const requestIndex = queue.findIndex(r => r.id === decision.requestId);

  if (requestIndex === -1) return null;

  const request = queue[requestIndex];
  const now = new Date().toISOString();

  // Update request
  const updated: ApprovalRequest = {
    ...request,
    status: decision.approved ? 'approved' : 'rejected',
    reviewedBy: decision.reviewedBy,
    reviewedAt: now,
    reviewNotes: decision.notes,
  };

  queue[requestIndex] = updated;
  approvalQueue.set(companyId, queue);

  // Log the decision
  logAction(companyId, decision.approved ? 'approval_granted' as AutopilotAction : 'approval_denied' as AutopilotAction, {
    requestId: request.id,
    type: request.type,
    reviewedBy: decision.reviewedBy,
    notes: decision.notes,
  });

  return updated;
}

/**
 * Get pending approvals for a company
 */
export function getPendingApprovals(companyId: string): ApprovalRequest[] {
  const queue = approvalQueue.get(companyId) || [];
  const now = new Date();

  // Filter and mark expired
  return queue.filter(r => {
    if (r.status !== 'pending') return false;
    if (new Date(r.expiresAt) < now) {
      r.status = 'expired';
      return false;
    }
    return true;
  });
}

/**
 * Get all approval requests for a company
 */
export function getApprovalHistory(
  companyId: string,
  options?: { limit?: number; status?: ApprovalRequest['status'] }
): ApprovalRequest[] {
  let queue = approvalQueue.get(companyId) || [];

  if (options?.status) {
    queue = queue.filter(r => r.status === options.status);
  }

  if (options?.limit) {
    queue = queue.slice(-options.limit);
  }

  return queue;
}

function generateApprovalTitle(type: ApprovalRequest['type'], change: unknown): string {
  switch (type) {
    case 'budget': {
      const budgetChange = change as BudgetChange;
      return `Budget ${budgetChange.type}: ${budgetChange.totalDelta}% change requested`;
    }
    case 'creative':
      return 'Creative change requested';
    case 'audience': {
      const audienceChange = change as TargetingChange;
      return `Audience ${audienceChange.type}: ${audienceChange.segments.length} segments`;
    }
    case 'experiment': {
      const exp = change as ExperimentPlan;
      return `New experiment: ${exp.name}`;
    }
    case 'autonomy_change':
      return 'Autonomy level change requested';
    default:
      return 'Change approval requested';
  }
}

function generateApprovalDescription(type: ApprovalRequest['type'], change: unknown): string {
  switch (type) {
    case 'budget': {
      const budgetChange = change as BudgetChange;
      return `Proposed budget ${budgetChange.type} of ${budgetChange.totalDelta}% across channels`;
    }
    case 'creative': {
      const creative = change as CreativeRecommendation;
      return creative.recommendation;
    }
    case 'audience': {
      const audience = change as TargetingChange;
      return `${audience.type} ${audience.segments.length} audience segments`;
    }
    case 'experiment': {
      const exp = change as ExperimentPlan;
      return exp.description;
    }
    default:
      return 'Autopilot is requesting approval for a change';
  }
}

function determinePriority(type: ApprovalRequest['type'], change: unknown): ApprovalRequest['priority'] {
  if (type === 'budget') {
    const budgetChange = change as BudgetChange;
    if (Math.abs(budgetChange.totalDelta) > 30) return 'high';
    if (Math.abs(budgetChange.totalDelta) > 15) return 'medium';
    return 'low';
  }

  if (type === 'autonomy_change') return 'high';
  if (type === 'experiment') return 'medium';

  return 'medium';
}

// ============================================================================
// Emergency Controls (Kill Switch)
// ============================================================================

/**
 * Trigger emergency stop for a company
 */
export function triggerEmergencyStop(
  companyId: string,
  triggeredBy: string,
  reason: string,
  options?: {
    affectedChannels?: string[];
    autoResumeIn?: number; // Hours
  }
): EmergencyState {
  const now = new Date();

  const state: EmergencyState = {
    companyId,
    triggered: true,
    triggeredAt: now.toISOString(),
    triggeredBy,
    reason,
    affectedChannels: options?.affectedChannels,
    status: 'active',
  };

  if (options?.autoResumeIn) {
    const resumeAt = new Date(now.getTime() + options.autoResumeIn * 60 * 60 * 1000);
    state.autoResumeAt = resumeAt.toISOString();
    state.status = 'scheduled_resume';
  }

  emergencyStates.set(companyId, state);

  // Log the emergency stop
  logAction(companyId, 'emergency_stop', {
    triggeredBy,
    reason,
    affectedChannels: options?.affectedChannels,
    autoResumeAt: state.autoResumeAt,
  });

  return state;
}

/**
 * Resolve emergency stop
 */
export function resolveEmergencyStop(
  companyId: string,
  resolvedBy: string,
  notes?: string
): EmergencyState | null {
  const state = emergencyStates.get(companyId);
  if (!state || !state.triggered) return null;

  const resolved: EmergencyState = {
    ...state,
    triggered: false,
    status: 'resolved',
  };

  emergencyStates.set(companyId, resolved);

  // Log the resolution
  logAction(companyId, 'emergency_resolved' as AutopilotAction, {
    resolvedBy,
    notes,
    originalReason: state.reason,
    duration: state.triggeredAt
      ? new Date().getTime() - new Date(state.triggeredAt).getTime()
      : 0,
  });

  return resolved;
}

/**
 * Check if emergency stop is active
 */
export function isEmergencyActive(companyId: string): boolean {
  const state = emergencyStates.get(companyId);
  if (!state?.triggered) return false;

  // Check auto-resume
  if (state.autoResumeAt && new Date(state.autoResumeAt) < new Date()) {
    resolveEmergencyStop(companyId, 'system', 'Auto-resumed after scheduled period');
    return false;
  }

  return true;
}

/**
 * Get emergency state
 */
export function getEmergencyState(companyId: string): EmergencyState | null {
  return emergencyStates.get(companyId) || null;
}

// ============================================================================
// Audit Logging
// ============================================================================

/**
 * Log an autopilot action
 */
export function logAction(
  companyId: string,
  action: AutopilotAction,
  details: Record<string, unknown>,
  options?: {
    triggeredBy?: 'autopilot' | 'human' | 'signal' | 'schedule';
    userId?: string;
    impactedDomains?: DomainName[];
    impactedFields?: string[];
  }
): AutopilotLogEntry {
  const entry: AutopilotLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyId,
    timestamp: new Date().toISOString(),
    action,
    category: getCategoryForAction(action),
    description: generateLogDescription(action, details),
    details,
    triggeredBy: options?.triggeredBy || 'autopilot',
    userId: options?.userId,
    impactedDomains: options?.impactedDomains || [],
    impactedFields: options?.impactedFields || [],
    outcome: 'success',
  };

  // Store log
  const logs = auditLog.get(companyId) || [];
  logs.push(entry);

  // Keep last 10000 entries
  if (logs.length > 10000) {
    auditLog.set(companyId, logs.slice(-10000));
  } else {
    auditLog.set(companyId, logs);
  }

  return entry;
}

/**
 * Get audit log for a company
 */
export function getAuditLog(
  companyId: string,
  options?: {
    limit?: number;
    since?: string;
    category?: AutopilotLogEntry['category'];
    action?: AutopilotAction;
  }
): AutopilotLogEntry[] {
  let logs = auditLog.get(companyId) || [];

  if (options?.since) {
    const sinceDate = new Date(options.since);
    logs = logs.filter(l => new Date(l.timestamp) >= sinceDate);
  }

  if (options?.category) {
    logs = logs.filter(l => l.category === options.category);
  }

  if (options?.action) {
    logs = logs.filter(l => l.action === options.action);
  }

  if (options?.limit) {
    logs = logs.slice(-options.limit);
  }

  return logs;
}

function getCategoryForAction(action: AutopilotAction): AutopilotLogEntry['category'] {
  const categoryMap: Record<string, AutopilotLogEntry['category']> = {
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
    emergency_stop: 'override',
    human_override: 'override',
    config_changed: 'override',
    quarter_plan_generated: 'cycle',
  };

  return categoryMap[action] || 'cycle';
}

function generateLogDescription(action: AutopilotAction, details: Record<string, unknown>): string {
  switch (action) {
    case 'cycle_started':
      return `Autopilot cycle #${details.cycleNumber || 'unknown'} started`;
    case 'cycle_completed':
      return `Autopilot cycle completed: ${details.hypothesesGenerated || 0} hypotheses, ${details.experimentsCreated || 0} experiments`;
    case 'hypothesis_generated':
      return `Generated hypothesis: ${details.category || 'unknown'}`;
    case 'experiment_created':
      return `Created experiment: ${details.name || 'unknown'}`;
    case 'budget_reallocated':
      return `Budget reallocated: ${details.totalDelta || 0}% change`;
    case 'signal_detected':
      return `Signal detected: ${details.type || 'unknown'} - ${details.severity || 'unknown'}`;
    case 'emergency_stop':
      return `Emergency stop triggered: ${details.reason || 'unknown reason'}`;
    case 'human_override':
      return `Human override by ${details.userId || 'unknown'}`;
    default:
      return `Action: ${action}`;
  }
}

// ============================================================================
// Change Tracking
// ============================================================================

/**
 * Record a change
 */
export function recordChange(
  companyId: string,
  type: ChangeRecord['type'],
  before: unknown,
  after: unknown,
  appliedBy: 'autopilot' | string,
  approvalId?: string
): ChangeRecord {
  const record: ChangeRecord = {
    id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyId,
    timestamp: new Date().toISOString(),
    type,
    before,
    after,
    appliedBy,
    approvalId,
  };

  const history = changeHistory.get(companyId) || [];
  history.push(record);
  changeHistory.set(companyId, history);

  return record;
}

/**
 * Revert a change
 */
export function revertChange(
  companyId: string,
  changeId: string,
  revertedBy: string
): ChangeRecord | null {
  const history = changeHistory.get(companyId) || [];
  const changeIndex = history.findIndex(c => c.id === changeId);

  if (changeIndex === -1) return null;

  const change = history[changeIndex];

  // Mark as reverted
  change.reverted = true;
  change.revertedAt = new Date().toISOString();
  change.revertedBy = revertedBy;

  history[changeIndex] = change;
  changeHistory.set(companyId, history);

  // Log the revert
  logAction(companyId, 'human_override', {
    action: 'revert',
    changeId,
    changeType: change.type,
    revertedBy,
  });

  return change;
}

/**
 * Get change history
 */
export function getChangeHistory(
  companyId: string,
  options?: {
    limit?: number;
    type?: ChangeRecord['type'];
    since?: string;
    includeReverted?: boolean;
  }
): ChangeRecord[] {
  let history = changeHistory.get(companyId) || [];

  if (options?.type) {
    history = history.filter(c => c.type === options.type);
  }

  if (options?.since) {
    const sinceDate = new Date(options.since);
    history = history.filter(c => new Date(c.timestamp) >= sinceDate);
  }

  if (!options?.includeReverted) {
    history = history.filter(c => !c.reverted);
  }

  if (options?.limit) {
    history = history.slice(-options.limit);
  }

  return history;
}

// ============================================================================
// Governance Dashboard Data
// ============================================================================

export interface GovernanceSummary {
  companyId: string;
  emergencyActive: boolean;
  pendingApprovals: number;
  approvedToday: number;
  rejectedToday: number;
  changesLast24h: number;
  revertsLast24h: number;
  activeExperiments: number;
  currentAutonomyLevel: AutonomyLevel;
  ruleViolationsLast24h: number;
}

/**
 * Get governance summary for dashboard
 */
export function getGovernanceSummary(
  companyId: string,
  config: AutopilotConfig
): GovernanceSummary {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString();

  const approvals = approvalQueue.get(companyId) || [];
  const todayApprovals = approvals.filter(a =>
    new Date(a.requestedAt) >= yesterday
  );

  const history = changeHistory.get(companyId) || [];
  const recentChanges = history.filter(c =>
    new Date(c.timestamp) >= yesterday
  );

  const logs = auditLog.get(companyId) || [];
  const recentViolations = logs.filter(l =>
    new Date(l.timestamp) >= yesterday &&
    l.action === 'human_override' // Rule violations often result in overrides
  );

  return {
    companyId,
    emergencyActive: isEmergencyActive(companyId),
    pendingApprovals: getPendingApprovals(companyId).length,
    approvedToday: todayApprovals.filter(a => a.status === 'approved').length,
    rejectedToday: todayApprovals.filter(a => a.status === 'rejected').length,
    changesLast24h: recentChanges.length,
    revertsLast24h: recentChanges.filter(c => c.reverted).length,
    activeExperiments: 0, // Would need experiment store integration
    currentAutonomyLevel: config.autonomyLevel,
    ruleViolationsLast24h: recentViolations.length,
  };
}

// ============================================================================
// Configuration Governance
// ============================================================================

/**
 * Validate and apply autonomy level change
 */
export function changeAutonomyLevel(
  companyId: string,
  currentConfig: AutopilotConfig,
  newLevel: AutonomyLevel,
  changedBy: string,
  reason: string
): { success: boolean; message: string; requiresApproval?: boolean } {
  // Can always decrease autonomy
  const levelOrder: AutonomyLevel[] = ['manual_only', 'ai_assisted', 'semi_autonomous', 'full_autonomous'];
  const currentIndex = levelOrder.indexOf(currentConfig.autonomyLevel);
  const newIndex = levelOrder.indexOf(newLevel);

  // Increasing autonomy requires approval for semi/full autonomous
  if (newIndex > currentIndex && newIndex >= 2) {
    // Create approval request
    createApprovalRequest(
      companyId,
      'autonomy_change',
      { current: currentConfig.autonomyLevel, proposed: newLevel },
      {
        reasoning: reason,
        expectedImpact: `Autonomy level will change from ${currentConfig.autonomyLevel} to ${newLevel}`,
        risks: ['Increased automation may make changes without human review'],
      }
    );

    return {
      success: false,
      message: 'Autonomy increase requires approval',
      requiresApproval: true,
    };
  }

  // Record the change
  recordChange(
    companyId,
    'config',
    { autonomyLevel: currentConfig.autonomyLevel },
    { autonomyLevel: newLevel },
    changedBy
  );

  // Log the change
  logAction(companyId, 'config_changed', {
    field: 'autonomyLevel',
    from: currentConfig.autonomyLevel,
    to: newLevel,
    changedBy,
    reason,
  });

  return {
    success: true,
    message: `Autonomy level changed to ${newLevel}`,
  };
}
