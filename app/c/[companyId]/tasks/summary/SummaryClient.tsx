'use client';

// app/c/[companyId]/tasks/summary/SummaryClient.tsx
// Daily Summary — Calendar · Email Pulse · Overdue · Hot · Due Today
// Source of truth: Airtable Tasks table + Google Calendar + Gmail

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Flame,
  CalendarClock,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  FileText,
  Paperclip,
  Clock,
  Calendar,
  Mail,
  Star,
  Video,
  Users,
  MapPin,
  Inbox,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface TaskRecord {
  id: string;
  task: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | null;
  due: string | null;
  from: string;
  project: string;
  nextAction: string;
  status: string;
  view: string;
  threadUrl: string | null;
  draftUrl: string | null;
  attachUrl: string | null;
  done: boolean;
  notes: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  htmlLink?: string;
  attendeeCount: number;
  responseStatus?: string;
  description?: string;
}

interface EmailDigest {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  labels: string[];
  isStarred: boolean;
  isImportant: boolean;
}

interface SummaryData {
  overdue: TaskRecord[];
  hot: TaskRecord[];
  dueToday: TaskRecord[];
  counts: {
    overdue: number;
    hot: number;
    dueToday: number;
    totalOpen: number;
  };
  calendar: {
    today: CalendarEvent[];
    week: CalendarEvent[];
  };
  emailPulse: {
    starred: EmailDigest[];
    needsReply: EmailDigest[];
    unreadCount: number;
  };
  googleConnected: boolean;
  generatedAt: string;
}

interface SummaryClientProps {
  companyId: string;
  companyName: string;
}

// ============================================================================
// Colors
// ============================================================================

const PRI_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  P0: { bg: 'bg-red-950', text: 'text-red-400', border: 'border-red-800', dot: 'bg-red-500' },
  P1: { bg: 'bg-orange-950', text: 'text-orange-400', border: 'border-orange-800', dot: 'bg-orange-400' },
  P2: { bg: 'bg-yellow-950', text: 'text-yellow-400', border: 'border-yellow-800', dot: 'bg-yellow-400' },
  P3: { bg: 'bg-green-950', text: 'text-green-400', border: 'border-green-800', dot: 'bg-green-400' },
};

// ============================================================================
// Shared Sub-components
// ============================================================================

function PriorityDot({ pri }: { pri: string | null }) {
  const c = PRI_COLORS[pri || 'P2'] || PRI_COLORS.P2;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {pri || '—'}
    </span>
  );
}

function LinkIcon({ url, icon: Icon, color, title }: { url: string | null; icon: typeof ExternalLink; color: string; title: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={title}
       className={`${color} hover:opacity-70 transition-opacity p-0.5`}
       onClick={(e) => e.stopPropagation()}>
      <Icon size={14} strokeWidth={2.2} />
    </a>
  );
}

function SectionHeader({ icon: Icon, label, count, color }: { icon: typeof Flame; label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={18} className={color} />
      <h3 className={`text-sm font-bold uppercase tracking-wide ${color}`}>{label}</h3>
      <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${color} bg-gray-800/60 border border-gray-700`}>
        {count}
      </span>
    </div>
  );
}

function EmptyBucket({ label }: { label: string }) {
  return (
    <div className="px-4 py-6 text-center text-gray-600 text-sm border border-dashed border-gray-800 rounded-lg">
      No {label.toLowerCase()} right now
    </div>
  );
}

function StatCard({ label, value, color, borderColor, bgColor }: { label: string; value: number; color: string; borderColor: string; bgColor: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-lg border ${borderColor} ${bgColor}`}>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-0.5">{label}</span>
    </div>
  );
}

// ============================================================================
// Task Row
// ============================================================================

function TaskRow({ task, companyId }: { task: TaskRecord; companyId: string }) {
  return (
    <Link
      href={`/c/${companyId}/tasks`}
      className="group flex items-start gap-3 px-4 py-3 rounded-lg border border-gray-800 hover:border-gray-600 hover:bg-gray-800/40 transition-all cursor-pointer"
    >
      <div className="flex-shrink-0 pt-0.5">
        <PriorityDot pri={task.priority} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-100 group-hover:text-white transition-colors truncate">
          {task.task}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.nextAction}</p>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
          {task.due && (
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {task.due}
            </span>
          )}
          {task.project && (
            <>
              <span className="text-gray-700">&middot;</span>
              <span className="truncate">{task.project}</span>
            </>
          )}
          {task.from && (
            <>
              <span className="text-gray-700">&middot;</span>
              <span className="truncate">{task.from}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
        <LinkIcon url={task.threadUrl} icon={ExternalLink} color="text-blue-400" title="Email thread" />
        <LinkIcon url={task.draftUrl} icon={FileText} color="text-green-400" title="Draft" />
        <LinkIcon url={task.attachUrl} icon={Paperclip} color="text-purple-400" title="Attachment" />
      </div>
    </Link>
  );
}

// ============================================================================
// Calendar Section
// ============================================================================

function formatTime(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDayLabel(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function CalendarEventRow({ event }: { event: CalendarEvent }) {
  const timeLabel = event.allDay
    ? 'All day'
    : `${formatTime(event.start)} – ${formatTime(event.end)}`;

  return (
    <a
      href={event.htmlLink || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 px-4 py-3 rounded-lg border border-gray-800 hover:border-blue-800/50 hover:bg-blue-950/20 transition-all"
    >
      {/* Time column */}
      <div className="flex-shrink-0 w-28 text-xs text-gray-400 pt-0.5 font-medium">
        {timeLabel}
      </div>

      {/* Event info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-100 group-hover:text-white truncate">
          {event.summary}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          {event.attendeeCount > 1 && (
            <span className="flex items-center gap-1">
              <Users size={11} />
              {event.attendeeCount}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin size={11} />
              {event.location.length > 40 ? event.location.slice(0, 40) + '...' : event.location}
            </span>
          )}
        </div>
      </div>

      {/* Status indicator */}
      {event.responseStatus === 'tentative' && (
        <span className="text-xs text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/50 flex-shrink-0">
          Maybe
        </span>
      )}
    </a>
  );
}

function CalendarSection({ today, week }: { today: CalendarEvent[]; week: CalendarEvent[] }) {
  const [showWeek, setShowWeek] = useState(false);

  // Group week events by day
  const weekByDay = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    for (const e of week) {
      const dayKey = formatDayLabel(e.start);
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(e);
    }
    return groups;
  }, [week]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-blue-400" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-blue-400">
            {showWeek ? 'This Week' : 'Today\'s Schedule'}
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-blue-400 bg-gray-800/60 border border-gray-700">
            {showWeek ? week.length : today.length}
          </span>
        </div>
        <button
          onClick={() => setShowWeek(!showWeek)}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          {showWeek ? 'Show today' : 'Show week'}
        </button>
      </div>

      {!showWeek ? (
        today.length > 0 ? (
          <div className="space-y-2">
            {today.map((e) => (
              <CalendarEventRow key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <EmptyBucket label="meetings today" />
        )
      ) : (
        Object.keys(weekByDay).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(weekByDay).map(([day, events]) => (
              <div key={day}>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                  {day}
                </div>
                <div className="space-y-2">
                  {events.map((e) => (
                    <CalendarEventRow key={e.id} event={e} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBucket label="meetings this week" />
        )
      )}
    </section>
  );
}

// ============================================================================
// Email Pulse Section
// ============================================================================

function extractSenderName(from: string): string {
  // "John Doe <john@example.com>" → "John Doe"
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  // "john@example.com" → "john"
  return from.split('@')[0];
}

function EmailRow({ email }: { email: EmailDigest }) {
  const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${email.threadId}`;
  return (
    <a
      href={gmailUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 px-4 py-3 rounded-lg border border-gray-800 hover:border-purple-800/50 hover:bg-purple-950/20 transition-all"
    >
      <div className="flex-shrink-0 pt-0.5">
        {email.isStarred ? (
          <Star size={14} className="text-yellow-400 fill-yellow-400" />
        ) : (
          <Mail size={14} className="text-gray-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-100 group-hover:text-white truncate">
          {email.subject || '(No subject)'}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <span className="truncate">{extractSenderName(email.from)}</span>
          {email.date && (
            <>
              <span className="text-gray-700">&middot;</span>
              <span className="flex-shrink-0">
                {new Date(email.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </>
          )}
        </div>
      </div>
      <ExternalLink size={13} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0 mt-1" />
    </a>
  );
}

function EmailPulseSection({ starred, needsReply, unreadCount }: {
  starred: EmailDigest[];
  needsReply: EmailDigest[];
  unreadCount: number;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Mail size={18} className="text-purple-400" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-purple-400">Email Pulse</h3>
        {unreadCount > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-purple-400 bg-gray-800/60 border border-gray-700">
            {unreadCount} unread
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Starred / flagged */}
        {starred.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-yellow-400/70 uppercase tracking-wide mb-2 px-1 flex items-center gap-1">
              <Star size={11} className="fill-yellow-400/70" />
              Starred
            </div>
            <div className="space-y-2">
              {starred.map((e) => (
                <EmailRow key={e.id} email={e} />
              ))}
            </div>
          </div>
        )}

        {/* Needs reply */}
        {needsReply.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1 flex items-center gap-1">
              <Inbox size={11} />
              Needs Attention
            </div>
            <div className="space-y-2">
              {needsReply.map((e) => (
                <EmailRow key={e.id} email={e} />
              ))}
            </div>
          </div>
        )}

        {starred.length === 0 && needsReply.length === 0 && (
          <EmptyBucket label="flagged emails" />
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SummaryClient({ companyId, companyName }: SummaryClientProps) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/os/tasks/summary?companyId=${encodeURIComponent(companyId)}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const generatedLabel = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link
            href={`/c/${companyId}/tasks`}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft size={12} />
            Back to Tasks
          </Link>
          <h2 className="text-xl font-bold text-gray-100">Daily Summary</h2>
          {generatedLabel && (
            <p className="text-xs text-gray-500 mt-0.5">{generatedLabel}</p>
          )}
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Overdue" value={data.counts.overdue} color="text-red-400" borderColor="border-red-900" bgColor="bg-red-950/40" />
          <StatCard label="Hot (P0)" value={data.counts.hot} color="text-orange-400" borderColor="border-orange-900" bgColor="bg-orange-950/40" />
          <StatCard label="Due Today" value={data.counts.dueToday} color="text-amber-400" borderColor="border-amber-900" bgColor="bg-amber-950/40" />
          <StatCard label="Total Open" value={data.counts.totalOpen} color="text-gray-300" borderColor="border-gray-700" bgColor="bg-gray-800/40" />
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
          <RefreshCw size={16} className="animate-spin mr-2" />
          Loading summary...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="border border-red-800 bg-red-950/30 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Content sections */}
      {data && (
        <div className="space-y-8">
          {/* ── Calendar ──────────────────────────────────────────────── */}
          {data.googleConnected ? (
            <CalendarSection today={data.calendar.today} week={data.calendar.week} />
          ) : (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-blue-400">Schedule</h3>
              </div>
              <div className="px-4 py-6 text-center text-gray-600 text-sm border border-dashed border-gray-800 rounded-lg">
                Connect Google in Settings to see your calendar here
              </div>
            </section>
          )}

          {/* ── Email Pulse ───────────────────────────────────────────── */}
          {data.googleConnected ? (
            <EmailPulseSection
              starred={data.emailPulse.starred}
              needsReply={data.emailPulse.needsReply}
              unreadCount={data.emailPulse.unreadCount}
            />
          ) : (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Mail size={18} className="text-purple-400" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-purple-400">Email Pulse</h3>
              </div>
              <div className="px-4 py-6 text-center text-gray-600 text-sm border border-dashed border-gray-800 rounded-lg">
                Connect Google in Settings to see your email pulse here
              </div>
            </section>
          )}

          {/* ── Overdue ───────────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={AlertTriangle} label="Overdue" count={data.counts.overdue} color="text-red-400" />
            {data.overdue.length > 0 ? (
              <div className="space-y-2">
                {data.overdue.map(t => <TaskRow key={t.id} task={t} companyId={companyId} />)}
              </div>
            ) : (
              <EmptyBucket label="overdue tasks" />
            )}
          </section>

          {/* ── Hot (P0) ──────────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={Flame} label="Hot (P0)" count={data.counts.hot} color="text-orange-400" />
            {data.hot.length > 0 ? (
              <div className="space-y-2">
                {data.hot.map(t => <TaskRow key={t.id} task={t} companyId={companyId} />)}
              </div>
            ) : (
              <EmptyBucket label="hot tasks" />
            )}
          </section>

          {/* ── Due Today ─────────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={CalendarClock} label="Due Today" count={data.counts.dueToday} color="text-amber-400" />
            {data.dueToday.length > 0 ? (
              <div className="space-y-2">
                {data.dueToday.map(t => <TaskRow key={t.id} task={t} companyId={companyId} />)}
              </div>
            ) : (
              <EmptyBucket label="tasks due today" />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
