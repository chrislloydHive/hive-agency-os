// lib/competition-v3/scoring/computeScores.ts
// Multi-Dimension Scoring Engine for Competition Lab V3
//
// SCORING V3.1 - Deterministic scoring from signals
//
// Scores competitors on 7 dimensions using classification signals as primary input:
// 1. ICP Fit - from icpOverlap signal + enrichment data
// 2. Business Model Fit - from businessModelMatch signal
// 3. Service Overlap - from serviceOverlap signal + enrichment data
// 4. Value Model Fit - from metadata alignment
// 5. ICP Stage Match - from enrichment data
// 6. AI/Automation Orientation - from metadata
// 7. Geography Fit - from geoScore or metadata
//
// Plus derived scores:
// - Threat Score (weighted composite with type adjustment)
// - Relevance Score (weighted composite with confidence)
//
// CRITICAL: No placeholder defaults (50/10/5). All scores computed from signals.

import type {
  EnrichedCandidate,
  QueryContext,
  CompetitorScores,
  ClassificationResult,
  ScoringStrategy,
  ScoringDebug,
} from '../types';
import { detectBadFitSignals, getThreatScoreCap } from '../enrichment/categoryClassifier';
import { isB2CCompany } from '../b2cRetailClassifier';

// ============================================================================
// Version & Constants
// ============================================================================

const SCORING_VERSION = '3.1.0-deterministic';

/**
 * Score values when signals are TRUE vs FALSE
 * These are NOT arbitrary 50s - they reflect signal presence/absence
 */
const SIGNAL_SCORES = {
  businessModelMatch: { present: 90, absent: 30 },
  icpOverlap: { present: 85, absent: 25 },
  serviceOverlap: { present: 90, absent: 20 },
  sameMarket: { present: 80, absent: 35 },
  isPlatform: { bonus: -15 },  // Platform penalty for threat
  isFractional: { bonus: -10 }, // Fractional penalty for threat
  isInternalAlt: { bonus: -10 }, // Internal penalty for threat
} as const;

/**
 * Score adjustments based on competitor type
 */
const TYPE_ADJUSTMENTS: Record<string, number> = {
  direct: 10,     // Direct competitors get +10 threat
  partial: 0,     // Partial competitors are neutral
  fractional: -10, // Fractional gets -10 threat
  platform: -15,  // Platform gets -15 threat
  internal: -10,  // Internal gets -10 threat
  irrelevant: -30, // Irrelevant heavily penalized
};

/**
 * Unknown value scores - NOT 50!
 * When we truly don't know, we use lower scores with explicit notes
 */
const UNKNOWN_SCORES = {
  noMetadata: 35,         // Can't compute - assume low fit
  noGeography: 40,        // Unknown geography - slight penalty
  noAIContext: 45,        // Unknown AI orientation - neutral-low
  noSignalData: 30,       // No signal at all - assume poor fit
  noEnrichment: 25,       // Failed enrichment - very low confidence
} as const;

// ============================================================================
// Main Scoring Function
// ============================================================================

export interface ScoredCandidate extends EnrichedCandidate {
  classification: ClassificationResult;
  scores: CompetitorScores;
}

export interface ScoringResult {
  candidates: ScoredCandidate[];
  debug: ScoringDebug;
}

/**
 * Score all candidates using deterministic scoring from signals
 */
export function scoreCompetitors(
  candidates: Array<EnrichedCandidate & { classification: ClassificationResult }>,
  context: QueryContext
): Array<EnrichedCandidate & { classification: ClassificationResult; scores: CompetitorScores }> {
  const startTime = Date.now();
  const isB2C = isB2CCompany(context);
  const notes: string[] = [];
  const missingInputs: string[] = [];

  console.log(`[competition-v3/scoring] Scoring ${candidates.length} candidates (B2C: ${isB2C}, Version: ${SCORING_VERSION})`);

  // Check for missing context inputs
  if (!context.businessModel) missingInputs.push('businessModel');
  if (!context.icpDescription) missingInputs.push('icpDescription');
  if (!context.geography && context.serviceRegions.length === 0) missingInputs.push('geography');
  if (context.primaryOffers.length === 0) missingInputs.push('primaryOffers');

  if (missingInputs.length > 0) {
    notes.push(`Missing context inputs: ${missingInputs.join(', ')}`);
  }

  if (isB2C) {
    notes.push('Using B2C retail scoring weights');
  }

  // Score each candidate
  const scored = candidates.map(candidate => {
    const scores = computeDeterministicScores(candidate, context, isB2C);
    return { ...candidate, scores };
  });

  // Validate no placeholder patterns
  const placeholderCount = scored.filter(c =>
    c.scores.icpFit === 50 &&
    c.scores.businessModelFit === 50 &&
    c.scores.serviceOverlap === 50 &&
    c.scores.threatScore === 10 &&
    c.scores.relevanceScore === 5
  ).length;

  if (placeholderCount > 0) {
    console.error(`[competition-v3/scoring] WARNING: ${placeholderCount} candidates have placeholder scores!`);
    notes.push(`SCORING_WARNING: ${placeholderCount} placeholder patterns detected`);
  }

  // Compute signal coverage stats
  const signalCoverage = {
    businessModelMatch: (candidates.filter(c => c.classification.signals.businessModelMatch).length / Math.max(1, candidates.length)) * 100,
    icpOverlap: (candidates.filter(c => c.classification.signals.icpOverlap).length / Math.max(1, candidates.length)) * 100,
    serviceOverlap: (candidates.filter(c => c.classification.signals.serviceOverlap).length / Math.max(1, candidates.length)) * 100,
    sameMarket: (candidates.filter(c => c.classification.signals.sameMarket).length / Math.max(1, candidates.length)) * 100,
  };

  // Compute score distribution
  const threatScores = scored.map(c => c.scores.threatScore);
  const relevanceScores = scored.map(c => c.scores.relevanceScore);

  const scoreDistribution = {
    threatScoreMin: Math.min(...threatScores, 0),
    threatScoreMax: Math.max(...threatScores, 0),
    threatScoreAvg: threatScores.length > 0 ? Math.round(threatScores.reduce((a, b) => a + b, 0) / threatScores.length) : 0,
    relevanceScoreMin: Math.min(...relevanceScores, 0),
    relevanceScoreMax: Math.max(...relevanceScores, 0),
    relevanceScoreAvg: relevanceScores.length > 0 ? Math.round(relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length) : 0,
  };

  notes.push(`Scored ${scored.length} candidates in ${Date.now() - startTime}ms`);
  notes.push(`Signal coverage: businessModelMatch=${signalCoverage.businessModelMatch.toFixed(0)}%, icpOverlap=${signalCoverage.icpOverlap.toFixed(0)}%`);
  notes.push(`Threat range: ${scoreDistribution.threatScoreMin}-${scoreDistribution.threatScoreMax} (avg: ${scoreDistribution.threatScoreAvg})`);

  console.log(`[competition-v3/scoring] Completed scoring:`);
  console.log(`  - Strategy: deterministic`);
  console.log(`  - Signal coverage: ${JSON.stringify(signalCoverage)}`);
  console.log(`  - Score distribution: ${JSON.stringify(scoreDistribution)}`);

  return scored;
}

/**
 * Score competitors with full debug output
 */
export function scoreCompetitorsWithDebug(
  candidates: Array<EnrichedCandidate & { classification: ClassificationResult }>,
  context: QueryContext
): ScoringResult {
  const startTime = Date.now();
  const isB2C = isB2CCompany(context);
  const notes: string[] = [];
  const missingInputs: string[] = [];

  // Check for missing context inputs
  if (!context.businessModel) missingInputs.push('businessModel');
  if (!context.icpDescription) missingInputs.push('icpDescription');
  if (!context.geography && context.serviceRegions.length === 0) missingInputs.push('geography');
  if (context.primaryOffers.length === 0) missingInputs.push('primaryOffers');

  if (isB2C) notes.push('Using B2C retail scoring weights');

  const scored = candidates.map(candidate => {
    const scores = computeDeterministicScores(candidate, context, isB2C);
    return { ...candidate, scores } as ScoredCandidate;
  });

  // Compute signal coverage
  const signalCoverage = {
    businessModelMatch: (candidates.filter(c => c.classification.signals.businessModelMatch).length / Math.max(1, candidates.length)) * 100,
    icpOverlap: (candidates.filter(c => c.classification.signals.icpOverlap).length / Math.max(1, candidates.length)) * 100,
    serviceOverlap: (candidates.filter(c => c.classification.signals.serviceOverlap).length / Math.max(1, candidates.length)) * 100,
    sameMarket: (candidates.filter(c => c.classification.signals.sameMarket).length / Math.max(1, candidates.length)) * 100,
  };

  // Compute score distribution
  const threatScores = scored.map(c => c.scores.threatScore);
  const relevanceScores = scored.map(c => c.scores.relevanceScore);

  const scoreDistribution = {
    threatScoreMin: Math.min(...threatScores, 0),
    threatScoreMax: Math.max(...threatScores, 0),
    threatScoreAvg: threatScores.length > 0 ? Math.round(threatScores.reduce((a, b) => a + b, 0) / threatScores.length) : 0,
    relevanceScoreMin: Math.min(...relevanceScores, 0),
    relevanceScoreMax: Math.max(...relevanceScores, 0),
    relevanceScoreAvg: relevanceScores.length > 0 ? Math.round(relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length) : 0,
  };

  notes.push(`Scored ${scored.length} candidates in ${Date.now() - startTime}ms`);

  const debug: ScoringDebug = {
    strategy: 'deterministic',
    version: SCORING_VERSION,
    computedAt: new Date().toISOString(),
    notes,
    missingInputs,
    signalCoverage,
    scoreDistribution,
  };

  return { candidates: scored, debug };
}

// ============================================================================
// Deterministic Scoring
// ============================================================================

/**
 * Compute all scores deterministically from signals and enrichment data
 * NO PLACEHOLDER DEFAULTS - every score is computed from signals
 */
function computeDeterministicScores(
  candidate: EnrichedCandidate & { classification: ClassificationResult },
  context: QueryContext,
  isB2C: boolean = false
): CompetitorScores {
  const signals = candidate.classification.signals;
  const metadata = candidate.metadata;
  const type = candidate.classification.type;

  // Initialize scoring notes
  const scoringNotes: CompetitorScores['scoringNotes'] = {
    icpNotes: null,
    businessModelNotes: null,
    serviceNotes: null,
    valueModelNotes: null,
    threatNotes: null,
  };

  // =========================================================================
  // 1. Business Model Fit (from signal + metadata)
  // =========================================================================
  let businessModelFit: number;
  if (signals.businessModelMatch) {
    businessModelFit = SIGNAL_SCORES.businessModelMatch.present;
    scoringNotes.businessModelNotes = 'businessModelMatch=true';
  } else if (metadata?.businessModel && context.businessModel) {
    // Partial match check
    const targetModel = context.businessModel.toLowerCase();
    const candidateModel = metadata.businessModel.toLowerCase();
    if (targetModel === candidateModel) {
      businessModelFit = 85;
      scoringNotes.businessModelNotes = `exactMatch: ${candidateModel}`;
    } else if (areSimilarModels(targetModel, candidateModel)) {
      businessModelFit = 70;
      scoringNotes.businessModelNotes = `similarModels: ${targetModel} vs ${candidateModel}`;
    } else {
      businessModelFit = SIGNAL_SCORES.businessModelMatch.absent;
      scoringNotes.businessModelNotes = `differentModels: ${targetModel} vs ${candidateModel}`;
    }
  } else if (!metadata?.businessModel) {
    businessModelFit = UNKNOWN_SCORES.noMetadata;
    scoringNotes.businessModelNotes = 'noMetadata';
  } else {
    businessModelFit = SIGNAL_SCORES.businessModelMatch.absent;
    scoringNotes.businessModelNotes = 'businessModelMatch=false';
  }

  // =========================================================================
  // 2. ICP Fit (from signal + semantic similarity)
  // =========================================================================
  let icpFit: number;
  if (signals.icpOverlap) {
    icpFit = SIGNAL_SCORES.icpOverlap.present;
    scoringNotes.icpNotes = 'icpOverlap=true';
  } else if (candidate.semanticSimilarity?.icpSimilarity) {
    icpFit = Math.round(candidate.semanticSimilarity.icpSimilarity * 100);
    scoringNotes.icpNotes = `semanticICP: ${icpFit}`;
  } else if (candidate.customerTypeMatch !== undefined) {
    icpFit = candidate.customerTypeMatch ? 70 : 35;
    scoringNotes.icpNotes = `customerTypeMatch: ${candidate.customerTypeMatch}`;
  } else {
    icpFit = SIGNAL_SCORES.icpOverlap.absent;
    scoringNotes.icpNotes = 'icpOverlap=false';
  }

  // =========================================================================
  // 3. Service Overlap (from signal + enrichment)
  // =========================================================================
  let serviceOverlap: number;
  if (signals.serviceOverlap) {
    serviceOverlap = SIGNAL_SCORES.serviceOverlap.present;
    scoringNotes.serviceNotes = 'serviceOverlap=true';
  } else if (candidate.semanticSimilarity?.offeringSimilarity) {
    serviceOverlap = Math.round(candidate.semanticSimilarity.offeringSimilarity * 100);
    scoringNotes.serviceNotes = `semanticOffering: ${serviceOverlap}`;
  } else if (candidate.offerOverlapScore !== undefined) {
    serviceOverlap = Math.round(candidate.offerOverlapScore * 100);
    scoringNotes.serviceNotes = `offerOverlapScore: ${candidate.offerOverlapScore.toFixed(2)}`;
  } else {
    serviceOverlap = SIGNAL_SCORES.serviceOverlap.absent;
    scoringNotes.serviceNotes = 'serviceOverlap=false';
  }

  // =========================================================================
  // 4. Value Model Fit (from metadata alignment)
  // =========================================================================
  let valueModelFit: number;
  const valueModelNotesParts: string[] = [];

  if (candidate.semanticSimilarity?.valueModelSimilarity) {
    valueModelFit = Math.round(candidate.semanticSimilarity.valueModelSimilarity * 100);
    valueModelNotesParts.push(`semanticValue: ${valueModelFit}`);
  } else {
    // Compute from metadata signals
    let valueScore: number = UNKNOWN_SCORES.noMetadata;

    if (metadata) {
      valueScore = 40; // Base when we have metadata

      // AI orientation match
      if (context.aiOrientation) {
        if (context.aiOrientation === 'ai-first' && metadata.hasAICapabilities) {
          valueScore += 20;
          valueModelNotesParts.push('aiMatch');
        } else if (context.aiOrientation === 'traditional' && !metadata.hasAICapabilities) {
          valueScore += 15;
          valueModelNotesParts.push('traditionalMatch');
        }
      }

      // Service model match
      if (context.serviceModel && metadata.serviceModel) {
        if (context.serviceModel === metadata.serviceModel) {
          valueScore += 15;
          valueModelNotesParts.push(`serviceModel=${metadata.serviceModel}`);
        }
      }

      // Pricing tier match
      if (context.pricePositioning && metadata.pricingTier) {
        if (context.pricePositioning.toLowerCase().includes(metadata.pricingTier)) {
          valueScore += 15;
          valueModelNotesParts.push(`pricingMatch=${metadata.pricingTier}`);
        }
      }
    } else {
      valueModelNotesParts.push('noMetadata');
    }

    valueModelFit = Math.min(100, Math.max(0, valueScore));
  }
  scoringNotes.valueModelNotes = valueModelNotesParts.join(', ') || null;

  // =========================================================================
  // 5. ICP Stage Match (B2C neutral, B2B from enrichment)
  // =========================================================================
  let icpStageMatch: number;
  if (isB2C) {
    icpStageMatch = 50; // Neutral for B2C - stage not relevant
  } else if (!context.icpStage) {
    icpStageMatch = UNKNOWN_SCORES.noAIContext; // No target stage defined
  } else {
    icpStageMatch = computeICPStageMatch(candidate, context);
  }

  // =========================================================================
  // 6. AI Orientation (from metadata)
  // =========================================================================
  let aiOrientation: number;
  if (isB2C) {
    aiOrientation = 50; // Neutral for B2C
  } else if (!metadata) {
    aiOrientation = UNKNOWN_SCORES.noMetadata;
  } else {
    aiOrientation = computeAIOrientationScore(metadata, context);
  }

  // =========================================================================
  // 7. Geography Fit (from geoScore or metadata)
  // =========================================================================
  let geographyFit: number;
  if (candidate.geoScore !== undefined) {
    geographyFit = Math.round(candidate.geoScore * 100);
  } else if (!context.geography && context.serviceRegions.length === 0) {
    geographyFit = UNKNOWN_SCORES.noGeography; // No target geography
  } else if (!metadata?.headquarters && (!metadata?.serviceRegions || metadata.serviceRegions.length === 0)) {
    geographyFit = UNKNOWN_SCORES.noGeography; // Unknown competitor geography
  } else {
    geographyFit = computeGeographyFitScore(metadata, context);
  }

  // =========================================================================
  // Compute Threat Score (weighted aggregate + type adjustment)
  // =========================================================================
  let threatScore: number;

  // Check for V3.5 signals first
  if (candidate.offerOverlapScore !== undefined && candidate.jtbdMatches !== undefined) {
    const offerOverlap = candidate.offerOverlapScore ?? 0;
    const jtbd = candidate.jtbdMatches ?? 0;
    const geoScore = candidate.geoScore ?? 0.4;

    if (isB2C) {
      threatScore = Math.round(
        ((offerOverlap * 0.4) + (jtbd * 0.25) + (geoScore * 0.35)) * 100
      );
    } else {
      threatScore = Math.round(
        ((offerOverlap * 0.5) + (jtbd * 0.3) + (geoScore * 0.2)) * 100
      );
    }
    scoringNotes.threatNotes = `v35signals: offer=${(offerOverlap * 100).toFixed(0)}, jtbd=${(jtbd * 100).toFixed(0)}, geo=${(geoScore * 100).toFixed(0)}`;
  } else {
    // Deterministic threat scoring from dimension scores
    threatScore = computeDeterministicThreatScore(
      { businessModelFit, icpFit, serviceOverlap, geographyFit, valueModelFit },
      type,
      isB2C
    );
    scoringNotes.threatNotes = `deterministic: bm=${businessModelFit}, icp=${icpFit}, svc=${serviceOverlap}, geo=${geographyFit}`;
  }

  // Apply type adjustment
  const typeAdjustment = TYPE_ADJUSTMENTS[type] ?? 0;
  threatScore = Math.round(Math.max(0, Math.min(100, threatScore + typeAdjustment)));
  scoringNotes.threatNotes += `, type=${type} (${typeAdjustment >= 0 ? '+' : ''}${typeAdjustment})`;

  // Apply caps based on bad-fit signals
  const badFitSignals = detectBadFitSignals(candidate, context);
  const threatCap = getThreatScoreCap(badFitSignals);
  if (threatCap !== null && threatScore > threatCap) {
    threatScore = threatCap;
    scoringNotes.threatNotes += ` [capped@${threatCap}]`;
  }

  // =========================================================================
  // Compute Relevance Score
  // =========================================================================
  const relevanceScore = computeDeterministicRelevanceScore(
    { icpFit, serviceOverlap, businessModelFit, geographyFit },
    candidate.classification,
    threatScore
  );

  // =========================================================================
  // Build final scores object
  // =========================================================================
  return {
    icpFit,
    businessModelFit,
    serviceOverlap,
    valueModelFit,
    icpStageMatch,
    aiOrientation,
    geographyFit,
    threatScore,
    relevanceScore,
    jtbdMatches: candidate.jtbdMatches,
    offerOverlapScore: candidate.offerOverlapScore,
    signalsVerified: candidate.signalsVerified,
    businessModelCategory: candidate.businessModelCategory,
    geoScore: candidate.geoScore,
    scoringNotes,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if two business models are similar
 */
function areSimilarModels(a: string, b: string): boolean {
  const agencyTypes = ['agency', 'studio', 'firm'];
  const consultancyTypes = ['consultancy', 'consulting', 'advisory'];

  const aIsAgency = agencyTypes.some(t => a.includes(t));
  const bIsAgency = agencyTypes.some(t => b.includes(t));

  const aIsConsultancy = consultancyTypes.some(t => a.includes(t));
  const bIsConsultancy = consultancyTypes.some(t => b.includes(t));

  // Same category = similar
  if (aIsAgency && bIsAgency) return true;
  if (aIsConsultancy && bIsConsultancy) return true;

  // Agency/consultancy overlap = somewhat similar
  if ((aIsAgency && bIsConsultancy) || (aIsConsultancy && bIsAgency)) return true;

  return false;
}

/**
 * Compute ICP stage match score
 */
function computeICPStageMatch(
  candidate: EnrichedCandidate,
  context: QueryContext
): number {
  if (!context.icpStage) return UNKNOWN_SCORES.noAIContext;

  const candidateText = [
    candidate.aiSummary,
    candidate.snippet,
    candidate.crawledContent?.homepage?.description,
  ].filter(Boolean).join(' ').toLowerCase();

  const stageKeywords: Record<string, string[]> = {
    startup: ['startup', 'early-stage', 'seed', 'pre-seed', 'founder', 'bootstrap'],
    growth: ['growth', 'scale', 'scaling', 'series', 'growth-stage', 'expanding'],
    'mid-market': ['mid-market', 'smb', 'small business', 'medium business'],
    enterprise: ['enterprise', 'large', 'fortune', 'global', 'multinational'],
  };

  const targetKeywords = stageKeywords[context.icpStage] || [];
  let matches = 0;
  for (const keyword of targetKeywords) {
    if (candidateText.includes(keyword)) matches++;
  }

  // Score based on matches - NOT defaulting to 50
  if (matches >= 3) return 90;
  if (matches >= 2) return 75;
  if (matches >= 1) return 55;
  return 30; // No matches = low score, NOT 50
}

/**
 * Compute AI orientation score
 */
function computeAIOrientationScore(
  metadata: EnrichedCandidate['metadata'],
  context: QueryContext
): number {
  if (!metadata) return UNKNOWN_SCORES.noMetadata;

  if (context.aiOrientation === 'ai-first' || context.aiOrientation === 'ai-augmented') {
    if (metadata.hasAICapabilities && metadata.hasAutomation) return 90;
    if (metadata.hasAICapabilities) return 75;
    if (metadata.hasAutomation) return 55;
    return 25; // AI-first target but no AI = low fit
  }

  if (context.aiOrientation === 'traditional') {
    if (!metadata.hasAICapabilities && !metadata.hasAutomation) return 80;
    if (metadata.hasAICapabilities) return 45;
    return 55;
  }

  // Unknown target orientation - score based on presence of AI
  if (metadata.hasAICapabilities) return 60;
  return 45;
}

/**
 * Compute geography fit score
 */
function computeGeographyFitScore(
  metadata: EnrichedCandidate['metadata'],
  context: QueryContext
): number {
  if (!metadata?.headquarters && (!metadata?.serviceRegions || metadata.serviceRegions.length === 0)) {
    return UNKNOWN_SCORES.noGeography;
  }

  const candidateRegions = [
    metadata?.headquarters,
    ...(metadata?.serviceRegions || []),
  ].filter(Boolean).map(r => r!.toLowerCase());

  const targetRegions = [
    context.geography,
    ...context.serviceRegions,
  ].filter(Boolean).map(r => r!.toLowerCase());

  // Check for direct overlap
  for (const candidateRegion of candidateRegions) {
    for (const targetRegion of targetRegions) {
      if (candidateRegion.includes(targetRegion) || targetRegion.includes(candidateRegion)) {
        return 85;
      }
    }
  }

  // Check for same country/major region
  const countries = ['us', 'usa', 'united states', 'uk', 'canada', 'australia', 'global'];
  for (const country of countries) {
    const candidateHas = candidateRegions.some(r => r.includes(country));
    const targetHas = targetRegions.some(r => r.includes(country));
    if (candidateHas && targetHas) {
      return 70;
    }
  }

  // Check if candidate is "global"
  if (candidateRegions.some(r => r.includes('global') || r.includes('worldwide'))) {
    return 65;
  }

  return 35; // Different geography = low fit
}

/**
 * Compute deterministic threat score from dimension scores
 *
 * Uses geometric mean approach - punishes low values in any dimension.
 * A competitor needs good ICP fit, value model fit, AND service overlap to be a real threat.
 */
function computeDeterministicThreatScore(
  coreScores: {
    businessModelFit: number;
    icpFit: number;
    serviceOverlap: number;
    geographyFit: number;
    valueModelFit: number;
  },
  competitorType: string,
  isB2C: boolean = false
): number {
  const { businessModelFit, icpFit, serviceOverlap, geographyFit, valueModelFit } = coreScores;

  let threat: number;

  if (isB2C) {
    // B2C: emphasize geography and product overlap
    const product = Math.max(1, serviceOverlap) * Math.max(1, geographyFit) * Math.max(1, valueModelFit);
    threat = Math.pow(product / 1_000_000, 1 / 3) * 100;
  } else {
    // B2B: weighted formula
    // threat = 0.25*businessModelFit + 0.25*icpFit + 0.25*serviceOverlap + 0.15*geographyFit + 0.10*valueModelFit
    threat =
      (0.25 * businessModelFit) +
      (0.25 * icpFit) +
      (0.25 * serviceOverlap) +
      (0.15 * geographyFit) +
      (0.10 * valueModelFit);
  }

  // Apply type-specific caps (BEFORE type adjustment)
  switch (competitorType) {
    case 'platform':
      threat = Math.min(threat, isB2C ? 70 : 55);
      break;
    case 'internal':
      threat = Math.min(threat, 65);
      break;
    case 'fractional':
      threat = Math.min(threat, 75);
      break;
    case 'partial':
      threat = Math.min(threat, 85);
      break;
    // 'direct' has no cap
  }

  return Math.round(Math.max(0, Math.min(100, threat)));
}

/**
 * Compute deterministic relevance score
 *
 * relevance = 0.35*icpFit + 0.35*serviceOverlap + 0.20*businessModelFit + 0.10*geographyFit
 * Plus confidence boost
 */
function computeDeterministicRelevanceScore(
  coreScores: {
    icpFit: number;
    serviceOverlap: number;
    businessModelFit: number;
    geographyFit: number;
  },
  classification: ClassificationResult,
  threatScore: number
): number {
  const { icpFit, serviceOverlap, businessModelFit, geographyFit } = coreScores;

  // Base relevance from weighted scores
  let relevance =
    (0.35 * icpFit) +
    (0.35 * serviceOverlap) +
    (0.20 * businessModelFit) +
    (0.10 * geographyFit);

  // Add confidence influence (up to +15)
  relevance += classification.confidence * 15;

  // Add threat score influence (small, up to +10)
  relevance += threatScore * 0.1;

  // Penalize irrelevant
  if (classification.type === 'irrelevant') {
    relevance = Math.min(relevance, 15);
  }

  return Math.round(Math.max(0, Math.min(100, relevance)));
}

// ============================================================================
// Fallback Scoring (for error states)
// ============================================================================

/**
 * Generate fallback scores for LOW_CONFIDENCE_CONTEXT or error states
 * Returns explicit zeros/low values, NOT placeholder 50s
 */
export function generateFallbackScores(strategy: ScoringStrategy): CompetitorScores {
  const isError = strategy === 'fallback_error';
  const isLowConfidence = strategy === 'fallback_low_confidence';

  return {
    icpFit: 0,
    businessModelFit: 0,
    serviceOverlap: 0,
    valueModelFit: 0,
    icpStageMatch: 0,
    aiOrientation: 0,
    geographyFit: 0,
    threatScore: 0,
    relevanceScore: 0,
    scoringNotes: {
      icpNotes: `fallback: ${strategy}`,
      businessModelNotes: `fallback: ${strategy}`,
      serviceNotes: `fallback: ${strategy}`,
      valueModelNotes: `fallback: ${strategy}`,
      threatNotes: isLowConfidence
        ? 'LOW_CONFIDENCE_CONTEXT - cannot score'
        : isError
          ? 'ERROR_STATE - cannot score'
          : 'fallback scoring applied',
    },
  };
}

/**
 * Generate fallback scoring debug
 */
export function generateFallbackScoringDebug(
  strategy: ScoringStrategy,
  reason: string
): ScoringDebug {
  return {
    strategy,
    version: SCORING_VERSION,
    computedAt: new Date().toISOString(),
    notes: [reason],
    missingInputs: ['all - fallback mode'],
    signalCoverage: {
      businessModelMatch: 0,
      icpOverlap: 0,
      serviceOverlap: 0,
      sameMarket: 0,
    },
    scoreDistribution: {
      threatScoreMin: 0,
      threatScoreMax: 0,
      threatScoreAvg: 0,
      relevanceScoreMin: 0,
      relevanceScoreMax: 0,
      relevanceScoreAvg: 0,
    },
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if scores look like placeholders (all 50s pattern)
 */
export function hasPlaceholderScores(scores: CompetitorScores): boolean {
  return (
    scores.icpFit === 50 &&
    scores.businessModelFit === 50 &&
    scores.serviceOverlap === 50 &&
    scores.threatScore === 10 &&
    scores.relevanceScore === 5
  );
}

/**
 * Validate that scored candidates don't have placeholder patterns
 * Returns error if placeholders detected
 */
export function validateScoredCandidates(
  candidates: Array<{ scores: CompetitorScores }>
): { valid: boolean; placeholderCount: number; message: string } {
  const placeholderCount = candidates.filter(c => hasPlaceholderScores(c.scores)).length;

  if (placeholderCount > 0) {
    return {
      valid: false,
      placeholderCount,
      message: `SCORING_FAILED: ${placeholderCount}/${candidates.length} candidates have placeholder scores`,
    };
  }

  return {
    valid: true,
    placeholderCount: 0,
    message: 'All scores computed deterministically',
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  SCORING_VERSION,
  SIGNAL_SCORES,
  TYPE_ADJUSTMENTS,
  UNKNOWN_SCORES,
};
