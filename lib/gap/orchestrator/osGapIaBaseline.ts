// lib/gap/orchestrator/osGapIaBaseline.ts
// OS-only GAP-IA wrapper for baseline context building
//
// This module provides a lightweight GAP-IA run specifically for the OS baseline
// context builder. It is completely isolated from the lead magnet GAP pipeline.
//
// Usage:
// - Called during baseline context build AFTER FCB and Labs
// - Fills SEO, Content, DigitalInfra, and Ops sections
// - Does NOT affect lead magnet GAP behavior
//
// ============================================================================
// DATA FLOW: baseline_context_build runs
// ============================================================================
//
// 1. runBaselineContextBuild() [lib/contextGraph/baseline.ts]
//    ↓ calls runGapIaForOsBaseline(companyId)
//
// 2. runGapIaForOsBaseline() [this file]
//    a) Fetch HTML: fetchHtmlBounded(url, 150000) - 150KB to capture footer links
//    b) Extract signals: extractHtmlSignals(html)
//    c) Parallel detection:
//       - collectDigitalFootprintSafe(domain, html)
//       - detectSocialAndGbpSafe(html) → SocialFootprintSnapshot
//       - discoverMultiPageContentSafe(url, html)
//    d) Core analysis: generateGapIaAnalysisCore(coreInput)
//       - coreInput includes socialFootprint for gating
//       - Calls mapInitialAssessmentToApiResponse() with socialFootprint
//       - mapDimensionSummariesToLegacy() computes subscores from detection
//       - sanitizeDigitalFootprintNarrative() rewrites contradictory text
//    e) Return OsGapIaBaselineResult with dimensions, quickWins, etc.
//
// 3. Back in baseline.ts:
//    a) writeGapIaBaselineToContext() - writes to Context Graph
//    b) logGapPlanRunToAirtable() - logs to GAP-Plan Run table
//       - Sets source: 'baseline_context_build'
//       - rawPlan includes dimensions with gated subscores/narratives
//
// Key insight: HTML truncation affects detection. We fetch 150KB (not 50KB)
// because social links and GBP references are commonly in the footer.
// Example: Atlas Skateboarding's footer starts at ~108KB.
//

import { getCompanyById } from '@/lib/airtable/companies';
import {
  createGapIaRun,
  updateGapIaRun,
} from '@/lib/airtable/gapIaRuns';
import {
  generateGapIaAnalysisCore,
  fetchHtmlBounded,
  extractHtmlSignals,
  discoverMultiPageContent,
  type GapIaCoreInput,
} from '@/lib/gap/core';
import {
  collectDigitalFootprint,
  type DigitalFootprint,
} from '@/lib/digital-footprint/collectDigitalFootprint';
import {
  detectSocialAndGbp,
  type SocialFootprintSnapshot,
} from '@/lib/gap/socialDetection';
import type {
  DimensionSummary,
  DigitalFootprintDimension,
  AuthorityDimension,
  GapFullAssessmentV1,
  BaselineGapSummary,
} from '@/lib/gap/types';
import {
  mapBaselineCoreToFullAssessment,
  projectToBaselineSummary,
} from '@/lib/gap/canonicalMapper';

// ============================================================================
// Types
// ============================================================================

/**
 * Result from OS baseline GAP-IA run
 */
export interface OsGapIaBaselineResult {
  success: boolean;
  /** Overall marketing readiness score (0-100) */
  overallScore: number;
  /** Maturity stage label */
  maturityStage: string;
  /** Dimension scores and insights */
  dimensions: {
    brand: DimensionSummary | null;
    content: DimensionSummary | null;
    seo: DimensionSummary | null;
    website: DimensionSummary | null;
    digitalFootprint: DigitalFootprintDimension | null;
    authority: AuthorityDimension | null;
  };
  /** Digital footprint raw data (legacy) */
  digitalFootprintData: DigitalFootprint | null;
  /** V5 Social footprint detection (GBP, social networks) */
  socialFootprint: SocialFootprintSnapshot | null;
  /** Quick wins extracted */
  quickWins: string[];
  /** Top opportunities */
  topOpportunities: string[];
  /** Error message if failed */
  error?: string;
  /** Processing time in ms */
  durationMs: number;

  // ============================================================================
  // Canonical Assessment (V1)
  // ============================================================================

  /**
   * Canonical GAP assessment in unified format
   *
   * This is the primary output - all other fields above are for backward
   * compatibility. New consumers should use this field.
   */
  canonicalAssessment?: GapFullAssessmentV1;

  /**
   * Lean projection of the canonical assessment
   *
   * A subset of canonicalAssessment for UI components that don't need
   * full GAP plan sections (which aren't populated for baseline anyway).
   */
  baselineSummary?: BaselineGapSummary;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Run GAP-IA for OS baseline context building
 *
 * This is an internal-only function that:
 * 1. Fetches the company's website HTML
 * 2. Runs the GAP-IA analysis engine
 * 3. Returns structured dimension outputs for context graph mapping
 *
 * IMPORTANT: This does NOT use the lead magnet endpoint.
 * It calls the internal GAP-IA core engine directly.
 *
 * @param companyId - The company ID to analyze
 * @returns Structured GAP-IA results for context graph mapping
 */
export async function runGapIaForOsBaseline(
  companyId: string
): Promise<OsGapIaBaselineResult> {
  const startTime = Date.now();

  console.log('[OS GAP-IA Baseline] Starting for company:', companyId);

  let gapIaRunId: string | null = null;

  try {
    // 1. Load company to get domain
    const company = await getCompanyById(companyId);
    if (!company) {
      return createErrorResult('Company not found', startTime);
    }

    const domain = company.domain;
    if (!domain || domain === 'unknown.com') {
      return createErrorResult('No domain available for GAP-IA', startTime);
    }

    const url = `https://${domain}`;
    console.log('[OS GAP-IA Baseline] Analyzing URL:', url);

    // 1.5. Create a GAP IA Run record in Airtable (so it shows in Diagnostics)
    try {
      const gapIaRun = await createGapIaRun({
        url,
        domain,
        source: 'os_baseline',
        companyId,
      });
      gapIaRunId = gapIaRun.id;
      console.log('[OS GAP-IA Baseline] Created GAP IA Run record:', gapIaRunId);
    } catch (e) {
      // Non-fatal - continue with analysis even if we can't create the record
      console.warn('[OS GAP-IA Baseline] Failed to create GAP IA Run record:', e);
    }

    // 2. Fetch website HTML
    // NOTE: We fetch 150KB (not 50KB) because social links and GBP are typically
    // in the footer, which can be beyond 100KB on modern sites. The LLM prompt
    // only uses a 10KB sample (see core.ts), so this doesn't affect LLM costs.
    // Example: Atlas Skateboarding's footer with Instagram/YouTube/GBP links
    // starts at byte ~108KB, which was being missed with the 50KB limit.
    let html: string;
    try {
      html = await fetchHtmlBounded(url, 150000);
    } catch (e) {
      console.warn('[OS GAP-IA Baseline] Failed to fetch HTML:', e);
      return createErrorResult(
        `Could not fetch website: ${e instanceof Error ? e.message : 'Unknown error'}`,
        startTime
      );
    }

    // Log HTML size for debugging truncation issues
    console.log('[OS GAP-IA Baseline] HTML fetched:', {
      domain,
      htmlLength: html.length,
      htmlLimitUsed: 150000,
      footerReached: html.length >= 100000, // True if we likely got the footer
    });

    // 3. Extract website signals
    const signals = extractHtmlSignals(html);

    // 4. Collect digital footprint, social footprint, and multi-page content (parallel)
    const [digitalFootprint, socialFootprint, multiPageSnapshot] = await Promise.all([
      collectDigitalFootprintSafe(domain, html),
      detectSocialAndGbpSafe(html, url),
      discoverMultiPageContentSafe(url, html),
    ]);

    console.log('[OS GAP-IA Baseline] Social detection result:', {
      gbpStatus: socialFootprint?.gbp?.status,
      gbpConfidence: socialFootprint?.gbp?.confidence,
      activeSocials: socialFootprint?.socials?.filter(s => s.status === 'present' || s.status === 'probable').map(s => s.network),
      dataConfidence: socialFootprint?.dataConfidence,
    });

    // 5. Run GAP-IA core engine
    // NOTE: socialFootprint is passed to enable gating of subscores and narratives
    const coreInput: GapIaCoreInput = {
      url,
      domain,
      html,
      signals,
      digitalFootprint,
      multiPageSnapshot,
      socialFootprint: socialFootprint ?? undefined,
      // No modelCaller specified - will use default OpenAI
    };

    const gapIaResult = await generateGapIaAnalysisCore(coreInput);

    // 6. Extract structured outputs from the V2 API response format
    const legacyDimensions = {
      brand: extractDimensionSummary(gapIaResult, 'brand'),
      content: extractDimensionSummary(gapIaResult, 'content'),
      seo: extractDimensionSummary(gapIaResult, 'seo'),
      website: extractDimensionSummary(gapIaResult, 'website'),
      digitalFootprint: extractDigitalFootprintDimension(gapIaResult),
      authority: extractAuthorityDimension(gapIaResult),
    };

    const legacyQuickWins = extractQuickWins(gapIaResult);
    const legacyTopOpportunities = gapIaResult.summary?.topOpportunities || [];

    // 7. Build canonical assessment using unified mapper
    // This applies social footprint gating consistently
    const canonicalAssessment = mapBaselineCoreToFullAssessment({
      coreResult: gapIaResult,
      metadata: {
        runId: gapIaRunId || `baseline-${Date.now()}`,
        url,
        domain,
        companyName: company.name || domain,
        companyId,
        source: 'baseline_context_build',
      },
      detectionData: {
        socialFootprint: socialFootprint ?? undefined,
        digitalFootprint: digitalFootprint ?? undefined,
        dataConfidence: undefined, // TODO: Compute data confidence
      },
      businessContext: {
        businessType: gapIaResult.core?.companyType,
        brandTier: gapIaResult.core?.brandTier,
      },
    });

    // Create lean projection for UI components
    const baselineSummary = projectToBaselineSummary(canonicalAssessment);

    const result: OsGapIaBaselineResult = {
      success: true,
      // Legacy fields (backward compatibility)
      overallScore: gapIaResult.summary?.overallScore || gapIaResult.core?.overallScore || 0,
      maturityStage: gapIaResult.core?.marketingMaturity || 'Unknown',
      dimensions: legacyDimensions,
      digitalFootprintData: digitalFootprint,
      socialFootprint,
      quickWins: legacyQuickWins,
      topOpportunities: legacyTopOpportunities,
      durationMs: Date.now() - startTime,
      // Canonical assessment (new unified format)
      canonicalAssessment,
      baselineSummary,
    };

    console.log('[OS GAP-IA Baseline] Complete:', {
      overallScore: result.overallScore,
      maturityStage: result.maturityStage,
      dimensionsFound: Object.values(result.dimensions).filter(Boolean).length,
      durationMs: result.durationMs,
    });

    // Log final digitalFootprint subscores for debugging gating issues
    if (result.dimensions.digitalFootprint) {
      console.log('[OS GAP-IA Baseline] DigitalFootprint final output:', {
        score: result.dimensions.digitalFootprint.score,
        subscores: result.dimensions.digitalFootprint.subscores,
        oneLinerPreview: result.dimensions.digitalFootprint.oneLiner?.substring(0, 80),
        socialFootprintProvided: !!socialFootprint,
      });
    }

    // Update the GAP IA Run record with completed status and results
    if (gapIaRunId) {
      try {
        await updateGapIaRun(gapIaRunId, {
          status: 'completed',
          core: {
            url,
            domain,
            brand: {},
            content: {},
            seo: {},
            website: {},
            quickSummary: result.topOpportunities.slice(0, 3).join(' '),
            topOpportunities: result.topOpportunities,
            overallScore: result.overallScore,
            marketingMaturity: result.maturityStage,
          },
        } as any);
        console.log('[OS GAP-IA Baseline] Updated GAP IA Run record as completed:', gapIaRunId);
      } catch (e) {
        console.warn('[OS GAP-IA Baseline] Failed to update GAP IA Run record:', e);
      }
    }

    return result;

  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    console.error('[OS GAP-IA Baseline] Error:', error);

    // Update the GAP IA Run record with failed status
    if (gapIaRunId) {
      try {
        await updateGapIaRun(gapIaRunId, {
          status: 'failed',
          errorMessage: error,
        });
        console.log('[OS GAP-IA Baseline] Updated GAP IA Run record as failed:', gapIaRunId);
      } catch (updateError) {
        console.warn('[OS GAP-IA Baseline] Failed to update GAP IA Run record:', updateError);
      }
    }

    return createErrorResult(error, startTime);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an error result
 */
function createErrorResult(error: string, startTime: number): OsGapIaBaselineResult {
  return {
    success: false,
    overallScore: 0,
    maturityStage: 'Unknown',
    dimensions: {
      brand: null,
      content: null,
      seo: null,
      website: null,
      digitalFootprint: null,
      authority: null,
    },
    digitalFootprintData: null,
    socialFootprint: null,
    quickWins: [],
    topOpportunities: [],
    error,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Safely collect digital footprint (non-blocking)
 */
async function collectDigitalFootprintSafe(domain: string, html?: string): Promise<DigitalFootprint> {
  try {
    const result = await collectDigitalFootprint(domain, html);
    return result;
  } catch (e) {
    console.warn('[OS GAP-IA Baseline] Digital footprint collection failed:', e);
    // Return empty footprint
    return {
      gbp: {
        found: false,
        hasReviews: false,
        reviewCountBucket: 'unknown',
        ratingBucket: 'unknown',
      },
      linkedin: {
        found: false,
        followerBucket: 'unknown',
        postingCadence: 'unknown',
      },
      otherSocials: {
        instagram: false,
        facebook: false,
        youtube: false,
      },
      brandedSearch: {
        ownDomainDominates: false,
        confusingNameCollisions: false,
      },
    };
  }
}

/**
 * Safely discover and fetch multi-page snapshot (non-blocking)
 */
async function discoverMultiPageContentSafe(
  url: string,
  html: string
): Promise<GapIaCoreInput['multiPageSnapshot']> {
  try {
    return await discoverMultiPageContent(url, html);
  } catch (e) {
    console.warn('[OS GAP-IA Baseline] Multi-page discovery failed:', e);
    return undefined;
  }
}

/**
 * Safely detect social media and GBP presence (non-blocking)
 *
 * This is critical for gating digitalFootprint subscores and narratives.
 * If detection fails, we return null and the gating layer will use defaults.
 */
async function detectSocialAndGbpSafe(html: string, baseUrl?: string): Promise<SocialFootprintSnapshot | null> {
  try {
    const result = detectSocialAndGbp({ html, schemas: [], baseUrl });
    return result;
  } catch (e) {
    console.warn('[OS GAP-IA Baseline] Social detection failed:', e);
    return null;
  }
}

/**
 * Extract a dimension summary from the GAP-IA V2 API response
 */
function extractDimensionSummary(
  result: Awaited<ReturnType<typeof generateGapIaAnalysisCore>>,
  dimensionKey: 'brand' | 'content' | 'seo' | 'website'
): DimensionSummary | null {
  // V2 API response has dimensions object
  const dim = result.dimensions?.[dimensionKey];
  if (dim) {
    return {
      score: dim.score || 0,
      label: dimensionKey.charAt(0).toUpperCase() + dimensionKey.slice(1),
      oneLiner: dim.oneLiner || '',
      issues: dim.issues || [],
      narrative: dim.narrative,
    };
  }

  return null;
}

/**
 * Extract digital footprint dimension
 */
function extractDigitalFootprintDimension(
  result: Awaited<ReturnType<typeof generateGapIaAnalysisCore>>
): DigitalFootprintDimension | null {
  const dim = result.dimensions?.digitalFootprint;
  if (dim) {
    return {
      score: dim.score || 0,
      label: 'Digital Footprint',
      oneLiner: dim.oneLiner || '',
      issues: dim.issues || [],
      subscores: dim.subscores || {
        googleBusinessProfile: 0,
        linkedinPresence: 0,
        socialPresence: 0,
        reviewsReputation: 0,
      },
    };
  }
  return null;
}

/**
 * Extract authority dimension
 */
function extractAuthorityDimension(
  result: Awaited<ReturnType<typeof generateGapIaAnalysisCore>>
): AuthorityDimension | null {
  const dim = result.dimensions?.authority;
  if (dim) {
    return {
      score: dim.score || 0,
      label: 'Authority',
      oneLiner: dim.oneLiner || '',
      issues: dim.issues || [],
      subscores: dim.subscores || {
        domainAuthority: 0,
        backlinks: 0,
        brandSearchDemand: 0,
        industryRecognition: 0,
      },
    };
  }
  return null;
}

/**
 * Extract quick wins from GAP-IA result
 */
function extractQuickWins(
  result: Awaited<ReturnType<typeof generateGapIaAnalysisCore>>
): string[] {
  // V2 format has quickWins.bullets array
  if (result.quickWins?.bullets && Array.isArray(result.quickWins.bullets)) {
    return result.quickWins.bullets.map((qw: { action?: string } | string) => {
      if (typeof qw === 'string') return qw;
      return qw.action || '';
    }).filter(Boolean);
  }
  return [];
}
