// app/api/os/brief/morning/route.ts
// Morning Brief — the one-shot "start your day" summary.
//
// Pulls the top signal from each of the five substrates Chris's day runs on:
//   - Focus     : top 3 ranked tasks (prioritization brain)
//   - Overdue   : count + top overdue item
//   - Risks     : stall/drift detector summary
//   - Inbox     : top inbox items likely needing reply (Gmail triage score)
//   - Calendar  : today's remaining meetings
//
// GET /api/os/brief/morning
//   ?companyId=xxx  (optional; defaults to first integration with Google)
//
// Never blocks the UI: every section degrades gracefully. If Google isn't
// connected, the Inbox and Calendar sections return empty but the rest still
// renders.
//
// Emits `brief.morning-viewed` when generated — closing the feedback loop on
// whether Chris actually reads the Brief in a given day.
//
// Design notes:
//   - Pure aggregation over existing endpoints' data sources, NOT a duplication
//     of their logic. If the scoring changes in `lib/prioritization.ts`, the
//     Brief changes with it.
//   - Designed to be renderable in a single card — we cap everything at 3 items
//     so the surface stays scannable.

import { NextRequest, NextResponse } from 'next/server';
import { getTasks, type TaskRecord } from '@/lib/airtable/tasks';
import { rankTasks, type ActivitySignals } from '@/lib/prioritization';
import { detectRisks } from '@/lib/riskDetection';
import {
  getRecentTaskActivity,
  getRecentActivityByTypes,
  logEventAsync,
  type ActivityRow,
} from '@/lib/airtable/activityLog';
import { getCompanyIntegrations, getAnyGoogleRefreshToken } from '@/lib/airtable/companyIntegrations';
import { refreshAccessToken } from '@/lib/google/oauth';
import { getEffectiveImportantDomains } from '@/lib/personalContext';
import {
  fetchTriageInbox,
  fetchCalendarRange,
  type TriageItem,
  type CalEvent,
} from '@/app/api/os/command-center/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ============================================================================
// Types (wire shape)
// ============================================================================

interface FocusReasonChip {
  /** Short machine tag (e.g. 'due.overdue', 'priority.P0'). Useful for testing. */
  tag: string;
  /** Human-readable label shown in the chip. */
  label: string;
  /** Signed score contribution — UI only needs the sign + magnitude for color. */
  points: number;
}

interface FocusEntry {
  id: string;
  title: string;
  priority: string | null;
  due: string | null;
  status: string;
  project?: string | null;
  topReason: string | null; // the highest-weight scoring reason (legacy)
  /** Top 3 reasons by magnitude, positive-weighted preferred. Surfaces "why
   *  this made the focus list" as compact chips Chris can scan in the brief. */
  reasons: FocusReasonChip[];
  score: number;
}

interface OverdueEntry {
  id: string;
  title: string;
  priority: string | null;
  due: string;
  overdueByDays: number;
}

interface RiskSummary {
  kind: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  entityId: string;
  entityTitle: string;
}

interface InboxEntry {
  threadId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  score: number;
  link: string;
  matchedReason: string;
  hasExistingTask: boolean;
}

interface CalendarEntry {
  id: string;
  title: string;
  start: string;      // ISO
  end: string;        // ISO
  allDay: boolean;
  attendeeCount: number;
  htmlLink?: string;
}

interface MorningBrief {
  generatedAt: string;       // ISO
  dateLabel: string;         // e.g. "Wednesday, April 15, 2026"
  focus: FocusEntry[];
  overdue: {
    count: number;
    top: OverdueEntry[];     // up to 3
  };
  risks: {
    high: number;
    medium: number;
    low: number;
    top: RiskSummary[];      // up to 3, severity-sorted
  };
  inbox: {
    fetched: boolean;        // false = no Google token; not an error
    needsReply: InboxEntry[];// top 3
    totalSurfaced: number;   // total scored items we pulled, pre-cap
    error?: string;
  };
  calendar: {
    fetched: boolean;
    remaining: CalendarEntry[]; // from "now" through end of today
    laterCount: number;         // count beyond the 3 shown
    error?: string;
  };
}

// ============================================================================
// Helpers
// ============================================================================

/** Parse a task's Airtable YYYY-MM-DD due date into overdue days relative to now. */
function overdueDays(ymd: string | null | undefined, now: Date): number {
  if (!ymd) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return 0;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - due.getTime()) / (24 * 3600 * 1000));
}

function aggregateFocusSignals(rows: ActivityRow[], now: Date): Record<string, ActivitySignals> {
  const sevenDaysAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  const fourteenDaysAgo = now.getTime() - 14 * 24 * 3600 * 1000;
  const byTask: Record<string, ActivitySignals> = {};
  for (const row of rows) {
    if (!row.entityId) continue;
    const t = Date.parse(row.timestamp);
    if (Number.isNaN(t)) continue;
    const sig =
      byTask[row.entityId] ||
      (byTask[row.entityId] = {
        opensLast7d: 0,
        updatesLast7d: 0,
        dismissalsLast14d: 0,
        lastActivityAt: undefined,
      });
    if (!sig.lastActivityAt || Date.parse(sig.lastActivityAt) < t) {
      sig.lastActivityAt = row.timestamp;
    }
    if (t >= sevenDaysAgo) {
      if (row.action === 'task.opened-in-ui') sig.opensLast7d += 1;
      else if (row.action.startsWith('task.updated') || row.action === 'task.status-changed')
        sig.updatesLast7d += 1;
    }
    if (t >= fourteenDaysAgo && row.action === 'task.dismissed-from-triage') {
      sig.dismissalsLast14d += 1;
    }
  }
  return byTask;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Top reason is the scoring entry with the largest magnitude (positive). */
function topReasonFromRanked(reasons: Array<{ label: string; points: number }> | undefined): string | null {
  if (!reasons || reasons.length === 0) return null;
  const positives = reasons.filter(r => r.points > 0);
  const pool = positives.length ? positives : reasons;
  return [...pool].sort((a, b) => Math.abs(b.points) - Math.abs(a.points))[0].label;
}

/** Return the top-N reasons by absolute magnitude, preferring positive-points
 *  entries (those are what "earned" the task its focus-list slot). If the task
 *  only has neutral/negative reasons we fall back to the top by magnitude —
 *  that way the UI never shows an empty "Why" row. */
function topReasonsFromRanked(
  reasons: Array<{ tag: string; label: string; points: number }> | undefined,
  n: number,
): FocusReasonChip[] {
  if (!reasons || reasons.length === 0) return [];
  const positives = reasons.filter(r => r.points > 0);
  const pool = positives.length ? positives : reasons;
  return [...pool]
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, n)
    .map(r => ({ tag: r.tag, label: r.label, points: r.points }));
}

function buildOverdueTop(tasks: TaskRecord[], now: Date): { count: number; top: OverdueEntry[] } {
  const overdue = tasks
    .filter(t => t.status !== 'Done' && t.status !== 'Archive' && !t.done)
    .map(t => ({ t, days: overdueDays(t.due, now) }))
    .filter(x => x.days > 0)
    .sort((a, b) => b.days - a.days);

  return {
    count: overdue.length,
    top: overdue.slice(0, 3).map(x => ({
      id: x.t.id,
      title: x.t.task,
      priority: x.t.priority,
      due: x.t.due!,
      overdueByDays: x.days,
    })),
  };
}

/** Pull Google access token using the same fallback chain as command-center. */
async function getGoogleAccessToken(companyId: string | null): Promise<string | null> {
  try {
    let refreshToken: string | undefined;
    if (companyId && companyId !== 'default') {
      const integrations = await getCompanyIntegrations(companyId);
      refreshToken = integrations?.google?.refreshToken;
    }
    if (!refreshToken) {
      const fallback = await getAnyGoogleRefreshToken();
      if (fallback) refreshToken = fallback;
    }
    if (!refreshToken) return null;
    return await refreshAccessToken(refreshToken);
  } catch (err) {
    console.warn('[api/os/brief/morning] google token fetch failed:', err);
    return null;
  }
}

// ============================================================================
// Handler
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const param = searchParams.get('companyId');
    const companyId =
      param && param !== 'default'
        ? param
        : process.env.DMA_DEFAULT_COMPANY_ID?.trim() || null;
    const now = new Date();

    // ── Tasks + derived surfaces ──────────────────────────────────────────
    const tasks = await getTasks({ excludeDone: false });

    // Activity signals for prioritization + risk detection (best-effort).
    const sinceIso = new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString();
    const liveTaskIds = tasks
      .filter(t => t.status !== 'Done' && t.status !== 'Archive' && !t.done)
      .map(t => t.id);

    const [taskActivity, emailActivity]: [ActivityRow[], ActivityRow[]] = await Promise.all([
      getRecentTaskActivity({ sinceIso, taskIds: liveTaskIds, maxRows: 2000 }),
      getRecentActivityByTypes({ sinceIso, entityTypes: ['email'], maxRows: 500 }),
    ]);

    const signals = aggregateFocusSignals(taskActivity, now);
    const ranked = rankTasks(tasks, signals, now);
    const focus: FocusEntry[] = ranked.slice(0, 3).map(r => ({
      id: r.task.id,
      title: r.task.task,
      priority: r.task.priority,
      due: r.task.due,
      status: r.task.status,
      project: r.task.project,
      topReason: topReasonFromRanked(r.reasons),
      reasons: topReasonsFromRanked(r.reasons, 3),
      score: r.score,
    }));

    const overdue = buildOverdueTop(tasks, now);

    const risks = detectRisks({
      tasks,
      activity: [...taskActivity, ...emailActivity],
      now,
    });
    const riskSummary = {
      high: risks.filter(r => r.severity === 'high').length,
      medium: risks.filter(r => r.severity === 'medium').length,
      low: risks.filter(r => r.severity === 'low').length,
      top: risks.slice(0, 3).map(r => ({
        kind: r.kind,
        severity: r.severity,
        reason: r.reason,
        entityId: r.entityId,
        entityTitle: r.entityTitle,
      })) as RiskSummary[],
    };

    // ── Google-dependent surfaces ─────────────────────────────────────────
    let inboxFetched = false;
    let inboxError: string | undefined;
    let inboxEntries: InboxEntry[] = [];
    let inboxTotal = 0;

    let calendarFetched = false;
    let calendarError: string | undefined;
    let calendarRemaining: CalendarEntry[] = [];
    let laterCount = 0;

    const accessToken = await getGoogleAccessToken(companyId);
    if (accessToken) {
      // Run Gmail + Calendar in parallel. Either can fail independently.
      const existingThreadUrls = new Set<string>();
      for (const t of tasks) if (t.threadUrl) existingThreadUrls.add(t.threadUrl);
      const importantDomains = await getEffectiveImportantDomains();

      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const [triageResult, calResult] = await Promise.allSettled([
        fetchTriageInbox(accessToken, existingThreadUrls, 14, importantDomains),
        // Full local calendar day — using `now` as timeMin hid meetings earlier today.
        fetchCalendarRange(accessToken, todayStart.toISOString(), todayEnd.toISOString()),
      ]);

      if (triageResult.status === 'fulfilled') {
        inboxFetched = true;
        const items: TriageItem[] = triageResult.value;
        // Surface things likely to need a reply: score ≥ 40 and unread/starred.
        const scored = items
          .filter(i => i.score >= 40)
          .sort((a, b) => b.score - a.score);
        inboxTotal = scored.length;
        inboxEntries = scored.slice(0, 3).map(i => ({
          threadId: i.threadId,
          subject: i.subject,
          fromName: i.fromName,
          fromEmail: i.fromEmail,
          score: Math.round(i.score),
          link: i.link,
          matchedReason: i.matchedReason,
          hasExistingTask: i.hasExistingTask,
        }));
      } else {
        inboxError =
          triageResult.reason instanceof Error
            ? triageResult.reason.message
            : 'Gmail triage failed';
      }

      if (calResult.status === 'fulfilled') {
        calendarFetched = true;
        const events: CalEvent[] = calResult.value.events;
        if (calResult.value.error) calendarError = calResult.value.error;
        // Filter events that haven't already ended (end > now).
        const upcoming = events.filter(e => {
          if (!e.end) return true;
          const endMs = Date.parse(e.end);
          return Number.isNaN(endMs) ? true : endMs > now.getTime();
        });
        calendarRemaining = upcoming.slice(0, 3).map(e => ({
          id: e.id,
          title: e.summary,
          start: e.start,
          end: e.end,
          allDay: e.allDay,
          attendeeCount: e.attendees.length,
          htmlLink: e.htmlLink,
        }));
        laterCount = Math.max(0, upcoming.length - calendarRemaining.length);
      } else {
        calendarError =
          calResult.reason instanceof Error ? calResult.reason.message : 'Calendar fetch failed';
      }
    }

    const brief: MorningBrief = {
      generatedAt: now.toISOString(),
      dateLabel: formatDateLabel(now),
      focus,
      overdue,
      risks: riskSummary,
      inbox: {
        fetched: inboxFetched,
        needsReply: inboxEntries,
        totalSurfaced: inboxTotal,
        error: inboxError,
      },
      calendar: {
        fetched: calendarFetched,
        remaining: calendarRemaining,
        laterCount,
        error: calendarError,
      },
    };

    // Single-line log so Vercel "Search logs" finds it (avoid quoted multi-arg / console.info quirks).
    console.log(
      `[brief/morning] build=2026-04-17c company=${companyId ? companyId.slice(0, 10) : 'none'} googleToken=${accessToken ? 'yes' : 'no'}`,
    );

    logEventAsync({
      actorType: 'user',
      actor: 'Chris',
      action: 'brief.morning-viewed',
      entityType: 'other',
      summary:
        `Morning brief: ${focus.length} focus, ${overdue.count} overdue, ` +
        `${riskSummary.high + riskSummary.medium + riskSummary.low} risks, ` +
        `${inboxEntries.length} inbox, ${calendarRemaining.length} meetings`,
      metadata: {
        focusCount: focus.length,
        overdueCount: overdue.count,
        riskCount: risks.length,
        inboxCount: inboxEntries.length,
        calendarCount: calendarRemaining.length,
        googleConnected: !!accessToken,
      },
      source: 'app/api/os/brief/morning',
    });

    return NextResponse.json(brief, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        'X-Hive-Morning-Brief': '2026-04-17c',
      },
    });
  } catch (err) {
    console.error('[api/os/brief/morning] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build morning brief' },
      { status: 500 },
    );
  }
}
