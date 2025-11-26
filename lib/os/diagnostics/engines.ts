// lib/os/diagnostics/engines.ts
// Engine wrappers for diagnostic tools
//
// This module provides a unified interface for running diagnostic engines.
// Each function wraps the underlying engine implementation and returns
// consistent results that can be stored in DiagnosticRuns.
//
// GAP engines support a modelCaller parameter to allow memory-aware AI calls
// via aiForCompany() when called from API routes.

import { getCompanyById, type CompanyRecord } from '@/lib/airtable/companies';
import { runBrandLab } from '@/lib/gap-heavy/modules/brandLabImpl';
import { runWebsiteLabV4 } from '@/lib/gap-heavy/modules/website';
import { runHeavyWorkerV4 } from '@/lib/gap-heavy/orchestratorV4';
import { runInitialAssessment, runFullGap, type GapModelCaller } from '@/lib/gap/core';
import type { DiagnosticToolId } from './runs';

// ============================================================================
// Types
// ============================================================================

export interface EngineResult {
  success: boolean;
  score?: number;
  summary?: string;
  data?: unknown;
  error?: string;
}

export interface EngineInput {
  companyId: string;
  company: CompanyRecord;
  websiteUrl: string;
}

/**
 * Extended input for GAP engines with optional model caller.
 * When modelCaller is provided, GAP engines will use it for AI calls,
 * enabling memory injection via aiForCompany().
 */
export interface GapEngineInput extends EngineInput {
  /**
   * Optional model caller for AI operations.
   * If provided, GAP engines will use this instead of direct OpenAI calls.
   * Use aiForCompany() to create a memory-aware model caller.
   */
  modelCaller?: GapModelCaller;
}

// ============================================================================
// GAP Snapshot Engine (GAP-IA)
// ============================================================================

/**
 * Run GAP Snapshot (Initial Assessment)
 * Quick assessment of marketing presence and maturity
 *
 * @param input.modelCaller - Optional model caller for memory-aware AI calls via aiForCompany()
 */
export async function runGapSnapshotEngine(input: GapEngineInput): Promise<EngineResult> {
  console.log('[GAP Snapshot Engine] Starting for:', input.websiteUrl);
  console.log('[GAP Snapshot Engine] Using modelCaller:', input.modelCaller ? 'custom (aiForCompany)' : 'default (direct OpenAI)');

  try {
    const result = await runInitialAssessment({
      url: input.websiteUrl,
      modelCaller: input.modelCaller,
    });

    // Extract score and summary from initialAssessment
    // The result has structure: { initialAssessment, businessContext, metadata }
    const ia = result.initialAssessment as any;
    const overallScore = ia?.scores?.overall ?? ia?.overallScore ?? ia?.score;
    const maturityStage = ia?.maturityStage;
    const summary = maturityStage
      ? `${maturityStage} maturity stage - Score: ${overallScore}/100`
      : `Overall Score: ${overallScore}/100`;

    console.log('[GAP Snapshot Engine] ✓ Complete:', { score: overallScore });

    return {
      success: true,
      score: typeof overallScore === 'number' ? overallScore : undefined,
      summary,
      data: result,
    };
  } catch (error) {
    console.error('[GAP Snapshot Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// GAP Plan Engine (Full GAP)
// ============================================================================

/**
 * Run Full GAP Plan generation
 * Comprehensive growth acceleration plan with roadmap
 *
 * This runs Initial Assessment first, then uses it for Full GAP Plan
 *
 * @param input.modelCaller - Optional model caller for memory-aware AI calls via aiForCompany()
 */
export async function runGapPlanEngine(input: GapEngineInput): Promise<EngineResult> {
  console.log('[GAP Plan Engine] Starting for:', input.websiteUrl);
  console.log('[GAP Plan Engine] Using modelCaller:', input.modelCaller ? 'custom (aiForCompany)' : 'default (direct OpenAI)');

  try {
    // First, run initial assessment to get the base analysis
    console.log('[GAP Plan Engine] Running initial assessment...');
    const iaResult = await runInitialAssessment({
      url: input.websiteUrl,
      modelCaller: input.modelCaller,
    });

    // Then run full GAP with the initial assessment
    console.log('[GAP Plan Engine] Generating full GAP plan...');
    const result = await runFullGap({
      url: input.websiteUrl,
      initialAssessment: iaResult.initialAssessment,
      modelCaller: input.modelCaller,
    });

    // Extract score and summary from fullGap
    const fg = result.fullGap as any;
    const overallScore = fg?.scorecard?.overall ?? fg?.executiveSummary?.overallScore;
    const summary = fg?.executiveSummary?.narrative
      ?? fg?.executiveSummary?.companyOverview
      ?? `Growth Plan generated - Score: ${overallScore}/100`;

    console.log('[GAP Plan Engine] ✓ Complete:', { score: overallScore });

    return {
      success: true,
      score: typeof overallScore === 'number' ? overallScore : undefined,
      summary: typeof summary === 'string' ? summary.substring(0, 500) : undefined,
      data: { ...result, initialAssessment: iaResult },
    };
  } catch (error) {
    console.error('[GAP Plan Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Website Lab Engine
// ============================================================================

/**
 * Run Website Lab V4 diagnostic
 * Multi-page UX & conversion analysis
 */
export async function runWebsiteLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[Website Lab Engine] Starting for:', input.websiteUrl);

  try {
    // Create an empty evidence pack for standalone runs
    const emptyEvidencePack = {
      runId: `standalone-${Date.now()}`,
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      createdAt: new Date().toISOString(),
      status: 'running' as const,
      modules: [],
    };

    const result = await runWebsiteLabV4({
      company: input.company,
      websiteUrl: input.websiteUrl,
      evidence: emptyEvidencePack,
    });

    // Extract score and summary from DiagnosticModuleResult
    const score = result.score;
    const summary = result.summary ?? `Website diagnostic complete - Score: ${score}/100`;

    console.log('[Website Lab Engine] ✓ Complete:', { score });

    return {
      success: true,
      score,
      summary: typeof summary === 'string' ? summary.substring(0, 500) : undefined,
      data: result,
    };
  } catch (error) {
    console.error('[Website Lab Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Brand Lab Engine
// ============================================================================

/**
 * Run Brand Lab diagnostic
 * Brand health, clarity, and positioning analysis
 */
export async function runBrandLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[Brand Lab Engine] Starting for:', input.websiteUrl);

  try {
    const result = await runBrandLab({
      company: input.company,
      websiteUrl: input.websiteUrl,
    });

    // Extract score and summary
    const score = result.diagnostic.score;
    const summary = result.actionPlan?.summary
      || `Brand health score: ${score}/100 (${result.diagnostic.benchmarkLabel})`;

    console.log('[Brand Lab Engine] ✓ Complete:', { score });

    return {
      success: true,
      score,
      summary,
      data: result,
    };
  } catch (error) {
    console.error('[Brand Lab Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Content Lab Engine (Stub)
// ============================================================================

/**
 * Run Content Lab diagnostic
 * Content inventory and quality assessment
 *
 * TODO: Implement full content diagnostic using existing content module
 */
export async function runContentLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[Content Lab Engine] Starting for:', input.websiteUrl);

  try {
    // For now, run the Heavy Worker V4 with just the content module
    const result = await runHeavyWorkerV4({
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      requestedModules: ['content'],
    });

    // Find content module result
    const contentModule = result.evidencePack.modules?.find(m => m.module === 'content');
    const score = contentModule?.score;
    const summary = contentModule?.summary || `Content diagnostic complete`;

    console.log('[Content Lab Engine] ✓ Complete:', { score });

    return {
      success: true,
      score,
      summary,
      data: {
        moduleResult: contentModule,
        heavyRunId: result.runId,
      },
    };
  } catch (error) {
    console.error('[Content Lab Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// SEO Lab Engine
// ============================================================================

/**
 * Run SEO Lab diagnostic
 * Technical SEO, meta tags, and search visibility analysis
 */
export async function runSeoLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[SEO Lab Engine] Starting for:', input.websiteUrl);

  try {
    // Run the Heavy Worker V4 with just the SEO module
    const result = await runHeavyWorkerV4({
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      requestedModules: ['seo'],
    });

    // Find SEO module result
    const seoModule = result.evidencePack.modules?.find(m => m.module === 'seo');
    const score = seoModule?.score;
    const summary = seoModule?.summary || `SEO diagnostic complete`;

    console.log('[SEO Lab Engine] ✓ Complete:', { score });

    return {
      success: true,
      score,
      summary,
      data: {
        moduleResult: seoModule,
        heavyRunId: result.runId,
      },
    };
  } catch (error) {
    console.error('[SEO Lab Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Demand Lab Engine
// ============================================================================

/**
 * Run Demand Lab diagnostic
 * Demand generation, funnel, and campaign analysis
 */
export async function runDemandLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[Demand Lab Engine] Starting for:', input.websiteUrl);

  try {
    // Run the Heavy Worker V4 with just the demand module
    const result = await runHeavyWorkerV4({
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      requestedModules: ['demand'],
    });

    // Find demand module result
    const demandModule = result.evidencePack.modules?.find(m => m.module === 'demand');
    const score = demandModule?.score;
    const summary = demandModule?.summary || `Demand diagnostic complete`;

    console.log('[Demand Lab Engine] ✓ Complete:', { score });

    return {
      success: true,
      score,
      summary,
      data: {
        moduleResult: demandModule,
        heavyRunId: result.runId,
      },
    };
  } catch (error) {
    console.error('[Demand Lab Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Ops Lab Engine
// ============================================================================

/**
 * Run Ops Lab diagnostic
 * Marketing operations and process assessment
 */
export async function runOpsLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[Ops Lab Engine] Starting for:', input.websiteUrl);

  try {
    // Run the Heavy Worker V4 with just the ops module
    const result = await runHeavyWorkerV4({
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      requestedModules: ['ops'],
    });

    // Find ops module result
    const opsModule = result.evidencePack.modules?.find(m => m.module === 'ops');
    const score = opsModule?.score;
    const summary = opsModule?.summary || `Ops diagnostic complete`;

    console.log('[Ops Lab Engine] ✓ Complete:', { score });

    return {
      success: true,
      score,
      summary,
      data: {
        moduleResult: opsModule,
        heavyRunId: result.runId,
      },
    };
  } catch (error) {
    console.error('[Ops Lab Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Engine Router
// ============================================================================

/**
 * Run a diagnostic engine by tool ID
 */
export async function runDiagnosticEngine(
  toolId: DiagnosticToolId,
  companyId: string
): Promise<EngineResult> {
  // Get company data
  const company = await getCompanyById(companyId);
  if (!company) {
    return { success: false, error: 'Company not found' };
  }

  if (!company.website) {
    return { success: false, error: 'Company has no website URL' };
  }

  const input: EngineInput = {
    companyId,
    company,
    websiteUrl: company.website,
  };

  // Route to appropriate engine
  switch (toolId) {
    case 'gapSnapshot':
      return runGapSnapshotEngine(input);
    case 'gapPlan':
      return runGapPlanEngine(input);
    case 'websiteLab':
      return runWebsiteLabEngine(input);
    case 'brandLab':
      return runBrandLabEngine(input);
    case 'contentLab':
      return runContentLabEngine(input);
    case 'seoLab':
      return runSeoLabEngine(input);
    case 'demandLab':
      return runDemandLabEngine(input);
    case 'opsLab':
      return runOpsLabEngine(input);
    default:
      return { success: false, error: `Unknown tool: ${toolId}` };
  }
}
