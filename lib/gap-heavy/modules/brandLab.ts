// lib/gap-heavy/modules/brandLab.ts
// Brand Lab V1 - Brand Diagnostic Tool
//
// This module defines the type system for Brand Lab diagnostics and action plans.
// Mirrors the Website Lab structure but focused on brand health, clarity, and coherence.

import { z } from 'zod';

// ============================================================================
// BRAND DIAGNOSTIC RESULT - Core Analysis Output
// ============================================================================

export const BrandPillarSchema = z.object({
  name: z.string(),
  description: z.string(),
  isExplicit: z.boolean().describe('Brand explicitly states this'),
  isPerceived: z.boolean().describe('We infer this from their content'),
  strengthScore: z.number().min(0).max(100),
});

export type BrandPillar = z.infer<typeof BrandPillarSchema>;

export const BrandIdentitySystemSchema = z.object({
  tagline: z.string().optional(),
  taglineClarityScore: z.number().min(0).max(100),
  corePromise: z.string().optional(),
  corePromiseClarityScore: z.number().min(0).max(100),
  toneOfVoice: z.string().describe('e.g. professional, friendly, authoritative'),
  toneConsistencyScore: z.number().min(0).max(100),
  personalityTraits: z.array(z.string()).describe('e.g. ["confident", "friendly", "innovative"]'),
  identityGaps: z.array(z.string()).describe('Missing or unclear identity elements'),
});

export type BrandIdentitySystem = z.infer<typeof BrandIdentitySystemSchema>;

export const BrandValuePropSchema = z.object({
  statement: z.string(),
  clarityScore: z.number().min(0).max(100),
  specificityScore: z.number().min(0).max(100),
  uniquenessScore: z.number().min(0).max(100),
  resonanceScore: z.number().min(0).max(100),
  notes: z.string().optional(),
});

export type BrandValueProp = z.infer<typeof BrandValuePropSchema>;

export const BrandMessagingSystemSchema = z.object({
  headlinePatterns: z.array(z.string()).describe('Sample headlines from site'),
  valueProps: z.array(BrandValuePropSchema),
  differentiators: z.array(z.string()),
  benefitVsFeatureRatio: z.number().min(0).max(100).describe('0 = all features, 100 = all benefits'),
  icpClarityScore: z.number().min(0).max(100).describe('How clear is who this is for'),
  messagingFocusScore: z.number().min(0).max(100).describe('How focused vs scattered'),
  clarityIssues: z.array(z.string()),
});

export type BrandMessagingSystem = z.infer<typeof BrandMessagingSystemSchema>;

export const BrandPositioningDiagnosticSchema = z.object({
  positioningTheme: z.string().describe('e.g. "Efficiency-focused partner for early-stage businesses"'),
  positioningClarityScore: z.number().min(0).max(100),
  competitiveAngle: z.string().describe('e.g. "speed", "affordability", "specialization"'),
  isClearWhoThisIsFor: z.boolean(),
  positioningRisks: z.array(z.string()),
});

export type BrandPositioningDiagnostic = z.infer<typeof BrandPositioningDiagnosticSchema>;

export const BrandAudienceFitSchema = z.object({
  primaryICPDescription: z.string(),
  icpSignals: z.array(z.string()).describe('What we see on site that indicates ICP'),
  alignmentScore: z.number().min(0).max(100),
  misalignmentNotes: z.array(z.string()),
});

export type BrandAudienceFit = z.infer<typeof BrandAudienceFitSchema>;

export const BrandTrustProfileSchema = z.object({
  trustArchetype: z.string().describe('e.g. "expert guides", "friendly partner", "authority"'),
  trustSignalsScore: z.number().min(0).max(100).describe('Brand-lens trust evaluation'),
  humanPresenceScore: z.number().min(0).max(100).describe('Founder/team visibility, brand story'),
  credibilityGaps: z.array(z.string()),
});

export type BrandTrustProfile = z.infer<typeof BrandTrustProfileSchema>;

export const BrandVisualProfileSchema = z.object({
  paletteDescriptor: z.string().describe('Brief human language summary of colors'),
  visualPersonalityWords: z.array(z.string()).describe('e.g. ["modern", "playful", "corporate"]'),
  visualConsistencyScore: z.number().min(0).max(100),
  brandRecognitionScore: z.number().min(0).max(100).describe('How memorable/distinctive'),
  logoUsageNotes: z.string().optional(),
  visualGaps: z.array(z.string()),
});

export type BrandVisualProfile = z.infer<typeof BrandVisualProfileSchema>;

export const BrandAssetsInventorySchema = z.object({
  hasLogoVariants: z.boolean(),
  hasFavicons: z.boolean(),
  hasIllustrationStyle: z.boolean(),
  hasPhotographyStyle: z.boolean(),
  hasIconSystem: z.boolean(),
  hasBrandGuidelines: z.boolean(),
  assetCoverageScore: z.number().min(0).max(100),
  assetNotes: z.array(z.string()),
});

export type BrandAssetsInventory = z.infer<typeof BrandAssetsInventorySchema>;

export const BrandInconsistencySchema = z.object({
  id: z.string(),
  type: z.enum(['tone', 'visual', 'promise', 'audience', 'offer']),
  location: z.string().describe('Page or context where found'),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
});

export type BrandInconsistency = z.infer<typeof BrandInconsistencySchema>;

export const BrandOpportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  theme: z.enum(['clarity', 'differentiation', 'trust', 'coherence', 'visual', 'story']),
  estimatedImpactScore: z.number().min(1).max(5),
  area: z.enum(['brand', 'content', 'website', 'seo', 'authority']),
});

export type BrandOpportunity = z.infer<typeof BrandOpportunitySchema>;

export const BrandRiskSchema = z.object({
  id: z.string(),
  description: z.string(),
  severity: z.number().min(1).max(5),
  riskType: z.enum(['confusion', 'misalignment', 'generic_positioning', 'trust', 'inconsistency']),
});

export type BrandRisk = z.infer<typeof BrandRiskSchema>;

export const BrandPersonaSignalsSchema = z.object({
  personaType: z.string(),
  signalsFound: z.array(z.string()),
  resonanceScore: z.number().min(0).max(100),
  notes: z.string().optional(),
});

export type BrandPersonaSignals = z.infer<typeof BrandPersonaSignalsSchema>;

export const BrandDiagnosticResultSchema = z.object({
  score: z.number().min(0).max(100),
  benchmarkLabel: z.enum(['weak', 'developing', 'solid', 'strong', 'category_leader']),
  summary: z.string(),

  // Core diagnostic sections
  brandPillars: z.array(BrandPillarSchema),
  identitySystem: BrandIdentitySystemSchema,
  messagingSystem: BrandMessagingSystemSchema,
  positioning: BrandPositioningDiagnosticSchema,
  audienceFit: BrandAudienceFitSchema,
  trustAndProof: BrandTrustProfileSchema,
  visualSystem: BrandVisualProfileSchema,
  brandAssets: BrandAssetsInventorySchema,

  // Issues and opportunities
  inconsistencies: z.array(BrandInconsistencySchema),
  opportunities: z.array(BrandOpportunitySchema),
  risks: z.array(BrandRiskSchema),

  // Optional
  personas: z.array(BrandPersonaSignalsSchema).optional(),
  notes: z.string().optional(),
});

export type BrandDiagnosticResult = z.infer<typeof BrandDiagnosticResultSchema>;

// ============================================================================
// BRAND ACTION PLAN - Action-First Output
// ============================================================================

export type BrandDimension =
  | 'identity'
  | 'messaging'
  | 'positioning'
  | 'visual'
  | 'trust'
  | 'audience_fit'
  | 'assets';

export type BrandServiceArea =
  | 'brand'
  | 'content'
  | 'website'
  | 'authority'
  | 'cross_cutting';

export type BrandPriorityBucket = 'now' | 'next' | 'later';

export type BrandWorkItemStatus = 'backlog' | 'planned' | 'in_progress' | 'done';

export const BrandActionThemeSchema = z.object({
  id: z.string(),
  label: z.string().describe('e.g. "Clarify Core Promise", "Elevate Trust & Human Presence"'),
  description: z.string(),
  priority: z.enum(['critical', 'important', 'nice_to_have']),
  linkedDimensions: z.array(z.string()),
  expectedImpactSummary: z.string(),
});

export type BrandActionTheme = z.infer<typeof BrandActionThemeSchema>;

export const BrandWorkItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  rationale: z.string().describe('Why this matters for the business'),
  evidenceRefs: z.array(z.string()).describe('Refs into diagnostic: pillars, inconsistencies, etc.'),
  dimension: z.enum(['identity', 'messaging', 'positioning', 'visual', 'trust', 'audience_fit', 'assets']),
  serviceArea: z.enum(['brand', 'content', 'website', 'authority', 'cross_cutting']),
  impactScore: z.number().min(1).max(5),
  effortScore: z.number().min(1).max(5),
  estimatedLift: z.union([z.number(), z.string()]).optional().describe('Percentage or qualitative'),
  priority: z.enum(['now', 'next', 'later']),
  recommendedAssigneeRole: z.string().optional().describe('e.g. "Brand Strategist", "Copywriter"'),
  recommendedTimebox: z.string().optional().describe('e.g. "1-2 days", "1 week"'),
  status: z.enum(['backlog', 'planned', 'in_progress', 'done']),
  tags: z.array(z.string()),
});

export type BrandWorkItem = z.infer<typeof BrandWorkItemSchema>;

export const BrandStrategyChangeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  reasoning: z.string(),
  linkedFindings: z.array(z.string()),
});

export type BrandStrategyChange = z.infer<typeof BrandStrategyChangeSchema>;

export const BrandExperimentSchema = z.object({
  id: z.string(),
  hypothesis: z.string(),
  metric: z.string(),
  description: z.string(),
  expectedImpact: z.string(),
  effortScore: z.number().min(1).max(5),
});

export type BrandExperiment = z.infer<typeof BrandExperimentSchema>;

export const BrandActionPlanSchema = z.object({
  summary: z.string().describe('Short, action-focused summary'),
  overallScore: z.number().min(0).max(100),
  benchmarkLabel: z.enum(['weak', 'developing', 'solid', 'strong', 'category_leader']),

  keyThemes: z.array(BrandActionThemeSchema),

  // Priority buckets
  now: z.array(BrandWorkItemSchema),
  next: z.array(BrandWorkItemSchema),
  later: z.array(BrandWorkItemSchema),

  strategicChanges: z.array(BrandStrategyChangeSchema),
  experiments: z.array(BrandExperimentSchema).optional(),
});

export type BrandActionPlan = z.infer<typeof BrandActionPlanSchema>;

// ============================================================================
// BRAND LAB RESULT - Complete Output
// ============================================================================

export const BrandLabResultSchema = z.object({
  diagnostic: BrandDiagnosticResultSchema,
  actionPlan: BrandActionPlanSchema,
  // Future: narrativeReport
});

export type BrandLabResult = z.infer<typeof BrandLabResultSchema>;

// ============================================================================
// BRAND COMPETITIVE LAYER (V4)
// ============================================================================

export const BrandCompetitorSummarySchema = z.object({
  name: z.string(),
  url: z.string(),
  positioningSnippet: z.string().describe('How competitor positions themselves'),
  estimatedAngle: z.string().describe('e.g., "low-cost", "premium", "specialized"'),
  notes: z.string(),
});

export type BrandCompetitorSummary = z.infer<typeof BrandCompetitorSummarySchema>;

export const BrandCompetitiveLandscapeSchema = z.object({
  primaryCompetitors: z.array(BrandCompetitorSummarySchema),
  categoryLanguagePatterns: z.array(z.string()).describe('Common phrases/clichés in the category'),
  differentiationScore: z.number().min(0).max(100).describe('How differentiated is the brand'),
  clicheDensityScore: z.number().min(0).max(100).describe('How much generic/cliché language is used'),
  whiteSpaceOpportunities: z.array(z.string()).describe('Positioning opportunities not claimed by competitors'),
  similarityNotes: z.array(z.string()).describe('Where brand blends in with competitors'),
});

export type BrandCompetitiveLandscape = z.infer<typeof BrandCompetitiveLandscapeSchema>;

// ============================================================================
// BRAND NARRATIVE REPORT
// ============================================================================

export const BrandNarrativeReportSchema = z.object({
  meta: z.object({
    generatedAt: z.string(),
    companyName: z.string(),
    websiteUrl: z.string(),
    brandScore: z.number(),
    benchmarkLabel: z.string(),
  }),
  executiveSummary: z.string().describe('2-3 paragraph overview'),
  brandStorySection: z.string().describe('Analysis of brand story and origin'),
  positioningSection: z.string().describe('Positioning analysis'),
  messagingSection: z.string().describe('Messaging clarity and effectiveness'),
  trustSection: z.string().describe('Trust and credibility analysis'),
  visualSection: z.string().describe('Visual brand system analysis'),
  audienceFitSection: z.string().describe('ICP alignment analysis'),
  priorityThemesSection: z.string().describe('Key themes for improvement'),
  quickWinsBullets: z.array(z.string()),
  strategicInitiativesBullets: z.array(z.string()),
  risksSection: z.string().describe('Brand risks and mitigation'),
  recommendedSequencingSection: z.string().describe('NOW/NEXT/LATER sequencing'),
});

export type BrandNarrativeReport = z.infer<typeof BrandNarrativeReportSchema>;

// ============================================================================
// BRAND FOR GAP INTEGRATION
// ============================================================================

export const BrandForGapSchema = z.object({
  brandScore: z.number(),
  benchmarkLabel: z.string(),
  corePromise: z.string().nullable(),
  tagline: z.string().nullable(),
  positioningTheme: z.string(),
  icpSummary: z.string(),
  keyBrandStrengths: z.array(z.string()),
  keyBrandWeaknesses: z.array(z.string()),
  topBrandRisks: z.array(z.string()),
  recommendedBrandWorkItems: z.array(z.string()),
});

export type BrandForGap = z.infer<typeof BrandForGapSchema>;

// ============================================================================
// EXTENDED BRAND DIAGNOSTIC RESULT (with Competitive Layer)
// ============================================================================

// Extend the existing schema to include competitive landscape
export const BrandDiagnosticResultWithCompetitiveSchema = BrandDiagnosticResultSchema.extend({
  competitiveLandscape: BrandCompetitiveLandscapeSchema.optional(),
});

export type BrandDiagnosticResultWithCompetitive = z.infer<typeof BrandDiagnosticResultWithCompetitiveSchema>;

// ============================================================================
// EXTENDED BRAND LAB RESULT (with Narrative)
// ============================================================================

export const BrandLabResultWithNarrativeSchema = z.object({
  diagnostic: BrandDiagnosticResultWithCompetitiveSchema,
  actionPlan: BrandActionPlanSchema,
  narrativeReport: BrandNarrativeReportSchema.optional(),
});

export type BrandLabResultWithNarrative = z.infer<typeof BrandLabResultWithNarrativeSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getBenchmarkLabel(score: number): BrandDiagnosticResult['benchmarkLabel'] {
  if (score >= 90) return 'category_leader';
  if (score >= 75) return 'strong';
  if (score >= 60) return 'solid';
  if (score >= 45) return 'developing';
  return 'weak';
}

export function dimensionToServiceArea(dimension: BrandDimension): BrandServiceArea {
  const mapping: Record<BrandDimension, BrandServiceArea> = {
    identity: 'brand',
    messaging: 'content',
    positioning: 'brand',
    visual: 'brand',
    trust: 'brand',
    audience_fit: 'brand',
    assets: 'brand',
  };
  return mapping[dimension];
}
