// app/api/os/companies/[companyId]/context/v4/proposals/generate/route.ts
// POST: Generate Context V4 proposals from diagnostic outputs
//
// This endpoint triggers the proposal generation pipeline that extracts
// candidates from completed diagnostic runs (GAP, Labs) and creates
// proposals for human review.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateProposalsFromDiagnostics } from '@/lib/contextGraph/v4/promotion/generateProposalsFromDiagnostics';
import { getCompanyById } from '@/lib/airtable/companies';

// ============================================================================
// Request Validation
// ============================================================================

const generateRequestSchema = z.object({
  fieldKeys: z.array(z.string()).optional(),
  dryRun: z.boolean().optional(),
});

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Parse optional request body
    let options: { fieldKeys?: string[]; dryRun?: boolean } = {};
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = generateRequestSchema.safeParse(body);
      if (parsed.success) {
        options = parsed.data;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log('[ProposalsGenerate] Starting generation:', {
      companyId,
      options,
    });

    // Generate proposals
    const result = await generateProposalsFromDiagnostics(companyId, options);

    console.log('[ProposalsGenerate] Generation complete:', {
      success: result.success,
      created: result.createdCount,
      skipped: result.skippedCount,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          debug: result.debug,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ProposalsGenerate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
