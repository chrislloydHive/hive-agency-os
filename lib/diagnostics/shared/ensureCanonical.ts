// lib/diagnostics/shared/ensureCanonical.ts
// Canonical Contract Helper - ensures all Labs produce consistent canonical outputs
//
// This helper is called by each Lab builder right before returning/saving results.
// It guarantees:
// 1. All required canonical fields exist (value or null)
// 2. No empty {} objects are ever returned
// 3. No empty [] arrays for required fields
// 4. Missing fields are synthesized from v1Result or diagnosticInput when possible

import {
  type LabType,
  type LabCanonicalSpec,
  type CanonicalFieldSpec,
  getCanonicalSpec,
} from './canonicalRegistry';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for canonical enforcement
 */
export interface EnsureCanonicalInput {
  /** Lab type being processed */
  labType: LabType;
  /** Current canonical/findings object (may be partial) */
  canonical: Record<string, unknown>;
  /** V1 result for fallback synthesis (optional) */
  v1Result?: Record<string, unknown>;
  /** Diagnostic input for fallback synthesis (optional) */
  diagnosticInput?: Record<string, unknown>;
  /** Raw LLM output (optional) */
  llmResult?: Record<string, unknown>;
}

/**
 * Result of canonical enforcement
 */
export interface EnsureCanonicalResult {
  /** Ensured canonical object with all required fields */
  canonical: Record<string, unknown>;
  /** Fields that were synthesized (not from original) */
  synthesizedFields: string[];
  /** Fields that couldn't be synthesized and are null */
  nullFields: string[];
  /** Validation passed */
  valid: boolean;
  /** Validation errors (if any) */
  errors: string[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a nested value in an object using dot notation
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || current[part] === null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Check if a value is "empty" per canonical rules
 * Empty = null, undefined, '', [], {}
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return true;
  return false;
}

/**
 * Check if a value meets the field spec requirements
 */
function meetsFieldSpec(value: unknown, spec: CanonicalFieldSpec): boolean {
  if (value === null) return !spec.required;
  if (value === undefined) return false;

  switch (spec.type) {
    case 'string':
      if (typeof value !== 'string') return false;
      if (spec.minLength && value.length < spec.minLength) return false;
      return true;

    case 'array':
      if (!Array.isArray(value)) return false;
      if (spec.minItems !== undefined && value.length < spec.minItems) return false;
      return true;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
      if (Object.keys(value).length === 0) return false;
      return true;

    case 'number':
      return typeof value === 'number' && !isNaN(value);

    default:
      return true;
  }
}

/**
 * Strip empty objects and arrays recursively from a canonical object
 * Preserves null values for explicit "not available" signal
 */
function stripEmptyFromCanonical(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Keep explicit null
    if (value === null) {
      result[key] = null;
      continue;
    }

    // Skip undefined
    if (value === undefined) continue;

    // Skip empty strings
    if (value === '') continue;

    // Skip empty arrays
    if (Array.isArray(value) && value.length === 0) continue;

    // Recurse into objects
    if (typeof value === 'object' && !Array.isArray(value)) {
      const stripped = stripEmptyFromCanonical(value as Record<string, unknown>);
      // Only include if non-empty after stripping
      if (Object.keys(stripped).length > 0) {
        result[key] = stripped;
      }
      continue;
    }

    // Keep everything else
    result[key] = value;
  }

  return result;
}

// ============================================================================
// Synthesis Functions per Lab Type
// ============================================================================

/**
 * Synthesize Brand Lab canonical fields from v1 result
 */
function synthesizeBrandCanonical(
  v1Result: Record<string, unknown>,
  diagnosticInput?: Record<string, unknown>
): Record<string, unknown> {
  const synthesized: Record<string, unknown> = {};
  const diagnostic = (v1Result.diagnostic || v1Result) as Record<string, unknown>;

  // Positioning
  const positioningTheme = getNestedValue(diagnostic, 'positioning.positioningTheme') as string;
  const tagline = getNestedValue(diagnostic, 'identitySystem.tagline') as string;
  const corePromise = getNestedValue(diagnostic, 'identitySystem.corePromise') as string;

  if (positioningTheme && positioningTheme.length > 15) {
    synthesized.positioning = {
      statement: positioningTheme,
      summary: positioningTheme,
      confidence: 0.7,
    };
  } else if (tagline && tagline.length > 10) {
    synthesized.positioning = {
      statement: tagline,
      summary: corePromise || tagline,
      confidence: 0.6,
    };
  }

  // Value Prop
  const valueProps = getNestedValue(diagnostic, 'messagingSystem.valueProps') as unknown[];
  if (valueProps && valueProps.length > 0) {
    const best = valueProps[0] as Record<string, unknown>;
    if (best.statement && (best.statement as string).length >= 15) {
      const statement = best.statement as string;
      const parts = statement.split(/[.!?:—–-]\s+/);
      synthesized.valueProp = {
        headline: parts[0]?.trim() || statement.slice(0, 50),
        description: parts.length > 1 ? parts.slice(1).join(' ').trim() : '',
        confidence: 0.7,
      };
    }
  }

  // Differentiators
  const differentiators = getNestedValue(diagnostic, 'positioning.differentiators') as string[];
  const uniqueVPs = getNestedValue(diagnostic, 'messagingSystem.uniqueValueProps') as string[];
  const diffList = differentiators || uniqueVPs || [];
  if (diffList.length > 0) {
    synthesized.differentiators = {
      bullets: diffList.filter((d) => d && d.length > 5).slice(0, 7),
      confidence: 0.7,
    };
  }

  // ICP
  const primaryICP = getNestedValue(diagnostic, 'audienceFit.primaryICPDescription') as string;
  const targetAudience = getNestedValue(diagnostic, 'audienceFit.targetAudience') as string;
  const icpText = primaryICP || targetAudience;
  if (icpText && icpText.length > 10) {
    synthesized.icp = {
      primaryAudience: icpText,
      confidence: 0.7,
    };
  }

  return synthesized;
}

/**
 * Synthesize Website Lab canonical fields from v1 result
 */
function synthesizeWebsiteCanonical(
  v1Result: Record<string, unknown>,
  _diagnosticInput?: Record<string, unknown>
): Record<string, unknown> {
  const synthesized: Record<string, unknown> = {};
  const siteAssessment = (v1Result.siteAssessment || v1Result) as Record<string, unknown>;

  // UX Maturity from benchmark label
  const benchmarkLabel = siteAssessment.benchmarkLabel as string;
  if (benchmarkLabel) {
    synthesized.uxMaturity = benchmarkLabel;
  }

  // Primary CTA
  const conversionAnalysis = siteAssessment.conversionAnalysis as Record<string, unknown>;
  const primaryCta = conversionAnalysis?.primaryCta as string;
  if (primaryCta) {
    synthesized.primaryCta = primaryCta;
  }

  // Top Issues from issues array
  const issues = siteAssessment.issues as unknown[];
  if (issues && issues.length > 0) {
    synthesized.topIssues = issues.slice(0, 5).map((i: any) => ({
      title: i.title || i.description,
      severity: i.severity || 'medium',
    }));
  } else {
    synthesized.topIssues = [];
  }

  return synthesized;
}

/**
 * Synthesize SEO Lab canonical fields from result
 */
function synthesizeSeoCanonical(
  v1Result: Record<string, unknown>,
  _diagnosticInput?: Record<string, unknown>
): Record<string, unknown> {
  const synthesized: Record<string, unknown> = {};

  // Maturity stage
  const maturityStage = v1Result.maturityStage as string;
  if (maturityStage) {
    synthesized.maturityStage = maturityStage;
  }

  // Technical health from subscores
  const subscores = v1Result.subscores as unknown[];
  if (subscores && subscores.length > 0) {
    const technicalScore = subscores.find((s: any) => s.label?.toLowerCase().includes('technical'));
    if (technicalScore) {
      synthesized.technicalHealth = (technicalScore as any).status || 'unknown';
    }
  }

  // Top issues
  const issues = v1Result.issues as unknown[];
  if (issues && issues.length > 0) {
    synthesized.topIssues = issues.slice(0, 5).map((i: any) => ({
      title: i.title,
      severity: i.severity,
      category: i.category,
    }));
  } else {
    synthesized.topIssues = [];
  }

  // Top queries from analytics
  const analyticsSnapshot = v1Result.analyticsSnapshot as Record<string, unknown>;
  const topQueries = analyticsSnapshot?.topQueries as unknown[];
  if (topQueries && topQueries.length > 0) {
    synthesized.topQueries = topQueries.slice(0, 10);
  }

  return synthesized;
}

/**
 * Synthesize Content Lab canonical fields
 */
function synthesizeContentCanonical(
  v1Result: Record<string, unknown>,
  _diagnosticInput?: Record<string, unknown>
): Record<string, unknown> {
  const synthesized: Record<string, unknown> = {};

  // Maturity stage
  const maturityStage = v1Result.maturityStage as string;
  if (maturityStage) {
    synthesized.maturityStage = maturityStage;
  }

  // Content types from findings
  const findings = v1Result.findings as Record<string, unknown>;
  const contentTypes = findings?.contentTypes as unknown[];
  if (contentTypes) {
    synthesized.contentTypes = contentTypes
      .filter((ct: any) => ct.present)
      .map((ct: any) => ct.type);
  } else {
    synthesized.contentTypes = [];
  }

  // Top topics
  const topics = findings?.topics as string[];
  if (topics && topics.length > 0) {
    synthesized.topTopics = topics.slice(0, 10);
  }

  // Top issues
  const issues = v1Result.issues as unknown[];
  if (issues && issues.length > 0) {
    synthesized.topIssues = issues.slice(0, 5).map((i: any) => ({
      title: i.title,
      severity: i.severity,
    }));
  } else {
    synthesized.topIssues = [];
  }

  return synthesized;
}

/**
 * Synthesize Competition Lab canonical fields
 */
function synthesizeCompetitionCanonical(
  v1Result: Record<string, unknown>,
  _diagnosticInput?: Record<string, unknown>
): Record<string, unknown> {
  const synthesized: Record<string, unknown> = {};

  // Competitors
  const competitors = v1Result.competitors as unknown[];
  if (competitors && competitors.length > 0) {
    synthesized.competitors = competitors;

    // Generate position summary
    const coreCount = competitors.filter((c: any) => c.category === 'direct' || c.role === 'core').length;
    const indirectCount = competitors.filter((c: any) => c.category === 'indirect' || c.role === 'secondary').length;
    synthesized.positionSummary = `Competitive landscape includes ${coreCount} direct competitors and ${indirectCount} indirect competitors.`;
  } else {
    synthesized.competitors = [];
    synthesized.positionSummary = 'No competitors identified.';
  }

  // Threat level
  const overallThreatLevel = v1Result.overallThreatLevel as number;
  if (typeof overallThreatLevel === 'number') {
    synthesized.threatLevel = overallThreatLevel;
  }

  return synthesized;
}

/**
 * Synthesize Audience Lab canonical fields
 */
function synthesizeAudienceCanonical(
  v1Result: Record<string, unknown>,
  _diagnosticInput?: Record<string, unknown>
): Record<string, unknown> {
  const synthesized: Record<string, unknown> = {};

  // Primary audience
  const primaryAudience = v1Result.primaryAudience as string;
  const targetAudience = v1Result.targetAudience as string;
  if (primaryAudience || targetAudience) {
    synthesized.primaryAudience = primaryAudience || targetAudience;
  }

  // Segments
  const segments = v1Result.segments as unknown[];
  if (segments && segments.length > 0) {
    synthesized.segments = segments;
  }

  // Pain points
  const painPoints = v1Result.painPoints as string[];
  if (painPoints && painPoints.length > 0) {
    synthesized.painPoints = painPoints;
  }

  return synthesized;
}

/**
 * Synthesize Ops Lab canonical fields
 */
function synthesizeOpsCanonical(
  v1Result: Record<string, unknown>,
  _diagnosticInput?: Record<string, unknown>
): Record<string, unknown> {
  const synthesized: Record<string, unknown> = {};

  // Maturity stage
  const maturityStage = v1Result.maturityStage as string;
  if (maturityStage) {
    synthesized.maturityStage = maturityStage;
  }

  // Tracking stack from analytics snapshot
  const analyticsSnapshot = v1Result.analyticsSnapshot as Record<string, unknown>;
  const trackingStack = analyticsSnapshot?.trackingStack as string[];
  if (trackingStack && trackingStack.length > 0) {
    synthesized.trackingStack = trackingStack;
  } else {
    synthesized.trackingStack = [];
  }

  // Has analytics
  const hasGa4 = analyticsSnapshot?.hasGa4 as boolean;
  const hasGtm = analyticsSnapshot?.hasGtm as boolean;
  if (hasGa4 || hasGtm) {
    synthesized.hasAnalytics = 'yes';
  } else if (trackingStack && trackingStack.length > 0) {
    synthesized.hasAnalytics = 'partial';
  } else {
    synthesized.hasAnalytics = 'no';
  }

  // Top issues
  const issues = v1Result.issues as unknown[];
  if (issues && issues.length > 0) {
    synthesized.topIssues = issues.slice(0, 5).map((i: any) => ({
      title: i.title,
      severity: i.severity,
      category: i.category,
    }));
  } else {
    synthesized.topIssues = [];
  }

  // CRM status
  const hasCrm = analyticsSnapshot?.hasCrm as boolean;
  if (hasCrm !== undefined) {
    synthesized.crmStatus = hasCrm ? 'connected' : 'none';
  }

  return synthesized;
}

/**
 * Synthesize Demand Lab canonical fields
 */
function synthesizeDemandCanonical(
  v1Result: Record<string, unknown>,
  _diagnosticInput?: Record<string, unknown>
): Record<string, unknown> {
  const synthesized: Record<string, unknown> = {};

  // Maturity stage
  const maturityStage = v1Result.maturityStage as string;
  if (maturityStage) {
    synthesized.maturityStage = maturityStage;
  }

  // Primary channels from analytics snapshot
  const analyticsSnapshot = v1Result.analyticsSnapshot as Record<string, unknown>;
  const topChannels = analyticsSnapshot?.topChannels as string[];
  if (topChannels && topChannels.length > 0) {
    synthesized.primaryChannels = topChannels;
  } else {
    synthesized.primaryChannels = [];
  }

  // Has paid traffic
  const paidShare = analyticsSnapshot?.paidShare as number;
  if (paidShare !== undefined && paidShare !== null) {
    synthesized.hasPaidTraffic = paidShare > 0 ? 'yes' : 'no';
  } else {
    synthesized.hasPaidTraffic = 'unknown';
  }

  // Top issues
  const issues = v1Result.issues as unknown[];
  if (issues && issues.length > 0) {
    synthesized.topIssues = issues.slice(0, 5).map((i: any) => ({
      title: i.title,
      severity: i.severity,
      category: i.category,
    }));
  } else {
    synthesized.topIssues = [];
  }

  // Conversion rate
  const conversionRate = analyticsSnapshot?.conversionRate as number;
  if (typeof conversionRate === 'number') {
    synthesized.conversionRate = conversionRate;
  }

  return synthesized;
}

/**
 * Get synthesis function for a lab type
 */
function getSynthesizer(labType: LabType): (
  v1Result: Record<string, unknown>,
  diagnosticInput?: Record<string, unknown>
) => Record<string, unknown> {
  switch (labType) {
    case 'brand':
      return synthesizeBrandCanonical;
    case 'website':
      return synthesizeWebsiteCanonical;
    case 'seo':
      return synthesizeSeoCanonical;
    case 'content':
      return synthesizeContentCanonical;
    case 'competition':
      return synthesizeCompetitionCanonical;
    case 'audience':
      return synthesizeAudienceCanonical;
    case 'ops':
      return synthesizeOpsCanonical;
    case 'demand':
      return synthesizeDemandCanonical;
    default:
      return () => ({});
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Ensure canonical fields are present and valid
 *
 * This function:
 * 1. Validates all required fields exist
 * 2. Synthesizes missing fields from v1Result when possible
 * 3. Sets explicitly null for fields that can't be synthesized
 * 4. Strips empty {} and [] (except explicit null)
 * 5. Returns validation result with errors
 *
 * @example
 * const result = ensureCanonical({
 *   labType: 'brand',
 *   canonical: brandLabResult.findings,
 *   v1Result: brandLabResult.findings.diagnosticV1,
 * });
 *
 * if (!result.valid) {
 *   console.warn('Canonical validation failed:', result.errors);
 * }
 *
 * return { ...brandLabResult, findings: result.canonical };
 */
export function ensureCanonical(input: EnsureCanonicalInput): EnsureCanonicalResult {
  const { labType, canonical, v1Result, diagnosticInput, llmResult } = input;

  const spec = getCanonicalSpec(labType);
  if (!spec) {
    return {
      canonical,
      synthesizedFields: [],
      nullFields: [],
      valid: false,
      errors: [`Unknown lab type: ${labType}`],
    };
  }

  const synthesizedFields: string[] = [];
  const nullFields: string[] = [];
  const errors: string[] = [];

  // Start with a copy of canonical
  const result: Record<string, unknown> = JSON.parse(JSON.stringify(canonical || {}));

  // Get synthesizer for this lab type
  const synthesize = getSynthesizer(labType);
  const synthesized = v1Result ? synthesize(v1Result, diagnosticInput) : {};

  // Also try LLM result for missing fields
  const llmSynthesized = llmResult ? synthesize(llmResult, diagnosticInput) : {};

  // Process each required field
  for (const fieldSpec of spec.fields) {
    const currentValue = getNestedValue(result, fieldSpec.path);

    // Check if field already meets spec
    if (meetsFieldSpec(currentValue, fieldSpec)) {
      continue;
    }

    // Try to synthesize from v1Result
    const synthesizedValue = getNestedValue(synthesized, fieldSpec.path);
    if (meetsFieldSpec(synthesizedValue, fieldSpec)) {
      setNestedValue(result, fieldSpec.path, synthesizedValue);
      synthesizedFields.push(fieldSpec.path);
      continue;
    }

    // Try to synthesize from LLM result
    const llmValue = getNestedValue(llmSynthesized, fieldSpec.path);
    if (meetsFieldSpec(llmValue, fieldSpec)) {
      setNestedValue(result, fieldSpec.path, llmValue);
      synthesizedFields.push(fieldSpec.path);
      continue;
    }

    // Field is missing and couldn't be synthesized
    if (fieldSpec.required) {
      // For required fields, set to null (explicit "not available")
      setNestedValue(result, fieldSpec.path, null);
      nullFields.push(fieldSpec.path);
      // Only error if it's a critical field
      if (fieldSpec.type === 'string' && fieldSpec.minLength && fieldSpec.minLength > 0) {
        errors.push(`Required field ${fieldSpec.path} could not be synthesized`);
      }
    }
    // Non-required fields can remain undefined (will be stripped)
  }

  // Strip empty objects and arrays (but keep explicit nulls)
  const strippedResult = stripEmptyFromCanonical(result);

  return {
    canonical: strippedResult,
    synthesizedFields,
    nullFields,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a canonical object meets all requirements without modification
 */
export function validateCanonical(
  labType: LabType,
  canonical: Record<string, unknown>
): { valid: boolean; errors: string[]; missingFields: string[] } {
  const spec = getCanonicalSpec(labType);
  if (!spec) {
    return {
      valid: false,
      errors: [`Unknown lab type: ${labType}`],
      missingFields: [],
    };
  }

  const errors: string[] = [];
  const missingFields: string[] = [];

  for (const fieldSpec of spec.fields) {
    if (!fieldSpec.required) continue;

    const value = getNestedValue(canonical, fieldSpec.path);

    if (!meetsFieldSpec(value, fieldSpec)) {
      missingFields.push(fieldSpec.path);
      if (value === undefined) {
        errors.push(`Missing required field: ${fieldSpec.path}`);
      } else if (isEmptyValue(value)) {
        errors.push(`Empty value for required field: ${fieldSpec.path}`);
      } else {
        errors.push(`Invalid value for ${fieldSpec.path}: does not meet spec`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    missingFields,
  };
}

/**
 * Check if a value would be stripped by canonical cleanup
 */
export function wouldBeStripped(value: unknown): boolean {
  return isEmptyValue(value) && value !== null;
}
