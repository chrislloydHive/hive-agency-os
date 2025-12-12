'use client';

// components/context/CompetitorEditor.tsx
// Structured competitor editor for the Context form
//
// Features:
// - Add/remove competitors
// - Edit all competitor fields
// - Source pill (AI/Baseline/Manual)
// - Drag to reorder (via up/down buttons)
// - Validation (domain required)

import { useCallback } from 'react';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Globe,
  Building2,
} from 'lucide-react';
import type { Competitor, CompetitorType, CompetitorSource } from '@/lib/types/context';
import { createEmptyCompetitor } from '@/lib/types/context';

// ============================================================================
// Types
// ============================================================================

interface CompetitorEditorProps {
  competitors: Competitor[];
  onChange: (competitors: Competitor[]) => void;
  disabled?: boolean;
}

// ============================================================================
// Source Badge Component
// ============================================================================

function SourceBadge({ source }: { source: CompetitorSource }) {
  const colors: Record<CompetitorSource, string> = {
    ai: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    baseline: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    manual: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const labels: Record<CompetitorSource, string> = {
    ai: 'AI',
    baseline: 'Baseline',
    manual: 'Manual',
  };

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium border rounded ${colors[source]}`}>
      {labels[source]}
    </span>
  );
}

// ============================================================================
// Type Select Component
// ============================================================================

function TypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: CompetitorType;
  onChange: (type: CompetitorType) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as CompetitorType)}
      disabled={disabled}
      className="px-2 py-1 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
    >
      <option value="direct">Direct</option>
      <option value="indirect">Indirect</option>
      <option value="adjacent">Adjacent</option>
    </select>
  );
}

// ============================================================================
// Slider Component
// ============================================================================

function Slider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
      />
      <span className="text-[10px] text-slate-400 w-8 text-right">{value}</span>
    </div>
  );
}

// ============================================================================
// Toggle Component
// ============================================================================

function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded transition-colors disabled:opacity-50 ${
        value
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'bg-slate-800/50 text-slate-500 border border-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// Competitor Card Component
// ============================================================================

function CompetitorCard({
  competitor,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  disabled,
}: {
  competitor: Competitor;
  index: number;
  total: number;
  onChange: (updated: Competitor) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled?: boolean;
}) {
  const updateField = useCallback(
    <K extends keyof Competitor>(field: K, value: Competitor[K]) => {
      onChange({ ...competitor, [field]: value, source: competitor.source === 'ai' || competitor.source === 'baseline' ? competitor.source : 'manual' });
    },
    [competitor, onChange]
  );

  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-2">
        {/* Domain and Name */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              value={competitor.domain}
              onChange={e => updateField('domain', e.target.value.toLowerCase())}
              placeholder="competitor.com"
              disabled={disabled}
              className="flex-1 px-2 py-1 text-sm bg-slate-800/50 border border-slate-700 rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
            />
            <SourceBadge source={competitor.source} />
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              value={competitor.name || ''}
              onChange={e => updateField('name', e.target.value || undefined)}
              placeholder="Company Name (optional)"
              disabled={disabled}
              className="flex-1 px-2 py-1 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
            />
            <TypeSelect
              value={competitor.type}
              onChange={v => updateField('type', v)}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || isFirst}
            className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || isLast}
            className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="p-1 text-slate-500 hover:text-red-400 disabled:opacity-50"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scores row */}
      <div className="grid grid-cols-2 gap-3">
        <Slider
          label="Offer Overlap"
          value={competitor.offerOverlap ?? 50}
          onChange={v => updateField('offerOverlap', v)}
          disabled={disabled}
        />
        <Slider
          label="Geo Relevance"
          value={competitor.geoRelevance ?? 50}
          onChange={v => updateField('geoRelevance', v)}
          disabled={disabled}
        />
      </div>

      {/* Toggles row */}
      <div className="flex items-center gap-2">
        <Toggle
          label="JTBD Match"
          value={competitor.jtbdMatch}
          onChange={v => updateField('jtbdMatch', v)}
          disabled={disabled}
        />
        <span className="text-[10px] text-slate-600">|</span>
        <span className="text-[10px] text-slate-500">
          Confidence: {competitor.confidence ?? 50}%
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompetitorEditor({
  competitors,
  onChange,
  disabled,
}: CompetitorEditorProps) {
  const handleAdd = useCallback(() => {
    onChange([...competitors, createEmptyCompetitor()]);
  }, [competitors, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(competitors.filter((_, i) => i !== index));
    },
    [competitors, onChange]
  );

  const handleUpdate = useCallback(
    (index: number, updated: Competitor) => {
      const newCompetitors = [...competitors];
      newCompetitors[index] = updated;
      onChange(newCompetitors);
    },
    [competitors, onChange]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newCompetitors = [...competitors];
      [newCompetitors[index - 1], newCompetitors[index]] = [
        newCompetitors[index],
        newCompetitors[index - 1],
      ];
      onChange(newCompetitors);
    },
    [competitors, onChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === competitors.length - 1) return;
      const newCompetitors = [...competitors];
      [newCompetitors[index], newCompetitors[index + 1]] = [
        newCompetitors[index + 1],
        newCompetitors[index],
      ];
      onChange(newCompetitors);
    },
    [competitors, onChange]
  );

  return (
    <div className="space-y-3">
      {/* Competitor list */}
      {competitors.length > 0 ? (
        <div className="space-y-2">
          {competitors.map((competitor, index) => (
            <CompetitorCard
              key={index}
              competitor={competitor}
              index={index}
              total={competitors.length}
              onChange={updated => handleUpdate(index, updated)}
              onRemove={() => handleRemove(index)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              disabled={disabled}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-slate-500">
          No competitors added yet
        </div>
      )}

      {/* Add button */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
        Add Competitor
      </button>
    </div>
  );
}
