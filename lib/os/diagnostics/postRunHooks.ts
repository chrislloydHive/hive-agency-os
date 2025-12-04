// lib/os/diagnostics/postRunHooks.ts
// Post-run hooks for diagnostic tools
//
// Call these after a diagnostic run completes successfully to:
// 1. Generate Brain entries (diagnostic summaries)
// 2. Refresh the company's Strategic Snapshot
// 3. Update the Company Context Graph
// 4. Run domain-specific writers for full data extraction

import { summarizeDiagnosticRunForBrain } from './aiInsights';
import { refreshCompanyStrategicSnapshot } from '@/lib/os/companies/strategySnapshot';
import { runFusion } from '@/lib/contextGraph/fusion';
import { writeWebsiteLabAndSave } from '@/lib/contextGraph/websiteLabWriter';
import { writeBrandLabAndSave } from '@/lib/contextGraph/brandLabWriter';
import type { DiagnosticRun } from './runs';
import type { WebsiteUXLabResultV4 } from '@/lib/gap-heavy/modules/websiteLab';
import type { BrandLabSummary } from '@/lib/media/diagnosticsInputs';

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

  // 3. Update Company Context Graph via Fusion
  try {
    console.log('[postRunHooks] Updating Context Graph via Fusion...');
    const fusionResult = await runFusion(companyId, {
      snapshotReason: 'diagnostic_run',
      snapshotDescription: `Updated after ${run.toolId} diagnostic run`,
    });
    console.log('[postRunHooks] Context Graph updated via Fusion:', {
      fieldsUpdated: fusionResult.fieldsUpdated,
      sourcesUsed: fusionResult.sourcesUsed,
      versionId: fusionResult.versionId,
    });
  } catch (error) {
    console.error('[postRunHooks] Failed to update Context Graph via Fusion:', error);
    // Don't throw - context graph updates are supplementary
  }

  // 4. Run domain-specific writers for full data extraction
  // These writers extract more detailed data than the fusion pipeline
  await runDomainWriters(companyId, run);

  console.log('[postRunHooks] Completed processing for run:', run.id);
}

/**
 * Run domain-specific writers based on the tool type
 *
 * These writers extract detailed data from the full diagnostic result
 * that may not be captured by the general fusion pipeline.
 */
async function runDomainWriters(
  companyId: string,
  run: DiagnosticRun
): Promise<void> {
  // Only proceed if we have raw data
  if (!run.rawJson) {
    console.log('[postRunHooks] No rawJson in run, skipping domain writers');
    return;
  }

  try {
    switch (run.toolId) {
      case 'websiteLab': {
        console.log('[postRunHooks] Running WebsiteLab domain writer...');

        // Extract the WebsiteUXLabResultV4 from rawJson
        // The rawJson structure may have the result nested under a 'result' key
        const rawData = run.rawJson as Record<string, unknown>;
        const websiteResult = (rawData.result || rawData) as WebsiteUXLabResultV4;

        // Validate we have the expected structure
        if (!websiteResult.siteAssessment && !websiteResult.siteGraph) {
          console.warn('[postRunHooks] WebsiteLab rawJson missing expected structure, skipping writer');
          return;
        }

        const { summary } = await writeWebsiteLabAndSave(
          companyId,
          websiteResult,
          run.id
        );

        console.log('[postRunHooks] WebsiteLab domain writer complete:', {
          fieldsUpdated: summary.fieldsUpdated,
          updatedPaths: summary.updatedPaths.slice(0, 5),
          errors: summary.errors.length,
        });
        break;
      }

      case 'brandLab': {
        console.log('[postRunHooks] Running BrandLab domain writer...');

        // Extract the BrandLabSummary from rawJson
        const rawData = run.rawJson as Record<string, unknown>;
        const brandResult = (rawData.result || rawData) as BrandLabSummary;

        // Validate we have some meaningful data
        if (!brandResult.positioningSummary && !brandResult.valueProps && !brandResult.voiceTone) {
          console.warn('[postRunHooks] BrandLab rawJson missing expected structure, skipping writer');
          return;
        }

        const { summary } = await writeBrandLabAndSave(
          companyId,
          brandResult,
          run.id
        );

        console.log('[postRunHooks] BrandLab domain writer complete:', {
          fieldsUpdated: summary.fieldsUpdated,
          updatedPaths: summary.updatedPaths.slice(0, 5),
          errors: summary.errors.length,
        });
        break;
      }

      // Add other domain writers here as they're implemented
      // case 'contentLab': { ... }
      // case 'seoLab': { ... }

      default:
        // No domain writer for this tool type
        break;
    }
  } catch (error) {
    console.error(`[postRunHooks] Domain writer failed for ${run.toolId}:`, error);
    // Don't throw - domain writer failures are supplementary
  }
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
