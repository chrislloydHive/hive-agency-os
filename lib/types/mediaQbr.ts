// lib/types/mediaQbr.ts
// Types for the Media QBR Template Generator
//
// Supports AI-powered generation of quarterly business reviews for media programs.

import type { CompanyAnalyticsSnapshot } from './companyAnalytics';
import type { CompanyMediaProgramSummary, MediaCampaignPerformance } from './mediaAnalytics';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';
import type { CompanyStatusNarrative } from './companyNarrative';

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for the Media QBR generator
 */
export interface MediaQbrInput {
  companyId: string;
  companyName?: string;
  range: '28d' | '90d';
  analytics: CompanyAnalyticsSnapshot;
  mediaSummary: CompanyMediaProgramSummary;
  campaigns: MediaCampaignPerformance[];
  findings: DiagnosticDetailFinding[];
  narrative?: CompanyStatusNarrative;
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Structured output from the Media QBR generator
 */
export interface MediaQbrOutput {
  /** High-level executive summary (2-3 paragraphs) */
  executiveSummary: string;

  /** Overview of media program performance (spend, leads, CPL, ROAS) */
  performanceOverview: string;

  /** Channel mix analysis and breakdown */
  channelMix: string;

  /** Key trends month-over-month or quarter-over-quarter */
  keyTrends: string[];

  /** Top performing campaigns with analysis */
  topCampaigns: string[];

  /** Underperforming campaigns needing attention */
  underperformingCampaigns: string[];

  /** Issues and opportunities from findings */
  issuesAndOpportunities: string[];

  /** Recommended actions for improvement */
  recommendedActions: string[];

  /** Strategic focus areas for next quarter */
  nextQuarterFocus: string[];

  /** Complete slide-ready markdown document */
  slideMarkdown: string;

  /** ISO timestamp when generated */
  generatedAt: string;

  /** Model used for generation */
  modelUsed: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get an empty/fallback QBR output
 */
export function getEmptyMediaQbrOutput(reason?: string): MediaQbrOutput {
  const fallbackMessage =
    reason || 'Unable to generate QBR. Please ensure media program and analytics are configured.';

  return {
    executiveSummary: fallbackMessage,
    performanceOverview: 'No performance data available.',
    channelMix: 'No channel data available.',
    keyTrends: [],
    topCampaigns: [],
    underperformingCampaigns: [],
    issuesAndOpportunities: [],
    recommendedActions: ['Configure analytics and media program data to generate a full QBR.'],
    nextQuarterFocus: [],
    slideMarkdown: `# MEDIA QBR\n\n${fallbackMessage}`,
    generatedAt: new Date().toISOString(),
    modelUsed: 'none',
  };
}

/**
 * Check if QBR has enough data to be useful
 */
export function isValidMediaQbr(qbr: MediaQbrOutput): boolean {
  return (
    qbr.modelUsed !== 'none' &&
    qbr.executiveSummary.length > 100 &&
    qbr.slideMarkdown.length > 500
  );
}
