// POST /api/os/tasks/:id/next-step
// Claude proposes 2–3 typed "next step" options (email | doc | subtasks) for My Day.

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
    options: z.array(z.union([emailOptionSchema, docOptionSchema, subtasksOptionSchema])).min(2).max(3),
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

    const [identity, voice, transcriptBlock, projectFolderUrl] = await Promise.all([
      getIdentity(),
      getVoice(),
      buildMeetingTranscriptContextBlock(drive, task.notes, { source: task.source }),
      getPmosDriveProjectFolderUrlForProjectName(task.project),
    ]);

    const threadId = extractGmailThreadIdFromUrl(task.threadUrl);
    const hasThread = !!threadId;
    const isWebsite = task.source === 'website-submission';

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

3) Break into subtasks:
{
  "type": "subtasks",
  "label": "<one-line user-facing description>",
  "summary": "<one sentence why this>",
  "subtasks": ["<3–7 short imperative items>"]
}

Selection guidance:
- If the task has a Gmail thread (threadUrl) or website-submission origin → include exactly one "email" option when a real reply or outreach makes sense.
- If the task is planning / strategy (marketing plan, proposal, brief, roadmap, narrative, campaign plan) → include exactly one "doc" option with a substantive outline (not placeholder lorem).
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

    const userContent = `Task JSON:\n${taskJsonForPrompt(task)}\n\n---\nHas Gmail thread id usable in client: ${hasThread}\nWebsite submission task: ${isWebsite}\n\n---\nExtra transcript / doc text from linked Google Docs in notes (may be empty):\n${transcriptBlock || '(none)'}`;

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
