// lib/contextGraph/governance/validateField.ts
// Field Value Validation
//
// Validates individual field values against contract rules.
// Used during proposal confirmation to ensure quality.

import { ContextContracts, type FieldValidationRule } from './contracts';
import type { DomainName } from '../companyContextGraph';

// ============================================================================
// Types
// ============================================================================

export interface FieldValidationWarning {
  path: string;
  message: string;
  severity: 'warning';
  ruleType: FieldValidationRule['type'];
}

export interface FieldValidationResult {
  isValid: boolean;
  warnings: FieldValidationWarning[];
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a field value against its contract rules
 *
 * @param path - Field path (e.g., 'brand.positioning')
 * @param value - The value to validate
 * @returns Validation result with warnings (non-blocking)
 */
export function validateFieldValue(
  path: string,
  value: unknown
): FieldValidationResult {
  const [domain] = path.split('.');
  const contract = ContextContracts[domain as DomainName];

  // No contract or no validation rules = valid
  if (!contract?.validationRules?.[path]) {
    return { isValid: true, warnings: [] };
  }

  const rules = contract.validationRules[path];
  const warnings: FieldValidationWarning[] = [];

  for (const rule of rules) {
    const valid = evaluateRule(value, rule);
    if (!valid) {
      warnings.push({
        path,
        message: rule.message,
        severity: 'warning',
        ruleType: rule.type,
      });
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * Validate multiple fields at once
 */
export function validateMultipleFields(
  fields: Array<{ path: string; value: unknown }>
): Map<string, FieldValidationResult> {
  const results = new Map<string, FieldValidationResult>();

  for (const { path, value } of fields) {
    results.set(path, validateFieldValue(path, value));
  }

  return results;
}

/**
 * Get all validation rules for a field path
 */
export function getValidationRulesForField(path: string): FieldValidationRule[] {
  const [domain] = path.split('.');
  const contract = ContextContracts[domain as DomainName];

  return contract?.validationRules?.[path] || [];
}

/**
 * Check if a field has validation rules defined
 */
export function hasValidationRules(path: string): boolean {
  return getValidationRulesForField(path).length > 0;
}

// ============================================================================
// Rule Evaluation
// ============================================================================

/**
 * Evaluate a single validation rule against a value
 */
function evaluateRule(value: unknown, rule: FieldValidationRule): boolean {
  // Custom validation takes precedence
  if (rule.type === 'custom' && rule.validate) {
    return rule.validate(value);
  }

  // Null/undefined values skip most rules (they're handled by required checks)
  if (value === null || value === undefined) {
    return true;
  }

  // String-based rules
  if (typeof value === 'string') {
    return evaluateStringRule(value, rule);
  }

  // Array-based rules
  if (Array.isArray(value)) {
    return evaluateArrayRule(value, rule);
  }

  return true;
}

/**
 * Evaluate rules against a string value
 */
function evaluateStringRule(value: string, rule: FieldValidationRule): boolean {
  switch (rule.type) {
    case 'minLength':
      return value.length >= (rule.value as number);

    case 'maxLength':
      return value.length <= (rule.value as number);

    case 'pattern':
      return new RegExp(rule.value as string).test(value);

    case 'mustInclude': {
      const keywords = Array.isArray(rule.value) ? rule.value : [rule.value as string];
      const lowerValue = value.toLowerCase();
      return keywords.some(keyword => lowerValue.includes(keyword.toLowerCase()));
    }

    case 'mustNotInclude': {
      const forbidden = Array.isArray(rule.value) ? rule.value : [rule.value as string];
      const lowerValue = value.toLowerCase();
      return !forbidden.some(keyword => lowerValue.includes(keyword.toLowerCase()));
    }

    default:
      return true;
  }
}

/**
 * Evaluate rules against an array value
 */
function evaluateArrayRule(value: unknown[], rule: FieldValidationRule): boolean {
  switch (rule.type) {
    case 'minLength':
      return value.length >= (rule.value as number);

    case 'maxLength':
      return value.length <= (rule.value as number);

    default:
      return true;
  }
}

// ============================================================================
// Contract Warning Formatting
// ============================================================================

/**
 * Format validation warnings for display in UI
 */
export function formatValidationWarnings(
  warnings: FieldValidationWarning[]
): string[] {
  return warnings.map(w => w.message);
}

/**
 * Aggregate all validation warnings from multiple results
 */
export function aggregateWarnings(
  results: Map<string, FieldValidationResult>
): FieldValidationWarning[] {
  const allWarnings: FieldValidationWarning[] = [];

  for (const result of results.values()) {
    allWarnings.push(...result.warnings);
  }

  return allWarnings;
}
