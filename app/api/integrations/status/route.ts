// app/api/integrations/status/route.ts
// Get status of all integrations

import { NextResponse } from 'next/server';
import { getGa4ConnectionStatus } from '@/lib/os/integrations/ga4Client';
import { getGscConnectionStatus } from '@/lib/os/integrations/gscClient';

export async function GET() {
  try {
    // Fetch status of all integrations in parallel
    const [ga4Status, gscStatus] = await Promise.all([
      getGa4ConnectionStatus().catch(() => ({ connected: false, source: 'none' as const })),
      getGscConnectionStatus().catch(() => ({ connected: false, source: 'none' as const })),
    ]);

    // Check Airtable status (if env vars are set, we're connected)
    const airtableConnected = !!(
      (process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN) &&
      process.env.AIRTABLE_BASE_ID
    );

    // Check OpenAI/Anthropic status
    const aiConnected = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

    return NextResponse.json({
      ga4: ga4Status,
      gsc: gscStatus,
      airtable: {
        connected: airtableConnected,
        source: airtableConnected ? 'env' : 'none',
      },
      ai: {
        connected: aiConnected,
        source: aiConnected ? 'env' : 'none',
        provider: process.env.ANTHROPIC_API_KEY ? 'Anthropic' : process.env.OPENAI_API_KEY ? 'OpenAI' : null,
      },
    });
  } catch (error) {
    console.error('[Integrations Status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
