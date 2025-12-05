'use client';

// components/os/context/IntentPanel.tsx
// Intent classification and agent routing panel
//
// Phase 4: Context Intent Engine UI (Simplified)

import { useState, useCallback } from 'react';

interface IntentPanelProps {
  companyId: string;
  currentDomain?: string;
  currentPath?: string;
}

export function IntentPanel({
  companyId,
  currentDomain,
}: IntentPanelProps) {
  const [request, setRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    intent?: { type: string; confidence: number; category: string };
    route?: { primaryAgent: string };
  } | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!request.trim()) return;
    setLoading(true);

    try {
      const response = await fetch('/api/context/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request,
          companyId,
          currentDomain,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch (err) {
      console.error('Intent classification failed:', err);
    } finally {
      setLoading(false);
    }
  }, [request, companyId, currentDomain]);

  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>
          {showTooltip && (
            <div className="absolute left-0 top-full mt-2 z-50">
              <div className="w-64 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
                <div className="text-sm font-medium text-slate-100 mb-1">
                  Natural Language Commands
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Describe what you want to change in the Context Graph using natural language. AI will interpret your intent and route to the appropriate action.
                </p>
              </div>
            </div>
          )}
        </div>
        AI Intent
      </h3>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="What do you want to do?"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !request.trim()}
          className="px-2 py-1.5 rounded-md bg-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/30 disabled:opacity-50"
        >
          {loading ? '...' : '→'}
        </button>
      </div>

      {result?.intent && (
        <div className="p-2 bg-slate-800/50 rounded-md space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-400">{result.intent.category}</span>
            <span className="text-[10px] text-slate-500">
              {Math.round(result.intent.confidence * 100)}%
            </span>
          </div>
          <div className="text-xs text-slate-300">
            {result.intent.type.replace(/_/g, ' ')}
          </div>
          {result.route && (
            <div className="text-[10px] text-slate-500">
              → {result.route.primaryAgent.replace(/_/g, ' ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default IntentPanel;
