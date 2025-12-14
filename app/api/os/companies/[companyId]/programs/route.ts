// app/api/os/companies/[companyId]/programs/route.ts
// Programs API - List and Create programs for a company
//
// GET: List programs (filter by type)
// POST: Create a new program (Website Program MVP)
//
// GATING: Uses registry-based readiness check before creating programs.
// See lib/os/registry/contextResolver.ts for isWebsiteProgramReady.

import { NextRequest, NextResponse } from 'next/server';
import {
  getProgramsForCompany,
  createProgram,
} from '@/lib/airtable/programs';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { readStrategyFromContextGraph } from '@/lib/contextGraph/domain-writers/strategyWriter';
import {
  createWebsiteProgramSkeleton,
  type WebsiteLabSummary,
  type StrategyExcerpt,
} from '@/lib/os/programs/website/createWebsiteProgramSkeleton';
import { isWebsiteProgramReady } from '@/lib/os/registry';
import type { ProgramType, CreateProgramRequest } from '@/lib/types/program';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// GET - List programs for company
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Get type filter from query params
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as ProgramType | null;

    // For MVP, default to website type
    const programType = type || 'website';

    const programs = await getProgramsForCompany(companyId, programType);

    return NextResponse.json({
      programs,
      total: programs.length,
      type: programType,
    });
  } catch (error) {
    console.error('[API] Programs list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create a new program
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json() as CreateProgramRequest;
    const { type = 'website' } = body;

    // MVP: Only website programs
    if (type !== 'website') {
      return NextResponse.json(
        { error: 'Only website programs are supported in MVP' },
        { status: 400 }
      );
    }

    // Check readiness using the registry-based gating function
    const readiness = await isWebsiteProgramReady(companyId);
    if (!readiness.ready) {
      return NextResponse.json({
        error: 'Context is incomplete for program creation',
        code: 'CONTEXT_NOT_READY',
        readiness: {
          score: readiness.score,
          blockers: readiness.blockers,
        },
        message: `Missing critical context: ${readiness.blockers.slice(0, 3).join(', ')}${readiness.blockers.length > 3 ? ` (+${readiness.blockers.length - 3} more)` : ''}`,
        suggestedAction: {
          type: 'fix_context',
          label: 'Complete Context',
          href: `/c/${companyId}/context`,
        },
      }, { status: 422 }); // Unprocessable Entity - need more data
    }

    // Check if a draft already exists
    const existingPrograms = await getProgramsForCompany(companyId, type);
    const existingDraft = existingPrograms.find(p => p.status === 'draft');

    if (existingDraft) {
      // Return existing draft instead of creating duplicate
      return NextResponse.json({
        success: true,
        program: existingDraft,
        message: 'Existing draft program returned',
        created: false,
      });
    }

    // Load inputs for skeleton generation
    const [contextGraph, strategyData] = await Promise.all([
      loadContextGraph(companyId),
      readStrategyFromContextGraph(companyId),
    ]);

    // Build strategy excerpt (strategyData has flat keys like 'strategy.positioning')
    const strategyExcerpt: StrategyExcerpt | null = strategyData ? {
      title: (strategyData['strategy.positioning'] as string) || undefined,
      primaryObjective: (strategyData['objectives.primaryObjective'] as string) || undefined,
      positioning: (strategyData['strategy.positioning'] as string) || undefined,
    } : null;

    // Build website lab summary from context graph website domain
    const websiteLabSummary: WebsiteLabSummary | null = contextGraph?.website ? {
      websiteScore: contextGraph.website.websiteScore?.value || undefined,
      executiveSummary: contextGraph.website.executiveSummary?.value || undefined,
      criticalIssues: contextGraph.website.criticalIssues?.value || undefined,
      quickWins: contextGraph.website.quickWins?.value || undefined,
      conversionBlocks: contextGraph.website.conversionBlocks?.value || undefined,
    } : null;

    // Generate skeleton
    const skeleton = createWebsiteProgramSkeleton({
      companyId,
      contextGraph,
      strategyExcerpt,
      websiteLabSummary,
    });

    // Merge with any provided plan overrides
    const plan = {
      ...skeleton,
      ...body.plan,
    };

    // Create the program
    const program = await createProgram(companyId, type, plan);

    if (!program) {
      return NextResponse.json(
        { error: 'Failed to create program' },
        { status: 500 }
      );
    }

    console.log(`[Programs] Created website program for ${companyId}:`, {
      programId: program.id,
      hasContext: !!contextGraph,
      hasStrategy: !!strategyExcerpt,
      hasWebsiteLab: !!websiteLabSummary,
    });

    return NextResponse.json({
      success: true,
      program,
      message: 'Program created successfully',
      created: true,
    });
  } catch (error) {
    console.error('[API] Programs create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
