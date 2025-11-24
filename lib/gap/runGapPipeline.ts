// lib/gap/runGapPipeline.ts
// Worker function that runs the GAP generation pipeline and updates progress

import { updateGapRun, getGapRun } from './gapRunStore';
import { generateGrowthAccelerationPlan } from '../growth-plan/generateGrowthActionPlan';
import type { GrowthAccelerationPlan } from '../growth-plan/types';
import { runWebsiteUxDiagnostics } from '@/lib/diagnostics/websiteUx';
import { runBrandDiagnostics, type CompanyContext as BrandCompanyContext } from '@/lib/diagnostics/brand';
import { upsertFullReportForOsRun } from '@/lib/airtable/fullReports';
import { getBase } from '@/lib/airtable';
import type { OsDiagnosticResult } from '@/lib/diagnostics/types';
import { fetchEvidenceForCompany } from '@/lib/telemetry/googleTelemetry';
import type { EvidencePayload } from '@/lib/gap/types';

/**
 * Helper to update progress safely
 */
async function setProgress(
  runId: string, 
  progress: number, 
  stage: string, 
  currentFinding?: string | null
) {
  const startTime = Date.now();
  try {
    console.log(`[setProgress:${runId}] Starting update: ${stage} (${progress}%)`);
    await updateGapRun(runId, {
      progress,
      stage,
      currentFinding: currentFinding ?? null,
      status: 'running',
      updatedAt: new Date(),
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[setProgress:${runId}] ✅ Update completed in ${elapsed}s: ${stage} (${progress}%)`);
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[setProgress:${runId}] ❌ Failed after ${elapsed}s: ${error instanceof Error ? error.message : String(error)}`);
    // Don't throw - progress updates are best effort
  }
}

/**
 * Progress callback type for GAP generation
 */
export type GapProgressCallback = (finding: string, progress?: number, stage?: string) => void;

/**
 * Combine Website/UX and Brand diagnostics into a single OsDiagnosticResult
 */
function combineDignostics({
  websiteUx,
  brand,
  companyContext,
  telemetryEvidence,
}: {
  websiteUx: any | null;
  brand: any | null;
  companyContext: BrandCompanyContext;
  telemetryEvidence?: EvidencePayload;
}): OsDiagnosticResult {
  const pillarScores: OsDiagnosticResult['pillarScores'] = [];
  const allIssues: OsDiagnosticResult['pillarScores'][number]['issues'] = [];
  const allPriorities: OsDiagnosticResult['priorities'] = [];
  let overallScore = 0;
  let pillarCount = 0;

  // Add Website/UX pillar
  if (websiteUx) {
    pillarScores.push({
      pillar: 'websiteUx' as const,
      score: websiteUx.score,
      justification: websiteUx.justification,
      issues: websiteUx.issues.map((i: any) => ({ ...i, pillar: 'websiteUx' as const })),
    });
    allIssues.push(...websiteUx.issues.map((i: any) => ({ ...i, pillar: 'websiteUx' as const })));
    allPriorities.push(
      ...websiteUx.priorities.map((p: any) => ({
        ...p,
        pillar: 'websiteUx' as const,
        description: p.rationale,
      }))
    );
    overallScore += websiteUx.score;
    pillarCount++;
  }

  // Add Brand pillar
  if (brand) {
    pillarScores.push({
      pillar: 'brand' as const,
      score: brand.score,
      justification: brand.justification,
      issues: brand.issues,
    });
    allIssues.push(...brand.issues);
    allPriorities.push(...brand.priorities);
    overallScore += brand.score;
    pillarCount++;
  }

  // Calculate overall score as average of available pillars
  if (pillarCount > 0) {
    overallScore = Math.round(overallScore / pillarCount);
  }

  // Build evidence object
  const evidence: any = {};
  if (websiteUx && websiteUx.evidence) {
    evidence.websiteUx = websiteUx.evidence;
  }
  if (brand && brand.evidence) {
    evidence.brand = brand.evidence;
  }

  // Merge telemetry evidence (GA4 + Search Console data)
  if (telemetryEvidence) {
    evidence.metrics = telemetryEvidence.metrics || [];
    evidence.insights = telemetryEvidence.insights || [];
    evidence.lastUpdated = telemetryEvidence.lastUpdated;
  }

  // Build simple growth plan from priorities
  const quickWins = allPriorities
    .filter((p) => p.effort === 'low' && p.impact !== 'low')
    .slice(0, 5)
    .map((p, idx) => ({
      id: `qw-${idx + 1}`,
      title: p.title,
      description: p.description || p.rationale,
      pillar: p.pillar === 'multi' ? undefined : p.pillar,
      estimatedImpact: p.impact,
      estimatedEffort: p.effort,
    }));

  const strategicInitiatives = allPriorities
    .filter((p) => p.effort !== 'low' || p.impact === 'high')
    .slice(0, 5)
    .map((p, idx) => ({
      id: `si-${idx + 1}`,
      title: p.title,
      description: p.description || p.rationale,
      pillar: p.pillar === 'multi' ? undefined : p.pillar,
    }));

  return {
    overallScore,
    pillarScores,
    priorities: allPriorities,
    plan: {
      quickWins,
      strategicInitiatives,
      recommendedFocusAreas: pillarScores.map((ps) =>
        ps.pillar === 'websiteUx' ? 'Website/UX' : ps.pillar === 'brand' ? 'Brand' : ps.pillar
      ),
    },
    evidence,
    schemaVersion: 'v1',
    metadata: {
      companyId: companyContext.id,
      runDate: new Date().toISOString(),
    },
  };
}

/**
 * Run the GAP generation pipeline
 * Updates progress throughout the process
 */
export async function runGapPipeline(
  runId: string,
  websiteUrl: string,
  competitorUrls: string[] = [],
  options?: {
    enableDebug?: boolean;
    mode?: 'gap' | 'os';
    companyId?: string;
    snapshotId?: string;
  }
): Promise<(GrowthAccelerationPlan | import('../growth-plan/schema').GrowthAccelerationPlanFallback) & { fullReportId?: string }> {
  const startTime = Date.now();
  const log = (msg: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[runGapPipeline:${runId}] [${elapsed}s] ${msg}`);
  };
  
  log(`Starting GAP pipeline for url: ${websiteUrl}`);

  try {
    // Update status to running
    log('Setting initial progress: starting');
    await setProgress(runId, 5, 'starting', 'Initializing GAP engine...');
    log('Initial progress set successfully');

    // The generateGrowthAccelerationPlan function handles the entire pipeline
    // We'll insert progress updates at key stages by wrapping it
    // Since the function is complex, we'll update progress at major milestones

    log('Setting progress: initializing-assessment');
    const progressStart = Date.now();
    // Don't await - make this progress update non-blocking too
    // If Airtable is slow, we don't want to block the entire pipeline
    setProgress(runId, 10, 'initializing-assessment', 'Analyzing website structure and navigation...').then(() => {
      const progressElapsed = ((Date.now() - progressStart) / 1000).toFixed(2);
      log(`Progress set: initializing-assessment (took ${progressElapsed}s)`);
    }).catch((err) => {
      const progressElapsed = ((Date.now() - progressStart) / 1000).toFixed(2);
      log(`WARNING: Progress update failed after ${progressElapsed}s: ${err instanceof Error ? err.message : String(err)}`);
    });
    
    // Create progress callback to report findings in real-time
    const reportFinding = async (finding: string, progress?: number, stage?: string) => {
      const currentProgress = progress ?? 10;
      const currentStage = stage ?? 'analyzing';
      log(`Progress callback received: ${currentStage} (${currentProgress}%) - ${finding.substring(0, 50)}...`);
      // Don't await - make progress updates non-blocking
      setProgress(runId, currentProgress, currentStage, finding).catch((err) => {
        log(`WARNING: Progress update failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    };
    
    // Call the main generation function with progress callback
    // This internally handles: snapshot → crawl → scoring → GAP generation
    log('About to call generateGrowthAccelerationPlan...');
    const planPromise = generateGrowthAccelerationPlan(websiteUrl, competitorUrls, {
      enableDebug: options?.enableDebug,
      onProgress: reportFinding,
    });
    
    // Add a heartbeat to log every 10 seconds while waiting
    const heartbeatInterval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`⏳ Still waiting for generateGrowthAccelerationPlan... (${elapsed}s elapsed)`);
    }, 10000);
    
    let plan: GrowthAccelerationPlan | import('../growth-plan/schema').GrowthAccelerationPlanFallback;
    try {
      plan = await planPromise;
      clearInterval(heartbeatInterval);
      log('generateGrowthAccelerationPlan completed successfully');
    } catch (planError) {
      clearInterval(heartbeatInterval);
      log(`generateGrowthAccelerationPlan failed: ${planError instanceof Error ? planError.message : String(planError)}`);
      throw planError;
    }

    log('Setting progress: finalizing');
    await setProgress(runId, 90, 'finalizing', 'Assembling final GAP Blueprint...');

    // Validate the plan
    // The generateGrowthAccelerationPlan already validates, but we ensure it's complete
    log('Validating plan...');
    if (!plan || !plan.gapId) {
      log('ERROR: Plan is invalid or missing gapId');
      throw new Error('Generated plan is invalid or missing gapId');
    }
    log(`Plan validated: gapId=${plan.gapId}`);

    // Run OS diagnostics if mode is 'os'
    let fullReportId: string | undefined;

    if (options?.mode === 'os' && options?.companyId) {
      log('Running OS diagnostics (Website/UX + Brand)...');
      try {
        await setProgress(runId, 92, 'diagnostics', 'Running OS diagnostics...');

        // Get company details from Airtable
        const base = getBase();
        const companiesTable = process.env.AIRTABLE_COMPANIES_TABLE || 'Companies';
        const companyRecord = await base(companiesTable).find(options.companyId);

        if (companyRecord) {
          const fields = companyRecord.fields;

          // Build company context for diagnostics
          const companyContext: BrandCompanyContext = {
            id: companyRecord.id,
            name: (fields['Company Name'] as string) || 'Unknown Company',
            websiteUrl: websiteUrl,
            industry: (fields['Industry'] as string) || null,
            stage: (fields['Stage'] as string) || null,
          };

          // Fetch telemetry evidence (GA4 + Search Console) if configured
          let telemetryEvidence: EvidencePayload | undefined;
          const ga4PropertyId = fields['GA4 Property ID'] as string | undefined;
          const searchConsoleSiteUrl = fields['Search Console Site URL'] as string | undefined;

          if (ga4PropertyId || searchConsoleSiteUrl) {
            log('Fetching telemetry evidence (GA4 + Search Console)...');
            try {
              await setProgress(runId, 93, 'telemetry', 'Fetching real telemetry data...');
              telemetryEvidence = await fetchEvidenceForCompany({
                ga4PropertyId,
                searchConsoleSiteUrl,
              });
              if (telemetryEvidence) {
                log(`Telemetry evidence collected: ${telemetryEvidence.metrics?.length || 0} metrics, ${telemetryEvidence.insights?.length || 0} insights`);
              } else {
                log('No telemetry evidence collected');
              }
            } catch (telemetryError) {
              log(`WARNING: Failed to fetch telemetry evidence: ${telemetryError instanceof Error ? telemetryError.message : String(telemetryError)}`);
            }
          } else {
            log('No telemetry sources configured (GA4/GSC), skipping evidence collection');
          }

          // Run Website/UX and Brand diagnostics in parallel
          log('Running Website/UX and Brand diagnostics in parallel...');
          const [websiteUxResult, brandResult] = await Promise.all([
            runWebsiteUxDiagnostics(companyContext).catch((err) => {
              log(`WARNING: Website/UX diagnostics failed: ${err.message}`);
              return null;
            }),
            runBrandDiagnostics(companyContext).catch((err) => {
              log(`WARNING: Brand diagnostics failed: ${err.message}`);
              return null;
            }),
          ]);

          log(`Diagnostics complete: websiteUx=${websiteUxResult?.score}/10, brand=${brandResult?.score}/10`);

          // Combine diagnostics into OsDiagnosticResult
          if (websiteUxResult || brandResult) {
            const osResult = combineDignostics({
              websiteUx: websiteUxResult,
              brand: brandResult,
              companyContext,
              telemetryEvidence,
            });

            log(`Combined OS result: overall=${osResult.overallScore}/10, pillars=${osResult.pillarScores.length}`);

            // Save to Full Reports
            log('Saving diagnostics to Full Reports...');
            fullReportId = await upsertFullReportForOsRun({
              companyId: options.companyId,
              snapshotId: options.snapshotId,
              gapRunId: runId,
              reportType: 'OS',
              osResult,
            });

            log(`Full Report saved: ${fullReportId}`);
          } else {
            log('WARNING: All diagnostics failed, skipping Full Report save');
          }
        } else {
          log(`WARNING: Company record not found: ${options.companyId}`);
        }
      } catch (diagnosticsError) {
        // Log but don't throw - diagnostics are supplementary
        log(`WARNING: OS diagnostics failed: ${diagnosticsError instanceof Error ? diagnosticsError.message : String(diagnosticsError)}`);
      }
    }

    // Mark as completed
    log('Setting progress: completed');
    await setProgress(runId, 100, 'completed');

    // Final update to mark as completed - wrap in try-catch to prevent worker failure
    log('Updating final status in Airtable...');
    try {
      await updateGapRun(runId, {
        status: 'completed',
        result: plan,
        updatedAt: new Date(),
      });
      log('Final status updated successfully');
    } catch (updateError) {
      // Log but don't throw - the plan was generated successfully
      log(`WARNING: Failed to update final status: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✅ GAP pipeline completed successfully in ${totalTime}s`);

    return {
      ...plan,
      fullReportId,
    };
  } catch (err: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const log = (msg: string) => {
      console.log(`[runGapPipeline:${runId}] [${totalTime}s] ${msg}`);
    };
    log(`❌ Error in pipeline: ${err?.message || String(err)}`);
    if (err?.stack) {
      log(`Stack trace: ${err.stack.substring(0, 500)}`);
    }

    const errorMessage = err?.message ?? 'Unknown error occurred during GAP generation';
    
    // Try to update status to failed, but don't let this throw if it fails
    try {
      await updateGapRun(runId, {
        status: 'failed',
        error: errorMessage,
        updatedAt: new Date(),
      });
    } catch (updateError) {
      // Log but don't throw - we're already in error state
      console.error(`[runGapPipeline] Failed to update error status for ${runId}:`, updateError);
    }

    throw err;
  }
}

