// app/api/os/companies/[companyId]/strategy/duplicate/route.ts
// POST to duplicate a strategy

import { NextRequest, NextResponse } from 'next/server';
import { duplicateStrategy } from '@/lib/os/strategy';

interface DuplicateRequest {
  strategyId: string;
  title?: string;
  setAsActive?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = (await request.json()) as DuplicateRequest;

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

    const strategy = await duplicateStrategy(body.strategyId, {
      title: body.title,
      setAsActive: body.setAsActive,
    });

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error('[POST /api/os/companies/[companyId]/strategy/duplicate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to duplicate strategy' },
      { status: 500 }
    );
  }
}
