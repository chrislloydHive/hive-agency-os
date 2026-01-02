// lib/os/draft/engine.ts
// Draft Engine - Core orchestration for draft generation
//
// Handles:
// - Ensuring prerequisites (running Full GAP + Competition if needed)
// - Building SignalsBundle from various data sources
// - Dispatching to resource-specific generators

import { getCompanyById } from '@/lib/airtable/companies';
import {
  getBaselineSignalsForCompany,
  getCompetitionSummaryForCompany,
  inferCompanyCategoryAndHints,
} from '@/lib/os/context';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import { runFullGAPOrchestrator } from '@/lib/gap/orchestrator';
import { runCompetitionV3 } from '@/lib/competition-v3';
import { runCompetitionV4, shouldRunV4 } from '@/lib/competition-v4';
import type { CompetitionV4Result } from '@/lib/competition-v4';
import { parseCompetitors } from '@/lib/types/context';
import type { Competitor } from '@/lib/types/context';
import type { CompetitionV3Result } from '@/lib/competition-v3/orchestrator/runCompetitionAnalysis';
import type {
  DraftableResourceKind,
  SignalsBundle,
  EnsurePrereqsResult,
  DraftResult,
  DiagnosticsSummary,
  CompetitionSnapshot,
  CompetitionV4Snapshot,
} from './types';
import { arePrereqsReady } from './types';

// Import resource-specific generators
import { generateContextDraft } from './generators/context';

// ============================================================================
// Build Signals Bundle
// ============================================================================

/**
 * Options for buildSignalsBundle
 */
export interface BuildSignalsBundleOptions {
  /** Fresh Competition V3 result to use instead of fetching from Airtable */
  freshCompetitionResult?: CompetitionV3Result;
  /** Fresh Competition V4 result (if V4 enabled) */
  freshCompetitionV4Result?: CompetitionV4Result;
}

/**
 * Build a SignalsBundle from existing data (does not run diagnostics).
 * Used when we want to generate from what exists without running new diagnostics.
 *
 * @param companyId - Company ID to build signals for
 * @param options - Optional settings, including fresh competition result to avoid Airtable stale reads
 */
export async function buildSignalsBundle(
  companyId: string,
  options?: BuildSignalsBundleOptions
): Promise<SignalsBundle> {
  // Debug logging for V4 integration
  console.log('[signals] engine', process.env.COMPETITION_ENGINE);
  console.log('[buildSignalsBundle] Building for:', companyId, {
    hasFreshCompetition: !!options?.freshCompetitionResult,
    hasFreshCompetitionV4: !!options?.freshCompetitionV4Result,
    shouldRunV4: shouldRunV4(),
  });

  // Fetch company info
  const company = await getCompanyById(companyId);
  const companyName = company?.name ?? '';
  const companyDomain = company?.domain ?? company?.website ?? '';

  // Fetch baseline signals
  const baselineSignals = await getBaselineSignalsForCompany(companyId);

  // Infer category and hints from company name/domain
  const inferred = inferCompanyCategoryAndHints({
    companyName,
    domain: companyDomain,
    websiteTitle: baselineSignals.websiteTitle ?? '',
    websiteMetaDescription: baselineSignals.websiteMetaDescription ?? '',
  });

  // Build diagnostics summary (placeholder - could be enriched from findings)
  const diagnosticsSummary: DiagnosticsSummary = {
    website: '',
    seo: '',
    content: '',
    brand: '',
  };

  // Get competition data
  let competitionSnapshot: CompetitionSnapshot | null = null;
  let competitionV4Snapshot: CompetitionV4Snapshot | null = null;
  const competitionSummary = await getCompetitionSummaryForCompany(companyId);
  let competitors: Competitor[] = [];
  let competitorSource: 'v3' | 'v4' = 'v3';

  // Use fresh competition result if provided (avoids Airtable stale reads)
  // Otherwise fetch from Airtable if we have competition data
  const freshResult = options?.freshCompetitionResult;
  const freshV4Result = options?.freshCompetitionV4Result;

  // V4 PREFERENCE: If V4 is enabled AND has validated competitors, use V4
  const v4Checks = {
    shouldRunV4: shouldRunV4(),
    hasFreshV4: !!freshV4Result,
    v4Status: freshV4Result?.execution.status,
    v4ValidatedCount: freshV4Result?.competitors.validated.length ?? 0,
  };
  console.log('[buildSignalsBundle] V4 checks:', v4Checks);

  const useV4 = v4Checks.shouldRunV4 &&
    v4Checks.hasFreshV4 &&
    v4Checks.v4Status === 'completed' &&
    v4Checks.v4ValidatedCount > 0;

  console.log('[buildSignalsBundle] useV4 decision:', useV4);

  if (useV4 && freshV4Result) {
    // Use Competition V4 for competitors
    competitorSource = 'v4';
    console.log('[competition-v4] ran', companyId);

    competitionV4Snapshot = {
      runId: freshV4Result.runId,
      completedAt: freshV4Result.execution.completedAt ?? new Date().toISOString(),
      categoryName: freshV4Result.category.category_name,
      categoryDescription: freshV4Result.category.category_description,
      validatedCount: freshV4Result.competitors.validated.length,
      removedCount: freshV4Result.competitors.removed.length,
      competitorDomains: freshV4Result.competitors.validated.map(c => c.domain),
    };

    // Parse competitors from V4 validated list
    competitors = freshV4Result.competitors.validated
      .slice(0, 10)
      .map(c => {
        const conf = c.confidence ?? 0.5;
        return {
          domain: c.domain.toLowerCase(),
          name: c.name ?? undefined,
          offerOverlap: Math.round(conf * 100),
          jtbdMatch: c.type === 'Direct',
          geoRelevance: 50, // V4 doesn't have geo data yet
          type: c.type === 'Direct' ? 'direct' as const : c.type === 'Indirect' ? 'indirect' as const : 'adjacent' as const,
          confidence: Math.round(conf * 100),
          source: 'baseline' as const,
        };
      });

    console.log('[signals] competitionSource', 'v4', competitors.slice(0, 5).map(c => c.domain));
    console.log('[buildSignalsBundle] Using Competition V4 (Classification Tree):', {
      runId: freshV4Result.runId,
      category: freshV4Result.category.category_name,
      validatedCount: freshV4Result.competitors.validated.length,
      removedCount: freshV4Result.competitors.removed.length,
      topDomains: competitors.slice(0, 3).map(c => c.domain),
    });
  } else if (freshResult && freshResult.run.status === 'completed') {
    // Use fresh Competition V3 result directly
    competitorSource = 'v3';

    console.log('[signals] competitionSource', 'v3', freshResult.competitors.slice(0, 5).map(c => c.domain));
    console.log('[buildSignalsBundle] Using fresh Competition V3 result:', {
      runId: freshResult.run.id,
      competitorCount: freshResult.competitors.length,
      topDomains: freshResult.competitors.slice(0, 3).map(c => c.domain),
    });

    competitionSnapshot = {
      runId: freshResult.run.id,
      completedAt: freshResult.run.completedAt ?? new Date().toISOString(),
      competitorCount: freshResult.competitors.length,
      competitorDomains: freshResult.competitors.map(c => c.domain ?? '').filter(Boolean),
    };

    // Parse competitors from fresh result
    competitors = freshResult.competitors
      .filter(c => c.classification?.type === 'direct' || c.classification?.type === 'partial')
      .slice(0, 10)
      .map(c => ({
        domain: (c.domain ?? c.homepageUrl ?? '').toLowerCase(),
        name: c.name ?? undefined,
        offerOverlap: c.scores?.serviceOverlap ?? 50,
        jtbdMatch: (c.scores?.icpFit ?? 0) > 60,
        geoRelevance: c.scores?.geographyFit ?? 50,
        type: c.classification?.type === 'direct' ? 'direct' as const : 'indirect' as const,
        confidence: c.scores?.relevanceScore ?? 50,
        source: 'baseline' as const,
      }));
  } else if (baselineSignals.hasCompetition) {
    // Fallback: fetch from Airtable
    competitorSource = 'v3';
    console.log('[signals] competitionSource', 'v3', '(from Airtable)');

    try {
      const competitionRun = await getLatestCompetitionRunV3(companyId);
      if (competitionRun) {
        competitionSnapshot = {
          runId: competitionRun.runId,
          completedAt: competitionRun.completedAt ?? new Date().toISOString(),
          competitorCount: competitionRun.competitors?.length ?? 0,
          competitorDomains: competitionRun.competitors?.map(c => c.domain ?? '').filter(Boolean) ?? [],
        };

        // Parse competitors from the run for use in Context
        if (competitionRun.competitors) {
          competitors = competitionRun.competitors
            .filter(c => c.classification?.type === 'direct' || c.classification?.type === 'partial')
            .slice(0, 10)
            .map(c => ({
              domain: (c.domain ?? c.homepageUrl ?? '').toLowerCase(),
              name: c.name ?? undefined,
              offerOverlap: c.scores?.serviceOverlap ?? 50,
              jtbdMatch: (c.scores?.icpFit ?? 0) > 60,
              geoRelevance: c.scores?.geographyFit ?? 50,
              type: c.classification?.type === 'direct' ? 'direct' as const : 'indirect' as const,
              confidence: c.scores?.relevanceScore ?? 50,
              source: 'baseline' as const,
            }));
        }
      }
    } catch (error) {
      console.error('[buildSignalsBundle] Error fetching competition:', error);
    }
  }

  // Also store V4 snapshot even if we used V3 for competitors (for debugging)
  if (freshV4Result && !competitionV4Snapshot) {
    competitionV4Snapshot = {
      runId: freshV4Result.runId,
      completedAt: freshV4Result.execution.completedAt ?? new Date().toISOString(),
      categoryName: freshV4Result.category.category_name,
      categoryDescription: freshV4Result.category.category_description,
      validatedCount: freshV4Result.competitors.validated.length,
      removedCount: freshV4Result.competitors.removed.length,
      competitorDomains: freshV4Result.competitors.validated.map(c => c.domain),
    };
  }

  const bundle: SignalsBundle = {
    baselineSignals,
    diagnosticsSummary,
    inferredCategory: inferred.companyCategory ?? null,
    inferredIndustry: inferred.detectedIndustry ?? null,
    inferredAudienceHints: inferred.detectedAudienceHints,
    inferredBusinessModelHints: inferred.detectedBusinessModelHints,
    competitionSnapshot,
    competitionV4Snapshot,
    competitionSummary,
    competitors,
    competitorSource,
  };

  console.log('[buildSignalsBundle] Built bundle:', {
    prereqsReady: arePrereqsReady(bundle),
    hasCompetition: !!competitionSnapshot,
    hasCompetitionV4: !!competitionV4Snapshot,
    competitorSource,
    competitorCount: competitors.length,
  });

  return bundle;
}

// ============================================================================
// Ensure Prerequisites
// ============================================================================

/**
 * Options for ensurePrereqs
 */
export interface EnsurePrereqsOptions {
  /** If true, skip running diagnostics even if not ready */
  skipDiagnostics?: boolean;
  /** If true, force a fresh Competition V3 run even if results exist */
  forceCompetition?: boolean;
}

/**
 * Ensure that prerequisites for draft generation are ready.
 * Runs Full GAP + Competition V3 if they don't exist.
 *
 * @param companyId - Company to ensure prereqs for
 * @param options - Configuration options
 */
export async function ensurePrereqs(
  companyId: string,
  options: EnsurePrereqsOptions | boolean = false
): Promise<EnsurePrereqsResult> {
  console.log('=== [ensurePrereqs] CALLED ===');
  // Support legacy boolean signature
  const opts: EnsurePrereqsOptions = typeof options === 'boolean'
    ? { skipDiagnostics: options }
    : options;
  const { skipDiagnostics = false, forceCompetition = false } = opts;

  console.log('[ensurePrereqs] Options:', JSON.stringify({ skipDiagnostics, forceCompetition }));
  console.log('[ensurePrereqs] Checking prereqs for:', companyId, { skipDiagnostics, forceCompetition });
  const actions: string[] = [];

  // First, check what we already have
  let signals = await buildSignalsBundle(companyId);

  // If we're skipping diagnostics, return early with what exists
  if (skipDiagnostics) {
    console.log('[ensurePrereqs] Skipping diagnostics');
    return {
      ready: arePrereqsReady(signals),
      signals,
      actions,
    };
  }

  // If prereqs are already ready AND we're not forcing competition, return early
  if (arePrereqsReady(signals) && !forceCompetition) {
    console.log('[ensurePrereqs] Prereqs already ready (use forceCompetition=true to rerun)');
    return {
      ready: arePrereqsReady(signals),
      signals,
      actions,
    };
  }

  // Run Full GAP + Competition (V3 and optionally V4) in parallel
  console.log('[ensurePrereqs] Running diagnostics...', { shouldRunV4: shouldRunV4() });

  // Get company info for V4
  const company = await getCompanyById(companyId);

  const diagnosticPromises: Promise<unknown>[] = [
    // Full GAP Orchestrator
    (async () => {
      console.log('[ensurePrereqs] Running Full GAP...');
      try {
        const output = await runFullGAPOrchestrator({
          companyId,
          gapIaRun: {},
        });
        if (output.success) {
          actions.push('Ran Full GAP analysis');
        }
        return { type: 'gap', output };
      } catch (error) {
        console.error('[ensurePrereqs] Full GAP failed:', error);
        throw error;
      }
    })(),

    // Competition V3
    (async () => {
      console.log('[ensurePrereqs] Running Competition V3...');
      try {
        const output = await runCompetitionV3({ companyId });
        if (output.run.status === 'completed') {
          actions.push(`V3: ${output.competitors.length} competitors`);
        }
        return { type: 'v3', output };
      } catch (error) {
        console.error('[ensurePrereqs] Competition V3 failed:', error);
        throw error;
      }
    })(),
  ];

  // Add V4 if enabled
  if (shouldRunV4()) {
    diagnosticPromises.push(
      (async () => {
        console.log('[ensurePrereqs] Running Competition V4 (Classification Tree)...');
        try {
          const output = await runCompetitionV4({
            companyId,
            companyName: company?.name ?? undefined,
            domain: company?.domain ?? company?.website ?? undefined,
          });
          if (output.execution.status === 'completed') {
            actions.push(`V4: ${output.competitors.validated.length} validated (${output.category.category_name})`);
          }
          return { type: 'v4', output };
        } catch (error) {
          console.error('[ensurePrereqs] Competition V4 failed:', error);
          throw error;
        }
      })()
    );
  }

  const results = await Promise.allSettled(diagnosticPromises);

  // Extract results by type
  let freshCompetitionResult: CompetitionV3Result | undefined;
  let freshCompetitionV4Result: CompetitionV4Result | undefined;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { type, output } = result.value as { type: string; output: unknown };
      if (type === 'v3') {
        freshCompetitionResult = output as CompetitionV3Result;
        console.log('[ensurePrereqs] Fresh V3 competition result available:', {
          runId: freshCompetitionResult.run.id,
          competitorCount: freshCompetitionResult.competitors.length,
          topDomains: freshCompetitionResult.competitors.slice(0, 3).map(c => c.domain),
        });
      } else if (type === 'v4') {
        freshCompetitionV4Result = output as CompetitionV4Result;
        console.log('[ensurePrereqs] Fresh V4 competition result available:', {
          runId: freshCompetitionV4Result.runId,
          category: freshCompetitionV4Result.category.category_name,
          validatedCount: freshCompetitionV4Result.competitors.validated.length,
          removedCount: freshCompetitionV4Result.competitors.removed.length,
        });
        // Log validated competitors for debugging
        console.log('[ensurePrereqs] competitionV4 validated',
          freshCompetitionV4Result.competitors.validated.length,
          freshCompetitionV4Result.competitors.validated.slice(0, 10).map(c => c.domain)
        );
      }
    }
  }

  console.log('[ensurePrereqs] Diagnostics complete:', {
    hasV3: !!freshCompetitionResult,
    hasV4: !!freshCompetitionV4Result,
  });

  // Rebuild signals bundle with fresh competition data (avoids Airtable stale reads)
  signals = await buildSignalsBundle(companyId, { freshCompetitionResult, freshCompetitionV4Result });

  return {
    ready: arePrereqsReady(signals),
    signals,
    actions,
  };
}

// ============================================================================
// Generate Draft for Resource
// ============================================================================

/**
 * Generate a draft for a specific resource kind.
 * Dispatches to resource-specific generators.
 *
 * @param kind - The resource type to generate
 * @param companyId - Company to generate for
 * @param signals - SignalsBundle with all necessary data
 */
export async function generateDraftForResource<T>(
  kind: DraftableResourceKind,
  companyId: string,
  signals: SignalsBundle
): Promise<DraftResult<T>> {
  console.log('[generateDraftForResource] Generating:', kind, 'for:', companyId);

  switch (kind) {
    case 'context':
      return generateContextDraft(companyId, signals) as Promise<DraftResult<T>>;

    case 'strategy':
      // TODO: Implement when Strategy resource is ready
      return {
        success: false,
        draft: null,
        summary: 'Strategy draft generation not yet implemented',
        error: 'NOT_IMPLEMENTED',
      };

    case 'creative_strategy':
      // TODO: Implement when Creative Strategy resource is ready
      return {
        success: false,
        draft: null,
        summary: 'Creative Strategy draft generation not yet implemented',
        error: 'NOT_IMPLEMENTED',
      };

    case 'work_plan':
      // TODO: Implement when Work Plan resource is ready
      return {
        success: false,
        draft: null,
        summary: 'Work Plan draft generation not yet implemented',
        error: 'NOT_IMPLEMENTED',
      };

    default:
      return {
        success: false,
        draft: null,
        summary: `Unknown resource kind: ${kind}`,
        error: 'UNKNOWN_KIND',
      };
  }
}
