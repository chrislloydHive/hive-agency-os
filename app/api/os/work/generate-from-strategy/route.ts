// app/api/os/work/generate-from-strategy/route.ts
// Generate work items from a finalized strategy

import { NextRequest, NextResponse } from 'next/server';
import { generateWorkFromStrategy } from '@/lib/os/work';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategyId, companyId } = body;

    if (!strategyId || !companyId) {
      return NextResponse.json(
        { error: 'Missing strategyId or companyId' },
        { status: 400 }
      );
    }

    const result = await generateWorkFromStrategy({
      strategyId,
      companyId,
    });

    return NextResponse.json({
      workstreams: result.workstreams,
      tasks: result.tasks,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] work/generate-from-strategy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate work' },
      { status: 500 }
    );
  }
}
