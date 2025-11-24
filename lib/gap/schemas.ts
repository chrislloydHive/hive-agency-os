// lib/gap/schemas.ts
// Zod validation schemas for GAP types

import { z } from 'zod';

// ============================================================================
// Marketing Maturity & Core Context Schemas
// ============================================================================

export const MarketingMaturityStageSchema = z.enum([
  'early',
  'developing',
  'advanced',
]);

export const BrandTierSchema = z.enum([
  'global_category_leader',
  'enterprise',
  'mid_market',
  'smb',
  'startup',
  'local_business',
  'nonprofit',
  'other',
]);

export const CompanyTypeSchema = z.enum([
  'b2b_saas',
  'b2c_saas',
  'b2b_services',
  'b2c_services',
  'marketplace',
  'ecommerce',
  'brick_and_mortar',
  'media_publisher',
  'nonprofit',
  'platform_infrastructure',
  'other',
]);

export const CoreMarketingContextSchema = z.object({
  url: z.string().url(),
  domain: z.string(),

  // Business basics
  businessName: z.string().optional(), // LLM should populate, fallback will handle if missing
  industry: z.string().optional(),
  primaryOffer: z.string().optional(),
  primaryAudience: z.string().optional(),
  geography: z.string().optional(),

  // Overall scores and maturity
  overallScore: z.number().min(0).max(100).optional(),
  marketingMaturity: MarketingMaturityStageSchema.optional(),
  marketingReadinessScore: z.number().min(0).max(100).optional(),

  // Brand tier and company classification
  brandTier: BrandTierSchema.optional(),
  companyType: CompanyTypeSchema.optional(),

  // Brand dimension
  brand: z.object({
    brandScore: z.number().min(0).max(100).optional(),
    perceivedPositioning: z.string().optional(),
    toneOfVoice: z.string().optional(),
    visualConsistency: z.enum(['low', 'medium', 'high']).nullable().optional(),
  }),

  // Content dimension
  content: z.object({
    contentScore: z.number().min(0).max(100).optional(),
    hasBlogOrResources: z.boolean().optional(),
    contentDepth: z.enum(['shallow', 'medium', 'deep']).nullable().optional(),
    contentFocus: z.string().optional(),
    postingConsistency: z
      .enum(['low', 'medium', 'high'])
      .nullable()
      .optional(),
  }),

  // SEO dimension
  seo: z.object({
    seoScore: z.number().min(0).max(100).optional(),
    appearsIndexable: z.boolean().nullable().optional(),
    onPageBasics: z.enum(['ok', 'issues']).nullable().optional(),
    searchIntentFit: z.enum(['weak', 'mixed', 'strong']).nullable().optional(),
  }),

  // Website dimension
  website: z.object({
    websiteScore: z.number().min(0).max(100).optional(),
    clarityOfMessage: z.enum(['low', 'medium', 'high']).nullable().optional(),
    primaryCtaQuality: z.enum(['weak', 'ok', 'strong']).nullable().optional(),
    perceivedFriction: z.enum(['low', 'medium', 'high']).nullable().optional(),
  }),

  // Digital Footprint & Authority dimension
  digitalFootprint: z.object({
    footprintScore: z.number().min(0).max(100).optional(),
    googleBusinessProfile: z.enum(['none', 'weak', 'medium', 'strong']).nullable().optional(),
    linkedinPresence: z.enum(['none', 'weak', 'medium', 'strong']).nullable().optional(),
    socialPresence: z.enum(['none', 'weak', 'medium', 'strong']).nullable().optional(),
    reviewsReputation: z.enum(['none', 'weak', 'medium', 'strong']).nullable().optional(),
    authoritySignals: z.enum(['none', 'weak', 'medium', 'strong']).nullable().optional(),
    brandSearchDemand: z.enum(['low', 'medium', 'high']).nullable().optional(),
  }).optional(),

  // Summary and opportunities
  quickSummary: z.string(),
  topOpportunities: z.array(z.string()),

  // Metadata
  source: z
    .enum(['gap-ia', 'full-gap', 'imported', 'manual'])
    .optional(),
  generatedAt: z.string().optional(),
});

// ============================================================================
// GAP-IA Run Schemas
// ============================================================================

export const GapIaStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'error',
]);

export const GapIaSourceSchema = z.enum([
  'lead-magnet',
  'internal',
  'imported',
]);

// ============================================================================
// Enhanced GAP-IA V2 Schemas (More Substance, Same Engine)
// ============================================================================

export const ImpactLevelSchema = z.enum(['low', 'medium', 'high']);
export const EffortLevelSchema = z.enum(['low', 'medium']);
export const CategorySchema = z.enum(['Brand', 'Content', 'SEO', 'Website', 'Website & Conversion', 'Digital Footprint', 'Authority', 'Other']);

export const DimensionSummarySchema = z.object({
  score: z.number().min(0).max(100),
  label: z.string(),
  oneLiner: z.string(), // 1 sentence interpretive summary
  issues: z.array(z.string()), // 2-4 short bullets
  narrative: z.string().optional(), // 2-3 paragraphs of detailed analysis
});

// Subscores for Digital Footprint dimension (online presence channels)
export const DigitalFootprintSubscoresSchema = z.object({
  googleBusinessProfile: z.number().min(0).max(100),
  linkedinPresence: z.number().min(0).max(100),
  socialPresence: z.number().min(0).max(100),
  reviewsReputation: z.number().min(0).max(100),
});

// Subscores for Authority dimension (trust and credibility signals)
export const AuthoritySubscoresSchema = z.object({
  domainAuthority: z.number().min(0).max(100),
  backlinks: z.number().min(0).max(100),
  brandSearchDemand: z.number().min(0).max(100),
  industryRecognition: z.number().min(0).max(100),
});

// Extended dimension summary for Digital Footprint (includes subscores)
export const DigitalFootprintDimensionSchema = DimensionSummarySchema.extend({
  subscores: DigitalFootprintSubscoresSchema,
});

// Extended dimension summary for Authority (includes subscores)
export const AuthorityDimensionSchema = DimensionSummarySchema.extend({
  subscores: AuthoritySubscoresSchema,
});

export const BreakdownItemSchema = z.object({
  category: CategorySchema,
  statement: z.string(), // 1-2 sentences, site-specific
  impactLevel: ImpactLevelSchema,
});

export const QuickWinItemSchema = z.object({
  category: CategorySchema,
  action: z.string(), // 1 sentence action
  expectedImpact: ImpactLevelSchema,
  effortLevel: EffortLevelSchema,
});

export const GapIaSummarySchema = z.object({
  overallScore: z.number().min(0).max(100),
  maturityStage: z.string(),
  headlineDiagnosis: z.string(), // 1 punchy sentence
  narrative: z.string(), // 2-3 sentence paragraph
  topOpportunities: z.array(z.string()), // 3-5 bullets
});

export const GapIaDimensionsSchema = z.object({
  brand: DimensionSummarySchema,
  content: DimensionSummarySchema,
  seo: DimensionSummarySchema,
  website: DimensionSummarySchema,
  digitalFootprint: DigitalFootprintDimensionSchema,
  authority: AuthorityDimensionSchema,
});

export const GapIaBreakdownSchema = z.object({
  bullets: z.array(BreakdownItemSchema), // 3-5
});

export const GapIaQuickWinsSchema = z.object({
  bullets: z.array(QuickWinItemSchema), // 3-5
});

// Legacy insights schema - kept for backward compatibility
export const GapIaInsightsSchema = z.object({
  overallSummary: z.string(),
  brandInsights: z.array(z.string()),
  contentInsights: z.array(z.string()),
  seoInsights: z.array(z.string()),
  websiteInsights: z.array(z.string()),
  recommendedNextStep: z.string().optional(),
});

export const GapIaRunSchema = z.object({
  id: z.string(),

  // Links to other entities
  companyId: z.string().optional(),
  inboundLeadId: z.string().optional(),
  gapPlanRunId: z.string().optional(),
  gapFullReportId: z.string().optional(),
  gapHeavyRunId: z.string().optional(),

  // Basic info
  url: z.string().url(),
  domain: z.string(),

  source: GapIaSourceSchema,
  status: GapIaStatusSchema,

  createdAt: z.string(),
  updatedAt: z.string(),

  // Core marketing context
  core: CoreMarketingContextSchema,

  // GAP-IA specific insights
  insights: GapIaInsightsSchema,

  // Optional error tracking
  errorMessage: z.string().optional(),
});

// ============================================================================
// AI Output Schema (for validating OpenAI responses)
// ============================================================================

/**
 * Schema for validating AI-generated GAP-IA V2 analysis output
 * This is what we expect from OpenAI before we save it to Airtable
 */
export const GapIaV2AiOutputSchema = z.object({
  summary: GapIaSummarySchema,
  dimensions: GapIaDimensionsSchema,
  breakdown: GapIaBreakdownSchema,
  quickWins: GapIaQuickWinsSchema,

  // Legacy fields for backward compatibility - REQUIRED for now
  core: CoreMarketingContextSchema,
  insights: GapIaInsightsSchema,
});

/**
 * Legacy schema - kept for backward compatibility
 * This is what we expect from OpenAI before we save it to Airtable
 */
export const GapIaAiOutputSchema = z.object({
  core: CoreMarketingContextSchema,
  insights: GapIaInsightsSchema,
});

// ============================================================================
// GAP-Plan Run Schema (minimal for now)
// ============================================================================

export const GapPlanRunStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'error',
]);

export const GapPlanRunSchema = z.object({
  id: z.string(),
  companyId: z.string().optional(),
  url: z.string().url(),
  domain: z.string(),
  status: GapPlanRunStatusSchema,
  overallScore: z.number().min(0).max(100).optional(),
  brandScore: z.number().min(0).max(100).optional(),
  contentScore: z.number().min(0).max(100).optional(),
  websiteScore: z.number().min(0).max(100).optional(),
  seoScore: z.number().min(0).max(100).optional(),
  authorityScore: z.number().min(0).max(100).optional(),
  maturityStage: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  errorMessage: z.string().optional(),
});

// ============================================================================
// GAP-Full Report Schema (minimal for now)
// ============================================================================

export const GapFullReportStatusSchema = z.enum([
  'draft',
  'processing',
  'ready',
  'archived',
  'error',
]);

export const GapFullReportSchema = z.object({
  id: z.string(),
  companyId: z.string().optional(),
  gapPlanRunId: z.string().optional(),
  status: GapFullReportStatusSchema,
  reportType: z.enum(['Initial', 'Quarterly', 'Annual']).optional(),
  overallScore: z.number().min(0).max(100).optional(),
  brandScore: z.number().min(0).max(100).optional(),
  contentScore: z.number().min(0).max(100).optional(),
  websiteScore: z.number().min(0).max(100).optional(),
  seoScore: z.number().min(0).max(100).optional(),
  authorityScore: z.number().min(0).max(100).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ============================================================================
// GAP-Heavy Run Schema (minimal for now)
// ============================================================================

export const GapHeavyRunStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'error',
  'cancelled',
]);

export const GapHeavyRunStepSchema = z.enum([
  'init',
  'discoverPages',
  'analyzePages',
  'deepSeoAudit',
  'socialDeepDive',
  'competitorDeepDive',
  'generateArtifacts',
  'complete',
]);

export const GapHeavyRunSchema = z.object({
  id: z.string(),
  gapPlanRunId: z.string(),
  companyId: z.string().optional(),
  gapFullReportId: z.string().optional(),
  url: z.string().url(),
  domain: z.string(),
  status: GapHeavyRunStatusSchema,
  currentStep: GapHeavyRunStepSchema,
  stepsCompleted: z.array(GapHeavyRunStepSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastTickAt: z.string().optional(),
  tickCount: z.number(),
  errorMessage: z.string().optional(),
});
