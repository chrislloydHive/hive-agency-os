// lib/labs/competitor/competitorLab.ts
// Competitor Lab - Competitive Analysis Refinement Runner
//
// Analyzes and refines competitive intelligence in the Context Graph:
// - Identifies and profiles competitors
// - Defines positioning axes
// - Creates positioning map
// - Feature matrix extraction
// - Pricing landscape analysis
// - Messaging overlap detection
// - Market cluster analysis
// - Threat modeling
// - Substitute detection
// - Whitespace opportunity mapping

import { z } from 'zod';
import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { setFieldUntyped, createProvenance } from '@/lib/contextGraph/mutate';
import { COMPETITOR_LAB_SYSTEM_PROMPT, generateCompetitorLabTaskPrompt, type CompetitorLabTaskInput } from './prompts';
import {
  dedupeCompetitors,
  mergeCompetitorLists,
  sanitizeCompetitorProfile,
  isValidCompetitorProfile,
  filterOutAgencies,
  type MergeStats,
} from './mergeCompetitors';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import {
  type CompetitorProfile,
  type PricingModel,
  type MessageOverlap,
  type MarketCluster,
  type ThreatScore,
  type Substitute,
  type WhitespaceOpportunity,
  type PositioningAxes,
  CompetitorProfile as CompetitorProfileSchema,
  FeatureMatrixEntry as FeatureMatrixEntrySchema,
  PricingModel as PricingModelSchema,
  MessageOverlap as MessageOverlapSchema,
  MarketCluster as MarketClusterSchema,
  ThreatScore as ThreatScoreSchema,
  Substitute as SubstituteSchema,
  WhitespaceOpportunity as WhitespaceOpportunitySchema,
  PositioningAxes as PositioningAxesSchema,
  PriceTier as PriceTierSchema,
} from '@/lib/contextGraph/domains/competitive';

// ============================================================================
// Types
// ============================================================================

export interface CompetitorLabInput {
  companyId: string;
  forceRun?: boolean;
  dryRun?: boolean;
}

export interface CompetitorLabResult {
  success: boolean;
  refinedContext: RefinedField[];
  diagnostics: LabDiagnostic[];
  summary?: string;
  applyResult?: ApplyResult;
  mergeStats?: MergeStats;
  validationStats?: ValidationStats;
  durationMs: number;
  runAt: string;
}

interface ValidationStats {
  competitorsValidated: number;
  competitorsInvalid: number;
  agenciesFiltered: number;  // Agencies/service providers rejected
  featuresValidated: number;
  pricingModelsValidated: number;
  clustersValidated: number;
  threatsValidated: number;
  substitutesValidated: number;
}

interface RefinedField {
  path: string;
  newValue: unknown;
  confidence: number;
  reason?: string;
  previousValue?: unknown;
}

interface LabDiagnostic {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  fieldPath?: string;
}

interface ApplyResult {
  attempted: number;
  updated: number;
  skippedHumanOverride: number;
  skippedHigherPriority: number;
  errors: string[];
}

// ============================================================================
// Response Schema
// ============================================================================

/**
 * Full Competitor Lab response schema - matches the expanded prompts
 */
const CompetitorLabResponseSchema = z.object({
  refinedContext: z.object({
    // Competitors
    competitors: z.array(z.object({
      name: z.string(),
      domain: z.string().nullable().optional(),
      category: z.enum(['direct', 'indirect', 'aspirational', 'emerging']).nullable().optional(),
      positioning: z.string().nullable().optional(),
      strengths: z.array(z.string()).default([]),
      weaknesses: z.array(z.string()).default([]),
      uniqueClaims: z.array(z.string()).default([]),
      offers: z.array(z.string()).default([]),
      xPosition: z.number().min(-100).max(100).nullable().optional(),
      yPosition: z.number().min(-100).max(100).nullable().optional(),
      confidence: z.number().min(0).max(1).default(0.5),
      trajectory: z.enum(['rising', 'falling', 'stagnant']).nullable().optional(),
      trajectoryReason: z.string().nullable().optional(),
      threatLevel: z.number().min(0).max(100).nullable().optional(),
      threatDrivers: z.array(z.string()).default([]),
    })).optional().default([]),

    // Positioning Axes
    positioningAxes: z.object({
      primaryAxis: z.object({
        label: z.string(),
        lowLabel: z.string(),
        highLabel: z.string(),
        description: z.string().nullable().optional(),
      }).nullable().optional(),
      secondaryAxis: z.object({
        label: z.string(),
        lowLabel: z.string(),
        highLabel: z.string(),
        description: z.string().nullable().optional(),
      }).nullable().optional(),
    }).nullable().optional(),

    // Own Position
    ownPosition: z.object({
      x: z.number().min(-100).max(100),
      y: z.number().min(-100).max(100),
    }).nullable().optional(),

    positionSummary: z.string().nullable().optional(),

    // Whitespace
    whitespaceOpportunities: z.array(z.object({
      name: z.string(),
      description: z.string().nullable().optional(),
      position: z.object({
        x: z.number().min(-100).max(100),
        y: z.number().min(-100).max(100),
      }),
      size: z.number().min(0).max(100).default(50),
      strategicFit: z.number().min(0).max(100).default(50),
      captureActions: z.array(z.string()).default([]),
    })).optional().default([]),

    // Feature Matrix
    featuresMatrix: z.array(z.object({
      featureName: z.string(),
      description: z.string().nullable().optional(),
      companySupport: z.boolean(),
      competitors: z.array(z.object({
        name: z.string(),
        hasFeature: z.boolean(),
        notes: z.string().nullable().optional(),
      })).default([]),
      importance: z.number().min(0).max(100).default(50),
    })).optional().default([]),

    // Pricing
    pricingModels: z.array(z.object({
      competitorName: z.string(),
      priceTier: z.enum(['low', 'medium', 'high', 'premium', 'enterprise']),
      pricingNotes: z.string().nullable().optional(),
      inferredPricePoint: z.number().nullable().optional(),
      valueForMoneyScore: z.number().min(0).max(100).default(50),
      modelType: z.string().nullable().optional(),
    })).optional().default([]),
    ownPriceTier: z.enum(['low', 'medium', 'high', 'premium', 'enterprise']).nullable().optional(),

    // Messaging Overlap
    messageOverlap: z.array(z.object({
      theme: z.string(),
      competitorsUsingIt: z.array(z.string()).default([]),
      overlapScore: z.number().min(0).max(100).default(0),
      suggestion: z.string().nullable().optional(),
      companyUsing: z.boolean().default(false),
    })).optional().default([]),
    messagingDifferentiationScore: z.number().min(0).max(100).nullable().optional(),

    // Market Clusters
    marketClusters: z.array(z.object({
      clusterName: z.string(),
      description: z.string().nullable().optional(),
      competitors: z.array(z.string()).default([]),
      clusterPosition: z.object({
        x: z.number().min(-100).max(100),
        y: z.number().min(-100).max(100),
      }),
      threatLevel: z.number().min(0).max(100).default(50),
      whitespaceOpportunity: z.string().nullable().optional(),
    })).optional().default([]),

    // Threat Modeling
    threatScores: z.array(z.object({
      competitorName: z.string(),
      threatLevel: z.number().min(0).max(100),
      threatDrivers: z.array(z.string()).default([]),
      timeHorizon: z.string().nullable().optional(),
      defensiveActions: z.array(z.string()).default([]),
    })).optional().default([]),
    overallThreatLevel: z.number().min(0).max(100).nullable().optional(),

    // Substitutes
    substitutes: z.array(z.object({
      name: z.string(),
      domain: z.string().nullable().optional(),
      reasonCustomersChooseThem: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      threatLevel: z.number().min(0).max(100).default(30),
      counterStrategy: z.string().nullable().optional(),
    })).optional().default([]),

    // Strategy
    differentiationStrategy: z.string().nullable().optional(),
    competitiveAdvantages: z.array(z.string()).optional().default([]),
    competitiveThreats: z.array(z.string()).optional().default([]),
    competitiveOpportunities: z.array(z.string()).optional().default([]),
    marketTrends: z.array(z.string()).optional().default([]),
  }),

  diagnostics: z.array(z.object({
    code: z.string(),
    message: z.string(),
    severity: z.enum(['info', 'warning', 'error']),
    fieldPath: z.string().optional(),
  })).optional().default([]),

  summary: z.object({
    competitorsIdentified: z.number().default(0),
    newCompetitorsFound: z.number().default(0),
    featuresAnalyzed: z.number().default(0),
    whitespaceOpportunitiesFound: z.number().default(0),
    highThreatCompetitors: z.number().default(0),
    messagingOverlapScore: z.number().default(0),
    keyInsight: z.string().optional(),
  }).optional(),
});

// ============================================================================
// Context Builder
// ============================================================================

/**
 * Build task input for the Competitor Lab prompt generator
 */
function buildCompetitorLabTaskInput(
  graph: CompanyContextGraph | null,
  company: { name: string; domain?: string | null },
  websiteContent: string = ''
): CompetitorLabTaskInput {
  const competitive = graph?.competitive;
  const identity = graph?.identity;

  // Build current context from graph
  const competitors = (competitive?.competitors?.value || competitive?.primaryCompetitors?.value || []).map(c => ({
    name: c.name,
    domain: c.domain || c.website || null,
    category: c.category || null,
    positioning: c.positioning || null,
    strengths: c.strengths || [],
    weaknesses: c.weaknesses || [],
    xPosition: c.xPosition ?? null,
    yPosition: c.yPosition ?? null,
    confidence: c.confidence ?? 0.5,
  }));

  const positioningAxes = competitive?.positioningAxes?.value || {
    primaryAxis: competitive?.primaryAxis?.value
      ? { label: competitive.primaryAxis.value, lowLabel: '', highLabel: '' }
      : null,
    secondaryAxis: competitive?.secondaryAxis?.value
      ? { label: competitive.secondaryAxis.value, lowLabel: '', highLabel: '' }
      : null,
  };

  const featuresMatrix = (competitive?.featuresMatrix?.value || []).map(f => ({
    featureName: f.featureName,
    companySupport: f.companySupport,
    competitors: f.competitors || [],
  }));

  const pricingModels = (competitive?.pricingModels?.value || []).map(p => ({
    competitorName: p.competitorName,
    priceTier: p.priceTier,
    valueForMoneyScore: p.valueForMoneyScore ?? 50,
  }));

  const messageOverlap = (competitive?.messageOverlap?.value || []).map(m => ({
    theme: m.theme,
    competitorsUsingIt: m.competitorsUsingIt || [],
    overlapScore: m.overlapScore ?? 0,
  }));

  const marketClusters = (competitive?.marketClusters?.value || []).map(c => ({
    clusterName: c.clusterName,
    competitors: c.competitors || [],
    clusterPosition: c.clusterPosition || { x: 0, y: 0 },
    threatLevel: c.threatLevel ?? 50,
  }));

  const threatScores = (competitive?.threatScores?.value || []).map(t => ({
    competitorName: t.competitorName,
    threatLevel: t.threatLevel,
    threatDrivers: t.threatDrivers || [],
  }));

  const substitutes = (competitive?.substitutes?.value || []).map(s => ({
    name: s.name,
    reasonCustomersChooseThem: s.reasonCustomersChooseThem || null,
    threatLevel: s.threatLevel ?? 30,
  }));

  // Build additional signals from identity and brand
  const signals: string[] = [];
  if (identity?.industry?.value) signals.push(`Industry: ${identity.industry.value}`);
  if (identity?.businessModel?.value) signals.push(`Business Model: ${identity.businessModel.value}`);
  if (identity?.marketPosition?.value) signals.push(`Market Position: ${identity.marketPosition.value}`);
  if (identity?.competitiveLandscape?.value) signals.push(`Competitive Landscape: ${identity.competitiveLandscape.value}`);
  if (graph?.brand?.positioning?.value) signals.push(`Brand Positioning: ${graph.brand.positioning.value}`);
  if (graph?.brand?.differentiators?.value?.length) {
    signals.push(`Differentiators: ${graph.brand.differentiators.value.join(', ')}`);
  }

  return {
    companyName: company.name,
    companyDomain: company.domain || '',
    industry: identity?.industry?.value || null,
    currentContext: {
      competitors,
      positioningAxes,
      positionSummary: competitive?.positionSummary?.value || null,
      whitespaceOpportunities: competitive?.whitespaceOpportunities?.value || [],
      featuresMatrix,
      pricingModels,
      messageOverlap,
      marketClusters,
      threatScores,
      substitutes,
    },
    websiteContent,
    additionalSignals: signals.length > 0 ? signals.join('\n') : null,
  };
}

// ============================================================================
// Validation & Processing
// ============================================================================

/**
 * Validate and sanitize competitors from LLM response
 * Includes agency/service provider filtering to reject non-competitors
 */
function validateCompetitors(
  rawCompetitors: unknown[],
  existingCompetitors: CompetitorProfile[],
  source: string
): {
  validated: CompetitorProfile[];
  stats: { valid: number; invalid: number; agenciesFiltered: number };
  mergeStats: MergeStats;
} {
  const validatedRaw: CompetitorProfile[] = [];
  let invalidCount = 0;

  for (const comp of rawCompetitors) {
    try {
      // Basic validation
      if (!comp || typeof comp !== 'object' || !('name' in comp)) {
        invalidCount++;
        continue;
      }

      // Sanitize using merge utilities
      const sanitized = sanitizeCompetitorProfile(comp as Partial<CompetitorProfile>);

      // Mark as autoSeeded since this is AI-generated
      sanitized.autoSeeded = true;

      // Validate
      if (isValidCompetitorProfile(sanitized)) {
        validatedRaw.push(sanitized);
      } else {
        invalidCount++;
      }
    } catch {
      invalidCount++;
    }
  }

  // AGENCY FILTER: Remove agencies and service providers
  // These have nav patterns like "Services", "Portfolio", "Clients"
  const { competitors: nonAgencies, rejectedAgencies } = filterOutAgencies(validatedRaw);

  if (rejectedAgencies.length > 0) {
    console.log(
      `[CompetitorLab] Filtered out ${rejectedAgencies.length} agencies/service providers:`,
      rejectedAgencies.map(r => `${r.competitor.name} (${r.reason})`).join(', ')
    );
  }

  // Deduplicate the filtered competitors
  const { competitors: deduped } = dedupeCompetitors(nonAgencies, { source });

  // Merge with existing competitors
  const existingCopy = [...existingCompetitors];
  const mergeStats = mergeCompetitorLists(existingCopy, deduped, { source });

  return {
    validated: existingCopy,
    stats: {
      valid: nonAgencies.length,
      invalid: invalidCount,
      agenciesFiltered: rejectedAgencies.length,
    },
    mergeStats,
  };
}

/**
 * Validate array of typed objects
 */
function validateTypedArray<T>(
  rawItems: unknown[],
  schema: z.ZodType<T>,
  defaults: Partial<T> = {}
): { items: T[]; validCount: number } {
  const items: T[] = [];
  let validCount = 0;

  for (const item of rawItems) {
    try {
      // Merge defaults with item safely
      const itemObj = typeof item === 'object' && item !== null ? item : {};
      const merged = { ...defaults, ...itemObj } as unknown;
      const parsed = schema.parse(merged);
      items.push(parsed);
      validCount++;
    } catch {
      // Skip invalid items
    }
  }

  return { items, validCount };
}

// ============================================================================
// Apply Refinements
// ============================================================================

/**
 * Apply validated refinements to the context graph
 */
async function applyRefinements(
  companyId: string,
  refinements: RefinedField[],
  dryRun: boolean
): Promise<ApplyResult> {
  const result: ApplyResult = {
    attempted: refinements.length,
    updated: 0,
    skippedHumanOverride: 0,
    skippedHigherPriority: 0,
    errors: [],
  };

  if (dryRun) {
    console.log('[CompetitorLab] Dry run - not applying refinements');
    return result;
  }

  // Load the context graph
  let graph = await loadContextGraph(companyId);
  if (!graph) {
    result.errors.push('Failed to load context graph');
    return result;
  }

  const runId = `competitor-lab-${Date.now()}`;

  for (const refinement of refinements) {
    try {
      const [domain, field] = refinement.path.split('.');
      const provenance = createProvenance('competitor_lab', {
        confidence: refinement.confidence,
        runId,
        notes: refinement.reason,
      });

      graph = setFieldUntyped(
        graph,
        domain,
        field,
        refinement.newValue,
        provenance
      );
      result.updated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('human override') || message.includes('higher priority')) {
        result.skippedHumanOverride++;
      } else {
        result.errors.push(`${refinement.path}: ${message}`);
      }
    }
  }

  // Save the updated graph
  if (result.updated > 0) {
    await saveContextGraph(graph, 'competitor_lab');
    console.log(`[CompetitorLab] Saved ${result.updated} refinements`);
  }

  return result;
}

// ============================================================================
// Main Runner
// ============================================================================

/**
 * Run Competitor Lab refinement
 *
 * Analyzes competitive landscape and refines competitive context in Brain.
 * Uses expanded prompts for full competitive intelligence analysis including:
 * - Competitor profiles with trajectories and threats
 * - Feature matrix extraction
 * - Pricing landscape analysis
 * - Messaging overlap detection
 * - Market cluster analysis
 * - Substitute detection
 * - Whitespace opportunity mapping
 */
export async function runCompetitorLabRefinement(
  input: CompetitorLabInput
): Promise<CompetitorLabResult> {
  const { companyId, forceRun, dryRun } = input;
  const startTime = Date.now();
  const runAt = new Date().toISOString();
  const source = 'competitor_lab';

  console.log(`[CompetitorLab] Starting refinement for ${companyId}`);

  const result: CompetitorLabResult = {
    success: false,
    refinedContext: [],
    diagnostics: [],
    durationMs: 0,
    runAt,
  };

  const validationStats: ValidationStats = {
    competitorsValidated: 0,
    competitorsInvalid: 0,
    agenciesFiltered: 0,
    featuresValidated: 0,
    pricingModelsValidated: 0,
    clustersValidated: 0,
    threatsValidated: 0,
    substitutesValidated: 0,
  };

  try {
    // 1. Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      result.diagnostics.push({
        code: 'company_not_found',
        message: `Company not found: ${companyId}`,
        severity: 'error',
      });
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // 2. Load context graph
    const graph = await loadContextGraph(companyId);

    // 3. Check if refinement is needed (only if we have comprehensive competitive context)
    const existingCompetitors = graph?.competitive?.competitors?.value || graph?.competitive?.primaryCompetitors?.value || [];
    const hasCompetitors = existingCompetitors.length >= 3;
    const hasAxes = graph?.competitive?.primaryAxis?.value && graph?.competitive?.secondaryAxis?.value;
    const hasFeatureMatrix = (graph?.competitive?.featuresMatrix?.value?.length || 0) >= 3;
    const hasClusters = (graph?.competitive?.marketClusters?.value?.length || 0) >= 1;

    if (!forceRun && hasCompetitors && hasAxes && hasFeatureMatrix && hasClusters) {
      console.log('[CompetitorLab] Comprehensive competitive context already populated, skipping');
      result.diagnostics.push({
        code: 'context_complete',
        message: 'Comprehensive competitive context is already populated. Use forceRun to regenerate.',
        severity: 'info',
      });
      result.success = true;
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // 4. Build task input for prompt generator
    const taskInput = buildCompetitorLabTaskInput(graph, {
      name: company.name,
      domain: company.domain || company.website || null,
    });

    // 5. Generate task prompt
    const taskPrompt = generateCompetitorLabTaskPrompt(taskInput);

    // 6. Call AI
    console.log('[CompetitorLab] Calling AI for comprehensive competitive analysis...');
    const aiResponse = await aiForCompany(companyId, {
      type: 'Strategy',
      tags: ['competitor-lab', 'refinement', 'competitive', 'expanded'],
      systemPrompt: COMPETITOR_LAB_SYSTEM_PROMPT,
      taskPrompt,
      model: 'gpt-4o',
      temperature: 0.3,
      jsonMode: true,
      maxTokens: 8000,
    });

    // 7. Parse response
    let parsed: z.infer<typeof CompetitorLabResponseSchema>;
    try {
      const rawContent = typeof aiResponse.content === 'string'
        ? JSON.parse(aiResponse.content)
        : aiResponse.content;
      parsed = CompetitorLabResponseSchema.parse(rawContent);
    } catch (parseError) {
      console.error('[CompetitorLab] Failed to parse AI response:', parseError);
      result.diagnostics.push({
        code: 'parse_error',
        message: 'Failed to parse AI response',
        severity: 'error',
      });
      result.durationMs = Date.now() - startTime;
      return result;
    }

    const refined = parsed.refinedContext;
    const refinements: RefinedField[] = [];

    // 8. Validate and process competitors with merge/dedupe
    if (refined.competitors && refined.competitors.length > 0) {
      const { validated, stats, mergeStats } = validateCompetitors(
        refined.competitors,
        existingCompetitors,
        source
      );

      validationStats.competitorsValidated = stats.valid;
      validationStats.competitorsInvalid = stats.invalid;
      validationStats.agenciesFiltered = stats.agenciesFiltered;
      result.mergeStats = mergeStats;

      refinements.push({
        path: 'competitive.competitors',
        newValue: validated,
        confidence: 0.8,
        reason: `Validated ${stats.valid} competitors, merged ${mergeStats.competitorsMerged}, added ${mergeStats.competitorsAdded}${stats.agenciesFiltered > 0 ? `, filtered ${stats.agenciesFiltered} agencies` : ''}`,
      });

      result.diagnostics.push({
        code: 'competitors_processed',
        message: `Processed ${stats.valid} valid competitors (${stats.invalid} invalid${stats.agenciesFiltered > 0 ? `, ${stats.agenciesFiltered} agencies filtered` : ''}). Merged ${mergeStats.competitorsMerged}, added ${mergeStats.competitorsAdded}.`,
        severity: 'info',
        fieldPath: 'competitive.competitors',
      });
    }

    // 9. Validate and process positioning axes
    if (refined.positioningAxes) {
      refinements.push({
        path: 'competitive.positioningAxes',
        newValue: refined.positioningAxes,
        confidence: 0.85,
        reason: 'Positioning axes defined',
      });

      // Also set legacy string axes
      if (refined.positioningAxes.primaryAxis) {
        refinements.push({
          path: 'competitive.primaryAxis',
          newValue: refined.positioningAxes.primaryAxis.label,
          confidence: 0.85,
        });
      }
      if (refined.positioningAxes.secondaryAxis) {
        refinements.push({
          path: 'competitive.secondaryAxis',
          newValue: refined.positioningAxes.secondaryAxis.label,
          confidence: 0.85,
        });
      }
    }

    // 10. Validate own position
    if (refined.ownPosition) {
      refinements.push({
        path: 'competitive.ownPositionPrimary',
        newValue: refined.ownPosition.x,
        confidence: 0.8,
      });
      refinements.push({
        path: 'competitive.ownPositionSecondary',
        newValue: refined.ownPosition.y,
        confidence: 0.8,
      });
    }

    // 11. Position summary
    if (refined.positionSummary) {
      refinements.push({
        path: 'competitive.positionSummary',
        newValue: refined.positionSummary,
        confidence: 0.8,
      });
    }

    // 12. Validate and process whitespace opportunities
    if (refined.whitespaceOpportunities && refined.whitespaceOpportunities.length > 0) {
      const { items: validWhitespace, validCount } = validateTypedArray(
        refined.whitespaceOpportunities,
        WhitespaceOpportunitySchema
      );

      refinements.push({
        path: 'competitive.whitespaceMap',
        newValue: validWhitespace,
        confidence: 0.75,
        reason: `Identified ${validCount} whitespace opportunities`,
      });

      // Also set legacy string array
      refinements.push({
        path: 'competitive.whitespaceOpportunities',
        newValue: validWhitespace.map(w => w.description || w.name),
        confidence: 0.75,
      });
    }

    // 13. Validate and process feature matrix
    if (refined.featuresMatrix && refined.featuresMatrix.length > 0) {
      const { items: validFeatures, validCount } = validateTypedArray(
        refined.featuresMatrix,
        FeatureMatrixEntrySchema
      );

      validationStats.featuresValidated = validCount;

      refinements.push({
        path: 'competitive.featuresMatrix',
        newValue: validFeatures,
        confidence: 0.8,
        reason: `Validated ${validCount} features`,
      });
    }

    // 14. Validate and process pricing models
    if (refined.pricingModels && refined.pricingModels.length > 0) {
      const { items: validPricing, validCount } = validateTypedArray(
        refined.pricingModels,
        PricingModelSchema
      );

      validationStats.pricingModelsValidated = validCount;

      refinements.push({
        path: 'competitive.pricingModels',
        newValue: validPricing,
        confidence: 0.75,
        reason: `Validated ${validCount} pricing models`,
      });
    }

    // Own price tier
    if (refined.ownPriceTier) {
      refinements.push({
        path: 'competitive.ownPriceTier',
        newValue: refined.ownPriceTier,
        confidence: 0.7,
      });
    }

    // 15. Validate and process message overlap
    if (refined.messageOverlap && refined.messageOverlap.length > 0) {
      const { items: validOverlap, validCount } = validateTypedArray(
        refined.messageOverlap,
        MessageOverlapSchema
      );

      refinements.push({
        path: 'competitive.messageOverlap',
        newValue: validOverlap,
        confidence: 0.75,
        reason: `Identified ${validCount} messaging themes`,
      });
    }

    if (refined.messagingDifferentiationScore !== null && refined.messagingDifferentiationScore !== undefined) {
      refinements.push({
        path: 'competitive.messagingDifferentiationScore',
        newValue: refined.messagingDifferentiationScore,
        confidence: 0.7,
      });
    }

    // 16. Validate and process market clusters
    if (refined.marketClusters && refined.marketClusters.length > 0) {
      const { items: validClusters, validCount } = validateTypedArray(
        refined.marketClusters,
        MarketClusterSchema
      );

      validationStats.clustersValidated = validCount;

      refinements.push({
        path: 'competitive.marketClusters',
        newValue: validClusters,
        confidence: 0.8,
        reason: `Identified ${validCount} market clusters`,
      });
    }

    // 17. Validate and process threat scores
    if (refined.threatScores && refined.threatScores.length > 0) {
      const { items: validThreats, validCount } = validateTypedArray(
        refined.threatScores,
        ThreatScoreSchema
      );

      validationStats.threatsValidated = validCount;

      refinements.push({
        path: 'competitive.threatScores',
        newValue: validThreats,
        confidence: 0.8,
        reason: `Assessed ${validCount} threat scores`,
      });
    }

    if (refined.overallThreatLevel !== null && refined.overallThreatLevel !== undefined) {
      refinements.push({
        path: 'competitive.overallThreatLevel',
        newValue: refined.overallThreatLevel,
        confidence: 0.75,
      });
    }

    // 18. Validate and process substitutes
    if (refined.substitutes && refined.substitutes.length > 0) {
      const { items: validSubstitutes, validCount } = validateTypedArray(
        refined.substitutes,
        SubstituteSchema
      );

      validationStats.substitutesValidated = validCount;

      refinements.push({
        path: 'competitive.substitutes',
        newValue: validSubstitutes,
        confidence: 0.7,
        reason: `Identified ${validCount} substitutes`,
      });
    }

    // 19. Process strategy fields
    if (refined.differentiationStrategy) {
      refinements.push({
        path: 'competitive.differentiationStrategy',
        newValue: refined.differentiationStrategy,
        confidence: 0.8,
      });
    }

    if (refined.competitiveAdvantages && refined.competitiveAdvantages.length > 0) {
      refinements.push({
        path: 'competitive.competitiveAdvantages',
        newValue: refined.competitiveAdvantages,
        confidence: 0.8,
      });
    }

    if (refined.competitiveThreats && refined.competitiveThreats.length > 0) {
      refinements.push({
        path: 'competitive.competitiveThreats',
        newValue: refined.competitiveThreats,
        confidence: 0.75,
      });
    }

    if (refined.competitiveOpportunities && refined.competitiveOpportunities.length > 0) {
      refinements.push({
        path: 'competitive.competitiveOpportunities',
        newValue: refined.competitiveOpportunities,
        confidence: 0.75,
      });
    }

    if (refined.marketTrends && refined.marketTrends.length > 0) {
      refinements.push({
        path: 'competitive.marketTrends',
        newValue: refined.marketTrends,
        confidence: 0.7,
      });
    }

    // 20. Set confidence and validation timestamps
    refinements.push({
      path: 'competitive.dataConfidence',
      newValue: 0.75, // Medium-high confidence from lab analysis
      confidence: 1.0,
    });

    refinements.push({
      path: 'competitive.lastValidatedAt',
      newValue: runAt,
      confidence: 1.0,
    });

    result.refinedContext = refinements;
    result.diagnostics = [
      ...result.diagnostics,
      ...(parsed.diagnostics || []),
    ];
    result.validationStats = validationStats;

    // Build summary string from parsed summary
    if (parsed.summary) {
      result.summary = parsed.summary.keyInsight ||
        `Analyzed ${parsed.summary.competitorsIdentified || 0} competitors, ` +
        `found ${parsed.summary.whitespaceOpportunitiesFound || 0} whitespace opportunities, ` +
        `${parsed.summary.highThreatCompetitors || 0} high-threat competitors`;
    }

    console.log(`[CompetitorLab] Validated ${refinements.length} refinements`);

    // 21. Apply refinements
    result.applyResult = await applyRefinements(companyId, refinements, dryRun || false);

    console.log(`[CompetitorLab] Applied ${result.applyResult.updated}/${result.applyResult.attempted} refinements`);

    result.success = true;
    result.durationMs = Date.now() - startTime;
    return result;

  } catch (error) {
    console.error('[CompetitorLab] Error:', error);
    result.diagnostics.push({
      code: 'run_error',
      message: error instanceof Error ? error.message : 'Unknown error',
      severity: 'error',
    });
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

// ============================================================================
// Exports
// ============================================================================

export type { RefinedField, LabDiagnostic, ApplyResult, ValidationStats };
