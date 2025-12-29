// app/api/os/case-studies/route.ts
// Case Studies API - List and Create/Upsert

import { NextRequest, NextResponse } from 'next/server';
import { getCaseStudies, upsertCaseStudy } from '@/lib/airtable/firmBrain';
import { CaseStudyInputSchema } from '@/lib/types/firmBrain';
import type { CaseStudyPermission } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

/**
 * GET /api/os/case-studies
 * List case studies with optional filtering
 *
 * Query params:
 * - permission: 'public' | 'internal' - filter by permission level
 * - q: string - search query (title, client, industry, services, tags)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const permission = searchParams.get('permission') as CaseStudyPermission | null;
    const search = searchParams.get('q') || undefined;

    // Validate permission param if provided
    if (permission && permission !== 'public' && permission !== 'internal') {
      return NextResponse.json(
        { status: 'error', message: 'Invalid permission value. Use "public" or "internal".' },
        { status: 400 }
      );
    }

    const caseStudies = await getCaseStudies({
      permission: permission || undefined,
      search,
    });

    return NextResponse.json({
      status: 'ok',
      data: caseStudies,
      count: caseStudies.length,
    });
  } catch (error) {
    console.error('[os/case-studies] GET error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch case studies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/os/case-studies
 * Create or upsert a case study
 *
 * Body: CaseStudyInput
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CaseStudyInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Invalid input',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const caseStudy = await upsertCaseStudy(parsed.data);

    return NextResponse.json(
      { status: 'ok', data: caseStudy },
      { status: 201 }
    );
  } catch (error) {
    console.error('[os/case-studies] POST error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to create/update case study' },
      { status: 500 }
    );
  }
}
