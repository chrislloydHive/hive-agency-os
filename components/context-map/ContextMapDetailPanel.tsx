// components/context-map/ContextMapDetailPanel.tsx
// Right-side detail drawer for node inspection and actions

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Check, Pencil, Sparkles, User, TestTube, ArrowRight, ChevronDown, ChevronUp, Eye, Edit3, Loader2, CheckCircle2, XCircle, AlertCircle, Code, Trash2, LinkIcon } from 'lucide-react';
import type { HydratedContextNode } from '@/lib/contextGraph/nodes';
import type { WhereUsedRef } from './types';
import { getShortLabel, formatRelativeTime, SOURCE_LABELS, formatNodeValue, getNodeTier, DOMAIN_TO_ZONE, ZONE_DEFINITIONS } from './constants';
import { RefinementComparisonPanel, RefinementPrompt } from './RefinementComparisonPanel';
import { FieldInput, getValuePreview } from './field-renderers';
import { getSchemaV2Entry } from '@/lib/contextGraph/unifiedRegistry';

/** Mode for the detail panel */
type PanelMode = 'view' | 'edit';

/** Inline notification for actions */
interface ActionNotification {
  type: 'success' | 'error' | 'info';
  message: string;
}

/** AI refinement data from API */
interface RefinementData {
  originalValue: unknown;
  refinedValue: unknown;
  rationale: string;
  confidence: number;
  hasDifference: boolean;
  changes?: {
    type: 'clarified' | 'structured' | 'expanded' | 'corrected' | 'formatted';
    description: string;
  };
}

interface ContextMapDetailPanelProps {
  node: HydratedContextNode | null;
  isOpen: boolean;
  onClose: () => void;
  /** Company ID for API calls (refinement, etc.) */
  companyId?: string;
  /** For proposal actions (proposed nodes) */
  onAcceptProposal?: (proposalId: string, batchId: string) => Promise<void>;
  onRejectProposal?: (proposalId: string, batchId: string) => Promise<void>;
  onEditProposal?: (proposalId: string, batchId: string, value: unknown) => Promise<void>;
  /** For confirmed node editing (creates new revision) */
  onUpdateNode?: (nodeKey: string, value: unknown) => Promise<void>;
  /** For deleting a node's value */
  onDeleteNode?: (nodeKey: string) => Promise<void>;
  /** Where this context node is referenced */
  whereUsed?: WhereUsedRef[];
}

export function ContextMapDetailPanel({
  node,
  isOpen,
  onClose,
  companyId,
  onAcceptProposal,
  onRejectProposal,
  onEditProposal,
  onUpdateNode,
  onDeleteNode,
  whereUsed = [],
}: ContextMapDetailPanelProps) {
  const [mode, setMode] = useState<PanelMode>('view');
  const [editedValue, setEditedValue] = useState<unknown>('');
  const [showProvenance, setShowProvenance] = useState(false);
  const [showWhereUsed, setShowWhereUsed] = useState(false);
  const [showRawValue, setShowRawValue] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<ActionNotification | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // AI Refinement state
  const [showRefinementPrompt, setShowRefinementPrompt] = useState(false);
  const [refinementLoading, setRefinementLoading] = useState(false);
  const [refinementData, setRefinementData] = useState<RefinementData | null>(null);

  // Reset state when node changes
  useEffect(() => {
    if (node) {
      setMode('view');
      setEditedValue('');
      setNotification(null);
      setShowDeleteConfirm(false);
      setShowRefinementPrompt(false);
      setRefinementData(null);
      setShowWhereUsed(false);
    }
  }, [node?.key]);

  // Auto-clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleClose = useCallback(() => {
    setMode('view');
    setEditedValue('');
    setShowProvenance(false);
    setShowDeleteConfirm(false);
    setNotification(null);
    onClose();
  }, [onClose]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!node || !onDeleteNode) return;
    setActionLoading('delete');
    try {
      await onDeleteNode(node.key);
      setNotification({ type: 'success', message: 'Value deleted' });
      setShowDeleteConfirm(false);
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete';
      setNotification({ type: 'error', message });
    } finally {
      setActionLoading(null);
    }
  }, [node, onDeleteNode, handleClose]);

  // AI Refinement handlers (must be before early return to maintain hooks order)
  const invokeRefinement = useCallback(async () => {
    if (!node || !companyId) return;
    setRefinementLoading(true);
    setShowRefinementPrompt(false);
    try {
      const response = await fetch('/api/os/context/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          nodeKey: node.key,
          originalValue: node.value,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to get refinement');
      }
      const data = await response.json();
      if (data.success) {
        setRefinementData(data);
      } else {
        setNotification({ type: 'error', message: 'Refinement failed' });
      }
    } catch (error) {
      console.error('[ContextMap] Refinement failed:', error);
      setNotification({ type: 'error', message: 'Failed to get AI refinement' });
    } finally {
      setRefinementLoading(false);
    }
  }, [node, companyId]);

  const handleAcceptRefinement = useCallback(async (refinedValue: unknown) => {
    if (!node || !onUpdateNode) return;
    try {
      await onUpdateNode(node.key, refinedValue);
      setNotification({ type: 'success', message: 'Refined value saved' });
      setRefinementData(null);
    } catch (error) {
      console.error('[ContextMap] Accept refinement failed:', error);
      setNotification({ type: 'error', message: 'Failed to save refinement' });
    }
  }, [node, onUpdateNode]);

  const handleEditRefinement = useCallback((value: unknown) => {
    // User wants to edit the refined value before saving
    setEditedValue(value);
    setRefinementData(null);
    setMode('edit');
  }, []);

  const handleKeepOriginal = useCallback(async () => {
    // Just dismiss refinement, keep original value (already saved)
    setRefinementData(null);
    setNotification({ type: 'info', message: 'Kept original value' });
  }, []);

  const dismissRefinement = useCallback(() => {
    setRefinementData(null);
    setShowRefinementPrompt(false);
  }, []);

  // Get Schema V2 field metadata for type-aware editing (must be before early return for hooks consistency)
  const fieldMeta = useMemo(() => node ? getSchemaV2Entry(node.key) : null, [node?.key]);

  if (!isOpen || !node) return null;

  // AI safety: Determine if editing is allowed for this node
  // - Confirmed nodes: Can edit (creates new revision with user source)
  // - Proposed nodes WITH pendingProposal: Use Accept/Reject/Edit flow
  // - Proposed nodes WITHOUT pendingProposal: Can edit (confirms the value)
  const isConfirmed = node.status === 'confirmed';
  const hasProposal = !!node.pendingProposal;

  // Can edit if:
  // 1. Node is confirmed, OR
  // 2. Node is proposed but has no pending proposal (allow user to confirm it)
  // AND onUpdateNode callback is provided
  const canEdit = !!onUpdateNode && (isConfirmed || !hasProposal);

  const label = getShortLabel(node.key);
  const isProposed = node.status === 'proposed' || hasProposal;
  const sourceLabel = SOURCE_LABELS[node.source] || node.source;
  const confidencePercent = Math.round(node.confidence * 100);
  const relativeTime = formatRelativeTime(node.lastUpdated);

  // Format value for display - use formatNodeValue for clean display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      if (value.length === 0) return '(empty list)';
      return '• ' + value.map(item =>
        typeof item === 'string' ? item : formatNodeValue(item, 100)
      ).join('\n• ');
    }
    return formatNodeValue(value, 500);
  };

  // Raw JSON view for debugging
  const getRawValue = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const displayValue = formatValue(node.value);
  const rawDisplayValue = getRawValue(node.value);
  const proposedValue = hasProposal ? formatValue(node.pendingProposal?.proposedValue) : null;
  const nodeTier = getNodeTier(node.key);

  // Get zone from domain
  const domain = node.key.split('.')[0];
  const zoneId = DOMAIN_TO_ZONE[domain] || 'overflow';
  const zone = ZONE_DEFINITIONS.find(z => z.id === zoneId);
  const zoneName = zone?.label || 'Other';

  // Source icon
  const SourceIcon = node.source === 'ai' ? Sparkles : node.source === 'user' ? User : TestTube;

  // Action handlers for proposed nodes
  const handleAccept = async () => {
    if (!node.pendingProposal || !node.proposalBatchId || !onAcceptProposal) return;
    setActionLoading('accept');
    try {
      await onAcceptProposal(node.pendingProposal.id, node.proposalBatchId);
      setNotification({ type: 'success', message: 'Proposal accepted' });
      handleClose();
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to accept proposal' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!node.pendingProposal || !node.proposalBatchId || !onRejectProposal) return;
    setActionLoading('reject');
    try {
      await onRejectProposal(node.pendingProposal.id, node.proposalBatchId);
      setNotification({ type: 'success', message: 'Proposal rejected' });
      handleClose();
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to reject proposal' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveProposalEdit = async () => {
    if (!node.pendingProposal || !node.proposalBatchId || !onEditProposal) return;
    setActionLoading('edit');
    try {
      // FieldInput returns the correct type directly
      await onEditProposal(node.pendingProposal.id, node.proposalBatchId, editedValue);
      setNotification({ type: 'success', message: 'Proposal edited and accepted' });
      handleClose();
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to save edit' });
    } finally {
      setActionLoading(null);
    }
  };

  // Handler for editing confirmed nodes (creates new revision)
  const handleSaveConfirmedEdit = async () => {
    if (!canEdit || !onUpdateNode) return;
    setActionLoading('save');
    try {
      // FieldInput returns the correct type directly
      await onUpdateNode(node.key, editedValue);
      setNotification({ type: 'success', message: 'Context updated' });
      setMode('view');
      // Show refinement prompt after successful save (for user-entered values)
      // Only for string values that could benefit from AI refinement
      const isRefinable = typeof editedValue === 'string' && editedValue.trim().length > 10;
      if (isRefinable) {
        setShowRefinementPrompt(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update context';
      setNotification({ type: 'error', message });
      console.error('[ContextMap] Save failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const startEditingProposal = () => {
    // Use actual value, not formatted display string
    setEditedValue(node.pendingProposal?.proposedValue ?? node.value);
    setMode('edit');
  };

  const startEditingConfirmed = () => {
    // Use actual value, not formatted display string
    setEditedValue(node.value);
    setMode('edit');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30 pointer-events-auto"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col h-full pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">{label}</h2>
            <p className="text-xs text-slate-500 font-mono">{node.key}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View/Edit Mode Toggle (only for confirmed nodes) */}
            {canEdit && !hasProposal && (
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-800 rounded-lg">
                <button
                  onClick={() => setMode('view')}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    mode === 'view'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  View
                </button>
                <button
                  onClick={startEditingConfirmed}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    mode === 'edit'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  Edit
                </button>
              </div>
            )}
            {/* Delete button (only for confirmed nodes with values) */}
            {onDeleteNode && isConfirmed && node.value !== null && node.value !== undefined && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                title="Delete value"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20">
            <p className="text-sm text-red-400 mb-2">Delete this value?</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={actionLoading === 'delete'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'delete' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={actionLoading === 'delete'}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Inline Notification */}
        {notification && (
          <div
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20'
                : notification.type === 'error'
                  ? 'bg-red-500/10 text-red-400 border-b border-red-500/20'
                  : 'bg-cyan-500/10 text-cyan-400 border-b border-cyan-500/20'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {notification.type === 'error' && <XCircle className="w-3.5 h-3.5" />}
            {notification.type === 'info' && <AlertCircle className="w-3.5 h-3.5" />}
            {notification.message}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Status Section */}
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="text-xs font-medium text-slate-500 mb-2">STATUS</div>
            <div className="flex items-center gap-2">
              {isProposed ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Sparkles className="w-3 h-3" />
                  AI Proposed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Check className="w-3 h-3" />
                  Confirmed
                </span>
              )}
              {/* Human Edited Badge */}
              {isConfirmed && node.humanEdited && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Pencil className="w-3 h-3" />
                  Edited
                </span>
              )}
            </div>
          </div>

          {/* Value Section */}
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">
                  {hasProposal ? 'CURRENT VALUE' : mode === 'edit' ? 'EDITING VALUE' : 'VALUE'}
                </span>
                {nodeTier === 'core' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500/20 text-cyan-400 rounded">
                    Core
                  </span>
                )}
                {nodeTier === 'supporting' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-500/20 text-slate-400 rounded">
                    Meta
                  </span>
                )}
              </div>
              {/* View Raw Toggle */}
              {mode === 'view' && !hasProposal && (
                <button
                  onClick={() => setShowRawValue(!showRawValue)}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
                    showRawValue
                      ? 'bg-slate-700 text-slate-300'
                      : 'text-slate-500 hover:text-slate-400'
                  }`}
                  title="Toggle raw JSON view"
                >
                  <Code className="w-3 h-3" />
                  Raw
                </button>
              )}
            </div>
            {mode === 'edit' && canEdit && !hasProposal ? (
              <div className="bg-slate-800 rounded-lg p-3 border border-cyan-500/30">
                <FieldInput
                  field={fieldMeta ?? undefined}
                  value={editedValue}
                  onChange={setEditedValue}
                  autoFocus
                />
              </div>
            ) : showRawValue ? (
              <pre className="text-xs text-slate-400 whitespace-pre-wrap bg-slate-800/50 rounded-lg p-3 max-h-64 overflow-y-auto font-mono">
                {rawDisplayValue}
              </pre>
            ) : (
              <div className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-800/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                {displayValue || <span className="text-slate-500 italic">(empty)</span>}
              </div>
            )}
          </div>

          {/* Proposed Value Section (if has proposal) */}
          {hasProposal && proposedValue && (
            <div className="px-4 py-3 border-b border-slate-800 bg-amber-500/5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-amber-400">PROPOSED VALUE</div>
                <span className="text-xs text-amber-400/70">
                  {Math.round((node.pendingProposal?.confidence || 0) * 100)}% confidence
                </span>
              </div>
              {mode === 'edit' ? (
                <div className="bg-slate-800 rounded-lg p-3 border border-amber-500/30">
                  <FieldInput
                    field={fieldMeta ?? undefined}
                    value={editedValue}
                    onChange={setEditedValue}
                  />
                </div>
              ) : (
                <div className="text-sm text-amber-200 whitespace-pre-wrap bg-slate-800/50 rounded-lg p-3 max-h-48 overflow-y-auto border-l-2 border-amber-500/50">
                  {proposedValue}
                </div>
              )}
              {node.pendingProposal?.reasoning && (
                <div className="mt-2 text-xs text-slate-400 italic">
                  {node.pendingProposal.reasoning}
                </div>
              )}
            </div>
          )}

          {/* AI Refinement Section */}
          {refinementData && (
            <div className="px-4 py-3 border-b border-slate-800">
              <RefinementComparisonPanel
                nodeKey={node.key}
                fieldLabel={label}
                refinement={refinementData}
                onAccept={handleAcceptRefinement}
                onEdit={handleEditRefinement}
                onKeepOriginal={handleKeepOriginal}
                onDismiss={dismissRefinement}
                isLoading={actionLoading !== null}
              />
            </div>
          )}

          {/* Subtle AI Refinement Prompt (after save) */}
          {showRefinementPrompt && !refinementData && mode === 'view' && companyId && (
            <div className="px-4 py-2 border-b border-slate-800">
              <RefinementPrompt
                onInvoke={invokeRefinement}
                isLoading={refinementLoading}
              />
            </div>
          )}

          {/* Metadata Section */}
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="text-xs font-medium text-slate-500 mb-3">METADATA</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Zone</span>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: `${zone?.color || '#64748b'}20`, color: zone?.color || '#94a3b8' }}
                >
                  {zoneName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Source</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                  <SourceIcon className="w-3 h-3" />
                  {sourceLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Confidence</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full">
                    <div
                      className={`h-full rounded-full ${
                        node.confidence > 0.7 ? 'bg-emerald-500' : node.confidence > 0.4 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-300">{confidencePercent}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Last Updated</span>
                <span className="text-xs text-slate-300">{relativeTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Category</span>
                <span className="text-xs text-slate-300">{node.category}</span>
              </div>
            </div>
          </div>

          {/* Where Used Section */}
          {whereUsed.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-800">
              <button
                onClick={() => setShowWhereUsed(!showWhereUsed)}
                className="flex items-center justify-between w-full text-xs font-medium text-slate-500 hover:text-slate-400"
              >
                <span className="flex items-center gap-1.5">
                  <LinkIcon className="w-3 h-3" />
                  WHERE USED ({whereUsed.length})
                </span>
                {showWhereUsed ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {showWhereUsed && (
                <div className="mt-3 space-y-2">
                  {whereUsed.map((ref, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs p-2 bg-slate-800/30 rounded hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                          ref.type === 'strategy' ? 'bg-violet-500/20 text-violet-400' :
                          ref.type === 'program' ? 'bg-blue-500/20 text-blue-400' :
                          ref.type === 'lab' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {ref.type}
                        </span>
                        <span className="text-slate-300">{ref.label}</span>
                      </div>
                      {ref.link && (
                        <a
                          href={ref.link}
                          className="text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Provenance Section */}
          {node.provenance && node.provenance.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-800">
              <button
                onClick={() => setShowProvenance(!showProvenance)}
                className="flex items-center justify-between w-full text-xs font-medium text-slate-500 hover:text-slate-400"
              >
                <span>PROVENANCE ({node.provenance.length})</span>
                {showProvenance ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {showProvenance && (
                <div className="mt-3 space-y-2">
                  {node.provenance.map((prov, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-xs text-slate-400 p-2 bg-slate-800/30 rounded"
                    >
                      <ArrowRight className="w-3 h-3 mt-0.5 text-slate-500" />
                      <div>
                        <span className="text-slate-300">{prov.source}</span>
                        <span className="mx-1">•</span>
                        <span>{Math.round(prov.confidence * 100)}%</span>
                        <span className="mx-1">•</span>
                        <span>{formatRelativeTime(prov.updatedAt)}</span>
                        {prov.notes && (
                          <div className="mt-1 text-slate-500 italic">{prov.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Footer - For Proposed Nodes WITHOUT pendingProposal (Quick Confirm) */}
        {mode === 'view' && !isConfirmed && !hasProposal && canEdit && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/80">
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setActionLoading('confirm');
                  try {
                    await onUpdateNode!(node.key, node.value);
                    setNotification({ type: 'success', message: 'Value confirmed' });
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to confirm';
                    setNotification({ type: 'error', message });
                    console.error('[ContextMap] Quick confirm failed:', error);
                  } finally {
                    setActionLoading(null);
                  }
                }}
                disabled={actionLoading !== null}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading === 'confirm' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm Value
                  </>
                )}
              </button>
              <button
                onClick={startEditingConfirmed}
                disabled={actionLoading !== null}
                className="px-4 py-2 text-sm font-medium bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
                title="Edit before confirming"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500 text-center">
              Confirm this AI-proposed value as accurate
            </p>
          </div>
        )}

        {/* Actions Footer - For Proposals (Accept/Reject/Edit) */}
        {hasProposal && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/80">
            {editedValue ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveProposalEdit}
                  disabled={actionLoading !== null}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-500 text-slate-900 rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {actionLoading === 'edit' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save & Accept
                    </>
                  )}
                </button>
                <button
                  onClick={() => setEditedValue('')}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 text-sm font-medium bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAccept}
                  disabled={actionLoading !== null}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {actionLoading === 'accept' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Accept
                    </>
                  )}
                </button>
                <button
                  onClick={startEditingProposal}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 text-sm font-medium bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
                  title="Edit before accepting"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Reject proposal"
                >
                  {actionLoading === 'reject' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions Footer - For Editable Nodes (Save Edit) */}
        {mode === 'edit' && canEdit && !hasProposal && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/80">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveConfirmedEdit}
                disabled={actionLoading !== null}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-500 text-slate-900 rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading === 'save' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {isConfirmed ? 'Save' : 'Confirm'}
                  </>
                )}
              </button>
              <button
                onClick={() => setMode('view')}
                disabled={actionLoading !== null}
                className="px-4 py-2 text-sm font-medium bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
            {!isConfirmed && (
              <p className="mt-2 text-xs text-slate-500 text-center">
                This will confirm the value as your own
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
