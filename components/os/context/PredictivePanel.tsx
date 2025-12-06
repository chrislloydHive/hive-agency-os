'use client';

// components/os/context/PredictivePanel.tsx
// Predictive inference panel
//
// Phase 4: Probabilistic inference UI (Simplified)

import { useState, useEffect, useCallback, useRef } from 'react';

interface FieldPrediction {
  id: string;
  path: string;
  domain: string;
  predictedValue: unknown;
  confidence: number;
  method: string;
  reasoning: string;
}

interface PredictivePanelProps {
  companyId: string;
  /** Current domain to filter predictions by (e.g., 'identity', 'audience', 'brand') */
  domain?: string;
  onPredictionAccepted?: (path: string, value: unknown) => Promise<{ success: boolean; error?: string } | void>;
}

export function PredictivePanel({
  companyId,
  domain,
  onPredictionAccepted,
}: PredictivePanelProps) {
  const [predictions, setPredictions] = useState<FieldPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/context/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          mode: 'fill_empty',
          domain, // Filter by current domain if provided
          limit: 10,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let results = data.predictions || [];

        // If domain is specified, filter predictions to only that domain
        if (domain) {
          results = results.filter((p: FieldPrediction) => p.domain === domain);
        }

        setPredictions(results);
      }
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, domain]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const handleAccept = useCallback(async (prediction: FieldPrediction) => {
    if (!onPredictionAccepted) {
      setPredictions(prev => prev.filter(p => p.id !== prediction.id));
      return;
    }

    setError(null);
    setSavingId(prediction.id);

    try {
      const result = await onPredictionAccepted(prediction.path, prediction.predictedValue);

      // Only update state if still mounted
      if (!isMountedRef.current) return;

      // If the handler returns a result, check for errors
      if (result && !result.success) {
        setError(result.error || 'Failed to save prediction');
        setSavingId(null);
        return;
      }

      // Success - remove the accepted prediction from the list
      setPredictions(prev => prev.filter(p => p.id !== prediction.id));
      setSavingId(null);
    } catch (err) {
      // Only update state if still mounted
      if (!isMountedRef.current) return;

      console.error('[PredictivePanel] Error in handleAccept:', err);
      setError(err instanceof Error ? err.message : 'Failed to save prediction');
      setSavingId(null);
    }
  }, [onPredictionAccepted]);

  const handleReject = (prediction: FieldPrediction) => {
    setError(null);
    setPredictions(prev => prev.filter(p => p.id !== prediction.id));
  };

  const handleAcceptAll = useCallback(async () => {
    if (!onPredictionAccepted || predictions.length === 0) return;

    setError(null);
    setSavingAll(true);

    // Save predictions sequentially to avoid race conditions
    const remainingPredictions = [...predictions];
    const failedPredictions: FieldPrediction[] = [];

    for (const prediction of predictions) {
      if (!isMountedRef.current) break;

      setSavingId(prediction.id);

      try {
        const result = await onPredictionAccepted(prediction.path, prediction.predictedValue);

        if (!isMountedRef.current) break;

        if (result && !result.success) {
          failedPredictions.push(prediction);
        } else {
          // Remove from remaining
          const idx = remainingPredictions.findIndex(p => p.id === prediction.id);
          if (idx !== -1) remainingPredictions.splice(idx, 1);
        }
      } catch (err) {
        console.error('[PredictivePanel] Error accepting prediction:', err);
        failedPredictions.push(prediction);
      }
    }

    if (!isMountedRef.current) return;

    setSavingId(null);
    setSavingAll(false);
    setPredictions(failedPredictions);

    if (failedPredictions.length > 0) {
      setError(`Failed to save ${failedPredictions.length} prediction(s)`);
    }
  }, [onPredictionAccepted, predictions]);

  if (loading) {
    return (
      <div className="text-sm text-slate-400">Loading predictions...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            AI Predictions
          </h3>
          {domain && (
            <p className="text-xs text-slate-500 mt-0.5">
              for <span className="text-slate-400 capitalize">{domain}</span> section
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {predictions.length > 0 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAcceptAll();
                }}
                disabled={savingId !== null || savingAll}
                className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {savingAll ? (
                  <>
                    <div className="w-3 h-3 border border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Accept All'
                )}
              </button>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                {predictions.length}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-2 rounded bg-red-500/20 border border-red-500/30 text-xs text-red-300">
          {error}
        </div>
      )}

      {predictions.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          <p>All fields are populated!</p>
          <p className="text-xs mt-1">No predictions needed.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {predictions.map((prediction) => (
            <div
              key={prediction.id}
              className="p-3 border border-slate-700 rounded-lg space-y-2 bg-slate-800/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-300">{prediction.path}</span>
                <span className="text-[10px] text-slate-500">
                  {Math.round(prediction.confidence * 100)}%
                </span>
              </div>

              <div className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded">
                {String(prediction.predictedValue)}
              </div>

              <div className="text-[10px] text-slate-500">
                {(prediction.method || 'unknown').replace(/_/g, ' ')}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 px-2 py-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAccept(prediction);
                  }}
                  disabled={savingId !== null}
                >
                  {savingId === prediction.id ? (
                    <>
                      <div className="w-3 h-3 border border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Accept'
                  )}
                </button>
                <button
                  type="button"
                  className="flex-1 px-2 py-1 text-xs rounded bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleReject(prediction)}
                  disabled={savingId !== null}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PredictivePanel;
