'use client';

// app/c/[companyId]/setup/components/AIAssistPanel.tsx
// AI Assist Panel - Slide-over panel showing AI suggestions for current step

import { useState, useCallback, useEffect } from 'react';
import { SetupStepId, SETUP_STEP_CONFIG, SetupFormData } from '../types';

// ============================================================================
// Types
// ============================================================================

interface FieldSuggestion {
  field: string;
  value: unknown;
  confidence: number;
  reasoning: string;
}

interface AIAssistPanelProps {
  companyId: string;
  currentStep: SetupStepId;
  formData: Partial<SetupFormData>;
  isOpen: boolean;
  onClose: () => void;
  onApplySuggestion: (field: string, value: unknown) => void;
  onApplyAll: (suggestions: FieldSuggestion[]) => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty array)';
    return value.slice(0, 3).join(', ') + (value.length > 3 ? ` +${value.length - 3} more` : '');
  }
  if (typeof value === 'string') return value.length > 80 ? value.slice(0, 80) + '...' : value;
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 80 ? str.slice(0, 80) + '...' : str;
  }
  return String(value);
}

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function getConfidenceBadge(confidence: number): { label: string; color: string; bg: string } {
  if (confidence >= 0.9) return { label: 'High', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
  if (confidence >= 0.7) return { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-500/20' };
  if (confidence >= 0.5) return { label: 'Fair', color: 'text-amber-400', bg: 'bg-amber-500/20' };
  return { label: 'Low', color: 'text-slate-400', bg: 'bg-slate-500/20' };
}

// ============================================================================
// Main Component
// ============================================================================

export function AIAssistPanel({
  companyId,
  currentStep,
  formData,
  isOpen,
  onClose,
  onApplySuggestion,
  onApplyAll,
}: AIAssistPanelProps) {
  const [suggestions, setSuggestions] = useState<FieldSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());

  const stepConfig = SETUP_STEP_CONFIG[currentStep];

  // Fetch suggestions when panel opens or step changes
  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setAppliedFields(new Set());

    try {
      const response = await fetch(`/api/setup/${companyId}/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStep,
          formData,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, currentStep, formData]);

  // Fetch when opened
  useEffect(() => {
    if (isOpen) {
      fetchSuggestions();
    }
  }, [isOpen, currentStep, fetchSuggestions]);

  // Handle apply single suggestion
  const handleApply = (suggestion: FieldSuggestion) => {
    onApplySuggestion(suggestion.field, suggestion.value);
    const newApplied = new Set([...appliedFields, suggestion.field]);
    setAppliedFields(newApplied);

    // Close panel if all suggestions are now applied
    if (newApplied.size === suggestions.length) {
      onClose();
    }
  };

  // Handle apply all
  const handleApplyAll = () => {
    const unapplied = suggestions.filter(s => !appliedFields.has(s.field));
    if (unapplied.length > 0) {
      onApplyAll(unapplied);
      setAppliedFields(new Set(suggestions.map(s => s.field)));
      // Close panel after applying all
      onClose();
    }
  };

  // Don't render if closed
  if (!isOpen) return null;

  const unappliedCount = suggestions.filter(s => !appliedFields.has(s.field)).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-amber-500/20 border border-purple-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">AI Assist</h2>
              <p className="text-xs text-slate-500">{stepConfig.label}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Loading State */}
          {isLoading && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-8 text-center">
              <div className="w-10 h-10 mx-auto rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mb-4" />
              <p className="text-sm text-slate-300">Analyzing your setup...</p>
              <p className="text-xs text-slate-500 mt-1">Generating intelligent suggestions</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm text-red-300">{error}</p>
                  <button
                    onClick={fetchSuggestions}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && suggestions.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-8 text-center">
              <svg className="w-10 h-10 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-sm text-slate-400">No suggestions available</p>
              <p className="text-xs text-slate-500 mt-1">
                Fill in more fields to get better suggestions
              </p>
            </div>
          )}

          {/* Suggestions List */}
          {!isLoading && suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => {
                const isApplied = appliedFields.has(suggestion.field);
                const confidence = getConfidenceBadge(suggestion.confidence);

                return (
                  <div
                    key={`${suggestion.field}-${index}`}
                    className={cn(
                      'rounded-lg border transition-all',
                      isApplied
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    )}
                  >
                    {/* Field Header */}
                    <div className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-100">
                            {formatFieldName(suggestion.field)}
                          </span>
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', confidence.bg, confidence.color)}>
                            {Math.round(suggestion.confidence * 100)}%
                          </span>
                        </div>
                      </div>

                      {isApplied ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Applied
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApply(suggestion)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500 hover:bg-purple-400 text-white transition-colors"
                        >
                          Apply
                        </button>
                      )}
                    </div>

                    {/* Value Preview */}
                    <div className="px-4 pb-3">
                      <div className={cn(
                        'rounded-md px-3 py-2 text-xs font-mono',
                        isApplied
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-slate-950 text-slate-300'
                      )}>
                        {formatValue(suggestion.value)}
                      </div>
                    </div>

                    {/* Reasoning */}
                    <div className="px-4 pb-3 border-t border-slate-800/50 pt-3">
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {suggestion.reasoning}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && suggestions.length > 0 && (
          <div className="border-t border-slate-800 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {unappliedCount > 0
                  ? `${unappliedCount} suggestion${unappliedCount !== 1 ? 's' : ''} remaining`
                  : 'All suggestions applied'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchSuggestions}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                >
                  Refresh
                </button>
                {unappliedCount > 0 && (
                  <button
                    onClick={handleApplyAll}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-purple-500 hover:bg-purple-400 text-white transition-colors"
                  >
                    Apply All ({unappliedCount})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default AIAssistPanel;
