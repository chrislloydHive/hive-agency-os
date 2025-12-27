// app/api/settings/firm-brain/team-members/route.ts
// Team Members API - List and Create

import { NextResponse } from 'next/server';
import { getTeamMembers, createTeamMember } from '@/lib/airtable/firmBrain';
import { TeamMemberInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/firm-brain/team-members
 * List all team members
 */
export async function GET() {
  try {
    const members = await getTeamMembers();
    return NextResponse.json({ members });
  } catch (error) {
    console.error('[firm-brain/team-members] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/firm-brain/team-members
 * Create a new team member
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = TeamMemberInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const member = await createTeamMember(parsed.data);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error('[firm-brain/team-members] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create team member' },
      { status: 500 }
    );
  }
}
