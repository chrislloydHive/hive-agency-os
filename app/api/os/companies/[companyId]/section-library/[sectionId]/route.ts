// app/api/os/companies/[companyId]/section-library/[sectionId]/route.ts
// API routes for single Section Library item

import { NextRequest, NextResponse } from 'next/server';
import {
  getSectionById,
  updateSection,
  deleteSection,
} from '@/lib/airtable/sectionLibrary';
import { UpdateSectionInputSchema } from '@/lib/types/sectionLibrary';
import { checkForClientLeakage, getLeakageSummary } from '@/lib/os/library/clientLeakageCheck';

interface RouteParams {
  params: Promise<{ companyId: string; sectionId: string }>;
}

// GET /api/os/companies/[companyId]/section-library/[sectionId]
// Get a single section
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

    // Verify access (company sections must belong to this company, global sections are accessible to all)
    if (section.scope === 'company' && section.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Include leakage check for promotion preview
    const leakageCheck = checkForClientLeakage(section.content);

    return NextResponse.json({
      section,
      leakageCheck,
      leakageSummary: getLeakageSummary(leakageCheck),
    });
  } catch (error) {
    console.error('[section-library] GET single error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch section' },
      { status: 500 }
    );
  }
}

// PATCH /api/os/companies/[companyId]/section-library/[sectionId]
// Update a section (company-scoped only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, sectionId } = await params;

    if (!companyId || !sectionId) {
      return NextResponse.json(
        { error: 'Company ID and Section ID are required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = UpdateSectionInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const section = await updateSection(sectionId, companyId, parsed.data);

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ section });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update section';

    // Handle specific error cases
    if (errorMessage.includes('Cannot edit global')) {
      return NextResponse.json(
        { error: 'Cannot edit global sections' },
        { status: 403 }
      );
    }
    if (errorMessage.includes('Cannot edit sections belonging')) {
      return NextResponse.json(
        { error: 'Cannot edit sections belonging to another company' },
        { status: 403 }
      );
    }

    console.error('[section-library] PATCH error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/os/companies/[companyId]/section-library/[sectionId]
// Delete a section (company-scoped only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, sectionId } = await params;

    if (!companyId || !sectionId) {
      return NextResponse.json(
        { error: 'Company ID and Section ID are required' },
        { status: 400 }
      );
    }

    const success = await deleteSection(sectionId, companyId);

    if (!success) {
      return NextResponse.json(
        { error: 'Section not found or delete failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete section';

    // Handle specific error cases
    if (errorMessage.includes('Cannot delete global')) {
      return NextResponse.json(
        { error: 'Cannot delete global sections' },
        { status: 403 }
      );
    }
    if (errorMessage.includes('Cannot delete sections belonging')) {
      return NextResponse.json(
        { error: 'Cannot delete sections belonging to another company' },
        { status: 403 }
      );
    }

    console.error('[section-library] DELETE error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
