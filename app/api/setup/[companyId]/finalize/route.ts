// app/api/setup/[companyId]/finalize/route.ts
// Finalize strategic setup - save all data, create work items

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { SetupFormData } from '@/app/c/[companyId]/brain/setup/types';
import { createWorkItem } from '@/lib/airtable/workItems';
import type { WorkSourceSetupWizard } from '@/lib/types/work';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const body = await request.json();
    const { formData } = body as { formData: Partial<SetupFormData> };

    // Get existing context graph (data should already be saved via saveStep)
    const graph = await getOrCreateContextGraph(companyId, formData.businessIdentity?.businessName || 'Company');

    // Save the graph to ensure any final changes are persisted
    await saveContextGraph(graph);

    // Create recommended work items based on the setup data
    const workItems = await createRecommendedWorkItems(companyId, formData);

    return NextResponse.json({
      success: true,
      completedAt: new Date().toISOString(),
      workItemsCreated: workItems.length,
    });
  } catch (error) {
    console.error('Finalize error:', error);
    return NextResponse.json(
      { error: 'Failed to finalize setup' },
      { status: 500 }
    );
  }
}

// Create recommended work items based on setup findings
async function createRecommendedWorkItems(
  companyId: string,
  formData: Partial<SetupFormData>
): Promise<string[]> {
  const workItemIds: string[] = [];

  // Source for all work items created from setup
  const source: WorkSourceSetupWizard = {
    sourceType: 'setup_wizard',
  };

  try {
    // Create work item for critical website issues
    if (formData.website?.criticalIssues && formData.website.criticalIssues.length > 0) {
      const item = await createWorkItem({
        companyId,
        title: 'Address Critical Website Issues',
        notes: `Critical issues identified during strategic setup:\n\n${formData.website.criticalIssues.map(i => `- ${i}`).join('\n')}`,
        area: 'Website UX',
        severity: 'High',
        status: 'Backlog',
        source,
      });
      if (item) workItemIds.push(item.id);
    }

    // Create work item for quick wins
    if (formData.website?.quickWins && formData.website.quickWins.length > 0) {
      const item = await createWorkItem({
        companyId,
        title: 'Implement Quick Win Improvements',
        notes: `Quick wins identified during strategic setup:\n\n${formData.website.quickWins.map(w => `- ${w}`).join('\n')}`,
        area: 'Website UX',
        severity: 'Medium',
        status: 'Backlog',
        source,
      });
      if (item) workItemIds.push(item.id);
    }

    // Create work item for media opportunities
    if (formData.mediaFoundations?.mediaOpportunities && formData.mediaFoundations.mediaOpportunities.length > 0) {
      const item = await createWorkItem({
        companyId,
        title: 'Explore Media Opportunities',
        notes: `Media opportunities identified during strategic setup:\n\n${formData.mediaFoundations.mediaOpportunities.map(o => `- ${o}`).join('\n')}`,
        area: 'Funnel',
        severity: 'Medium',
        status: 'Backlog',
        source,
      });
      if (item) workItemIds.push(item.id);
    }

    // Create work item for measurement setup if incomplete
    if (!formData.measurement?.ga4PropertyId) {
      const item = await createWorkItem({
        companyId,
        title: 'Complete GA4 Tracking Setup',
        notes: 'GA4 property ID was not configured during strategic setup. Complete tracking configuration to enable proper measurement.',
        area: 'Analytics',
        severity: 'High',
        status: 'Backlog',
        source,
      });
      if (item) workItemIds.push(item.id);
    }

    // Create work item for creative strategy implementation
    if (formData.creativeStrategy?.coreMessages && formData.creativeStrategy.coreMessages.length > 0) {
      const item = await createWorkItem({
        companyId,
        title: 'Develop Creative Assets',
        notes: `Create creative assets based on strategic messaging:\n\nCore Messages:\n${formData.creativeStrategy.coreMessages.map(m => `- ${m}`).join('\n')}\n\nCTAs:\n${(formData.creativeStrategy.callToActions || []).map(c => `- ${c}`).join('\n')}`,
        area: 'Brand',
        severity: 'Medium',
        status: 'Backlog',
        source,
      });
      if (item) workItemIds.push(item.id);
    }

  } catch (error) {
    console.error('Error creating work items:', error);
  }

  return workItemIds;
}
