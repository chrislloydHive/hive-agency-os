// lib/inngest/functions/brand-diagnostic.ts
// Brand Lab Diagnostic - Inngest Multi-Step Function
//
// Runs Brand Lab V2 diagnostic asynchronously with progress tracking.
// Each step is resumable and can be retried independently.

import { inngest } from '../client';
import { NonRetriableError } from 'inngest';
import { getCompanyById } from '@/lib/airtable/companies';
import { createDiagnosticRun, updateDiagnosticRun } from '@/lib/os/diagnostics/runs';
import { processDiagnosticRunCompletionAsync } from '@/lib/os/diagnostics/postRunHooks';

// ============================================================================
// EVENT TYPES
// ============================================================================

export type BrandDiagnosticStartEvent = {
  name: 'brand.diagnostic.start';
  data: {
    companyId: string;
    runId?: string; // Optional: existing run to update
  };
};

export type BrandDiagnosticUpdatedEvent = {
  name: 'brand.diagnostic.updated';
  data: {
    companyId: string;
    runId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    currentStep?: string;
    percent?: number;
    error?: string;
  };
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export const brandDiagnostic = inngest.createFunction(
  {
    id: 'brand-diagnostic',
    name: 'Brand Lab Diagnostic Pipeline',
    retries: 2,
  },
  { event: 'brand.diagnostic.start' },
  async ({ event, step }) => {
    const { companyId, runId: existingRunId } = event.data;

    console.log('[BrandDiagnostic] Starting pipeline', { companyId });

    // ========================================================================
    // STEP 0: Initialize Run Record
    // ========================================================================
    const { runId, websiteUrl, company } = await step.run('initialize-run', async () => {
      console.log('[BrandDiagnostic] Initializing run record...');

      // Verify company exists
      const company = await getCompanyById(companyId);
      if (!company) {
        throw new NonRetriableError(`Company ${companyId} not found`);
      }

      if (!company.website) {
        throw new NonRetriableError(`Company ${companyId} has no website URL`);
      }

      // Create or use existing run
      let runId = existingRunId;
      if (!runId) {
        const run = await createDiagnosticRun({
          companyId,
          toolId: 'brandLab',
          status: 'running',
        });
        runId = run.id;
      } else {
        // Update existing run to running
        await updateDiagnosticRun(runId, { status: 'running' });
      }

      // Emit status update event
      await inngest.send({
        name: 'brand.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'initialize',
          percent: 5,
        },
      });

      return { runId, websiteUrl: company.website, company };
    });

    // ========================================================================
    // STEP 1: Run V1 Brand Lab Engine (LLM Analysis) + Validation
    // ========================================================================
    const v1Result = await step.run('run-v1-engine', async () => {
      console.log('[BrandDiagnostic] Step 1/4: Running V1 Brand Lab engine...');

      await inngest.send({
        name: 'brand.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'Analyzing brand signals...',
          percent: 15,
        },
      });

      // Import and run V1 engine
      const { runBrandLab: runBrandLabV1 } = await import('@/lib/gap-heavy/modules/brandLabImpl');

      const result = await runBrandLabV1({
        company,
        websiteUrl,
        skipCompetitive: false,
      });

      console.log('[BrandDiagnostic] V1 analysis complete:', {
        v1Score: result.diagnostic.score,
        benchmarkLabel: result.diagnostic.benchmarkLabel,
      });

      // Validate the diagnostic is not a fallback/scaffold
      const { detectBrandLabFailure } = await import('@/lib/diagnostics/brand-lab/validation');
      const validation = detectBrandLabFailure(result);

      if (validation.failed) {
        console.error('[BrandDiagnostic] V1 diagnostic failed validation:', validation.reasons);

        // Update run to failed status before throwing
        await updateDiagnosticRun(runId, {
          status: 'failed',
          metadata: {
            error: 'Brand Lab could not complete a reliable analysis.',
            validationReasons: validation.reasons,
          },
        });

        // Emit failure event
        await inngest.send({
          name: 'brand.diagnostic.updated',
          data: {
            companyId,
            runId,
            status: 'failed',
            error: 'Brand Lab could not complete a reliable analysis: ' + validation.reasons.join(' '),
          },
        });

        throw new NonRetriableError(
          `Brand Lab validation failed: ${validation.reasons.join('; ')}`
        );
      }

      return result;
    });

    // ========================================================================
    // STEP 2: Transform to V2 Structure
    // ========================================================================
    const v2Result = await step.run('transform-to-v2', async () => {
      console.log('[BrandDiagnostic] Step 2/4: Transforming to V2 structure...');

      await inngest.send({
        name: 'brand.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'Building dimension scores...',
          percent: 70,
        },
      });

      // Import V2 modules
      const { buildBrandDimensionsFromV1, computeBrandDataConfidence } = await import(
        '@/lib/diagnostics/brand-lab/scoring'
      );
      const { generateBrandNarrative } = await import('@/lib/diagnostics/brand-lab/narrative');

      const diagnostic = v1Result.diagnostic;
      const actionPlan = v1Result.actionPlan;

      // Compute data confidence
      const dataConfidence = computeBrandDataConfidence(diagnostic);

      // Build dimensions from V1 structures
      const scoringResult = buildBrandDimensionsFromV1(diagnostic);
      const { dimensions, issues, overallScore, maturityStage } = scoringResult;

      // Generate narrative summary
      const narrativeSummary = generateBrandNarrative({
        dimensions,
        overallScore,
        maturityStage,
        benchmarkLabel: diagnostic.benchmarkLabel,
        summary: diagnostic.summary,
      });

      console.log('[BrandDiagnostic] V2 scoring complete:', {
        overallScore,
        maturityStage,
        dimensionCount: dimensions.length,
        issueCount: issues.length,
      });

      return {
        overallScore,
        maturityStage,
        dataConfidence,
        narrativeSummary,
        dimensions,
        issues,
        diagnostic,
        actionPlan,
      };
    });

    // ========================================================================
    // STEP 3: Build Full V2 Result (using V1 result from Step 1)
    // ========================================================================
    const fullResult = await step.run('build-full-result', async () => {
      console.log('[BrandDiagnostic] Step 3/4: Building full V2 result...');

      await inngest.send({
        name: 'brand.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'Generating recommendations...',
          percent: 85,
        },
      });

      // Use the SAME V1 result from Step 1 - don't re-run V1!
      // This ensures we use the validated result, not a potentially different re-run
      const { buildBrandLabResultFromV1 } = await import('@/lib/diagnostics/brand-lab');

      const result = await buildBrandLabResultFromV1(v1Result, {
        company,
        websiteUrl,
        companyId,
      });

      console.log('[BrandDiagnostic] Full result built:', {
        quickWins: result.quickWins.length,
        projects: result.projects.length,
      });

      return result;
    });

    // ========================================================================
    // STEP 4: Persist Results
    // ========================================================================
    await step.run('persist-results', async () => {
      console.log('[BrandDiagnostic] Step 4/4: Persisting results...');

      await inngest.send({
        name: 'brand.diagnostic.updated',
        data: {
          companyId,
          runId,
          status: 'running',
          currentStep: 'Saving results...',
          percent: 95,
        },
      });

      // Update diagnostic run with results
      const updatedRun = await updateDiagnosticRun(runId, {
        status: 'complete',
        score: fullResult.overallScore,
        summary: fullResult.narrativeSummary,
        rawJson: fullResult,
      });

      console.log('[BrandDiagnostic] Results persisted to diagnostic run:', runId);

      // Also save to Heavy Run evidencePack for backward compatibility
      try {
        const { getHeavyGapRunsByCompanyId, updateHeavyGapRunState } = await import(
          '@/lib/airtable/gapHeavyRuns'
        );

        const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 1);
        if (heavyRuns.length > 0) {
          const heavyRun = heavyRuns[0];
          await updateHeavyGapRunState({
            ...heavyRun,
            evidencePack: {
              ...(heavyRun.evidencePack || {}),
              brandLab: fullResult,
              modules: heavyRun.evidencePack?.modules || [],
            },
            updatedAt: new Date().toISOString(),
          });
          console.log('[BrandDiagnostic] Results saved to Heavy Run evidencePack');
        }
      } catch (err) {
        console.warn('[BrandDiagnostic] Could not update Heavy Run:', err);
      }

      // Process post-run hooks (Brain entry + Strategic Snapshot)
      processDiagnosticRunCompletionAsync(companyId, updatedRun);

      return { runId };
    });

    // ========================================================================
    // FINAL: Emit Completion Event
    // ========================================================================
    await inngest.send({
      name: 'brand.diagnostic.updated',
      data: {
        companyId,
        runId,
        status: 'completed',
        percent: 100,
      },
    });

    console.log('[BrandDiagnostic] ============================================');
    console.log('[BrandDiagnostic] DIAGNOSTIC PIPELINE COMPLETE');
    console.log(`[BrandDiagnostic] Score: ${fullResult.overallScore}/100`);
    console.log(`[BrandDiagnostic] Maturity: ${fullResult.maturityStage}`);
    console.log(`[BrandDiagnostic] Quick Wins: ${fullResult.quickWins.length}`);
    console.log('[BrandDiagnostic] ============================================');

    return {
      runId,
      companyId,
      score: fullResult.overallScore,
      maturityStage: fullResult.maturityStage,
      quickWins: fullResult.quickWins.length,
      projects: fullResult.projects.length,
    };
  }
);

// ============================================================================
// ERROR HANDLER
// ============================================================================

export const brandDiagnosticErrorHandler = inngest.createFunction(
  {
    id: 'brand-diagnostic-error-handler',
    name: 'Brand Lab Diagnostic Error Handler',
  },
  { event: 'inngest/function.failed' },
  async ({ event }) => {
    // Only handle failures from brand-diagnostic function
    if (event.data.function_id !== 'brand-diagnostic') {
      return;
    }

    const { companyId, runId } = event.data.event.data;
    const error = event.data.error;

    console.error('[BrandDiagnostic] Function failed:', error);

    // Update run record with error
    if (runId) {
      try {
        await updateDiagnosticRun(runId, {
          status: 'failed',
          metadata: { error: String(error) },
        });
      } catch (updateError) {
        console.error('[BrandDiagnostic] Failed to update run record:', updateError);
      }
    }

    // Emit failure event
    await inngest.send({
      name: 'brand.diagnostic.updated',
      data: {
        companyId,
        runId,
        status: 'failed',
        error: String(error),
      },
    });
  }
);
