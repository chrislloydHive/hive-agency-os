// lib/growthActionPlanSchema.ts

import { z } from "zod";
import { normalizeTimeHorizon } from "./timeHorizonNormalizer";

// Time horizon enum: accepts string and normalizes to canonical format
export const TimeHorizonEnum = z.string().transform((val) => normalizeTimeHorizon(val)) as z.ZodType<'immediate' | 'short_term' | 'medium_term' | 'long_term'>;

// Quick wins can only be immediate or short_term
export const QuickWinTimeHorizonEnum = z.enum([
  "immediate",
  "short_term",
]);

// Strategic initiatives can only be medium_term or long_term
export const StrategicInitiativeTimeHorizonEnum = z.enum([
  "medium_term",
  "long_term",
]);

export const PriorityEnum = z.enum(["low", "medium", "high"]);

export const ImpactEnum = z.enum(["low", "medium", "high"]);

// Keep resourceRequirement free-form but predictable
export const BaseActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: PriorityEnum,
  timeHorizon: TimeHorizonEnum,
  impact: ImpactEnum,
  resourceRequirement: z.string(), // "minimal", "moderate", "significant", etc.
  specificChanges: z.array(z.string()).default([]),
  expectedOutcome: z.string().optional(),
  successMetrics: z.array(z.string()).default([]),
  potentialScoreGain: z.number().int().min(0).max(100).optional(),
  estimatedEffort: z.string().optional(),
  serviceArea: z.string().optional(),
});

export const QuickWinSchema = BaseActionSchema.extend({
  timeHorizon: QuickWinTimeHorizonEnum, // Quick wins are immediate or short-term only
  quickWinReason: z.string().optional(),
  expectedTimeline: z.string().optional(),
});

export const StrategicInitiativeSchema = BaseActionSchema.extend({
  timeHorizon: StrategicInitiativeTimeHorizonEnum, // Strategic initiatives are medium-term or long-term only
  totalDuration: z.string().optional(),
  investmentLevel: z.string().optional(),
  expectedROI: z.string().optional(),
});

export const ExecutiveSummarySchema = z.object({
  overallScore: z.number().int().min(0).max(100).optional(),
  maturityStage: z.string().optional(),
  companyOverview: z.string().optional(),
  narrative: z.string().optional(),
  strengths: z.array(z.string()).default([]),
  keyIssues: z.array(z.string()).default([]),
  strategicPriorities: z.array(z.string()).default([]),
  expectedOutcomes: z.array(z.string()).optional(),
});

export const ScorecardSchema = z.object({
  overall: z.number().int().min(0).max(100),
  website: z.number().int().min(0).max(100).optional(),
  content: z.number().int().min(0).max(100).optional(),
  seo: z.number().int().min(0).max(100).optional(),
  brand: z.number().int().min(0).max(100).optional(),
  authority: z.number().int().min(0).max(100).optional(),
  evaluatedDimensions: z.array(z.string()).default([]),
});

export const TimelineBucketSchema = z.array(BaseActionSchema);

export const TimelineSchema = z.object({
  immediate: TimelineBucketSchema.default([]),
  shortTerm: TimelineBucketSchema.default([]),
  mediumTerm: TimelineBucketSchema.default([]),
  longTerm: TimelineBucketSchema.default([]),
});

export const ExpectedWindowSchema = z.object({
  scoreImprovement: z.number().int().optional(),
  keyMetrics: z.array(z.string()).default([]),
  milestones: z.array(z.string()).default([]),
});

export const ExpectedOutcomesSchema = z.object({
  thirtyDays: ExpectedWindowSchema.default({}),
  ninetyDays: ExpectedWindowSchema.default({}),
  sixMonths: ExpectedWindowSchema.default({}),
});

export const SectionAnalysisSchema = z.object({
  summary: z.string().optional(),
  keyFindings: z.array(z.string()).default([]),
  quickWins: z.array(z.string()).default([]),
  deeperInitiatives: z.array(z.string()).default([]),
});

export const RiskSchema = z.object({
  risk: z.string(),
  mitigation: z.string().optional(),
  likelihood: z.string().optional(), // "low" | "medium" | "high" (free-form for now)
  impact: z.string().optional(),
});

export const ResourceRequirementSchema = z.object({
  type: z.string(), // "internal", "external", etc.
  description: z.string(),
  estimatedCost: z.string().optional(),
  urgency: z.string().optional(),
});

export const SiteCrawlSchema = z.object({
  attemptedUrls: z.array(z.string()).default([]),
  successfulUrls: z.array(z.string()).default([]),
  failedUrls: z.array(z.string()).default([]),
  coverageLevel: z.string().optional(), // "minimal" | "partial" | "good"
});

export const TechnicalSeoSchema = z.object({
  lighthouseAvailable: z.boolean().optional(),
  coreWebVitalsAvailable: z.boolean().optional(),
  metaTagsParsed: z.boolean().optional(),
  indexabilityChecked: z.boolean().optional(),
});

export const CompetitorsSchema = z.object({
  providedByUser: z.boolean().optional(),
  autoDiscovered: z.boolean().optional(),
  competitorCount: z.number().int().optional(),
});

export const ContentInventorySchema = z.object({
  blogDetected: z.boolean().optional(),
  caseStudiesDetected: z.boolean().optional(),
  aboutPageDetected: z.boolean().optional(),
  faqDetected: z.boolean().optional(),
});

export const AnalyticsAvailabilitySchema = z.object({
  googleAnalyticsDetected: z.boolean().optional(),
  gtmDetected: z.boolean().optional(),
  otherAnalyticsDetected: z.boolean().optional(),
});

export const DataAvailabilitySchema = z.object({
  siteCrawl: SiteCrawlSchema.optional(),
  technicalSeo: TechnicalSeoSchema.optional(),
  competitors: CompetitorsSchema.optional(),
  contentInventory: ContentInventorySchema.optional(),
  analytics: AnalyticsAvailabilitySchema.optional().default({}),
  overallConfidence: z.string().optional(), // "low" | "medium" | "high"
});

export const MarketAnalysisSchema = z.object({
  category: z.string().optional(),
  commonPainPoints: z.array(z.string()).default([]),
  commonClaims: z.array(z.string()).default([]),
  pricingPatterns: z.array(z.string()).default([]),
  ICPProfiles: z.array(z.string()).default([]),
  categoryTrends: z.array(z.string()).default([]),
  differentiationWhitespace: z.array(z.string()).default([]),
});

export const PositioningAnalysisSchema = z.object({
  primaryAudience: z.string().optional(),
  geographicFocus: z.string().optional(),
  corePositioningStatement: z.string().optional(),
  keyThemes: z.array(z.string()).default([]),
  differentiationSignals: z.array(z.string()).default([]),
  evidenceFromSite: z.array(z.string()).default([]),
});

export const SocialStrengthEnum = z.enum(["none", "weak", "present", "strong"]);

export const SocialSignalsSchema = z.object({
  hasLinkedIn: z.boolean().optional().default(false),
  hasFacebook: z.boolean().optional().default(false),
  hasInstagram: z.boolean().optional().default(false),
  linkedinUrls: z.array(z.string()).default([]),
  facebookUrls: z.array(z.string()).default([]),
  instagramUrls: z.array(z.string()).default([]),
  linkedinStrength: SocialStrengthEnum.optional(),
  facebookStrength: SocialStrengthEnum.optional(),
  instagramStrength: SocialStrengthEnum.optional(),
});

export const ErrorSchema = z.object({
  message: z.string(),
  validationErrors: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
        expected: z.any().optional(),
        received: z.any().optional(),
        path: z.array(z.union([z.string(), z.number()])).optional(),
      })
    )
    .optional(),
});

// 🔒 Growth Acceleration Plan (GAP) Schema v1
export const GrowthAccelerationPlanSchema = z.object({
  gapId: z.string(),
  companyName: z.string(),
  websiteUrl: z.string(),
  generatedAt: z.string(),
  error: ErrorSchema.optional(),
  planVersion: z.enum(['v1', 'v2']).optional(),
  assessmentSnapshotId: z.string().optional(),

  // V2 enhanced fields (all optional for backward compatibility)
  executiveSummaryV2: z.object({
    overallScore: z.number(),
    maturityStage: z.string(),
    headline: z.string(),
    narrative: z.string(),
    keyStrengths: z.array(z.string()),
    keyIssues: z.array(z.string()),
    strategicTheme: z.string(),
  }).optional(),

  strategicDiagnosis: z.any().optional(),
  channelRecommendations: z.any().optional(),
  actions: z.any().optional(),
  roadmapV2: z.any().optional(),
  accelerators: z.any().optional(),
  benchmarksV2: z.any().optional(),
  strategicOutcomes: z.any().optional(),
  sectionAnalysesLegacy: z.any().optional(),
  competitorAnalysis: z.any().optional(),

  // Consultant Report fields
  gapReportMarkdown: z.string().nullable().optional(),
  gapReportVersion: z.string().nullable().optional(),

  executiveSummary: ExecutiveSummarySchema,
  quickWins: z.array(QuickWinSchema).default([]),
  strategicInitiatives: z.array(StrategicInitiativeSchema).default([]),
  focusAreas: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      priority: PriorityEnum.optional(),
      actions: z
        .array(
          z.union([
            QuickWinSchema,
            StrategicInitiativeSchema,
            BaseActionSchema, // fallback
          ])
        )
        .optional()
        .default([]),
      expectedImpact: z.string().optional(),
      successCriteria: z.array(z.string()).default([]),
    })
  ).default([]),

  resourceRequirements: z.array(ResourceRequirementSchema).default([]),
  timeline: TimelineSchema,
  expectedOutcomes: ExpectedOutcomesSchema,
  risks: z.array(RiskSchema).default([]),
  nextSteps: z.array(z.string()).default([]),

  sectionAnalyses: z.record(SectionAnalysisSchema).default({}),
  marketAnalysis: MarketAnalysisSchema.optional(),
  positioningAnalysis: PositioningAnalysisSchema.optional(),
  dataAvailability: DataAvailabilitySchema.optional(),
  scorecard: ScorecardSchema.optional(),
  socialSignals: SocialSignalsSchema.optional(),
  debug: z.any().optional(), // Debug payload (dev mode only, not validated)

  // Dimension narratives from GAP-IA (optional)
  dimensionNarratives: z.object({
    brand: z.string().optional(),
    content: z.string().optional(),
    seo: z.string().optional(),
    website: z.string().optional(),
  }).optional(),

  // 90-day roadmap (optional)
  roadmap: z.array(z.object({
    phase: z.string(),
    focus: z.string(),
    actions: z.array(z.string()),
    businessRationale: z.string().optional(),
  })).optional(),

  // KPIs to watch (optional)
  kpis: z.array(z.object({
    name: z.string(),
    description: z.string(),
    whyItMatters: z.string(),
    whatGoodLooksLike: z.string().optional(),
  })).optional(),
});

export type GrowthAccelerationPlan = z.infer<typeof GrowthAccelerationPlanSchema>;
export type QuickWin = z.infer<typeof QuickWinSchema>;
export type StrategicInitiative = z.infer<typeof StrategicInitiativeSchema>;
export type Scorecard = z.infer<typeof ScorecardSchema>;

