'use client';
// app/tasks/command-center/CommandCenterClient.tsx
// Chief of Staff AI — Daily Command Center UI

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TaskEditPanel } from './TaskEditPanel';
// FocusStrip and RiskStrip removed — Morning Brief covers focus + risks inline.
// Components still exist if we ever want to re-enable them.
import { MorningBrief } from './MorningBrief';
import { CommandBar } from './CommandBar';
import {
  ArrowLeft, Flame, Calendar, Clock, FileText,
  ChevronRight, Zap, Link2, RefreshCw, Archive, ChevronDown,
  Inbox, Eye, FolderKanban, MessageSquare, Users, BarChart3, ExternalLink,
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

interface FollowUpItem {
  id: string;
  title: string;
  when: string;
  attendees: string[];
  externalCount: number;
  daysSince: number;
  link?: string;
  score: number;
}
interface ReviewQueueItem {
  id: string;
  title: string;
  lastModified: string;
  modifiedBy: string;
  link?: string;
  daysSinceViewed: number | null;
  daysSinceModified: number;
  score: number;
}
interface InProgressCluster {
  id: string;
  label: string;
  docCount: number;
  lastModified: string;
  docs: { id: string; title: string; link?: string; modifiedTime: string }[];
  score: number;
  folderLink?: string;
  folderName?: string;
}
interface CommitmentItem {
  id: string;
  phrase: string;
  to: string;
  subject: string;
  sentAt: string;
  link: string;
  deadline: string | null;
  score: number;
}

interface CommandCenterData {
  topPriorities: WorkItem[];
  fires: WorkItem[];
  thisWeek: WorkItem[];
  waitingOn: WorkItem[];
  upcomingMeetings: WorkItem[];
  recentActivity: WorkItem[];
  stale: WorkItem[];
  followUps?: FollowUpItem[];
  reviewQueue?: ReviewQueueItem[];
  inProgress?: InProgressCluster[];
  commitments?: CommitmentItem[];
  triage?: TriageItem[];
  counts: Record<string, number>;
  googleConnected: boolean;
  googleError?: string | null;
  myEmail?: string | null;
  sources: { tasks: number; events: number; pastEvents?: number; docs: number; sent?: number; triage?: number };
  generatedAt: string;
}

export interface TriageItem {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  from: string;
  fromName: string;
  fromEmail: string;
  fromDomain: string;
  date: string;
  unread: boolean;
  starred: boolean;
  important: boolean;
  matchedReason: string;
  link: string;
  hasExistingTask: boolean;
  score?: number;
  scoreReasons?: string[];
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

function formatAgo(d?: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  const now = new Date();
  const diffDays = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays <= 7) return `${diffDays}d ago`;
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
  item, backUrl, showAction = false, showDue = true, onEdit,
}: { item: WorkItem; backUrl: string; showAction?: boolean; showDue?: boolean; onEdit?: (airtableId: string) => void }) {
  const aId = airtableIdOf(item.id);
  const due = formatDue(item.dueDate);
  const isOverdue = item.flags?.includes('overdue');
  const href = aId ? `${backUrl}?task=${aId}` : (item.links[0]?.url || '#');
  const external = !aId && item.links[0]?.url;
  const canEdit = !!aId && !!onEdit;

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

  if (canEdit && aId) {
    return (
      <button
        type="button"
        onClick={() => onEdit!(aId)}
        className="w-full text-left"
      >
        {content}
      </button>
    );
  }
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
  const ago = item.lastActivity ? formatAgo(item.lastActivity) : '';
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

function FollowUpRow({ item }: { item: FollowUpItem }) {
  const when = item.daysSince === 0 ? 'today' : item.daysSince === 1 ? 'yesterday' : `${item.daysSince}d ago`;
  const shortAttendees = item.attendees.slice(0, 2).map(a => a.split('@')[0]).join(', ');
  const more = item.attendees.length > 2 ? ` +${item.attendees.length - 2}` : '';
  return (
    <a href={item.link || '#'} target="_blank" rel="noreferrer" className="block">
      <div className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors border-l-2 border-orange-500/30">
        <Users className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200 truncate">{item.title}</div>
          <div className="text-xs text-gray-500">
            {when} · with {shortAttendees}{more}
          </div>
          <div className="text-xs text-orange-300/80 mt-1">→ Follow up — no task logged yet</div>
        </div>
      </div>
    </a>
  );
}

function ReviewRow({ item }: { item: ReviewQueueItem }) {
  const modAgo = item.daysSinceModified === 0 ? 'today' : item.daysSinceModified === 1 ? 'yesterday' : `${item.daysSinceModified}d ago`;
  const viewedLabel = item.daysSinceViewed === null ? 'never opened' : `you viewed ${item.daysSinceViewed}d ago`;
  return (
    <a href={item.link || '#'} target="_blank" rel="noreferrer" className="block">
      <div className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <Eye className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200 truncate">{item.title}</div>
          <div className="text-xs text-gray-500">
            {item.modifiedBy} edited {modAgo} · {viewedLabel}
          </div>
        </div>
      </div>
    </a>
  );
}

function ProjectRow({ item }: { item: InProgressCluster }) {
  const lastAgo = formatAgo(item.lastModified);
  return (
    <div className="py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-3">
        <FolderKanban className="w-4 h-4 text-teal-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {item.folderLink ? (
              <a href={item.folderLink} target="_blank" rel="noreferrer" className="text-sm text-gray-200 hover:text-teal-300 truncate transition-colors">
                {item.label}
              </a>
            ) : (
              <div className="text-sm text-gray-200 truncate">{item.label}</div>
            )}
            {item.folderLink && (
              <a href={item.folderLink} target="_blank" rel="noreferrer"
                className="shrink-0 p-0.5 rounded hover:bg-white/10 text-gray-600 hover:text-teal-300 transition-colors"
                title="Open project folder in Drive"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="text-xs text-gray-500">{item.docCount} doc{item.docCount === 1 ? '' : 's'} · last edit {lastAgo}</div>
        </div>
      </div>
      <div className="mt-1 ml-7 space-y-0.5">
        {item.docs.slice(0, 3).map(d => (
          <a key={d.id} href={d.link || '#'} target="_blank" rel="noreferrer" className="block text-xs text-gray-400 hover:text-gray-200 truncate">
            · {d.title}
          </a>
        ))}
        {item.docs.length < item.docCount && (
          <div className="text-xs text-gray-600">· +{item.docCount - item.docs.length} more</div>
        )}
      </div>
    </div>
  );
}

function CommitmentRow({ item }: { item: CommitmentItem }) {
  const sent = new Date(item.sentAt);
  const daysSince = Math.round((Date.now() - sent.getTime()) / (1000 * 60 * 60 * 24));
  const sentLabel = daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince}d ago`;
  const toShort = item.to.split(',')[0].replace(/<.*$/, '').trim().split('@')[0].slice(0, 40);
  return (
    <a href={item.link || '#'} target="_blank" rel="noreferrer" className="block">
      <div className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors border-l-2 border-amber-500/30">
        <MessageSquare className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200 italic">&ldquo;{item.phrase}&rdquo;</div>
          <div className="text-xs text-gray-500 mt-0.5">
            to {toShort} · {sentLabel}
            {item.deadline && <span className="text-amber-300/80"> · promised {item.deadline}</span>}
          </div>
        </div>
      </div>
    </a>
  );
}

// Triage row — email needing attention with inline Create Task / Draft Reply
function TriageRow({ item, onTask, onDraft, busyAction }: {
  item: TriageItem;
  onTask: (item: TriageItem) => void;
  onDraft: (item: TriageItem) => void;
  busyAction: { id: string; action: 'task' | 'draft' } | null;
}) {
  const dateLabel = formatAgo(item.date) || '';
  const taskBusy = busyAction?.id === item.id && busyAction?.action === 'task';
  const draftBusy = busyAction?.id === item.id && busyAction?.action === 'draft';
  const reasonColor =
    item.matchedReason === 'Key sender' ? 'text-purple-300 bg-purple-500/10' :
    item.matchedReason === 'Finance keyword' ? 'text-amber-300 bg-amber-500/10' :
    item.matchedReason === 'Starred/Important' ? 'text-yellow-300 bg-yellow-500/10' :
    'text-sky-300 bg-sky-500/10';
  return (
    <div className="py-2 border-b border-white/5 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${reasonColor}`}>{item.matchedReason}</span>
            {item.hasExistingTask && (
              <span className="text-[10px] px-1.5 py-0.5 rounded text-gray-400 bg-gray-500/10">Task exists</span>
            )}
            <span className="text-xs text-gray-500">{item.fromName || item.fromEmail}</span>
            <span className="text-xs text-gray-600">· {dateLabel}</span>
          </div>
          <div className="text-sm text-gray-200 mt-0.5 truncate">{item.subject}</div>
          {item.snippet && (
            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.snippet}</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded border border-white/5 hover:border-white/20"
            title="Open in Gmail"
          >
            <Link2 className="w-3 h-3" />
          </a>
          <button
            onClick={() => onTask(item)}
            disabled={taskBusy}
            className="text-xs text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded disabled:opacity-50 whitespace-nowrap"
          >
            {taskBusy ? '…' : '+ Task'}
          </button>
          <button
            onClick={() => onDraft(item)}
            disabled={draftBusy}
            className="text-xs text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-1 rounded disabled:opacity-50 whitespace-nowrap"
          >
            {draftBusy ? '…' : 'Draft reply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tile wrapper — gives each section a card look in the dashboard grid
function Tile({
  icon: Icon, label, count, color, accent, children, fullWidth = false, subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  color: string;
  accent?: string;    // left border tailwind class, e.g. 'border-l-red-500/50'
  children: React.ReactNode;
  fullWidth?: boolean;
  subtitle?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-white/[0.02] border border-white/5 ${accent ? `border-l-4 ${accent}` : ''} p-4 ${fullWidth ? 'lg:col-span-2' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <h2 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">{label}</h2>
        <span className="text-xs text-gray-500">({count})</span>
      </div>
      {subtitle && <p className="text-xs text-gray-500 mb-2">{subtitle}</p>}
      {children}
    </div>
  );
}

function ShowMore({ total, shown, onClick }: { total: number; shown: number; onClick: () => void }) {
  if (total <= shown) return null;
  const remaining = total - shown;
  return (
    <button
      onClick={onClick}
      className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors ml-3"
    >
      + {remaining} more
    </button>
  );
}

function ShowLess({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors ml-3">
      show less
    </button>
  );
}

// ============================================================================
// Relative time display — self-updating "5s ago" / "2m ago" etc.
// ============================================================================
function RelativeTime({ date }: { date: Date }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (secs < 60) return <>{secs}s ago</>;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return <>{mins}m ago</>;
  const hrs = Math.floor(mins / 60);
  return <>{hrs}h ago</>;
}

// ============================================================================
// Main component
// ============================================================================

export function CommandCenterClient({ companyId, backUrl = '/tasks' }: { companyId: string; backUrl?: string }) {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scanDurationMs, setScanDurationMs] = useState<number | null>(null);
  const [scanCompletedAt, setScanCompletedAt] = useState<Date | null>(null);
  const [scanStep, setScanStep] = useState<number>(0); // 0=idle, 1..5 = animating through sources
  const [staleOpen, setStaleOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setExpanded(e => ({ ...e, [k]: !e[k] }));
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [createFromEmail, setCreateFromEmail] = useState<{ prefill: Record<string, unknown>; emailMeta: { threadId: string; messageId: string; link: string } } | null>(null);
  const [triageBusy, setTriageBusy] = useState<{ id: string; action: 'task' | 'draft' } | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);
  // Optimistic capture: items the user has already "Task'd" in this session.
  // Tracked by messageId so the row disappears from Needs Triage immediately,
  // before the next Airtable refresh propagates `hasExistingTask`.
  const [hiddenTriageIds, setHiddenTriageIds] = useState<Set<string>>(new Set());
  const handleEdit = (airtableId: string) => setEditingTaskId(airtableId);
  const TOP_N = 3;

  async function handleCreateFromEmail(item: TriageItem) {
    setTriageBusy({ id: item.id, action: 'task' });
    setTriageError(null);
    try {
      const res = await fetch('/api/os/tasks/from-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: item.id, threadId: item.threadId }),
      });
      if (!res.ok) throw new Error(`Parse failed: ${res.status}`);
      const json = await res.json();
      setCreateFromEmail({
        prefill: json.prefill || {},
        emailMeta: { threadId: item.threadId, messageId: item.id, link: item.link },
      });
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : 'Failed to parse email');
    } finally {
      setTriageBusy(null);
    }
  }

  async function handleDraftReply(item: TriageItem) {
    setTriageBusy({ id: item.id, action: 'draft' });
    setTriageError(null);
    try {
      const res = await fetch('/api/os/gmail/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: item.id, threadId: item.threadId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Draft failed: ${res.status}`);
      }
      if (json.draftUrl) window.open(json.draftUrl, '_blank');
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : 'Failed to create draft');
    } finally {
      setTriageBusy(null);
    }
  }

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const t0 = performance.now();
    // Animate through the scan steps so the UI feels responsive.
    setScanStep(1);
    const stepInterval = setInterval(() => {
      setScanStep(s => (s >= 5 ? 5 : s + 1));
    }, 400);
    try {
      const res = await fetch(`/api/os/command-center?companyId=${companyId}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setData(json);
      setScanDurationMs(Math.round(performance.now() - t0));
      setScanCompletedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      clearInterval(stepInterval);
      setScanStep(0);
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Always bust the server-side cache on initial page load so completed tasks
  // (marked done in My Day or another tab) don't linger as stale fires.
  useEffect(() => { load(true); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Command Center</h1>
            <p className="text-xs text-gray-500">
              {new Date(data.generatedAt).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {!data.googleConnected && <span className="text-amber-400"> · Google not connected</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CommandBar
              onSelectTask={id => setEditingTaskId(id)}
              onSelectProject={name => {
                // Open the PM OS interface filtered to the selected project.
                // This navigates externally — the inline context shows when a
                // task with that project name is opened in the edit panel.
                window.open(`https://airtable.com/appQLwoVH8JyGSTIo/pagD8gby09ctslXG2`, '_blank');
              }}
            />
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-lg hover:bg-amber-950/60 transition-colors"
            >
              <Inbox className="w-3.5 h-3.5" />
              My Day
            </Link>
            <Link
              href="/tasks/summary"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-300 bg-sky-950/40 border border-sky-800/50 rounded-lg hover:bg-sky-950/60 transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Daily Summary
            </Link>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded border border-white/10 hover:border-white/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Data sources strip — shows exactly what was scanned, with progress during refresh */}
        <div className="mb-6">
          {refreshing ? (
            // Active-scan progress line
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-gray-500">Scanning:</span>
              {[
                { step: 1, label: 'Airtable tasks', activeClass: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5' },
                { step: 2, label: 'Google Calendar', activeClass: 'border-blue-500/30 text-blue-300 bg-blue-500/5' },
                { step: 3, label: 'Google Drive', activeClass: 'border-sky-500/30 text-sky-300 bg-sky-500/5' },
                { step: 4, label: 'Gmail inbox (triage)', activeClass: 'border-amber-500/30 text-amber-300 bg-amber-500/5' },
                { step: 5, label: 'Gmail sent mail', activeClass: 'border-orange-500/30 text-orange-300 bg-orange-500/5' },
              ].map(({ step, label, activeClass }) => {
                const active = scanStep >= step;
                const done = scanStep > step;
                return (
                  <span
                    key={step}
                    className={`px-2 py-0.5 rounded border inline-flex items-center gap-1 transition-opacity ${
                      active ? activeClass : 'border-white/10 text-gray-600 opacity-60'
                    }`}
                  >
                    {done ? (
                      <span className="text-emerald-400">✓</span>
                    ) : active ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <span className="w-3 h-3 inline-block" />
                    )}
                    {label}
                  </span>
                );
              })}
            </div>
          ) : (
            // Completed-scan summary with counts + timing
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-gray-500">Scanned:</span>
              <span className={`px-2 py-0.5 rounded border ${data.sources.tasks > 0 ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5' : 'border-white/10 text-gray-500'}`}>
                Airtable · {data.sources.tasks} tasks
              </span>
              <span className={`px-2 py-0.5 rounded border ${data.sources.events > 0 ? 'border-blue-500/30 text-blue-300 bg-blue-500/5' : data.googleConnected ? 'border-white/10 text-gray-500' : 'border-amber-500/30 text-amber-300 bg-amber-500/5'}`}>
                Calendar · {data.sources.events} events
              </span>
              <span className={`px-2 py-0.5 rounded border ${data.sources.docs > 0 ? 'border-sky-500/30 text-sky-300 bg-sky-500/5' : data.googleConnected ? 'border-white/10 text-gray-500' : 'border-amber-500/30 text-amber-300 bg-amber-500/5'}`}>
                Drive · {data.sources.docs} docs
              </span>
              {typeof data.sources.triage === 'number' && (
                <span className={`px-2 py-0.5 rounded border ${data.sources.triage > 0 ? 'border-amber-500/30 text-amber-300 bg-amber-500/5' : 'border-white/10 text-gray-500'}`}>
                  Gmail inbox · {data.sources.triage} to triage
                </span>
              )}
              {typeof data.sources.sent === 'number' && (
                <span className={`px-2 py-0.5 rounded border ${data.sources.sent > 0 ? 'border-orange-500/30 text-orange-300 bg-orange-500/5' : 'border-white/10 text-gray-500'}`}>
                  Sent mail · {data.sources.sent}
                </span>
              )}
              {typeof data.sources.pastEvents === 'number' && (
                <span className={`px-2 py-0.5 rounded border ${data.sources.pastEvents > 0 ? 'border-purple-500/30 text-purple-300 bg-purple-500/5' : 'border-white/10 text-gray-500'}`}>
                  Past meetings · {data.sources.pastEvents}
                </span>
              )}
              {scanDurationMs !== null && scanCompletedAt && (
                <span className="text-gray-500 ml-1">
                  · {scanDurationMs < 1000 ? `${scanDurationMs}ms` : `${(scanDurationMs / 1000).toFixed(1)}s`}
                  {' · '}
                  <RelativeTime date={scanCompletedAt} />
                </span>
              )}
              {!data.googleConnected && (
                <span className="text-amber-400 ml-2">
                  Google not connected{data.googleError ? ` — ${data.googleError}` : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Morning brief: one-shot summary across focus, overdue, risks, inbox, calendar. */}
        <MorningBrief onEdit={handleEdit} />

        {/* FocusStrip + RiskStrip removed: the Morning Brief surfaces the same
            focus ranking + overdue/risk data in a single card. Keeping these
            as standalone imports for now in case we ever want a "drill-down"
            mode, but they no longer render on the main scroll. */}

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

        {/* Dashboard grid — tiles, each capped to top 3 with expand */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* FIRES — hero, full width */}
          {data.fires.length > 0 && (
            <Tile icon={Flame} label="Fires" count={data.fires.length} color="text-red-400" accent="border-l-red-500/60" fullWidth>
              <div className="space-y-1">
                {(expanded.fires ? data.fires : data.fires.slice(0, TOP_N)).map(item => (
                  <WorkItemRow key={item.id} item={item} backUrl={backUrl} showAction onEdit={handleEdit} />
                ))}
              </div>
              {expanded.fires
                ? <ShowLess onClick={() => toggle('fires')} />
                : <ShowMore total={data.fires.length} shown={TOP_N} onClick={() => toggle('fires')} />}
            </Tile>
          )}

          {/* NEEDS TRIAGE — hero, full width. Capture-only surface: rows here
              are not yet Tasks. Clicking "+ Task" moves the item into the Tasks
              table (the source of truth) and it disappears from this list. */}
          {(() => {
            const visibleTriage = (data.triage || []).filter(
              t => !hiddenTriageIds.has(t.id) && !hiddenTriageIds.has(t.threadId),
            );
            if (visibleTriage.length === 0) return null;
            return (
              <Tile icon={Inbox} label="Needs Triage" count={visibleTriage.length} color="text-amber-300" accent="border-l-amber-500/60" fullWidth subtitle="Capture surface — click + Task to move into Tasks (source of truth). Draft reply to respond.">
                {triageError && (
                  <div className="text-xs text-red-400 mb-2 flex items-start gap-2">
                    <span className="flex-1">{triageError}</span>
                    <button onClick={() => setTriageError(null)} className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2">dismiss</button>
                  </div>
                )}
                <div>
                  {(expanded.triage ? visibleTriage : visibleTriage.slice(0, 5)).map(item => (
                    <TriageRow key={item.id} item={item} onTask={handleCreateFromEmail} onDraft={handleDraftReply} busyAction={triageBusy} />
                  ))}
                </div>
                {expanded.triage
                  ? <ShowLess onClick={() => toggle('triage')} />
                  : <ShowMore total={visibleTriage.length} shown={5} onClick={() => toggle('triage')} />}
              </Tile>
            );
          })()}

          {/* Top 3 Today removed — Morning Brief Focus section covers the same
              ranked tasks with Decide buttons. The topPriorities data is still
              fetched (other consumers may use it) but no longer rendered here. */}

          {/* FOLLOW-UPS */}
          {data.followUps && data.followUps.length > 0 && (
            <Tile
              icon={Inbox} label="Meeting Follow-Ups" count={data.followUps.length} color="text-orange-400"
              accent="border-l-orange-500/50"
              subtitle="Recent meetings with no task logged afterward."
            >
              <div className="space-y-1">
                {(expanded.followUps ? data.followUps : data.followUps.slice(0, TOP_N)).map(item => (
                  <FollowUpRow key={item.id} item={item} />
                ))}
              </div>
              {expanded.followUps
                ? <ShowLess onClick={() => toggle('followUps')} />
                : <ShowMore total={data.followUps.length} shown={TOP_N} onClick={() => toggle('followUps')} />}
            </Tile>
          )}

          {/* COMMITMENTS */}
          {data.commitments && data.commitments.length > 0 && (
            <Tile
              icon={MessageSquare} label="Commitments You Made" count={data.commitments.length} color="text-amber-400"
              accent="border-l-amber-500/50"
              subtitle="Promises pulled from your sent mail."
            >
              <div className="space-y-1">
                {(expanded.commitments ? data.commitments : data.commitments.slice(0, TOP_N)).map(item => (
                  <CommitmentRow key={item.id} item={item} />
                ))}
              </div>
              {expanded.commitments
                ? <ShowLess onClick={() => toggle('commitments')} />
                : <ShowMore total={data.commitments.length} shown={TOP_N} onClick={() => toggle('commitments')} />}
            </Tile>
          )}

          {/* WAITING ON */}
          {data.waitingOn.length > 0 && (
            <Tile icon={Clock} label="Waiting On" count={data.waitingOn.length} color="text-yellow-400" accent="border-l-yellow-500/50">
              <div className="space-y-1">
                {(expanded.waitingOn ? data.waitingOn : data.waitingOn.slice(0, TOP_N)).map(item => (
                  <WorkItemRow key={item.id} item={item} backUrl={backUrl} showAction onEdit={handleEdit} />
                ))}
              </div>
              {expanded.waitingOn
                ? <ShowLess onClick={() => toggle('waitingOn')} />
                : <ShowMore total={data.waitingOn.length} shown={TOP_N} onClick={() => toggle('waitingOn')} />}
            </Tile>
          )}

          {/* MEETINGS THIS WEEK */}
          {data.googleConnected && (
            <Tile icon={Calendar} label="Meetings This Week" count={data.upcomingMeetings.length} color="text-blue-400">
              {data.upcomingMeetings.length > 0 ? (
                <>
                  <div className="space-y-1">
                    {(expanded.meetings ? data.upcomingMeetings : data.upcomingMeetings.slice(0, TOP_N)).map(item => (
                      <MeetingRow key={item.id} item={item} backUrl={backUrl} />
                    ))}
                  </div>
                  {expanded.meetings
                    ? <ShowLess onClick={() => toggle('meetings')} />
                    : <ShowMore total={data.upcomingMeetings.length} shown={TOP_N} onClick={() => toggle('meetings')} />}
                </>
              ) : (
                <p className="text-xs text-gray-500">No events in the next 7 days.</p>
              )}
            </Tile>
          )}

          {/* THIS WEEK */}
          {data.thisWeek.length > 0 && (
            <Tile icon={Zap} label="This Week" count={data.thisWeek.length} color="text-sky-400">
              <div className="space-y-1">
                {(expanded.thisWeek ? data.thisWeek : data.thisWeek.slice(0, TOP_N)).map(item => (
                  <WorkItemRow key={item.id} item={item} backUrl={backUrl} onEdit={handleEdit} />
                ))}
              </div>
              {expanded.thisWeek
                ? <ShowLess onClick={() => toggle('thisWeek')} />
                : <ShowMore total={data.thisWeek.length} shown={TOP_N} onClick={() => toggle('thisWeek')} />}
            </Tile>
          )}

          {/* REVIEW QUEUE */}
          {data.reviewQueue && data.reviewQueue.length > 0 && (
            <Tile
              icon={Eye} label="Review Queue" count={data.reviewQueue.length} color="text-purple-400"
              subtitle="Docs others changed that you haven't reviewed."
            >
              <div className="space-y-1">
                {(expanded.reviewQueue ? data.reviewQueue : data.reviewQueue.slice(0, TOP_N)).map(item => (
                  <ReviewRow key={item.id} item={item} />
                ))}
              </div>
              {expanded.reviewQueue
                ? <ShowLess onClick={() => toggle('reviewQueue')} />
                : <ShowMore total={data.reviewQueue.length} shown={TOP_N} onClick={() => toggle('reviewQueue')} />}
            </Tile>
          )}

          {/* WHAT YOU'RE BUILDING */}
          {data.inProgress && data.inProgress.length > 0 && (
            <Tile
              icon={FolderKanban} label="What You're Building" count={data.inProgress.length} color="text-teal-400"
              subtitle="Clusters of docs you've been editing."
            >
              <div className="space-y-2">
                {(expanded.inProgress ? data.inProgress : data.inProgress.slice(0, TOP_N)).map(item => (
                  <ProjectRow key={item.id} item={item} />
                ))}
              </div>
              {expanded.inProgress
                ? <ShowLess onClick={() => toggle('inProgress')} />
                : <ShowMore total={data.inProgress.length} shown={TOP_N} onClick={() => toggle('inProgress')} />}
            </Tile>
          )}

          {/* RECENTLY ACTIVE — reference, opaque-ish */}
          {data.googleConnected && data.recentActivity.length > 0 && (
            <Tile icon={FileText} label="Recently Active" count={data.recentActivity.length} color="text-gray-400">
              <div className="space-y-1">
                {(expanded.recent ? data.recentActivity : data.recentActivity.slice(0, TOP_N)).map(item => (
                  <DocRow key={item.id} item={item} />
                ))}
              </div>
              {expanded.recent
                ? <ShowLess onClick={() => toggle('recent')} />
                : <ShowMore total={data.recentActivity.length} shown={TOP_N} onClick={() => toggle('recent')} />}
            </Tile>
          )}

          {/* STALE — full width, collapsible */}
          {data.stale && data.stale.length > 0 && (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 lg:col-span-2">
              <button
                onClick={() => setStaleOpen(o => !o)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-300 w-full"
              >
                <Archive className="w-4 h-4" />
                <h2 className="text-xs font-semibold uppercase tracking-wide">Stale Backlog</h2>
                <span className="text-xs">({data.stale.length})</span>
                <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${staleOpen ? 'rotate-180' : ''}`} />
              </button>
              {!staleOpen && (
                <p className="text-xs text-gray-600 mt-2">
                  {data.stale.length} tasks overdue 90+ days. Likely abandoned — expand to review.
                </p>
              )}
              {staleOpen && (
                <div className="space-y-1 opacity-60 mt-2">
                  {data.stale.map(item => <WorkItemRow key={item.id} item={item} backUrl={backUrl} onEdit={handleEdit} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <TaskEditPanel
        taskId={editingTaskId}
        onClose={() => setEditingTaskId(null)}
        onSaved={() => load(true)}
      />
      <TaskEditPanel
        mode="create"
        prefill={createFromEmail?.prefill}
        emailMeta={createFromEmail?.emailMeta}
        onClose={() => setCreateFromEmail(null)}
        onSaved={() => {
          // Optimistically hide the email from Needs Triage the instant a Task
          // is created for it — Tasks is the source of truth, and the row
          // should stop appearing as "unhandled" the moment it's captured.
          const captured = createFromEmail?.emailMeta;
          if (captured) {
            setHiddenTriageIds(prev => {
              const next = new Set(prev);
              next.add(captured.messageId);
              next.add(captured.threadId);
              return next;
            });
          }
          setCreateFromEmail(null);
          load(true);
        }}
      />
    </div>
  );
}
