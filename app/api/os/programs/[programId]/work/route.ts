// app/api/os/programs/[programId]/work/route.ts
// Work items for a program
//
// GET: Returns work items linked to this program with status summary
// POST: Create work from a deliverable (with scope checking and event logging)

import { NextRequest, NextResponse } from 'next/server';
import { getPlanningProgram, updatePlanningProgram } from '@/lib/airtable/planningPrograms';
import {
  getWorkItemsByIds,
  createWorkItem,
  getWorkItemsForCompany,
  type WorkItemRecord,
  type WorkItemStatus,
  type WorkItemArea,
} from '@/lib/airtable/workItems';
import { performScopeCheck } from '@/lib/os/programs/scopeGuard';
import {
  logWorkCreation,
  logWorkCreationSkipped,
  logScopeViolation,
} from '@/lib/observability/operationalEvents';
import type { WorkstreamType } from '@/lib/types/program';

// ============================================================================
// Workstream → WorkItemArea Mapping
// ============================================================================

const WORKSTREAM_TO_AREA: Record<WorkstreamType, WorkItemArea> = {
  content: 'Content',
  brand: 'Brand',
  social: 'Content', // Social content → Content area
  seo: 'SEO',
  paid_media: 'Analytics', // Paid media → Analytics area
  partnerships: 'Strategy', // Partnerships → Strategy area
  analytics: 'Analytics',
  ops: 'Operations',
  website: 'Website UX',
  email: 'Content', // Email → Content area
  conversion: 'Funnel',
  other: 'Other',
};

function mapWorkstreamToArea(workstream: WorkstreamType): WorkItemArea {
  return WORKSTREAM_TO_AREA[workstream] || 'Other';
}

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

// ============================================================================
// POST: Create work from deliverable
// ============================================================================

interface CreateWorkFromDeliverableRequest {
  deliverableId: string;
  deliverableTitle: string;
  workstream: WorkstreamType;
  dueDate?: string;
  description?: string;
}

interface CreateWorkFromDeliverableResponse {
  success: boolean;
  status: 'created' | 'already_exists' | 'scope_violation' | 'error';
  workItemId?: string;
  workItemTitle?: string;
  existingWorkItemId?: string;
  debugId: string;
  scopeViolation?: {
    code: string;
    message: string;
    recommendedActions: Array<{ id: string; label: string; type: string }>;
  };
  error?: string;
}

/**
 * POST /api/os/programs/[programId]/work
 * Create work item from a deliverable
 *
 * Performs scope checking if program.scopeEnforced is true.
 * Logs events for observability.
 * Returns debugId for UI display.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<CreateWorkFromDeliverableResponse>> {
  const { programId } = await params;

  try {
    const body: CreateWorkFromDeliverableRequest = await request.json();
    const { deliverableId, deliverableTitle, workstream, dueDate, description } = body;

    // Validate required fields
    if (!deliverableId || !deliverableTitle || !workstream) {
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          debugId: '',
          error: 'Missing required fields: deliverableId, deliverableTitle, workstream',
        },
        { status: 400 }
      );
    }

    // Fetch program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          debugId: '',
          error: 'Program not found',
        },
        { status: 404 }
      );
    }

    // Get current active work count for concurrency check
    const existingWorkItems = await getWorkItemsForCompany(program.companyId);
    const completedStatuses: Array<WorkItemStatus | undefined> = ['Done'];
    const activeWorkForProgram = existingWorkItems.filter((w) => {
      const isLinkedToProgram = program.commitment.workItemIds?.includes(w.id);
      const isActive = !completedStatuses.includes(w.status);
      return isLinkedToProgram && isActive;
    });

    // Perform scope check if scope enforcement is enabled
    if (program.scopeEnforced) {
      const scopeCheck = performScopeCheck({
        program,
        proposedWorkstream: workstream,
        currentActiveWorkCount: activeWorkForProgram.length,
      });

      if (!scopeCheck.allowed && scopeCheck.violation) {
        // Log scope violation event
        const debugId = await logScopeViolation(program.companyId, {
          code: scopeCheck.violation.code,
          programId: program.id,
          programTitle: program.title,
          domain: scopeCheck.violation.context.domain,
          blockedAction: scopeCheck.violation.blockedAction,
          attemptedWorkstream: workstream,
          currentCount: scopeCheck.violation.context.currentCount,
          limit: scopeCheck.violation.context.limit,
          recommendedActions: scopeCheck.violation.recommendedActions.map((a) => ({
            id: a.id,
            label: a.label,
            type: a.type,
          })),
        });

        return NextResponse.json(
          {
            success: false,
            status: 'scope_violation',
            debugId,
            scopeViolation: {
              code: scopeCheck.violation.code,
              message: scopeCheck.violation.message,
              recommendedActions: scopeCheck.violation.recommendedActions.map((a) => ({
                id: a.id,
                label: a.label,
                type: a.type,
              })),
            },
          },
          { status: 403 }
        );
      }
    }

    // Check if work already exists for this deliverable (idempotency)
    const existingWork = existingWorkItems.find((w) => {
      if (typeof w.source === 'object' && w.source) {
        const source = w.source as { planningProgramDeliverableId?: string };
        return source.planningProgramDeliverableId === deliverableId;
      }
      return false;
    });

    if (existingWork) {
      const debugId = await logWorkCreationSkipped(program.companyId, {
        workItemId: existingWork.id,
        title: existingWork.title,
        workstream,
        programId: program.id,
        programTitle: program.title,
        deliverableId,
        deliverableTitle,
        sourceContext: 'deliverable_conversion',
        status: 'already_exists',
        existingWorkItemId: existingWork.id,
      });

      return NextResponse.json({
        success: true,
        status: 'already_exists',
        workItemId: existingWork.id,
        workItemTitle: existingWork.title,
        existingWorkItemId: existingWork.id,
        debugId,
      });
    }

    // Create work item
    // Note: We store the deliverableId in the source JSON for tracking
    const workItem = await createWorkItem({
      title: deliverableTitle,
      companyId: program.companyId,
      area: mapWorkstreamToArea(workstream),
      status: 'Backlog',
      dueDate,
      notes: description ? `${description}\n\nSource: Deliverable ${deliverableId}` : `Source: Deliverable ${deliverableId}`,
      source: {
        sourceType: 'planning_program',
        programId: program.id,
        planningProgramDeliverableId: deliverableId,
      } as any, // Extended source type for PlanningProgram
    });

    if (!workItem) {
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          debugId: '',
          error: 'Failed to create work item',
        },
        { status: 500 }
      );
    }

    // Update program's commitment with new work item
    const updatedWorkItemIds = [...(program.commitment.workItemIds || []), workItem.id];
    await updatePlanningProgram(program.id, {
      commitment: {
        ...program.commitment,
        workItemIds: updatedWorkItemIds,
      },
    });

    // Log work creation event
    const debugId = await logWorkCreation(program.companyId, {
      workItemId: workItem.id,
      title: workItem.title,
      workstream,
      programId: program.id,
      programTitle: program.title,
      deliverableId,
      deliverableTitle,
      sourceContext: 'deliverable_conversion',
      status: 'created',
    });

    return NextResponse.json({
      success: true,
      status: 'created',
      workItemId: workItem.id,
      workItemTitle: workItem.title,
      debugId,
    });
  } catch (error) {
    console.error('[Programs/Work POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'error',
        debugId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
