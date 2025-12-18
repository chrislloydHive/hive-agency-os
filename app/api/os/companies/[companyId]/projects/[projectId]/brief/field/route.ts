// app/api/os/companies/[companyId]/projects/[projectId]/brief/field/route.ts
// AI helper for individual brief fields

import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/os/projects';
import { getCreativeBriefByProjectId, updateBriefField } from '@/lib/airtable/creativeBriefs';
import { aiHelperForBriefField } from '@/lib/os/projects/briefGeneration';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; projectId: string }> };

/**
 * POST /api/os/companies/[companyId]/projects/[projectId]/brief/field
 * AI helper for brief fields (suggest, refine, shorten, expand, variants)
 *
 * Body:
 * - fieldPath: string (e.g., 'content.singleMindedMessage')
 * - currentValue?: string
 * - action: 'suggest' | 'refine' | 'shorten' | 'expand' | 'variants'
 * - guidance?: string
 * - apply?: boolean (if true, apply the suggestion to the brief)
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

    // Get brief
    const brief = await getCreativeBriefByProjectId(projectId);
    if (!brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    // Check if brief is locked
    if (brief.isLocked) {
      return NextResponse.json(
        { error: 'Brief is locked and cannot be modified' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { fieldPath, currentValue, action, guidance, apply } = body;

    if (!fieldPath) {
      return NextResponse.json({ error: 'Field path is required' }, { status: 400 });
    }
    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Validate action
    const validActions = ['suggest', 'refine', 'shorten', 'expand', 'variants'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[brief/field] AI helper for field ${fieldPath} (action: ${action})`);

    // Call AI helper
    const result = await aiHelperForBriefField({
      projectId,
      fieldPath,
      currentValue,
      action,
      guidance,
    });

    // Check for errors
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // If apply flag is set and we have a single value, update the brief
    let updatedBrief = null;
    if (apply && result.value) {
      updatedBrief = await updateBriefField(brief.id, fieldPath, result.value);
    }

    return NextResponse.json({
      success: true,
      value: result.value,
      variants: result.variants,
      confidence: result.confidence,
      reasoning: result.reasoning,
      applied: apply && result.value ? true : false,
      brief: updatedBrief || undefined,
    });
  } catch (error) {
    console.error('[POST /brief/field] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Field AI helper failed' },
      { status: 500 }
    );
  }
}
