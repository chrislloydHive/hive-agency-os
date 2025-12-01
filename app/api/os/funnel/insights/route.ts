import { NextRequest, NextResponse } from 'next/server';
import { generateFunnelInsights } from '@/lib/ai/funnelInsights';
import type { FunnelDataset } from '@/lib/os/analytics/funnel';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dataset, companyName } = body as {
      dataset: FunnelDataset;
      companyName?: string;
    };

    if (!dataset) {
      return NextResponse.json({ error: 'Missing dataset' }, { status: 400 });
    }

    // Validate dataset structure
    if (!dataset.context || !dataset.range || !dataset.stages) {
      return NextResponse.json(
        { error: 'Invalid dataset structure' },
        { status: 400 }
      );
    }

    // Generate insights
    const insights = await generateFunnelInsights(dataset, {
      companyName,
    });

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('[Funnel Insights API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
