// lib/os/ai/buildStrategyFieldPrompt.ts
// Strategy Field Prompt Builder
//
// Single function that builds AI prompts for strategy field generation.
// Driven by contracts defined in strategyFieldContracts.ts.
//
// Pattern: Similar to UI state selectors but for AI prompt composition.

import type { ContextFieldV4 } from '@/lib/types/contextField';
import {
  getContract,
  getAIInputKeyLabel,
  isStrategyInputKey,
  isStrategyFallbackKey,
  CATEGORY_SAFETY_RULE,
  GOAL_ALIGNMENT_RULE,
  BUSINESS_DEFINITION_KEYS,
  BUSINESS_DEFINITION_MISSING_RULE,
  type StrategyFieldKey,
  type ContextV4Key,
  type AIInputKey,
  type StrategyFallbackKey,
  type AIGenerationContract,
} from './strategyFieldContracts';

// ============================================================================
// Types
// ============================================================================

/**
 * Confirmed context snapshot - key-value pairs from confirmed fields only
 */
export interface ConfirmedContextSnapshot {
  /** Map of field paths to their confirmed values */
  fields: Record<string, unknown>;
  /** Original V4 fields for richer metadata access */
  raw?: ContextFieldV4[];
}

/**
 * Strategy-level inputs (from Strategy record, not Context V4)
 */
export interface StrategyInputs {
  /** Plain-language goal statement (0-400 chars) */
  goalStatement?: string;
}

/**
 * Repair mode for targeted variant regeneration
 */
export type RewriteMode = 'defensible' | 'constraints';

/**
 * Warning types to explicitly avoid during generation
 */
export type AvoidWarningType =
  | 'banned_phrase'
  | 'invented_claim'
  | 'generic_fluff'
  | 'constraint_violation';

/**
 * Input arguments for prompt building
 */
export interface BuildPromptArgs {
  /** The strategy field to generate */
  fieldKey: StrategyFieldKey;
  /** Confirmed context snapshot (ONLY confirmed fields) */
  contextSnapshot: ConfirmedContextSnapshot;
  /** GAP-derived fallback inputs (e.g., business summary) */
  fallbackInputs?: Partial<Record<StrategyFallbackKey, string>>;
  /** Strategy-level inputs (goalStatement, etc.) */
  strategyInputs?: StrategyInputs;
  /** Current value of the field (for improvement, not blind replacement) */
  currentValue?: string;
  /** Override number of variants (defaults to contract spec) */
  variantCount?: number;
  /** Company name for personalization */
  companyName?: string;

  // === Repair Mode Options ===
  /** Specific variant text to repair (enables repair mode) */
  variantToRepair?: string;
  /** Mode for rewriting: 'defensible' removes unsupported claims, 'constraints' respects operational limits */
  rewriteMode?: RewriteMode;
  /** Warning types to explicitly avoid in generation */
  avoidWarnings?: AvoidWarningType[];
  /** Specific phrases that caused warnings (to avoid in regeneration) */
  avoidPhrases?: string[];
}

/**
 * Metadata about what inputs were used (for UI trust chips)
 */
export interface PromptGeneratedUsing {
  /** Primary input keys that were found and used (includes both Context V4 and Strategy keys) */
  usedPrimaryKeys: AIInputKey[];
  /** Fallback input keys that were used (e.g., GAP summary) */
  usedFallbackKeys: StrategyFallbackKey[];
  /** Constraint keys that were found and applied */
  usedConstraintKeys: ContextV4Key[];
  /** Primary input keys that were missing */
  missingPrimaryKeys: AIInputKey[];
  /** Secondary input keys that were used (includes both Context V4 and Strategy keys) */
  usedSecondaryKeys: AIInputKey[];
  /** Human-readable labels for used primary keys */
  primaryLabels: string[];
  /** Human-readable labels for used fallback keys */
  fallbackLabels: string[];
  /** Human-readable labels for used constraint keys */
  constraintLabels: string[];
  /** Whether category safety mode was activated due to missing anchors */
  categorySafetyMode: boolean;
  /** Missing category safety anchor keys (if any) */
  missingCategorySafetyKeys: ContextV4Key[];
  /** Whether goal alignment rule is active */
  goalAlignmentActive: boolean;
  /** Whether business definition is missing (neutral mode active) */
  businessDefinitionMissing: boolean;
  /** Which business definition keys are missing */
  missingBusinessDefinitionKeys: ContextV4Key[];
}

/**
 * Result of prompt building
 */
export interface BuildPromptResult {
  /** System prompt for the AI */
  systemPrompt: string;
  /** User prompt with all context and instructions */
  userPrompt: string;
  /** Metadata about what was used */
  generatedUsing: PromptGeneratedUsing;
  /** Contract that was used */
  contract: AIGenerationContract;
  /** Number of variants requested */
  variantCount: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract a value from context or strategy inputs by key
 */
function extractValue(
  snapshot: ConfirmedContextSnapshot,
  strategyInputs: StrategyInputs | undefined,
  fallbackInputs: Partial<Record<StrategyFallbackKey, string>> | undefined,
  key: AIInputKey
): unknown | undefined {
  // Handle strategy-level keys
  if (isStrategyInputKey(key)) {
    if (key === 'strategy.goalStatement') {
      return strategyInputs?.goalStatement;
    }
    return undefined;
  }
  // Handle GAP-derived fallback keys
  if (isStrategyFallbackKey(key)) {
    return fallbackInputs?.[key];
  }
  // Handle Context V4 keys
  return snapshot.fields[key];
}

/**
 * Format a value for inclusion in a prompt
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '[unknown]';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[none specified]';
    return value.map(v => {
      if (typeof v === 'object' && v !== null) {
        // Handle complex objects (like competitors)
        if ('name' in v) return String(v.name);
        return JSON.stringify(v);
      }
      return String(v);
    }).join(', ');
  }
  if (typeof value === 'object') {
    // Handle complex objects
    if ('name' in value) return String((value as { name: unknown }).name);
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Check which keys from a list are present in context or strategy inputs
 */
function categorizeKeys(
  keys: AIInputKey[],
  snapshot: ConfirmedContextSnapshot,
  strategyInputs?: StrategyInputs,
  fallbackInputs?: Partial<Record<StrategyFallbackKey, string>>
): { found: AIInputKey[]; missing: AIInputKey[] } {
  const found: AIInputKey[] = [];
  const missing: AIInputKey[] = [];

  for (const key of keys) {
    const value = extractValue(snapshot, strategyInputs, fallbackInputs, key);
    if (value !== undefined && value !== null && value !== '') {
      found.push(key);
    } else {
      missing.push(key);
    }
  }

  return { found, missing };
}

/**
 * Check which Context V4 keys from a list are present (for constraints/safety)
 */
function categorizeContextKeys(
  keys: ContextV4Key[],
  snapshot: ConfirmedContextSnapshot
): { found: ContextV4Key[]; missing: ContextV4Key[] } {
  const found: ContextV4Key[] = [];
  const missing: ContextV4Key[] = [];

  for (const key of keys) {
    const value = snapshot.fields[key];
    if (value !== undefined && value !== null) {
      found.push(key);
    } else {
      missing.push(key);
    }
  }

  return { found, missing };
}

/**
 * Build a bullet list of key-value pairs for the prompt
 */
function buildKeyValueList(
  keys: AIInputKey[],
  snapshot: ConfirmedContextSnapshot,
  strategyInputs?: StrategyInputs,
  fallbackInputs?: Partial<Record<StrategyFallbackKey, string>>,
  prefix: string = ''
): string {
  const lines: string[] = [];
  for (const key of keys) {
    const value = extractValue(snapshot, strategyInputs, fallbackInputs, key);
    const label = getAIInputKeyLabel(key);
    const formattedValue = formatValue(value);
    lines.push(`${prefix}- ${label}: ${formattedValue}`);
  }
  return lines.join('\n');
}

/**
 * Build a bullet list of Context V4 key-value pairs (for constraints)
 */
function buildContextKeyValueList(
  keys: ContextV4Key[],
  snapshot: ConfirmedContextSnapshot,
  prefix: string = ''
): string {
  const lines: string[] = [];
  for (const key of keys) {
    const value = snapshot.fields[key];
    const label = getAIInputKeyLabel(key);
    const formattedValue = formatValue(value);
    lines.push(`${prefix}- ${label}: ${formattedValue}`);
  }
  return lines.join('\n');
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build a prompt for AI generation of a strategy field
 *
 * This is the single source of truth for prompt composition.
 * It uses the contract for the field to determine:
 * - What inputs to include
 * - What constraints to apply
 * - What exclusions to avoid
 * - What output format to request
 *
 * @param args - Input arguments
 * @returns Complete prompt and metadata
 */
export function buildStrategyFieldPrompt(args: BuildPromptArgs): BuildPromptResult {
  const {
    fieldKey,
    contextSnapshot,
    fallbackInputs,
    strategyInputs,
    currentValue,
    variantCount: overrideVariants,
    companyName,
    // Repair mode options
    variantToRepair,
    rewriteMode,
    avoidWarnings,
    avoidPhrases,
  } = args;

  // Load contract
  const contract = getContract(fieldKey);
  // In repair mode, we only generate 1 variant
  const variantCount = variantToRepair ? 1 : (overrideVariants ?? contract.outputSpec.variants);

  // Check business definition inputs (for neutral mode)
  // Active when: contract requires it AND any business definition key is missing
  const businessDefinitionResult = categorizeContextKeys(
    BUSINESS_DEFINITION_KEYS,
    contextSnapshot
  );
  const businessDefinitionMissing = !!(
    contract.requireBusinessDefinition &&
    businessDefinitionResult.missing.length > 0
  );

  // Determine if GAP fallback is available
  const gapBusinessSummary = fallbackInputs?.['gap.businessSummary'];
  const gapFallbackAvailable = !!(
    contract.allowGapFallbackWhenBusinessDefinitionMissing &&
    gapBusinessSummary &&
    gapBusinessSummary.trim().length > 0
  );

  // Build effective primary inputs (include GAP fallback when allowed)
  const effectivePrimaryKeys: AIInputKey[] = [...contract.primaryInputs];
  if (
    businessDefinitionMissing &&
    gapFallbackAvailable &&
    contract.fallbackPrimaryInputs?.includes('gap.businessSummary')
  ) {
    effectivePrimaryKeys.push('gap.businessSummary');
  }

  // Categorize inputs (includes both Context V4 and Strategy keys)
  const primaryResult = categorizeKeys(
    effectivePrimaryKeys,
    contextSnapshot,
    strategyInputs,
    fallbackInputs
  );
  const secondaryResult = contract.secondaryInputs
    ? categorizeKeys(contract.secondaryInputs, contextSnapshot, strategyInputs, fallbackInputs)
    : { found: [], missing: [] };

  // Constraints are Context V4 only
  const constraintResult = contract.hardConstraints
    ? categorizeContextKeys(contract.hardConstraints, contextSnapshot)
    : { found: [], missing: [] };

  // Check category safety inputs (Context V4 only)
  const categorySafetyResult = contract.categorySafetyInputs
    ? categorizeContextKeys(contract.categorySafetyInputs, contextSnapshot)
    : { found: [], missing: [] };
  const categorySafetyMode = categorySafetyResult.missing.length > 0;

  // Check if goal alignment rule should be active
  // Active when: contract requires it AND goalStatement is provided
  const goalAlignmentActive = !!(
    contract.requireGoalAlignment &&
    strategyInputs?.goalStatement &&
    strategyInputs.goalStatement.trim().length > 0
  );

  // Build metadata
  const generatedUsing: PromptGeneratedUsing = {
    usedPrimaryKeys: primaryResult.found,
    usedConstraintKeys: constraintResult.found,
    missingPrimaryKeys: primaryResult.missing,
    usedSecondaryKeys: secondaryResult.found,
    primaryLabels: primaryResult.found
      .filter(k => !isStrategyFallbackKey(k))
      .map(getAIInputKeyLabel),
    fallbackLabels: primaryResult.found
      .filter(isStrategyFallbackKey)
      .map(getAIInputKeyLabel),
    constraintLabels: constraintResult.found.map(getAIInputKeyLabel),
    categorySafetyMode,
    missingCategorySafetyKeys: categorySafetyResult.missing,
    goalAlignmentActive,
    businessDefinitionMissing,
    missingBusinessDefinitionKeys: businessDefinitionResult.missing,
    usedFallbackKeys: primaryResult.found.filter(isStrategyFallbackKey),
  };

  // Build system prompt
  const systemPrompt = buildSystemPrompt(contract);

  // Build user prompt (with optional repair mode)
  const userPrompt = buildUserPrompt({
    contract,
    snapshot: contextSnapshot,
    fallbackInputs,
    strategyInputs,
    primaryKeys: effectivePrimaryKeys,
    secondaryKeys: contract.secondaryInputs || [],
    constraintKeys: contract.hardConstraints || [],
    currentValue,
    variantCount,
    companyName,
    // Pass repair options through
    variantToRepair,
    rewriteMode,
    avoidWarnings,
    avoidPhrases,
    // Category safety mode
    categorySafetyMode,
    // Goal alignment
    goalAlignmentActive,
    // Business definition missing (neutral mode)
    businessDefinitionMissing,
    gapFallbackAvailable,
    gapBusinessSummary,
  });

  return {
    systemPrompt,
    userPrompt,
    generatedUsing,
    contract,
    variantCount,
  };
}

/**
 * The "No New Claims" rule - always included in prompts
 */
export const NO_NEW_CLAIMS_RULE = `CRITICAL: Do not introduce ANY new products, features, audiences, pricing, claims, metrics, partnerships, or capabilities not explicitly stated in the provided inputs. You may only reference what is given - never invent or assume.`;

/**
 * Build the system prompt
 */
function buildSystemPrompt(contract: AIGenerationContract): string {
  return `You are a strategic marketing consultant helping generate ${contract.label.toLowerCase()} options for a business.

Your role is to:
1. Generate clear, specific, differentiated options
2. Honor all provided context about the business
3. Respect all constraints
4. Avoid generic or unsupported claims

${NO_NEW_CLAIMS_RULE}

You must output ONLY a JSON object with this structure:
{
  "variants": [
    { "text": "variant 1 text" },
    { "text": "variant 2 text" },
    ...
  ]
}

Do not include any explanation, preamble, or markdown formatting outside the JSON.`;
}

/**
 * Build the user prompt with all context sections
 */
function buildUserPrompt(args: {
  contract: AIGenerationContract;
  snapshot: ConfirmedContextSnapshot;
  fallbackInputs?: Partial<Record<StrategyFallbackKey, string>>;
  strategyInputs?: StrategyInputs;
  primaryKeys: AIInputKey[];
  secondaryKeys: AIInputKey[];
  constraintKeys: ContextV4Key[];
  currentValue?: string;
  variantCount: number;
  companyName?: string;
  // Repair mode options
  variantToRepair?: string;
  rewriteMode?: RewriteMode;
  avoidWarnings?: AvoidWarningType[];
  avoidPhrases?: string[];
  // Category safety mode
  categorySafetyMode?: boolean;
  // Goal alignment
  goalAlignmentActive?: boolean;
  // Business definition missing (neutral mode)
  businessDefinitionMissing?: boolean;
  gapFallbackAvailable?: boolean;
  gapBusinessSummary?: string;
}): string {
  const {
    contract,
    snapshot,
    fallbackInputs,
    strategyInputs,
    primaryKeys,
    secondaryKeys,
    constraintKeys,
    currentValue,
    variantCount,
    companyName,
    variantToRepair,
    rewriteMode,
    avoidWarnings,
    avoidPhrases,
    categorySafetyMode,
    goalAlignmentActive,
    businessDefinitionMissing,
    gapFallbackAvailable,
    gapBusinessSummary,
  } = args;

  const sections: string[] = [];
  const isRepairMode = !!variantToRepair && !!rewriteMode;

  // Header - different for repair vs normal mode
  const forBusiness = companyName ? ` for ${companyName}` : '';
  if (isRepairMode) {
    sections.push(`## Goal\nREPAIR the following ${contract.label} variant${forBusiness}.\n\nOriginal variant to repair:\n"${variantToRepair}"`);
  } else {
    sections.push(`## Goal\nGenerate ${variantCount} alternative ${contract.label} variants${forBusiness}.`);
  }

  // === REPAIR INSTRUCTIONS (only in repair mode) ===
  if (isRepairMode) {
    const repairInstructions: string[] = [];

    if (rewriteMode === 'defensible') {
      repairInstructions.push(
        '- Remove any claims that cannot be verified from the provided context',
        '- Replace invented statistics, awards, or credentials with context-grounded alternatives',
        '- Keep the core message and intent intact',
        '- Do not add new features, benefits, or claims not in the context'
      );
    } else if (rewriteMode === 'constraints') {
      repairInstructions.push(
        '- Ensure the variant respects all operational constraints listed below',
        '- Scale claims appropriately to match resource/budget reality',
        '- Replace "enterprise" or "global" language if it contradicts small team/budget context',
        '- Keep the core message and intent intact'
      );
    }

    // Add specific warnings to avoid
    if (avoidWarnings && avoidWarnings.length > 0) {
      const warningDescriptions: Record<AvoidWarningType, string> = {
        banned_phrase: 'Do not use any banned/excluded phrases',
        invented_claim: 'Do not invent claims, stats, or credentials not in context',
        generic_fluff: 'Avoid generic marketing buzzwords (revolutionary, seamless, etc.)',
        constraint_violation: 'Respect all operational constraints (budget, team size, etc.)',
      };
      for (const w of avoidWarnings) {
        repairInstructions.push(`- ${warningDescriptions[w]}`);
      }
    }

    sections.push(`## REPAIR Instructions\n${repairInstructions.join('\n')}`);

    // Explicit NO_NEW_CLAIMS reminder in repair mode
    sections.push(`## CRITICAL REPAIR RULE\n${NO_NEW_CLAIMS_RULE}`);
  }

  // === Phrases to explicitly avoid ===
  if (avoidPhrases && avoidPhrases.length > 0) {
    sections.push(`## Phrases to REMOVE or AVOID\nThe following phrases caused issues and must NOT appear in the output:\n${avoidPhrases.map(p => `- "${p}"`).join('\n')}`);
  }

  // === Category Safety Mode ===
  if (categorySafetyMode) {
    sections.push(`## CRITICAL: ${CATEGORY_SAFETY_RULE}`);
  }

  // === Goal Alignment Rule ===
  if (goalAlignmentActive) {
    sections.push(`## CRITICAL: ${GOAL_ALIGNMENT_RULE}`);
  }

  // === Business Definition Missing (Neutral Mode) ===
  if (businessDefinitionMissing) {
    if (gapFallbackAvailable && gapBusinessSummary) {
      sections.push(`## CRITICAL: GAP Business Definition (Fallback)
Confirmed business-definition inputs are missing. Use the GAP-derived summary below as the best available definition. You MUST:
- Align to this summary without changing the domain
- Avoid CRO/analytics/website-audit claims unless explicitly stated
- Stay grounded in the provided description and audience`);
      sections.push(`## GAP-derived business summary (use as primary definition)
- ${gapBusinessSummary}`);
    } else {
      sections.push(`## CRITICAL: ${BUSINESS_DEFINITION_MISSING_RULE}`);
      // Force neutral template output
      sections.push(`## REQUIRED OUTPUT FORMAT (Neutral Mode Active)
All variants MUST follow this exact template format:
"We help [audience] to [outcome]"

If audience or outcome is not known, leave clear placeholders (e.g., "[your primary audience]" / "[the primary job you solve]") instead of guessing.
You may NOT deviate from this format. Do not use any mechanism language, platform references, or feature descriptions.`);
    }
  }

  // Primary inputs (MUST honor)
  sections.push(`## MUST Honor (Primary Inputs)\n${buildKeyValueList(primaryKeys, snapshot, strategyInputs, fallbackInputs)}`);

  // Secondary inputs (MAY influence)
  if (secondaryKeys.length > 0) {
    const secondaryList = buildKeyValueList(secondaryKeys, snapshot, strategyInputs, fallbackInputs);
    if (secondaryList.trim()) {
      sections.push(`## MAY Influence (Secondary Inputs)\n${secondaryList}`);
    }
  }

  // Hard constraints (MUST NOT violate) - Context V4 only
  if (constraintKeys.length > 0) {
    const constraintList = buildContextKeyValueList(constraintKeys, snapshot);
    sections.push(`## MUST NOT Violate (Constraints)\n${constraintList}`);
  } else {
    sections.push(`## MUST NOT Violate (Constraints)\n- No specific constraints provided`);
  }

  // Exclusions
  if (contract.exclusions && contract.exclusions.length > 0) {
    sections.push(`## Do NOT Use These Phrases\n${contract.exclusions.map(e => `- "${e}"`).join('\n')}`);
  }

  // Style guidance
  if (contract.styleGuidance) {
    sections.push(`## Style Guidance\n${contract.styleGuidance}`);
  }

  // Current value handling (only in normal mode, not repair)
  if (currentValue && !isRepairMode) {
    sections.push(`## Current Value (Improve, Don't Replace Blindly)\nThe current ${contract.label.toLowerCase()} is:\n"${currentValue}"\n\nMaintain the core intent but improve clarity, differentiation, or specificity.`);
  }

  // Output format - in repair mode, we only want 1 variant
  const outputVariantCount = isRepairMode ? 1 : variantCount;
  sections.push(`## Output Format
Return a JSON object with exactly ${outputVariantCount} variant${outputVariantCount > 1 ? 's' : ''}.
Each variant should be ${contract.outputSpec.format === 'bullets' ? 'a bulleted list' : 'a paragraph'} of no more than ${contract.outputSpec.maxWords} words.

Example:
{
  "variants": [
    { "text": "${isRepairMode ? 'Repaired variant text here' : 'First variant text here' }"${outputVariantCount > 1 ? '},\n    { "text": "Second variant text here" }' : ' }'}
  ]
}`);

  return sections.join('\n\n');
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Create a confirmed context snapshot from V4 fields
 */
export function createSnapshotFromFields(fields: ContextFieldV4[]): ConfirmedContextSnapshot {
  const snapshot: ConfirmedContextSnapshot = {
    fields: {},
    raw: fields,
  };

  for (const field of fields) {
    if (field.status === 'confirmed') {
      snapshot.fields[field.key] = field.value;
    }
  }

  return snapshot;
}

/**
 * Get human-readable summary of what was used (for UI)
 */
export function getGeneratedUsingSummary(meta: PromptGeneratedUsing): string {
  const parts: string[] = [];

  if (meta.primaryLabels.length > 0) {
    parts.push(meta.primaryLabels.join(' + '));
  }

  if (meta.constraintLabels.length > 0) {
    parts.push(`Constraints: ${meta.constraintLabels.join(', ')}`);
  }

  if (parts.length === 0) {
    return 'No confirmed context used';
  }

  return `Generated using: ${parts.join(' | ')}`;
}
