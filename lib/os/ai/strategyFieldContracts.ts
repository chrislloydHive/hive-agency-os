// lib/os/ai/strategyFieldContracts.ts
// Strategy Field Generation Contracts
//
// Defines contracts for AI-driven strategy field suggestions.
// Each contract specifies what confirmed Context V4 fields are required,
// constraints that must not be violated, and output specifications.
//
// Pattern: Similar to UI state selectors but for AI generation.

// ============================================================================
// Types
// ============================================================================

/**
 * Strategy fields that can be AI-generated
 * Extensible - add new fields as needed
 */
export type StrategyFieldKey =
  | 'valueProp'
  | 'positioning'
  | 'audience'
  | 'objectives'
  | 'constraints'
  | 'bets';

/**
 * Context V4 field paths that can be used as inputs
 * Format: "domain.field" (e.g., "audience.icpDescription")
 */
export type ContextV4Key =
  // Identity
  | 'identity.businessModel'
  | 'identity.businessName'
  | 'identity.industry'
  | 'identity.revenueModel'
  | 'identity.businessType'
  // Audience
  | 'audience.primaryAudience'
  | 'audience.icpDescription'
  | 'audience.coreSegments'
  | 'audience.demographics'
  | 'audience.painPoints'
  | 'audience.buyingBehavior'
  // Product/Offer
  | 'productOffer.primaryProducts'
  | 'productOffer.heroProducts'
  | 'productOffer.productLines'
  | 'productOffer.valueProposition'
  | 'productOffer.differentiators'
  | 'productOffer.pricingModel'
  // Brand
  | 'brand.positioning'
  | 'brand.valueProps'
  | 'brand.differentiators'
  | 'brand.toneOfVoice'
  | 'brand.messagingPillars'
  // Competitive
  | 'competitive.competitors'
  | 'competitive.positionSummary'
  | 'competitive.competitiveAdvantages'
  | 'competition.primaryCompetitors'
  | 'competition.landscapeAnalysis'
  // Operational Constraints
  | 'operationalConstraints.budgetCapsFloors'
  | 'operationalConstraints.minBudget'
  | 'operationalConstraints.maxBudget'
  | 'operationalConstraints.resourceConstraints'
  | 'operationalConstraints.timeline';

/**
 * Strategy-level field paths (from Strategy record, not Context V4)
 * These are sourced from the selected strategy, not the context snapshot.
 */
export type StrategyInputKey =
  | 'strategy.goalStatement';

/**
 * GAP-derived fallback inputs for strategy fields
 * Used when confirmed Context V4 business definition data is missing
 */
export type StrategyFallbackKey = 'gap.businessSummary' | 'gap.valuePropHint';

/**
 * Combined input key type for all possible AI generation inputs
 */
export type AIInputKey = ContextV4Key | StrategyInputKey | StrategyFallbackKey;

/**
 * Output format specification
 */
export interface OutputSpec {
  /** Number of variants to generate */
  variants: number;
  /** Output format */
  format: 'paragraph' | 'bullets';
  /** Maximum words per variant */
  maxWords: number;
}

/**
 * Contract for AI generation of a strategy field
 *
 * Contracts are explicit about what inputs are required vs optional,
 * what constraints must be honored, and what outputs are expected.
 */
export interface AIGenerationContract {
  /** Field key identifier */
  id: StrategyFieldKey;
  /** Human-readable label */
  label: string;
  /** Description for debugging/UI */
  description: string;

  /**
   * PRIMARY INPUTS - MUST be honored
   * These are the core context fields that drive generation.
   * If missing, generation can proceed but should note "unknown".
   * Can include both ContextV4 keys and Strategy-level keys.
   */
  primaryInputs: AIInputKey[];

  /**
   * SECONDARY INPUTS - MAY influence tone/details
   * Optional context that enriches the output.
   * Can include both ContextV4 keys and Strategy-level keys.
   */
  secondaryInputs?: AIInputKey[];

  /**
   * HARD CONSTRAINTS - MUST NOT be violated
   * Generation must respect these constraints.
   * Missing constraints should be treated as "none specified".
   */
  hardConstraints?: ContextV4Key[];

  /**
   * EXCLUSIONS - phrases/patterns to avoid
   * Common generic phrases or claims that should not appear.
   */
  exclusions?: string[];

  /**
   * STYLE GUIDANCE - optional writing guidance
   * Tone, structure, or formatting hints.
   */
  styleGuidance?: string;

  /**
   * CATEGORY SAFETY INPUTS - strategic anchors that prevent drift
   * When ANY of these are missing, CATEGORY_SAFETY_RULE is applied.
   * This prevents the AI from drifting into adjacent product categories.
   */
  categorySafetyInputs?: ContextV4Key[];

  /**
   * GOAL ALIGNMENT RULE - when goalStatement is primary input
   * If true, adds explicit rule requiring alignment with stated goal.
   */
  requireGoalAlignment?: boolean;

  /**
   * BUSINESS DEFINITION GUARDRAIL
   * If true, this contract requires business definition inputs to produce
   * high-quality, differentiated outputs. When these inputs are missing,
   * the BUSINESS_DEFINITION_MISSING_RULE will be applied.
   */
  requireBusinessDefinition?: boolean;

  /**
   * NEUTRAL OUTPUT MODE
   * If true AND business definition inputs are missing, the generator
   * will produce intentionally neutral "We help X do Y" format outputs
   * rather than attempting to infer specifics that could drift.
   */
  neutralIfMissingBusinessDefinition?: boolean;

  /**
   * GAP FALLBACK
   * Allows GAP-derived fallback inputs to be treated as primary when
   * business definition keys are missing.
   */
  allowGapFallbackWhenBusinessDefinitionMissing?: boolean;

  /**
   * Fallback primary inputs (e.g., GAP business summary)
   */
  fallbackPrimaryInputs?: StrategyFallbackKey[];

  /**
   * OUTPUT SPECIFICATION
   */
  outputSpec: OutputSpec;
}

// ============================================================================
// Category Safety Rule
// ============================================================================

/**
 * Category safety rule for when strategic anchors are missing.
 *
 * When key inputs (ICP, positioning, differentiators, business model) are missing,
 * the generator should produce category-safe, descriptive statements only —
 * avoiding mechanism claims that could drift into adjacent product categories.
 */
export const CATEGORY_SAFETY_RULE = `CATEGORY SAFETY MODE (Strategic Anchors Missing):
When key strategic inputs are unavailable, you MUST:
- Do NOT assume product features, mechanisms, or capabilities
- Do NOT imply diagnostics, analytics, optimization, CRO, or automated systems
- Do NOT describe software functionality or platform capabilities
- ONLY describe WHO the product is for and the HIGH-LEVEL BENEFIT
- Generate a descriptive, category-safe value statement only
- Stay abstract — focus on outcomes and audience, not implementation`;

/**
 * Keys that trigger category safety mode when missing
 */
export const CATEGORY_SAFETY_ANCHOR_KEYS: ContextV4Key[] = [
  'audience.icpDescription',
  'brand.positioning',
  'productOffer.differentiators',
  'identity.businessModel',
];

// ============================================================================
// Goal Alignment Rule
// ============================================================================

/**
 * Goal alignment rule for contracts that use goalStatement as primary input.
 *
 * When goalStatement is provided, the AI must align all outputs with the
 * stated goal and must not introduce goals not mentioned by the user.
 */
export const GOAL_ALIGNMENT_RULE = `GOAL ALIGNMENT (Required):
All outputs MUST align with the stated goal. You MUST:
- Ensure every recommendation directly supports achieving the stated goal
- Do NOT introduce objectives, strategies, or bets not clearly aligned with the goal
- Do NOT assume goals beyond what the user has explicitly stated
- If the goal is vague, stay conservative and avoid overinterpreting intent`;

// ============================================================================
// Business Definition Guardrail
// ============================================================================

/**
 * Keys that define the business identity for value proposition generation.
 * When these are missing, the generator must use neutral output mode.
 */
export const BUSINESS_DEFINITION_KEYS: ContextV4Key[] = [
  'audience.icpDescription',
  'brand.positioning',
  'brand.differentiators',
  'identity.businessModel',
];

/**
 * Rule applied when business definition inputs are missing.
 * Forces neutral, non-specific output to prevent category drift.
 */
export const BUSINESS_DEFINITION_MISSING_RULE = `BUSINESS DEFINITION MISSING (Neutral Mode Required):
Key business definition inputs are not yet confirmed. You MUST:
- Do NOT mention CRO, conversion rate optimization, or landing page performance
- Do NOT mention website analytics, scroll depth, bounce rate, or user behavior tracking
- Do NOT imply diagnostics, audits, or performance testing features
- Do NOT assume the product is software, a platform, or a digital tool
- Stay descriptive of WHAT the business does and WHO it serves
- Use ONLY this neutral template format: "We help [audience] to [outcome]"

Example good outputs:
- "We help small businesses grow their customer base"
- "We help fitness trainers connect with clients"
- "We help e-commerce brands increase their sales"

Example BAD outputs (DO NOT generate):
- "Our platform optimizes your conversion funnel" (assumes software/CRO)
- "Track user behavior and improve bounce rates" (assumes analytics)
- "AI-powered insights for landing page performance" (assumes specific mechanisms)`;

// ============================================================================
// Human-readable labels for input keys (for UI trust chips)
// ============================================================================

/**
 * Labels for strategy-level input keys
 */
export const STRATEGY_KEY_LABELS: Record<StrategyInputKey, string> = {
  'strategy.goalStatement': 'Goal Statement',
};

/**
 * Labels for Context V4 keys
 */
export const CONTEXT_KEY_LABELS: Record<ContextV4Key, string> = {
  // Identity
  'identity.businessModel': 'Business Model',
  'identity.businessName': 'Business Name',
  'identity.industry': 'Industry',
  'identity.revenueModel': 'Revenue Model',
  'identity.businessType': 'Business Type',
  // Audience
  'audience.primaryAudience': 'Primary Audience',
  'audience.icpDescription': 'ICP Description',
  'audience.coreSegments': 'Core Segments',
  'audience.demographics': 'Demographics',
  'audience.painPoints': 'Pain Points',
  'audience.buyingBehavior': 'Buying Behavior',
  // Product/Offer
  'productOffer.primaryProducts': 'Primary Products',
  'productOffer.heroProducts': 'Hero Products',
  'productOffer.productLines': 'Product Lines',
  'productOffer.valueProposition': 'Value Proposition',
  'productOffer.differentiators': 'Differentiators',
  'productOffer.pricingModel': 'Pricing Model',
  // Brand
  'brand.positioning': 'Brand Positioning',
  'brand.valueProps': 'Value Props',
  'brand.differentiators': 'Brand Differentiators',
  'brand.toneOfVoice': 'Tone of Voice',
  'brand.messagingPillars': 'Messaging Pillars',
  // Competitive
  'competitive.competitors': 'Competitors',
  'competitive.positionSummary': 'Competitive Position',
  'competitive.competitiveAdvantages': 'Competitive Advantages',
  'competition.primaryCompetitors': 'Primary Competitors',
  'competition.landscapeAnalysis': 'Landscape Analysis',
  // Operational Constraints
  'operationalConstraints.budgetCapsFloors': 'Budget Constraints',
  'operationalConstraints.minBudget': 'Minimum Budget',
  'operationalConstraints.maxBudget': 'Maximum Budget',
  'operationalConstraints.resourceConstraints': 'Resource Constraints',
  'operationalConstraints.timeline': 'Timeline',
};

/**
 * Labels for GAP-derived fallback keys
 */
export const STRATEGY_FALLBACK_KEY_LABELS: Record<StrategyFallbackKey, string> = {
  'gap.businessSummary': 'GAP summary',
  'gap.valuePropHint': 'GAP value prop hint',
};

// ============================================================================
// Contract Definitions
// ============================================================================

/**
 * Value Proposition contract
 *
 * Generates alternative value proposition statements that articulate
 * why customers should choose this business over alternatives.
 */
const VALUE_PROP_CONTRACT: AIGenerationContract = {
  id: 'valueProp',
  label: 'Value Proposition',
  description: 'Generate compelling value proposition statements',

  primaryInputs: [
    'audience.icpDescription',
    'brand.positioning',
    'productOffer.differentiators',
    'productOffer.valueProposition', // existing value prop if any
    'identity.businessModel',
  ],

  // GAP fallback when business definition keys are missing
  allowGapFallbackWhenBusinessDefinitionMissing: true,
  fallbackPrimaryInputs: ['gap.businessSummary'],

  secondaryInputs: [
    'strategy.goalStatement', // SECONDARY - stabilizer when context is incomplete
    'audience.painPoints',
    'competitive.competitiveAdvantages',
    'brand.toneOfVoice',
  ],

  hardConstraints: [
    'operationalConstraints.budgetCapsFloors',
    'operationalConstraints.resourceConstraints',
  ],

  /**
   * Category safety inputs - when ANY are missing, avoid mechanism claims.
   * Prevents drift into adjacent product categories (CRO, diagnostics, etc.)
   */
  categorySafetyInputs: [
    'audience.icpDescription',
    'brand.positioning',
    'productOffer.differentiators',
    'identity.businessModel',
  ],

  /**
   * Business definition guardrail - requires ICP + business model to produce
   * differentiated outputs. When missing, uses neutral "We help X do Y" format.
   */
  requireBusinessDefinition: true,
  neutralIfMissingBusinessDefinition: true,

  exclusions: [
    'enterprise-grade', // unless explicitly in context
    'AI-powered', // unless product is actually AI
    'cutting-edge',
    'world-class',
    'industry-leading',
    'best-in-class',
    'seamless',
    'innovative', // too generic
    'revolutionary',
    'disruptive',
    'game-changing',
    'next-generation',
    'end-to-end',
    'holistic',
    'synergy',
    'leverage',
    'empower',
  ],

  styleGuidance: `
Write plainspoken, differentiated value propositions.
Each variant should be 1-2 sentences that clearly articulate:
1. WHO the customer is
2. WHAT problem you solve
3. WHY you're different from alternatives

Avoid jargon and unsupported claims.
Be specific to this business - generic statements are not helpful.

GUARDRAIL (CRO/Website Drift Prevention):
- Do NOT mention CRO, conversion rate optimization, or landing page performance
- Do NOT mention website analytics, scroll depth, bounce rate, or user behavior tracking
- Do NOT imply diagnostics, audits, or performance testing features
- These terms should ONLY appear if explicitly present in the confirmed context inputs
`.trim(),

  outputSpec: {
    variants: 3,
    format: 'paragraph',
    maxWords: 50,
  },
};

/**
 * Positioning contract
 *
 * Generates positioning statements using the classic "For [ICP]..." format.
 */
const POSITIONING_CONTRACT: AIGenerationContract = {
  id: 'positioning',
  label: 'Positioning Statement',
  description: 'Generate strategic positioning statements',

  primaryInputs: [
    'audience.icpDescription',
    'audience.primaryAudience',
    'productOffer.differentiators',
    'competition.primaryCompetitors',
    'competitive.positionSummary',
  ],

  secondaryInputs: [
    'strategy.goalStatement', // SECONDARY - stabilizer when context is incomplete
    'identity.industry',
    'brand.toneOfVoice',
    'audience.painPoints',
    'productOffer.valueProposition',
  ],

  hardConstraints: [
    'operationalConstraints.budgetCapsFloors',
    'operationalConstraints.resourceConstraints',
  ],

  exclusions: [
    'only solution',
    'best solution',
    '#1',
    'market leader', // unless proven
    'unparalleled',
    'unmatched',
    'unique', // too generic
    'superior',
    'premium', // unless pricing supports it
    'affordable', // unless pricing supports it
  ],

  styleGuidance: `
Use the classic positioning format:
"For [target customer] who [statement of need], [brand name] is a [frame of reference] that [key benefit]. Unlike [alternatives], we [key differentiator]."

Be concise and specific. Each positioning statement should:
1. Clearly identify the target customer
2. State the primary need or problem
3. Define the category/frame of reference
4. Articulate the key benefit
5. Differentiate from alternatives

Do not make unsupported claims about market position.
`.trim(),

  outputSpec: {
    variants: 3,
    format: 'paragraph',
    maxWords: 60,
  },
};

/**
 * Audience contract (placeholder for future expansion)
 */
const AUDIENCE_CONTRACT: AIGenerationContract = {
  id: 'audience',
  label: 'Target Audience',
  description: 'Generate audience segment descriptions',

  primaryInputs: [
    'audience.primaryAudience',
    'audience.icpDescription',
    'audience.demographics',
    'productOffer.primaryProducts',
  ],

  secondaryInputs: [
    'audience.painPoints',
    'audience.buyingBehavior',
    'identity.industry',
  ],

  hardConstraints: [],

  exclusions: [
    'everyone',
    'anyone who',
    'all businesses',
    'companies of all sizes',
  ],

  styleGuidance: `
Be specific about who the ideal customer is.
Include firmographics, psychographics, or behavioral traits.
Avoid descriptions so broad they could apply to any business.
`.trim(),

  outputSpec: {
    variants: 3,
    format: 'bullets',
    maxWords: 80,
  },
};

// ============================================================================
// Contract Registry
// ============================================================================

/**
 * All registered contracts
 */
const CONTRACTS: Record<StrategyFieldKey, AIGenerationContract> = {
  valueProp: VALUE_PROP_CONTRACT,
  positioning: POSITIONING_CONTRACT,
  audience: AUDIENCE_CONTRACT,
  // Goal-driven contracts (goalStatement as PRIMARY input)
  objectives: {
    id: 'objectives',
    label: 'Strategic Objectives',
    description: 'Generate strategic objective recommendations aligned with stated goal',
    primaryInputs: [
      'strategy.goalStatement', // PRIMARY - drives objective generation
      'identity.businessModel',
      'productOffer.valueProposition',
    ],
    secondaryInputs: [
      'audience.icpDescription',
      'competitive.positionSummary',
    ],
    requireGoalAlignment: true, // All objectives must align with goal
    styleGuidance: `
Generate SMART objectives (Specific, Measurable, Achievable, Relevant, Time-bound) that directly support the stated goal.
Each objective should be:
1. Clearly tied to the goal statement
2. Actionable and specific
3. Realistic given the business context
Do not introduce objectives unrelated to the stated goal.
`.trim(),
    outputSpec: { variants: 3, format: 'bullets', maxWords: 100 },
  },
  constraints: {
    id: 'constraints',
    label: 'Strategic Constraints',
    description: 'Generate constraint awareness statements',
    primaryInputs: [
      'operationalConstraints.budgetCapsFloors',
      'operationalConstraints.resourceConstraints',
    ],
    secondaryInputs: [
      'strategy.goalStatement', // SECONDARY - stabilizer for constraints
      'operationalConstraints.timeline',
    ],
    styleGuidance: `
Articulate realistic constraints that the strategy must operate within.
Be specific about budget ranges, team capacity, and timeline limitations.
`.trim(),
    outputSpec: { variants: 2, format: 'bullets', maxWords: 60 },
  },
  bets: {
    id: 'bets',
    label: 'Strategic Bets',
    description: 'Generate strategic bet recommendations aligned with stated goal',
    primaryInputs: [
      'strategy.goalStatement', // PRIMARY - drives bet generation
      'competitive.positionSummary',
      'audience.icpDescription',
      'productOffer.differentiators',
    ],
    secondaryInputs: [
      'identity.businessModel',
      'audience.painPoints',
    ],
    requireGoalAlignment: true, // All bets must align with goal
    styleGuidance: `
Generate strategic bets that represent calculated risks in pursuit of the stated goal.
Each bet should:
1. Directly support achieving the stated goal
2. Identify a specific opportunity or hypothesis
3. Be bold but defensible given the competitive context
Do not introduce bets unrelated to the stated goal.
`.trim(),
    outputSpec: { variants: 3, format: 'paragraph', maxWords: 80 },
  },
};

// ============================================================================
// Exports
// ============================================================================

/**
 * Get a contract by field key
 * @throws Error if contract not found
 */
export function getContract(fieldKey: StrategyFieldKey): AIGenerationContract {
  const contract = CONTRACTS[fieldKey];
  if (!contract) {
    throw new Error(`No contract found for field key: ${fieldKey}`);
  }
  return contract;
}

/**
 * Get all registered field keys
 */
export function getAllFieldKeys(): StrategyFieldKey[] {
  return Object.keys(CONTRACTS) as StrategyFieldKey[];
}

/**
 * Check if a field key has a contract
 */
export function hasContract(fieldKey: string): fieldKey is StrategyFieldKey {
  return fieldKey in CONTRACTS;
}

/**
 * Get the human-readable label for a context key
 */
export function getContextKeyLabel(key: ContextV4Key): string {
  return CONTEXT_KEY_LABELS[key] || key.split('.').pop() || key;
}

/**
 * Get the human-readable label for any AI input key (context or strategy)
 */
export function getAIInputKeyLabel(key: AIInputKey): string {
  if (key.startsWith('strategy.')) {
    return STRATEGY_KEY_LABELS[key as StrategyInputKey] || key.split('.').pop() || key;
  }
  if (key.startsWith('gap.')) {
    return STRATEGY_FALLBACK_KEY_LABELS[key as StrategyFallbackKey] || key.split('.').pop() || key;
  }
  return CONTEXT_KEY_LABELS[key as ContextV4Key] || key.split('.').pop() || key;
}

/**
 * Check if a key is a strategy-level input (vs Context V4)
 */
export function isStrategyInputKey(key: AIInputKey): key is StrategyInputKey {
  return key.startsWith('strategy.');
}

/**
 * Check if a key is a GAP-derived fallback input
 */
export function isStrategyFallbackKey(key: AIInputKey): key is StrategyFallbackKey {
  return key.startsWith('gap.');
}
