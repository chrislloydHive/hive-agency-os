// POST /api/os/tasks/:id/next-step
// Claude proposes 2–3 typed "next step" options grounded in live Gmail/Drive/meeting state.

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
import {
  fetchLiveState,
  formatLiveThreadForPrompt,
  formatLinkedDocsForPrompt,
  formatCrossThreadsForPrompt,
  formatMeetingNotesForPrompt,
} from '@/lib/os/nextStepLiveState';
import type { SuggestedThreadRelink } from '@/lib/os/nextStepLiveState';
import { callAnthropicWithRetry, httpStatusForAnthropicError } from '@/lib/ai/anthropicRetry';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

// ── Zod schemas ─────────────────────────────────────────────────────────────

const meetingSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().min(1),
    date: z.string().min(1),
  })
  .strict();

const emailOptionSchema = z
  .object({
    type: z.literal('email'),
    label: z.string().min(1),
    summary: z.string().min(1),
    to: z.string(),
    subject: z.string().min(1),
    body: z.string().min(1),
    recipientConfidence: z.enum(['high', 'low']),
    meetingSource: meetingSourceSchema.optional(),
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
    meetingSource: meetingSourceSchema.optional(),
  })
  .strict();

const scheduleOptionSchema = z
  .object({
    type: z.literal('schedule'),
    label: z.string().min(1),
    summary: z.string().min(1),
    eventTitle: z.string().min(1),
    startISO: z.string().min(1),
    endISO: z.string().min(1),
    attendees: z.array(z.string().min(1)).optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    meetingSource: meetingSourceSchema.optional(),
  })
  .strict();

const subtasksOptionSchema = z
  .object({
    type: z.literal('subtasks'),
    label: z.string().min(1),
    summary: z.string().min(1),
    subtasks: z.array(z.string().min(1)).min(3).max(7),
    meetingSource: meetingSourceSchema.optional(),
  })
  .strict();

const noActionOptionSchema = z
  .object({
    type: z.literal('no-action'),
    label: z.string().min(1),
    summary: z.string().min(1),
    waitingOn: z.string().min(1),
    suggestedFollowupISO: z.string().optional(),
    meetingSource: meetingSourceSchema.optional(),
  })
  .strict();

const suggestedThreadRelinkLlmSchema = z
  .object({
    fromThreadId: z.string().min(1),
    toThreadId: z.string().min(1),
    toSubject: z.string().min(1),
    reasoning: z.string().min(1),
  })
  .strict();

const nextStepResponseSchema = z
  .object({
    options: z
      .array(
        z.union([
          emailOptionSchema,
          docOptionSchema,
          scheduleOptionSchema,
          subtasksOptionSchema,
          noActionOptionSchema,
        ]),
      )
      .min(1)
      .max(3),
    reasoning: z.string().min(1),
    suggestedThreadRelink: suggestedThreadRelinkLlmSchema.optional(),
  });

// ── Helpers ─────────────────────────────────────────────────────────────────

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
      notes: t.notes ? t.notes.slice(0, 4000) : '',
      threadUrl: t.threadUrl,
      draftUrl: t.draftUrl,
      attachUrl: t.attachUrl,
      calendarEventUrl: t.calendarEventUrl,
      createdAt: t.createdAt,
      lastSyncedAt: t.lastSyncedAt,
    },
    null,
    2,
  );
}

type ParsedOption = z.infer<typeof nextStepResponseSchema>['options'][number];

function dedupeOptionsByType(options: ParsedOption[]): ParsedOption[] {
  const seen = new Set<string>();
  const out: ParsedOption[] = [];
  for (const o of options) {
    if (seen.has(o.type)) continue;
    seen.add(o.type);
    out.push(o);
    if (out.length >= 3) break;
  }
  return out;
}

// ── Route handler ───────────────────────────────────────────────────────────

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

    const threadId = extractGmailThreadIdFromUrl(task.threadUrl);

    // Fetch identity first (need email for live-state), then live-state + voice + folder in parallel
    const identity = await getIdentity();
    const myEmail = identity.email || '';

    const [voice, projectFolderUrl, live, allTasks] = await Promise.all([
      getVoice(),
      getPmosDriveProjectFolderUrlForProjectName(task.project),
      fetchLiveState({ gmail, drive, task, threadId, myEmail }),
      getTasks({}),
    ]);

    const blockerTasks: TaskRecord[] = [];
    if (task.blockedBy.length > 0) {
      for (const bid of task.blockedBy) {
        const bt = allTasks.find((t) => t.id === bid);
        if (bt) blockerTasks.push(bt);
      }
    }

    const signatureBlock = [
      '',
      '--',
      identity.name,
      `${identity.role}, ${identity.company}`,
      identity.email,
    ].join('\n');

    const signatureRule = `For every "email" option, the "body" MUST end with this exact signature block (copy these lines verbatim, including the leading blank line):\n${signatureBlock}`;

    // Available meeting notes for meetingSource references
    const meetingSourceRefs = live.meetingNotes.map((n) => ({
      title: n.title,
      url: n.url,
      date: n.date,
    }));
    const meetingSourceInstruction =
      meetingSourceRefs.length > 0
        ? `\nWhen an option's proposal is materially shaped by a meeting note, include a "meetingSource" field: ${JSON.stringify(meetingSourceRefs[0])} (use the actual note that influenced the option). Only on influenced options; omit if not influenced.`
        : '';

    const systemPrompt = `You are a triage assistant for ${identity.name}'s Hive OS task system.
Propose 2 or 3 distinct "next step" options. Output strict JSON only — no prose outside the JSON.

Schema:
{
  "options": [ /* 2 or 3 objects, each exactly one of the shapes below */ ],
  "reasoning": "<paragraph grounded in LIVE state — cite specific messages by date/sender>",
  "suggestedThreadRelink": { /* optional — include only when you conclude an other-thread is the true current state */
    "fromThreadId": "<the currently linked thread id>",
    "toThreadId": "<MUST be the exact threadId from the [threadId=...] tag in OTHER RECENT THREADS — a hex string, NOT the subject>",
    "toSubject": "<the other thread's subject>",
    "reasoning": "<one sentence explaining why>"
  }
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
  "startISO": "<RFC3339 start, e.g. '2026-05-06T09:00:00-07:00'>",
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

5) No action needed right now:
{
  "type": "no-action",
  "label": "Nothing to do right now — waiting on <person>",
  "summary": "<one-sentence reason citing live state>",
  "waitingOn": "<person name or email>",
  "suggestedFollowupISO": "<ISO date for a check-back reminder, optional>"
}

ANALYSIS INSTRUCTIONS (CRITICAL — follow these exactly):
- First, reconcile the TASK SNAPSHOT against the LIVE THREAD STATE. If the nextAction is contradicted by what's in the thread now (e.g., the task says "follow up" but the user's latest message IS the follow-up), state that explicitly in the reasoning.
- NEVER claim "no follow-up has happened" or "the thread has gone quiet" unless the LIVE THREAD MESSAGES show that. Count from live state, not from the task snapshot.
- If ballInCourt is "user", an email proposal can include a substantive follow-up. If ballInCourt is the other party AND the user's last message is recent (≤ 5 business days), the strongest proposal is usually a SCHEDULE option (follow-up reminder) rather than another email nudge.
- If the live state genuinely shows there's nothing to do, return a "no-action" proposal instead of inventing work.
- The "reasoning" string MUST cite live-state facts ("user sent prep materials on May 9 at 2:43pm; ball is with Tom"), NOT snapshot facts ("the task says ..."). If a reader can't tell from the reasoning that you saw the latest messages, the prompt is failing.
- CROSS-THREAD DISCOVERY: If the linked thread shows the work has gone quiet but one of the OTHER RECENT THREADS is plainly the continuation of this work (same contact, topically aligned, more recent), reason from THAT thread's state as the ground truth. Cite the specific other-thread subject and date in your reasoning so the user can verify. You may include a 'doc' or 'email' proposal that references the correct other thread. You may also include a 'subtasks' proposal whose first item is 'Link this task to the actual thread <subject>' so the user can re-anchor. When you conclude an other-thread is the true current state, include a "suggestedThreadRelink" object in your response (see schema above). CRITICAL: the toThreadId MUST be the exact hex threadId shown in the [threadId=...] tag of OTHER RECENT THREADS. Do NOT use the subject line, a URL, or any synthesized value. Do NOT construct a toThreadUrl — the server builds it.
- BLOCKERS: If any blocker listed in BLOCKERS has status != Done, the strongest proposal is usually to advance the blocker, not this task. Propose a "no-action" chip whose label references the blocker by title, OR a "subtasks" chip whose first item is to act on the blocker. Only propose work on the current task if all blockers are Done or there's a parallelizable step that doesn't actually depend on the blocker.
- EXTERNAL WAIT: If waitingOnType is set and the wait is still active (date hasn't passed, decision hasn't been recorded, etc.), default to "no-action" with waitingOn populated from the existing fields.

Selection guidance:
- If the task has a Gmail thread → include exactly one "email" option when a real reply or outreach makes sense GIVEN the current live thread state. The body must reflect what's actually been said.
- If the task is planning / strategy → include one "doc" option with a substantive outline.
- If the task involves scheduling → include one "schedule" option. Default to a sensible block (next business day morning if no signal; 30 min duration).
- If the task is broad or ambiguous → include one "subtasks" option.
- If the user is waiting on someone with no overdue signal → include one "no-action" option.
- Never more than one option per type. Never invent types not listed above.
- ${signatureRule}${meetingSourceInstruction}

MEETING NOTES: Use these to inform proposals when they meaningfully change what's outstanding. If a note moves a deadline, changes scope, names a new decision-maker, or supersedes the task's current nextAction, reflect that in your proposals.

Voice for email bodies: ${voice.tone}. Plain text only in email body.

Subtasks: 3–7 items, each starts with a strong verb, specific to this task.

Project folder hint for doc options: ${
      projectFolderUrl
        ? `If you return a "doc" option, set projectFolderUrl to: ${JSON.stringify(projectFolderUrl)}`
        : 'Omit projectFolderUrl on doc options unless you have a real Drive folder URL from context.'
    }

recipientConfidence for email: "high" only when "to" is a single clear email; otherwise "low".`;

    // ── Build user content with live-state blocks ──────────────────────────

    const liveThreadBlock = live.thread
      ? `LIVE THREAD STATE (fetched now from Gmail — this is ground truth):\n${formatLiveThreadForPrompt(live.thread)}`
      : threadId
        ? 'LIVE THREAD STATE: (a thread is linked but contents could not be fetched — proceed cautiously and prefer asking the user for status over re-introducing.)'
        : 'LIVE THREAD STATE: (no linked thread)';

    const crossThreadBlock =
      live.crossThreadCandidates.length > 0 && live.primaryOutboundContact
        ? `OTHER RECENT THREADS WITH ${live.primaryOutboundContact} (last 30 days, contact-based match — may include the true current state of this work):\n${formatCrossThreadsForPrompt(live.crossThreadCandidates, live.primaryOutboundContact)}`
        : threadId
          ? 'OTHER RECENT THREADS: (no other recent threads found with the primary contact)'
          : 'OTHER RECENT THREADS: (no linked thread, so no contact-based search performed)';

    const linkedDocsBlock = `LINKED DOCS (live):\n${formatLinkedDocsForPrompt(live.linkedDocs)}`;

    const blockersBlock =
      blockerTasks.length > 0
        ? `BLOCKERS (this task is gated on these — proposals should account for them):\n${blockerTasks.map((bt) => `— [${bt.status}] ${bt.task} — ${bt.nextAction || '(no next action)'}`).join('\n')}`
        : 'BLOCKERS: (none)';

    const externalWaitBlock =
      task.waitingOnType
        ? `EXTERNAL WAIT:\n  type: ${task.waitingOnType}, description: ${task.waitingOnDescription || '(none)'}, until: ${task.waitingUntil || 'open-ended'}`
        : 'EXTERNAL WAIT: (none)';

    const meetingNotesBlock = `RECENT MEETING NOTES (live, filtered to this task — last 7 days):\n${formatMeetingNotesForPrompt(live.meetingNotes)}`;

    const userContent = [
      `TASK SNAPSHOT (what the task record says — may be stale):`,
      taskJsonForPrompt(task),
      '',
      '---',
      '',
      liveThreadBlock,
      '',
      '---',
      '',
      crossThreadBlock,
      '',
      '---',
      '',
      linkedDocsBlock,
      '',
      '---',
      '',
      blockersBlock,
      '',
      '---',
      '',
      externalWaitBlock,
      '',
      '---',
      '',
      meetingNotesBlock,
    ].join('\n');

    const anthropic = new Anthropic({
      apiKey,
      timeout: 55_000,
    });

    const aiResult = await callAnthropicWithRetry(
      () =>
        anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      `next-step/${task.id}`,
    );

    if (!aiResult.ok) {
      const status = httpStatusForAnthropicError(aiResult);
      return NextResponse.json(
        { error: aiResult.error, upstreamStatus: aiResult.upstreamStatus, retryable: aiResult.retryable },
        { status },
      );
    }

    const ai = aiResult.value;
    const block = ai.content[0];
    if (!block || block.type !== 'text') {
      return NextResponse.json(
        { error: 'Unexpected Claude response shape (no text block)' },
        { status: 502 },
      );
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
    if (options.length < 1) {
      return NextResponse.json(
        { error: 'Model returned no valid options after validation', detail: rawText },
        { status: 502 },
      );
    }

    options = options.map((o) => {
      if (o.type !== 'doc') return o;
      if (projectFolderUrl) {
        return { ...o, projectFolderUrl } as typeof o;
      }
      const { projectFolderUrl: _p, ...rest } = o;
      return rest as typeof o;
    });

    // Validate and build suggestedThreadRelink server-side
    const validCandidateIds = new Set(live.crossThreadCandidates.map((c) => c.threadId));
    let suggestedThreadRelink: SuggestedThreadRelink | undefined;

    if (parsed.suggestedThreadRelink) {
      const llmRelink = parsed.suggestedThreadRelink;
      const isValidHex = /^[0-9a-fA-F]{10,}$/.test(llmRelink.toThreadId);
      const isKnownCandidate = validCandidateIds.has(llmRelink.toThreadId);

      if (isValidHex && isKnownCandidate) {
        suggestedThreadRelink = {
          fromThreadId: llmRelink.fromThreadId,
          toThreadId: llmRelink.toThreadId,
          toThreadUrl: `https://mail.google.com/mail/u/0/#inbox/${llmRelink.toThreadId}`,
          toSubject: llmRelink.toSubject,
          reasoning: llmRelink.reasoning,
        };
      } else {
        console.warn(
          `[next-step] relink-invalid: llmReturned=${llmRelink.toThreadId} isHex=${isValidHex} isCandidate=${isKnownCandidate}`,
        );
      }
    }

    const chosenTypes = options.map((o) => o.type);
    console.log(
      `[next-step] live-state: ${task.id} threadMsgs=${live.stats.threadMsgs} newSinceTask=${live.stats.newSinceTask} linkedDocs=${live.stats.linkedDocs} meetingCandidates=${live.stats.meetingCandidates} meetingMatched=${live.stats.meetingMatched} ballInCourt=${live.stats.ballInCourt} primaryContact=${live.primaryOutboundContact || 'none'} contactSource=${live.contactSource || 'none'} contactCandidates=${live.stats.contactCandidates} suggestedRelink=${!!suggestedThreadRelink} chosenTypes=[${chosenTypes.join(',')}]`,
    );

    const response: Record<string, unknown> = {
      options,
      reasoning: parsed.reasoning,
    };
    if (suggestedThreadRelink) {
      response.suggestedThreadRelink = suggestedThreadRelink;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('[tasks/:id/next-step] error:', err);
    const msg = err instanceof Error ? err.message : 'Next step failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
