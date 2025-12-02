// lib/gap-heavy/strategicTypes.ts
// GAP Heavy Strategic Intelligence Types
//
// GAP Heavy is a multi-source strategic intelligence engine focused on:
// - Competitors and category positioning
// - Search visibility and market mapping
// - Growth opportunities and gaps
// - Strategic priorities and narratives
//
// This is NOT another diagnostic. It synthesizes multiple data sources into
// strategic priorities and "how we win" narratives. Per-dimension scores
// (website, brand, content, seo, ops) are handled by Labs, not GAP Heavy.

import { z } from 'zod';

// ============================================================================
// Competitor Analysis
// ============================================================================

/**
 * A competitor identified during GAP Heavy analysis
 */
export interface GapHeavyCompetitor {
  /** Unique identifier for this competitor */
  id: string;
  /** Competitor name */
  name: string;
  /** Competitor website URL */
  url?: string;
  /** How they are positioned in the market */
  positionSummary: string;
  /** Strengths relative to the analyzed company */
  relativeStrengths: string[];
  /** Weaknesses relative to the analyzed company */
  relativeWeaknesses: string[];
  /** Inferred marketing channels (e.g., "SEO", "Paid Search", "YouTube", "Local", "Social") */
  inferredChannels: string[];
  /** Additional notes */
  notes?: string;
}

export const GapHeavyCompetitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  positionSummary: z.string(),
  relativeStrengths: z.array(z.string()),
  relativeWeaknesses: z.array(z.string()),
  inferredChannels: z.array(z.string()),
  notes: z.string().optional(),
});

// ============================================================================
// Search Visibility Map
// ============================================================================

/**
 * Search visibility analysis vs competitors
 */
export interface GapHeavyVisibilityMap {
  /** Narrative overview of visibility vs competitors */
  summary: string;
  /** Key channels where visibility matters (e.g., "Google Search", "Local/GBP", "YouTube") */
  keyChannels: string[];
  /** Description of brand vs non-brand search split (e.g., "80% branded, 20% non-branded") */
  brandVsNonBrand: string;
  /** Coverage by search intent (e.g., "Strong on branded navigational", "Weak on category non-brand") */
  coverageByIntent: string[];
  /** Additional notes */
  notes?: string;
}

export const GapHeavyVisibilityMapSchema = z.object({
  summary: z.string(),
  keyChannels: z.array(z.string()),
  brandVsNonBrand: z.string(),
  coverageByIntent: z.array(z.string()),
  notes: z.string().optional(),
});

// ============================================================================
// Opportunities
// ============================================================================

/**
 * Category of opportunity identified
 */
export type GapHeavyOpportunityCategory =
  | 'category'   // Category/market positioning opportunities
  | 'content'    // Content gap opportunities
  | 'funnel'     // Funnel optimization opportunities
  | 'local'      // Local/GBP opportunities
  | 'social'     // Social media opportunities
  | 'brand'      // Brand positioning opportunities
  | 'other';     // Other opportunities

export const GapHeavyOpportunityCategorySchema = z.enum([
  'category',
  'content',
  'funnel',
  'local',
  'social',
  'brand',
  'other',
]);

/**
 * Expected impact level
 */
export type GapHeavyImpact = 'high' | 'medium' | 'low';

export const GapHeavyImpactSchema = z.enum(['high', 'medium', 'low']);

/**
 * Time horizon for opportunity
 */
export type GapHeavyTimeHorizon = 'near-term' | 'mid-term' | 'long-term';

export const GapHeavyTimeHorizonSchema = z.enum(['near-term', 'mid-term', 'long-term']);

/**
 * A growth opportunity identified during analysis
 */
export interface GapHeavyOpportunity {
  /** Unique identifier */
  id: string;
  /** Title (e.g., "Own 'car audio installation near me' in Seattle") */
  title: string;
  /** Category of opportunity */
  category: GapHeavyOpportunityCategory;
  /** Detailed description */
  description: string;
  /** Expected impact level */
  expectedImpact: GapHeavyImpact;
  /** Time horizon for realization */
  timeHorizon: GapHeavyTimeHorizon;
  /** References to supporting evidence */
  supportingEvidenceIds?: string[];
}

export const GapHeavyOpportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: GapHeavyOpportunityCategorySchema,
  description: z.string(),
  expectedImpact: GapHeavyImpactSchema,
  timeHorizon: GapHeavyTimeHorizonSchema,
  supportingEvidenceIds: z.array(z.string()).optional(),
});

// ============================================================================
// Funnel Gaps
// ============================================================================

/**
 * Funnel stage where gap exists
 */
export type GapHeavyFunnelStage =
  | 'awareness'
  | 'consideration'
  | 'decision'
  | 'post-purchase';

export const GapHeavyFunnelStageSchema = z.enum([
  'awareness',
  'consideration',
  'decision',
  'post-purchase',
]);

/**
 * Severity of funnel gap
 */
export type GapHeavySeverity = 'high' | 'medium' | 'low';

export const GapHeavySeveritySchema = z.enum(['high', 'medium', 'low']);

/**
 * A gap in the marketing/sales funnel
 */
export interface GapHeavyFunnelGap {
  /** Unique identifier */
  id: string;
  /** Title (e.g., "Missing comparison pages vs Best Buy and independent shops") */
  title: string;
  /** Detailed description */
  description: string;
  /** Funnel stage where gap exists */
  stage: GapHeavyFunnelStage;
  /** Severity of the gap */
  severity: GapHeavySeverity;
  /** References to supporting evidence */
  supportingEvidenceIds?: string[];
}

export const GapHeavyFunnelGapSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  stage: GapHeavyFunnelStageSchema,
  severity: GapHeavySeveritySchema,
  supportingEvidenceIds: z.array(z.string()).optional(),
});

// ============================================================================
// Local & Social Signals
// ============================================================================

/**
 * Local and social media presence signals
 */
export interface GapHeavyLocalAndSocialSignals {
  /** Overall summary of local and social presence */
  summary: string;
  /** Description of local presence (GBP, directories, etc.) */
  localPresence: string;
  /** Review positioning vs competitors */
  reviewPositioning: string;
  /** Social proof summary (followers, engagement, content frequency) */
  socialProofSummary: string;
  /** Additional notes */
  notes?: string;
}

export const GapHeavyLocalAndSocialSignalsSchema = z.object({
  summary: z.string(),
  localPresence: z.string(),
  reviewPositioning: z.string(),
  socialProofSummary: z.string(),
  notes: z.string().optional(),
});

// ============================================================================
// Strategic Priorities
// ============================================================================

/**
 * A strategic priority / big lever for growth
 */
export interface GapHeavyStrategicPriority {
  /** Unique identifier */
  id: string;
  /** Title (e.g., "Win non-branded category searches for key install queries") */
  title: string;
  /** Why this priority matters - strategic rationale */
  whyItMatters: string;
  /** Short, action-oriented bullet points for recommended plays */
  recommendedPlays: string[];
  /** Related opportunity IDs */
  relatedOpportunitiesIds?: string[];
  /** Related funnel gap IDs */
  relatedFunnelGapIds?: string[];
}

export const GapHeavyStrategicPrioritySchema = z.object({
  id: z.string(),
  title: z.string(),
  whyItMatters: z.string(),
  recommendedPlays: z.array(z.string()),
  relatedOpportunitiesIds: z.array(z.string()).optional(),
  relatedFunnelGapIds: z.array(z.string()).optional(),
});

// ============================================================================
// Evidence
// ============================================================================

/**
 * Source of evidence
 */
export type GapHeavyEvidenceSource =
  | 'search-console'
  | 'serp'
  | 'crawler'
  | 'gbp'
  | 'social'
  | 'analytics'
  | 'other';

export const GapHeavyEvidenceSourceSchema = z.enum([
  'search-console',
  'serp',
  'crawler',
  'gbp',
  'social',
  'analytics',
  'other',
]);

/**
 * A piece of evidence supporting the analysis
 */
export interface GapHeavyEvidenceItem {
  /** Unique identifier */
  id: string;
  /** Source of this evidence */
  source: GapHeavyEvidenceSource;
  /** Description of the evidence */
  description: string;
  /** URL reference if applicable */
  url?: string;
  /** Additional notes */
  notes?: string;
}

export const GapHeavyEvidenceItemSchema = z.object({
  id: z.string(),
  source: GapHeavyEvidenceSourceSchema,
  description: z.string(),
  url: z.string().optional(),
  notes: z.string().optional(),
});

// ============================================================================
// Data Confidence
// ============================================================================

/**
 * Data signals used to compute confidence score
 */
export interface GapHeavyDataSignals {
  /** Whether Google Search Console data was available */
  hasGsc: boolean;
  /** Whether SERP sampling was performed */
  hasSerpSamples: boolean;
  /** Whether site crawl was completed */
  hasCrawl: boolean;
  /** Whether Google Business Profile data was available */
  hasGbp: boolean;
  /** Whether social media data was available */
  hasSocial: boolean;
  /** Whether GA4/analytics data was available */
  hasAnalytics: boolean;
  /** Number of competitors confidently identified */
  competitorCount: number;
}

export const GapHeavyDataSignalsSchema = z.object({
  hasGsc: z.boolean(),
  hasSerpSamples: z.boolean(),
  hasCrawl: z.boolean(),
  hasGbp: z.boolean(),
  hasSocial: z.boolean(),
  hasAnalytics: z.boolean(),
  competitorCount: z.number(),
});

/**
 * Compute data confidence score from signals
 *
 * @param signals - Available data signals
 * @returns Confidence score 0-100
 */
export function computeGapHeavyConfidence(signals: GapHeavyDataSignals): number {
  let score = 0;

  // Core sources (60 points total)
  if (signals.hasGsc) score += 20;
  if (signals.hasSerpSamples) score += 20;
  if (signals.hasCrawl) score += 20;

  // Supplementary sources (30 points total)
  if (signals.hasGbp) score += 10;
  if (signals.hasSocial) score += 10;
  if (signals.hasAnalytics) score += 10;

  // Competitor identification (10 points)
  if (signals.competitorCount >= 3) score += 10;
  else if (signals.competitorCount >= 1) score += 5;

  return Math.min(100, score);
}

// ============================================================================
// Main Result Type
// ============================================================================

/**
 * GAP Heavy Strategic Intelligence Result
 *
 * This is the primary output of the GAP Heavy engine. It represents a
 * strategic competitive and opportunity analysis, NOT a diagnostic with
 * per-dimension scores (those are handled by Labs).
 *
 * Use this to understand:
 * - Who the competitors are and how they compare
 * - Where visibility gaps exist
 * - What growth opportunities are available
 * - Where funnel gaps need attention
 * - What strategic priorities to focus on
 */
export interface GapHeavyResult {
  /** Company ID this analysis is for */
  companyId: string;

  /** Data confidence score (0-100) based on available sources */
  dataConfidence: number;

  /** Signals used to compute data confidence */
  dataSignals: GapHeavyDataSignals;

  /** Competitor landscape analysis */
  competitorLandscape: GapHeavyCompetitor[];

  /** Search visibility map vs competitors */
  searchVisibilityMap: GapHeavyVisibilityMap;

  /** Category/market positioning opportunities */
  categoryOpportunities: GapHeavyOpportunity[];

  /** Content gap opportunities */
  contentOpportunities: GapHeavyOpportunity[];

  /** Funnel gaps identified */
  funnelGaps: GapHeavyFunnelGap[];

  /** Local and social presence signals */
  localAndSocialSignals: GapHeavyLocalAndSocialSignals;

  /** Strategic priorities - the big levers */
  strategicPriorities: GapHeavyStrategicPriority[];

  /** Long-form narrative: "how we win" - consultant-grade strategic narrative */
  strategistNarrative: string;

  /** Supporting evidence for all findings */
  evidence: GapHeavyEvidenceItem[];

  /** ISO timestamp of when this analysis was created */
  createdAt: string;
}

export const GapHeavyResultSchema = z.object({
  companyId: z.string(),
  dataConfidence: z.number().min(0).max(100),
  dataSignals: GapHeavyDataSignalsSchema,
  competitorLandscape: z.array(GapHeavyCompetitorSchema),
  searchVisibilityMap: GapHeavyVisibilityMapSchema,
  categoryOpportunities: z.array(GapHeavyOpportunitySchema),
  contentOpportunities: z.array(GapHeavyOpportunitySchema),
  funnelGaps: z.array(GapHeavyFunnelGapSchema),
  localAndSocialSignals: GapHeavyLocalAndSocialSignalsSchema,
  strategicPriorities: z.array(GapHeavyStrategicPrioritySchema),
  strategistNarrative: z.string(),
  evidence: z.array(GapHeavyEvidenceItemSchema),
  createdAt: z.string(),
});

// ============================================================================
// Engine Result Wrapper
// ============================================================================

/**
 * Result from the GAP Heavy strategic intelligence engine
 */
export interface GapHeavyEngineResult {
  /** Whether the analysis succeeded */
  success: boolean;
  /** The strategic intelligence result (if successful) */
  result?: GapHeavyResult;
  /** Error message (if failed) */
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for GAP Heavy entities
 */
export function generateGapHeavyId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create empty/default GapHeavyResult for error fallback
 */
export function createEmptyGapHeavyResult(companyId: string): GapHeavyResult {
  return {
    companyId,
    dataConfidence: 0,
    dataSignals: {
      hasGsc: false,
      hasSerpSamples: false,
      hasCrawl: false,
      hasGbp: false,
      hasSocial: false,
      hasAnalytics: false,
      competitorCount: 0,
    },
    competitorLandscape: [],
    searchVisibilityMap: {
      summary: 'Unable to analyze search visibility - insufficient data.',
      keyChannels: [],
      brandVsNonBrand: 'Unknown',
      coverageByIntent: [],
    },
    categoryOpportunities: [],
    contentOpportunities: [],
    funnelGaps: [],
    localAndSocialSignals: {
      summary: 'Unable to analyze local and social signals - insufficient data.',
      localPresence: 'Unknown',
      reviewPositioning: 'Unknown',
      socialProofSummary: 'Unknown',
    },
    strategicPriorities: [],
    strategistNarrative: 'Unable to generate strategic narrative - insufficient data available for analysis.',
    evidence: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validate and parse a GapHeavyResult from unknown data
 */
export function parseGapHeavyResult(data: unknown): GapHeavyResult | null {
  const result = GapHeavyResultSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.error('[GAP Heavy] Failed to parse result:', result.error);
  return null;
}
