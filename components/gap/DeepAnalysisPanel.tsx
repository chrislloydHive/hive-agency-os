'use client';

import { useEffect, useState } from 'react';
import { HeavyGapRunState } from '@/lib/gap-heavy/state';

interface DeepAnalysisPanelProps {
  gapPlanRunId?: string;
  gapFullReportId?: string;
}

type State = 'loading' | 'no-run' | 'has-run' | 'error';

export function DeepAnalysisPanel({
  gapPlanRunId,
  gapFullReportId,
}: DeepAnalysisPanelProps) {
  const [state, setState] = useState<State>('loading');
  const [heavyRun, setHeavyRun] = useState<HeavyGapRunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isTicking, setIsTicking] = useState(false);

  // Fetch Heavy Run on mount
  useEffect(() => {
    if (!gapPlanRunId && !gapFullReportId) {
      setState('error');
      setError('No GAP Plan Run or Full Report ID provided');
      return;
    }

    fetchHeavyRun();
  }, [gapPlanRunId, gapFullReportId]);

  const fetchHeavyRun = async () => {
    setState('loading');
    setError(null);

    try {
      // Try to find Heavy Run by GAP Plan Run ID
      if (gapPlanRunId) {
        const response = await fetch(
          `/api/gap-heavy/by-plan-run?gapPlanRunId=${gapPlanRunId}`
        );
        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.error || 'Failed to fetch Heavy Run');
        }

        if (data.heavyRun) {
          setHeavyRun(data.heavyRun);
          setState('has-run');
        } else {
          setState('no-run');
        }
      } else {
        // No gapPlanRunId - can't query yet
        setState('no-run');
      }
    } catch (err) {
      console.error('[DeepAnalysisPanel] Error fetching Heavy Run:', err);
      setState('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleCreateHeavyRun = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/gap-heavy/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gapPlanRunId,
          gapFullReportId,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to create Heavy Run');
      }

      setHeavyRun(data.heavyRun);
      setState('has-run');
    } catch (err) {
      console.error('[DeepAnalysisPanel] Error creating Heavy Run:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleTickHeavyRun = async () => {
    if (!heavyRun) return;

    setIsTicking(true);
    setError(null);

    try {
      const response = await fetch('/api/gap-heavy/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: heavyRun.id }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to advance Heavy Run');
      }

      setHeavyRun(data.heavyRun);
    } catch (err) {
      console.error('[DeepAnalysisPanel] Error ticking Heavy Run:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsTicking(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="animate-spin h-4 w-4 border-2 border-slate-600 border-t-amber-500 rounded-full" />
          <span className="text-sm text-slate-400">
            Checking for deep analysis...
          </span>
        </div>
      </div>
    );
  }

  if (state === 'no-run') {
    return (
      <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">
              Deep Analysis (Optional)
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Run a comprehensive background analysis that discovers all pages,
              performs deep SEO audits, analyzes social presence, and generates
              enhanced recommendations.
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded text-sm text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleCreateHeavyRun}
          disabled={isCreating}
          className="w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-semibold rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isCreating ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-slate-600 border-t-slate-300 rounded-full" />
              Starting deep analysis...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Run deep analysis
            </>
          )}
        </button>
      </div>
    );
  }

  if (state === 'has-run' && heavyRun) {
    const statusColors: Record<HeavyGapRunState['status'], string> = {
      pending: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      running: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      error: 'bg-red-500/10 text-red-400 border-red-500/30',
      cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    };

    const isActive = heavyRun.status === 'running' || heavyRun.status === 'pending';
    const canTick = heavyRun.status !== 'completed' && heavyRun.status !== 'error' && heavyRun.status !== 'cancelled';

    return (
      <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-lg">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">
            Deep Analysis Status
          </h3>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
              statusColors[heavyRun.status]
            }`}
          >
            {heavyRun.status}
          </span>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Current Step:</span>
            <span className="text-slate-200 font-medium">
              {heavyRun.currentStep}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Tick Count:</span>
            <span className="text-slate-200">{heavyRun.tickCount}</span>
          </div>

          {heavyRun.lastTickAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Last Updated:</span>
              <span className="text-slate-200 text-xs">
                {new Date(heavyRun.lastTickAt).toLocaleString()}
              </span>
            </div>
          )}

          {heavyRun.stepsCompleted && heavyRun.stepsCompleted.length > 0 && (
            <div>
              <span className="text-xs text-slate-400 block mb-2">
                Steps Completed:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {heavyRun.stepsCompleted.map((step, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  >
                    {step}
                  </span>
                ))}
              </div>
            </div>
          )}

          {heavyRun.errorMessage && (
            <div className="p-3 bg-red-900/20 border border-red-700/50 rounded text-sm text-red-300">
              {heavyRun.errorMessage}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-700/50 rounded text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Manual Tick Button (for testing) */}
        {canTick && (
          <button
            onClick={handleTickHeavyRun}
            disabled={isTicking}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-200 font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isTicking ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-slate-600 border-t-slate-300 rounded-full" />
                Advancing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Advance analysis step (manual)
              </>
            )}
          </button>
        )}

        {/* Show insights when completed */}
        {heavyRun.status === 'completed' && heavyRun.data && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-900/20 border border-emerald-700/50 rounded text-sm text-emerald-300">
              ✓ Deep analysis complete! Enhanced insights have been generated.
            </div>

            {/* Base Snapshot */}
            {heavyRun.data.baseSnapshot && (
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-300 mb-2">
                  Base Snapshot
                </h4>
                <p className="text-sm text-slate-400 mb-2">
                  {heavyRun.data.baseSnapshot.summary}
                </p>
                {heavyRun.data.baseSnapshot.scores && Object.keys(heavyRun.data.baseSnapshot.scores).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(heavyRun.data.baseSnapshot.scores).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-700/50 text-slate-300"
                      >
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Discovered Pages */}
            {heavyRun.data.discoverPages && (
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-300 mb-2">
                  Page Discovery
                </h4>
                <div className="space-y-2 text-sm text-slate-400">
                  <p>
                    Discovered <strong className="text-slate-200">{heavyRun.data.discoverPages.discoveredUrls?.length || 0}</strong> pages
                    {heavyRun.data.discoverPages.sitemapFound && ' via sitemap'}
                  </p>
                  {heavyRun.data.discoverPages.discoveredUrls && heavyRun.data.discoverPages.discoveredUrls.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
                        View all URLs ({heavyRun.data.discoverPages.discoveredUrls.length})
                      </summary>
                      <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {heavyRun.data.discoverPages.discoveredUrls.map((url, idx) => (
                          <li key={idx} className="text-xs text-slate-500 truncate">
                            {url}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* Analyzed Pages */}
            {heavyRun.data.analyzePages && (
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-300 mb-2">
                  Page Analysis
                </h4>
                <div className="space-y-2 text-sm text-slate-400">
                  <p>
                    Analyzed <strong className="text-slate-200">{heavyRun.data.analyzePages.pageCount || 0}</strong> pages
                  </p>
                  {heavyRun.data.analyzePages.contentDepthSummary && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-700/50 text-slate-300">
                        Avg words: {heavyRun.data.analyzePages.contentDepthSummary.avgWordsPerPage}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-700/50 text-slate-300">
                        Total words: {heavyRun.data.analyzePages.contentDepthSummary.totalWords?.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Raw Data (Debug) */}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
                View raw data (debug)
              </summary>
              <pre className="mt-2 p-3 bg-slate-950 rounded text-xs text-slate-400 overflow-x-auto">
                {JSON.stringify(heavyRun.data, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
        <p className="text-sm text-red-300">{error || 'Unknown error'}</p>
      </div>
    );
  }

  return null;
}
