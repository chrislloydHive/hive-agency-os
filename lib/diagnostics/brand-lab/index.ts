// lib/diagnostics/brand-lab/index.ts
// Brand Lab V2 Main Entry Point
//
// This is the main orchestrator that:
// 1. Runs the V1 engine to collect brand signals
// 2. Validates that the diagnostic is not a fallback/scaffold
// 3. Transforms V1 output into V2 dimension-based scoring
// 4. Generates narrative summary
// 5. Builds quick wins and projects
// 6. Returns the complete BrandLabResult (or error for failed diagnostics)

import type {
  BrandLabResult,
  BrandLabEngineResult,
  BrandLabValidatedResult,
  BrandLabQuickWin,
  BrandLabProject,
  BrandLabFindings,
  BrandMaturityStage,
} from './types';
import { buildBrandDimensionsFromV1, computeBrandDataConfidence } from './scoring';
import { generateBrandNarrative } from './narrative';
import { detectBrandLabFailure } from './validation';
import { runBrandLab as runBrandLabV1 } from '@/lib/gap-heavy/modules/brandLabImpl';
import type { CompanyRecord } from '@/lib/airtable/companies';

// Re-export types for convenience
export * from './types';
export { detectBrandLabFailure } from './validation';

// ============================================================================
// Main Run Function
// ============================================================================

export interface RunBrandLabParams {
  company: CompanyRecord;
  websiteUrl: string;
  companyId?: string;
  companyType?: string | null;
}

/**
 * Run Brand Lab V2 diagnostic with validation
 *
 * This is the RECOMMENDED entry point that:
 * 1. Runs V1 signal collection
 * 2. Validates the result is not a fallback/scaffold
 * 3. Returns status: 'ok' with result, or status: 'failed' with error
 *
 * Use this when you need to handle failure states explicitly.
 */
export async function runBrandLabWithValidation(params: RunBrandLabParams): Promise<BrandLabValidatedResult> {
  const { company, websiteUrl, companyId, companyType } = params;

  console.log('[Brand Lab V2] Starting analysis with validation:', { companyId: company.id, websiteUrl });

  try {
    // 1. Run V1 engine to collect brand signals
    const v1Result = await runBrandLabV1({
      company,
      websiteUrl,
      skipCompetitive: false,
    });

    // 2. Validate the diagnostic is not a fallback
    const validation = detectBrandLabFailure(v1Result);

    if (validation.failed) {
      console.warn('[Brand Lab V2] Diagnostic failed validation:', validation.reasons);

      return {
        status: 'failed',
        error: {
          reason: 'Brand Lab could not complete a reliable analysis.',
          details: validation.reasons,
        },
      };
    }

    // 3. Build full V2 result
    const result = await buildBrandLabResultFromV1(v1Result, params);

    console.log('[Brand Lab V2] Analysis complete:', {
      overallScore: result.overallScore,
      maturityStage: result.maturityStage,
    });

    return {
      status: 'ok',
      result,
    };
  } catch (error) {
    console.error('[Brand Lab V2] Unexpected error:', error);

    return {
      status: 'failed',
      error: {
        reason: 'Brand Lab encountered an unexpected error.',
        details: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}

/**
 * Run Brand Lab V2 diagnostic (legacy, no validation)
 *
 * WARNING: This function does NOT validate if the diagnostic is a fallback.
 * It will return scaffold/fake results if the LLM fails.
 *
 * Use runBrandLabWithValidation() instead for new code.
 */
export async function runBrandLab(params: RunBrandLabParams): Promise<BrandLabResult> {
  const { company, websiteUrl, companyId, companyType } = params;

  console.log('[Brand Lab V2] Starting analysis:', { companyId: company.id, websiteUrl });

  // 1. Run V1 engine to collect brand signals
  const v1Result = await runBrandLabV1({
    company,
    websiteUrl,
    skipCompetitive: false, // Include competitive layer
  });

  // 2. Build full V2 result (no validation)
  return buildBrandLabResultFromV1(v1Result, params);
}

/**
 * Build BrandLabResult from V1 result.
 * Exported for use in Inngest function where V1 is run separately.
 */
export async function buildBrandLabResultFromV1(
  v1Result: Awaited<ReturnType<typeof runBrandLabV1>>,
  params: RunBrandLabParams
): Promise<BrandLabResult> {
  const { company, websiteUrl, companyId, companyType } = params;

  const diagnostic = v1Result.diagnostic;
  const actionPlan = v1Result.actionPlan;

  console.log('[Brand Lab V2] V1 analysis complete:', {
    v1Score: diagnostic.score,
    benchmarkLabel: diagnostic.benchmarkLabel,
    hasCompetitive: 'competitiveLandscape' in diagnostic,
  });

  // 2. Compute data confidence
  const dataConfidence = computeBrandDataConfidence(diagnostic);

  // 3. Build dimensions from V1 structures
  const scoringResult = buildBrandDimensionsFromV1(diagnostic);
  const { dimensions, issues, overallScore, maturityStage } = scoringResult;

  console.log('[Brand Lab V2] Scoring complete:', {
    overallScore,
    maturityStage,
    issueCount: issues.length,
    dimensionCount: dimensions.length,
  });

  // 4. Generate narrative summary
  const narrativeSummary = generateBrandNarrative({
    dimensions,
    overallScore,
    maturityStage,
    benchmarkLabel: diagnostic.benchmarkLabel,
    summary: diagnostic.summary,
  });

  // 5. Build quick wins from action plan
  const quickWins = buildBrandQuickWins(actionPlan, diagnostic);

  // 6. Build projects from action plan
  const projects = buildBrandProjects(actionPlan, diagnostic, maturityStage);

  // 7. Carry forward rich findings (preserves V1 detail)
  const findings: BrandLabFindings = {
    diagnosticV1: v1Result,
    brandPillars: diagnostic.brandPillars,
    identitySystem: diagnostic.identitySystem,
    messagingSystem: diagnostic.messagingSystem,
    positioning: diagnostic.positioning,
    audienceFit: diagnostic.audienceFit,
    trustAndProof: diagnostic.trustAndProof,
    visualSystem: diagnostic.visualSystem,
    brandAssets: diagnostic.brandAssets,
    inconsistencies: diagnostic.inconsistencies,
    opportunities: diagnostic.opportunities,
    risks: diagnostic.risks,
    competitiveLandscape: 'competitiveLandscape' in diagnostic ? diagnostic.competitiveLandscape : undefined,
  };

  console.log('[Brand Lab V2] Complete:', {
    issues: issues.length,
    quickWins: quickWins.length,
    projects: projects.length,
  });

  return {
    overallScore,
    maturityStage,
    dataConfidence,
    narrativeSummary,
    dimensions,
    issues,
    quickWins,
    projects,
    findings,
    generatedAt: new Date().toISOString(),
    url: websiteUrl,
    companyId: companyId ?? company.id,
    companyType: companyType ?? null,
  };
}

/**
 * Run Brand Lab and wrap result in engine result format.
 * Uses validation to detect fallback/scaffold results.
 */
export async function runBrandLabEngine(params: RunBrandLabParams): Promise<BrandLabEngineResult> {
  try {
    // Use the validated version
    const validated = await runBrandLabWithValidation(params);

    if (validated.status === 'failed') {
      console.warn('[Brand Lab V2] Engine detected failed diagnostic:', validated.error);

      return {
        success: false,
        error: validated.error?.reason ?? 'Brand Lab could not complete a reliable analysis.',
      };
    }

    const report = validated.result!;

    return {
      success: true,
      score: report.overallScore,
      summary: report.narrativeSummary,
      report,
    };
  } catch (error) {
    console.error('[Brand Lab V2] Engine error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Quick Wins Builder
// ============================================================================

/**
 * Normalize quick win category to a consistent set
 */
function normalizeQuickWinCategory(rawDim?: string, rawArea?: string): string {
  const source = (rawDim || rawArea || '').toLowerCase();

  if (source.includes('position')) return 'positioning';
  if (source.includes('trust')) return 'trust';
  if (source.includes('identity')) return 'identity';
  if (source.includes('messaging')) return 'messaging';
  if (source.includes('visual')) return 'visual';
  if (source.includes('audience')) return 'audience';

  return 'brand';
}

/**
 * Build quick wins from action plan and diagnostic
 * Deduplicates by category+action and normalizes categories
 */
function buildBrandQuickWins(actionPlan: any, diagnostic: any): BrandLabQuickWin[] {
  const wins: BrandLabQuickWin[] = [];
  let idCounter = 0;
  const seen = new Set<string>();

  const add = (
    category: string,
    action: string,
    impact: 'low' | 'medium' | 'high',
    effort: 'low' | 'medium' | 'high'
  ) => {
    // Dedupe by category::action
    const key = `${category}::${action}`;
    if (seen.has(key)) return;
    seen.add(key);

    wins.push({
      id: `bq-${idCounter++}`,
      category,
      action,
      expectedImpact: impact,
      effortLevel: effort,
    });
  };

  // Extract quick wins from NOW items in action plan
  const nowItems = Array.isArray(actionPlan?.now) ? actionPlan.now : [];

  nowItems.forEach((item: any) => {
    const category = normalizeQuickWinCategory(item.dimension, item.serviceArea);
    const action = item.title ?? item.description ?? 'Brand improvement';
    const impact: 'low' | 'medium' | 'high' =
      item.impactScore >= 4 ? 'high' : item.impactScore >= 2 ? 'medium' : 'low';
    const effort: 'low' | 'medium' | 'high' =
      item.effortScore <= 2 ? 'low' : item.effortScore <= 3 ? 'medium' : 'high';

    add(category, action, impact, effort);
  });

  // Add from V1 opportunities if we need more
  const opportunities = Array.isArray(diagnostic?.opportunities) ? diagnostic.opportunities : [];
  opportunities
    .filter((opp: any) => opp.estimatedImpactScore >= 3)
    .forEach((opp: any) => {
      const category = normalizeQuickWinCategory(opp.theme, opp.area);
      const impact: 'low' | 'medium' | 'high' =
        opp.estimatedImpactScore >= 4 ? 'high' : opp.estimatedImpactScore >= 3 ? 'medium' : 'low';
      add(category, opp.title, impact, 'medium');
    });

  // Add based on diagnostic gaps if we still need more
  if (wins.length < 3) {
    // Identity quick win
    if (diagnostic.identitySystem?.identityGaps?.length > 0 || diagnostic.identitySystem?.corePromiseClarityScore < 60) {
      add('identity', 'Clarify your core brand promise and tagline.', 'high', 'medium');
    }

    // Trust quick win
    if (diagnostic.trustAndProof?.trustSignalsScore < 60) {
      add('trust', 'Add testimonials or case study excerpts to your homepage.', 'high', 'low');
    }

    // Messaging quick win
    if (diagnostic.messagingSystem?.messagingFocusScore < 60) {
      add('messaging', 'Rewrite your homepage headline to focus on benefits.', 'high', 'low');
    }
  }

  // Sort by impact and limit to 5
  return wins
    .sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.expectedImpact] - impactOrder[b.expectedImpact];
    })
    .slice(0, 5);
}

// ============================================================================
// Projects Builder
// ============================================================================

/**
 * Build strategic projects from action plan and diagnostic
 */
function buildBrandProjects(
  actionPlan: any,
  diagnostic: any,
  maturityStage: BrandMaturityStage
): BrandLabProject[] {
  const projects: BrandLabProject[] = [];
  let idCounter = 0;

  const add = (
    category: string,
    title: string,
    description: string,
    impact: 'low' | 'medium' | 'high',
    timeHorizon: 'near-term' | 'mid-term' | 'long-term'
  ) => {
    projects.push({
      id: `bp-${idCounter++}`,
      category,
      title,
      description,
      impact,
      timeHorizon,
    });
  };

  // Extract projects from action plan buckets
  const buckets = [
    { items: actionPlan?.now ?? [], horizon: 'near-term' as const },
    { items: actionPlan?.next ?? [], horizon: 'mid-term' as const },
    { items: actionPlan?.later ?? [], horizon: 'long-term' as const },
  ];

  buckets.forEach(({ items, horizon }) => {
    if (!Array.isArray(items)) return;
    items.slice(0, 2).forEach((item: any) => {
      const category = item.dimension ?? item.serviceArea ?? 'brand';
      const title = item.title ?? 'Brand improvement initiative';
      const description = item.description ?? item.rationale ?? '';
      const impact: 'low' | 'medium' | 'high' =
        item.impactScore >= 4 ? 'high' : item.impactScore >= 2 ? 'medium' : 'low';

      add(category, title, description, impact, horizon);
    });
  });

  // Add maturity-based strategic projects
  if (maturityStage === 'unproven') {
    add(
      'Foundation',
      'Establish brand foundation',
      'Define core brand elements: promise, positioning, visual identity, and key messages. This foundational work enables all future brand efforts.',
      'high',
      'near-term'
    );
  } else if (maturityStage === 'emerging') {
    add(
      'Clarity',
      'Strengthen brand clarity',
      'Refine positioning, sharpen messaging, and ensure consistent application across all touchpoints.',
      'high',
      'mid-term'
    );
  } else if (maturityStage === 'scaling') {
    add(
      'Differentiation',
      'Build brand differentiation',
      'Develop unique brand assets, thought leadership content, and distinctive positioning to stand out.',
      'high',
      'mid-term'
    );
  }

  // Add from strategic changes in action plan
  const strategicChanges = Array.isArray(actionPlan?.strategicChanges) ? actionPlan.strategicChanges : [];
  strategicChanges.slice(0, 2).forEach((change: any) => {
    add('Strategy', change.title, change.description ?? change.reasoning ?? '', 'high', 'mid-term');
  });

  // Add brand guidelines project if missing
  if (!diagnostic.brandAssets?.hasBrandGuidelines) {
    add(
      'Assets',
      'Create brand guidelines',
      'Document brand identity, voice, visual system, and usage rules for consistent brand application.',
      'medium',
      'mid-term'
    );
  }

  // Limit to top 5 projects
  return projects.slice(0, 5);
}
