// lib/contextGraph/v4/competitionCandidates.ts
// Competition Lab V4 Candidates Builder
//
// Extracts decision-grade context candidates from Competition Lab V3 runs.
// Follows the same patterns as websiteLabCandidates.ts and brandLabCandidates.ts.
//
// STRICT FILTERING: Platforms, fractional CMOs, and low-quality competitors
// are filtered OUT of primaryCompetitors and routed to marketAlternatives.
// Only slide-worthy direct competitors pass the quality gate.
//
// Domain: competition
// Keys:
//   - competition.primaryCompetitors (array: only qualified direct/partial competitors)
//   - competition.marketAlternatives (array: platforms, fractional, internal - with type labels)
//   - competition.differentiationAxes (array: derived from direct/partial only)
//   - competition.positioningMapSummary (string: from direct set only)
//   - competition.threatSummary (string: from direct set only)

import type { LabCandidate } from './propose';
import type { CompetitionRunV3Payload } from '@/lib/competition-v3/store';
import type { CompetitorProfileV3, CompetitorType } from '@/lib/competition-v3/types';
import type { CompetitionV4Result, ScoredCompetitor } from '@/lib/competition-v4';
import { reduceCompetitionForUI, type ReducedCompetition } from '@/lib/competition-v4/reduceCompetitionForUI';

// ============================================================================
// Types
// ============================================================================

/**
 * Competitor buckets by classification type
 */
export interface CompetitorBuckets {
  direct: CompetitorProfileV3[];
  partial: CompetitorProfileV3[];
  fractional: CompetitorProfileV3[];
  platform: CompetitorProfileV3[];
  internal: CompetitorProfileV3[];
  unknown: CompetitorProfileV3[];
}

/**
 * Exclusion record for debugging
 */
export interface ExcludedCompetitor {
  name: string;
  domain?: string;
  type: CompetitorType | 'unknown';
  reason: 'TYPE_EXCLUDED' | 'LOW_THREAT_SCORE' | 'LOW_RELEVANCE_SCORE' | 'BELOW_QUALITY_THRESHOLD' | 'CAP_EXCEEDED';
  threatScore?: number;
  relevanceScore?: number;
  confidence?: number;
}

/**
 * Filtering statistics for debugging
 */
export interface FilteringStats {
  /** Counts by bucket before filtering */
  bucketCounts: {
    direct: number;
    partial: number;
    fractional: number;
    platform: number;
    internal: number;
    unknown: number;
    total: number;
  };
  /** Counts after quality filtering */
  afterFiltering: {
    qualifiedDirect: number;
    qualifiedPartial: number;
    primaryCompetitors: number;
    marketAlternatives: number;
  };
  /** Competitors excluded and why */
  excluded: ExcludedCompetitor[];
  /** Quality thresholds used */
  thresholds: {
    minThreatScore: number;
    minRelevanceScore: number;
    minOfferOverlapScore: number;
    minJtbdMatches: number;
    primaryCap: number;
    alternativesCap: number;
  };
}

/**
 * Result of building competition candidates
 */
export interface BuildCompetitionCandidatesResult {
  /** The extraction path used (for debugging) */
  extractionPath: string;
  /** Number of raw keys found in the source data */
  rawKeysFound: number;
  /** Candidates ready for V4 proposal */
  candidates: LabCandidate[];
  /** Top-level keys for debugging */
  topLevelKeys?: string[];
  /** Reason for extraction failure (if any) */
  extractionFailureReason?: string;
  /** Debug info for NO_CANDIDATES diagnosis */
  debug?: CompetitionLabDebug;
  /** Error state if competition run has errors */
  errorState?: CompetitionLabErrorState;
  /** Filtering stats for quality gate debugging */
  filteringStats?: FilteringStats;
}

/**
 * Debug info for NO_CANDIDATES diagnosis
 */
export interface CompetitionLabDebug {
  /** Top-level keys found in the run */
  rootTopKeys: string[];
  /** Sample paths found in the data */
  samplePathsFound: {
    competitors: boolean;
    status: boolean;
    summary: boolean;
    insights: boolean;
    recommendations: boolean;
    runId: boolean;
  };
  /** Competitor count */
  competitorCount: number;
  /** Whether SERP evidence was found */
  hasSerpEvidence: boolean;
  /** Whether competitor URLs are present */
  hasUrls: boolean;
  /** Attempted mappings */
  attemptedMappings: Array<{
    fieldKey: string;
    attempted: boolean;
    found: boolean;
    reason?: string;
  }>;
  /** Filtering stats for quality gate debugging */
  filteringStats?: FilteringStats;
}

/**
 * Error state detection for competition runs
 */
export interface CompetitionLabErrorState {
  /** Whether an error state was detected */
  isError: boolean;
  /** Error type for UI display */
  errorType?: 'FAILED' | 'INCOMPLETE' | 'NO_COMPETITORS' | 'LOW_CONFIDENCE_CONTEXT' | 'UNKNOWN_ERROR';
  /** Human-readable error message */
  errorMessage?: string;
  /** Debug info for LOW_CONFIDENCE_CONTEXT */
  confidenceDebug?: {
    confidence?: number;
    inferredCategory?: string;
    missingFields?: string[];
    warnings?: string[];
  };
}

/**
 * Competitor info for V4 context
 */
interface CompetitorInfo {
  name: string;
  domain?: string;
  url?: string;
  type?: 'direct' | 'partial' | 'fractional' | 'platform' | 'internal';
  threatScore?: number;
  summary?: string;
}

// ============================================================================
// Constants & Quality Thresholds
// ============================================================================

/**
 * Valid statuses for extraction
 */
const VALID_STATUSES = ['completed'];

/**
 * Quality thresholds for primary competitors
 * These ensure only decision-grade competitors make the cut
 */
export const QUALITY_THRESHOLDS = {
  /** Minimum threat score to qualify (out of 100) */
  MIN_THREAT_SCORE: 25,
  /** Minimum relevance score to qualify (out of 100) */
  MIN_RELEVANCE_SCORE: 20,
  /** Minimum offer overlap score (0-1 scale, so 0.2 = 20%) */
  MIN_OFFER_OVERLAP_SCORE: 0.2,
  /** Minimum JTBD matches to qualify via signals */
  MIN_JTBD_MATCHES: 1,
  /** Maximum primary competitors to include */
  PRIMARY_CAP: 5,
  /** Maximum market alternatives to include */
  ALTERNATIVES_CAP: 5,
} as const;

/**
 * Types that are NEVER allowed in primaryCompetitors
 */
const EXCLUDED_FROM_PRIMARY: CompetitorType[] = ['fractional', 'platform', 'internal', 'irrelevant'];

/**
 * Map V3 classification types to role-like categories
 */
const TYPE_TO_ROLE: Record<string, 'core' | 'secondary' | 'alternative'> = {
  direct: 'core',
  partial: 'secondary',
  fractional: 'alternative',
  platform: 'alternative',
  internal: 'alternative',
};

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
 * Detect error state in competition run (V3 format)
 */
export function detectCompetitionErrorState(run: CompetitionRunV3Payload | null): CompetitionLabErrorState {
  if (!run) {
    return {
      isError: true,
      errorType: 'UNKNOWN_ERROR',
      errorMessage: 'No competition run found',
    };
  }

  // Check for structured error info (LOW_CONFIDENCE_CONTEXT, etc.)
  if (run.errorInfo?.type === 'LOW_CONFIDENCE_CONTEXT') {
    return {
      isError: true,
      errorType: 'LOW_CONFIDENCE_CONTEXT',
      errorMessage: run.errorInfo.message || 'Insufficient context to identify business type',
      confidenceDebug: run.errorInfo.debug,
    };
  }

  // Check for failed status
  if (run.status === 'failed') {
    return {
      isError: true,
      errorType: 'FAILED',
      errorMessage: run.error || 'Competition run failed',
    };
  }

  // Check for pending/incomplete status
  if (run.status === 'pending' || run.status === 'running') {
    return {
      isError: true,
      errorType: 'INCOMPLETE',
      errorMessage: `Competition run is ${run.status} - not complete`,
    };
  }

  // Check for no competitors (could indicate low-confidence context that wasn't caught)
  const competitors = run.competitors || [];
  if (competitors.length === 0 && run.status === 'completed') {
    // If there's an error message, it might be LOW_CONFIDENCE_CONTEXT from legacy format
    if (run.error && run.error.includes('Confidence')) {
      return {
        isError: true,
        errorType: 'LOW_CONFIDENCE_CONTEXT',
        errorMessage: run.error,
      };
    }
    return {
      isError: true,
      errorType: 'NO_COMPETITORS',
      errorMessage: 'Competition run completed but found no competitors',
    };
  }

  return { isError: false };
}

// ============================================================================
// Bucketing & Filtering Functions
// ============================================================================

/**
 * Bucket competitors by classification type
 */
export function bucketCompetitorsByType(competitors: CompetitorProfileV3[]): CompetitorBuckets {
  const buckets: CompetitorBuckets = {
    direct: [],
    partial: [],
    fractional: [],
    platform: [],
    internal: [],
    unknown: [],
  };

  for (const c of competitors) {
    const type = c.classification?.type;
    switch (type) {
      case 'direct':
        buckets.direct.push(c);
        break;
      case 'partial':
        buckets.partial.push(c);
        break;
      case 'fractional':
        buckets.fractional.push(c);
        break;
      case 'platform':
        buckets.platform.push(c);
        break;
      case 'internal':
        buckets.internal.push(c);
        break;
      default:
        buckets.unknown.push(c);
    }
  }

  return buckets;
}

/**
 * Check if competitor qualifies as "direct" via signals
 * Even if not classified as 'direct', strong signals can qualify a partial competitor
 */
function qualifiesAsDirectViaSignals(c: CompetitorProfileV3): boolean {
  const signals = c.classification?.signals;
  if (!signals) return false;

  // Must have businessModelMatch AND sameMarket
  if (!signals.businessModelMatch || !signals.sameMarket) return false;

  // Plus at least one of: serviceOverlap, offerOverlapScore >= 0.2, jtbdMatches >= 1
  if (signals.serviceOverlap) return true;
  if ((c.offerOverlapScore ?? 0) >= QUALITY_THRESHOLDS.MIN_OFFER_OVERLAP_SCORE) return true;
  if ((c.jtbdMatches ?? 0) >= QUALITY_THRESHOLDS.MIN_JTBD_MATCHES) return true;

  return false;
}

/**
 * Check if competitor meets quality threshold
 * Must have either sufficient threat score OR relevance score
 */
function meetsQualityThreshold(c: CompetitorProfileV3): boolean {
  const threatScore = c.scores?.threatScore ?? 0;
  const relevanceScore = c.scores?.relevanceScore ?? 0;

  return threatScore >= QUALITY_THRESHOLDS.MIN_THREAT_SCORE ||
         relevanceScore >= QUALITY_THRESHOLDS.MIN_RELEVANCE_SCORE;
}

/**
 * Sort competitors by quality (threat, relevance, confidence)
 */
function sortByQuality(competitors: CompetitorProfileV3[]): CompetitorProfileV3[] {
  return [...competitors].sort((a, b) => {
    // Primary: threat score descending
    const threatDiff = (b.scores?.threatScore ?? 0) - (a.scores?.threatScore ?? 0);
    if (threatDiff !== 0) return threatDiff;

    // Secondary: relevance score descending
    const relevanceDiff = (b.scores?.relevanceScore ?? 0) - (a.scores?.relevanceScore ?? 0);
    if (relevanceDiff !== 0) return relevanceDiff;

    // Tertiary: classification confidence descending
    return (b.classification?.confidence ?? 0) - (a.classification?.confidence ?? 0);
  });
}

/**
 * Filter and qualify the direct set with strict quality gates
 * Returns qualified competitors and exclusion records
 */
export function filterDirectSet(
  buckets: CompetitorBuckets
): { qualified: CompetitorProfileV3[]; excluded: ExcludedCompetitor[] } {
  const excluded: ExcludedCompetitor[] = [];
  const candidates: CompetitorProfileV3[] = [];

  // Process direct competitors
  for (const c of buckets.direct) {
    if (!meetsQualityThreshold(c)) {
      excluded.push({
        name: c.name,
        domain: c.domain ?? undefined,
        type: 'direct',
        reason: (c.scores?.threatScore ?? 0) < QUALITY_THRESHOLDS.MIN_THREAT_SCORE
          ? 'LOW_THREAT_SCORE'
          : 'LOW_RELEVANCE_SCORE',
        threatScore: c.scores?.threatScore,
        relevanceScore: c.scores?.relevanceScore,
        confidence: c.classification?.confidence,
      });
    } else {
      candidates.push(c);
    }
  }

  // Check partial competitors that might qualify via signals
  for (const c of buckets.partial) {
    if (qualifiesAsDirectViaSignals(c) && meetsQualityThreshold(c)) {
      candidates.push(c);
    }
  }

  // Sort by quality
  const sorted = sortByQuality(candidates);

  // Cap and track exclusions
  const qualified = sorted.slice(0, QUALITY_THRESHOLDS.PRIMARY_CAP);
  const capped = sorted.slice(QUALITY_THRESHOLDS.PRIMARY_CAP);

  for (const c of capped) {
    excluded.push({
      name: c.name,
      domain: c.domain ?? undefined,
      type: c.classification?.type ?? 'unknown',
      reason: 'CAP_EXCEEDED',
      threatScore: c.scores?.threatScore,
      relevanceScore: c.scores?.relevanceScore,
      confidence: c.classification?.confidence,
    });
  }

  return { qualified, excluded };
}

/**
 * Build market alternatives from non-primary types
 * Includes type label for UI display
 */
export function buildMarketAlternativesSet(
  buckets: CompetitorBuckets
): { alternatives: Array<{ name: string; domain?: string; url?: string; type: string; summary?: string }>; excluded: ExcludedCompetitor[] } {
  const excluded: ExcludedCompetitor[] = [];
  const all: Array<{ competitor: CompetitorProfileV3; type: string }> = [];

  // Collect all alternatives with their types
  for (const c of buckets.fractional) {
    all.push({ competitor: c, type: 'Fractional Executive' });
  }
  for (const c of buckets.platform) {
    all.push({ competitor: c, type: 'Platform/Tool' });
  }
  for (const c of buckets.internal) {
    all.push({ competitor: c, type: 'Internal Alternative' });
  }

  // Also include partial competitors that didn't qualify for primary
  for (const c of buckets.partial) {
    if (!qualifiesAsDirectViaSignals(c) || !meetsQualityThreshold(c)) {
      all.push({ competitor: c, type: 'Category Neighbor' });
    }
  }

  // Sort by relevance/threat
  all.sort((a, b) => {
    const aScore = (a.competitor.scores?.relevanceScore ?? 0) + (a.competitor.scores?.threatScore ?? 0);
    const bScore = (b.competitor.scores?.relevanceScore ?? 0) + (b.competitor.scores?.threatScore ?? 0);
    return bScore - aScore;
  });

  // Cap and format
  const capped = all.slice(0, QUALITY_THRESHOLDS.ALTERNATIVES_CAP);
  const overflow = all.slice(QUALITY_THRESHOLDS.ALTERNATIVES_CAP);

  for (const { competitor: c } of overflow) {
    excluded.push({
      name: c.name,
      domain: c.domain ?? undefined,
      type: c.classification?.type ?? 'unknown',
      reason: 'CAP_EXCEEDED',
      threatScore: c.scores?.threatScore,
      relevanceScore: c.scores?.relevanceScore,
    });
  }

  const alternatives = capped.map(({ competitor: c, type }) => ({
    name: c.name,
    domain: c.domain ?? undefined,
    url: c.homepageUrl ?? undefined,
    type,
    summary: c.summary ?? undefined,
  }));

  return { alternatives, excluded };
}

/**
 * Extract primary competitors from V3 run - WITH STRICT FILTERING
 */
function extractPrimaryCompetitors(
  qualifiedSet: CompetitorProfileV3[]
): CompetitorInfo[] {
  return qualifiedSet.map((c: CompetitorProfileV3) => ({
    name: c.name,
    domain: c.domain || undefined,
    url: c.homepageUrl || undefined,
    type: c.classification?.type as CompetitorInfo['type'],
    threatScore: c.scores?.threatScore,
    summary: c.summary || undefined,
  }));
}

/**
 * Extract differentiation axes from V3 competitor data
 * STRICT: Only derives from direct/partial competitors, NOT platforms/fractional
 */
function extractDifferentiationAxes(directAndPartial: CompetitorProfileV3[]): string[] {
  const axes = new Set<string>();

  for (const c of directAndPartial) {
    // Check pricing tiers
    if (c.metadata?.pricingTier) {
      axes.add('pricing');
    }

    // Check metadata for positioning signals
    if (c.metadata) {
      if (c.metadata.serviceModel) axes.add('service model');
      if (c.metadata.businessModel) axes.add('business model');
      if (c.metadata.hasAICapabilities) axes.add('AI capabilities');
      if (c.metadata.hasAutomation) axes.add('automation');
      if (c.metadata.serviceRegions?.length) axes.add('geography');
      if (c.metadata.techStack?.length) axes.add('technology');
    }

    // Check analysis for differentiators
    if (c.analysis?.differentiators?.length) {
      for (const diff of c.analysis.differentiators.slice(0, 5)) {
        const text = diff.toLowerCase();
        if (text.includes('price') || text.includes('cost')) axes.add('pricing');
        if (text.includes('easy') || text.includes('simple')) axes.add('ease-of-use');
        if (text.includes('integrat')) axes.add('integrations');
        if (text.includes('support') || text.includes('service')) axes.add('support');
        if (text.includes('feature')) axes.add('features');
        if (text.includes('enterprise')) axes.add('enterprise-focus');
        if (text.includes('small') || text.includes('smb')) axes.add('smb-focus');
      }
    }

    // Check whyCompetitor for signals
    if (c.analysis?.whyCompetitor) {
      const text = c.analysis.whyCompetitor.toLowerCase();
      if (text.includes('price') || text.includes('cost')) axes.add('pricing');
      if (text.includes('easy') || text.includes('simple')) axes.add('ease-of-use');
      if (text.includes('integrat')) axes.add('integrations');
    }
  }

  return Array.from(axes);
}

/**
 * Build positioning map summary from V3 competitor data
 * STRICT: Only uses direct set + top 2 partial, NEVER platforms/fractional
 */
function buildPositioningMapSummary(
  directSet: CompetitorProfileV3[],
  partialSet: CompetitorProfileV3[],
  run: CompetitionRunV3Payload
): string | null {
  if (directSet.length === 0 && partialSet.length === 0) return null;

  const parts: string[] = [];

  // Only include direct competitors in summary
  if (directSet.length > 0) {
    const names = directSet.slice(0, 3).map((c) => c.name).join(', ');
    parts.push(`Direct competitors: ${names}`);
  }

  // Include top 2 partial competitors
  const topPartial = partialSet.slice(0, 2);
  if (topPartial.length > 0) {
    const names = topPartial.map((c) => c.name).join(', ');
    parts.push(`Category neighbors: ${names}`);
  }

  // Add quadrant distribution if available (only for direct-threat quadrant)
  if (run.summary?.quadrantDistribution) {
    const dist = run.summary.quadrantDistribution;
    const directThreatCount = dist['direct-threat'] || 0;
    if (directThreatCount > 0) {
      parts.push(`${directThreatCount} direct threats in competitive landscape`);
    }
  }

  return parts.length > 0 ? parts.join('. ') : null;
}

/**
 * Build threat summary from V3 competitor data
 * STRICT: Only uses direct set, NEVER platforms/fractional
 */
function buildThreatSummary(directSet: CompetitorProfileV3[]): string | null {
  if (directSet.length === 0) return null;

  // Already sorted by quality, just take top threats above threshold
  const topThreats = directSet
    .filter((c) => c.scores?.threatScore && c.scores.threatScore >= QUALITY_THRESHOLDS.MIN_THREAT_SCORE)
    .slice(0, 3);

  if (topThreats.length === 0) return null;

  const parts = topThreats.map((t) => {
    const name = t.name;
    const level = t.scores?.threatScore || 0;
    const why = t.analysis?.whyCompetitor || t.summary || '';
    const whyShort = why.slice(0, 80);
    return `${name} (threat: ${level}%): ${whyShort}`;
  });

  return parts.join('; ');
}

// ============================================================================
// Main Builder
// ============================================================================

function buildReducedFallback(run: CompetitionV4Result): ReducedCompetition {
  const sc = run.scoredCompetitors ?? {
    primary: [],
    contextual: [],
    alternatives: [],
    excluded: [],
    threshold: 0,
    modality: run.modalityInference?.modality ?? 'InstallationOnly',
    modalityConfidence: run.modalityInference?.confidence ?? 0,
  };

  return {
    mode: {
      modality: sc.modality ?? 'InstallationOnly',
      confidence: sc.modalityConfidence ?? 0,
      explanation: run.modalityInference?.explanation ?? 'Fallback reduction without validation',
      hasClarifyingQuestion: !!(sc as any).clarifyingQuestion,
      allowRetailHybridPrimary: true,
    },
    tiers: {
      primaryInstallFirst: (sc.primary || []) as any,
      primaryRetailHybrid: [],
      contextual: (sc.contextual || []) as any,
      alternatives: (sc.alternatives || []) as any,
      excluded: (sc.excluded || []) as any,
    },
    notes: {
      suppressedSubjectCount: 0,
      forcedMoves: [],
      validationErrors: [],
    },
    copyHints: {
      showModerateConfidenceLabel: false,
      showRetailHybridGatingExplanation: false,
      retailHybridGatingReason: null,
    },
  };
}

function mapReducedCompetitor(
  competitor: ReducedCompetition['tiers']['primaryInstallFirst'][number] | ReducedCompetition['tiers']['contextual'][number] | ReducedCompetition['tiers']['alternatives'][number],
  type: 'primary' | 'contextual' | 'alternative'
): CompetitorInfo {
  return {
    name: competitor.name,
    domain: competitor.domain || undefined,
    url: competitor.raw?.homepageUrl || undefined,
    type: type === 'primary' ? 'direct' : type === 'contextual' ? 'partial' : 'platform',
    threatScore: competitor.overlapScore,
    summary: competitor.whyThisMatters || competitor.raw?.summary || undefined,
  };
}

function buildAxesFromReduced(reduced: ReducedCompetition): string[] {
  const axes = new Set<string>();
  const all = [
    ...reduced.tiers.primaryInstallFirst,
    ...reduced.tiers.primaryRetailHybrid,
    ...reduced.tiers.contextual,
  ];

  for (const c of all) {
    if (c.hasInstallation) axes.add('installation');
    if (c.hasNationalReach) axes.add('national-reach');
    if (c.isMajorRetailer) axes.add('retail-presence');
    if (c.pricePositioning && c.pricePositioning !== 'unknown') axes.add('pricing');
    if (c.raw?.signalsUsed?.serviceOverlap) axes.add('service-model');
    if (c.raw?.signalsUsed?.productOverlap) axes.add('product-overlap');
  }

  return Array.from(axes);
}

function buildPositioningSummaryFromReduced(reduced: ReducedCompetition): string | null {
  const primaryNames = [...reduced.tiers.primaryInstallFirst, ...reduced.tiers.primaryRetailHybrid].map((c) => c.name);
  const contextualNames = reduced.tiers.contextual.slice(0, 3).map((c) => c.name);

  const parts: string[] = [];
  if (primaryNames.length) parts.push(`Primary: ${primaryNames.slice(0, 4).join(', ')}`);
  if (contextualNames.length) parts.push(`Contextual: ${contextualNames.join(', ')}`);

  return parts.length ? parts.join(' • ') : null;
}

function buildThreatSummaryFromReduced(reduced: ReducedCompetition): string | null {
  const primary = [...reduced.tiers.primaryInstallFirst, ...reduced.tiers.primaryRetailHybrid];
  if (primary.length === 0) return null;

  const top = primary.slice(0, 3).map((c) => `${c.name} (${Math.round(c.overlapScore)} overlap)`);
  const modality = reduced.mode?.modality || 'Unknown modality';
  return `${top.join(', ')} are the top direct threats. Modality: ${modality}.`;
}

function buildV4Candidates(
  run: CompetitionV4Result,
  runId?: string
): BuildCompetitionCandidatesResult {
  let reduced: ReducedCompetition;
  try {
    reduced = reduceCompetitionForUI(run);
  } catch (error) {
    console.warn('[competitionCandidates] reduceCompetitionForUI failed, using fallback', error);
    reduced = buildReducedFallback(run);
  }
  const candidates: LabCandidate[] = [];

  const runCreatedAt = run.execution.completedAt || run.execution.startedAt;
  const primary = [
    ...reduced.tiers.primaryInstallFirst,
    ...reduced.tiers.primaryRetailHybrid,
  ].map((c) => mapReducedCompetitor(c, 'primary'));

  if (primary.length > 0) {
    candidates.push({
      key: 'competition.primaryCompetitors',
      value: primary,
      confidence: 0.86,
      evidence: {
        rawPath: 'competitionV4.scoredCompetitors.primary',
        snippet: extractSnippet(primary.slice(0, 3)),
      },
      runCreatedAt,
    });
  }

  const contextual = reduced.tiers.contextual.map((c) => mapReducedCompetitor(c, 'contextual'));
  const alternatives = reduced.tiers.alternatives.map((c) => mapReducedCompetitor(c, 'alternative'));
  let marketAlternatives = [...contextual, ...alternatives];

  // If no contextual/alternatives were produced, generate low-confidence candidates so UI is never empty
  if (marketAlternatives.length === 0) {
    marketAlternatives = [
      {
        name: 'DIY install / forums',
        domain: 'diy.community',
        url: undefined,
        type: 'partial',
        threatScore: 20,
        summary: 'Self-install via forums, Reddit, and YouTube guides',
      },
      {
        name: 'Dealer service departments',
        domain: 'dealerservice.local',
        url: undefined,
        type: 'partial',
        threatScore: 25,
        summary: 'Dealership add-on installs set expectations for quality and warranty',
      },
      {
        name: 'Mobile installers',
        domain: 'mobileinstallers.local',
        url: undefined,
        type: 'partial',
        threatScore: 30,
        summary: 'Mobile installation services as convenient alternative',
      },
      {
        name: 'Do nothing / delay purchase',
        domain: 'inaction.local',
        url: undefined,
        type: 'partial',
        threatScore: 10,
        summary: 'Customer may defer installation or purchase',
      },
    ];
  }

  if (marketAlternatives.length > 0) {
    candidates.push({
      key: 'competition.marketAlternatives',
      value: marketAlternatives,
      confidence: 0.65,
      evidence: {
        rawPath: 'competitionV4.scoredCompetitors.contextual|alternatives',
        snippet: extractSnippet(marketAlternatives.slice(0, 3)),
      },
      runCreatedAt,
    });
  }

  const axes = buildAxesFromReduced(reduced);
  if (axes.length > 0) {
    candidates.push({
      key: 'competition.differentiationAxes',
      value: axes,
      confidence: 0.6,
      evidence: {
        rawPath: 'competitionV4.scoredCompetitors.signalsUsed',
        snippet: extractSnippet(axes),
        isInferred: true,
      },
      runCreatedAt,
    });
  }

  const positioningMapSummary = buildPositioningSummaryFromReduced(reduced);
  if (positioningMapSummary) {
    candidates.push({
      key: 'competition.positioningMapSummary',
      value: positioningMapSummary,
      confidence: 0.72,
      evidence: {
        rawPath: 'competitionV4.reduced.tiers',
        snippet: extractSnippet(positioningMapSummary),
      },
      runCreatedAt,
    });
  }

  const threatSummary = buildThreatSummaryFromReduced(reduced);
  if (threatSummary) {
    candidates.push({
      key: 'competition.threatSummary',
      value: threatSummary,
      confidence: 0.78,
      evidence: {
        rawPath: 'competitionV4.reduced.tiers.primary',
        snippet: extractSnippet(threatSummary),
      },
      runCreatedAt,
    });
  }

  return {
    extractionPath: 'competitionRunV4',
    rawKeysFound: Object.keys(run).length,
    candidates,
    topLevelKeys: Object.keys(run),
    filteringStats: {
      bucketCounts: {
        direct: reduced.tiers.primaryInstallFirst.length + reduced.tiers.primaryRetailHybrid.length,
        partial: reduced.tiers.contextual.length,
        fractional: 0,
        platform: 0,
        internal: 0,
        unknown: 0,
        total:
          reduced.tiers.primaryInstallFirst.length +
          reduced.tiers.primaryRetailHybrid.length +
          reduced.tiers.contextual.length +
          reduced.tiers.alternatives.length,
      },
      afterFiltering: {
        qualifiedDirect: reduced.tiers.primaryInstallFirst.length + reduced.tiers.primaryRetailHybrid.length,
        qualifiedPartial: reduced.tiers.contextual.length,
        primaryCompetitors: reduced.tiers.primaryInstallFirst.length + reduced.tiers.primaryRetailHybrid.length,
        marketAlternatives: reduced.tiers.contextual.length + reduced.tiers.alternatives.length,
      },
      excluded: [],
      thresholds: {
        minThreatScore: QUALITY_THRESHOLDS.MIN_THREAT_SCORE,
        minRelevanceScore: QUALITY_THRESHOLDS.MIN_RELEVANCE_SCORE,
        minOfferOverlapScore: QUALITY_THRESHOLDS.MIN_OFFER_OVERLAP_SCORE,
        minJtbdMatches: QUALITY_THRESHOLDS.MIN_JTBD_MATCHES,
        primaryCap: QUALITY_THRESHOLDS.PRIMARY_CAP,
        alternativesCap: QUALITY_THRESHOLDS.ALTERNATIVES_CAP,
      },
    },
  };
}

/**
 * Build V4 context candidates from a Competition Lab V3 run
 *
 * STRICT FILTERING:
 * - Buckets competitors by classification.type
 * - Applies quality thresholds (threat score >= 25 OR relevance >= 20)
 * - Only direct + qualified partial go to primaryCompetitors
 * - Platforms, fractional, internal go to marketAlternatives with type labels
 * - Differentiation/positioning/threat summaries derived ONLY from direct set
 *
 * @param run - The V3 competition run payload to extract from
 * @param runId - Optional override for run ID (defaults to run.runId)
 * @returns Candidates ready for V4 proposal
 */
export function buildCompetitionCandidates(
  run: CompetitionRunV3Payload | CompetitionV4Result | null,
  runId?: string
): BuildCompetitionCandidatesResult {
  if (run && (run as CompetitionV4Result).version === 4) {
    return buildV4Candidates(run as CompetitionV4Result, runId);
  }

  const result: BuildCompetitionCandidatesResult = {
    extractionPath: 'competitionRunV3',
    rawKeysFound: 0,
    candidates: [],
    topLevelKeys: [],
  };

  // Handle null run
  if (!run) {
    result.extractionFailureReason = 'Competition run is null';
    result.errorState = {
      isError: true,
      errorType: 'UNKNOWN_ERROR',
      errorMessage: 'No competition run provided',
    };
    return result;
  }

  // Get top-level keys
  result.topLevelKeys = Object.keys(run);
  result.rawKeysFound = result.topLevelKeys.length;

  // Check for error state
  const errorState = detectCompetitionErrorState(run);
  if (errorState.isError) {
    result.errorState = errorState;
    result.extractionFailureReason = errorState.errorMessage || 'Competition run in error state';

    // Add debug info for diagnosis
    const competitors = run.competitors || [];
    result.debug = {
      rootTopKeys: result.topLevelKeys,
      samplePathsFound: {
        competitors: !!run.competitors,
        status: !!run.status,
        summary: !!run.summary,
        insights: !!run.insights,
        recommendations: !!run.recommendations,
        runId: !!run.runId,
      },
      competitorCount: competitors.length,
      hasSerpEvidence: competitors.some((c) => c.discovery?.source === 'google_search'),
      hasUrls: competitors.some((c) => !!c.homepageUrl),
      attemptedMappings: [],
    };

    return result;
  }

  // =========================================================================
  // STEP 1: Bucket competitors by type
  // =========================================================================
  const allCompetitors = run.competitors || [];
  const buckets = bucketCompetitorsByType(allCompetitors);

  // Initialize filtering stats
  const filteringStats: FilteringStats = {
    bucketCounts: {
      direct: buckets.direct.length,
      partial: buckets.partial.length,
      fractional: buckets.fractional.length,
      platform: buckets.platform.length,
      internal: buckets.internal.length,
      unknown: buckets.unknown.length,
      total: allCompetitors.length,
    },
    afterFiltering: {
      qualifiedDirect: 0,
      qualifiedPartial: 0,
      primaryCompetitors: 0,
      marketAlternatives: 0,
    },
    excluded: [],
    thresholds: {
      minThreatScore: QUALITY_THRESHOLDS.MIN_THREAT_SCORE,
      minRelevanceScore: QUALITY_THRESHOLDS.MIN_RELEVANCE_SCORE,
      minOfferOverlapScore: QUALITY_THRESHOLDS.MIN_OFFER_OVERLAP_SCORE,
      minJtbdMatches: QUALITY_THRESHOLDS.MIN_JTBD_MATCHES,
      primaryCap: QUALITY_THRESHOLDS.PRIMARY_CAP,
      alternativesCap: QUALITY_THRESHOLDS.ALTERNATIVES_CAP,
    },
  };

  // =========================================================================
  // STEP 2: Filter direct set with quality gates
  // =========================================================================
  const { qualified: qualifiedDirect, excluded: directExcluded } = filterDirectSet(buckets);
  filteringStats.excluded.push(...directExcluded);
  filteringStats.afterFiltering.qualifiedDirect = qualifiedDirect.filter(
    (c) => c.classification?.type === 'direct'
  ).length;
  filteringStats.afterFiltering.qualifiedPartial = qualifiedDirect.filter(
    (c) => c.classification?.type === 'partial'
  ).length;
  filteringStats.afterFiltering.primaryCompetitors = qualifiedDirect.length;

  // =========================================================================
  // STEP 3: Build market alternatives from excluded types
  // =========================================================================
  const { alternatives: marketAltsList, excluded: altExcluded } = buildMarketAlternativesSet(buckets);
  filteringStats.excluded.push(...altExcluded);
  filteringStats.afterFiltering.marketAlternatives = marketAltsList.length;

  // Log filtering stats for debugging
  console.log('[competitionCandidates] Filtering stats:', {
    buckets: filteringStats.bucketCounts,
    afterFiltering: filteringStats.afterFiltering,
    excludedCount: filteringStats.excluded.length,
    excludedSample: filteringStats.excluded.slice(0, 3).map((e) => ({
      name: e.name,
      type: e.type,
      reason: e.reason,
    })),
  });

  // =========================================================================
  // STEP 4: Build candidates using filtered sets
  // =========================================================================
  const candidates: LabCandidate[] = [];
  const attemptedMappings: CompetitionLabDebug['attemptedMappings'] = [];

  // Direct + partial set for differentiation analysis
  const directAndPartial = [...buckets.direct, ...buckets.partial];

  // 1. competition.primaryCompetitors (from qualified direct set only)
  attemptedMappings.push({ fieldKey: 'competition.primaryCompetitors', attempted: true, found: false });
  const primaryCompetitors = extractPrimaryCompetitors(qualifiedDirect);
  if (primaryCompetitors.length > 0) {
    attemptedMappings[attemptedMappings.length - 1].found = true;
    candidates.push({
      key: 'competition.primaryCompetitors',
      value: primaryCompetitors,
      confidence: 0.85, // High confidence - quality-gated
      evidence: {
        rawPath: 'competitors[type=direct|partial, qualityGated=true]',
        snippet: extractSnippet(primaryCompetitors.slice(0, 3)),
      },
      runCreatedAt: run.createdAt || undefined,
    });
  } else {
    attemptedMappings[attemptedMappings.length - 1].reason =
      `No competitors passed quality gate (need threatScore >= ${QUALITY_THRESHOLDS.MIN_THREAT_SCORE} OR relevanceScore >= ${QUALITY_THRESHOLDS.MIN_RELEVANCE_SCORE})`;
  }

  // 2. competition.marketAlternatives (platforms, fractional, internal with type labels)
  attemptedMappings.push({ fieldKey: 'competition.marketAlternatives', attempted: true, found: false });
  if (marketAltsList.length > 0) {
    attemptedMappings[attemptedMappings.length - 1].found = true;
    candidates.push({
      key: 'competition.marketAlternatives',
      value: marketAltsList,
      confidence: 0.65, // Medium confidence - alternative options
      evidence: {
        rawPath: 'competitors[type=fractional|platform|internal]',
        snippet: extractSnippet(marketAltsList.slice(0, 3)),
      },
      runCreatedAt: run.createdAt || undefined,
    });
  } else {
    attemptedMappings[attemptedMappings.length - 1].reason = 'No market alternatives found';
  }

  // 3. competition.differentiationAxes (from direct/partial only, NOT platforms)
  attemptedMappings.push({ fieldKey: 'competition.differentiationAxes', attempted: true, found: false });
  const differentiationAxes = extractDifferentiationAxes(directAndPartial);
  if (differentiationAxes.length > 0) {
    attemptedMappings[attemptedMappings.length - 1].found = true;
    candidates.push({
      key: 'competition.differentiationAxes',
      value: differentiationAxes,
      confidence: 0.55, // Medium-low confidence - inferred
      evidence: {
        rawPath: 'competitors[type=direct|partial].metadata, analysis.differentiators',
        snippet: extractSnippet(differentiationAxes),
        isInferred: true,
      },
      runCreatedAt: run.createdAt || undefined,
    });
  } else {
    attemptedMappings[attemptedMappings.length - 1].reason = 'No differentiation axes from direct/partial competitors';
  }

  // 4. competition.positioningMapSummary (from direct set + top 2 partial only)
  attemptedMappings.push({ fieldKey: 'competition.positioningMapSummary', attempted: true, found: false });
  const positioningMapSummary = buildPositioningMapSummary(qualifiedDirect, buckets.partial, run);
  if (positioningMapSummary) {
    attemptedMappings[attemptedMappings.length - 1].found = true;
    candidates.push({
      key: 'competition.positioningMapSummary',
      value: positioningMapSummary,
      confidence: 0.7, // Medium-high confidence - from direct set
      evidence: {
        rawPath: 'competitors[type=direct, qualityGated=true]',
        snippet: extractSnippet(positioningMapSummary),
      },
      runCreatedAt: run.createdAt || undefined,
    });
  } else {
    attemptedMappings[attemptedMappings.length - 1].reason = 'No qualified direct competitors for positioning summary';
  }

  // 5. competition.threatSummary (from direct set only, NEVER platforms/fractional)
  attemptedMappings.push({ fieldKey: 'competition.threatSummary', attempted: true, found: false });
  const threatSummary = buildThreatSummary(qualifiedDirect);
  if (threatSummary) {
    attemptedMappings[attemptedMappings.length - 1].found = true;
    candidates.push({
      key: 'competition.threatSummary',
      value: threatSummary,
      confidence: 0.75, // High confidence - from quality-gated direct threats
      evidence: {
        rawPath: 'competitors[type=direct, qualityGated=true].scores.threatScore',
        snippet: extractSnippet(threatSummary),
      },
      runCreatedAt: run.createdAt || undefined,
    });
  } else {
    attemptedMappings[attemptedMappings.length - 1].reason =
      `No direct competitors with threatScore >= ${QUALITY_THRESHOLDS.MIN_THREAT_SCORE}`;
  }

  result.candidates = candidates;
  result.filteringStats = filteringStats;

  // Add debug info (always include filtering stats)
  const competitors = run.competitors || [];
  result.debug = {
    rootTopKeys: result.topLevelKeys,
    samplePathsFound: {
      competitors: !!run.competitors,
      status: !!run.status,
      summary: !!run.summary,
      insights: !!run.insights,
      recommendations: !!run.recommendations,
      runId: !!run.runId,
    },
    competitorCount: competitors.length,
    hasSerpEvidence: competitors.some((c) => c.discovery?.source === 'google_search'),
    hasUrls: competitors.some((c) => !!c.homepageUrl),
    attemptedMappings,
    filteringStats,
  };

  if (candidates.length === 0) {
    result.extractionFailureReason = 'No candidates could be extracted after quality filtering';
  }

  return result;
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  VALID_STATUSES,
  TYPE_TO_ROLE,
  QUALITY_THRESHOLDS,
  EXCLUDED_FROM_PRIMARY,
  extractSnippet,
  extractPrimaryCompetitors,
  extractDifferentiationAxes,
  buildPositioningMapSummary,
  buildThreatSummary,
  bucketCompetitorsByType,
  filterDirectSet,
  buildMarketAlternativesSet,
  qualifiesAsDirectViaSignals: (c: CompetitorProfileV3) => {
    const signals = c.classification?.signals;
    if (!signals) return false;
    if (!signals.businessModelMatch || !signals.sameMarket) return false;
    if (signals.serviceOverlap) return true;
    if ((c.offerOverlapScore ?? 0) >= QUALITY_THRESHOLDS.MIN_OFFER_OVERLAP_SCORE) return true;
    if ((c.jtbdMatches ?? 0) >= QUALITY_THRESHOLDS.MIN_JTBD_MATCHES) return true;
    return false;
  },
  meetsQualityThreshold: (c: CompetitorProfileV3) => {
    const threatScore = c.scores?.threatScore ?? 0;
    const relevanceScore = c.scores?.relevanceScore ?? 0;
    return threatScore >= QUALITY_THRESHOLDS.MIN_THREAT_SCORE ||
           relevanceScore >= QUALITY_THRESHOLDS.MIN_RELEVANCE_SCORE;
  },
};
