// app/api/os/gmail/draft-reply/route.ts
// Fetches a Gmail message, AI-generates a reply body in Chris's voice,
// and creates a Gmail draft in the same thread. Does NOT send.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { callAnthropicWithRetry, httpStatusForAnthropicError } from '@/lib/ai/anthropicRetry';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken, getGoogleAccountEmail } from '@/lib/google/oauth';
import { getIdentity, getVoice, getVoiceRulesBlock } from '@/lib/personalContext';
import { logEventAsync } from '@/lib/airtable/activityLog';
import {
  extractBody,
  buildConversationTranscript,
  type MsgPart,
} from '@/lib/gmail/threadContext';
import { findTaskByThreadUrl, updateTask } from '@/lib/airtable/tasks';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const anthropic = new Anthropic();

// Thread-body + transcript helpers live in lib/gmail/threadContext.ts and are
// shared with the auto-tasks sync (Phase 2 of smart tasks). See imports above.

function encodeRFC2047(str: string): string {
  // Simple UTF-8 MIME encoded-word for headers with non-ASCII chars
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  const b64 = Buffer.from(str, 'utf-8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

/** Convert plain-text reply body into simple HTML (preserves line breaks). */
function bodyToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Paragraphs on blank lines; <br> on single newlines.
  return escaped
    .split(/\n\s*\n/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
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
  /** Optional HTML signature (from Gmail sendAs). When provided, the draft is
   *  built as multipart/alternative — plain text for older clients, HTML for
   *  modern ones. Signature goes at the end of both. */
  htmlSignature?: string;
}) {
  const { fromEmail, fromName, toEmail, toName, subject, inReplyTo, references, body, htmlSignature } = params;
  const fromHdr = fromName ? `${encodeRFC2047(fromName)} <${fromEmail}>` : fromEmail;
  const toHdr = toName ? `${encodeRFC2047(toName)} <${toEmail}>` : toEmail;
  const subjectHdr = encodeRFC2047(subject.startsWith('Re:') ? subject : `Re: ${subject}`);

  const commonHeaders = [
    `From: ${fromHdr}`,
    `To: ${toHdr}`,
    `Subject: ${subjectHdr}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
    references ? `References: ${references}` : '',
    'MIME-Version: 1.0',
  ].filter(Boolean);

  let raw: string;

  if (htmlSignature) {
    // multipart/alternative: both a plain and HTML version of the body.
    // HTML version includes the user's real Gmail signature (logo, styled).
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const plainBody = body; // Plain body stands on its own; the signature is
                            // rich HTML and doesn't degrade cleanly, so we skip
                            // it from the plain part.
    const htmlBody = `${bodyToHtml(body)}\n<br>\n${htmlSignature}`;

    raw = [
      ...commonHeaders,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      plainBody,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
      '',
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    // Plain-only fallback (gmail.settings.basic scope not yet granted).
    raw = [
      ...commonHeaders,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
    ].join('\r\n');
  }

  return Buffer.from(raw, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Fetch the user's HTML signature for the given send-as address (their main
 *  account email by default). Returns empty string on permission issues so
 *  the draft can still be built without a signature. */
async function fetchSignature(
  gmail: ReturnType<typeof google.gmail>,
  sendAsEmail: string,
): Promise<string> {
  try {
    const list = await gmail.users.settings.sendAs.list({ userId: 'me' });
    const addresses = list.data.sendAs || [];
    // Prefer the one matching our from address; fall back to isPrimary.
    const match =
      addresses.find((a) => a.sendAsEmail?.toLowerCase() === sendAsEmail.toLowerCase())
      ?? addresses.find((a) => a.isPrimary);
    return (match?.signature || '').trim();
  } catch (err) {
    console.warn('[draft-reply] fetchSignature failed (non-fatal):', err instanceof Error ? err.message : err);
    return '';
  }
}

function parseEmailHeader(h: string): { name: string; email: string } {
  if (!h) return { name: '', email: '' };

  // Prefer anything inside angle brackets: `Display Name <a@b.com>` → `a@b.com`
  const bracketMatch = h.match(/<([^>]+)>/);
  if (bracketMatch) {
    const email = bracketMatch[1].trim();
    const name = h.slice(0, h.indexOf('<')).trim().replace(/^"|"$/g, '');
    return { name, email };
  }

  // No brackets — look for a bare email address anywhere in the string.
  const bareEmail = h.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (bareEmail) {
    return { name: '', email: bareEmail[0] };
  }

  // Nothing usable — return empty email so the caller can error clearly
  // instead of shipping a malformed To: header to Gmail.
  return { name: h.trim(), email: '' };
}

/** Quick sanity check before we hand a recipient to Gmail. */
function looksLikeEmail(addr: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
}

/** Call Google's tokeninfo endpoint to see what scopes the access token actually has.
 *  Used as a diagnostic when drafts fail — the error surfaces this back to the UI so
 *  the user can tell whether the reconnect actually granted gmail.compose. */
async function introspectScopes(accessToken: string): Promise<string[] | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const scopeStr = typeof json?.scope === 'string' ? json.scope : '';
    return scopeStr.split(/\s+/).filter(Boolean);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let accessTokenForDiagnostics: string | null = null;
  let tokenSourceForDiagnostics = 'none';
  try {
    const {
      messageId: providedMessageId,
      threadId: providedThreadId,
      companyId,
      customInstructions,
    } = await req.json();

    if (!providedMessageId && !providedThreadId) {
      return NextResponse.json({ error: 'messageId or threadId is required' }, { status: 400 });
    }

    // Token resolution preference order:
    //  1. explicitly-provided companyId
    //  2. DMA_DEFAULT_COMPANY_ID (the record the reconnect flow writes to)
    //  3. any record with a Google refresh token (last-resort fallback)
    //
    // Without preference #2, if Airtable has multiple CompanyIntegrations records,
    // reconnecting could update the "right" record while reads still hit a stale one.
    let refreshToken: string | undefined;
    if (companyId && companyId !== 'default') {
      const integrations = await getCompanyIntegrations(companyId);
      if (integrations?.google?.refreshToken) {
        refreshToken = integrations.google.refreshToken;
        tokenSourceForDiagnostics = `companyId=${companyId}`;
      }
    }
    const defaultCompanyId = process.env.DMA_DEFAULT_COMPANY_ID;
    if (!refreshToken && defaultCompanyId) {
      const integrations = await getCompanyIntegrations(defaultCompanyId);
      if (integrations?.google?.refreshToken) {
        refreshToken = integrations.google.refreshToken;
        tokenSourceForDiagnostics = `default (${defaultCompanyId})`;
      }
    }
    if (!refreshToken) {
      refreshToken = (await getAnyGoogleRefreshToken()) || undefined;
      if (refreshToken) tokenSourceForDiagnostics = 'fallback (getAnyGoogleRefreshToken)';
    }
    if (!refreshToken) return NextResponse.json({ error: 'No Google refresh token available' }, { status: 500 });
    console.log(`[draft-reply] Using token from: ${tokenSourceForDiagnostics}`);

    const accessToken = await refreshAccessToken(refreshToken);
    accessTokenForDiagnostics = accessToken;
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    // Grab my email early so we can skip self-sent messages when picking the
    // latest message in a thread (replying to yourself = invalid To header).
    const [profileEmail, identity, voice, voiceRules] = await Promise.all([
      getGoogleAccountEmail(accessToken),
      getIdentity(),
      getVoice(),
      getVoiceRulesBlock(),
    ]);
    const myEmail = profileEmail || identity.email;
    const myName = identity.name;
    const myEmailLower = (myEmail || '').toLowerCase();

    // If the caller only has a threadId, pick the latest message in the thread
    // that wasn't sent by us (we want to reply TO someone, not to ourselves).
    let messageId: string = providedMessageId;
    if (!messageId && providedThreadId) {
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: providedThreadId,
        format: 'metadata',
        metadataHeaders: ['From', 'Date'],
      });
      const messages = thread.data.messages || [];
      if (messages.length === 0) {
        return NextResponse.json({ error: `Thread ${providedThreadId} has no messages` }, { status: 404 });
      }
      // Walk from newest → oldest; pick the first one NOT from us.
      let chosen = null as (typeof messages)[number] | null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const hdrs = messages[i].payload?.headers || [];
        const fromVal = (hdrs.find(h => h.name?.toLowerCase() === 'from')?.value || '').toLowerCase();
        if (!myEmailLower || !fromVal.includes(myEmailLower)) {
          chosen = messages[i];
          break;
        }
      }
      // Fall back to the latest if every message was from us (self-thread).
      if (!chosen) chosen = messages[messages.length - 1];
      if (!chosen?.id) {
        return NextResponse.json({ error: 'Could not resolve latest message id from thread' }, { status: 500 });
      }
      messageId = chosen.id;
    }

    // Fetch the message
    const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const headers = msg.data.payload?.headers || [];
    const get = (n: string) => headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
    const subject = get('Subject');
    const fromHeader = get('From');
    const messageIdHdr = get('Message-ID');
    const referencesHdr = get('References');
    const body = extractBody(msg.data.payload as MsgPart) || msg.data.snippet || '';
    const trimmed = body.slice(0, 6000);
    const threadId = msg.data.threadId || providedThreadId;

    // Fetch the full thread so the AI sees the whole back-and-forth, not just
    // the single message being replied to. Graceful-degrade on failure — the
    // single-message path still works without conversation context.
    let conversationTranscript = '';
    if (threadId) {
      try {
        const threadFull = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'full',
        });
        const threadMessages = threadFull.data.messages || [];
        // Prior turns = everything BEFORE the target message (chronological order).
        // threads.get returns oldest → newest, so slice up to the target's index.
        const targetIdx = threadMessages.findIndex((m) => m.id === messageId);
        const priorMessages = targetIdx > 0 ? threadMessages.slice(0, targetIdx) : [];
        conversationTranscript = buildConversationTranscript(priorMessages, myEmailLower, {
          maxCharsPerTurn: 600,
          maxTotalChars: 4000,
        });
      } catch (err) {
        console.warn(
          '[draft-reply] full-thread fetch failed (non-fatal, proceeding with single-message context):',
          err instanceof Error ? err.message : err,
        );
      }
    }

    let { name: fromName, email: fromEmail } = parseEmailHeader(fromHeader);

    // Form-submission relay fix: when the email came from a no-reply address
    // (Framer, Typeform, Webflow, etc.) but the body contains an explicit
    // "Email:" field from the form, reply to the *submitter*, not the relay.
    // Without this, AI drafts would politely go to noreply@framer.com.
    const isSubmissionRelay =
      /^\s*new\s+submission/i.test(subject) ||
      /\bno[-]?reply@|\bnotifications?@|\bdonotreply@/i.test(fromEmail);
    if (isSubmissionRelay) {
      const bodyEmailMatch = trimmed.match(/^\s*email\s*:\s*([^\s<>]+@[^\s<>]+)/im);
      if (bodyEmailMatch && looksLikeEmail(bodyEmailMatch[1].trim())) {
        fromEmail = bodyEmailMatch[1].trim();
        const bodyNameMatch = trimmed.match(/^\s*name\s*:\s*([^\r\n]+)/im);
        fromName = bodyNameMatch ? bodyNameMatch[1].trim() : '';
      }
    }

    // Sanity check: did we end up with a real recipient? If not, bail loudly so
    // the UI can tell the user what's wrong instead of Gmail's generic
    // "Invalid To header" response.
    if (!looksLikeEmail(fromEmail)) {
      return NextResponse.json(
        {
          error: `Can't draft reply — recipient address not usable. Parsed From: "${fromHeader}" → "${fromEmail}". This usually happens when the latest message in the thread has no sender email (e.g. a forwarded or mailing-list email), or when the only messages in the thread were sent by you.`,
          fromHeaderRaw: fromHeader,
          parsedEmail: fromEmail,
        },
        { status: 422 },
      );
    }

    // AI-generate reply body
    const instructionsBlock = customInstructions
      ? `Additional instructions from ${identity.name}: ${customInstructions}\n\n`
      : '';
    // When this is a form-submission relay, tell the AI explicitly who the
    // reply is going to — the From header says "Framer <noreply@...>" but the
    // actual recipient is the form submitter whose email we pulled from the body.
    const recipientHint = isSubmissionRelay
      ? `\n\nNote: this is a website form submission. The reply will go to the submitter at ${fromEmail}${fromName ? ` (${fromName})` : ''}, NOT to the form relay service. Address your reply to that person, not to "Framer".`
      : '';

    // Fetch the user's real Gmail signature (HTML with logo/formatting).
    // Requires gmail.settings.basic scope — falls back to AI-written sign-off
    // if missing, so the draft still has some attribution.
    const htmlSignature = await fetchSignature(gmail, myEmail);

    const aiResult = await callAnthropicWithRetry(
      () =>
        anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          messages: [
            {
              role: 'user',
              content: `You are drafting a reply on behalf of ${identity.name}, ${identity.role} of ${identity.company}. Write in their voice: ${voice.tone}. No corporate fluff.

${voiceRules}

${instructionsBlock}${conversationTranscript
  ? `Prior conversation in this thread (oldest → newest, quoted history stripped):
"""
${conversationTranscript}
"""

`
  : ''}Message being replied to:
From: ${fromHeader}
Subject: ${subject}${recipientHint}

"""
${trimmed}
"""

Draft a reply that ${identity.name} can quickly review and send. Use the prior conversation (if shown above) to understand what's already been discussed, agreed, promised, or left open — don't repeat context the other party already has. If the message references something from earlier in the thread, match that reference accurately. Return ONLY the body text, no JSON, no quote block, no markdown fences.

${htmlSignature
  ? 'Do NOT include a signature — one will be appended automatically. End the body with a simple sign-off word like "Thanks," or "Best," on its own line.'
  : `End the reply with this signature on its own lines, preceded by a blank line:\n\n${identity.name}${identity.role && identity.company ? `\n${identity.role}, ${identity.company}` : ''}`}`,
            },
          ],
        }),
      'draft-reply',
    );

    if (!aiResult.ok) {
      const status = httpStatusForAnthropicError(aiResult);
      return NextResponse.json(
        { error: aiResult.error, upstreamStatus: aiResult.upstreamStatus, retryable: aiResult.retryable },
        { status },
      );
    }

    const ai = aiResult.value;
    const content = ai.content[0];
    if (content.type !== 'text') throw new Error('Unexpected AI response type');
    const replyBody = content.text.trim();

    // Build raw RFC 2822 message (multipart with HTML signature when available)
    const raw = buildRawReply({
      fromEmail: myEmail,
      fromName: myName,
      toEmail: fromEmail,
      toName: fromName,
      subject,
      inReplyTo: messageIdHdr,
      references: referencesHdr ? `${referencesHdr} ${messageIdHdr}` : messageIdHdr,
      body: replyBody,
      htmlSignature: htmlSignature || undefined,
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

    // Mark the thread as read — Chris has engaged with it by drafting a reply.
    // Best-effort: failures here shouldn't bubble up and prevent the draft URL
    // from being returned.
    if (threadId) {
      gmail.users.threads
        .modify({ userId: 'me', id: threadId, requestBody: { removeLabelIds: ['UNREAD'] } })
        .catch((err) => console.warn('[draft-reply] mark-read failed (non-fatal):', err?.message || err));
    }

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

    // Stamp the matching Hive OS task with the new draftUrl so My Day's row
    // flips from "Draft reply" to "Review in Gmail" on next loadTasks(). Without
    // this, the row keeps showing "Draft reply" even though a Gmail draft
    // exists — confusing UX (clicking creates a duplicate draft each time).
    // Best-effort: missing/failing task lookups don't break the response.
    if (threadId) {
      try {
        const matchUrl = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
        const task = await findTaskByThreadUrl(matchUrl);
        if (task && task.draftUrl !== matchUrl) {
          await updateTask(task.id, { draftUrl: matchUrl });
        }
      } catch (err) {
        console.warn(
          '[draft-reply] failed to stamp task draftUrl (non-fatal):',
          err instanceof Error ? err.message : err,
        );
      }
    }

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
    const needsReconnect = status === 401 || status === 403;
    const defaultCompany = process.env.DMA_DEFAULT_COMPANY_ID || '';

    // Diagnostic: if we have an access token and the failure looks scope-related,
    // fetch the granted scopes from Google and surface them to the client.
    let grantedScopes: string[] | null = null;
    let missingScopes: string[] = [];
    if (accessTokenForDiagnostics && needsReconnect) {
      grantedScopes = await introspectScopes(accessTokenForDiagnostics);
      if (grantedScopes) {
        const required = [
          'https://www.googleapis.com/auth/gmail.compose',
        ];
        missingScopes = required.filter(s => !grantedScopes!.includes(s));
      }
    }

    return NextResponse.json(
      {
        error: friendly,
        detail: msg,
        ...(needsReconnect && defaultCompany
          ? { reconnectUrl: `/api/integrations/google/authorize?companyId=${defaultCompany}&redirect=${encodeURIComponent('/tasks/command-center')}` }
          : {}),
        ...(grantedScopes ? { grantedScopes, missingScopes } : {}),
        tokenSource: tokenSourceForDiagnostics,
      },
      { status },
    );
  }
}
