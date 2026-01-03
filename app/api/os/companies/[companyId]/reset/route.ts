import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { applyCompanyReset } from '@/lib/os/reset/applyCompanyReset';
import type { ResetKind, ResetMode } from '@/lib/os/reset/buildResetInventory';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;
  if (!companyId) {
    return NextResponse.json({ ok: false, error: 'Missing companyId' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const mode: ResetMode = body.mode === 'apply' ? 'apply' : 'dryRun';
    const resetKind: ResetKind = body.resetKind === 'hard' ? 'hard' : 'soft';
    const resetBatchId: string = body.resetBatchId || randomUUID();
    const confirmHardDelete: boolean = body.confirmHardDelete === true;

    if (resetKind === 'hard' && (!confirmHardDelete || mode !== 'apply')) {
      return NextResponse.json(
        { ok: false, error: 'Hard delete requires mode=apply and confirmHardDelete=true' },
        { status: 400 }
      );
    }

    const result = await applyCompanyReset({
      companyId,
      mode,
      resetKind,
      resetBatchId,
      confirmHardDelete,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[reset-company] error', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

