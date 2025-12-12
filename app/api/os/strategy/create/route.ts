// app/api/os/strategy/create/route.ts
// Create new strategy API

import { NextRequest, NextResponse } from 'next/server';
import { createDraftStrategy } from '@/lib/os/strategy';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, title, summary, objectives, pillars } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const strategy = await createDraftStrategy({
      companyId,
      title,
      summary,
      objectives,
      pillars,
    });

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error('[API] strategy/create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create strategy' },
      { status: 500 }
    );
  }
}
