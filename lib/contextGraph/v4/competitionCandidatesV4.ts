// lib/contextGraph/v4/competitionCandidatesV4.ts
// Competition Lab V4 Candidates Builder
//
// Builds context graph proposals from Competition Lab V4 runs.
// Maps structured competitor buckets to Context Graph fields:
//
// competitiveLandscape.primaryCompetitors ← competitors.primary (REQUIRED FIELD)
// competitiveLandscape.competitors ← primary + contextual
// competitiveLandscape.marketStructureSummary ← summary.competitive_positioning
// competitiveLandscape.differentiationAxes ← summary.key_differentiation_axes
// competitiveLandscape.competitiveRisks ← summary.competitive_risks

import type { LabCandidate } from './propose';
import type { CompetitionV4Result, ScoredCompetitor } from '@/lib/competition-v4/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Competitor info for Context Graph
 */
export interface ContextCompetitorInfo {
  name: string;
  domain?: string;
  classification: 'primary' | 'contextual' | 'alternative';
  overlapScore: number;
  reasons?: string[];
}

/**
 * Result of building V4 competition candidates
 */
export interface BuildCompetitionCandidatesV4Result {
  /** The extraction path used */
  extractionPath: string;
  /** Candidates ready for V4 proposal */
  candidates: LabCandidate[];
  /** Debug info */
  debug?: {
    primaryCount: number;
    contextualCount: number;
    alternativeCount: number;
    excludedCount: number;
    hasSummary: boolean;
    hasModality: boolean;
    topTraitRules: string[];
  };
  /** Error state if run has errors */
  errorState?: {
    isError: boolean;
    errorType?: string;
    errorMessage?: string;
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract snippet for evidence
 */
function extractSnippet(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.slice(0, 200);
  }
  if (typeof value === 'object' && value !== null) {
    const str = JSON.stringify(value);
    return str.slice(0, 200);
  }
  return undefined;
}

/**
 * Map ScoredCompetitor to ContextCompetitorInfo
 */
function mapToContextCompetitor(comp: ScoredCompetitor): ContextCompetitorInfo {
  return {
    name: comp.name,
    domain: comp.domain || undefined,
    classification: comp.classification === 'excluded' ? 'alternative' : comp.classification,
    overlapScore: comp.overlapScore,
    reasons: comp.reasons,
  };
}

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build V4 context candidates from a Competition Lab V4 run
 *
 * Maps structured competitor buckets to Context Graph fields.
 * The primary competitors list is a REQUIRED field for Strategy context coverage.
 */
export function buildCompetitionCandidatesV4(
  run: CompetitionV4Result | null
): BuildCompetitionCandidatesV4Result {
  const result: BuildCompetitionCandidatesV4Result = {
    extractionPath: 'competitionV4',
    candidates: [],
  };

  // Handle null run
  if (!run) {
    result.errorState = {
      isError: true,
      errorType: 'UNKNOWN_ERROR',
      errorMessage: 'No competition V4 run provided',
    };
    return result;
  }

  // Check for execution errors
  if (run.execution.status === 'failed') {
    result.errorState = {
      isError: true,
      errorType: 'FAILED',
      errorMessage: run.execution.error || 'Competition V4 run failed',
    };
    return result;
  }

  // Get scored competitors
  const scored = run.scoredCompetitors;
  if (!scored) {
    result.errorState = {
      isError: true,
      errorType: 'NO_SCORED_COMPETITORS',
      errorMessage: 'No scored competitors in V4 run',
    };
    return result;
  }

  const primary = scored.primary || [];
  const contextual = scored.contextual || [];
  const alternatives = scored.alternatives || [];
  const excluded = scored.excluded || [];

  // Build debug info
  result.debug = {
    primaryCount: primary.length,
    contextualCount: contextual.length,
    alternativeCount: alternatives.length,
    excludedCount: excluded.length,
    hasSummary: !!run.summary,
    hasModality: !!scored.modality,
    topTraitRules: scored.topTraitRules || [],
  };

  const candidates: LabCandidate[] = [];
  const runCreatedAt = run.execution.startedAt;

  // =========================================================================
  // 1. competitiveLandscape.primaryCompetitors (REQUIRED FIELD)
  // =========================================================================
  // This is the critical field that unblocks Strategy context coverage
  if (primary.length > 0) {
    const primaryCompetitors = primary.map(mapToContextCompetitor);

    candidates.push({
      key: 'competitiveLandscape.primaryCompetitors',
      value: primaryCompetitors,
      confidence: 0.85,
      evidence: {
        rawPath: 'scoredCompetitors.primary',
        snippet: extractSnippet(primaryCompetitors.slice(0, 3)),
      },
      runCreatedAt,
    });
  }

  // =========================================================================
  // 2. competitiveLandscape.competitors (primary + contextual)
  // =========================================================================
  const allCompetitors = [...primary, ...contextual].map(mapToContextCompetitor);
  if (allCompetitors.length > 0) {
    candidates.push({
      key: 'competitiveLandscape.competitors',
      value: allCompetitors,
      confidence: 0.80,
      evidence: {
        rawPath: 'scoredCompetitors.primary + scoredCompetitors.contextual',
        snippet: extractSnippet(allCompetitors.slice(0, 3)),
      },
      runCreatedAt,
    });
  }

  // =========================================================================
  // 3. competitiveLandscape.marketStructureSummary (from summary)
  // =========================================================================
  if (run.summary?.competitive_positioning) {
    candidates.push({
      key: 'competitiveLandscape.marketStructureSummary',
      value: run.summary.competitive_positioning,
      confidence: 0.75,
      evidence: {
        rawPath: 'summary.competitive_positioning',
        snippet: extractSnippet(run.summary.competitive_positioning),
      },
      runCreatedAt,
    });
  }

  // =========================================================================
  // 4. competitiveLandscape.differentiationAxes (from summary)
  // =========================================================================
  if (run.summary?.key_differentiation_axes && run.summary.key_differentiation_axes.length > 0) {
    candidates.push({
      key: 'competitiveLandscape.differentiationAxes',
      value: run.summary.key_differentiation_axes,
      confidence: 0.70,
      evidence: {
        rawPath: 'summary.key_differentiation_axes',
        snippet: extractSnippet(run.summary.key_differentiation_axes),
      },
      runCreatedAt,
    });
  }

  // =========================================================================
  // 5. competitiveLandscape.competitiveRisks (from summary)
  // =========================================================================
  if (run.summary?.competitive_risks && run.summary.competitive_risks.length > 0) {
    candidates.push({
      key: 'competitiveLandscape.competitiveRisks',
      value: run.summary.competitive_risks,
      confidence: 0.70,
      evidence: {
        rawPath: 'summary.competitive_risks',
        snippet: extractSnippet(run.summary.competitive_risks),
      },
      runCreatedAt,
    });
  }

  // =========================================================================
  // 6. competitiveLandscape.competitiveModality (modality used for analysis)
  // =========================================================================
  if (scored.modality) {
    candidates.push({
      key: 'competitiveLandscape.competitiveModality',
      value: scored.modality,
      confidence: scored.modalityConfidence ? (scored.modalityConfidence / 100) : 0.75,
      evidence: {
        rawPath: 'scoredCompetitors.modality',
        snippet: `Modality: ${scored.modality}`,
      },
      runCreatedAt,
    });
  }

  // =========================================================================
  // 7. Alternative competitors as marketAlternatives
  // =========================================================================
  if (alternatives.length > 0) {
    const marketAlternatives = alternatives.map(alt => ({
      name: alt.name,
      domain: alt.domain || undefined,
      type: 'Alternative Competitor',
      summary: alt.whyThisMatters || undefined,
    }));

    candidates.push({
      key: 'competitiveLandscape.marketAlternatives',
      value: marketAlternatives,
      confidence: 0.65,
      evidence: {
        rawPath: 'scoredCompetitors.alternatives',
        snippet: extractSnippet(marketAlternatives.slice(0, 3)),
      },
      runCreatedAt,
    });
  }

  result.candidates = candidates;

  // Log results
  console.log(`[competitionCandidatesV4] Built ${candidates.length} candidates`, {
    primaryCount: primary.length,
    contextualCount: contextual.length,
    modality: scored.modality,
  });

  return result;
}

/**
 * Extract quality-relevant data from Competition V4 run
 * Returns metrics for lab quality scoring
 */
export function extractV4QualityMetrics(run: CompetitionV4Result | null): {
  competitorCount: number;
  primaryCount: number;
  hasReasons: boolean;
  hasSignals: boolean;
  hasSummary: boolean;
  hasDifferentiationAxes: boolean;
  hasRisks: boolean;
  modalityConfidence: number;
  avgConfidence: number;
} {
  if (!run || !run.scoredCompetitors) {
    return {
      competitorCount: 0,
      primaryCount: 0,
      hasReasons: false,
      hasSignals: false,
      hasSummary: false,
      hasDifferentiationAxes: false,
      hasRisks: false,
      modalityConfidence: 0,
      avgConfidence: 0,
    };
  }

  const scored = run.scoredCompetitors;
  const allCompetitors = [...(scored.primary || []), ...(scored.contextual || []), ...(scored.alternatives || [])];

  const hasReasons = allCompetitors.some(c => c.reasons && c.reasons.length > 0);
  const hasSignals = allCompetitors.some(c => c.signalsUsed && Object.keys(c.signalsUsed).length > 0);

  const totalConfidence = allCompetitors.reduce((sum, c) => sum + (c.confidence || 0), 0);
  const avgConfidence = allCompetitors.length > 0 ? totalConfidence / allCompetitors.length : 0;

  return {
    competitorCount: allCompetitors.length,
    primaryCount: (scored.primary || []).length,
    hasReasons,
    hasSignals,
    hasSummary: !!run.summary?.competitive_positioning,
    hasDifferentiationAxes: (run.summary?.key_differentiation_axes || []).length > 0,
    hasRisks: (run.summary?.competitive_risks || []).length > 0,
    modalityConfidence: scored.modalityConfidence || 0,
    avgConfidence,
  };
}
