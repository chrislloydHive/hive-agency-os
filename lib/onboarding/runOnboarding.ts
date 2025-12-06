// lib/onboarding/runOnboarding.ts
// "Run Everything Once" Onboarding Orchestrator
//
// Orchestrates: FCB → Labs Refinement → Full GAP → Snapshot
// to fully initialize a company's Context Graph in one pass.

import { randomUUID } from 'crypto';
import { getCompanyById } from '@/lib/airtable/companies';
import { runFoundationalContextBuilder, type FCBRunResult } from '@/lib/contextGraph/fcb';
import {
  runAudienceLabRefinement,
  runBrandLabRefinement,
  runCreativeLabRefinement,
  runCompetitorLabRefinementGeneric,
  runWebsiteLabRefinementGeneric,
  type LabRefinementRunResult,
} from '@/lib/labs/refinementRunner';
import { runFullGAPOrchestrator } from '@/lib/gap/orchestrator/runFullGAPOrchestrator';
import { computeContextHealthScore, type ContextHealthScore } from '@/lib/contextGraph/health';
import { captureVersion } from '@/lib/contextGraph/history';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import type {
  OnboardingInput,
  OnboardingResult,
  OnboardingStep,
  StepResult,
  StepStatus,
} from './types';
import { ONBOARDING_STEPS, STEP_TO_LAB_ID } from './types';

// ============================================================================
// Progress Callback Type
// ============================================================================

/**
 * Callback for streaming progress updates to the UI
 */
export type OnboardingProgressCallback = (progress: {
  type: 'step_started' | 'step_completed' | 'step_failed' | 'step_skipped' | 'complete' | 'error';
  step?: OnboardingStep;
  stepIndex?: number;
  totalSteps: number;
  status?: StepStatus;
  message?: string;
  durationMs?: number;
  error?: string;
  steps: StepResult[];
  result?: OnboardingResult;
}) => void;

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Run the full onboarding pass for a company.
 *
 * This is the "Run Everything Once" function that:
 * 1. Runs FCB to auto-fill context from website
 * 2. Runs Audience Lab refinement
 * 3. Runs Brand Lab refinement
 * 4. Runs Creative Lab refinement
 * 5. Runs Full GAP Orchestrator
 * 6. Creates initial snapshot for QBR
 *
 * @param input - Configuration for the onboarding run
 * @param onProgress - Optional callback for streaming progress updates
 */
export async function runOnboarding(
  input: OnboardingInput,
  onProgress?: OnboardingProgressCallback
): Promise<OnboardingResult> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  console.log(`[Onboarding] Starting run ${runId} for company ${input.companyId}`);

  // Initialize step results
  const stepResults: StepResult[] = ONBOARDING_STEPS.map(step => ({
    step,
    status: 'pending' as StepStatus,
  }));

  // Get company info
  const company = await getCompanyById(input.companyId);
  if (!company) {
    throw new Error(`Company not found: ${input.companyId}`);
  }

  // Get initial context health
  let contextHealthBefore: ContextHealthScore;
  try {
    contextHealthBefore = await computeContextHealthScore(input.companyId);
  } catch (e) {
    // Default empty health score
    contextHealthBefore = {
      companyId: input.companyId,
      overallScore: 0,
      completenessScore: 0,
      criticalCoverageScore: 0,
      freshnessScore: 0,
      confidenceScore: 0,
      severity: 'unhealthy',
      sectionScores: [],
      missingCriticalFields: [],
      computedAt: new Date().toISOString(),
      stats: {
        totalFields: 0,
        populatedFields: 0,
        criticalFields: 0,
        criticalPopulated: 0,
        staleFields: 0,
        averageConfidence: 0,
        manualFields: 0,
        autoFillableFields: 0,
      },
    };
  }

  // Results containers
  let fcbResult: FCBRunResult | null = null;
  let audienceLabResult: LabRefinementRunResult | null = null;
  let brandLabResult: LabRefinementRunResult | null = null;
  let creativeLabResult: LabRefinementRunResult | null = null;
  let competitorLabResult: LabRefinementRunResult | null = null;
  let websiteLabResult: LabRefinementRunResult | null = null;
  let gapResult: OnboardingResult['gap'] = null;
  let snapshotId: string | undefined;
  let error: string | undefined;

  const updateStep = (step: OnboardingStep, status: StepStatus, extra?: Partial<StepResult>) => {
    const idx = stepResults.findIndex(s => s.step === step);
    if (idx >= 0) {
      stepResults[idx] = { ...stepResults[idx], status, ...extra };

      // Emit progress event
      if (onProgress) {
        const eventType = status === 'running' ? 'step_started'
          : status === 'completed' ? 'step_completed'
          : status === 'failed' ? 'step_failed'
          : status === 'skipped' ? 'step_skipped'
          : 'step_started';

        onProgress({
          type: eventType,
          step,
          stepIndex: idx,
          totalSteps: ONBOARDING_STEPS.length,
          status,
          message: extra?.error,
          durationMs: extra?.durationMs,
          steps: [...stepResults],
        });
      }
    }
  };

  try {
    // ========================================================================
    // Step 1: FCB
    // ========================================================================
    console.log('[Onboarding] Step 1: Running FCB...');
    updateStep('fcb', 'running', { startedAt: new Date().toISOString() });

    const domain = company.domain || company.website;
    if (!domain) {
      console.log('[Onboarding] No domain found, skipping FCB');
      updateStep('fcb', 'skipped', {
        completedAt: new Date().toISOString(),
        error: 'No domain configured',
      });
    } else {
      try {
        const fcbStart = Date.now();
        fcbResult = await runFoundationalContextBuilder(
          input.companyId,
          domain,
          company.name,
          { saveSnapshot: false, reason: 'Onboarding initial pass' }
        );
        updateStep('fcb', fcbResult.success ? 'completed' : 'failed', {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - fcbStart,
          error: fcbResult.error,
        });
        console.log(`[Onboarding] FCB completed: ${fcbResult.fieldsWritten} fields written`);
      } catch (e) {
        const err = e instanceof Error ? e.message : 'Unknown error';
        console.error('[Onboarding] FCB failed:', err);
        updateStep('fcb', 'failed', {
          completedAt: new Date().toISOString(),
          error: err,
        });
      }
    }

    // ========================================================================
    // Step 2: Audience Lab Refinement
    // ========================================================================
    console.log('[Onboarding] Step 2: Running Audience Lab...');
    updateStep('audience_lab', 'running', { startedAt: new Date().toISOString() });

    try {
      const labStart = Date.now();
      audienceLabResult = await runAudienceLabRefinement(input.companyId, {
        forceRun: input.force,
        dryRun: input.dryRun,
      });
      updateStep('audience_lab', 'completed', {
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - labStart,
      });
      console.log(`[Onboarding] Audience Lab completed: ${audienceLabResult.refinement.refinedContext.length} refinements`);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Onboarding] Audience Lab failed:', err);
      updateStep('audience_lab', 'failed', {
        completedAt: new Date().toISOString(),
        error: err,
      });
    }

    // ========================================================================
    // Step 3: Brand Lab Refinement
    // ========================================================================
    console.log('[Onboarding] Step 3: Running Brand Lab...');
    updateStep('brand_lab', 'running', { startedAt: new Date().toISOString() });

    try {
      const labStart = Date.now();
      brandLabResult = await runBrandLabRefinement(input.companyId, {
        forceRun: input.force,
        dryRun: input.dryRun,
      });
      updateStep('brand_lab', 'completed', {
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - labStart,
      });
      console.log(`[Onboarding] Brand Lab completed: ${brandLabResult.refinement.refinedContext.length} refinements`);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Onboarding] Brand Lab failed:', err);
      updateStep('brand_lab', 'failed', {
        completedAt: new Date().toISOString(),
        error: err,
      });
    }

    // ========================================================================
    // Step 4: Creative Lab Refinement
    // ========================================================================
    console.log('[Onboarding] Step 4: Running Creative Lab...');
    updateStep('creative_lab', 'running', { startedAt: new Date().toISOString() });

    try {
      const labStart = Date.now();
      creativeLabResult = await runCreativeLabRefinement(input.companyId, {
        forceRun: input.force,
        dryRun: input.dryRun,
      });
      updateStep('creative_lab', 'completed', {
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - labStart,
      });
      console.log(`[Onboarding] Creative Lab completed: ${creativeLabResult.refinement.refinedContext.length} refinements`);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Onboarding] Creative Lab failed:', err);
      updateStep('creative_lab', 'failed', {
        completedAt: new Date().toISOString(),
        error: err,
      });
    }

    // ========================================================================
    // Step 5: Competitor Lab Refinement
    // ========================================================================
    console.log('[Onboarding] Step 5: Running Competitor Lab...');
    updateStep('competitor_lab', 'running', { startedAt: new Date().toISOString() });

    try {
      const labStart = Date.now();
      competitorLabResult = await runCompetitorLabRefinementGeneric(input.companyId, {
        forceRun: input.force,
        dryRun: input.dryRun,
      });
      updateStep('competitor_lab', 'completed', {
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - labStart,
      });
      console.log(`[Onboarding] Competitor Lab completed: ${competitorLabResult.refinement.refinedContext.length} refinements`);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Onboarding] Competitor Lab failed:', err);
      updateStep('competitor_lab', 'failed', {
        completedAt: new Date().toISOString(),
        error: err,
      });
    }

    // ========================================================================
    // Step 6: Website Lab Refinement
    // ========================================================================
    console.log('[Onboarding] Step 6: Running Website Lab...');
    updateStep('website_lab', 'running', { startedAt: new Date().toISOString() });

    try {
      const labStart = Date.now();
      websiteLabResult = await runWebsiteLabRefinementGeneric(input.companyId, {
        forceRun: input.force,
        dryRun: input.dryRun,
      });
      updateStep('website_lab', 'completed', {
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - labStart,
      });
      console.log(`[Onboarding] Website Lab completed: ${websiteLabResult.refinement.refinedContext.length} refinements`);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Onboarding] Website Lab failed:', err);
      updateStep('website_lab', 'failed', {
        completedAt: new Date().toISOString(),
        error: err,
      });
    }

    // ========================================================================
    // Step 7: Full GAP Orchestrator
    // ========================================================================
    console.log('[Onboarding] Step 7: Running Full GAP Orchestrator...');
    updateStep('gap_orchestrator', 'running', { startedAt: new Date().toISOString() });

    try {
      const gapStart = Date.now();
      const gapOutput = await runFullGAPOrchestrator({
        companyId: input.companyId,
        dryRun: input.dryRun,
      });
      gapResult = {
        success: gapOutput.success,
        labsRun: gapOutput.labsRun || [],
        insightsGenerated: gapOutput.insights?.length || 0,
        snapshotId: gapOutput.snapshotId,
      };
      updateStep('gap_orchestrator', gapOutput.success ? 'completed' : 'failed', {
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - gapStart,
      });
      console.log(`[Onboarding] GAP Orchestrator completed: ${gapResult.insightsGenerated} insights`);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Onboarding] GAP Orchestrator failed:', err);
      gapResult = { success: false, labsRun: [], insightsGenerated: 0, error: err };
      updateStep('gap_orchestrator', 'failed', {
        completedAt: new Date().toISOString(),
        error: err,
      });
    }

    // ========================================================================
    // Step 8: Create Baseline Snapshot
    // ========================================================================
    console.log('[Onboarding] Step 8: Creating baseline snapshot...');
    updateStep('snapshot', 'running', { startedAt: new Date().toISOString() });

    try {
      const graph = await loadContextGraph(input.companyId);
      if (graph && !input.dryRun) {
        const version = await captureVersion(graph, 'diagnostic_run', {
          description: 'Onboarding complete - initial baseline',
          triggerRunId: runId,
        });
        snapshotId = version?.versionId;
      }
      updateStep('snapshot', 'completed', {
        completedAt: new Date().toISOString(),
      });
      console.log(`[Onboarding] Snapshot created: ${snapshotId || 'dry-run'}`);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Onboarding] Snapshot failed:', err);
      updateStep('snapshot', 'failed', {
        completedAt: new Date().toISOString(),
        error: err,
      });
    }

  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
    console.error('[Onboarding] Critical error:', error);
  }

  // ========================================================================
  // Get final context health
  // ========================================================================
  let contextHealthAfter: ContextHealthScore;
  try {
    contextHealthAfter = await computeContextHealthScore(input.companyId);
  } catch (e) {
    contextHealthAfter = contextHealthBefore;
  }

  // ========================================================================
  // Build result
  // ========================================================================
  const completedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - startTime;

  // Calculate summary stats
  const fieldsPopulated = fcbResult?.fieldsWritten || 0;
  const fieldsRefined =
    (audienceLabResult?.applyResult?.updated || 0) +
    (brandLabResult?.applyResult?.updated || 0) +
    (creativeLabResult?.applyResult?.updated || 0) +
    (competitorLabResult?.applyResult?.updated || 0) +
    (websiteLabResult?.applyResult?.updated || 0);
  const insightsGenerated = gapResult?.insightsGenerated || 0;
  const healthImprovement = contextHealthAfter.overallScore - contextHealthBefore.overallScore;

  const success =
    stepResults.filter(s => s.status === 'failed').length === 0 ||
    contextHealthAfter.overallScore > contextHealthBefore.overallScore;

  console.log(`[Onboarding] Complete. Health: ${contextHealthBefore.overallScore} → ${contextHealthAfter.overallScore}`);

  const result: OnboardingResult = {
    success,
    companyId: input.companyId,
    companyName: company.name,
    runId,
    startedAt,
    completedAt,
    totalDurationMs,
    steps: stepResults,
    fcb: fcbResult,
    labs: {
      audience: audienceLabResult,
      brand: brandLabResult,
      creative: creativeLabResult,
      competitor: competitorLabResult,
      website: websiteLabResult,
    },
    gap: gapResult,
    contextHealthBefore,
    contextHealthAfter,
    snapshotId: snapshotId || gapResult?.snapshotId,
    summary: {
      fieldsPopulated,
      fieldsRefined,
      insightsGenerated,
      healthImprovement,
    },
    error,
  };

  // Emit final complete event
  if (onProgress) {
    onProgress({
      type: error ? 'error' : 'complete',
      totalSteps: ONBOARDING_STEPS.length,
      steps: [...stepResults],
      result,
      error,
    });
  }

  return result;
}
