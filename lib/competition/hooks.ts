// lib/competition/hooks.ts
// React hooks for Competition Lab v2 API integration

import { useState, useEffect, useCallback } from 'react';
import type {
  CompetitionRun,
  ScoredCompetitor,
  CompetitionRunResult,
  CompetitorFeedbackAction,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface UseCompetitionRunResult {
  run: CompetitionRun | null;
  competitors: ScoredCompetitor[];
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  triggerRun: () => Promise<void>;
  applyFeedback: (action: CompetitorFeedbackAction) => Promise<void>;
}

// ============================================================================
// Hook: useCompetitionRun
// ============================================================================

export function useCompetitionRun(companyId: string): UseCompetitionRunResult {
  const [run, setRun] = useState<CompetitionRun | null>(null);
  const [competitors, setCompetitors] = useState<ScoredCompetitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch latest run
  const fetchLatestRun = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/os/companies/${companyId}/competition`);

      if (!response.ok) {
        if (response.status === 404) {
          // No runs yet - that's okay
          setRun(null);
          setCompetitors([]);
          return;
        }
        throw new Error(`Failed to fetch competition data: ${response.status}`);
      }

      const data = await response.json();

      if (data.run) {
        setRun(data.run);
        setCompetitors(data.run.competitors || []);
      } else if (data.competitors) {
        setCompetitors(data.competitors);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competition data');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Trigger new run
  const triggerRun = useCallback(async () => {
    try {
      setIsRunning(true);
      setError(null);

      const response = await fetch(`/api/os/companies/${companyId}/competition/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to trigger run: ${response.status}`);
      }

      const result: CompetitionRunResult = await response.json();

      // Update state with new data
      if (result.competitors) {
        setCompetitors(result.competitors);
      }

      // Refresh to get full run data
      await fetchLatestRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run competition analysis');
    } finally {
      setIsRunning(false);
    }
  }, [companyId, fetchLatestRun]);

  // Apply feedback (promote/remove/add)
  const applyFeedback = useCallback(async (action: CompetitorFeedbackAction) => {
    try {
      setError(null);

      const response = await fetch(`/api/os/companies/${companyId}/competition/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to apply feedback: ${response.status}`);
      }

      // Refresh to get updated data
      await fetchLatestRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply feedback');
    }
  }, [companyId, fetchLatestRun]);

  // Initial fetch
  useEffect(() => {
    fetchLatestRun();
  }, [fetchLatestRun]);

  return {
    run,
    competitors,
    isLoading,
    isRunning,
    error,
    refresh: fetchLatestRun,
    triggerRun,
    applyFeedback,
  };
}

// ============================================================================
// Utility: Format date
// ============================================================================

export function formatRunDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Utility: Get role color
// ============================================================================

export function getRoleColor(role: string): { bg: string; text: string; border: string } {
  switch (role) {
    case 'core':
      return { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500' };
    case 'secondary':
      return { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500' };
    case 'alternative':
      return { bg: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-500' };
    default:
      return { bg: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-500' };
  }
}

// ============================================================================
// Utility: Get brand scale label
// ============================================================================

export function getBrandScaleLabel(scale: string | null): string {
  switch (scale) {
    case 'startup':
      return 'Startup';
    case 'smb':
      return 'SMB';
    case 'mid_market':
      return 'Mid-Market';
    case 'enterprise':
      return 'Enterprise';
    case 'dominant':
      return 'Market Leader';
    default:
      return 'Unknown';
  }
}
