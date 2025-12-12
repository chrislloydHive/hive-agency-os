// app/api/os/context/update/route.ts
// Update company context API

import { NextRequest, NextResponse } from 'next/server';
import { updateCompanyContext } from '@/lib/os/context';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, updates, source } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const context = await updateCompanyContext({
      companyId,
      updates: updates || {},
      source: source || 'user',
    });

    return NextResponse.json({ context });
  } catch (error) {
    console.error('[API] context/update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update context' },
      { status: 500 }
    );
  }
}
