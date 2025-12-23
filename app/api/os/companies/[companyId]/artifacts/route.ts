// app/api/os/companies/[companyId]/artifacts/route.ts
// Artifacts API - List and create artifacts for a company
//
// GET  - List all artifacts for a company
// POST - Create a new artifact

import { NextRequest, NextResponse } from 'next/server';
import {
  getArtifactsForCompany,
  createArtifact,
} from '@/lib/airtable/artifacts';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import type { CreateArtifactInput } from '@/lib/types/artifact';

type Params = { params: Promise<{ companyId: string }> };

/**
 * GET /api/os/companies/[companyId]/artifacts
 * List all artifacts for a company
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId } = await params;

    // Optional filtering by type or status
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    let artifacts = await getArtifactsForCompany(companyId);

    // Apply filters if provided
    if (type) {
      artifacts = artifacts.filter(a => a.type === type);
    }
    if (status) {
      artifacts = artifacts.filter(a => a.status === status);
    }

    return NextResponse.json({ artifacts });
  } catch (error) {
    console.error('[API Artifacts] Failed to list artifacts:', error);
    return NextResponse.json(
      { error: 'Failed to list artifacts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/os/companies/[companyId]/artifacts
 * Create a new artifact
 *
 * Body:
 * - title: string (required)
 * - type: ArtifactType (required)
 * - source: ArtifactSource (required)
 * - sourceStrategyId?: string
 * - sourceQbrStoryId?: string
 * - sourceBriefId?: string
 * - sourceMediaPlanId?: string
 * - engagementId?: string
 * - projectId?: string
 * - description?: string
 * - tags?: string[]
 * - googleFileId?: string (if file already exists)
 * - googleFileUrl?: string
 * - googleFileType?: GoogleFileType
 * - googleFolderId?: string
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.type || !body.source) {
      return NextResponse.json(
        { error: 'Missing required fields: title, type, source' },
        { status: 400 }
      );
    }

    const input: CreateArtifactInput = {
      companyId,
      title: body.title,
      type: body.type,
      source: body.source,
      sourceStrategyId: body.sourceStrategyId,
      sourceQbrStoryId: body.sourceQbrStoryId,
      sourceBriefId: body.sourceBriefId,
      sourceMediaPlanId: body.sourceMediaPlanId,
      engagementId: body.engagementId,
      projectId: body.projectId,
      description: body.description,
      tags: body.tags,
      googleFileId: body.googleFileId,
      googleFileUrl: body.googleFileUrl,
      googleFileType: body.googleFileType,
      googleFolderId: body.googleFolderId,
      contextVersionAtCreation: body.contextVersionAtCreation,
      strategyVersionAtCreation: body.strategyVersionAtCreation,
    };

    const artifact = await createArtifact(input);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Failed to create artifact' },
        { status: 500 }
      );
    }

    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    console.error('[API Artifacts] Failed to create artifact:', error);
    return NextResponse.json(
      { error: 'Failed to create artifact' },
      { status: 500 }
    );
  }
}
