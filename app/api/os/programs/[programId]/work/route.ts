// app/api/os/programs/[programId]/work/route.ts
// Get work items for a committed program
//
// Returns work items linked to this program with status summary
// for displaying execution progress in the ProgramPlanner

import { NextRequest, NextResponse } from 'next/server';
import { getPlanningProgram } from '@/lib/airtable/planningPrograms';
import { getWorkItemsByIds, type WorkItemRecord, type WorkItemStatus } from '@/lib/airtable/workItems';

interface RouteParams {
  params: Promise<{ programId: string }>;
}

interface WorkItemSummary {
  id: string;
  title: string;
  status: WorkItemStatus | undefined;
  area: string | undefined;
  dueDate: string | undefined;
}

interface ExecutionStatusResponse {
  success: boolean;
  programId: string;
  programStatus: string;
  workItems: WorkItemSummary[];
  summary: {
    total: number;
    byStatus: Record<string, number>;
    completionPercent: number;
  };
  error?: string;
}

/**
 * GET /api/os/programs/[programId]/work
 * Returns work items and execution status for a program
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ExecutionStatusResponse>> {
  try {
    const { programId } = await params;

    // Fetch program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        {
          success: false,
          programId,
          programStatus: 'unknown',
          workItems: [],
          summary: { total: 0, byStatus: {}, completionPercent: 0 },
          error: 'Program not found',
        },
        { status: 404 }
      );
    }

    // Get work item IDs from commitment
    const workItemIds = program.commitment.workItemIds || [];

    if (workItemIds.length === 0) {
      return NextResponse.json({
        success: true,
        programId,
        programStatus: program.status,
        workItems: [],
        summary: { total: 0, byStatus: {}, completionPercent: 0 },
      });
    }

    // Fetch work items
    const workItems = await getWorkItemsByIds(workItemIds);

    // Map to summary format
    const workItemSummaries: WorkItemSummary[] = workItems.map((item: WorkItemRecord) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      area: item.area,
      dueDate: item.dueDate,
    }));

    // Calculate status breakdown
    const byStatus: Record<string, number> = {};
    for (const item of workItems) {
      const status = item.status || 'Backlog';
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    // Calculate completion percentage
    const doneCount = byStatus['Done'] || 0;
    const completionPercent = workItems.length > 0
      ? Math.round((doneCount / workItems.length) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      programId,
      programStatus: program.status,
      workItems: workItemSummaries,
      summary: {
        total: workItems.length,
        byStatus,
        completionPercent,
      },
    });
  } catch (error) {
    console.error('[Programs/Work] Error:', error);
    return NextResponse.json(
      {
        success: false,
        programId: '',
        programStatus: 'unknown',
        workItems: [],
        summary: { total: 0, byStatus: {}, completionPercent: 0 },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
