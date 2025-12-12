// app/api/os/strategy/update/route.ts
// Update strategy API

import { NextRequest, NextResponse } from 'next/server';
import { updateStrategy } from '@/lib/os/strategy';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategyId, updates } = body;

    if (!strategyId) {
      return NextResponse.json({ error: 'Missing strategyId' }, { status: 400 });
    }

    const strategy = await updateStrategy({
      strategyId,
      updates: updates || {},
    });

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error('[API] strategy/update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update strategy' },
      { status: 500 }
    );
  }
}
