// app/api/os/companies/[companyId]/website-lab/v5/bundle-quick-wins/route.ts
// Bundle Quick Wins into Work Items
//
// POST: Creates work items from a batch of quick wins

import { NextRequest, NextResponse } from 'next/server';
import { createWorkItem } from '@/lib/airtable/workItems';
import type { V5QuickWin } from '@/lib/gap-heavy/modules/websiteLabV5';
import type { WorkSource } from '@/lib/types/work';

interface BundleQuickWinsRequest {
  quickWins: V5QuickWin[];
  runId?: string;
}

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { companyId } = await context.params;
    const body = (await request.json()) as BundleQuickWinsRequest;
    const { quickWins, runId } = body;

    if (!quickWins || quickWins.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: quickWins' },
        { status: 400 }
      );
    }

    console.log('[V5 Bundle Quick Wins] Creating work items from quick wins:', {
      companyId,
      count: quickWins.length,
      runId,
    });

    const createdItems: { id: string; title: string }[] = [];
    const errors: string[] = [];

    // Create work items for each quick win
    for (const win of quickWins) {
      try {
        // Build work source metadata
        const source: WorkSource = {
          sourceType: 'diagnostics',
          toolId: 'websiteLab',
          diagnosticRunId: runId || undefined,
        };

        // Build notes from quick win details
        const notesParts: string[] = [];
        notesParts.push(`**Action:** ${win.action}`);
        notesParts.push(`**Page:** ${win.page}`);
        if (win.expectedImpact) {
          notesParts.push(`**Expected Impact:** ${win.expectedImpact}`);
        }
        notesParts.push(`**Addresses Issue:** #${win.addressesIssueId}`);

        const workItem = await createWorkItem({
          title: win.title,
          companyId,
          notes: notesParts.join('\n'),
          area: 'Website UX',
          severity: 'Medium', // Quick wins are typically medium priority
          status: 'Backlog',
          source,
        });

        if (workItem) {
          createdItems.push({ id: workItem.id, title: workItem.title });
        } else {
          errors.push(`Failed to create work item for: ${win.title}`);
        }
      } catch (error) {
        console.error('[V5 Bundle Quick Wins] Error creating work item:', error);
        errors.push(`Error creating work item for: ${win.title}`);
      }
    }

    console.log('[V5 Bundle Quick Wins] Completed:', {
      created: createdItems.length,
      errors: errors.length,
    });

    return NextResponse.json({
      success: createdItems.length > 0,
      createdCount: createdItems.length,
      items: createdItems,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[V5 Bundle Quick Wins] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
