'use client';

// components/os/programs/ProgramLearningsPanel.tsx
// Displays outcome signals (learnings) captured from program execution
//
// Shows outcomes from work items and artifacts linked to this program.
// Read-only panel to inform retrospectives and strategy refinement.

import { useState, useEffect } from 'react';
import { Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import { LearningsPanel } from '@/components/os/strategy/LearningsPanel';
import type { OutcomeSignal } from '@/lib/types/outcomeSignal';

// ============================================================================
// Types
// ============================================================================

interface ProgramLearningsPanelProps {
  programId: string;
  companyId: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function ProgramLearningsPanel({
  programId,
  companyId,
}: ProgramLearningsPanelProps) {
  const [signals, setSignals] = useState<OutcomeSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOutcomes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/os/programs/${programId}/outcomes`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch outcomes');
      }
      const data = await response.json();
      setSignals(data.signals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outcomes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutcomes();
  }, [programId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading outcomes...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400">
            <Lightbulb className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={fetchOutcomes}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // No signals - render nothing (don't show empty panel)
  if (signals.length === 0) {
    return null;
  }

  // Render LearningsPanel with fetched signals
  return (
    <LearningsPanel
      signals={signals}
      companyId={companyId}
      defaultCollapsed={false}
      maxVisible={5}
    />
  );
}

export default ProgramLearningsPanel;
