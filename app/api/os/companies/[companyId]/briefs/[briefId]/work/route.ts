// app/api/os/companies/[companyId]/briefs/[briefId]/work/route.ts
// Generate work items from an approved brief
//
// POST /api/os/companies/[companyId]/briefs/[briefId]/work
//
// Gating (NON-NEGOTIABLE):
// - Brief MUST be approved before work can be generated

import { NextRequest, NextResponse } from 'next/server';
import { getBriefById } from '@/lib/airtable/briefs';
import { createWorkItem, type CreateWorkItemInput } from '@/lib/airtable/workItems';
import { canGenerateWork } from '@/lib/types/brief';
import type { BriefType } from '@/lib/types/brief';
import type { WorkItemArea, WorkSourceCreativeBrief, WorkItemSeverity } from '@/lib/types/work';

export const maxDuration = 120;

type Params = { params: Promise<{ companyId: string; briefId: string }> };

// ============================================================================
// Work Templates by Brief Type
// ============================================================================

interface WorkTemplate {
  title: string;
  description?: string;
  category: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

const WORK_TEMPLATES: Record<BriefType, WorkTemplate[]> = {
  creative: [
    { title: 'Write headline + body copy', category: 'content', priority: 'P1' },
    { title: 'Design layout concepts (3)', category: 'brand', priority: 'P1' },
    { title: 'Select final concept', category: 'brand', priority: 'P2' },
    { title: 'Produce print-ready file', category: 'brand', priority: 'P2' },
    { title: 'Compliance/legal review', category: 'ops', priority: 'P1' },
  ],
  campaign: [
    { title: 'Finalize campaign creative direction', category: 'brand', priority: 'P1' },
    { title: 'Create campaign assets', category: 'brand', priority: 'P1' },
    { title: 'Set up media plan', category: 'demand', priority: 'P1' },
    { title: 'Launch campaign', category: 'demand', priority: 'P1' },
    { title: 'Monitor and optimize', category: 'analytics', priority: 'P2' },
  ],
  seo: [
    { title: 'Technical SEO audit fixes', category: 'seo', priority: 'P1' },
    { title: 'On-page optimization', category: 'seo', priority: 'P1' },
    { title: 'Content optimization', category: 'content', priority: 'P1' },
    { title: 'Set up measurement', category: 'analytics', priority: 'P2' },
    { title: 'Link building outreach', category: 'seo', priority: 'P2' },
  ],
  content: [
    { title: 'Create content calendar', category: 'content', priority: 'P1' },
    { title: 'Write content briefs for each piece', category: 'content', priority: 'P1' },
    { title: 'Draft content', category: 'content', priority: 'P1' },
    { title: 'Review and edit', category: 'content', priority: 'P2' },
    { title: 'Distribute content', category: 'demand', priority: 'P2' },
  ],
  website: [
    { title: 'Define site structure and navigation', category: 'website', priority: 'P1' },
    { title: 'Create wireframes', category: 'website', priority: 'P1' },
    { title: 'Design visual mockups', category: 'brand', priority: 'P1' },
    { title: 'Write page copy', category: 'content', priority: 'P1' },
    { title: 'Development and build', category: 'website', priority: 'P1' },
    { title: 'QA and testing', category: 'ops', priority: 'P2' },
    { title: 'Launch', category: 'ops', priority: 'P2' },
  ],
  program: [
    { title: 'Define program phases', category: 'ops', priority: 'P1' },
    { title: 'Create phase 1 plan', category: 'ops', priority: 'P1' },
    { title: 'Execute phase 1', category: 'ops', priority: 'P1' },
  ],
};

// ============================================================================
// Helpers
// ============================================================================

function mapCategoryToArea(category: string): WorkItemArea | undefined {
  const mapping: Record<string, WorkItemArea> = {
    brand: 'Brand',
    content: 'Content',
    seo: 'SEO',
    website: 'Website UX',
    analytics: 'Funnel',
    demand: 'Funnel',
    ops: 'Brand',
  };
  return mapping[category];
}

function mapPriorityToSeverity(priority: string): WorkItemSeverity {
  const mapping: Record<string, WorkItemSeverity> = {
    P0: 'Critical',
    P1: 'High',
    P2: 'Medium',
    P3: 'Low',
  };
  return mapping[priority] || 'Medium';
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { companyId, briefId } = await params;

    // 1. Get the brief
    const brief = await getBriefById(briefId);
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    // 2. Check gating - brief MUST be approved
    if (!canGenerateWork(brief)) {
      return NextResponse.json(
        {
          error: 'Brief must be approved before generating work',
          briefStatus: brief.status,
        },
        { status: 400 }
      );
    }

    // 3. Get templates for this brief type
    const templates = WORK_TEMPLATES[brief.type] || [];

    if (templates.length === 0) {
      return NextResponse.json(
        { error: `No work templates defined for brief type: ${brief.type}` },
        { status: 400 }
      );
    }

    // 4. Build source for tracking
    const source: WorkSourceCreativeBrief = {
      sourceType: 'creative_brief',
      briefId: brief.id,
      briefTitle: brief.title,
      projectId: brief.projectId || '',
      projectType: brief.type,
    };

    // 5. Create work items
    const createdItems: string[] = [];
    const errors: string[] = [];

    for (const template of templates) {
      const workItemInput: CreateWorkItemInput = {
        companyId,
        title: template.title,
        notes: template.description || `From brief: ${brief.title}`,
        area: mapCategoryToArea(template.category),
        severity: mapPriorityToSeverity(template.priority),
        status: 'Backlog',
        source,
      };

      try {
        const item = await createWorkItem(workItemInput);
        if (item) {
          createdItems.push(item.id);
        } else {
          errors.push(`Failed to create: ${template.title}`);
        }
      } catch (err) {
        errors.push(`Error creating ${template.title}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      briefId: brief.id,
      briefTitle: brief.title,
      workItemsCreated: createdItems.length,
      workItemIds: createdItems,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[API] Work generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
