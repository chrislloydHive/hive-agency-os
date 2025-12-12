// lib/contextGraph/governance/index.ts
// Governance Layer Exports

// Locks
export {
  lockField,
  unlockField,
  checkLock,
  isLocked,
  getLocks,
  getLocksForDomain,
  cleanupExpiredLocks,
  lockFields,
  type FieldLock,
  type LockCheckResult,
} from './locks';

// Contracts
export {
  ContextContracts,
  validateDomainContract,
  validateGraphContracts,
  getMissingRequiredFields,
  getDomainViolations,
  isFieldRequired,
  getSuggestedLabForField,
  type DomainContract,
  type ContractViolation,
  type ContractStatus,
  type GraphContractStatus,
} from './contracts';

// Validation Rules
export {
  validateGraph,
  validateDomain,
  getAutoFixableIssues,
  wouldCauseIssues,
  type ValidationIssue,
  type ValidationResult,
} from './rules';

// Update Log
export {
  logUpdate,
  queryUpdateLogs,
  getRecentUpdates,
  getFieldHistory,
  getPendingSuggestions,
  markUpdateApplied,
  markUpdateRejected,
  getUpdateStats,
  getUpdatesByTool,
  cleanupOldRejected,
  type UpdateLogEntry,
  type UpdateLogQuery,
} from './updateLog';

// Pipeline
export {
  applyGovernedUpdate,
  applyBatchUpdate,
  requestGraphUpdate,
  acceptSuggestion,
  rejectSuggestion,
  type UpdateMetadata,
  type UpdateResult,
  type BatchUpdateResult,
} from './pipeline';

// Adaptive Rules (Phase 4)
export {
  initializeDefaultRules,
  createRule,
  updateRule,
  deleteRule,
  getAllRules,
  getRulesForDomain,
  getRulesByTrigger,
  evaluateRules,
  learnRuleFromPattern,
  adaptRules,
  getRulePerformance,
  getExecutionHistory,
  getAdaptiveRulesStats,
  type AdaptiveRule,
  type RuleTrigger,
  type RuleAction,
  type RuleCondition,
  type RuleExecutionResult,
  type RulePerformance,
} from './adaptiveRules';

// Governed Lab Writer
export {
  governedLabWrite,
  previewLabWrite,
  getProtectedFieldsForLab,
  type LabSource,
  type LabWriteField,
  type LabWriteProposal,
  type GovernedLabWriteResult,
} from './governedLabWriter';
