// app/api/os/companies/[companyId]/work/bulk/route.ts
// Bulk create work items from diagnostic issues
//
// Used by DiagnosticIssuesPanel "Create Work Items" action

import { NextResponse } from 'next/server';
import { createWorkItem, type CreateWorkItemInput } from '@/lib/work/workItems';

interface WorkItemInput {
  title: string;
  description?: string;
  priority: string;
  domain?: string;
  sourceLabSlug?: string;
  sourceRunId?: string;
}

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;

  try {
    const body = await request.json();
    const { items } = body as { items: WorkItemInput[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'items array is required' },
        { status: 400 }
      );
    }

    console.log('[WorkBulk] Creating', items.length, 'work items for company:', companyId);

    const createdItems: { id: string; title: string }[] = [];
    const errors: { title: string; error: string }[] = [];

    // Create work items sequentially to avoid rate limits
    for (const item of items) {
      try {
        const input: CreateWorkItemInput = {
          companyId,
          title: item.title,
          description: item.description || '',
          area: item.domain || 'Other',
          priority: item.priority as 'P0' | 'P1' | 'P2' | 'P3',
          status: 'Backlog',
          sourceType: item.sourceLabSlug
            ? `Diagnostic Issue (${item.sourceLabSlug})`
            : 'Diagnostic Issue',
          sourceId: item.sourceRunId,
        };

        const workItem = await createWorkItem(input);

        if (workItem) {
          createdItems.push({ id: workItem.id, title: workItem.title });
        } else {
          errors.push({ title: item.title, error: 'Failed to create' });
        }
      } catch (err) {
        errors.push({
          title: item.title,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    console.log('[WorkBulk] Created', createdItems.length, 'work items,', errors.length, 'errors');

    return NextResponse.json({
      ok: true,
      created: createdItems.length,
      items: createdItems,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[WorkBulk] Error creating work items:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create work items' },
      { status: 500 }
    );
  }
}
