// app/api/os/companies/[companyId]/projects/[projectId]/route.ts
// Single project CRUD API - Get, update, delete

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectWithDetails,
  getProjectById,
  updateProject,
} from '@/lib/os/projects';
import { deleteProject } from '@/lib/airtable/projects';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; projectId: string }> };

/**
 * GET /api/os/companies/[companyId]/projects/[projectId]
 * Get project with full details (strategy, brief, readiness)
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { companyId, projectId } = await params;

  if (!companyId || !projectId) {
    return NextResponse.json(
      { error: 'Company ID and Project ID are required' },
      { status: 400 }
    );
  }

  try {
    const viewModel = await getProjectWithDetails(projectId);

    if (!viewModel) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify project belongs to company
    if (viewModel.project.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Project does not belong to this company' },
        { status: 403 }
      );
    }

    return NextResponse.json(viewModel);
  } catch (error) {
    console.error('[GET /projects/[projectId]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/os/companies/[companyId]/projects/[projectId]
 * Update a project
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const { companyId, projectId } = await params;

  if (!companyId || !projectId) {
    return NextResponse.json(
      { error: 'Company ID and Project ID are required' },
      { status: 400 }
    );
  }

  try {
    // Verify project exists and belongs to company
    const existing = await getProjectById(projectId);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Project does not belong to this company' },
        { status: 403 }
      );
    }

    // Check if project is locked
    if (existing.isLocked) {
      return NextResponse.json(
        { error: 'Project is locked and cannot be modified' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, status } = body;

    const updates: Partial<typeof existing> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    const updated = await updateProject(projectId, updates);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, project: updated });
  } catch (error) {
    console.error('[PUT /projects/[projectId]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/os/companies/[companyId]/projects/[projectId]
 * Delete a project
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { companyId, projectId } = await params;

  if (!companyId || !projectId) {
    return NextResponse.json(
      { error: 'Company ID and Project ID are required' },
      { status: 400 }
    );
  }

  try {
    // Verify project exists and belongs to company
    const existing = await getProjectById(projectId);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Project does not belong to this company' },
        { status: 403 }
      );
    }

    // Don't allow deleting locked projects
    if (existing.isLocked) {
      return NextResponse.json(
        { error: 'Cannot delete a locked project' },
        { status: 400 }
      );
    }

    const success = await deleteProject(projectId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete project' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /projects/[projectId]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete project' },
      { status: 500 }
    );
  }
}
