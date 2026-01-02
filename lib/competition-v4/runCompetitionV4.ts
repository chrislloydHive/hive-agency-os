// lib/competition-v4/runCompetitionV4.ts
// Competition V4 - Classification Tree Orchestrator
//
// Sequential AI pipeline with trait-based scoring:
// 1. Business Decomposition → 2. Category Definition → 3. Discovery → 4. Validation → 5. Summary
// Then apply trait-based overlap scoring and modality inference

import { aiSimple } from '@/lib/ai-gateway';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import type {
  CompetitionV4Input,
  CompetitionV4Result,
  BusinessDecompositionResult,
  CategoryDefinition,
  CompetitorDiscoveryResult,
  CompetitorValidationResult,
  CompetitiveSummary,
  ProposedCompetitor,
  ScoredCompetitor,
  CompetitiveModalityType,
  ExcludedCompetitorRecord,
  ModalityInferenceInfo,
  CandidateExpansionStats,
  CompetitorSignalsUsed,
} from './types';
import {
  generateExpansionQueries,
  deduplicateCompetitors,
  buildExpansionStats,
} from './candidateExpansion';
import {
  PROMPT_1_BUSINESS_DECOMPOSITION,
  PROMPT_2_CATEGORY_DEFINITION,
  PROMPT_3_COMPETITOR_DISCOVERY,
  PROMPT_4_COMPETITOR_VALIDATION,
  PROMPT_5_COMPETITIVE_SUMMARY,
  buildDecompositionPrompt,
  buildCategoryPrompt,
  buildDiscoveryPrompt,
  buildValidationPrompt,
  buildSummaryPrompt,
} from './prompts';
import {
  calculateOverlapScore,
  type CompetitorTraits,
  type SubjectProfile,
  type ScoringResult,
} from './overlapScoring';
import {
  inferModality,
  buildSignalsFromDecomposition,
  buildSignalsFromContext,
  mergeSignals,
  type ModalityInferenceResult,
} from './modalityInference';

// ============================================================================
// JSON Parsing Helpers
// ============================================================================

interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  raw?: string;
}

function parseJsonResponse<T>(response: string, stepName: string): ParseResult<T> {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr) as T;
    return { success: true, data: parsed, raw: response };
  } catch (error) {
    console.error(`[competition-v4] Failed to parse ${stepName} response:`, error);
    console.error(`[competition-v4] Raw response:`, response.slice(0, 500));
    return {
      success: false,
      error: `Failed to parse ${stepName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      raw: response,
    };
  }
}

// ============================================================================
// Individual Step Functions
// ============================================================================

async function runStep1Decomposition(
  input: CompetitionV4Input & { approvedContext?: string }
): Promise<ParseResult<BusinessDecompositionResult>> {
  console.log('[competition-v4] Step 1: Business Decomposition...');

  const taskPrompt = buildDecompositionPrompt({
    companyName: input.companyName || 'Unknown Company',
    domain: input.domain,
    websiteText: input.websiteText,
    diagnosticsSummary: input.diagnosticsSummary,
    approvedContext: input.approvedContext,
  });

  const response = await aiSimple({
    systemPrompt: PROMPT_1_BUSINESS_DECOMPOSITION,
    taskPrompt,
    temperature: 0.2,
    maxTokens: 1500,
    jsonMode: true,
  });

  return parseJsonResponse<BusinessDecompositionResult>(response, 'Business Decomposition');
}

async function runStep2CategoryDefinition(
  decomposition: BusinessDecompositionResult,
  approvedContext?: string
): Promise<ParseResult<CategoryDefinition>> {
  console.log('[competition-v4] Step 2: Category Definition...');

  const taskPrompt = buildCategoryPrompt(decomposition, approvedContext);

  const response = await aiSimple({
    systemPrompt: PROMPT_2_CATEGORY_DEFINITION,
    taskPrompt,
    temperature: 0.2,
    maxTokens: 1500,
    jsonMode: true,
  });

  return parseJsonResponse<CategoryDefinition>(response, 'Category Definition');
}

interface DiscoveryOptions {
  category: CategoryDefinition;
  companyName: string;
  approvedContext?: string;
  competitiveModality?: CompetitiveModalityType;
  customerComparisonModes?: string[];
  hasInstallation?: boolean;
  geographicScope?: string;
  serviceEmphasis?: number;
  productEmphasis?: number;
  serviceCategories?: string[];
  productCategories?: string[];
  serviceAreas?: string[];
}

async function runStep3CompetitorDiscovery(
  options: DiscoveryOptions
): Promise<ParseResult<CompetitorDiscoveryResult>> {
  console.log('[competition-v4] Step 3: Competitor Discovery (Trait-Based)...');
  if (options.competitiveModality) {
    console.log(`[competition-v4] Modality: ${options.competitiveModality} (service: ${options.serviceEmphasis?.toFixed(2) || 'N/A'})`);
  }

  const taskPrompt = buildDiscoveryPrompt({
    category: options.category,
    companyName: options.companyName,
    approvedContext: options.approvedContext,
    competitiveModality: options.competitiveModality,
    customerComparisonModes: options.customerComparisonModes,
    hasInstallation: options.hasInstallation,
    geographicScope: options.geographicScope,
    serviceEmphasis: options.serviceEmphasis,
    productEmphasis: options.productEmphasis,
    serviceCategories: options.serviceCategories,
    productCategories: options.productCategories,
    serviceAreas: options.serviceAreas,
  });

  const response = await aiSimple({
    systemPrompt: PROMPT_3_COMPETITOR_DISCOVERY,
    taskPrompt,
    temperature: 0.3, // Slightly higher for diversity
    maxTokens: 5000, // Increased for trait fields
    jsonMode: true,
  });

  return parseJsonResponse<CompetitorDiscoveryResult>(response, 'Competitor Discovery');
}

interface ValidationOptions {
  category: CategoryDefinition;
  competitors: ProposedCompetitor[];
  approvedContext?: string;
  competitiveModality?: CompetitiveModalityType;
  hasInstallation?: boolean;
  serviceEmphasis?: number;
  geographicScope?: string;
}

async function runStep4CompetitorValidation(
  options: ValidationOptions
): Promise<ParseResult<CompetitorValidationResult>> {
  console.log('[competition-v4] Step 4: Competitor Validation (Intent-Based)...');

  const taskPrompt = buildValidationPrompt({
    category: options.category,
    competitors: options.competitors,
    approvedContext: options.approvedContext,
    competitiveModality: options.competitiveModality,
    hasInstallation: options.hasInstallation,
    serviceEmphasis: options.serviceEmphasis,
    geographicScope: options.geographicScope,
  });

  const response = await aiSimple({
    systemPrompt: PROMPT_4_COMPETITOR_VALIDATION,
    taskPrompt,
    temperature: 0.1, // Low for validation
    maxTokens: 5000,
    jsonMode: true,
  });

  return parseJsonResponse<CompetitorValidationResult>(response, 'Competitor Validation');
}

async function runStep5CompetitiveSummary(
  category: CategoryDefinition,
  validatedCompetitors: ProposedCompetitor[],
  approvedContext?: string
): Promise<ParseResult<CompetitiveSummary>> {
  console.log('[competition-v4] Step 5: Competitive Summary...');

  const taskPrompt = buildSummaryPrompt(category, validatedCompetitors, approvedContext);

  const response = await aiSimple({
    systemPrompt: PROMPT_5_COMPETITIVE_SUMMARY,
    taskPrompt,
    temperature: 0.3,
    maxTokens: 1500,
    jsonMode: true,
  });

  return parseJsonResponse<CompetitiveSummary>(response, 'Competitive Summary');
}

// ============================================================================
// Trait-Based Overlap Scoring
// ============================================================================

/**
 * Convert a proposed competitor to CompetitorTraits for scoring
 */
function proposedToTraits(comp: ProposedCompetitor): CompetitorTraits {
  // Calculate signal completeness
  let knownSignals = 0;
  const totalSignals = 7;

  if ((comp as any).hasServiceCapability !== undefined || comp.hasInstallation !== undefined) knownSignals++;
  if ((comp as any).geographicReach !== undefined || comp.hasNationalReach !== undefined) knownSignals++;
  if (comp.productCategories && comp.productCategories.length > 0) knownSignals++;
  if (comp.serviceCategories && comp.serviceCategories.length > 0) knownSignals++;
  if (comp.pricePositioning) knownSignals++;
  if (comp.brandTrustScore !== undefined || (comp as any).brandRecognition !== undefined) knownSignals++;
  if ((comp as any).isRetailer !== undefined || (comp as any).isServiceProvider !== undefined) knownSignals++;

  const signalCompleteness = knownSignals / totalSignals;

  // Handle both old and new field names
  const hasServiceCapability = (comp as any).hasServiceCapability ?? comp.hasInstallation ?? false;
  const serviceCapabilityConfidence = (comp as any).serviceCapabilityEvidence ? 0.9 : (hasServiceCapability ? 0.6 : 0.2);

  let geographicReach: 'local' | 'regional' | 'national' | 'unknown' = 'unknown';
  if ((comp as any).geographicReach) {
    geographicReach = (comp as any).geographicReach;
  } else if (comp.hasNationalReach) {
    geographicReach = 'national';
  } else if (comp.isLocal) {
    geographicReach = 'local';
  }

  const brandRecognition = ((comp as any).brandRecognition ?? comp.brandTrustScore ?? 50) / 100;

  return {
    name: comp.name,
    domain: comp.domain,
    hasServiceCapability,
    serviceCapabilityConfidence,
    geographicReach,
    serviceAreas: (comp as any).serviceAreas || [],
    productCategories: comp.productCategories || [],
    serviceCategories: comp.serviceCategories || [],
    brandRecognition,
    pricePositioning: comp.pricePositioning || 'unknown',
    isRetailer: (comp as any).isRetailer ?? comp.isMajorRetailer ?? false,
    isServiceProvider: (comp as any).isServiceProvider ?? hasServiceCapability,
    signalCompleteness,
  };
}

/**
 * Build signals used info for transparency
 */
function buildSignalsUsed(
  traits: CompetitorTraits,
  subject: SubjectProfile
): CompetitorSignalsUsed {
  const signals: CompetitorSignalsUsed = {};

  if (traits.hasServiceCapability) {
    signals.installationCapability = true;
  }

  if (traits.geographicReach !== 'unknown') {
    signals.geographicOverlap = traits.geographicReach;
    signals.marketReach = traits.geographicReach;
  }

  if (traits.productCategories.length > 0 && subject.productCategories.length > 0) {
    const hasOverlap = traits.productCategories.some(pc =>
      subject.productCategories.some(sc =>
        pc.toLowerCase().includes(sc.toLowerCase()) ||
        sc.toLowerCase().includes(pc.toLowerCase())
      )
    );
    signals.productOverlap = hasOverlap;
  }

  if (traits.serviceCategories.length > 0 && subject.serviceCategories.length > 0) {
    const hasOverlap = traits.serviceCategories.some(tc =>
      subject.serviceCategories.some(sc =>
        tc.toLowerCase().includes(sc.toLowerCase()) ||
        sc.toLowerCase().includes(tc.toLowerCase())
      )
    );
    signals.serviceOverlap = hasOverlap;
  }

  if (traits.pricePositioning !== 'unknown') {
    signals.pricePositioning = traits.pricePositioning;
  }

  return signals;
}

/**
 * Generate reasons bullets for competitor inclusion
 */
function generateReasons(
  traits: CompetitorTraits,
  result: ScoringResult,
  subject: SubjectProfile
): string[] {
  const reasons: string[] = [];

  // Add trait rule explanations
  if (result.traitRulesApplied.length > 0) {
    if (result.traitRulesApplied.includes('national-retailer-with-service-in-hybrid-market')) {
      reasons.push('National retailer with installation services');
    }
    if (result.traitRulesApplied.includes('local-service-provider-in-service-market')) {
      reasons.push('Local service provider in your market');
    }
    if (result.traitRulesApplied.includes('same-geographic-same-service')) {
      reasons.push('Same service area and offerings');
    }
    if (result.traitRulesApplied.includes('service-provider-with-product-overlap')) {
      reasons.push('Offers similar products and services');
    }
    if (result.traitRulesApplied.includes('national-reach-in-any-retail')) {
      reasons.push('National retail presence');
    }
  }

  // Add dimension-based reasons
  if (result.dimensionScores.installationCapabilityOverlap > 0.7) {
    reasons.push('Strong installation/service overlap');
  }
  if (result.dimensionScores.productCategoryOverlap > 0.6) {
    reasons.push('Similar product categories');
  }
  if (result.dimensionScores.geographicPresenceOverlap > 0.7) {
    reasons.push('Operates in same geographic area');
  }
  if (result.dimensionScores.brandTrustOverlap > 0.7) {
    reasons.push('Similar brand recognition level');
  }

  // Add inclusion reason if exclusion was prevented
  if (result.inclusionReason) {
    reasons.push(result.inclusionReason);
  }

  // Ensure at least one reason
  if (reasons.length === 0) {
    reasons.push('Identified as relevant competitor');
  }

  return reasons.slice(0, 4); // Limit to 4 reasons
}

/**
 * Apply trait-based overlap scoring to validated competitors
 */
function applyTraitBasedScoring(
  competitors: ProposedCompetitor[],
  subjectProfile: SubjectProfile,
  thresholds: { primary: number; contextual: number; alternative: number }
): {
  primary: ScoredCompetitor[];
  contextual: ScoredCompetitor[];
  alternative: ScoredCompetitor[];
  excluded: ExcludedCompetitorRecord[];
  threshold: number;
  topTraitRules: string[];
} {
  const primary: ScoredCompetitor[] = [];
  const contextual: ScoredCompetitor[] = [];
  const alternative: ScoredCompetitor[] = [];
  const excluded: ExcludedCompetitorRecord[] = [];
  const allRules = new Map<string, number>();

  for (const comp of competitors) {
    const traits = proposedToTraits(comp);
    const result = calculateOverlapScore(traits, subjectProfile, {
      primaryThreshold: thresholds.primary,
      contextualThreshold: thresholds.contextual,
      alternativeThreshold: thresholds.alternative,
    });

    // Track rule frequency
    result.traitRulesApplied.forEach(rule => {
      allRules.set(rule, (allRules.get(rule) || 0) + 1);
    });

    if (result.classification === 'excluded') {
      excluded.push({
        name: comp.name,
        domain: comp.domain,
        reason: result.missingSignals.length > 0
          ? `Low overlap (${result.overallScore}%) - missing: ${result.missingSignals.slice(0, 3).join(', ')}`
          : `Low overlap (${result.overallScore}%) with subject business`,
      });
      continue;
    }

    const signalsUsed = buildSignalsUsed(traits, subjectProfile);
    const reasons = generateReasons(traits, result, subjectProfile);

    const scoredComp: ScoredCompetitor = {
      ...comp,
      overlapScore: result.overallScore,
      classification: result.classification,
      rulesApplied: result.traitRulesApplied,
      inclusionReason: result.inclusionReason || undefined,
      confidence: result.confidence,
      whyThisMatters: result.whyThisMatters,
      signalsUsed,
      reasons,
    };

    switch (result.classification) {
      case 'primary':
        primary.push(scoredComp);
        break;
      case 'contextual':
        contextual.push(scoredComp);
        break;
      case 'alternative':
        alternative.push(scoredComp);
        break;
    }
  }

  // Sort by score
  primary.sort((a, b) => b.overlapScore - a.overlapScore);
  contextual.sort((a, b) => b.overlapScore - a.overlapScore);
  alternative.sort((a, b) => b.overlapScore - a.overlapScore);

  // Get top trait rules by frequency
  const topTraitRules = Array.from(allRules.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rule]) => rule);

  console.log(`[competition-v4] Scoring: ${primary.length} primary, ${contextual.length} contextual, ${alternative.length} alternative, ${excluded.length} excluded`);

  if (topTraitRules.length > 0) {
    console.log(`[competition-v4] Top trait rules: ${topTraitRules.join(', ')}`);
  }

  return { primary, contextual, alternative, excluded, threshold: thresholds.primary, topTraitRules };
}

// ============================================================================
// Category Post-Processing
// ============================================================================

/**
 * Enforce marketplace/platform classification when decomposition signals indicate
 * a multi-provider business model.
 */
function enforceMarketplaceClassification(
  category: CategoryDefinition,
  decomposition: BusinessDecompositionResult
): CategoryDefinition {
  const isMarketplace = decomposition.economic_model === 'Marketplace' || decomposition.economic_model === 'Platform';
  const hasDifferentBuyerUser = decomposition.buyer_user_relationship === 'Different';

  const hasSubscriptionInName = category.category_name.toLowerCase().includes('subscription');
  const hasMarketplaceInName = category.category_name.toLowerCase().includes('marketplace') ||
    category.category_name.toLowerCase().includes('platform');

  if ((isMarketplace || hasDifferentBuyerUser) && hasSubscriptionInName && !hasMarketplaceInName) {
    console.log('[competition-v4] Post-process: Converting subscription category to marketplace');

    const vertical = decomposition.primary_vertical || 'Service';
    const modelType = decomposition.economic_model === 'Platform' ? 'Platform' : 'Marketplace';

    const correctedSlug = `${vertical.toLowerCase()}_service_${modelType.toLowerCase()}`;
    const correctedName = `${vertical} Services ${modelType}`;

    let correctedDescription = category.category_description;
    if (!correctedDescription.toLowerCase().includes('connect')) {
      correctedDescription = `A ${modelType.toLowerCase()} that connects ${vertical.toLowerCase()} service providers with customers. ${correctedDescription}`;
    }

    return {
      ...category,
      category_slug: correctedSlug,
      category_name: correctedName,
      category_description: correctedDescription,
    };
  }

  return category;
}

// ============================================================================
// Main Orchestrator
// ============================================================================

export async function runCompetitionV4(
  input: CompetitionV4Input
): Promise<CompetitionV4Result> {
  const startTime = Date.now();
  const runId = `comp-v4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[COMPETITION V4] Starting Trait-Based Analysis`);
  console.log(`[COMPETITION V4] Run ID: ${runId}`);
  console.log(`[COMPETITION V4] Company: ${input.companyId}`);
  console.log(`${'='.repeat(60)}\n`);

  const stepErrors: { step: string; error: string }[] = [];
  let stepsCompleted = 0;

  // Get company info if not provided
  let companyName = input.companyName;
  let domain = input.domain;

  if (!companyName || !domain) {
    try {
      const company = await getCompanyById(input.companyId);
      if (company) {
        companyName = companyName || company.name || 'Unknown Company';
        domain = domain || company.domain || company.website || undefined;
      }
    } catch (error) {
      console.warn('[competition-v4] Failed to load company:', error);
    }
  }

  companyName = companyName || 'Unknown Company';

  // Get website text and approved context from context graph
  let websiteText = input.websiteText;
  let approvedContext: string | undefined;
  let contextGraph: any = null;

  try {
    contextGraph = await loadContextGraph(input.companyId);
    if (contextGraph) {
      // Build approved context summary
      const identity = contextGraph?.identity || {};
      const productOffer = contextGraph?.productOffer || {};
      const audience = contextGraph?.audience || {};
      const competitive = contextGraph?.competitive || {};

      const parts: string[] = [];
      const pushVal = (label: string, val: unknown) => {
        if (val === null || val === undefined) return;
        if (Array.isArray(val) && val.length === 0) return;
        if (typeof val === 'string' && !val.trim()) return;
        parts.push(`${label}: ${typeof val === 'string' ? val : JSON.stringify(val)}`);
      };

      pushVal('Business Model', identity.businessModel?.value);
      pushVal('Business Archetype', identity.businessArchetype?.value);
      pushVal('Industry', identity.industry?.value);
      pushVal('Geography', identity.geographicFootprint?.value || identity.headquartersLocation?.value);
      pushVal('ICP Description', audience.icpDescription?.value);
      pushVal('Primary Audience', audience.primaryAudience?.value);
      pushVal('Primary Products', productOffer.primaryProducts?.value);
      pushVal('Services', productOffer.services?.value || productOffer.coreServices?.value);
      pushVal('Product Categories', productOffer.productCategories?.value);
      pushVal('Value Proposition', productOffer.valueProposition?.value);
      pushVal('Differentiators', productOffer.keyDifferentiators?.value);
      pushVal('Competitive Notes', competitive.competitiveNotes?.value);
      pushVal('Category Alternatives', competitive.categoryAlternatives?.value);
      pushVal('Replacement Alternatives', competitive.replacementAlternatives?.value);
      pushVal('Approved Competitors', competitive.competitors?.value);

      approvedContext = parts.length > 0 ? parts.join('\n') : undefined;

      // If no websiteText provided, synthesize from context
      if (!websiteText) {
        const synthParts: string[] = [];
        if (identity.businessName?.value) synthParts.push(`Business: ${identity.businessName.value}`);
        if (identity.industry?.value) synthParts.push(`Industry: ${identity.industry.value}`);
        if (identity.businessModel?.value) synthParts.push(`Business Model: ${identity.businessModel.value}`);
        if (productOffer.coreServices?.value) synthParts.push(`Services: ${JSON.stringify(productOffer.coreServices.value)}`);
        if (audience.targetAudience?.value) synthParts.push(`Target Audience: ${audience.targetAudience.value}`);
        websiteText = synthParts.join('\n');
      }
    }
  } catch (error) {
    console.warn('[competition-v4] Failed to load context graph:', error);
  }

  // Initialize result with defaults
  let decomposition: BusinessDecompositionResult = {
    market_orientation: 'Unknown',
    economic_model: 'Unknown',
    offering_type: 'Unknown',
    buyer_user_relationship: 'Unknown',
    transaction_model: 'Unknown',
    primary_vertical: 'Unknown',
    secondary_verticals: [],
    geographic_scope: 'Unknown',
    confidence_notes: 'Failed to complete decomposition',
  };

  let category: CategoryDefinition = {
    category_slug: 'unknown',
    category_name: 'Unknown Category',
    category_description: 'Category could not be determined',
    qualification_rules: [],
    exclusion_rules: [],
  };

  let validatedCompetitors: ProposedCompetitor[] = [];
  let removedCompetitors: { name: string; domain: string; reason: string }[] = [];
  let summary: CompetitiveSummary | undefined;
  let modalityInference: ModalityInferenceResult | undefined;

  try {
    // Step 1: Business Decomposition
    const step1Result = await runStep1Decomposition({
      ...input,
      companyName,
      domain,
      websiteText,
      approvedContext,
    });

    if (!step1Result.success || !step1Result.data) {
      stepErrors.push({ step: 'decomposition', error: step1Result.error || 'Unknown error' });
      throw new Error(`Step 1 failed: ${step1Result.error}`);
    }

    decomposition = step1Result.data;
    stepsCompleted++;
    console.log(`[competition-v4] Decomposition: ${decomposition.economic_model} / ${decomposition.primary_vertical}`);

    // Step 1.5: Infer modality from signals (if not provided)
    if (!input.competitiveModality) {
      const decompSignals = buildSignalsFromDecomposition(decomposition);
      const contextSignals = buildSignalsFromContext(contextGraph);
      const allSignals = mergeSignals(decompSignals, contextSignals);

      modalityInference = inferModality(allSignals);
      console.log(`[competition-v4] Inferred modality: ${modalityInference.modality} (confidence: ${modalityInference.confidence}%)`);

      if (modalityInference.clarifyingQuestion) {
        console.log(`[competition-v4] Would ask: "${modalityInference.clarifyingQuestion.question}"`);
      }
    }

    const effectiveModality = input.competitiveModality || modalityInference?.modality || 'ProductOnly';
    const serviceEmphasis = modalityInference?.serviceEmphasis ?? (effectiveModality.includes('Install') ? 0.7 : 0.3);
    const productEmphasis = modalityInference?.productEmphasis ?? 0.5;

    // Step 2: Category Definition
    const step2Result = await runStep2CategoryDefinition(decomposition, approvedContext);

    if (!step2Result.success || !step2Result.data) {
      stepErrors.push({ step: 'category', error: step2Result.error || 'Unknown error' });
      throw new Error(`Step 2 failed: ${step2Result.error}`);
    }

    category = step2Result.data;
    category = enforceMarketplaceClassification(category, decomposition);

    stepsCompleted++;
    console.log(`[competition-v4] Category: ${category.category_name}`);

    // Step 3: Competitor Discovery (with trait context)
    const geographicScope = input.geographicScope ||
      (decomposition.geographic_scope === 'Local' ? 'local' :
       decomposition.geographic_scope === 'Regional' ? 'regional' : 'national');

    const step3Result = await runStep3CompetitorDiscovery({
      category,
      companyName,
      approvedContext,
      competitiveModality: effectiveModality,
      customerComparisonModes: input.customerComparisonModes,
      hasInstallation: input.hasInstallation ?? serviceEmphasis > 0.5,
      geographicScope,
      serviceEmphasis,
      productEmphasis,
      serviceCategories: input.serviceCategories || [],
      productCategories: input.productCategories || [],
      serviceAreas: [],
    });

    if (!step3Result.success || !step3Result.data) {
      stepErrors.push({ step: 'discovery', error: step3Result.error || 'Unknown error' });
      throw new Error(`Step 3 failed: ${step3Result.error}`);
    }

    const discoveredCompetitors = step3Result.data.competitors || [];
    stepsCompleted++;
    console.log(`[competition-v4] Discovered ${discoveredCompetitors.length} competitors`);

    // Step 4: Competitor Validation (intent-based)
    if (discoveredCompetitors.length > 0) {
      const step4Result = await runStep4CompetitorValidation({
        category,
        competitors: discoveredCompetitors,
        approvedContext,
        competitiveModality: effectiveModality,
        hasInstallation: input.hasInstallation ?? serviceEmphasis > 0.5,
        serviceEmphasis,
        geographicScope,
      });

      if (!step4Result.success || !step4Result.data) {
        stepErrors.push({ step: 'validation', error: step4Result.error || 'Unknown error' });
        // Don't throw - we can still use discovered competitors
        validatedCompetitors = discoveredCompetitors;
      } else {
        validatedCompetitors = step4Result.data.validated_competitors || [];
        removedCompetitors = step4Result.data.removed_competitors || [];
        stepsCompleted++;
        console.log(`[competition-v4] Validated ${validatedCompetitors.length} competitors, removed ${removedCompetitors.length}`);
      }
    } else {
      stepsCompleted++; // Skip validation if no competitors
    }

    // Step 5: Competitive Summary (optional)
    if (!input.skipSummary && validatedCompetitors.length > 0) {
      const step5Result = await runStep5CompetitiveSummary(category, validatedCompetitors, approvedContext);

      if (step5Result.success && step5Result.data) {
        summary = step5Result.data;
        stepsCompleted++;
        console.log(`[competition-v4] Summary generated`);
      } else {
        stepErrors.push({ step: 'summary', error: step5Result.error || 'Unknown error' });
      }
    }
  } catch (error) {
    console.error('[competition-v4] Pipeline error:', error);
  }

  // Apply trait-based overlap scoring
  let scoredCompetitors: CompetitionV4Result['scoredCompetitors'];
  let modalityInfo: ModalityInferenceInfo | undefined;
  let candidateExpansionStats: CandidateExpansionStats | undefined;

  if (validatedCompetitors.length > 0) {
    const effectiveModality = input.competitiveModality || modalityInference?.modality || 'ProductOnly';
    const serviceEmphasis = modalityInference?.serviceEmphasis ?? 0.5;
    const productEmphasis = modalityInference?.productEmphasis ?? 0.5;
    const geographicScope = input.geographicScope ||
      (decomposition.geographic_scope === 'Local' ? 'local' :
       decomposition.geographic_scope === 'Regional' ? 'regional' : 'national');

    // Build subject profile for scoring
    const subjectProfile: SubjectProfile = {
      name: companyName,
      modality: effectiveModality,
      productCategories: input.productCategories || [],
      serviceCategories: input.serviceCategories || [],
      hasServiceCapability: input.hasInstallation ?? serviceEmphasis > 0.5,
      geographicScope: geographicScope as 'local' | 'regional' | 'national',
      serviceAreas: input.serviceAreas || [],
      pricePositioning: input.pricePositioning || 'mid',
      brandRecognition: 0.5,
      serviceEmphasis,
      productEmphasis,
    };

    const scoring = applyTraitBasedScoring(
      validatedCompetitors,
      subjectProfile,
      {
        primary: input.overlapThreshold ? input.overlapThreshold + 15 : 55,
        contextual: input.overlapThreshold || 40,
        alternative: input.overlapThreshold ? input.overlapThreshold - 15 : 25,
      }
    );

    scoredCompetitors = {
      primary: scoring.primary,
      contextual: scoring.contextual,
      alternatives: scoring.alternative,
      excluded: scoring.excluded,
      threshold: scoring.threshold,
      modality: effectiveModality,
      modalityConfidence: modalityInference?.confidence,
      clarifyingQuestion: modalityInference?.clarifyingQuestion ? {
        question: modalityInference.clarifyingQuestion.question,
        yesImplies: modalityInference.clarifyingQuestion.yesImplies,
        noImplies: modalityInference.clarifyingQuestion.noImplies,
        context: modalityInference.clarifyingQuestion.context,
      } : undefined,
      topTraitRules: scoring.topTraitRules,
    };

    // Build modality inference info for UI
    if (modalityInference) {
      modalityInfo = {
        modality: modalityInference.modality,
        confidence: modalityInference.confidence,
        signals: modalityInference.signals,
        explanation: modalityInference.explanation,
        serviceEmphasis: modalityInference.serviceEmphasis,
        productEmphasis: modalityInference.productEmphasis,
        missingSignals: modalityInference.clarifyingQuestion
          ? ['Clarification needed: ' + modalityInference.clarifyingQuestion.question]
          : undefined,
      };
    }
  }

  const durationMs = Date.now() - startTime;
  const status = stepsCompleted >= 4 ? 'completed' : stepsCompleted >= 1 ? 'partial' : 'failed';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[COMPETITION V4] Analysis Complete`);
  console.log(`[COMPETITION V4] Status: ${status}`);
  console.log(`[COMPETITION V4] Steps: ${stepsCompleted}/5`);
  console.log(`[COMPETITION V4] Competitors: ${validatedCompetitors.length} validated, ${removedCompetitors.length} removed`);
  if (scoredCompetitors) {
    console.log(`[COMPETITION V4] Classified: ${scoredCompetitors.primary.length} primary, ${scoredCompetitors.contextual.length} contextual, ${scoredCompetitors.alternatives?.length || 0} alternative`);
    console.log(`[COMPETITION V4] Modality: ${scoredCompetitors.modality} (confidence: ${scoredCompetitors.modalityConfidence || 'manual'}%)`);
  }
  console.log(`[COMPETITION V4] Duration: ${durationMs}ms`);
  console.log(`${'='.repeat(60)}\n`);

  return {
    version: 4,
    runId,
    companyId: input.companyId,
    companyName,
    domain: domain || null,
    decomposition,
    category,
    competitors: {
      validated: validatedCompetitors,
      removed: removedCompetitors,
    },
    scoredCompetitors,
    modalityInference: modalityInfo,
    candidateExpansion: candidateExpansionStats,
    summary,
    execution: {
      status,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      stepsCompleted,
      stepErrors: stepErrors.length > 0 ? stepErrors : undefined,
    },
  };
}

// ============================================================================
// Export
// ============================================================================

export { runCompetitionV4 as default };
