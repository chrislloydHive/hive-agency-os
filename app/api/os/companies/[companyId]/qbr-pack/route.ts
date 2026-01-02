// app/api/os/companies/[companyId]/qbr-pack/route.ts
// GET endpoint to generate a QBR Pack for a company's programs
//
// Synthesizes program status into structured QBR sections for executive review.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { listPlanningPrograms } from '@/lib/airtable/planningPrograms';
import { getWorkItemsForCompany } from '@/lib/airtable/workItems';
import { generateQBRPack, type QBRPackOptions } from '@/lib/os/programs/qbrPack';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;
    const { searchParams } = new URL(request.url);

    // Parse query params
    const quarterStr = searchParams.get('quarter');
    const yearStr = searchParams.get('year');

    const options: QBRPackOptions = {};
    if (quarterStr) options.quarter = parseInt(quarterStr, 10);
    if (yearStr) options.year = parseInt(yearStr, 10);

    // Fetch company for name
    const company = await getCompanyById(companyId);
    if (company) {
      options.companyName = company.name;
    }

    // Fetch programs and work items
    const [programs, workItems] = await Promise.all([
      listPlanningPrograms(companyId),
      getWorkItemsForCompany(companyId),
    ]);

    if (programs.length === 0) {
      return NextResponse.json({
        success: true,
        pack: null,
        message: 'No programs found for this company',
      });
    }

    // Generate the QBR pack
    const pack = generateQBRPack(programs, workItems, options);

    return NextResponse.json({
      success: true,
      pack,
    });
  } catch (error) {
    console.error('[QBR Pack] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
