// lib/briefs/briefQuality.ts
// Brief Quality Assessment Module
//
// Provides a lightweight, rules-based quality indicator for briefs.
// Advisory only (no blocking), designed to scale later.

import type { Brief, BriefCore } from '@/lib/types/brief';

// ============================================================================
// Types
// ============================================================================

/**
 * Brief quality levels
 */
export type BriefQuality = 'high' | 'medium' | 'low';

/**
 * Reasons why a brief may have reduced quality
 */
export type BriefQualityReason =
  | 'missing_required_sections'
  | 'too_generic'
  | 'no_diagnostics_used'
  | 'stale_context'
  | 'no_acceptance_criteria';

/**
 * Human-readable labels for quality reasons
 */
export const QUALITY_REASON_LABELS: Record<BriefQualityReason, string> = {
  missing_required_sections: 'Missing required sections',
  too_generic: 'Content may be too generic or brief',
  no_diagnostics_used: 'No diagnostics data used',
  stale_context: 'Context data may be outdated',
  no_acceptance_criteria: 'Missing acceptance criteria',
};

/**
 * Suggestions for improving each quality reason
 */
export const QUALITY_REASON_SUGGESTIONS: Record<BriefQualityReason, string> = {
  missing_required_sections: 'Fill in the Objective, Problem to Solve, and Success Definition fields',
  too_generic: 'Add more specific details about scope, targets, or deliverables',
  no_diagnostics_used: 'Run GAP analysis to inform the brief with real diagnostics',
  stale_context: 'Update company context to ensure brief reflects current state',
  no_acceptance_criteria: 'Define clear success criteria in the Success Definition field',
};

/**
 * Quality badge colors
 */
export const QUALITY_BADGE_COLORS: Record<BriefQuality, string> = {
  high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  low: 'bg-red-500/10 text-red-400 border-red-500/30',
};

/**
 * Quality labels
 */
export const QUALITY_LABELS: Record<BriefQuality, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/**
 * Input arguments for quality computation
 */
export interface ComputeBriefQualityArgs {
  brief: Brief;
  /** Optional: info about diagnostics used */
  diagnosticsUsed?: {
    labs?: string[];
    ts?: string;
  } | null;
  /** Optional: when context was last updated */
  contextUpdatedAt?: string | null;
}

/**
 * Result of quality computation
 */
export interface BriefQualityResult {
  quality: BriefQuality;
  reasons: BriefQualityReason[];
}

// ============================================================================
// Heuristics
// ============================================================================

/**
 * Minimum character count for a field to be considered "substantive"
 */
const MIN_SUBSTANTIVE_LENGTH = 50;

/**
 * Minimum total character count for brief to not be "too generic"
 */
const MIN_TOTAL_CONTENT_LENGTH = 300;

/**
 * Days after which context is considered stale
 */
const STALE_CONTEXT_DAYS = 30;

/**
 * Check if a string field has substantive content
 */
function isSubstantive(value: string | undefined | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length >= MIN_SUBSTANTIVE_LENGTH;
}

/**
 * Check if a list field has items
 */
function hasItems(value: string[] | undefined | null): boolean {
  return Array.isArray(value) && value.length > 0 && value.some(v => v.trim().length > 0);
}

/**
 * Check if required sections are filled
 */
function checkMissingRequiredSections(core: BriefCore): boolean {
  // Required: objective, problemToSolve, successDefinition must have content
  const hasObjective = isSubstantive(core.objective);
  const hasProblem = isSubstantive(core.problemToSolve);
  const hasSuccess = isSubstantive(core.successDefinition);

  return !hasObjective || !hasProblem || !hasSuccess;
}

/**
 * Check if success definition has acceptance-criteria-like content
 */
function checkNoAcceptanceCriteria(core: BriefCore): boolean {
  const success = core.successDefinition?.trim() || '';

  // Consider it "has acceptance criteria" if:
  // 1. It's substantive, AND
  // 2. Contains measurement-like terms OR has multiple points
  if (success.length < 30) return true;

  const measurementTerms = [
    'increase', 'decrease', 'improve', 'reduce',
    'reach', 'achieve', 'complete', 'deliver',
    '%', 'percent', 'metric', 'kpi',
    'conversion', 'traffic', 'engagement', 'revenue',
    'user', 'customer', 'visitor',
    'within', 'by', 'before',
  ];

  const hasMetrics = measurementTerms.some(term =>
    success.toLowerCase().includes(term)
  );

  const hasBullets = success.includes('-') || success.includes('•') || /\d+\./.test(success);

  return !hasMetrics && !hasBullets;
}

/**
 * Check if brief content is too generic (short or boilerplate-heavy)
 */
function checkTooGeneric(core: BriefCore): boolean {
  // Calculate total content length
  const fields = [
    core.objective,
    core.targetAudience,
    core.problemToSolve,
    core.singleMindedFocus,
    core.successDefinition,
    ...(core.constraints || []),
    ...(core.assumptions || []),
  ];

  const totalLength = fields.reduce((sum, field) => {
    if (typeof field === 'string') return sum + (field?.trim().length || 0);
    return sum;
  }, 0);

  return totalLength < MIN_TOTAL_CONTENT_LENGTH;
}

/**
 * Check if context is stale
 */
function checkStaleContext(contextUpdatedAt: string | null | undefined): boolean {
  if (!contextUpdatedAt) return false; // No context info, don't flag

  const contextDate = new Date(contextUpdatedAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - contextDate.getTime()) / (1000 * 60 * 60 * 24));

  return diffDays > STALE_CONTEXT_DAYS;
}

/**
 * Check if diagnostics were used
 */
function checkNoDiagnosticsUsed(
  brief: Brief,
  diagnosticsUsed?: { labs?: string[]; ts?: string } | null
): boolean {
  // Check traceability first
  const hasGapRun = !!brief.traceability?.sourceGapRunId;
  const hasContextSnapshot = !!brief.traceability?.sourceContextSnapshotId;
  const hasBets = (brief.traceability?.sourceStrategicBetIds?.length || 0) > 0;

  // If any traceability exists, diagnostics were used
  if (hasGapRun || hasContextSnapshot || hasBets) return false;

  // Check explicit diagnostics info
  if (diagnosticsUsed?.labs && diagnosticsUsed.labs.length > 0) return false;

  // No diagnostics detected
  return true;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Compute brief quality based on heuristics
 *
 * @param args - Brief and optional context info
 * @returns Quality level and list of reasons
 */
export function computeBriefQuality(args: ComputeBriefQualityArgs): BriefQualityResult {
  const { brief, diagnosticsUsed, contextUpdatedAt } = args;
  const reasons: BriefQualityReason[] = [];

  // Check each heuristic
  if (checkMissingRequiredSections(brief.core)) {
    reasons.push('missing_required_sections');
  }

  if (checkNoAcceptanceCriteria(brief.core)) {
    reasons.push('no_acceptance_criteria');
  }

  if (checkTooGeneric(brief.core)) {
    reasons.push('too_generic');
  }

  if (checkNoDiagnosticsUsed(brief, diagnosticsUsed)) {
    reasons.push('no_diagnostics_used');
  }

  if (checkStaleContext(contextUpdatedAt)) {
    reasons.push('stale_context');
  }

  // Map reasons to quality level
  let quality: BriefQuality;

  if (reasons.length === 0) {
    quality = 'high';
  } else if (reasons.length <= 2 && !reasons.includes('missing_required_sections')) {
    quality = 'medium';
  } else {
    quality = 'low';
  }

  return { quality, reasons };
}

/**
 * Get a summary string for the quality result
 */
export function getQualitySummary(result: BriefQualityResult): string {
  if (result.quality === 'high') {
    return 'This brief has all required sections and looks well-structured.';
  }

  if (result.quality === 'medium') {
    return 'This brief is usable but could be improved.';
  }

  return 'This brief needs attention before it can guide effective work.';
}
