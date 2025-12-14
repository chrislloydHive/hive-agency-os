// app/api/os/strategy/create/route.ts
// Create new strategy API
//
// TRUST: Always creates a NEW draft record. Never mutates existing active strategies.
// Stores version metadata for traceability (baseContextRevisionId, hiveBrainRevisionId, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { createDraftStrategy } from '@/lib/os/strategy';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      title,
      summary,
      objectives,
      pillars,
      // Version metadata (for traceability)
      baseContextRevisionId,
      hiveBrainRevisionId,
      competitionSourceUsed,
      generatedWithIncompleteContext,
      missingSrmFields,
    } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    console.log('[API] strategy/create with version metadata:', {
      baseContextRevisionId,
      competitionSourceUsed,
      generatedWithIncompleteContext,
    });

    const strategy = await createDraftStrategy({
      companyId,
      title,
      summary,
      objectives,
      pillars,
      // Pass version metadata through
      baseContextRevisionId,
      hiveBrainRevisionId,
      competitionSourceUsed,
      generatedWithIncompleteContext,
      missingSrmFields,
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
