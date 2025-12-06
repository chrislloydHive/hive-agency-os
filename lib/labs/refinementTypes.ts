// lib/labs/refinementTypes.ts
// Shared refinement result types for Labs operating in Brain-first mode
//
// Labs in refinement mode:
// - Read from Context Graph/Brain first
// - Produce delta updates (refinedContext), not complete replacements
// - Respect human overrides and higher-priority sources
// - Use confidence + provenance for writes

import { z } from 'zod';
import type { LabId } from '@/lib/contextGraph/labContext';

// ============================================================================
// Core Types
// ============================================================================

/**
 * A single field refinement proposed by a Lab
 */
export interface RefinedField {
  /** Context Graph path, e.g. "audience.coreSegments" - must exist in CONTEXT_FIELDS */
  path: string;

  /** The new value to set */
  newValue: unknown;

  /** Confidence score 0-1 */
  confidence: number;

  /** Short explanation for why this refinement is proposed */
  reason?: string;

  /** The previous value (for display purposes) */
  previousValue?: unknown;
}

/**
 * Diagnostic message from Lab refinement
 */
export interface LabDiagnostic {
  /** Diagnostic code for categorization (e.g., "missing_icp", "weak_positioning") */
  code: string;

  /** Human-readable diagnostic message */
  message: string;

  /** Severity level */
  severity: 'info' | 'warning' | 'error';

  /** Related field path if applicable */
  fieldPath?: string;
}

/**
 * Result from a Lab running in refinement mode
 */
export interface LabRefinementResult {
  /** Fields proposed for refinement */
  refinedContext: RefinedField[];

  /** Diagnostics/warnings from the refinement process */
  diagnostics: LabDiagnostic[];

  /** Overall confidence in the refinement */
  overallConfidence?: number;

  /** Summary of what was refined */
  summary?: string;
}

/**
 * Result of applying refinements to Context Graph
 */
export interface RefinementApplyResult {
  /** Total fields attempted */
  attempted: number;

  /** Fields successfully updated */
  updated: number;

  /** Fields skipped due to human override */
  skippedHumanOverride: number;

  /** Fields skipped due to higher priority source */
  skippedHigherPriority: number;

  /** Fields skipped due to same/better value already present */
  skippedUnchanged: number;

  /** Detailed results per field */
  fieldResults: Array<{
    path: string;
    status: 'updated' | 'skipped_human_override' | 'skipped_higher_priority' | 'skipped_unchanged' | 'error';
    reason?: string;
    previousValue?: unknown;
    newValue?: unknown;
  }>;
}

// ============================================================================
// Lab-Specific Types
// ============================================================================

/**
 * Refinement Labs that support refinement mode
 */
export type RefinementLabId = 'audience' | 'brand' | 'creative' | 'competitor' | 'website';

/**
 * List of all available refinement labs for iteration
 */
export const AVAILABLE_REFINEMENT_LABS: RefinementLabId[] = [
  'audience',
  'brand',
  'creative',
  'competitor',
  'website',
];

/**
 * Input for a Lab running in refinement mode
 */
export interface LabRefinementInput {
  companyId: string;
  labId: RefinementLabId;

  /** Optional: Force run even if context is complete */
  forceRun?: boolean;

  /** Optional: Run in dry-run mode (don't write to Context Graph) */
  dryRun?: boolean;

  /** Optional: Maximum number of fields to refine */
  maxRefinements?: number;
}

/**
 * Extended result including apply summary
 */
export interface LabRefinementRunResult {
  /** The raw refinement result from the Lab */
  refinement: LabRefinementResult;

  /** Result of applying refinements (null if dryRun) */
  applyResult: RefinementApplyResult | null;

  /** Lab that produced this result */
  labId: RefinementLabId;

  /** Company ID */
  companyId: string;

  /** Run timestamp */
  runAt: string;

  /** Duration in milliseconds */
  durationMs: number;
}

// ============================================================================
// Zod Schemas for AI Response Validation
// ============================================================================

/**
 * Schema for RefinedField from AI response
 */
export const RefinedFieldSchema = z.object({
  path: z.string().min(1),
  newValue: z.unknown(),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
});

/**
 * Schema for LabDiagnostic from AI response
 */
export const LabDiagnosticSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['info', 'warning', 'error']),
  fieldPath: z.string().optional(),
});

/**
 * Schema for LabRefinementResult from AI response
 */
export const LabRefinementResultSchema = z.object({
  refinedContext: z.array(RefinedFieldSchema),
  diagnostics: z.array(LabDiagnosticSchema),
  overallConfidence: z.number().min(0).max(1).optional(),
  summary: z.string().optional(),
});

/**
 * Parse and validate AI response into LabRefinementResult
 */
export function parseLabRefinementResponse(response: unknown): LabRefinementResult {
  // Handle string responses (JSON)
  let data = response;
  if (typeof response === 'string') {
    try {
      data = JSON.parse(response);
    } catch {
      throw new Error('Invalid JSON response from Lab');
    }
  }

  // Validate with Zod
  const result = LabRefinementResultSchema.safeParse(data);
  if (!result.success) {
    console.error('[LabRefinement] Validation errors:', result.error.errors);
    throw new Error(`Invalid Lab refinement response: ${result.error.message}`);
  }

  // Map to ensure newValue is always present (Zod infers optional for unknown)
  return {
    refinedContext: result.data.refinedContext.map((field) => ({
      path: field.path,
      newValue: field.newValue,
      confidence: field.confidence,
      reason: field.reason,
    })),
    diagnostics: result.data.diagnostics,
    overallConfidence: result.data.overallConfidence,
    summary: result.data.summary,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty refinement result
 */
export function createEmptyRefinementResult(): LabRefinementResult {
  return {
    refinedContext: [],
    diagnostics: [],
  };
}

/**
 * Add a diagnostic to a refinement result
 */
export function addDiagnostic(
  result: LabRefinementResult,
  code: string,
  message: string,
  severity: LabDiagnostic['severity'],
  fieldPath?: string
): void {
  result.diagnostics.push({ code, message, severity, fieldPath });
}

/**
 * Add a refined field to a refinement result
 */
export function addRefinedField(
  result: LabRefinementResult,
  path: string,
  newValue: unknown,
  confidence: number,
  reason?: string,
  previousValue?: unknown
): void {
  result.refinedContext.push({
    path,
    newValue,
    confidence,
    reason,
    previousValue,
  });
}

/**
 * Get summary stats from a refinement result
 */
export function getRefinementStats(result: LabRefinementResult): {
  totalRefinements: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  infoCount: number;
  warningCount: number;
  errorCount: number;
} {
  const highConfidence = result.refinedContext.filter(r => r.confidence >= 0.8).length;
  const mediumConfidence = result.refinedContext.filter(r => r.confidence >= 0.5 && r.confidence < 0.8).length;
  const lowConfidence = result.refinedContext.filter(r => r.confidence < 0.5).length;

  return {
    totalRefinements: result.refinedContext.length,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    infoCount: result.diagnostics.filter(d => d.severity === 'info').length,
    warningCount: result.diagnostics.filter(d => d.severity === 'warning').length,
    errorCount: result.diagnostics.filter(d => d.severity === 'error').length,
  };
}
