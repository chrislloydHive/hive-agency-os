// lib/gmail/threadContext.ts
//
// Shared helpers for building conversation context out of Gmail thread data.
// Used by:
//   - /api/os/gmail/draft-reply — to give Claude the whole back-and-forth when
//     generating a reply, not just the single message being replied to.
//   - /api/os/sync/auto-tasks  — to refresh a task's Next Action when a new
//     reply lands in the underlying thread.
//
// Kept lightweight (no external deps) and tolerant of partial data — any
// message missing bodies or headers just contributes what it has.

export type MsgPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: MsgPart[] | null;
};

/** Thread root messages include RFC822 `headers` alongside MIME `parts`. */
export type GmailMessageLike = {
  id?: string | null;
  snippet?: string | null;
  internalDate?: string | null;
  payload?: (MsgPart & {
    headers?: Array<{ name?: string | null; value?: string | null }> | null;
  }) | null;
};

/** Minimal HTML → text conversion for text/html-only messages (Framer,
 *  Mailchimp, some iOS clients). Not a full HTML parser — good enough to
 *  preserve readable text without markup noise. */
function stripTagsToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Turn block-closing tags into spaces so "<p>A</p><p>B</p>" → "A B".
    .replace(/<\/(p|div|li|h[1-6]|tr|td|br)\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Best-effort body text for a Gmail message. Prefers text/plain; falls back
 *  to text/html → stripped text when plain is empty. */
export function extractBody(payload: MsgPart | undefined | null): string {
  if (!payload) return '';
  let plain = '';
  let html = '';
  const walk = (part: MsgPart | undefined | null) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      plain += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n';
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n';
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  if (plain.trim()) return plain;
  if (html.trim()) return stripTagsToText(html);
  return '';
}

/** Strip common quoted-reply boilerplate so conversation transcripts don't
 *  repeat the same content N times as the thread grows. Handles:
 *   - Gmail: "On <date>, <name> wrote:" anchor — truncates from that line.
 *   - Outlook: "-----Original Message-----" separator — truncates from there.
 *   - Leading ">" quoted lines — dropped entirely. */
export function stripQuotedReply(text: string): string {
  let out = text;
  const onWroteMatch = out.match(/\n[^\n]*\bOn\b[^\n]{0,200}?\bwrote:\s*$/im);
  if (onWroteMatch && typeof onWroteMatch.index === 'number') {
    out = out.slice(0, onWroteMatch.index);
  }
  const outlookMatch = out.match(/\n-{2,}\s*Original Message\s*-{2,}/i);
  if (outlookMatch && typeof outlookMatch.index === 'number') {
    out = out.slice(0, outlookMatch.index);
  }
  out = out
    .split('\n')
    .filter((line) => !/^\s*>/.test(line))
    .join('\n');
  return out.trim();
}

/** Simple parser for Gmail `From:` headers. Returns `{name, email}`.
 *  Handles `"Display" <a@b.com>`, `a@b.com`, and malformed strings. */
function parseFromHeader(h: string): { name: string; email: string } {
  if (!h) return { name: '', email: '' };
  const bracketMatch = h.match(/<([^>]+)>/);
  if (bracketMatch) {
    const email = bracketMatch[1].trim();
    const name = h.slice(0, h.indexOf('<')).trim().replace(/^"|"$/g, '');
    return { name, email };
  }
  const bareEmail = h.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (bareEmail) return { name: '', email: bareEmail[0] };
  return { name: h.trim(), email: '' };
}

export interface ConversationTurn {
  /** "Me" when the message was from the current user, otherwise display name
   *  or bare email. */
  fromLabel: string;
  /** Raw `Date:` header value, or empty if unavailable. */
  date: string;
  /** Body with quoted history stripped. May be empty for messages with no
   *  plain/html body (unusual but possible). */
  body: string;
}

export function messageToTurn(msg: GmailMessageLike, myEmailLower: string): ConversationTurn {
  const headers = msg.payload?.headers || [];
  const getHdr = (n: string) =>
    headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
  const fromHeader = getHdr('From');
  const dateHeader = getHdr('Date');
  const { name, email } = parseFromHeader(fromHeader);
  const isMe = !!myEmailLower && email.toLowerCase() === myEmailLower;
  const rawBody = extractBody(msg.payload as MsgPart) || msg.snippet || '';
  const cleaned = stripQuotedReply(rawBody);
  return {
    fromLabel: isMe ? 'Me' : name || email || 'Unknown sender',
    date: dateHeader,
    body: cleaned,
  };
}

export function formatTurn(t: ConversationTurn): string {
  const header = t.date ? `${t.fromLabel} — ${t.date}` : t.fromLabel;
  return `[${header}]\n${t.body}`;
}

export interface TranscriptOptions {
  /** Max chars per individual turn after quote-stripping. Prevents one huge
   *  forwarded email from blowing the overall budget. */
  maxCharsPerTurn: number;
  /** Total budget for the entire transcript. Oldest turns drop first when
   *  over budget so freshest context survives. */
  maxTotalChars: number;
}

/** Build a compact chronological transcript from a list of Gmail messages.
 *  Dropped older turns are indicated in the output so the model knows
 *  context was elided (and how much).
 *
 *  Input must be in chronological order (oldest → newest), which is the
 *  order Gmail returns from threads.get. */
export function buildConversationTranscript(
  messages: GmailMessageLike[],
  myEmailLower: string,
  opts: TranscriptOptions,
): string {
  if (messages.length === 0) return '';
  const turns = messages.map((m) => messageToTurn(m, myEmailLower));
  for (const t of turns) {
    if (t.body.length > opts.maxCharsPerTurn) {
      t.body = t.body.slice(0, opts.maxCharsPerTurn).trim() + '…';
    }
  }
  // Walk newest → oldest, accumulate until the budget is hit; reverse at the
  // end to restore chronological order for the output.
  const kept: ConversationTurn[] = [];
  let total = 0;
  let droppedCount = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const block = formatTurn(turns[i]);
    if (total + block.length > opts.maxTotalChars && kept.length > 0) {
      droppedCount = i + 1;
      break;
    }
    kept.unshift(turns[i]);
    total += block.length;
  }
  let out = kept.map(formatTurn).join('\n---\n');
  if (droppedCount > 0) {
    out =
      `[…${droppedCount} earlier message${droppedCount > 1 ? 's' : ''} omitted for brevity…]\n---\n` +
      out;
  }
  return out;
}
