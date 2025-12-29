'use client';

// hooks/useEngagement.ts
// Engagement state management hook
//
// Handles:
// - Fetching active engagement
// - Creating new engagements
// - Status transitions
// - Polling for progress during context gathering

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CompanyEngagement,
  CreateEngagementInput,
} from '@/lib/types/engagement';
import type { LabId } from '@/lib/contextGraph/labContext';

// ============================================================================
// Types
// ============================================================================

export interface ApproveContextResult {
  engagement: CompanyEngagement;
  strategyId?: string;  // For project engagements, the auto-created ProjectStrategy ID
}

export interface UseEngagementReturn {
  // State
  engagement: CompanyEngagement | null;
  loading: boolean;
  error: string | null;

  // Actions
  createEngagement: (input: Omit<CreateEngagementInput, 'companyId'>) => Promise<CompanyEngagement>;
  startContextGathering: (gapRunId: string) => Promise<void>;
  approveContext: () => Promise<ApproveContextResult>;
  cancelEngagement: () => Promise<void>;
  refreshEngagement: () => Promise<void>;

  // Action states
  creating: boolean;
  approving: boolean;
  cancelling: boolean;
}

export interface LabProgress {
  labId: LabId;
  status: 'pending' | 'running' | 'complete' | 'error';
  error?: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useEngagement(companyId: string): UseEngagementReturn {
  const [engagement, setEngagement] = useState<CompanyEngagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Polling interval ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch active engagement
  const fetchEngagement = useCallback(async () => {
    try {
      const res = await fetch(`/api/os/companies/${companyId}/engagements?active=true`);
      if (!res.ok) throw new Error('Failed to fetch engagement');

      const data = await res.json();
      setEngagement(data.engagement || null);
      setError(null);
    } catch (err) {
      console.error('[useEngagement] Error fetching:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Initial fetch
  useEffect(() => {
    fetchEngagement();
  }, [fetchEngagement]);

  // Polling during context_gathering
  useEffect(() => {
    if (engagement?.status === 'context_gathering') {
      pollingRef.current = setInterval(() => {
        fetchEngagement();
      }, 5000); // Poll every 5 seconds
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [engagement?.status, fetchEngagement]);

  // Create engagement
  const createEngagement = useCallback(async (
    input: Omit<CreateEngagementInput, 'companyId'>
  ): Promise<CompanyEngagement> => {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`/api/os/companies/${companyId}/engagements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create engagement');
      }

      const data = await res.json();
      setEngagement(data.engagement);
      return data.engagement;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setCreating(false);
    }
  }, [companyId]);

  // Start context gathering
  const startContextGathering = useCallback(async (gapRunId: string): Promise<void> => {
    if (!engagement) throw new Error('No active engagement');

    try {
      const res = await fetch(
        `/api/os/companies/${companyId}/engagements/${engagement.id}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start-context-gathering',
            gapRunId,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start context gathering');
      }

      const data = await res.json();
      setEngagement(data.engagement);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    }
  }, [companyId, engagement]);

  // Approve context
  const approveContext = useCallback(async (): Promise<ApproveContextResult> => {
    if (!engagement) throw new Error('No active engagement');

    setApproving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/os/companies/${companyId}/engagements/${engagement.id}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve-context' }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve context');
      }

      const data = await res.json();
      setEngagement(data.engagement);

      // Return the result including strategyId for project engagements
      return {
        engagement: data.engagement,
        strategyId: data.strategyId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setApproving(false);
    }
  }, [companyId, engagement]);

  // Cancel engagement (reset to draft or delete)
  const cancelEngagement = useCallback(async (): Promise<void> => {
    if (!engagement) throw new Error('No active engagement');

    setCancelling(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/os/companies/${companyId}/engagements/${engagement.id}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel engagement');
      }

      // After reset, clear the engagement to allow starting fresh
      setEngagement(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setCancelling(false);
    }
  }, [companyId, engagement]);

  // Refresh engagement
  const refreshEngagement = useCallback(async (): Promise<void> => {
    await fetchEngagement();
  }, [fetchEngagement]);

  return {
    engagement,
    loading,
    error,
    createEngagement,
    startContextGathering,
    approveContext,
    cancelEngagement,
    refreshEngagement,
    creating,
    approving,
    cancelling,
  };
}

// ============================================================================
// Lab Progress Hook (for detailed progress tracking)
// ============================================================================

export interface UseLabProgressReturn {
  labProgress: LabProgress[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to track individual lab progress during context gathering
 * This polls a GAP run status endpoint
 */
export function useLabProgress(
  gapRunId: string | undefined,
  selectedLabs: LabId[]
): UseLabProgressReturn {
  // Create a stable key from the labs array to avoid reference comparison issues
  const labsKey = selectedLabs.join(',');

  const [labProgress, setLabProgress] = useState<LabProgress[]>(() =>
    selectedLabs.map((labId) => ({ labId, status: 'pending' }))
  );
  const [loading, setLoading] = useState(false);

  // Store labs in a ref to avoid stale closures
  const labsRef = useRef(selectedLabs);
  labsRef.current = selectedLabs;

  // Fetch lab progress from GAP run
  const fetchProgress = useCallback(async () => {
    if (!gapRunId) return;

    const labs = labsRef.current;
    setLoading(true);
    try {
      // Try to get progress from GAP status endpoint
      const res = await fetch(`/api/os/diagnostics/status/gap-plan?runId=${gapRunId}`);
      if (!res.ok) {
        // If no status endpoint, just mark all as running
        setLabProgress(labs.map(labId => ({ labId, status: 'running' })));
        return;
      }

      const data = await res.json();

      // Map GAP run status to lab progress
      // This assumes the GAP run response has a labStatuses field
      const newProgress: LabProgress[] = labs.map((labId) => {
        const labStatus = data.labStatuses?.[labId];
        if (!labStatus) {
          return { labId, status: 'pending' };
        }

        let status: LabProgress['status'] = 'pending';
        if (labStatus.status === 'complete' || labStatus.status === 'completed') {
          status = 'complete';
        } else if (labStatus.status === 'running' || labStatus.status === 'in_progress') {
          status = 'running';
        } else if (labStatus.status === 'error' || labStatus.status === 'failed') {
          status = 'error';
        }

        return {
          labId,
          status,
          error: labStatus.error,
        };
      });

      setLabProgress(newProgress);
    } catch (err) {
      console.error('[useLabProgress] Error fetching progress:', err);
    } finally {
      setLoading(false);
    }
  }, [gapRunId]); // Removed selectedLabs - using ref instead

  // Initialize with selected labs when they change
  useEffect(() => {
    setLabProgress(labsRef.current.map((labId) => ({ labId, status: 'pending' })));
     
  }, [labsKey]); // Use stable string key instead of array reference

  // Poll for progress
  useEffect(() => {
    if (!gapRunId) return;

    // Initial fetch
    fetchProgress();

    // Set up polling
    const interval = setInterval(fetchProgress, 3000);

    return () => clearInterval(interval);
  }, [gapRunId, fetchProgress]);

  return {
    labProgress,
    loading,
    refresh: fetchProgress,
  };
}

export default useEngagement;
