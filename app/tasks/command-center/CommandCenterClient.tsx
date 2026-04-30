'use client';
// app/tasks/command-center/CommandCenterClient.tsx
// Chief of Staff AI — Daily Command Center
// Three sections, tight: Today (mirror My Day's top + meeting prep),
// What's Slipping (overdue / commitments without a task / meetings with no
// follow-up / stale triage), Fresh (counters linking to the right surface).
// Reference prototype: /Users/chrislloyd/Documents/Claude/Projects/Email Inbox Management/hive-inbox-tracker.jsx

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TaskEditPanel } from './TaskEditPanel';
import { CommandBar } from './CommandBar';
import {
  Flame, Calendar, ChevronRight, RefreshCw,
  Inbox, MessageSquare, Mail, AlertTriangle,
  ListTodo, ArrowRight, CheckCircle2, Zap,
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
  commitments?: CommitmentItem[];
  triage?: TriageItem[];
  websiteSubmissions?: TriageItem[];
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

function daysSince(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

function formatDueBadge(iso?: string | null): { text: string; variant: 'overdue' | 'today' | 'tomorrow' | 'neutral' } | null {
  if (!iso) return null;
  const diff = daysUntil(iso);
  if (diff === null) return null;
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, variant: 'overdue' };
  if (diff === 0) return { text: 'Due today', variant: 'today' };
  if (diff === 1) return { text: 'Due tomorrow', variant: 'tomorrow' };
  if (diff <= 7) return { text: new Date(iso).toLocaleDateString('en-US', { weekday: 'short' }), variant: 'neutral' };
  return null;
}

function formatEventTime(d?: string | null): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  return `${date.toLocaleDateString('en-US', { weekday: 'short' })} · ${time}`;
}

// ============================================================================
// UI primitives
// ============================================================================

function PriorityPill({ pri }: { pri?: string | null }) {
  const config: Record<string, { bg: string; text: string; border: string }> = {
    P0: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
    P1: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    P2: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    P3: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' },
  };
  const p = pri || 'P2';
  const c = config[p] || config.P2;
  return (
    <span className={`inline-flex items-center justify-center w-[26px] h-[18px] rounded text-[10px] font-bold tracking-wide border flex-shrink-0 ${c.bg} ${c.text} ${c.border}`}>
      {p}
    </span>
  );
}

type TagVariant = 'overdue' | 'today' | 'tomorrow' | 'auto' | 'waiting' | 'draftReady' | 'neutral';

function Tag({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: TagVariant }) {
  const variants: Record<TagVariant, string> = {
    overdue: 'bg-red-500/10 text-red-400 border-red-500/30',
    today: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    tomorrow: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    auto: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    waiting: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    draftReady: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    neutral: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-px rounded text-[10px] font-semibold border tabular-nums ${variants[variant]}`}>
      {children}
    </span>
  );
}

type ActionVariant = 'primary' | 'neutral' | 'subtle';

function MiniAction({
  children, variant = 'neutral', onClick, disabled, title,
}: {
  children: React.ReactNode;
  variant?: ActionVariant;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  title?: string;
}) {
  const variants: Record<ActionVariant, string> = {
    primary: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50',
    neutral: 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600',
    subtle: 'border-transparent text-gray-500 hover:bg-gray-800 hover:text-gray-300',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors disabled:opacity-50 disabled:cursor-wait ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function SectionHead({
  icon: Icon, label, count, accent = 'text-gray-400', meta, action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  accent?: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3 px-0.5">
      {Icon && <Icon className={`w-3.5 h-3.5 ${accent}`} />}
      <h2 className={`text-[11px] font-semibold tracking-[0.1em] uppercase ${accent}`}>{label}</h2>
      {typeof count === 'number' && <span className="text-xs text-gray-500">({count})</span>}
      <div className="flex-1" />
      {meta && <span className="text-xs text-gray-500">{meta}</span>}
      {action}
    </div>
  );
}

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
// Today section
// ============================================================================

function TodaySection({
  focus, meetingsToday, onEditTask,
}: {
  focus: WorkItem[];
  meetingsToday: WorkItem[];
  onEditTask: (airtableId: string) => void;
}) {
  if (focus.length === 0 && meetingsToday.length === 0) return null;

  return (
    <section className="mb-7">
      <SectionHead
        icon={ListTodo}
        label="Today"
        meta="top priorities from My Day"
        action={
          <Link href="/tasks" className="text-xs text-indigo-400 hover:text-indigo-300">
            Open My Day →
          </Link>
        }
      />
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        {focus.length > 0 && (
          <div className="divide-y divide-gray-800">
            {focus.map((t) => {
              const due = formatDueBadge(t.dueDate);
              const airtableId = airtableIdOf(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => airtableId && onEditTask(airtableId)}
                  className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1 cursor-pointer group"
                >
                  <PriorityPill pri={t.priority} />
                  <span className="flex-1 text-sm text-gray-100 truncate group-hover:text-white">{t.title}</span>
                  {due && <Tag variant={due.variant}>{due.text}</Tag>}
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                </div>
              );
            })}
          </div>
        )}

        {meetingsToday.length > 0 && (
          <div className="mt-3 px-3 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-center gap-2.5 text-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-gray-300">
              {meetingsToday.length === 1 ? (
                <>
                  <span className="text-gray-100 font-medium">{meetingsToday[0].title}</span> — no prep doc or linked tasks
                </>
              ) : (
                <>{meetingsToday.length} meetings today with no prep</>
              )}
            </span>
            <span className="ml-auto text-xs text-gray-500 tabular-nums">
              {formatEventTime(meetingsToday[0].dueDate)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// What's Slipping section
// ============================================================================

function SubgroupHeader({ label, hint }: { label: string; hint: string }) {
  return (
    <h3 className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-500 mb-2">
      {label}
      <span className="text-gray-600 normal-case tracking-normal font-normal italic ml-2">— {hint}</span>
    </h3>
  );
}

function OverdueRow({ item, onEdit }: { item: WorkItem; onEdit: (airtableId: string) => void }) {
  const days = daysUntil(item.dueDate);
  const late = days !== null ? Math.abs(days) : 0;
  const airtableId = airtableIdOf(item.id);
  return (
    <div
      onClick={() => airtableId && onEdit(airtableId)}
      className="group flex items-start gap-3 py-2 cursor-pointer"
    >
      <PriorityPill pri={item.priority} />
      <div className="flex-1 min-w-0 pt-[1px]">
        <div className="text-sm text-gray-100 truncate">{item.title}</div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">
          {item.project || item.owner || 'No project'}
          {item.links.length > 0 && <> <span className="text-gray-700">·</span> {item.links.length} linked</>}
        </div>
      </div>
      <Tag variant="overdue">{late}d late</Tag>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <MiniAction onClick={(e) => { e.stopPropagation(); if (airtableId) onEdit(airtableId); }}>Reschedule</MiniAction>
        <MiniAction onClick={(e) => e.stopPropagation()}>Close</MiniAction>
      </div>
    </div>
  );
}

function CommitmentRow({ item, onDismiss, onAdd }: { item: CommitmentItem; onDismiss: () => void; onAdd: () => void }) {
  const when = formatEventTime(item.sentAt) || item.sentAt;
  return (
    <div className="group flex items-start gap-3 py-2">
      <MessageSquare className="w-3.5 h-3.5 text-gray-500 mt-1 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-100 italic">
          <span className="text-gray-500">&ldquo;</span>{item.phrase}<span className="text-gray-500">&rdquo;</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          to {item.to}
          <span className="text-gray-700"> · </span>
          <a href={item.link} target="_blank" rel="noreferrer" className="hover:text-indigo-400">{when}</a>
          {item.subject && <> <span className="text-gray-700">·</span> {item.subject}</>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <MiniAction variant="primary" onClick={onAdd}>+ Task</MiniAction>
        <MiniAction onClick={onDismiss}>Dismiss</MiniAction>
      </div>
    </div>
  );
}

function FollowUpRow({ item }: { item: FollowUpItem }) {
  return (
    <div className="group flex items-start gap-3 py-2">
      <Calendar className="w-3.5 h-3.5 text-gray-500 mt-1 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-100">
          {item.link ? (
            <a href={item.link} target="_blank" rel="noreferrer" className="hover:text-indigo-400">{item.title}</a>
          ) : item.title}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">
          {item.when}
          {item.attendees.length > 0 && <> <span className="text-gray-700">·</span> with {item.attendees.slice(0, 3).join(', ')}{item.attendees.length > 3 && ` +${item.attendees.length - 3}`}</>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <MiniAction variant="primary">+ Task</MiniAction>
        <MiniAction>Nothing to log</MiniAction>
      </div>
    </div>
  );
}

function TriageRow({
  item, onTask, onDraft, onArchive, busyAction,
}: {
  item: TriageItem;
  onTask: (item: TriageItem) => void;
  onDraft: (item: TriageItem) => void;
  onArchive: (item: TriageItem) => void;
  busyAction: 'task' | 'draft' | null;
}) {
  const age = daysSince(item.date);
  return (
    <div className="group flex items-start gap-3 py-2">
      <Mail className="w-3.5 h-3.5 text-gray-500 mt-1 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-100 truncate">
          <a href={item.link} target="_blank" rel="noreferrer" className="hover:text-indigo-400 hover:underline">{item.subject}</a>
        </div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">
          {item.fromName || item.fromEmail}
          <span className="text-gray-700"> · </span>
          {age}d old
          {item.snippet && <> <span className="text-gray-700">·</span> {item.snippet}</>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <MiniAction
          variant="primary"
          onClick={() => onTask(item)}
          disabled={busyAction === 'task'}
        >
          {busyAction === 'task' ? '…' : '+ Task'}
        </MiniAction>
        <MiniAction
          onClick={() => onDraft(item)}
          disabled={busyAction === 'draft'}
        >
          {busyAction === 'draft' ? '…' : 'Draft reply'}
        </MiniAction>
        <MiniAction onClick={() => onArchive(item)}>Archive</MiniAction>
      </div>
    </div>
  );
}

function WhatsSlippingSection({
  overdue, commitments, followUps, staleTriage,
  onEditTask, onDismissCommitment, onAddFromCommitment,
  onTaskFromTriage, onDraftReply, onArchiveTriage, triageBusy,
}: {
  overdue: WorkItem[];
  commitments: CommitmentItem[];
  followUps: FollowUpItem[];
  staleTriage: TriageItem[];
  onEditTask: (airtableId: string) => void;
  onDismissCommitment: (id: string) => void;
  onAddFromCommitment: (c: CommitmentItem) => void;
  onTaskFromTriage: (item: TriageItem) => void;
  onArchiveTriage: (item: TriageItem) => void;
  onDraftReply: (item: TriageItem) => void;
  triageBusy: { id: string; action: 'task' | 'draft' } | null;
}) {
  const total = overdue.length + commitments.length + followUps.length + staleTriage.length;
  if (total === 0) return null;

  return (
    <section className="mb-7">
      <SectionHead
        icon={Flame}
        label="What's slipping"
        count={total}
        accent="text-red-400"
        meta="things that should be in My Day but aren't"
      />
      <div className="bg-gray-900 border border-gray-800 border-l-2 border-l-red-500/40 rounded-xl overflow-hidden divide-y divide-gray-800">

        {overdue.length > 0 && (
          <div className="p-4">
            <SubgroupHeader label="Overdue" hint="already in the system, past their date" />
            <div className="divide-y divide-gray-800/60">
              {overdue.map((t) => <OverdueRow key={t.id} item={t} onEdit={onEditTask} />)}
            </div>
          </div>
        )}

        {commitments.length > 0 && (
          <div className="p-4">
            <SubgroupHeader label="Commitments without a task" hint="promises from your sent mail" />
            <div className="divide-y divide-gray-800/60">
              {commitments.map((c) => (
                <CommitmentRow
                  key={c.id}
                  item={c}
                  onDismiss={() => onDismissCommitment(c.id)}
                  onAdd={() => onAddFromCommitment(c)}
                />
              ))}
            </div>
          </div>
        )}

        {followUps.length > 0 && (
          <div className="p-4">
            <SubgroupHeader label="Meetings with no follow-up logged" hint="you met and nothing got captured" />
            <div className="divide-y divide-gray-800/60">
              {followUps.map((f) => <FollowUpRow key={f.id} item={f} />)}
            </div>
          </div>
        )}

        {staleTriage.length > 0 && (
          <div className="p-4">
            <SubgroupHeader label="Stale in triage" hint="emails older than 2 days still waiting" />
            <div className="divide-y divide-gray-800/60">
              {staleTriage.map((t) => (
                <TriageRow
                  key={t.id}
                  item={t}
                  onTask={onTaskFromTriage}
                  onDraft={onDraftReply}
                  onArchive={onArchiveTriage}
                  busyAction={triageBusy?.id === t.id ? triageBusy.action : null}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

// ============================================================================
// Fresh section (counters linking out)
// ============================================================================

function FreshCard({ n, label, cta, href, external }: { n: number; label: string; cta: string; href: string; external?: boolean }) {
  const inner = (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:bg-gray-800/50 hover:border-gray-700 transition-colors cursor-pointer">
      <div className="text-2xl font-semibold text-gray-100 tabular-nums leading-none">{n}</div>
      <div className="text-xs text-gray-500 mt-1.5">{label}</div>
      <div className="text-xs text-indigo-400 mt-1.5 flex items-center gap-1">{cta} <ArrowRight className="w-3 h-3" /></div>
    </div>
  );
  if (external) {
    return <a href={href} target="_blank" rel="noreferrer">{inner}</a>;
  }
  return <Link href={href}>{inner}</Link>;
}

// ============================================================================
// Website submissions section (low priority — routine Framer form fills)
// ============================================================================

function WebsiteSubmissionsSection({ submissions }: { submissions: TriageItem[] }) {
  if (submissions.length === 0) return null;
  const visible = submissions.slice(0, 5);
  const overflow = submissions.length - visible.length;
  return (
    <section className="mb-7">
      <SectionHead
        icon={Mail}
        label="Website submissions"
        count={submissions.length}
        accent="text-teal-400"
        meta="low priority — form fills from the Hive site"
      />
      <div className="bg-gray-900 border border-gray-800 border-l-2 border-l-teal-500/30 rounded-xl divide-y divide-gray-800/60">
        {visible.map((s) => (
          <div key={s.id} className="flex items-start gap-3 px-4 py-2.5 group">
            <Mail className="w-3.5 h-3.5 text-teal-400/60 mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-100 truncate">
                <a href={s.link} target="_blank" rel="noreferrer" className="hover:text-teal-300">
                  {s.subject}
                </a>
              </div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">
                {s.fromName || s.fromEmail} <span className="text-gray-700">·</span> {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {s.snippet && <> <span className="text-gray-700">·</span> {s.snippet.length > 120 ? s.snippet.slice(0, 117) + '…' : s.snippet}</>}
              </div>
            </div>
          </div>
        ))}
        {overflow > 0 && (
          <div className="px-4 py-2 text-xs text-gray-500 italic">
            + {overflow} more in My Day
          </div>
        )}
      </div>
    </section>
  );
}

function FreshSection({
  freshTriage, weekTasks, weekMeetings,
}: {
  freshTriage: number;
  weekTasks: number;
  weekMeetings: number;
}) {
  return (
    <section className="mb-7">
      <SectionHead icon={Inbox} label="Fresh" meta="last 48h — act from the right surface" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <FreshCard n={freshTriage} label="emails in triage < 2 days old" cta="Triage inbox" href="https://mail.google.com/mail/u/0/#inbox" external />
        <FreshCard n={weekTasks} label="tasks scheduled this week" cta="Open My Day" href="/tasks" />
        <FreshCard n={weekMeetings} label="meetings this week" cta="Calendar" href="https://calendar.google.com" external />
      </div>
    </section>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function CommandCenterClient({ companyId }: { companyId: string; backUrl?: string }) {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scanDurationMs, setScanDurationMs] = useState<number | null>(null);
  const [scanCompletedAt, setScanCompletedAt] = useState<Date | null>(null);
  const [scanStep, setScanStep] = useState<number>(0);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [createFromEmail, setCreateFromEmail] = useState<{
    prefill: Record<string, unknown>;
    emailMeta: { threadId: string; messageId: string; link: string };
  } | null>(null);
  const [triageBusy, setTriageBusy] = useState<{ id: string; action: 'task' | 'draft' } | null>(null);
  const [triageError, setTriageError] = useState<{ message: string; reconnectUrl?: string } | null>(null);
  const [hiddenTriageIds, setHiddenTriageIds] = useState<Set<string>>(new Set());
  const [dismissedCommitmentIds, setDismissedCommitmentIds] = useState<Set<string>>(new Set());

  const handleEdit = (airtableId: string) => setEditingTaskId(airtableId);

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
      setTriageError({ message: err instanceof Error ? err.message : 'Failed to parse email' });
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
        setTriageError({
          message: json?.error || `Draft failed: ${res.status}`,
          reconnectUrl: typeof json?.reconnectUrl === 'string' ? json.reconnectUrl : undefined,
        });
        return;
      }
      if (json.draftUrl) window.open(json.draftUrl, '_blank');
    } catch (err) {
      setTriageError({ message: err instanceof Error ? err.message : 'Failed to create draft' });
    } finally {
      setTriageBusy(null);
    }
  }

  async function load(refresh = false, runTriage = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const t0 = performance.now();
    setScanStep(1);
    const stepInterval = setInterval(() => {
      setScanStep((s) => (s >= 5 ? 5 : s + 1));
    }, 400);
    try {
      // When the user clicks Refresh, run inbox-to-task conversion BEFORE
      // fetching command-center data so any newly created tasks appear in
      // the same render. The endpoint has its own 30-second cooldown, so
      // rapid clicks are no-ops. Failure here is non-fatal — we still
      // refresh the view.
      if (refresh && runTriage) {
        await fetch('/api/os/tasks/sync-gmail', {
          method: 'POST',
          cache: 'no-store',
        }).catch(() => {});
      }
      const res = await fetch(
        `/api/os/command-center?companyId=${companyId}${refresh ? '&refresh=1' : ''}`,
        { cache: 'no-store' }
      );
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

  // Bust server cache on initial load so completed tasks don't linger.
  useEffect(() => { load(true); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background Gmail sync after first load.
  const gmailSyncFired = useRef(false);
  useEffect(() => {
    if (loading || !data || gmailSyncFired.current) return;
    gmailSyncFired.current = true;
    let cancelled = false;
    fetch('/api/os/tasks/sync-gmail', { method: 'POST' })
      .then((r) => r.json())
      .then((res) => { if (!cancelled && res.synced > 0) load(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-tasks sync: materialize commitments / follow-ups / stale triage into
  // Airtable tasks so they also show up in My Day. Fire-and-forget on mount;
  // endpoint has its own 60-second cooldown.
  const autoSyncFired = useRef(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [autoSyncSummary, setAutoSyncSummary] = useState<string | null>(null);

  async function runAutoSync(manual = false) {
    setAutoSyncing(true);
    try {
      const res = await fetch('/api/os/sync/auto-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.stats) {
        const s = json.stats;
        const parts: string[] = [];
        if (s.created) parts.push(`${s.created} new`);
        if (s.unarchived) parts.push(`${s.unarchived} re-surfaced`);
        if (s.errors) parts.push(`${s.errors} errors`);
        setAutoSyncSummary(parts.length ? `Synced · ${parts.join(', ')}` : 'Synced · no changes');
        // If anything changed, reload Command Center data too (may affect counts).
        if (s.created > 0 || s.unarchived > 0 || s.updated > 0) load(true);
      } else if (json.reason === 'cooldown') {
        if (manual) {
          const secs = Math.ceil((json.cooldownMsRemaining || 0) / 1000);
          setAutoSyncSummary(`Synced recently — wait ${secs}s to re-run`);
        }
      } else if (!res.ok) {
        setAutoSyncSummary(`Sync error: ${json.error || res.status}`);
      }
    } catch (err) {
      setAutoSyncSummary(`Sync failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setAutoSyncing(false);
    }
  }

  useEffect(() => {
    if (loading || !data || autoSyncFired.current) return;
    autoSyncFired.current = true;
    runAutoSync(false);
  }, [loading, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss commitment / triage / follow-up → PATCH the auto-task so it
  // stays dismissed across reloads. Falls back to local hide if no task exists yet.
  async function dismissAutoItem(source: 'commitment' | 'meeting-follow-up' | 'email-triage', sourceRef: string) {
    try {
      await fetch('/api/os/sync/auto-tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, sourceRef }),
      });
    } catch {
      /* swallow — local hide still applied below */
    }
  }

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

  // Derived data for sections
  const focus = data.topPriorities.slice(0, 3);

  const meetingsToday = data.upcomingMeetings.filter((m) => {
    const diff = daysUntil(m.dueDate);
    return diff === 0 && (m.flags?.includes('no-prep') || !m.links || m.links.length === 0);
  });

  const overdue = data.fires.filter((f) => {
    const diff = daysUntil(f.dueDate);
    return diff !== null && diff < 0;
  });

  const commitments = (data.commitments || []).filter((c) => !dismissedCommitmentIds.has(c.id));
  const followUps = data.followUps || [];

  const visibleTriage = (data.triage || []).filter((t) => !hiddenTriageIds.has(t.id) && !t.hasExistingTask);
  const staleTriage = visibleTriage.filter((t) => daysSince(t.date) > 2);
  const freshTriage = visibleTriage.filter((t) => daysSince(t.date) <= 2).length;

  const weekTasks = (data.counts.thisWeek ?? 0) + (data.counts.topPriorities ?? 0);
  const weekMeetings = data.counts.upcomingMeetings ?? 0;

  const dismissCommitment = (id: string) => {
    setDismissedCommitmentIds((s) => new Set([...s, id])); // optimistic hide
    dismissAutoItem('commitment', id).catch(() => {});      // persist to task
  };
  const addFromCommitment = (c: CommitmentItem) => {
    // Treat commitment like a triage email for prefill — the endpoint handles both shapes,
    // but falling back to an empty prefill lets the user fill it in if not.
    setCreateFromEmail({
      prefill: { task: c.phrase, from: c.to, project: '' },
      emailMeta: { threadId: '', messageId: c.id, link: c.link },
    });
  };
  const taskFromTriage = (item: TriageItem) => {
    // Optimistically hide the row so it doesn't linger while we open the edit panel.
    setHiddenTriageIds((s) => new Set([...s, item.id]));
    handleCreateFromEmail(item);
  };

  const dateStr = new Date(data.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-50 tracking-tight">Command Center</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {dateStr}
              {!data.googleConnected && <span className="text-amber-400"> · Google not connected</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CommandBar
              onSelectTask={(id) => setEditingTaskId(id)}
              onSelectProject={() => {
                window.open('https://airtable.com/appQLwoVH8JyGSTIo/pagD8gby09ctslXG2', '_blank');
              }}
            />
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
            >
              <Inbox className="w-3.5 h-3.5" />
              Open My Day →
            </Link>
            <button
              onClick={() => runAutoSync(true)}
              disabled={autoSyncing}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-md border border-gray-700 hover:border-gray-600 disabled:opacity-50"
              title="Sync commitments, meeting follow-ups, and stale triage emails into My Day"
            >
              <Zap className={`w-3.5 h-3.5 ${autoSyncing ? 'animate-pulse' : ''}`} />
              {autoSyncing ? 'Syncing' : 'Sync now'}
            </button>
            <button
              onClick={() => load(true, true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-md border border-gray-700 hover:border-gray-600 disabled:opacity-50"
              title="Refresh — pulls new emails into tasks, then re-reads the board"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>
        {autoSyncSummary && (
          <div className="mb-2 text-xs text-gray-500">{autoSyncSummary}</div>
        )}

        {/* Scan chip strip */}
        <div className="mb-6 flex flex-wrap items-center gap-1.5 text-[11px]">
          {refreshing ? (
            <>
              <span className="text-gray-500 mr-1">Scanning:</span>
              {[
                { step: 1, label: 'Airtable tasks', cls: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5' },
                { step: 2, label: 'Google Calendar', cls: 'border-blue-500/30 text-blue-300 bg-blue-500/5' },
                { step: 3, label: 'Google Drive', cls: 'border-sky-500/30 text-sky-300 bg-sky-500/5' },
                { step: 4, label: 'Gmail inbox', cls: 'border-amber-500/30 text-amber-300 bg-amber-500/5' },
                { step: 5, label: 'Sent mail', cls: 'border-orange-500/30 text-orange-300 bg-orange-500/5' },
              ].map(({ step, label, cls }) => {
                const active = scanStep >= step;
                const done = scanStep > step;
                return (
                  <span
                    key={step}
                    className={`px-2 py-0.5 rounded border inline-flex items-center gap-1 transition-opacity ${active ? cls : 'border-white/10 text-gray-600 opacity-60'}`}
                  >
                    {done ? <span className="text-emerald-400">✓</span> : active ? <RefreshCw className="w-3 h-3 animate-spin" /> : <span className="w-3 h-3 inline-block" />}
                    {label}
                  </span>
                );
              })}
            </>
          ) : (
            <>
              <span className="text-gray-500 mr-1">Scanned:</span>
              <span className="px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300 bg-emerald-500/5 text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1.5" />
                Airtable · <span className="text-gray-200 tabular-nums">{data.sources.tasks}</span> tasks
              </span>
              <span className="px-2 py-0.5 rounded border border-blue-500/30 text-blue-300 bg-blue-500/5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block mr-1.5" />
                Calendar · <span className="text-gray-200 tabular-nums">{data.sources.events}</span> events
              </span>
              {typeof data.sources.triage === 'number' && (
                <span className="px-2 py-0.5 rounded border border-amber-500/30 text-amber-300 bg-amber-500/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block mr-1.5" />
                  Gmail · <span className="text-gray-200 tabular-nums">{data.sources.triage}</span> inbox
                </span>
              )}
              {typeof data.sources.sent === 'number' && (
                <span className="px-2 py-0.5 rounded border border-orange-500/30 text-orange-300 bg-orange-500/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block mr-1.5" />
                  Sent · <span className="text-gray-200 tabular-nums">{data.sources.sent}</span>
                </span>
              )}
              <span className="px-2 py-0.5 rounded border border-sky-500/30 text-sky-300 bg-sky-500/5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block mr-1.5" />
                Drive · <span className="text-gray-200 tabular-nums">{data.sources.docs}</span> docs
              </span>
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
            </>
          )}
        </div>

        {/* Triage error banner */}
        {triageError && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between gap-3 text-sm">
            <span className="text-red-300 flex-1">{triageError.message}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {triageError.reconnectUrl && (
                <a
                  href={triageError.reconnectUrl}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 transition-colors"
                >
                  Reconnect Google →
                </a>
              )}
              <button onClick={() => setTriageError(null)} className="text-red-400 hover:text-red-200 text-xs">
                dismiss
              </button>
            </div>
          </div>
        )}

        {/* Sections */}
        <TodaySection
          focus={focus}
          meetingsToday={meetingsToday}
          onEditTask={handleEdit}
        />

        <WhatsSlippingSection
          overdue={overdue}
          commitments={commitments}
          followUps={followUps}
          staleTriage={staleTriage}
          onEditTask={handleEdit}
          onDismissCommitment={dismissCommitment}
          onAddFromCommitment={addFromCommitment}
          onTaskFromTriage={taskFromTriage}
          onDraftReply={handleDraftReply}
          onArchiveTriage={(item) => {
            setHiddenTriageIds((s) => new Set([...s, item.id]));
            dismissAutoItem('email-triage', item.id).catch(() => {});
          }}
          triageBusy={triageBusy}
        />

        <FreshSection
          freshTriage={freshTriage}
          weekTasks={weekTasks}
          weekMeetings={weekMeetings}
        />

        <WebsiteSubmissionsSection
          submissions={(data.websiteSubmissions || []).filter((s) => !s.hasExistingTask)}
        />

        {/* Empty-state hint when everything is quiet */}
        {focus.length === 0 && overdue.length === 0 && commitments.length === 0 && followUps.length === 0 && staleTriage.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-emerald-500/50" />
            Nothing pressing right now. Nice.
          </div>
        )}

      </div>

      {/* Task edit panel (for editing existing tasks) */}
      {editingTaskId && (
        <TaskEditPanel
          mode="edit"
          taskId={editingTaskId}
          onClose={() => setEditingTaskId(null)}
          onSaved={() => { setEditingTaskId(null); load(true); }}
        />
      )}

      {/* New task from email (prefilled) */}
      {createFromEmail && (
        <TaskEditPanel
          mode="create"
          prefill={createFromEmail.prefill}
          emailMeta={createFromEmail.emailMeta}
          onClose={() => setCreateFromEmail(null)}
          onSaved={() => { setCreateFromEmail(null); load(true); }}
        />
      )}
    </div>
  );
}
