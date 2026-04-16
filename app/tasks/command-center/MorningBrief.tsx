'use client';
// app/tasks/command-center/MorningBrief.tsx
// The "start your day" card — renders the five-substrate summary returned by
// /api/os/brief/morning. Sits at the very top of the Command Center so Chris
// sees the full signal before he scrolls.
//
// Design: every section degrades gracefully. If Gmail isn't connected the
// Inbox slot becomes a hint; if the Activity Log is empty the Risks slot shows
// "all clear." The card is always a single paragraph wide — easy to scan at
// 7am with coffee.
//
// Clicking a Focus task opens the existing TaskEditPanel via `onEdit`, and
// emits `task.opened-in-ui` for the engagement feedback loop.

import { useEffect, useState } from 'react';
import { Sunrise, AlertTriangle, Calendar, Mail, Target, RefreshCw, Sparkles } from 'lucide-react';
import { MorningBriefFocusRow } from './MorningBriefFocusRow';

interface FocusReasonChip {
  tag: string;
  label: string;
  points: number;
}

interface FocusEntry {
  id: string;
  title: string;
  priority: string | null;
  due: string | null;
  status: string;
  project?: string | null;
  topReason: string | null;
  /** Top 3 scoring reasons — rendered as chips under the title in the brief. */
  reasons?: FocusReasonChip[];
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
  start: string;
  end: string;
  allDay: boolean;
  attendeeCount: number;
  htmlLink?: string;
}

interface MorningBriefData {
  generatedAt: string;
  dateLabel: string;
  focus: FocusEntry[];
  overdue: { count: number; top: OverdueEntry[] };
  risks: { high: number; medium: number; low: number; top: RiskSummary[] };
  inbox: { fetched: boolean; needsReply: InboxEntry[]; totalSurfaced: number; error?: string };
  calendar: { fetched: boolean; remaining: CalendarEntry[]; laterCount: number; error?: string };
}

// NOTE: Focus-row priority pills now live in MorningBriefFocusRow.
// Overdue and Risks rows use hard-coded red/severity styling below, so we
// don't need a shared helper here anymore.

function formatTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function MorningBrief({ onEdit }: { onEdit: (taskId: string) => void }) {
  const [data, setData] = useState<MorningBriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Bumps on every "Decide all" click. Each row stores the last nonce it
   *  handled, so a bump = run-once trigger without re-running on re-renders. */
  const [decideAllNonce, setDecideAllNonce] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/os/brief/morning', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Brief request failed: ${res.status}`);
      const json: MorningBriefData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load morning brief');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /**
   * Called by a focus row after Apply succeeds. We deliberately DON'T reload
   * the brief immediately — that would yank the row out from under a success
   * message Chris is still reading. Users who want a fresh brief can hit the
   * refresh icon (or it'll be fresh on next mount). The task itself has been
   * updated in Airtable, so other panels like TaskList see it already.
   */
  function handleFocusApplied() {
    // Intentional no-op for now; wired so we can flip to `load()` later if
    // Chris prefers auto-refresh behavior. Kept typed to avoid drift.
  }

  // Emit task.opened-in-ui when Chris clicks a focus item.
  async function handleFocusClick(taskId: string) {
    onEdit(taskId);
    try {
      await fetch('/api/os/activity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorType: 'user',
          actor: 'Chris',
          action: 'task.opened-in-ui',
          entityType: 'task',
          entityId: taskId,
          source: 'MorningBrief',
        }),
      });
    } catch {
      // non-fatal
    }
  }

  if (error) {
    // Fail silently — the rest of the dashboard still works.
    return null;
  }

  if (!data) {
    return (
      <div className="mb-6 rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/5 to-purple-500/[0.02] p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Sunrise className="w-4 h-4 animate-pulse" />
          Assembling your morning brief…
        </div>
      </div>
    );
  }

  const totalRisks = data.risks.high + data.risks.medium + data.risks.low;

  return (
    <div className="mb-6 rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/[0.06] to-purple-500/[0.02] p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Sunrise className="w-5 h-5 text-indigo-300" />
          <div>
            <h2 className="text-base font-semibold text-gray-100">Morning brief</h2>
            <p className="text-xs text-gray-500 mt-0.5">{data.dateLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          aria-label="Reload brief"
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded border border-white/10 hover:border-white/20"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Focus ── */}
        <section className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-indigo-300" />
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Focus</h3>
            </div>
            <div className="flex items-center gap-2">
              {data.focus.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDecideAllNonce(Date.now())}
                  className="flex items-center gap-1 text-[10px] text-indigo-200 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-500/50 px-1.5 py-0.5 rounded transition-colors"
                  title="Run the decision engine on all focus tasks in parallel"
                >
                  <Sparkles className="w-3 h-3" />
                  Decide all
                </button>
              )}
              <span className="text-[10px] text-gray-500">top {data.focus.length}</span>
            </div>
          </div>
          {data.focus.length === 0 ? (
            <p className="text-xs text-gray-500">No live tasks to focus on.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.focus.map(f => (
                <MorningBriefFocusRow
                  key={f.id}
                  focus={f}
                  onEdit={handleFocusClick}
                  decideNonce={decideAllNonce ?? undefined}
                  onApplied={handleFocusApplied}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ── Calendar today ── */}
        <section className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-sky-300" />
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Today</h3>
            </div>
            <span className="text-[10px] text-gray-500">
              {data.calendar.remaining.length + data.calendar.laterCount} remaining
            </span>
          </div>
          {!data.calendar.fetched ? (
            <p className="text-xs text-gray-500">Connect Google to see your calendar.</p>
          ) : data.calendar.remaining.length === 0 ? (
            <p className="text-xs text-gray-500">No more meetings today.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.calendar.remaining.map(e => (
                <li
                  key={e.id}
                  className="flex items-start gap-2 p-2 rounded border border-white/5 bg-white/[0.02]"
                >
                  <span className="text-[10px] text-sky-300 shrink-0 mt-0.5 tabular-nums w-12">
                    {e.allDay ? 'all day' : formatTime(e.start)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-100 truncate">{e.title}</div>
                    {e.attendeeCount > 0 && (
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {e.attendeeCount} {e.attendeeCount === 1 ? 'attendee' : 'attendees'}
                      </div>
                    )}
                  </div>
                </li>
              ))}
              {data.calendar.laterCount > 0 && (
                <li className="text-[11px] text-gray-500 pl-2">
                  +{data.calendar.laterCount} more later today
                </li>
              )}
            </ul>
          )}
        </section>

        {/* ── Overdue + Risks (combined column) ── */}
        <section className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`w-3.5 h-3.5 ${data.risks.high > 0 || data.overdue.count > 0 ? 'text-red-400' : data.risks.medium > 0 ? 'text-amber-400' : 'text-gray-500'}`}
              />
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">What's slipping</h3>
            </div>
            <span className="text-[10px] text-gray-500">
              {data.overdue.count} overdue · {totalRisks} risk{totalRisks === 1 ? '' : 's'}
            </span>
          </div>
          {data.overdue.count === 0 && totalRisks === 0 ? (
            <p className="text-xs text-gray-500">Nothing slipping — enjoy the clarity.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.overdue.top.map(o => (
                <li key={`overdue-${o.id}`}>
                  <button
                    type="button"
                    onClick={() => handleFocusClick(o.id)}
                    className="w-full text-left flex items-start gap-2 p-2 rounded border border-red-500/20 bg-red-500/[0.04] hover:bg-red-500/[0.08] transition-colors"
                  >
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-300 font-medium shrink-0 mt-0.5">
                      {o.overdueByDays}d late
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-100 truncate">{o.title}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">due {o.due}</div>
                    </div>
                  </button>
                </li>
              ))}
              {data.risks.top.slice(0, Math.max(0, 3 - data.overdue.top.length)).map((r, i) => (
                <li key={`risk-${r.entityId}-${i}`}>
                  <button
                    type="button"
                    onClick={() => r.entityId && handleFocusClick(r.entityId)}
                    className="w-full text-left flex items-start gap-2 p-2 rounded border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                  >
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 mt-0.5 ${
                        r.severity === 'high'
                          ? 'bg-red-500/10 border-red-500/40 text-red-300'
                          : r.severity === 'medium'
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                            : 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                      }`}
                    >
                      {r.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-100 truncate">{r.entityTitle}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5 truncate">{r.reason}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Inbox ── */}
        <section className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-emerald-300" />
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Inbox</h3>
            </div>
            <span className="text-[10px] text-gray-500">
              {data.inbox.fetched ? `${data.inbox.totalSurfaced} scored` : 'not connected'}
            </span>
          </div>
          {!data.inbox.fetched ? (
            <p className="text-xs text-gray-500">Connect Gmail to see emails needing reply.</p>
          ) : data.inbox.needsReply.length === 0 ? (
            <p className="text-xs text-gray-500">No high-signal emails waiting on you.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.inbox.needsReply.map(m => (
                <li
                  key={m.threadId}
                  className="flex items-start gap-2 p-2 rounded border border-white/5 bg-white/[0.02]"
                >
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shrink-0 mt-0.5">
                    {m.matchedReason}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-100 truncate">{m.subject}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                      from {m.fromName || m.fromEmail}
                      {m.hasExistingTask ? ' · already a task' : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
