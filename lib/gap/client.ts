/**
 * GAP V2 Client Library
 * 
 * Zod schemas and fetch helper for Growth Acceleration Plan API
 */

import { z } from 'zod';

// Scorecard Schema
const ScorecardSchema = z.object({
  overall: z.number().min(0).max(100).optional(),
  website: z.number().min(0).max(100).optional(),
  content: z.number().min(0).max(100).optional(),
  seo: z.number().min(0).max(100).optional(),
  brand: z.number().min(0).max(100).optional(),
  authority: z.number().min(0).max(100).optional(),
  evaluatedDimensions: z.array(z.enum(['website', 'content', 'seo', 'brand', 'authority'])),
});

// CTA Insights Schema
const CtaInsightsSchema = z.object({
  primaryCtaText: z.string().nullable(),
  primaryCtaType: z.enum(['book_call', 'contact', 'shop', 'signup', 'learn_more', 'other']).nullable(),
  clarityLevel: z.enum(['clear', 'moderate', 'unclear']),
  prominenceLevel: z.enum(['prominent', 'buried', 'missing']),
  frictionFlags: z.array(z.string()),
  recommendedPrimaryCta: z.string(),
}).optional();

// Panel Hints Schema
const PanelHintsSchema = z.object({
  hero: z.string(),
  nav: z.string(),
  offer: z.string(),
  proof: z.string(),
  footer: z.string(),
}).optional();

// Social Presence Schema
const SocialPresenceSchema = z.object({
  linkedinUrl: z.string().url().optional(),
  instagramUrl: z.string().url().optional(),
  facebookUrl: z.string().url().optional(),
  googleBusinessUrl: z.string().url().optional(),
  blogUrl: z.string().optional(),
  blogPostCountEstimate: z.number().int().optional(),
  overallPresenceLevel: z.enum(['strong', 'moderate', 'weak', 'missing']).optional(),
  notes: z.string().optional(),
}).optional();

// Competitor Schema
const CompetitorSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  type: z.enum(['direct', 'adjacent', 'inspirational']).optional(),
  reason: z.string().optional(),
});

// Competitor Summary Schema
const CompetitorSummarySchema = z.object({
  primaryCompetitors: z.array(CompetitorSchema).optional(),
  competitorCount: z.number().int().optional(),
  notes: z.string().optional(),
}).optional();

// Quick Win Schema
const QuickWinSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  timeHorizon: z.enum(['immediate', 'short_term']),
  impact: z.enum(['low', 'medium', 'high']),
  resourceRequirement: z.enum(['minimal', 'moderate', 'significant']),
  specificChanges: z.array(z.string()),
  expectedOutcome: z.string(),
  successMetrics: z.array(z.string()),
  estimatedEffort: z.string(),
  serviceArea: z.string(),
  quickWinReason: z.string(),
  expectedTimeline: z.string(),
});

// Strategic Initiative Schema
const StrategicInitiativeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  timeHorizon: z.enum(['short_term', 'medium_term', 'long_term']),
  impact: z.enum(['low', 'medium', 'high']),
  resourceRequirement: z.enum(['minimal', 'moderate', 'significant']),
  specificChanges: z.array(z.string()),
  expectedOutcome: z.string(),
  successMetrics: z.array(z.string()),
  estimatedEffort: z.string(),
  serviceArea: z.string(),
  totalDuration: z.string(),
  investmentLevel: z.enum(['low', 'medium', 'high']),
});

// Executive Summary Schema
const ExecutiveSummarySchema = z.object({
  overallScore: z.number().min(0).max(100).optional(),
  maturityStage: z.string(),
  narrative: z.string(),
  strengths: z.array(z.string()),
  keyIssues: z.array(z.string()),
  strategicPriorities: z.array(z.string()),
  expectedOutcomes: z.string(),
});

// Timeline Schema
const TimelineSchema = z.object({
  immediate: z.array(z.union([QuickWinSchema, StrategicInitiativeSchema])),
  shortTerm: z.array(z.union([QuickWinSchema, StrategicInitiativeSchema])),
  mediumTerm: z.array(StrategicInitiativeSchema),
  longTerm: z.array(StrategicInitiativeSchema),
});

// Growth Acceleration Plan Schema
const GrowthAccelerationPlanSchema = z.object({
  gapId: z.string(),
  companyName: z.string(),
  websiteUrl: z.string(),
  generatedAt: z.string(),
  assessmentSnapshotId: z.string().optional(),
  executiveSummary: ExecutiveSummarySchema,
  quickWins: z.array(QuickWinSchema),
  strategicInitiatives: z.array(StrategicInitiativeSchema),
  focusAreas: z.array(z.any()),
  resourceRequirements: z.array(z.any()),
  timeline: TimelineSchema,
  expectedOutcomes: z.any(),
  risks: z.array(z.any()),
  nextSteps: z.array(z.string()),
  sectionAnalyses: z.any(),
  dataAvailability: z.any(),
  scorecard: ScorecardSchema,
  ctaInsights: CtaInsightsSchema,
  panelHints: PanelHintsSchema,
  socialPresence: SocialPresenceSchema,
  competitorSummary: CompetitorSummarySchema,
});

// API Response Schema
const GrowthPlanApiResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    plan: GrowthAccelerationPlanSchema,
    warnings: z.array(z.string()).optional(),
    diagnostics: z.any().optional(), // Diagnostics JSON from Airtable
    scores: z.object({
      brand: z.number().optional(),
      content: z.number().optional(),
      seo: z.number().optional(),
      websiteUx: z.number().optional(),
    }).optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
    code: z.string().optional(),
  }),
]);

// Type exports
export type Scorecard = z.infer<typeof ScorecardSchema>;
export type CtaInsights = z.infer<typeof CtaInsightsSchema>;
export type PanelHints = z.infer<typeof PanelHintsSchema>;
export type SocialPresence = z.infer<typeof SocialPresenceSchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;
export type CompetitorSummary = z.infer<typeof CompetitorSummarySchema>;
export type QuickWin = z.infer<typeof QuickWinSchema>;
export type StrategicInitiative = z.infer<typeof StrategicInitiativeSchema>;
export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
export type GrowthAccelerationPlan = z.infer<typeof GrowthAccelerationPlanSchema>;
export type GrowthPlanApiResponse = z.infer<typeof GrowthPlanApiResponseSchema>;

/**
 * Fetch Growth Acceleration Plan from API
 */
export async function fetchGrowthPlan(
  url: string,
  snapshotId?: string
): Promise<GrowthPlanApiResponse> {
  const response = await fetch('/api/growth-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      snapshotId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Failed to fetch growth plan';
    let errorCode: string | undefined;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorMessage;
      errorCode = errorJson.code;
    } catch {
      errorMessage = errorText || `HTTP ${response.status}`;
      errorCode = response.status.toString();
    }

    return {
      ok: false,
      error: errorMessage,
      code: errorCode,
    };
  }

  const data = await response.json();

  // The API returns { ok: true, plan: {...} } or { ok: false, error: string }
  // Transform to match our schema
  if (data.ok === false) {
    return {
      ok: false,
      error: data.error || 'Unknown error',
      code: data.code,
    };
  }

  if (data.ok === true && data.plan) {
    // Validate plan structure
    const validated = GrowthAccelerationPlanSchema.safeParse(data.plan);
    
    if (!validated.success) {
      console.warn('Plan validation failed:', validated.error);
      // Return anyway but mark as potentially invalid
      return {
        ok: true,
        plan: data.plan as GrowthAccelerationPlan,
        warnings: ['Plan structure validation failed, but data returned'],
      };
    }

    return {
      ok: true,
      plan: validated.data,
      warnings: data.warnings,
    };
  }

  return {
    ok: false,
    error: 'Invalid response format from API',
    code: 'VALIDATION_ERROR',
  };
}

/**
 * Fetch Growth Acceleration Plan from Airtable by fullReportId
 */
export async function fetchGrowthPlanByReportId(
  fullReportId: string
): Promise<GrowthPlanApiResponse> {
  try {
    const response = await fetch(`/api/full-report?fullReportId=${fullReportId}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch report';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }

      return {
        ok: false,
        error: errorMessage,
        code: response.status.toString(),
      };
    }

    const data = await response.json();

    if (data.ok === false) {
      return {
        ok: false,
        error: data.error || 'Unknown error',
        code: data.code,
      };
    }

    if (data.ok === true && data.plan) {
      return {
        ok: true,
        plan: data.plan as GrowthAccelerationPlan,
        warnings: data.warnings,
        diagnostics: data.diagnostics,
        scores: data.scores,
      };
    }

    return {
      ok: false,
      error: 'Invalid response format from API',
      code: 'VALIDATION_ERROR',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'FETCH_ERROR',
    };
  }
}

/**
 * Fetch Growth Acceleration Plan from Airtable by gapId
 */
export async function fetchGrowthPlanByGapId(
  gapId: string
): Promise<GrowthPlanApiResponse> {
  try {
    const response = await fetch(`/api/full-report?gapId=${encodeURIComponent(gapId)}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch report';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }

      return {
        ok: false,
        error: errorMessage,
        code: response.status.toString(),
      };
    }

    const data = await response.json();

    if (data.ok === false) {
      return {
        ok: false,
        error: data.error || 'Unknown error',
        code: data.code,
      };
    }

    if (data.ok === true && data.plan) {
      return {
        ok: true,
        plan: data.plan as GrowthAccelerationPlan,
        warnings: data.warnings,
        diagnostics: data.diagnostics,
        scores: data.scores,
      };
    }

    return {
      ok: false,
      error: 'Invalid response format from API',
      code: 'VALIDATION_ERROR',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'FETCH_ERROR',
    };
  }
}

/**
 * Helper to categorize initiatives by days (0-30, 30-60, 60-90, 90+)
 */
export function categorizeByDays(
  initiatives: StrategicInitiative[]
): {
  '0-30': StrategicInitiative[];
  '30-60': StrategicInitiative[];
  '60-90': StrategicInitiative[];
  '90+': StrategicInitiative[];
} {
  const buckets = {
    '0-30': [] as StrategicInitiative[],
    '30-60': [] as StrategicInitiative[],
    '60-90': [] as StrategicInitiative[],
    '90+': [] as StrategicInitiative[],
  };

  for (const initiative of initiatives) {
    const timeframe = initiative.totalDuration || initiative.estimatedEffort || '';
    const lower = timeframe.toLowerCase();

    let days: number | null = null;

    // Extract days
    const daysMatch = lower.match(/(\d+)\s*day/i);
    if (daysMatch) {
      days = parseInt(daysMatch[1]);
    }

    // Extract weeks
    if (days === null) {
      const weeksMatch = lower.match(/(\d+)\s*week/i);
      if (weeksMatch) {
        days = parseInt(weeksMatch[1]) * 7;
      }
    }

    // Extract months - handle ranges like "3-6 months"
    if (days === null) {
      const rangeMatch = lower.match(/(\d+)\s*-\s*(\d+)\s*month/i);
      const singleMatch = lower.match(/(\d+)\s*month/i);
      
      if (rangeMatch) {
        // For ranges, use the upper bound (e.g., "3-6 months" -> 6 months = 180 days)
        const maxMonths = parseInt(rangeMatch[2]);
        days = maxMonths * 30;
      } else if (singleMatch) {
        const months = parseInt(singleMatch[1]);
        days = months * 30;
      }
    }

    // Fallback to timeHorizon if timeframe parsing failed
    if (days === null) {
      if (initiative.timeHorizon === 'short_term') {
        days = 45; // ~1.5 months
      } else if (initiative.timeHorizon === 'medium_term') {
        days = 135; // ~4.5 months
      } else if (initiative.timeHorizon === 'long_term') {
        days = 180; // 6+ months
      } else {
        days = 90; // default
      }
    }

    // Categorize into buckets
    if (days <= 30) {
      buckets['0-30'].push(initiative);
    } else if (days <= 60) {
      buckets['30-60'].push(initiative);
    } else if (days <= 90) {
      buckets['60-90'].push(initiative);
    } else {
      buckets['90+'].push(initiative);
    }
  }

  return buckets;
}
