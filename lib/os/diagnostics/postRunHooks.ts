// lib/os/diagnostics/postRunHooks.ts
// Post-run hooks for diagnostic tools
//
// Call these after a diagnostic run completes successfully to:
// 1. Generate Brain entries (diagnostic summaries)
// 2. Refresh the company's Strategic Snapshot
// 3. Update the Company Context Graph

import { summarizeDiagnosticRunForBrain } from './aiInsights';
import { refreshCompanyStrategicSnapshot } from '@/lib/os/companies/strategySnapshot';
import { runFusion } from '@/lib/contextGraph/fusion';
import type { DiagnosticRun } from './runs';

/**
 * Process a completed diagnostic run
 *
 * This should be called after any diagnostic run completes successfully.
 * It handles:
 * 1. Creating a Brain entry with AI-generated insights
 * 2. Refreshing the company's Strategic Snapshot
 *
 * Failures are logged but don't throw - we don't want to break the main flow.
 */
export async function processDiagnosticRunCompletion(
  companyId: string,
  run: DiagnosticRun
): Promise<void> {
  console.log('[postRunHooks] Processing completed run:', {
    companyId,
    runId: run.id,
    toolId: run.toolId,
    score: run.score,
  });

  // Skip if run failed
  if (run.status !== 'complete') {
    console.log('[postRunHooks] Skipping - run not complete');
    return;
  }

  // 1. Generate Brain entry
  try {
    console.log('[postRunHooks] Generating Brain entry...');
    await summarizeDiagnosticRunForBrain(companyId, run);
    console.log('[postRunHooks] Brain entry created');
  } catch (error) {
    console.error('[postRunHooks] Failed to create Brain entry:', error);
    // Don't throw - continue to snapshot
  }

  // 2. Refresh Strategic Snapshot
  try {
    console.log('[postRunHooks] Refreshing Strategic Snapshot...');
    await refreshCompanyStrategicSnapshot(companyId);
    console.log('[postRunHooks] Strategic Snapshot refreshed');
  } catch (error) {
    console.error('[postRunHooks] Failed to refresh Strategic Snapshot:', error);
    // Don't throw
  }

  // 3. Update Company Context Graph
  try {
    console.log('[postRunHooks] Updating Context Graph...');
    const fusionResult = await runFusion(companyId, {
      snapshotReason: 'diagnostic_run',
      snapshotDescription: `Updated after ${run.toolId} diagnostic run`,
    });
    console.log('[postRunHooks] Context Graph updated:', {
      fieldsUpdated: fusionResult.fieldsUpdated,
      sourcesUsed: fusionResult.sourcesUsed,
      versionId: fusionResult.versionId,
    });
  } catch (error) {
    console.error('[postRunHooks] Failed to update Context Graph:', error);
    // Don't throw - context graph updates are supplementary
  }

  console.log('[postRunHooks] Completed processing for run:', run.id);
}

/**
 * Process diagnostic run completion in the background
 *
 * Same as processDiagnosticRunCompletion but doesn't wait for completion.
 * Use this when you want to return a response immediately.
 */
export function processDiagnosticRunCompletionAsync(
  companyId: string,
  run: DiagnosticRun
): void {
  // Fire and forget
  processDiagnosticRunCompletion(companyId, run).catch((error) => {
    console.error('[postRunHooks] Async processing failed:', error);
  });
}
