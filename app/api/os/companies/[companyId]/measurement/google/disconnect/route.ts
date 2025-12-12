// app/api/os/companies/[companyId]/measurement/google/disconnect/route.ts
// Disconnect Google integration for a company

import { NextRequest, NextResponse } from 'next/server';
import { disconnectGoogle } from '@/lib/airtable/companyIntegrations';

export const dynamic = 'force-dynamic';

type RouteParams = {
  params: Promise<{ companyId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  try {
    await disconnectGoogle(companyId);
    return NextResponse.json({ ok: true, message: 'Google disconnected' });
  } catch (error) {
    console.error('[Google Disconnect] Error:', error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
