// components/website/WebsiteDiagnosticRunner.tsx
// Client component that triggers and monitors Website Diagnostic execution

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type DiagnosticStatus = 'not_started' | 'pending' | 'running' | 'completed' | 'failed';

type Props = {
  companyId: string;
  initialStatus?: DiagnosticStatus;
};

export function WebsiteDiagnosticRunner({ companyId, initialStatus = 'not_started' }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<DiagnosticStatus>(initialStatus);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [percent, setPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Poll for status updates
  useEffect(() => {
    if (status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/diagnostics/website/status?companyId=${companyId}`);
        const data = await res.json();

        setStatus(data.status);
        setCurrentStep(data.currentStep || '');
        setPercent(data.percent || 0);
        setError(data.error);

        if (data.status === 'completed') {
          // Hard refresh to show results from server
          clearInterval(interval);
          // Small delay to ensure UI updates, then reload
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else if (data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling diagnostic status:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [status, companyId, router]);

  const startDiagnostic = async () => {
    setRunning(true);
    setError(null);
    setStatus('pending');

    try {
      const res = await fetch('/api/diagnostics/website/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start diagnostic');
      }

      setStatus('running');
      setPercent(0);
    } catch (err) {
      console.error('Error starting diagnostic:', err);
      setError(String(err));
      setStatus('failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
      <h2 className="mb-4 text-xl font-bold text-slate-100">Website Diagnostic Runner</h2>

      {/* Status Display */}
      {status === 'not_started' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            No diagnostic has been run yet for this company.
          </p>
          <button
            onClick={startDiagnostic}
            disabled={running}
            className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
              running
                ? 'cursor-wait bg-slate-700 text-slate-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {running ? 'Starting...' : 'Run Website Diagnostic'}
          </button>
        </div>
      )}

      {status === 'pending' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-blue-500"></div>
            <span className="text-sm font-medium text-slate-300">Queuing diagnostic...</span>
          </div>
        </div>
      )}

      {status === 'running' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              Running diagnostic...
            </span>
            <span className="text-sm font-semibold text-blue-400">{percent}%</span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            ></div>
          </div>

          {currentStep && (
            <div className="text-xs text-slate-400">
              Current step: <span className="font-medium text-slate-300">{currentStep}</span>
            </div>
          )}

          <div className="space-y-1 text-xs text-slate-500">
            <p>✓ Discovering pages</p>
            {percent >= 25 && <p>✓ Extracting evidence</p>}
            {percent >= 37 && <p>✓ Building site graph</p>}
            {percent >= 50 && <p>✓ Classifying page intents</p>}
            {percent >= 62 && <p>✓ Running heuristic evaluation</p>}
            {percent >= 75 && <p>✓ Simulating personas</p>}
            {percent >= 87 && <p>✓ Running intelligence engines</p>}
            {percent >= 95 && <p>✓ Building action plan</p>}
            {percent >= 98 && <p>✓ Persisting results</p>}
          </div>
        </div>
      )}

      {status === 'completed' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-400">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium">Diagnostic completed successfully</span>
          </div>
          <p className="text-xs text-slate-400">
            Refreshing page to show results...
          </p>
        </div>
      )}

      {status === 'failed' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-red-400">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium">Diagnostic failed</span>
          </div>
          {error && (
            <div className="rounded bg-red-900/20 p-3 text-xs text-red-300">
              {error}
            </div>
          )}
          <button
            onClick={startDiagnostic}
            disabled={running}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Retry Diagnostic
          </button>
        </div>
      )}
    </div>
  );
}
