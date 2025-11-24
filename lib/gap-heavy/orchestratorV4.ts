// lib/gap-heavy/orchestratorV4.ts
// Heavy Worker V4 - Modular Diagnostic Pipeline Orchestrator

import type { CompanyRecord } from '@/lib/airtable/companies';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  createHeavyGapRun,
  updateHeavyGapRunState,
  getHeavyGapRunById,
} from '@/lib/airtable/gapHeavyRuns';
import type { HeavyGapRunState } from './state';
import { normalizeDomain } from './state';
import type {
  DiagnosticModuleKey,
  DiagnosticModuleResult,
  EvidencePack,
} from './types';
import { runSeoModule } from './modules/seo';
import { runDemandModule } from './modules/demand';
import { runContentModule } from './modules/content';
import { runWebsiteModule, runWebsiteLabV4 } from './modules/website';
import { runBrandModule as runBrandModuleImpl } from './brandModule';

// ============================================================================
// V4 Orchestrator Options
// ============================================================================

export interface HeavyWorkerV4Options {
  /** Airtable Company record ID */
  companyId: string;

  /** Website URL to analyze */
  websiteUrl: string;

  /** Optional GAP Plan Run ID to link */
  gapPlanRunId?: string;

  /** Which modules to run (defaults to all) */
  requestedModules?: DiagnosticModuleKey[];

  /** Optional existing Heavy Run ID to update (instead of creating new) */
  existingRunId?: string;

  /** Enable Website Lab V4/V5 (multi-page UX lab) instead of V3 (single-page) */
  enableWebsiteLabV4?: boolean;
}

export interface HeavyWorkerV4Result {
  /** Airtable record ID of the Heavy Run */
  runId: string;

  /** Final state after all modules completed */
  state: HeavyGapRunState;

  /** Evidence pack with all module results */
  evidencePack: EvidencePack;

  /** Which modules were requested */
  modulesRequested: DiagnosticModuleKey[];

  /** Which modules completed successfully */
  modulesCompleted: DiagnosticModuleKey[];

  /** Any errors encountered */
  errors?: string[];
}

// ============================================================================
// Main V4 Orchestrator
// ============================================================================

/**
 * Run Heavy Worker V4 - Modular Diagnostic Pipeline
 *
 * This is the V4 entry point that runs one or more diagnostic modules
 * in a modular, extensible way. Each module operates independently and
 * contributes to a shared EvidencePack.
 *
 * @param options - Configuration for the V4 run
 * @returns Result with runId, state, and evidence pack
 */
export async function runHeavyWorkerV4(
  options: HeavyWorkerV4Options
): Promise<HeavyWorkerV4Result> {
  console.log('[V4 Orchestrator] Starting Heavy Worker V4 run:', {
    companyId: options.companyId,
    websiteUrl: options.websiteUrl,
    requestedModules: options.requestedModules,
  });

  const errors: string[] = [];

  // ============================================================================
  // 1. Resolve Company Record
  // ============================================================================

  let company: CompanyRecord | null = null;
  try {
    company = await getCompanyById(options.companyId);
    if (!company) {
      throw new Error(`Company not found: ${options.companyId}`);
    }
    console.log('[V4 Orchestrator] Resolved company:', company.name);
  } catch (error) {
    const errorMsg = `Failed to resolve company: ${error instanceof Error ? error.message : String(error)}`;
    console.error('[V4 Orchestrator]', errorMsg);
    throw new Error(errorMsg);
  }

  // ============================================================================
  // 2. Determine Requested Modules
  // ============================================================================

  const ALL_MODULES: DiagnosticModuleKey[] = [
    'seo',
    'content',
    'website',
    'brand',
    'demand',
    'ops',
  ];

  const requestedModules = options.requestedModules || ALL_MODULES;
  console.log('[V4 Orchestrator] Requested modules:', requestedModules);

  // ============================================================================
  // 3. Create or Update Heavy Run Record
  // ============================================================================

  let state: HeavyGapRunState;

  if (options.existingRunId) {
    // Update existing run
    const existingState = await getHeavyGapRunById(options.existingRunId);
    if (!existingState) {
      throw new Error(`Heavy Run not found: ${options.existingRunId}`);
    }
    state = existingState;
    console.log('[V4 Orchestrator] Using existing Heavy Run:', state.id);
  } else {
    // Create new Heavy Run
    const domain = normalizeDomain(options.websiteUrl);
    state = await createHeavyGapRun({
      gapPlanRunId: options.gapPlanRunId || '',
      companyId: options.companyId,
      companyName: company.name,
      url: options.websiteUrl,
      domain,
    });
    console.log('[V4 Orchestrator] Created new Heavy Run:', state.id);
  }

  // ============================================================================
  // 4. Initialize V4 Fields
  // ============================================================================

  // Set worker version to V4
  state.workerVersion = 'heavy-v4.0.0';
  state.status = 'running';

  // Set requested modules
  state.modulesRequested = requestedModules;
  state.modulesCompleted = [];

  // Initialize EvidencePack with pending module results
  const moduleResults: DiagnosticModuleResult[] = requestedModules.map((module) => ({
    module,
    status: 'pending',
  }));

  state.evidencePack = {
    presence: {},
    demand: {},
    performance: {},
    modules: moduleResults,
  };

  // Save initial state
  state = await updateHeavyGapRunState(state);
  console.log('[V4 Orchestrator] Initialized V4 state with pending modules');

  // ============================================================================
  // 5. Run Each Requested Module
  // ============================================================================

  const completedModules: DiagnosticModuleKey[] = [];

  for (const moduleKey of requestedModules) {
    try {
      console.log(`[V4 Orchestrator] Running module: ${moduleKey}`);

      // Update module status to running
      const moduleIndex = state.evidencePack!.modules.findIndex(
        (m) => m.module === moduleKey
      );
      if (moduleIndex >= 0) {
        state.evidencePack!.modules[moduleIndex].status = 'running';
        state.evidencePack!.modules[moduleIndex].startedAt = new Date().toISOString();
      }

      // Run the module
      const moduleResult = await runModule(moduleKey, {
        company,
        websiteUrl: options.websiteUrl,
        existingEvidence: state.evidencePack!,
        enableWebsiteLabV4: options.enableWebsiteLabV4,
      });

      // Update module result in evidence pack
      if (moduleIndex >= 0) {
        state.evidencePack!.modules[moduleIndex] = moduleResult;
      }

      // Track completion
      completedModules.push(moduleKey);
      state.modulesCompleted = completedModules;

      console.log(`[V4 Orchestrator] Module ${moduleKey} completed:`, {
        status: moduleResult.status,
        score: moduleResult.score,
      });

      // Save state after each module
      state = await updateHeavyGapRunState(state);
    } catch (error) {
      const errorMsg = `Module ${moduleKey} failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error('[V4 Orchestrator]', errorMsg);
      errors.push(errorMsg);

      // Mark module as failed
      const moduleIndex = state.evidencePack!.modules.findIndex(
        (m) => m.module === moduleKey
      );
      if (moduleIndex >= 0) {
        state.evidencePack!.modules[moduleIndex].status = 'failed';
        state.evidencePack!.modules[moduleIndex].completedAt = new Date().toISOString();
        state.evidencePack!.modules[moduleIndex].summary = `Failed: ${errorMsg}`;
      }

      // Save state with failure
      state = await updateHeavyGapRunState(state);
    }
  }

  // ============================================================================
  // 6. Finalize Run
  // ============================================================================

  // Determine final status
  const allCompleted = requestedModules.every((module) =>
    completedModules.includes(module)
  );
  state.status = allCompleted ? 'completed' : errors.length > 0 ? 'error' : 'completed';

  // Update final timestamps
  state.updatedAt = new Date().toISOString();
  state.lastTickAt = state.updatedAt;

  // Save final state
  state = await updateHeavyGapRunState(state);

  console.log('[V4 Orchestrator] Heavy Worker V4 run completed:', {
    runId: state.id,
    status: state.status,
    modulesCompleted: completedModules.length,
    modulesRequested: requestedModules.length,
    errors: errors.length,
  });

  return {
    runId: state.id,
    state,
    evidencePack: state.evidencePack!,
    modulesRequested: requestedModules,
    modulesCompleted: completedModules,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================================
// Module Router
// ============================================================================

interface ModuleContext {
  company: CompanyRecord;
  websiteUrl: string;
  existingEvidence: EvidencePack;
  enableWebsiteLabV4?: boolean;
}

/**
 * Route to the appropriate module implementation
 */
async function runModule(
  moduleKey: DiagnosticModuleKey,
  context: ModuleContext
): Promise<DiagnosticModuleResult> {
  switch (moduleKey) {
    case 'seo':
      return await runSeoModuleImpl(context);
    case 'content':
      return await runContentModuleImpl(context);
    case 'website':
      return await runWebsiteModuleImpl(context, context.enableWebsiteLabV4 || false);
    case 'brand':
      return await runBrandModule(context);
    case 'demand':
      return await runDemandModuleImpl(context);
    case 'ops':
      return await runOpsModule(context);
    default:
      throw new Error(`Unknown module: ${moduleKey}`);
  }
}

// ============================================================================
// Stub Module Implementations
// ============================================================================

/**
 * SEO Module - REAL IMPLEMENTATION
 *
 * Analyzes SEO health: meta tags, canonicals, heading structure, internal linking, indexability
 */
async function runSeoModuleImpl(context: ModuleContext): Promise<DiagnosticModuleResult> {
  console.log('[SEO Module] Running real SEO analysis...');

  return await runSeoModule({
    company: context.company,
    websiteUrl: context.websiteUrl,
    evidence: context.existingEvidence,
  });
}

/**
 * Content Module - REAL IMPLEMENTATION
 *
 * Analyzes blog posts, resources, content depth, and freshness
 */
async function runContentModuleImpl(context: ModuleContext): Promise<DiagnosticModuleResult> {
  console.log('[Content Module] Running content analysis...');

  return await runContentModule({
    company: context.company,
    websiteUrl: context.websiteUrl,
    evidence: context.existingEvidence,
  });
}

/**
 * Website Module - REAL IMPLEMENTATION
 *
 * Analyzes website UX, conversion elements, CTAs, trust signals, and performance.
 * Can run either V3 (single-page) or V4/V5 (multi-page UX Lab) based on flag.
 */
async function runWebsiteModuleImpl(
  context: ModuleContext,
  enableV4: boolean
): Promise<DiagnosticModuleResult> {
  if (enableV4) {
    console.log('[Website Module] Running V4/V5 UX Lab (multi-page analysis)...');
    return await runWebsiteLabV4({
      company: context.company,
      websiteUrl: context.websiteUrl,
      evidence: context.existingEvidence,
    });
  } else {
    console.log('[Website Module] Running V3 analysis (single-page)...');
    return await runWebsiteModule({
      company: context.company,
      websiteUrl: context.websiteUrl,
      evidence: context.existingEvidence,
    });
  }
}

/**
 * Brand Module - REAL IMPLEMENTATION
 *
 * Analyzes brand presence, positioning, value proposition clarity, and differentiation
 */
async function runBrandModule(context: ModuleContext): Promise<DiagnosticModuleResult> {
  console.log('[Brand Module] Running brand & positioning analysis...');

  return await runBrandModuleImpl({
    company: context.company,
    websiteUrl: context.websiteUrl,
    evidence: context.existingEvidence,
  });
}

/**
 * Demand Module - REAL IMPLEMENTATION
 *
 * Analyzes GA4 traffic, engagement metrics, and conversion events
 * Gracefully skips if GA4 is not configured
 */
async function runDemandModuleImpl(context: ModuleContext): Promise<DiagnosticModuleResult> {
  console.log('[Demand Module] Running demand analysis...');

  return await runDemandModule({
    company: context.company,
    websiteUrl: context.websiteUrl,
    evidence: context.existingEvidence,
  });
}

/**
 * Ops Module - STUB
 *
 * Future: Analyze operational health, execution consistency, etc.
 */
async function runOpsModule(context: ModuleContext): Promise<DiagnosticModuleResult> {
  console.log('[Ops Module] Running (stub)...');

  return {
    module: 'ops',
    status: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    score: 0,
    summary: 'Ops module - stubbed, to be implemented.',
    issues: [],
    recommendations: [],
    rawEvidence: {
      stub: true,
      message: 'Ops analysis not yet implemented',
    },
  };
}
