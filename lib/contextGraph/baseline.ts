// lib/contextGraph/baseline.ts
// One-Click "Baseline Context Build" Orchestrator
//
// This is the canonical "Run Everything Once" function that builds a complete
// baseline Context Graph for a new company. After this runs, users refine
// rather than start from a blank slate.
//
// Pipeline: FCB → Labs Refinement → GAP-IA (light) → Competition Discovery → Import → Snapshot

import { randomUUID } from 'crypto';
import { getCompanyById } from '@/lib/airtable/companies';
import { runFoundationalContextBuilder, type FCBRunResult } from './fcb';
import {
  runLabRefinement,
  type LabRefinementRunResult,
} from '@/lib/labs/refinementRunner';
import type { RefinementLabId } from '@/lib/labs/refinementTypes';
import { loadContextGraph, saveContextGraph } from './storage';
import { createEmptyContextGraph } from './companyContextGraph';
import { computeContextHealthScore, type ContextHealthScore } from './health';
import { captureVersion } from './history';
import type { CompanyContextGraph } from './companyContextGraph';
import { runGapIaForOsBaseline } from '@/lib/gap/orchestrator/osGapIaBaseline';
import { writeGapIaBaselineToContext } from './writers/gapIaBaselineWriter';
import { runCompetitionV2 } from '@/lib/competition/discoveryV2';
import { competitionLabImporter } from './importers/competitionLabImporter';
import { logGapPlanRunToAirtable } from '@/lib/airtable/gapPlanRuns';

// ============================================================================
// Types
// ============================================================================

/**
 * Baseline build step identifiers
 */
export type BaselineStep =
  | 'initialize'
  | 'fcb'
  | 'audience_lab'
  | 'brand_lab'
  | 'creative_lab'
  | 'competitor_lab'
  | 'website_lab'
  | 'gap_ia'
  | 'competition_discovery'
  | 'competition_import'
  | 'snapshot';

/**
 * Step status
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Individual step result
 */
export interface StepResult {
  step: BaselineStep;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  message?: string;
  error?: string;
}

/**
 * Context summary for before/after comparison
 */
export interface ContextSummary {
  overallScore: number;
  completenessScore: number;
  criticalCoverageScore: number;
  freshnessScore: number;
  confidenceScore: number;
  severity: 'healthy' | 'degraded' | 'unhealthy';
  populatedFields: number;
  totalFields: number;
}

/**
 * Section touch summary
 */
export interface SectionTouch {
  section: string;
  fieldsBefore: number;
  fieldsAfter: number;
  delta: number;
}

/**
 * Input for baseline build
 */
export interface BaselineBuildInput {
  companyId: string;
  /** Force re-run even if already initialized */
  force?: boolean;
  /** Skip GAP-IA (faster but less thorough) */
  skipGapIa?: boolean;
  /** Dry run - don't persist changes */
  dryRun?: boolean;
}

/**
 * Result of baseline build
 */
export interface BaselineBuildResult {
  success: boolean;
  companyId: string;
  companyName: string;
  runId: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;

  /** Whether this was a no-op (already initialized) */
  wasNoOp: boolean;

  /** Step-by-step results */
  steps: StepResult[];

  /** Context health before/after */
  contextBefore: ContextSummary;
  contextAfter: ContextSummary;

  /** Which sections were touched */
  sectionsTouched: SectionTouch[];

  /** FCB result */
  fcbResult: FCBRunResult | null;

  /** Lab refinement results */
  labsResults: {
    audience: LabRefinementRunResult | null;
    brand: LabRefinementRunResult | null;
    creative: LabRefinementRunResult | null;
    competitor: LabRefinementRunResult | null;
    website: LabRefinementRunResult | null;
  };

  /** GAP-IA result (if run) */
  gapIaResult: {
    success: boolean;
    insightsGenerated: number;
    dimensionScores?: Record<string, number>;
  } | null;

  /** Snapshot ID */
  snapshotId: string | null;

  /** Summary stats */
  summary: {
    fieldsPopulated: number;
    fieldsRefined: number;
    healthImprovement: number;
  };

  /** Error if failed */
  error?: string;
}

/**
 * Progress callback for streaming updates
 */
export type BaselineProgressCallback = (progress: {
  type: 'step_started' | 'step_completed' | 'step_failed' | 'step_skipped' | 'complete' | 'error';
  step?: BaselineStep;
  stepIndex?: number;
  totalSteps: number;
  status?: StepStatus;
  message?: string;
  durationMs?: number;
  error?: string;
  steps: StepResult[];
  result?: BaselineBuildResult;
}) => void;

// ============================================================================
// Step Configuration
// ============================================================================

const BASELINE_STEPS: BaselineStep[] = [
  'initialize',
  'fcb',
  'audience_lab',
  'brand_lab',
  'creative_lab',
  'competitor_lab',
  'website_lab',
  'gap_ia',
  'competition_discovery',
  'competition_import',
  'snapshot',
];

const STEP_LABELS: Record<BaselineStep, string> = {
  initialize: 'Initialize Context Graph',
  fcb: 'Auto-fill from Website (FCB)',
  audience_lab: 'Audience Lab Refinement',
  brand_lab: 'Brand Lab Refinement',
  creative_lab: 'Creative Lab Refinement',
  competitor_lab: 'Competitor Lab Refinement',
  website_lab: 'Website Lab Refinement',
  gap_ia: 'Marketing Assessment (GAP-IA)',
  competition_discovery: 'Discover Competitors (AI)',
  competition_import: 'Import Competitors to Context',
  snapshot: 'Create Baseline Snapshot',
};

const REFINEMENT_LABS: RefinementLabId[] = [
  'audience',
  'brand',
  'creative',
  'competitor',
  'website',
];

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Run the full baseline context build for a company.
 *
 * This is the canonical "Run Everything Once" function that:
 * 1. Checks if already initialized (short-circuits if so)
 * 2. Runs FCB to auto-fill from website
 * 3. Runs all Labs in refinement mode
 * 4. Auto-seeds competitors if still empty
 * 5. Creates a baseline snapshot
 *
 * After this runs, most auto-fillable fields are populated and users
 * refine rather than start from a blank slate.
 */
export async function runBaselineContextBuild(
  input: BaselineBuildInput,
  onProgress?: BaselineProgressCallback
): Promise<BaselineBuildResult> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  console.log(`[Baseline] Starting run ${runId} for company ${input.companyId}`);

  // Initialize step results
  const stepResults: StepResult[] = BASELINE_STEPS.map(step => ({
    step,
    status: 'pending' as StepStatus,
  }));

  const updateStep = (step: BaselineStep, status: StepStatus, extra?: Partial<StepResult>) => {
    const idx = stepResults.findIndex(s => s.step === step);
    if (idx >= 0) {
      stepResults[idx] = { ...stepResults[idx], status, ...extra };

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
          totalSteps: BASELINE_STEPS.length,
          status,
          message: extra?.message || STEP_LABELS[step],
          durationMs: extra?.durationMs,
          error: extra?.error,
          steps: [...stepResults],
        });
      }
    }
  };

  // Get company info
  const company = await getCompanyById(input.companyId);
  if (!company) {
    const error = `Company not found: ${input.companyId}`;
    console.error(`[Baseline] ${error}`);
    return createErrorResult(input.companyId, runId, startedAt, error, stepResults);
  }

  // Result containers
  let fcbResult: FCBRunResult | null = null;
  let labsResults: BaselineBuildResult['labsResults'] = {
    audience: null,
    brand: null,
    creative: null,
    competitor: null,
    website: null,
  };
  let gapIaResult: BaselineBuildResult['gapIaResult'] = null;
  let snapshotId: string | null = null;
  let wasNoOp = false;
  let error: string | undefined;

  // Get or create context graph
  let graph: CompanyContextGraph;

  try {
    // ========================================================================
    // Phase 0: Initialize / Short-circuit Check
    // ========================================================================
    console.log('[Baseline] Phase 0: Checking initialization status...');
    updateStep('initialize', 'running', { startedAt: new Date().toISOString() });

    const existingGraph = await loadContextGraph(input.companyId);

    // Check if already initialized
    if (existingGraph?.meta?.contextInitializedAt && !input.force) {
      console.log(`[Baseline] Already initialized at ${existingGraph.meta.contextInitializedAt}, skipping`);
      wasNoOp = true;

      updateStep('initialize', 'completed', {
        completedAt: new Date().toISOString(),
        message: `Already initialized at ${existingGraph.meta.contextInitializedAt}`,
      });

      // Skip all other steps
      for (const step of BASELINE_STEPS.slice(1)) {
        updateStep(step, 'skipped', { message: 'Already initialized' });
      }

      const health = await computeContextHealthScore(input.companyId);
      const contextSummary = healthToSummary(health);

      return {
        success: true,
        companyId: input.companyId,
        companyName: company.name,
        runId,
        startedAt,
        completedAt: new Date().toISOString(),
        totalDurationMs: Date.now() - startTime,
        wasNoOp: true,
        steps: stepResults,
        contextBefore: contextSummary,
        contextAfter: contextSummary,
        sectionsTouched: [],
        fcbResult: null,
        labsResults,
        gapIaResult: null,
        snapshotId: existingGraph.meta.lastSnapshotId || null,
        summary: {
          fieldsPopulated: 0,
          fieldsRefined: 0,
          healthImprovement: 0,
        },
      };
    }

    // Create or use existing graph
    graph = existingGraph || createEmptyContextGraph(input.companyId, company.name);

    updateStep('initialize', 'completed', {
      completedAt: new Date().toISOString(),
      message: existingGraph ? 'Using existing graph' : 'Created new graph',
    });

    // Get initial health score
    const healthBefore = await safeComputeHealth(input.companyId);

    // ========================================================================
    // Phase 1: FCB (Foundational Context Builder)
    // ========================================================================
    console.log('[Baseline] Phase 1: Running FCB...');
    updateStep('fcb', 'running', { startedAt: new Date().toISOString() });

    const domain = company.domain || company.website;
    if (!domain) {
      console.log('[Baseline] No domain found, skipping FCB');
      updateStep('fcb', 'skipped', {
        completedAt: new Date().toISOString(),
        message: 'No domain configured',
      });
    } else {
      try {
        const fcbStart = Date.now();
        fcbResult = await runFoundationalContextBuilder(
          input.companyId,
          domain,
          company.name,
          { saveSnapshot: false, reason: 'Baseline context build' }
        );

        updateStep('fcb', fcbResult.success ? 'completed' : 'failed', {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - fcbStart,
          message: `${fcbResult.fieldsWritten} fields written`,
          error: fcbResult.error,
        });

        console.log(`[Baseline] FCB completed: ${fcbResult.fieldsWritten} fields written`);
      } catch (e) {
        const err = e instanceof Error ? e.message : 'Unknown error';
        console.error('[Baseline] FCB failed:', err);
        updateStep('fcb', 'failed', {
          completedAt: new Date().toISOString(),
          error: err,
        });
      }
    }

    // ========================================================================
    // Phase 2: Labs Refinement
    // ========================================================================
    console.log('[Baseline] Phase 2: Running Labs...');

    for (const labId of REFINEMENT_LABS) {
      const stepName = `${labId}_lab` as BaselineStep;
      console.log(`[Baseline] Running ${labId} lab...`);
      updateStep(stepName, 'running', { startedAt: new Date().toISOString() });

      try {
        const labStart = Date.now();
        const result = await runLabRefinement({
          companyId: input.companyId,
          labId,
          forceRun: true, // Always run during baseline
          dryRun: input.dryRun,
        });

        labsResults[labId] = result;

        const refinementsCount = result.refinement.refinedContext.length;
        const updatedCount = result.applyResult?.updated || 0;

        updateStep(stepName, 'completed', {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - labStart,
          message: `${refinementsCount} refinements proposed, ${updatedCount} applied`,
        });

        console.log(`[Baseline] ${labId} lab completed: ${refinementsCount} refinements`);
      } catch (e) {
        const err = e instanceof Error ? e.message : 'Unknown error';
        console.error(`[Baseline] ${labId} lab failed:`, err);
        updateStep(stepName, 'failed', {
          completedAt: new Date().toISOString(),
          error: err,
        });
      }
    }

    // ========================================================================
    // Phase 3: GAP-IA Marketing Assessment
    // ========================================================================
    if (!input.skipGapIa) {
      console.log('[Baseline] Phase 3: Running GAP-IA analysis...');
      updateStep('gap_ia', 'running', { startedAt: new Date().toISOString() });

      try {
        const gapStart = Date.now();
        const gapResult = await runGapIaForOsBaseline(input.companyId);

        if (gapResult.success) {
          // Write GAP-IA results to context graph
          const writeResult = await writeGapIaBaselineToContext(
            input.companyId,
            gapResult,
            { runId, dryRun: input.dryRun }
          );

          // Build result for reporting
          gapIaResult = {
            success: true,
            insightsGenerated: writeResult.fieldsWritten,
            dimensionScores: {
              seo: gapResult.dimensions.seo?.score || 0,
              content: gapResult.dimensions.content?.score || 0,
              brand: gapResult.dimensions.brand?.score || 0,
              website: gapResult.dimensions.website?.score || 0,
              digitalFootprint: gapResult.dimensions.digitalFootprint?.score || 0,
            },
          };

          updateStep('gap_ia', 'completed', {
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - gapStart,
            message: `Score ${gapResult.overallScore}%, ${writeResult.fieldsWritten} fields written`,
          });

          console.log(`[Baseline] GAP-IA completed: score ${gapResult.overallScore}%, ${writeResult.fieldsWritten} fields`);

          // Also log to GAP-Plan Run table for visibility in Reports Hub
          try {
            await logGapPlanRunToAirtable({
              planId: `baseline-${runId}`,
              url: domain ? `https://${domain}` : '',
              maturityStage: gapResult.maturityStage as 'Early' | 'Emerging' | 'Scaling' | 'Leading' | undefined,
              scores: {
                overall: gapResult.overallScore,
                brand: gapResult.dimensions.brand?.score,
                content: gapResult.dimensions.content?.score,
                website: gapResult.dimensions.website?.score,
                seo: gapResult.dimensions.seo?.score,
                digitalFootprint: gapResult.dimensions.digitalFootprint?.score,
                authority: gapResult.dimensions.authority?.score,
              },
              quickWinsCount: gapResult.quickWins.length,
              initiativesCount: gapResult.topOpportunities.length,
              createdAt: startedAt,
              companyId: input.companyId,
              rawPlan: {
                companyName: company.name,
                source: 'baseline_context_build',
                runId,
                overallScore: gapResult.overallScore,
                maturityStage: gapResult.maturityStage,
                dimensions: gapResult.dimensions,
                quickWins: gapResult.quickWins,
                topOpportunities: gapResult.topOpportunities,
              },
            });
            console.log('[Baseline] Logged to GAP-Plan Run table for Reports visibility');
          } catch (logError) {
            // Non-fatal - don't fail baseline if logging fails
            console.warn('[Baseline] Failed to log to GAP-Plan Run table:', logError);
          }
        } else {
          gapIaResult = {
            success: false,
            insightsGenerated: 0,
          };

          updateStep('gap_ia', 'failed', {
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - gapStart,
            error: gapResult.error || 'GAP-IA analysis failed',
          });

          console.warn('[Baseline] GAP-IA failed:', gapResult.error);
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : 'Unknown error';
        console.error('[Baseline] GAP-IA failed:', err);
        gapIaResult = { success: false, insightsGenerated: 0 };
        updateStep('gap_ia', 'failed', {
          completedAt: new Date().toISOString(),
          error: err,
        });
      }
    } else {
      console.log('[Baseline] Phase 3: GAP-IA skipped (skipGapIa=true)');
      updateStep('gap_ia', 'skipped', {
        completedAt: new Date().toISOString(),
        message: 'Skipped by configuration',
      });
    }

    // ========================================================================
    // Phase 4: Competition Discovery (discover competitors via AI)
    // ========================================================================
    console.log('[Baseline] Phase 4: Running Competition Discovery...');
    updateStep('competition_discovery', 'running', { startedAt: new Date().toISOString() });

    let competitionRunId: string | null = null;
    let competitorsDiscovered = 0;

    try {
      // Check if we already have competitors in Context Graph
      const currentGraph = await loadContextGraph(input.companyId);
      const existingCompetitors = currentGraph?.competitive?.competitors?.value;
      const hasExistingCompetitors = Array.isArray(existingCompetitors) && existingCompetitors.length > 0;

      if (hasExistingCompetitors && !input.force) {
        console.log('[Baseline] Competitors already in Context Graph, skipping discovery');
        updateStep('competition_discovery', 'skipped', {
          completedAt: new Date().toISOString(),
          message: `${existingCompetitors.length} competitors already exist`,
        });
      } else {
        // Run Competition Discovery V2
        console.log('[Baseline] Running Competition Discovery V2...');
        const discoveryStart = Date.now();

        if (!input.dryRun) {
          const competitionRun = await runCompetitionV2({ companyId: input.companyId });
          competitionRunId = competitionRun.id;
          competitorsDiscovered = competitionRun.competitors.length;

          if (competitionRun.status === 'failed') {
            throw new Error(competitionRun.errorMessage || 'Competition discovery failed');
          }

          updateStep('competition_discovery', 'completed', {
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - discoveryStart,
            message: `Discovered ${competitorsDiscovered} competitors`,
          });
        } else {
          updateStep('competition_discovery', 'skipped', {
            completedAt: new Date().toISOString(),
            message: 'Dry run - skipped discovery',
          });
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Baseline] Competition discovery failed:', err);
      updateStep('competition_discovery', 'failed', {
        completedAt: new Date().toISOString(),
        error: err,
      });
      // Don't fail the whole pipeline - continue to import step
    }

    // ========================================================================
    // Phase 4b: Import Competitors to Context Graph
    // ========================================================================
    console.log('[Baseline] Phase 4b: Importing competitors to Context Graph...');
    updateStep('competition_import', 'running', { startedAt: new Date().toISOString() });

    try {
      if (competitorsDiscovered === 0 && !competitionRunId) {
        console.log('[Baseline] No competitors to import, skipping');
        updateStep('competition_import', 'skipped', {
          completedAt: new Date().toISOString(),
          message: 'No competitors discovered',
        });
      } else if (input.dryRun) {
        updateStep('competition_import', 'skipped', {
          completedAt: new Date().toISOString(),
          message: 'Dry run - skipped import',
        });
      } else {
        // Reload graph for import
        const graphForImport = await loadContextGraph(input.companyId);
        if (!graphForImport) {
          throw new Error('Could not load context graph for import');
        }

        const importStart = Date.now();
        const importResult = await competitionLabImporter.importAll(graphForImport, input.companyId, domain || '');

        if (importResult.success) {
          // Save the updated graph
          await saveContextGraph(graphForImport, 'competition_import');

          updateStep('competition_import', 'completed', {
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - importStart,
            message: `Imported ${importResult.fieldsUpdated} fields (${importResult.updatedPaths.length} paths)`,
          });
        } else {
          throw new Error(importResult.errors.join(', ') || 'Import failed');
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Baseline] Competition import failed:', err);
      updateStep('competition_import', 'failed', {
        completedAt: new Date().toISOString(),
        error: err,
      });
    }

    // ========================================================================
    // Phase 5: Snapshot & Finalize
    // ========================================================================
    console.log('[Baseline] Phase 5: Creating snapshot...');
    updateStep('snapshot', 'running', { startedAt: new Date().toISOString() });

    try {
      // Reload final graph
      const finalGraph = await loadContextGraph(input.companyId);

      if (finalGraph && !input.dryRun) {
        // Mark as initialized
        finalGraph.meta.contextInitializedAt = new Date().toISOString();
        finalGraph.meta.updatedAt = new Date().toISOString();

        // Save updated graph with initialization timestamp
        await saveContextGraph(finalGraph, 'baseline_build');

        // Create snapshot
        const version = await captureVersion(finalGraph, 'diagnostic_run', {
          description: 'Baseline context build complete',
          triggerRunId: runId,
        });
        snapshotId = version?.versionId || null;

        updateStep('snapshot', 'completed', {
          completedAt: new Date().toISOString(),
          message: snapshotId ? `Snapshot ${snapshotId}` : 'Snapshot created',
        });

        console.log(`[Baseline] Snapshot created: ${snapshotId}`);
      } else {
        updateStep('snapshot', input.dryRun ? 'skipped' : 'failed', {
          completedAt: new Date().toISOString(),
          message: input.dryRun ? 'Dry run - no snapshot' : 'No graph to snapshot',
        });
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      console.error('[Baseline] Snapshot failed:', err);
      updateStep('snapshot', 'failed', {
        completedAt: new Date().toISOString(),
        error: err,
      });
    }

    // ========================================================================
    // Build Final Result
    // ========================================================================
    const healthAfter = await safeComputeHealth(input.companyId);

    const completedAt = new Date().toISOString();
    const totalDurationMs = Date.now() - startTime;

    // Calculate summary stats
    const fieldsPopulated = fcbResult?.fieldsWritten || 0;
    const fieldsRefined = Object.values(labsResults)
      .filter(Boolean)
      .reduce((sum, r) => sum + (r?.applyResult?.updated || 0), 0);
    const healthImprovement = healthAfter.overallScore - healthBefore.overallScore;

    // Check for any failures
    const hasFailures = stepResults.some(s => s.status === 'failed');
    const success = !hasFailures || healthImprovement > 0;

    console.log(`[Baseline] Complete. Health: ${healthBefore.overallScore} → ${healthAfter.overallScore} (+${healthImprovement})`);

    const result: BaselineBuildResult = {
      success,
      companyId: input.companyId,
      companyName: company.name,
      runId,
      startedAt,
      completedAt,
      totalDurationMs,
      wasNoOp,
      steps: stepResults,
      contextBefore: healthToSummary(healthBefore),
      contextAfter: healthToSummary(healthAfter),
      sectionsTouched: computeSectionsTouched(healthBefore, healthAfter),
      fcbResult,
      labsResults,
      gapIaResult,
      snapshotId,
      summary: {
        fieldsPopulated,
        fieldsRefined,
        healthImprovement,
      },
      error,
    };

    // Emit final complete event
    if (onProgress) {
      onProgress({
        type: error ? 'error' : 'complete',
        totalSteps: BASELINE_STEPS.length,
        steps: [...stepResults],
        result,
        error,
      });
    }

    return result;

  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
    console.error('[Baseline] Critical error:', error);

    return createErrorResult(input.companyId, runId, startedAt, error, stepResults, company.name);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an error result
 */
function createErrorResult(
  companyId: string,
  runId: string,
  startedAt: string,
  error: string,
  steps: StepResult[],
  companyName = 'Unknown'
): BaselineBuildResult {
  return {
    success: false,
    companyId,
    companyName,
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - new Date(startedAt).getTime(),
    wasNoOp: false,
    steps,
    contextBefore: createEmptySummary(),
    contextAfter: createEmptySummary(),
    sectionsTouched: [],
    fcbResult: null,
    labsResults: {
      audience: null,
      brand: null,
      creative: null,
      competitor: null,
      website: null,
    },
    gapIaResult: null,
    snapshotId: null,
    summary: {
      fieldsPopulated: 0,
      fieldsRefined: 0,
      healthImprovement: 0,
    },
    error,
  };
}

/**
 * Create empty context summary
 */
function createEmptySummary(): ContextSummary {
  return {
    overallScore: 0,
    completenessScore: 0,
    criticalCoverageScore: 0,
    freshnessScore: 0,
    confidenceScore: 0,
    severity: 'unhealthy',
    populatedFields: 0,
    totalFields: 0,
  };
}

/**
 * Convert health score to summary
 */
function healthToSummary(health: ContextHealthScore): ContextSummary {
  return {
    overallScore: health.overallScore,
    completenessScore: health.completenessScore,
    criticalCoverageScore: health.criticalCoverageScore,
    freshnessScore: health.freshnessScore,
    confidenceScore: health.confidenceScore,
    severity: health.severity,
    populatedFields: health.stats.populatedFields,
    totalFields: health.stats.totalFields,
  };
}

/**
 * Safely compute health score, returning empty if fails
 */
async function safeComputeHealth(companyId: string): Promise<ContextHealthScore> {
  try {
    return await computeContextHealthScore(companyId);
  } catch {
    return {
      companyId,
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
}

/**
 * Compute which sections were touched
 */
function computeSectionsTouched(
  before: ContextHealthScore,
  after: ContextHealthScore
): SectionTouch[] {
  const touches: SectionTouch[] = [];

  // Compare section scores
  for (const afterSection of after.sectionScores) {
    const beforeSection = before.sectionScores.find(s => s.section === afterSection.section);
    const beforePopulated = beforeSection?.populatedFields || 0;
    const afterPopulated = afterSection.populatedFields;
    const delta = afterPopulated - beforePopulated;

    if (delta !== 0) {
      touches.push({
        section: afterSection.section,
        fieldsBefore: beforePopulated,
        fieldsAfter: afterPopulated,
        delta,
      });
    }
  }

  return touches.sort((a, b) => b.delta - a.delta);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if a company has been baseline-initialized
 */
export async function isBaselineInitialized(companyId: string): Promise<boolean> {
  const graph = await loadContextGraph(companyId);
  return !!graph?.meta?.contextInitializedAt;
}

/**
 * Get baseline initialization date for a company
 */
export async function getBaselineInitializedAt(companyId: string): Promise<string | null> {
  const graph = await loadContextGraph(companyId);
  return graph?.meta?.contextInitializedAt || null;
}

/**
 * Get baseline build status summary for UI
 */
export async function getBaselineStatus(companyId: string): Promise<{
  initialized: boolean;
  initializedAt: string | null;
  healthScore: number;
  completeness: number;
  lastSnapshotId: string | null;
}> {
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    return {
      initialized: false,
      initializedAt: null,
      healthScore: 0,
      completeness: 0,
      lastSnapshotId: null,
    };
  }

  const health = await safeComputeHealth(companyId);

  return {
    initialized: !!graph.meta?.contextInitializedAt,
    initializedAt: graph.meta?.contextInitializedAt || null,
    healthScore: health.overallScore,
    completeness: health.completenessScore,
    lastSnapshotId: graph.meta?.lastSnapshotId || null,
  };
}
