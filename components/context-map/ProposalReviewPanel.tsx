// components/context-map/ProposalReviewPanel.tsx
// Slide-out panel for reviewing proposal batches
//
// V4 Convergence: Adds decision impact badges, specificity scoring,
// low-impact filtering, and Confirm Best per Domain button

'use client';

import { useState } from 'react';
import { X, Check, Trash2, Pencil, CheckCheck, Sparkles, Filter, Zap, Target, Eye, EyeOff, ChevronDown, ChevronUp, AlertTriangle, Link as LinkIcon, Quote } from 'lucide-react';
import type { HydratedContextNode } from '@/lib/contextGraph/nodes';
import type { DecisionImpact } from '@/lib/types/contextField';
import { getShortLabel, formatNodeValue, getZoneForField, getZoneColor } from './constants';

interface ProposalReviewPanelProps {
  isOpen: boolean;
  nodes: HydratedContextNode[];
  onClose: () => void;
  onAcceptProposal: (proposalId: string, batchId: string) => Promise<void>;
  onRejectProposal: (proposalId: string, batchId: string) => Promise<void>;
  onEditProposal?: (proposalId: string, batchId: string, value: unknown) => Promise<void>;
  onAcceptAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
  /** Deep link: Show only proposals from this batch */
  focusBatchId?: string;
  /** Company ID for confirm-best endpoint */
  companyId?: string;
  /** Callback when confirm-best completes */
  onConfirmBestComplete?: () => void;
}

type ReviewStatus = 'pending' | 'accepted' | 'rejected' | 'loading';

export function ProposalReviewPanel({
  isOpen,
  nodes,
  onClose,
  onAcceptProposal,
  onRejectProposal,
  onEditProposal,
  onAcceptAll,
  onRejectAll,
  focusBatchId,
  companyId,
  onConfirmBestComplete,
}: ProposalReviewPanelProps) {
  // Filter to only nodes with pending proposals
  const allProposalNodes = nodes.filter(n => n.pendingProposal);

  // Track individual review status
  const [reviewStatus, setReviewStatus] = useState<Record<string, ReviewStatus>>({});
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // V4 Convergence: Filter controls
  const [showLowImpact, setShowLowImpact] = useState(false);
  const [isConfirmingBest, setIsConfirmingBest] = useState(false);

  // V4 Evidence Grounding: Track expanded evidence sections
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());

  // Filter proposals based on decision impact
  const proposalNodes = showLowImpact
    ? allProposalNodes
    : allProposalNodes.filter(n => {
        const impact = n.decisionImpact || n.pendingProposal?.decisionImpact;
        // Show MEDIUM and HIGH by default, hide LOW
        return impact !== 'LOW' && !n.hiddenByDefault;
      });

  // Count hidden proposals
  const hiddenCount = allProposalNodes.length - proposalNodes.length;

  if (!isOpen) return null;

  const handleAccept = async (node: HydratedContextNode) => {
    if (!node.pendingProposal || !node.proposalBatchId) return;

    setReviewStatus(prev => ({ ...prev, [node.key]: 'loading' }));
    try {
      await onAcceptProposal(node.pendingProposal.id, node.proposalBatchId);
      setReviewStatus(prev => ({ ...prev, [node.key]: 'accepted' }));
    } catch {
      setReviewStatus(prev => ({ ...prev, [node.key]: 'pending' }));
    }
  };

  const handleReject = async (node: HydratedContextNode) => {
    if (!node.pendingProposal || !node.proposalBatchId) return;

    setReviewStatus(prev => ({ ...prev, [node.key]: 'loading' }));
    try {
      await onRejectProposal(node.pendingProposal.id, node.proposalBatchId);
      setReviewStatus(prev => ({ ...prev, [node.key]: 'rejected' }));
    } catch {
      setReviewStatus(prev => ({ ...prev, [node.key]: 'pending' }));
    }
  };

  const handleEdit = async (node: HydratedContextNode) => {
    if (!node.pendingProposal || !node.proposalBatchId || !onEditProposal) return;

    try {
      // Try to parse as JSON, otherwise use as string
      let parsedValue: unknown = editValue;
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        // Keep as string
      }

      await onEditProposal(node.pendingProposal.id, node.proposalBatchId, parsedValue);
      setEditingKey(null);
      setReviewStatus(prev => ({ ...prev, [node.key]: 'accepted' }));
    } catch (e) {
      console.error('Edit failed:', e);
    }
  };

  const startEdit = (node: HydratedContextNode) => {
    setEditingKey(node.key);
    const value = node.pendingProposal?.proposedValue;
    setEditValue(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  };

  const handleAcceptAllClick = async () => {
    setIsProcessingAll(true);
    try {
      await onAcceptAll();
      // Mark all as accepted
      const newStatus: Record<string, ReviewStatus> = {};
      proposalNodes.forEach(n => { newStatus[n.key] = 'accepted'; });
      setReviewStatus(newStatus);
    } finally {
      setIsProcessingAll(false);
    }
  };

  const handleRejectAllClick = async () => {
    setIsProcessingAll(true);
    try {
      await onRejectAll();
      // Mark all as rejected
      const newStatus: Record<string, ReviewStatus> = {};
      proposalNodes.forEach(n => { newStatus[n.key] = 'rejected'; });
      setReviewStatus(newStatus);
    } finally {
      setIsProcessingAll(false);
    }
  };

  // V4 Convergence: Confirm Best per Domain
  const handleConfirmBest = async () => {
    if (!companyId) {
      console.warn('Cannot confirm best: missing companyId');
      return;
    }

    setIsConfirmingBest(true);
    try {
      const response = await fetch('/api/os/context/proposals/confirm-best', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          userId: 'user', // TODO: Get actual user ID
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Confirm best failed:', error);
        return;
      }

      const result = await response.json();
      console.log('Confirm best result:', result);

      // Update local state
      const newStatus: Record<string, ReviewStatus> = {};
      for (const confirmed of result.confirmed || []) {
        // Find the node with this field path and mark as accepted
        const node = proposalNodes.find(n => n.key === confirmed.fieldPath);
        if (node) {
          newStatus[node.key] = 'accepted';
        }
      }
      for (const rejected of result.rejected || []) {
        const node = proposalNodes.find(n => n.key === rejected.fieldPath);
        if (node) {
          newStatus[node.key] = 'rejected';
        }
      }
      setReviewStatus(prev => ({ ...prev, ...newStatus }));

      // Notify parent
      onConfirmBestComplete?.();
    } catch (error) {
      console.error('Confirm best error:', error);
    } finally {
      setIsConfirmingBest(false);
    }
  };

  const pendingCount = proposalNodes.filter(n => !reviewStatus[n.key] || reviewStatus[n.key] === 'pending').length;
  const acceptedCount = proposalNodes.filter(n => reviewStatus[n.key] === 'accepted').length;
  const rejectedCount = proposalNodes.filter(n => reviewStatus[n.key] === 'rejected').length;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Review AI Proposals</h2>
            <p className="text-xs text-slate-400">
              {focusBatchId ? `Batch: ${focusBatchId.slice(0, 8)}... · ` : ''}
              {pendingCount} pending · {acceptedCount} accepted · {rejectedCount} rejected
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* V4 Convergence: Filter Toggle */}
      {hiddenCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/20">
          <button
            onClick={() => setShowLowImpact(!showLowImpact)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showLowImpact ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {showLowImpact ? 'Hide' : 'Show'} low-impact ({hiddenCount})
          </button>
        </div>
      )}

      {/* Bulk Actions */}
      {pendingCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-700 bg-slate-800/30">
          {/* V4 Convergence: Confirm Best per Domain */}
          {companyId && (
            <button
              onClick={handleConfirmBest}
              disabled={isProcessingAll || isConfirmingBest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs font-medium rounded transition-colors disabled:opacity-50"
              title="Confirm the highest-ranked proposal per domain and reject the rest"
            >
              <Target className="w-3.5 h-3.5" />
              {isConfirmingBest ? 'Processing...' : 'Confirm Best per Domain'}
            </button>
          )}
          <button
            onClick={handleAcceptAllClick}
            disabled={isProcessingAll || isConfirmingBest}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium rounded transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Accept All ({pendingCount})
          </button>
          <button
            onClick={handleRejectAllClick}
            disabled={isProcessingAll || isConfirmingBest}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            Reject All
          </button>
        </div>
      )}

      {/* Proposal List */}
      <div className="flex-1 overflow-y-auto">
        {proposalNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-slate-500" />
            </div>
            <div className="text-slate-400 text-sm mb-2">
              No pending proposals
            </div>
            <div className="text-slate-500 text-xs max-w-[280px]">
              {allProposalNodes.length === 0 ? (
                <>
                  AI proposals will appear here when generated.
                  Run a diagnostic or use "Suggest Context" to get started.
                </>
              ) : (
                <>
                  All {allProposalNodes.length} proposal(s) are hidden due to low impact.
                  Click "Show low-impact" above to reveal them.
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {proposalNodes.map((node) => {
              const status = reviewStatus[node.key] || 'pending';
              const zoneId = getZoneForField(node.key);
              const zoneColor = getZoneColor(zoneId);
              const isEditing = editingKey === node.key;

              return (
                <div
                  key={node.key}
                  className={`p-4 ${status !== 'pending' ? 'opacity-50' : ''}`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: zoneColor }}
                      />
                      <span className="text-sm font-medium text-slate-200">
                        {getShortLabel(node.key)}
                      </span>
                      {status === 'accepted' && (
                        <span className="text-xs text-emerald-400">Accepted</span>
                      )}
                      {status === 'rejected' && (
                        <span className="text-xs text-red-400">Rejected</span>
                      )}
                      {status === 'loading' && (
                        <span className="text-xs text-amber-400 animate-pulse">Processing...</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">{node.category}</span>
                  </div>

                  {/* V4 Convergence: Impact & Specificity Badges */}
                  {(node.decisionImpact || node.specificityScore !== undefined) && (
                    <div className="flex items-center gap-2 mb-2">
                      {/* Decision Impact Badge */}
                      {node.decisionImpact && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            node.decisionImpact === 'HIGH'
                              ? 'bg-purple-500/20 text-purple-400'
                              : node.decisionImpact === 'MEDIUM'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          <Zap className="w-2.5 h-2.5" />
                          {node.decisionImpact}
                        </span>
                      )}
                      {/* Specificity Score Badge */}
                      {node.specificityScore !== undefined && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            node.specificityScore >= 70
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : node.specificityScore >= 45
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                          title={
                            node.genericnessReasons?.length
                              ? `Issues: ${node.genericnessReasons.join(', ')}`
                              : 'Specificity score'
                          }
                        >
                          <Filter className="w-2.5 h-2.5" />
                          {node.specificityScore}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Current Value (if exists) */}
                  {node.value !== null && node.value !== undefined && (
                    <div className="mb-2 p-2 bg-slate-800/50 rounded text-xs">
                      <div className="text-slate-500 mb-1">Current:</div>
                      <div className="text-slate-300 line-clamp-2">
                        {formatNodeValue(node.value, 100)}
                      </div>
                    </div>
                  )}

                  {/* Proposed Value */}
                  {isEditing ? (
                    <div className="mb-2">
                      <div className="text-xs text-amber-500 mb-1">Edit proposed value:</div>
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full p-2 bg-slate-800 border border-amber-500/50 rounded text-sm text-slate-200 font-mono"
                        rows={3}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleEdit(node)}
                          className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded hover:bg-amber-500/30"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
                      <div className="text-amber-500 mb-1">Proposed:</div>
                      <div className="text-slate-200">
                        {formatNodeValue(node.pendingProposal?.proposedValue, 150)}
                      </div>
                    </div>
                  )}

                  {/* Confidence & Reasoning */}
                  {node.pendingProposal?.reasoning && (
                    <div className="mb-3 text-xs text-slate-400 italic">
                      &ldquo;{node.pendingProposal.reasoning}&rdquo;
                    </div>
                  )}

                  {/* V4 Evidence Grounding */}
                  {(() => {
                    const evidenceAnchors = node.evidenceAnchors || node.pendingProposal?.evidenceAnchors;
                    const isUngrounded = node.isUngrounded || node.pendingProposal?.isUngrounded ||
                      (evidenceAnchors !== undefined && evidenceAnchors.length === 0);
                    const isExpanded = expandedEvidence.has(node.key);

                    const toggleEvidence = () => {
                      setExpandedEvidence(prev => {
                        const next = new Set(prev);
                        if (next.has(node.key)) {
                          next.delete(node.key);
                        } else {
                          next.add(node.key);
                        }
                        return next;
                      });
                    };

                    return (
                      <>
                        {/* Ungrounded Warning */}
                        {isUngrounded && (
                          <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-400">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Ungrounded proposal — no evidence from website</span>
                          </div>
                        )}

                        {/* Evidence Expander */}
                        {evidenceAnchors && evidenceAnchors.length > 0 && (
                          <div className="mb-3">
                            <button
                              onClick={toggleEvidence}
                              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                              <Quote className="w-3 h-3" />
                              Evidence ({evidenceAnchors.length})
                            </button>

                            {isExpanded && (
                              <div className="mt-2 space-y-2 pl-4 border-l-2 border-slate-700">
                                {evidenceAnchors.map((anchor, idx) => (
                                  <div key={idx} className="text-xs">
                                    <div className="text-slate-300 italic mb-1">
                                      &ldquo;{anchor.quote}&rdquo;
                                    </div>
                                    {(anchor.url || anchor.pageTitle) && (
                                      <div className="flex items-center gap-1 text-slate-500">
                                        {anchor.url ? (
                                          <a
                                            href={anchor.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 hover:text-blue-400 transition-colors"
                                          >
                                            <LinkIcon className="w-3 h-3" />
                                            {anchor.pageTitle || 'Source'}
                                          </a>
                                        ) : (
                                          <span>{anchor.pageTitle}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Actions */}
                  {status === 'pending' && !isEditing && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAccept(node)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium rounded transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Accept
                      </button>
                      {onEditProposal && (
                        <button
                          onClick={() => startEdit(node)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-medium rounded transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleReject(node)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
        <button
          onClick={onClose}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
