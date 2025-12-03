// app/api/media/assumptions/route.ts
// API endpoint for managing Media Assumptions
//
// GET /api/media/assumptions?companyId=xxx - Get assumptions for a company
// POST /api/media/assumptions - Save/update assumptions for a company

import { NextRequest, NextResponse } from 'next/server';
import {
  getMediaAssumptionsWithDefaults,
  saveMediaAssumptionsFromAPI,
} from '@/lib/airtable/mediaAssumptions';
import type { MediaAssumptions } from '@/lib/media/assumptions';

// ============================================================================
// Types
// ============================================================================

interface AssumptionsResponse {
  success: boolean;
  assumptions?: MediaAssumptions;
  error?: string;
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(
  request: NextRequest
): Promise<NextResponse<AssumptionsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    const assumptions = await getMediaAssumptionsWithDefaults(companyId);

    return NextResponse.json({
      success: true,
      assumptions,
    });
  } catch (error) {
    console.error('[API] Error fetching assumptions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch assumptions',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<AssumptionsResponse>> {
  try {
    const body = await request.json();
    const { companyId, assumptions, updatedBy } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!assumptions) {
      return NextResponse.json(
        { success: false, error: 'assumptions object is required' },
        { status: 400 }
      );
    }

    const result = await saveMediaAssumptionsFromAPI(
      companyId,
      assumptions,
      updatedBy
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      assumptions: result.assumptions,
    });
  } catch (error) {
    console.error('[API] Error saving assumptions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save assumptions',
      },
      { status: 500 }
    );
  }
}
