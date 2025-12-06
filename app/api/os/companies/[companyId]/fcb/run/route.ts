// app/api/os/companies/[companyId]/fcb/run/route.ts
// FCB-only endpoint for "Re-crawl Website"
//
// POST /api/os/companies/[companyId]/fcb/run
//   - Force-runs FCB regardless of freshness
//   - Does NOT run Labs, GAP, or Snapshot
//   - Returns updated/skipped field counts

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { runFoundationalContextBuilder } from '@/lib/contextGraph/fcb';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// POST - Force-run FCB Only
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Get company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { status: 'error', error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get domain
    const domain = company.domain || company.website;
    if (!domain) {
      return NextResponse.json(
        { status: 'error', error: 'No domain configured for this company. Add a domain first.' },
        { status: 400 }
      );
    }

    console.log(`[FCB Run API] Force-running FCB for ${company.name} (${domain})`);

    // Run FCB only - no snapshot (keeping it lightweight)
    const result = await runFoundationalContextBuilder(
      companyId,
      domain,
      company.name,
      {
        saveSnapshot: false,
        reason: 'Re-crawl Website (FCB Only) triggered from Context Health Header',
      }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          status: 'error',
          error: result.error || 'FCB run failed',
          ran: 'fcb-only',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      ran: 'fcb-only',
      updatedFields: result.fieldsWritten,
      skippedHumanOverrides: result.fieldsSkipped,
      totalExtracted: result.totalFieldsExtracted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[FCB Run API] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
