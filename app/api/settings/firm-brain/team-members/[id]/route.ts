// app/api/settings/firm-brain/team-members/[id]/route.ts
// Individual Team Member API - Get, Update, Delete

import { NextResponse } from 'next/server';
import {
  getTeamMemberById,
  updateTeamMember,
  deleteTeamMember,
} from '@/lib/airtable/firmBrain';
import { TeamMemberInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/settings/firm-brain/team-members/[id]
 * Get a specific team member
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const member = await getTeamMemberById(id);

    if (!member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('[firm-brain/team-members/[id]] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team member' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/firm-brain/team-members/[id]
 * Update a team member
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = TeamMemberInputSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const member = await updateTeamMember(id, parsed.data);

    if (!member) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('[firm-brain/team-members/[id]] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update team member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/firm-brain/team-members/[id]
 * Delete a team member
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await deleteTeamMember(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete team member' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[firm-brain/team-members/[id]] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete team member' },
      { status: 500 }
    );
  }
}
