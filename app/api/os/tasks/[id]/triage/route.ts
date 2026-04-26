// app/api/os/tasks/[id]/triage
// POST — Claude-generated triage (priority, due, next action, optional draft reply).

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getTasks } from '@/lib/airtable/tasks';
import type { TaskRecord } from '@/lib/airtable/tasks';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';
import { extractGmailThreadIdFromUrl } from '@/lib/gmail/extractThreadIdFromUrl';
import {
  extractBody,
  type GmailMessageLike,
  type MsgPart,
} from '@/lib/gmail/threadContext';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a triage assistant for Chris Lloyd's Hive OS task system.
Given a task and the related Gmail thread (if any), suggest priority, due date, next action, and optionally a draft reply.
Output strict JSON matching the schema below — no prose outside the JSON.

Schema (types are exact; use null where allowed):
{
  "priority": "P0" | "P1" | "P2" | "P3" | null,
  "due": "YYYY-MM-DD" | null,
  "nextAction": "<short concrete action string>",
  "reasoning": "<2-3 sentence explanation of WHY>",
  "draftReply": "<full reply body as plain text>" | null
}

Rules:
- priority: P0 = drop-everything; P3 = backlog unless context says otherwise.
- due: only a real calendar date as YYYY-MM-DD, or null if not appropriate to set.
- nextAction: one short sentence, specific and actionable.
- reasoning: 2-3 sentences, plain text inside the JSON string.
- draftReply: when a Gmail thread is provided, you may suggest a full reply body Chris could send; use null if no reply is appropriate. When NO thread context is provided, draftReply must be null.`;

const suggestionSchema = z
  .object({
    priority: z.enum(['P0', 'P1', 'P2', 'P3']).nullable(),
    due: z.union([z.string(), z.null()]),
    nextAction: z.string().min(1),
    reasoning: z.string().min(1),
    draftReply: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

function isValidYmd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

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

function formatTaskForPrompt(t: TaskRecord): string {
  return JSON.stringify(
    {
      id: t.id,
      title: t.task,
      priority: t.priority,
      due: t.due,
      status: t.status,
      nextAction: t.nextAction,
      from: t.from,
      project: t.project,
      notes: t.notes ? t.notes.slice(0, 4000) : '',
      threadUrl: t.threadUrl,
    },
    null,
    2,
  );
}

function formatLatestMessagesForPrompt(
  messages: GmailMessageLike[],
  maxMessages: number,
): string {
  const slice = messages.length <= maxMessages ? messages : messages.slice(-maxMessages);
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
      `--- Message ${i} (of ${slice.length} in window) ---\nSubject: ${subj}\nFrom: ${from}\nDate: ${date}\n\n${clipped}`,
    );
  }
  return blocks.join('\n\n');
}

async function resolveGoogleAccess(): Promise<{ accessToken: string } | { error: string; status: number }> {
  let refreshToken: string | undefined;
  const defaultCompanyId = process.env.DMA_DEFAULT_COMPANY_ID;
  if (defaultCompanyId) {
    const integrations = await getCompanyIntegrations(defaultCompanyId);
    refreshToken = integrations?.google?.refreshToken;
  }
  if (!refreshToken) refreshToken = (await getAnyGoogleRefreshToken()) || undefined;
  if (!refreshToken) {
    return { error: 'No Google refresh token available', status: 500 };
  }
  try {
    const accessToken = await refreshAccessToken(refreshToken);
    return { accessToken };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token refresh failed';
    return { error: msg, status: 401 };
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 },
      );
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

    const googleAccess = await resolveGoogleAccess();
    if ('error' in googleAccess) {
      return NextResponse.json({ error: googleAccess.error }, { status: googleAccess.status });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: googleAccess.accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const threadId = extractGmailThreadIdFromUrl(task.threadUrl);
    let hasUsableThread = false;

    let threadBlock = 'No Gmail thread is linked to this task (no usable thread id in threadUrl).';
    if (threadId) {
      try {
        const thread = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'full',
        });
        const messages = (thread.data.messages || []) as GmailMessageLike[];
        if (messages.length === 0) {
          threadBlock = 'Thread was fetched but contains no messages.';
        } else {
          hasUsableThread = true;
          threadBlock = `Gmail thread id: ${threadId}\nIncluding the latest ${Math.min(5, messages.length)} message(s) (oldest of this window first):\n\n${formatLatestMessagesForPrompt(messages, 5)}`;
        }
      } catch (err) {
        console.warn('[tasks/:id/triage] Gmail thread fetch failed:', err);
        threadBlock = `Could not fetch Gmail thread ${threadId}: ${err instanceof Error ? err.message : 'unknown error'}`;
      }
    }

    const userContent = `Task (JSON):\n${formatTaskForPrompt(task)}\n\n---\n\n${threadBlock}`;

    const anthropic = new Anthropic({
      apiKey,
      timeout: 28_000,
    });

    const ai = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

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

    let parsed: z.infer<typeof suggestionSchema>;
    try {
      const obj = JSON.parse(jsonStr) as unknown;
      parsed = suggestionSchema.parse(obj);
    } catch {
      return NextResponse.json({ error: rawText }, { status: 502 });
    }

    let due: string | null = parsed.due;
    if (due !== null) {
      if (!isValidYmd(due)) {
        return NextResponse.json({ error: rawText }, { status: 502 });
      }
    }

    let draftReply: string | null;
    if (!hasUsableThread) {
      draftReply = null;
    } else {
      draftReply = parsed.draftReply === undefined ? null : parsed.draftReply;
    }

    return NextResponse.json({
      suggestion: {
        priority: parsed.priority,
        due,
        nextAction: parsed.nextAction,
        reasoning: parsed.reasoning,
        draftReply,
      },
    });
  } catch (err) {
    console.error('[tasks/:id/triage] error:', err);
    const msg = err instanceof Error ? err.message : 'Triage failed';
    if (msg.toLowerCase().includes('timeout') || msg.includes('ETIMEDOUT')) {
      return NextResponse.json({ error: msg }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
