// app/api/os/companies/[companyId]/strategy/compare/apply/route.ts
// POST /api/os/companies/[companyId]/strategy/compare/apply
//
// Applies/locks a generated comparison artifact as canonical record
// Does NOT activate a strategy automatically

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getComparisonById,
  applyComparison,
} from '@/lib/os/strategy/comparison';
import type { ApplyComparisonResponse } from '@/lib/types/strategyComparison';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    const { comparisonId } = body as { comparisonId: string };

    // Validate request
    if (!comparisonId) {
      return NextResponse.json(
        { success: false, error: 'comparisonId is required' },
        { status: 400 }
      );
    }

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get comparison
    const comparison = await getComparisonById(comparisonId);
    if (!comparison) {
      return NextResponse.json(
        { success: false, error: 'Comparison not found' },
        { status: 404 }
      );
    }

    // Validate comparison belongs to this company
    if (comparison.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Comparison does not belong to this company' },
        { status: 403 }
      );
    }

    // Check if already applied
    if (comparison.status === 'applied') {
      return NextResponse.json(
        { success: false, error: 'Comparison is already applied' },
        { status: 400 }
      );
    }

    // Check if archived
    if (comparison.status === 'archived') {
      return NextResponse.json(
        { success: false, error: 'Cannot apply an archived comparison' },
        { status: 400 }
      );
    }

    // Apply the comparison (mark as canonical)
    await applyComparison(comparisonId);

    const response: ApplyComparisonResponse = {
      success: true,
      comparisonId,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /strategy/compare/apply] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to apply comparison',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
