// app/api/os/companies/[companyId]/artifact-index/route.ts
// API endpoint for CompanyArtifactIndex
//
// GET: Retrieve all indexed artifacts for a company.
// This is the CANONICAL source for the Documents UI.
// Documents should query ONLY this endpoint.

import { NextRequest, NextResponse } from 'next/server';
import { getArtifactIndexForCompany } from '@/lib/airtable/artifactIndex';

export const dynamic = 'force-dynamic';

type RouteParams = {
  params: Promise<{ companyId: string }>;
};

/**
 * GET /api/os/companies/[companyId]/artifact-index
 *
 * Retrieve all indexed artifacts for a company.
 * This is the CANONICAL source for Documents UI.
 *
 * Query params:
 * - flat=true: Return flat array (default)
 * - grouped=true: Return grouped by phase
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Fetch indexed artifacts
    const artifacts = await getArtifactIndexForCompany(companyId);

    // LOG: Documents query result count
    console.log(`[artifact-index API] Documents query returned ${artifacts.length} items companyId=${companyId}`);

    // Check if grouped response requested
    const url = new URL(request.url);
    const grouped = url.searchParams.get('grouped') === 'true';

    if (grouped) {
      // Group by phase
      const byPhase = artifacts.reduce((acc, artifact) => {
        const phase = artifact.phase || 'Other';
        if (!acc[phase]) acc[phase] = [];
        acc[phase].push(artifact);
        return acc;
      }, {} as Record<string, typeof artifacts>);

      return NextResponse.json({
        ok: true,
        companyId,
        total: artifacts.length,
        groups: byPhase,
      });
    }

    // Return flat array (default)
    return NextResponse.json({
      ok: true,
      companyId,
      artifacts,
      total: artifacts.length,
    });
  } catch (error) {
    console.error('[artifact-index API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch artifact index' },
      { status: 500 }
    );
  }
}
