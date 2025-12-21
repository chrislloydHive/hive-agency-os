// lib/contextGraph/v4/index.ts
// V4 Context Graph Module Exports
//
// V4 introduces a "facts-first + review queue" workflow.

export {
  proposeFromLabResult,
  proposeSingleField,
  type LabCandidate,
  type ProposeFromLabResultParams,
  type ProposeFromLabResultSummary,
} from './propose';

export {
  buildWebsiteLabCandidates,
  extractWebsiteLabResult,
  getWebsiteLabAuthorizedDomains,
  type BuildWebsiteLabCandidatesResult,
} from './websiteLabCandidates';
