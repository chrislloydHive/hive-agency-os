'use client';

// components/os/RunDiagnosticsButton.tsx
// Reusable button that executes Full GAP + Competition baseline runner
//
// Use this instead of a Link when you want "Run Diagnostics" to actually
// execute diagnostics rather than just navigate to the diagnostics page.

import { useState } from 'react';
import { Loader2, BarChart3, Play } from 'lucide-react';

interface RunDiagnosticsButtonProps {
  companyId: string;
  /** Variant style: 'card' for grid cards, 'button' for inline buttons */
  variant?: 'card' | 'button' | 'compact';
  /** Optional callback when run completes */
  onComplete?: (result: BaselineResult) => void;
}

interface BaselineResult {
  success: boolean;
  message: string;
  fullGap: { ran: boolean; success: boolean };
  competition: { ran: boolean; success: boolean; competitorCount?: number };
}

export function RunDiagnosticsButton({
  companyId,
  variant = 'button',
  onComplete,
}: RunDiagnosticsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BaselineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/os/context/run-baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Baseline run failed');
      }

      const baselineResult: BaselineResult = {
        success: data.success,
        message: data.message,
        fullGap: data.fullGap,
        competition: data.competition,
      };

      setResult(baselineResult);
      onComplete?.(baselineResult);

      // Reload page after success to refresh data
      if (data.success) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run diagnostics');
    } finally {
      setLoading(false);
    }
  };

  // Card variant (for grid layouts like Overview page)
  if (variant === 'card') {
    return (
      <button
        onClick={handleRun}
        disabled={loading}
        className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-amber-500/50 hover:bg-amber-500/5 hover:-translate-y-0.5 transition-all group disabled:opacity-50 disabled:cursor-wait disabled:hover:translate-y-0"
      >
        <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center group-hover:bg-amber-500/25 transition-colors">
          {loading ? (
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          ) : (
            <BarChart3 className="w-5 h-5 text-amber-400" />
          )}
        </div>
        <div className="text-center">
          <p className="text-xs font-medium text-slate-200">
            {loading ? 'Running...' : result ? 'Complete!' : 'Run Diagnostics'}
          </p>
          {result && (
            <p className="text-[10px] text-slate-500 mt-0.5">{result.message}</p>
          )}
          {error && (
            <p className="text-[10px] text-red-400 mt-0.5">{error}</p>
          )}
        </div>
      </button>
    );
  }

  // Compact variant (for inline use)
  if (variant === 'compact') {
    return (
      <button
        onClick={handleRun}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
        {loading ? 'Running...' : 'Run Diagnostics'}
      </button>
    );
  }

  // Button variant (default)
  return (
    <div className="space-y-2">
      <button
        onClick={handleRun}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-wait"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <BarChart3 className="w-4 h-4" />
        )}
        {loading ? 'Running Diagnostics...' : 'Run Diagnostics'}
      </button>

      {result && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <p className="text-sm text-emerald-400">{result.message}</p>
          <p className="text-xs text-slate-500 mt-1">Page will refresh shortly...</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
