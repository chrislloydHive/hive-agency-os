// app/api/os/morning-brief
// GET — single LLM-generated paragraph orienting Chris for the day.
//
// Inputs aggregated server-side: active tasks (priorities, dues, drafts),
// today's calendar events. Sent to Claude Haiku with a tight prompt to produce
// a 3-4 line paragraph in Chris's voice — no greetings, no sign-offs, no
// markdown. Frontend renders it above the Today section in My Day.
//
// Returns { brief, generatedAt }.

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { getTasks, type TaskRecord } from '@/lib/airtable/tasks';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';
import { getTodayRangeUtcMs } from '@/lib/google/calendarDayBounds';
import { getIdentity, getVoice } from '@/lib/personalContext';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MODEL = 'claude-haiku-4-5-20251001';

function calendarTimeZone(): string {
  return (
    process.env.HIVE_OS_CALENDAR_TZ?.trim() ||
    process.env.OS_CALENDAR_TZ?.trim() ||
    'America/Los_Angeles'
  );
}

const PRI_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function isWaitingTask(t: TaskRecord): boolean {
  const next = (t.nextAction || '').toLowerCase();
  return /\b(waiting on|wait for|pending from|awaiting|expect.*from|follow up on|as promised)\b/i.test(next);
}

function daysDiff(dueStr?: string | null, today = new Date()): number | null {
  if (!dueStr) return null;
  const d = new Date(dueStr + 'T00:00:00');
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

interface BriefContext {
  topActionable: TaskRecord[];      // P0/P1 due today or overdue, not draft-ready
  draftsReady: TaskRecord[];        // tasks with draftUrl
  staleWaiting: TaskRecord[];       // waiting >7 days
  overdueCount: number;
  todayCount: number;
  events: Array<{ title: string; start: string; end: string }>;
}

async function gatherContext(): Promise<BriefContext> {
  const tasks = await getTasks({ excludeDone: true });
  const active = tasks.filter((t) => !t.dismissedAt);

  const draftsReady = active.filter((t) => !!t.draftUrl).slice(0, 5);
  const overdue = active.filter((t) => {
    const dd = daysDiff(t.due);
    return dd != null && dd < 0 && !t.draftUrl;
  });
  const dueToday = active.filter((t) => daysDiff(t.due) === 0);

  const priSort = (a: TaskRecord, b: TaskRecord) => {
    const pa = PRI_ORDER[a.priority || ''] ?? 9;
    const pb = PRI_ORDER[b.priority || ''] ?? 9;
    if (pa !== pb) return pa - pb;
    const ad = a.due ? new Date(a.due).getTime() : Infinity;
    const bd = b.due ? new Date(b.due).getTime() : Infinity;
    return ad - bd;
  };

  // Top 3 actionable items for today, weighted by priority then due date.
  // Excludes draft-ready (those are surfaced separately), excludes waiting,
  // excludes stale (>7d overdue with no draft) — those are noise here.
  const topActionable = active
    .filter((t) => !t.draftUrl)
    .filter((t) => !isWaitingTask(t))
    .filter((t) => {
      const dd = daysDiff(t.due);
      // Today, tomorrow, or overdue but recent (<= 7d ago)
      return dd == null ? false : dd >= -7 && dd <= 1;
    })
    .sort(priSort)
    .slice(0, 3);

  // "Things slipping": waiting items the other party owes that have stalled.
  const now = new Date();
  const staleWaiting = active
    .filter((t) => isWaitingTask(t) && !t.draftUrl)
    .filter((t) => {
      const ts = t.lastSeenAt || t.latestInboundAt || t.createdAt;
      if (!ts) return false;
      const d = new Date(ts);
      const days = Math.round((now.getTime() - d.getTime()) / 86400000);
      return days > 7;
    })
    .slice(0, 3);

  // Today's calendar events (best-effort — degrade silently if Google access fails).
  const events: Array<{ title: string; start: string; end: string }> = [];
  try {
    const defaultCompanyId = process.env.DMA_DEFAULT_COMPANY_ID;
    let refreshToken: string | undefined;
    if (defaultCompanyId) {
      const integrations = await getCompanyIntegrations(defaultCompanyId);
      refreshToken = integrations?.google?.refreshToken;
    }
    if (!refreshToken) refreshToken = (await getAnyGoogleRefreshToken()) || undefined;
    if (refreshToken) {
      const accessToken = await refreshAccessToken(refreshToken);
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth });
      const tz = calendarTimeZone();
      const { startMs, endMs } = getTodayRangeUtcMs(new Date(), tz);
      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date(startMs).toISOString(),
        timeMax: new Date(endMs).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 25,
        timeZone: tz,
      });
      for (const ev of res.data.items || []) {
        // Skip personal holds / focus blocks
        const summary = (ev.summary || '').trim();
        if (!summary) continue;
        if (/^(hold|focus|ooo|out of office|lunch|break|block|busy)$/i.test(summary)) continue;
        const start = ev.start?.dateTime || ev.start?.date || '';
        const end = ev.end?.dateTime || ev.end?.date || '';
        events.push({ title: summary, start, end });
      }
    }
  } catch (err) {
    console.warn('[morning-brief] calendar fetch failed (non-fatal):', err instanceof Error ? err.message : err);
  }

  return {
    topActionable,
    draftsReady,
    staleWaiting,
    overdueCount: overdue.length,
    todayCount: dueToday.length,
    events,
  };
}

function describeTask(t: TaskRecord): string {
  const dd = daysDiff(t.due);
  let when = '';
  if (dd == null) when = 'no date';
  else if (dd < 0) when = `${Math.abs(dd)}d overdue`;
  else if (dd === 0) when = 'due today';
  else if (dd === 1) when = 'due tomorrow';
  else when = `due in ${dd}d`;
  const pri = t.priority || '—';
  const proj = t.project ? ` [${t.project}]` : '';
  return `- ${pri}${proj} "${t.task}" (${when})`;
}

function describeWaiting(t: TaskRecord, now = new Date()): string {
  const ts = t.lastSeenAt || t.latestInboundAt || t.createdAt;
  const days = ts ? Math.round((now.getTime() - new Date(ts).getTime()) / 86400000) : null;
  const ago = days != null ? `${days}d stalled` : 'stalled';
  return `- "${t.task}" (${ago}, waiting on: ${t.nextAction || '—'})`;
}

function buildContextString(ctx: BriefContext): string {
  const now = new Date();
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const lines: string[] = [];
  lines.push(`Today: ${today}`);
  lines.push(`Counts: ${ctx.todayCount} due today, ${ctx.overdueCount} overdue, ${ctx.draftsReady.length} drafts ready, ${ctx.staleWaiting.length} stalled follow-ups.`);

  if (ctx.topActionable.length > 0) {
    lines.push('', 'Top actionable items (priority/date):');
    for (const t of ctx.topActionable) lines.push(describeTask(t));
  }
  if (ctx.draftsReady.length > 0) {
    lines.push('', 'Drafts ready in Gmail:');
    for (const t of ctx.draftsReady.slice(0, 3)) lines.push(`- "${t.task}"`);
  }
  if (ctx.staleWaiting.length > 0) {
    lines.push('', 'Slipping (waiting on others, stalled >7d):');
    for (const t of ctx.staleWaiting) lines.push(describeWaiting(t, now));
  }
  if (ctx.events.length > 0) {
    lines.push('', "Today's meetings:");
    for (const ev of ctx.events) {
      const start = ev.start ? new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: calendarTimeZone() }) : '?';
      lines.push(`- ${start} — ${ev.title}`);
    }
  }
  return lines.join('\n');
}

export async function GET() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
    }

    const [identity, voice, ctx] = await Promise.all([getIdentity(), getVoice(), gatherContext()]);

    const totalSurface = ctx.topActionable.length + ctx.draftsReady.length + ctx.staleWaiting.length + ctx.events.length;
    if (totalSurface === 0) {
      return NextResponse.json({
        brief: 'Nothing on the radar today — empty queue. Use the calm to get ahead.',
        generatedAt: new Date().toISOString(),
      });
    }

    const systemPrompt = `You are writing the morning orientation paragraph for ${identity.name} (${identity.role}, ${identity.company}). 3-4 short lines. Address as "you". Help them see today's reality in one glance.

Voice: ${voice.tone}. Concrete: name people and times when given. No greetings ("Good morning!"), no sign-offs ("You got this!"), no headers, no markdown, no bullet points — flowing prose only. No filler ("Here's what's happening today"). Lead with the most important thing.

Cover (only what's actually present in the data — skip empty categories silently):
1. The single most important actionable item today (priority + brief context).
2. Drafts ready to send if any (count + 1 example title).
3. Meeting prep if a notable meeting is on the calendar (name it).
4. Anything slipping (stalled follow-ups) if present.

If something is genuinely empty (no overdue, no slipping, etc.), say so briefly rather than padding.`;

    const userContent = buildContextString(ctx);

    const anthropic = new Anthropic({ apiKey, timeout: 25_000 });
    const ai = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });
    const block = ai.content[0];
    if (!block || block.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected Claude response shape' }, { status: 502 });
    }
    const brief = block.text.trim();
    return NextResponse.json({ brief, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[morning-brief] error:', err);
    const msg = err instanceof Error ? err.message : 'Morning brief failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
