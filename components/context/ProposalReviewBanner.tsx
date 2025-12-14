// components/context/ProposalReviewBanner.tsx
// Banner showing pending context proposals requiring review
//
// Shows on both Strategy and Context pages when there are pending proposals.
// Clicking opens a batch review panel for quick accept/reject.

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, X, ChevronRight, Loader2, Sparkles } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PendingProposal {
  id: string;
  fieldPath: string;
  fieldLabel: string;
  proposedValue: unknown;
  currentValue: unknown | null;
  reasoning: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
  batchId?: string;
}

interface ProposalBatch {
  id: string;
  trigger: string;
  proposalCount: number;
  createdAt: string;
}

interface ProposalReviewBannerProps {
  companyId: string;
  /** Current page context */
  currentPage: 'strategy' | 'context';
  /** Callback when proposals are accepted/rejected */
  onProposalsUpdated?: () => void;
  /** Optional: Use cached proposal count instead of fetching */
  cachedProposalCount?: number;
}

// ============================================================================
// Component
// ============================================================================

export function ProposalReviewBanner({
  companyId,
  currentPage,
  onProposalsUpdated,
  cachedProposalCount,
}: ProposalReviewBannerProps) {
  const [proposals, setProposals] = useState<PendingProposal[]>([]);
  const [isLoading, setIsLoading] = useState(cachedProposalCount === undefined);
  const [isExpanded, setIsExpanded] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Fetch pending proposals
  const fetchProposals = useCallback(async () => {
    try {
      const response = await fetch(`/api/os/context/propose-from-strategy?companyId=${companyId}`);
      if (!response.ok) throw new Error('Failed to load proposals');
      const data = await response.json();
      setProposals(data.proposals || []);
      setError(null);
    } catch (err) {
      console.error('[ProposalReviewBanner] Error:', err);
      setError('Failed to load proposals');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (cachedProposalCount === undefined) {
      fetchProposals();
    }
  }, [fetchProposals, cachedProposalCount]);

  // Accept a proposal
  const handleAccept = async (proposal: PendingProposal) => {
    if (!proposal.batchId) return;

    setProcessingIds(prev => new Set(prev).add(proposal.id));
    try {
      const response = await fetch('/api/os/context/proposals/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          proposalId: proposal.id,
          batchId: proposal.batchId,
        }),
      });

      if (!response.ok) throw new Error('Failed to accept proposal');

      // Remove from local state
      setProposals(prev => prev.filter(p => p.id !== proposal.id));
      onProposalsUpdated?.();
    } catch (err) {
      console.error('[ProposalReviewBanner] Accept error:', err);
      setError('Failed to accept proposal');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(proposal.id);
        return next;
      });
    }
  };

  // Reject a proposal
  const handleReject = async (proposal: PendingProposal) => {
    if (!proposal.batchId) return;

    setProcessingIds(prev => new Set(prev).add(proposal.id));
    try {
      const response = await fetch('/api/os/context/proposals/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          proposalId: proposal.id,
          batchId: proposal.batchId,
        }),
      });

      if (!response.ok) throw new Error('Failed to reject proposal');

      // Remove from local state
      setProposals(prev => prev.filter(p => p.id !== proposal.id));
      onProposalsUpdated?.();
    } catch (err) {
      console.error('[ProposalReviewBanner] Reject error:', err);
      setError('Failed to reject proposal');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(proposal.id);
        return next;
      });
    }
  };

  // Accept all pending
  const handleAcceptAll = async () => {
    for (const proposal of proposals) {
      await handleAccept(proposal);
    }
  };

  // Reject all pending
  const handleRejectAll = async () => {
    for (const proposal of proposals) {
      await handleReject(proposal);
    }
  };

  // Use cached count or fetched proposals
  const proposalCount = cachedProposalCount ?? proposals.length;

  // Don't show if no proposals
  if (!isLoading && proposalCount === 0) {
    return null;
  }

  // Determine link target based on current page
  const reviewLink = currentPage === 'strategy'
    ? `/c/${companyId}/context?proposals=pending`
    : undefined;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg overflow-hidden">
      {/* Collapsed Banner */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-500/5 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-300">
            {isLoading ? (
              'Loading proposals...'
            ) : (
              <>New context proposed ({proposalCount}) — Review</>
            )}
          </span>
        </div>

        {reviewLink && (
          <Link
            href={reviewLink}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            Open in Context
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}

        <ChevronRight
          className={`w-4 h-4 text-amber-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Expanded Panel */}
      {isExpanded && !isLoading && (
        <div className="border-t border-amber-500/20 bg-slate-900/50">
          {/* Bulk Actions */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800">
            <button
              onClick={handleAcceptAll}
              disabled={processingIds.size > 0}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded disabled:opacity-50"
            >
              <Check className="w-3 h-3" />
              Accept All
            </button>
            <button
              onClick={handleRejectAll}
              disabled={processingIds.size > 0}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              Reject All
            </button>
            {error && (
              <span className="text-xs text-red-400 ml-auto">{error}</span>
            )}
          </div>

          {/* Proposal List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-300">
                      {proposal.fieldLabel}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {Math.round(proposal.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {formatValue(proposal.proposedValue)}
                  </p>
                  {proposal.reasoning && (
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                      {proposal.reasoning}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {processingIds.has(proposal.id) ? (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  ) : (
                    <>
                      <button
                        onClick={() => handleAccept(proposal)}
                        className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded"
                        title="Accept"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReject(proposal)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.length > 0 ? value.slice(0, 3).join(', ') + (value.length > 3 ? '...' : '') : '(empty list)';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value).slice(0, 50) + '...';
  }
  return String(value);
}
