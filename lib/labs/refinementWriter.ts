// lib/labs/refinementWriter.ts
// Non-destructive writer for Lab refinements to Context Graph
//
// Rules:
// - Never set isHumanOverride from a Lab
// - Never overwrite human overrides or QBR/Setup authoritative values
// - Always record provenance with sourceType: "lab", sourceName: "<LabName>"

import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import {
  setFieldUntypedWithResult,
  createProvenance,
  type ProvenanceSource,
} from '@/lib/contextGraph/mutate';
import { isValidFieldPath } from '@/lib/contextGraph/schema';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { WithMetaType } from '@/lib/contextGraph/types';
import type {
  LabRefinementResult,
  RefinedField,
  RefinementApplyResult,
  RefinementLabId,
  LabDiagnostic,
} from './refinementTypes';

// ============================================================================
// Source Priority Helpers
// ============================================================================

/**
 * Map Lab ID to provenance source
 */
function labIdToSource(labId: RefinementLabId): ProvenanceSource {
  const mapping: Record<RefinementLabId, ProvenanceSource> = {
    audience: 'audience_lab',
    brand: 'brand_lab',
    creative: 'creative_lab',
    competitor: 'competitor_lab',
    website: 'website_lab',
  };
  return mapping[labId];
}

/**
 * Human override sources that Labs should never overwrite
 */
const HUMAN_OVERRIDE_SOURCES = ['user', 'manual', 'qbr', 'strategy', 'setup_wizard'];

/**
 * Check if a source is a human override
 */
function isHumanOverrideSource(source?: string): boolean {
  return source ? HUMAN_OVERRIDE_SOURCES.includes(source) : false;
}

/**
 * Sources with higher priority than Labs
 */
const HIGHER_PRIORITY_SOURCES = [...HUMAN_OVERRIDE_SOURCES, 'gap_heavy'];

/**
 * Check if existing source has higher priority than Lab
 */
function hasHigherPriorityThanLab(source?: string): boolean {
  return source ? HIGHER_PRIORITY_SOURCES.includes(source) : false;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Apply Lab refinements to the Context Graph
 *
 * This function:
 * - Validates each field path against CONTEXT_FIELDS
 * - Checks for human overrides and higher-priority sources
 * - Only writes if the new value is different or has higher confidence
 * - Records provenance with Lab source
 *
 * @param companyId - Company to update
 * @param labId - Lab producing the refinements
 * @param result - Refinement result from Lab
 * @param options - Optional configuration
 */
export async function applyLabRefinements(
  companyId: string,
  labId: RefinementLabId,
  result: LabRefinementResult,
  options?: {
    /** Run ID for provenance */
    runId?: string;
    /** If true, don't actually write to Context Graph */
    dryRun?: boolean;
    /** If true, log detailed information */
    debug?: boolean;
  }
): Promise<RefinementApplyResult> {
  const { runId, dryRun = false, debug = false } = options || {};

  if (debug) {
    console.log(`[RefinementWriter] Applying ${result.refinedContext.length} refinements from ${labId}`);
  }

  // Load current context graph
  let graph = await loadContextGraph(companyId);
  if (!graph) {
    console.warn(`[RefinementWriter] No context graph found for ${companyId}`);
    return {
      attempted: result.refinedContext.length,
      updated: 0,
      skippedHumanOverride: 0,
      skippedHigherPriority: 0,
      skippedUnchanged: 0,
      fieldResults: result.refinedContext.map((r) => ({
        path: r.path,
        status: 'error' as const,
        reason: 'No context graph found',
      })),
    };
  }

  const source = labIdToSource(labId);
  const fieldResults: RefinementApplyResult['fieldResults'] = [];
  let updated = 0;
  let skippedHumanOverride = 0;
  let skippedHigherPriority = 0;
  let skippedUnchanged = 0;

  for (const refinement of result.refinedContext) {
    const checkResult = checkRefinement(graph, refinement, source);

    if (debug) {
      console.log(`[RefinementWriter] ${refinement.path}: ${checkResult.status}`, checkResult.reason);
    }

    if (checkResult.status === 'skip_human_override') {
      skippedHumanOverride++;
      fieldResults.push({
        path: refinement.path,
        status: 'skipped_human_override',
        reason: checkResult.reason,
        previousValue: checkResult.previousValue,
        newValue: refinement.newValue,
      });
      continue;
    }

    if (checkResult.status === 'skip_higher_priority') {
      skippedHigherPriority++;
      fieldResults.push({
        path: refinement.path,
        status: 'skipped_higher_priority',
        reason: checkResult.reason,
        previousValue: checkResult.previousValue,
        newValue: refinement.newValue,
      });
      continue;
    }

    if (checkResult.status === 'skip_unchanged') {
      skippedUnchanged++;
      fieldResults.push({
        path: refinement.path,
        status: 'skipped_unchanged',
        reason: checkResult.reason,
        previousValue: checkResult.previousValue,
        newValue: refinement.newValue,
      });
      continue;
    }

    // Apply the refinement
    if (!dryRun) {
      const [domain, field] = refinement.path.split('.');
      const provenance = createProvenance(source, {
        confidence: refinement.confidence,
        runId,
        notes: refinement.reason,
      });

      const { graph: updatedGraph, result: setResult } = setFieldUntypedWithResult(
        graph,
        domain,
        field,
        refinement.newValue,
        provenance,
        { debug }
      );

      if (setResult.updated) {
        graph = updatedGraph;
        updated++;
        fieldResults.push({
          path: refinement.path,
          status: 'updated',
          previousValue: checkResult.previousValue,
          newValue: refinement.newValue,
        });
      } else {
        // Blocked by source priority (shouldn't happen given our pre-checks)
        fieldResults.push({
          path: refinement.path,
          status: 'skipped_higher_priority',
          reason: setResult.reason,
          previousValue: checkResult.previousValue,
          newValue: refinement.newValue,
        });
      }
    } else {
      // Dry run - count as would-be-updated
      updated++;
      fieldResults.push({
        path: refinement.path,
        status: 'updated',
        previousValue: checkResult.previousValue,
        newValue: refinement.newValue,
      });
    }
  }

  // Save updated graph (unless dry run)
  if (!dryRun && updated > 0) {
    await saveContextGraph(graph, `${labId}_lab`);
    console.log(`[RefinementWriter] Saved ${updated} refinements from ${labId} for ${companyId}`);
  }

  return {
    attempted: result.refinedContext.length,
    updated,
    skippedHumanOverride,
    skippedHigherPriority,
    skippedUnchanged,
    fieldResults,
  };
}

// ============================================================================
// Check Logic
// ============================================================================

interface CheckResult {
  status: 'apply' | 'skip_human_override' | 'skip_higher_priority' | 'skip_unchanged' | 'skip_invalid';
  reason?: string;
  previousValue?: unknown;
  existingConfidence?: number;
}

function checkRefinement(
  graph: CompanyContextGraph,
  refinement: RefinedField,
  source: ProvenanceSource
): CheckResult {
  const { path, newValue, confidence } = refinement;

  // Validate path
  if (!isValidFieldPath(path)) {
    return {
      status: 'skip_invalid',
      reason: `Invalid field path: ${path}`,
    };
  }

  // Get existing field
  const [domain, field] = path.split('.');
  const domainObj = graph[domain as keyof CompanyContextGraph] as Record<string, WithMetaType<unknown>> | undefined;

  if (!domainObj || typeof domainObj !== 'object') {
    return {
      status: 'skip_invalid',
      reason: `Domain not found: ${domain}`,
    };
  }

  const fieldData = domainObj[field];
  if (!fieldData || typeof fieldData !== 'object') {
    // Field doesn't exist - can apply
    return { status: 'apply' };
  }

  const existingProvenance = fieldData.provenance?.[0];
  const existingSource = existingProvenance?.source;
  const existingConfidence = existingProvenance?.confidence ?? 0.5;
  const previousValue = fieldData.value;

  // Check 1: Human override - never stomp
  if (isHumanOverrideSource(existingSource)) {
    return {
      status: 'skip_human_override',
      reason: `Field has human override from ${existingSource}`,
      previousValue,
      existingConfidence,
    };
  }

  // Check 2: Higher priority source
  if (hasHigherPriorityThanLab(existingSource)) {
    return {
      status: 'skip_higher_priority',
      reason: `Field has higher priority source: ${existingSource}`,
      previousValue,
      existingConfidence,
    };
  }

  // Check 3: Same value with equal or higher confidence - skip
  if (valuesEqual(previousValue, newValue) && confidence <= existingConfidence) {
    return {
      status: 'skip_unchanged',
      reason: `Value unchanged and confidence (${confidence}) <= existing (${existingConfidence})`,
      previousValue,
      existingConfidence,
    };
  }

  // Check 4: Lower confidence than existing (but different value) - still skip
  // Unless the existing value is clearly inferior (empty, etc.)
  if (confidence < existingConfidence && hasValue(previousValue)) {
    return {
      status: 'skip_unchanged',
      reason: `New confidence (${confidence}) < existing (${existingConfidence})`,
      previousValue,
      existingConfidence,
    };
  }

  return {
    status: 'apply',
    previousValue,
    existingConfidence,
  };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => valuesEqual(v, b[i]));
  }
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a summary of apply results for display
 */
export function formatApplyResultSummary(result: RefinementApplyResult): string {
  const parts: string[] = [];

  if (result.updated > 0) {
    parts.push(`${result.updated} field(s) refined`);
  }
  if (result.skippedHumanOverride > 0) {
    parts.push(`${result.skippedHumanOverride} skipped (human override)`);
  }
  if (result.skippedHigherPriority > 0) {
    parts.push(`${result.skippedHigherPriority} skipped (higher priority)`);
  }
  if (result.skippedUnchanged > 0) {
    parts.push(`${result.skippedUnchanged} unchanged`);
  }

  return parts.join(', ') || 'No changes';
}

/**
 * Create diagnostics for apply result
 */
export function createApplyDiagnostics(result: RefinementApplyResult): LabDiagnostic[] {
  const diagnostics: LabDiagnostic[] = [];

  if (result.skippedHumanOverride > 0) {
    diagnostics.push({
      code: 'human_override_preserved',
      message: `${result.skippedHumanOverride} field(s) preserved human overrides`,
      severity: 'info',
    });
  }

  if (result.skippedHigherPriority > 0) {
    diagnostics.push({
      code: 'higher_priority_preserved',
      message: `${result.skippedHigherPriority} field(s) had higher priority sources`,
      severity: 'info',
    });
  }

  const errors = result.fieldResults.filter((r) => r.status === 'error');
  if (errors.length > 0) {
    diagnostics.push({
      code: 'apply_errors',
      message: `${errors.length} field(s) failed to apply`,
      severity: 'warning',
    });
  }

  return diagnostics;
}
