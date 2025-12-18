// app/api/os/companies/[companyId]/strategy/drafts/route.ts
// Strategy drafts CRUD API
//
// GET: List all drafts for a strategy
// POST: Create/update a draft
// DELETE: Delete a draft

import { NextRequest, NextResponse } from 'next/server';
import {
  getDraftsForStrategy,
  saveDraft,
  deleteDraftByKey,
  draftsToRecord,
  type CreateDraftRequest,
  type DraftScopeType,
} from '@/lib/os/strategy/drafts';

// ============================================================================
// GET: List drafts for a strategy
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const url = new URL(request.url);
    const strategyId = url.searchParams.get('strategyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    if (!strategyId) {
      return NextResponse.json({ error: 'Strategy ID is required' }, { status: 400 });
    }

    const drafts = await getDraftsForStrategy(companyId, strategyId);

    return NextResponse.json({
      drafts,
      draftsRecord: draftsToRecord(drafts),
      count: drafts.length,
    });
  } catch (error) {
    console.error('[GET /strategy/drafts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get drafts' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Create/update a draft
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const {
      strategyId,
      scopeType,
      fieldKey,
      entityId,
      draftValue,
      originalValue,
      rationale,
      confidence,
      sourcesUsed,
      basedOnHashes,
    } = body;

    if (!strategyId || !scopeType || !fieldKey || draftValue === undefined) {
      return NextResponse.json(
        { error: 'strategyId, scopeType, fieldKey, and draftValue are required' },
        { status: 400 }
      );
    }

    const draftRequest: CreateDraftRequest = {
      companyId,
      strategyId,
      scopeType: scopeType as DraftScopeType,
      fieldKey,
      entityId,
      draftValue,
      originalValue,
      rationale: rationale || [],
      confidence: confidence || 'medium',
      sourcesUsed: sourcesUsed || [],
      basedOnHashes,
    };

    const draft = await saveDraft(draftRequest);

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[POST /strategy/drafts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save draft' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Delete a draft
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const url = new URL(request.url);
    const strategyId = url.searchParams.get('strategyId');
    const scopeType = url.searchParams.get('scopeType') as DraftScopeType;
    const fieldKey = url.searchParams.get('fieldKey');
    const entityId = url.searchParams.get('entityId') || undefined;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    if (!strategyId || !scopeType || !fieldKey) {
      return NextResponse.json(
        { error: 'strategyId, scopeType, and fieldKey are required' },
        { status: 400 }
      );
    }

    await deleteDraftByKey(companyId, strategyId, scopeType, fieldKey, entityId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /strategy/drafts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
