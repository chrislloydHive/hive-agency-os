// app/api/os/companies/[companyId]/creative/generate/route.ts
// API route to generate creative strategy using Creative Lab

import { NextRequest, NextResponse } from 'next/server';
import { loadCreativeLabContext } from '@/app/c/[companyId]/labs/creative/loadCreativeLab';
import { runCreativeLab } from '@/app/c/[companyId]/labs/creative/runCreativeLab';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    console.log('[CreativeLab API] Generate request for:', companyId);

    // Load context
    const context = await loadCreativeLabContext(companyId);

    // Run Creative Lab
    const result = await runCreativeLab(context);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Generation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      output: result.output,
      runId: result.runId,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error('[CreativeLab API] Generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
