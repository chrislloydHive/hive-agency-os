// app/api/os/dma/work-item/route.ts
// Create work items from DMA Funnel insights, quick wins, experiments, or blueprint actions

import { NextResponse } from 'next/server';
import { createWorkItem, type WorkItemArea, type WorkItemSeverity } from '@/lib/airtable/workItems';
import type { WorkSourceDmaFunnel } from '@/lib/types/work';

// Default company ID for DMA work items (Hive Agency)
// You can set this via env var or modify to look up dynamically
const DMA_COMPANY_ID = process.env.DMA_DEFAULT_COMPANY_ID || 'recWofrWdHQOwDIBP';

interface CreateDmaWorkItemRequest {
  title: string;
  description?: string;
  itemType: 'quick_win' | 'experiment' | 'blueprint_action';
  priority?: 'low' | 'medium' | 'high';
  dateRange?: string;
  // Optional: override the default company ID
  companyId?: string;
}

function mapPriorityToSeverity(priority?: string): WorkItemSeverity {
  switch (priority) {
    case 'high':
      return 'High';
    case 'low':
      return 'Low';
    default:
      return 'Medium';
  }
}

function getAreaFromItemType(itemType: string): WorkItemArea {
  // DMA funnel items are typically demand generation / funnel focused
  if (itemType === 'blueprint_action') {
    return 'Strategy';
  }
  return 'Funnel';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateDmaWorkItemRequest;

    // Validate required fields
    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!body.itemType) {
      return NextResponse.json({ error: 'Item type is required' }, { status: 400 });
    }

    const validItemTypes = ['quick_win', 'experiment', 'blueprint_action'];
    if (!validItemTypes.includes(body.itemType)) {
      return NextResponse.json(
        { error: `Invalid item type. Must be one of: ${validItemTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Build source metadata
    const source: WorkSourceDmaFunnel = {
      sourceType: 'dma_funnel',
      itemType: body.itemType,
      insightText: body.description?.slice(0, 500),
      dateRange: body.dateRange,
    };

    // Build notes
    const notesParts: string[] = [];
    notesParts.push(`Source: DMA Funnel ${body.itemType.replace('_', ' ')}`);
    if (body.dateRange) {
      notesParts.push(`Period: ${body.dateRange}`);
    }
    if (body.description) {
      notesParts.push(body.description);
    }
    const notes = notesParts.join('\n\n');

    // Create the work item
    const workItem = await createWorkItem({
      title: body.title,
      companyId: body.companyId || DMA_COMPANY_ID,
      notes,
      area: getAreaFromItemType(body.itemType),
      severity: mapPriorityToSeverity(body.priority),
      status: 'Backlog',
      source,
    });

    if (!workItem) {
      return NextResponse.json(
        { error: 'Failed to create work item' },
        { status: 500 }
      );
    }

    console.log('[DMA Work Item] Created:', {
      id: workItem.id,
      title: workItem.title,
      itemType: body.itemType,
    });

    return NextResponse.json({
      success: true,
      workItem: {
        id: workItem.id,
        title: workItem.title,
        status: workItem.status,
        area: workItem.area,
      },
    });
  } catch (error) {
    console.error('[DMA Work Item] Error creating work item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
