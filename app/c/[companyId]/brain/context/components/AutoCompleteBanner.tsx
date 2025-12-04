'use client';

// app/c/[companyId]/brain/context/components/AutoCompleteBanner.tsx
// Banner that appears when context coverage is low, offering to hydrate from historical runs

import { useState, useEffect } from 'react';
import { hydrateContextAction, checkAvailableDataSourcesAction } from '../actions';

interface AutoCompleteBannerProps {
  companyId: string;
  coveragePercent: number;
  threshold?: number; // Default 50%
}

export function AutoCompleteBanner({
  companyId,
  coveragePercent,
  threshold = 50,
}: AutoCompleteBannerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    fieldsUpdated: number;
  } | null>(null);
  const [availableSources, setAvailableSources] = useState<Array<{
    id: string;
    name: string;
    hasData: boolean;
  }>>([]);
  const [isCheckingSource, setIsCheckingSource] = useState(true);

  // Check available data sources on mount
  useEffect(() => {
    async function checkSources() {
      try {
        const result = await checkAvailableDataSourcesAction(companyId);
        if (result.success) {
          setAvailableSources(result.sources);
        }
      } catch (error) {
        console.error('Failed to check data sources:', error);
      } finally {
        setIsCheckingSource(false);
      }
    }

    checkSources();
  }, [companyId]);

  // Don't show banner if coverage is above threshold
  if (coveragePercent >= threshold || isDismissed) {
    return null;
  }

  // Check if any source has data to import
  const sourcesWithData = availableSources.filter(s => s.hasData);
  const hasDataToImport = sourcesWithData.length > 0;

  // Don't show if still checking or no data available
  if (isCheckingSource || !hasDataToImport) {
    return null;
  }

  const handleAutoComplete = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const result = await hydrateContextAction(companyId);
      setResult(result);

      if (result.success && result.fieldsUpdated > 0) {
        // Refresh the page after a short delay to show the updated data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to auto-complete',
        fieldsUpdated: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-amber-400"
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
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-amber-200">
                Auto-Complete Context
              </h3>
              <p className="mt-1 text-xs text-amber-300/70">
                We found historical data that can fill in your context graph.
                Coverage is currently at {coveragePercent}%.
              </p>

              {/* Available Sources */}
              <div className="mt-2 flex flex-wrap gap-2">
                {sourcesWithData.map(source => (
                  <span
                    key={source.id}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {source.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Dismiss button */}
            <button
              onClick={() => setIsDismissed(true)}
              className="flex-shrink-0 p-1 rounded text-amber-400/50 hover:text-amber-400 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Result Message */}
          {result && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-xs ${
                result.success
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-red-500/20 text-red-300'
              }`}
            >
              {result.message}
              {result.success && result.fieldsUpdated > 0 && (
                <span className="ml-1 text-emerald-400">
                  Refreshing...
                </span>
              )}
            </div>
          )}

          {/* Action Button */}
          {!result?.success && (
            <div className="mt-3">
              <button
                onClick={handleAutoComplete}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-md bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-medium text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-900/30 border-t-slate-900 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    Import from History
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
