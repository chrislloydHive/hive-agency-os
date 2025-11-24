/**
 * Create Work Item API Route
 *
 * POST /api/os/create-work-item
 *
 * Creates a Work Item from an OS Priority
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFullReportById } from '@/lib/airtable/fullReports';
import {
  createWorkItemFromPriority,
  type WorkItemStatus,
} from '@/lib/airtable/workItems';
import type { PriorityItem } from '@/lib/airtable/fullReports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateWorkItemRequest {
  companyId: string;
  fullReportId: string;
  priorityId: string;
  overrides?: {
    title?: string;
    owner?: string;
    dueDate?: string;
    status?: WorkItemStatus;
    type?: string;
    notes?: string;
  };
}

interface CreateWorkItemResponse {
  success: boolean;
  workItemId?: string;
  companyId?: string;
  fullReportId?: string;
  sourcePriorityId?: string;
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateWorkItemResponse>> {
  try {
    console.log('[POST /api/os/create-work-item] Starting...');

    // Parse request body
    const body = (await request.json()) as CreateWorkItemRequest;
    const { companyId, fullReportId, priorityId, overrides } = body;

    // Validate required fields
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!fullReportId) {
      return NextResponse.json(
        { success: false, error: 'fullReportId is required' },
        { status: 400 }
      );
    }

    if (!priorityId) {
      return NextResponse.json(
        { success: false, error: 'priorityId is required' },
        { status: 400 }
      );
    }

    console.log('[POST /api/os/create-work-item] Request:', {
      companyId,
      fullReportId,
      priorityId,
      hasOverrides: !!overrides,
    });

    // Fetch the OS Full Report
    console.log('[POST /api/os/create-work-item] Fetching full report...');
    const fullReport = await getFullReportById(fullReportId);

    if (!fullReport) {
      console.error('[POST /api/os/create-work-item] Full report not found:', fullReportId);
      return NextResponse.json(
        { success: false, error: 'Full report not found' },
        { status: 404 }
      );
    }

    // Parse Priorities JSON
    const prioritiesRaw = fullReport.prioritiesJson;

    if (!prioritiesRaw) {
      console.error('[POST /api/os/create-work-item] No priorities found in full report');
      return NextResponse.json(
        { success: false, error: 'No priorities found in full report' },
        { status: 404 }
      );
    }

    // Parse priorities
    let priorities: PriorityItem[];
    try {
      const parsed = typeof prioritiesRaw === 'string'
        ? JSON.parse(prioritiesRaw)
        : prioritiesRaw;

      priorities = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[POST /api/os/create-work-item] Failed to parse priorities JSON:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid priorities JSON in full report' },
        { status: 500 }
      );
    }

    console.log('[POST /api/os/create-work-item] Found', priorities.length, 'priorities');

    // Find the matching priority
    const priority = priorities.find((p) => p.id === priorityId);

    if (!priority) {
      console.error('[POST /api/os/create-work-item] Priority not found:', priorityId);
      return NextResponse.json(
        {
          success: false,
          error: `Priority with id "${priorityId}" not found in full report`,
        },
        { status: 404 }
      );
    }

    console.log('[POST /api/os/create-work-item] Found priority:', {
      id: priority.id,
      title: priority.title,
    });

    // Create the work item
    console.log('[POST /api/os/create-work-item] Creating work item...');
    // Apply overrides to priority before creating work item
    const priorityWithOverrides: PriorityItem = {
      ...priority,
      ...(overrides?.title && { title: overrides.title }),
      ...(overrides?.notes && { summary: overrides.notes }),
    };

    const result = await createWorkItemFromPriority({
      companyId,
      fullReportId,
      priority: priorityWithOverrides,
      defaultStatus: overrides?.status,
    });

    const workItemId = result?.id;

    console.log('[POST /api/os/create-work-item] ✅ Work item created:', workItemId);

    return NextResponse.json({
      success: true,
      workItemId,
      companyId,
      fullReportId,
      sourcePriorityId: priorityId,
    });
  } catch (error: any) {
    console.error('[POST /api/os/create-work-item] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
