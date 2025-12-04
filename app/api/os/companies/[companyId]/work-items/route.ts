// app/api/os/companies/[companyId]/work-items/route.ts
// Work Items CRUD API for a company

import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkItems,
  createWorkItem,
  CreateWorkItemInput,
} from '@/lib/work/workItems';

// GET /api/os/companies/[companyId]/work-items
// Fetch all work items for a company
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const workItems = await getWorkItems(companyId);

    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const area = searchParams.get('area');
    const priority = searchParams.get('priority');

    let filtered = workItems;

    if (status) {
      filtered = filtered.filter((item) => item.status === status);
    }
    if (area) {
      filtered = filtered.filter((item) => item.area === area);
    }
    if (priority) {
      filtered = filtered.filter((item) => item.priority === priority);
    }

    return NextResponse.json({
      success: true,
      workItems: filtered,
      total: workItems.length,
      filtered: filtered.length,
    });
  } catch (error) {
    console.error('[WorkItems API] Error fetching work items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch work items' },
      { status: 500 }
    );
  }
}

// POST /api/os/companies/[companyId]/work-items
// Create a new work item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const body = await request.json();

    const input: CreateWorkItemInput = {
      companyId,
      title: body.title,
      description: body.description,
      area: body.area,
      priority: body.priority,
      status: body.status,
      dueDate: body.dueDate,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
    };

    if (!input.title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const workItem = await createWorkItem(input);

    if (!workItem) {
      return NextResponse.json(
        { error: 'Failed to create work item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workItem,
    });
  } catch (error) {
    console.error('[WorkItems API] Error creating work item:', error);
    return NextResponse.json(
      { error: 'Failed to create work item' },
      { status: 500 }
    );
  }
}
