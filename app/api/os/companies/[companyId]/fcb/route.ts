// app/api/os/companies/[companyId]/fcb/route.ts
// API endpoint for Foundational Context Builder
//
// POST /api/os/companies/[companyId]/fcb
//   - Runs FCB to auto-fill context from website
//   - Returns FCBRunResult with extraction details
//
// GET /api/os/companies/[companyId]/fcb
//   - Returns info about whether FCB can/should run

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { runFoundationalContextBuilder } from '@/lib/contextGraph/fcb';
import { loadContextGraph } from '@/lib/contextGraph/storage';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// GET - Check FCB status
// ============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Get company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Check if domain is available
    const domain = company.domain || company.website;
    if (!domain) {
      return NextResponse.json({
        canRun: false,
        reason: 'No domain configured for this company',
        companyId,
        companyName: company.name,
      });
    }

    // Check current context graph state
    const graph = await loadContextGraph(companyId);
    const isEmpty = !graph || Object.keys(graph.identity || {}).every(
      key => !(graph.identity as any)[key]?.value
    );

    return NextResponse.json({
      canRun: true,
      domain,
      companyId,
      companyName: company.name,
      hasExistingContext: !isEmpty,
      recommendation: isEmpty
        ? 'FCB recommended - context graph is empty'
        : 'FCB can refine existing context (will not overwrite higher-priority data)',
    });
  } catch (error) {
    console.error('[FCB API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check FCB status' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Run FCB
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Get company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get domain
    const domain = company.domain || company.website;
    if (!domain) {
      return NextResponse.json(
        { error: 'No domain configured for this company. Add a domain first.' },
        { status: 400 }
      );
    }

    // Parse request body for options
    let options: { reason?: string; saveSnapshot?: boolean } = {};
    try {
      const body = await request.json();
      options = body || {};
    } catch {
      // No body is fine
    }

    console.log(`[FCB API] Starting FCB for ${company.name} (${domain})`);

    // Run FCB
    const result = await runFoundationalContextBuilder(
      companyId,
      domain,
      company.name,
      {
        saveSnapshot: options.saveSnapshot ?? true,
        reason: options.reason || 'Manual FCB trigger via API',
      }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'FCB run failed',
          result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      summary: {
        totalExtracted: result.totalFieldsExtracted,
        written: result.fieldsWritten,
        skipped: result.fieldsSkipped,
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    console.error('[FCB API] POST error:', error);
    return NextResponse.json(
      {
        error: 'Failed to run FCB',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
