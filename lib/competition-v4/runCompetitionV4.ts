// lib/competition-v4/runCompetitionV4.ts
// Competition V4 - Classification Tree Orchestrator
//
// Sequential AI pipeline:
// 1. Business Decomposition → 2. Category Definition → 3. Discovery → 4. Validation → 5. Summary

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
} from './types';
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

async function runStep3CompetitorDiscovery(
  category: CategoryDefinition,
  companyName: string,
  approvedContext?: string
): Promise<ParseResult<CompetitorDiscoveryResult>> {
  console.log('[competition-v4] Step 3: Competitor Discovery...');

  const taskPrompt = buildDiscoveryPrompt(category, companyName, approvedContext);

  const response = await aiSimple({
    systemPrompt: PROMPT_3_COMPETITOR_DISCOVERY,
    taskPrompt,
    temperature: 0.3, // Slightly higher for diversity
    maxTokens: 3000,
    jsonMode: true,
  });

  return parseJsonResponse<CompetitorDiscoveryResult>(response, 'Competitor Discovery');
}

async function runStep4CompetitorValidation(
  category: CategoryDefinition,
  competitors: ProposedCompetitor[],
  approvedContext?: string
): Promise<ParseResult<CompetitorValidationResult>> {
  console.log('[competition-v4] Step 4: Competitor Validation...');

  const taskPrompt = buildValidationPrompt(category, competitors, approvedContext);

  const response = await aiSimple({
    systemPrompt: PROMPT_4_COMPETITOR_VALIDATION,
    taskPrompt,
    temperature: 0.1, // Low for strict validation
    maxTokens: 3000,
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
// Category Post-Processing
// ============================================================================

/**
 * Enforce marketplace/platform classification when decomposition signals indicate
 * a multi-provider business model. Subscription describes pricing, not category.
 */
function enforceMarketplaceClassification(
  category: CategoryDefinition,
  decomposition: BusinessDecompositionResult
): CategoryDefinition {
  const isMarketplace = decomposition.economic_model === 'Marketplace' || decomposition.economic_model === 'Platform';
  const hasDifferentBuyerUser = decomposition.buyer_user_relationship === 'Different';

  // Check if category name incorrectly uses "Subscription" for a marketplace
  const hasSubscriptionInName = category.category_name.toLowerCase().includes('subscription');
  const hasMarketplaceInName = category.category_name.toLowerCase().includes('marketplace') ||
    category.category_name.toLowerCase().includes('platform');

  // If decomposition shows marketplace/platform but category uses subscription, fix it
  if ((isMarketplace || hasDifferentBuyerUser) && hasSubscriptionInName && !hasMarketplaceInName) {
    console.log('[competition-v4] Post-process: Converting subscription category to marketplace');

    // Extract the vertical/domain part (e.g., "Fitness" from "Fitness Service Subscription")
    const vertical = decomposition.primary_vertical || 'Service';

    // Determine if it's a marketplace or platform based on economic model
    const modelType = decomposition.economic_model === 'Platform' ? 'Platform' : 'Marketplace';

    // Build corrected category
    const correctedSlug = `${vertical.toLowerCase()}_service_${modelType.toLowerCase()}`;
    const correctedName = `${vertical} Services ${modelType}`;

    // Update description to mention connecting providers with customers
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
  console.log(`[COMPETITION V4] Starting Classification Tree Analysis`);
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
  try {
    const graph = await loadContextGraph(input.companyId);
    if (graph) {
      // Build approved context summary
      const identity = (graph as any)?.identity || {};
      const productOffer = (graph as any)?.productOffer || {};
      const audience = (graph as any)?.audience || {};
      const competitive = (graph as any)?.competitive || {};

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

    // Step 2: Category Definition
    const step2Result = await runStep2CategoryDefinition(decomposition, approvedContext);

    if (!step2Result.success || !step2Result.data) {
      stepErrors.push({ step: 'category', error: step2Result.error || 'Unknown error' });
      throw new Error(`Step 2 failed: ${step2Result.error}`);
    }

    category = step2Result.data;

    // Post-process: Enforce marketplace/platform classification based on decomposition signals
    category = enforceMarketplaceClassification(category, decomposition);

    stepsCompleted++;
    console.log(`[competition-v4] Category: ${category.category_name} (${category.category_slug})`);

    // Step 3: Competitor Discovery
    const step3Result = await runStep3CompetitorDiscovery(category, companyName, approvedContext);

    if (!step3Result.success || !step3Result.data) {
      stepErrors.push({ step: 'discovery', error: step3Result.error || 'Unknown error' });
      throw new Error(`Step 3 failed: ${step3Result.error}`);
    }

    const discoveredCompetitors = step3Result.data.competitors || [];
    stepsCompleted++;
    console.log(`[competition-v4] Discovered ${discoveredCompetitors.length} competitors`);

    // Step 4: Competitor Validation
    if (discoveredCompetitors.length > 0) {
      const step4Result = await runStep4CompetitorValidation(category, discoveredCompetitors, approvedContext);

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
        // Don't throw - summary is optional
      }
    }
  } catch (error) {
    console.error('[competition-v4] Pipeline error:', error);
  }

  const durationMs = Date.now() - startTime;
  const status = stepsCompleted >= 4 ? 'completed' : stepsCompleted >= 1 ? 'partial' : 'failed';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[COMPETITION V4] Analysis Complete`);
  console.log(`[COMPETITION V4] Status: ${status}`);
  console.log(`[COMPETITION V4] Steps: ${stepsCompleted}/5`);
  console.log(`[COMPETITION V4] Competitors: ${validatedCompetitors.length} validated, ${removedCompetitors.length} removed`);
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
