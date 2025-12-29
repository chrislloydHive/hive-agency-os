// lib/gap/orchestrator/runFullGAPOrchestrator.ts
// Full GAP OS Orchestrator - Context-First Mode
//
// This is the main orchestrator for running Full GAP in OS mode.
// It is completely isolated from the lead magnet mode and:
// - Loads context graph and assesses health
// - Determines which Labs need to run
// - Runs Labs in refinement mode
// - Merges Lab outputs into context
// - Runs GAP core engine
// - Extracts normalized insights
// - Creates snapshots for QBR

import crypto from 'crypto';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { getOrCreateContextGraph } from '@/lib/contextGraph/storage';
import { getCompanyById } from '@/lib/airtable/companies';
import { logGapPlanRunToAirtable } from '@/lib/airtable/gapPlanRuns';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { LabId } from '@/lib/contextGraph/labContext';
import type { ClientInsight, InsightCategory } from '@/lib/types/clientBrain';

// Helper to generate UUIDs without external dependency
function generateUUID(): string {
  return crypto.randomUUID();
}

import type {
  OrchestratorInput,
  OrchestratorOutput,
  ContextHealthAssessment,
  LabRefinementOutput,
  GAPStructuredOutput,
  GAPSnapshot,
  LabDiagnostics,
  LabRefinedContext,
  LabInsightUnit,
} from './types';
import { assessContextHealth } from './contextHealth';
import { determineLabsNeededForMissingFields } from './labPlan';
import { runCompetitionGap, validateCompetitiveContextForStrategy } from './competitionGap';

// Import canonical context extraction
import {
  extractCanonicalFields,
  extractFromFullGap,
  mergeExtractionResults,
  type ExtractionResult,
  type ExtractionContext,
} from '@/lib/os/context/extractors';
import { tryNormalizeWebsiteUrl } from '@/lib/utils/urls';
import { upsertContextFields } from '@/lib/os/context/upsertContextFields';
import { canonicalizeFindings, getFieldsForGapToPropose } from '@/lib/os/context/canonicalizer';
import { GAP_ALLOWED_FIELDS } from '@/lib/os/context/schema';
import type { ContextFinding } from '@/lib/types/contextField';

// ============================================================================
// Helper: Build Extraction Context
// ============================================================================

/**
 * Build ExtractionContext based on company state and context health.
 *
 * - New companies (low completeness, no confirmed fields) get baseline mode with lenient filtering
 * - Existing companies get refinement mode with strict filtering
 * - B2C/local businesses get lenient filtering for category-level content
 */
function buildExtractionContext(
  healthBefore: ContextHealthAssessment,
  contextGraph: CompanyContextGraph
): ExtractionContext {
  // Determine company stage based on completeness
  // If completeness is below 10% or we're missing 5+ critical fields, it's a new company
  const isNewCompany = healthBefore.completeness < 0.1 ||
    healthBefore.missingCriticalFields.length >= 5;

  // Determine business model from context graph
  // Look for business_model field or infer from industry
  const businessModelValue = contextGraph.identity?.businessModel?.value ||
    contextGraph.identity?.industry?.value;

  let businessModel: 'b2b' | 'b2c' | 'local' | undefined;
  if (typeof businessModelValue === 'string') {
    const lowerValue = businessModelValue.toLowerCase();
    if (lowerValue.includes('b2b') || lowerValue.includes('enterprise') || lowerValue.includes('saas')) {
      businessModel = 'b2b';
    } else if (lowerValue.includes('b2c') || lowerValue.includes('consumer') || lowerValue.includes('retail')) {
      businessModel = 'b2c';
    } else if (lowerValue.includes('local') || lowerValue.includes('service') || lowerValue.includes('small business')) {
      businessModel = 'local';
    }
  }

  // If no business model detected and it's a new company, default to B2C/local (lenient)
  // This ensures new companies without explicit business model get baseline context
  if (!businessModel && isNewCompany) {
    businessModel = 'b2c';
  }

  const extractionContext: ExtractionContext = {
    companyStage: isNewCompany ? 'new' : 'existing',
    businessModel,
    runPurpose: isNewCompany ? 'baseline' : 'refinement',
  };

  console.log('[GAP Orchestrator] Extraction context:', extractionContext);

  return extractionContext;
}

// Import diagnostic engines
import {
  runBrandLabEngine,
  runWebsiteLabEngine,
  runSeoLabEngine,
  runContentLabEngine,
  runDemandLabEngine,
  runOpsLabEngine,
  runAudienceLabEngine,
  runCreativeLabEngine,
  runMediaLabEngine,
  runUxLabEngine,
  runCompetitorLabEngine,
  runGapPlanEngine,
  type EngineInput,
} from '@/lib/os/diagnostics/engines';

import {
  createDiagnosticRun,
  updateDiagnosticRun,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';

// ============================================================================
// Helper: Map LabId to DiagnosticToolId
// ============================================================================

/**
 * Map a LabId to the corresponding DiagnosticToolId for run recording.
 */
function labIdToToolId(labId: LabId): DiagnosticToolId {
  const mapping: Record<LabId, DiagnosticToolId> = {
    brand: 'brandLab',
    website: 'websiteLab',
    seo: 'seoLab',
    content: 'contentLab',
    demand: 'demandLab',
    ops: 'opsLab',
    audience: 'audienceLab',
    creative: 'creativeLab',
    media: 'mediaLab',
    ux: 'websiteLab', // UX maps to websiteLab
    competitor: 'competitorLab',
  };
  return mapping[labId] || 'brandLab';
}

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Run the Full GAP in OS Orchestrator mode.
 *
 * This is the main entry point for OS-mode GAP runs.
 * It is completely isolated from the lead magnet pipeline.
 */
export async function runFullGAPOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorOutput> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  console.log('[GAP Orchestrator] Starting OS mode for company:', input.companyId);

  try {
    // ========================================================================
    // Step 1: Load Context Graph + Health Assessment
    // ========================================================================
    console.log('[GAP Orchestrator] Step 1: Loading context graph...');

    const company = await getCompanyById(input.companyId);
    if (!company) {
      throw new Error(`Company not found: ${input.companyId}`);
    }

    // Normalize the website URL once for all downstream uses
    const rawWebsiteUrl = company.website || company.domain || '';
    const urlNormResult = tryNormalizeWebsiteUrl(rawWebsiteUrl);
    const normalizedWebsiteUrl = urlNormResult.ok ? urlNormResult.url : '';

    if (!urlNormResult.ok) {
      console.warn('[GAP Orchestrator] URL normalization failed:', urlNormResult.error);
    } else if (rawWebsiteUrl !== normalizedWebsiteUrl) {
      console.log('[GAP Orchestrator] URL normalized:', rawWebsiteUrl, '->', normalizedWebsiteUrl);
    }

    const contextBefore = await getOrCreateContextGraph(
      input.companyId,
      company.name
    );

    const healthBefore = assessContextHealth(contextBefore);

    console.log('[GAP Orchestrator] Context health:', {
      completeness: healthBefore.completeness,
      freshness: healthBefore.freshness,
      missingCritical: healthBefore.missingCriticalFields.length,
      stale: healthBefore.staleFields.length,
    });

    // ========================================================================
    // Step 1.5: Run Competition GAP (ALWAYS - Prerequisite for Strategy)
    // ========================================================================
    // Competition GAP runs BEFORE all other labs to ensure competitive context
    // is always available. It's the ONLY source for competitive fields.
    console.log('[GAP Orchestrator] Step 1.5: Running Competition GAP...');

    let competitionGapResult;
    if (!input.dryRun) {
      try {
        competitionGapResult = await runCompetitionGap({
          companyId: input.companyId,
          forceRun: input.forceLabs?.includes('competitor'),
        });

        console.log('[GAP Orchestrator] Competition GAP result:', {
          success: competitionGapResult.success,
          cached: competitionGapResult.cached,
          competitors: competitionGapResult.competitors,
          durationMs: competitionGapResult.durationMs,
        });

        // Reload context graph after Competition GAP updates
        if (competitionGapResult.success && !competitionGapResult.cached) {
          const updatedGraph = await loadContextGraph(input.companyId);
          if (updatedGraph) {
            Object.assign(contextBefore, updatedGraph);
          }
        }
      } catch (error) {
        // Competition GAP failure is logged but doesn't block orchestrator
        // However, strategy generation will be blocked downstream
        console.error('[GAP Orchestrator] Competition GAP failed (continuing):', error);
        competitionGapResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          cached: false,
          fieldsUpdated: 0,
          competitors: 0,
          durationMs: 0,
        };
      }

      // Validate competitive context for strategy
      const competitiveValidation = validateCompetitiveContextForStrategy(contextBefore);
      if (!competitiveValidation.ready) {
        console.warn('[GAP Orchestrator] Competitive context incomplete:', competitiveValidation.message);
      }
    }

    // ========================================================================
    // Step 2: Determine Which Labs to Run
    // ========================================================================
    console.log('[GAP Orchestrator] Step 2: Determining labs to run...');

    const labPlan = determineLabsNeededForMissingFields(
      healthBefore,
      input.forceLabs,
      input.skipLabs
    );

    console.log('[GAP Orchestrator] Lab plan:', {
      labsToRun: labPlan.labs.map((l) => l.labId),
      estimatedDuration: `${Math.round(labPlan.totalEstimatedDurationMs / 1000)}s`,
    });

    // ========================================================================
    // Step 3: Execute Labs in Refinement Mode
    // ========================================================================
    console.log('[GAP Orchestrator] Step 3: Executing labs...');

    const labOutputs: LabRefinementOutput[] = [];
    const labsRun: LabId[] = [];

    if (!input.dryRun) {
      for (const labItem of labPlan.labs) {
        console.log(`[GAP Orchestrator] Running ${labItem.labName}...`);

        try {
          const labOutput = await runLabInRefinementMode(
            labItem.labId,
            input.companyId,
            company,
            contextBefore
          );

          labOutputs.push(labOutput);
          labsRun.push(labItem.labId);

          console.log(`[GAP Orchestrator] ${labItem.labName} complete:`, {
            success: labOutput.success,
            refinedFields: labOutput.refinedContext.length,
            insights: labOutput.insights.length,
          });
        } catch (error) {
          console.error(`[GAP Orchestrator] ${labItem.labName} failed:`, error);
          labOutputs.push({
            labId: labItem.labId,
            labName: labItem.labName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            refinedContext: [],
            diagnostics: {
              labId: labItem.labId,
              score: null,
              summary: null,
              issues: [],
              recommendations: [],
            },
            insights: [],
            runId: generateUUID(),
            durationMs: 0,
          });
        }
      }
    }

    // ========================================================================
    // Step 4: Merge Lab Outputs into Context Graph
    // ========================================================================
    console.log('[GAP Orchestrator] Step 4: Merging lab outputs...');

    let contextAfter = structuredClone(contextBefore);

    if (!input.dryRun) {
      for (const labOutput of labOutputs) {
        if (labOutput.success && labOutput.refinedContext.length > 0) {
          contextAfter = mergeRefinedContext(
            contextAfter,
            labOutput.refinedContext,
            labOutput.labId
          );
        }
      }

      // Save updated context graph
      await saveContextGraph(contextAfter, 'gap_orchestrator');
    }

    // ========================================================================
    // Step 4.5: Extract Canonical Context TEXT Fields
    // ========================================================================
    console.log('[GAP Orchestrator] Step 4.5: Extracting canonical text fields...');

    // Build extraction context for filtering decisions
    const extractionCtx = buildExtractionContext(healthBefore, contextBefore);

    if (!input.dryRun) {
      try {
        // Extract canonical fields from each lab's raw data
        const extractionResults: ExtractionResult[] = [];

        for (const labOutput of labOutputs) {
          if (labOutput.success) {
            // Get the raw lab data (stored in diagnostics or passed through)
            // The engine result is stored in labOutput and we need to access the raw data
            const labData = (labOutput as any).rawEngineData || labOutput.diagnostics;

            if (labData) {
              const extraction = extractCanonicalFields(
                labOutput.labId,
                labData,
                labOutput.runId,
                extractionCtx
              );

              if (extraction.fields.length > 0) {
                extractionResults.push(extraction);
                console.log(`[GAP Orchestrator] Extracted ${extraction.fields.length} canonical fields from ${labOutput.labName}`);
              }
            }
          }
        }

        // Merge all extraction results (confidence arbitration)
        const mergedFields = mergeExtractionResults(extractionResults);

        // Upsert canonical fields to context graph
        if (mergedFields.length > 0) {
          const upsertResult = await upsertContextFields(
            input.companyId,
            company.name,
            mergedFields,
            { source: 'gap_full' }
          );

          console.log('[GAP Orchestrator] Canonical fields upsert:', {
            upserted: upsertResult.fieldsUpserted,
            skipped: upsertResult.fieldsSkipped,
            paths: upsertResult.updatedPaths,
          });

          // Reload context graph to include canonical field updates
          const updatedGraph = await loadContextGraph(input.companyId);
          if (updatedGraph) {
            contextAfter = updatedGraph;
          }
        }
      } catch (extractError) {
        // Don't fail orchestrator if extraction fails
        console.error('[GAP Orchestrator] Canonical field extraction error (continuing):', extractError);
      }
    }

    const healthAfter = assessContextHealth(contextAfter);

    // ========================================================================
    // Step 5: Run Full GAP Plan Engine
    // ========================================================================
    console.log('[GAP Orchestrator] Step 5: Running Full GAP Plan engine...');

    let gapStructured: GAPStructuredOutput;
    let gapPlanResult: any = null;

    if (!input.dryRun && normalizedWebsiteUrl) {
      try {
        // Run the Full GAP Plan V4 multi-pass pipeline
        const gapEngineInput = {
          companyId: input.companyId,
          company,
          websiteUrl: normalizedWebsiteUrl,
        };

        gapPlanResult = await runGapPlanEngine(gapEngineInput);

        if (gapPlanResult.success && gapPlanResult.data?.growthPlan) {
          console.log('[GAP Orchestrator] Full GAP Plan complete:', {
            score: gapPlanResult.score,
            hasRefinedMarkdown: !!gapPlanResult.data.refinedMarkdown,
          });

          // Build structured output from GAP Plan result
          const growthPlan = gapPlanResult.data.growthPlan;
          gapStructured = {
            scores: {
              overall: growthPlan.scorecard?.overall ?? healthAfter.completeness,
              brand: growthPlan.scorecard?.brand ?? labOutputs.find(l => l.labId === 'brand')?.diagnostics.score ?? 0,
              content: growthPlan.scorecard?.content ?? labOutputs.find(l => l.labId === 'content')?.diagnostics.score ?? 0,
              seo: growthPlan.scorecard?.seo ?? labOutputs.find(l => l.labId === 'seo')?.diagnostics.score ?? 0,
              website: growthPlan.scorecard?.website ?? labOutputs.find(l => l.labId === 'website')?.diagnostics.score ?? 0,
              authority: growthPlan.scorecard?.authority ?? 0,
              digitalFootprint: growthPlan.scorecard?.digitalFootprint ?? 0,
            },
            maturityStage: growthPlan.executiveSummary?.maturityStage ?? 'Unknown',
            dimensionDiagnostics: growthPlan.dimensionDiagnostics ?? [],
            keyFindings: growthPlan.keyFindings ?? [],
            recommendedNextSteps: growthPlan.roadmap?.initiatives?.map((i: any) => ({
              title: i.title,
              description: i.description,
              priority: i.priority ?? 1,
              effort: i.effort ?? 'medium',
              impact: i.impact ?? 'medium',
              dimension: i.dimension ?? 'general',
            })) ?? [],
            kpisToWatch: growthPlan.kpis ?? [],
          };
        } else {
          console.warn('[GAP Orchestrator] GAP Plan engine failed, falling back to lab synthesis');
          gapStructured = buildGAPStructuredOutput(healthAfter, labOutputs, input.gapIaRun);
        }
      } catch (gapError) {
        console.error('[GAP Orchestrator] GAP Plan engine error, falling back to lab synthesis:', gapError);
        gapStructured = buildGAPStructuredOutput(healthAfter, labOutputs, input.gapIaRun);
      }
    } else {
      // Dry run or no website - just synthesize lab outputs
      gapStructured = buildGAPStructuredOutput(healthAfter, labOutputs, input.gapIaRun);
    }

    // ========================================================================
    // Step 5.5: Extract Canonical Fields from GAP Result (RESTRICTED)
    // ========================================================================
    // GAP Full may ONLY propose values for:
    // - Fields in GAP_ALLOWED_FIELDS
    // - Fields that are currently MISSING
    // - GAP MUST NOT overwrite confirmed values
    if (!input.dryRun && gapPlanResult?.success && gapPlanResult?.data) {
      try {
        console.log('[GAP Orchestrator] Step 5.5: Extracting canonical fields from GAP result...');

        // Get fields GAP is allowed to propose (missing + in GAP_ALLOWED_FIELDS)
        const allowedFields = await getFieldsForGapToPropose(input.companyId);
        console.log(`[GAP Orchestrator] GAP allowed to propose ${allowedFields.length} fields:`, allowedFields);

        const gapExtraction = extractFromFullGap(gapPlanResult.data, generateUUID(), extractionCtx);

        if (gapExtraction.fields.length > 0) {
          // Filter to only allowed fields
          const filteredFields = gapExtraction.fields.filter(f =>
            allowedFields.includes(f.key as any)
          );

          console.log(`[GAP Orchestrator] Filtered from ${gapExtraction.fields.length} to ${filteredFields.length} allowed fields`);

          // Convert to ContextFinding format for canonicalizer
          const findings: ContextFinding[] = filteredFields.map(f => ({
            fieldKey: f.key,
            value: typeof f.value === 'string' ? f.value : JSON.stringify(f.value),
            confidence: f.confidence,
            source: 'gap_full' as const,
            sourceRunId: generateUUID(),
            evidence: f.sources[0]?.evidence,
          }));

          // Use canonicalizer for quality validation
          if (findings.length > 0) {
            const canonResult = await canonicalizeFindings(
              input.companyId,
              findings,
              {
                source: 'gap_full',
                sourceRunId: generateUUID(),
              }
            );

            console.log('[GAP Orchestrator] GAP canonical fields via canonicalizer:', {
              written: canonResult.written.length,
              rejected: canonResult.rejected.length,
              skipped: canonResult.skipped.length,
            });

            // Log rejections for debugging
            if (canonResult.rejected.length > 0) {
              console.log('[GAP Orchestrator] Rejected fields:');
              for (const r of canonResult.rejected) {
                console.log(`  - ${r.key}: ${r.reason}`);
              }
            }
          }
        }
      } catch (gapExtractError) {
        console.error('[GAP Orchestrator] GAP canonical extraction error (continuing):', gapExtractError);
      }
    }

    // ========================================================================
    // Step 6: Extract Normalized Insights
    // ========================================================================
    console.log('[GAP Orchestrator] Step 6: Extracting insights...');

    const insights = extractInsightsFromLabOutputs(labOutputs, input.companyId);

    console.log(`[GAP Orchestrator] Extracted ${insights.length} insights`);

    // ========================================================================
    // Step 7: Create Snapshot for QBR
    // ========================================================================
    console.log('[GAP Orchestrator] Step 7: Creating snapshot...');

    const snapshotId = generateUUID();
    const snapshot: GAPSnapshot = {
      id: snapshotId,
      companyId: input.companyId,
      timestamp: new Date().toISOString(),
      contextBefore,
      contextAfter,
      gapFindings: gapStructured,
      insights,
      labsRun,
      changes: {
        fieldsUpdated: countFieldChanges(contextBefore, contextAfter),
        fieldsAdded: countNewFields(contextBefore, contextAfter),
        insightsCreated: insights.length,
        scoreChange: gapStructured.scores.overall - (healthBefore.completeness || 0),
      },
    };

    // ========================================================================
    // Step 8: Log to Airtable
    // ========================================================================
    console.log('[GAP Orchestrator] Step 8: Logging to Airtable...');

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    // Log to GAP-Plan Run table for visibility in Reports
    try {
      await logGapPlanRunToAirtable({
        planId: snapshotId,
        url: normalizedWebsiteUrl || rawWebsiteUrl,
        maturityStage: gapStructured.maturityStage as 'Early' | 'Emerging' | 'Scaling' | 'Leading' | undefined,
        scores: {
          overall: gapStructured.scores.overall,
          brand: gapStructured.scores.brand,
          content: gapStructured.scores.content,
          website: gapStructured.scores.website,
          seo: gapStructured.scores.seo,
          authority: gapStructured.scores.authority,
          digitalFootprint: gapStructured.scores.digitalFootprint,
        },
        quickWinsCount: gapStructured.recommendedNextSteps.filter(s => s.effort === 'low').length,
        initiativesCount: gapStructured.recommendedNextSteps.length,
        createdAt: startedAt,
        companyId: input.companyId,
        rawPlan: {
          companyName: company.name,
          snapshotId,
          labsRun,
          gapStructured,
          insights: insights.slice(0, 20), // Limit to avoid Airtable size limits
          durationMs,
        },
      });
      console.log('[GAP Orchestrator] Logged to Airtable successfully');
    } catch (logError) {
      // Don't fail the orchestrator if logging fails
      console.error('[GAP Orchestrator] Failed to log to Airtable:', logError);
    }

    // ========================================================================
    // Step 9: Return OS-Oriented Output
    // ========================================================================
    console.log('[GAP Orchestrator] Complete:', {
      duration: `${Math.round(durationMs / 1000)}s`,
      labsRun: labsRun.length,
      insights: insights.length,
      scoreImprovement: snapshot.changes.scoreChange,
    });

    return {
      mode: 'os_orchestrator',
      success: true,
      contextBefore,
      contextAfter,
      healthBefore,
      healthAfter,
      labsRun,
      labOutputs,
      gapStructured,
      insights,
      snapshotId,
      durationMs,
      startedAt,
      completedAt,
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    console.error('[GAP Orchestrator] Failed:', error);

    // Return failure output with available data
    return {
      mode: 'os_orchestrator',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      contextBefore: null as any,
      contextAfter: null as any,
      healthBefore: {
        completeness: 0,
        freshness: 0,
        missingCriticalFields: [],
        staleFields: [],
        staleSections: [],
        recommendations: [],
      },
      healthAfter: {
        completeness: 0,
        freshness: 0,
        missingCriticalFields: [],
        staleFields: [],
        staleSections: [],
        recommendations: [],
      },
      labsRun: [],
      labOutputs: [],
      gapStructured: {
        scores: {
          overall: 0,
          brand: 0,
          content: 0,
          seo: 0,
          website: 0,
          authority: 0,
          digitalFootprint: 0,
        },
        maturityStage: 'Unknown',
        dimensionDiagnostics: [],
        keyFindings: [],
        recommendedNextSteps: [],
        kpisToWatch: [],
      },
      insights: [],
      snapshotId: '',
      durationMs,
      startedAt,
      completedAt,
    };
  }
}

// ============================================================================
// Lab Execution
// ============================================================================

/**
 * Run a Lab in refinement mode.
 *
 * Refinement mode returns structured context updates and insights,
 * NOT full narrative reports.
 */
async function runLabInRefinementMode(
  labId: LabId,
  companyId: string,
  company: any,
  context: CompanyContextGraph
): Promise<LabRefinementOutput> {
  const startTime = Date.now();
  const runId = generateUUID();
  const toolId = labIdToToolId(labId);

  // Create a diagnostic run record to track this lab execution
  let diagnosticRunRecord: any = null;
  try {
    diagnosticRunRecord = await createDiagnosticRun({
      companyId,
      toolId,
      status: 'running',
      metadata: {
        source: 'gap_orchestrator',
        labId,
        runId,
      },
    });
    console.log(`[GAP Orchestrator] Created diagnostic run record for ${labId}:`, diagnosticRunRecord?.id);
  } catch (err) {
    // Don't fail the lab run if we can't create the record
    console.warn(`[GAP Orchestrator] Failed to create diagnostic run record for ${labId}:`, err);
  }

  // Normalize the URL before passing to engines
  const rawUrl = company.website || company.domain || '';
  const urlResult = tryNormalizeWebsiteUrl(rawUrl);
  const websiteUrl = urlResult.ok ? urlResult.url : rawUrl;

  const input: EngineInput = {
    companyId,
    company,
    websiteUrl,
  };

  let engineResult: any;
  let labName: string;

  // Run the appropriate engine
  switch (labId) {
    case 'brand':
      labName = 'Brand Lab';
      engineResult = await runBrandLabEngine(input);
      break;
    case 'website':
      labName = 'Website Lab';
      engineResult = await runWebsiteLabEngine(input);
      break;
    case 'seo':
      labName = 'SEO Lab';
      engineResult = await runSeoLabEngine(input);
      break;
    case 'content':
      labName = 'Content Lab';
      engineResult = await runContentLabEngine(input);
      break;
    case 'demand':
      labName = 'Demand Lab';
      engineResult = await runDemandLabEngine(input);
      break;
    case 'ops':
      labName = 'Ops Lab';
      engineResult = await runOpsLabEngine(input);
      break;
    case 'audience':
      labName = 'Audience Lab';
      engineResult = await runAudienceLabEngine(input);
      break;
    case 'creative':
      labName = 'Creative Lab';
      engineResult = await runCreativeLabEngine(input);
      break;
    case 'media':
      labName = 'Media Lab';
      engineResult = await runMediaLabEngine(input);
      break;
    case 'ux':
      labName = 'UX Lab';
      engineResult = await runUxLabEngine(input);
      break;
    case 'competitor':
      labName = 'Competitor Lab';
      engineResult = await runCompetitorLabEngine(input);
      break;
    default:
      // Skip truly unknown labs gracefully
      console.log(`[GAP Orchestrator] Skipping unknown lab: ${labId}`);
      return {
        labId,
        labName: `${labId} Lab`,
        success: true,
        error: undefined,
        refinedContext: [],
        diagnostics: {
          labId,
          score: null,
          summary: `Lab ${labId} is not recognized`,
          issues: [],
          recommendations: [],
          runId,
        },
        insights: [],
        runId,
        durationMs: 0,
      };
  }

  if (!engineResult.success) {
    // Update diagnostic run record as failed
    if (diagnosticRunRecord?.id) {
      try {
        await updateDiagnosticRun(diagnosticRunRecord.id, {
          status: 'failed',
          summary: engineResult.error || 'Lab execution failed',
        });
      } catch (err) {
        console.warn(`[GAP Orchestrator] Failed to update diagnostic run record for ${labId}:`, err);
      }
    }

    return {
      labId,
      labName,
      success: false,
      error: engineResult.error,
      refinedContext: [],
      diagnostics: {
        labId,
        score: null,
        summary: null,
        issues: [],
        recommendations: [],
        runId,
      },
      insights: [],
      runId,
      durationMs: Date.now() - startTime,
    };
  }

  // Extract refined context from engine result
  const refinedContext = extractRefinedContextFromEngine(labId, engineResult);

  // Extract diagnostics
  const diagnostics = extractDiagnosticsFromEngine(labId, engineResult, runId);

  // Extract insights
  const insights = extractInsightsFromEngine(labId, engineResult);

  const durationMs = Date.now() - startTime;

  // Update diagnostic run record as complete
  if (diagnosticRunRecord?.id) {
    try {
      await updateDiagnosticRun(diagnosticRunRecord.id, {
        status: 'complete',
        score: diagnostics.score,
        summary: diagnostics.summary || `${labName} completed successfully`,
        rawJson: engineResult.data,
      });
      console.log(`[GAP Orchestrator] Updated diagnostic run record for ${labId} as complete`);
    } catch (err) {
      console.warn(`[GAP Orchestrator] Failed to update diagnostic run record for ${labId}:`, err);
    }
  }

  return {
    labId,
    labName,
    success: true,
    refinedContext,
    diagnostics,
    insights,
    runId,
    durationMs,
    // Store raw engine data for canonical field extraction
    rawEngineData: engineResult.data,
  };
}

/**
 * Extract refined context fields from engine result
 */
function extractRefinedContextFromEngine(
  labId: LabId,
  engineResult: any
): LabRefinedContext[] {
  const refined: LabRefinedContext[] = [];
  const data = engineResult.data;

  if (!data) return refined;

  // Map Lab outputs to context fields based on labId
  switch (labId) {
    case 'brand':
      if (data.overallScore !== undefined) {
        refined.push({
          domain: 'brand',
          field: 'healthScore',
          value: data.overallScore,
          confidence: 0.8,
        });
      }
      if (data.dimensions) {
        refined.push({
          domain: 'brand',
          field: 'dimensionScores',
          value: data.dimensions,
          confidence: 0.8,
        });
      }
      if (data.pillars) {
        refined.push({
          domain: 'brand',
          field: 'pillars',
          value: data.pillars,
          confidence: 0.75,
        });
      }
      break;

    case 'website':
      if (data.score !== undefined) {
        refined.push({
          domain: 'website',
          field: 'uxScore',
          value: data.score,
          confidence: 0.8,
        });
      }
      if (data.criticalIssues) {
        refined.push({
          domain: 'website',
          field: 'criticalIssues',
          value: data.criticalIssues,
          confidence: 0.85,
        });
      }
      if (data.conversionFactors) {
        refined.push({
          domain: 'website',
          field: 'conversionFactors',
          value: data.conversionFactors,
          confidence: 0.8,
        });
      }
      break;

    case 'seo':
      if (data.overallScore !== undefined) {
        refined.push({
          domain: 'seo',
          field: 'overallScore',
          value: data.overallScore,
          confidence: 0.8,
        });
      }
      if (data.technicalIssues) {
        refined.push({
          domain: 'seo',
          field: 'technicalIssues',
          value: data.technicalIssues,
          confidence: 0.85,
        });
      }
      if (data.topGaps) {
        refined.push({
          domain: 'seo',
          field: 'contentGaps',
          value: data.topGaps,
          confidence: 0.75,
        });
      }
      break;

    case 'content':
      if (data.score !== undefined) {
        refined.push({
          domain: 'content',
          field: 'qualityScore',
          value: data.score,
          confidence: 0.8,
        });
      }
      break;

    case 'demand':
      if (data.score !== undefined) {
        refined.push({
          domain: 'digitalInfra',
          field: 'demandGenScore',
          value: data.score,
          confidence: 0.8,
        });
      }
      break;

    case 'ops':
      if (data.score !== undefined) {
        refined.push({
          domain: 'ops',
          field: 'maturityScore',
          value: data.score,
          confidence: 0.8,
        });
      }
      break;
  }

  return refined;
}

/**
 * Extract diagnostics from engine result
 */
function extractDiagnosticsFromEngine(
  labId: LabId,
  engineResult: any,
  runId: string
): LabDiagnostics {
  const data = engineResult.data || {};

  return {
    labId,
    score: engineResult.score ?? null,
    summary: engineResult.summary ?? null,
    issues: data.issues?.map((i: any) => typeof i === 'string' ? i : i.title || i.description) || [],
    recommendations: data.recommendations?.map((r: any) => typeof r === 'string' ? r : r.title || r.description) || [],
    runId,
  };
}

/**
 * Extract insights from engine result
 */
function extractInsightsFromEngine(
  labId: LabId,
  engineResult: any
): LabInsightUnit[] {
  const insights: LabInsightUnit[] = [];
  const data = engineResult.data || {};

  // Extract issues as insights
  const issues = data.issues || data.criticalIssues || [];
  for (const issue of issues.slice(0, 5)) {
    const title = typeof issue === 'string' ? issue : issue.title || issue.description;
    if (title) {
      insights.push({
        title: title.length > 100 ? title.substring(0, 97) + '...' : title,
        summary: typeof issue === 'object' ? issue.description || title : title,
        category: labId,
        severity: determineSeverity(issue),
        recommendation: typeof issue === 'object' ? issue.recommendation || issue.recommendedAction : undefined,
        sourceLabId: labId,
      });
    }
  }

  // Extract quick wins as insights
  const quickWins = data.quickWins || [];
  for (const qw of quickWins.slice(0, 3)) {
    const title = typeof qw === 'string' ? qw : qw.title || qw.description;
    if (title) {
      insights.push({
        title: `Quick Win: ${title.length > 80 ? title.substring(0, 77) + '...' : title}`,
        summary: typeof qw === 'object' ? qw.description || title : title,
        category: labId,
        severity: 'medium',
        recommendation: typeof qw === 'object' ? qw.action || qw.recommendation : undefined,
        sourceLabId: labId,
      });
    }
  }

  return insights;
}

function determineSeverity(issue: any): 'low' | 'medium' | 'high' | 'critical' {
  if (typeof issue === 'object') {
    if (issue.severity) return issue.severity;
    if (issue.priority === 'high' || issue.impact === 'high') return 'high';
    if (issue.priority === 'critical') return 'critical';
  }
  return 'medium';
}

// ============================================================================
// Context Merge
// ============================================================================

/**
 * Merge refined context from a Lab into the context graph
 */
function mergeRefinedContext(
  graph: CompanyContextGraph,
  refinedContext: LabRefinedContext[],
  sourceLabId: LabId
): CompanyContextGraph {
  const updated = structuredClone(graph);
  const now = new Date().toISOString();

  for (const item of refinedContext) {
    const domain = updated[item.domain as keyof CompanyContextGraph] as any;
    if (!domain) continue;

    // Create or update the field with provenance
    domain[item.field] = {
      value: item.value,
      provenance: [
        {
          source: `${sourceLabId}_lab`,
          updatedAt: now,
          confidence: item.confidence,
          notes: `Auto-populated by ${sourceLabId} lab during GAP orchestration`,
        },
        ...(domain[item.field]?.provenance || []),
      ],
    };
  }

  return updated;
}

// ============================================================================
// GAP Structured Output
// ============================================================================

/**
 * Build structured GAP output from Lab results
 */
function buildGAPStructuredOutput(
  health: ContextHealthAssessment,
  labOutputs: LabRefinementOutput[],
  gapIaRun: any
): GAPStructuredOutput {
  // Calculate scores from Lab outputs
  const brandLab = labOutputs.find((l) => l.labId === 'brand');
  const websiteLab = labOutputs.find((l) => l.labId === 'website');
  const seoLab = labOutputs.find((l) => l.labId === 'seo');
  const contentLab = labOutputs.find((l) => l.labId === 'content');

  const scores = {
    overall: health.completeness,
    brand: brandLab?.diagnostics.score ?? 0,
    content: contentLab?.diagnostics.score ?? 0,
    seo: seoLab?.diagnostics.score ?? 0,
    website: websiteLab?.diagnostics.score ?? 0,
    authority: 0, // Placeholder
    digitalFootprint: 0, // Placeholder
  };

  // Determine maturity stage from overall score
  const maturityStage =
    scores.overall >= 80
      ? 'Established'
      : scores.overall >= 60
        ? 'Scaling'
        : scores.overall >= 40
          ? 'Emerging'
          : 'Early Stage';

  // Build dimension diagnostics from Lab outputs
  const dimensionDiagnostics = labOutputs
    .filter((l) => l.success)
    .map((l) => ({
      dimension: l.labName,
      score: l.diagnostics.score ?? 0,
      summary: l.diagnostics.summary ?? '',
      strengths: [], // TODO: Extract from lab data
      gaps: l.diagnostics.issues.slice(0, 3),
      opportunities: l.diagnostics.recommendations.slice(0, 3),
    }));

  // Extract key findings from Lab insights
  const keyFindings = labOutputs
    .flatMap((l) => l.insights)
    .slice(0, 10)
    .map((insight) => ({
      type: insight.severity === 'critical' || insight.severity === 'high' ? 'gap' as const : 'opportunity' as const,
      title: insight.title,
      description: insight.summary,
      dimensions: [insight.category],
      severity: insight.severity,
    }));

  // Build recommended next steps from Lab recommendations
  const recommendedNextSteps = labOutputs
    .flatMap((l) =>
      l.diagnostics.recommendations.map((r, i) => ({
        title: r,
        description: r,
        priority: i + 1,
        effort: 'medium' as const,
        impact: 'medium' as const,
        dimension: l.labName,
      }))
    )
    .slice(0, 10);

  return {
    scores,
    maturityStage,
    dimensionDiagnostics,
    keyFindings,
    recommendedNextSteps,
    kpisToWatch: [], // TODO: Extract from context
  };
}

// ============================================================================
// Insights Extraction
// ============================================================================

/**
 * Extract normalized insights from Lab outputs
 */
function extractInsightsFromLabOutputs(
  labOutputs: LabRefinementOutput[],
  companyId: string
): ClientInsight[] {
  const insights: ClientInsight[] = [];

  for (const labOutput of labOutputs) {
    for (const unit of labOutput.insights) {
      // Map Lab category to InsightCategory
      const category = mapLabCategoryToInsightCategory(unit.category);

      insights.push({
        id: generateUUID(),
        companyId,
        title: unit.title,
        body: unit.summary,
        category,
        severity: unit.severity,
        status: 'open', // InsightStatus valid value
        source: {
          type: 'tool_run',
          toolSlug: unit.sourceLabId,
          toolRunId: labOutput.runId,
        },
        recommendation: unit.recommendation,
        rationale: unit.rationale,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return insights;
}

/**
 * Map Lab category string to valid InsightCategory
 */
function mapLabCategoryToInsightCategory(labCategory: string): InsightCategory {
  const mapping: Record<string, InsightCategory> = {
    brand: 'brand',
    website: 'website',
    seo: 'seo',
    content: 'content',
    audience: 'audience',
    creative: 'creative',
    media: 'media',
    demand: 'demand',
    ops: 'ops',
    ux: 'website',
  };
  return mapping[labCategory] || 'other';
}

// ============================================================================
// Helpers
// ============================================================================

function countFieldChanges(
  before: CompanyContextGraph,
  after: CompanyContextGraph
): number {
  // Simple count of fields that have different values
  const changes = 0;
  const beforeJson = JSON.stringify(before);
  const afterJson = JSON.stringify(after);

  // Quick heuristic: count provenance entries added
  const beforeProvCount = (beforeJson.match(/"provenance"/g) || []).length;
  const afterProvCount = (afterJson.match(/"provenance"/g) || []).length;

  return Math.max(0, afterProvCount - beforeProvCount);
}

function countNewFields(
  before: CompanyContextGraph,
  after: CompanyContextGraph
): number {
  // Count fields that exist in after but not in before
  // This is a simplified version
  return 0; // TODO: Implement proper field counting
}
