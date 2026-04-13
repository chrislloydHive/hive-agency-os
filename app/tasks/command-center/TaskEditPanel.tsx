'use client';
// Slide-in panel for editing a task from Airtable without leaving the Command Center.

import { useEffect, useState, useCallback } from 'react';
import { X, Save, ExternalLink, Loader2 } from 'lucide-react';

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
  threadUrl: string | null;
  notes: string;
  createdAt: string | null;
  lastModified: string | null;
}

const STATUS_OPTIONS: TaskStatus[] = ['Inbox', 'Next', 'Waiting', 'Done', 'Archive'];
const PRIORITY_OPTIONS: TaskPriority[] = ['P0', 'P1', 'P2', 'P3'];

interface Props {
  taskId: string | null;    // null = closed
  onClose: () => void;
  onSaved?: () => void;     // parent refresh hook
}

export function TaskEditPanel({ taskId, onClose, onSaved }: Props) {
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Form fields
  const [taskTitle, setTaskTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Inbox');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [due, setDue] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [notes, setNotes] = useState('');

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
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (taskId) loadTask(taskId);
    else setTask(null);
  }, [taskId, loadTask]);

  // Close on Escape
  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, onClose]);

  async function handleSave() {
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        task: taskTitle,
        status,
        nextAction,
        notes,
        due: due || null,
      };
      if (priority) body.priority = priority;
      const res = await fetch(`/api/os/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(msg || `Save failed: ${res.status}`);
      }
      setDirty(false);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true); };
  }

  if (!taskId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0f0f0f] border-l border-white/10 z-50 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-semibold text-gray-100">Edit Task</h3>
          <button
            onClick={onClose}
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
          {task && !loading && (
            <>
              {/* Task title */}
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Task</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={e => mark(setTaskTitle)(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Status + Priority */}
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

              {/* Due */}
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Due</label>
                <input
                  type="date"
                  value={due ? due.slice(0, 10) : ''}
                  onChange={e => mark(setDue)(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Next Action */}
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Next Action</label>
                <textarea
                  value={nextAction}
                  onChange={e => mark(setNextAction)(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => mark(setNotes)(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-gray-100 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              {/* Read-only meta */}
              <div className="pt-2 border-t border-white/5 text-xs text-gray-500 space-y-1">
                {task.project && <div>Project: <span className="text-gray-400">{task.project}</span></div>}
                {task.from && <div>From: <span className="text-gray-400">{task.from}</span></div>}
                {task.threadUrl && (
                  <a
                    href={task.threadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                  >
                    Open email thread <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {dirty ? 'Unsaved changes' : task ? 'Up to date' : ''}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 rounded border border-white/10 hover:border-white/20"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !task || !dirty}
              className="px-3 py-1.5 text-xs text-white rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/5 disabled:text-gray-500 flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving' : 'Save'}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
