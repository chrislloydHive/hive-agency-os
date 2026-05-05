// Shared Gmail + Claude logic for POST /api/os/tasks/:id/refresh-from-thread and auto-resolve sync.

import Anthropic from '@anthropic-ai/sdk';
import type { gmail_v1 } from 'googleapis';
import { z } from 'zod';
import type { TaskRecord } from '@/lib/airtable/tasks';
import { extractGmailThreadIdFromUrl } from '@/lib/gmail/extractThreadIdFromUrl';
import {
  buildConversationTranscript,
  extractBody,
  type GmailMessageLike,
  type MsgPart,
} from '@/lib/gmail/threadContext';

export const REFRESH_FROM_THREAD_MODEL = 'claude-sonnet-4-6';

/** Strip common email signatures after `--` on its own line (best-effort). */
export function stripEmailSignatureBlock(text: string): string {
  const idx = text.search(/\n--\s*\r?\n/);
  if (idx === -1) return text.trim();
  return text.slice(0, idx).trim();
}

export function threadUrlFromGmailThreadId(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

export function latestMessageId(messages: GmailMessageLike[]): string | null {
  if (!messages.length) return null;
  const last = messages[messages.length - 1];
  return last?.id || null;
}

export function latestInternalDateMs(messages: GmailMessageLike[]): number {
  let max = 0;
  for (const m of messages) {
    const n = Number(m.internalDate || 0);
    if (n > max) max = n;
  }
  return max;
}

export function watermarkMsForRefresh(task: TaskRecord): number {
  const last = task.lastSyncedAt ? Date.parse(task.lastSyncedAt) : NaN;
  const created = task.createdAt ? Date.parse(task.createdAt) : NaN;
  const w = Number.isFinite(last) ? last : Number.isFinite(created) ? created : 0;
  return w - 120_000; // 2m slack for clock skew vs Gmail internalDate
}

export function threadHasInboundAfterWatermark(messages: GmailMessageLike[], watermarkMs: number): boolean {
  for (const m of messages) {
    const ms = Number(m.internalDate || 0);
    if (ms >= watermarkMs) return true;
  }
  return false;
}

/** Extract quoted subject phrases that may refer to another Gmail thread. */
export function extractCrossThreadSubjectHints(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim();
    if (t.length < 5 || t.length > 180) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  const combined = text;
  const reQuotedThread =
    /\b(?:in|from)\s+the\s+['"]([^'"]{5,200})['"]\s+thread\b/gi;
  for (const m of combined.matchAll(reQuotedThread)) {
    if (m[1]) push(m[1]);
  }
  const reThreadAbout = /\bthread\s+(?:titled|called|named|about)\s+['"]([^'"]{5,200})['"]/gi;
  for (const m of combined.matchAll(reThreadAbout)) {
    if (m[1]) push(m[1]);
  }
  const reSentIn = /\bsent\s+(?:it|that|the docs?|this)\s+in\s+(?:the\s+)?['"]([^'"]{5,200})['"]/gi;
  for (const m of combined.matchAll(reSentIn)) {
    if (m[1]) push(m[1]);
  }
  return out.slice(0, 6);
}

function normalizeSubject(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .trim()
    .toLowerCase();
}

function subjectFromThread(messages: GmailMessageLike[]): string {
  const first = messages[0];
  const headers = first?.payload?.headers || [];
  const subj = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';
  return subj.trim();
}

function escapeGmailQueryTerm(s: string): string {
  return s.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/**
 * Search inbox for a thread whose subject best matches `hint`, excluding `excludeThreadId`.
 * Returns the best thread id or null.
 */
export async function findAlternateThreadIdBySubjectHint(
  gmail: gmail_v1.Gmail,
  hint: string,
  excludeThreadId: string,
): Promise<string | null> {
  const term = escapeGmailQueryTerm(hint);
  if (term.length < 4) return null;
  const q = `subject:${term}`;
  let list: gmail_v1.Schema$Thread[];
  try {
    const res = await gmail.users.threads.list({
      userId: 'me',
      maxResults: 15,
      q,
    });
    list = res.data.threads || [];
  } catch {
    return null;
  }

  let bestId: string | null = null;
  let bestScore = -1;
  let bestMs = 0;

  for (const th of list) {
    const id = th.id;
    if (!id || id === excludeThreadId) continue;
    try {
      const full = await gmail.users.threads.get({
        userId: 'me',
        id,
        format: 'full',
      });
      const msgs = (full.data.messages || []) as GmailMessageLike[];
      if (!msgs.length) continue;
      const subj = subjectFromThread(msgs);
      const ns = normalizeSubject(subj);
      const nh = normalizeSubject(hint);
      let score = 0;
      if (ns.includes(nh) || nh.includes(ns)) score += 50;
      if (ns === nh) score += 80;
      const ms = latestInternalDateMs(msgs);
      if (score > bestScore || (score === bestScore && ms > bestMs)) {
        bestScore = score;
        bestMs = ms;
        bestId = id;
      }
    } catch {
      // skip
    }
  }

  return bestScore >= 50 ? bestId : null;
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

const proposalPatchSchema = z
  .object({
    task: z.string().min(1).optional(),
    nextAction: z.string().min(1).optional(),
    notes: z.string().optional(),
    priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
    due: z.union([z.string(), z.null()]).optional(),
    status: z.enum(['Inbox', 'Next', 'Waiting', 'Done', 'Archive']).optional(),
    threadId: z.string().min(8).optional(),
    threadUrl: z.string().min(24).optional(),
  })
  .strip();

const refreshOkSchema = z
  .object({
    proposal: proposalPatchSchema,
    fields: z.array(z.string().min(1)).min(1),
    changeSummary: z.string().min(1),
    reasoning: z.string().min(1),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
  })
  .strict();

const refreshNoChangeSchema = z
  .object({
    noChange: z.literal(true),
    reasoning: z.string().min(1),
  })
  .strict();

export type RefreshFromThreadOk =
  | { noChange: true; reasoning: string; evaluatedThreadId: string; latestMessageId: string }
  | {
      noChange: false;
      proposal: Record<string, unknown>;
      fields: string[];
      changeSummary: string;
      reasoning: string;
      confidence: 'high' | 'medium' | 'low';
      evaluatedThreadId: string;
      latestMessageId: string;
    };

export type RefreshFromThreadResult =
  | { ok: true; data: RefreshFromThreadOk }
  | { ok: false; error: string; status?: number };

type PartWithFilename = MsgPart & { filename?: string | null };

function listAttachmentHints(messages: GmailMessageLike[]): string {
  const names: string[] = [];
  const walk = (part: MsgPart | null | undefined) => {
    if (!part) return;
    const fn = (part as PartWithFilename).filename;
    if (fn && String(fn).trim()) names.push(String(fn).trim());
    (part.parts || []).forEach(walk);
  };
  for (const m of messages) {
    walk(m.payload as MsgPart);
  }
  const uniq = [...new Set(names)];
  return uniq.length ? uniq.slice(0, 40).join(', ') : '(none named in MIME parts)';
}

const SYSTEM_PROMPT = `You are assisting with Hive OS personal tasks tied to Gmail threads.

You receive the full task record (JSON) and a chronological email thread transcript (signatures and quoted reply history are already trimmed).

Your job:
1) Decide whether the task's current title, next action, notes, priority, due date, and status still accurately reflect what is OUTSTANDING given the latest thread state.
2) If the latest message(s) clearly resolve the work, you may propose status "Done".
3) If scope or asks changed, propose updated task title, nextAction, and/or notes that reflect the current reality.
4) Do NOT propose changes that only paraphrase existing fields — only when information has materially changed.
5) For notes: when adding context, prefer APPENDING a new dated bullet line at the top or end (e.g. "May 4: …") summarizing new activity, rather than rewriting all notes from scratch, when the existing notes are still useful.
6) If the real work moved to a different email thread and the task's threadUrl/threadId no longer match, you may include threadId and threadUrl in the proposal (use the evaluated thread).

Output strict JSON only — no markdown fences, no prose outside JSON.

Either:
{ "noChange": true, "reasoning": "<why nothing material changed>" }

Or:
{
  "proposal": { /* only keys that should change; allowed keys: task, nextAction, notes, priority, due, status, threadId, threadUrl */ },
  "fields": ["task", "nextAction"],
  "changeSummary": "<one sentence>",
  "reasoning": "<longer explanation citing specific new message(s)>",
  "confidence": "high" | "medium" | "low"
}

Rules for the object-with-changes shape:
- "fields" must list every key you include in "proposal" (same strings).
- "due" must be YYYY-MM-DD or null.
- "priority" only P0|P1|P2|P3.
- "status" only Inbox|Next|Waiting|Done|Archive.
- "threadUrl" should be a full https://mail.google.com/... inbox URL when you set threadId.
- If nothing material changed, you MUST return noChange: true.`;

export async function runTaskRefreshFromThread(params: {
  task: TaskRecord;
  gmail: gmail_v1.Gmail;
  anthropic: Anthropic;
  userName: string;
  userEmail: string;
  /** When set, skips re-fetching the primary thread (messages must be chronological). */
  primaryThreadMessages?: GmailMessageLike[];
}): Promise<RefreshFromThreadResult> {
  const { task, gmail, anthropic, userName, userEmail } = params;
  const primaryThreadId = extractGmailThreadIdFromUrl(task.threadUrl);
  if (!primaryThreadId) {
    return {
      ok: true,
      data: {
        noChange: true,
        reasoning: 'Task has no thread to evaluate against.',
        evaluatedThreadId: '',
        latestMessageId: '',
      },
    };
  }

  let primaryMessages: GmailMessageLike[];
  try {
    if (params.primaryThreadMessages?.length) {
      primaryMessages = params.primaryThreadMessages;
    } else {
      const primary = await gmail.users.threads.get({
        userId: 'me',
        id: primaryThreadId,
        format: 'full',
      });
      primaryMessages = (primary.data.messages || []) as GmailMessageLike[];
    }
  } catch (e) {
    return {
      ok: false,
      error: `Could not load primary Gmail thread: ${e instanceof Error ? e.message : 'unknown'}`,
      status: 502,
    };
  }

  const firstBodyRaw = primaryMessages.length
    ? extractBody(primaryMessages[0].payload as MsgPart)
    : '';
  const firstBody = stripEmailSignatureBlock(firstBodyRaw);
  const scanText = `${task.notes || ''}\n\n${firstBody}`;

  let targetThreadId = primaryThreadId;
  const hints = extractCrossThreadSubjectHints(scanText);
  for (const h of hints) {
    const alt = await findAlternateThreadIdBySubjectHint(gmail, h, primaryThreadId);
    if (alt) {
      targetThreadId = alt;
      break;
    }
  }

  let messages: GmailMessageLike[];
  if (targetThreadId === primaryThreadId && params.primaryThreadMessages?.length) {
    messages = primaryMessages;
  } else {
    try {
      const t = await gmail.users.threads.get({
        userId: 'me',
        id: targetThreadId,
        format: 'full',
      });
      messages = (t.data.messages || []) as GmailMessageLike[];
    } catch (e) {
      return {
        ok: false,
        error: `Could not load target Gmail thread ${targetThreadId}: ${e instanceof Error ? e.message : 'unknown'}`,
        status: 502,
      };
    }
  }

  const latestMessageIdVal = latestMessageId(messages) || '';
  if (!messages.length) {
    return {
      ok: true,
      data: {
        noChange: true,
        reasoning: 'Thread has no messages to evaluate.',
        evaluatedThreadId: targetThreadId,
        latestMessageId: latestMessageIdVal,
      },
    };
  }

  const myLower = userEmail.trim().toLowerCase();
  const transcript = buildConversationTranscript(messages, myLower, {
    maxCharsPerTurn: 12_000,
    maxTotalChars: 120_000,
  });

  const attachments = listAttachmentHints(messages);
  const taskPayload = {
    id: task.id,
    task: task.task,
    nextAction: task.nextAction,
    notes: task.notes,
    priority: task.priority,
    due: task.due,
    status: task.status,
    project: task.project,
    from: task.from,
    threadUrl: task.threadUrl,
    draftUrl: task.draftUrl,
    attachUrl: task.attachUrl,
    source: task.source,
    createdAt: task.createdAt,
    lastSyncedAt: task.lastSyncedAt,
    latestInboundAt: task.latestInboundAt,
  };

  const userContent = `User: ${userName} <${userEmail}>

Evaluated Gmail thread id: ${targetThreadId}
(Primary task thread id was: ${primaryThreadId}${targetThreadId !== primaryThreadId ? ' — switched after cross-thread hint match.' : ''})

Attachment filenames (from MIME parts): ${attachments}

--- Task (JSON) ---
${JSON.stringify(taskPayload, null, 2)}

--- Full thread transcript (oldest → newest) ---
${transcript || '(empty)'}`;

  try {
    const ai = await anthropic.messages.create({
      model: REFRESH_FROM_THREAD_MODEL,
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    const block = ai.content[0];
    if (!block || block.type !== 'text') {
      return { ok: false, error: 'Unexpected Claude response (no text block)', status: 502 };
    }
    let jsonStr: string;
    try {
      jsonStr = extractJsonObject(block.text);
    } catch {
      return { ok: false, error: block.text.slice(0, 2000), status: 502 };
    }
    let raw: unknown;
    try {
      raw = JSON.parse(jsonStr) as unknown;
    } catch {
      return { ok: false, error: 'Invalid JSON from model', status: 502 };
    }

    const noCh = refreshNoChangeSchema.safeParse(raw);
    if (noCh.success) {
      return {
        ok: true,
        data: {
          noChange: true,
          reasoning: noCh.data.reasoning,
          evaluatedThreadId: targetThreadId,
          latestMessageId: latestMessageIdVal,
        },
      };
    }

    const parsed = refreshOkSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: block.text.slice(0, 2000), status: 502 };
    }

    const proposalObj = parsed.data.proposal as Record<string, unknown>;
    const fields = [...parsed.data.fields];

    if (targetThreadId !== primaryThreadId) {
      if (!proposalObj.threadId) proposalObj.threadId = targetThreadId;
      if (!proposalObj.threadUrl) proposalObj.threadUrl = threadUrlFromGmailThreadId(targetThreadId);
      if (!fields.includes('threadId')) fields.push('threadId');
      if (!fields.includes('threadUrl')) fields.push('threadUrl');
    }

    const confidence = parsed.data.confidence ?? 'medium';

    return {
      ok: true,
      data: {
        noChange: false,
        proposal: proposalObj,
        fields,
        changeSummary: parsed.data.changeSummary,
        reasoning: parsed.data.reasoning,
        confidence,
        evaluatedThreadId: targetThreadId,
        latestMessageId: latestMessageIdVal,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Claude request failed';
    if (msg.toLowerCase().includes('timeout') || msg.includes('ETIMEDOUT')) {
      return { ok: false, error: msg, status: 504 };
    }
    return { ok: false, error: msg, status: 500 };
  }
}

export function shouldRunThreadRefreshForSync(task: TaskRecord, messages: GmailMessageLike[]): boolean {
  if (!task.threadUrl) return false;
  const latestId = latestMessageId(messages);
  if (!latestId) return false;
  if (task.threadRefreshMessageId && task.threadRefreshMessageId === latestId) {
    return false;
  }
  const wm = watermarkMsForRefresh(task);
  if (!threadHasInboundAfterWatermark(messages, wm)) {
    return false;
  }
  return true;
}
