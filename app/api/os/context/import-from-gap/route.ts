// app/api/os/context/import-from-gap/route.ts
// Import context from a Full GAP report
//
// This endpoint extracts structured context from an existing Full GAP report
// and updates the company context. Used for DMA companies that already have
// a GAP run before entering the OS.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  buildContextFromFullGap,
  updateCompanyContext,
} from '@/lib/os/context';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, fullGapReportId } = body as {
      companyId: string;
      fullGapReportId: string;
    };

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    if (!fullGapReportId) {
      return NextResponse.json({ error: 'Missing fullGapReportId' }, { status: 400 });
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    console.log('[context/import-from-gap] Importing context for', company.name, 'from', fullGapReportId);

    // Build context from GAP report
    const importedContext = await buildContextFromFullGap(companyId, fullGapReportId);

    if (!importedContext) {
      return NextResponse.json(
        { error: 'Failed to extract context from GAP report. The report may be empty or have an unexpected format.' },
        { status: 500 }
      );
    }

    // Check if we got any useful data
    const hasData = Object.keys(importedContext).some(
      key => key !== 'isAiGenerated' && importedContext[key as keyof typeof importedContext]
    );

    if (!hasData) {
      return NextResponse.json(
        {
          error: 'No extractable context found in the GAP report. Try running AI Assist after running diagnostics.',
          context: importedContext,
        },
        { status: 422 }
      );
    }

    // Save the imported context
    const updatedContext = await updateCompanyContext({
      companyId,
      updates: importedContext,
      source: 'diagnostic', // Mark as imported from diagnostic
    });

    console.log('[context/import-from-gap] Successfully imported context:', Object.keys(importedContext));

    return NextResponse.json({
      success: true,
      context: importedContext,
      fullContext: updatedContext,
      message: `Imported ${Object.keys(importedContext).length - 1} fields from Full GAP report`,
    });
  } catch (error) {
    console.error('[API] context/import-from-gap error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
