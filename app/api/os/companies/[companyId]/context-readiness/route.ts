// app/api/os/companies/[companyId]/context-readiness/route.ts
// API Route for Context Readiness
//
// Returns the context readiness summary for a company.
// Query param: requiredFor (overview | proposals | strategy | gap-plan | labs)

import { NextRequest, NextResponse } from 'next/server';
import { loadCompanyReadinessCached } from '@/lib/os/contextReadiness';
import type { RequiredForFeature } from '@/lib/os/contextReadiness';

const VALID_FEATURES: RequiredForFeature[] = ['overview', 'proposals', 'strategy', 'gap-plan', 'labs'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);
    const requiredFor = searchParams.get('requiredFor') as RequiredForFeature | null;

    // Validate requiredFor
    if (!requiredFor || !VALID_FEATURES.includes(requiredFor)) {
      return NextResponse.json(
        {
          error: 'Invalid requiredFor parameter',
          validOptions: VALID_FEATURES,
        },
        { status: 400 }
      );
    }

    // Load readiness with caching
    const summary = await loadCompanyReadinessCached(companyId, requiredFor);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[ContextReadiness API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compute context readiness' },
      { status: 500 }
    );
  }
}
