// lib/contextGraph/v4/index.ts
// Context V4 Convergence & Evidence Grounding exports

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
  extractWebsiteLabCandidates,
  type LabResultForProposals,
  type GenerateLabProposalsOptions,
  type GenerateLabProposalsResult,
} from './labProposals';
