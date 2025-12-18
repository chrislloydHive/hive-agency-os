// app/api/os/companies/[companyId]/strategy/set-active/route.ts
// POST to set the active strategy for a company

import { NextRequest, NextResponse } from 'next/server';
import { setActiveStrategy } from '@/lib/os/strategy';

interface SetActiveRequest {
  strategyId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = (await request.json()) as SetActiveRequest;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    if (!body.strategyId) {
      return NextResponse.json(
        { error: 'Strategy ID is required' },
        { status: 400 }
      );
    }

    const strategy = await setActiveStrategy(companyId, body.strategyId);

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error('[POST /api/os/companies/[companyId]/strategy/set-active] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set active strategy' },
      { status: 500 }
    );
  }
}
