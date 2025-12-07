// lib/competition/types.ts
// Competition Lab v2 - Core Type Definitions
//
// Defines the data model for competitor discovery, scoring, and classification.
// Updated with step tracking, stats, and observable run state.

import { z } from 'zod';

// ============================================================================
// Search Source Classification
// ============================================================================

export const CompetitorSearchSource = z.enum([
  'ai_simulation', // LLM-generated competitor suggestions
  'serp',          // Real web search (future: SerpAPI/Google)
  'manual',        // User-provided competitor
]);

export type CompetitorSearchSource = z.infer<typeof CompetitorSearchSource>;

// ============================================================================
// Run Step Tracking
// ============================================================================

export const CompetitionRunStepName = z.enum([
  'loadContext',
  'generateQueries',
  'discover',
  'enrich',
  'score',
  'classify',
  'analyze',
  'position',
]);

export type CompetitionRunStepName = z.infer<typeof CompetitionRunStepName>;

export const CompetitionRunStepStatus = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
]);

export type CompetitionRunStepStatus = z.infer<typeof CompetitionRunStepStatus>;

export const CompetitionRunStep = z.object({
  name: CompetitionRunStepName,
  status: CompetitionRunStepStatus,
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  errorMessage: z.string().nullable().default(null),
});

export type CompetitionRunStep = z.infer<typeof CompetitionRunStep>;

// ============================================================================
// Run Stats
// ============================================================================

export const CompetitionRunStats = z.object({
  candidatesDiscovered: z.number().default(0),
  candidatesEnriched: z.number().default(0),
  candidatesScored: z.number().default(0),
  coreCount: z.number().default(0),
  secondaryCount: z.number().default(0),
  alternativeCount: z.number().default(0),
});

export type CompetitionRunStats = z.infer<typeof CompetitionRunStats>;

// ============================================================================
// Query Summary
// ============================================================================

export const CompetitionRunQuerySummary = z.object({
  queriesGenerated: z.array(z.string()).default([]),
  sourcesUsed: z.array(CompetitorSearchSource).default([]),
});

export type CompetitionRunQuerySummary = z.infer<typeof CompetitionRunQuerySummary>;

// ============================================================================
// Discovered Candidate (Pre-scoring)
// ============================================================================

export const DiscoveredCandidate = z.object({
  name: z.string().min(1),
  domain: z.string().nullable().default(null),
  homepageUrl: z.string().nullable().default(null),
  shortSummary: z.string().nullable().default(null),
  geo: z.string().nullable().default(null),
  priceTierGuess: z.enum(['low', 'mid', 'high']).nullable().default(null),
  source: CompetitorSearchSource,
  sourceNote: z.string().nullable().default(null),
});

export type DiscoveredCandidate = z.infer<typeof DiscoveredCandidate>;

// Schema for validating AI discovery responses
export const DiscoveredCandidatesSchema = z.array(DiscoveredCandidate).min(1);

// ============================================================================
// Competitor Role Classification
// ============================================================================

export const CompetitorRole = z.enum([
  'core',        // Direct competitors (high similarity in offer + audience)
  'secondary',   // Adjacent competitors (moderate similarity)
  'alternative', // Substitutes / alternatives (different approach, same need)
]);

export type CompetitorRole = z.infer<typeof CompetitorRole>;

// ============================================================================
// Price Tier Classification
// ============================================================================

export const PriceTierSchema = z.enum([
  'budget',
  'mid',
  'premium',
  'enterprise',
]);

export type PriceTier = z.infer<typeof PriceTierSchema>;

// ============================================================================
// Brand Scale Classification
// ============================================================================

export const BrandScale = z.enum([
  'startup',      // < 50 employees, early stage
  'smb',          // Small-medium business
  'mid_market',   // Mid-market company
  'enterprise',   // Large enterprise
  'dominant',     // Market leader / household name
]);

export type BrandScale = z.infer<typeof BrandScale>;

// ============================================================================
// Discovery Source Tracking
// ============================================================================

export const DiscoverySource = z.enum([
  'brand_query',       // "{brand} competitors"
  'category_query',    // "best {industry} companies in {location}"
  'geo_query',         // "{industry} near {city}"
  'marketplace_query', // G2/Capterra listings
  'human_provided',    // User-provided competitor
  'context_graph',     // From existing Context Graph
  'related_search',    // From search "related" results
]);

export type DiscoverySource = z.infer<typeof DiscoverySource>;

// ============================================================================
// Competitor Provenance
// ============================================================================

export const CompetitorProvenance = z.object({
  discoveredFrom: z.array(DiscoverySource).default([]),
  humanOverride: z.boolean().default(false),
  humanOverrideAt: z.string().nullable().default(null),
  removed: z.boolean().default(false),
  removedAt: z.string().nullable().default(null),
  removedReason: z.string().nullable().default(null),
  promoted: z.boolean().default(false),
  promotedAt: z.string().nullable().default(null),
});

export type CompetitorProvenance = z.infer<typeof CompetitorProvenance>;

// ============================================================================
// Enriched Competitor Data
// ============================================================================

export const EnrichedCompetitorData = z.object({
  // Basic enrichment
  companyType: z.string().nullable().default(null), // e.g., "agency", "saas", "consultancy"
  category: z.string().nullable().default(null),     // e.g., "marketing automation"
  summary: z.string().nullable().default(null),      // One-line description
  tagline: z.string().nullable().default(null),

  // Audience / ICP
  targetAudience: z.string().nullable().default(null),
  icpDescription: z.string().nullable().default(null),
  companySizeTarget: z.string().nullable().default(null), // "SMB", "Enterprise", etc.

  // Geographic
  geographicFocus: z.string().nullable().default(null),   // "US", "Global", "Regional"
  headquartersLocation: z.string().nullable().default(null),
  serviceAreas: z.array(z.string()).default([]),

  // Offers / Services
  primaryOffers: z.array(z.string()).default([]),
  uniqueFeatures: z.array(z.string()).default([]),

  // Pricing
  pricingTier: PriceTierSchema.nullable().default(null),
  pricingModel: z.string().nullable().default(null), // "subscription", "project", "retainer"
  estimatedPriceRange: z.string().nullable().default(null),

  // Brand
  brandScale: BrandScale.nullable().default(null),
  estimatedEmployees: z.number().nullable().default(null),
  foundedYear: z.number().nullable().default(null),

  // Positioning
  positioning: z.string().nullable().default(null),
  valueProposition: z.string().nullable().default(null),
  differentiators: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),

  // Channels
  primaryChannels: z.array(z.string()).default([]),

  // Social proof
  socialProof: z.array(z.string()).default([]), // Awards, certifications, notable clients

  // Raw extracted data
  rawExtract: z.record(z.unknown()).optional(),
});

export type EnrichedCompetitorData = z.infer<typeof EnrichedCompetitorData>;

// ============================================================================
// Scored Competitor
// ============================================================================

export const ScoredCompetitor = z.object({
  id: z.string(),
  competitorName: z.string(),
  competitorDomain: z.string().nullable(),
  homepageUrl: z.string().nullable().default(null),
  shortSummary: z.string().nullable().default(null),
  geo: z.string().nullable().default(null),
  priceTier: z.enum(['low', 'mid', 'high']).nullable().default(null),

  // Role classification
  role: CompetitorRole,

  // Similarity scores (0-100)
  overallScore: z.number().min(0).max(100),
  offerSimilarity: z.number().min(0).max(100),
  audienceSimilarity: z.number().min(0).max(100),
  geoOverlap: z.number().min(0).max(100),
  priceTierOverlap: z.number().min(0).max(100),
  compositeScore: z.number().min(0).max(100).default(0), // Alias for overallScore

  // Brand scale
  brandScale: BrandScale.nullable(),

  // Enriched data
  enrichedData: EnrichedCompetitorData,

  // Provenance
  provenance: CompetitorProvenance,

  // Search source tracking
  source: CompetitorSearchSource.default('ai_simulation'),
  sourceNote: z.string().nullable().default(null),

  // User actions
  removedByUser: z.boolean().default(false),
  promotedByUser: z.boolean().default(false),

  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string().nullable().default(null),

  // Position for visualization (assigned after scoring)
  xPosition: z.number().min(0).max(100).nullable().default(null),
  yPosition: z.number().min(0).max(100).nullable().default(null),

  // AI-generated analysis
  whyThisCompetitorMatters: z.string().nullable().default(null),
  howTheyDiffer: z.string().nullable().default(null),
  threatLevel: z.number().min(0).max(100).nullable().default(null),
  threatDrivers: z.array(z.string()).default([]),
});

export type ScoredCompetitor = z.infer<typeof ScoredCompetitor>;

// ============================================================================
// Competition Run
// ============================================================================

export const CompetitionRunStatus = z.enum([
  'pending',
  'discovering',
  'enriching',
  'scoring',
  'classifying',
  'completed',
  'failed',
]);

export type CompetitionRunStatus = z.infer<typeof CompetitionRunStatus>;

export const CompetitionRun = z.object({
  id: z.string(),
  companyId: z.string(),

  // Status
  status: CompetitionRunStatus,

  // Timestamps
  startedAt: z.string(),
  completedAt: z.string().nullable().default(null),
  updatedAt: z.string().default(() => new Date().toISOString()),

  // Step tracking for observability
  steps: z.array(CompetitionRunStep).default([]),

  // Configuration
  contextSnapshotId: z.string().nullable().default(null),
  querySet: z.object({
    brandQueries: z.array(z.string()).default([]),
    categoryQueries: z.array(z.string()).default([]),
    geoQueries: z.array(z.string()).default([]),
    marketplaceQueries: z.array(z.string()).default([]),
  }).default({}),
  modelVersion: z.string().default('v2'),

  // Query summary for UI display
  querySummary: CompetitionRunQuerySummary.optional(),

  // Results
  competitors: z.array(ScoredCompetitor).default([]),

  // Intermediate data
  discoveredCandidates: z.array(DiscoveredCandidate).optional(),

  // Stats (new structured format)
  stats: CompetitionRunStats.optional(),

  // Legacy stats (for backwards compatibility)
  candidatesDiscovered: z.number().default(0),
  candidatesEnriched: z.number().default(0),
  candidatesScored: z.number().default(0),

  // Data confidence
  dataConfidenceScore: z.number().min(0).max(100).default(0),

  // Error handling
  errors: z.array(z.string()).default([]),
  errorMessage: z.string().nullable().default(null),

  // Debug data (stored but not exposed to UI)
  rawAiPayloads: z.record(z.unknown()).optional(),
});

export type CompetitionRun = z.infer<typeof CompetitionRun>;

// ============================================================================
// Competition Run Result (API Response)
// ============================================================================

export interface CompetitionRunResult {
  runId: string;
  status: CompetitionRunStatus;
  competitors: ScoredCompetitor[];
  summary: CompetitionSummary;
}

export interface CompetitionSummary {
  totalDiscovered: number;
  coreCount: number;
  secondaryCount: number;
  alternativeCount: number;
  avgOfferSimilarity: number;
  avgAudienceSimilarity: number;
  topThreat: string | null;
  dataConfidence: number;
  humanOverrideCount: number;
}

// ============================================================================
// Candidate Competitor (Pre-scoring)
// ============================================================================

export interface CandidateCompetitor {
  name: string;
  domain: string | null;
  discoveredFrom: DiscoverySource[];
  rawSearchResult?: Record<string, unknown>;
}

// ============================================================================
// Target Company Context (For Scoring)
// ============================================================================

export interface TargetCompanyContext {
  companyId: string;
  businessName: string;
  domain: string | null;
  industry: string | null;
  icpDescription: string | null;
  serviceArea: string | null;
  geographicFootprint: string | null;
  revenueModel: string | null;
  marketMaturity: string | null;
  priceTier: PriceTier | SimplePriceTier | null;
  primaryOffers: string[];
  humanProvidedCompetitors: string[];
}

// ============================================================================
// User Feedback Actions
// ============================================================================

export type CompetitorFeedbackAction =
  | { type: 'remove'; competitorId: string; reason?: string }
  | { type: 'promote'; competitorId: string; toRole: CompetitorRole }
  | { type: 'add'; domain: string; name?: string };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate overall score from individual scores
 */
export function calculateOverallScore(scores: {
  offerSimilarity: number;
  audienceSimilarity: number;
  geoOverlap: number;
  priceTierOverlap: number;
}): number {
  return Math.round(
    0.35 * scores.offerSimilarity +
    0.35 * scores.audienceSimilarity +
    0.20 * scores.geoOverlap +
    0.10 * scores.priceTierOverlap
  );
}

/**
 * Classify competitor role based on scores
 */
export function classifyCompetitorRole(
  overallScore: number,
  offerSimilarity: number,
  audienceSimilarity: number,
  isHumanProvided: boolean
): CompetitorRole {
  // Human-provided competitors are always core
  if (isHumanProvided) {
    return 'core';
  }

  // Core: High overall + high offer + high audience
  if (overallScore >= 75 && offerSimilarity >= 70 && audienceSimilarity >= 70) {
    return 'core';
  }

  // Secondary: Moderate overall
  if (overallScore >= 55) {
    return 'secondary';
  }

  // Alternative: Lower similarity
  return 'alternative';
}

/**
 * Generate a unique competitor ID
 */
export function generateCompetitorId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique run ID
 */
export function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Step Management Helpers
// ============================================================================

/**
 * Create initial steps array for a new run
 */
export function createInitialSteps(): CompetitionRunStep[] {
  const stepNames: CompetitionRunStepName[] = [
    'loadContext',
    'generateQueries',
    'discover',
    'enrich',
    'score',
    'classify',
    'analyze',
    'position',
  ];
  return stepNames.map((name) => ({
    name,
    status: 'pending' as const,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
  }));
}

/**
 * Mark a step as running
 */
export function startStep(
  run: CompetitionRun,
  stepName: CompetitionRunStepName
): CompetitionRun {
  const steps = run.steps.map((step) =>
    step.name === stepName
      ? { ...step, status: 'running' as const, startedAt: new Date().toISOString() }
      : step
  );
  return { ...run, steps, updatedAt: new Date().toISOString() };
}

/**
 * Mark a step as completed
 */
export function completeStep(
  run: CompetitionRun,
  stepName: CompetitionRunStepName
): CompetitionRun {
  const steps = run.steps.map((step) =>
    step.name === stepName
      ? { ...step, status: 'completed' as const, finishedAt: new Date().toISOString() }
      : step
  );
  return { ...run, steps, updatedAt: new Date().toISOString() };
}

/**
 * Mark a step as failed
 */
export function failStep(
  run: CompetitionRun,
  stepName: CompetitionRunStepName,
  errorMessage: string
): CompetitionRun {
  const steps = run.steps.map((step) =>
    step.name === stepName
      ? { ...step, status: 'failed' as const, finishedAt: new Date().toISOString(), errorMessage }
      : step
  );
  return { ...run, steps, updatedAt: new Date().toISOString() };
}

// ============================================================================
// Domain & URL Utilities
// ============================================================================

/**
 * Normalize a URL to extract domain
 */
export function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    // Handle URLs without protocol
    const urlToProcess = url.includes('://') ? url : `https://${url}`;
    const u = new URL(urlToProcess);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    // If URL parsing fails, try to extract domain-like string
    const match = url.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
    return match ? match[0].toLowerCase() : null;
  }
}

// ============================================================================
// Price Tier Utilities
// ============================================================================

export type SimplePriceTier = 'low' | 'mid' | 'high';

/**
 * Derive price tier from text context using keyword analysis
 */
export function derivePriceTierFromText(text: string | null | undefined): SimplePriceTier | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // High tier keywords
  const highKeywords = ['premium', 'enterprise', 'luxury', 'boutique', 'exclusive', 'high-end'];
  if (highKeywords.some((k) => lower.includes(k))) return 'high';

  // Low tier keywords
  const lowKeywords = ['affordable', 'cheap', 'budget', 'low-cost', 'discount', 'free'];
  if (lowKeywords.some((k) => lower.includes(k))) return 'low';

  // Mid tier keywords (or default)
  const midKeywords = ['competitive', 'value', 'mid-range', 'standard'];
  if (midKeywords.some((k) => lower.includes(k))) return 'mid';

  return null;
}

/**
 * Resolve price tier from candidate guess or text context
 */
export function resolvePriceTier(
  candidateGuess: SimplePriceTier | null | undefined,
  textContext?: string | null
): SimplePriceTier | null {
  if (candidateGuess) return candidateGuess;
  return derivePriceTierFromText(textContext);
}

/**
 * Calculate price tier overlap score
 */
export function calculatePriceTierOverlap(
  companyTier: SimplePriceTier | null,
  competitorTier: SimplePriceTier | null
): number {
  // If either tier is unknown, return neutral score
  if (!companyTier || !competitorTier) return 50;

  // Same tier = maximum overlap
  if (companyTier === competitorTier) return 100;

  // Calculate based on tier distance
  const tiers: SimplePriceTier[] = ['low', 'mid', 'high'];
  const diff = Math.abs(tiers.indexOf(companyTier) - tiers.indexOf(competitorTier));

  // Adjacent tier = moderate overlap
  if (diff === 1) return 60;

  // Two tiers apart = low overlap
  return 20;
}

// ============================================================================
// Stats Computation
// ============================================================================

/**
 * Compute run stats from competitors
 */
export function computeRunStats(
  competitors: ScoredCompetitor[],
  discovered: number,
  enriched: number
): CompetitionRunStats {
  const activeCompetitors = competitors.filter((c) => !c.removedByUser);
  return {
    candidatesDiscovered: discovered,
    candidatesEnriched: enriched,
    candidatesScored: competitors.length,
    coreCount: activeCompetitors.filter((c) => c.role === 'core').length,
    secondaryCount: activeCompetitors.filter((c) => c.role === 'secondary').length,
    alternativeCount: activeCompetitors.filter((c) => c.role === 'alternative').length,
  };
}
