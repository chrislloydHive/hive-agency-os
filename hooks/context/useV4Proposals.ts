// hooks/context/useV4Proposals.ts
// React hook for fetching and managing Context V4 proposals
//
// Provides:
// - Loading V4 proposals for a company
// - Confirming proposals (with optional value override)
// - Rejecting proposals
// - Generating proposals from diagnostics

import { useState, useCallback, useEffect } from 'react';
import type {
  ContextProposal,
  ListProposalsResponse,
  ConfirmProposalResponse,
  RejectProposalResponse,
  GenerateProposalsResponse,
} from '@/lib/types/contextProposal';

// ============================================================================
// Types
// ============================================================================

export interface UseV4ProposalsResult {
  /** All proposals grouped by field key */
  proposalsByField: Record<string, ContextProposal[]>;
  /** Flat list of all proposals */
  proposals: ContextProposal[];
  /** Pending proposals only */
  pendingProposals: ContextProposal[];
  /** Total proposal counts by status */
  byStatus: { proposed: number; confirmed: number; rejected: number };
  /** Counts by source type */
  bySource: Record<string, number>;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh proposals from server */
  refresh: () => Promise<void>;
  /** Confirm a proposal */
  confirmProposal: (
    proposalId: string,
    options?: { overrideValue?: string; userId?: string }
  ) => Promise<ConfirmProposalResponse>;
  /** Reject a proposal */
  rejectProposal: (
    proposalId: string,
    options?: { reason?: string; userId?: string }
  ) => Promise<RejectProposalResponse>;
  /** Generate proposals from diagnostics */
  generateProposals: (options?: {
    fieldKeys?: string[];
    dryRun?: boolean;
  }) => Promise<GenerateProposalsResponse>;
  /** Is a proposal action in progress */
  isActioning: string | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useV4Proposals(
  companyId: string,
  options?: { statusFilter?: 'proposed' | 'confirmed' | 'rejected' }
): UseV4ProposalsResult {
  const [proposalsByField, setProposalsByField] = useState<
    Record<string, ContextProposal[]>
  >({});
  const [byStatus, setByStatus] = useState<{
    proposed: number;
    confirmed: number;
    rejected: number;
  }>({ proposed: 0, confirmed: 0, rejected: 0 });
  const [bySource, setBySource] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActioning, setIsActioning] = useState<string | null>(null);

  // Flatten proposals
  const proposals = Object.values(proposalsByField).flat();
  const pendingProposals = proposals.filter((p) => p.status === 'proposed');

  // Fetch proposals
  const refresh = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.statusFilter) {
        params.set('status', options.statusFilter);
      }

      const url = `/api/os/companies/${companyId}/context/v4/proposals${
        params.toString() ? `?${params}` : ''
      }`;
      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch proposals: ${response.status}`);
      }

      const data: ListProposalsResponse = await response.json();

      if (data.success) {
        setProposalsByField(data.proposalsByField);
        setByStatus(data.byStatus);
        setBySource(data.bySource);
      } else {
        throw new Error('Failed to load proposals');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [companyId, options?.statusFilter]);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Confirm a proposal
  const confirmProposal = useCallback(
    async (
      proposalId: string,
      opts?: { overrideValue?: string; userId?: string }
    ): Promise<ConfirmProposalResponse> => {
      setIsActioning(proposalId);
      setError(null);

      try {
        const response = await fetch(
          `/api/os/context/proposals/${proposalId}/confirm`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              overrideValue: opts?.overrideValue,
              userId: opts?.userId,
            }),
          }
        );

        const data: ConfirmProposalResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to confirm proposal');
        }

        // Optimistically update local state
        setProposalsByField((prev) => {
          const updated = { ...prev };
          for (const fieldKey of Object.keys(updated)) {
            updated[fieldKey] = updated[fieldKey].map((p) =>
              p.id === proposalId
                ? { ...p, status: 'confirmed' as const, decidedAt: data.proposal.decidedAt }
                : p
            );
          }
          return updated;
        });
        setByStatus((prev) => ({
          ...prev,
          proposed: Math.max(0, prev.proposed - 1),
          confirmed: prev.confirmed + 1,
        }));

        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setIsActioning(null);
      }
    },
    []
  );

  // Reject a proposal
  const rejectProposal = useCallback(
    async (
      proposalId: string,
      opts?: { reason?: string; userId?: string }
    ): Promise<RejectProposalResponse> => {
      setIsActioning(proposalId);
      setError(null);

      try {
        const response = await fetch(
          `/api/os/context/proposals/${proposalId}/reject`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason: opts?.reason,
              userId: opts?.userId,
            }),
          }
        );

        const data: RejectProposalResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to reject proposal');
        }

        // Optimistically update local state
        setProposalsByField((prev) => {
          const updated = { ...prev };
          for (const fieldKey of Object.keys(updated)) {
            updated[fieldKey] = updated[fieldKey].map((p) =>
              p.id === proposalId
                ? { ...p, status: 'rejected' as const, decidedAt: data.proposal.decidedAt }
                : p
            );
          }
          return updated;
        });
        setByStatus((prev) => ({
          ...prev,
          proposed: Math.max(0, prev.proposed - 1),
          rejected: prev.rejected + 1,
        }));

        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setIsActioning(null);
      }
    },
    []
  );

  // Generate proposals from diagnostics
  const generateProposals = useCallback(
    async (opts?: {
      fieldKeys?: string[];
      dryRun?: boolean;
    }): Promise<GenerateProposalsResponse> => {
      setError(null);

      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/v4/proposals/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fieldKeys: opts?.fieldKeys,
              dryRun: opts?.dryRun,
            }),
          }
        );

        const data: GenerateProposalsResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to generate proposals');
        }

        // Refresh to get new proposals
        if (!opts?.dryRun && data.createdCount > 0) {
          await refresh();
        }

        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      }
    },
    [companyId, refresh]
  );

  return {
    proposalsByField,
    proposals,
    pendingProposals,
    byStatus,
    bySource,
    loading,
    error,
    refresh,
    confirmProposal,
    rejectProposal,
    generateProposals,
    isActioning,
  };
}
