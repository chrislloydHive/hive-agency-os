// app/api/os/companies/[companyId]/projects/route.ts
// Project CRUD API - List and create projects

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectsForCompany,
  createProjectWithStrategy,
} from '@/lib/os/projects';
import type { CreateProjectInput } from '@/lib/types/project';
import type { ProjectType } from '@/lib/types/engagement';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string }> };

/**
 * GET /api/os/companies/[companyId]/projects
 * List all projects for a company
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
  }

  try {
    const projects = await getProjectsForCompany(companyId);

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('[GET /projects] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/os/companies/[companyId]/projects
 * Create a new project with strategy
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { engagementId, name, type, description, inheritFromCompanyStrategy } = body;

    // Validate required fields
    if (!engagementId) {
      return NextResponse.json({ error: 'Engagement ID is required' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ error: 'Project type is required' }, { status: 400 });
    }

    const input: CreateProjectInput = {
      companyId,
      engagementId,
      name,
      type: type as ProjectType,
      description,
    };

    const result = await createProjectWithStrategy(input, {
      inheritFromCompanyStrategy: inheritFromCompanyStrategy !== false,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      project: result.project,
      strategy: result.strategy,
    });
  } catch (error) {
    console.error('[POST /projects] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create project' },
      { status: 500 }
    );
  }
}
