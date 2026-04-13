// app/api/dev/google-companies/route.ts
// Diagnostic: lists all companyIds that currently have a Google refresh token,
// plus the company name if we can find it. Use to figure out which companyId
// to pass to /api/integrations/google/authorize?companyId=...

import { NextResponse } from 'next/server';
import { getAirtableConfig } from '@/lib/airtable/client';
import { getCompanyById } from '@/lib/airtable/companies';

const INTEGRATIONS_TABLE = 'CompanyIntegrations';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getAirtableConfig();
    const params = new URLSearchParams();
    params.set('filterByFormula', `AND({GoogleRefreshToken} != '', {GoogleRefreshToken} != BLANK())`);
    // Request ALL fields so we can see the real schema
    params.set('maxRecords', '20');

    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(INTEGRATIONS_TABLE)}?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Airtable ${res.status}: ${text}` }, { status: 500 });
    }
    const data = await res.json();

    // Dump raw fields (minus tokens) so we can see the real schema
    const rows = (data.records || []).map((r: { id: string; fields: Record<string, unknown> }) => {
      const fields = { ...r.fields };
      // Redact sensitive values
      for (const k of Object.keys(fields)) {
        if (/token/i.test(k) && typeof fields[k] === 'string') {
          fields[k] = `[redacted ${(fields[k] as string).length} chars]`;
        }
      }
      return {
        integrationRecordId: r.id,
        fieldNames: Object.keys(r.fields || {}),
        fields,
      };
    });

    return NextResponse.json({ count: rows.length, rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
