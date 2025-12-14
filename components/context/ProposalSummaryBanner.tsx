// components/context/ProposalSummaryBanner.tsx
// Proposal Summary Banner
//
// Shows a banner when there are pending AI proposals for context fields
// Allows bulk accept/reject all

'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { ContextProposalBatch } from '@/lib/contextGraph/nodes';

interface ProposalSummaryBannerProps {
  batches: ContextProposalBatch[];
  onAcceptAll: (batchId: string) => Promise<void>;
  onRejectAll: (batchId: string) => Promise<void>;
  onRefresh?: () => void;
}

export function ProposalSummaryBanner({
  batches,
  onAcceptAll,
  onRejectAll,
  onRefresh,
}: ProposalSummaryBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Count total pending proposals
  const totalPending = batches.reduce(
    (count, batch) =>
      count + batch.proposals.filter((p) => p.status === 'pending').length,
    0
  );

  const handleAcceptAll = useCallback(async (batchId: string) => {
    setActionLoading(`accept-${batchId}`);
    try {
      await onAcceptAll(batchId);
      onRefresh?.();
    } finally {
      setActionLoading(null);
    }
  }, [onAcceptAll, onRefresh]);

  const handleRejectAll = useCallback(async (batchId: string) => {
    setActionLoading(`reject-${batchId}`);
    try {
      await onRejectAll(batchId);
      onRefresh?.();
    } finally {
      setActionLoading(null);
    }
  }, [onRejectAll, onRefresh]);

  if (totalPending === 0) {
    return null;
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/20 p-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-amber-400">
              {totalPending} AI Proposal{totalPending !== 1 ? 's' : ''} Pending
            </div>
            <div className="text-xs text-slate-400">
              Review and confirm context suggestions
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-amber-500/20 px-4 py-3 space-y-3">
          {batches.map((batch) => {
            const pendingInBatch = batch.proposals.filter(
              (p) => p.status === 'pending'
            ).length;

            if (pendingInBatch === 0) return null;

            return (
              <div
                key={batch.id}
                className="rounded-lg bg-slate-800/50 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs font-medium text-slate-300">
                      {pendingInBatch} field{pendingInBatch !== 1 ? 's' : ''}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      From {batch.trigger.replace(/_/g, ' ')}
                      {batch.triggerSource && ` • ${batch.triggerSource}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAcceptAll(batch.id)}
                      disabled={actionLoading !== null}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {actionLoading === `accept-${batch.id}` ? (
                        <span className="animate-pulse">Accepting...</span>
                      ) : (
                        <>
                          <Check className="h-3 w-3" />
                          Accept All
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectAll(batch.id)}
                      disabled={actionLoading !== null}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {actionLoading === `reject-${batch.id}` ? (
                        <span className="animate-pulse">Rejecting...</span>
                      ) : (
                        <>
                          <X className="h-3 w-3" />
                          Reject All
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Field List */}
                <div className="space-y-1">
                  {batch.proposals
                    .filter((p) => p.status === 'pending')
                    .map((proposal) => (
                      <div
                        key={proposal.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-900/50"
                      >
                        <span className="text-slate-400">{proposal.fieldLabel}</span>
                        <span className="text-slate-500">
                          {Math.round(proposal.confidence * 100)}% confidence
                        </span>
                      </div>
                    ))}
                </div>

                {/* Batch Reasoning */}
                {batch.batchReasoning && (
                  <div className="mt-2 text-[10px] text-slate-500 italic">
                    {batch.batchReasoning}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
