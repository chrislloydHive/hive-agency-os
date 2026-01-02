// lib/os/context/schema.ts
// Canonical Context Schema - LOCKED
//
// This defines the AUTHORITATIVE canonical context fields for Hive OS.
// This schema is LOCKED - no freeform fields, no "notes", no generic content.
//
// Key principles:
// - Facts only, no recommendations/advice
// - Provenance-aware (source, confidence, status)
// - Predetermined fields ONLY - no freeform notes
// - Quality guards: min/max length, no placeholders
// - Fields must be concrete and strategy-usable
//
// SCHEMA LOCK: Any changes to this file require explicit approval.
// Do not add generic fields like "notes", "summary", or "thoughts".

// ============================================================================
// Context Dimensions
// ============================================================================

export type ContextDimension =
  | 'BusinessReality'
  | 'AudienceICP'
  | 'Offer'
  | 'Brand'
  | 'GoToMarket'
  | 'CompetitiveLandscape'
  | 'Constraints'
  | 'ExecutionCapabilities';

// ============================================================================
// Canonical Field Keys
// ============================================================================

/**
 * Predetermined canonical field keys
 * These are the fields that MUST be populated for Strategy Frame
 */
export type CanonicalFieldKey =
  // Strategic Frame (required for strategy)
  | 'audience_icp_primary'
  | 'audience_icp_secondary'
  | 'value_prop'
  | 'positioning'
  | 'differentiators'
  | 'constraints_max_budget'
  | 'constraints_min_budget'
  | 'constraints_geo'
  | 'competitors_primary'
  | 'competitors_notes'
  // Supporting fields
  | 'offer_products_services'
  | 'gtm_primary_channels'
  | 'gtm_sales_motion'
  | 'brand_tone'
  | 'execution_capabilities'
  | 'business_stage'
  | 'business_archetype'
  | 'business_model'
  | 'industry';

// ============================================================================
// Field Status & Source
// ============================================================================

export type ContextFieldStatus = 'missing' | 'proposed' | 'confirmed';

export type ContextFieldSourceType = 'lab' | 'gap' | 'user';

export interface LabFieldSource {
  type: 'lab';
  lab: string;
  runId: string;
  evidence?: string;
}

export interface GapFieldSource {
  type: 'gap';
  runId: string;
  evidence?: string;
}

export interface UserFieldSource {
  type: 'user';
  userId?: string;
  evidence?: string;
}

export type ContextFieldSource = LabFieldSource | GapFieldSource | UserFieldSource;

// ============================================================================
// Context Field Record
// ============================================================================

export interface ContextFieldRecord {
  key: CanonicalFieldKey;
  dimension: ContextDimension;
  label: string;
  value: string;
  confidence: number; // 0-1
  status: ContextFieldStatus;
  sources: ContextFieldSource[];
  updatedAt: string;
}

/**
 * Candidate for upsert (before persistence)
 */
export interface ContextFieldCandidate {
  key: CanonicalFieldKey;
  value: string;
  confidence: number;
  sources: ContextFieldSource[];
}

// ============================================================================
// Field Definitions (Schema)
// ============================================================================

/**
 * Workflow types that may require context fields
 */
export type WorkflowType = 'strategy' | 'programs' | 'briefs' | 'work';

export interface CanonicalFieldDefinition {
  key: CanonicalFieldKey;
  dimension: ContextDimension;
  label: string;
  description: string;
  valueType: 'text' | 'list' | 'number';
  /** @deprecated Use requiredFor instead */
  requiredForStrategyFrame: boolean;
  /** Which workflows require this field */
  requiredFor: WorkflowType[];
  /** Path in CompanyContextGraph (e.g., 'audience.primaryAudience') */
  contextGraphPath?: string;
  /** Which labs can populate this field */
  populatedByLabs?: string[];
  /** Can Full GAP populate this field? Only for MISSING required fields */
  populatedByGap?: boolean;
  /** Is this field immutable once confirmed? Default true for all */
  immutableWhenConfirmed?: boolean;
}

// ============================================================================
// Canonical Field Registry
// ============================================================================

export const CANONICAL_FIELD_DEFINITIONS: Record<CanonicalFieldKey, CanonicalFieldDefinition> = {
  // -------------------------------------------------------------------------
  // Strategic Frame Fields (REQUIRED for strategy)
  // -------------------------------------------------------------------------
  audience_icp_primary: {
    key: 'audience_icp_primary',
    dimension: 'AudienceICP',
    label: 'Primary Audience / ICP',
    description: 'The primary target audience or ideal customer profile',
    valueType: 'text',
    requiredForStrategyFrame: true,
    requiredFor: ['strategy', 'programs', 'briefs'],
    contextGraphPath: 'audience.primaryAudience',
    populatedByLabs: ['audience', 'brand'],
    populatedByGap: true,
  },
  audience_icp_secondary: {
    key: 'audience_icp_secondary',
    dimension: 'AudienceICP',
    label: 'Secondary Audience',
    description: 'Secondary target audiences or segments',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: [],
    contextGraphPath: 'audience.coreSegments',
    populatedByLabs: ['audience'],
    populatedByGap: false, // Optional field - GAP does NOT fill
  },
  value_prop: {
    key: 'value_prop',
    dimension: 'Offer',
    label: 'Value Proposition',
    description: 'The core value proposition offered to customers',
    valueType: 'text',
    requiredForStrategyFrame: true,
    requiredFor: ['strategy', 'programs', 'briefs'],
    contextGraphPath: 'productOffer.valueProposition',
    populatedByLabs: ['brand', 'audience'],
    populatedByGap: true,
  },
  positioning: {
    key: 'positioning',
    dimension: 'Brand',
    label: 'Positioning',
    description: 'How the brand is positioned in the market',
    valueType: 'text',
    requiredForStrategyFrame: true,
    requiredFor: ['strategy', 'programs', 'briefs'],
    contextGraphPath: 'brand.positioning',
    populatedByLabs: ['brand'],
    populatedByGap: true,
  },
  differentiators: {
    key: 'differentiators',
    dimension: 'Brand',
    label: 'Key Differentiators',
    description: 'Key differentiators from competitors',
    valueType: 'text',
    requiredForStrategyFrame: true,
    requiredFor: ['strategy', 'programs'],
    contextGraphPath: 'brand.differentiators',
    populatedByLabs: ['brand', 'competitor'],
    populatedByGap: true,
  },
  constraints_max_budget: {
    key: 'constraints_max_budget',
    dimension: 'Constraints',
    label: 'Max Budget',
    description: 'Maximum marketing budget constraint',
    valueType: 'text',
    requiredForStrategyFrame: true,
    requiredFor: ['strategy', 'programs'],
    contextGraphPath: 'budgetOps.maxBudget',
    populatedByLabs: [],
    populatedByGap: false, // User-only - AI cannot propose budget
  },
  constraints_min_budget: {
    key: 'constraints_min_budget',
    dimension: 'Constraints',
    label: 'Min Budget',
    description: 'Minimum marketing budget constraint',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: ['strategy'],
    contextGraphPath: 'budgetOps.minBudget',
    populatedByLabs: [],
    populatedByGap: false, // User-only - AI cannot propose budget
  },
  constraints_geo: {
    key: 'constraints_geo',
    dimension: 'Constraints',
    label: 'Geographic Constraints',
    description: 'Geographic restrictions or focus areas',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: [],
    contextGraphPath: 'identity.geographicFootprint',
    populatedByLabs: ['brand'],
    populatedByGap: false, // Optional field
  },
  competitors_primary: {
    key: 'competitors_primary',
    dimension: 'CompetitiveLandscape',
    label: 'Primary Competitors',
    description: 'Main competitors in the market',
    valueType: 'list',
    requiredForStrategyFrame: true,
    requiredFor: ['strategy', 'programs'],
    contextGraphPath: 'competitive.competitors',
    populatedByLabs: ['competitor'],
    populatedByGap: true,
  },
  competitors_notes: {
    key: 'competitors_notes',
    dimension: 'CompetitiveLandscape',
    label: 'Competitive Notes',
    description: 'Additional notes about the competitive landscape',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: [],
    contextGraphPath: 'competitive.competitiveNotes',
    populatedByLabs: ['competitor'],
    populatedByGap: false, // Optional field
  },

  // -------------------------------------------------------------------------
  // Supporting Fields (NOT required, but useful)
  // -------------------------------------------------------------------------
  offer_products_services: {
    key: 'offer_products_services',
    dimension: 'Offer',
    label: 'Products/Services',
    description: 'Primary products or services offered',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: ['programs'],
    contextGraphPath: 'productOffer.primaryProducts',
    populatedByLabs: ['brand'],
    populatedByGap: false, // Not required - don't auto-fill
  },
  gtm_primary_channels: {
    key: 'gtm_primary_channels',
    dimension: 'GoToMarket',
    label: 'Primary Channels',
    description: 'Primary marketing/sales channels',
    valueType: 'list',
    requiredForStrategyFrame: false,
    requiredFor: ['programs'],
    contextGraphPath: 'performanceMedia.activeChannels',
    populatedByLabs: ['media', 'demand'],
    populatedByGap: false, // Optional
  },
  gtm_sales_motion: {
    key: 'gtm_sales_motion',
    dimension: 'GoToMarket',
    label: 'Sales Motion',
    description: 'Primary sales motion (self-serve, sales-led, hybrid)',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: [],
    contextGraphPath: 'identity.businessModel',
    populatedByLabs: ['brand'],
    populatedByGap: false, // Optional
  },
  brand_tone: {
    key: 'brand_tone',
    dimension: 'Brand',
    label: 'Brand Tone',
    description: 'The tone of voice used in brand communications',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: ['briefs'],
    contextGraphPath: 'brand.toneOfVoice',
    populatedByLabs: ['brand', 'creative'],
    populatedByGap: false, // Optional - briefs only
  },
  execution_capabilities: {
    key: 'execution_capabilities',
    dimension: 'ExecutionCapabilities',
    label: 'Execution Capabilities',
    description: 'Available capabilities for execution',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: ['programs', 'work'],
    contextGraphPath: 'ops.teamSummary',
    populatedByLabs: ['ops'],
    populatedByGap: false, // Optional
  },
  business_stage: {
    key: 'business_stage',
    dimension: 'BusinessReality',
    label: 'Business Stage',
    description: 'Current stage of the business (early, growth, mature)',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: ['strategy'],
    contextGraphPath: 'identity.marketMaturity',
    populatedByLabs: ['brand'],
    populatedByGap: false, // Optional
  },
  business_model: {
    key: 'business_model',
    dimension: 'BusinessReality',
    label: 'Business Model',
    description: 'The business model (subscription, marketplace, etc.)',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: ['strategy'],
    contextGraphPath: 'identity.businessModel',
    populatedByLabs: ['brand'],
    populatedByGap: false, // Optional
  },
  business_archetype: {
    key: 'business_archetype',
    dimension: 'BusinessReality',
    label: 'Business Archetype',
    description: 'How the business competes (local, regional service, retail, ecommerce, marketplace, SaaS)',
    valueType: 'text',
    requiredForStrategyFrame: true,
    requiredFor: ['strategy'],
    contextGraphPath: 'identity.businessArchetype',
    populatedByLabs: [],
    populatedByGap: false, // Must be confirmed by operator
  },
  industry: {
    key: 'industry',
    dimension: 'BusinessReality',
    label: 'Industry',
    description: 'The industry or vertical',
    valueType: 'text',
    requiredForStrategyFrame: false,
    requiredFor: [],
    contextGraphPath: 'identity.industry',
    populatedByLabs: ['brand'],
    populatedByGap: false, // Optional
  },
};

// ============================================================================
// SCHEMA LOCK: Fields that GAP Full can populate
// ============================================================================

/**
 * LOCKED: Fields that GAP Full is allowed to propose values for.
 * GAP Full may ONLY fill these when they are MISSING.
 * GAP Full MUST NOT overwrite confirmed values.
 *
 * IMPORTANT: GAP V4 output structure ONLY contains:
 * - businessContext.businessType → business_model
 * - businessContext.maturityStage → business_stage
 *
 * GAP does NOT produce these fields (they MUST come from Labs):
 * - positioning, value_prop, differentiators → Brand Lab
 * - audience_icp_primary → Brand Lab or Audience Lab
 * - competitors_primary → Competitor Lab
 */
export const GAP_ALLOWED_FIELDS: CanonicalFieldKey[] = [
  'business_stage',   // From GAP maturityStage
  'business_model',   // From GAP businessType
];

/**
 * Check if GAP Full is allowed to propose a value for a field
 */
export function canGapProposeField(key: CanonicalFieldKey): boolean {
  return GAP_ALLOWED_FIELDS.includes(key);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all required fields for Strategy Frame
 */
export function getRequiredFieldsForStrategyFrame(): CanonicalFieldDefinition[] {
  return Object.values(CANONICAL_FIELD_DEFINITIONS).filter(
    (def) => def.requiredForStrategyFrame
  );
}

/**
 * Get field definition by key
 */
export function getFieldDefinition(key: CanonicalFieldKey): CanonicalFieldDefinition | undefined {
  return CANONICAL_FIELD_DEFINITIONS[key];
}

/**
 * Get fields by dimension
 */
export function getFieldsByDimension(dimension: ContextDimension): CanonicalFieldDefinition[] {
  return Object.values(CANONICAL_FIELD_DEFINITIONS).filter(
    (def) => def.dimension === dimension
  );
}

/**
 * Get fields that a lab can populate
 */
export function getFieldsPopulatedByLab(labId: string): CanonicalFieldDefinition[] {
  return Object.values(CANONICAL_FIELD_DEFINITIONS).filter(
    (def) => def.populatedByLabs?.includes(labId)
  );
}

/**
 * Get fields that GAP can populate
 */
export function getFieldsPopulatedByGap(): CanonicalFieldDefinition[] {
  return Object.values(CANONICAL_FIELD_DEFINITIONS).filter(
    (def) => def.populatedByGap
  );
}

/**
 * Map canonical field key to context graph path
 */
export function getContextGraphPath(key: CanonicalFieldKey): string | undefined {
  return CANONICAL_FIELD_DEFINITIONS[key]?.contextGraphPath;
}

/**
 * All canonical field keys
 */
export const ALL_CANONICAL_FIELD_KEYS = Object.keys(
  CANONICAL_FIELD_DEFINITIONS
) as CanonicalFieldKey[];

/**
 * Required field keys for Strategy Frame
 */
export const REQUIRED_STRATEGY_FRAME_KEYS = getRequiredFieldsForStrategyFrame().map(
  (def) => def.key
);

// ============================================================================
// Quality Validation Rules
// ============================================================================

/**
 * Quality validation rules for canonical fields.
 * Rejects low-quality, placeholder, or generic values.
 */
export interface FieldValidationRules {
  minLength: number;
  maxLength: number;
  /** Patterns that indicate placeholder/generic content */
  rejectPatterns?: RegExp[];
}

/** Default validation rules */
export const DEFAULT_VALIDATION_RULES: FieldValidationRules = {
  minLength: 20,
  maxLength: 500,
  rejectPatterns: [
    // Generic value prop patterns
    /^(strong|clear|effective|good|great|excellent)\s+(value\s+)?prop(osition)?/i,
    // Generic tone patterns
    /^professional\s+and\s+\w+$/i,
    /^(friendly|approachable|authoritative)\s+and\s+\w+$/i,
    // Vague product descriptions
    /^(various|multiple|several)\s+(products?|services?|solutions?)/i,
    /^(we|they|the company)\s+(offer|provide|deliver)/i,
    // AI placeholder patterns
    /^AI\s+(can|will|should)\s+propose/i,
    /context\s+(incomplete|missing|needed)/i,
    // Empty placeholders
    /^(N\/A|TBD|TODO|Unknown|Not specified|Missing|None)/i,
    // Generic positioning
    /^(clear|strong|solid)\s+(positioning|branding|identity)/i,
    /^(leading|top|best)\s+(provider|company|solution)/i,
  ],
};

/** Per-field validation overrides */
export const FIELD_VALIDATION_OVERRIDES: Partial<Record<CanonicalFieldKey, Partial<FieldValidationRules>>> = {
  // Shorter fields allowed
  industry: { minLength: 3, maxLength: 100 },
  business_model: { minLength: 5, maxLength: 100 },
  business_archetype: { minLength: 3, maxLength: 80 },
  business_stage: { minLength: 5, maxLength: 100 },
  gtm_sales_motion: { minLength: 5, maxLength: 100 },
  constraints_max_budget: { minLength: 3, maxLength: 50 },
  constraints_min_budget: { minLength: 3, maxLength: 50 },
  constraints_geo: { minLength: 3, maxLength: 200 },
  // Lists can be shorter per item
  competitors_primary: { minLength: 3, maxLength: 300 },
  gtm_primary_channels: { minLength: 3, maxLength: 200 },
  // Brand tone can be a bit shorter but not generic
  brand_tone: {
    minLength: 15,
    maxLength: 200,
    rejectPatterns: [
      /^professional\s+and\s+\w+$/i,
      /^(friendly|warm|approachable)$/i,
      /^(formal|informal|casual)$/i,
    ],
  },
};

/**
 * Validation result
 */
export interface FieldValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a field value against quality rules.
 * Returns invalid if value is too short, too long, or matches placeholder patterns.
 */
export function validateFieldValue(
  key: CanonicalFieldKey,
  value: string
): FieldValidationResult {
  const overrides = FIELD_VALIDATION_OVERRIDES[key] || {};
  const rules: FieldValidationRules = {
    ...DEFAULT_VALIDATION_RULES,
    ...overrides,
    rejectPatterns: [
      ...(DEFAULT_VALIDATION_RULES.rejectPatterns || []),
      ...(overrides.rejectPatterns || []),
    ],
  };

  const trimmed = value?.trim() || '';

  // Check empty
  if (!trimmed) {
    return { valid: false, reason: 'Value is empty' };
  }

  // Check minimum length
  if (trimmed.length < rules.minLength) {
    return {
      valid: false,
      reason: `Too short (${trimmed.length} chars, min ${rules.minLength})`,
    };
  }

  // Check maximum length
  if (trimmed.length > rules.maxLength) {
    return {
      valid: false,
      reason: `Too long (${trimmed.length} chars, max ${rules.maxLength})`,
    };
  }

  // Check placeholder patterns
  if (rules.rejectPatterns) {
    for (const pattern of rules.rejectPatterns) {
      if (pattern.test(trimmed)) {
        return {
          valid: false,
          reason: `Matches placeholder pattern`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Get missing required fields for strategy
 */
export function getMissingRequiredFields(
  populatedKeys: Set<CanonicalFieldKey>
): CanonicalFieldDefinition[] {
  return getRequiredFieldsForStrategyFrame().filter(
    (def) => !populatedKeys.has(def.key)
  );
}
