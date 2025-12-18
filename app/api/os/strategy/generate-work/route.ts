// app/api/os/strategy/generate-work/route.ts
// Generate Work Items from Strategy Plays
//
// Takes a list of play IDs and creates work items for each play.
// Returns the created work items and optionally the updated strategy.

import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '@/lib/os/strategy';
import { createWorkItemsFromStrategyPlays } from '@/lib/airtable/workItems';
import type { StrategyPlay } from '@/lib/types/strategy';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategyId, playIds } = body;

    if (!strategyId) {
      return NextResponse.json({ error: 'Missing strategyId' }, { status: 400 });
    }

    if (!playIds || !Array.isArray(playIds) || playIds.length === 0) {
      return NextResponse.json({ error: 'Missing or empty playIds array' }, { status: 400 });
    }

    console.log('[API] strategy/generate-work:', {
      strategyId,
      playIds,
    });

    // Get the strategy to find the plays
    const strategy = await getStrategyById(strategyId);

    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    if (!strategy.plays || strategy.plays.length === 0) {
      return NextResponse.json({ error: 'Strategy has no plays' }, { status: 400 });
    }

    // Filter plays to only include the requested ones
    const selectedPlays = strategy.plays.filter((play: StrategyPlay) =>
      playIds.includes(play.id)
    );

    if (selectedPlays.length === 0) {
      return NextResponse.json({ error: 'No matching plays found' }, { status: 400 });
    }

    // Create work items from the plays
    const workItems = await createWorkItemsFromStrategyPlays({
      companyId: strategy.companyId,
      strategyId: strategy.id,
      plays: selectedPlays,
    });

    console.log('[API] strategy/generate-work: Created', workItems.length, 'work items');

    return NextResponse.json({
      success: true,
      workItems,
      createdCount: workItems.length,
    });
  } catch (error) {
    console.error('[API] strategy/generate-work error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate work from plays' },
      { status: 500 }
    );
  }
}
