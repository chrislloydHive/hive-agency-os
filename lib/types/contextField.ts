// lib/types/contextField.ts
// Canonical Context Field Contract
//
// This defines the authoritative contract for all context fields in Hive OS.
// All context data MUST conform to this structure.
//
// RULES:
// - value MUST be null if missing (never `{}` or undefined)
// - status drives completeness, not key existence
// - confirmed fields are immutable by AI
// - sources array provides full provenance chain

// ============================================================================
// Field Status
// ============================================================================

/**
 * Context field status determines completeness and mutability
 *
 * - missing: Field has no value (value MUST be null)
 * - proposed: AI-generated value pending human review
 * - confirmed: Human-verified value, immutable by AI
 */
export type ContextFieldStatus = 'missing' | 'proposed' | 'confirmed';

// ============================================================================
// Source Types
// ============================================================================

/**
 * Source types for context data provenance
 *
 * IMPORTANT: For competitive.* fields:
 * - 'competition_lab' is the ONLY authorized source for competitive context
 * - 'competitor_lab' and 'competition_gap' are DEPRECATED (kept for backward compat)
 */
export type ContextSourceType =
  | 'user'
  | 'import'
  | 'lab'
  | 'gap_full'
  | 'brand_lab'           // Brand Lab (brand, audience, productOffer fields)
  | 'competition_lab'     // CANONICAL: Competition Lab (competitive.* fields)
  | 'competitor_lab'      // DEPRECATED: Use competition_lab
  | 'competition_gap';    // DEPRECATED: Use competition_lab

/**
 * Provenance record for a context field value
 */
export interface ContextSource {
  /** How this value was created/updated */
  source: ContextSourceType;
  /** Run ID if from a lab or GAP run */
  sourceRunId?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Optional notes about the source */
  notes?: string;
  /** When this source contributed */
  timestamp?: string;
}

// ============================================================================
// Context Field
// ============================================================================

/**
 * Canonical context field structure
 *
 * ALL context data in Hive OS must conform to this structure.
 * This is the single source of truth for context field representation.
 *
 * @template T - The value type (defaults to string)
 */
export interface ContextField<T = string> {
  /** Unique field key (e.g., 'audience.primaryAudience') */
  key: string;
  /** Field value - MUST be null if status is 'missing' */
  value: T | null;
  /** Field status determines completeness */
  status: ContextFieldStatus;
  /** Confidence score (0-1), derived from best source */
  confidence?: number;
  /** Provenance chain, newest first */
  sources: ContextSource[];
  /** Last update timestamp */
  updatedAt: string;
}

// ============================================================================
// Field Finding (Lab/GAP Output)
// ============================================================================

/**
 * Finding from a Lab or GAP run before canonicalization
 *
 * Labs and GAP output findings, NOT direct context writes.
 * The canonicalizer layer converts findings to ContextField writes.
 */
export interface ContextFinding {
  /** Target field key in canonical schema */
  fieldKey: string;
  /** Proposed value */
  value: string;
  /** Confidence in this value (0-1) */
  confidence: number;
  /** Source identifier (e.g., 'brand_lab', 'gap_full') */
  source: ContextSourceType;
  /** Run ID for traceability */
  sourceRunId: string;
  /** Evidence or reasoning for this value */
  evidence?: string;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a ContextField conforms to the contract
 */
export function validateContextField<T>(field: ContextField<T>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Rule: missing status requires null value
  if (field.status === 'missing' && field.value !== null) {
    errors.push('Field with status "missing" must have null value');
  }

  // Rule: non-missing status requires non-null value
  if (field.status !== 'missing' && field.value === null) {
    errors.push('Field with status "proposed" or "confirmed" must have non-null value');
  }

  // Rule: sources array must exist
  if (!Array.isArray(field.sources)) {
    errors.push('Field must have sources array');
  }

  // Rule: proposed/confirmed fields should have at least one source
  if (field.status !== 'missing' && field.sources.length === 0) {
    errors.push('Non-missing field should have at least one source');
  }

  // Rule: updatedAt must be valid ISO string
  if (!field.updatedAt || isNaN(Date.parse(field.updatedAt))) {
    errors.push('Field must have valid updatedAt timestamp');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a missing field placeholder
 */
export function createMissingField(key: string): ContextField<string> {
  return {
    key,
    value: null,
    status: 'missing',
    sources: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create a proposed field from a finding
 */
export function createProposedField<T>(
  key: string,
  value: T,
  source: ContextSource
): ContextField<T> {
  return {
    key,
    value,
    status: 'proposed',
    confidence: source.confidence,
    sources: [source],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Check if a field counts toward completeness
 * A field is complete if it has a non-null value AND status is not 'missing'
 */
export function isFieldComplete<T>(field: ContextField<T> | null | undefined): boolean {
  if (!field) return false;
  return field.value !== null && field.status !== 'missing';
}

/**
 * Check if a field can be modified by AI
 * Confirmed fields are immutable by AI
 */
export function isFieldMutableByAI<T>(field: ContextField<T>): boolean {
  return field.status !== 'confirmed';
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for ContextField
 */
export function isContextField(obj: unknown): obj is ContextField<unknown> {
  if (!obj || typeof obj !== 'object') return false;
  const field = obj as Record<string, unknown>;
  return (
    'key' in field &&
    'value' in field &&
    'status' in field &&
    'sources' in field &&
    'updatedAt' in field &&
    ['missing', 'proposed', 'confirmed'].includes(field.status as string)
  );
}
