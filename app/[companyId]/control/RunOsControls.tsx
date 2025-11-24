'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { runQuickOs, runDeepOs } from './actions';

interface RunOsControlsProps {
  companyId: string;
  companyName: string;
}

export function RunOsControls({ companyId, companyName }: RunOsControlsProps) {
  const router = useRouter();
  const [isRunningQuick, setIsRunningQuick] = useState(false);
  const [isRunningDeep, setIsRunningDeep] = useState(false);
  const [showDeepConfirm, setShowDeepConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleQuickRun = async () => {
    setIsRunningQuick(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await runQuickOs(companyId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to start quick OS run');
      }

      console.log('[RunOsControls] Quick run started:', result.gapRunId);

      // Show success message
      setSuccess(`✓ Quick analysis started! The run will appear in the table below.`);

      // Refresh the page to show the new run
      setTimeout(() => {
        router.refresh();
      }, 500);

      // Clear success message after 8 seconds
      setTimeout(() => setSuccess(null), 8000);
    } catch (err) {
      console.error('[RunOsControls] Error running quick OS:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunningQuick(false);
    }
  };

  const handleDeepRun = async () => {
    setIsRunningDeep(true);
    setError(null);
    setSuccess(null);
    setShowDeepConfirm(false);

    try {
      const result = await runDeepOs(companyId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to start deep OS run');
      }

      console.log('[RunOsControls] Deep run started:', result.gapRunId);

      // Show success message
      setSuccess(`✓ Deep analysis started! The run will appear in the table below.`);

      // Refresh the page to show the new run
      setTimeout(() => {
        router.refresh();
      }, 500);

      // Clear success message after 8 seconds
      setTimeout(() => setSuccess(null), 8000);
    } catch (err) {
      console.error('[RunOsControls] Error running deep OS:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunningDeep(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Refresh Button */}
      <div>
        <button
          onClick={handleQuickRun}
          disabled={isRunningQuick || isRunningDeep}
          className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-200 font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isRunningQuick ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-slate-600 border-t-slate-300 rounded-full" />
              Running quick analysis...
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
              Quick Refresh
            </>
          )}
        </button>
        <p className="text-xs text-slate-500 mt-1">
          Lightweight analysis with core diagnostics
        </p>
      </div>

      {/* Deep OS Run Button */}
      <div>
        {!showDeepConfirm ? (
          <>
            <button
              onClick={() => setShowDeepConfirm(true)}
              disabled={isRunningQuick || isRunningDeep}
              className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-slate-200 font-semibold rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-600"
            >
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
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
              Deep OS Run (Heavy)
            </button>
            <p className="text-xs text-slate-500 mt-1">
              Comprehensive analysis with telemetry and extended diagnostics
            </p>
          </>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <svg
                className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-amber-300 font-medium mb-1">
                  Confirm Deep OS Run
                </p>
                <p className="text-xs text-amber-200/70 mb-3">
                  This is a comprehensive analysis for {companyName}. It may
                  take longer and use more credits. Proceed?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeepRun}
                    disabled={isRunningDeep}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-700 disabled:text-amber-300 text-slate-950 font-semibold rounded text-xs transition-colors disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {isRunningDeep ? (
                      <>
                        <div className="animate-spin h-3 w-3 border-2 border-slate-950/30 border-t-slate-950 rounded-full" />
                        Running...
                      </>
                    ) : (
                      'Yes, run deep analysis'
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeepConfirm(false)}
                    disabled={isRunningDeep}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-200 rounded text-xs transition-colors disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success Display */}
      {success && (
        <div className="p-4 bg-emerald-900/30 border-2 border-emerald-600/60 rounded-lg text-base text-emerald-200 font-medium shadow-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-sm text-red-300">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}
    </div>
  );
}
