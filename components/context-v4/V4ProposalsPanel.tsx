// components/context-v4/V4ProposalsPanel.tsx
// Context V4 Proposals Review Panel
//
// Shows pending V4 proposals with one-click confirm/reject actions.
// Used in the Decide phase to review GAP/Labs extracted context.

'use client';

import { useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  Pencil,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileSearch,
  Zap,
} from 'lucide-react';
import type { ContextProposal } from '@/lib/types/contextProposal';
import { useV4Proposals } from '@/hooks/context/useV4Proposals';
import { getPromotableFieldConfig } from '@/lib/contextGraph/v4/promotion/promotableFields';

// ============================================================================
// Types
// ============================================================================

interface V4ProposalsPanelProps {
  companyId: string;
  onConfirmComplete?: () => void;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function SourceBadge({ sourceType }: { sourceType: string }) {
  const sourceLabels: Record<string, { label: string; color: string }> = {
    full_gap: { label: 'GAP', color: 'bg-blue-500/20 text-blue-400' },
    gap_ia: { label: 'GAP IA', color: 'bg-blue-500/20 text-blue-400' },
    website_lab: { label: 'Website Lab', color: 'bg-purple-500/20 text-purple-400' },
    brand_lab: { label: 'Brand Lab', color: 'bg-purple-500/20 text-purple-400' },
    audience_lab: { label: 'Audience Lab', color: 'bg-purple-500/20 text-purple-400' },
    competition_lab: { label: 'Competition Lab', color: 'bg-purple-500/20 text-purple-400' },
    content_lab: { label: 'Content Lab', color: 'bg-purple-500/20 text-purple-400' },
    seo_lab: { label: 'SEO Lab', color: 'bg-purple-500/20 text-purple-400' },
    manual: { label: 'Manual', color: 'bg-slate-500/20 text-slate-400' },
  };

  const config = sourceLabels[sourceType] || sourceLabels.manual;

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level =
    confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low';
  const colors = {
    high: 'bg-emerald-500/20 text-emerald-400',
    medium: 'bg-amber-500/20 text-amber-400',
    low: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[level]}`}>
      <Zap className="w-2.5 h-2.5" />
      {confidence}%
    </span>
  );
}

function ProposalCard({
  proposal,
  isActioning,
  onConfirm,
  onReject,
}: {
  proposal: ContextProposal;
  isActioning: boolean;
  onConfirm: (proposalId: string, overrideValue?: string) => Promise<void>;
  onReject: (proposalId: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(proposal.proposedValue);
  const [showEvidence, setShowEvidence] = useState(false);

  const fieldConfig = getPromotableFieldConfig(proposal.fieldKey);
  const fieldLabel = fieldConfig?.label || proposal.fieldKey;

  const handleConfirm = async () => {
    const value = isEditing ? editValue : undefined;
    await onConfirm(proposal.id, value);
    setIsEditing(false);
  };

  const handleReject = async () => {
    await onReject(proposal.id);
  };

  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-slate-200">{fieldLabel}</h4>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {proposal.fieldKey}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <SourceBadge sourceType={proposal.sourceType} />
          <ConfidenceBadge confidence={proposal.confidence} />
        </div>
      </div>

      {/* Proposed Value */}
      {isEditing ? (
        <div className="mb-3">
          <div className="text-[10px] text-amber-400 mb-1">Edit value:</div>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-amber-500/30 rounded text-slate-200 focus:outline-none focus:border-amber-500/50 resize-none"
            rows={3}
          />
        </div>
      ) : (
        <div className="mb-3 p-2.5 bg-amber-500/5 border border-amber-500/20 rounded">
          <div className="text-[10px] text-amber-400 mb-1">Proposed value:</div>
          <div className="text-sm text-slate-200 whitespace-pre-wrap">
            {proposal.proposedValue || '(empty)'}
          </div>
        </div>
      )}

      {/* Evidence Toggle */}
      {proposal.evidence && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
          >
            {showEvidence ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            Evidence
          </button>
          {showEvidence && (
            <div className="mt-2 p-2 bg-slate-800/50 rounded text-[11px] text-slate-400 italic">
              {proposal.evidence}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isActioning}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isActioning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Save & Confirm
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditValue(proposal.proposedValue);
              }}
              disabled={isActioning}
              className="px-2.5 py-1 text-xs font-medium rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isActioning}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isActioning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isActioning}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isActioning}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isActioning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function V4ProposalsPanel({
  companyId,
  onConfirmComplete,
  className = '',
}: V4ProposalsPanelProps) {
  const {
    pendingProposals,
    byStatus,
    loading,
    error,
    refresh,
    confirmProposal,
    rejectProposal,
    generateProposals,
    isActioning,
  } = useV4Proposals(companyId, { statusFilter: 'proposed' });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleConfirm = async (proposalId: string, overrideValue?: string) => {
    try {
      await confirmProposal(proposalId, { overrideValue });
      onConfirmComplete?.();
    } catch {
      // Error handled by hook
    }
  };

  const handleReject = async (proposalId: string) => {
    try {
      await rejectProposal(proposalId);
    } catch {
      // Error handled by hook
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const result = await generateProposals();
      if (result.createdCount === 0) {
        setGenerateError('No new proposals found. Run more diagnostics to extract context.');
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          <span className="ml-2 text-sm text-slate-400">Loading proposals...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-slate-900/50 border border-red-500/30 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={refresh}
          className="mt-3 text-xs text-slate-400 hover:text-slate-300"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">Context Proposals</h3>
            <p className="text-xs text-slate-500">
              {pendingProposals.length} pending · {byStatus.confirmed} confirmed · {byStatus.rejected} rejected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSearch className="w-3.5 h-3.5" />
            )}
            Generate
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Generation Error */}
      {generateError && (
        <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/20">
          <p className="text-xs text-amber-400">{generateError}</p>
        </div>
      )}

      {/* Proposals List */}
      <div className="p-4">
        {pendingProposals.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 mb-2">No pending proposals</p>
            <p className="text-xs text-slate-500 max-w-[280px] mx-auto">
              Click "Generate" to extract proposals from your diagnostic runs, or run labs first.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                isActioning={isActioning === proposal.id}
                onConfirm={handleConfirm}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default V4ProposalsPanel;
