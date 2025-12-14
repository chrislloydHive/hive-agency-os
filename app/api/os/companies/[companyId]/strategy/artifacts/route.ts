// app/api/os/companies/[companyId]/strategy/artifacts/route.ts
// API routes for strategy artifacts
//
// GET - List all artifacts for a company
// POST - Create a new artifact

import { NextResponse } from 'next/server';
import {
  getArtifactsForCompany,
  createArtifact,
} from '@/lib/os/strategy/artifacts';
import type { CreateArtifactRequest } from '@/lib/types/strategyArtifact';

type RouteParams = {
  params: Promise<{ companyId: string }>;
};

// GET /api/os/companies/[companyId]/strategy/artifacts
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const artifacts = await getArtifactsForCompany(companyId);
    return NextResponse.json({ artifacts });
  } catch (error) {
    console.error('[artifacts/route] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artifacts' },
      { status: 500 }
    );
  }
}

// POST /api/os/companies/[companyId]/strategy/artifacts
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    const createRequest: CreateArtifactRequest = {
      companyId,
      type: body.type,
      title: body.title,
      content: body.content || '',
      source: body.source || 'human',
      linkedContextRevisionId: body.linkedContextRevisionId,
      linkedCompetitionSource: body.linkedCompetitionSource,
      linkedArtifactIds: body.linkedArtifactIds,
    };

    const artifact = await createArtifact(createRequest);
    return NextResponse.json({ artifact });
  } catch (error) {
    console.error('[artifacts/route] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create artifact' },
      { status: 500 }
    );
  }
}
