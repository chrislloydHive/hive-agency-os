// POST /api/os/tasks/:id/refresh-from-thread
// Re-evaluates task fields against the current Gmail thread (and cross-thread hints).

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { getTasks } from '@/lib/airtable/tasks';
import { getOsGoogleAccessToken } from '@/lib/gmail/osGoogleAccess';
import { getGoogleAccountEmail } from '@/lib/google/oauth';
import { getIdentity } from '@/lib/personalContext';
import { runTaskRefreshFromThread } from '@/lib/os/taskRefreshFromThread';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const all = await getTasks({});
    const task = all.find((t) => t.id === id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const googleAccess = await getOsGoogleAccessToken();
    if (!googleAccess.ok) {
      return NextResponse.json({ error: googleAccess.error }, { status: googleAccess.status });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: googleAccess.accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const [identity, profileEmail] = await Promise.all([getIdentity(), getGoogleAccountEmail(googleAccess.accessToken)]);
    const userEmail = profileEmail || identity.email;
    const anthropic = new Anthropic({ apiKey, timeout: 55_000 });

    const result = await runTaskRefreshFromThread({
      task,
      gmail,
      anthropic,
      userName: identity.name,
      userEmail,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
    }

    const d = result.data;
    if (d.noChange) {
      return NextResponse.json({ noChange: true, reasoning: d.reasoning });
    }

    return NextResponse.json({
      proposal: d.proposal,
      fields: d.fields,
      changeSummary: d.changeSummary,
      reasoning: d.reasoning,
      confidence: d.confidence,
    });
  } catch (err) {
    console.error('[tasks/:id/refresh-from-thread] error:', err);
    const msg = err instanceof Error ? err.message : 'Refresh failed';
    if (msg.toLowerCase().includes('timeout') || msg.includes('ETIMEDOUT')) {
      return NextResponse.json({ error: msg }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
