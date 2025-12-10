'use client';

// components/plan/PlanSynthesisModal.tsx
// Modal showing AI-generated plan synthesis
//
// Displays:
// - Primary themes identified
// - Prioritized actions
// - Recommended sequencing
// - KPI considerations

import { useState, useEffect } from 'react';
import { X, Sparkles, Copy, Check, Download, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface PlanSynthesis {
  themes: string[];
  prioritizedActions: string[];
  sequencing: string;
  kpiConsiderations: string;
  implementationNotes: string;
  summary: string;
}

interface PlanSynthesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  synthesis: PlanSynthesis | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Main Component
// ============================================================================

export function PlanSynthesisModal({
  isOpen,
  onClose,
  synthesis,
  isLoading,
  error,
}: PlanSynthesisModalProps) {
  const [copied, setCopied] = useState(false);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!synthesis) return;

    const text = `
# Plan Synthesis

## Summary
${synthesis.summary}

## Primary Themes
${synthesis.themes.map(t => `- ${t}`).join('\n')}

## Prioritized Actions
${synthesis.prioritizedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## Recommended Sequencing
${synthesis.sequencing}

## KPI Considerations
${synthesis.kpiConsiderations}

## Implementation Notes
${synthesis.implementationNotes}
    `.trim();

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Plan Synthesis</h2>
              <p className="text-xs text-slate-500">AI-generated strategic summary</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-4" />
              <p className="text-slate-400">Analyzing findings and generating synthesis...</p>
              <p className="text-sm text-slate-500 mt-1">This may take a moment</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
              <p className="text-red-400">{error}</p>
              <button
                onClick={onClose}
                className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
              >
                Close and try again
              </button>
            </div>
          )}

          {synthesis && !isLoading && !error && (
            <div className="space-y-6">
              {/* Summary */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
                  Executive Summary
                </h3>
                <p className="text-slate-300 leading-relaxed bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  {synthesis.summary}
                </p>
              </div>

              {/* Themes */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
                  Primary Themes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {synthesis.themes.map((theme, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-sm bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>

              {/* Prioritized Actions */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
                  Prioritized Actions
                </h3>
                <ol className="space-y-2">
                  {synthesis.prioritizedActions.map((action, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-semibold">
                        {i + 1}
                      </span>
                      <span className="text-slate-300">{action}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Sequencing */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
                  Recommended Sequencing
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {synthesis.sequencing}
                </p>
              </div>

              {/* KPIs */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
                  KPI Considerations
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {synthesis.kpiConsiderations}
                </p>
              </div>

              {/* Implementation */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
                  Implementation Notes
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {synthesis.implementationNotes}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {synthesis && !isLoading && !error && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlanSynthesisModal;
