// lib/labs/contextBoosters.ts
// Context Boosters - Lightweight Lab Runs Before Brief Generation
//
// Context boosters auto-run scoped labs before brief generation to ground
// briefs in fresh diagnostic data. They run without user interaction and
// respect all authority/humanConfirmed rules.
//
// Rules:
// - Only run when generating a brief
// - Never require user interaction
// - Never overwrite human-confirmed values
// - Only update lab-owned domains
// - No Strategy writes

import { runLabRefinement } from './refinementRunner';
import type { RefinementLabId } from './refinementTypes';

// ============================================================================
// Types
// ============================================================================

export interface BoosterRunOptions {
  /** Company ID to run boosters for */
  companyId: string;
  /** Lab IDs to run as boosters (must be valid refinement labs) */
  labs: RefinementLabId[];
  /** Optional: Run ID for tracing */
  runId?: string;
  /** Optional: Run in dry-run mode (no writes) */
  dryRun?: boolean;
  /** Optional: Force run even if context is complete */
  forceRun?: boolean;
}

export interface BoosterResult {
  labId: RefinementLabId;
  success: boolean;
  durationMs: number;
  fieldsUpdated: number;
  skippedHumanOverride: number;
  error?: string;
}

export interface BoosterRunResult {
  /** Overall success (all labs ran without errors) */
  success: boolean;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Results for each lab */
  results: BoosterResult[];
  /** Summary: total fields updated across all labs */
  totalFieldsUpdated: number;
  /** Summary: total fields skipped due to human override */
  totalSkippedHumanOverride: number;
}

// ============================================================================
// Booster Runner
// ============================================================================

/**
 * Run context boosters for brief generation
 *
 * This function runs a set of labs in "booster mode" - lightweight refinement
 * that updates the context graph with fresh diagnostic data before generating
 * a brief.
 *
 * Key behaviors:
 * - Runs labs in parallel for speed
 * - Respects humanConfirmed and source authority (no overwrites)
 * - Only updates lab-owned domains
 * - Returns quickly if context is already complete
 *
 * @param options - Booster run configuration
 * @returns Aggregated results from all booster runs
 */
export async function runContextBoosters(
  options: BoosterRunOptions
): Promise<BoosterRunResult> {
  const { companyId, labs, runId, dryRun = false, forceRun = false } = options;
  const startTime = Date.now();

  console.log('[ContextBoosters] Starting booster run:', {
    companyId,
    labs,
    runId,
    dryRun,
    forceRun,
  });

  if (labs.length === 0) {
    console.log('[ContextBoosters] No labs configured, skipping');
    return {
      success: true,
      totalDurationMs: 0,
      results: [],
      totalFieldsUpdated: 0,
      totalSkippedHumanOverride: 0,
    };
  }

  // Run all labs in parallel for speed
  const labPromises = labs.map(async (labId): Promise<BoosterResult> => {
    const labStartTime = Date.now();

    try {
      const result = await runLabRefinement({
        companyId,
        labId,
        forceRun,
        dryRun,
        // No maxRefinements limit for boosters - let them refine what they can
      });

      const fieldsUpdated = result.applyResult?.updated ?? 0;
      const skippedHumanOverride = result.applyResult?.skippedHumanOverride ?? 0;

      console.log(`[ContextBoosters] ${labId} completed:`, {
        durationMs: result.durationMs,
        fieldsUpdated,
        skippedHumanOverride,
      });

      return {
        labId,
        success: true,
        durationMs: Date.now() - labStartTime,
        fieldsUpdated,
        skippedHumanOverride,
      };
    } catch (error) {
      console.error(`[ContextBoosters] ${labId} failed:`, error);

      return {
        labId,
        success: false,
        durationMs: Date.now() - labStartTime,
        fieldsUpdated: 0,
        skippedHumanOverride: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Wait for all labs to complete
  const results = await Promise.all(labPromises);

  // Aggregate results
  const totalDurationMs = Date.now() - startTime;
  const totalFieldsUpdated = results.reduce((sum, r) => sum + r.fieldsUpdated, 0);
  const totalSkippedHumanOverride = results.reduce((sum, r) => sum + r.skippedHumanOverride, 0);
  const allSuccess = results.every((r) => r.success);

  console.log('[ContextBoosters] Booster run complete:', {
    companyId,
    totalDurationMs,
    totalFieldsUpdated,
    totalSkippedHumanOverride,
    labResults: results.map((r) => ({ lab: r.labId, success: r.success, fields: r.fieldsUpdated })),
  });

  return {
    success: allSuccess,
    totalDurationMs,
    results,
    totalFieldsUpdated,
    totalSkippedHumanOverride,
  };
}

/**
 * Get boosters for a project type (helper for callers)
 */
export function getBoostersForProjectType(projectTypeKey: string): RefinementLabId[] {
  // Import here to avoid circular deps
  const { getProjectTypeConfig } = require('@/lib/projects/projectTypeRegistry');
  const config = getProjectTypeConfig(projectTypeKey);
  return config?.contextBoosters ?? [];
}
