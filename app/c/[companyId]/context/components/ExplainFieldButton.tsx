'use client';

// app/c/[companyId]/context/components/ExplainFieldButton.tsx
// AI Field Explanation Component
//
// Button + modal that explains a context field using AI:
// - What this field represents
// - Why it matters for marketing
// - How it's typically populated
// - Related fields and context

import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ExplainFieldButtonProps {
  companyId: string;
  fieldPath: string;
  fieldLabel: string;
  fieldValue: string | null;
  domainId: string;
}

interface ExplanationData {
  explanation: string;
  importance: string;
  relatedFields: string[];
  sourceSuggestions: string[];
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Main Component
// ============================================================================

export function ExplainFieldButton({
  companyId,
  fieldPath,
  fieldLabel,
  fieldValue,
  domainId,
}: ExplainFieldButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExplain = async () => {
    setIsOpen(true);
    if (explanation) return; // Already have explanation

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/context-explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldPath,
          fieldLabel,
          fieldValue,
          domainId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate explanation');
      }

      const data = await response.json();
      setExplanation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleExplain}
        className="p-1.5 rounded-md text-slate-500 hover:text-amber-300 hover:bg-slate-800 transition-colors"
        title="Explain this field with AI"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-lg max-h-[80vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">{fieldLabel}</h2>
                  <p className="text-xs text-slate-500 font-mono">{fieldPath}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin mb-4" />
                  <p className="text-sm text-slate-400">Generating explanation...</p>
                </div>
              ) : error ? (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-center">
                  <p className="text-sm text-red-300">{error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      setExplanation(null);
                      handleExplain();
                    }}
                    className="mt-3 text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Try again
                  </button>
                </div>
              ) : explanation ? (
                <div className="space-y-5">
                  {/* Explanation */}
                  <div>
                    <h3 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                      What is this field?
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {explanation.explanation}
                    </p>
                  </div>

                  {/* Importance */}
                  <div>
                    <h3 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                      Why it matters
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {explanation.importance}
                    </p>
                  </div>

                  {/* Related Fields */}
                  {explanation.relatedFields.length > 0 && (
                    <div>
                      <h3 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                        Related fields
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {explanation.relatedFields.map((field) => (
                          <span
                            key={field}
                            className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 border border-slate-700"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source Suggestions */}
                  {explanation.sourceSuggestions.length > 0 && (
                    <div>
                      <h3 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                        How to populate
                      </h3>
                      <ul className="space-y-1.5">
                        {explanation.sourceSuggestions.map((suggestion, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                            <span className="text-amber-400">→</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end p-4 border-t border-slate-800">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ExplainFieldButton;
