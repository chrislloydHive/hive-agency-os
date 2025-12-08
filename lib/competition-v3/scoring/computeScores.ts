// lib/competition-v3/scoring/computeScores.ts
// Multi-Dimension Scoring Engine for Competition Lab V3
//
// Scores competitors on 7 dimensions:
// 1. ICP Fit
// 2. Business Model Fit
// 3. Service Overlap
// 4. Value Model Fit
// 5. ICP Stage Match
// 6. AI/Automation Orientation
// 7. Geography Fit
//
// Plus derived scores:
// - Threat Score (weighted composite)
// - Relevance Score

import type { EnrichedCandidate, QueryContext, CompetitorScores, ClassificationResult } from '../types';
import { detectBadFitSignals, getThreatScoreCap } from '../enrichment/categoryClassifier';

// ============================================================================
// Scoring Weights
// ============================================================================

interface ScoringWeights {
  icpFit: number;
  businessModelFit: number;
  serviceOverlap: number;
  valueModelFit: number;
  icpStageMatch: number;
  aiOrientation: number;
  geographyFit: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  icpFit: 0.20,
  businessModelFit: 0.15,
  serviceOverlap: 0.20,
  valueModelFit: 0.15,
  icpStageMatch: 0.10,
  aiOrientation: 0.10,
  geographyFit: 0.10,
};

// Threat score weights by competitor type
const THREAT_WEIGHTS: Record<string, ScoringWeights> = {
  direct: {
    icpFit: 0.25,
    businessModelFit: 0.20,
    serviceOverlap: 0.25,
    valueModelFit: 0.10,
    icpStageMatch: 0.10,
    aiOrientation: 0.05,
    geographyFit: 0.05,
  },
  partial: {
    icpFit: 0.25,
    businessModelFit: 0.15,
    serviceOverlap: 0.20,
    valueModelFit: 0.15,
    icpStageMatch: 0.10,
    aiOrientation: 0.10,
    geographyFit: 0.05,
  },
  fractional: {
    icpFit: 0.30,
    businessModelFit: 0.10,
    serviceOverlap: 0.15,
    valueModelFit: 0.20,
    icpStageMatch: 0.15,
    aiOrientation: 0.05,
    geographyFit: 0.05,
  },
  platform: {
    icpFit: 0.15,
    businessModelFit: 0.10,
    serviceOverlap: 0.30,
    valueModelFit: 0.20,
    icpStageMatch: 0.10,
    aiOrientation: 0.10,
    geographyFit: 0.05,
  },
  internal: {
    icpFit: 0.20,
    businessModelFit: 0.05,
    serviceOverlap: 0.25,
    valueModelFit: 0.20,
    icpStageMatch: 0.15,
    aiOrientation: 0.10,
    geographyFit: 0.05,
  },
};

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Score all candidates
 */
export function scoreCompetitors(
  candidates: Array<EnrichedCandidate & { classification: ClassificationResult }>,
  context: QueryContext
): Array<EnrichedCandidate & { classification: ClassificationResult; scores: CompetitorScores }> {
  console.log(`[competition-v3/scoring] Scoring ${candidates.length} candidates`);

  return candidates.map(candidate => {
    const scores = computeScores(candidate, context);
    return { ...candidate, scores };
  });
}

/**
 * Compute all scores for a candidate
 */
function computeScores(
  candidate: EnrichedCandidate & { classification: ClassificationResult },
  context: QueryContext
): CompetitorScores {
  const similarity = candidate.semanticSimilarity;
  const metadata = candidate.metadata;
  const classification = candidate.classification;

  // Compute individual dimension scores
  const icpFit = computeICPFit(candidate, context, similarity);
  const businessModelFit = computeBusinessModelFit(metadata, context);
  const serviceOverlap = computeServiceOverlap(candidate, context, similarity);
  const valueModelFit = computeValueModelFit(candidate, context, similarity);
  const icpStageMatch = computeICPStageMatch(candidate, context);
  const aiOrientation = computeAIOrientation(metadata, context);
  const geographyFit = computeGeographyFit(metadata, context);

  // Compute threat score using V3.5 signals when available
  let threatScore: number;
  if (candidate.offerOverlapScore !== undefined && candidate.jtbdMatches !== undefined) {
    const offerOverlap = candidate.offerOverlapScore ?? 0;
    const jtbd = candidate.jtbdMatches ?? 0;
    const geoScore = candidate.geoScore ?? 0.4;
    threatScore = Math.round(
      ((offerOverlap * 0.5) + (jtbd * 0.3) + (geoScore * 0.2)) * 100
    );
  } else {
    // Fallback to older realistic threat score
    threatScore = computeRealisticThreatScore(
      { icpFit, valueModelFit, serviceOverlap },
      classification.type
    );
  }

  // Apply caps based on bad-fit signals
  const badFitSignals = detectBadFitSignals(candidate, context);
  const threatCap = getThreatScoreCap(badFitSignals);
  let threatNotes = `Type: ${classification.type}, Confidence: ${(classification.confidence * 100).toFixed(0)}%`;

  if (threatCap !== null) {
    threatScore = Math.min(threatScore, threatCap);
    threatNotes += ` [Capped at ${threatCap}]`;
  }

  // Compute relevance score (how relevant is this as a competitor)
  const relevanceScore = computeRelevanceScore(candidate, classification, threatScore);

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
    scoringNotes: {
      icpNotes: null,
      businessModelNotes: null,
      serviceNotes: null,
      valueModelNotes: null,
      threatNotes,
    },
  };
}

// ============================================================================
// Realistic Threat Scoring
// ============================================================================

/**
 * Compute realistic threat score using geometric mean approach
 *
 * This punishes low values in any dimension - a competitor needs
 * good ICP fit, value model fit, AND service overlap to be a real threat.
 */
function computeRealisticThreatScore(
  coreScores: { icpFit: number; valueModelFit: number; serviceOverlap: number },
  competitorType: string
): number {
  const { icpFit, valueModelFit, serviceOverlap } = coreScores;

  // Use geometric-ish mean that punishes low values
  // Formula: cbrt(icpFit * valueModelFit * serviceOverlap) normalized to 0-100
  const product = Math.max(1, icpFit) * Math.max(1, valueModelFit) * Math.max(1, serviceOverlap);
  let threat = Math.pow(product / 1_000_000, 1/3) * 100;

  // Apply type-specific caps
  switch (competitorType) {
    case 'platform':
      // Platforms are alternatives, not primary threats
      threat = Math.min(threat, 55);
      break;
    case 'internal':
      // Internal hire is an alternative path, not same market
      threat = Math.min(threat, 65);
      break;
    case 'fractional':
      // Fractional competes for budget but different model
      threat = Math.min(threat, 75);
      break;
    case 'partial':
      // Partial overlap means not fully competing
      threat = Math.min(threat, 85);
      break;
    // 'direct' has no cap - can reach 100
  }

  // Clamp to 0-100
  return Math.round(Math.max(0, Math.min(100, threat)));
}

// ============================================================================
// Individual Dimension Scoring
// ============================================================================

/**
 * Compute ICP Fit score (0-100)
 */
function computeICPFit(
  candidate: EnrichedCandidate,
  context: QueryContext,
  similarity: EnrichedCandidate['semanticSimilarity']
): number {
  // Use semantic similarity if available
  if (similarity?.icpSimilarity) {
    return Math.round(similarity.icpSimilarity * 100);
  }

  // Fallback: rule-based scoring
  let score = 50; // Base score

  const content = candidate.crawledContent;
  if (!content) return score;

  // Check for ICP keywords
  const icpKeywords = extractICPKeywords(context.icpDescription);
  const candidateText = [
    content.homepage.description,
    ...content.industries,
    ...content.services.offerings,
  ].join(' ').toLowerCase();

  for (const keyword of icpKeywords) {
    if (candidateText.includes(keyword.toLowerCase())) {
      score += 10;
    }
  }

  // Check industry overlap
  if (context.targetIndustries.length > 0 && content.industries.length > 0) {
    const overlap = context.targetIndustries.filter(i =>
      content.industries.some(ci => ci.toLowerCase().includes(i.toLowerCase()))
    );
    score += overlap.length * 15;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Compute Business Model Fit score (0-100)
 */
function computeBusinessModelFit(
  metadata: EnrichedCandidate['metadata'],
  context: QueryContext
): number {
  if (!metadata?.businessModel || !context.businessModel) {
    return 50; // Unknown - neutral score
  }

  const targetModel = context.businessModel.toLowerCase();
  const candidateModel = metadata.businessModel.toLowerCase();

  // Direct match
  if (targetModel === candidateModel) return 90;

  // Similar models
  const agencyTypes = ['agency', 'studio', 'firm'];
  const consultancyTypes = ['consultancy', 'consulting', 'advisory'];

  const isTargetAgency = agencyTypes.some(t => targetModel.includes(t));
  const isCandidateAgency = agencyTypes.some(t => candidateModel.includes(t));

  const isTargetConsultancy = consultancyTypes.some(t => targetModel.includes(t));
  const isCandidateConsultancy = consultancyTypes.some(t => candidateModel.includes(t));

  if (isTargetAgency && isCandidateAgency) return 85;
  if (isTargetConsultancy && isCandidateConsultancy) return 85;
  if ((isTargetAgency && isCandidateConsultancy) || (isTargetConsultancy && isCandidateAgency)) return 70;

  // SaaS vs service
  if (candidateModel === 'saas' && (isTargetAgency || isTargetConsultancy)) return 40;

  return 50;
}

/**
 * Compute Service Overlap score (0-100)
 */
function computeServiceOverlap(
  candidate: EnrichedCandidate,
  context: QueryContext,
  similarity: EnrichedCandidate['semanticSimilarity']
): number {
  // Use semantic similarity if available
  if (similarity?.offeringSimilarity) {
    return Math.round(similarity.offeringSimilarity * 100);
  }

  // Fallback: keyword matching
  if (context.primaryOffers.length === 0) return 50;

  const candidateServices = candidate.crawledContent?.services?.offerings || [];
  const candidateKeywords = candidate.crawledContent?.services?.keywords || [];
  const allCandidateServices = [...candidateServices, ...candidateKeywords].map(s => s.toLowerCase());

  if (allCandidateServices.length === 0) return 40;

  // Count overlapping services
  let matches = 0;
  for (const offer of context.primaryOffers) {
    const offerWords = offer.toLowerCase().split(/\s+/);
    for (const word of offerWords) {
      if (word.length > 3 && allCandidateServices.some(s => s.includes(word))) {
        matches++;
        break;
      }
    }
  }

  const overlapRatio = matches / context.primaryOffers.length;
  return Math.round(30 + overlapRatio * 60); // Range: 30-90
}

/**
 * Compute Value Model Fit score (0-100)
 */
function computeValueModelFit(
  candidate: EnrichedCandidate,
  context: QueryContext,
  similarity: EnrichedCandidate['semanticSimilarity']
): number {
  // Use semantic similarity if available
  if (similarity?.valueModelSimilarity) {
    return Math.round(similarity.valueModelSimilarity * 100);
  }

  // Fallback: AI orientation and positioning comparison
  let score = 50;

  const metadata = candidate.metadata;
  if (!metadata) return score;

  // AI orientation match
  if (context.aiOrientation) {
    if (context.aiOrientation === 'ai-first' && metadata.hasAICapabilities) {
      score += 20;
    } else if (context.aiOrientation === 'traditional' && !metadata.hasAICapabilities) {
      score += 15;
    }
  }

  // Service model match
  if (context.serviceModel && metadata.serviceModel) {
    if (context.serviceModel === metadata.serviceModel) {
      score += 15;
    }
  }

  // Pricing tier match
  if (context.pricePositioning && metadata.pricingTier) {
    if (context.pricePositioning.toLowerCase().includes(metadata.pricingTier)) {
      score += 15;
    }
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Compute ICP Stage Match score (0-100)
 */
function computeICPStageMatch(
  candidate: EnrichedCandidate,
  context: QueryContext
): number {
  if (!context.icpStage) return 50;

  const candidateText = [
    candidate.aiSummary,
    candidate.snippet,
    candidate.crawledContent?.homepage.description,
  ].filter(Boolean).join(' ').toLowerCase();

  const stageKeywords: Record<string, string[]> = {
    startup: ['startup', 'early-stage', 'seed', 'pre-seed', 'founder', 'bootstrap'],
    growth: ['growth', 'scale', 'scaling', 'series', 'growth-stage', 'expanding'],
    'mid-market': ['mid-market', 'smb', 'small business', 'medium business'],
    enterprise: ['enterprise', 'large', 'fortune', 'global', 'multinational'],
  };

  const targetKeywords = stageKeywords[context.icpStage] || [];

  // Count matches
  let matches = 0;
  for (const keyword of targetKeywords) {
    if (candidateText.includes(keyword)) {
      matches++;
    }
  }

  // Score based on matches
  if (matches >= 3) return 90;
  if (matches >= 2) return 75;
  if (matches >= 1) return 60;
  return 40;
}

/**
 * Compute AI/Automation Orientation score (0-100)
 */
function computeAIOrientation(
  metadata: EnrichedCandidate['metadata'],
  context: QueryContext
): number {
  if (!metadata) return 50;

  // If target is AI-oriented, score candidates with AI higher
  if (context.aiOrientation === 'ai-first' || context.aiOrientation === 'ai-augmented') {
    if (metadata.hasAICapabilities && metadata.hasAutomation) return 90;
    if (metadata.hasAICapabilities) return 75;
    if (metadata.hasAutomation) return 60;
    return 30;
  }

  // If target is traditional, score candidates similarly
  if (context.aiOrientation === 'traditional') {
    if (!metadata.hasAICapabilities && !metadata.hasAutomation) return 80;
    if (metadata.hasAICapabilities) return 50;
    return 60;
  }

  // Unknown orientation - neutral scoring
  return 50;
}

/**
 * Compute Geography Fit score (0-100)
 */
function computeGeographyFit(
  metadata: EnrichedCandidate['metadata'],
  context: QueryContext
): number {
  if (!context.geography && context.serviceRegions.length === 0) {
    return 50; // No geographic focus - neutral
  }

  if (!metadata?.headquarters && metadata?.serviceRegions.length === 0) {
    return 50; // Unknown geography
  }

  const candidateRegions = [
    metadata?.headquarters,
    ...(metadata?.serviceRegions || []),
  ].filter(Boolean).map(r => r!.toLowerCase());

  const targetRegions = [
    context.geography,
    ...context.serviceRegions,
  ].filter(Boolean).map(r => r!.toLowerCase());

  // Check for overlap
  for (const candidateRegion of candidateRegions) {
    for (const targetRegion of targetRegions) {
      if (candidateRegion.includes(targetRegion) || targetRegion.includes(candidateRegion)) {
        return 85;
      }
    }
  }

  // Check for same country/major region
  const countries = ['us', 'usa', 'united states', 'uk', 'canada', 'australia'];
  for (const country of countries) {
    const candidateHas = candidateRegions.some(r => r.includes(country));
    const targetHas = targetRegions.some(r => r.includes(country));
    if (candidateHas && targetHas) {
      return 70;
    }
  }

  return 40; // Different geography
}

// ============================================================================
// Composite Scoring
// ============================================================================

/**
 * Compute weighted composite score
 */
function computeWeightedScore(
  scores: Record<string, number>,
  weights: ScoringWeights
): number {
  let total = 0;
  let weightSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const score = scores[key];
    if (typeof score === 'number') {
      total += score * weight;
      weightSum += weight;
    }
  }

  return weightSum > 0 ? Math.round(total / weightSum) : 50;
}

/**
 * Compute relevance score
 */
function computeRelevanceScore(
  candidate: EnrichedCandidate,
  classification: ClassificationResult,
  threatScore: number
): number {
  if (threatScore < 20) return 5;
  // Base relevance from classification confidence
  let score = classification.confidence * 60;

  // Add threat score influence
  score += threatScore * 0.3;

  // Boost for higher-frequency discoveries
  if (candidate.frequency > 1) {
    score += Math.min(10, candidate.frequency * 3);
  }

  // Boost for directory presence
  if (candidate.directoryRating) {
    score += 5;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract ICP keywords from description
 */
function extractICPKeywords(icpDescription: string | null): string[] {
  if (!icpDescription) return [];

  // Extract meaningful words
  const words = icpDescription
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Filter common words
  const stopWords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'their', 'they', 'what', 'when', 'which', 'about', 'more', 'into', 'some', 'than']);
  return words.filter(w => !stopWords.has(w)).slice(0, 10);
}
