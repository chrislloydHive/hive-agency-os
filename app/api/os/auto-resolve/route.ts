// POST /api/os/auto-resolve
// Claude classifies threaded open tasks; writes only suggestedResolution (medium/high).

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  getTasks,
  updateTask,
  suggestedResolutionStoredSchema,
  type SuggestedResolution,
  type TaskRecord,
} from '@/lib/airtable/tasks';
import { getOsGoogleAccessToken } from '@/lib/gmail/osGoogleAccess';
import { extractGmailThreadIdFromUrl } from '@/lib/gmail/extractThreadIdFromUrl';
import { isLikelyMailGoogleThreadUrl } from '@/lib/gmail/isMailThreadUrl';
import {
  extractBody,
  type GmailMessageLike,
  type MsgPart,
} from '@/lib/gmail/threadContext';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MODEL = 'claude-sonnet-4-6';
const CLAUDE_TIMEOUT_MS = 30_000;
const BODY_CLIP = 2000;
const THREAD_MSG_WINDOW = 5;
const CONCURRENCY = 3;

const SYSTEM = `You are a triage assistant for a personal task system.
Given a task and the related Gmail thread, classify whether the task is still active.
Output ONLY strict JSON in this schema, no prose:
{
  "action": "close" | "update_nextAction" | "leave",
  "newNextAction": "<only if action=update_nextAction>",
  "reasoning": "<2-3 sentences explaining your read>",
  "confidence": "high" | "medium" | "low"
}

Decision rules:
- close: thread is clearly resolved (other party said they were done, OR Chris already replied delivering the asked-for thing, OR the deadline passed and is no longer relevant).
- update_nextAction: thread state changed but task is still active — e.g. "Waiting on X" but X already replied with a partial answer that needs follow-up.
- leave: still active and the existing nextAction is correct.

confidence:
- high: thread state is unambiguous.
- medium: likely but reasonable doubt.
- low: uncertain — pick "leave" with low if so.`;

const classifierSchema = z
  .object({
    action: z.enum(['close', 'update_nextAction', 'leave']),
    newNextAction: z.string().optional(),
    reasoning: z.string().min(1),
    confidence: z.enum(['high', 'medium', 'low']),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.action === 'update_nextAction') {
      if (!data.newNextAction?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['newNextAction'],
          message: 'newNextAction required when action is update_nextAction',
        });
      }
    } else if (data.newNextAction != null && String(data.newNextAction).trim() !== '') {
      ctx.addIssue({
        code: 'custom',
        path: ['newNextAction'],
        message: 'newNextAction only allowed when action is update_nextAction',
      });
    }
  });

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

function formatMessagesForClassifier(messages: GmailMessageLike[], max: number, bodyMax: number): string {
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
    const rawBody = extractBody(m.payload as MsgPart).trim() || (m.snippet || '').trim();
    const clipped = rawBody.length > bodyMax ? `${rawBody.slice(0, bodyMax)}…` : rawBody;
    blocks.push(
      `--- Message ${i} (of ${slice.length}, oldest first in window) ---\nSubject: ${subj}\nFrom: ${from}\nDate: ${date}\n\n${clipped}`,
    );
  }
  return blocks.join('\n\n');
}

function lastModifiedAtLeast30MinutesAgo(iso: string | null): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return Date.now() - t >= 30 * 60 * 1000;
}

function isOpenTask(t: TaskRecord): boolean {
  return !t.done && t.status !== 'Done';
}

function pickCandidates(tasks: TaskRecord[]): TaskRecord[] {
  return tasks.filter(
    (t) =>
      isOpenTask(t) &&
      !t.dismissedAt &&
      t.threadUrl &&
      isLikelyMailGoogleThreadUrl(t.threadUrl) &&
      !t.suggestedResolution &&
      lastModifiedAtLeast30MinutesAgo(t.lastModified),
  );
}

async function runPool<T, R>(items: T[], poolSize: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) break;
      results[i] = await worker(items[i]);
    }
  }

  const n = Math.min(poolSize, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => runWorker()));
  return results;
}

export async function POST() {
  const errors: { taskId: string; error: string }[] = [];
  let candidates = 0;
  let suggested = 0;
  let skipped = 0;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
    }

    const googleAccess = await getOsGoogleAccessToken();
    if (!googleAccess.ok) {
      return NextResponse.json({ error: googleAccess.error }, { status: googleAccess.status });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: googleAccess.accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const all = await getTasks({});
    const list = pickCandidates(all);
    candidates = list.length;

    const anthropic = new Anthropic({ apiKey, timeout: CLAUDE_TIMEOUT_MS });

    type Outcome =
      | { taskId: string; kind: 'suggested' }
      | { taskId: string; kind: 'skipped' }
      | { taskId: string; kind: 'error'; error: string };

    const outcomes = await runPool<TaskRecord, Outcome>(list, CONCURRENCY, async (task) => {
      const threadId = extractGmailThreadIdFromUrl(task.threadUrl);
      if (!threadId) {
        return { taskId: task.id, kind: 'skipped' };
      }

      try {
        const thread = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'full',
        });
        const messages = (thread.data.messages || []) as GmailMessageLike[];
        const recent = messages.slice(-THREAD_MSG_WINDOW);
        const threadBlock =
          recent.length === 0
            ? '(Thread has no messages.)'
            : formatMessagesForClassifier(recent, THREAD_MSG_WINDOW, BODY_CLIP);

        const taskPayload = {
          id: task.id,
          title: task.task,
          nextAction: task.nextAction,
          project: task.project,
          from: task.from,
          notes: task.notes ? task.notes.slice(0, 4000) : '',
          threadUrl: task.threadUrl,
        };

        const userContent = `Task (JSON):\n${JSON.stringify(taskPayload, null, 2)}\n\n---\n\nGmail thread (latest up to ${THREAD_MSG_WINDOW} messages):\n${threadBlock}`;

        const ai = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 600,
          system: SYSTEM,
          messages: [{ role: 'user', content: userContent }],
        });

        const block = ai.content[0];
        if (!block || block.type !== 'text') {
          return { taskId: task.id, kind: 'skipped' };
        }

        let jsonStr: string;
        try {
          jsonStr = extractJsonObject(block.text);
        } catch {
          return { taskId: task.id, kind: 'skipped' };
        }

        let parsed: z.infer<typeof classifierSchema>;
        try {
          parsed = classifierSchema.parse(JSON.parse(jsonStr) as unknown);
        } catch {
          return { taskId: task.id, kind: 'skipped' };
        }

        if (parsed.action === 'leave' || parsed.confidence === 'low') {
          return { taskId: task.id, kind: 'skipped' };
        }

        if (parsed.confidence !== 'high' && parsed.confidence !== 'medium') {
          return { taskId: task.id, kind: 'skipped' };
        }

        if (parsed.action !== 'close' && parsed.action !== 'update_nextAction') {
          return { taskId: task.id, kind: 'skipped' };
        }

        const suggestedAt = new Date().toISOString();
        const full: SuggestedResolution = {
          action: parsed.action,
          reasoning: parsed.reasoning,
          confidence: parsed.confidence,
          suggestedAt,
          ...(parsed.action === 'update_nextAction' && parsed.newNextAction
            ? { newNextAction: parsed.newNextAction.trim() }
            : {}),
        };

        const finalCheck = suggestedResolutionStoredSchema.safeParse(full);
        if (!finalCheck.success) {
          return { taskId: task.id, kind: 'skipped' };
        }

        await updateTask(task.id, { suggestedResolution: finalCheck.data });
        return { taskId: task.id, kind: 'suggested' };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { taskId: task.id, kind: 'error', error: msg };
      }
    });

    for (const o of outcomes) {
      if (o.kind === 'suggested') suggested += 1;
      else if (o.kind === 'skipped') skipped += 1;
      else errors.push({ taskId: o.taskId, error: o.error });
    }

    return NextResponse.json({
      summary: { candidates, suggested, skipped },
      errors,
    });
  } catch (err) {
    console.error('[auto-resolve] fatal:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'auto-resolve failed',
        summary: { candidates, suggested, skipped },
        errors,
      },
      { status: 500 },
    );
  }
}
