// app/api/os/context/discard-draft/route.ts
// Delete a context draft

import { NextRequest, NextResponse } from 'next/server';
import { deleteContextDraft } from '@/lib/os/context';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body as { companyId: string };

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    await deleteContextDraft(companyId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[discard-draft] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discard draft' },
      { status: 500 }
    );
  }
}
