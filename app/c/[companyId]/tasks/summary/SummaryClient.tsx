'use client';

// app/c/[companyId]/tasks/summary/SummaryClient.tsx
// Daily Summary — 100% Task-backed.
// Source of truth: Airtable Tasks table ONLY.
// Calendar / Gmail / Drive context lives in Command Center; Daily Summary is
// a pure read of Tasks so every row here can be traced to a task you can work.

import { useState, useEffect } from 'react';
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
  Globe,
  DollarSign,
  Target,
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

interface SummaryData {
  overdue: TaskRecord[];
  hot: TaskRecord[];
  dueToday: TaskRecord[];
  webLeads: TaskRecord[];
  arAging: TaskRecord[];
  counts: {
    overdue: number;
    hot: number;
    dueToday: number;
    totalOpen: number;
    webLeads: number;
    arAging: number;
  };
  generatedAt: string;
}

interface SummaryClientProps {
  companyId: string;
  companyName: string;
  backUrl?: string; // Override the "My Day" back link (defaults to /c/{companyId}/tasks)
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
    <div className={`flex flex-col items-center px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border ${borderColor} ${bgColor}`}>
      <span className={`text-lg sm:text-xl font-bold ${color}`}>{value}</span>
      <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ============================================================================
// Task Row
// ============================================================================

function TaskRow({ task, companyId, backUrl }: { task: TaskRecord; companyId: string; backUrl?: string }) {
  const baseUrl = backUrl || `/c/${companyId}/tasks`;
  return (
    <div className="group flex items-start gap-3 px-4 py-3 rounded-lg border border-gray-800 hover:border-gray-600 hover:bg-gray-800/40 transition-all">
      <div className="flex-shrink-0 pt-0.5">
        <PriorityDot pri={task.priority} />
      </div>
      <Link href={`${baseUrl}?task=${task.id}`} className="flex-1 min-w-0 cursor-pointer">
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
      </Link>
      <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
        <LinkIcon url={task.threadUrl} icon={ExternalLink} color="text-blue-400" title="Email thread" />
        <LinkIcon url={task.draftUrl} icon={FileText} color="text-green-400" title="Draft" />
        <LinkIcon url={task.attachUrl} icon={Paperclip} color="text-purple-400" title="Attachment" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SummaryClient({ companyId, companyName: _companyName, backUrl }: SummaryClientProps) {
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
    <div className="min-h-screen">
      {/* Header bar — matches My Day top bar */}
      <div className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">DAILY SUMMARY</h1>
              {generatedLabel && (
                <p className="text-xs text-gray-500 mt-0.5">{generatedLabel} &middot; Tasks only</p>
              )}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <Link
              href={backUrl || `/c/${companyId}/tasks`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-lg hover:bg-amber-950/60 transition-colors"
            >
              <ArrowLeft size={13} />
              My Day
            </Link>
            <Link
              href="/tasks/command-center"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-lg hover:bg-emerald-950/60 transition-colors"
            >
              <Target size={13} />
              Command Center
            </Link>
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          {/* Mobile */}
          <div className="flex sm:hidden items-center gap-2">
            <Link
              href={backUrl || `/c/${companyId}/tasks`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-lg"
            >
              <ArrowLeft size={12} />
              My Day
            </Link>
            <Link
              href="/tasks/command-center"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-lg"
            >
              <Target size={12} />
              CC
            </Link>
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards — compact row */}
      {data && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-2">
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <StatCard label="Overdue" value={data.counts.overdue} color="text-red-400" borderColor="border-red-900" bgColor="bg-red-950/40" />
            <StatCard label="Hot (P0)" value={data.counts.hot} color="text-orange-400" borderColor="border-orange-900" bgColor="bg-orange-950/40" />
            <StatCard label="Due Today" value={data.counts.dueToday} color="text-amber-400" borderColor="border-amber-900" bgColor="bg-amber-950/40" />
            <StatCard label="Total Open" value={data.counts.totalOpen} color="text-gray-300" borderColor="border-gray-700" bgColor="bg-gray-800/40" />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-6">

      {/* Source-of-truth callout */}
      <div className="text-xs text-gray-500 border border-gray-800 bg-gray-900/40 rounded-lg px-4 py-2">
        Everything on this page is a row in your <Link href={backUrl || `/c/${companyId}/tasks`} className="text-gray-300 underline underline-offset-2 hover:text-white">Tasks</Link> table.
        Calendar, email, and Drive activity live in the <Link href="/tasks/command-center" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">Command Center</Link>.
      </div>

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
          {/* ── Web Leads ────────────────────────────────────────────── */}
          {data.webLeads && data.webLeads.length > 0 && (
            <section>
              <SectionHeader icon={Globe} label="Web Leads" count={data.counts.webLeads} color="text-emerald-400" />
              <div className="space-y-2">
                {data.webLeads.map(t => <TaskRow key={t.id} task={t} companyId={companyId} backUrl={backUrl} />)}
              </div>
            </section>
          )}

          {/* ── A/R Aging ────────────────────────────────────────────── */}
          {data.arAging && data.arAging.length > 0 && (
            <section>
              <SectionHeader icon={DollarSign} label="A/R Aging" count={data.counts.arAging} color="text-green-400" />
              <div className="space-y-2">
                {data.arAging.map(t => <TaskRow key={t.id} task={t} companyId={companyId} backUrl={backUrl} />)}
              </div>
            </section>
          )}

          {/* ── Overdue ───────────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={AlertTriangle} label="Overdue" count={data.counts.overdue} color="text-red-400" />
            {data.overdue.length > 0 ? (
              <div className="space-y-2">
                {data.overdue.map(t => <TaskRow key={t.id} task={t} companyId={companyId} backUrl={backUrl} />)}
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
                {data.hot.map(t => <TaskRow key={t.id} task={t} companyId={companyId} backUrl={backUrl} />)}
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
                {data.dueToday.map(t => <TaskRow key={t.id} task={t} companyId={companyId} backUrl={backUrl} />)}
              </div>
            ) : (
              <EmptyBucket label="tasks due today" />
            )}
          </section>
        </div>
      )}

      </div>{/* end max-w-7xl content wrapper */}
    </div>
  );
}
