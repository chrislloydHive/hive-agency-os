'use client';

// components/os/context/PredictivePanel.tsx
// Predictive inference panel
//
// Phase 4: Probabilistic inference UI (Simplified)

import { useState, useEffect, useCallback } from 'react';

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
  onPredictionAccepted?: (path: string, value: unknown) => void;
}

export function PredictivePanel({
  companyId,
  onPredictionAccepted,
}: PredictivePanelProps) {
  const [predictions, setPredictions] = useState<FieldPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/context/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, mode: 'fill_empty', limit: 10 }),
      });

      if (response.ok) {
        const data = await response.json();
        setPredictions(data.predictions || []);
      }
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const handleAccept = (prediction: FieldPrediction) => {
    if (onPredictionAccepted) {
      onPredictionAccepted(prediction.path, prediction.predictedValue);
    }
    setPredictions(prev => prev.filter(p => p.id !== prediction.id));
  };

  const handleReject = (prediction: FieldPrediction) => {
    setPredictions(prev => prev.filter(p => p.id !== prediction.id));
  };

  if (loading) {
    return (
      <div className="text-sm text-slate-400">Loading predictions...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          AI Predictions
        </h3>
        {predictions.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            {predictions.length}
          </span>
        )}
      </div>

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
                {prediction.method.replace(/_/g, ' ')}
              </div>

              <div className="flex gap-2">
                <button
                  className="flex-1 px-2 py-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  onClick={() => handleAccept(prediction)}
                >
                  Accept
                </button>
                <button
                  className="flex-1 px-2 py-1 text-xs rounded bg-slate-700 text-slate-400 hover:bg-slate-600"
                  onClick={() => handleReject(prediction)}
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
