/**
 * Gmail draft creation — given a `messageId` and a body, create a draft reply
 * in the same thread, properly threaded with In-Reply-To + References headers.
 *
 * Pure, single-purpose utility. Does NOT generate the body — caller supplies
 * it. Used by:
 *   - /api/os/gmail/draft-reply         (AI-generated body)
 *   - /api/os/tasks/[id]/apply-decision (body comes from decision engine)
 *
 * Never sends the email. Only creates a draft. The user reviews + sends from
 * Gmail.
 */

import { google } from 'googleapis';

type MsgPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: MsgPart[] | null;
};

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
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  const b64 = Buffer.from(str, 'utf-8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

function parseEmailHeader(h: string): { name: string; email: string } {
  const m = h.match(/^\s*"?([^"<]*?)"?\s*<?([^>]+)>?\s*$/);
  return { name: (m?.[1] || '').trim(), email: (m?.[2] || h).trim() };
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
}): string {
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
  return Buffer.from(raw, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface CreatedDraft {
  draftId: string;
  threadId: string;
  toEmail: string;
  toName: string;
  subject: string;
  bodyChars: number;
  /** Echo of the original message so caller can log + display context. */
  originalSnippet: string;
}

/**
 * Fetch the original message, build a properly-threaded reply with the
 * supplied body, and create the draft in Gmail. Returns metadata about the
 * created draft.
 */
export async function createDraftReply(params: {
  accessToken: string;
  messageId: string;
  /** Optional fallback if the message has no threadId. */
  threadId?: string;
  /** Plain-text body to use verbatim. No AI generation here. */
  body: string;
  /** Sender identity (defaults are pulled by caller, not this util). */
  myEmail: string;
  myName?: string;
}): Promise<CreatedDraft> {
  const { accessToken, messageId, threadId: threadIdFallback, body, myEmail, myName } = params;

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth });

  const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const headers = msg.data.payload?.headers || [];
  const get = (n: string) =>
    headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
  const subject = get('Subject') || '(no subject)';
  const fromHeader = get('From') || '';
  const messageIdHdr = get('Message-ID');
  const referencesHdr = get('References');
  const threadId = msg.data.threadId || threadIdFallback || '';
  const originalSnippet =
    extractPlainText(msg.data.payload as MsgPart).slice(0, 500) ||
    msg.data.snippet?.slice(0, 500) ||
    '';

  const { name: fromName, email: fromEmail } = parseEmailHeader(fromHeader);

  const raw = buildRawReply({
    fromEmail: myEmail,
    fromName: myName,
    toEmail: fromEmail,
    toName: fromName,
    subject,
    inReplyTo: messageIdHdr,
    references: referencesHdr ? `${referencesHdr} ${messageIdHdr}` : messageIdHdr,
    body,
  });

  const draft = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        threadId,
        raw,
      },
    },
  });

  return {
    draftId: draft.data.id || '',
    threadId,
    toEmail: fromEmail,
    toName: fromName,
    subject,
    bodyChars: body.length,
    originalSnippet,
  };
}

// Exposed for tests / callers that need the lower-level pieces.
export const _internal = { extractPlainText, parseEmailHeader, buildRawReply, encodeRFC2047 };
