// app/api/os/companies/[companyId]/strategy/fields/suggest/route.ts
// Contract-Driven Strategy Field Suggestion API
//
// Generates AI suggestions for strategy fields using explicit contracts.
// Returns variants grounded in confirmed Context V4 data with trust metadata.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getCompanyById } from '@/lib/airtable/companies';
import { getConfirmedFieldsV4, getFieldCountsV4 } from '@/lib/contextGraph/fieldStoreV4';
import { getStrategyById } from '@/lib/os/strategy';
import {
  buildStrategyFieldPrompt,
  createSnapshotFromFields,
  type RewriteMode,
  type AvoidWarningType,
} from '@/lib/os/ai/buildStrategyFieldPrompt';
import {
  hasContract,
  getContract,
  type StrategyFieldKey,
} from '@/lib/os/ai/strategyFieldContracts';
import { getGapBusinessSummary } from '@/lib/os/ai/gapBusinessSummary';
import { safeAiCall } from '@/lib/ai/safeCall';
import {
  parseVariantsFromOutput,
  validateGeneratedVariants,
  type VariantWarning,
} from '@/lib/os/ai/validateGeneratedVariants';

export const maxDuration = 60;

// ============================================================================
// Types & Validation
// ============================================================================

const INPUTS_CONFIRMED_THRESHOLD = 3;

const RequestBodySchema = z.object({
  /** Strategy ID (required - goalStatement is fetched server-side) */
  strategyId: z.string().min(1),
  fieldKey: z.enum(['valueProp', 'positioning', 'audience', 'objectives', 'constraints', 'bets']),
  currentValue: z.string().optional(),
  variants: z.number().int().min(1).max(10).optional(),

  // === Repair Mode Options ===
  /** Specific variant text to repair (enables repair mode) */
  variantToRepair: z.string().optional(),
  /** Mode for rewriting: 'defensible' or 'constraints' */
  rewriteMode: z.enum(['defensible', 'constraints']).optional(),
  /** Warning types to explicitly avoid */
  avoidWarnings: z.array(
    z.enum(['banned_phrase', 'invented_claim', 'generic_fluff', 'constraint_violation'])
  ).optional(),
  /** Specific phrases that caused warnings */
  avoidPhrases: z.array(z.string()).optional(),
});

type RequestBody = z.infer<typeof RequestBodySchema>;

interface SuggestionVariant {
  text: string;
  /** Whether this variant was repaired (vs newly generated) */
  repaired?: boolean;
}

interface SuggestResponse {
  variants: SuggestionVariant[];
  generatedUsing: {
    primary: string[];
    constraints: string[];
    missingPrimary: string[];
    categorySafetyMode?: boolean;
    goalAlignmentActive?: boolean;
    businessDefinitionMissing?: boolean;
    usedFallback?: string[];
    missingBusinessDefinitionKeys?: string[];
  };
  /** Validation warnings for individual variants */
  warnings?: VariantWarning[];
  /** Whether this was a repair operation */
  isRepair?: boolean;
  debug?: {
    promptPreview: string;
    contractId: string;
    confirmedCount: number;
    parseMethod?: string;
    repairMode?: string;
    hasGoalStatement?: boolean;
    /** Whether automatic drift repair was attempted */
    repairAttempted?: boolean;
    /** Whether the repair succeeded (fewer drift warnings) */
    repairSucceeded?: boolean;
    /** Why repair was attempted */
    repairReason?: string;
    /** Whether the returned variants are from repair */
    wasRepaired?: boolean;
  };
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    // Parse and validate request body
    const rawBody = await request.json();
    const parseResult = RequestBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const body: RequestBody = parseResult.data;
    const {
      strategyId,
      fieldKey,
      currentValue,
      variants: variantOverride,
      // Repair mode options
      variantToRepair,
      rewriteMode,
      avoidWarnings,
      avoidPhrases,
    } = body;

    const isRepairMode = !!variantToRepair && !!rewriteMode;

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Fetch strategy and validate ownership (SERVER-SIDE SOURCE OF TRUTH for goalStatement)
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }
    if (strategy.companyId !== companyId) {
      return NextResponse.json({ error: 'Strategy does not belong to this company' }, { status: 403 });
    }

    // Read goalStatement from strategy (server-side, not from request)
    const goalStatement = strategy.goalStatement;

    // Validate contract exists for field key
    if (!hasContract(fieldKey)) {
      return NextResponse.json(
        { error: `No contract found for field key: ${fieldKey}` },
        { status: 400 }
      );
    }

    // Check Context V4 readiness
    const fieldCounts = await getFieldCountsV4(companyId);
    if (fieldCounts.confirmed < INPUTS_CONFIRMED_THRESHOLD) {
      return NextResponse.json(
        {
          error: 'Insufficient confirmed context',
          details: `Need ${INPUTS_CONFIRMED_THRESHOLD} confirmed fields, have ${fieldCounts.confirmed}`,
          confirmedCount: fieldCounts.confirmed,
          requiredCount: INPUTS_CONFIRMED_THRESHOLD,
        },
        { status: 422 }
      );
    }

    // Load confirmed fields
    const confirmedFields = await getConfirmedFieldsV4(companyId);
    const contextSnapshot = createSnapshotFromFields(confirmedFields);

    // GAP fallback: derive business summary from recent GAP outputs
    const gapSummaryResult = await getGapBusinessSummary(companyId);
    const fallbackInputs = gapSummaryResult.summary
      ? { 'gap.businessSummary': gapSummaryResult.summary }
      : undefined;

    // Build strategy inputs (from request)
    const strategyInputs = goalStatement
      ? { goalStatement }
      : undefined;

    // Build prompt using contract (with optional repair mode)
    const promptResult = buildStrategyFieldPrompt({
      fieldKey: fieldKey as StrategyFieldKey,
      contextSnapshot,
      fallbackInputs,
      strategyInputs,
      currentValue,
      variantCount: variantOverride,
      companyName: company.name,
      // Pass repair options
      variantToRepair,
      rewriteMode: rewriteMode as RewriteMode | undefined,
      avoidWarnings: avoidWarnings as AvoidWarningType[] | undefined,
      avoidPhrases,
    });

    // Call Claude
    const anthropic = new Anthropic();

    const aiResult = await safeAiCall(
      async () => {
        return anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: promptResult.systemPrompt,
          messages: [
            {
              role: 'user',
              content: promptResult.userPrompt,
            },
          ],
        });
      },
      { retries: 1, context: `strategy-field-suggest:${fieldKey}` }
    );

    if (!aiResult.ok || !aiResult.value) {
      console.error('[strategy/fields/suggest] AI call failed:', aiResult.error);
      return NextResponse.json(
        { error: 'Failed to generate suggestions', details: aiResult.error },
        { status: 500 }
      );
    }

    // Extract text from response
    const responseText =
      aiResult.value.content[0]?.type === 'text'
        ? aiResult.value.content[0].text
        : '';

    // Parse AI response using robust parser (handles JSON, numbered lists, bullets, paragraphs)
    const parseResultAi = parseVariantsFromOutput(responseText, promptResult.variantCount);

    if (parseResultAi.variants.length === 0) {
      console.error('[strategy/fields/suggest] Failed to parse AI response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response', rawOutput: responseText.slice(0, 500) },
        { status: 500 }
      );
    }

    // Validate generated variants against contract and context
    let validation = validateGeneratedVariants(
      parseResultAi.variants,
      promptResult.contract,
      contextSnapshot,
      {
        businessDefinitionMissing: promptResult.generatedUsing.businessDefinitionMissing,
        hasGapBusinessSummary: !!gapSummaryResult.summary,
      }
    );

    // Track repair state for response
    let repairAttempted = false;
    let repairSucceeded = false;
    let repairReason: string | undefined;
    let wasRepaired = false;
    let finalVariants = parseResultAi.variants;
    let finalParseMethod = parseResultAi.parseMethod;
    let finalPromptResult = promptResult;

    // =========================================================================
    // AUTOMATIC REPAIR RETRY: If ALL variants drifted and contract requires
    // business definition, attempt a single repair with neutral mode forced.
    // =========================================================================
    const contract = getContract(fieldKey as StrategyFieldKey);
    const driftWarningTypes: Set<string> = new Set(['category_drift', 'domain_mismatch']);

    // Check if ALL variants have drift warnings
    const allVariantsDrifted =
      !isRepairMode &&
      contract.requireBusinessDefinition &&
      finalVariants.length > 0 &&
      finalVariants.every((_, idx) =>
        validation.warnings.some(
          (w) => w.variantIndex === idx && driftWarningTypes.has(w.type)
        )
      );

    if (allVariantsDrifted) {
      repairAttempted = true;
      repairReason = 'All variants had category_drift or domain_mismatch warnings';

      console.log(
        `[strategy/fields/suggest] All ${finalVariants.length} variants drifted for ${fieldKey}, attempting repair...`
      );

      // Rebuild prompt with businessDefinitionMissing forced to true
      // This injects BUSINESS_DEFINITION_MISSING_RULE and forces neutral template format
      const repairPromptResult = buildStrategyFieldPrompt({
        fieldKey: fieldKey as StrategyFieldKey,
        contextSnapshot: {
          fields: {}, // Empty context forces businessDefinitionMissing = true
          raw: [],
        },
        strategyInputs,
        currentValue,
        variantCount: variantOverride,
        companyName: company.name,
      });

      // Call Claude with repair prompt
      const repairAiResult = await safeAiCall(
        async () => {
          return anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: repairPromptResult.systemPrompt,
            messages: [
              {
                role: 'user',
                content: repairPromptResult.userPrompt,
              },
            ],
          });
        },
        { retries: 1, context: `strategy-field-suggest-repair:${fieldKey}` }
      );

      if (repairAiResult.ok && repairAiResult.value) {
        const repairResponseText =
          repairAiResult.value.content[0]?.type === 'text'
            ? repairAiResult.value.content[0].text
            : '';

        const repairParseResult = parseVariantsFromOutput(
          repairResponseText,
          repairPromptResult.variantCount
        );

        if (repairParseResult.variants.length > 0) {
          // Validate repaired variants
          const repairValidation = validateGeneratedVariants(
            repairParseResult.variants,
            contract,
            contextSnapshot,
            {
              businessDefinitionMissing: repairPromptResult.generatedUsing.businessDefinitionMissing,
              hasGapBusinessSummary: !!gapSummaryResult.summary,
            }
          );

          // Count drift warnings in repaired variants
          const repairDriftCount = repairValidation.warnings.filter((w) =>
            driftWarningTypes.has(w.type)
          ).length;

          const originalDriftCount = validation.warnings.filter((w) =>
            driftWarningTypes.has(w.type)
          ).length;

          // Use repaired variants if they have fewer drift warnings
          if (repairDriftCount < originalDriftCount) {
            repairSucceeded = true;
            wasRepaired = true;
            finalVariants = repairParseResult.variants;
            finalParseMethod = repairParseResult.parseMethod;
            finalPromptResult = repairPromptResult;
            validation = repairValidation;

            console.log(
              `[strategy/fields/suggest] Repair succeeded: ${originalDriftCount} -> ${repairDriftCount} drift warnings`
            );
          } else {
            console.log(
              `[strategy/fields/suggest] Repair did not improve: ${originalDriftCount} -> ${repairDriftCount} drift warnings`
            );
          }
        }
      }
    }

    // Build response with variants as objects
    const response: SuggestResponse = {
      variants: finalVariants.map((text) => ({
        text,
        // Mark as repaired if this was a repair operation (manual or auto)
        ...((isRepairMode || wasRepaired) && { repaired: true }),
      })),
      generatedUsing: {
        primary: finalPromptResult.generatedUsing.primaryLabels,
        constraints: finalPromptResult.generatedUsing.constraintLabels,
        missingPrimary: finalPromptResult.generatedUsing.missingPrimaryKeys.map(
          (k) => k.split('.').pop() || k
        ),
        categorySafetyMode: finalPromptResult.generatedUsing.categorySafetyMode,
        goalAlignmentActive: finalPromptResult.generatedUsing.goalAlignmentActive,
        businessDefinitionMissing: finalPromptResult.generatedUsing.businessDefinitionMissing,
        usedFallback: finalPromptResult.generatedUsing.fallbackLabels,
        missingBusinessDefinitionKeys: finalPromptResult.generatedUsing.missingBusinessDefinitionKeys,
      },
    };

    // Include isRepair flag if this was a repair operation
    if (isRepairMode) {
      response.isRepair = true;
    }

    // Include warnings if any
    if (validation.warnings.length > 0) {
      response.warnings = validation.warnings;
    }

    // Add debug info in non-production
    if (process.env.NODE_ENV !== 'production') {
      response.debug = {
        promptPreview: finalPromptResult.userPrompt.slice(0, 500) + '...',
        contractId: finalPromptResult.contract.id,
        confirmedCount: fieldCounts.confirmed,
        parseMethod: finalParseMethod,
        ...(isRepairMode && { repairMode: rewriteMode }),
        hasGoalStatement: !!goalStatement,
        // Auto-repair metadata
        ...(repairAttempted && {
          repairAttempted,
          repairSucceeded,
          repairReason,
          wasRepaired,
        }),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/os/companies/[companyId]/strategy/fields/suggest] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
