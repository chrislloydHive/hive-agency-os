// POST /api/os/tasks/:id/prepare
// Claude-proposed Gmail compose/reply for review — does not call Gmail send/draft APIs.

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getTasks } from '@/lib/airtable/tasks';
import type { TaskRecord } from '@/lib/airtable/tasks';
import { getGoogleAccountEmail } from '@/lib/google/oauth';
import { getIdentity } from '@/lib/personalContext';
import { getOsGoogleAccessToken } from '@/lib/gmail/osGoogleAccess';
import { extractGmailThreadIdFromUrl } from '@/lib/gmail/extractThreadIdFromUrl';
import {
  extractBody,
  type GmailMessageLike,
  type MsgPart,
} from '@/lib/gmail/threadContext';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MODEL = 'claude-sonnet-4-6';

const proposalSchema = z
  .object({
    to: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    reasoning: z.string().min(1),
    recipientConfidence: z.enum(['high', 'medium', 'low']),
  })
  .strict();

function extractJsonObject(raw: string): string {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model output');
  }
  return stripped.slice(start, end + 1);
}

function parseEmailHeader(h: string): { name: string; email: string } {
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

const zStrictEmail = z.string().email();

/** Single-line `Label: value` from Framer-style notes (same table as command center). */
function linesMatchingLabel(notes: string, labelRe: RegExp): string[] {
  const out: string[] = [];
  for (const line of notes.split(/\r?\n/)) {
    const m = line.match(labelRe);
    if (m?.[1] != null && String(m[1]).trim()) out.push(String(m[1]).trim());
  }
  return out;
}

/**
 * Parse submitter email from task Notes (`Email: …`) and topic (`Select a Topic: …`).
 * recipientConfidence: high = one Email line, zod-valid address, no display-name brackets,
 * no trimming fixes; medium = multiple Email lines, angle brackets, or punctuation trimmed;
 * low = missing or not a valid email.
 */
function parseWebsiteSubmissionNotesFields(notes: string | null | undefined): {
  email: string | null;
  recipientConfidence: 'high' | 'medium' | 'low';
  topic: string | null;
} {
  const raw = typeof notes === 'string' ? notes : '';
  const topicLines = linesMatchingLabel(raw, /^\s*Select a Topic:\s*(.+)$/i);
  const topic = topicLines.length === 0 ? null : topicLines[0];

  const emailLines = linesMatchingLabel(raw, /^\s*Email:\s*(.+)$/i);
  if (emailLines.length === 0) {
    return { email: null, recipientConfidence: 'low', topic };
  }

  const ambiguousMultipleEmail = emailLines.length > 1;
  const rawValue = emailLines[0];
  let working = rawValue.trim();
  if (working.toLowerCase().startsWith('mailto:')) {
    working = working.slice('mailto:'.length).trim();
  }

  const hadBrackets = /<[^>]+>/.test(working);
  const { email: loose } = parseEmailHeader(working);
  let candidate = (loose || working).trim();
  const beforeTrim = candidate;
  candidate = candidate.replace(/[.,;)\]]+$/g, '').trim();

  if (!candidate || !zStrictEmail.safeParse(candidate).success) {
    return { email: null, recipientConfidence: 'low', topic };
  }

  if (ambiguousMultipleEmail || hadBrackets || beforeTrim !== candidate || rawValue.trim() !== beforeTrim) {
    return { email: candidate, recipientConfidence: 'medium', topic };
  }
  return { email: candidate, recipientConfidence: 'high', topic };
}

function escapeForDoubleQuotedPrompt(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

function formatMessagesForPrompt(messages: GmailMessageLike[], max: number): string {
  const slice = messages.length <= max ? messages : messages.slice(-max);
  const blocks: string[] = [];
  let i = 0;
  for (const m of slice) {
    i += 1;
    const headers = m.payload?.headers || [];
    const get = (n: string) =>
      headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
    const subj = get('Subject');
    const from = get('From');
    const date = get('Date');
    const body = extractBody(m.payload as MsgPart).trim() || (m.snippet || '').trim();
    const clipped = body.length > 3500 ? `${body.slice(0, 3500)}…` : body;
    blocks.push(
      `--- Message ${i} (of ${slice.length} in window, chronological) ---\nSubject: ${subj}\nFrom: ${from}\nDate: ${date}\n\n${clipped}`,
    );
  }
  return blocks.join('\n\n');
}

/**
 * Prefer the latest inbound correspondent (non-self From). If the latest
 * message is from self, use the first non-self address on its To line.
 */
function replyTargetFromThread(
  messages: GmailMessageLike[],
  myEmailLower: string,
): { email: string; fromHeader: string } | null {
  for (let idx = messages.length - 1; idx >= 0; idx--) {
    const headers = messages[idx].payload?.headers || [];
    const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
    const toHeader = headers.find((h) => h.name?.toLowerCase() === 'to')?.value || '';
    const { email: fromE } = parseEmailHeader(fromHeader);
    const fromIsSelf =
      !!myEmailLower &&
      (fromHeader.toLowerCase().includes(myEmailLower) || fromE.toLowerCase() === myEmailLower);
    if (fromE && !fromIsSelf) {
      return { email: fromE, fromHeader };
    }
    const parts = toHeader.split(',').map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const { email } = parseEmailHeader(p);
      if (email && (!myEmailLower || email.toLowerCase() !== myEmailLower)) {
        return { email, fromHeader: p };
      }
    }
  }
  return null;
}

function latestThreadSubject(messages: GmailMessageLike[]): string {
  const last = messages[messages.length - 1];
  const headers = last?.payload?.headers || [];
  const subj = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value?.trim() || '';
  return subj.replace(/^Re:\s*/i, '').trim() || '(no subject)';
}

async function fetchRecentGmailHeaderHints(
  gmail: ReturnType<typeof google.gmail>,
): Promise<string> {
  try {
    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 25,
      q: 'newer_than:45d (in:inbox OR in:sent)',
    });
    const ids = (list.data.messages || []).map((m) => m.id).filter(Boolean) as string[];
    const lines: string[] = [];
    let n = 0;
    for (const id of ids.slice(0, 20)) {
      if (n >= 15) break;
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject'],
        });
        n += 1;
        const headers = msg.data.payload?.headers || [];
        const g = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
        lines.push(`- Subject: ${g('Subject')} | From: ${g('From')} | To: ${g('To')}`);
      } catch {
        // skip broken message
      }
    }
    return lines.length
      ? `Recent Gmail headers (for inferring domains / first names):\n${lines.join('\n')}`
      : '(No recent Gmail headers retrieved.)';
  } catch (e) {
    return `(Could not list recent Gmail: ${e instanceof Error ? e.message : 'unknown'})`;
  }
}

function taskJsonForPrompt(t: TaskRecord): string {
  return JSON.stringify(
    {
      id: t.id,
      title: t.task,
      source: t.source,
      nextAction: t.nextAction,
      project: t.project,
      from: t.from,
      notes: t.notes ? t.notes.slice(0, 6000) : '',
      threadUrl: t.threadUrl,
    },
    null,
    2,
  );
}

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

    const [profileEmail, identity] = await Promise.all([
      getGoogleAccountEmail(googleAccess.accessToken),
      getIdentity(),
    ]);
    const myEmail = profileEmail || identity.email;
    const myEmailLower = (myEmail || '').toLowerCase();

    const isWebsiteSubmission = task.source === 'website-submission';
    const websiteParse = isWebsiteSubmission ? parseWebsiteSubmissionNotesFields(task.notes) : null;

    const threadId = extractGmailThreadIdFromUrl(task.threadUrl);
    let threadBlock = '';
    let mode: 'reply' | 'new' = 'new';
    let replyToEmail: string | null = null;
    let threadSubjectBase = '';

    if (isWebsiteSubmission) {
      mode = 'new';
      replyToEmail = null;
      threadSubjectBase = '';
      const parts = [
        'Website form submission: the task Notes contain the submitter fields (Name, Email, Select a Topic, Message, etc.).',
        'The Gmail threadUrl on this task (if any) is only a Framer/relay notification thread — do NOT use it for recipient, subject, or reply framing.',
        'Compose a brand-new outbound email to the submitter (not an in-thread reply). Do not use a "Re:" subject or imply you are replying within that notification thread.',
      ];
      if (websiteParse?.email) {
        parts.push(`Parsed submitter Email (use as "to" exactly): ${JSON.stringify(websiteParse.email)}`);
      } else {
        parts.push(
          'No valid Email: line was parsed from notes — infer "to" from the notes text if possible, else use a clear placeholder.',
        );
      }
      if (websiteParse?.topic) {
        parts.push(`Parsed submitter topic (Select a Topic): ${JSON.stringify(websiteParse.topic)}`);
      }
      threadBlock = parts.join('\n');
    } else if (threadId) {
      try {
        const thread = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'full',
        });
        const messages = (thread.data.messages || []) as GmailMessageLike[];
        if (messages.length === 0) {
          threadBlock =
            'threadUrl was present but the Gmail thread has no messages; treat as new compose.';
        } else {
          mode = 'reply';
          const recent = messages.slice(-3);
          threadBlock = `Gmail thread id: ${threadId}\nLast 3 messages in the thread (oldest of the three first):\n\n${formatMessagesForPrompt(recent, 3)}`;
          const target = replyTargetFromThread(messages, myEmailLower);
          replyToEmail = target?.email || null;
          threadSubjectBase = latestThreadSubject(messages);
        }
      } catch (err) {
        threadBlock = `Could not fetch Gmail thread ${threadId}: ${err instanceof Error ? err.message : 'unknown error'}. Infer a new email instead.`;
      }
    } else {
      threadBlock = await fetchRecentGmailHeaderHints(gmail);
    }

    const escapedTopic = threadSubjectBase.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedTaskTitle = escapeForDoubleQuotedPrompt(task.task);
    const escapedSubmitTopic = websiteParse?.topic
      ? escapeForDoubleQuotedPrompt(websiteParse.topic)
      : '';

    const systemPrompt = isWebsiteSubmission
      ? `You are a triage assistant for Chris Lloyd's Hive OS task system.
This task is a WEBSITE FORM SUBMISSION follow-up. Output strict JSON only — no prose outside the JSON — matching this schema:
{
  "to": "<email>",
  "subject": "<subject line>",
  "body": "<full plain-text body>",
  "reasoning": "<1-2 short sentences>",
  "recipientConfidence": "high" | "medium" | "low"
}

Rules:
- This is a NEW outbound email to the human who submitted the form — NOT a reply to Framer/noreply and NOT a continuation of the notification thread. Never prefix the subject with "Re:" or "RE:" or "Fwd:".
- Do not base the subject on "New Submission" or other automated notification subject lines alone. Use the task title ("${escapedTaskTitle}")${escapedSubmitTopic ? ` and/or the submitter's chosen topic ("${escapedSubmitTopic}")` : ''} to craft a short, natural subject (e.g. their topic + "— thanks for reaching out").
- Set "to" to the parsed submitter email from Context when one is given; otherwise derive from notes "Email:" only — never use a noreply relay as the recipient.
- Body: Chris's voice — first personal response, reference their message/topic from notes when helpful, 2-4 short paragraphs, one clear next step when appropriate.
- recipientConfidence: use "high" only if "to" is a single obvious RFC-style address with no ambiguity; "medium" if display names, multiple possibilities, or light cleanup was needed; "low" if "to" is a placeholder or uncertain.`
      : mode === 'reply' && replyToEmail
        ? `You are a triage assistant for Chris Lloyd's Hive OS task system.
The user is replying in an existing Gmail thread. Output strict JSON only — no prose outside the JSON — matching this schema:
{
  "to": "<email>",
  "subject": "<subject line>",
  "body": "<full plain-text body>",
  "reasoning": "<1-2 short sentences>",
  "recipientConfidence": "high" | "medium" | "low"
}

Rules:
- This is a REPLY. Set "to" EXACTLY to: ${JSON.stringify(replyToEmail)} (the latest non-self correspondent).
- Subject: use the thread topic "${escapedTopic}" — prefix with "Re: " if not already present (case-insensitive check for leading Re:).
- Body: reply in Chris's voice — concise, reference the thread, 2-4 short paragraphs, clear next step if appropriate.
- recipientConfidence: "high" if "to" is the mandated address above; otherwise explain via reasoning.`
        : mode === 'reply' && !replyToEmail
          ? `You are a triage assistant for Chris Lloyd's Hive OS task system.
The task links a Gmail thread but no clear non-self reply address was derived. Output strict JSON only — no prose outside the JSON — matching this schema:
{
  "to": "<email>",
  "subject": "<subject line>",
  "body": "<full plain-text body>",
  "reasoning": "<1-2 short sentences>",
  "recipientConfidence": "high" | "medium" | "low"
}

Rules:
- This is a REPLY. Infer "to" from the thread headers (From/To/Cc) — the person Chris should respond to, not Chris himself.
- Subject: use the thread topic "${escapedTopic}" — prefix with "Re: " if not already present.
- Body: reply in Chris's voice — concise, reference the thread, 2-4 short paragraphs.
- recipientConfidence reflects how sure you are about "to".`
          : `You are a triage assistant for Chris Lloyd's Hive OS task system.
There is NO active Gmail thread for this task — propose a brand-new email. Output strict JSON only — no prose outside the JSON — matching this schema:
{
  "to": "<email OR placeholder like \\"<adam>\\" if unknown>",
  "subject": "<short action-oriented subject, no boilerplate>",
  "body": "<full plain-text body>",
  "reasoning": "<1-2 short sentences>",
  "recipientConfidence": "high" | "medium" | "low"
}

Rules:
- Infer likely recipient from nextAction / project / from / notes (e.g. "Message Adam…" → try Adam@likely-domain). Use the recent Gmail header hints below to match first names or domains when helpful.
- If you cannot find a real address, use a placeholder like "<firstname>" and set recipientConfidence to "low".
- Subject: short, action-oriented (e.g. "Pioneer install — what did we learn?").
- Body: friendly, concise, 2-4 short paragraphs, reference project context, end with one clear ask when applicable.
- Keep reasoning under two sentences.`;

    const userContent = `Task JSON:\n${taskJsonForPrompt(task)}\n\n---\n\nContext:\n${threadBlock}\n\nSigned-in Gmail address (do not use as "to"): ${myEmail || '(unknown)'}`;

    const anthropic = new Anthropic({
      apiKey,
      timeout: 28_000,
    });

    const ai = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const block = ai.content[0];
    if (!block || block.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected Claude response shape (no text block)' }, { status: 502 });
    }

    const rawText = block.text.trim();
    let jsonStr: string;
    try {
      jsonStr = extractJsonObject(rawText);
    } catch {
      return NextResponse.json({ error: rawText }, { status: 502 });
    }

    let proposal: z.infer<typeof proposalSchema>;
    try {
      proposal = proposalSchema.parse(JSON.parse(jsonStr) as unknown);
    } catch {
      return NextResponse.json({ error: rawText }, { status: 502 });
    }

    if (!isWebsiteSubmission && mode === 'reply' && replyToEmail && proposal.to.trim().toLowerCase() !== replyToEmail.toLowerCase()) {
      proposal = { ...proposal, to: replyToEmail, recipientConfidence: 'high' };
    }

    if (isWebsiteSubmission && websiteParse) {
      const strippedSubject = proposal.subject.replace(/^(Re|RE|Fwd|FWD):\s*/i, '').trim();
      proposal = {
        ...proposal,
        ...(websiteParse.email ? { to: websiteParse.email } : {}),
        recipientConfidence: websiteParse.recipientConfidence,
        subject: strippedSubject.length > 0 ? strippedSubject : proposal.subject.trim(),
      };
    }

    return NextResponse.json({ proposal });
  } catch (err) {
    console.error('[tasks/:id/prepare] error:', err);
    const msg = err instanceof Error ? err.message : 'Prepare failed';
    if (msg.toLowerCase().includes('timeout') || msg.includes('ETIMEDOUT')) {
      return NextResponse.json({ error: msg }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
