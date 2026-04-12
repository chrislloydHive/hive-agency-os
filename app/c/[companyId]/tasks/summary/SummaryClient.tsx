'use client';

// app/c/[companyId]/tasks/summary/SummaryClient.tsx
// Daily Summary — Overdue · Hot · Due Today
// Source of truth: Airtable Tasks table via /api/os/tasks/summary

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
} from 'lucide-react';

// ============================================================================
// Types (mirroring lib/airtable/tasks.ts TaskRecord)
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
  counts: {
    overdue: number;
    hot: number;
    dueToday: number;
    totalOpen: number;
  };
  generatedAt: string;
}

interface SummaryClientProps {
  companyId: string;
  companyName: string;
}

// ============================================================================
// Priority / status colors (consistent with TasksClient)
// ============================================================================

const PRI_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  P0: { bg: 'bg-red-950', text: 'text-red-400', border: 'border-red-800', dot: 'bg-red-500' },
  P1: { bg: 'bg-orange-950', text: 'text-orange-400', border: 'border-orange-800', dot: 'bg-orange-400' },
  P2: { bg: 'bg-yellow-950', text: 'text-yellow-400', border: 'border-yellow-800', dot: 'bg-yellow-400' },
  P3: { bg: 'bg-green-950', text: 'text-green-400', border: 'border-green-800', dot: 'bg-green-400' },
};

// ============================================================================
// Sub-components
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
       className={`${color} hover:opacity-70 transition-opacity p-0.5`}>
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

function TaskRow({ task, companyId }: { task: TaskRecord; companyId: string }) {
  return (
    <Link
      href={`/c/${companyId}/tasks`}
      className="group flex items-start gap-3 px-4 py-3 rounded-lg border border-gray-800 hover:border-gray-600 hover:bg-gray-800/40 transition-all cursor-pointer"
    >
      {/* Priority pill */}
      <div className="flex-shrink-0 pt-0.5">
        <PriorityDot pri={task.priority} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-100 group-hover:text-white transition-colors truncate">
          {task.task}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
          {task.nextAction}
        </p>
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

      {/* Quick-action links */}
      <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
        <LinkIcon url={task.threadUrl} icon={ExternalLink} color="text-blue-400" title="Email thread" />
        <LinkIcon url={task.draftUrl} icon={FileText} color="text-green-400" title="Draft" />
        <LinkIcon url={task.attachUrl} icon={Paperclip} color="text-purple-400" title="Attachment" />
      </div>
    </Link>
  );
}

function EmptyBucket({ label }: { label: string }) {
  return (
    <div className="px-4 py-6 text-center text-gray-600 text-sm border border-dashed border-gray-800 rounded-lg">
      No {label.toLowerCase()} tasks right now
    </div>
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
      const res = await fetch('/api/os/tasks/summary');
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
  }, []);

  // Format the timestamp
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
          Loading summary from Airtable...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="border border-red-800 bg-red-950/30 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Sections */}
      {data && (
        <div className="space-y-8">
          {/* Overdue */}
          <section>
            <SectionHeader icon={AlertTriangle} label="Overdue" count={data.counts.overdue} color="text-red-400" />
            {data.overdue.length > 0 ? (
              <div className="space-y-2">
                {data.overdue.map(t => <TaskRow key={t.id} task={t} companyId={companyId} />)}
              </div>
            ) : (
              <EmptyBucket label="overdue" />
            )}
          </section>

          {/* Hot (P0) */}
          <section>
            <SectionHeader icon={Flame} label="Hot (P0)" count={data.counts.hot} color="text-orange-400" />
            {data.hot.length > 0 ? (
              <div className="space-y-2">
                {data.hot.map(t => <TaskRow key={t.id} task={t} companyId={companyId} />)}
              </div>
            ) : (
              <EmptyBucket label="hot" />
            )}
          </section>

          {/* Due Today */}
          <section>
            <SectionHeader icon={CalendarClock} label="Due Today" count={data.counts.dueToday} color="text-amber-400" />
            {data.dueToday.length > 0 ? (
              <div className="space-y-2">
                {data.dueToday.map(t => <TaskRow key={t.id} task={t} companyId={companyId} />)}
              </div>
            ) : (
              <EmptyBucket label="due today" />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stat Card
// ============================================================================

function StatCard({ label, value, color, borderColor, bgColor }: { label: string; value: number; color: string; borderColor: string; bgColor: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-lg border ${borderColor} ${bgColor}`}>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-0.5">{label}</span>
    </div>
  );
}
