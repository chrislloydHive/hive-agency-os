// lib/types/contextV2.ts
// Context V2 - Structured, Provenance-Aware Company Context
//
// Evolution of Context into a durable, structured source of truth.
// - Clear section structure (Company Reality, Market Reality, Constraints, Strategic Intent)
// - Provenance tracking for each field (source, lastUpdated, confidence, needsReview)
// - Lifecycle status (Draft, Confirmed, Needs Review)
// - Full backward compatibility with V1

import type { CompanyContext, Competitor } from './context';

// ============================================================================
// Field Provenance & Metadata
// ============================================================================

/**
 * Source of a context field value
 */
export type ContextFieldSource = 'AI' | 'User' | 'Lab' | 'Imported';

/**
 * Confidence level for a field value
 */
export type ContextConfidence = 'High' | 'Medium' | 'Low';

/**
 * Metadata attached to each context field
 */
export interface ContextFieldMeta {
  /** The data source that set this value */
  source: ContextFieldSource;
  /** When this value was last updated */
  lastUpdated: string; // ISO date
  /** Confidence level in this value */
  confidence: ContextConfidence;
  /** Whether this field needs human review */
  needsReview: boolean;
  /** Optional notes about this field's confidence */
  confidenceNotes?: string;
}

/**
 * A context field with provenance metadata
 */
export interface ContextField<T> {
  /** The actual value */
  value: T;
  /** Field metadata */
  meta: ContextFieldMeta;
}

/**
 * Helper to create a field with default metadata
 */
export function createField<T>(
  value: T,
  source: ContextFieldSource = 'AI',
  confidence: ContextConfidence = 'Medium',
  needsReview: boolean = source === 'AI'
): ContextField<T> {
  return {
    value,
    meta: {
      source,
      lastUpdated: new Date().toISOString(),
      confidence,
      needsReview,
    },
  };
}

/**
 * Helper to check if a field is user-confirmed (protected from AI overwrite)
 */
export function isUserConfirmed<T>(field: ContextField<T> | undefined): boolean {
  return field?.meta.source === 'User' && !field.meta.needsReview;
}

// ============================================================================
// Context Lifecycle
// ============================================================================

/**
 * Top-level lifecycle status for Context
 */
export type ContextLifecycleStatus = 'Draft' | 'Confirmed' | 'Needs Review';

// ============================================================================
// Section 1: Company Reality
// ============================================================================

/**
 * Fundamental business facts
 */
export interface CompanyRealitySection {
  /** How the company makes money (e.g., "B2B SaaS", "marketplace", "service-based") */
  businessModel?: ContextField<string>;
  /** Industry/vertical category (e.g., "fitness marketplace", "local service") */
  category?: ContextField<string>;
  /** Geographic focus (e.g., "US National", "NYC Metro", "Global") */
  geography?: ContextField<string>;
  /** Company lifecycle stage (e.g., "Startup", "Growth", "Enterprise") */
  stage?: ContextField<string>;
  /** Core value proposition */
  valueProposition?: ContextField<string>;
}

// ============================================================================
// Section 2: Market Reality
// ============================================================================

/**
 * Market positioning and audience
 */
export interface MarketRealitySection {
  /** High-level audience description (not full Audience Lab detail) */
  audienceSummary?: ContextField<string>;
  /** Primary target audience segment */
  primaryAudience?: ContextField<string>;
  /** Secondary audience if applicable */
  secondaryAudience?: ContextField<string>;
  /** ICP description */
  icpDescription?: ContextField<string>;
  /** Competitive category/space */
  competitiveCategory?: ContextField<string>;
  /** Competitive posture (e.g., "challenger", "leader", "niche player") */
  competitivePosture?: ContextField<string>;
  /** Structured competitor list */
  competitors?: ContextField<Competitor[]>;
  /** Key differentiators */
  differentiators?: ContextField<string[]>;
  /** Market signals */
  marketSignals?: ContextField<string[]>;
}

// ============================================================================
// Section 3: Constraints & Assumptions
// ============================================================================

/**
 * Operational boundaries and assumptions
 */
export interface ConstraintsSection {
  /** Budget constraints/range */
  budget?: ContextField<string>;
  /** Regulatory considerations */
  regulatory?: ContextField<string>;
  /** Internal capabilities/limitations */
  internalCapabilities?: ContextField<string>;
  /** Known unknowns - things we need to figure out */
  knownUnknowns?: ContextField<string[]>;
  /** Timeline constraints */
  timeline?: ContextField<string>;
  /** General constraints notes */
  constraints?: ContextField<string>;
}

// ============================================================================
// Section 4: Strategic Intent
// ============================================================================

/**
 * Goals and success criteria
 */
export interface StrategicIntentSection {
  /** Primary business objectives */
  primaryObjectives?: ContextField<string[]>;
  /** Things explicitly NOT pursuing */
  nonGoals?: ContextField<string[]>;
  /** How success will be measured */
  successDefinition?: ContextField<string>;
  /** Key metrics to track */
  keyMetrics?: ContextField<string[]>;
}

// ============================================================================
// Context V2 - Full Structure
// ============================================================================

/**
 * Context V2 - Structured company context with provenance
 */
export interface CompanyContextV2 {
  /** Database record ID */
  id?: string;
  /** Company ID this context belongs to */
  companyId: string;

  // ========== Lifecycle ==========
  /** Current lifecycle status */
  status: ContextLifecycleStatus;

  // ========== Sections ==========
  /** Section 1: Company Reality - fundamental business facts */
  companyReality: CompanyRealitySection;
  /** Section 2: Market Reality - positioning and audience */
  marketReality: MarketRealitySection;
  /** Section 3: Constraints & Assumptions */
  constraints: ConstraintsSection;
  /** Section 4: Strategic Intent - goals and success criteria */
  strategicIntent: StrategicIntentSection;

  // ========== Metadata ==========
  /** When context was created */
  createdAt?: string;
  /** When context was last updated */
  updatedAt?: string;
  /** Who last updated (user ID or "system") */
  updatedBy?: string;
  /** Free-form notes */
  notes?: ContextField<string>;

  // ========== Legacy Fields (for gradual migration) ==========
  /** @deprecated Use companyReality.category */
  companyCategory?: string;
  /** @deprecated Use marketReality.competitors */
  competitorsNotes?: string;
}

// ============================================================================
// Conversion & Adapter Functions
// ============================================================================

/**
 * Convert V1 CompanyContext to V2 CompanyContextV2
 * Maps flat fields into sections with default provenance
 */
export function contextV1ToV2(v1: CompanyContext): CompanyContextV2 {
  const now = new Date().toISOString();

  // Determine source based on isAiGenerated flag
  const defaultSource: ContextFieldSource = v1.isAiGenerated ? 'AI' : 'User';
  const defaultConfidence: ContextConfidence = v1.isAiGenerated ? 'Medium' : 'High';

  // Helper to wrap a value with metadata
  const wrapField = <T>(value: T | undefined): ContextField<T> | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string' && !value.trim()) return undefined;
    if (Array.isArray(value) && value.length === 0) return undefined;

    return {
      value,
      meta: {
        source: defaultSource,
        lastUpdated: v1.updatedAt || now,
        confidence: defaultConfidence,
        needsReview: v1.isAiGenerated === true,
      },
    };
  };

  // Build confidence notes from V1
  const buildConfidenceNotes = (): string | undefined => {
    const notes: string[] = [];
    if (v1.confidenceNotes?.highConfidence?.length) {
      notes.push(`High confidence: ${v1.confidenceNotes.highConfidence.join(', ')}`);
    }
    if (v1.confidenceNotes?.needsReview?.length) {
      notes.push(`Needs review: ${v1.confidenceNotes.needsReview.join(', ')}`);
    }
    return notes.length > 0 ? notes.join('; ') : undefined;
  };

  return {
    id: v1.id,
    companyId: v1.companyId,

    // Lifecycle - default to Draft if AI-generated, Confirmed if user-edited
    status: v1.isAiGenerated ? 'Draft' : 'Confirmed',

    // Section 1: Company Reality
    companyReality: {
      businessModel: wrapField(v1.businessModel),
      category: wrapField(v1.companyCategory),
      valueProposition: wrapField(v1.valueProposition),
      // geography and stage not in V1, will be undefined
    },

    // Section 2: Market Reality
    marketReality: {
      primaryAudience: wrapField(v1.primaryAudience),
      secondaryAudience: wrapField(v1.secondaryAudience),
      icpDescription: wrapField(v1.icpDescription),
      competitors: wrapField(v1.competitors),
      differentiators: wrapField(v1.differentiators),
      marketSignals: wrapField(v1.marketSignals),
      // competitiveCategory and competitivePosture not in V1
    },

    // Section 3: Constraints
    constraints: {
      budget: wrapField(v1.budget),
      timeline: wrapField(v1.timeline),
      constraints: wrapField(v1.constraints),
      // regulatory, internalCapabilities, knownUnknowns not in V1
    },

    // Section 4: Strategic Intent
    strategicIntent: {
      primaryObjectives: wrapField(v1.objectives),
      keyMetrics: wrapField(v1.keyMetrics),
      // nonGoals, successDefinition not in V1
    },

    // Metadata
    createdAt: v1.createdAt,
    updatedAt: v1.updatedAt,
    updatedBy: v1.updatedBy,
    notes: v1.notes ? {
      value: v1.notes,
      meta: {
        source: defaultSource,
        lastUpdated: v1.updatedAt || now,
        confidence: defaultConfidence,
        needsReview: false,
        confidenceNotes: buildConfidenceNotes(),
      },
    } : undefined,

    // Legacy fields for compatibility
    companyCategory: v1.companyCategory,
    competitorsNotes: v1.competitorsNotes,
  };
}

/**
 * Convert V2 CompanyContextV2 back to V1 CompanyContext
 * Extracts values from provenance wrappers
 */
export function contextV2ToV1(v2: CompanyContextV2): CompanyContext {
  // Helper to extract value from field
  const extractValue = <T>(field: ContextField<T> | undefined): T | undefined => {
    return field?.value;
  };

  // Build confidence notes for V1
  const buildV1ConfidenceNotes = (): CompanyContext['confidenceNotes'] => {
    const highConfidence: string[] = [];
    const needsReview: string[] = [];

    const checkField = (name: string, field: ContextField<unknown> | undefined) => {
      if (!field) return;
      if (field.meta.confidence === 'High') {
        highConfidence.push(name);
      }
      if (field.meta.needsReview) {
        needsReview.push(`${name}: needs review`);
      }
    };

    // Check all sections
    checkField('businessModel', v2.companyReality.businessModel);
    checkField('category', v2.companyReality.category);
    checkField('valueProposition', v2.companyReality.valueProposition);
    checkField('primaryAudience', v2.marketReality.primaryAudience);
    checkField('competitors', v2.marketReality.competitors);
    checkField('objectives', v2.strategicIntent.primaryObjectives);

    if (highConfidence.length === 0 && needsReview.length === 0) {
      return undefined;
    }

    return { highConfidence, needsReview };
  };

  // Determine isAiGenerated based on status and field sources
  const isAiGenerated = v2.status === 'Draft' ||
    v2.companyReality.businessModel?.meta.source === 'AI';

  return {
    id: v2.id,
    companyId: v2.companyId,

    // Company Reality
    businessModel: extractValue(v2.companyReality.businessModel),
    valueProposition: extractValue(v2.companyReality.valueProposition),
    companyCategory: extractValue(v2.companyReality.category) || v2.companyCategory,

    // Market Reality
    primaryAudience: extractValue(v2.marketReality.primaryAudience),
    secondaryAudience: extractValue(v2.marketReality.secondaryAudience),
    icpDescription: extractValue(v2.marketReality.icpDescription),
    competitors: extractValue(v2.marketReality.competitors),
    differentiators: extractValue(v2.marketReality.differentiators),
    marketSignals: extractValue(v2.marketReality.marketSignals),
    competitorsNotes: v2.competitorsNotes,

    // Constraints
    budget: extractValue(v2.constraints.budget),
    timeline: extractValue(v2.constraints.timeline),
    constraints: extractValue(v2.constraints.constraints),

    // Strategic Intent
    objectives: extractValue(v2.strategicIntent.primaryObjectives),
    keyMetrics: extractValue(v2.strategicIntent.keyMetrics),

    // Metadata
    createdAt: v2.createdAt,
    updatedAt: v2.updatedAt,
    updatedBy: v2.updatedBy,
    notes: extractValue(v2.notes),
    isAiGenerated,
    confidenceNotes: buildV1ConfidenceNotes(),
  };
}

// ============================================================================
// Field Update Utilities
// ============================================================================

/**
 * Update a single field, respecting provenance rules
 * - User-confirmed fields are protected from AI/Lab overwrites
 * - Returns null if update should be blocked
 */
export function updateField<T>(
  existing: ContextField<T> | undefined,
  newValue: T,
  newSource: ContextFieldSource,
  confidence: ContextConfidence = 'Medium'
): ContextField<T> | null {
  // If field is user-confirmed and source is not User, block update
  if (existing && isUserConfirmed(existing) && newSource !== 'User') {
    console.log('[Context V2] Blocked update to user-confirmed field');
    return null;
  }

  return {
    value: newValue,
    meta: {
      source: newSource,
      lastUpdated: new Date().toISOString(),
      confidence,
      needsReview: newSource === 'AI', // AI suggestions need review
    },
  };
}

/**
 * Mark a field as needing review (non-blocking flag from Labs)
 */
export function flagForReview<T>(field: ContextField<T>, reason?: string): ContextField<T> {
  return {
    ...field,
    meta: {
      ...field.meta,
      needsReview: true,
      confidenceNotes: reason || field.meta.confidenceNotes,
    },
  };
}

/**
 * Confirm a field (mark as reviewed by user)
 */
export function confirmField<T>(field: ContextField<T>): ContextField<T> {
  return {
    ...field,
    meta: {
      ...field.meta,
      source: 'User',
      needsReview: false,
      confidence: 'High',
      lastUpdated: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Context Status Utilities
// ============================================================================

/**
 * Calculate overall context status based on field states
 */
export function calculateContextStatus(context: CompanyContextV2): ContextLifecycleStatus {
  // Collect all fields
  const allFields: (ContextField<unknown> | undefined)[] = [
    context.companyReality.businessModel,
    context.companyReality.category,
    context.companyReality.valueProposition,
    context.marketReality.primaryAudience,
    context.marketReality.competitors,
    context.strategicIntent.primaryObjectives,
  ];

  const definedFields = allFields.filter(f => f !== undefined) as ContextField<unknown>[];

  if (definedFields.length === 0) {
    return 'Draft';
  }

  // If any field needs review, overall status is Needs Review
  const anyNeedsReview = definedFields.some(f => f.meta.needsReview);
  if (anyNeedsReview) {
    return 'Needs Review';
  }

  // If all fields are user-sourced or high confidence, status is Confirmed
  const allConfirmed = definedFields.every(
    f => f.meta.source === 'User' || f.meta.confidence === 'High'
  );
  if (allConfirmed) {
    return 'Confirmed';
  }

  return 'Draft';
}

/**
 * Get fields that need attention (review or low confidence)
 */
export function getFieldsNeedingAttention(context: CompanyContextV2): string[] {
  const fields: string[] = [];

  const checkField = (name: string, field: ContextField<unknown> | undefined) => {
    if (field?.meta.needsReview || field?.meta.confidence === 'Low') {
      fields.push(name);
    }
  };

  // Check all sections
  checkField('businessModel', context.companyReality.businessModel);
  checkField('category', context.companyReality.category);
  checkField('geography', context.companyReality.geography);
  checkField('stage', context.companyReality.stage);
  checkField('valueProposition', context.companyReality.valueProposition);

  checkField('audienceSummary', context.marketReality.audienceSummary);
  checkField('primaryAudience', context.marketReality.primaryAudience);
  checkField('competitiveCategory', context.marketReality.competitiveCategory);
  checkField('competitors', context.marketReality.competitors);

  checkField('budget', context.constraints.budget);
  checkField('regulatory', context.constraints.regulatory);
  checkField('knownUnknowns', context.constraints.knownUnknowns);

  checkField('primaryObjectives', context.strategicIntent.primaryObjectives);
  checkField('successDefinition', context.strategicIntent.successDefinition);

  return fields;
}

// ============================================================================
// Section Completeness
// ============================================================================

/**
 * Calculate completeness for a section
 */
export function calculateSectionCompleteness(
  section: CompanyRealitySection | MarketRealitySection | ConstraintsSection | StrategicIntentSection,
  requiredFields: string[]
): number {
  let filled = 0;
  let total = requiredFields.length;

  for (const fieldName of requiredFields) {
    const field = (section as Record<string, ContextField<unknown> | undefined>)[fieldName];
    if (field?.value !== undefined && field.value !== null) {
      if (typeof field.value === 'string' && field.value.trim()) {
        filled++;
      } else if (Array.isArray(field.value) && field.value.length > 0) {
        filled++;
      } else if (typeof field.value !== 'string' && !Array.isArray(field.value)) {
        filled++;
      }
    }
  }

  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

/**
 * Get completeness for all sections
 */
export function getContextCompleteness(context: CompanyContextV2): {
  overall: number;
  companyReality: number;
  marketReality: number;
  constraints: number;
  strategicIntent: number;
} {
  const companyReality = calculateSectionCompleteness(
    context.companyReality,
    ['businessModel', 'category', 'valueProposition']
  );

  const marketReality = calculateSectionCompleteness(
    context.marketReality,
    ['primaryAudience', 'competitiveCategory']
  );

  const constraints = calculateSectionCompleteness(
    context.constraints,
    ['budget']
  );

  const strategicIntent = calculateSectionCompleteness(
    context.strategicIntent,
    ['primaryObjectives']
  );

  const overall = Math.round(
    (companyReality * 0.3) +
    (marketReality * 0.3) +
    (constraints * 0.2) +
    (strategicIntent * 0.2)
  );

  return {
    overall,
    companyReality,
    marketReality,
    constraints,
    strategicIntent,
  };
}

// ============================================================================
// Empty Context Factory
// ============================================================================

/**
 * Create an empty V2 context with all sections initialized
 */
export function createEmptyContextV2(companyId: string): CompanyContextV2 {
  return {
    companyId,
    status: 'Draft',
    companyReality: {},
    marketReality: {},
    constraints: {},
    strategicIntent: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
