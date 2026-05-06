// app/api/os/gmail/thread-preview
// GET /api/os/gmail/thread-preview?threadId=<gmailThreadId>
//
// Returns the latest non-Chris message in a thread for inline hover-preview
// rendering in My Day. Cheap, single-thread fetch — distinct from the heavier
// cross-thread context the next-step route builds.
//
// Response shape:
//   { from: string, when: string, snippet: string, fromMe: boolean }
//
// `from` is the human-friendly name when available, falling back to email.
// `when` is the raw RFC 2822 Date header value (formatted client-side).
// `snippet` is the body's first ~280 chars with quoted history stripped.
// `fromMe` is true if every message in the thread is from Chris (no inbound
// to nudge against) — caller can render a different message in that case.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken, getGoogleAccountEmail } from '@/lib/google/oauth';
import { extractBody, stripQuotedReply } from '@/lib/gmail/threadContext';
import type { MsgPart } from '@/lib/gmail/threadContext';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const PREVIEW_MAX_CHARS = 280;

function parseFromHeader(h: string): { name: string; email: string } {
  if (!h) return { name: '', email: '' };
  const bracket = h.match(/<([^>]+)>/);
  if (bracket) {
    const email = bracket[1].trim();
    const name = h.slice(0, h.indexOf('<')).trim().replace(/^"|"$/g, '');
    return { name, email };
  }
  const bare = h.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (bare) return { name: '', email: bare[0] };
  return { name: h.trim(), email: '' };
}

export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get('threadId');
  if (!threadId) {
    return NextResponse.json({ error: 'threadId required' }, { status: 400 });
  }

  try {
    let refreshToken: string | undefined;
    const defaultCompanyId = process.env.DMA_DEFAULT_COMPANY_ID;
    if (defaultCompanyId) {
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

    const myEmail = (await getGoogleAccountEmail(accessToken)) || '';
    const myEmailLower = myEmail.toLowerCase();

    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });
    const messages = thread.data.messages || [];
    if (messages.length === 0) {
      return NextResponse.json({ from: '', when: '', snippet: '', fromMe: true });
    }

    // Walk newest → oldest, pick the first non-Chris message.
    let chosen: typeof messages[number] | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const fromVal = (m.payload?.headers || []).find(
        (h) => h.name?.toLowerCase() === 'from',
      )?.value || '';
      if (myEmailLower && fromVal.toLowerCase().includes(myEmailLower)) continue;
      chosen = m;
      break;
    }

    // If every message was self-sent, fall back to the latest message — caller
    // gets fromMe:true and can render "you sent: ...".
    let fromMe = false;
    if (!chosen) {
      chosen = messages[messages.length - 1];
      fromMe = true;
    }
    if (!chosen) {
      return NextResponse.json({ from: '', when: '', snippet: '', fromMe: true });
    }

    const headers = chosen.payload?.headers || [];
    const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
    const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || '';
    const { name, email } = parseFromHeader(fromHeader);
    const fromLabel = fromMe ? 'You' : (name || email || 'Unknown');

    const rawBody = extractBody(chosen.payload as MsgPart) || chosen.snippet || '';
    let cleaned = stripQuotedReply(rawBody).replace(/\s+/g, ' ').trim();
    if (cleaned.length > PREVIEW_MAX_CHARS) {
      cleaned = cleaned.slice(0, PREVIEW_MAX_CHARS).trim() + '…';
    }

    return NextResponse.json({
      from: fromLabel,
      when: dateHeader,
      snippet: cleaned,
      fromMe,
    });
  } catch (err) {
    console.error('[thread-preview] error:', err);
    const msg = err instanceof Error ? err.message : 'Thread preview failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
