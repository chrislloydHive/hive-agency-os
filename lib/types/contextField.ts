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
// Decision Impact (V4 Convergence)
// ============================================================================

/**
 * Decision impact level for context proposals
 *
 * - HIGH: Critical for strategy (positioning, value prop, audience, ICP)
 * - MEDIUM: Important for tactics (conversion actions, channels, budget)
 * - LOW: Narrative/summary content (executive summary, website summary)
 */
export type DecisionImpact = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Metadata for decision-grade context proposals
 *
 * Used by the V4 Convergence layer to filter and rank proposals.
 */
export interface DecisionGradeMetadata {
  /** How important this field is for decision-making */
  decisionImpact: DecisionImpact;
  /** How specific this value is to the company (0-100) */
  specificityScore: number;
  /** Reasons why this value might be generic */
  genericnessReasons: string[];
  /** Whether this is a summary-shaped field that should be hidden by default */
  hiddenByDefault?: boolean;
  /** Field category for grouping (derivedNarrative, corePositioning, etc.) */
  fieldCategory?: 'derivedNarrative' | 'corePositioning' | 'tactical' | 'evidence';
}

// ============================================================================
// Evidence Anchors (V4 Evidence Grounding)
// ============================================================================

/**
 * An evidence anchor is a concrete quote from the company's website
 * that grounds a proposal in actual content rather than AI-generated summaries.
 *
 * Proposals with empty evidenceAnchors are considered "ungrounded" and
 * receive a specificity penalty.
 */
export interface EvidenceAnchor {
  /** URL of the source page (optional if from stored snapshot) */
  url?: string;
  /** Title of the source page */
  pageTitle?: string;
  /** Short quote from the page content (max 200 chars) */
  quote: string;
}

/**
 * Check if an evidence anchor is valid
 * - quote must be non-empty and <= 200 chars
 */
export function isValidEvidenceAnchor(anchor: EvidenceAnchor): boolean {
  return (
    typeof anchor.quote === 'string' &&
    anchor.quote.trim().length > 0 &&
    anchor.quote.length <= 200
  );
}

/**
 * Truncate a quote to 200 chars with ellipsis
 */
export function truncateQuote(text: string, maxLength: number = 200): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
}

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

// ============================================================================
// V4 Types: Facts-First + Review Queue
// ============================================================================
// V4 introduces a review workflow where labs/GAP propose facts, users confirm,
// and confirmed facts materialize to the existing Context Graph for compat.

/**
 * V4 field status with explicit rejected state
 */
export type ContextFieldStatusV4 = 'confirmed' | 'proposed' | 'rejected';

/**
 * V4 source categories (simplified from granular source types)
 * Priority order: user > gap > lab > crm > ai > import
 */
export type ContextFieldSourceV4 =
  | 'user'    // Direct user edit (highest priority)
  | 'gap'     // GAP engine (gap_ia, gap_full, gap_heavy)
  | 'lab'     // Lab diagnostics (website_lab, brand_lab, etc.)
  | 'crm'     // CRM/Airtable sync
  | 'ai'      // AI-inferred values
  | 'import'; // Imported from external sources (lowest priority)

/**
 * Source priority ordering (highest to lowest)
 * Used for conflict resolution when multiple sources propose for same field.
 */
export const SOURCE_PRIORITY_V4: Record<ContextFieldSourceV4, number> = {
  user: 100,   // Highest - human truth
  gap: 80,     // GAP strategic analysis
  lab: 60,     // Lab diagnostics
  crm: 40,     // CRM data
  ai: 20,      // AI-inferred
  import: 10,  // Imported (lowest)
};

/**
 * Get priority score for a source
 */
export function getSourcePriority(source: ContextFieldSourceV4): number {
  return SOURCE_PRIORITY_V4[source] ?? 0;
}

/**
 * Check if source A has higher priority than source B
 */
export function isHigherPrioritySource(a: ContextFieldSourceV4, b: ContextFieldSourceV4): boolean {
  return getSourcePriority(a) > getSourcePriority(b);
}

/**
 * Evidence supporting a V4 field value
 */
export interface ContextFieldEvidenceV4 {
  /** Diagnostic run ID (from DIAGNOSTIC_RUNS table) */
  runId?: string;
  /** Source URL where data was extracted */
  url?: string;
  /** Text snippet supporting the value (max 500 chars) */
  snippet?: string;
  /** JSON path in source data */
  rawPath?: string;
  /** Which importer produced this field */
  importerId?: string;
  /** Original granular source type */
  originalSource?: string;
}

/**
 * V4 Context Field with explicit status and review workflow support
 */
export interface ContextFieldV4 {
  /** Canonical path: "domain.field" (e.g., "identity.industry") */
  key: string;

  /** Top-level domain (e.g., "identity", "brand") */
  domain: string;

  /** The field value */
  value: unknown;

  /** Field status */
  status: ContextFieldStatusV4;

  /** Source category */
  source: ContextFieldSourceV4;

  /** Specific source ID (run ID, user ID, etc.) */
  sourceId?: string;

  /** Confidence score 0-1 */
  confidence: number;

  /** ISO timestamp of last update */
  updatedAt: string;

  /** Evidence supporting this value */
  evidence?: ContextFieldEvidenceV4;

  /**
   * Stable dedupe key for idempotency: sha1(companyId + fieldKey + source + sourceId + valueHash)
   * If a proposal with this dedupeKey already exists, skip re-proposing.
   */
  dedupeKey?: string;

  // Confirmation/Lock
  /** ISO timestamp when user confirmed (locks from AI overwrite) */
  lockedAt?: string;
  /** User ID who confirmed */
  lockedBy?: string;
  /** True if user edited the proposed value before confirming (not just accepted as-is) */
  humanEdited?: boolean;

  // Rejection
  /** ISO timestamp when rejected */
  rejectedAt?: string;
  /** Rejection reason */
  rejectedReason?: string;
  /** Source ID that was rejected (blocks re-proposal from same source) */
  rejectedSourceId?: string;

  // History
  /** Previous value before this update */
  previousValue?: unknown;
  /** Previous source */
  previousSource?: ContextFieldSourceV4;

  // -------------------------------------------------------------------------
  // Alternative Proposals (for decision surface)
  // -------------------------------------------------------------------------

  /**
   * Alternative proposals for this field from different sources.
   * Only set when status is 'proposed' and multiple sources have proposed values.
   * Sorted by source priority (highest first).
   */
  alternatives?: ContextFieldAlternativeV4[];

  // -------------------------------------------------------------------------
  // Conflict Metadata (for precedence rules)
  // -------------------------------------------------------------------------

  /**
   * True if this proposal conflicts with an existing confirmed field.
   * Only higher-priority sources can propose when confirmed exists.
   */
  conflictsWithConfirmed?: boolean;

  /**
   * Preview of the existing confirmed value (truncated to 100 chars).
   * Set when conflictsWithConfirmed is true.
   */
  confirmedValuePreview?: string;

  /**
   * The confirmed value that this proposal would replace.
   * Set when conflictsWithConfirmed is true.
   */
  confirmedValue?: unknown;

  // -------------------------------------------------------------------------
  // Lineage Metadata
  // -------------------------------------------------------------------------

  /** ISO timestamp when the source run was created */
  runCreatedAt?: string;

  /** Schema variant used for extraction (e.g., "labResultV4", "vNextRoot") */
  schemaVariant?: string;

  /** Which importer produced this field (e.g., "websiteLab", "brandLab") */
  importerId?: string;
}

/**
 * Alternative proposal for a field (stored in alternatives array)
 */
export interface ContextFieldAlternativeV4 {
  /** The proposed value */
  value: unknown;

  /** Source category */
  source: ContextFieldSourceV4;

  /** Specific source ID (run ID) */
  sourceId?: string;

  /** Confidence score 0-1 */
  confidence: number;

  /** ISO timestamp when proposed */
  proposedAt: string;

  /** Evidence supporting this value */
  evidence?: ContextFieldEvidenceV4;

  /** Stable dedupe key */
  dedupeKey: string;

  /** ISO timestamp when the source run was created */
  runCreatedAt?: string;

  /** Which importer produced this field */
  importerId?: string;
}

/**
 * V4 Field Store - container for all fields for a company
 */
export interface ContextFieldStoreV4 {
  companyId: string;
  fields: Record<string, ContextFieldV4>;
  meta: {
    lastUpdated: string;
    version: number;
  };
}

// ============================================================================
// V4 API Types
// ============================================================================

export interface FactSheetDomainV4 {
  domain: string;
  label: string;
  confirmed: ContextFieldV4[];
  proposedCount: number;
  missingKeys: string[];
  missingFields?: MissingFieldInfoV4[];
  completeness: number;
}

export interface FactSheetResponseV4 {
  companyId: string;
  companyName: string;
  domains: FactSheetDomainV4[];
  totalConfirmed: number;
  totalProposed: number;
  totalMissing: number;
  lastUpdated: string;
}

export interface ReviewQueueResponseV4 {
  companyId: string;
  proposed: ContextFieldV4[];
  totalCount: number;
  byDomain: Record<string, number>;
  bySource: Record<string, number>;
}

export interface ConfirmFieldsRequestV4 {
  keys: string[];
}

export interface ConfirmFieldsResponseV4 {
  confirmed: string[];
  failed: string[];
}

export interface RejectFieldsRequestV4 {
  keys: string[];
  reason?: string;
}

export interface UpdateFieldRequestV4 {
  key: string;
  value: unknown;
}

export interface UpdateFieldResponseV4 {
  field: ContextFieldV4;
}

// ============================================================================
// V4 Missing Field Explainability
// ============================================================================

/**
 * Reason why a field is missing in V4
 */
export type MissingFieldReason =
  | 'NO_PROPOSAL_ATTEMPTED'     // No proposal has been generated yet
  | 'PROPOSAL_REJECTED'         // A proposal exists but was rejected
  | 'PROPOSAL_LOW_CONFIDENCE'   // A low-confidence proposal exists (requires review)
  | 'NO_LAB_SIGNAL_FOUND'       // Labs ran but no signal for this field
  | 'REQUIRES_USER_INPUT';      // Field requires manual user entry

/**
 * Available sources that could provide data for a missing field
 */
export interface MissingFieldAvailableSource {
  /** Source identifier (e.g., "websiteLab", "brandLab", "gapPlan") */
  sourceId: string;
  /** Human-readable label */
  label: string;
  /** Whether this source has signals for this field */
  hasSignal: boolean;
}

/**
 * Extended info about a missing field for explainability
 */
export interface MissingFieldInfoV4 {
  /** The field key (e.g., "brand.valueProposition") */
  key: string;
  /** Human-readable field name */
  label: string;
  /** Why this field is missing */
  reason: MissingFieldReason;
  /** Human-readable explanation */
  explanation: string;
  /** Available sources that could provide data */
  availableSources: MissingFieldAvailableSource[];
  /** Whether a targeted propose action is available */
  canPropose: boolean;
  /** Rejected field info (if reason is PROPOSAL_REJECTED) */
  rejection?: {
    rejectedAt: string;
    reason?: string;
  };
}

/**
 * Extended FactSheetDomainV4 with missing field details
 */
export interface FactSheetDomainV4Extended extends FactSheetDomainV4 {
  /** Detailed info about missing fields */
  missingFields: MissingFieldInfoV4[];
}

// ============================================================================
// V4 Context Readiness
// ============================================================================

/**
 * Required fields for strategy generation (minimum viable context).
 * Strategy will warn or block if these are missing.
 */
export const REQUIRED_STRATEGY_KEYS_V4: string[] = [
  'brand.positioning',
  'brand.valueProposition',
  'audience.primaryAudience',
  'identity.companyDescription',
  'productOffer.primaryOffer',
];

/**
 * Context readiness response from the readiness endpoint
 */
export interface ContextReadinessV4 {
  /** Overall readiness score 0-100 */
  readinessScore: number;

  /** True if readiness is sufficient for strategy (score >= threshold) */
  ready: boolean;

  /** Threshold used for readiness check (default 60) */
  threshold: number;

  /** Required keys that are missing (not confirmed) */
  requiredKeysMissing: string[];

  /** Required keys that are confirmed */
  requiredKeysConfirmed: string[];

  /** Required keys that have proposals pending review */
  requiredKeysProposed: string[];

  /** Count of confirmed fields */
  confirmedCount: number;

  /** Count of proposed fields */
  proposedCount: number;

  /** True if any recent lab run has error state (blocking proposals) */
  hasErrorState: boolean;

  /** Error state details if hasErrorState is true */
  errorStateDetails?: {
    source: string;
    errorType: string;
    errorMessage?: string;
  };
}

/**
 * Readiness gate check result
 */
export interface ReadinessGateResult {
  /** Whether to allow proceeding */
  allow: boolean;

  /** User-facing message explaining the decision */
  message: string;

  /** Readiness data */
  readiness: ContextReadinessV4;

  /** Suggested action */
  suggestedAction?: 'REVIEW_PROPOSALS' | 'RUN_LABS' | 'OVERRIDE';
}

// ============================================================================
// V4 Domain Labels
// ============================================================================

export const DOMAIN_LABELS_V4: Record<string, string> = {
  identity: 'Company Identity',
  brand: 'Brand & Messaging',
  audience: 'Target Audience',
  productOffer: 'Products & Services',
  competitive: 'Competitive Landscape',
  digitalInfra: 'Digital Infrastructure',
  website: 'Website',
  content: 'Content',
  seo: 'SEO',
  ops: 'Operations',
  performanceMedia: 'Performance Media',
  creative: 'Creative',
  budgetOps: 'Budget & Operations',
  operationalConstraints: 'Operational Constraints',
  objectives: 'Business Objectives',
  historical: 'Historical Data',
  storeRisk: 'Store Risk',
  historyRefs: 'History References',
  social: 'Social Media',
  capabilities: 'Capabilities',
};

// ============================================================================
// V4 Feature Flag
// ============================================================================

/**
 * Check if Context V4 is enabled
 */
export function isContextV4Enabled(): boolean {
  return process.env.CONTEXT_V4_ENABLED === 'true' || process.env.CONTEXT_V4_ENABLED === '1';
}

/**
 * Check if WebsiteLab ingestion should use V4 proposal flow
 * When enabled, WebsiteLab results are proposed to the V4 Review Queue
 * instead of being written directly to the Context Graph.
 */
export function isContextV4IngestWebsiteLabEnabled(): boolean {
  return (
    isContextV4Enabled() &&
    (process.env.CONTEXT_V4_INGEST_WEBSITELAB === 'true' ||
      process.env.CONTEXT_V4_INGEST_WEBSITELAB === '1')
  );
}

/**
 * Check if Brand Lab ingestion should use V4 proposal flow
 * When enabled, Brand Lab results are proposed to the V4 Review Queue
 * instead of being written directly to the Context Graph.
 */
export function isContextV4IngestBrandLabEnabled(): boolean {
  return (
    isContextV4Enabled() &&
    (process.env.CONTEXT_V4_INGEST_BRANDLAB === 'true' ||
      process.env.CONTEXT_V4_INGEST_BRANDLAB === '1')
  );
}

/**
 * Check if GAP Plan ingestion should use V4 proposal flow
 * When enabled, GAP Plan results are proposed to the V4 Review Queue
 * instead of being written directly to the Context Graph.
 */
export function isContextV4IngestGapPlanEnabled(): boolean {
  return (
    isContextV4Enabled() &&
    (process.env.CONTEXT_V4_INGEST_GAPPLAN === 'true' ||
      process.env.CONTEXT_V4_INGEST_GAPPLAN === '1')
  );
}

/**
 * Check if Competition Lab ingestion should use V4 proposal flow
 * When enabled, Competition Lab results are proposed to the V4 Review Queue
 * instead of being written directly to the Context Graph.
 */
export function isContextV4IngestCompetitionLabEnabled(): boolean {
  return (
    isContextV4Enabled() &&
    (process.env.CONTEXT_V4_INGEST_COMPETITIONLAB === 'true' ||
      process.env.CONTEXT_V4_INGEST_COMPETITIONLAB === '1')
  );
}

/**
 * Check if auto-propose baseline is enabled
 * When enabled, required strategy fields are automatically proposed
 * after Labs/GAPs complete (without auto-confirming).
 */
export function isContextV4AutoProposeBaselineEnabled(): boolean {
  return (
    isContextV4Enabled() &&
    (process.env.CONTEXT_V4_AUTO_PROPOSE_BASELINE === 'true' ||
      process.env.CONTEXT_V4_AUTO_PROPOSE_BASELINE === '1')
  );
}
