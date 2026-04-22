// app/api/os/gmail/mark-read/route.ts
//
// Removes the UNREAD label from a Gmail thread or message so the inbox reflects
// that Chris has engaged with it via Hive OS. Fired from:
//   - /api/os/gmail/draft-reply (server-side, after a draft is successfully created)
//   - "Review in Gmail" click in My Day (client-side fire-and-forget)
//   - "Open email thread" link in TaskEditPanel (client-side fire-and-forget)
//
// Requires gmail.modify scope. Failures are non-fatal — the caller swallows
// errors so the main action (draft, open thread) isn't blocked.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { messageId, threadId, companyId } = await req.json();
    if (!messageId && !threadId) {
      return NextResponse.json({ error: 'messageId or threadId is required' }, { status: 400 });
    }

    // Same token-resolution order as draft-reply: caller-provided id → default
    // company → any-available. Keeps reads/writes on the same token path.
    let refreshToken: string | undefined;
    if (companyId && companyId !== 'default') {
      const integrations = await getCompanyIntegrations(companyId);
      refreshToken = integrations?.google?.refreshToken;
    }
    const defaultCompanyId = process.env.DMA_DEFAULT_COMPANY_ID;
    if (!refreshToken && defaultCompanyId) {
      const integrations = await getCompanyIntegrations(defaultCompanyId);
      refreshToken = integrations?.google?.refreshToken;
    }
    if (!refreshToken) refreshToken = (await getAnyGoogleRefreshToken()) || undefined;
    if (!refreshToken) {
      return NextResponse.json({ error: 'No Google refresh token available' }, { status: 500 });
    }

    const accessToken = await refreshAccessToken(refreshToken);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    // Prefer thread-level modification — clears UNREAD across all messages in
    // the thread. Chris shouldn't see the "1 unread" count for a thread he's
    // already engaging with.
    if (threadId) {
      await gmail.users.threads.modify({
        userId: 'me',
        id: threadId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
      return NextResponse.json({ ok: true, target: 'thread', id: threadId });
    }

    // Fallback to message-level.
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
    return NextResponse.json({ ok: true, target: 'message', id: messageId });
  } catch (err) {
    console.error('[gmail/mark-read] error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to mark as read';
    const lower = msg.toLowerCase();
    // Scope missing? Callers need to know so they can surface the reconnect banner.
    if (
      lower.includes('insufficient') ||
      lower.includes('scope') ||
      lower.includes('permission')
    ) {
      return NextResponse.json(
        {
          error: 'Google permission missing (gmail.modify). Reconnect Google to grant mark-as-read access.',
          detail: msg,
          needsReconnect: true,
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
