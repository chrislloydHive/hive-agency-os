// app/api/os/client-brain/[companyId]/insights/[insightId]/route.ts
// Get, update, and delete individual Client Brain Insights

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getClientInsight,
  updateClientInsight,
  deleteClientInsight,
} from '@/lib/airtable/clientInsights';
import type {
  InsightStatus,
  InsightSeverity,
  InsightCategory,
} from '@/lib/types/clientBrain';

interface RouteContext {
  params: Promise<{ companyId: string; insightId: string }>;
}

// ============================================================================
// GET - Get a single insight
// ============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { companyId, insightId } = await context.params;

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get insight
    const insight = await getClientInsight(insightId);
    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    // Validate insight belongs to company
    if (insight.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Insight does not belong to this company' },
        { status: 403 }
      );
    }

    return NextResponse.json({ insight });
  } catch (error) {
    console.error('[Insight API] Error getting insight:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get insight' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update insight (status, severity, category, etc.)
// ============================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { companyId, insightId } = await context.params;

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get existing insight
    const existing = await getClientInsight(insightId);
    if (!existing) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    // Validate insight belongs to company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Insight does not belong to this company' },
        { status: 403 }
      );
    }

    // Parse update payload
    const body = await request.json();
    const { status, severity, category, title, body: insightBody, linkedWorkItemId } = body as {
      status?: InsightStatus;
      severity?: InsightSeverity;
      category?: InsightCategory;
      title?: string;
      body?: string;
      linkedWorkItemId?: string;
    };

    // Validate status if provided
    const validStatuses: InsightStatus[] = ['open', 'in_progress', 'resolved', 'dismissed'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {};
    if (status !== undefined) updatePayload.status = status;
    if (severity !== undefined) updatePayload.severity = severity;
    if (category !== undefined) updatePayload.category = category;
    if (title !== undefined) updatePayload.title = title;
    if (insightBody !== undefined) updatePayload.body = insightBody;
    if (linkedWorkItemId !== undefined) updatePayload.linkedWorkItemId = linkedWorkItemId;

    // Update insight
    const updated = await updateClientInsight(insightId, updatePayload);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 });
    }

    console.log('[Insight API] Updated insight:', {
      insightId,
      status,
      severity,
      category,
    });

    return NextResponse.json({
      success: true,
      insight: updated,
    });
  } catch (error) {
    console.error('[Insight API] Error updating insight:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update insight' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete an insight
// ============================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { companyId, insightId } = await context.params;

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get existing insight
    const existing = await getClientInsight(insightId);
    if (!existing) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    // Validate insight belongs to company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Insight does not belong to this company' },
        { status: 403 }
      );
    }

    // Delete insight
    const deleted = await deleteClientInsight(insightId);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete insight' }, { status: 500 });
    }

    console.log('[Insight API] Deleted insight:', insightId);

    return NextResponse.json({
      success: true,
      message: 'Insight deleted',
    });
  } catch (error) {
    console.error('[Insight API] Error deleting insight:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete insight' },
      { status: 500 }
    );
  }
}
