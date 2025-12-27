'use client';

// app/c/[companyId]/deliver/proposals/[proposalId]/ProposalDetailClient.tsx
// Proposal Detail Client Component
//
// Shows proposal details, diff visualization, and accept/reject actions.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  X,
  AlertTriangle,
  Clock,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Lightbulb,
  HelpCircle,
} from 'lucide-react';
import type { PlanProposal, Plan } from '@/lib/types/plan';
import type { PlanDiff as PlanDiffType } from '@/lib/os/plans/diff/planDiff';
import { PlanDiff } from '@/components/os/plans/PlanDiff';

// ============================================================================
// Types
// ============================================================================

interface ProposalDetailClientProps {
  companyId: string;
  companyName: string;
  proposal: PlanProposal;
  proposedPlan: Plan | null;
  approvedPlan: Plan | null;
  diff: PlanDiffType | null;
}

// ============================================================================
// Helper Components
// ============================================================================

function StatusBanner({ proposal }: { proposal: PlanProposal }) {
  if (proposal.status === 'pending') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300">
        <Clock className="w-5 h-5" />
        <span className="text-sm font-medium">Awaiting Review</span>
      </div>
    );
  }

  if (proposal.status === 'applied') {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
        <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-emerald-300">Accepted</p>
          {proposal.resolvedAt && (
            <p className="text-xs text-slate-400 mt-0.5">
              Accepted on {new Date(proposal.resolvedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              {proposal.resolvedBy && ` by ${proposal.resolvedBy}`}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (proposal.status === 'discarded') {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-300">Rejected</p>
          {proposal.rejectionReason && (
            <p className="text-xs text-slate-400 mt-0.5">
              Reason: {proposal.rejectionReason}
            </p>
          )}
          {proposal.resolvedAt && (
            <p className="text-xs text-slate-500 mt-0.5">
              Rejected on {new Date(proposal.resolvedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function WarningsList({ warnings }: { warnings: string[] }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        Warnings
      </h3>
      <ul className="space-y-1">
        {warnings.map((warning, i) => (
          <li key={i} className="text-sm text-amber-300/80 pl-5 relative">
            <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-amber-400/50" />
            {warning}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssumptionsList({ assumptions }: { assumptions?: string[] }) {
  if (!assumptions || assumptions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
        <Lightbulb className="w-3.5 h-3.5 text-blue-400" />
        Assumptions
      </h3>
      <ul className="space-y-1">
        {assumptions.map((assumption, i) => (
          <li key={i} className="text-sm text-slate-300 pl-5 relative">
            <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-blue-400/50" />
            {assumption}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UnknownsList({ unknowns }: { unknowns?: string[] }) {
  if (!unknowns || unknowns.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
        <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
        Unknowns
      </h3>
      <ul className="space-y-1">
        {unknowns.map((unknown, i) => (
          <li key={i} className="text-sm text-slate-300 pl-5 relative">
            <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-purple-400/50" />
            {unknown}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RejectDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Reject Proposal</h2>
        <p className="text-sm text-slate-400 mb-4">
          This will reject the proposal and archive the proposed plan. Optionally provide a reason.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection (optional)"
          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
          rows={3}
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Reject Proposal
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProposalDetailClient({
  companyId,
  companyName,
  proposal,
  proposedPlan,
  approvedPlan,
  diff,
}: ProposalDetailClientProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = proposal.status === 'pending';
  const title = proposal.title || `Proposal ${proposal.id.slice(-6)}`;

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/plan-proposals/${proposal.id}/accept`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept proposal');
      }

      // Refresh the page to show updated status
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept proposal');
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async (reason: string) => {
    setRejecting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/plan-proposals/${proposal.id}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectionReason: reason || undefined }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject proposal');
      }

      setShowRejectDialog(false);
      // Refresh the page to show updated status
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject proposal');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/c/${companyId}/deliver/proposals`}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Proposals
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100 mb-1">{title}</h1>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="capitalize">{proposal.planType} Plan</span>
              <span>•</span>
              <span>
                Created {new Date(proposal.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div className="mb-6">
        <StatusBanner proposal={proposal} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Actions (for pending proposals) */}
      {isPending && (
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={handleAccept}
            disabled={accepting || rejecting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {accepting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Accept Proposal
          </button>
          <button
            onClick={() => setShowRejectDialog(true)}
            disabled={accepting || rejecting}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-300 hover:bg-red-500/20 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Reject
          </button>
        </div>
      )}

      {/* Proposal Details */}
      <div className="space-y-6 mb-8">
        {/* Rationale */}
        {proposal.rationale && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              Rationale
            </h3>
            <p className="text-sm text-slate-300">{proposal.rationale}</p>
          </div>
        )}

        {/* Warnings, Assumptions, Unknowns */}
        {(proposal.warnings?.length > 0 || proposal.assumptions?.length || proposal.unknowns?.length) && (
          <div className="grid gap-4 md:grid-cols-3">
            {proposal.warnings && proposal.warnings.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                <WarningsList warnings={proposal.warnings} />
              </div>
            )}
            {proposal.assumptions && proposal.assumptions.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                <AssumptionsList assumptions={proposal.assumptions} />
              </div>
            )}
            {proposal.unknowns && proposal.unknowns.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                <UnknownsList unknowns={proposal.unknowns} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Diff Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Proposed Changes</h2>

        {diff ? (
          <PlanDiff diff={diff} defaultExpanded={true} />
        ) : proposedPlan ? (
          <div className="flex items-start gap-3 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
            <FileText className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-300">Unable to compute diff</p>
              <p className="text-xs text-slate-500 mt-0.5">
                The plan structure could not be compared. Review the plan directly.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
            <FileText className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-300">No plan to compare</p>
              <p className="text-xs text-slate-500 mt-0.5">
                The proposed plan could not be loaded.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <RejectDialog
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onConfirm={handleReject}
        loading={rejecting}
      />
    </div>
  );
}

export default ProposalDetailClient;
