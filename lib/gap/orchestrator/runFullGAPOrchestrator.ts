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
import { determineLabsNeededForMissingFields, getFieldsForLab } from './labPlan';

// Import diagnostic engines
import {
  runBrandLabEngine,
  runWebsiteLabEngine,
  runSeoLabEngine,
  runContentLabEngine,
  runDemandLabEngine,
  runOpsLabEngine,
  type EngineInput,
} from '@/lib/os/diagnostics/engines';

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

    const healthAfter = assessContextHealth(contextAfter);

    // ========================================================================
    // Step 5: Run GAP Core Engine (Structured Output)
    // ========================================================================
    console.log('[GAP Orchestrator] Step 5: Running GAP core engine...');

    const gapStructured = buildGAPStructuredOutput(
      healthAfter,
      labOutputs,
      input.gapIaRun
    );

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

    // TODO: Save snapshot to Airtable/storage

    // ========================================================================
    // Step 8: Return OS-Oriented Output
    // ========================================================================
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

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

  const input: EngineInput = {
    companyId,
    company,
    websiteUrl: company.website || '',
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
    default:
      throw new Error(`Unknown lab: ${labId}`);
  }

  if (!engineResult.success) {
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

  return {
    labId,
    labName,
    success: true,
    refinedContext,
    diagnostics,
    insights,
    runId,
    durationMs: Date.now() - startTime,
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
  let changes = 0;
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
