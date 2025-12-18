// app/api/os/companies/[companyId]/projects/[projectId]/work/from-brief/route.ts
// Generate work items from approved creative brief

import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/os/projects';
import { getCreativeBriefByProjectId } from '@/lib/airtable/creativeBriefs';
import { createWorkItem, type CreateWorkItemInput } from '@/lib/airtable/workItems';
import type { ProjectType } from '@/lib/types/engagement';
import type { WorkItemArea, WorkSourceCreativeBrief, WorkItemSeverity } from '@/lib/types/work';

export const maxDuration = 120;

/**
 * Map template category to WorkItemArea
 */
function mapCategoryToArea(category: string): WorkItemArea | undefined {
  const mapping: Record<string, WorkItemArea> = {
    brand: 'Brand',
    content: 'Content',
    seo: 'SEO',
    website: 'Website UX',
    analytics: 'Funnel',
    demand: 'Funnel',
    ops: 'Brand', // Default ops tasks to Brand
  };
  return mapping[category];
}

/**
 * Map template priority to WorkItemSeverity
 */
function mapPriorityToSeverity(priority: string): WorkItemSeverity {
  const mapping: Record<string, WorkItemSeverity> = {
    P0: 'Critical',
    P1: 'High',
    P2: 'Medium',
    P3: 'Low',
  };
  return mapping[priority] || 'Medium';
}

type Params = { params: Promise<{ companyId: string; projectId: string }> };

/**
 * Work item templates by project type
 */
const WORK_TEMPLATES: Record<ProjectType, Array<{
  title: string;
  description?: string;
  category: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  conditional?: (brief: { mandatories?: string[] }) => boolean;
}>> = {
  print_ad: [
    {
      title: 'Write headline + body copy',
      description: 'Draft headline options and body copy based on the creative brief',
      category: 'content',
      priority: 'P1',
    },
    {
      title: 'Design layout concepts (3)',
      description: 'Create 3 distinct layout concepts for review',
      category: 'brand',
      priority: 'P1',
    },
    {
      title: 'Select final concept',
      description: 'Review concepts and select final direction',
      category: 'brand',
      priority: 'P2',
    },
    {
      title: 'Produce print-ready file (PDF/X)',
      description: 'Prepare final artwork with proper bleeds and color settings',
      category: 'brand',
      priority: 'P2',
    },
    {
      title: 'Compliance/legal review',
      description: 'Review disclaimers and legal requirements',
      category: 'ops',
      priority: 'P1',
      conditional: (brief) =>
        brief.mandatories?.some(m =>
          m.toLowerCase().includes('disclaimer') ||
          m.toLowerCase().includes('legal')
        ) ?? false,
    },
  ],
  website: [
    {
      title: 'Define site structure and navigation',
      category: 'website',
      priority: 'P1',
    },
    {
      title: 'Create wireframes',
      category: 'website',
      priority: 'P1',
    },
    {
      title: 'Design visual mockups',
      category: 'brand',
      priority: 'P1',
    },
    {
      title: 'Write page copy',
      category: 'content',
      priority: 'P1',
    },
    {
      title: 'Development and build',
      category: 'website',
      priority: 'P1',
    },
    {
      title: 'QA and testing',
      category: 'ops',
      priority: 'P2',
    },
  ],
  campaign: [
    {
      title: 'Finalize campaign creative direction',
      category: 'brand',
      priority: 'P1',
    },
    {
      title: 'Create campaign assets',
      category: 'brand',
      priority: 'P1',
    },
    {
      title: 'Set up media plan',
      category: 'demand',
      priority: 'P1',
    },
    {
      title: 'Launch campaign',
      category: 'demand',
      priority: 'P1',
    },
    {
      title: 'Monitor and optimize',
      category: 'analytics',
      priority: 'P2',
    },
  ],
  content: [
    {
      title: 'Develop content calendar',
      category: 'content',
      priority: 'P1',
    },
    {
      title: 'Create content briefs',
      category: 'content',
      priority: 'P1',
    },
    {
      title: 'Write and produce content',
      category: 'content',
      priority: 'P1',
    },
    {
      title: 'Review and approve content',
      category: 'content',
      priority: 'P2',
    },
    {
      title: 'Publish and distribute',
      category: 'content',
      priority: 'P2',
    },
  ],
  other: [
    {
      title: 'Define project deliverables',
      category: 'other',
      priority: 'P1',
    },
    {
      title: 'Execute project work',
      category: 'other',
      priority: 'P1',
    },
    {
      title: 'Review and approve',
      category: 'other',
      priority: 'P2',
    },
  ],
};

/**
 * POST /api/os/companies/[companyId]/projects/[projectId]/work/from-brief
 * Generate work items from approved creative brief
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

    // Verify brief is approved
    if (brief.status !== 'approved') {
      return NextResponse.json(
        { error: 'Brief must be approved before generating work items' },
        { status: 400 }
      );
    }

    console.log(`[work/from-brief] Generating work items for project ${projectId}`);

    // Get work templates for project type
    const templates = WORK_TEMPLATES[project.type] || WORK_TEMPLATES.other;

    // Filter conditional templates
    const applicableTemplates = templates.filter(template => {
      if (template.conditional) {
        return template.conditional({
          mandatories: brief.content.mandatories,
        });
      }
      return true;
    });

    // Create work items
    const createdItems: string[] = [];
    const errors: string[] = [];

    // Build source for tracking
    const source: WorkSourceCreativeBrief = {
      sourceType: 'creative_brief',
      briefId: brief.id,
      briefTitle: brief.title,
      projectId,
      projectType: brief.projectType,
    };

    for (const template of applicableTemplates) {
      const workItemInput: CreateWorkItemInput = {
        companyId,
        title: template.title,
        notes: template.description || '',
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

    console.log(`[work/from-brief] Created ${createdItems.length} work items`);

    return NextResponse.json({
      success: true,
      createdCount: createdItems.length,
      createdIds: createdItems,
      errors: errors.length > 0 ? errors : undefined,
      projectType: project.type,
    });
  } catch (error) {
    console.error('[POST /work/from-brief] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Work generation failed' },
      { status: 500 }
    );
  }
}
