// components/context-map/RefinementComparisonPanel.tsx
// Side-by-side comparison for AI-refined context values
//
// DOCTRINE: User-First - AI improves without overwriting intent.
// Shows original vs refined with clear actions.

'use client';

import { useState, useCallback } from 'react';
import { Check, X, Edit3, Sparkles, Loader2, ArrowRight } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface RefinementData {
  originalValue: unknown;
  refinedValue: unknown;
  rationale: string;
  confidence: number;
  hasDifference: boolean;
  changes?: {
    type: 'clarified' | 'structured' | 'expanded' | 'corrected' | 'formatted';
    description: string;
  };
}

interface RefinementComparisonPanelProps {
  /** Node key being refined */
  nodeKey: string;
  /** Human-readable label */
  fieldLabel: string;
  /** Refinement data from API */
  refinement: RefinementData;
  /** Accept the refined value */
  onAccept: (refinedValue: unknown) => Promise<void>;
  /** Edit before accepting */
  onEdit: (value: unknown) => void;
  /** Keep original value */
  onKeepOriginal: () => Promise<void>;
  /** Dismiss without action */
  onDismiss: () => void;
  /** Loading state */
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function RefinementComparisonPanel({
  nodeKey,
  fieldLabel,
  refinement,
  onAccept,
  onEdit,
  onKeepOriginal,
  onDismiss,
  isLoading = false,
}: RefinementComparisonPanelProps) {
  const [actionLoading, setActionLoading] = useState<'accept' | 'keep' | null>(null);

  const handleAccept = useCallback(async () => {
    setActionLoading('accept');
    try {
      await onAccept(refinement.refinedValue);
    } finally {
      setActionLoading(null);
    }
  }, [onAccept, refinement.refinedValue]);

  const handleKeepOriginal = useCallback(async () => {
    setActionLoading('keep');
    try {
      await onKeepOriginal();
    } finally {
      setActionLoading(null);
    }
  }, [onKeepOriginal]);

  const handleEdit = useCallback(() => {
    onEdit(refinement.refinedValue);
  }, [onEdit, refinement.refinedValue]);

  // If no difference, show simple confirmation
  if (!refinement.hasDifference) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-emerald-400 mb-2">
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">Looking good!</span>
        </div>
        <p className="text-xs text-slate-400">
          Your value is clear and well-structured. No refinement needed.
        </p>
        <button
          onClick={onDismiss}
          className="mt-3 text-xs text-slate-500 hover:text-slate-400"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // Determine change type styling
  const changeTypeStyles = {
    clarified: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    structured: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    expanded: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    corrected: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    formatted: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const changeType = refinement.changes?.type || 'clarified';
  const changeStyle = changeTypeStyles[changeType];

  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-slate-200">AI Refinement</span>
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${changeStyle}`}>
            {changeType}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-slate-500 hover:text-slate-400 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Comparison */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Original */}
          <div>
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-2">
              Your Original
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 min-h-[60px]">
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {formatValue(refinement.originalValue)}
              </p>
            </div>
          </div>

          {/* Arrow */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden">
            <ArrowRight className="w-4 h-4 text-purple-400" />
          </div>

          {/* Refined */}
          <div>
            <div className="text-[10px] font-medium text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI Refined
            </div>
            <div className="bg-purple-500/5 border border-purple-500/30 rounded-lg p-3 min-h-[60px]">
              <p className="text-sm text-slate-200 whitespace-pre-wrap">
                {formatValue(refinement.refinedValue)}
              </p>
            </div>
          </div>
        </div>

        {/* Rationale */}
        <div className="mt-3 px-2">
          <p className="text-xs text-slate-500 italic">
            {refinement.rationale}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-600">
              Confidence: {Math.round(refinement.confidence * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-800 bg-slate-800/30">
        <button
          onClick={handleAccept}
          disabled={isLoading || actionLoading !== null}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {actionLoading === 'accept' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4" />
              Accept Refined
            </>
          )}
        </button>

        <button
          onClick={handleEdit}
          disabled={isLoading || actionLoading !== null}
          className="px-3 py-2 text-sm font-medium bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
          title="Edit refined value before accepting"
        >
          <Edit3 className="w-4 h-4" />
        </button>

        <button
          onClick={handleKeepOriginal}
          disabled={isLoading || actionLoading !== null}
          className="px-3 py-2 text-sm text-slate-500 hover:text-slate-400 disabled:opacity-50"
        >
          {actionLoading === 'keep' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Keep Original'
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Inline Refinement Prompt (Subtle)
// ============================================================================

interface RefinementPromptProps {
  onInvoke: () => void;
  isLoading?: boolean;
}

export function RefinementPrompt({ onInvoke, isLoading }: RefinementPromptProps) {
  return (
    <button
      onClick={onInvoke}
      disabled={isLoading}
      className="inline-flex items-center gap-1.5 text-xs text-purple-400/70 hover:text-purple-400 transition-colors disabled:opacity-50"
    >
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Sparkles className="w-3 h-3" />
      )}
      <span>AI can help refine this</span>
    </button>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty list)';
    return value.map((v, i) => `${i + 1}. ${String(v)}`).join('\n');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
