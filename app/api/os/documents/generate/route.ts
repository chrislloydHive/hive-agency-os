// app/api/os/documents/generate/route.ts
// Generate brief documents from strategy

import { NextRequest, NextResponse } from 'next/server';
import { generateBriefFromStrategy, createBrief } from '@/lib/os/documents';
import { getActiveStrategy } from '@/lib/os/strategy';
import type { BriefType } from '@/lib/types/documents';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, strategyId: providedStrategyId, type } = body as {
      companyId: string;
      strategyId?: string;
      type: BriefType;
    };

    if (!companyId || !type) {
      return NextResponse.json(
        { error: 'Missing companyId or type' },
        { status: 400 }
      );
    }

    // If no strategyId provided, get the active strategy
    let strategyId = providedStrategyId;
    if (!strategyId) {
      const activeStrategy = await getActiveStrategy(companyId);
      if (!activeStrategy) {
        return NextResponse.json(
          { error: 'No active strategy found. Please create a strategy first.' },
          { status: 400 }
        );
      }
      strategyId = activeStrategy.id;
    }

    // Generate brief content
    const generated = await generateBriefFromStrategy({
      companyId,
      strategyId,
      type,
    });

    // Save the brief to Airtable so it has an ID
    const savedBrief = await createBrief(generated.brief);

    return NextResponse.json({ brief: savedBrief });
  } catch (error) {
    console.error('[API] documents/generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate brief' },
      { status: 500 }
    );
  }
}
