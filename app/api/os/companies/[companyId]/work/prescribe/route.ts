// app/api/os/companies/[companyId]/work/prescribe/route.ts
// API endpoint for creating user-prescribed work items
//
// Allows users to directly create work items without AI discovery.
// Used in Website Optimization flow when users know exactly what needs to be done.

import { NextRequest, NextResponse } from 'next/server';
import { createWorkItem, type WorkItemArea } from '@/lib/airtable/workItems';
import type { WorkSourceUserPrescribed } from '@/lib/types/work';

/**
 * Request body for prescribing work
 */
interface PrescribeWorkRequest {
  workType: 'seo_copy' | 'landing_page_copy' | 'page_edits' | 'other';
  scope: string;
  goal: string;
  notes?: string;
  projectContext?: string;
}

/**
 * Map work type to WorkItemArea
 */
function mapWorkTypeToArea(workType: PrescribeWorkRequest['workType']): WorkItemArea {
  switch (workType) {
    case 'seo_copy':
      return 'SEO';
    case 'landing_page_copy':
      return 'Content';
    case 'page_edits':
      return 'Website UX';
    case 'other':
    default:
      return 'Other';
  }
}

/**
 * Map work type to human-readable label
 */
function mapWorkTypeToLabel(workType: PrescribeWorkRequest['workType']): string {
  switch (workType) {
    case 'seo_copy':
      return 'SEO Copy Updates';
    case 'landing_page_copy':
      return 'Landing Page Copy';
    case 'page_edits':
      return 'Page Edits';
    case 'other':
    default:
      return 'Other Work';
  }
}

/**
 * Generate title from work type and scope
 */
function generateTitle(workType: PrescribeWorkRequest['workType'], scope: string): string {
  const typeLabel = mapWorkTypeToLabel(workType);
  // Create a concise title using the work type and first part of scope
  const scopePreview = scope.length > 50 ? scope.slice(0, 50) + '...' : scope;
  return `${typeLabel}: ${scopePreview}`;
}

/**
 * Generate notes from prescribed work data
 */
function generateNotes(data: PrescribeWorkRequest): string {
  const parts: string[] = [];

  parts.push(`**Work Type:** ${mapWorkTypeToLabel(data.workType)}`);
  parts.push(`**Scope:** ${data.scope}`);
  parts.push(`**Goal:** ${data.goal}`);

  if (data.notes) {
    parts.push(`**Notes/Constraints:** ${data.notes}`);
  }

  return parts.join('\n\n');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await context.params;
    const body = await request.json() as PrescribeWorkRequest;

    // Validate required fields
    if (!body.workType) {
      return NextResponse.json(
        { error: 'workType is required' },
        { status: 400 }
      );
    }

    if (!body.scope || !body.scope.trim()) {
      return NextResponse.json(
        { error: 'scope is required' },
        { status: 400 }
      );
    }

    if (!body.goal || !body.goal.trim()) {
      return NextResponse.json(
        { error: 'goal is required' },
        { status: 400 }
      );
    }

    // Build source metadata
    const source: WorkSourceUserPrescribed = {
      sourceType: 'user_prescribed',
      projectContext: body.projectContext || 'website_optimization',
      workType: body.workType,
      scope: body.scope.trim(),
      goal: body.goal.trim(),
      notes: body.notes?.trim(),
    };

    // Create the work item
    const workItem = await createWorkItem({
      title: generateTitle(body.workType, body.scope.trim()),
      companyId,
      notes: generateNotes(body),
      area: mapWorkTypeToArea(body.workType),
      severity: 'Medium',
      status: 'Backlog',
      source,
    });

    if (!workItem) {
      return NextResponse.json(
        { error: 'Failed to create work item' },
        { status: 500 }
      );
    }

    console.log('[Prescribe Work] Created work item:', {
      workItemId: workItem.id,
      companyId,
      workType: body.workType,
    });

    return NextResponse.json({
      success: true,
      workItem,
    });
  } catch (error) {
    console.error('[Prescribe Work] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
