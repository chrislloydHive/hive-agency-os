// app/api/os/companies/[companyId]/briefs/[briefId]/route.ts
// Get, update, or delete a specific brief

import { NextRequest, NextResponse } from 'next/server';
import {
  getBriefById,
  updateBrief,
  updateBriefCore,
  updateBriefExtension,
  deleteBrief,
} from '@/lib/airtable/briefs';
import type { BriefCore, BriefExtension, BriefStatus } from '@/lib/types/brief';

type Params = { params: Promise<{ companyId: string; briefId: string }> };

/**
 * GET /api/os/companies/[companyId]/briefs/[briefId]
 * Get a specific brief
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { briefId } = await params;

    const brief = await getBriefById(briefId);

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ brief });
  } catch (error) {
    console.error('[API] Failed to get brief:', error);
    return NextResponse.json(
      { error: 'Failed to get brief' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/os/companies/[companyId]/briefs/[briefId]
 * Update a brief
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { briefId } = await params;
    const body = await request.json();

    // Check if brief exists and is editable
    const existing = await getBriefById(briefId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    if (existing.isLocked) {
      return NextResponse.json(
        { error: 'Brief is locked and cannot be edited' },
        { status: 400 }
      );
    }

    const {
      title,
      status,
      core,
      extension,
    } = body as {
      title?: string;
      status?: BriefStatus;
      core?: BriefCore;
      extension?: BriefExtension;
    };

    let updated = existing;

    // Update core if provided
    if (core) {
      const result = await updateBriefCore(briefId, core);
      if (result) updated = result;
    }

    // Update extension if provided
    if (extension) {
      const result = await updateBriefExtension(briefId, extension);
      if (result) updated = result;
    }

    // Update title/status if provided
    if (title || status) {
      const result = await updateBrief(briefId, { title, status });
      if (result) updated = result;
    }

    return NextResponse.json({ brief: updated });
  } catch (error) {
    console.error('[API] Failed to update brief:', error);
    return NextResponse.json(
      { error: 'Failed to update brief' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/os/companies/[companyId]/briefs/[briefId]
 * Delete a brief
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { briefId } = await params;

    // Check if brief exists
    const existing = await getBriefById(briefId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    if (existing.isLocked) {
      return NextResponse.json(
        { error: 'Brief is locked and cannot be deleted' },
        { status: 400 }
      );
    }

    const success = await deleteBrief(briefId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete brief' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to delete brief:', error);
    return NextResponse.json(
      { error: 'Failed to delete brief' },
      { status: 500 }
    );
  }
}
