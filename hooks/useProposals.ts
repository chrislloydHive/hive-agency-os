// hooks/useProposals.ts
// React hook for managing Context Proposals
//
// Provides proposal loading, accepting, rejecting, and editing functionality

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ContextProposalBatch, ContextProposal } from '@/lib/contextGraph/nodes';

interface UseProposalsOptions {
  companyId: string;
  autoLoad?: boolean;
}

interface UseProposalsReturn {
  batches: ContextProposalBatch[];
  isLoading: boolean;
  error: string | null;
  pendingCount: number;

  // Actions
  loadProposals: () => Promise<void>;
  acceptProposal: (proposalId: string, batchId: string, options?: { fieldPath?: string; proposedValue?: unknown; companyId?: string }) => Promise<void>;
  rejectProposal: (proposalId: string, batchId: string) => Promise<void>;
  editAndAcceptProposal: (proposalId: string, batchId: string, editedValue: unknown) => Promise<void>;
  acceptAllInBatch: (batchId: string) => Promise<void>;
  rejectAllInBatch: (batchId: string) => Promise<void>;

  // Helpers
  getProposalForField: (fieldPath: string) => { proposal: ContextProposal; batchId: string } | null;
  hasProposalForField: (fieldPath: string) => boolean;
}

export function useProposals({ companyId, autoLoad = true }: UseProposalsOptions): UseProposalsReturn {
  const [batches, setBatches] = useState<ContextProposalBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate pending count
  const pendingCount = batches.reduce(
    (count, batch) =>
      count + batch.proposals.filter((p) => p.status === 'pending').length,
    0
  );

  // Load proposals
  const loadProposals = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/context/proposals?companyId=${encodeURIComponent(companyId)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load proposals');
      }

      const data = await response.json();
      setBatches(data.batches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
      setBatches([]);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && companyId) {
      loadProposals();
    }
  }, [autoLoad, companyId, loadProposals]);

  // Accept a single proposal
  const acceptProposal = useCallback(async (
    proposalId: string,
    batchId: string,
    options?: { fieldPath?: string; proposedValue?: unknown; companyId?: string }
  ) => {
    try {
      const response = await fetch('/api/os/context/proposals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          proposalId,
          action: 'accept',
          userId: 'user', // TODO: Get actual user ID
          // Include proposal details for local-only proposals (not in Airtable)
          fieldPath: options?.fieldPath,
          proposedValue: options?.proposedValue,
          companyId: options?.companyId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept proposal');
      }

      // Reload proposals to get updated state
      await loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept proposal');
      throw err;
    }
  }, [loadProposals]);

  // Reject a single proposal
  const rejectProposal = useCallback(async (proposalId: string, batchId: string) => {
    try {
      const response = await fetch('/api/os/context/proposals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          proposalId,
          action: 'reject',
          userId: 'user',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject proposal');
      }

      await loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject proposal');
      throw err;
    }
  }, [loadProposals]);

  // Edit and accept a proposal
  const editAndAcceptProposal = useCallback(async (
    proposalId: string,
    batchId: string,
    editedValue: unknown
  ) => {
    try {
      const response = await fetch('/api/os/context/proposals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          proposalId,
          action: 'edit',
          editedValue,
          userId: 'user',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to edit proposal');
      }

      await loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit proposal');
      throw err;
    }
  }, [loadProposals]);

  // Accept all proposals in a batch
  const acceptAllInBatch = useCallback(async (batchId: string) => {
    try {
      const response = await fetch('/api/os/context/proposals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          action: 'accept_all',
          userId: 'user',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept all proposals');
      }

      await loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept all proposals');
      throw err;
    }
  }, [loadProposals]);

  // Reject all proposals in a batch
  const rejectAllInBatch = useCallback(async (batchId: string) => {
    try {
      const response = await fetch('/api/os/context/proposals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          action: 'reject_all',
          userId: 'user',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject all proposals');
      }

      await loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject all proposals');
      throw err;
    }
  }, [loadProposals]);

  // Get proposal for a specific field
  const getProposalForField = useCallback((fieldPath: string): { proposal: ContextProposal; batchId: string } | null => {
    for (const batch of batches) {
      for (const proposal of batch.proposals) {
        if (proposal.fieldPath === fieldPath && proposal.status === 'pending') {
          return { proposal, batchId: batch.id };
        }
      }
    }
    return null;
  }, [batches]);

  // Check if field has a pending proposal
  const hasProposalForField = useCallback((fieldPath: string): boolean => {
    return getProposalForField(fieldPath) !== null;
  }, [getProposalForField]);

  return {
    batches,
    isLoading,
    error,
    pendingCount,
    loadProposals,
    acceptProposal,
    rejectProposal,
    editAndAcceptProposal,
    acceptAllInBatch,
    rejectAllInBatch,
    getProposalForField,
    hasProposalForField,
  };
}
