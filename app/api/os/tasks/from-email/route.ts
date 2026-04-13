// app/api/os/tasks/from-email/route.ts
// Fetches a Gmail message by id and AI-parses it into a task prefill.
// Does NOT write to Airtable — returns { prefill } for the edit panel to confirm.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const anthropic = new Anthropic();

type MsgPart = { mimeType?: string | null; body?: { data?: string | null } | null; parts?: MsgPart[] | null };
function extractPlainText(payload: MsgPart | undefined | null): string {
  let body = '';
  const walk = (part: MsgPart | undefined | null) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n';
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return body;
}

export async function POST(req: NextRequest) {
  try {
    const { messageId, threadId, companyId } = await req.json();
    if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 });

    // Resolve refresh token
    let refreshToken: string | undefined;
    if (companyId && companyId !== 'default') {
      const integrations = await getCompanyIntegrations(companyId);
      refreshToken = integrations?.google?.refreshToken;
    }
    if (!refreshToken) refreshToken = (await getAnyGoogleRefreshToken()) || undefined;
    if (!refreshToken) return NextResponse.json({ error: 'No Google refresh token available' }, { status: 500 });

    const accessToken = await refreshAccessToken(refreshToken);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const headers = msg.data.payload?.headers || [];
    const get = (n: string) => headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
    const subject = get('Subject');
    const from = get('From');
    const dateHdr = get('Date');
    const body = extractPlainText(msg.data.payload as MsgPart) || msg.data.snippet || '';
    const trimmed = body.slice(0, 6000);
    const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${threadId || msg.data.threadId || messageId}`;

    // AI parse
    const ai = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `You are a task parser for a digital agency owner named Chris Lloyd who runs Hive Ad Agency.
An email has arrived that Chris needs to act on. Parse it into a structured task.

Email:
From: ${from}
Subject: ${subject}
Date: ${dateHdr}

"""
${trimmed}
"""

Return a JSON object with these fields (ONLY JSON, no markdown):
- "task": concise task title (max 60 chars) describing what Chris needs to DO (not the email subject). Examples: "Review A/R Aging, follow up on Acme past due", "Upload tax docs to TaxCaddy", "Reply to Jim re: geofence data".
- "from": the sender's name (or first name if available).
- "project": best-guess project category. Common ones: "Car Toys 2026 Media", "Car Toys Tint", "Car Toys / Billing", "HEY / Eric Request", "Hive Admin", "Hive Billing", "Legal", "Portage Bank". Empty string if unsure.
- "nextAction": 1-2 sentences describing the specific next step.
- "priority": "P0" (blocking today), "P1" (this week, important), "P2" (normal), "P3" (backlog).
- "due": suggested due date YYYY-MM-DD based on any mentioned deadline, or "" if none.
- "status": "Inbox" for new triage items, "Next" if ready to do.
- "notes": any key facts or context worth preserving (numbers, names, amounts). Keep under 300 chars. Empty string if nothing notable.`,
        },
      ],
    });

    const content = ai.content[0];
    if (content.type !== 'text') throw new Error('Unexpected AI response type');
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(jsonText);

    const prefill = {
      task: parsed.task || subject || '(untitled)',
      from: parsed.from || from,
      project: parsed.project || '',
      nextAction: parsed.nextAction || '',
      priority: parsed.priority || 'P2',
      due: parsed.due || '',
      status: parsed.status || 'Inbox',
      notes: parsed.notes || '',
      threadUrl: gmailLink,
    };

    return NextResponse.json({ prefill, source: { subject, from, link: gmailLink } });
  } catch (err) {
    console.error('[from-email] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to parse email' },
      { status: 500 },
    );
  }
}
