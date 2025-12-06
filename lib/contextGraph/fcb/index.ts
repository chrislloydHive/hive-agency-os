// lib/contextGraph/fcb/index.ts
// Foundational Context Builder (FCB) - Main Entry Point
//
// FCB auto-populates 40-60% of the Context Graph from public signals
// like the company website, metadata, and social profiles.
//
// Usage:
//   import { runFoundationalContextBuilder } from '@/lib/contextGraph/fcb';
//   const result = await runFoundationalContextBuilder(companyId, domain, companyName);

import { randomUUID } from 'crypto';
import { loadContextGraph, saveContextGraph } from '../storage';
import { createEmptyContextGraph } from '../companyContextGraph';
import { captureVersion } from '../history';
import { collectSignals } from './signalCollector';
import { runAllExtractors } from './extractors';
import { writeExtractedFields, buildExtractorSummary } from './writer';
import type {
  SignalBundle,
  FCBRunResult,
  ExtractorResult,
  ExtractorSummary,
  CollectionDiagnostic,
  ExtractorDiagnostic,
} from './types';

// ============================================================================
// Main Entry Point
// ============================================================================

export interface FCBOptions {
  /** Skip signal collection and use provided signals */
  signals?: SignalBundle;
  /** Save a history snapshot after writing */
  saveSnapshot?: boolean;
  /** Reason for the FCB run (for snapshot) */
  reason?: string;
}

/**
 * Run the Foundational Context Builder
 *
 * This will:
 * 1. Collect signals from the company website
 * 2. Run LLM extractors on each domain
 * 3. Write extracted fields to the Context Graph (respecting priority)
 * 4. Optionally save a history snapshot
 */
export async function runFoundationalContextBuilder(
  companyId: string,
  domain: string,
  companyName: string,
  options?: FCBOptions
): Promise<FCBRunResult> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const allDiagnostics: (CollectionDiagnostic | ExtractorDiagnostic)[] = [];

  console.log(`[FCB] Starting run ${runId} for ${companyName} (${domain})`);

  try {
    // =========================================================================
    // Step 1: Collect signals
    // =========================================================================

    let signals: SignalBundle;
    if (options?.signals) {
      signals = options.signals;
      console.log('[FCB] Using provided signals');
    } else {
      console.log('[FCB] Collecting signals from website...');
      signals = await collectSignals(companyId, domain, companyName);
      allDiagnostics.push(...signals.collectionDiagnostics);
    }

    // =========================================================================
    // Step 2: Run extractors
    // =========================================================================

    console.log('[FCB] Running extractors...');
    const extractorResults = await runAllExtractors(signals);

    // Collect all extracted fields and diagnostics
    const allFields = [
      ...extractorResults.identity.fields,
      ...extractorResults.audience.fields,
      ...extractorResults.productOffer.fields,
      ...extractorResults.brand.fields,
      ...extractorResults.website.fields,
    ];

    allDiagnostics.push(
      ...extractorResults.identity.diagnostics,
      ...extractorResults.audience.diagnostics,
      ...extractorResults.productOffer.diagnostics,
      ...extractorResults.brand.diagnostics,
      ...extractorResults.website.diagnostics
    );

    console.log(`[FCB] Extracted ${allFields.length} fields total`);

    // =========================================================================
    // Step 3: Load/create context graph and write fields
    // =========================================================================

    console.log('[FCB] Loading context graph...');
    let graph = await loadContextGraph(companyId);
    if (!graph) {
      console.log('[FCB] Creating new context graph');
      graph = createEmptyContextGraph(companyId, companyName);
    }

    console.log('[FCB] Writing extracted fields...');
    const { graph: updatedGraph, result: writeResult } = writeExtractedFields(
      graph,
      allFields,
      runId
    );

    console.log(`[FCB] Wrote ${writeResult.fieldsWritten} fields, skipped ${writeResult.fieldsSkipped}`);

    // =========================================================================
    // Step 4: Save context graph
    // =========================================================================

    await saveContextGraph(updatedGraph, 'fcb');
    console.log('[FCB] Context graph saved');

    // =========================================================================
    // Step 5: Optionally save snapshot
    // =========================================================================

    if (options?.saveSnapshot !== false) {
      try {
        await captureVersion(
          updatedGraph,
          'diagnostic_run',
          {
            description: options?.reason || 'Foundational Context Builder auto-fill',
            triggerRunId: runId,
          }
        );
        console.log('[FCB] History snapshot saved');
      } catch (e) {
        console.warn('[FCB] Failed to save snapshot:', e);
      }
    }

    // =========================================================================
    // Build result
    // =========================================================================

    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Build extractor summaries
    const buildSummary = (result: ExtractorResult): ExtractorSummary => {
      const written = writeResult.writtenPaths.filter(p =>
        result.fields.some(f => f.path === p)
      );
      const skipped = writeResult.skippedPaths.filter(sp =>
        result.fields.some(f => f.path === sp.path)
      );

      return {
        fieldsExtracted: result.fields.length,
        fieldsWritten: written.length,
        fieldsSkipped: skipped.length,
        avgConfidence:
          result.fields.length > 0
            ? result.fields.reduce((sum, f) => sum + f.confidence, 0) / result.fields.length
            : 0,
        writtenPaths: written,
        skippedPaths: skipped,
      };
    };

    const runResult: FCBRunResult = {
      success: true,
      companyId,
      runId,
      startedAt,
      completedAt,
      durationMs,
      totalFieldsExtracted: allFields.length,
      fieldsWritten: writeResult.fieldsWritten,
      fieldsSkipped: writeResult.fieldsSkipped,
      extractorResults: {
        identity: buildSummary(extractorResults.identity),
        audience: buildSummary(extractorResults.audience),
        productOffer: buildSummary(extractorResults.productOffer),
        brand: buildSummary(extractorResults.brand),
        website: buildSummary(extractorResults.website),
        competitive: buildSummary(extractorResults.competitive),
      },
      diagnostics: allDiagnostics,
    };

    console.log(`[FCB] Run complete in ${durationMs}ms`);

    return runResult;
  } catch (error) {
    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    console.error('[FCB] Run failed:', error);

    return {
      success: false,
      companyId,
      runId,
      startedAt,
      completedAt,
      durationMs,
      totalFieldsExtracted: 0,
      fieldsWritten: 0,
      fieldsSkipped: 0,
      extractorResults: {
        identity: { fieldsExtracted: 0, fieldsWritten: 0, fieldsSkipped: 0, avgConfidence: 0, writtenPaths: [], skippedPaths: [] },
        audience: { fieldsExtracted: 0, fieldsWritten: 0, fieldsSkipped: 0, avgConfidence: 0, writtenPaths: [], skippedPaths: [] },
        productOffer: { fieldsExtracted: 0, fieldsWritten: 0, fieldsSkipped: 0, avgConfidence: 0, writtenPaths: [], skippedPaths: [] },
        brand: { fieldsExtracted: 0, fieldsWritten: 0, fieldsSkipped: 0, avgConfidence: 0, writtenPaths: [], skippedPaths: [] },
        website: { fieldsExtracted: 0, fieldsWritten: 0, fieldsSkipped: 0, avgConfidence: 0, writtenPaths: [], skippedPaths: [] },
        competitive: { fieldsExtracted: 0, fieldsWritten: 0, fieldsSkipped: 0, avgConfidence: 0, writtenPaths: [], skippedPaths: [] },
      },
      diagnostics: allDiagnostics,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Re-export types
export type {
  SignalBundle,
  FCBRunResult,
  ExtractorResult,
  ExtractorSummary,
  CollectionDiagnostic,
  ExtractorDiagnostic,
  ExtractedField,
} from './types';
