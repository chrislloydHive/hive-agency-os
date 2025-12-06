// lib/competition/types.ts
// Competition Lab v2 - Core Type Definitions
//
// Defines the data model for competitor discovery, scoring, and classification.

import { z } from 'zod';

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

  // Role classification
  role: CompetitorRole,

  // Similarity scores (0-100)
  overallScore: z.number().min(0).max(100),
  offerSimilarity: z.number().min(0).max(100),
  audienceSimilarity: z.number().min(0).max(100),
  geoOverlap: z.number().min(0).max(100),
  priceTierOverlap: z.number().min(0).max(100),

  // Brand scale
  brandScale: BrandScale.nullable(),

  // Enriched data
  enrichedData: EnrichedCompetitorData,

  // Provenance
  provenance: CompetitorProvenance,

  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string().nullable().default(null),

  // Position for visualization (assigned after scoring)
  xPosition: z.number().min(-100).max(100).nullable().default(null),
  yPosition: z.number().min(-100).max(100).nullable().default(null),

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

  // Configuration
  contextSnapshotId: z.string().nullable().default(null),
  querySet: z.object({
    brandQueries: z.array(z.string()).default([]),
    categoryQueries: z.array(z.string()).default([]),
    geoQueries: z.array(z.string()).default([]),
    marketplaceQueries: z.array(z.string()).default([]),
  }).default({}),
  modelVersion: z.string().default('v2'),

  // Results
  competitors: z.array(ScoredCompetitor).default([]),

  // Stats
  candidatesDiscovered: z.number().default(0),
  candidatesEnriched: z.number().default(0),
  candidatesScored: z.number().default(0),

  // Data confidence
  dataConfidenceScore: z.number().min(0).max(100).default(0),

  // Errors
  errors: z.array(z.string()).default([]),
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
  priceTier: PriceTier | null;
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
