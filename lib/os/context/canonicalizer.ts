// lib/os/context/canonicalizer.ts
// Context Canonicalizer Layer
//
// This is the ONLY approved path for writing context to the Context Graph.
// Labs and GAP output findings → canonicalizer → ContextField writes.
//
// Responsibilities:
// - Validate findings against schema
// - Reject generic/placeholder text
// - Normalize to concrete sentences
// - Write with proper status and provenance
// - Enforce immutability of confirmed fields

import type {
  ContextField,
  ContextFinding,
  ContextSource,
  ContextSourceType,
} from '@/lib/types/contextField';
import {
  createMissingField,
  createProposedField,
  isFieldMutableByAI,
} from '@/lib/types/contextField';
import {
  type CanonicalFieldKey,
  type ContextFieldStatus,
  CANONICAL_FIELD_DEFINITIONS,
  validateFieldValue,
  canGapProposeField,
  GAP_ALLOWED_FIELDS,
} from './schema';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { isCompetitionGapExclusiveField } from '@/lib/gap/orchestrator/competitionGap';

// ============================================================================
// Types
// ============================================================================

export interface CanonicalizationResult {
  success: boolean;
  /** Fields successfully written */
  written: CanonicalFieldKey[];
  /** Fields rejected with reasons */
  rejected: Array<{
    key: CanonicalFieldKey;
    reason: string;
  }>;
  /** Fields skipped (already confirmed, not allowed, etc.) */
  skipped: Array<{
    key: CanonicalFieldKey;
    reason: string;
  }>;
}

export interface CanonicalizerOptions {
  /** Source type for provenance */
  source: ContextSourceType;
  /** Run ID for traceability */
  sourceRunId: string;
  /** Force overwrite even if field is confirmed (DANGEROUS - use only for user input) */
  forceOverwrite?: boolean;
  /** Dry run - validate but don't write */
  dryRun?: boolean;
}

// ============================================================================
// Quality Validation (Beyond Schema Rules)
// ============================================================================

/**
 * Additional banned phrases that indicate generic/AI filler content
 */
const BANNED_PHRASES = [
  // Vague qualifiers
  'various',
  'multiple',
  'several',
  'many',
  'some',
  // Generic openers
  'the company',
  'this company',
  'they offer',
  'we offer',
  'provides',
  // AI telltale phrases
  'appears to',
  'seems to',
  'likely',
  'probably',
  'may include',
  'could include',
  // Placeholder indicators
  'to be determined',
  'not specified',
  'information not available',
  'context needed',
  'ai can propose',
  // Generic value props
  'high-quality',
  'best-in-class',
  'industry-leading',
  'cutting-edge',
  'innovative solutions',
  'comprehensive',
  'full range of',
  // CRITICAL: Evaluation-style content (meta-comments about quality)
  'is present but',
  'could be sharper',
  'could be clearer',
  'could be stronger',
  'could be better',
  'could be more',
  'is partially defined',
  'is somewhat defined',
  'is moderately defined',
  'is not immediately clear',
  'is not clearly defined',
  'has gaps in',
  'could better align',
  'needs more',
  'needs to be',
  'needs improvement',
  'differentiation is not',
  'serviceable but',
  // Generic differentiators
  'focus on innovation',
  'focus on quality',
  'focus on customer',
  'customer-centric approach',
  'customer centric approach',
  // Generic tone descriptors
  'professional yet approachable',
  'professional and approachable',
  'friendly yet professional',
];

/**
 * Check if text contains banned phrases indicating generic content
 */
function containsBannedPhrases(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      return phrase;
    }
  }
  return null;
}

// ============================================================================
// Empty Value Detection (Prevent Materializing Empty Fields)
// ============================================================================

/**
 * Check if a value should be materialized in the context graph.
 *
 * RULES:
 * - Strings: must be non-empty and have meaningful content (>= 10 chars after trim)
 * - Arrays: must have at least 1 non-empty item
 * - Objects: must have non-empty `value` property or other meaningful properties
 * - null/undefined: NEVER materialize
 *
 * This prevents "(empty)" proposed fields from flooding the Context Map.
 */
function shouldMaterializeValue(value: unknown): boolean {
  // null/undefined - never materialize
  if (value === null || value === undefined) {
    return false;
  }

  // Strings - must have meaningful content
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Reject very short strings or placeholder text
    if (trimmed.length < 10) return false;
    // Reject placeholder values
    const lowerTrimmed = trimmed.toLowerCase();
    if (
      lowerTrimmed === 'n/a' ||
      lowerTrimmed === 'na' ||
      lowerTrimmed === 'none' ||
      lowerTrimmed === 'unknown' ||
      lowerTrimmed === 'tbd' ||
      lowerTrimmed === 'to be determined' ||
      lowerTrimmed === '(empty)' ||
      lowerTrimmed === 'empty' ||
      lowerTrimmed === '-' ||
      lowerTrimmed === '...'
    ) {
      return false;
    }
    return true;
  }

  // Arrays - must have at least 1 meaningful item
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    // Check if at least one item is meaningful
    return value.some(item => {
      if (typeof item === 'string') {
        return item.trim().length > 0;
      }
      return item !== null && item !== undefined;
    });
  }

  // Objects - must have non-empty meaningful properties
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // If it has a 'value' property, check that
    if ('value' in obj) {
      return shouldMaterializeValue(obj.value);
    }
    // Otherwise check if it has any non-empty properties
    return Object.values(obj).some(v => shouldMaterializeValue(v));
  }

  // Numbers, booleans - always materialize
  return true;
}

/**
 * Check if text is specific enough (not generic)
 * Returns rejection reason or null if valid
 */
function validateSpecificity(key: CanonicalFieldKey, text: string): string | null {
  const trimmed = text.trim();

  // Check banned phrases
  const banned = containsBannedPhrases(trimmed);
  if (banned) {
    return `Contains generic phrase: "${banned}"`;
  }

  // Check for proper nouns / specificity indicators
  // Good: "B2B SaaS companies with 50-500 employees"
  // Bad: "Businesses looking for solutions"
  const hasNumbers = /\d/.test(trimmed);
  const hasProperNouns = /[A-Z][a-z]+/.test(trimmed);
  const wordCount = trimmed.split(/\s+/).length;

  // Very short text with no specifics
  if (wordCount < 5 && !hasNumbers && !hasProperNouns) {
    return 'Too generic - needs specific details';
  }

  return null;
}

/**
 * Normalize text to 1-3 concrete sentences
 */
function normalizeText(text: string, maxSentences: number = 3): string {
  const trimmed = text.trim();

  // Split into sentences
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Take up to maxSentences
  const normalized = sentences.slice(0, maxSentences).map(s => s.trim()).join('. ');

  // Add period if missing
  return normalized.endsWith('.') ? normalized : normalized + '.';
}

// ============================================================================
// Field Reading
// ============================================================================

/**
 * Get the current status of a field in the context graph
 */
function getFieldStatus(
  graph: CompanyContextGraph,
  key: CanonicalFieldKey
): { status: ContextFieldStatus; value: unknown } | null {
  const def = CANONICAL_FIELD_DEFINITIONS[key];
  if (!def?.contextGraphPath) return null;

  const [domain, ...fieldParts] = def.contextGraphPath.split('.');
  const fieldPath = fieldParts.join('.');

  const domainObj = (graph as Record<string, unknown>)[domain];
  if (!domainObj || typeof domainObj !== 'object') return null;

  // Navigate to field
  let target: unknown = domainObj;
  for (const part of fieldParts) {
    if (!target || typeof target !== 'object') return null;
    target = (target as Record<string, unknown>)[part];
  }

  if (!target || typeof target !== 'object') return null;

  const fieldObj = target as { value?: unknown; provenance?: Array<{ source?: string }> };

  // Determine status from value and provenance
  if (fieldObj.value === null || fieldObj.value === undefined) {
    return { status: 'missing', value: null };
  }

  // Check if user-confirmed
  const latestSource = fieldObj.provenance?.[0]?.source;
  if (latestSource === 'user') {
    return { status: 'confirmed', value: fieldObj.value };
  }

  return { status: 'proposed', value: fieldObj.value };
}

// ============================================================================
// Main Canonicalizer
// ============================================================================

/**
 * Canonicalize findings from Labs/GAP and write to Context Graph
 *
 * This is the ONLY approved path for writing context data.
 */
export async function canonicalizeFindings(
  companyId: string,
  findings: ContextFinding[],
  options: CanonicalizerOptions
): Promise<CanonicalizationResult> {
  const result: CanonicalizationResult = {
    success: false,
    written: [],
    rejected: [],
    skipped: [],
  };

  // Load context graph
  const graph = await loadContextGraph(companyId);
  if (!graph) {
    result.rejected.push({
      key: 'audience_icp_primary', // placeholder
      reason: 'Context graph not found',
    });
    return result;
  }

  const updatedGraph = structuredClone(graph);

  for (const finding of findings) {
    const key = finding.fieldKey as CanonicalFieldKey;

    // 0. CRITICAL: Never materialize empty values
    // This prevents "(empty)" proposed fields from flooding the Context Map
    if (!shouldMaterializeValue(finding.value)) {
      result.skipped.push({
        key,
        reason: 'Empty or meaningless value (not materializing)',
      });
      continue;
    }

    // 1. Check if field is in schema
    const def = CANONICAL_FIELD_DEFINITIONS[key];
    if (!def) {
      result.rejected.push({
        key,
        reason: `Field "${key}" not in canonical schema`,
      });
      continue;
    }

    // 2. Check if source is allowed to write this field
    if (finding.source === 'gap_full' && !canGapProposeField(key)) {
      result.skipped.push({
        key,
        reason: 'GAP Full not allowed to propose this field',
      });
      continue;
    }

    // 2.5 CRITICAL: Competitive fields can ONLY be written by competition_lab
    // competition_lab is the SINGLE source of truth for competitive context
    // NOTE: We standardized on "competition_lab" - deprecated: "competitor_lab", "competition_gap"
    const isCompetitiveField = isCompetitionGapExclusiveField(key) ||
      key.startsWith('competitive_') ||
      def.contextGraphPath?.startsWith('competitive.');

    const isCompetitionLabSource =
      finding.source === 'competition_lab' ||
      options.source === 'competition_lab';

    if (isCompetitiveField && !isCompetitionLabSource) {
      result.rejected.push({
        key,
        reason: 'Competitive fields can ONLY be written by competition_lab',
      });
      continue;
    }

    // 3. Check current field status
    const currentStatus = getFieldStatus(updatedGraph, key);
    if (currentStatus?.status === 'confirmed' && !options.forceOverwrite) {
      result.skipped.push({
        key,
        reason: 'Field is confirmed (immutable by AI)',
      });
      continue;
    }

    // 4. Validate value quality
    const schemaValidation = validateFieldValue(key, finding.value);
    if (!schemaValidation.valid) {
      result.rejected.push({
        key,
        reason: `Schema validation failed: ${schemaValidation.reason}`,
      });
      continue;
    }

    // 5. Check specificity
    const specificityError = validateSpecificity(key, finding.value);
    if (specificityError) {
      result.rejected.push({
        key,
        reason: specificityError,
      });
      continue;
    }

    // 6. Normalize text
    const normalizedValue = normalizeText(finding.value);

    // 7. Write to graph
    if (!options.dryRun) {
      writeFieldToGraph(updatedGraph, key, normalizedValue, {
        source: options.source,
        sourceRunId: options.sourceRunId,
        confidence: finding.confidence,
        notes: finding.evidence,
        timestamp: new Date().toISOString(),
      });
    }

    result.written.push(key);
  }

  // Save updated graph
  if (!options.dryRun && result.written.length > 0) {
    await saveContextGraph(updatedGraph, options.source);
  }

  result.success = true;

  console.log(`[Canonicalizer] ${options.source}: wrote ${result.written.length}, rejected ${result.rejected.length}, skipped ${result.skipped.length}`);

  return result;
}

/**
 * Write a single field to the context graph
 */
function writeFieldToGraph(
  graph: CompanyContextGraph,
  key: CanonicalFieldKey,
  value: string,
  source: ContextSource
): void {
  const def = CANONICAL_FIELD_DEFINITIONS[key];
  if (!def?.contextGraphPath) return;

  const [domain, ...fieldParts] = def.contextGraphPath.split('.');
  const finalField = fieldParts[fieldParts.length - 1];

  // Navigate to parent
  let target: Record<string, unknown> = graph as Record<string, unknown>;
  target = target[domain] as Record<string, unknown>;
  if (!target) return;

  for (let i = 0; i < fieldParts.length - 1; i++) {
    target = target[fieldParts[i]] as Record<string, unknown>;
    if (!target) return;
  }

  // Get existing provenance
  const existing = target[finalField] as { provenance?: unknown[] } | undefined;
  const existingProvenance = existing?.provenance || [];

  // Write field with provenance
  target[finalField] = {
    value,
    provenance: [
      {
        source: source.source,
        sourceRunId: source.sourceRunId,
        confidence: source.confidence,
        notes: source.notes,
        updatedAt: source.timestamp || new Date().toISOString(),
      },
      ...existingProvenance.slice(0, 4), // Keep last 4 entries
    ],
  };
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Initialize missing required fields for a company
 * Sets all required fields to { value: null, status: 'missing' }
 */
export async function initializeMissingFields(
  companyId: string
): Promise<CanonicalFieldKey[]> {
  const graph = await loadContextGraph(companyId);
  if (!graph) return [];

  const initialized: CanonicalFieldKey[] = [];

  for (const [key, def] of Object.entries(CANONICAL_FIELD_DEFINITIONS)) {
    if (!def.requiredFor.includes('strategy')) continue;

    const status = getFieldStatus(graph, key as CanonicalFieldKey);
    if (!status) {
      // Field path doesn't exist - initialize it
      // This will be handled by the migration script
      initialized.push(key as CanonicalFieldKey);
    }
  }

  return initialized;
}

/**
 * Get all missing required fields for a company
 */
export async function getMissingRequiredFieldsForCompany(
  companyId: string
): Promise<CanonicalFieldKey[]> {
  const graph = await loadContextGraph(companyId);
  if (!graph) return Object.keys(CANONICAL_FIELD_DEFINITIONS) as CanonicalFieldKey[];

  const missing: CanonicalFieldKey[] = [];

  for (const [key, def] of Object.entries(CANONICAL_FIELD_DEFINITIONS)) {
    if (!def.requiredFor.includes('strategy')) continue;

    const status = getFieldStatus(graph, key as CanonicalFieldKey);
    if (!status || status.status === 'missing') {
      missing.push(key as CanonicalFieldKey);
    }
  }

  return missing;
}

/**
 * Get fields that GAP Full should propose (missing + allowed)
 */
export async function getFieldsForGapToPropose(
  companyId: string
): Promise<CanonicalFieldKey[]> {
  const missing = await getMissingRequiredFieldsForCompany(companyId);

  // Filter to only fields GAP is allowed to propose
  return missing.filter(key => GAP_ALLOWED_FIELDS.includes(key));
}
