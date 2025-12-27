// app/api/settings/firm-brain/profile/route.ts
// Agency Profile API - Single record CRUD

import { NextResponse } from 'next/server';
import { getAgencyProfile, upsertAgencyProfile } from '@/lib/airtable/firmBrain';
import { AgencyProfileInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/firm-brain/profile
 * Get the agency profile (single record)
 */
export async function GET() {
  try {
    const profile = await getAgencyProfile();
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[firm-brain/profile] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agency profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/firm-brain/profile
 * Create or update the agency profile
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = AgencyProfileInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const profile = await upsertAgencyProfile(parsed.data);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[firm-brain/profile] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update agency profile' },
      { status: 500 }
    );
  }
}
