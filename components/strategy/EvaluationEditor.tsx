'use client';

// components/strategy/EvaluationEditor.tsx
// Reusable editor for Pros/Cons/Tradeoffs/Risks evaluation fields
//
// Used in both Builder and Blueprint views for editing strategy evaluation data.

import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  ThumbsUp,
  ThumbsDown,
  Scale,
  AlertTriangle,
  Shield,
  Lightbulb,
  Link2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { StrategyEvaluation, StrategyRisk } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

interface EvaluationEditorProps {
  evaluation: StrategyEvaluation;
  onChange: (evaluation: StrategyEvaluation) => void;
  onAiSuggest?: () => void;
  aiLoading?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  title?: string;
}

// ============================================================================
// List Editor Component
// ============================================================================

function ListEditor({
  items,
  onChange,
  placeholder,
  readOnly,
  icon: Icon,
  colorClass,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  readOnly?: boolean;
  icon: React.ElementType;
  colorClass: string;
}) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (newItem.trim() && !readOnly) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (index: number) => {
    if (!readOnly) {
      onChange(items.filter((_, i) => i !== index));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border ${colorClass}`}
        >
          <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span className="text-sm flex-1">{item}</span>
          {!readOnly && (
            <button
              onClick={() => handleRemove(idx)}
              className="text-slate-500 hover:text-slate-300 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 px-2.5 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
          <button
            onClick={handleAdd}
            disabled={!newItem.trim()}
            className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Risks Editor Component
// ============================================================================

function RisksEditor({
  risks,
  onChange,
  readOnly,
}: {
  risks: StrategyRisk[];
  onChange: (risks: StrategyRisk[]) => void;
  readOnly?: boolean;
}) {
  const [newRisk, setNewRisk] = useState('');
  const [newMitigation, setNewMitigation] = useState('');

  const handleAdd = () => {
    if (newRisk.trim() && !readOnly) {
      onChange([...risks, { risk: newRisk.trim(), mitigation: newMitigation.trim() || undefined }]);
      setNewRisk('');
      setNewMitigation('');
    }
  };

  const handleRemove = (index: number) => {
    if (!readOnly) {
      onChange(risks.filter((_, i) => i !== index));
    }
  };

  const handleUpdate = (index: number, field: 'risk' | 'mitigation', value: string) => {
    if (!readOnly) {
      const updated = [...risks];
      updated[index] = { ...updated[index], [field]: value || undefined };
      onChange(updated);
    }
  };

  return (
    <div className="space-y-2">
      {risks.map((item, idx) => (
        <div
          key={idx}
          className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/5"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              {readOnly ? (
                <p className="text-sm text-red-300">{item.risk}</p>
              ) : (
                <input
                  type="text"
                  value={item.risk}
                  onChange={(e) => handleUpdate(idx, 'risk', e.target.value)}
                  className="w-full px-2 py-1 text-sm bg-transparent border-none text-red-300 focus:outline-none"
                />
              )}
              {(item.mitigation || !readOnly) && (
                <div className="flex items-start gap-2 pl-1">
                  <Shield className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                  {readOnly ? (
                    <p className="text-xs text-emerald-300">{item.mitigation}</p>
                  ) : (
                    <input
                      type="text"
                      value={item.mitigation || ''}
                      onChange={(e) => handleUpdate(idx, 'mitigation', e.target.value)}
                      placeholder="Mitigation strategy..."
                      className="w-full px-2 py-0.5 text-xs bg-transparent border-none text-emerald-300 placeholder-slate-500 focus:outline-none"
                    />
                  )}
                </div>
              )}
            </div>
            {!readOnly && (
              <button
                onClick={() => handleRemove(idx)}
                className="text-slate-500 hover:text-slate-300 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      ))}
      {!readOnly && (
        <div className="space-y-1">
          <input
            type="text"
            value={newRisk}
            onChange={(e) => setNewRisk(e.target.value)}
            placeholder="Add risk..."
            className="w-full px-2.5 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
          {newRisk && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMitigation}
                onChange={(e) => setNewMitigation(e.target.value)}
                placeholder="Mitigation (optional)"
                className="flex-1 px-2.5 py-1 text-xs bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
              <button
                onClick={handleAdd}
                className="px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300"
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Evaluation Editor
// ============================================================================

export function EvaluationEditor({
  evaluation,
  onChange,
  onAiSuggest,
  aiLoading,
  readOnly,
  compact,
  title = 'Tradeoffs & Risks',
}: EvaluationEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasContent =
    (evaluation.pros?.length || 0) +
    (evaluation.cons?.length || 0) +
    (evaluation.tradeoffs?.length || 0) +
    (evaluation.risks?.length || 0) +
    (evaluation.assumptions?.length || 0) > 0;

  const updateField = useCallback(
    <K extends keyof StrategyEvaluation>(field: K, value: StrategyEvaluation[K]) => {
      onChange({ ...evaluation, [field]: value });
    },
    [evaluation, onChange]
  );

  // Compact summary for collapsed state
  const summary = compact && !isExpanded ? (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      {(evaluation.pros?.length || 0) > 0 && (
        <span className="flex items-center gap-1">
          <ThumbsUp className="w-3 h-3 text-emerald-400" />
          {evaluation.pros?.length}
        </span>
      )}
      {(evaluation.cons?.length || 0) > 0 && (
        <span className="flex items-center gap-1">
          <ThumbsDown className="w-3 h-3 text-red-400" />
          {evaluation.cons?.length}
        </span>
      )}
      {(evaluation.risks?.length || 0) > 0 && (
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          {evaluation.risks?.length}
        </span>
      )}
      {!hasContent && <span className="italic">No evaluation yet</span>}
    </div>
  ) : null;

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-xs font-medium text-slate-400">{title}</span>
        </div>
        {summary}
        {onAiSuggest && !readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAiSuggest();
            }}
            disabled={aiLoading}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 rounded transition-colors"
          >
            {aiLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            AI Suggest
          </button>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 space-y-4 bg-slate-900/30">
          {/* Pros */}
          <div>
            <h5 className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              Pros
            </h5>
            <ListEditor
              items={evaluation.pros || []}
              onChange={(items) => updateField('pros', items)}
              placeholder="Add a benefit..."
              readOnly={readOnly}
              icon={ThumbsUp}
              colorClass="border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
            />
          </div>

          {/* Cons */}
          <div>
            <h5 className="text-[10px] font-medium text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <ThumbsDown className="w-3 h-3" />
              Cons
            </h5>
            <ListEditor
              items={evaluation.cons || []}
              onChange={(items) => updateField('cons', items)}
              placeholder="Add a drawback..."
              readOnly={readOnly}
              icon={ThumbsDown}
              colorClass="border-red-500/30 bg-red-500/5 text-red-300"
            />
          </div>

          {/* Tradeoffs */}
          <div>
            <h5 className="text-[10px] font-medium text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Scale className="w-3 h-3" />
              Tradeoffs
            </h5>
            <ListEditor
              items={evaluation.tradeoffs || []}
              onChange={(items) => updateField('tradeoffs', items)}
              placeholder="Add a tradeoff..."
              readOnly={readOnly}
              icon={Scale}
              colorClass="border-amber-500/30 bg-amber-500/5 text-amber-300"
            />
          </div>

          {/* Risks */}
          <div>
            <h5 className="text-[10px] font-medium text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Risks & Mitigations
            </h5>
            <RisksEditor
              risks={evaluation.risks || []}
              onChange={(risks) => updateField('risks', risks)}
              readOnly={readOnly}
            />
          </div>

          {/* Assumptions */}
          <div>
            <h5 className="text-[10px] font-medium text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Assumptions
            </h5>
            <ListEditor
              items={evaluation.assumptions || []}
              onChange={(items) => updateField('assumptions', items)}
              placeholder="Add an assumption..."
              readOnly={readOnly}
              icon={Lightbulb}
              colorClass="border-blue-500/30 bg-blue-500/5 text-blue-300"
            />
          </div>

          {/* Dependencies */}
          <div>
            <h5 className="text-[10px] font-medium text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              Dependencies
            </h5>
            <ListEditor
              items={evaluation.dependencies || []}
              onChange={(items) => updateField('dependencies', items)}
              placeholder="Add a dependency..."
              readOnly={readOnly}
              icon={Link2}
              colorClass="border-purple-500/30 bg-purple-500/5 text-purple-300"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Display Component (for Blueprint view)
// ============================================================================

export function EvaluationSummary({
  evaluation,
  maxItems = 2,
  showRisks = true,
}: {
  evaluation: StrategyEvaluation;
  maxItems?: number;
  showRisks?: boolean;
}) {
  const pros = evaluation.pros?.slice(0, maxItems) || [];
  const cons = evaluation.cons?.slice(0, maxItems) || [];
  const tradeoffs = evaluation.tradeoffs?.slice(0, maxItems) || [];
  const risks = evaluation.risks?.slice(0, maxItems) || [];

  const hasContent = pros.length + cons.length + tradeoffs.length + risks.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div className="space-y-2 text-xs">
      {/* Pros/Cons Row */}
      {(pros.length > 0 || cons.length > 0) && (
        <div className="flex gap-4">
          {pros.length > 0 && (
            <div className="flex-1">
              <span className="text-emerald-400 font-medium flex items-center gap-1 mb-1">
                <ThumbsUp className="w-3 h-3" />
                Pros
              </span>
              {pros.map((p, i) => (
                <p key={i} className="text-slate-400 truncate">• {p}</p>
              ))}
              {(evaluation.pros?.length || 0) > maxItems && (
                <p className="text-slate-500 italic">+{(evaluation.pros?.length || 0) - maxItems} more</p>
              )}
            </div>
          )}
          {cons.length > 0 && (
            <div className="flex-1">
              <span className="text-red-400 font-medium flex items-center gap-1 mb-1">
                <ThumbsDown className="w-3 h-3" />
                Cons
              </span>
              {cons.map((c, i) => (
                <p key={i} className="text-slate-400 truncate">• {c}</p>
              ))}
              {(evaluation.cons?.length || 0) > maxItems && (
                <p className="text-slate-500 italic">+{(evaluation.cons?.length || 0) - maxItems} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tradeoffs */}
      {tradeoffs.length > 0 && (
        <div className="px-2 py-1.5 bg-amber-500/5 border border-amber-500/20 rounded">
          <span className="text-amber-400 font-medium flex items-center gap-1 mb-1">
            <Scale className="w-3 h-3" />
            Tradeoffs
          </span>
          {tradeoffs.map((t, i) => (
            <p key={i} className="text-amber-200/70 truncate">• {t}</p>
          ))}
        </div>
      )}

      {/* Key Risks */}
      {showRisks && risks.length > 0 && (
        <div className="px-2 py-1.5 bg-red-500/5 border border-red-500/20 rounded">
          <span className="text-red-400 font-medium flex items-center gap-1 mb-1">
            <AlertTriangle className="w-3 h-3" />
            Key Risks
          </span>
          {risks.map((r, i) => (
            <div key={i} className="text-red-200/70">
              <p className="truncate">• {r.risk}</p>
              {r.mitigation && (
                <p className="text-emerald-300/60 text-[10px] ml-3 truncate">
                  ↳ {r.mitigation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
