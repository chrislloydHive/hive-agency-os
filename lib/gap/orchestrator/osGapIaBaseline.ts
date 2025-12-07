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
import type {
  DimensionSummary,
  DigitalFootprintDimension,
  AuthorityDimension,
} from '@/lib/gap/types';

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
  /** Digital footprint raw data */
  digitalFootprintData: DigitalFootprint | null;
  /** Quick wins extracted */
  quickWins: string[];
  /** Top opportunities */
  topOpportunities: string[];
  /** Error message if failed */
  error?: string;
  /** Processing time in ms */
  durationMs: number;
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
    let html: string;
    try {
      html = await fetchHtmlBounded(url, 50000);
    } catch (e) {
      console.warn('[OS GAP-IA Baseline] Failed to fetch HTML:', e);
      return createErrorResult(
        `Could not fetch website: ${e instanceof Error ? e.message : 'Unknown error'}`,
        startTime
      );
    }

    // 3. Extract website signals
    const signals = extractHtmlSignals(html);

    // 4. Collect digital footprint and multi-page content (parallel)
    const [digitalFootprint, multiPageSnapshot] = await Promise.all([
      collectDigitalFootprintSafe(domain, html),
      discoverMultiPageContentSafe(url, html),
    ]);

    // 5. Run GAP-IA core engine
    const coreInput: GapIaCoreInput = {
      url,
      domain,
      html,
      signals,
      digitalFootprint,
      multiPageSnapshot,
      // No modelCaller specified - will use default OpenAI
    };

    const gapIaResult = await generateGapIaAnalysisCore(coreInput);

    // 6. Extract structured outputs from the V2 API response format
    const result: OsGapIaBaselineResult = {
      success: true,
      overallScore: gapIaResult.summary?.overallScore || gapIaResult.core?.overallScore || 0,
      maturityStage: gapIaResult.core?.marketingMaturity || 'Unknown',
      dimensions: {
        brand: extractDimensionSummary(gapIaResult, 'brand'),
        content: extractDimensionSummary(gapIaResult, 'content'),
        seo: extractDimensionSummary(gapIaResult, 'seo'),
        website: extractDimensionSummary(gapIaResult, 'website'),
        digitalFootprint: extractDigitalFootprintDimension(gapIaResult),
        authority: extractAuthorityDimension(gapIaResult),
      },
      digitalFootprintData: digitalFootprint,
      quickWins: extractQuickWins(gapIaResult),
      topOpportunities: gapIaResult.summary?.topOpportunities || [],
      durationMs: Date.now() - startTime,
    };

    console.log('[OS GAP-IA Baseline] Complete:', {
      overallScore: result.overallScore,
      maturityStage: result.maturityStage,
      dimensionsFound: Object.values(result.dimensions).filter(Boolean).length,
      durationMs: result.durationMs,
    });

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
