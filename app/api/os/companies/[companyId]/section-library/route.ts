// app/api/os/companies/[companyId]/section-library/route.ts
// API routes for Section Library (list and create)

import { NextRequest, NextResponse } from 'next/server';
import {
  getSectionsForCompany,
  createSection,
} from '@/lib/airtable/sectionLibrary';
import { CreateSectionInputSchema } from '@/lib/types/sectionLibrary';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// GET /api/os/companies/[companyId]/section-library
// List sections for company (includes company + global sections)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = {
      scope: searchParams.get('scope') as 'company' | 'global' | 'all' | undefined,
      q: searchParams.get('q') || undefined,
      tag: searchParams.get('tag') || undefined,
    };

    const result = await getSectionsForCompany(companyId, query);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[section-library] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sections' },
      { status: 500 }
    );
  }
}

// POST /api/os/companies/[companyId]/section-library
// Create a new company-scoped section
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = CreateSectionInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const section = await createSection(companyId, parsed.data);

    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    console.error('[section-library] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create section' },
      { status: 500 }
    );
  }
}
