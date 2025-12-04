'use client';

// components/os/context/TemporalPanel.tsx
// Temporal history panel
//
// Phase 4: Time-series visualization (Simplified)

import { useState, useEffect, useCallback } from 'react';

interface FieldHistoryEntry {
  id: string;
  path: string;
  domain: string;
  value: unknown;
  previousValue: unknown;
  updatedBy: 'human' | 'ai' | 'system';
  timestamp: string;
}

interface TemporalPanelProps {
  companyId: string;
  selectedDomain?: string;
  onFieldSelect?: (path: string) => void;
}

export function TemporalPanel({
  companyId,
  selectedDomain,
  onFieldSelect,
}: TemporalPanelProps) {
  const [history, setHistory] = useState<FieldHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId,
        mode: selectedDomain ? 'domain_history' : 'field_history',
        limit: '50',
      });
      if (selectedDomain) {
        params.set('domain', selectedDomain);
      } else {
        params.set('path', '*');
      }

      const response = await fetch(`/api/context/temporal?${params}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedDomain]);

  const fetchNarrative = async () => {
    setNarrativeLoading(true);
    try {
      const response = await fetch(
        `/api/context/temporal?companyId=${companyId}&mode=narrative`
      );
      if (response.ok) {
        const data = await response.json();
        setNarrative(data.narrative?.summary || 'No narrative available.');
      }
    } catch (err) {
      console.error('Failed to fetch narrative:', err);
    } finally {
      setNarrativeLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="text-sm text-slate-400">Loading history...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Timeline
        </h3>
        <button
          onClick={fetchNarrative}
          disabled={narrativeLoading}
          className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
        >
          {narrativeLoading ? '...' : 'AI Story'}
        </button>
      </div>

      {narrative && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-slate-300 leading-relaxed">{narrative}</p>
        </div>
      )}

      {history.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          <p>No history recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="p-2 border border-slate-700 rounded cursor-pointer hover:bg-slate-800/50"
              onClick={() => onFieldSelect?.(entry.path)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      entry.updatedBy === 'human'
                        ? 'bg-blue-500/20 text-blue-400'
                        : entry.updatedBy === 'ai'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {entry.updatedBy}
                  </span>
                  <span className="font-mono text-xs text-slate-300 truncate max-w-[150px]">
                    {entry.path}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(entry.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TemporalPanel;
