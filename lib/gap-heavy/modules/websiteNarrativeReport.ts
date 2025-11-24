/**
 * Website V5 Deep Narrative Engine
 *
 * Generates consultant-grade, long-form narrative reports from Website Lab results.
 * This is NOT an internal action plan tool - it's a client-facing interpretive report.
 *
 * Purpose:
 * - Take Website Lab V4/V5 results and synthesize into readable prose
 * - Generate downloadable/printable reports for GAP-Full Report system
 * - Provide explanatory, persuasive, structured consultant-grade narratives
 */

import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────────────
// Core Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * Benchmark label for overall website performance
 */
export type WebsiteNarrativeBenchmark = 'leader' | 'strong' | 'average' | 'weak';

/**
 * A single section of the narrative report
 */
export interface WebsiteNarrativeSection {
  /**
   * Unique identifier for this section (e.g. "hero_value_prop", "conversion_flow")
   */
  id: string;

  /**
   * Display title for the section
   */
  title: string;

  /**
   * Sort order (lower numbers appear first)
   */
  order: number;

  /**
   * Optional bullet points to surface key insights (3-5 bullets)
   */
  summaryBulletPoints?: string[];

  /**
   * Rich, multi-paragraph markdown narrative body.
   * Should be interpretive, explanatory, and reference specific evidence.
   */
  bodyMarkdown: string;
}

/**
 * Key statistics to display as headline metrics
 */
export interface WebsiteNarrativeKeyStats {
  overallScore: number;
  funnelHealthScore?: number;
  trustScore?: number;
  contentClarityScore?: number;
  conversionReadinessScore?: number;
  visualModernityScore?: number;
  personaSuccessRate?: number; // 0-100, % of personas that succeeded
  criticalIssuesCount?: number;
  quickWinsCount?: number;
}

/**
 * Full narrative report structure
 */
export interface WebsiteNarrativeReport {
  /**
   * Report title (e.g. "Website Experience Diagnostic Report")
   */
  title: string;

  /**
   * Company name
   */
  companyName: string;

  /**
   * Website URL analyzed
   */
  websiteUrl: string;

  /**
   * ISO timestamp of generation
   */
  generatedAt: string;

  /**
   * Overall website score (0-100)
   */
  overallScore: number;

  /**
   * Benchmark label for the score
   */
  benchmarkLabel: WebsiteNarrativeBenchmark;

  /**
   * Executive summary (1-3 pages of prose, markdown format)
   * Should cover:
   * - Overall score & benchmark
   * - 3-5 core findings
   * - 3-5 top opportunities/themes
   * - Impact narrative ("What happens if we fix this?")
   */
  executiveSummaryMarkdown: string;

  /**
   * Optional headline metrics to display
   */
  keyStats?: WebsiteNarrativeKeyStats;

  /**
   * Ordered sections of the report
   */
  sections: WebsiteNarrativeSection[];

  /**
   * Optional metadata about the analysis
   */
  metadata?: {
    pagesAnalyzed?: number;
    personasTested?: number;
    heuristicsFlagged?: number;
    analysisDepth?: 'basic' | 'standard' | 'comprehensive';
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Zod Schemas
// ────────────────────────────────────────────────────────────────────────────

export const WebsiteNarrativeBenchmarkSchema = z.enum([
  'leader',
  'strong',
  'average',
  'weak',
]);

export const WebsiteNarrativeSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  order: z.number(),
  summaryBulletPoints: z.array(z.string()).optional(),
  bodyMarkdown: z.string().min(1),
});

export const WebsiteNarrativeKeyStatsSchema = z.object({
  overallScore: z.number().min(0).max(100),
  funnelHealthScore: z.number().min(0).max(100).optional(),
  trustScore: z.number().min(0).max(100).optional(),
  contentClarityScore: z.number().min(0).max(100).optional(),
  conversionReadinessScore: z.number().min(0).max(100).optional(),
  visualModernityScore: z.number().min(0).max(100).optional(),
  personaSuccessRate: z.number().min(0).max(100).optional(),
  criticalIssuesCount: z.number().min(0).optional(),
  quickWinsCount: z.number().min(0).optional(),
});

export const WebsiteNarrativeReportSchema = z.object({
  title: z.string().min(1),
  companyName: z.string().min(1),
  websiteUrl: z.string().url(),
  generatedAt: z.string().datetime(),
  overallScore: z.number().min(0).max(100),
  benchmarkLabel: WebsiteNarrativeBenchmarkSchema,
  executiveSummaryMarkdown: z.string().min(50),
  keyStats: WebsiteNarrativeKeyStatsSchema.optional(),
  sections: z.array(WebsiteNarrativeSectionSchema),
  metadata: z
    .object({
      pagesAnalyzed: z.number().min(0).optional(),
      personasTested: z.number().min(0).optional(),
      heuristicsFlagged: z.number().min(0).optional(),
      analysisDepth: z.enum(['basic', 'standard', 'comprehensive']).optional(),
    })
    .optional(),
});

// ────────────────────────────────────────────────────────────────────────────
// Standard Section IDs
// ────────────────────────────────────────────────────────────────────────────

/**
 * Standard section IDs for consistent report structure
 */
export const NARRATIVE_SECTION_IDS = {
  EXECUTIVE_SUMMARY: 'executive_summary', // Usually in executiveSummaryMarkdown
  DIAGNOSTIC_OVERVIEW: 'diagnostic_overview',
  HERO_VALUE_PROP: 'hero_value_prop',
  NAVIGATION_STRUCTURE: 'navigation_structure',
  CONVERSION_FLOW: 'conversion_flow',
  TRUST_SOCIAL_PROOF: 'trust_social_proof',
  CONTENT_CLARITY: 'content_clarity',
  VISUAL_BRAND: 'visual_brand',
  PERSONA_JOURNEYS: 'persona_journeys',
  SCENT_TRAIL: 'scent_trail',
  PRIORITY_THEMES: 'priority_themes',
  APPENDIX: 'appendix',
} as const;

/**
 * Standard section order
 */
export const NARRATIVE_SECTION_ORDER: Record<string, number> = {
  [NARRATIVE_SECTION_IDS.DIAGNOSTIC_OVERVIEW]: 10,
  [NARRATIVE_SECTION_IDS.HERO_VALUE_PROP]: 20,
  [NARRATIVE_SECTION_IDS.NAVIGATION_STRUCTURE]: 30,
  [NARRATIVE_SECTION_IDS.CONVERSION_FLOW]: 40,
  [NARRATIVE_SECTION_IDS.TRUST_SOCIAL_PROOF]: 50,
  [NARRATIVE_SECTION_IDS.CONTENT_CLARITY]: 60,
  [NARRATIVE_SECTION_IDS.VISUAL_BRAND]: 70,
  [NARRATIVE_SECTION_IDS.PERSONA_JOURNEYS]: 80,
  [NARRATIVE_SECTION_IDS.SCENT_TRAIL]: 90,
  [NARRATIVE_SECTION_IDS.PRIORITY_THEMES]: 100,
  [NARRATIVE_SECTION_IDS.APPENDIX]: 110,
};
