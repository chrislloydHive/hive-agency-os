// app/api/os/companies/[companyId]/reports/annual/route.ts
// Annual Marketing Plan API Endpoint
//
// GET: Load annual plan data and optionally generate narrative
// POST: Generate full annual plan narrative with AI enhancement
//
// This endpoint uses the unified Annual Plan data loader and narrative engine
// from lib/os/reports/annualPlanData.ts and lib/os/reports/annualPlanNarrativeEngine.ts

import { NextRequest, NextResponse } from 'next/server';
import {
  loadAnnualPlanData,
  getAnnualPlanReadiness,
  type AnnualPlanData,
} from '@/lib/os/reports/annualPlanData';
import {
  generateAnnualPlanNarrative,
  generateQuickAnnualPlanSummary,
  type AnnualPlanNarrative,
  type GenerateAnnualPlanOptions,
} from '@/lib/os/reports/annualPlanNarrativeEngine';

// ============================================================================
// GET - Load Annual Plan Data
// ============================================================================

/**
 * GET /api/os/companies/[companyId]/reports/annual
 *
 * Query Parameters:
 * - summary: "true" to return only summary metrics (fast)
 * - narrative: "true" to include generated narrative (slower, uses AI)
 * - year: Optional target year (e.g., "2025")
 *
 * Returns:
 * - Annual plan data bundle with diagnostics, themes, work, audience, brand
 * - Optional: generated narrative sections
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const searchParams = request.nextUrl.searchParams;

  const summaryOnly = searchParams.get('summary') === 'true';
  const includeNarrative = searchParams.get('narrative') === 'true';
  const targetYear = searchParams.get('year')
    ? parseInt(searchParams.get('year')!, 10)
    : undefined;

  console.log('[Annual Plan API] GET request:', { companyId, summaryOnly, includeNarrative, targetYear });

  try {
    // Load Annual Plan data
    const data = await loadAnnualPlanData(companyId);
    const readiness = getAnnualPlanReadiness(data);

    // If summary only, return quick summary
    if (summaryOnly) {
      const quickSummary = generateQuickAnnualPlanSummary(data);

      return NextResponse.json({
        success: true,
        companyId,
        companyName: data.company.name,
        ...quickSummary,
        readiness,
        coverage: data.coverage,
        loadedAt: data.loadedAt,
        warnings: data.warnings,
      });
    }

    // Full data response
    const response: {
      success: boolean;
      data: AnnualPlanData;
      readiness: ReturnType<typeof getAnnualPlanReadiness>;
      summary: ReturnType<typeof generateQuickAnnualPlanSummary>;
      narrative?: AnnualPlanNarrative;
    } = {
      success: true,
      data,
      readiness,
      summary: generateQuickAnnualPlanSummary(data),
    };

    // Optionally include narrative
    if (includeNarrative) {
      const narrativeOptions: GenerateAnnualPlanOptions = {
        useAI: true,
        targetYear,
        includeBudget: true,
      };

      const narrative = await generateAnnualPlanNarrative(data, narrativeOptions);
      response.narrative = narrative;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Annual Plan API] GET error:', error);

    if (error instanceof Error && error.message.includes('Company not found')) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to load annual plan data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Generate Annual Plan Narrative
// ============================================================================

interface PostBody {
  /** Target year (e.g., 2025) - optional, defaults to next year */
  year?: number;
  /** Use AI for enhanced narrative */
  useAI?: boolean;
  /** Include budget recommendations */
  includeBudget?: boolean;
}

/**
 * POST /api/os/companies/[companyId]/reports/annual
 *
 * Generate a full Annual Plan narrative from current data.
 *
 * Body:
 * - year: Optional target year
 * - useAI: Whether to use AI for enhanced narrative (default: true)
 * - includeBudget: Include budget framework section (default: true)
 *
 * Returns:
 * - Complete Annual Plan narrative with all sections
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  let body: PostBody = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is OK, use defaults
  }

  const { year, useAI = true, includeBudget = true } = body;

  console.log('[Annual Plan API] POST request:', { companyId, year, useAI, includeBudget });

  try {
    // Load Annual Plan data
    const data = await loadAnnualPlanData(companyId);
    const readiness = getAnnualPlanReadiness(data);

    // Check readiness
    if (!readiness.ready && useAI) {
      console.warn('[Annual Plan API] Generating with low readiness:', readiness.score);
    }

    // Generate narrative
    const narrativeOptions: GenerateAnnualPlanOptions = {
      useAI,
      targetYear: year,
      includeBudget,
    };

    const narrative = await generateAnnualPlanNarrative(data, narrativeOptions);

    return NextResponse.json({
      success: true,
      narrative,
      summary: generateQuickAnnualPlanSummary(data),
      readiness,
      // Include meta for client-side rendering
      meta: {
        companyId,
        companyName: data.company.name,
        targetYear: year || new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0),
        diagnosticModulesCount: data.diagnostics.all.length,
        themesCount: data.themes.length,
        findingsCount: data.findings.length,
        strategicPatternsCount: data.strategicPatterns.length,
        workCompleted: data.work.totalCompleted,
        workBacklog: data.work.totalBacklog,
        hasAudienceData: data.coverage.hasAudienceData,
        hasBrandData: data.coverage.hasBrandData,
        maturityLevel: data.diagnostics.maturity,
        overallScore: data.diagnostics.overallScore,
        loadedAt: data.loadedAt,
      },
      // Include enhanced sections for advanced clients
      enhancedData: {
        diagnostics: data.diagnostics,
        themes: data.themes,
        strategicPatterns: data.strategicPatterns,
        work: data.work,
        audience: data.audience,
        brand: data.brand,
      },
    });
  } catch (error) {
    console.error('[Annual Plan API] POST error:', error);

    if (error instanceof Error && error.message.includes('Company not found')) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to generate annual plan narrative' },
      { status: 500 }
    );
  }
}
