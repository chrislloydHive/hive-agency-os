// lib/contextGraph/v4/competitionCandidates.ts
// Competition Lab V4 Candidates Builder
//
// Extracts decision-grade context candidates from Competition Lab runs.
// Follows the same patterns as websiteLabCandidates.ts and brandLabCandidates.ts.
//
// Domain: competition
// Keys:
//   - competition.primaryCompetitors (array of names + URLs)
//   - competition.marketAlternatives (array: in-house, agency, spreadsheets, etc)
//   - competition.differentiationAxes (array: pricing, ease-of-use, integrations, etc)
//   - competition.positioningMapSummary (string summary of key differences)
//   - competition.threatSummary (string: top threats + why)

import type { LabCandidate } from './propose';
import type { CompetitionRun, ScoredCompetitor } from '@/lib/competition/types';

// ============================================================================
// Types
// ============================================================================

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
    stats: boolean;
    querySummary: boolean;
    discoveredCandidates: boolean;
    dataConfidenceScore: boolean;
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
}

/**
 * Error state detection for competition runs
 */
export interface CompetitionLabErrorState {
  /** Whether an error state was detected */
  isError: boolean;
  /** Error type for UI display */
  errorType?: 'FAILED' | 'INCOMPLETE' | 'NO_COMPETITORS' | 'UNKNOWN_ERROR';
  /** Human-readable error message */
  errorMessage?: string;
}

/**
 * Competitor info for V4 context
 */
interface CompetitorInfo {
  name: string;
  domain?: string;
  url?: string;
  role?: 'core' | 'secondary' | 'alternative';
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Signature fields that indicate valid competition run data
 */
const COMPETITION_SIGNATURE_FIELDS = [
  'competitors',
  'status',
  'companyId',
  'modelVersion',
  'stats',
  'startedAt',
];

/**
 * Valid statuses for extraction
 */
const VALID_STATUSES = ['completed', 'enriching', 'scoring', 'classifying'];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a value is meaningful (not null, undefined, or empty)
 */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

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
 * Detect error state in competition run
 */
export function detectCompetitionErrorState(run: CompetitionRun | null): CompetitionLabErrorState {
  if (!run) {
    return {
      isError: true,
      errorType: 'UNKNOWN_ERROR',
      errorMessage: 'No competition run found',
    };
  }

  // Check for failed status
  if (run.status === 'failed') {
    return {
      isError: true,
      errorType: 'FAILED',
      errorMessage: run.errorMessage || 'Competition run failed',
    };
  }

  // Check for pending/incomplete status
  if (run.status === 'pending' || run.status === 'discovering') {
    return {
      isError: true,
      errorType: 'INCOMPLETE',
      errorMessage: `Competition run is ${run.status} - not complete`,
    };
  }

  // Check for no competitors
  const competitors = run.competitors || [];
  const activeCompetitors = competitors.filter((c) => !c.removedByUser);
  if (activeCompetitors.length === 0 && VALID_STATUSES.includes(run.status)) {
    return {
      isError: true,
      errorType: 'NO_COMPETITORS',
      errorMessage: 'Competition run completed but found no competitors',
    };
  }

  return { isError: false };
}

/**
 * Extract primary competitors from run
 */
function extractPrimaryCompetitors(run: CompetitionRun): CompetitorInfo[] {
  const competitors = run.competitors || [];
  const activeCompetitors = competitors.filter((c) => !c.removedByUser);

  return activeCompetitors.map((c: ScoredCompetitor) => ({
    name: c.competitorName,
    domain: c.competitorDomain || undefined,
    url: c.homepageUrl || undefined,
    role: c.role || undefined,
  }));
}

/**
 * Extract market alternatives from competitor data
 * Looks for competitors marked as 'alternative' role
 */
function extractMarketAlternatives(run: CompetitionRun): string[] {
  const competitors = run.competitors || [];
  const alternatives = competitors.filter(
    (c) => c.role === 'alternative' && !c.removedByUser
  );

  // Collect unique alternative types
  const alternativeTypes: string[] = [];
  for (const alt of alternatives) {
    if (alt.competitorName) {
      alternativeTypes.push(alt.competitorName);
    }
  }

  // If no explicit alternatives, try to infer from enriched data
  if (alternativeTypes.length === 0) {
    for (const c of competitors.filter((c) => !c.removedByUser)) {
      const enriched = c.enrichedData;
      if (enriched?.companyType && !alternativeTypes.includes(enriched.companyType)) {
        alternativeTypes.push(enriched.companyType);
      }
    }
  }

  return alternativeTypes.slice(0, 10); // Cap at 10
}

/**
 * Extract differentiation axes from competitor enriched data
 */
function extractDifferentiationAxes(run: CompetitionRun): string[] {
  const axes = new Set<string>();
  const competitors = run.competitors || [];

  for (const c of competitors.filter((c) => !c.removedByUser)) {
    // Check pricing tiers
    if (c.priceTier) {
      axes.add('pricing');
    }

    // Check enriched data for positioning
    const enriched = c.enrichedData;
    if (enriched) {
      if (enriched.positioning) axes.add('positioning');
      if (enriched.targetAudience || enriched.companySizeTarget) axes.add('target market');
      if (enriched.primaryOffers?.length) axes.add('offerings');
      if (enriched.differentiators?.length) axes.add('features');
      if (enriched.geographicFocus) axes.add('geography');
      if (enriched.primaryChannels?.length) axes.add('channels');
    }

    // Check howTheyDiffer for additional axes
    if (c.howTheyDiffer) {
      const text = c.howTheyDiffer.toLowerCase();
      if (text.includes('price') || text.includes('cost')) axes.add('pricing');
      if (text.includes('easy') || text.includes('simple') || text.includes('usability')) axes.add('ease-of-use');
      if (text.includes('integrat')) axes.add('integrations');
      if (text.includes('support') || text.includes('service')) axes.add('support');
      if (text.includes('feature')) axes.add('features');
      if (text.includes('enterprise')) axes.add('enterprise-focus');
      if (text.includes('small') || text.includes('smb')) axes.add('smb-focus');
    }
  }

  return Array.from(axes);
}

/**
 * Build positioning map summary from competitor data
 */
function buildPositioningMapSummary(run: CompetitionRun): string | null {
  const competitors = run.competitors || [];
  const active = competitors.filter((c) => !c.removedByUser);

  if (active.length === 0) return null;

  const coreCompetitors = active.filter((c) => c.role === 'core');
  const secondaryCompetitors = active.filter((c) => c.role === 'secondary');
  const alternativeCompetitors = active.filter((c) => c.role === 'alternative');

  const parts: string[] = [];

  if (coreCompetitors.length > 0) {
    const names = coreCompetitors.slice(0, 3).map((c) => c.competitorName).join(', ');
    parts.push(`Core competitors: ${names}`);
  }

  if (secondaryCompetitors.length > 0) {
    const names = secondaryCompetitors.slice(0, 3).map((c) => c.competitorName).join(', ');
    parts.push(`Secondary: ${names}`);
  }

  if (alternativeCompetitors.length > 0) {
    const names = alternativeCompetitors.slice(0, 2).map((c) => c.competitorName).join(', ');
    parts.push(`Alternatives: ${names}`);
  }

  // Add differentiation insight if available
  const topThreat = coreCompetitors.find((c) => c.threatLevel && c.threatLevel > 50);
  if (topThreat?.howTheyDiffer) {
    parts.push(`Key differentiator: ${topThreat.howTheyDiffer.slice(0, 100)}`);
  }

  return parts.length > 0 ? parts.join('. ') : null;
}

/**
 * Build threat summary from competitor data
 */
function buildThreatSummary(run: CompetitionRun): string | null {
  const competitors = run.competitors || [];
  const active = competitors.filter((c) => !c.removedByUser);

  // Sort by threat level
  const byThreat = [...active].sort((a, b) => (b.threatLevel || 0) - (a.threatLevel || 0));
  const topThreats = byThreat.filter((c) => c.threatLevel && c.threatLevel > 40).slice(0, 3);

  if (topThreats.length === 0) return null;

  const parts = topThreats.map((t) => {
    const name = t.competitorName;
    const level = t.threatLevel;
    const why = t.whyThisCompetitorMatters || t.howTheyDiffer || '';
    const whyShort = why.slice(0, 80);
    return `${name} (threat: ${level}%): ${whyShort}`;
  });

  return parts.join('; ');
}

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build V4 context candidates from a Competition Lab run
 *
 * @param run - The competition run to extract from
 * @param runId - The run ID for evidence tracking
 * @returns Candidates ready for V4 proposal
 */
export function buildCompetitionCandidates(
  run: CompetitionRun | null,
  runId?: string
): BuildCompetitionCandidatesResult {
  const result: BuildCompetitionCandidatesResult = {
    extractionPath: 'competitionRun',
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
        stats: !!run.stats,
        querySummary: !!run.querySummary,
        discoveredCandidates: !!run.discoveredCandidates,
        dataConfidenceScore: run.dataConfidenceScore !== undefined,
      },
      competitorCount: competitors.length,
      hasSerpEvidence: competitors.some((c) => c.source === 'serp'),
      hasUrls: competitors.some((c) => !!c.homepageUrl),
      attemptedMappings: [],
    };

    return result;
  }

  // Build candidates
  const candidates: LabCandidate[] = [];
  const attemptedMappings: CompetitionLabDebug['attemptedMappings'] = [];
  const effectiveRunId = runId || run.id;

  // 1. competition.primaryCompetitors
  attemptedMappings.push({ fieldKey: 'competition.primaryCompetitors', attempted: true, found: false });
  const primaryCompetitors = extractPrimaryCompetitors(run);
  if (primaryCompetitors.length > 0) {
    attemptedMappings[attemptedMappings.length - 1].found = true;
    candidates.push({
      key: 'competition.primaryCompetitors',
      value: primaryCompetitors,
      confidence: 0.85, // High confidence - direct from run
      evidence: {
        rawPath: 'competitors',
        snippet: extractSnippet(primaryCompetitors.slice(0, 3)),
      },
      runCreatedAt: run.startedAt || undefined,
    });
  } else {
    attemptedMappings[attemptedMappings.length - 1].reason = 'No active competitors found';
  }

  // 2. competition.marketAlternatives
  attemptedMappings.push({ fieldKey: 'competition.marketAlternatives', attempted: true, found: false });
  const marketAlternatives = extractMarketAlternatives(run);
  if (marketAlternatives.length > 0) {
    attemptedMappings[attemptedMappings.length - 1].found = true;
    candidates.push({
      key: 'competition.marketAlternatives',
      value: marketAlternatives,
      confidence: 0.65, // Medium confidence - may be inferred
      evidence: {
        rawPath: 'competitors[role=alternative]',
        snippet: extractSnippet(marketAlternatives.slice(0, 5)),
        isInferred: true,
      },
      runCreatedAt: run.startedAt || undefined,
    });
  } else {
    attemptedMappings[attemptedMappings.length - 1].reason = 'No market alternatives found';
  }

  // 3. competition.differentiationAxes
  attemptedMappings.push({ fieldKey: 'competition.differentiationAxes', attempted: true, found: false });
  const differentiationAxes = extractDifferentiationAxes(run);
  if (differentiationAxes.length > 0) {
    attemptedMappings[attemptedMappings.length - 1].found = true;
    candidates.push({
      key: 'competition.differentiationAxes',
      value: differentiationAxes,
      confidence: 0.55, // Medium-low confidence - inferred from multiple signals
      evidence: {
        rawPath: 'competitors[].enrichedData, howTheyDiffer',
        snippet: extractSnippet(differentiationAxes),
        isInferred: true,
      },
      runCreatedAt: run.startedAt || undefined,
    });
  } else {
    attemptedMappings[attemptedMappings.length - 1].reason = 'No differentiation axes could be inferred';
  }

  // 4. competition.positioningMapSummary
  attemptedMappings.push({ fieldKey: 'competition.positioningMapSummary', attempted: true, found: false });
  const positioningMapSummary = buildPositioningMapSummary(run);
  if (positioningMapSummary) {
    attemptedMappings[attemptedMappings.length - 1].found = true;
    candidates.push({
      key: 'competition.positioningMapSummary',
      value: positioningMapSummary,
      confidence: 0.7, // Medium-high confidence - synthesized from direct data
      evidence: {
        rawPath: 'competitors[].role, howTheyDiffer',
        snippet: extractSnippet(positioningMapSummary),
      },
      runCreatedAt: run.startedAt || undefined,
    });
  } else {
    attemptedMappings[attemptedMappings.length - 1].reason = 'Could not build positioning summary';
  }

  // 5. competition.threatSummary
  attemptedMappings.push({ fieldKey: 'competition.threatSummary', attempted: true, found: false });
  const threatSummary = buildThreatSummary(run);
  if (threatSummary) {
    attemptedMappings[attemptedMappings.length - 1].found = true;
    candidates.push({
      key: 'competition.threatSummary',
      value: threatSummary,
      confidence: 0.75, // High confidence - direct threat data
      evidence: {
        rawPath: 'competitors[].threatLevel, whyThisCompetitorMatters',
        snippet: extractSnippet(threatSummary),
      },
      runCreatedAt: run.startedAt || undefined,
    });
  } else {
    attemptedMappings[attemptedMappings.length - 1].reason = 'No significant threats found';
  }

  result.candidates = candidates;

  // Add debug info if no candidates
  if (candidates.length === 0) {
    const competitors = run.competitors || [];
    result.debug = {
      rootTopKeys: result.topLevelKeys,
      samplePathsFound: {
        competitors: !!run.competitors,
        status: !!run.status,
        stats: !!run.stats,
        querySummary: !!run.querySummary,
        discoveredCandidates: !!run.discoveredCandidates,
        dataConfidenceScore: run.dataConfidenceScore !== undefined,
      },
      competitorCount: competitors.length,
      hasSerpEvidence: competitors.some((c) => c.source === 'serp'),
      hasUrls: competitors.some((c) => !!c.homepageUrl),
      attemptedMappings,
    };
    result.extractionFailureReason = 'No candidates could be extracted from competition run';
  }

  return result;
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  COMPETITION_SIGNATURE_FIELDS,
  VALID_STATUSES,
  isMeaningfulValue,
  extractSnippet,
  extractPrimaryCompetitors,
  extractMarketAlternatives,
  extractDifferentiationAxes,
  buildPositioningMapSummary,
  buildThreatSummary,
};
