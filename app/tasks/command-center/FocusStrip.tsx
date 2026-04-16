'use client';
// app/tasks/command-center/FocusStrip.tsx
// Compact "what to work on right now" strip that sits above the Command Center
// dashboard. Calls /api/os/tasks/focus and renders the top-ranked live tasks
// with their score and top reason chips.
//
// Clicking a card opens the existing TaskEditPanel via the parent's onEdit.
// That click also emits a `task.opened-in-ui` event so the prioritization
// brain learns what Chris engages with.

import { useEffect, useState } from 'react';
import { Target, RefreshCw } from 'lucide-react';

interface FocusReason {
  tag: string;
  label: string;
  points: number;
}

interface FocusItem {
  id: string;
  title: string;
  priority: string | null;
  due: string | null;
  status: string;
  project: string;
  from: string;
  nextAction: string;
  threadUrl: string | null;
  score: number;
  reasons: FocusReason[];
  signals: unknown;
}

interface FocusResponse {
  generatedAt: string;
  liveTaskCount: number;
  limit: number;
  items: FocusItem[];
}

const MAX_VISIBLE = 5;

function priorityClass(p: string | null): string {
  switch (p) {
    case 'P0':
      return 'bg-red-500/10 border-red-500/40 text-red-300';
    case 'P1':
      return 'bg-amber-500/10 border-amber-500/40 text-amber-300';
    case 'P2':
      return 'bg-sky-500/10 border-sky-500/40 text-sky-300';
    case 'P3':
      return 'bg-white/5 border-white/10 text-gray-400';
    default:
      return 'bg-white/5 border-white/10 text-gray-400';
  }
}

function reasonChipClass(points: number): string {
  if (points >= 50) return 'bg-red-500/10 border-red-500/30 text-red-300';
  if (points >= 20) return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
  if (points > 0) return 'bg-sky-500/10 border-sky-500/30 text-sky-300';
  return 'bg-white/5 border-white/10 text-gray-500';
}

async function emitOpenedEvent(item: FocusItem) {
  // Fire-and-forget. Never blocks the UI click.
  try {
    await fetch('/api/os/activity/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'task.opened-in-ui',
        actor: 'Chris',
        actorType: 'user',
        entityType: 'task',
        entityId: item.id,
        entityTitle: item.title,
        summary: `Opened "${item.title}" from Focus strip (score ${item.score})`,
        metadata: {
          source: 'focus-strip',
          score: item.score,
          reasons: item.reasons.map(r => r.tag),
          priority: item.priority,
          due: item.due,
        },
        source: 'components/FocusStrip',
      }),
    });
  } catch {
    // Never break the UI on a logging failure.
  }
}

export function FocusStrip({ onEdit }: { onEdit: (taskId: string) => void }) {
  const [data, setData] = useState<FocusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/os/tasks/focus?limit=${MAX_VISIBLE}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Focus request failed: ${res.status}`);
      const json: FocusResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load focus');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Never blow up the page if focus fails; just render nothing.
  if (error) return null;

  return (
    <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-emerald-200">Focus now</h2>
          {data && (
            <span className="text-xs text-gray-500">
              top {data.items.length} of {data.liveTaskCount} live tasks
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded border border-white/10 hover:border-white/20"
          aria-label="Reload focus list"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading' : 'Reload'}
        </button>
      </div>

      {loading && !data ? (
        <div className="text-xs text-gray-500 py-2">Computing focus…</div>
      ) : data && data.items.length === 0 ? (
        <div className="text-xs text-gray-500 py-2">
          Nothing live. Inbox zero — or everything is marked Done.
        </div>
      ) : (
        <ol className="space-y-2">
          {data?.items.map((item, i) => {
            const topReasons = item.reasons
              .filter(r => r.points !== 0)
              .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
              .slice(0, 3);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    void emitOpenedEvent(item);
                    onEdit(item.id);
                  }}
                  className="w-full text-left flex items-start gap-3 p-2 rounded border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-colors"
                >
                  <span className="text-xs text-gray-600 font-mono mt-0.5 w-5 shrink-0">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${priorityClass(item.priority)}`}
                      >
                        {item.priority || '—'}
                      </span>
                      <span className="text-sm text-gray-100 truncate">{item.title}</span>
                      {item.due && (
                        <span className="text-[11px] text-gray-500">· due {item.due}</span>
                      )}
                    </div>
                    {topReasons.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {topReasons.map(r => (
                          <span
                            key={r.tag}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${reasonChipClass(r.points)}`}
                            title={`${r.points > 0 ? '+' : ''}${r.points}`}
                          >
                            {r.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-mono tabular-nums shrink-0">
                    {item.score}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
