// app/api/settings/firm-brain/case-studies/route.ts
// Case Studies API - List and Create

import { NextResponse } from 'next/server';
import { getCaseStudies, createCaseStudy } from '@/lib/airtable/firmBrain';
import { CaseStudyInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/firm-brain/case-studies
 * List all case studies
 */
export async function GET() {
  try {
    const caseStudies = await getCaseStudies();
    return NextResponse.json({ caseStudies });
  } catch (error) {
    console.error('[firm-brain/case-studies] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch case studies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/firm-brain/case-studies
 * Create a new case study
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CaseStudyInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const caseStudy = await createCaseStudy(parsed.data);
    return NextResponse.json({ caseStudy }, { status: 201 });
  } catch (error) {
    console.error('[firm-brain/case-studies] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create case study' },
      { status: 500 }
    );
  }
}
