/**
 * Growth Acceleration Plan (GAP) Schema
 * 
 * Zod schemas for validating Growth Acceleration Plan (GAP) JSON structures.
 * Used to validate LLM-generated JSON before returning to clients.
 */

import { z } from 'zod';
import { normalizeTimeHorizon } from './timeHorizonNormalizer';

// Enums and literals
const priorityLevelSchema = z.enum(['critical', 'high', 'medium', 'low']);

// Time horizon schema: accepts string and normalizes to canonical format
// This allows the LLM to emit variants like "short-term", "short_term", "short", etc.
const timeHorizonSchema = z.string().transform((val) => normalizeTimeHorizon(val)) as z.ZodType<'immediate' | 'short_term' | 'medium_term' | 'long_term'>;
const impactLevelSchema = z.enum(['transformational', 'high', 'medium', 'low']);
const resourceLevelSchema = z.enum(['minimal', 'moderate', 'significant', 'major']);
const serviceAreaSchema = z.enum(['brandingAndImpact', 'contentAndEngagement', 'websiteAndConversion', 'seoAndVisibility', 'cross_cutting']);
const coverageLevelSchema = z.enum(['minimal', 'partial', 'good']);
const confidenceLevelSchema = z.enum(['low', 'medium', 'high']);
const evaluatedDimensionSchema = z.enum(['website', 'content', 'seo', 'brand', 'authority']);

// ============================================================================
// V2 SCHEMAS (Full GAP Enhancement)
// ============================================================================

// Strategic Diagnosis schemas
const bottleneckCategorySchema = z.enum([
  'Discovery',
  'Conversion',
  'Retention',
  'Positioning',
  'Product-Market Fit',
  'Other'
]);

const icpSchema = z.object({
  label: z.string(),
  description: z.string(),
  keyPainPoints: z.array(z.string()),
  keyObjections: z.array(z.string()),
});

const strategicDiagnosisSchema = z.object({
  growthBottleneck: z.string(),
  bottleneckCategory: bottleneckCategorySchema,
  whyThisMatters: z.string(),
  primaryIcp: icpSchema,
  secondaryIcp: z.object({
    label: z.string(),
    description: z.string(),
  }).optional(),
});

// Channel Recommendation schema
const channelRecommendationSchema = z.object({
  summary: z.string(),
  keyPlays: z.array(z.string()),
});

// GAP Action V2 schema (enhanced action with all metadata)
const v2TimeHorizonSchema = z.enum(['Immediate', 'Short Term', 'Medium Term', 'Long Term']);
const v2ImpactSchema = z.enum(['low', 'medium', 'high']);
const v2EffortSchema = z.enum(['low', 'medium', 'high']);
const v2ConfidenceSchema = z.enum(['low', 'medium', 'high']);
const v2CategorySchema = z.enum([
  'Brand',
  'Content',
  'SEO',
  'Website & Conversion',
  'Authority',
  'Email',
  'Paid',
  'Other'
]);

const gapActionV2Schema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: v2CategorySchema,
  channel: z.string(),
  timeHorizon: v2TimeHorizonSchema,
  impact: v2ImpactSchema,
  effort: v2EffortSchema,
  confidence: v2ConfidenceSchema,
  dependencies: z.array(z.string()).optional(),
  ownerHint: z.string().optional(),
});

// Action reference (for roadmap/accelerators)
const gapActionRefSchema = z.object({
  actionId: z.string(),
  rationale: z.string().optional(),
});

// Benchmark metric
const benchmarkMetricSchema = z.object({
  value: z.number().nullable(),
  median: z.number().nullable(),
  topQuartile: z.number().nullable(),
  percentile: z.number().nullable(),
});

// Strategic outcome
const strategicOutcomeSchema = z.object({
  label: z.string(),
  description: z.string(),
  linkedScores: z.array(z.string()),
});

// Executive Summary V2 (enhanced)
const executiveSummaryV2Schema = z.object({
  overallScore: z.number().min(0).max(100),
  maturityStage: z.string(),
  headline: z.string(),
  narrative: z.string(),
  keyStrengths: z.array(z.string()),
  keyIssues: z.array(z.string()),
  strategicTheme: z.string(),
});

// Channel Recommendations (all channels)
const channelRecommendationsSchema = z.object({
  websiteAndConversion: channelRecommendationSchema.optional(),
  seoAndContent: channelRecommendationSchema.optional(),
  emailAndNurture: channelRecommendationSchema.optional(),
  paidSearch: channelRecommendationSchema.optional(),
  paidSocial: channelRecommendationSchema.optional(),
  socialOrganic: channelRecommendationSchema.optional(),
  partnerships: channelRecommendationSchema.optional(),
  brandAndPositioning: channelRecommendationSchema.optional(),
});

// Roadmap V2 (time-based buckets with action references)
const roadmapV2Schema = z.object({
  immediate: z.array(gapActionRefSchema),
  shortTerm: z.array(gapActionRefSchema),
  mediumTerm: z.array(gapActionRefSchema),
  longTerm: z.array(gapActionRefSchema),
});

// Benchmarks V2 (enhanced)
const benchmarksV2Schema = z.object({
  peerCount: z.number(),
  cohortLabel: z.string(),
  overall: benchmarkMetricSchema,
  website: benchmarkMetricSchema,
  brand: benchmarkMetricSchema,
  content: benchmarkMetricSchema,
  seo: benchmarkMetricSchema,
  authority: benchmarkMetricSchema,
});

// Scorecard schema
const scorecardSchema = z.object({
  overall: z.number().min(0).max(100).optional(),
  website: z.number().min(0).max(100).optional(),
  content: z.number().min(0).max(100).optional(),
  seo: z.number().min(0).max(100).optional(),
  brand: z.number().min(0).max(100).optional(),
  authority: z.number().min(0).max(100).optional(),
  evaluatedDimensions: z.array(evaluatedDimensionSchema),
});

// Executive Summary schema
const executiveSummarySchema = z.object({
  overallScore: z.number().min(0).max(100).optional(),
  maturityStage: z.string(),
  narrative: z.string(),
  strengths: z.array(z.string()),
  keyIssues: z.array(z.string()),
  strategicPriorities: z.array(z.string()),
  expectedOutcomes: z.array(z.string()),
});

// Section Analysis schema (Rich Diagnostic)
const sectionAnalysisSchema = z.object({
  // Core identification
  label: z.string().min(1).max(100),
  score: z.number().min(0).max(100),
  grade: z.string().min(1).max(50), // e.g., "A", "B", "Strong", "Developing"
  
  // Narrative
  verdict: z.string().min(10).max(200), // 1 short sentence
  summary: z.string().min(20).max(500), // 1-3 sentences
  
  // Diagnostic arrays
  strengths: z.array(z.string().min(10).max(300)).min(2).max(5),
  issues: z.array(z.string().min(10).max(300)).min(3).max(5),
  recommendations: z.array(z.string().min(10).max(300)).min(3).max(7),
  
  // Impact assessment
  impactEstimate: z.string().min(3).max(200),
  
  // Legacy fields (optional for backward compatibility)
  keyFindings: z.array(z.string().min(3)).max(10).optional(),
  quickWins: z.array(z.string().min(3)).max(10).optional(),
  deeperInitiatives: z.array(z.string().min(3)).max(10).optional(),
  maturityNotes: z.string().min(3).max(800).optional(),
});

// Data Availability schema
const dataAvailabilitySchema = z.object({
  siteCrawl: z.object({
    attemptedUrls: z.array(z.string()),
    successfulUrls: z.array(z.string()),
    failedUrls: z.array(z.string()),
    coverageLevel: coverageLevelSchema,
  }),
  technicalSeo: z.object({
    lighthouseAvailable: z.boolean(),
    coreWebVitalsAvailable: z.boolean(),
    metaTagsParsed: z.boolean(),
    indexabilityChecked: z.boolean(),
  }),
  competitors: z.object({
    providedByUser: z.boolean(),
    autoDiscovered: z.boolean(),
    competitorCount: z.number(),
  }),
  contentInventory: z.object({
    blogDetected: z.boolean(),
    caseStudiesDetected: z.boolean(),
    aboutPageDetected: z.boolean(),
    faqDetected: z.boolean(),
  }),
  analytics: z.object({
    googleAnalyticsDetected: z.boolean(),
    gtmDetected: z.boolean(),
    otherAnalyticsDetected: z.boolean(),
  }),
  overallConfidence: confidenceLevelSchema,
});

// Market Analysis schema
const marketAnalysisSchema = z.object({
  category: z.string(),
  commonPainPoints: z.array(z.string()),
  commonClaims: z.array(z.string()),
  pricingPatterns: z.array(z.string()),
  ICPProfiles: z.array(z.string()),
  categoryTrends: z.array(z.string()),
  differentiationWhitespace: z.array(z.string()),
});

// Positioning Analysis schema
const positioningAnalysisSchema = z.object({
  primaryAudience: z.string(),
  geographicFocus: z.string(),
  localSearchLanguage: z.array(z.string()).optional(),
  corePositioningStatement: z.string(),
  keyThemes: z.array(z.string()),
  differentiationSignals: z.array(z.string()),
  evidenceFromSite: z.array(z.string()),
});

// Competitor Analysis schema
const competitorAnalysisSchema = z.object({
  competitorsReviewed: z.array(z.string()),
  categorySummary: z.string(),
  positioningPatterns: z.array(z.string()),
  differentiationOpportunities: z.array(z.string()),
  contentFootprintSummary: z.array(z.string()),
  seoVisibilitySummary: z.array(z.string()),
  messagingComparison: z.array(z.string()),
  recommendations: z.array(z.string()),
});

// Initiative Phase schema
const initiativePhaseSchema = z.object({
  phaseNumber: z.number(),
  name: z.string(),
  duration: z.string(),
  deliverables: z.array(z.string()),
  milestones: z.array(z.string()),
});

// Growth Action schema (base for QuickWin and StrategicInitiative)
const growthActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: priorityLevelSchema,
  timeHorizon: timeHorizonSchema,
  impact: impactLevelSchema,
  resourceRequirement: resourceLevelSchema,
  specificChanges: z.array(z.string()),
  expectedOutcome: z.string(),
  successMetrics: z.array(z.string()),
  potentialScoreGain: z.number().min(0).max(100).optional(),
  estimatedEffort: z.string(),
  requiredSkills: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  serviceArea: serviceAreaSchema,
  evidence: z.string().optional(),
  pillar: z.string().optional(),
});

// QuickWin schema
const quickWinSchema = growthActionSchema.extend({
  timeHorizon: z.enum(['immediate', 'short_term']), // Quick wins are immediate or short-term only
  quickWinReason: z.string(),
  expectedTimeline: z.string(),
});

// Strategic Initiative schema
const strategicInitiativeSchema = growthActionSchema.extend({
  timeHorizon: z.enum(['medium_term', 'long_term']),
  phases: z.array(initiativePhaseSchema).optional(),
  totalDuration: z.string(),
  investmentLevel: z.enum(['low', 'medium', 'high']),
  expectedROI: z.string().optional(),
});

// Resource Requirement schema
const resourceRequirementSchema = z.object({
  type: z.enum(['internal', 'external', 'tool', 'budget']),
  description: z.string(),
  estimatedCost: z.string().optional(),
  urgency: z.enum(['immediate', 'soon', 'later']),
});

// Growth Focus Area schema
const growthFocusAreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  priority: priorityLevelSchema,
  actions: z.array(growthActionSchema),
  expectedImpact: z.string(),
  successCriteria: z.array(z.string()),
});

// Risk schema
const riskSchema = z.object({
  risk: z.string(),
  mitigation: z.string(),
  likelihood: z.enum(['low', 'medium', 'high']),
  impact: impactLevelSchema,
});

// Expected Outcomes schema
const expectedOutcomesSchema = z.object({
  thirtyDays: z.object({
    scoreImprovement: z.number(),
    keyMetrics: z.array(z.string()),
    milestones: z.array(z.string()),
  }),
  ninetyDays: z.object({
    scoreImprovement: z.number(),
    keyMetrics: z.array(z.string()),
    milestones: z.array(z.string()),
  }),
  sixMonths: z.object({
    scoreImprovement: z.number(),
    keyMetrics: z.array(z.string()),
    milestones: z.array(z.string()),
  }),
});

// Timeline schema
const timelineSchema = z.object({
  immediate: z.array(growthActionSchema),
  shortTerm: z.array(growthActionSchema),
  mediumTerm: z.array(growthActionSchema),
  longTerm: z.array(growthActionSchema),
});

// Section Analyses schema (new format: brand | content | seo | website)
const sectionAnalysesSchema = z.object({
  brand: sectionAnalysisSchema.optional(),
  content: sectionAnalysisSchema.optional(),
  seo: sectionAnalysisSchema.optional(),
  website: sectionAnalysisSchema.optional(),
}).optional();

// Legacy Section Analyses schema (for backward compatibility)
const sectionAnalysesLegacySchema = z.object({
  websiteAndConversion: sectionAnalysisSchema.optional(),
  seoAndVisibility: sectionAnalysisSchema.optional(),
  contentAndMessaging: sectionAnalysisSchema.optional(),
  brandAndPositioning: sectionAnalysisSchema.optional(),
}).optional();

/**
 * Growth Acceleration Plan (GAP) Schema
 * Complete schema for validating Growth Acceleration Plan (GAP) JSON
 */
export const GrowthAccelerationPlanSchema = z.object({
  // Metadata
  gapId: z.string(),
  companyName: z.string(),
  websiteUrl: z.string().url(),
  generatedAt: z.string(), // ISO timestamp
  assessmentSnapshotId: z.string().optional(),

  // Plan version (v1 or v2)
  planVersion: z.enum(['v1', 'v2']).optional(),

  // ============================================================================
  // V2 ENHANCED FIELDS (optional for backward compatibility)
  // ============================================================================

  // Enhanced executive summary
  executiveSummaryV2: executiveSummaryV2Schema.optional(),

  // Strategic diagnosis (growth bottleneck + ICP)
  strategicDiagnosis: strategicDiagnosisSchema.optional(),

  // Channel-by-channel recommendations
  channelRecommendations: channelRecommendationsSchema.optional(),

  // Full action inventory (20-40 actions)
  actions: z.array(gapActionV2Schema).optional(),

  // Roadmap V2 (time-based buckets with action references)
  roadmapV2: roadmapV2Schema.optional(),

  // Accelerators (3-6 highest-leverage actions)
  accelerators: z.array(gapActionRefSchema).optional(),

  // Enhanced benchmarks
  benchmarksV2: benchmarksV2Schema.optional(),

  // Strategic outcomes
  strategicOutcomes: z.array(strategicOutcomeSchema).optional(),

  // ============================================================================
  // V1 LEGACY FIELDS (kept for backward compatibility)
  // ============================================================================

  // Executive summary
  executiveSummary: executiveSummarySchema,

  // Quick wins (30-day actions)
  quickWins: z.array(quickWinSchema),

  // Strategic initiatives (90-day+ actions)
  strategicInitiatives: z.array(strategicInitiativeSchema),

  // Focus areas (grouped by theme)
  focusAreas: z.array(growthFocusAreaSchema),

  // Resource requirements
  resourceRequirements: z.array(resourceRequirementSchema),

  // Timeline overview
  timeline: timelineSchema,

  // Expected outcomes
  expectedOutcomes: expectedOutcomesSchema,

  // Risk mitigation
  risks: z.array(riskSchema),

  // Next steps
  nextSteps: z.array(z.string()),

  // Section analyses (detailed breakdowns by service area)
  sectionAnalyses: sectionAnalysesSchema,
  // Legacy format (for backward compatibility)
  sectionAnalysesLegacy: sectionAnalysesLegacySchema.optional(),

  // Competitor analysis
  competitorAnalysis: competitorAnalysisSchema.optional(),

  // Market analysis
  marketAnalysis: marketAnalysisSchema,

  // Positioning analysis
  positioningAnalysis: positioningAnalysisSchema,

  // Data availability tracking
  dataAvailability: dataAvailabilitySchema,

  // Scorecard (optional, may be added separately)
  scorecard: scorecardSchema.optional(),
});

/**
 * Inferred TypeScript type from Growth Acceleration Plan (GAP) Schema
 */
export type GrowthAccelerationPlan = z.infer<typeof GrowthAccelerationPlanSchema>;

/**
 * Fallback error object structure
 * Returned when validation fails
 */
export interface GrowthAccelerationPlanFallback {
  gapId: string;
  companyName: string;
  websiteUrl: string;
  generatedAt: string;
  error: {
    message: string;
    validationErrors?: z.ZodError['errors'];
  };
  dataAvailability: {
    siteCrawl: {
      attemptedUrls: string[];
      successfulUrls: string[];
      failedUrls: string[];
      coverageLevel: 'minimal';
    };
    technicalSeo: {
      lighthouseAvailable: false;
      coreWebVitalsAvailable: false;
      metaTagsParsed: false;
      indexabilityChecked: false;
      websiteScoringAvailable: false;
    };
    competitors: {
      providedByUser: false;
      autoDiscovered: false;
      competitorCount: 0;
    };
    contentInventory: {
      blogDetected: false;
      caseStudiesDetected: false;
      aboutPageDetected: false;
      faqDetected: false;
    };
    analytics: {
      googleAnalyticsDetected: false;
      gtmDetected: false;
      otherAnalyticsDetected: false;
    };
    insightsAvailable: false;
    overallConfidence: 'low';
  };
  executiveSummary: {
    overallScore: undefined;
    maturityStage: 'Not evaluated';
    narrative: 'Growth Acceleration Plan (GAP) generation encountered validation errors. Please try again or contact support.';
    strengths: [];
    keyIssues: ['Validation error occurred during plan generation'];
    strategicPriorities: [];
    expectedOutcomes: ['Unable to generate expected outcomes due to validation errors.'];
  };
  quickWins: [];
  strategicInitiatives: [];
  focusAreas: [];
  resourceRequirements: [];
  timeline: {
    immediate: [];
    shortTerm: [];
    mediumTerm: [];
    longTerm: [];
  };
  expectedOutcomes: {
    thirtyDays: {
      scoreImprovement: 0;
      keyMetrics: [];
      milestones: [];
    };
    ninetyDays: {
      scoreImprovement: 0;
      keyMetrics: [];
      milestones: [];
    };
    sixMonths: {
      scoreImprovement: 0;
      keyMetrics: [];
      milestones: [];
    };
  };
  risks: [];
  nextSteps: [];
  sectionAnalyses: undefined;
  competitorAnalysis: undefined;
  marketAnalysis: {
    category: 'Not evaluated (validation error)';
    commonPainPoints: [];
    commonClaims: [];
    pricingPatterns: [];
    ICPProfiles: [];
    categoryTrends: [];
    differentiationWhitespace: [];
  };
  positioningAnalysis: {
    primaryAudience: 'Not clearly defined';
    geographicFocus: 'Not clearly defined';
    corePositioningStatement: 'Positioning not clearly articulated';
    keyThemes: [];
    differentiationSignals: [];
    evidenceFromSite: [];
  };
  scorecard?: undefined;
}

/**
 * Validate Growth Acceleration Plan (GAP) JSON
 * 
 * @param data - Unknown data to validate
 * @param fallbackMetadata - Metadata to use in fallback error object
 * @returns Validated GrowthAccelerationPlan or fallback error object
 */
export function validateGrowthAccelerationPlan(
  data: unknown,
  fallbackMetadata: {
    gapId: string;
    companyName: string;
    websiteUrl: string;
    generatedAt: string;
  }
): GrowthAccelerationPlan | GrowthAccelerationPlanFallback {
  const result = GrowthAccelerationPlanSchema.safeParse(data);
  
  if (result.success) {
    return result.data;
  }
  
  // Log validation errors
  console.error('❌ Growth Acceleration Plan (GAP) validation failed:', result.error);
  console.error('Validation errors:', JSON.stringify(result.error.errors, null, 2));
  
  // Return structured fallback error object
  return {
    ...fallbackMetadata,
    error: {
      message: 'Growth Acceleration Plan (GAP) validation failed',
      validationErrors: result.error.errors,
    },
    dataAvailability: {
      siteCrawl: {
        attemptedUrls: [],
        successfulUrls: [],
        failedUrls: [],
        coverageLevel: 'minimal' as const,
      },
      technicalSeo: {
        lighthouseAvailable: false,
        coreWebVitalsAvailable: false,
        metaTagsParsed: false,
        indexabilityChecked: false,
        websiteScoringAvailable: false,
      },
      competitors: {
        providedByUser: false,
        autoDiscovered: false,
        competitorCount: 0,
      },
      contentInventory: {
        blogDetected: false,
        caseStudiesDetected: false,
        aboutPageDetected: false,
        faqDetected: false,
      },
      analytics: {
        googleAnalyticsDetected: false,
        gtmDetected: false,
        otherAnalyticsDetected: false,
      },
      insightsAvailable: false,
      overallConfidence: 'low',
    },
    executiveSummary: {
      overallScore: undefined,
      maturityStage: 'Not evaluated',
      narrative: 'Growth Action Plan generation encountered validation errors. Please try again or contact support.',
      strengths: [],
      keyIssues: ['Validation error occurred during plan generation'],
      strategicPriorities: [],
      expectedOutcomes: ['Unable to generate expected outcomes due to validation errors.'],
    },
    quickWins: [],
    strategicInitiatives: [],
    focusAreas: [],
    resourceRequirements: [],
    timeline: {
      immediate: [],
      shortTerm: [],
      mediumTerm: [],
      longTerm: [],
    },
    expectedOutcomes: {
      thirtyDays: {
        scoreImprovement: 0,
        keyMetrics: [],
        milestones: [],
      },
      ninetyDays: {
        scoreImprovement: 0,
        keyMetrics: [],
        milestones: [],
      },
      sixMonths: {
        scoreImprovement: 0,
        keyMetrics: [],
        milestones: [],
      },
    },
    risks: [],
    nextSteps: [],
    sectionAnalyses: undefined,
    competitorAnalysis: undefined,
    marketAnalysis: {
      category: 'Not evaluated (validation error)',
      commonPainPoints: [],
      commonClaims: [],
      pricingPatterns: [],
      ICPProfiles: [],
      categoryTrends: [],
      differentiationWhitespace: [],
    },
    positioningAnalysis: {
      primaryAudience: 'Not clearly defined',
      geographicFocus: 'Not clearly defined',
      corePositioningStatement: 'Positioning not clearly articulated',
      keyThemes: [],
      differentiationSignals: [],
      evidenceFromSite: [],
    },
  };
}

