// app/api/os/companies/[companyId]/projects/[projectId]/brief/approve/route.ts
// Approve creative brief and lock project/strategy

import { NextRequest, NextResponse } from 'next/server';
import { getProjectById, approveBriefAndLockProject } from '@/lib/os/projects';
import { getCreativeBriefByProjectId, approveBrief } from '@/lib/airtable/creativeBriefs';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; projectId: string }> };

/**
 * POST /api/os/companies/[companyId]/projects/[projectId]/brief/approve
 * Approve creative brief and lock project + strategy
 *
 * Body:
 * - briefId: string (required)
 * - approvalNotes?: string (optional)
 * - approvedBy?: string (optional)
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { companyId, projectId } = await params;

  if (!companyId || !projectId) {
    return NextResponse.json(
      { error: 'Company ID and Project ID are required' },
      { status: 400 }
    );
  }

  try {
    // Verify project exists and belongs to company
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Project does not belong to this company' },
        { status: 403 }
      );
    }

    // Check if already locked
    if (project.isLocked) {
      return NextResponse.json(
        { error: 'Project is already locked' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { briefId, approvalNotes, approvedBy } = body;

    if (!briefId) {
      return NextResponse.json({ error: 'Brief ID is required' }, { status: 400 });
    }

    // Verify brief exists and belongs to project
    const brief = await getCreativeBriefByProjectId(projectId);
    if (!brief || brief.id !== briefId) {
      return NextResponse.json(
        { error: 'Brief not found or does not belong to this project' },
        { status: 404 }
      );
    }

    // Check if brief is already approved
    if (brief.status === 'approved') {
      return NextResponse.json(
        { error: 'Brief is already approved' },
        { status: 400 }
      );
    }

    console.log(`[brief/approve] Approving brief ${briefId} for project ${projectId}`);

    // Approve brief in Airtable
    const approvedBriefResult = await approveBrief(briefId, approvedBy, approvalNotes);
    if (!approvedBriefResult) {
      return NextResponse.json(
        { error: 'Failed to approve brief' },
        { status: 500 }
      );
    }

    // Lock project and strategy
    const lockResult = await approveBriefAndLockProject(projectId, briefId, approvedBy);
    if (!lockResult.success) {
      return NextResponse.json(
        { error: lockResult.error || 'Failed to lock project' },
        { status: 500 }
      );
    }

    console.log(`[brief/approve] Brief approved and project locked`);

    return NextResponse.json({
      success: true,
      brief: approvedBriefResult,
      project: lockResult.project,
      strategy: lockResult.strategy,
      projectLocked: true,
      strategyLocked: true,
    });
  } catch (error) {
    console.error('[POST /brief/approve] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Brief approval failed' },
      { status: 500 }
    );
  }
}
