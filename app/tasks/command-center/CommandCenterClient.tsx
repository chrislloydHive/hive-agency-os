'use client';
// app/tasks/command-center/CommandCenterClient.tsx
// Chief of Staff AI — Daily Command Center UI

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Flame, Target, Calendar, Clock, FileText,
  ChevronRight, Zap, Link2, RefreshCw, Archive, ChevronDown,
} from 'lucide-react';

// ============================================================================
// Types (mirror server response)
// ============================================================================

interface WorkItem {
  id: string;
  source: 'airtable' | 'calendar' | 'drive' | 'gmail';
  type: 'task' | 'event' | 'doc' | 'email';
  title: string;
  description?: string;
  dueDate?: string | null;
  lastActivity?: string | null;
  owner?: string;
  status?: string;
  priority?: string | null;
  project?: string;
  links: { label: string; url: string }[];
  score?: number;
  scoreBreakdown?: { urgency: number; importance: number; risk: number; momentum: number };
  relatedIds?: string[];
  flags?: string[];
  suggestedAction?: { label: string; effort: 'quick' | 'short' | 'deep'; when: 'now' | 'today' | 'thisWeek' };
}

interface CommandCenterData {
  topPriorities: WorkItem[];
  fires: WorkItem[];
  thisWeek: WorkItem[];
  waitingOn: WorkItem[];
  upcomingMeetings: WorkItem[];
  recentActivity: WorkItem[];
  stale: WorkItem[];
  counts: Record<string, number>;
  googleConnected: boolean;
  googleError?: string | null;
  sources: { tasks: number; events: number; docs: number };
  generatedAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

function airtableIdOf(workId: string): string | null {
  const [src, id] = workId.split(':');
  return src === 'airtable' ? id : null;
}

function formatDue(d?: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  const now = new Date();
  const diffDays = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatEventTime(d?: string | null): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${time}`;
}

function effortColor(effort?: string) {
  if (effort === 'quick') return 'text-green-400 bg-green-400/10';
  if (effort === 'short') return 'text-blue-400 bg-blue-400/10';
  if (effort === 'deep') return 'text-purple-400 bg-purple-400/10';
  return 'text-gray-400 bg-gray-400/10';
}

// ============================================================================
// UI pieces
// ============================================================================

function SectionHeader({ icon: Icon, label, count, color }: { icon: React.ComponentType<{ className?: string }>; label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-4 h-4 ${color}`} />
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">{label}</h2>
      <span className="text-xs text-gray-500">({count})</span>
    </div>
  );
}

function FlagBadge({ flag }: { flag: string }) {
  const styles: Record<string, string> = {
    overdue: 'bg-red-500/20 text-red-300 border-red-500/30',
    hot: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    blocked: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    idle: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    'no-prep': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  };
  return (
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${styles[flag] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
      {flag}
    </span>
  );
}

function WorkItemRow({
  item, backUrl, showAction = false, showDue = true,
}: { item: WorkItem; backUrl: string; showAction?: boolean; showDue?: boolean }) {
  const aId = airtableIdOf(item.id);
  const due = formatDue(item.dueDate);
  const isOverdue = item.flags?.includes('overdue');
  const href = aId ? `${backUrl}?task=${aId}` : (item.links[0]?.url || '#');
  const external = !aId && item.links[0]?.url;

  const content = (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 group">
      {item.priority && (
        <span className={`text-[10px] font-bold mt-0.5 ${item.priority === 'P0' ? 'text-red-400' : item.priority === 'P1' ? 'text-orange-400' : 'text-gray-500'}`}>
          {item.priority}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-100 truncate">{item.title}</span>
          {item.flags?.map(f => <FlagBadge key={f} flag={f} />)}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
          {item.project && <span>{item.project}</span>}
          {item.project && due && <span>·</span>}
          {showDue && due && <span className={isOverdue ? 'text-red-400' : ''}>{due}</span>}
          {item.relatedIds && item.relatedIds.length > 0 && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5"><Link2 className="w-3 h-3" />{item.relatedIds.length} linked</span>
            </>
          )}
        </div>
        {showAction && item.suggestedAction && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${effortColor(item.suggestedAction.effort)}`}>
              {item.suggestedAction.effort}
            </span>
            <span className="text-xs text-gray-400">→ {item.suggestedAction.label}</span>
          </div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 mt-1 flex-shrink-0" />
    </div>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noreferrer">{content}</a>;
  }
  return <Link href={href}>{content}</Link>;
}

function MeetingRow({ item, backUrl }: { item: WorkItem; backUrl: string }) {
  const time = formatEventTime(item.dueDate);
  const noPrep = item.flags?.includes('no-prep');
  const href = item.links[0]?.url || '#';

  return (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 group">
        <Calendar className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-100 truncate">{item.title}</span>
            {noPrep && <FlagBadge flag="no-prep" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
            <span>{time}</span>
            {item.relatedIds && item.relatedIds.length > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5"><Link2 className="w-3 h-3" />{item.relatedIds.length} linked</span>
              </>
            )}
          </div>
          {noPrep && (
            <div className="text-xs text-amber-400/80 mt-1">No prep docs or tasks found — add context before meeting</div>
          )}
        </div>
      </div>
    </a>
  );
}

function DocRow({ item }: { item: WorkItem }) {
  const ago = item.lastActivity ? formatDue(item.lastActivity) : '';
  return (
    <a href={item.links[0]?.url || '#'} target="_blank" rel="noreferrer" className="block">
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200 truncate">{item.title}</div>
          <div className="text-xs text-gray-500">{item.owner ? `${item.owner} · ` : ''}{ago}</div>
        </div>
      </div>
    </a>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function CommandCenterClient({ companyId, backUrl = '/tasks' }: { companyId: string; backUrl?: string }) {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [staleOpen, setStaleOpen] = useState(false);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/os/command-center?companyId=${companyId}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading command center...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center justify-center">
        <div className="text-red-400 text-sm">{error || 'No data'}</div>
      </div>
    );
  }

  const empty = data.counts.topPriorities + data.counts.fires + data.counts.thisWeek + data.counts.waitingOn + data.counts.upcomingMeetings === 0;
  const onlyStale = empty && (data.counts.stale || 0) > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href={backUrl} className="text-gray-500 hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Command Center</h1>
              <p className="text-xs text-gray-500">
                {new Date(data.generatedAt).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {!data.googleConnected && <span className="text-amber-400"> · Google not connected</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded border border-white/10 hover:border-white/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        {/* Data sources strip — always visible so you can see what's feeding this */}
        <div className="mb-6 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-gray-500">Pulling from:</span>
          <span className={`px-2 py-0.5 rounded border ${data.sources.tasks > 0 ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5' : 'border-white/10 text-gray-500'}`}>
            Airtable · {data.sources.tasks} tasks
          </span>
          <span className={`px-2 py-0.5 rounded border ${data.sources.events > 0 ? 'border-blue-500/30 text-blue-300 bg-blue-500/5' : data.googleConnected ? 'border-white/10 text-gray-500' : 'border-amber-500/30 text-amber-300 bg-amber-500/5'}`}>
            Calendar · {data.sources.events} events
          </span>
          <span className={`px-2 py-0.5 rounded border ${data.sources.docs > 0 ? 'border-sky-500/30 text-sky-300 bg-sky-500/5' : data.googleConnected ? 'border-white/10 text-gray-500' : 'border-amber-500/30 text-amber-300 bg-amber-500/5'}`}>
            Drive · {data.sources.docs} docs
          </span>
          {!data.googleConnected && (
            <span className="text-amber-400 ml-2">
              Google not connected{data.googleError ? ` — ${data.googleError}` : ''}
            </span>
          )}
        </div>

        {empty && !onlyStale && (
          <div className="text-center py-12 text-gray-500 text-sm">
            Inbox zero. No priorities, fires, or meetings to surface.
          </div>
        )}
        {onlyStale && (
          <div className="mb-8 p-4 rounded border border-amber-500/30 bg-amber-500/5 text-sm text-amber-200">
            All {data.counts.stale} active tasks are overdue by 90+ days. Either they&rsquo;re abandoned (close them out) or their due dates need updating. Expand <strong>Stale Backlog</strong> below to triage.
          </div>
        )}

        {/* Fires */}
        {data.fires.length > 0 && (
          <section className="mb-8">
            <SectionHeader icon={Flame} label="Fires" count={data.fires.length} color="text-red-400" />
            <div className="space-y-1 border-l-2 border-red-500/40 pl-2">
              {data.fires.map(item => <WorkItemRow key={item.id} item={item} backUrl={backUrl} showAction />)}
            </div>
          </section>
        )}

        {/* Top Priorities */}
        {data.topPriorities.length > 0 && (
          <section className="mb-8">
            <SectionHeader icon={Target} label="Top 3 Today" count={data.topPriorities.length} color="text-emerald-400" />
            <div className="space-y-1">
              {data.topPriorities.map(item => <WorkItemRow key={item.id} item={item} backUrl={backUrl} showAction />)}
            </div>
          </section>
        )}

        {/* Upcoming Meetings — always show section if Google is connected */}
        {data.googleConnected && (
          <section className="mb-8">
            <SectionHeader icon={Calendar} label="Meetings This Week" count={data.upcomingMeetings.length} color="text-blue-400" />
            {data.upcomingMeetings.length > 0 ? (
              <div className="space-y-1">
                {data.upcomingMeetings.map(item => <MeetingRow key={item.id} item={item} backUrl={backUrl} />)}
              </div>
            ) : (
              <p className="text-xs text-gray-500 ml-6">No events in the next 7 days.</p>
            )}
          </section>
        )}

        {/* Waiting On */}
        {data.waitingOn.length > 0 && (
          <section className="mb-8">
            <SectionHeader icon={Clock} label="Waiting On" count={data.waitingOn.length} color="text-yellow-400" />
            <div className="space-y-1">
              {data.waitingOn.map(item => <WorkItemRow key={item.id} item={item} backUrl={backUrl} showAction />)}
            </div>
          </section>
        )}

        {/* This Week */}
        {data.thisWeek.length > 0 && (
          <section className="mb-8">
            <SectionHeader icon={Zap} label="This Week" count={data.thisWeek.length} color="text-sky-400" />
            <div className="space-y-1">
              {data.thisWeek.map(item => <WorkItemRow key={item.id} item={item} backUrl={backUrl} />)}
            </div>
          </section>
        )}

        {/* Stale (>90d overdue) — collapsed by default */}
        {data.stale && data.stale.length > 0 && (
          <section className="mb-8">
            <button
              onClick={() => setStaleOpen(o => !o)}
              className="flex items-center gap-2 mb-3 text-gray-500 hover:text-gray-300 w-full"
            >
              <Archive className="w-4 h-4" />
              <h2 className="text-sm font-semibold uppercase tracking-wide">Stale Backlog</h2>
              <span className="text-xs">({data.stale.length})</span>
              <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${staleOpen ? 'rotate-180' : ''}`} />
            </button>
            {!staleOpen && (
              <p className="text-xs text-gray-600 ml-6">
                {data.stale.length} tasks overdue 90+ days. Likely abandoned — expand to review, close out, or reschedule.
              </p>
            )}
            {staleOpen && (
              <div className="space-y-1 opacity-60">
                {data.stale.map(item => <WorkItemRow key={item.id} item={item} backUrl={backUrl} />)}
              </div>
            )}
          </section>
        )}

        {/* Recent Activity — always show if Google connected */}
        {data.googleConnected && (
          <section className="mb-8">
            <SectionHeader icon={FileText} label="Recently Active" count={data.recentActivity.length} color="text-gray-400" />
            {data.recentActivity.length > 0 ? (
              <div className="space-y-1">
                {data.recentActivity.slice(0, 8).map(item => <DocRow key={item.id} item={item} />)}
              </div>
            ) : (
              <p className="text-xs text-gray-500 ml-6">No Drive activity in the last 7 days.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
