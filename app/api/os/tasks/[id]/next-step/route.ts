// POST /api/os/tasks/:id/next-step
// Claude proposes 2–3 typed "next step" options (email | doc | schedule | subtasks) for My Day.

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getTasks } from '@/lib/airtable/tasks';
import type { TaskRecord } from '@/lib/airtable/tasks';
import { getPmosDriveProjectFolderUrlForProjectName } from '@/lib/airtable/pmosDriveProjectFolder';
import { getIdentity, getVoice } from '@/lib/personalContext';
import { getOsGoogleAccessToken } from '@/lib/gmail/osGoogleAccess';
import { extractGmailThreadIdFromUrl } from '@/lib/gmail/extractThreadIdFromUrl';
import { buildMeetingTranscriptContextBlock } from '@/lib/os/taskNotesTranscript';
import { buildConversationTranscript } from '@/lib/gmail/threadContext';
import type { GmailMessageLike } from '@/lib/gmail/threadContext';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

const emailOptionSchema = z
  .object({
    type: z.literal('email'),
    label: z.string().min(1),
    summary: z.string().min(1),
    to: z.string(),
    subject: z.string().min(1),
    body: z.string().min(1),
    recipientConfidence: z.enum(['high', 'low']),
  })
  .strict();

const docOptionSchema = z
  .object({
    type: z.literal('doc'),
    label: z.string().min(1),
    summary: z.string().min(1),
    docTitle: z.string().min(1),
    docBody: z.string().min(1),
    projectFolderUrl: z.string().min(1).optional(),
  })
  .strict();

const scheduleOptionSchema = z
  .object({
    type: z.literal('schedule'),
    label: z.string().min(1),
    summary: z.string().min(1),
    eventTitle: z.string().min(1),
    // RFC3339, e.g. "2026-05-06T09:00:00-04:00". Frontend re-parses to local
    // and re-emits with the user's offset, so we keep validation lenient.
    startISO: z.string().min(1),
    endISO: z.string().min(1),
    attendees: z.array(z.string().min(1)).optional(),
    description: z.string().optional(),
    location: z.string().optional(),
  })
  .strict();

const subtasksOptionSchema = z
  .object({
    type: z.literal('subtasks'),
    label: z.string().min(1),
    summary: z.string().min(1),
    subtasks: z.array(z.string().min(1)).min(3).max(7),
  })
  .strict();

const nextStepResponseSchema = z
  .object({
    options: z
      .array(z.union([emailOptionSchema, docOptionSchema, scheduleOptionSchema, subtasksOptionSchema]))
      .min(2)
      .max(3),
    reasoning: z.string().min(1),
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

function taskJsonForPrompt(t: TaskRecord): string {
  return JSON.stringify(
    {
      id: t.id,
      title: t.task,
      source: t.source,
      nextAction: t.nextAction,
      project: t.project,
      from: t.from,
      notes: t.notes ? t.notes.slice(0, 8000) : '',
      threadUrl: t.threadUrl,
      draftUrl: t.draftUrl,
      attachUrl: t.attachUrl,
      calendarEventUrl: t.calendarEventUrl,
    },
    null,
    2,
  );
}

function dedupeOptionsByType<T extends z.infer<typeof nextStepResponseSchema>['options'][number]>(
  options: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const o of options) {
    if (seen.has(o.type)) continue;
    seen.add(o.type);
    out.push(o);
    if (out.length >= 3) break;
  }
  return out;
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
    const drive = google.drive({ version: 'v3', auth });
    const gmail = google.gmail({ version: 'v1', auth });

    const [identity, voice, transcriptBlock, projectFolderUrl] = await Promise.all([
      getIdentity(),
      getVoice(),
      buildMeetingTranscriptContextBlock(drive, task.notes, { source: task.source }),
      getPmosDriveProjectFolderUrlForProjectName(task.project),
    ]);

    const threadId = extractGmailThreadIdFromUrl(task.threadUrl);
    const hasThread = !!threadId;
    const isWebsite = task.source === 'website-submission';

    // Build a comprehensive conversation pool for Claude to reason over.
    //
    // Two sources, merged and de-duped by message id, then sorted chronologically:
    //   1. The thread linked on the task (when present).
    //   2. Recent emails to/from the same participants across ALL threads
    //      (newer_than:30d), to catch post-meeting follow-ups, separate
    //      doc-share threads, etc. that don't share a Gmail threadId with the
    //      original task thread. This is the difference between Claude seeing
    //      the original outreach vs. seeing yesterday's confirmation reply.
    //
    // Both stages are best-effort and graceful-degrade — a missing thread or
    // failed search just means less context, never an error response.
    const myEmailLower = (identity.email || '').toLowerCase();
    const messagePool = new Map<string, GmailMessageLike>();
    const participantEmails = new Set<string>();

    /** Pull an email out of a `From:` (or similar) header. */
    const emailFromHeader = (h: string): string => {
      if (!h) return '';
      const bracket = h.match(/<([^>]+)>/);
      if (bracket) return bracket[1].trim();
      const bare = h.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      return bare ? bare[0] : '';
    };

    // Stage 1: linked thread.
    if (threadId) {
      try {
        const threadFull = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'full',
        });
        for (const m of threadFull.data.messages || []) {
          if (m.id) messagePool.set(m.id, m as GmailMessageLike);
          const fromVal = (m.payload?.headers || []).find(
            (h) => h.name?.toLowerCase() === 'from',
          )?.value || '';
          const email = emailFromHeader(fromVal).toLowerCase();
          if (email && email !== myEmailLower) participantEmails.add(email);
        }
      } catch (err) {
        console.warn(
          '[next-step] linked-thread fetch failed (non-fatal):',
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Also seed from task.from in case the thread has no usable From: or
    // there's no linked thread at all.
    {
      const taskFromEmail = emailFromHeader(task.from || '').toLowerCase();
      if (taskFromEmail && taskFromEmail !== myEmailLower) {
        participantEmails.add(taskFromEmail);
      }
    }

    // Stage 2: cross-thread recent emails with the participants.
    if (participantEmails.size > 0) {
      try {
        const participants = Array.from(participantEmails).slice(0, 3);
        const orClauses: string[] = [];
        for (const p of participants) {
          orClauses.push(`from:${p}`, `to:${p}`);
        }
        const q = `(${orClauses.join(' OR ')}) newer_than:30d`;
        const list = await gmail.users.messages.list({
          userId: 'me',
          q,
          maxResults: 10,
        });
        const ids = (list.data.messages || [])
          .map((m) => m.id)
          .filter((s): s is string => !!s)
          .filter((id) => !messagePool.has(id));
        // Fetch in parallel; null out failures so one bad message doesn't
        // poison the whole pool.
        const fetched = await Promise.all(
          ids.map((id) =>
            gmail.users.messages
              .get({ userId: 'me', id, format: 'full' })
              .then((r) => r.data)
              .catch(() => null),
          ),
        );
        for (const m of fetched) {
          if (m && m.id && !messagePool.has(m.id)) {
            messagePool.set(m.id, m as GmailMessageLike);
          }
        }
      } catch (err) {
        console.warn(
          '[next-step] cross-thread search failed (non-fatal):',
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Sort chronologically (oldest → newest) and build the transcript.
    const allMessages = Array.from(messagePool.values()).sort((a, b) => {
      const da = Number(a.internalDate || 0);
      const db = Number(b.internalDate || 0);
      return da - db;
    });
    const conversationTranscript =
      allMessages.length === 0
        ? ''
        : buildConversationTranscript(allMessages, myEmailLower, {
            maxCharsPerTurn: 800,
            maxTotalChars: 8000,
          });

    const signatureBlock = [
      '',
      '--',
      identity.name,
      `${identity.role}, ${identity.company}`,
      identity.email,
    ].join('\n');

    const signatureRule = `For every "email" option, the "body" MUST end with this exact signature block (copy these lines verbatim, including the leading blank line):\n${signatureBlock}`;

    const systemPrompt = `You are a triage assistant for Chris Lloyd's Hive OS task system.
Propose 2 or 3 distinct "next step" options Chris could take. Output strict JSON only — no prose outside the JSON.

Schema:
{
  "options": [ /* 2 or 3 objects, each exactly one of the shapes below */ ],
  "reasoning": "<short paragraph explaining why these options fit this task>"
}

Allowed option types (each object MUST include "type" exactly as shown). Never repeat the same type twice.

1) Email follow-up:
{
  "type": "email",
  "label": "<one-line user-facing description>",
  "summary": "<one sentence why this>",
  "to": "<best-guess recipient email or empty string>",
  "subject": "<draft subject>",
  "body": "<full plain-text draft including the signature block below>",
  "recipientConfidence": "high" | "low"
}

2) Google Doc planning / strategy:
{
  "type": "doc",
  "label": "<one-line user-facing description>",
  "summary": "<one sentence why this>",
  "docTitle": "<proposed Google Doc title>",
  "docBody": "<outline or skeleton; markdown OK — # headings, bullets, short paragraphs>",
  "projectFolderUrl": "<optional; leave empty string or omit — server may fill from project>"
}

3) Calendar / schedule:
{
  "type": "schedule",
  "label": "<one-line user-facing description>",
  "summary": "<one sentence why this>",
  "eventTitle": "<short, specific event title — not generic>",
  "startISO": "<RFC3339 start, e.g. '2026-05-06T09:00:00-04:00'>",
  "endISO":   "<RFC3339 end, same TZ as startISO>",
  "attendees": ["<email>", "..."],
  "description": "<optional agenda / context for the event body>",
  "location": "<optional Google Meet link, address, or 'TBD'>"
}

4) Break into subtasks:
{
  "type": "subtasks",
  "label": "<one-line user-facing description>",
  "summary": "<one sentence why this>",
  "subtasks": ["<3–7 short imperative items>"]
}

Reading the conversation state:
- If a "Recent Gmail with this contact" block is provided below, READ IT before deciding what's next. This may span MULTIPLE Gmail threads (e.g. an original outreach thread plus a fresh post-meeting follow-up thread with a different subject). The task title and notes were written when the task was first created — they may be days or weeks out of date. These messages are the source of truth for the *current* state of the relationship.
- Always anchor on the MOST RECENT messages first. If the latest message is from yesterday and confirms receipt, that's the state — even if older messages in the same context look like an unstarted intro.
- Specifically check: has Chris already pitched/presented/sent the thing? Did the other party acknowledge, ask for time, commit to a follow-up, or go silent? Who owes whom the next response? Are there commitments ("I'll get back to you Monday", "I'll loop in Mike") that change what should happen next?
- Pick options that move the *current* state forward, not the original task title. If Chris already presented and the other party said "I'll review and follow up", an "intro email" is wrong — a polite nudge / status check / scheduled follow-up call is right. If the other party already responded with what Chris asked for, the right move may be subtasks to act on it, or a doc to organize the response.

Selection guidance:
- If the task has a Gmail thread (threadUrl) or website-submission origin → include exactly one "email" option when a real reply or outreach makes sense GIVEN the current thread state. The body must reflect what's actually been said — never re-introduce yourself or re-pitch something already presented.
- If the task is planning / strategy (marketing plan, proposal, brief, roadmap, narrative, campaign plan) → include exactly one "doc" option with a substantive outline (not placeholder lorem).
- If the task involves putting time on the calendar — setting up a call/meeting, blocking focus time, prepping for a meeting that needs its own block, or "find time to do X" — include exactly one "schedule" option. Default to a sensible block (next business day morning if no signal; 30 min duration unless the task implies longer; 60 min for prep blocks; 25 min for "quick chat"). Use the user's local timezone offset. Pull attendee emails from the task's "from" or thread context only when high-confidence; otherwise leave attendees empty so the user fills it in. The user will adjust before saving — pick reasonable, not perfect.
- If the task is broad or ambiguous (vague nextAction, no thread, weak context) → include exactly one "subtasks" option with concrete verbs to un-stick the work.
- Never more than one option per type. Never invent other types.
- ${signatureRule}

Voice for email bodies: ${voice.tone}. Plain text only in email body. Signoff line inside the block above is enough — do not duplicate a separate "— Chris" before the signature block.

Subtasks: 3–7 items, each starts with a strong verb, specific to this task.

Project folder hint for doc options: ${
      projectFolderUrl
        ? `If you return a "doc" option, set projectFolderUrl to: ${JSON.stringify(projectFolderUrl)}`
        : 'Omit projectFolderUrl on doc options unless you have a real Drive folder URL from context.'
    }

recipientConfidence for email: "high" only when "to" is a single clear email; otherwise "low".`;

    const recentThreadBlock = conversationTranscript
      ? `Recent Gmail with this contact (oldest → newest, may span multiple threads; read this to determine the current state of the relationship — proposals already made, commitments already given, who owes the next response):\n${conversationTranscript}`
      : hasThread
        ? 'Recent Gmail with this contact: (a thread is linked but contents could not be fetched — proceed cautiously and prefer asking the user for status over re-introducing.)'
        : 'Recent Gmail with this contact: (none found — no linked thread and no recent emails with the participants)';

    const userContent = `Task JSON:\n${taskJsonForPrompt(task)}\n\n---\nHas Gmail thread id usable in client: ${hasThread}\nWebsite submission task: ${isWebsite}\n\n---\n${recentThreadBlock}\n\n---\nExtra transcript / doc text from linked Google Docs in notes (may be empty):\n${transcriptBlock || '(none)'}`;

    const anthropic = new Anthropic({
      apiKey,
      timeout: 55_000,
    });

    const ai = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
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

    let parsed: z.infer<typeof nextStepResponseSchema>;
    try {
      parsed = nextStepResponseSchema.parse(JSON.parse(jsonStr) as unknown);
    } catch {
      return NextResponse.json({ error: rawText }, { status: 502 });
    }

    let options = dedupeOptionsByType(parsed.options);
    if (options.length < 2) {
      return NextResponse.json(
        { error: 'Model returned fewer than 2 distinct option types after validation', detail: rawText },
        { status: 502 },
      );
    }

    options = options.map((o) => {
      if (o.type !== 'doc') return o;
      if (projectFolderUrl) {
        return { ...o, projectFolderUrl };
      }
      const { projectFolderUrl: _p, ...rest } = o;
      return rest;
    });

    return NextResponse.json({
      options,
      reasoning: parsed.reasoning,
    });
  } catch (err) {
    console.error('[tasks/:id/next-step] error:', err);
    const msg = err instanceof Error ? err.message : 'Next step failed';
    if (msg.toLowerCase().includes('timeout') || msg.includes('ETIMEDOUT')) {
      return NextResponse.json({ error: msg }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
