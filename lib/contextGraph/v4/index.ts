// lib/contextGraph/v4/index.ts
// V4 Context Graph Module Exports
//
// V4 introduces a "facts-first + review queue" workflow with convergence
// and evidence grounding for decision-grade proposals.

// ============================================================================
// Core Proposal System
// ============================================================================

export {
  proposeFromLabResult,
  proposeSingleField,
  generateDedupeKey,
  MAX_ALTERNATIVES,
  type LabCandidate,
  type ProposeFromLabResultParams,
  type ProposeFromLabResultSummary,
} from './propose';

// ============================================================================
// Lab Candidates
// ============================================================================

export {
  buildWebsiteLabCandidates,
  extractWebsiteLabResult,
  getWebsiteLabAuthorizedDomains,
  type BuildWebsiteLabCandidatesResult,
} from './websiteLabCandidates';

export {
  buildBrandLabCandidates,
  extractBrandLabResult,
  findBrandLabRoot,
  type BuildBrandLabCandidatesResult,
  type BrandLabDebug,
} from './brandLabCandidates';

export {
  buildGapPlanCandidates,
  extractGapPlanStructured,
  findGapPlanRoot,
  type BuildGapPlanCandidatesResult,
  type GapPlanDebug,
} from './gapPlanCandidates';

// ============================================================================
// Cooldown
// ============================================================================

export {
  getCooldownRemaining,
  isInCooldown,
  setCooldown,
  clearCooldown,
  getCooldownInfo,
  cleanupExpiredCooldowns,
  DEFAULT_COOLDOWN_SECONDS,
} from './cooldown';

// ============================================================================
// Required Strategy Fields
// ============================================================================

export {
  V4_REQUIRED_STRATEGY_FIELDS,
  getAllRequiredPaths,
  isFieldSatisfied,
  getMissingRequiredV4,
  getRequiredFieldStats,
  type V4RequiredField,
} from './requiredStrategyFields';

// ============================================================================
// Auto-Propose Baseline
// ============================================================================

export {
  autoProposeBaselineIfNeeded,
  type AutoProposeTriggeredBy,
  type AutoProposeBaselineParams,
  type AutoProposeBaselineResult,
} from './autoProposeBaseline';

// ============================================================================
// V4 Convergence & Evidence Grounding
// ============================================================================

// Convergence module
export {
  isConvergenceEnabled,
  computeSpecificityScore,
  inferDecisionImpact,
  isSummaryShaped,
  enhanceProposalWithConvergence,
  applyConvergenceToCandidates,
  needsConvergenceRewrite,
  getProposalRankingScore,
  rankProposals,
  getDomainGroup,
  groupProposalsByDomain,
  type SpecificityResult,
  type SpecificityOptions,
  type ConvergenceCandidate,
  type EnhancedCandidate,
} from './convergence';

// Site snapshot for evidence grounding
export {
  getSiteSnapshotForCompany,
  extractEvidenceAnchors,
  hasUsableContent,
  shouldBlockProposals,
  type SiteSnapshot,
  type SnapshotPage,
} from './siteSnapshot';

// Evidence grounding validation
export {
  groundCandidate,
  groundCandidates,
  validatePositioning,
  validateValueProposition,
  validatePrimaryAudience,
  validateIcpDescription,
  getFieldValidator,
  findGenericCliches,
  isTooGeneric,
  shouldBlockForErrorState,
  type GroundedCandidate,
  type FieldValidationResult,
  type EvidenceGroundingOptions,
} from './evidenceGrounding';

// Lab proposals with evidence grounding
export {
  generateLabProposals,
  generateBrandLabProposals,
  generateWebsiteLabProposals,
  extractBrandLabCandidates,
  extractWebsiteLabCandidates as extractWebsiteLabCandidatesV4,
  type LabResultForProposals,
  type GenerateLabProposalsOptions,
  type GenerateLabProposalsResult,
} from './labProposals';
