'use client';

// app/c/[companyId]/context/components/SuggestionPanel.tsx
// AI Suggestion Panel Component
//
// Lists AI-generated suggestions with Accept/Reject buttons.
// Shows confidence level and reasoning for each suggestion.

import { useState, useCallback } from 'react';
import type { AISuggestion } from '@/lib/contextGraph/inference/aiSuggest';

// ============================================================================
// Types
// ============================================================================

interface SuggestionPanelProps {
  companyId: string;
  suggestions: AISuggestion[];
  onAccept: (suggestion: AISuggestion) => Promise<void>;
  onReject: (suggestion: AISuggestion) => Promise<void>;
  onExplain?: (suggestion: AISuggestion) => void;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') return value.length > 100 ? value.slice(0, 100) + '...' : value;
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 100 ? str.slice(0, 100) + '...' : str;
  }
  return String(value);
}

function getConfidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.9) return { label: 'Very High', color: 'text-emerald-400' };
  if (confidence >= 0.7) return { label: 'High', color: 'text-blue-400' };
  if (confidence >= 0.5) return { label: 'Medium', color: 'text-amber-400' };
  return { label: 'Low', color: 'text-red-400' };
}

// ============================================================================
// Main Component
// ============================================================================

export function SuggestionPanel({
  companyId,
  suggestions,
  onAccept,
  onReject,
  onExplain,
  onRefresh,
  isLoading = false,
}: SuggestionPanelProps) {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleAccept = useCallback(async (suggestion: AISuggestion) => {
    setProcessingIds(prev => new Set([...prev, suggestion.id]));
    try {
      await onAccept(suggestion);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  }, [onAccept]);

  const handleReject = useCallback(async (suggestion: AISuggestion) => {
    setProcessingIds(prev => new Set([...prev, suggestion.id]));
    try {
      await onReject(suggestion);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  }, [onReject]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-100">AI Suggestions</h3>
          <p className="text-[11px] text-slate-500">
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={cn(
            'p-2 rounded-md transition-colors',
            'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <svg
            className={cn('w-4 h-4', isLoading && 'animate-spin')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && suggestions.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 text-center">
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin mb-3" />
          <p className="text-sm text-slate-400">Generating suggestions...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && suggestions.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center">
          <svg
            className="w-8 h-8 mx-auto text-slate-600 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <p className="text-sm text-slate-500">No suggestions available</p>
          <p className="text-xs text-slate-600 mt-1">
            Click refresh to generate new suggestions
          </p>
        </div>
      )}

      {/* Suggestion List */}
      <div className="space-y-3">
        {suggestions.map((suggestion) => {
          const isProcessing = processingIds.has(suggestion.id);
          const isExpanded = expandedIds.has(suggestion.id);
          const confidence = getConfidenceLabel(suggestion.confidence);

          return (
            <div
              key={suggestion.id}
              className={cn(
                'rounded-lg border bg-slate-900/50 overflow-hidden',
                'transition-all',
                isProcessing ? 'opacity-60 border-slate-700' : 'border-slate-800'
              )}
            >
              {/* Header */}
              <button
                onClick={() => toggleExpand(suggestion.id)}
                className="w-full px-4 py-3 flex items-start justify-between text-left hover:bg-slate-800/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-100">
                      {suggestion.fieldLabel}
                    </span>
                    <span className={cn('text-[10px] font-medium', confidence.color)}>
                      {Math.round(suggestion.confidence * 100)}% · {confidence.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {suggestion.path}
                  </p>
                </div>
                <svg
                  className={cn(
                    'w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ml-2',
                    isExpanded && 'rotate-180'
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-800">
                  {/* Values Comparison */}
                  <div className="pt-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                        Current Value
                      </div>
                      <div className="rounded-md bg-slate-950 px-2 py-1.5 text-xs text-slate-400 font-mono">
                        {formatValue(suggestion.oldValue)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-emerald-500 mb-1">
                        Suggested Value
                      </div>
                      <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-1.5 text-xs text-emerald-300 font-mono">
                        {formatValue(suggestion.suggestedValue)}
                      </div>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                      Reasoning
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {suggestion.reasoning}
                    </p>
                  </div>

                  {/* Related Fields */}
                  {suggestion.relatedFields && suggestion.relatedFields.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                        Based On
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestion.relatedFields.map((f) => (
                          <span
                            key={f}
                            className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleAccept(suggestion)}
                      disabled={isProcessing}
                      className={cn(
                        'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        'bg-emerald-500 hover:bg-emerald-400 text-slate-900',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      {isProcessing ? 'Applying...' : 'Accept'}
                    </button>
                    <button
                      onClick={() => handleReject(suggestion)}
                      disabled={isProcessing}
                      className={cn(
                        'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        'bg-slate-700 hover:bg-slate-600 text-slate-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      Reject
                    </button>
                    {onExplain && (
                      <button
                        onClick={() => onExplain(suggestion)}
                        disabled={isProcessing}
                        className={cn(
                          'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                          'border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        Explain
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SuggestionPanel;
