// lib/competition/hooks.ts
// React hooks for Competition Lab v2 API integration
//
// Updated to expose full run state including steps, stats, and errors.

import { useState, useEffect, useCallback } from 'react';
import type {
  CompetitionRun,
  ScoredCompetitor,
  CompetitorFeedbackAction,
  CompetitionRunStats,
  CompetitionRunStep,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface UseCompetitionRunResult {
  // Run state
  latestRun: CompetitionRun | null;
  runs: CompetitionRun[];
  competitors: ScoredCompetitor[];

  // Run metadata
  stats: CompetitionRunStats | null;
  steps: CompetitionRunStep[];
  querySummary: { queriesGenerated: string[]; sourcesUsed: string[] } | null;

  // Loading states
  isLoading: boolean;
  isRunning: boolean;

  // Error state
  error: string | null;
  runError: string | null; // Specific error from the run itself

  // Actions
  refetch: () => Promise<void>;
  runV2: () => Promise<void>;
  applyFeedback: (action: CompetitorFeedbackAction) => Promise<void>;
}

// ============================================================================
// Hook: useCompetitionRun
// ============================================================================

export function useCompetitionRun(companyId: string): UseCompetitionRunResult {
  const [latestRun, setLatestRun] = useState<CompetitionRun | null>(null);
  const [runs, setRuns] = useState<CompetitionRun[]>([]);
  const [competitors, setCompetitors] = useState<ScoredCompetitor[]>([]);
  const [stats, setStats] = useState<CompetitionRunStats | null>(null);
  const [steps, setSteps] = useState<CompetitionRunStep[]>([]);
  const [querySummary, setQuerySummary] = useState<{ queriesGenerated: string[]; sourcesUsed: string[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Fetch latest run and list
  const fetchLatestRun = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/os/companies/${companyId}/competition`);

      if (!response.ok) {
        if (response.status === 404) {
          // No runs yet - that's okay
          setLatestRun(null);
          setRuns([]);
          setCompetitors([]);
          setStats(null);
          setSteps([]);
          setQuerySummary(null);
          setRunError(null);
          return;
        }
        throw new Error(`Failed to fetch competition data: ${response.status}`);
      }

      const data = await response.json();

      if (data.run) {
        const run = data.run as CompetitionRun;
        setLatestRun(run);
        setCompetitors(run.competitors || []);
        setStats(run.stats || null);
        setSteps(run.steps || []);
        setQuerySummary(run.querySummary || null);
        setRunError(run.errorMessage || null);
      } else {
        setLatestRun(null);
        setCompetitors([]);
        setStats(null);
        setSteps([]);
        setQuerySummary(null);
        setRunError(null);
      }

      if (data.runs) {
        setRuns(data.runs);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load competition data';
      setError(message);
      console.error('[useCompetitionRun] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Trigger new V2 run
  const runV2 = useCallback(async () => {
    try {
      setIsRunning(true);
      setError(null);
      setRunError(null);

      const response = await fetch(`/api/os/companies/${companyId}/competition/run-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || `Failed to trigger run: ${response.status}`;
        setRunError(errorMessage);
        throw new Error(errorMessage);
      }

      // Check if the run itself failed
      if (data.status === 'failed') {
        setRunError(data.errorMessage || 'Run failed without specific error');
      }

      // Refresh to get full run data
      await fetchLatestRun();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run competition analysis';
      setError(message);
      console.error('[useCompetitionRun] Run error:', err);
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
      const message = err instanceof Error ? err.message : 'Failed to apply feedback';
      setError(message);
      console.error('[useCompetitionRun] Feedback error:', err);
    }
  }, [companyId, fetchLatestRun]);

  // Initial fetch
  useEffect(() => {
    fetchLatestRun();
  }, [fetchLatestRun]);

  return {
    latestRun,
    runs,
    competitors,
    stats,
    steps,
    querySummary,
    isLoading,
    isRunning,
    error,
    runError,
    refetch: fetchLatestRun,
    runV2,
    applyFeedback,
  };
}

// ============================================================================
// Legacy alias
// ============================================================================

// For backwards compatibility
export function useCompetitionRunLegacy(companyId: string) {
  const result = useCompetitionRun(companyId);
  return {
    run: result.latestRun,
    competitors: result.competitors,
    isLoading: result.isLoading,
    isRunning: result.isRunning,
    error: result.error,
    refresh: result.refetch,
    triggerRun: result.runV2,
    applyFeedback: result.applyFeedback,
  };
}

// ============================================================================
// Utility: Format date
// ============================================================================

export function formatRunDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
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

// ============================================================================
// Utility: Get step status info
// ============================================================================

export function getStepStatusInfo(status: string): { label: string; color: string; icon: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending', color: 'text-slate-400', icon: '○' };
    case 'running':
      return { label: 'Running', color: 'text-amber-400', icon: '◐' };
    case 'completed':
      return { label: 'Done', color: 'text-green-400', icon: '●' };
    case 'failed':
      return { label: 'Failed', color: 'text-red-400', icon: '✕' };
    default:
      return { label: status, color: 'text-slate-400', icon: '○' };
  }
}

// ============================================================================
// Utility: Get step name label
// ============================================================================

export function getStepNameLabel(stepName: string): string {
  const labels: Record<string, string> = {
    loadContext: 'Load Context',
    generateQueries: 'Generate Queries',
    discover: 'Discover Competitors',
    enrich: 'Enrich Data',
    score: 'Score Similarity',
    classify: 'Classify Roles',
    analyze: 'Strategic Analysis',
    position: 'Position on Map',
  };
  return labels[stepName] || stepName;
}

// ============================================================================
// Utility: Get status badge info
// ============================================================================

export function getRunStatusInfo(status: string): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending', color: 'text-slate-300', bgColor: 'bg-slate-700' };
    case 'discovering':
      return { label: 'Discovering...', color: 'text-amber-300', bgColor: 'bg-amber-900/50' };
    case 'enriching':
      return { label: 'Enriching...', color: 'text-amber-300', bgColor: 'bg-amber-900/50' };
    case 'scoring':
      return { label: 'Scoring...', color: 'text-amber-300', bgColor: 'bg-amber-900/50' };
    case 'classifying':
      return { label: 'Classifying...', color: 'text-amber-300', bgColor: 'bg-amber-900/50' };
    case 'completed':
      return { label: 'Completed', color: 'text-green-300', bgColor: 'bg-green-900/50' };
    case 'failed':
      return { label: 'Failed', color: 'text-red-300', bgColor: 'bg-red-900/50' };
    default:
      return { label: status, color: 'text-slate-300', bgColor: 'bg-slate-700' };
  }
}
