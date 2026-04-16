'use client';
// app/tasks/command-center/RiskStrip.tsx
// "What is quietly going wrong?" — severity-sorted risks from /api/os/tasks/risks.
// Renders collapsed by default so the strip is unobtrusive when all is well.
// Each task-scoped risk is clickable → opens the existing TaskEditPanel.

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

type RiskSeverity = 'low' | 'medium' | 'high';

interface RiskItem {
  kind: string;
  severity: RiskSeverity;
  reason: string;
  entityType: 'task' | 'email';
  entityId: string;
  entityTitle: string;
  signals: Record<string, unknown>;
}

interface RiskResponse {
  generatedAt: string;
  windowDays: number;
  totalTasks: number;
  liveTaskCount: number;
  risks: RiskItem[];
}

function severityClass(s: RiskSeverity): string {
  switch (s) {
    case 'high':
      return 'bg-red-500/10 border-red-500/40 text-red-300';
    case 'medium':
      return 'bg-amber-500/10 border-amber-500/40 text-amber-300';
    case 'low':
      return 'bg-sky-500/10 border-sky-500/40 text-sky-300';
  }
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'stalled.waiting':
      return 'Waiting';
    case 'stalled.inbox':
      return 'Stale Inbox';
    case 'stalled.overdue':
      return 'Overdue';
    case 'drift.draft-unsent':
      return 'Draft unsent';
    case 'thrash.status':
      return 'Thrashing';
    default:
      return kind;
  }
}

export function RiskStrip({ onEdit }: { onEdit: (taskId: string) => void }) {
  const [data, setData] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/os/tasks/risks', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Risk request failed: ${res.status}`);
      const json: RiskResponse = await res.json();
      setData(json);
      // Auto-open if any high-severity risks exist.
      if (json.risks.some(r => r.severity === 'high')) setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load risks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return null;
  if (!data) {
    return (
      <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-gray-500">
        Scanning for risks…
      </div>
    );
  }

  const highCount = data.risks.filter(r => r.severity === 'high').length;
  const medCount = data.risks.filter(r => r.severity === 'medium').length;
  const lowCount = data.risks.filter(r => r.severity === 'low').length;

  const headerColor =
    highCount > 0
      ? 'border-red-500/30 bg-red-500/[0.04]'
      : medCount > 0
        ? 'border-amber-500/30 bg-amber-500/[0.04]'
        : 'border-white/10 bg-white/[0.02]';

  return (
    <div className={`mb-6 rounded-lg border ${headerColor} p-4`}>
      {/* Header row: toggle button + sibling reload button (NOT nested — nested
          <button> inside <button> is invalid HTML and breaks hydration). */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
          aria-expanded={open}
        >
          <AlertTriangle
            className={`w-4 h-4 shrink-0 ${highCount ? 'text-red-400' : medCount ? 'text-amber-400' : 'text-gray-500'}`}
          />
          <h2 className="text-sm font-semibold text-gray-200">Risks & stalls</h2>
          <span className="text-xs text-gray-500 truncate">
            {data.risks.length === 0
              ? 'nothing flagged'
              : `${highCount} high · ${medCount} medium · ${lowCount} low`}
          </span>
          <span className="ml-auto shrink-0">
            {open ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded border border-white/10 hover:border-white/20 shrink-0"
          aria-label="Reload risks"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {open && data.risks.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {data.risks.map((r, i) => {
            const clickable = r.entityType === 'task';
            return (
              <li key={`${r.kind}:${r.entityId}:${i}`}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onEdit(r.entityId)}
                  className={`w-full text-left flex items-start gap-3 p-2 rounded border border-white/5 bg-white/[0.02] ${
                    clickable ? 'hover:bg-white/[0.05] hover:border-white/10' : 'opacity-80 cursor-default'
                  } transition-colors`}
                >
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 mt-0.5 ${severityClass(r.severity)}`}
                  >
                    {r.severity}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-gray-400 shrink-0 mt-0.5">
                    {kindLabel(r.kind)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-100 truncate">{r.entityTitle}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{r.reason}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && data.risks.length === 0 && (
        <div className="mt-3 text-xs text-gray-500">
          Nothing flagged. Waiting items are moving, inbox is being triaged,
          overdue items have recent motion.
        </div>
      )}
    </div>
  );
}
