// app/api/os/strategy/finalize/route.ts
// Finalize strategy and generate work API

import { NextRequest, NextResponse } from 'next/server';
import { finalizeStrategy } from '@/lib/os/strategy';
import { generateWorkFromStrategy } from '@/lib/os/work';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Default generateWork to true so finalization always creates work
    const { strategyId, generateWork = true } = body;

    if (!strategyId) {
      return NextResponse.json({ error: 'Missing strategyId' }, { status: 400 });
    }

    console.log('[API] strategy/finalize - Starting finalization for:', strategyId);

    // First, finalize the strategy
    const strategy = await finalizeStrategy({ strategyId });
    console.log('[API] strategy/finalize - Strategy finalized:', strategy.id, strategy.status);

    // Generate work items (default: always)
    let workResult = null;
    if (generateWork) {
      console.log('[API] strategy/finalize - Generating work for company:', strategy.companyId);
      try {
        workResult = await generateWorkFromStrategy({
          strategyId,
          companyId: strategy.companyId,
        });
        console.log('[API] strategy/finalize - Work generated:', {
          workstreams: workResult.workstreams.length,
          tasks: workResult.tasks.length,
        });
      } catch (workError) {
        console.error('[API] strategy/finalize - Work generation error:', workError);
        // Return the error in the response but don't fail the whole request
        return NextResponse.json({
          strategy,
          work: null,
          workError: workError instanceof Error ? workError.message : 'Work generation failed',
        });
      }
    }

    return NextResponse.json({
      strategy,
      work: workResult,
    });
  } catch (error) {
    console.error('[API] strategy/finalize error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to finalize strategy' },
      { status: 500 }
    );
  }
}
