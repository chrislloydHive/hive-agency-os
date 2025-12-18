// lib/contextGraph/validation/schemaValidator.ts
// Schema V2 Validation for AI-proposed Context
//
// Validates that AI output:
// 1. Uses ONLY keys from CONTEXT_SCHEMA_V2_KEYS
// 2. Uses correct value types (select options, lists, etc.)
// 3. Does NOT contain recommendation language ("should", "recommend", etc.)
// 4. Only proposes to aiProposable fields

import {
  CONTEXT_SCHEMA_V2_KEYS,
  isSchemaV2Key,
  getSchemaV2Entry,
  type ContextSchemaV2Key,
  type UnifiedFieldEntry,
} from '../unifiedRegistry';

// ============================================================================
// Types
// ============================================================================

export type ValidationErrorCode =
  | 'UNKNOWN_KEY'
  | 'NOT_AI_PROPOSABLE'
  | 'INVALID_TYPE'
  | 'INVALID_SELECT_VALUE'
  | 'RECOMMENDATION_LANGUAGE';

export interface ValidationError {
  field: string;
  code: ValidationErrorCode;
  message: string;
  suggestedFix?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  filteredProposals: Record<string, unknown>;
}

// ============================================================================
// Recommendation Language Detection
// ============================================================================

/**
 * Patterns that indicate recommendation/advice language
 * Context should be FACTUAL only, no "should" statements
 */
const RECOMMENDATION_PATTERNS = [
  /\bshould\b/i,
  /\brecommend(?:s|ed|ing)?\b/i,
  /\bconsider\b/i,
  /\bopportunit(?:y|ies)\s+to\b/i,
  /\bcould\s+improve\b/i,
  /\bwould\s+benefit\s+from\b/i,
  /\bsuggested?\b/i,
  /\badvise[ds]?\b/i,
  /\bpropose[ds]?\b/i,
  /\bbetter\s+to\b/i,
  /\bideal(?:ly)?\b/i,
  /\boptimal(?:ly)?\b/i,
];

/**
 * Check if text contains recommendation language
 */
export function containsRecommendationLanguage(value: unknown): { found: boolean; matches: string[] } {
  const textToCheck = extractTextForValidation(value);
  if (!textToCheck) return { found: false, matches: [] };

  const matches: string[] = [];
  for (const pattern of RECOMMENDATION_PATTERNS) {
    const match = textToCheck.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  return { found: matches.length > 0, matches };
}

/**
 * Extract text content from various value types for validation
 */
function extractTextForValidation(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    return value.filter(v => typeof v === 'string').join(' ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

// ============================================================================
// Type Validation
// ============================================================================

/**
 * Validate that a value matches the expected field type
 */
function validateValueType(
  key: string,
  value: unknown,
  field: UnifiedFieldEntry
): ValidationError | null {
  // Null/undefined values are allowed (means "not provided")
  if (value === null || value === undefined) return null;

  switch (field.valueType) {
    case 'text':
    case 'string':
      if (typeof value !== 'string') {
        return {
          field: key,
          code: 'INVALID_TYPE',
          message: `Expected string for field "${key}", got ${typeof value}`,
        };
      }
      break;

    case 'select':
      if (typeof value !== 'string') {
        return {
          field: key,
          code: 'INVALID_TYPE',
          message: `Expected string for select field "${key}", got ${typeof value}`,
        };
      }
      // Validate against allowed options
      if (field.options) {
        const validValues = field.options.map(o => o.value);
        if (!validValues.includes(value)) {
          return {
            field: key,
            code: 'INVALID_SELECT_VALUE',
            message: `Invalid value "${value}" for field "${key}". Must be one of: ${validValues.join(', ')}`,
            suggestedFix: `Use one of: ${validValues.join(', ')}`,
          };
        }
      }
      break;

    case 'multi-select':
      if (!Array.isArray(value)) {
        return {
          field: key,
          code: 'INVALID_TYPE',
          message: `Expected array for multi-select field "${key}", got ${typeof value}`,
        };
      }
      // Validate each value against options (unless custom values allowed)
      if (field.options && !field.allowCustomOptions) {
        const validValues = field.options.map(o => o.value);
        const invalidValues = (value as string[]).filter(v => !validValues.includes(v));
        if (invalidValues.length > 0) {
          return {
            field: key,
            code: 'INVALID_SELECT_VALUE',
            message: `Invalid values [${invalidValues.join(', ')}] for field "${key}". Must be from: ${validValues.join(', ')}`,
            suggestedFix: `Use only: ${validValues.join(', ')}`,
          };
        }
      }
      break;

    case 'list':
    case 'string[]':
    case 'array':
      if (!Array.isArray(value)) {
        return {
          field: key,
          code: 'INVALID_TYPE',
          message: `Expected array for list field "${key}", got ${typeof value}`,
        };
      }
      break;

    case 'number':
      if (typeof value !== 'number' && typeof value !== 'string') {
        return {
          field: key,
          code: 'INVALID_TYPE',
          message: `Expected number for field "${key}", got ${typeof value}`,
        };
      }
      break;

    case 'url':
      if (typeof value !== 'string') {
        return {
          field: key,
          code: 'INVALID_TYPE',
          message: `Expected URL string for field "${key}", got ${typeof value}`,
        };
      }
      // Basic URL validation
      try {
        new URL(value);
      } catch {
        return {
          field: key,
          code: 'INVALID_TYPE',
          message: `Invalid URL format for field "${key}": ${value}`,
          suggestedFix: 'Provide a valid URL starting with http:// or https://',
        };
      }
      break;
  }

  return null;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate AI-proposed context against Schema V2
 *
 * @param proposals - Object with field keys and proposed values
 * @returns ValidationResult with errors, warnings, and filtered valid proposals
 */
export function validateAIContextProposal(
  proposals: Record<string, unknown>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const filteredProposals: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(proposals)) {
    // Skip null/undefined values (not proposing anything)
    if (value === null || value === undefined) continue;

    // 1. Check if key is in Schema V2
    if (!isSchemaV2Key(key)) {
      errors.push({
        field: key,
        code: 'UNKNOWN_KEY',
        message: `Field "${key}" is not in the canonical Schema V2. AI cannot propose arbitrary fields.`,
        suggestedFix: `Use only keys from CONTEXT_SCHEMA_V2_KEYS`,
      });
      continue;
    }

    // 2. Get field metadata
    const fieldEntry = getSchemaV2Entry(key);
    if (!fieldEntry) {
      errors.push({
        field: key,
        code: 'UNKNOWN_KEY',
        message: `Field "${key}" has no registry entry.`,
      });
      continue;
    }

    // 3. Check if AI can propose this field
    if (!fieldEntry.aiProposable) {
      errors.push({
        field: key,
        code: 'NOT_AI_PROPOSABLE',
        message: `Field "${key}" is user-only and cannot be AI-proposed.`,
        suggestedFix: 'This field must be filled by the user',
      });
      continue;
    }

    // 4. Validate value type
    const typeError = validateValueType(key, value, fieldEntry);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    // 5. Check for recommendation language
    const langCheck = containsRecommendationLanguage(value);
    if (langCheck.found) {
      errors.push({
        field: key,
        code: 'RECOMMENDATION_LANGUAGE',
        message: `Field "${key}" contains recommendation language: [${langCheck.matches.join(', ')}]. Context must be factual only.`,
        suggestedFix: 'Remove "should", "recommend", "consider", etc. State facts only.',
      });
      continue;
    }

    // All checks passed - include in filtered proposals
    filteredProposals[key] = value;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    filteredProposals,
  };
}

/**
 * Get validation summary for logging
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.valid) {
    return `Validation passed: ${Object.keys(result.filteredProposals).length} valid fields`;
  }

  const errorSummary = result.errors
    .map(e => `- ${e.field}: ${e.code}`)
    .join('\n');

  return `Validation failed with ${result.errors.length} errors:\n${errorSummary}`;
}

/**
 * Get list of all AI-proposable field keys for prompts
 */
export function getAIProposableFieldKeys(): ContextSchemaV2Key[] {
  return CONTEXT_SCHEMA_V2_KEYS.filter(key => {
    const entry = getSchemaV2Entry(key);
    return entry?.aiProposable === true;
  }) as ContextSchemaV2Key[];
}

/**
 * Get AI prompt hints for all proposable fields
 */
export function getAIPromptHints(): Record<string, string> {
  const hints: Record<string, string> = {};

  for (const key of CONTEXT_SCHEMA_V2_KEYS) {
    const entry = getSchemaV2Entry(key);
    if (entry?.aiProposable && entry.aiPromptHint) {
      hints[key] = entry.aiPromptHint;
    }
  }

  return hints;
}

/**
 * Generate schema description for AI system prompts
 */
export function generateSchemaPromptDescription(): string {
  const lines: string[] = [
    'CONTEXT SCHEMA V2 - Strict Field Definitions',
    '============================================',
    '',
    'You may ONLY output values for these exact fields:',
    '',
  ];

  // Group by zone
  const zones = new Map<string, UnifiedFieldEntry[]>();
  for (const key of CONTEXT_SCHEMA_V2_KEYS) {
    const entry = getSchemaV2Entry(key);
    if (!entry || !entry.aiProposable) continue;

    const zone = entry.zoneId || 'other';
    if (!zones.has(zone)) zones.set(zone, []);
    zones.get(zone)!.push(entry);
  }

  for (const [zone, fields] of zones) {
    lines.push(`## ${zone.toUpperCase()}`);
    for (const field of fields) {
      let typeDesc: string = field.valueType;
      if (field.options) {
        const values = field.options.map(o => o.value).join('|');
        typeDesc = `select(${values})`;
      }
      lines.push(`- ${field.key} (${typeDesc}): ${field.description || field.label}`);
      if (field.aiPromptHint) {
        lines.push(`  Hint: ${field.aiPromptHint}`);
      }
    }
    lines.push('');
  }

  lines.push('STRICT RULES:');
  lines.push('- For select fields, use ONLY the allowed values');
  lines.push('- NEVER output recommendations or "should" statements');
  lines.push('- Output null if you cannot determine a value with confidence');
  lines.push('- Facts only, no advice or strategy');

  return lines.join('\n');
}
