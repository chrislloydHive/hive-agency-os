// app/os/[companyId]/diagnostics/brand/BrandDiagnosticRunner.tsx
// Client component that triggers Brand Lab diagnostic

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  companyId: string;
};

export function BrandDiagnosticRunner({ companyId }: Props) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/os/diagnostics/run-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run brand diagnostic');
      }

      setResult(data);

      // Reload after success (give Airtable time to propagate)
      setTimeout(() => {
        console.log('[BrandDiagnosticRunner] Refreshing to show results...');
        router.refresh();
      }, 3000);

    } catch (err) {
      console.error('Brand diagnostic error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
      <h2 className="mb-4 text-xl font-bold text-slate-100">Brand Diagnostic</h2>

      {/* Empty State */}
      {!isRunning && !result && !error && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 text-center">
            <div className="mb-3">
              <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">
              No Brand Diagnostic Yet
            </h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Run a brand diagnostic to analyze brand health, clarity, positioning, and coherence.
            </p>
          </div>

          <button
            onClick={handleRun}
            className="w-full rounded-lg bg-blue-500/20 px-4 py-3 text-sm font-medium text-blue-300 transition-all hover:bg-blue-500/30 border border-blue-500/50"
          >
            Run Brand Lab V1
          </button>
        </div>
      )}

      {/* Running State */}
      {isRunning && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-blue-500"></div>
            <span className="text-sm font-medium text-slate-300">
              Running Brand Diagnostic...
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-500">
            <p>✓ Fetching website content</p>
            <p>✓ Analyzing brand identity</p>
            <p>✓ Evaluating messaging & positioning</p>
            <p>✓ Assessing visual consistency</p>
            <p>✓ Building action plan</p>
          </div>

          <p className="text-xs text-slate-400">
            This may take 30-60 seconds...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <div className="flex items-center gap-2 text-red-300 mb-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium">Diagnostic failed</span>
            </div>
            <p className="text-sm text-red-300">{error}</p>
          </div>

          <button
            onClick={handleRun}
            className="w-full rounded-lg bg-blue-500/20 px-4 py-3 text-sm font-medium text-blue-300 transition-all hover:bg-blue-500/30 border border-blue-500/50"
          >
            Retry Diagnostic
          </button>
        </div>
      )}

      {/* Success State */}
      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
            <div className="flex items-center gap-2 text-green-300 mb-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium">Brand diagnostic complete!</span>
            </div>
            <p className="text-sm text-green-300">
              Score: {result.score}/100 ({result.benchmarkLabel})
            </p>
          </div>

          <p className="text-xs text-slate-400">
            Refreshing page to show results...
          </p>
        </div>
      )}
    </div>
  );
}
