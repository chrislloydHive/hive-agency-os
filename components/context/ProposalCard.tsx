// components/context/ProposalCard.tsx
// Proposal Card Component
//
// Shows a pending AI proposal with accept/edit/reject actions
// Used inline within context fields to show proposals

'use client';

import { useState, useCallback } from 'react';
import { Check, X, Pencil, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { ContextProposal } from '@/lib/contextGraph/nodes';

interface ProposalCardProps {
  proposal: ContextProposal;
  batchId: string;
  currentValue: unknown;
  onAccept: (proposalId: string, batchId: string) => Promise<void>;
  onReject: (proposalId: string, batchId: string) => Promise<void>;
  onEdit: (proposalId: string, batchId: string, editedValue: unknown) => Promise<void>;
  isLoading?: boolean;
}

export function ProposalCard({
  proposal,
  batchId,
  currentValue,
  onAccept,
  onReject,
  onEdit,
  isLoading = false,
}: ProposalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState<string>(
    typeof proposal.proposedValue === 'string'
      ? proposal.proposedValue
      : JSON.stringify(proposal.proposedValue, null, 2)
  );
  const [showReasoning, setShowReasoning] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAccept = useCallback(async () => {
    setActionLoading('accept');
    try {
      await onAccept(proposal.id, batchId);
    } finally {
      setActionLoading(null);
    }
  }, [proposal.id, batchId, onAccept]);

  const handleReject = useCallback(async () => {
    setActionLoading('reject');
    try {
      await onReject(proposal.id, batchId);
    } finally {
      setActionLoading(null);
    }
  }, [proposal.id, batchId, onReject]);

  const handleSaveEdit = useCallback(async () => {
    setActionLoading('edit');
    try {
      // Try to parse as JSON, otherwise use as string
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(editedValue);
      } catch {
        parsedValue = editedValue;
      }
      await onEdit(proposal.id, batchId, parsedValue);
      setIsEditing(false);
    } finally {
      setActionLoading(null);
    }
  }, [proposal.id, batchId, editedValue, onEdit]);

  const confidencePercent = Math.round(proposal.confidence * 100);
  const isValueDifferent = JSON.stringify(currentValue) !== JSON.stringify(proposal.proposedValue);

  // Format values for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(', ');
    return JSON.stringify(value);
  };

  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-medium text-amber-400">AI Proposal</span>
          <span className="text-[10px] text-amber-400/70">{confidencePercent}% confidence</span>
        </div>
        <span className="text-[10px] text-slate-500">
          {proposal.trigger.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Current vs Proposed */}
      {isValueDifferent && currentValue !== null && currentValue !== undefined && (
        <div className="mb-2 text-xs">
          <div className="text-slate-500 mb-0.5">Current:</div>
          <div className="text-slate-400 bg-slate-800/50 rounded px-2 py-1 line-through opacity-75">
            {formatValue(currentValue)}
          </div>
        </div>
      )}

      {/* Proposed Value or Edit Mode */}
      {isEditing ? (
        <div className="mb-2">
          <div className="text-slate-500 text-xs mb-0.5">Edit proposed value:</div>
          <textarea
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none"
            rows={3}
          />
        </div>
      ) : (
        <div className="mb-2 text-xs">
          <div className="text-slate-500 mb-0.5">Proposed:</div>
          <div className="text-slate-200 bg-slate-800/50 rounded px-2 py-1 border-l-2 border-amber-500/50">
            {formatValue(proposal.proposedValue)}
          </div>
        </div>
      )}

      {/* Reasoning Toggle */}
      {proposal.reasoning && (
        <button
          type="button"
          onClick={() => setShowReasoning(!showReasoning)}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-400 mb-2"
        >
          {showReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Why this suggestion?
        </button>
      )}

      {showReasoning && proposal.reasoning && (
        <div className="mb-2 text-[10px] text-slate-400 bg-slate-800/30 rounded px-2 py-1.5 italic">
          {proposal.reasoning}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isLoading || actionLoading !== null}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === 'edit' ? (
                <span className="animate-pulse">Saving...</span>
              ) : (
                <>
                  <Check className="h-3 w-3" />
                  Save
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isLoading || actionLoading !== null}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleAccept}
              disabled={isLoading || actionLoading !== null}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === 'accept' ? (
                <span className="animate-pulse">Accepting...</span>
              ) : (
                <>
                  <Check className="h-3 w-3" />
                  Accept
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isLoading || actionLoading !== null}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isLoading || actionLoading !== null}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === 'reject' ? (
                <span className="animate-pulse">Rejecting...</span>
              ) : (
                <>
                  <X className="h-3 w-3" />
                  Reject
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
