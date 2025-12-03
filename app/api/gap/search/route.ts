// app/api/gap/search/route.ts
// Search for existing GAP runs by domain

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableConfig } from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { normalizeDomain } from '@/lib/airtable/companies';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
  }

  const normalizedDomain = normalizeDomain(domain);
  console.log('[GAP Search] Searching for domain:', normalizedDomain);

  try {
    const config = getAirtableConfig();

    // Search GAP-IA Run table for matching domain
    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      AIRTABLE_TABLES.GAP_IA_RUN
    )}?filterByFormula=${encodeURIComponent(
      `AND({Domain} = "${normalizedDomain}", {Status} = "completed")`
    )}&sort[0][field]=Created%20At&sort[0][direction]=desc&maxRecords=5`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GAP Search] Airtable error:', errorText);
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const result = await response.json();
    const records = result.records || [];

    console.log(`[GAP Search] Found ${records.length} GAP runs for ${normalizedDomain}`);

    // Map to a simplified format
    const gapRuns = records.map((record: any) => {
      const fields = record.fields || {};
      const dataJson = fields['Data JSON'] ? JSON.parse(fields['Data JSON']) : {};

      return {
        id: record.id,
        domain: fields['Domain'] || normalizedDomain,
        url: fields['Website URL'] || '',
        status: dataJson.status || 'unknown',
        overallScore: dataJson.overallScore || dataJson.summary?.overallScore,
        createdAt: fields['Created At'],
        businessName: dataJson.core?.businessName || dataJson.summary?.businessName,
        industry: dataJson.core?.industry || dataJson.summary?.industry,
        maturityStage: dataJson.maturityStage || dataJson.summary?.maturityStage,
        // V2 summary fields
        summary: dataJson.summary ? {
          headline: dataJson.summary.headline,
          overallScore: dataJson.summary.overallScore,
          maturityStage: dataJson.summary.maturityStage,
        } : null,
      };
    });

    return NextResponse.json({
      domain: normalizedDomain,
      runs: gapRuns,
      count: gapRuns.length,
    });
  } catch (error) {
    console.error('[GAP Search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search GAP runs' },
      { status: 500 }
    );
  }
}
