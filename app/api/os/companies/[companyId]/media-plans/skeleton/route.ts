// app/api/os/companies/[companyId]/media-plans/skeleton/route.ts
// Create a skeletal Media Plan Draft from a Strategy tactic
//
// POST - Create a minimal media plan draft for a paid media tactic

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import type { MediaPlanDraft, MediaPlanDraftResponse } from '@/lib/types/mediaPlan';

// ============================================================================
// Validation Schema
// ============================================================================

const CreateSkeletonBodySchema = z.object({
  strategyId: z.string().min(1, 'strategyId is required'),
  tacticId: z.string().optional(),
  tacticTitle: z.string().optional(),
  title: z.string().optional(),
});

type CreateSkeletonBody = z.infer<typeof CreateSkeletonBodySchema>;

// ============================================================================
// In-memory storage (placeholder - should use Airtable in production)
// ============================================================================

// NOTE: This is a skeleton implementation. In production, this should:
// 1. Store in Airtable MediaPlanDrafts table
// 2. Include proper idempotency checks
// 3. Return existing draft if already created for the same tactic

const drafts = new Map<string, MediaPlanDraft>();

// ============================================================================
// Route Handler
// ============================================================================

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/media-plans/skeleton
 * Create a skeletal media plan draft
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const parseResult = CreateSkeletonBodySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { strategyId, tacticId, tacticTitle, title } = parseResult.data;

    console.log('[media-plans/skeleton] Creating draft:', {
      companyId,
      strategyId,
      tacticId,
    });

    // Check for existing draft (idempotency)
    if (tacticId) {
      const existingKey = `${strategyId}:${tacticId}`;
      const existing = drafts.get(existingKey);
      if (existing) {
        console.log('[media-plans/skeleton] Found existing draft:', existing.id);
        return NextResponse.json({
          status: 'ok',
          mediaPlanDraft: existing,
          alreadyExists: true,
        } satisfies MediaPlanDraftResponse);
      }
    }

    // Create the draft
    const now = new Date().toISOString();
    const draft: MediaPlanDraft = {
      id: `mpdraft_${nanoid(12)}`,
      companyId,
      strategyId,
      title: title || tacticTitle || 'Media Plan Draft',
      status: 'draft',
      tacticId,
      tacticTitle,
      strategyLink: tacticId
        ? {
            strategyId,
            tacticId,
            tacticTitle,
          }
        : undefined,
      channels: [],
      createdAt: now,
      updatedAt: now,
    };

    // Store the draft (placeholder - should use Airtable)
    if (tacticId) {
      const key = `${strategyId}:${tacticId}`;
      drafts.set(key, draft);
    }

    console.log('[media-plans/skeleton] Created draft:', draft.id);

    return NextResponse.json({
      status: 'ok',
      mediaPlanDraft: draft,
      alreadyExists: false,
    } satisfies MediaPlanDraftResponse);
  } catch (error) {
    console.error('[media-plans/skeleton] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
