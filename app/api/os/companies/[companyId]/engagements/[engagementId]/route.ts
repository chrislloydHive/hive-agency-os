// app/api/os/companies/[companyId]/engagements/[engagementId]/route.ts
// Individual Engagement CRUD operations

import { NextRequest, NextResponse } from 'next/server';
import {
  getEngagementById,
  updateEngagement,
  deleteEngagement,
} from '@/lib/airtable/engagements';
import type { UpdateEngagementInput } from '@/lib/types/engagement';

// GET /api/os/companies/[companyId]/engagements/[engagementId]
// Get a specific engagement
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; engagementId: string }> }
) {
  const { engagementId } = await params;

  try {
    const engagement = await getEngagementById(engagementId);

    if (!engagement) {
      return NextResponse.json(
        { error: 'Engagement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      engagement,
    });
  } catch (error) {
    console.error('[Engagements API] Error fetching engagement:', error);
    return NextResponse.json(
      { error: 'Failed to fetch engagement' },
      { status: 500 }
    );
  }
}

// PATCH /api/os/companies/[companyId]/engagements/[engagementId]
// Update an engagement
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; engagementId: string }> }
) {
  const { engagementId } = await params;

  try {
    const body = await request.json();

    const updates: UpdateEngagementInput = {};

    if (body.type !== undefined) updates.type = body.type;
    if (body.projectType !== undefined) updates.projectType = body.projectType;
    if (body.projectName !== undefined) updates.projectName = body.projectName;
    if (body.selectedLabs !== undefined) updates.selectedLabs = body.selectedLabs;
    if (body.status !== undefined) updates.status = body.status;
    if (body.gapRunId !== undefined) updates.gapRunId = body.gapRunId;
    if (body.contextApprovedAt !== undefined) updates.contextApprovedAt = body.contextApprovedAt;

    const engagement = await updateEngagement(engagementId, updates);

    return NextResponse.json({
      success: true,
      engagement,
    });
  } catch (error) {
    console.error('[Engagements API] Error updating engagement:', error);
    return NextResponse.json(
      { error: 'Failed to update engagement' },
      { status: 500 }
    );
  }
}

// DELETE /api/os/companies/[companyId]/engagements/[engagementId]
// Delete an engagement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; engagementId: string }> }
) {
  const { engagementId } = await params;

  try {
    await deleteEngagement(engagementId);

    return NextResponse.json({
      success: true,
      message: 'Engagement deleted',
    });
  } catch (error) {
    console.error('[Engagements API] Error deleting engagement:', error);
    return NextResponse.json(
      { error: 'Failed to delete engagement' },
      { status: 500 }
    );
  }
}
