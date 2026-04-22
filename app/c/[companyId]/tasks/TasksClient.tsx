'use client';

// app/c/[companyId]/tasks/TasksClient.tsx
// My Day — the work surface
//
// Pattern: each task row has exactly one primary action button tied to its
// type. Email → Draft reply (or Review in Gmail if draft already exists).
// Doc → Open in Drive. Spreadsheet → Open workbook. Meeting → Draft brief.
// Metadata (priority, title) is click-to-edit on hover; serial edits via J/K/1/2/3/X.
//
// Reference prototype: /Users/chrislloyd/Documents/Claude/Projects/Email Inbox Management/my-day.jsx

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TaskEditPanel } from '@/app/tasks/command-center/TaskEditPanel';
import {
  Mail, FileText, BarChart3, Calendar, ClipboardList, Target,
  Brain, FolderKanban, Archive as ArchiveIcon, Inbox,
  CheckCircle2, ChevronRight, MoreHorizontal, Plus, Search,
  Clock, ArrowRightCircle, Zap,
  Folder, Globe, Link2, Presentation, Table2, X,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface CompanyData {
  id: string;
  name: string;
}

export interface TasksClientProps {
  company?: CompanyData;
}

interface TaskItem {
  id: number;
  airtableId?: string;
  task: string;
  pri: Priority;
  due: string;
  from: string;
  project: string;
  nextAction: string;
  status: TaskStatus;
  threadUrl: string | null;
  draftUrl: string | null;
  attachUrl: string | null;
  notes: string;
  assignedTo: string;
  checked: boolean;
  view: ViewType;
  priorStatusBeforeDone?: TaskStatus;
  priorViewBeforeDone?: ViewType;
  /** Surfaced from /api/os/tasks to render the ⚡ auto pill on tasks that
   *  were upserted by /api/os/sync/auto-tasks. */
  autoCreated?: boolean;
  source?: 'manual' | 'commitment' | 'meeting-follow-up' | 'email-triage' | 'website-submission' | null;
  /** External identifier tied to the source system. For website-submission
   *  tasks this is the Gmail messageId — used so Draft reply targets the
   *  specific submission instead of the latest message in the thread. */
  sourceRef?: string | null;
}

type Priority = 'P0' | 'P1' | 'P2' | 'P3';
type TaskStatus = 'Next' | 'Inbox' | 'Waiting' | 'Done' | 'Archive';
type ViewType = 'inbox' | 'braindump' | 'projects' | 'archive';

// Workspace (pinned working documents). Mirrors lib/airtable/workspaceDocs shape.
type WorkspaceCategory = 'Doc' | 'Sheet' | 'Slides' | 'Folder' | 'Web Page' | 'Other';
interface WorkspaceDoc {
  id: string;
  name: string;
  url: string;
  description: string;
  category: WorkspaceCategory | null;
  frequency: string | null;
  lastReviewed: string | null;
  pinned: boolean;
  archivedAt: string | null;
  autoDiscovered: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Best-guess category from URL when the record doesn't set one explicitly.
 *  Used for icon selection; the saved `category` wins when present. */
function inferWorkspaceCategory(url: string): WorkspaceCategory {
  if (/docs\.google\.com\/document/.test(url)) return 'Doc';
  if (/docs\.google\.com\/spreadsheets/.test(url)) return 'Sheet';
  if (/docs\.google\.com\/presentation/.test(url)) return 'Slides';
  if (/drive\.google\.com\/drive\/folders/.test(url)) return 'Folder';
  if (/^https?:\/\//.test(url)) return 'Web Page';
  return 'Other';
}

/** Relative time for the workspace row's activity hint. Short, no "about"s. */
function shortRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (!ts) return '';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 14) return `${diffDay}d ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 6) return `${diffWk}w ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Config
// ============================================================================

const PRI_CONFIG: Record<Priority, { bg: string; text: string; border: string }> = {
  P0: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  P1: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  P2: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  P3: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' },
};

type TaskType = 'email' | 'email-draft' | 'doc' | 'sheet' | 'meeting' | 'generic';

function inferType(t: TaskItem): TaskType {
  if (t.draftUrl) return 'email-draft';
  if (t.threadUrl) return 'email';
  if (t.attachUrl?.includes('docs.google.com/spreadsheets')) return 'sheet';
  if (t.attachUrl?.includes('docs.google.com')) return 'doc';
  if (t.attachUrl) return 'doc';
  const lower = t.task.toLowerCase();
  if (/\b(meet|prep|agenda|sync|standup|kickoff)\b/.test(lower)) return 'meeting';
  return 'generic';
}

const TYPE_CONFIG: Record<TaskType, { icon: typeof Mail; label: string }> = {
  email: { icon: Mail, label: 'Email' },
  'email-draft': { icon: Mail, label: 'Email (draft ready)' },
  doc: { icon: FileText, label: 'Doc' },
  sheet: { icon: BarChart3, label: 'Spreadsheet' },
  meeting: { icon: Calendar, label: 'Meeting' },
  generic: { icon: ClipboardList, label: 'Task' },
};

function actionFor(t: TaskItem): {
  label: string;
  variant: 'primary' | 'success' | 'neutral';
  href?: string;
  trailing?: boolean;
} {
  const type = inferType(t);
  if (type === 'email-draft') {
    return { label: 'Review in Gmail', variant: 'success', href: t.draftUrl!, trailing: true };
  }
  if (type === 'email') {
    return { label: 'Draft reply', variant: 'primary' };
  }
  if (type === 'doc') {
    if (t.attachUrl) return { label: 'Open in Drive', variant: 'neutral', href: t.attachUrl, trailing: true };
    return { label: 'Start draft', variant: 'primary' };
  }
  if (type === 'sheet') {
    return { label: 'Open workbook', variant: 'neutral', href: t.attachUrl!, trailing: true };
  }
  if (type === 'meeting') {
    return { label: 'Draft brief', variant: 'primary' };
  }
  if (t.threadUrl) return { label: 'Open thread', variant: 'neutral', href: t.threadUrl, trailing: true };
  return { label: 'Open', variant: 'neutral' };
}

// ============================================================================
// Helpers
// ============================================================================

/* Due dates come in from Airtable in inconsistent shapes:
 *   - ISO:      "2026-04-10" or "2026-04-10T00:00:00.000Z"
 *   - Text:     "Apr 10" / "April 10" / "Apr 10 2026"
 *   - US slash: "4/10" / "4/10/26" / "4/10/2026"
 *   - Empty string or junk.
 * The old parser matched any 4-digit run as "already has a year," which meant
 * a string like "4/10/2001" was passed through untouched and rendered as
 * "9131d late." Here we parse each shape explicitly. */
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Bot-submitted spam detector for Framer form tasks. Same heuristic as the
 *  server-side filter in lib/os/commandCenterGoogle, applied to the Notes
 *  field so legacy tasks from before the server filter existed also hide. */
const SPAM_COMMON_WORDS_RE =
  /\b(the|and|or|i|we|you|your|our|my|me|is|are|was|be|have|has|for|in|on|at|of|with|about|to|from|would|could|can|please|thanks|thank|hi|hello|help|need|want|like|interested|looking|business|company|service|product|marketing|website|email|contact|ask|question|quote)\b/i;

function hasRandomCamelCase(s: string): boolean {
  if (!/^[A-Za-z]+$/.test(s)) return false;
  let transitions = 0;
  for (let i = 1; i < s.length; i++) {
    if (/[a-z]/.test(s[i - 1]) && /[A-Z]/.test(s[i])) transitions++;
  }
  return transitions >= 2;
}

function submissionNotesLookSpammy(notes: string): boolean {
  if (!notes) return false;
  const lines = notes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const getValue = (line: string) => line.split(':').slice(1).join(':').trim();
  const name = lines.find((l) => /^name\s*:/i.test(l)) ? getValue(lines.find((l) => /^name\s*:/i.test(l))!) : '';
  const email = lines.find((l) => /^email\s*:/i.test(l)) ? getValue(lines.find((l) => /^email\s*:/i.test(l))!) : '';
  const message = lines.find((l) => /^(message|notes?|details?|description|comments?)\s*:/i.test(l))
    ? getValue(lines.find((l) => /^(message|notes?|details?|description|comments?)\s*:/i.test(l))!)
    : '';

  let signals = 0;
  if (message) {
    const words = message.split(/\s+/).filter((w) => w.length > 0);
    if (words.length <= 1 && message.length >= 10) signals++;
    if (!SPAM_COMMON_WORDS_RE.test(message) && message.length >= 15) signals++;
    if (hasRandomCamelCase(message.replace(/\s+/g, ''))) signals++;
  } else {
    signals++;
  }
  if (name && hasRandomCamelCase(name)) signals++;
  if (email) {
    const local = email.split('@')[0] || '';
    const dots = (local.match(/\./g) || []).length;
    if (dots >= 3) signals++;
  }
  return signals >= 2;
}

/** Pull a compact Topic + Message preview out of the Notes field on a
 *  website-submission task. Notes stores the full form body (Name, Email,
 *  Phone, Topic, Message on separate lines); the row only needs the topic
 *  value + message so Chris can scan and prioritize. */
function submissionRowPreview(notes: string): string {
  if (!notes) return '';
  const lines = notes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const getValue = (line: string) => line.split(':').slice(1).join(':').trim();
  const topicLine = lines.find((l) => /^(select\s+a\s+)?topic\s*:/i.test(l));
  const messageLine = lines.find((l) => /^(message|notes?|details?|description|comments?)\s*:/i.test(l));
  const parts: string[] = [];
  if (topicLine) {
    const val = getValue(topicLine);
    if (val) parts.push(val);
  }
  if (messageLine) {
    const val = getValue(messageLine);
    if (val) parts.push(`Message: ${val}`);
  }
  const preview = parts.join(' · ');
  return preview.length > 220 ? preview.slice(0, 217) + '…' : preview;
}

/** Returns null if the date is more than 2 years from now in either direction —
 *  that almost always means a data entry error (e.g. year 2001 from a stale
 *  Airtable value). Applied to ALL branches so no format sneaks past. */
function withinSanityWindow(d: Date | null, raw: string): Date | null {
  if (!d || isNaN(d.getTime())) return null;
  const twoYearsMs = 1000 * 60 * 60 * 24 * 365 * 2;
  if (Math.abs(d.getTime() - Date.now()) > twoYearsMs) {
    if (typeof console !== 'undefined') {
      console.warn(`[TasksClient] Ignoring unreasonable due date: "${raw}" → ${d.toISOString()}`);
    }
    return null;
  }
  return d;
}

function parseDue(d: string): Date | null {
  if (!d || typeof d !== 'string') return null;
  const s = d.trim();
  if (!s) return null;

  // ISO (YYYY-MM-DD)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return withinSanityWindow(
      new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
      s,
    );
  }

  // Text month: "Apr 10", "April 10, 2026"
  const text = s.match(/^([A-Za-z]{3,})\s+(\d{1,2})(?:[,\s]+(\d{4}))?/);
  if (text) {
    const m = MONTHS[text[1].slice(0, 3).toLowerCase()];
    if (m !== undefined) {
      const y = text[3] ? Number(text[3]) : new Date().getFullYear();
      return withinSanityWindow(new Date(y, m, Number(text[2])), s);
    }
  }

  // US-style: "4/10", "4/10/26", "4/10/2026"
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (slash) {
    let y = slash[3] ? Number(slash[3]) : new Date().getFullYear();
    if (y < 100) y += y < 50 ? 2000 : 1900; // 2-digit year: <50 → 20xx, else 19xx
    return withinSanityWindow(new Date(y, Number(slash[1]) - 1, Number(slash[2])), s);
  }

  // Last resort: trust the native parser.
  const native = new Date(s);
  if (!isNaN(native.getTime())) return withinSanityWindow(native, s);
  return null;
}

function daysUntil(d: string): number | null {
  const dt = parseDue(d);
  if (!dt) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);
  return Math.round((dt.getTime() - now.getTime()) / 86400000);
}

/** Pull the Gmail thread ID out of a thread URL like
 *  `https://mail.google.com/mail/u/0/#inbox/19d6a58c78785bd5`.
 *  We accept any trailing id-like segment so variations (labels, search, etc.)
 *  still resolve. */
function extractThreadId(url: string | null | undefined): string | null {
  if (!url) return null;
  const frag = url.split('#')[1];
  if (!frag) return null;
  const parts = frag.split('?')[0].split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  // Gmail thread/message IDs are hex-ish (a-f 0-9) and 10+ chars.
  if (last && /^[a-zA-Z0-9_-]{8,}$/.test(last)) return last;
  return null;
}

// ============================================================================
// UI primitives
// ============================================================================

function PriorityBadge({ pri, onChange }: { pri: Priority; onChange: (p: Priority) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const c = PRI_CONFIG[pri];
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex items-center justify-center w-[26px] h-[18px] rounded text-[10px] font-bold tracking-wide border transition-all cursor-pointer hover:brightness-125 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1)] ${c.bg} ${c.text} ${c.border}`}
        title="Click to change priority"
      >
        {pri}
      </button>
      {open && (
        <span className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 py-1 min-w-[90px]">
          {(['P0', 'P1', 'P2', 'P3'] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(p); setOpen(false); }}
              className="block w-full text-left px-3 py-1 text-xs hover:bg-gray-800 text-gray-200"
            >
              {p}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function formatDueLabel(due: string): string {
  const dt = parseDue(due);
  if (!dt) return due;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shiftDays(offset: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function DuePill({ due, onChange }: { due: string; onChange: (newDue: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const diff = daysUntil(due);

  let pillClasses = 'bg-gray-500/10 text-gray-400 border-gray-500/30';
  let pillText: string | null = null;
  if (diff !== null) {
    if (diff < 0) {
      pillClasses = 'bg-red-500/10 text-red-400 border-red-500/30';
      pillText = `${Math.abs(diff)}d late`;
    } else if (diff === 0) {
      pillClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      pillText = 'Due today';
    } else if (diff === 1) {
      pillClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      pillText = 'Tomorrow';
    } else if (diff <= 7) {
      pillText = formatDueLabel(due);
    } else {
      // far away — don't show a pill by default, but keep target clickable as a subtle dot.
      pillText = null;
    }
  }

  // When there's no pill to show, render a tiny "+ due" affordance on hover of the row.
  // Otherwise, clicking the pill opens the picker.
  if (pillText === null) {
    return (
      <span ref={ref} className="relative inline-flex">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Set due date"
        >
          + due
        </button>
        {open && <DuePopover due={due} onChange={onChange} onClose={() => setOpen(false)} />}
      </span>
    );
  }

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold tabular-nums border cursor-pointer hover:brightness-125 ${pillClasses}`}
        title="Click to reschedule"
      >
        {pillText}
      </button>
      {open && <DuePopover due={due} onChange={onChange} onClose={() => setOpen(false)} />}
    </span>
  );
}

function DuePopover({
  due, onChange, onClose,
}: { due: string; onChange: (newDue: string) => void; onClose: () => void }) {
  const [customOpen, setCustomOpen] = useState(false);
  const set = (newDue: string) => {
    onChange(newDue);
    onClose();
  };
  const options = [
    { label: 'Today', value: shiftDays(0) },
    { label: 'Tomorrow', value: shiftDays(1) },
    { label: 'In 3 days', value: shiftDays(3) },
    { label: 'Next week', value: shiftDays(7) },
  ];
  return (
    <span className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-30 py-1 min-w-[140px]">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={(e) => { e.stopPropagation(); set(opt.value); }}
          className="flex justify-between w-full text-left px-3 py-1 text-xs hover:bg-gray-800 text-gray-200"
        >
          <span>{opt.label}</span>
          <span className="text-gray-500 tabular-nums">{opt.value}</span>
        </button>
      ))}
      <div className="border-t border-gray-800 my-1" />
      {customOpen ? (
        <input
          type="date"
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const dt = new Date(v + 'T00:00:00');
            set(dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
          }}
          className="w-full px-3 py-1 text-xs bg-gray-800 text-gray-200 border-none focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setCustomOpen(true); }}
          className="block w-full text-left px-3 py-1 text-xs hover:bg-gray-800 text-gray-200"
        >
          Pick date…
        </button>
      )}
      {due && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); set(''); }}
          className="block w-full text-left px-3 py-1 text-xs hover:bg-gray-800 text-gray-500 border-t border-gray-800 mt-1"
        >
          Clear
        </button>
      )}
    </span>
  );
}

function InlineTitleEdit({
  initial, onSave, onCancel,
}: { initial: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initial) onSave(trimmed);
    else onCancel();
  };
  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      onBlur={commit}
      className="flex-1 min-w-0 text-sm font-medium text-gray-100 bg-gray-800/80 border border-indigo-500/40 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500"
    />
  );
}

type TagVariant = 'auto' | 'waiting' | 'draftReady' | 'neutral';

function Tag({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: TagVariant }) {
  const variants: Record<TagVariant, string> = {
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

function ActionButton({
  action, onClick, busy,
}: {
  action: ReturnType<typeof actionFor>;
  onClick?: (e: React.MouseEvent) => void;
  busy?: boolean;
}) {
  const classes = {
    primary: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50',
    neutral: 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600',
  } as const;

  const content = (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors whitespace-nowrap ${classes[action.variant]} ${busy ? 'opacity-70 cursor-wait' : ''}`}>
      {busy ? (
        <>
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Drafting…
        </>
      ) : (
        <>
          {action.label}
          {action.trailing && <ChevronRight className="w-3 h-3" />}
        </>
      )}
    </span>
  );

  if (action.href) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          e.stopPropagation();
          // Fire onClick side-effect (e.g. mark-read) BEFORE the browser
          // navigates to the new tab. onClick runs in parallel with nav.
          onClick?.(e);
        }}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
    >
      {content}
    </button>
  );
}

// ============================================================================
// Task row (launcher pattern)
// ============================================================================

function TaskRow({
  t, focused, editingTitle, busyDraft, onCheck, onPriChange, onDueChange, onTitleEditStart,
  onTitleSave, onTitleCancel, onOpenPanel, onActionClick, onMoveToTasks, showMoveAction,
}: {
  t: TaskItem;
  focused: boolean;
  editingTitle: boolean;
  busyDraft?: boolean;
  onCheck: () => void;
  onPriChange: (p: Priority) => void;
  onDueChange: (newDue: string) => void;
  onTitleEditStart: () => void;
  onTitleSave: (v: string) => void;
  onTitleCancel: () => void;
  onOpenPanel: () => void;
  onActionClick?: () => void;
  onMoveToTasks?: () => void;
  showMoveAction?: boolean;
}) {
  const type = inferType(t);
  const TypeIcon = TYPE_CONFIG[type].icon;
  const action = actionFor(t);
  const isDraftReady = type === 'email-draft';
  const isOverdue = (daysUntil(t.due) ?? 99) < 0;

  return (
    <div
      onClick={onOpenPanel}
      className={`group grid grid-cols-[18px_16px_1fr_auto_auto] items-center gap-3 px-3.5 py-3 rounded-xl border transition-all cursor-pointer
        ${isDraftReady ? 'bg-gradient-to-r from-emerald-500/[0.03] to-transparent border-emerald-500/20' : 'bg-gray-900 border-gray-800'}
        ${isOverdue && !isDraftReady ? 'border-l-2 border-l-red-500/50' : ''}
        hover:bg-gray-800/60 hover:border-gray-700
        ${focused ? 'ring-1 ring-indigo-500/40 border-indigo-500/40' : ''}
        ${t.checked ? 'opacity-50' : ''}
      `}
    >
      {/* Check */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onCheck(); }}
        className="w-[18px] h-[18px] rounded-full border border-gray-700 hover:border-emerald-500/60 transition-colors flex items-center justify-center"
        title="Mark done"
      >
        {t.checked && <CheckCircle2 className="w-[14px] h-[14px] text-emerald-400" />}
      </button>

      {/* Type icon */}
      <span
        title={TYPE_CONFIG[type].label}
        className="w-[16px] h-[16px] text-gray-500 flex items-center justify-center"
      >
        <TypeIcon className="w-[14px] h-[14px]" />
      </span>

      {/* Body */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <PriorityBadge pri={t.pri} onChange={onPriChange} />
          {editingTitle ? (
            <InlineTitleEdit initial={t.task} onSave={onTitleSave} onCancel={onTitleCancel} />
          ) : (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (!t.checked) onTitleEditStart();
              }}
              className={`text-sm font-medium truncate cursor-text border-b border-transparent hover:border-gray-600 transition-colors ${
                t.checked ? 'line-through text-gray-500' : 'text-gray-100'
              }`}
              title="Click to edit title (or press E)"
            >
              {t.task}
            </span>
          )}
          {isDraftReady && <Tag variant="draftReady">● Draft ready</Tag>}
          {t.autoCreated && <Tag variant="auto"><Zap className="w-[10px] h-[10px]" /> auto</Tag>}
          <DuePill due={t.due} onChange={onDueChange} />
          {t.status === 'Waiting' && <Tag variant="waiting"><Clock className="w-[10px] h-[10px]" /> waiting</Tag>}
        </div>
        {(() => {
          // Compute the prefix shown before the preview text.
          // Priority: explicit project → sender name (unless it's the useless
          // "Hive website" Framer label) → empty. Submissions always drop it
          // since the section header already says "Website submissions".
          const isSubmission = t.source === 'website-submission' || t.from === 'Hive website';
          const prefix = t.project
            ? t.project
            : isSubmission
              ? ''
              : (t.from || '');
          // For submissions, nextAction is stored blank (data lives in notes).
          // Derive a Topic + Message preview from notes at render time so the
          // row stays scannable without duplicating the data across fields.
          const preview = isSubmission
            ? submissionRowPreview(t.notes || '')
            : (t.nextAction || '');
          return (
            <div className="text-xs text-gray-500 truncate">
              {prefix}
              {preview && prefix && <span className="text-gray-700"> · </span>}
              {preview && <span>{preview}</span>}
            </div>
          );
        })()}
      </div>

      {/* Primary action */}
      {showMoveAction && onMoveToTasks ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveToTasks(); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
        >
          <ArrowRightCircle className="w-3.5 h-3.5" />
          Move to Tasks
        </button>
      ) : (
        <ActionButton action={action} busy={busyDraft} onClick={onActionClick} />
      )}

      {/* More menu (opens full edit panel) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenPanel(); }}
        className="w-[26px] h-[26px] rounded flex items-center justify-center text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-gray-700/60 hover:text-gray-200 transition-all"
        title="Open full edit panel"
      >
        <MoreHorizontal className="w-[16px] h-[16px]" />
      </button>
    </div>
  );
}

// ============================================================================
// Keyboard shortcuts strip
// ============================================================================

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 bg-gray-800 border border-gray-700 border-b-2 rounded text-[11px] font-mono text-gray-200">
      {children}
    </span>
  );
}

function ShortcutsStrip() {
  const rows: { keys: string[]; label: string }[] = [
    { keys: ['J', 'K'], label: 'move between rows' },
    { keys: ['1', '2', '3'], label: 'set priority' },
    { keys: ['E'], label: 'edit title inline' },
    { keys: ['X'], label: 'toggle done' },
    { keys: ['↵'], label: 'open full panel' },
  ];
  return (
    <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-xl p-3.5">
      <div className="flex items-center flex-wrap gap-x-6 gap-y-2 text-xs text-gray-400">
        <span className="text-gray-500">Shortcuts:</span>
        {rows.map((r, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            {r.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
            <span className="ml-1">{r.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function TasksClient({ company }: TasksClientProps) {
  const searchParams = useSearchParams();
  const deepLinkTaskId = searchParams.get('task');
  const deepLinkHandled = useRef(false);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewType>('inbox');
  const [search, setSearch] = useState('');
  const [editingAirtableId, setEditingAirtableId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [doneExpanded, setDoneExpanded] = useState(false);
  const [submissionsExpanded, setSubmissionsExpanded] = useState(false);

  // Workspace (pinned working documents)
  const [workspaceDocs, setWorkspaceDocs] = useState<WorkspaceDoc[]>([]);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);
  const [wsNewName, setWsNewName] = useState('');
  const [wsNewUrl, setWsNewUrl] = useState('');
  const [wsAdding, setWsAdding] = useState(false);
  const [wsAddOpen, setWsAddOpen] = useState(false);
  const [waitingExpanded, setWaitingExpanded] = useState(true);
  const [draftingId, setDraftingId] = useState<number | null>(null);
  const [draftError, setDraftError] = useState<{
    message: string;
    reconnectUrl?: string;
    grantedScopes?: string[];
    missingScopes?: string[];
    tokenSource?: string;
  } | null>(null);

  const [newTaskText, setNewTaskText] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [parseStatus, setParseStatus] = useState('');

  // Add task (preserved from original)
  const addTask = useCallback(async (text: string, view: ViewType) => {
    if (!text.trim() || addingTask) return;
    setAddingTask(true);
    setParseStatus('');
    try {
      let taskData = {
        task: text.trim(), priority: 'P2', status: 'Inbox',
        from: 'Chris Lloyd', project: '', nextAction: '', due: '',
      };
      if (view === 'braindump' && text.trim().length > 30) {
        setParseStatus('Parsing with AI...');
        try {
          const parseRes = await fetch('/api/os/tasks/parse-dump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.trim() }),
          });
          if (parseRes.ok) {
            const { parsed } = await parseRes.json();
            taskData = {
              task: parsed.task || taskData.task,
              priority: parsed.priority || 'P2',
              status: parsed.status || 'Inbox',
              from: parsed.from || 'Chris Lloyd',
              project: parsed.project || '',
              nextAction: parsed.nextAction || '',
              due: parsed.due || '',
            };
            setParseStatus('Creating task...');
          }
        } catch {
          // Fall through — save as raw text if AI fails
        }
      }
      const res = await fetch('/api/os/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskData, view, done: false }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      const data = await res.json();
      const t = data.task;
      const newItem: TaskItem = {
        id: tasks.length + 1,
        airtableId: t.id,
        task: t.task || taskData.task,
        pri: (t.priority || 'P2') as Priority,
        due: t.due || '',
        from: t.from || 'Chris Lloyd',
        project: t.project || '',
        nextAction: t.nextAction || '',
        status: (t.status || 'Inbox') as TaskStatus,
        threadUrl: t.threadUrl || null,
        draftUrl: t.draftUrl || null,
        attachUrl: t.attachUrl || null,
        notes: t.notes || '',
        assignedTo: t.assignedTo || '',
        checked: false,
        view: (t.view || view) as ViewType,
      };
      setTasks((prev) => [newItem, ...prev]);
      setNewTaskText('');
      setParseStatus('');
    } catch (err) {
      console.error('Failed to add task:', err);
      setParseStatus('');
    } finally {
      setAddingTask(false);
    }
  }, [addingTask, tasks.length]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/os/tasks', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      const mapped: TaskItem[] = (data.tasks || []).map((t: Record<string, unknown>, i: number) => ({
        id: i + 1,
        airtableId: (t.id as string) || undefined,
        task: (t.task as string) || '',
        pri: (t.priority as Priority) || 'P2',
        due: (t.due as string) || '',
        from: (t.from as string) || '',
        project: (t.project as string) || '',
        nextAction: (t.nextAction as string) || '',
        status: (t.status as TaskStatus) || 'Inbox',
        threadUrl: (t.threadUrl as string) || null,
        draftUrl: (t.draftUrl as string) || null,
        attachUrl: (t.attachUrl as string) || null,
        notes: (t.notes as string) || '',
        assignedTo: (t.assignedTo as string) || '',
        checked: (t.done as boolean) || false,
        view: (t.view as ViewType) || 'inbox',
        autoCreated: (t.autoCreated as boolean) || false,
        source: (t.source as TaskItem['source']) || null,
        sourceRef: (t.sourceRef as string) || null,
      }));
      setTasks(mapped);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Workspace docs — fetch on mount, refresh when user adds/opens/archives.
  const fetchWorkspaceDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/os/workspace', { cache: 'no-store' });
      console.log('[Workspace] GET /api/os/workspace status:', res.status);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn('[Workspace] GET failed:', res.status, text.slice(0, 200));
        return;
      }
      const json = await res.json();
      console.log('[Workspace] GET returned', json.count, 'docs. First:', json.docs?.[0]);
      setWorkspaceDocs(json.docs || []);
    } catch (err) {
      console.error('[Workspace] GET threw:', err);
    }
  }, []);
  useEffect(() => { fetchWorkspaceDocs(); }, [fetchWorkspaceDocs]);

  /** Open a workspace doc in a new tab and bump LastReviewed so it bubbles
   *  to the top of the list on next render. Optimistic client update + async
   *  server sync. */
  const openWorkspaceDoc = useCallback((doc: WorkspaceDoc) => {
    window.open(doc.url, '_blank');
    const nowIso = new Date().toISOString();
    // Optimistic: bump locally so the row re-sorts immediately.
    setWorkspaceDocs((prev) => {
      const updated = prev.map((d) => (d.id === doc.id ? { ...d, lastReviewed: nowIso } : d));
      updated.sort((a, b) => {
        const aTs = Date.parse(a.lastReviewed || a.createdAt || '') || 0;
        const bTs = Date.parse(b.lastReviewed || b.createdAt || '') || 0;
        return bTs - aTs;
      });
      return updated;
    });
    fetch('/api/os/workspace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: doc.id, action: 'touch' }),
    }).catch(() => {});
  }, []);

  const archiveWorkspaceDoc = useCallback(async (doc: WorkspaceDoc) => {
    // Optimistic remove
    setWorkspaceDocs((prev) => prev.filter((d) => d.id !== doc.id));
    try {
      await fetch('/api/os/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, action: 'archive' }),
      });
    } catch {
      // Rollback on failure
      setWorkspaceDocs((prev) => [...prev, doc]);
    }
  }, []);

  const submitNewWorkspaceDoc = useCallback(async () => {
    const name = wsNewName.trim();
    const url = wsNewUrl.trim();
    if (!url || wsAdding) return;
    setWsAdding(true);
    try {
      const res = await fetch('/api/os/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || url.split('/').filter(Boolean).pop() || 'Untitled',
          url,
          category: inferWorkspaceCategory(url),
        }),
      });
      const json = await res.json();
      if (res.ok && json.doc) {
        setWorkspaceDocs((prev) => [json.doc, ...prev]);
        setWsNewName('');
        setWsNewUrl('');
        setWsAddOpen(false);
      }
    } finally {
      setWsAdding(false);
    }
  }, [wsNewName, wsNewUrl, wsAdding]);

  // Gmail sync: fire-and-forget on mount.
  const gmailSyncFired = useRef(false);
  useEffect(() => {
    if (gmailSyncFired.current) return;
    gmailSyncFired.current = true;
    let cancelled = false;
    fetch('/api/os/tasks/sync-gmail', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data.synced > 0) fetchTasks(); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetchTasks]);

  // Auto-tasks sync: fire-and-forget on mount. Materializes Command Center
  // items (commitments, meeting follow-ups, stale triage) into My Day tasks.
  // The endpoint has its own 60-second cooldown so rapid reloads are safe.
  const autoSyncFired = useRef(false);
  const [manualSyncing, setManualSyncing] = useState(false);
  const [manualSyncSummary, setManualSyncSummary] = useState<string | null>(null);

  async function runManualSync() {
    setManualSyncing(true);
    try {
      const res = await fetch('/api/os/sync/auto-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // let server pick DMA_DEFAULT_COMPANY_ID
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.stats) {
        const s = json.stats;
        const parts: string[] = [];
        if (s.created) parts.push(`${s.created} new`);
        if (s.unarchived) parts.push(`${s.unarchived} re-surfaced`);
        if (s.errors) parts.push(`${s.errors} errors`);
        setManualSyncSummary(parts.length ? `Synced · ${parts.join(', ')}` : 'Synced · no changes');
        if (s.created > 0 || s.unarchived > 0 || s.updated > 0) fetchTasks();
        if ((s.workspaceCreated ?? 0) > 0 || (s.workspaceUnarchived ?? 0) > 0 || (s.workspaceArchivedStale ?? 0) > 0) {
          fetchWorkspaceDocs();
        }
      } else if (json.reason === 'cooldown') {
        const secs = Math.ceil((json.cooldownMsRemaining || 0) / 1000);
        setManualSyncSummary(`Synced recently — wait ${secs}s to re-run`);
      } else if (!res.ok) {
        setManualSyncSummary(`Sync error: ${json.error || res.status}`);
      }
    } catch (err) {
      setManualSyncSummary(`Sync failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setManualSyncing(false);
    }
  }

  useEffect(() => {
    if (autoSyncFired.current) return;
    autoSyncFired.current = true;
    let cancelled = false;
    fetch('/api/os/sync/auto-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const stats = data?.stats;
        if (stats && (stats.created > 0 || stats.unarchived > 0 || stats.updated > 0)) {
          fetchTasks(); // refresh so new auto-tasks appear immediately
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetchTasks]);

  // Deep link handler
  useEffect(() => {
    if (!deepLinkTaskId || deepLinkHandled.current || loading || tasks.length === 0) return;
    deepLinkHandled.current = true;
    const match = tasks.find((t) => t.airtableId === deepLinkTaskId);
    if (match) {
      if (match.view !== activeView) setActiveView(match.view);
      setEditingAirtableId(match.airtableId!);
    }
  }, [deepLinkTaskId, loading, tasks, activeView]);

  const toggleCheck = useCallback((id: number) => {
    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== id) return t;
        const nowChecked = !t.checked;
        if (nowChecked) {
          return {
            ...t, checked: true,
            status: 'Done' as TaskStatus, view: 'archive' as ViewType,
            priorStatusBeforeDone: t.status, priorViewBeforeDone: t.view,
          };
        }
        return {
          ...t, checked: false,
          status: t.priorStatusBeforeDone ?? 'Inbox',
          view: t.priorViewBeforeDone ?? 'inbox',
          priorStatusBeforeDone: undefined, priorViewBeforeDone: undefined,
        };
      });
      const task = updated.find((t) => t.id === id);
      if (task?.airtableId) {
        const payload: Record<string, unknown> = { id: task.airtableId, done: task.checked };
        if (task.checked) {
          payload.status = 'Done';
          payload.view = 'archive';
        } else {
          payload.status = task.status;
          payload.view = task.view;
        }
        fetch('/api/os/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch((err) => console.error('Failed to update task:', err));
      }
      return updated;
    });
  }, []);

  const changePri = useCallback((id: number, pri: Priority) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, pri } : t));
      const task = updated.find((t) => t.id === id);
      if (task?.airtableId) {
        fetch('/api/os/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: task.airtableId, priority: pri }),
        }).catch((err) => console.error('Failed to update priority:', err));
      }
      return updated;
    });
  }, []);

  const changeTitle = useCallback((id: number, newTitle: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, task: newTitle } : t));
      const task = updated.find((t) => t.id === id);
      if (task?.airtableId) {
        fetch('/api/os/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: task.airtableId, task: newTitle }),
        }).catch((err) => console.error('Failed to update title:', err));
      }
      return updated;
    });
  }, []);

  /** Fire-and-forget mark-as-read. Called when Chris opens a thread via
   *  "Review in Gmail" or "Open email thread" — we're confident he's engaged.
   *  Failures are silent (scope missing, etc.) so the navigation isn't blocked. */
  const markThreadRead = useCallback((taskItem: TaskItem) => {
    const threadId = extractThreadId(taskItem.threadUrl);
    if (!threadId) return;
    fetch('/api/os/gmail/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    }).catch(() => {});
  }, []);

  const changeDue = useCallback((id: number, newDue: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, due: newDue } : t));
      const task = updated.find((t) => t.id === id);
      if (task?.airtableId) {
        fetch('/api/os/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: task.airtableId, due: newDue }),
        }).catch((err) => console.error('Failed to update due date:', err));
      }
      return updated;
    });
  }, []);

  const draftReply = useCallback(async (taskItem: TaskItem) => {
    const isSubmission = taskItem.source === 'website-submission';
    // If we already have a draft URL, just open it — no point spending an LLM
    // call. EXCEPT for submissions: their earlier drafts may have been
    // created with stale logic (wrong To, no signature), so always re-draft
    // until the stored draft is known-good.
    if (taskItem.draftUrl && !isSubmission) {
      window.open(taskItem.draftUrl, '_blank');
      return;
    }
    const threadId = extractThreadId(taskItem.threadUrl);
    if (!threadId) {
      setDraftError({ message: 'No Gmail thread URL on this task. Draft requires a linked email thread.' });
      return;
    }
    // For submissions, prefer the specific messageId stored as sourceRef so
    // the AI drafts against THIS submission, not whatever the latest message
    // in the thread happens to be. Framer submissions with the same subject
    // get grouped into one Gmail thread, so thread-based picking would reply
    // to whichever submission is newest — usually the wrong one.
    const messageId =
      taskItem.source === 'website-submission' && taskItem.sourceRef
        ? taskItem.sourceRef
        : undefined;
    setDraftError(null);
    setDraftingId(taskItem.id);
    try {
      const res = await fetch('/api/os/gmail/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, ...(messageId ? { messageId } : {}) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDraftError({
          message: json?.error || `Draft failed (${res.status})`,
          reconnectUrl: typeof json?.reconnectUrl === 'string' ? json.reconnectUrl : undefined,
          grantedScopes: Array.isArray(json?.grantedScopes) ? json.grantedScopes : undefined,
          missingScopes: Array.isArray(json?.missingScopes) ? json.missingScopes : undefined,
          tokenSource: typeof json?.tokenSource === 'string' ? json.tokenSource : undefined,
        });
        return;
      }
      const newDraftUrl: string | undefined = json.draftUrl;
      if (newDraftUrl) {
        window.open(newDraftUrl, '_blank');
        // Persist draftUrl so the row flips to "Review in Gmail" next render.
        setTasks((prev) => prev.map((t) => (t.id === taskItem.id ? { ...t, draftUrl: newDraftUrl } : t)));
        if (taskItem.airtableId) {
          fetch('/api/os/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: taskItem.airtableId, draftUrl: newDraftUrl }),
          }).catch((err) => console.error('Failed to persist draftUrl:', err));
        }
      }
    } catch (err) {
      setDraftError({ message: err instanceof Error ? err.message : 'Failed to draft reply' });
    } finally {
      setDraftingId(null);
    }
  }, []);

  const moveToTasks = useCallback(async (taskItem: TaskItem) => {
    try {
      const res = await fetch('/api/os/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskItem.airtableId, view: 'inbox' }),
      });
      if (!res.ok) throw new Error('Failed to move task');
      setTasks((prev) => prev.map((t) => (t.id === taskItem.id ? { ...t, view: 'inbox' as ViewType } : t)));
    } catch (err) {
      console.error('Failed to move task:', err);
    }
  }, []);

  // Derived lists for the active view
  const viewTasks = useMemo(() => {
    if (activeView === 'inbox') {
      return tasks.filter((t) => t.view === 'inbox' && t.status !== 'Done');
    }
    return tasks.filter((t) => t.view === activeView);
  }, [tasks, activeView]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return viewTasks;
    return viewTasks.filter((t) =>
      t.task.toLowerCase().includes(q) ||
      t.from.toLowerCase().includes(q) ||
      t.nextAction.toLowerCase().includes(q) ||
      t.project.toLowerCase().includes(q)
    );
  }, [viewTasks, search]);

  // For the inbox view, split into today / waiting / website submissions / done.
  // Website submissions live in their own quiet section — never clutter Today.
  const isSubmission = (t: TaskItem) => t.source === 'website-submission';
  const activeInbox = useMemo(
    () => filtered.filter((t) => t.status !== 'Waiting' && !t.checked && !isSubmission(t)),
    [filtered],
  );
  const waitingInbox = useMemo(
    () => filtered.filter((t) => t.status === 'Waiting' && !t.checked && !isSubmission(t)),
    [filtered],
  );
  const websiteSubmissions = useMemo(
    () =>
      filtered.filter(
        (t) => isSubmission(t) && !t.checked && !submissionNotesLookSpammy(t.notes || ''),
      ),
    [filtered],
  );

  // Sort active by priority then due
  const sortedActive = useMemo(() => {
    const priOrder: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return [...activeInbox].sort((a, b) => {
      const pri = priOrder[a.pri] - priOrder[b.pri];
      if (pri !== 0) return pri;
      const ad = parseDue(a.due)?.getTime() ?? Infinity;
      const bd = parseDue(b.due)?.getTime() ?? Infinity;
      return ad - bd;
    });
  }, [activeInbox]);

  const doneToday = useMemo(
    () => tasks.filter((t) => t.checked && t.status === 'Done'),
    [tasks]
  );
  const draftsReady = useMemo(
    () => sortedActive.filter((t) => inferType(t) === 'email-draft').length,
    [sortedActive]
  );

  // Keyboard: J/K/1-3/X/E/Enter
  useEffect(() => {
    if (activeView !== 'inbox') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (editingAirtableId || editingTitleId != null) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        const idx = sortedActive.findIndex((t) => t.id === focusId);
        const next = sortedActive[Math.min(sortedActive.length - 1, idx + 1)];
        if (next) { e.preventDefault(); setFocusId(next.id); }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        const idx = sortedActive.findIndex((t) => t.id === focusId);
        const next = sortedActive[Math.max(0, idx - 1)];
        if (next) { e.preventDefault(); setFocusId(next.id); }
      } else if (['1', '2', '3'].includes(e.key) && focusId != null) {
        const map: Record<string, Priority> = { '1': 'P1', '2': 'P2', '3': 'P3' };
        changePri(focusId, map[e.key]);
      } else if (e.key === 'x' && focusId != null) {
        toggleCheck(focusId);
      } else if (e.key === 'e' && focusId != null) {
        e.preventDefault();
        setEditingTitleId(focusId);
      } else if (e.key === 'Enter' && focusId != null) {
        const t = sortedActive.find((x) => x.id === focusId);
        if (t?.airtableId) setEditingAirtableId(t.airtableId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeView, sortedActive, focusId, editingAirtableId, editingTitleId, changePri, toggleCheck]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading tasks...</p>
        </div>
      </div>
    );
  }

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const viewTabs: { id: ViewType; label: string; icon: typeof Mail }[] = [
    { id: 'inbox', label: 'Tasks', icon: Inbox },
    { id: 'braindump', label: 'Brain Dump', icon: Brain },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'archive', label: 'Archive', icon: ArchiveIcon },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-2">
          <div>
            <h1 className="text-2xl font-semibold text-gray-50 tracking-tight">My Day</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {dateStr}
              {company?.name && <span className="text-gray-600"> · {company.name}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/tasks/command-center"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <Target className="w-3.5 h-3.5" />
              Command Center
            </Link>
            <button
              type="button"
              onClick={() => runManualSync()}
              disabled={manualSyncing}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-md border border-gray-700 hover:border-gray-600 disabled:opacity-50"
              title="Pull in new commitments, meeting follow-ups, and stale triage emails as tasks"
            >
              <Zap className={`w-3.5 h-3.5 ${manualSyncing ? 'animate-pulse' : ''}`} />
              {manualSyncing ? 'Syncing' : 'Sync now'}
            </button>
          </div>
        </div>
        {manualSyncSummary && (
          <div className="mb-2 text-xs text-gray-500">{manualSyncSummary}</div>
        )}

        {/* Day summary */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 items-center text-xs text-gray-400 pb-4 mb-5 border-b border-gray-800">
          <span><span className="text-gray-100 font-medium tabular-nums">{sortedActive.length}</span> tasks</span>
          <span className="text-gray-700">·</span>
          <span><span className="text-emerald-400 font-medium tabular-nums">{draftsReady}</span> drafts ready to review</span>
          <span className="text-gray-700">·</span>
          <span><span className="text-purple-400 font-medium tabular-nums">{waitingInbox.length}</span> waiting on others</span>
          {websiteSubmissions.length > 0 && (
            <>
              <span className="text-gray-700">·</span>
              <span><span className="text-teal-400 font-medium tabular-nums">{websiteSubmissions.length}</span> website submissions</span>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto">
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            // Count excludes website submissions from the Tasks tab — they live
            // in their own section and shouldn't inflate the "inbox" count.
            const count = tasks.filter(
              (t) => t.view === tab.id && !t.checked && t.source !== 'website-submission',
            ).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveView(tab.id); setFocusId(null); }}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${
                    isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-800 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <div className="flex-1" />
          {/* Search */}
          <div className="relative flex-shrink-0 w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-800 rounded-md bg-gray-900 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600"
            />
          </div>
        </div>

        {/* Draft-reply error banner */}
        {draftError && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-red-300 flex-1">{draftError.message}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {draftError.reconnectUrl && (
                  <a
                    href={draftError.reconnectUrl}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 transition-colors"
                  >
                    Reconnect Google →
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setDraftError(null)}
                  className="text-red-400 hover:text-red-200 text-xs"
                >
                  dismiss
                </button>
              </div>
            </div>
            {draftError.grantedScopes && (
              <div className="border-t border-red-500/20 px-3 py-2 text-xs text-red-300/80 space-y-1">
                <div>
                  <span className="text-red-400/70">Granted scopes on your current token:</span>{' '}
                  {draftError.grantedScopes.length === 0 ? (
                    <em>(none)</em>
                  ) : (
                    <code className="font-mono text-[11px] text-red-200/90">
                      {draftError.grantedScopes.map(s => s.replace('https://www.googleapis.com/auth/', '')).join(', ')}
                    </code>
                  )}
                </div>
                {draftError.missingScopes && draftError.missingScopes.length > 0 && (
                  <div>
                    <span className="text-red-400/70">Missing:</span>{' '}
                    <code className="font-mono text-[11px] text-red-200">
                      {draftError.missingScopes.map(s => s.replace('https://www.googleapis.com/auth/', '')).join(', ')}
                    </code>
                  </div>
                )}
                {draftError.tokenSource && (
                  <div>
                    <span className="text-red-400/70">Token source:</span>{' '}
                    <code className="font-mono text-[11px] text-red-200/90">{draftError.tokenSource}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* New task input (only in inbox + braindump views) */}
        {(activeView === 'inbox' || activeView === 'braindump') && (
          <div className="mb-5 flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2">
            <Plus className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTask(newTaskText, activeView); }}
              placeholder={activeView === 'braindump' ? 'Brain dump — I\'ll parse it with AI…' : 'Add a task…'}
              disabled={addingTask}
              className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 focus:outline-none"
            />
            {parseStatus && <span className="text-xs text-amber-400">{parseStatus}</span>}
          </div>
        )}

        {/* Inbox view: today / waiting / done */}
        {activeView === 'inbox' && (
          <>
            {/* TODAY */}
            {sortedActive.length > 0 ? (
              <section className="mb-6">
                <div className="flex items-center gap-2.5 mb-3 px-0.5">
                  <h2 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Today</h2>
                  <span className="text-xs text-gray-500">{sortedActive.length} tasks · sorted by priority, then due</span>
                </div>
                <div className="space-y-2.5">
                  {sortedActive.map((t) => (
                    <TaskRow
                      key={t.id}
                      t={t}
                      focused={focusId === t.id}
                      editingTitle={editingTitleId === t.id}
                      busyDraft={draftingId === t.id}
                      onCheck={() => toggleCheck(t.id)}
                      onPriChange={(p) => changePri(t.id, p)}
                      onDueChange={(d) => changeDue(t.id, d)}
                      onTitleEditStart={() => { setFocusId(t.id); setEditingTitleId(t.id); }}
                      onTitleSave={(v) => { changeTitle(t.id, v); setEditingTitleId(null); }}
                      onTitleCancel={() => setEditingTitleId(null)}
                      onActionClick={() => {
                        const tt = inferType(t);
                        if (tt === 'email') draftReply(t);
                        else if (tt === 'email-draft') markThreadRead(t);
                        else if (tt === 'doc' || tt === 'sheet') { /* link nav, no side effect */ }
                        else if (t.airtableId) setEditingAirtableId(t.airtableId);
                      }}
                      onOpenPanel={() => {
                        setFocusId(t.id);
                        if (t.airtableId) setEditingAirtableId(t.airtableId);
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : (
              search ? (
                <div className="text-center py-10 text-gray-500 text-sm">No tasks match &ldquo;{search}&rdquo;</div>
              ) : (
                <div className="text-center py-10 text-gray-500 text-sm">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-emerald-500/50" />
                  Nothing active. Add a task above to get started.
                </div>
              )
            )}

            {/* WORKSPACE — pinned working docs, sorted by LastReviewed desc.
                Click a row → opens in a new tab + bumps LastReviewed so the
                list naturally reflects actual usage. */}
            <section className="mb-6">
              <div className="flex items-center gap-2.5 mb-3 px-0.5">
                <button
                  type="button"
                  onClick={() => setWorkspaceExpanded((x) => !x)}
                  className="flex items-center gap-2.5 cursor-pointer hover:text-gray-300"
                >
                  <h2 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-cyan-400/80">
                    Workspace
                  </h2>
                  <span className="text-xs text-gray-500">
                    {workspaceDocs.length} {workspaceDocs.length === 1 ? 'item' : 'items'}
                  </span>
                  <ChevronRight
                    className={`w-3 h-3 text-gray-600 transition-transform ${workspaceExpanded ? 'rotate-90' : ''}`}
                  />
                </button>
                <span className="flex-1" />
                {workspaceExpanded && !wsAddOpen && (
                  <button
                    type="button"
                    onClick={() => setWsAddOpen(true)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800/60"
                    title="Add a document"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                )}
              </div>

              {workspaceExpanded && wsAddOpen && (
                <div className="mb-2.5 bg-gray-900 border border-cyan-500/20 rounded-xl px-3 py-2 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={wsNewName}
                      onChange={(e) => setWsNewName(e.target.value)}
                      placeholder="Name (optional — inferred from URL if blank)"
                      className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => { setWsAddOpen(false); setWsNewName(''); setWsNewUrl(''); }}
                      className="w-5 h-5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700/60 flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-gray-500" />
                    <input
                      type="text"
                      value={wsNewUrl}
                      onChange={(e) => setWsNewUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && wsNewUrl.trim()) submitNewWorkspaceDoc();
                      }}
                      placeholder="Paste URL — https://…"
                      disabled={wsAdding}
                      className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={submitNewWorkspaceDoc}
                      disabled={wsAdding || !wsNewUrl.trim()}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
                    >
                      {wsAdding ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              {workspaceExpanded && workspaceDocs.length === 0 && !wsAddOpen && (
                <div className="text-xs text-gray-600 italic px-0.5 py-2">
                  No pinned docs yet. Click <strong>+ Add</strong> to pin one.
                </div>
              )}

              {workspaceExpanded && workspaceDocs.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {workspaceDocs.map((doc) => {
                    const cat = doc.category || inferWorkspaceCategory(doc.url);
                    // Each category gets its own accent color so the grid reads
                    // visually at a glance — blue Docs, green Sheets, etc.
                    const accent =
                      cat === 'Doc' ? { icon: 'text-blue-400', border: 'hover:border-blue-500/40', iconBg: 'bg-blue-500/10' } :
                      cat === 'Sheet' ? { icon: 'text-emerald-400', border: 'hover:border-emerald-500/40', iconBg: 'bg-emerald-500/10' } :
                      cat === 'Slides' ? { icon: 'text-amber-400', border: 'hover:border-amber-500/40', iconBg: 'bg-amber-500/10' } :
                      cat === 'Folder' ? { icon: 'text-sky-400', border: 'hover:border-sky-500/40', iconBg: 'bg-sky-500/10' } :
                      cat === 'Web Page' ? { icon: 'text-purple-400', border: 'hover:border-purple-500/40', iconBg: 'bg-purple-500/10' } :
                      { icon: 'text-gray-400', border: 'hover:border-gray-600', iconBg: 'bg-gray-700/30' };
                    const Icon =
                      cat === 'Doc' ? FileText :
                      cat === 'Sheet' ? Table2 :
                      cat === 'Slides' ? Presentation :
                      cat === 'Folder' ? Folder :
                      cat === 'Web Page' ? Globe :
                      Link2;
                    const activity = shortRelativeTime(doc.lastReviewed);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => openWorkspaceDoc(doc)}
                        className={`group relative bg-gray-900 border border-gray-800 ${accent.border} rounded-xl p-3 cursor-pointer transition-all hover:bg-gray-900/80 hover:shadow-lg flex flex-col gap-2 min-h-[110px]`}
                      >
                        {/* Header: icon + badges */}
                        <div className="flex items-center justify-between gap-2">
                          <div className={`w-8 h-8 rounded-lg ${accent.iconBg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${accent.icon}`} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            {doc.autoDiscovered && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-semibold border bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                                title="Auto-discovered from Drive activity"
                              >
                                <Zap className="w-[9px] h-[9px]" /> auto
                              </span>
                            )}
                            {doc.frequency && (
                              <span className="text-[9px] uppercase tracking-wider text-gray-600 font-medium">
                                {doc.frequency}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title + description */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-100 line-clamp-2 leading-tight">
                            {doc.name}
                          </div>
                          {doc.description && (
                            <div className="text-[11px] text-gray-500 mt-1 line-clamp-1">
                              {doc.description}
                            </div>
                          )}
                        </div>

                        {/* Footer: activity hint */}
                        {activity && (
                          <div className="text-[10px] text-gray-600 tabular-nums">
                            {activity}
                          </div>
                        )}

                        {/* Hover-only archive button, top-right corner */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); archiveWorkspaceDoc(doc); }}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded text-gray-600 opacity-0 group-hover:opacity-100 hover:text-gray-300 hover:bg-gray-700/80 flex items-center justify-center transition-all"
                          title="Archive from workspace"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* WAITING */}
            {waitingInbox.length > 0 && (
              <section className="mb-6">
                <button
                  type="button"
                  onClick={() => setWaitingExpanded((x) => !x)}
                  className="flex items-center gap-2.5 mb-3 px-0.5 cursor-pointer hover:text-gray-300"
                >
                  <h2 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-gray-400">Waiting on others</h2>
                  <span className="text-xs text-gray-500">{waitingInbox.length} items</span>
                  <ChevronRight className={`w-3 h-3 text-gray-600 transition-transform ${waitingExpanded ? 'rotate-90' : ''}`} />
                </button>
                {waitingExpanded && (
                  <div className="space-y-2.5">
                    {waitingInbox.map((t) => (
                      <TaskRow
                        key={t.id}
                        t={t}
                        focused={focusId === t.id}
                        editingTitle={editingTitleId === t.id}
                        onCheck={() => toggleCheck(t.id)}
                        onPriChange={(p) => changePri(t.id, p)}
                        onDueChange={(d) => changeDue(t.id, d)}
                        onTitleEditStart={() => { setFocusId(t.id); setEditingTitleId(t.id); }}
                        onTitleSave={(v) => { changeTitle(t.id, v); setEditingTitleId(null); }}
                        onTitleCancel={() => setEditingTitleId(null)}
                        onOpenPanel={() => {
                          setFocusId(t.id);
                          if (t.airtableId) setEditingAirtableId(t.airtableId);
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* WEBSITE SUBMISSIONS — low-priority, collapsible, default collapsed.
                Teal accent to visually separate from other task kinds. */}
            {websiteSubmissions.length > 0 && (
              <section className="mb-6">
                <button
                  type="button"
                  onClick={() => setSubmissionsExpanded((x) => !x)}
                  className="w-full flex items-center gap-2.5 mb-3 px-0.5 cursor-pointer hover:text-gray-300"
                >
                  <h2 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-teal-400">
                    Website submissions
                  </h2>
                  <span className="text-xs text-gray-500">{websiteSubmissions.length} items</span>
                  <span className="text-[10px] text-gray-600 italic">low priority</span>
                  <span className="flex-1" />
                  <ChevronRight
                    className={`w-3 h-3 text-gray-600 transition-transform ${submissionsExpanded ? 'rotate-90' : ''}`}
                  />
                </button>
                {submissionsExpanded && (
                  <div className="space-y-2.5">
                    {websiteSubmissions.map((t) => (
                      <TaskRow
                        key={t.id}
                        t={t}
                        focused={false}
                        editingTitle={editingTitleId === t.id}
                        busyDraft={draftingId === t.id}
                        onCheck={() => toggleCheck(t.id)}
                        onPriChange={(p) => changePri(t.id, p)}
                        onDueChange={(d) => changeDue(t.id, d)}
                        onTitleEditStart={() => setEditingTitleId(t.id)}
                        onTitleSave={(v) => { changeTitle(t.id, v); setEditingTitleId(null); }}
                        onTitleCancel={() => setEditingTitleId(null)}
                        onActionClick={() => {
                          // Submissions are email-type (threadUrl set) — draft a reply.
                          // Email-draft type already has href and goes through the link.
                          const tt = inferType(t);
                          if (tt === 'email') draftReply(t);
                          else if (tt === 'email-draft') markThreadRead(t);
                          else if (t.airtableId) setEditingAirtableId(t.airtableId);
                        }}
                        onOpenPanel={() => t.airtableId && setEditingAirtableId(t.airtableId)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* DONE TODAY */}
            {doneToday.length > 0 && (
              <button
                type="button"
                onClick={() => setDoneExpanded((x) => !x)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-transparent border border-dashed border-gray-800 rounded-xl text-sm text-gray-500 hover:bg-gray-900/60 hover:text-gray-400 transition-colors"
              >
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-[11px] h-[11px]" />
                </span>
                Done today <span className="text-gray-400 tabular-nums">({doneToday.length})</span>
                <span className="ml-auto text-xs text-gray-600">{doneExpanded ? 'collapse' : 'expand'} ›</span>
              </button>
            )}

            {doneExpanded && doneToday.length > 0 && (
              <div className="space-y-2.5 mt-2">
                {doneToday.map((t) => (
                  <TaskRow
                    key={t.id}
                    t={t}
                    focused={false}
                    editingTitle={editingTitleId === t.id}
                    busyDraft={draftingId === t.id}
                    onCheck={() => toggleCheck(t.id)}
                    onPriChange={(p) => changePri(t.id, p)}
                    onDueChange={(d) => changeDue(t.id, d)}
                    onTitleEditStart={() => setEditingTitleId(t.id)}
                    onTitleSave={(v) => { changeTitle(t.id, v); setEditingTitleId(null); }}
                    onTitleCancel={() => setEditingTitleId(null)}
                    onActionClick={() => {
                      const tt = inferType(t);
                      if (tt === 'email') draftReply(t);
                      else if (tt === 'email-draft') markThreadRead(t);
                      else if (tt === 'doc' || tt === 'sheet') { /* link nav */ }
                      else if (t.airtableId) setEditingAirtableId(t.airtableId);
                    }}
                    onOpenPanel={() => t.airtableId && setEditingAirtableId(t.airtableId)}
                  />
                ))}
              </div>
            )}

            {sortedActive.length > 0 && <ShortcutsStrip />}
          </>
        )}

        {/* Other views: flat list with Move-to-Tasks for braindump */}
        {activeView !== 'inbox' && (
          <div className="space-y-2.5">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                {search ? `No tasks match "${search}"` : 'Nothing here yet.'}
              </div>
            ) : (
              filtered.map((t) => (
                <TaskRow
                  key={t.id}
                  t={t}
                  focused={false}
                  editingTitle={editingTitleId === t.id}
                  busyDraft={draftingId === t.id}
                  onCheck={() => toggleCheck(t.id)}
                  onPriChange={(p) => changePri(t.id, p)}
                  onDueChange={(d) => changeDue(t.id, d)}
                  onTitleEditStart={() => setEditingTitleId(t.id)}
                  onTitleSave={(v) => { changeTitle(t.id, v); setEditingTitleId(null); }}
                  onTitleCancel={() => setEditingTitleId(null)}
                  onActionClick={() => {
                    const tt = inferType(t);
                    if (tt === 'email') draftReply(t);
                    else if (tt === 'email-draft') markThreadRead(t);
                    else if (tt === 'doc' || tt === 'sheet') { /* link nav */ }
                    else if (t.airtableId) setEditingAirtableId(t.airtableId);
                  }}
                  onOpenPanel={() => t.airtableId && setEditingAirtableId(t.airtableId)}
                  showMoveAction={activeView === 'braindump'}
                  onMoveToTasks={() => moveToTasks(t)}
                />
              ))
            )}
          </div>
        )}

      </div>

      {/* Edit panel */}
      <TaskEditPanel
        taskId={editingAirtableId}
        onClose={() => setEditingAirtableId(null)}
        onSaved={() => fetchTasks()}
      />
    </div>
  );
}
