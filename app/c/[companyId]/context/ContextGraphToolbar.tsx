'use client';

// app/c/[companyId]/context/ContextGraphToolbar.tsx
// Toolbar for the Context Graph Explorer with mode toggle, snapshot selector, and filters

import { type GraphMode, type SnapshotInfo } from '@/lib/contextGraph/graphView';

interface ContextGraphToolbarProps {
  mode: GraphMode;
  onModeChange: (mode: GraphMode) => void;
  snapshots: SnapshotInfo[];
  activeSnapshotId: string;
  onSnapshotChange: (snapshotId: string) => void;
  highlightHumanOverrides: boolean;
  onHighlightHumanOverridesChange: (value: boolean) => void;
}

export function ContextGraphToolbar({
  mode,
  onModeChange,
  snapshots,
  activeSnapshotId,
  onSnapshotChange,
  highlightHumanOverrides,
  onHighlightHumanOverridesChange,
}: ContextGraphToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2 border-b border-slate-800 bg-slate-900/50">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Mode</span>
        <div className="flex rounded-md overflow-hidden border border-slate-700">
          <button
            type="button"
            onClick={() => onModeChange('field')}
            className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
              mode === 'field'
                ? 'bg-amber-500/20 text-amber-300 border-r border-amber-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-r border-slate-700'
            }`}
          >
            Field Graph
          </button>
          <button
            type="button"
            onClick={() => onModeChange('provenance')}
            className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
              mode === 'provenance'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Provenance
          </button>
        </div>
      </div>

      {/* Snapshot Selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Snapshot</span>
        <select
          value={activeSnapshotId}
          onChange={(e) => onSnapshotChange(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
        >
          <option value="now">Now (Live)</option>
          {snapshots.map((snapshot) => (
            <option key={snapshot.id} value={snapshot.id}>
              {snapshot.label || formatSnapshotDate(snapshot.createdAt)}
              {snapshot.reason && ` (${snapshot.reason})`}
            </option>
          ))}
        </select>
      </div>

      {/* Highlight Human Overrides */}
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={highlightHumanOverrides}
          onChange={(e) => onHighlightHumanOverridesChange(e.target.checked)}
          className="h-3 w-3 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
        />
        <span className="text-[11px] text-slate-400">Highlight human overrides</span>
      </label>
    </div>
  );
}

function formatSnapshotDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
