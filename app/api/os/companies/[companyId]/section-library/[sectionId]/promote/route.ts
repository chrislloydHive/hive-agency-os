// app/api/os/companies/[companyId]/section-library/[sectionId]/promote/route.ts
// API route for promoting a company section to global

import { NextRequest, NextResponse } from 'next/server';
import {
  getSectionById,
  promoteSectionToGlobal,
} from '@/lib/airtable/sectionLibrary';
import { PromoteToGlobalInputSchema } from '@/lib/types/sectionLibrary';
import { checkForClientLeakage, getLeakageSummary } from '@/lib/os/library/clientLeakageCheck';
import { getCompanyById } from '@/lib/airtable/companies';

interface RouteParams {
  params: Promise<{ companyId: string; sectionId: string }>;
}

// GET /api/os/companies/[companyId]/section-library/[sectionId]/promote
// Preview promotion (check for leakage)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, sectionId } = await params;

    if (!companyId || !sectionId) {
      return NextResponse.json(
        { error: 'Company ID and Section ID are required' },
        { status: 400 }
      );
    }

    const section = await getSectionById(sectionId);

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Must be company-scoped and owned by this company
    if (section.scope === 'global') {
      return NextResponse.json(
        { error: 'Section is already global' },
        { status: 400 }
      );
    }

    if (section.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Get company name for leakage check
    const company = await getCompanyById(companyId);
    const companyName = company?.name || undefined;

    // Check for client leakage
    const leakageCheck = checkForClientLeakage(section.content, companyName);

    return NextResponse.json({
      canPromote: true,
      section,
      leakageCheck,
      leakageSummary: getLeakageSummary(leakageCheck),
      requiresConfirmation: leakageCheck.hasWarnings,
    });
  } catch (error) {
    console.error('[section-library] promote GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check promotion eligibility' },
      { status: 500 }
    );
  }
}

// POST /api/os/companies/[companyId]/section-library/[sectionId]/promote
// Promote section to global
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, sectionId } = await params;

    if (!companyId || !sectionId) {
      return NextResponse.json(
        { error: 'Company ID and Section ID are required' },
        { status: 400 }
      );
    }

    // Parse and validate confirmation
    const body = await request.json();
    const parsed = PromoteToGlobalInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'You must confirm that the content contains no client-specific details',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Perform promotion
    const result = await promoteSectionToGlobal(sectionId, companyId);

    return NextResponse.json({
      success: true,
      originalSection: result.originalSection,
      globalSection: result.globalSection,
    }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to promote section';

    // Handle specific error cases
    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }
    if (errorMessage.includes('already global')) {
      return NextResponse.json(
        { error: 'Section is already global' },
        { status: 400 }
      );
    }
    if (errorMessage.includes('Cannot promote')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      );
    }

    console.error('[section-library] promote POST error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
