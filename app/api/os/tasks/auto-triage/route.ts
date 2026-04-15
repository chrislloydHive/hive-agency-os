// app/api/os/tasks/auto-triage/route.ts
// Auto-triage endpoint — scans Gmail, scores inbox items, and auto-creates
// Task rows in Airtable for anything at or above `threshold`.
//
// This is the "Tasks are the source of truth" bridge: every morning (or on
// demand) this sweep materializes high-signal email into Airtable so nothing
// actionable lives only in Gmail.
//
// POST /api/os/tasks/auto-triage
// Body:
//   { companyId?: string, threshold?: number, max?: number, dryRun?: boolean }
//
// Defaults:
//   threshold = 60  (roughly: key sender OR finance keyword, or reply+recency)
//   max       = 10  (cap on Tasks created per run)
//   dryRun    = false
//
// Returns: { created: [...], skipped: [...], ranSummary: string }

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { google } from 'googleapis';
import { fetchTriageInbox, TRIAGE_IMPORTANT_SENDER_DOMAINS, type TriageItem } from '@/app/api/os/command-center/route';
import { getTasks, createTask } from '@/lib/airtable/tasks';
import type { TaskPriority, TaskStatus, TaskRecord } from '@/lib/airtable/tasks';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = new Anthropic();

type MsgPart = { mimeType?: string | null; body?: { data?: string | null } | null; parts?: MsgPart[] | null };
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

/**
 * Priority → due date fallback. Used when the AI doesn't supply a valid YYYY-MM-DD.
 * Chris's rule: every task should land with a date; he'd rather adjust than have it blank.
 */
function defaultDueForPriority(priority: TaskPriority): string {
  const offsetDays = priority === 'P0' ? 0 : priority === 'P1' ? 3 : priority === 'P2' ? 7 : 14;
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

interface Prefill {
  task: string;
  from: string;
  project: string;
  nextAction: string;
  priority: TaskPriority;
  due: string;
  status: TaskStatus;
  notes: string;
  threadUrl: string;
}

/**
 * AI-parse a Gmail message into a task prefill. Mirrors /api/os/tasks/from-email
 * but inlined here so we can batch without HTTP roundtrips.
 */
async function parseEmailToTask(params: {
  gmail: ReturnType<typeof google.gmail>;
  messageId: string;
  threadId: string;
  fallbackSubject: string;
  fallbackFrom: string;
}): Promise<Prefill | null> {
  const { gmail, messageId, threadId, fallbackSubject, fallbackFrom } = params;
  try {
    const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const headers = msg.data.payload?.headers || [];
    const get = (n: string) => headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value || '';
    const subject = get('Subject') || fallbackSubject;
    const from = get('From') || fallbackFrom;
    const dateHdr = get('Date');
    const body = extractPlainText(msg.data.payload as MsgPart) || msg.data.snippet || '';
    const trimmed = body.slice(0, 6000);
    const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
    const today = new Date().toISOString().slice(0, 10);

    const ai = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `You are a task parser for Chris Lloyd, owner of Hive Ad Agency. An email arrived that Chris needs to act on. Parse it into a structured task.

Today's date: ${today}

Email:
From: ${from}
Subject: ${subject}
Date: ${dateHdr}

"""
${trimmed}
"""

Return ONLY a JSON object (no markdown fences) with these fields:
- "task": concise task title (max 60 chars) describing what Chris needs to DO (not the subject line). Ex: "Reply to Jim re: geofence data", "Upload tax docs to TaxCaddy".
- "from": sender's name (or first name if easy).
- "project": best-guess project category. Common: "Car Toys 2026 Media", "Car Toys Tint", "Car Toys / Billing", "HEY / Eric Request", "Hive Admin", "Hive Billing", "Legal", "Portage Bank". Empty string if unsure.
- "nextAction": 1-2 sentences describing the specific next step.
- "priority": "P0" (blocking today) / "P1" (this week, important) / "P2" (normal) / "P3" (backlog).
- "due": ALWAYS write a due date in YYYY-MM-DD format. Never leave blank. Rules in order:
  1. If the email mentions an explicit deadline (a date, "by Friday", "EOD", "next week", etc.), use it — resolve relative phrases against today's date above.
  2. Otherwise fall back to a priority-based default: P0 → today (${today}), P1 → +3 days from today, P2 → +7 days from today, P3 → +14 days from today.
  3. If the email signals urgency (client awaiting reply, approval/answer needed, invoice past due, time-sensitive contract) but gives no explicit date, pick the tighter of rule 2 or +2 days from today.
- "status": "Inbox" for new triage items, "Next" if ready to do.
- "notes": key facts worth preserving (numbers, names, amounts). Under 300 chars. "" if nothing.`,
        },
      ],
    });

    const content = ai.content[0];
    if (content.type !== 'text') return null;
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(jsonText);

    const priority = (parsed.priority as TaskPriority) || 'P2';
    // Safety net: if AI returns empty/invalid due, fall back to a priority-based default
    // so every task lands in Tasks with a date (Chris's workflow: always have a due date).
    const isValidDate = typeof parsed.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due);
    const due = isValidDate ? parsed.due : defaultDueForPriority(priority);

    return {
      task: parsed.task || subject || '(untitled)',
      from: parsed.from || from,
      project: parsed.project || '',
      nextAction: parsed.nextAction || '',
      priority,
      due,
      status: (parsed.status as TaskStatus) || 'Inbox',
      notes: parsed.notes || '',
      threadUrl: gmailLink,
    };
  } catch (err) {
    console.error('[auto-triage] parseEmailToTask error:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyId: string | undefined = body.companyId;
    const threshold: number = typeof body.threshold === 'number' ? body.threshold : 60;
    const max: number = typeof body.max === 'number' ? Math.min(body.max, 25) : 10;
    const dryRun: boolean = !!body.dryRun;

    // ── Resolve Google refresh token ────────────────────────────────────
    let refreshToken: string | undefined;
    if (companyId && companyId !== 'default') {
      const integrations = await getCompanyIntegrations(companyId);
      refreshToken = integrations?.google?.refreshToken;
    }
    if (!refreshToken) refreshToken = (await getAnyGoogleRefreshToken()) || undefined;
    if (!refreshToken) {
      return NextResponse.json({ error: 'No Google refresh token available' }, { status: 500 });
    }

    const accessToken = await refreshAccessToken(refreshToken);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    // ── Fetch existing tasks so we can detect dupes ─────────────────────
    let tasks: TaskRecord[] = [];
    try {
      tasks = await getTasks({ excludeDone: true });
    } catch (err) {
      console.error('[auto-triage] Airtable getTasks failed:', err);
      return NextResponse.json({ error: 'Airtable unavailable; refusing to run (could create dupes)' }, { status: 502 });
    }
    const existingThreadUrls = new Set<string>();
    for (const t of tasks) if (t.threadUrl) existingThreadUrls.add(t.threadUrl);

    const envImportantSenders = (process.env.CC_IMPORTANT_SENDERS || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const importantDomains = Array.from(new Set([...TRIAGE_IMPORTANT_SENDER_DOMAINS, ...envImportantSenders]));

    // ── Scan Gmail (14-day window, shares the Command Center scoring) ───
    const triage: TriageItem[] = await fetchTriageInbox(accessToken, existingThreadUrls, 14, importantDomains);

    // Candidates: no existing task, AND either (a) explicitly starred by Chris, or
    // (b) scored at-or-above threshold. Stars are a hard "I care about this" signal
    // and should always become a Task regardless of score.
    //
    // Slot allocation: within `max`, starred items are packed first (all of them,
    // up to the cap). Remaining slots go to top-scoring non-starred items. This
    // guarantees a stray starred email never gets crowded out by a flood of
    // QuickBooks/replies that happen to score higher.
    const eligible = triage.filter(t => !t.hasExistingTask);
    const starredEligible = eligible.filter(t => t.starred);
    const scoredEligible = eligible.filter(t => !t.starred && t.score >= threshold);
    const starredSlice = starredEligible.slice(0, max);
    const remaining = Math.max(0, max - starredSlice.length);
    const candidates = [...starredSlice, ...scoredEligible.slice(0, remaining)];

    const created: Array<{ taskId: string; subject: string; from: string; score: number; link: string; priority: string }> = [];
    const skipped: Array<{ subject: string; from: string; score: number; reason: string; link: string }> = [];

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        threshold,
        wouldCreate: candidates.map(c => ({
          subject: c.subject,
          from: c.from,
          score: c.score,
          reasons: c.scoreReasons,
          link: c.link,
        })),
        ranSummary: `Dry run — would create ${candidates.length} Task(s) from ${triage.length} triage items (threshold ${threshold}).`,
      });
    }

    for (const item of candidates) {
      try {
        const prefill = await parseEmailToTask({
          gmail,
          messageId: item.id,
          threadId: item.threadId,
          fallbackSubject: item.subject,
          fallbackFrom: item.from,
        });
        if (!prefill) {
          skipped.push({ subject: item.subject, from: item.from, score: item.score, reason: 'AI parse failed', link: item.link });
          continue;
        }
        const rec = await createTask({
          task: prefill.task,
          priority: prefill.priority,
          due: prefill.due || undefined,
          from: prefill.from,
          project: prefill.project || undefined,
          nextAction: prefill.nextAction,
          status: prefill.status,
          view: 'inbox',
          threadUrl: prefill.threadUrl,
          notes: prefill.notes,
        });
        created.push({
          taskId: rec.id,
          subject: item.subject,
          from: item.from,
          score: item.score,
          link: item.link,
          priority: prefill.priority,
        });
      } catch (err) {
        console.error('[auto-triage] create failed for', item.subject, err);
        skipped.push({
          subject: item.subject,
          from: item.from,
          score: item.score,
          reason: err instanceof Error ? err.message : 'unknown error',
          link: item.link,
        });
      }
    }

    return NextResponse.json({
      threshold,
      max,
      triageScanned: triage.length,
      candidates: candidates.length,
      created,
      skipped,
      ranSummary: `Created ${created.length} Task(s) from ${triage.length} triage items (threshold ${threshold}).`,
    });
  } catch (err) {
    console.error('[auto-triage] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to auto-triage' },
      { status: 500 },
    );
  }
}
