'use client';

import { useState, useEffect, useCallback } from 'react';

interface RunGapPanelProps {
  companyId: string; // Airtable record ID
  companyName: string;
  websiteUrl: string;
}

interface GapRunStatus {
  runId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  stage: string | null;
  currentFinding: string | null;
  error: string | null;
}

export default function RunGapPanel({
  companyId,
  companyName,
  websiteUrl,
}: RunGapPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<GapRunStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll for status updates
  useEffect(() => {
    if (!runStatus || !runStatus.runId) return;

    // Don't poll if completed or failed
    if (runStatus.status === 'completed' || runStatus.status === 'failed') {
      setIsRunning(false);
      return;
    }

    // Poll every 4 seconds
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/growth-plan?runId=${runStatus.runId}`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          console.error('Failed to fetch GAP run status:', response.statusText);
          return;
        }

        const data = await response.json();

        if (data.ok) {
          setRunStatus({
            runId: data.runId,
            status: data.status,
            progress: data.progress ?? 0,
            stage: data.stage ?? null,
            currentFinding: data.currentFinding ?? null,
            error: data.error ?? null,
          });

          // Stop polling if completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            setIsRunning(false);
          }
        }
      } catch (error) {
        console.error('Error polling GAP run status:', error);
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [runStatus]);

  const handleRunGap = useCallback(async () => {
    if (!websiteUrl) {
      setErrorMessage('No website URL available for this company');
      return;
    }

    setIsRunning(true);
    setErrorMessage(null);
    setRunStatus(null);

    try {
      const response = await fetch('/api/growth-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: websiteUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start GAP run');
      }

      const data = await response.json();

      if (data.ok && data.runId) {
        setRunStatus({
          runId: data.runId,
          status: data.status ?? 'queued',
          progress: 0,
          stage: null,
          currentFinding: null,
          error: null,
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error starting GAP run:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to start GAP run'
      );
      setIsRunning(false);
    }
  }, [websiteUrl]);

  const getStatusMessage = () => {
    if (!runStatus) return null;

    const { status, stage, progress, error } = runStatus;

    if (status === 'completed') {
      return (
        <div className="flex items-start gap-2">
          <span className="text-green-400 text-lg">✅</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-400">
              GAP completed successfully
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Refresh diagnostics & plan to see the latest insights
            </p>
          </div>
        </div>
      );
    }

    if (status === 'failed') {
      return (
        <div className="flex items-start gap-2">
          <span className="text-red-400 text-lg">❌</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">GAP run failed</p>
            {error && (
              <p className="text-xs text-slate-400 mt-0.5 break-words">
                {error}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (status === 'running' || status === 'queued') {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-400">
              GAP running
              {stage && (
                <>
                  : <span className="text-slate-300">{stage}</span>
                </>
              )}
            </p>
            <span className="text-xs font-semibold text-slate-400">
              {progress}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-400 h-1.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {/* Current finding */}
          {runStatus.currentFinding && (
            <p className="text-xs text-slate-500 italic leading-relaxed">
              {runStatus.currentFinding}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex flex-col gap-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-100">
          Growth Acceleration Plan
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">{companyName}</p>
        {websiteUrl && (
          <p className="text-xs text-slate-500 break-all mt-0.5">
            {websiteUrl}
          </p>
        )}
      </div>

      {/* Status or button */}
      {runStatus ? (
        <div className="mt-1">{getStatusMessage()}</div>
      ) : (
        <button
          onClick={handleRunGap}
          disabled={isRunning || !websiteUrl}
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-amber-400 text-slate-900 text-sm font-medium hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? (
            <>
              <svg
                className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-slate-900"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Starting...
            </>
          ) : !websiteUrl ? (
            'No website URL'
          ) : (
            'Run Growth Acceleration Plan'
          )}
        </button>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
          <span className="text-red-400 text-sm">⚠️</span>
          <p className="text-xs text-red-400 flex-1">{errorMessage}</p>
        </div>
      )}

      {/* Run again button (only show after completion/failure) */}
      {runStatus && (runStatus.status === 'completed' || runStatus.status === 'failed') && (
        <button
          onClick={handleRunGap}
          disabled={isRunning || !websiteUrl}
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Run Again
        </button>
      )}
    </div>
  );
}
