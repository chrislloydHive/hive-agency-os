// app/api/os/companies/[companyId]/projects/[projectId]/brief/generate/route.ts
// Generate creative brief from project strategy

import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/os/projects';
import { generateCreativeBrief } from '@/lib/os/projects/briefGeneration';
import { linkBriefToProject } from '@/lib/airtable/projects';

export const maxDuration = 180; // 3 minutes for AI generation

type Params = { params: Promise<{ companyId: string; projectId: string }> };

/**
 * POST /api/os/companies/[companyId]/projects/[projectId]/brief/generate
 * Generate creative brief from project strategy
 *
 * Body:
 * - mode: 'create' | 'replace' | 'improve'
 * - guidance?: string (optional user guidance)
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

    // Parse request body
    const body = await request.json();
    const { mode = 'create', guidance } = body;

    // Validate mode
    if (!['create', 'replace', 'improve'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be: create, replace, or improve' },
        { status: 400 }
      );
    }

    console.log(`[brief/generate] Generating brief for project ${projectId} (mode: ${mode})`);

    // Generate brief
    const result = await generateCreativeBrief({
      projectId,
      mode,
      guidance,
    });

    // Check for errors
    if ('error' in result) {
      // Check for specific gating errors
      if (result.error.includes('GAP')) {
        return NextResponse.json(
          {
            error: result.error,
            gapRequired: true,
          },
          { status: 400 }
        );
      }
      if (result.error.includes('accepted') || result.error.includes('bet')) {
        return NextResponse.json(
          {
            error: result.error,
            acceptedBetsRequired: true,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Link brief to project
    await linkBriefToProject(projectId, result.brief.id);

    console.log(`[brief/generate] Brief generated successfully: ${result.brief.id}`);

    return NextResponse.json({
      success: true,
      brief: result.brief,
      reasoning: result.reasoning,
      inputsUsed: result.inputsUsed,
      inputsUsedBadges: result.inputsUsedBadges,
    });
  } catch (error) {
    console.error('[POST /brief/generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Brief generation failed' },
      { status: 500 }
    );
  }
}
