// POST /api/dev/company-integrations-placeholder
// Creates a stub CompanyIntegrations row in AIRTABLE_DB_BASE_ID (Hive DB) so OAuth can run.
//
// Local only: returns 403 in production (use Airtable UI or curl there — see handler comment).

import { NextRequest, NextResponse } from 'next/server';
import { createCompanyIntegrationPlaceholder } from '@/lib/airtable/companyIntegrations';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error:
          'Disabled in production. In Airtable (Hive DB base), add a row in CompanyIntegrations with CompanyId = your company record id and GoogleConnected off; or run curl from your machine (see project docs).',
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : undefined;
    const clientCode = typeof body.clientCode === 'string' ? body.clientCode.trim() : undefined;

    if (!companyId || !companyId.startsWith('rec')) {
      return NextResponse.json(
        { error: 'Body must include companyId (Airtable record id, e.g. recWofrWdHQOwDIBP)' },
        { status: 400 },
      );
    }

    const data = await createCompanyIntegrationPlaceholder({ companyId, companyName, clientCode });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[company-integrations-placeholder]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
