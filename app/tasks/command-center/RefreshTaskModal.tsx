'use client';

// RefreshTaskModal — re-read a task's Gmail thread and propose field updates.
// When the thread was deleted in Gmail, shows an archive path instead of HTTP 502.

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Archive, Loader2, X } from 'lucide-react';
import { isThreadGoneRefreshResponse } from '@/lib/os/gmailThreadGone';

type Stage = 'loading' | 'proposal' | 'noChange' | 'thread-gone' | 'error';

type RefreshOk = {
  proposal: Record<string, unknown>;
  fields: string[];
  changeSummary: string;
  reasoning: string;
  confidence?: 'high' | 'medium' | 'low';
};

export interface RefreshTaskModalProps {
  taskId: string;
  taskTitle: string;
  /** Prefer flat /api/refresh-task when set (extension / legacy clients). */
  useFlatRefreshApi?: boolean;
  onClose: () => void;
  onApplied?: () => void;
  onArchived?: () => void;
}

function refreshUrl(taskId: string, useFlat: boolean): string {
  return useFlat
    ? '/api/refresh-task'
    : `/api/os/tasks/${encodeURIComponent(taskId)}/refresh-from-thread`;
}

async function postRefresh(taskId: string, useFlat: boolean): Promise<Response> {
  const url = refreshUrl(taskId, useFlat);
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: useFlat ? JSON.stringify({ taskId }) : undefined,
    cache: 'no-store',
  });
}

export function RefreshTaskModal({
  taskId,
  taskTitle,
  useFlatRefreshApi = false,
  onClose,
  onApplied,
  onArchived,
}: RefreshTaskModalProps) {
  const [stage, setStage] = useState<Stage>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [threadGoneDetail, setThreadGoneDetail] = useState<string | null>(null);
  const [noChangeReason, setNoChangeReason] = useState<string | null>(null);
  const [refreshData, setRefreshData] = useState<RefreshOk | null>(null);
  const [applying, setApplying] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    setStage('loading');
    setErrorMessage(null);
    setThreadGoneDetail(null);
    setNoChangeReason(null);
    setRefreshData(null);
    try {
      const res = await postRefresh(taskId, useFlatRefreshApi);
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
        noChange?: boolean;
        reasoning?: string;
        proposal?: Record<string, unknown>;
        fields?: string[];
        changeSummary?: string;
        confidence?: 'high' | 'medium' | 'low';
      };

      if (isThreadGoneRefreshResponse(res.status, body)) {
        setThreadGoneDetail(
          body.error?.trim() ||
            'The Gmail thread this task was created from is no longer in your mailbox.',
        );
        setStage('thread-gone');
        return;
      }

      if (!res.ok) {
        setErrorMessage(body.error?.trim() || `Refresh failed (HTTP ${res.status})`);
        setStage('error');
        return;
      }

      if (body.noChange) {
        setNoChangeReason(body.reasoning?.trim() || 'No material changes in the thread.');
        setStage('noChange');
        return;
      }

      if (!body.proposal || !body.fields?.length) {
        setNoChangeReason(body.reasoning?.trim() || 'Nothing to update.');
        setStage('noChange');
        return;
      }

      setRefreshData({
        proposal: body.proposal,
        fields: body.fields,
        changeSummary: body.changeSummary ?? 'Suggested updates',
        reasoning: body.reasoning ?? '',
        confidence: body.confidence,
      });
      setStage('proposal');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Refresh failed');
      setStage('error');
    }
  }, [taskId, useFlatRefreshApi]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyChanges() {
    if (!refreshData) return;
    setApplying(true);
    setErrorMessage(null);
    try {
      const patch: Record<string, unknown> = {};
      for (const key of refreshData.fields) {
        if (key === 'threadId') continue;
        if (Object.prototype.hasOwnProperty.call(refreshData.proposal, key)) {
          patch[key] = refreshData.proposal[key];
        }
      }
      if (refreshData.proposal.threadUrl) {
        patch.threadUrl = refreshData.proposal.threadUrl;
      }
      const res = await fetch(`/api/os/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Apply failed (${res.status})`);
      }
      onApplied?.();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Apply failed');
      setStage('error');
    } finally {
      setApplying(false);
    }
  }

  async function archiveTask() {
    setArchiving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/os/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Archive', view: 'archive' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Archive failed (${res.status})`);
      }
      onArchived?.();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Archive failed');
      setStage('error');
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refresh-task-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-700 px-4 py-3">
          <div className="min-w-0">
            <h2 id="refresh-task-title" className="text-sm font-semibold text-gray-100">
              Refresh from Gmail
            </h2>
            <p className="mt-0.5 truncate text-xs text-gray-500" title={taskTitle}>
              {taskTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          {stage === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading Gmail thread…
            </div>
          )}

          {stage === 'thread-gone' && (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <div>
                  <p className="font-medium">Source thread no longer accessible</p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    Gmail deleted or archived this thread after the task was created. You can
                    archive the task so it stops showing up for refresh.
                  </p>
                  {threadGoneDetail && (
                    <p className="mt-2 text-xs text-amber-200/60">{threadGoneDetail}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void archiveTask()}
                disabled={archiving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-amber-400 disabled:opacity-60"
              >
                {archiving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                Archive task
              </button>
            </div>
          )}

          {stage === 'noChange' && (
            <div className="space-y-3 text-sm text-gray-300">
              <p className="font-medium text-gray-200">No updates needed</p>
              <p className="text-gray-400">{noChangeReason}</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          )}

          {stage === 'proposal' && refreshData && (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-emerald-300">{refreshData.changeSummary}</p>
              <p className="text-gray-400">{refreshData.reasoning}</p>
              <ul className="list-inside list-disc text-xs text-gray-500">
                {refreshData.fields.map((f) => (
                  <li key={f}>
                    {f}:{' '}
                    <span className="text-gray-400">
                      {String(refreshData.proposal[f] ?? '').slice(0, 120)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void applyChanges()}
                  disabled={applying}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {applying ? 'Applying…' : 'Apply changes'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {stage === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-red-400">{errorMessage}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
