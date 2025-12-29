// app/api/os/funnel/work-item/route.ts
// Create work items from unified Funnel AI insights (DMA, Company, Workspace)

import { NextResponse } from 'next/server';
import { createWorkItem, type WorkItemArea, type WorkItemSeverity } from '@/lib/airtable/workItems';
import type { WorkSourceFunnelInsight } from '@/lib/types/work';

// Default company ID for workspace-level funnel work items (Hive Agency)
const DEFAULT_COMPANY_ID = process.env.DMA_DEFAULT_COMPANY_ID || 'recWofrWdHQOwDIBP';

interface CreateFunnelWorkItemRequest {
  title: string;
  description?: string;
  itemType: 'quick_win' | 'experiment' | 'recommendation';
  priority?: 'low' | 'medium' | 'high';
  dateRange?: string;
  // Funnel context
  funnelContext: 'dma' | 'company' | 'workspace';
  companyId?: string;
  companyName?: string;
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

function getAreaFromContext(context: string): WorkItemArea {
  // Funnel insights are primarily Funnel/Analytics focused
  return 'Funnel';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateFunnelWorkItemRequest;

    // Validate required fields
    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!body.itemType) {
      return NextResponse.json({ error: 'Item type is required' }, { status: 400 });
    }

    if (!body.funnelContext) {
      return NextResponse.json({ error: 'Funnel context is required' }, { status: 400 });
    }

    const validItemTypes = ['quick_win', 'experiment', 'recommendation'];
    if (!validItemTypes.includes(body.itemType)) {
      return NextResponse.json(
        { error: `Invalid item type. Must be one of: ${validItemTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const validContexts = ['dma', 'company', 'workspace'];
    if (!validContexts.includes(body.funnelContext)) {
      return NextResponse.json(
        { error: `Invalid funnel context. Must be one of: ${validContexts.join(', ')}` },
        { status: 400 }
      );
    }

    // Determine company ID
    // For company context, require companyId
    // For dma/workspace, use default if not provided
    const companyId = body.companyId || DEFAULT_COMPANY_ID;
    if (body.funnelContext === 'company' && !body.companyId) {
      return NextResponse.json(
        { error: 'Company ID is required for company funnel context' },
        { status: 400 }
      );
    }

    // Build source metadata
    const source: WorkSourceFunnelInsight = {
      sourceType: 'funnel_insight',
      funnelContext: body.funnelContext,
      companyId: body.companyId,
      companyName: body.companyName,
      itemType: body.itemType,
      insightText: body.description?.slice(0, 500),
      dateRange: body.dateRange,
    };

    // Build notes
    const notesParts: string[] = [];
    const contextLabel = body.funnelContext === 'dma'
      ? 'DMA Funnel'
      : body.funnelContext === 'company'
        ? `${body.companyName || 'Company'} Funnel`
        : 'Workspace Funnel';
    notesParts.push(`Source: ${contextLabel} ${body.itemType.replace('_', ' ')}`);
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
      companyId,
      notes,
      area: getAreaFromContext(body.funnelContext),
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

    console.log('[Funnel Work Item] Created:', {
      id: workItem.id,
      title: workItem.title,
      funnelContext: body.funnelContext,
      companyId,
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
    console.error('[Funnel Work Item] Error creating work item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
