// app/api/os/companies/[companyId]/website-lab/v5/create-work/route.ts
// Create Work Item from V5 Blocking Issue
//
// POST: Creates a work item from a blocking issue

import { NextRequest, NextResponse } from 'next/server';
import { createWorkItem } from '@/lib/airtable/workItems';
import type { V5BlockingIssue } from '@/lib/gap-heavy/modules/websiteLabV5';
import type { WorkSource } from '@/lib/types/work';

interface CreateWorkRequest {
  issue: V5BlockingIssue;
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
    const body = (await request.json()) as CreateWorkRequest;
    const { issue, runId } = body;

    if (!issue) {
      return NextResponse.json(
        { error: 'Missing required field: issue' },
        { status: 400 }
      );
    }

    console.log('[V5 Create Work] Creating work item from blocking issue:', {
      companyId,
      issueId: issue.id,
      severity: issue.severity,
      page: issue.page,
    });

    // Map severity to work item severity
    const severityMap: Record<string, 'Critical' | 'High' | 'Medium' | 'Low'> = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    // Build work source metadata
    const source: WorkSource = {
      sourceType: 'diagnostics',
      toolId: 'websiteLab',
      diagnosticRunId: runId || undefined,
    };

    // Build notes from issue details
    const notesParts: string[] = [];
    notesParts.push(`**Problem:** ${issue.whyItBlocks}`);
    notesParts.push(`**Page:** ${issue.page}`);
    notesParts.push(`**Affected Personas:** ${issue.affectedPersonas.join(', ')}`);
    notesParts.push('');
    notesParts.push(`**Fix:** ${issue.concreteFix.what}`);
    notesParts.push(`**Where:** ${issue.concreteFix.where}`);

    const workItem = await createWorkItem({
      title: issue.whyItBlocks.substring(0, 100) + (issue.whyItBlocks.length > 100 ? '...' : ''),
      companyId,
      notes: notesParts.join('\n'),
      area: 'Website UX',
      severity: severityMap[issue.severity] || 'Medium',
      status: 'Backlog',
      source,
    });

    if (!workItem) {
      return NextResponse.json(
        { error: 'Failed to create work item' },
        { status: 500 }
      );
    }

    console.log('[V5 Create Work] Work item created successfully:', {
      workItemId: workItem.id,
      title: workItem.title,
    });

    return NextResponse.json({
      success: true,
      workItemId: workItem.id,
      title: workItem.title,
    });
  } catch (error) {
    console.error('[V5 Create Work] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
