// app/api/os/companies/[companyId]/qbr/route.ts
// Unified QBR API Endpoint
//
// GET: Load QBR data and optionally generate narrative
// POST: Generate full QBR narrative with AI enhancement
//
// This endpoint uses the new unified QBR data loader and narrative engine
// from lib/os/reports/qbrData.ts and lib/os/reports/qbrNarrativeEngine.ts

import { NextRequest, NextResponse } from 'next/server';
import { loadQBRData, getQBRSummary, calculateOverallHealthScore, type QBRData } from '@/lib/os/reports/qbrData';
import { generateQBRNarrative, generateQuickNarrativeSummary, type QBRNarrative, type GenerateNarrativeOptions } from '@/lib/os/reports/qbrNarrativeEngine';

// ============================================================================
// GET - Load QBR Data
// ============================================================================

/**
 * GET /api/os/companies/[companyId]/qbr
 *
 * Query Parameters:
 * - summary: "true" to return only summary metrics (fast)
 * - narrative: "true" to include generated narrative (slower, uses AI)
 * - quarter: Optional quarter label override (e.g., "Q4 2024")
 *
 * Returns:
 * - QBR data bundle with work items, findings, diagnostics, context health
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
  const quarterLabel = searchParams.get('quarter') || undefined;

  console.log('[QBR API] GET request:', { companyId, summaryOnly, includeNarrative });

  try {
    // Load QBR data
    const data = await loadQBRData(companyId);

    // If summary only, return quick summary
    if (summaryOnly) {
      const summary = getQBRSummary(data);
      const quickNarrative = generateQuickNarrativeSummary(data);

      return NextResponse.json({
        success: true,
        companyId,
        companyName: data.company.name,
        ...summary,
        headline: quickNarrative.headline,
        keyStats: quickNarrative.keyStats,
        loadedAt: data.loadedAt,
        warnings: data.warnings,
      });
    }

    // Full data response
    const response: {
      success: boolean;
      data: QBRData;
      summary: ReturnType<typeof getQBRSummary>;
      narrative?: QBRNarrative;
      enhancedData?: {
        plan: typeof data.plan;
        work: typeof data.workEnhanced;
        diagnostics: typeof data.diagnosticsEnhanced;
        history: typeof data.history;
      };
    } = {
      success: true,
      data,
      summary: getQBRSummary(data),
      // Include enhanced sections for v2 clients
      enhancedData: {
        plan: data.plan,
        work: data.workEnhanced,
        diagnostics: data.diagnosticsEnhanced,
        history: data.history,
      },
    };

    // Optionally include narrative
    if (includeNarrative) {
      const narrativeOptions: GenerateNarrativeOptions = {
        useAI: true,
        quarterLabel,
        includeEmptyContext: true,
      };

      const narrative = await generateQBRNarrative(data, narrativeOptions);
      response.narrative = narrative;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[QBR API] GET error:', error);

    if (error instanceof Error && error.message.includes('Company not found')) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to load QBR data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Generate QBR Narrative
// ============================================================================

interface PostBody {
  /** Quarter label (e.g., "Q4 2024") - optional, defaults to current */
  quarter?: string;
  /** Use AI for enhanced narrative */
  useAI?: boolean;
  /** Include context graph section even if empty */
  includeEmptyContext?: boolean;
}

/**
 * POST /api/os/companies/[companyId]/qbr
 *
 * Generate a full QBR narrative from current data.
 *
 * Body:
 * - quarter: Optional quarter label
 * - useAI: Whether to use AI for enhanced narrative (default: true)
 * - includeEmptyContext: Include context section even if no data
 *
 * Returns:
 * - Complete QBR narrative with all sections
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

  const { quarter, useAI = true, includeEmptyContext = true } = body;

  console.log('[QBR API] POST request:', { companyId, quarter, useAI });

  try {
    // Load QBR data
    const data = await loadQBRData(companyId);

    // Generate narrative
    const narrativeOptions: GenerateNarrativeOptions = {
      useAI,
      quarterLabel: quarter,
      includeEmptyContext,
    };

    const narrative = await generateQBRNarrative(data, narrativeOptions);

    return NextResponse.json({
      success: true,
      narrative,
      summary: getQBRSummary(data),
      // Include raw data counts for client-side rendering
      meta: {
        companyId,
        companyName: data.company.name,
        findingsCount: data.findings.length,
        workItemsCount: data.work.counts.total,
        diagnosticModulesCount: data.diagnostics.totalModuleCount,
        trendsCount: data.diagnostics.trends?.length || 0,
        themesCount: data.plan?.themes?.length || 0,
        completedThisQuarter: data.workEnhanced?.completedThisQuarter?.length || 0,
        blockedItems: data.workEnhanced?.blocked?.length || 0,
        quarterStart: data.history?.quarterStart,
        quarterEnd: data.history?.quarterEnd,
        loadedAt: data.loadedAt,
        hasAnalytics: data.analyticsSnapshot?.hasAnalytics ?? false,
      },
      // Include analytics snapshot
      analytics: data.analyticsSnapshot,
      // Include enhanced sections for v2 clients
      enhancedData: {
        plan: data.plan,
        work: data.workEnhanced,
        diagnostics: data.diagnosticsEnhanced,
        history: data.history,
      },
    });
  } catch (error) {
    console.error('[QBR API] POST error:', error);

    if (error instanceof Error && error.message.includes('Company not found')) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to generate QBR narrative' },
      { status: 500 }
    );
  }
}
