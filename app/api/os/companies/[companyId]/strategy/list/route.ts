// app/api/os/companies/[companyId]/strategy/list/route.ts
// GET list of strategies for multi-strategy selector

import { NextRequest, NextResponse } from 'next/server';
import { getStrategyListItems } from '@/lib/os/strategy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const strategies = await getStrategyListItems(companyId);

    return NextResponse.json({ strategies });
  } catch (error) {
    console.error('[GET /api/os/companies/[companyId]/strategy/list] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get strategies' },
      { status: 500 }
    );
  }
}
