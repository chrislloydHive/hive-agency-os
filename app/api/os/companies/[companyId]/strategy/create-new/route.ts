// app/api/os/companies/[companyId]/strategy/create-new/route.ts
// POST to create a new blank strategy

import { NextRequest, NextResponse } from 'next/server';
import { createNewStrategy } from '@/lib/os/strategy';

interface CreateNewRequest {
  title?: string;
  setAsActive?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = (await request.json()) as CreateNewRequest;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const strategy = await createNewStrategy(companyId, {
      title: body.title,
      setAsActive: body.setAsActive,
    });

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error('[POST /api/os/companies/[companyId]/strategy/create-new] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create strategy' },
      { status: 500 }
    );
  }
}
