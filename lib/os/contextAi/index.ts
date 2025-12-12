// lib/os/contextAi/index.ts
// Context AI module - AI-powered helpers for company context
//
// This module provides AI-powered helpers for:
// - Generating company status narratives
// - Generating analytics-derived findings
// - Writing AI findings to Brain/diagnostics

export {
  generateCompanyStatusNarrative,
  type GenerateNarrativeInput,
} from './generateCompanyStatusNarrative';

export {
  generateAnalyticsFindings,
  type AnalyticsFinding,
  type AnalyticsFindingLabSlug,
  type AnalyticsFindingSeverity,
  type GenerateAnalyticsFindingsInput,
} from './generateAnalyticsFindings';

export {
  writeAnalyticsFindingsToBrain,
  type WriteAnalyticsFindingsInput,
  type WriteAnalyticsFindingsResult,
} from './writeAnalyticsFindingsToBrain';
