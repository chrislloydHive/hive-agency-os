// app/api/os/companies/[companyId]/labs/refine/route.ts
// API endpoint for Lab refinement mode
//
// POST: Run a Lab in refinement mode
// GET: Get latest refinement run results

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  runLabRefinement,
  runAllLabRefinements,
  type RefinementLabId,
  type LabRefinementRunResult,
} from '@/lib/labs/refinementRunner';

// ============================================================================
// Types
// ============================================================================

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

interface RefineRequest {
  labId?: RefinementLabId;
  runAll?: boolean;
  forceRun?: boolean;
  dryRun?: boolean;
  maxRefinements?: number;
}

// ============================================================================
// POST: Run refinement
// ============================================================================

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { companyId } = await context.params;

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Parse request
    const body: RefineRequest = await request.json().catch(() => ({}));
    const { labId, runAll, forceRun, dryRun, maxRefinements } = body;

    // Validate input
    if (!runAll && !labId) {
      return NextResponse.json(
        { error: 'Must specify labId or runAll' },
        { status: 400 }
      );
    }

    if (labId && !['audience', 'brand', 'creative', 'competitor', 'website'].includes(labId)) {
      return NextResponse.json(
        { error: 'Invalid labId. Must be audience, brand, creative, competitor, or website' },
        { status: 400 }
      );
    }

    console.log(`[LabRefine API] Running refinement for ${companyId}:`, {
      labId,
      runAll,
      forceRun,
      dryRun,
    });

    // Run refinement
    let results: Record<RefinementLabId, LabRefinementRunResult> | LabRefinementRunResult;

    if (runAll) {
      results = await runAllLabRefinements(companyId, { forceRun, dryRun });
    } else {
      results = await runLabRefinement({
        companyId,
        labId: labId!,
        forceRun,
        dryRun,
        maxRefinements,
      });
    }

    // Build response summary
    if (runAll) {
      const allResults = results as Record<RefinementLabId, LabRefinementRunResult>;
      const summary = {
        audience: summarizeResult(allResults.audience),
        brand: summarizeResult(allResults.brand),
        creative: summarizeResult(allResults.creative),
        competitor: summarizeResult(allResults.competitor),
        website: summarizeResult(allResults.website),
        totalUpdated:
          (allResults.audience.applyResult?.updated ?? 0) +
          (allResults.brand.applyResult?.updated ?? 0) +
          (allResults.creative.applyResult?.updated ?? 0) +
          (allResults.competitor.applyResult?.updated ?? 0) +
          (allResults.website.applyResult?.updated ?? 0),
        totalDurationMs:
          allResults.audience.durationMs +
          allResults.brand.durationMs +
          allResults.creative.durationMs +
          allResults.competitor.durationMs +
          allResults.website.durationMs,
      };

      return NextResponse.json({
        success: true,
        companyId,
        results: allResults,
        summary,
      });
    } else {
      const singleResult = results as LabRefinementRunResult;
      return NextResponse.json({
        success: true,
        companyId,
        result: singleResult,
        summary: summarizeResult(singleResult),
      });
    }
  } catch (error) {
    console.error('[LabRefine API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to run refinement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET: Get refinement status/info
// ============================================================================

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { companyId } = await context.params;

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Return info about what Labs support refinement mode
    return NextResponse.json({
      companyId,
      companyName: company.name,
      refinementLabs: [
        {
          id: 'audience',
          name: 'Audience Lab',
          description: 'Refines audience segments, pain points, and targeting',
        },
        {
          id: 'brand',
          name: 'Brand Lab',
          description: 'Refines positioning, value props, and tone of voice',
        },
        {
          id: 'creative',
          name: 'Creative Lab',
          description: 'Refines messaging framework, key messages, and CTAs',
        },
        {
          id: 'competitor',
          name: 'Competitor Lab',
          description: 'Refines competitive intelligence, positioning, threats, and market analysis',
        },
        {
          id: 'website',
          name: 'Website Lab',
          description: 'Refines website UX, conversion analysis, quick wins, and recommendations',
        },
      ],
      endpoints: {
        runSingle: 'POST with { labId: "audience"|"brand"|"creative"|"competitor"|"website" }',
        runAll: 'POST with { runAll: true }',
        options: {
          forceRun: 'Run even if context is >90% complete',
          dryRun: 'Preview changes without writing',
          maxRefinements: 'Limit number of fields to refine',
        },
      },
    });
  } catch (error) {
    console.error('[LabRefine API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get refinement info' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function summarizeResult(result: LabRefinementRunResult): {
  labId: RefinementLabId;
  proposed: number;
  updated: number;
  skippedHuman: number;
  skippedSource: number;
  skippedUnchanged: number;
  diagnosticsCount: number;
  durationMs: number;
} {
  return {
    labId: result.labId,
    proposed: result.refinement.refinedContext.length,
    updated: result.applyResult?.updated ?? 0,
    skippedHuman: result.applyResult?.skippedHumanOverride ?? 0,
    skippedSource: result.applyResult?.skippedHigherPriority ?? 0,
    skippedUnchanged: result.applyResult?.skippedUnchanged ?? 0,
    diagnosticsCount: result.refinement.diagnostics.length,
    durationMs: result.durationMs,
  };
}
