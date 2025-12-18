'use client';

// components/os/ai/FieldAIActions.tsx
// Reusable AI Improve control for any editable field
//
// Features:
// - Improve button triggers AI proposal
// - Shows inline draft preview with diff
// - Apply / Edit / Discard actions
// - Shows sources used and confidence
//
// AI NEVER overwrites - always proposes drafts requiring user approval

import React, { useState, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  Check,
  X,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronUp,
  Database,
  Target,
  Layers,
  Zap,
  Globe,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type FieldScope = 'frame' | 'strategy' | 'tactic' | 'objective';

export interface FieldDraft {
  fieldKey: string;
  draftValue: string;
  rationale: string[];
  confidence: 'high' | 'medium' | 'low';
  sourcesUsed: string[];
  createdAt: string;
  isEditing: boolean;
  editedValue?: string;
}

export interface FieldAIActionsProps {
  fieldKey: string;
  currentValue: string | null;
  scope: FieldScope;
  companyId: string;
  strategyId: string;
  // Context for AI (passed to endpoint)
  contextPayload?: {
    objectives?: unknown[];
    priorities?: unknown[];
    tactics?: unknown[];
    frame?: unknown;
  };
  // Current draft if exists
  draft?: FieldDraft;
  // Callbacks
  onDraftReceived: (draft: FieldDraft) => void;
  onApply: (value: string) => void;
  onDiscard: () => void;
  // UI options
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

// ============================================================================
// Source Icon Helper
// ============================================================================

function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case 'context':
      return <Database className="w-3 h-3" />;
    case 'objectives':
      return <Target className="w-3 h-3" />;
    case 'strategy':
      return <Layers className="w-3 h-3" />;
    case 'tactics':
      return <Zap className="w-3 h-3" />;
    case 'competition':
      return <Globe className="w-3 h-3" />;
    default:
      return null;
  }
}

// ============================================================================
// Confidence Badge
// ============================================================================

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    low: 'bg-red-500/10 text-red-400 border-red-500/30',
  };

  return (
    <span className={`px-1.5 py-0.5 text-xs rounded border ${colors[confidence]}`}>
      {confidence}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FieldAIActions({
  fieldKey,
  currentValue,
  scope,
  companyId,
  strategyId,
  contextPayload,
  draft,
  onDraftReceived,
  onApply,
  onDiscard,
  disabled = false,
  compact = false,
  className = '',
}: FieldAIActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRationale, setShowRationale] = useState(false);
  const [editValue, setEditValue] = useState('');

  // -------------------------------------------------------------------------
  // Fetch AI Improvement
  // -------------------------------------------------------------------------

  const requestImprovement = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/ai-propose-field`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategyId,
            scope,
            fieldKey: fieldKey.split('.').pop(), // Get just the field name
            currentValue,
            context: contextPayload,
          }),
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to get AI suggestion');
      }

      const data = await response.json();

      const newDraft: FieldDraft = {
        fieldKey,
        draftValue: data.draftValue,
        rationale: data.rationale || [],
        confidence: data.confidence || 'medium',
        sourcesUsed: data.sourcesUsed || [],
        createdAt: new Date().toISOString(),
        isEditing: false,
      };

      onDraftReceived(newDraft);
    } catch (err) {
      console.error('[FieldAIActions] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [companyId, strategyId, scope, fieldKey, currentValue, contextPayload, onDraftReceived]);

  // -------------------------------------------------------------------------
  // Handle Apply
  // -------------------------------------------------------------------------

  const handleApply = useCallback(() => {
    if (!draft) return;
    const valueToApply = draft.isEditing && draft.editedValue !== undefined
      ? draft.editedValue
      : draft.draftValue;
    onApply(valueToApply);
  }, [draft, onApply]);

  // -------------------------------------------------------------------------
  // Handle Edit Mode
  // -------------------------------------------------------------------------

  const startEditing = useCallback(() => {
    if (!draft) return;
    setEditValue(draft.draftValue);
    onDraftReceived({
      ...draft,
      isEditing: true,
      editedValue: draft.draftValue,
    });
  }, [draft, onDraftReceived]);

  const updateEditValue = useCallback((value: string) => {
    if (!draft) return;
    setEditValue(value);
    onDraftReceived({
      ...draft,
      editedValue: value,
    });
  }, [draft, onDraftReceived]);

  const cancelEditing = useCallback(() => {
    if (!draft) return;
    onDraftReceived({
      ...draft,
      isEditing: false,
      editedValue: undefined,
    });
  }, [draft, onDraftReceived]);

  // -------------------------------------------------------------------------
  // Render: No Draft State (Just Improve Button)
  // -------------------------------------------------------------------------

  if (!draft) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={requestImprovement}
          disabled={disabled || loading}
          className={`
            flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors
            ${disabled || loading
              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/30'
            }
          `}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {compact ? '' : 'Improve'}
        </button>

        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Draft State (Preview + Actions)
  // -------------------------------------------------------------------------

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Draft Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-purple-400">AI Draft</span>
          <ConfidenceBadge confidence={draft.confidence} />
        </div>

        <div className="flex items-center gap-1">
          {/* Sources Used */}
          <div className="flex items-center gap-1 mr-2">
            {draft.sourcesUsed.map((source) => (
              <span
                key={source}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-slate-700/50 text-slate-400 rounded"
                title={`Used: ${source}`}
              >
                <SourceIcon source={source} />
                {!compact && <span className="capitalize">{source}</span>}
              </span>
            ))}
          </div>

          {/* Regenerate */}
          <button
            onClick={requestImprovement}
            disabled={loading}
            className="p-1 text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
            title="Regenerate"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Draft Preview / Edit */}
      {draft.isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => updateEditValue(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
            >
              <Check className="w-3 h-3" />
              Apply Edit
            </button>
            <button
              onClick={cancelEditing}
              className="px-2 py-1 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Before/After Preview */}
          <div className="space-y-1">
            {currentValue && (
              <div className="px-2 py-1.5 text-xs bg-red-500/10 border border-red-500/20 rounded text-red-300 line-through">
                {currentValue.length > 100 ? currentValue.substring(0, 100) + '...' : currentValue}
              </div>
            )}
            <div className="px-2 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-300">
              {draft.draftValue.length > 200 ? draft.draftValue.substring(0, 200) + '...' : draft.draftValue}
            </div>
          </div>

          {/* Rationale (Collapsible) */}
          {draft.rationale.length > 0 && (
            <div>
              <button
                onClick={() => setShowRationale(!showRationale)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
              >
                {showRationale ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Why this change?
              </button>
              {showRationale && (
                <ul className="mt-1 pl-4 text-xs text-slate-400 list-disc space-y-0.5">
                  {draft.rationale.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
            >
              <Check className="w-3 h-3" />
              Apply
            </button>
            <button
              onClick={startEditing}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
            <button
              onClick={onDiscard}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            >
              <X className="w-3 h-3" />
              Discard
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default FieldAIActions;
