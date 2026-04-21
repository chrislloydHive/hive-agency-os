'use client';
// Slide-in panel for editing or creating a task.
// - Edit mode: pass `taskId`. Fetches from /api/os/tasks/:id, auto-saves on change (debounced).
// - Create mode: pass `mode="create"` + `prefill`. POSTs to /api/os/tasks via Create.

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Save, ExternalLink, Loader2, CheckSquare, Square, FolderPlus, Layout, ChevronDown, Users, Calendar, AlertCircle, Check } from 'lucide-react';
import { TaskDecider } from './TaskDecider';
import type { TaskView } from '@/lib/airtable/tasks';

// ── PM OS deep links ─────────────────────────────────────────────────────────
// These point into the Airtable interface Chris uses for project management.
// The Inbox form creates a new project (with automations that generate the
// project number and Drive folders). The interface URL is the main working view.
const PMOS_PROJECTS_URL = 'https://airtable.com/appQLwoVH8JyGSTIo/pagD8gby09ctslXG2';

type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';
type TaskStatus = 'Inbox' | 'Next' | 'Waiting' | 'Done' | 'Archive';

interface TaskRecord {
  id: string;
  task: string;
  priority: TaskPriority | null;
  due: string | null;
  from: string;
  project: string;
  nextAction: string;
  status: TaskStatus;
  /** Airtable "View" — inbox / braindump / projects / archive */
  view?: TaskView;
  threadUrl: string | null;
  notes: string;
  assignedTo: string;
  createdAt: string | null;
  lastModified: string | null;
}

interface PersonOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

const STATUS_OPTIONS: TaskStatus[] = ['Inbox', 'Next', 'Waiting', 'Done', 'Archive'];
const PRIORITY_OPTIONS: TaskPriority[] = ['P0', 'P1', 'P2', 'P3'];

type Mode = 'edit' | 'create';

interface EmailMeta {
  threadId: string;
  messageId: string;
  link: string;   // gmail thread URL → becomes threadUrl on the task
}

interface Props {
  mode?: Mode;                             // default 'edit'
  taskId?: string | null;                  // edit mode: required to open
  prefill?: Record<string, unknown>;       // create mode: initial values
  emailMeta?: EmailMeta;                   // create mode: attach thread URL + source metadata
  onClose: () => void;
  onSaved?: () => void;
}

const AUTOSAVE_DEBOUNCE_MS = 600;

export function TaskEditPanel({ mode = 'edit', taskId, prefill, emailMeta, onClose, onSaved }: Props) {
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  /** Browser `setTimeout` id (avoids Node `Timeout` vs DOM `number` mismatch in tsc). */
  const debounceTimerRef = useRef<number | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  /** Last tab/view before a task was moved to Done, used to restore on un-complete */
  const nonDoneViewRef = useRef<TaskView>('inbox');

  // Form fields
  const [taskTitle, setTaskTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Inbox');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [due, setDue] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [notes, setNotes] = useState('');
  const [project, setProject] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // People directory for the Assigned To dropdown
  const [people, setPeople] = useState<PersonOption[]>([]);
  useEffect(() => {
    fetch('/api/os/people')
      .then(r => r.ok ? r.json() : { people: [] })
      .then(d => setPeople(d.people || []))
      .catch(() => {});
  }, []);

  const isCreate = mode === 'create';
  const open = isCreate ? !!prefill : !!taskId;

  const loadTask = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/os/tasks/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const { task: t } = await res.json();
      setTask(t);
      setTaskTitle(t.task || '');
      setStatus(t.status || 'Inbox');
      setPriority((t.priority as TaskPriority) || '');
      setDue(t.due || '');
      setNextAction(t.nextAction || '');
      setNotes(t.notes || '');
      setProject(t.project || '');
      setAssignedTo(t.assignedTo || '');
      const tv = (t.view || 'inbox') as TaskView;
      if (t.status !== 'Done' && t.status !== 'Archive') {
        nonDoneViewRef.current = tv;
      }
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, []);

  // Edit mode: fetch when taskId changes
  useEffect(() => {
    if (isCreate) return;
    if (taskId) loadTask(taskId);
    else setTask(null);
  }, [isCreate, taskId, loadTask]);

  // Create mode: hydrate form from prefill when it arrives
  useEffect(() => {
    if (!isCreate || !prefill) return;
    setTaskTitle(String(prefill.task || prefill.title || ''));
    setStatus((prefill.status as TaskStatus) || 'Inbox');
    setPriority((prefill.priority as TaskPriority) || 'P2');
    setDue(typeof prefill.due === 'string' ? prefill.due : '');
    setNextAction(String(prefill.nextAction || ''));
    setNotes(String(prefill.notes || ''));
    setProject(String(prefill.project || ''));
    setDirty(true); // enable Save immediately
    setError(null);
  }, [isCreate, prefill]);

  const buildEditBody = useCallback((): Record<string, unknown> => {
    const resolvedView: TaskView =
      status === 'Done' || status === 'Archive' ? 'archive' : nonDoneViewRef.current;
    const body: Record<string, unknown> = {
      task: taskTitle,
      status,
      nextAction,
      notes,
      due: due || null,
      project: project || undefined,
      assignedTo: assignedTo || null,
      view: resolvedView,
      // Keep Airtable's Done checkbox in sync with Status. Status remains the
      // source of truth (see excludeDone filter), but some views still read
      // the Done field — mirror it here so the two never disagree.
      done: status === 'Done',
    };
    if (priority) body.priority = priority;
    return body;
  }, [taskTitle, status, nextAction, notes, due, project, priority, assignedTo]);

  const persistEdit = useCallback(async () => {
    if (!task || isCreate) return;
    const sent = buildEditBody();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/os/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sent),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(msg || `Save failed: ${res.status}`);
      }
      const current = buildEditBody();
      if (JSON.stringify(sent) === JSON.stringify(current)) {
        setDirty(false);
      }
      onSavedRef.current?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [task, isCreate, buildEditBody]);

  // Edit mode: debounced auto-save when the form is dirty
  useEffect(() => {
    if (isCreate || !task || loading || !dirty) return;
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void persistEdit();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [isCreate, task?.id, loading, dirty, persistEdit]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        task: taskTitle,
        status,
        nextAction,
        notes,
        due: due || null,
        project: project || undefined,
        done: status === 'Done',
        view: (status === 'Done' || status === 'Archive' ? 'archive' : 'inbox') as TaskView,
      };
      if (priority) body.priority = priority;
      if (emailMeta?.link) body.threadUrl = emailMeta.link;
      const res = await fetch(`/api/os/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(msg || `Save failed: ${res.status}`);
      }
      setDirty(false);
      onSavedRef.current?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const handleClose = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!isCreate && task && dirty) {
      await persistEdit();
    }
    onClose();
  }, [isCreate, task, dirty, persistEdit, onClose]);

  // Close on Escape (flush pending edit save first)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true); };
  }

  if (!open) return null;

  const headerLabel = isCreate ? 'Create Task from Email' : 'Edit Task';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={() => void handleClose()} />
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0f0f0f] border-l border-white/10 z-50 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-semibold text-gray-100">{headerLabel}</h3>
          <button
            onClick={() => void handleClose()}
            className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-gray-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          )}
          {error && (
            <div className="p-3 rounded border border-red-500/30 bg-red-500/5 text-xs text-red-300">
              {error}
            </div>
          )}
          {(isCreate || (task && !loading)) && (
            <>
              {/* Mark-as-complete toggle. Mirrors the row checkbox in the task list:
                  checking it sets Status=Done (and Done=true); unchecking reverts
                  to Next (the normal "ready to do" state). The Status dropdown
                  below stays authoritative, so users can still pick Waiting/Archive. */}
              <button
                type="button"
                onClick={() => mark(setStatus)(status === 'Done' ? 'Next' : 'Done')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
                  status === 'Done'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
                aria-pressed={status === 'Done'}
              >
                {status === 'Done' ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-gray-500" />
                )}
                <span>{status === 'Done' ? 'Completed' : 'Mark as complete'}</span>
              </button>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Task</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={e => mark(setTaskTitle)(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={e => mark(setStatus)(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={e => mark(setPriority)(e.target.value as TaskPriority | '')}
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30"
                  >
                    <option value="">—</option>
                    {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Due</label>
                <input
                  type="date"
                  value={due ? due.slice(0, 10) : ''}
                  onChange={e => mark(setDue)(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Assigned To</label>
                <select
                  value={assignedTo}
                  onChange={e => mark(setAssignedTo)(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30"
                >
                  <option value="">— unassigned —</option>
                  {people.map(p => (
                    <option key={p.id} value={p.name}>{p.name}{p.role ? ` (${p.role})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Next Action</label>
                <textarea
                  value={nextAction}
                  onChange={e => mark(setNextAction)(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => mark(setNotes)(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              {isCreate && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Project (optional)</label>
                  <input
                    type="text"
                    value={project}
                    onChange={e => mark(setProject)(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-white/5 text-xs text-gray-500 space-y-1">
                {!isCreate && task?.project && <div>Project: <span className="text-gray-400">{task.project}</span></div>}
                {!isCreate && task?.from && <div>From: <span className="text-gray-400">{task.from}</span></div>}
                {!isCreate && task?.threadUrl && (
                  <a href={task.threadUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300">
                    Open email thread <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {isCreate && emailMeta?.link && (
                  <a href={emailMeta.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300">
                    Source email <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* ── PM OS actions ── */}
              {!isCreate && (
                <PmOsActions taskTitle={taskTitle} project={task?.project || project} />
              )}

              {/* Decision engine: "what should I do about this task, right now?" — edit mode only */}
              {!isCreate && task?.id && (
                <TaskDecider
                  taskId={task.id}
                  onApplied={() => {
                    // Apply mutates the task server-side (or creates a Gmail draft and
                    // stores draftUrl on it). Reuse the existing save hook so parent
                    // re-fetches — no new plumbing needed.
                    onSavedRef.current?.();
                  }}
                />
              )}
            </>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {isCreate
              ? (dirty ? 'Review fields, then create' : '')
              : saving
                ? 'Saving…'
                : dirty
                  ? 'Unsaved changes — saving soon'
                  : task
                    ? 'Saved'
                    : ''}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleClose()}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 rounded border border-white/10 hover:border-white/20"
            >
              {isCreate ? 'Cancel' : 'Close'}
            </button>
            {isCreate && (
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={saving || !dirty}
                className="px-3 py-1.5 text-xs text-white rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/5 disabled:text-gray-500 flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Creating' : 'Create'}
              </button>
            )}
          </div>
        </footer>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PmOsActions
// Contextual links into the Client PM OS Airtable interface. Surfaces:
//   - "Create in PM OS" when the task looks like a project-creation action
//   - "Open PM OS" always, as a quick-access link to the interface
// ─────────────────────────────────────────────────────────────────────────────

/** Keywords in a task title that suggest it's a "create project" action. */
const CREATE_PROJECT_KEYWORDS = [
  'add project', 'create project', 'new project', 'set up project',
  'setup project', 'start project', 'launch project', 'build project',
  'add marine', 'add cartoys', 'add car toys',
];

function looksLikeProjectCreation(title: string): boolean {
  const lower = title.toLowerCase();
  return CREATE_PROJECT_KEYWORDS.some(kw => lower.includes(kw));
}

// ── PM OS context types (mirrors /api/os/pmos/context response) ─────────────

interface PmOsProject {
  id: string;
  name: string;
  status: string | null;
  priority: string | null;
  client: string | null;
  startDate: string | null;
  dueDate: string | null;
  description: string | null;
  taskCount: number;
}

interface PmOsTask {
  id: string;
  name: string;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  owner: string | null;
}

interface PmOsContextData {
  project: PmOsProject | null;
  tasks: PmOsTask[];
  interfaceUrl: string;
}

// ── Status / priority pill colors ───────────────────────────────────────────

function statusColor(s: string | null): string {
  if (!s) return 'bg-white/5 text-gray-400';
  const l = s.toLowerCase();
  if (l.includes('done') || l.includes('complete')) return 'bg-emerald-500/15 text-emerald-300';
  if (l.includes('progress') || l.includes('active')) return 'bg-sky-500/15 text-sky-300';
  if (l.includes('blocked') || l.includes('stuck')) return 'bg-red-500/15 text-red-300';
  if (l.includes('review')) return 'bg-amber-500/15 text-amber-300';
  return 'bg-white/5 text-gray-400';
}

function priorityColor(p: string | null): string {
  if (!p) return '';
  const l = p.toLowerCase();
  if (l === 'high' || l === 'urgent' || l === 'p0') return 'text-red-400';
  if (l === 'medium' || l === 'p1') return 'text-amber-400';
  return 'text-gray-500';
}

// ── PM OS select options (from Airtable schema) ────────────────────────────

const PMOS_STATUSES = [
  'New', 'Not Started', 'In Progress', 'Blocked', 'Done', 'Reviewed', 'Promoted', 'Archived',
] as const;

const PMOS_PRIORITIES = ['High', 'Medium', 'Low'] as const;

const PMOS_OWNERS = [
  'Adam', 'Chris', 'Grace', 'Shannon', 'Andy', 'Louie', 'Jim', 'Production Partner',
] as const;

// ── Inline task row with quick-edit ─────────────────────────────────────────

function PmOsTaskRow({
  task,
  onUpdated,
}: {
  task: PmOsTask;
  onUpdated: (id: string, patch: Partial<PmOsTask>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(task.status || '');
  const [localPriority, setLocalPriority] = useState(task.priority || '');
  const [localDue, setLocalDue] = useState(task.dueDate || '');
  const [localOwner, setLocalOwner] = useState(task.owner || '');
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Reset local state when task changes externally
  useEffect(() => {
    setLocalStatus(task.status || '');
    setLocalPriority(task.priority || '');
    setLocalDue(task.dueDate || '');
    setLocalOwner(task.owner || '');
  }, [task.status, task.priority, task.dueDate, task.owner]);

  async function handleSave() {
    setSaving(true);
    setSaveErr(null);

    const patch: Record<string, unknown> = {};
    if (localStatus !== (task.status || '')) patch.status = localStatus || null;
    if (localPriority !== (task.priority || '')) patch.priority = localPriority || null;
    if (localDue !== (task.dueDate || '')) patch.dueDate = localDue || null;
    if (localOwner !== (task.owner || '')) patch.owner = localOwner || null;

    if (Object.keys(patch).length === 0) {
      setEditing(false);
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/os/pmos/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(msg || `Save failed: ${res.status}`);
      }
      // Update parent state optimistically
      onUpdated(task.id, {
        status: localStatus || null,
        priority: localPriority || null,
        dueDate: localDue || null,
        owner: localOwner || null,
      });
      setEditing(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const statusDot = (() => {
    const s = (editing ? localStatus : task.status)?.toLowerCase() || '';
    if (s.includes('done') || s.includes('reviewed') || s.includes('promoted')) return 'bg-emerald-400';
    if (s.includes('progress')) return 'bg-sky-400';
    if (s.includes('blocked')) return 'bg-red-400';
    return 'bg-gray-600';
  })();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full flex items-center gap-2 py-1.5 px-2 rounded bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left group"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
        <span className="text-[11px] text-gray-300 truncate flex-1">{task.name}</span>
        {task.status && (
          <span className={`text-[10px] px-1 py-0.5 rounded ${statusColor(task.status)} opacity-60 group-hover:opacity-100`}>
            {task.status}
          </span>
        )}
        {task.owner && (
          <span className="text-[10px] text-gray-600 shrink-0 truncate max-w-[60px]">{task.owner}</span>
        )}
      </button>
    );
  }

  // Edit mode — inline dropdowns
  return (
    <div className="rounded border border-purple-500/30 bg-purple-500/[0.03] p-2 space-y-2">
      <div className="text-[11px] text-gray-300 font-medium truncate">{task.name}</div>

      <div className="grid grid-cols-2 gap-1.5">
        <select
          value={localStatus}
          onChange={e => setLocalStatus(e.target.value)}
          className="px-1.5 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-gray-200 focus:outline-none focus:border-purple-500/40"
        >
          <option value="">Status…</option>
          {PMOS_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={localPriority}
          onChange={e => setLocalPriority(e.target.value)}
          className="px-1.5 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-gray-200 focus:outline-none focus:border-purple-500/40"
        >
          <option value="">Priority…</option>
          {PMOS_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={localOwner}
          onChange={e => setLocalOwner(e.target.value)}
          className="px-1.5 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-gray-200 focus:outline-none focus:border-purple-500/40"
        >
          <option value="">Owner…</option>
          {PMOS_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        <input
          type="date"
          value={localDue ? localDue.slice(0, 10) : ''}
          onChange={e => setLocalDue(e.target.value)}
          className="px-1.5 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-gray-200 focus:outline-none focus:border-purple-500/40"
        />
      </div>

      {saveErr && (
        <div className="text-[10px] text-red-400">{saveErr}</div>
      )}

      <div className="flex gap-1.5 justify-end">
        <button
          type="button"
          onClick={() => { setEditing(false); setSaveErr(null); }}
          className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 rounded border border-white/10 hover:border-white/20"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-2 py-0.5 text-[10px] text-purple-200 rounded border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-50 flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
          {saving ? 'Saving' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── PmOsProjectContext — fetches and renders PM OS context inline ────────────

function PmOsProjectContext({ projectName }: { projectName: string }) {
  const [ctx, setCtx] = useState<PmOsContextData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectName || projectName === fetchedRef.current) return;
    fetchedRef.current = projectName;
    setLoading(true);
    setErr(null);
    fetch(`/api/os/pmos/context?project=${encodeURIComponent(projectName)}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`PM OS lookup failed: ${res.status}`);
        return res.json() as Promise<PmOsContextData>;
      })
      .then(data => setCtx(data))
      .catch(e => setErr(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [projectName]);

  // Optimistic update handler — patches a task in local state after save
  const handleTaskUpdated = useCallback((taskId: string, patch: Partial<PmOsTask>) => {
    setCtx(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t),
      };
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-gray-500">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading PM OS context…
      </div>
    );
  }

  if (err) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-red-400/70">
        <AlertCircle className="w-3 h-3" /> {err}
      </div>
    );
  }

  if (!ctx?.project) return null;

  const p = ctx.project;
  const tasks = ctx.tasks;

  return (
    <div className="space-y-2">
      {/* Project header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 text-left group"
      >
        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        <span className="text-xs text-gray-300 font-medium truncate flex-1">{p.name}</span>
        {p.status && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor(p.status)}`}>
            {p.status}
          </span>
        )}
      </button>

      {expanded && (
        <div className="ml-5 space-y-2">
          {/* Project metadata chips */}
          <div className="flex flex-wrap gap-1.5">
            {p.client && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300">
                <Users className="w-2.5 h-2.5" /> {p.client}
              </span>
            )}
            {p.priority && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded bg-white/5 ${priorityColor(p.priority)}`}>
                {p.priority}
              </span>
            )}
            {p.dueDate && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                <Calendar className="w-2.5 h-2.5" /> {p.dueDate}
              </span>
            )}
            {p.taskCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                {p.taskCount} task{p.taskCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Description snippet */}
          {p.description && (
            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
              {p.description}
            </p>
          )}

          {/* Task list — click any row to quick-edit */}
          {tasks.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-gray-600 font-medium">
                Tasks <span className="text-gray-700 normal-case font-normal">· click to edit</span>
              </div>
              <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1">
                {tasks.map(t => (
                  <PmOsTaskRow key={t.id} task={t} onUpdated={handleTaskUpdated} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PmOsActions ─────────────────────────────────────────────────────────────

function PmOsActions({
  taskTitle,
  project,
}: {
  taskTitle: string;
  project: string;
}) {
  const showCreate = looksLikeProjectCreation(taskTitle);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Layout className="w-3.5 h-3.5 text-purple-300" />
        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">PM OS</h4>
      </div>

      {showCreate && (
        <a
          href={PMOS_PROJECTS_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-500/50 transition-colors"
        >
          <FolderPlus className="w-4 h-4 text-purple-300" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-purple-200 font-medium">Create project in PM OS</div>
            <div className="text-[10px] text-purple-300/60 mt-0.5">Opens Projects — click Create → Project to start the form</div>
          </div>
          <ExternalLink className="w-3 h-3 text-purple-300/60 shrink-0" />
        </a>
      )}

      {/* Inline PM OS project context — shows linked tasks, status, client */}
      {project && <PmOsProjectContext projectName={project} />}

      <a
        href={PMOS_PROJECTS_URL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 px-3 py-2 rounded border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-colors"
      >
        <Layout className="w-3.5 h-3.5 text-gray-400" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-300">Open PM OS interface</div>
          {project && (
            <div className="text-[10px] text-gray-500 mt-0.5 truncate">
              Project: {project}
            </div>
          )}
        </div>
        <ExternalLink className="w-3 h-3 text-gray-500 shrink-0" />
      </a>
    </div>
  );
}
