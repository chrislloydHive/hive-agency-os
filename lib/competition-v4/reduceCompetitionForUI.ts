// lib/competition-v4/reduceCompetitionForUI.ts
// Deterministic render reducer for Competition Lab V4
//
// SINGLE SOURCE OF TRUTH:
// UI must render using ReducedCompetition only.
// This reducer applies gating rules at render time to ensure semantic correctness.
//
// ALGORITHM:
// Step 0: Collect all competitors from raw tiers
// Step 1: Dedupe by domain (keep strongest tier)
// Step 2: Remove subject company
// Step 3: Determine mode + confidence
// Step 4: Tag each competitor with mechanism (retailHybrid vs installFirst)
// Step 5: Apply gating rules (move retail-hybrids to contextual when required)
// Step 6: Build final tiers
// Step 7: Sort within tiers
// Step 8: Output ReducedCompetition

import type {
  CompetitionV4Result,
  ScoredCompetitor,
  ExcludedCompetitorRecord,
  CompetitiveModalityType,
} from './types';
import {
  validateCompetitionRun,
  isRetailHybrid,
  isInstallFirst,
  type SubjectInfo,
  type ValidationError,
} from './validateCompetitionRun';

// ============================================================================
// Types
// ============================================================================

export interface ReducedCompetitor {
  // Identity
  name: string;
  domain: string | null;

  // Scores
  overlapScore: number;
  brandRecognition: number;
  confidence: number;

  // Classification
  mechanism: 'install-first' | 'retail-hybrid' | 'other';
  originalTier: 'primary' | 'contextual' | 'alternatives' | 'excluded';

  // Signals
  hasInstallation: boolean;
  hasNationalReach: boolean;
  isMajorRetailer: boolean;
  isLocal: boolean;
  pricePositioning: 'budget' | 'mid' | 'premium' | 'unknown';

  // Rich details
  whyThisMatters?: string;
  reasons?: string[];
  competitionMechanism: string;

  // Raw data (for UI components that need full access)
  raw: ScoredCompetitor;
}

export interface ForcedMove {
  domain: string;
  name: string;
  from: string;
  to: string;
  reason: string;
}

export interface ReducedCompetition {
  mode: {
    modality: CompetitiveModalityType;
    confidence: number;
    explanation: string;
    hasClarifyingQuestion: boolean;
    /** True if retail-hybrids are allowed in Primary */
    allowRetailHybridPrimary: boolean;
  };

  tiers: {
    /** Install-first primary competitors */
    primaryInstallFirst: ReducedCompetitor[];
    /** Retail-hybrid primary competitors (may be empty when gated) */
    primaryRetailHybrid: ReducedCompetitor[];
    /** Contextual competitors (includes gated retail-hybrids) */
    contextual: ReducedCompetitor[];
    /** Alternative solutions */
    alternatives: ReducedCompetitor[];
    /** Excluded competitors */
    excluded: ExcludedCompetitorRecord[];
  };

  notes: {
    /** Number of subject company occurrences filtered out */
    suppressedSubjectCount: number;
    /** Competitors moved between tiers by gating rules */
    forcedMoves: ForcedMove[];
    /** Validation errors detected (for dev visibility) */
    validationErrors: ValidationError[];
  };

  /** UI copy hints */
  copyHints: {
    /** Show "moderate confidence" label */
    showModerateConfidenceLabel: boolean;
    /** Show retail-hybrid gating explanation */
    showRetailHybridGatingExplanation: boolean;
    /** Explanation text for why retail-hybrids are in contextual */
    retailHybridGatingReason: string | null;
  };
}

// ============================================================================
// Internal Types
// ============================================================================

interface TaggedCompetitor {
  competitor: ScoredCompetitor;
  originalTier: 'primary' | 'contextual' | 'alternatives' | 'excluded';
  mechanism: 'install-first' | 'retail-hybrid' | 'other';
  dedupeKey: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get tier priority for deduplication (lower = stronger)
 */
function getTierPriority(tier: string): number {
  switch (tier) {
    case 'primary':
      return 0;
    case 'contextual':
      return 1;
    case 'alternatives':
      return 2;
    case 'excluded':
      return 3;
    default:
      return 4;
  }
}

/**
 * Generate dedupe key from domain or normalized name
 */
function getDedupeKey(competitor: ScoredCompetitor | ExcludedCompetitorRecord): string {
  if (competitor.domain) {
    return competitor.domain.toLowerCase().replace(/^www\./, '');
  }
  return competitor.name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Determine mechanism for a competitor.
 * HARD RULE: Retail-Hybrid can NEVER be Install-First.
 */
function getMechanism(competitor: ScoredCompetitor): 'install-first' | 'retail-hybrid' | 'other' {
  // Check retail-hybrid FIRST - this takes precedence
  if (isRetailHybrid(competitor)) {
    return 'retail-hybrid';
  }
  if (isInstallFirst(competitor)) {
    return 'install-first';
  }
  return 'other';
}

/**
 * Generate competition mechanism description
 */
function getCompetitionMechanism(competitor: ScoredCompetitor, mechanism: string): string {
  if (mechanism === 'retail-hybrid') {
    return 'Influences customer expectations through national retail presence and bundled services';
  }
  if (competitor.hasInstallation && competitor.overlapScore >= 60) {
    return 'Competes directly for installation jobs';
  }
  if (competitor.hasInstallation) {
    return 'Offers similar installation services';
  }
  if (competitor.pricePositioning === 'budget') {
    return 'Applies price pressure via budget positioning';
  }
  if (competitor.hasNationalReach) {
    return 'Shapes market expectations through national scale';
  }
  if (competitor.isLocal) {
    return 'Competes for local market share';
  }
  return 'Competes in overlapping service categories';
}

/**
 * Convert ScoredCompetitor to ReducedCompetitor
 */
function toReducedCompetitor(
  competitor: ScoredCompetitor,
  originalTier: 'primary' | 'contextual' | 'alternatives' | 'excluded',
  mechanism: 'install-first' | 'retail-hybrid' | 'other'
): ReducedCompetitor {
  return {
    name: competitor.name,
    domain: competitor.domain || null,
    overlapScore: competitor.overlapScore ?? 0,
    brandRecognition: competitor.brandTrustScore ?? 50,
    confidence: competitor.confidence ?? 50,
    mechanism,
    originalTier,
    hasInstallation: competitor.hasInstallation ?? false,
    hasNationalReach: competitor.hasNationalReach ?? false,
    isMajorRetailer: competitor.isMajorRetailer ?? false,
    isLocal: competitor.isLocal ?? false,
    pricePositioning: competitor.pricePositioning ?? 'unknown',
    whyThisMatters: competitor.whyThisMatters,
    reasons: competitor.reasons,
    competitionMechanism: getCompetitionMechanism(competitor, mechanism),
    raw: competitor,
  };
}

/**
 * Check if competitor matches subject company
 */
function matchesSubject(
  competitor: ScoredCompetitor | ExcludedCompetitorRecord,
  subject: SubjectInfo
): boolean {
  const competitorName = competitor.name.toLowerCase().trim();
  const subjectName = subject.companyName.toLowerCase().trim();
  const competitorDomain = competitor.domain?.toLowerCase().trim() || '';
  const subjectDomain = subject.domain?.toLowerCase().trim() || '';

  // Exact domain match
  if (subjectDomain && competitorDomain === subjectDomain) {
    return true;
  }

  // Exact name match
  if (competitorName === subjectName) {
    return true;
  }

  // Partial name containment
  if (
    competitorName.includes(subjectName) ||
    subjectName.includes(competitorName)
  ) {
    const lenRatio =
      Math.min(competitorName.length, subjectName.length) /
      Math.max(competitorName.length, subjectName.length);
    if (lenRatio > 0.5) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Main Reducer
// ============================================================================

/**
 * Reduces Competition V4 result to a deterministic, semantically correct UI structure.
 *
 * This is the SINGLE SOURCE OF TRUTH for the UI.
 * All gating rules are applied here at render time.
 *
 * @param run - The Competition V4 result from the model
 * @param subject - Subject company info (name + domain)
 * @returns ReducedCompetition ready for UI rendering
 */
export function reduceCompetitionForUI(
  run: CompetitionV4Result,
  subject: SubjectInfo
): ReducedCompetition {
  // Run validation first (for logging/dev visibility)
  const validationResult = validateCompetitionRun(run, subject);

  const sc = run.scoredCompetitors;
  const forcedMoves: ForcedMove[] = [];
  let suppressedSubjectCount = 0;

  // ========================================================================
  // Step 0: Collect all competitors from raw tiers
  // ========================================================================
  const allTagged: TaggedCompetitor[] = [];

  if (sc) {
    for (const competitor of sc.primary || []) {
      allTagged.push({
        competitor,
        originalTier: 'primary',
        mechanism: getMechanism(competitor),
        dedupeKey: getDedupeKey(competitor),
      });
    }
    for (const competitor of sc.contextual || []) {
      allTagged.push({
        competitor,
        originalTier: 'contextual',
        mechanism: getMechanism(competitor),
        dedupeKey: getDedupeKey(competitor),
      });
    }
    for (const competitor of sc.alternatives || []) {
      allTagged.push({
        competitor,
        originalTier: 'alternatives',
        mechanism: getMechanism(competitor),
        dedupeKey: getDedupeKey(competitor),
      });
    }
  }

  // ========================================================================
  // Step 1: Dedupe by domain (keep strongest tier)
  // ========================================================================
  const deduped = new Map<string, TaggedCompetitor>();
  for (const tagged of allTagged) {
    const existing = deduped.get(tagged.dedupeKey);
    if (!existing) {
      deduped.set(tagged.dedupeKey, tagged);
    } else {
      // Keep the one from the stronger tier
      if (getTierPriority(tagged.originalTier) < getTierPriority(existing.originalTier)) {
        deduped.set(tagged.dedupeKey, tagged);
      }
    }
  }

  // ========================================================================
  // Step 2: Remove subject company
  // ========================================================================
  const withoutSubject: TaggedCompetitor[] = [];
  for (const tagged of deduped.values()) {
    if (matchesSubject(tagged.competitor, subject)) {
      suppressedSubjectCount++;
    } else {
      withoutSubject.push(tagged);
    }
  }

  // Also filter excluded list
  const excludedFiltered = (sc?.excluded || []).filter(
    (e) => !matchesSubject(e, subject)
  );
  if ((sc?.excluded?.length || 0) > excludedFiltered.length) {
    suppressedSubjectCount += (sc?.excluded?.length || 0) - excludedFiltered.length;
  }

  // ========================================================================
  // Step 3: Determine mode + confidence
  // ========================================================================
  const modality: CompetitiveModalityType =
    sc?.modality ?? run.modalityInference?.modality ?? 'InstallationOnly';
  const confidence = sc?.modalityConfidence ?? run.modalityInference?.confidence ?? 0;
  const hasClarifyingQuestion = Boolean(sc?.clarifyingQuestion);
  const explanation =
    run.modalityInference?.explanation ??
    'Competitive modality inferred from business signals.';

  // ========================================================================
  // Step 4: Already tagged with mechanism in Step 0
  // ========================================================================

  // ========================================================================
  // Step 5: Apply GATING RULES
  // ========================================================================

  // Rule G1 (default conservative):
  // If modality === "InstallationOnly" OR confidence < 70:
  //   retail-hybrid competitors must NOT be in any primary tier
  //   move to contextual

  // Rule G2 (promotion allowed):
  // If modality === "Retail+Installation" AND confidence >= 70:
  //   retail-hybrid may appear in primaryRetailHybrid

  // Rule G3 (clarifying question enforcement):
  // If hasClarifyingQuestion === true AND confidence < 70:
  //   retail-hybrid MUST be contextual

  const allowRetailHybridPrimary =
    modality === 'Retail+Installation' && confidence >= 70 && !hasClarifyingQuestion;

  let retailHybridGatingReason: string | null = null;

  if (!allowRetailHybridPrimary) {
    if (modality === 'InstallationOnly') {
      retailHybridGatingReason =
        'Retail-hybrid competitors are shown contextually under Installation-Focused competition mode.';
    } else if (confidence < 70) {
      retailHybridGatingReason =
        'Retail-hybrid competitors are shown contextually due to moderate confidence in competition mode.';
    } else if (hasClarifyingQuestion) {
      retailHybridGatingReason =
        'Retail-hybrid competitors are shown contextually while competition dynamics are being clarified.';
    }
  }

  // ========================================================================
  // Step 6: Build final tiers
  // ========================================================================
  const primaryInstallFirst: ReducedCompetitor[] = [];
  const primaryRetailHybrid: ReducedCompetitor[] = [];
  const contextual: ReducedCompetitor[] = [];
  const alternatives: ReducedCompetitor[] = [];

  for (const tagged of withoutSubject) {
    const reduced = toReducedCompetitor(
      tagged.competitor,
      tagged.originalTier,
      tagged.mechanism
    );

    if (tagged.originalTier === 'primary') {
      if (tagged.mechanism === 'retail-hybrid') {
        if (allowRetailHybridPrimary) {
          // Promotion allowed
          primaryRetailHybrid.push(reduced);
        } else {
          // GATING: Move to contextual
          contextual.push(reduced);
          forcedMoves.push({
            domain: tagged.competitor.domain || tagged.competitor.name,
            name: tagged.competitor.name,
            from: 'primary',
            to: 'contextual',
            reason: retailHybridGatingReason || 'Retail-hybrid gated from primary',
          });
        }
      } else {
        // Service-first or other
        primaryInstallFirst.push(reduced);
      }
    } else if (tagged.originalTier === 'contextual') {
      contextual.push(reduced);
    } else if (tagged.originalTier === 'alternatives') {
      alternatives.push(reduced);
    }
    // 'excluded' is handled separately
  }

  // ========================================================================
  // Step 7: Sort within tiers
  // ========================================================================

  // Primary tiers: sort by overlapScore desc
  primaryInstallFirst.sort((a, b) => b.overlapScore - a.overlapScore);
  primaryRetailHybrid.sort((a, b) => b.overlapScore - a.overlapScore);

  // Contextual: sort by brandRecognition desc, then overlapScore desc
  contextual.sort((a, b) => {
    if (b.brandRecognition !== a.brandRecognition) {
      return b.brandRecognition - a.brandRecognition;
    }
    return b.overlapScore - a.overlapScore;
  });

  // Alternatives and excluded: stable sort (no change)

  // ========================================================================
  // Step 8: Output ReducedCompetition
  // ========================================================================

  return {
    mode: {
      modality,
      confidence,
      explanation,
      hasClarifyingQuestion,
      allowRetailHybridPrimary,
    },

    tiers: {
      primaryInstallFirst,
      primaryRetailHybrid,
      contextual,
      alternatives,
      excluded: excludedFiltered,
    },

    notes: {
      suppressedSubjectCount,
      forcedMoves,
      validationErrors: validationResult.errors,
    },

    copyHints: {
      showModerateConfidenceLabel: confidence < 70,
      showRetailHybridGatingExplanation: forcedMoves.length > 0,
      retailHybridGatingReason,
    },
  };
}

// ============================================================================
// Utility: Get Total Counts
// ============================================================================

export function getReducedCompetitorCounts(reduced: ReducedCompetition): {
  primaryTotal: number;
  primaryInstallFirst: number;
  primaryRetailHybrid: number;
  contextual: number;
  alternatives: number;
  excluded: number;
  total: number;
} {
  const primaryInstallFirst = reduced.tiers.primaryInstallFirst.length;
  const primaryRetailHybrid = reduced.tiers.primaryRetailHybrid.length;
  const contextual = reduced.tiers.contextual.length;
  const alternatives = reduced.tiers.alternatives.length;
  const excluded = reduced.tiers.excluded.length;

  return {
    primaryTotal: primaryInstallFirst + primaryRetailHybrid,
    primaryInstallFirst,
    primaryRetailHybrid,
    contextual,
    alternatives,
    excluded,
    total: primaryInstallFirst + primaryRetailHybrid + contextual + alternatives,
  };
}
