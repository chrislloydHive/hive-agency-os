'use client';

// components/os/strategy/GuidedRevisionPanel.tsx
// "Guided Revision" Panel - Strategy revision proposals from learnings
//
// Design principle: Proposals are drafts that require explicit apply/reject.
// This is a "human-in-the-loop editor," not an autonomous optimizer.

import { useState, useCallback, useEffect } from 'react';
import {
  Wand2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRight,
  FileEdit,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  StrategyRevisionProposal,
  StrategyRevisionChange,
  RevisionConfidence,
} from '@/lib/types/strategyRevision';
import {
  getRevisionTargetLabel,
  getRevisionActionLabel,
  getConfidenceColorClass,
  isHighImpactProposal,
  hasRemovalChanges,
} from '@/lib/types/strategyRevision';

// ============================================================================
// Types
// ============================================================================

interface GuidedRevisionPanelProps {
  companyId: string;
  strategyId: string;
  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Callback when a proposal is applied */
  onProposalApplied?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function GuidedRevisionPanel({
  companyId,
  strategyId,
  defaultCollapsed = true,
  onProposalApplied,
}: GuidedRevisionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [proposals, setProposals] = useState<StrategyRevisionProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Fetch existing proposals
  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/revision-proposals?status=draft`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch proposals');
      }

      const data = await response.json();
      setProposals(data.proposals || []);
      setError(null);
    } catch (err) {
      console.error('[GuidedRevisionPanel] Error fetching proposals:', err);
      setError('Failed to load revision proposals');
    } finally {
      setLoading(false);
    }
  }, [companyId, strategyId]);

  // Generate new proposals
  const handleGenerate = useCallback(async () => {
    try {
      setGenerating(true);
      setError(null);

      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/revision-proposals`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate proposals');
      }

      const data = await response.json();
      setProposals(data.proposals || []);

      if (data.proposals?.length === 0) {
        // No proposals generated is not an error
        setError(null);
      }
    } catch (err) {
      console.error('[GuidedRevisionPanel] Error generating proposals:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate proposals');
    } finally {
      setGenerating(false);
    }
  }, [companyId, strategyId]);

  // Apply a proposal
  const handleApply = useCallback(async (proposalId: string, force = false) => {
    try {
      setApplyingId(proposalId);
      setError(null);

      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/revision-proposals/${proposalId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'apply', forceApply: force }),
        }
      );

      const data = await response.json();

      if (response.status === 409 && data.status === 'confirmation_required') {
        // Need confirmation for high-impact changes
        setConfirmingId(proposalId);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply proposal');
      }

      // Remove applied proposal from list
      setProposals(prev => prev.filter(p => p.id !== proposalId));
      setConfirmingId(null);
      onProposalApplied?.();
    } catch (err) {
      console.error('[GuidedRevisionPanel] Error applying proposal:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply proposal');
    } finally {
      setApplyingId(null);
    }
  }, [companyId, strategyId, onProposalApplied]);

  // Reject a proposal
  const handleReject = useCallback(async (proposalId: string) => {
    try {
      setApplyingId(proposalId);

      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/revision-proposals/${proposalId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject' }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject proposal');
      }

      // Remove rejected proposal from list
      setProposals(prev => prev.filter(p => p.id !== proposalId));
    } catch (err) {
      console.error('[GuidedRevisionPanel] Error rejecting proposal:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject proposal');
    } finally {
      setApplyingId(null);
    }
  }, [companyId, strategyId]);

  // Load proposals on mount
  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const draftCount = proposals.filter(p => p.status === 'draft').length;

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-purple-500/10 rounded-lg">
            <Wand2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-medium text-white">Guided Revision</h3>
            <p className="text-xs text-slate-500">
              {draftCount > 0
                ? `${draftCount} suggestion${draftCount !== 1 ? 's' : ''} based on learnings`
                : 'Generate suggestions from outcome signals'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Count badge */}
          {draftCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded">
              {draftCount} draft{draftCount !== 1 ? 's' : ''}
            </span>
          )}

          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Content - collapsible */}
      {!isCollapsed && (
        <div className="px-4 pb-4 border-t border-slate-800">
          {/* Generate button */}
          <div className="mt-4 mb-4">
            <button
              onClick={handleGenerate}
              disabled={generating || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium rounded-lg border border-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Generate Suggestions
                </>
              )}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!loading && proposals.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500">
                No suggestions yet. Generate suggestions from your outcome signals.
              </p>
            </div>
          )}

          {/* Proposals list */}
          {!loading && proposals.length > 0 && (
            <div className="space-y-3">
              {proposals.map(proposal => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onApply={() => handleApply(proposal.id)}
                  onReject={() => handleReject(proposal.id)}
                  onConfirmApply={() => handleApply(proposal.id, true)}
                  onCancelConfirm={() => setConfirmingId(null)}
                  isApplying={applyingId === proposal.id}
                  isConfirming={confirmingId === proposal.id}
                />
              ))}
            </div>
          )}

          {/* Note about proposals */}
          <div className="mt-4 pt-3 border-t border-slate-800/50">
            <p className="text-[10px] text-slate-600 text-center">
              Suggestions are drafts. Review each before applying to your strategy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Proposal Card
// ============================================================================

function ProposalCard({
  proposal,
  onApply,
  onReject,
  onConfirmApply,
  onCancelConfirm,
  isApplying,
  isConfirming,
}: {
  proposal: StrategyRevisionProposal;
  onApply: () => void;
  onReject: () => void;
  onConfirmApply: () => void;
  onCancelConfirm: () => void;
  isApplying: boolean;
  isConfirming: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isHighImpact = isHighImpactProposal(proposal);
  const hasRemovals = hasRemovalChanges(proposal);

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getConfidenceColorClass(proposal.confidence)}`}>
              {proposal.confidence}
            </span>
            {isHighImpact && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                High Impact
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-white">{proposal.title}</h4>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
            {proposal.summary}
          </p>
        </div>
      </div>

      {/* Evidence link */}
      <div className="mt-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          {expanded ? 'Hide details' : `Based on ${proposal.signalIds.length} learning${proposal.signalIds.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Expanded: Changes + Evidence */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Changes */}
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Changes</p>
            {proposal.changes.map((change, idx) => (
              <ChangePreview key={idx} change={change} />
            ))}
          </div>

          {/* Evidence */}
          {proposal.evidence.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Evidence</p>
              <div className="space-y-1">
                {proposal.evidence.slice(0, 3).map((item, idx) => (
                  <p key={idx} className="text-xs text-slate-400 flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
                    <span className="line-clamp-2">{item}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation dialog */}
      {isConfirming && (
        <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-400 mb-2">
            This proposal includes high-impact changes. Are you sure?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onConfirmApply}
              disabled={isApplying}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
            >
              {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm Apply'}
            </button>
            <button
              onClick={onCancelConfirm}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isConfirming && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onApply}
            disabled={isApplying}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-medium rounded-lg border border-purple-500/30 transition-colors disabled:opacity-50"
          >
            {isApplying ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-3 h-3" />
                Apply
              </>
            )}
          </button>
          <button
            onClick={onReject}
            disabled={isApplying}
            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Change Preview
// ============================================================================

function ChangePreview({ change }: { change: StrategyRevisionChange }) {
  const ActionIcon = change.action === 'add' ? Plus : change.action === 'remove' ? Trash2 : FileEdit;

  return (
    <div className="flex items-start gap-2 p-2 bg-slate-900/50 rounded">
      <div className={`p-1 rounded ${
        change.action === 'add' ? 'bg-emerald-500/10 text-emerald-400' :
        change.action === 'remove' ? 'bg-red-500/10 text-red-400' :
        'bg-blue-500/10 text-blue-400'
      }`}>
        <ActionIcon className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300">
          <span className="font-medium">{getRevisionActionLabel(change.action)}</span>
          {' '}
          <span className="text-slate-500">{getRevisionTargetLabel(change.target)}</span>
        </p>
        {change.description && (
          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
            {change.description}
          </p>
        )}
      </div>
    </div>
  );
}

export default GuidedRevisionPanel;
