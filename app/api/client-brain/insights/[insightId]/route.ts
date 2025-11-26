// app/api/client-brain/insights/[insightId]/route.ts
// Single insight operations: GET, PATCH, DELETE

import { NextRequest, NextResponse } from 'next/server';
import {
  getInsightById,
  updateInsight,
  deleteInsight,
} from '@/lib/airtable/clientBrain';
import { normalizeInsightCategory, normalizeInsightSeverity } from '@/lib/types/clientBrain';

interface RouteParams {
  params: Promise<{ insightId: string }>;
}

// GET /api/client-brain/insights/[insightId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { insightId } = await params;

    const insight = await getInsightById(insightId);

    if (!insight) {
      return NextResponse.json(
        { error: 'Insight not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      insight,
    });

  } catch (error) {
    console.error('[Insight API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch insight' },
      { status: 500 }
    );
  }
}

// PATCH /api/client-brain/insights/[insightId]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { insightId } = await params;
    const body = await request.json();
    const { title, body: insightBody, category, severity } = body;

    const updates: Parameters<typeof updateInsight>[1] = {};

    if (title !== undefined) updates.title = title;
    if (insightBody !== undefined) updates.body = insightBody;
    if (category !== undefined) updates.category = normalizeInsightCategory(category);
    if (severity !== undefined) updates.severity = normalizeInsightSeverity(severity);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid update fields provided' },
        { status: 400 }
      );
    }

    const insight = await updateInsight(insightId, updates);

    return NextResponse.json({
      success: true,
      insight,
    });

  } catch (error) {
    console.error('[Insight API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update insight' },
      { status: 500 }
    );
  }
}

// DELETE /api/client-brain/insights/[insightId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { insightId } = await params;

    await deleteInsight(insightId);

    return NextResponse.json({
      success: true,
      message: 'Insight deleted',
    });

  } catch (error) {
    console.error('[Insight API] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete insight' },
      { status: 500 }
    );
  }
}
