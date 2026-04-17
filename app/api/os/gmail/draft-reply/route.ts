// app/api/os/gmail/draft-reply/route.ts
// Fetches a Gmail message, AI-generates a reply body in Chris's voice,
// and creates a Gmail draft in the same thread. Does NOT send.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken, getGoogleAccountEmail } from '@/lib/google/oauth';
import { getIdentity, getVoice, getVoiceRulesBlock } from '@/lib/personalContext';
import { logEventAsync } from '@/lib/airtable/activityLog';

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

function encodeRFC2047(str: string): string {
  // Simple UTF-8 MIME encoded-word for headers with non-ASCII chars
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  const b64 = Buffer.from(str, 'utf-8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

function buildRawReply(params: {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toName?: string;
  subject: string;
  inReplyTo: string;
  references: string;
  body: string;
}) {
  const { fromEmail, fromName, toEmail, toName, subject, inReplyTo, references, body } = params;
  const fromHdr = fromName ? `${encodeRFC2047(fromName)} <${fromEmail}>` : fromEmail;
  const toHdr = toName ? `${encodeRFC2047(toName)} <${toEmail}>` : toEmail;
  const subjectHdr = encodeRFC2047(subject.startsWith('Re:') ? subject : `Re: ${subject}`);

  const lines = [
    `From: ${fromHdr}`,
    `To: ${toHdr}`,
    `Subject: ${subjectHdr}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
    references ? `References: ${references}` : '',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ].filter(Boolean);

  const raw = lines.join('\r\n');
  return Buffer.from(raw, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseEmailHeader(h: string): { name: string; email: string } {
  const m = h.match(/^\s*"?([^"<]*?)"?\s*<?([^>]+)>?\s*$/);
  return { name: (m?.[1] || '').trim(), email: (m?.[2] || h).trim() };
}

export async function POST(req: NextRequest) {
  try {
    const { messageId, threadId: _threadId, companyId, customInstructions } = await req.json();
    if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 });

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

    // Fetch the message
    const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const headers = msg.data.payload?.headers || [];
    const get = (n: string) => headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
    const subject = get('Subject');
    const fromHeader = get('From');
    const messageIdHdr = get('Message-ID');
    const referencesHdr = get('References');
    const body = extractPlainText(msg.data.payload as MsgPart) || msg.data.snippet || '';
    const trimmed = body.slice(0, 6000);
    const threadId = msg.data.threadId || _threadId;

    const { name: fromName, email: fromEmail } = parseEmailHeader(fromHeader);

    // Gmail profile (not OAuth2 userinfo — our scopes include gmail.* only)
    const [profileEmail, identity, voice, voiceRules] = await Promise.all([
      getGoogleAccountEmail(accessToken),
      getIdentity(),
      getVoice(),
      getVoiceRulesBlock(),
    ]);
    const myEmail = profileEmail || identity.email;
    const myName = identity.name;

    // AI-generate reply body
    const instructionsBlock = customInstructions
      ? `Additional instructions from ${identity.name}: ${customInstructions}\n\n`
      : '';
    const ai = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `You are drafting a reply on behalf of ${identity.name}, ${identity.role} of ${identity.company}. Write in their voice: ${voice.tone}. No corporate fluff.

${voiceRules}

${instructionsBlock}Original email:
From: ${fromHeader}
Subject: ${subject}

"""
${trimmed}
"""

Draft a reply that ${identity.name} can quickly review and send. Return ONLY the body text, no JSON, no quote block, no markdown fences.`,
        },
      ],
    });

    const content = ai.content[0];
    if (content.type !== 'text') throw new Error('Unexpected AI response type');
    const replyBody = content.text.trim();

    // Build raw RFC 2822 message
    const raw = buildRawReply({
      fromEmail: myEmail,
      fromName: myName,
      toEmail: fromEmail,
      toName: fromName,
      subject,
      inReplyTo: messageIdHdr,
      references: referencesHdr ? `${referencesHdr} ${messageIdHdr}` : messageIdHdr,
      body: replyBody,
    });

    // Create draft in the original thread
    const draft = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          threadId,
          raw,
        },
      },
    });

    const draftId = draft.data.id;

    logEventAsync({
      actorType: 'ai',
      actor: 'ai-drafter',
      action: 'email.draft-created',
      entityType: 'email',
      entityId: threadId || messageId,
      entityTitle: subject,
      summary: `Draft reply created for "${subject}" → ${fromEmail}`,
      metadata: {
        draftId,
        threadId,
        messageId,
        to: fromEmail,
        subject,
        hasCustomInstructions: Boolean(customInstructions),
        bodyChars: replyBody.length,
      },
      source: 'app/api/os/gmail/draft-reply',
    });
    // Gmail's web app doesn't expose a stable deep-link to a specific draft by draftId,
    // but the draft is visible in the original thread view. That's the best landing spot.
    const threadUrl = threadId ? `https://mail.google.com/mail/u/0/#inbox/${threadId}` : 'https://mail.google.com/mail/u/0/#drafts';

    return NextResponse.json({
      draftId,
      draftUrl: threadUrl,   // UI opens this — lands on the thread with the new draft
      threadUrl,
      body: replyBody,
      to: fromEmail,
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
    });
  } catch (err) {
    console.error('[draft-reply] error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to create draft';
    const lower = msg.toLowerCase();
    let friendly = msg;
    let status = 500;
    if (lower.includes('insufficient') || lower.includes('scope') || lower.includes('forbidden') || lower.includes('permission') || lower.includes('authentication credential') || lower.includes('access token') || lower.includes('unauthenticated')) {
      friendly = 'Google permission missing (gmail.compose). Disconnect and reconnect Google integration to grant draft access.';
      status = 403;
    } else if (lower.includes('invalid_grant') || lower.includes('refresh')) {
      friendly = 'Google token expired. Reconnect Google integration.';
      status = 401;
    }
    return NextResponse.json({ error: friendly, detail: msg }, { status });
  }
}
