// components/context-map/ContextMapToolbar.tsx
// Filter controls for the Context Map

'use client';

import { Filter, RotateCcw, Eye, EyeOff, Sparkles, User, TestTube, FileInput } from 'lucide-react';
import type { MapFilters, StatusFilter, SourceFilter } from './types';
import { COLORS, SOURCE_LABELS } from './constants';

interface ContextMapToolbarProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  onResetView: () => void;
  stats: {
    total: number;
    confirmed: number;
    proposed: number;
    bySource: Record<string, number>;
  };
}

const SOURCE_OPTIONS: { value: SourceFilter; label: string; icon: typeof Sparkles }[] = [
  { value: 'ai', label: 'AI', icon: Sparkles },
  { value: 'user', label: 'User', icon: User },
  { value: 'lab', label: 'Lab', icon: TestTube },
  { value: 'import', label: 'Import', icon: FileInput },
];

export function ContextMapToolbar({
  filters,
  onFiltersChange,
  onResetView,
  stats,
}: ContextMapToolbarProps) {
  const handleStatusChange = (status: StatusFilter) => {
    onFiltersChange({ ...filters, status });
  };

  const handleSourceToggle = (source: SourceFilter) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];
    onFiltersChange({ ...filters, sources: newSources });
  };

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, minConfidence: parseFloat(e.target.value) });
  };

  const handleEdgesToggle = () => {
    onFiltersChange({ ...filters, showEdges: !filters.showEdges });
  };

  const confidencePercent = Math.round(filters.minConfidence * 100);

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-900/80 border-b border-slate-800">
      {/* Status Filter */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500 mr-2">Status:</span>
        <button
          onClick={() => handleStatusChange('all')}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            filters.status === 'all'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
          }`}
        >
          All ({stats.total})
        </button>
        <button
          onClick={() => handleStatusChange('confirmed')}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            filters.status === 'confirmed'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
          }`}
        >
          Confirmed ({stats.confirmed})
        </button>
        <button
          onClick={() => handleStatusChange('proposed')}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            filters.status === 'proposed'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
          }`}
        >
          Proposed ({stats.proposed})
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-700" />

      {/* Source Filter */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500 mr-2">Source:</span>
        {SOURCE_OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = filters.sources.length === 0 || filters.sources.includes(value);
          const count = stats.bySource[value] || 0;
          return (
            <button
              key={value}
              onClick={() => handleSourceToggle(value)}
              title={`${SOURCE_LABELS[value]} (${count})`}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-slate-700 text-slate-200'
                  : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-700" />

      {/* Confidence Slider */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Min:</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={filters.minConfidence}
          onChange={handleConfidenceChange}
          className="w-20 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
        />
        <span className="text-xs text-slate-400 w-8">{confidencePercent}%</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Edges Toggle */}
      <button
        onClick={handleEdgesToggle}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
          filters.showEdges
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800 border border-slate-700'
        }`}
      >
        {filters.showEdges ? (
          <Eye className="w-3.5 h-3.5" />
        ) : (
          <EyeOff className="w-3.5 h-3.5" />
        )}
        Edges
      </button>

      {/* Reset View */}
      <button
        onClick={onResetView}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-md border border-slate-700 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset
      </button>
    </div>
  );
}
