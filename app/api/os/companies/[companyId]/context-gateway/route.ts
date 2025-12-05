// app/api/os/companies/[companyId]/context-gateway/route.ts
// Context Gateway API endpoint
//
// GET /api/os/companies/[companyId]/context-gateway
// Returns the AI-scoped view of company context via Context Gateway

import { NextRequest, NextResponse } from 'next/server';
import { getAllContext, getContextForScopes, type ContextScopeId } from '@/lib/contextGraph/contextGateway';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);

    const scope = searchParams.get('scope'); // 'full' or comma-separated scopes
    const minConfidence = parseFloat(searchParams.get('minConfidence') ?? '0.4');
    const minFreshness = parseFloat(searchParams.get('minFreshness') ?? '0.3');
    const snapshotId = searchParams.get('snapshotId') ?? undefined;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    console.log('[API] Context Gateway request:', { companyId, scope, minConfidence, minFreshness });

    let result;

    if (scope === 'full' || !scope) {
      // Get all context
      result = await getAllContext(companyId, {
        minConfidence,
        minFreshness,
        snapshotId,
      });
    } else {
      // Get specific scopes
      const scopes = scope.split(',').map(s => s.trim()) as ContextScopeId[];
      result = await getContextForScopes({
        companyId,
        scopes,
        minConfidence,
        minFreshness,
        snapshotId,
      });
    }

    console.log('[API] Context Gateway result:', {
      companyId,
      totalFields: result.totalFields,
      populatedFields: result.populatedFields,
      sectionCount: result.sections.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Context Gateway error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
