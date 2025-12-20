/**
 * POST /api/os/companies/[companyId]/engagements/[engagementId]/seed-onboarding
 *
 * Seeds initial onboarding Work items for a Won opportunity engagement.
 * Idempotent - safe to call multiple times; duplicates will be skipped.
 *
 * Request body:
 * {
 *   opportunityId: string  // The Won opportunity that triggered this engagement
 *   wonAt?: string         // ISO datetime when opportunity was Won (used as baseline for due dates)
 * }
 *
 * Response:
 * {
 *   ok: boolean,
 *   created: number,   // Number of new work items created
 *   skipped: number,   // Number of existing items skipped (idempotency)
 *   error?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { seedPostWonWork } from '@/lib/os/pipeline/postWonOnboarding';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; engagementId: string }> }
) {
  try {
    const { companyId, engagementId } = await params;
    const body = await request.json();
    const { opportunityId, wonAt } = body;

    // Validate required fields
    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Missing companyId' },
        { status: 400 }
      );
    }

    if (!engagementId) {
      return NextResponse.json(
        { ok: false, error: 'Missing engagementId' },
        { status: 400 }
      );
    }

    if (!opportunityId) {
      return NextResponse.json(
        { ok: false, error: 'Missing opportunityId in request body' },
        { status: 400 }
      );
    }

    console.log('[Seed Onboarding API] Seeding work items:', {
      companyId,
      engagementId,
      opportunityId,
      wonAt: wonAt || '(using today)',
    });

    // Seed the onboarding work items
    const result = await seedPostWonWork({
      companyId,
      opportunityId,
      engagementId,
      wonAt,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || 'Failed to seed onboarding work items',
          created: result.created,
          skipped: result.skipped,
        },
        { status: 500 }
      );
    }

    console.log('[Seed Onboarding API] Success:', {
      created: result.created,
      skipped: result.skipped,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      skipped: result.skipped,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Seed Onboarding API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
