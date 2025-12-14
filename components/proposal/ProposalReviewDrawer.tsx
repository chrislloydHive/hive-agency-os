'use client';

// components/proposal/ProposalReviewDrawer.tsx
// Proposal Review Drawer Component
//
// Presents AI-proposed changes for user review before application.
// Users can selectively approve changes while locked fields are clearly marked.
//
// See: docs/ui/proposal-drawer.md for UX rules

import { useState, useMemo, useCallback } from 'react';
import {
  X,
  Check,
  Loader2,
  Lock,
  Copy,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import type { Proposal, PatchOperation, ProposalConflict, JsonPointer } from '@/lib/os/writeContract/types';
import { labelForJsonPointer } from '@/lib/contextGraph/paths/labelForJsonPointer';

// ============================================================================
// Types
// ============================================================================

interface ProposalReviewDrawerProps {
  proposal: Proposal;
  isOpen: boolean;
  onClose: () => void;
  onApply: (selectedPaths: JsonPointer[]) => Promise<void>;
  isApplying?: boolean;
}

interface GroupedOperations {
  domain: string;
  operations: Array<{
    operation: PatchOperation;
    path: JsonPointer;
    label: string;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDomainFromPath(path: JsonPointer): string {
  const segments = path.split('/').filter(Boolean);
  return segments[0] || 'unknown';
}

function getDomainLabel(domain: string): string {
  const labels: Record<string, string> = {
    identity: 'Identity',
    audience: 'Audience',
    brand: 'Brand',
    productOffer: 'Product/Offer',
    website: 'Website',
    creative: 'Creative',
    performanceMedia: 'Performance Media',
    competitive: 'Competitive',
    objectives: 'Objectives',
    operationalConstraints: 'Operational Constraints',
    ops: 'Operations',
    capabilities: 'Capabilities',
    meta: 'Metadata',
  };
  return labels[domain] || domain.charAt(0).toUpperCase() + domain.slice(1);
}

function groupOperationsByDomain(operations: PatchOperation[]): GroupedOperations[] {
  const groups: Map<string, GroupedOperations> = new Map();

  for (const op of operations) {
    const domain = getDomainFromPath(op.path);
    if (!groups.has(domain)) {
      groups.set(domain, {
        domain,
        operations: [],
      });
    }
    groups.get(domain)!.operations.push({
      operation: op,
      path: op.path,
      label: labelForJsonPointer(op.path).fullLabel,
    });
  }

  return Array.from(groups.values()).sort((a, b) => a.domain.localeCompare(b.domain));
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty list)';
    // For arrays of strings, show them directly
    if (value.every(v => typeof v === 'string')) {
      return value.slice(0, 3).join(', ') + (value.length > 3 ? ` +${value.length - 3} more` : '');
    }
    return `${value.length} item(s)`;
  }
  if (typeof value === 'object') {
    // Check for WithMeta wrapper pattern
    const obj = value as Record<string, unknown>;
    if ('value' in obj && obj.value !== undefined) {
      return formatValue(obj.value);
    }
    // For objects, show a summary of keys
    const keys = Object.keys(obj);
    if (keys.length === 0) return '(empty object)';
    // Show count of non-empty keys
    const nonEmptyCount = keys.filter(k => {
      const v = obj[k];
      return v !== null && v !== undefined && v !== '' &&
        !(typeof v === 'object' && Object.keys(v as object).length === 0);
    }).length;
    if (nonEmptyCount === 0) return '(no data)';
    return `${nonEmptyCount} field(s) configured`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).slice(0, 100);
}

// ============================================================================
// Sub-components
// ============================================================================

function OperationBadge({ op }: { op: PatchOperation['op'] }) {
  const config = {
    replace: { label: 'Changed', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    add: { label: 'Added', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    remove: { label: 'Removed', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  }[op];

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${config.className}`}>
      {config.label}
    </span>
  );
}

function OperationIcon({ op }: { op: PatchOperation['op'] }) {
  switch (op) {
    case 'add':
      return <Plus className="w-3.5 h-3.5 text-emerald-400" />;
    case 'remove':
      return <Minus className="w-3.5 h-3.5 text-red-400" />;
    case 'replace':
      return <RefreshCw className="w-3.5 h-3.5 text-amber-400" />;
  }
}

function OperationRow({
  operation,
  label,
  isSelected,
  onToggle,
  disabled,
}: {
  operation: PatchOperation;
  label: string;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-slate-800/50 border-cyan-500/30'
          : 'bg-slate-900/30 border-slate-800 hover:border-slate-700'
      }`}
    >
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
          isSelected
            ? 'bg-cyan-500 border-cyan-500 text-white'
            : 'border-slate-600 hover:border-slate-500'
        } disabled:opacity-50`}
      >
        {isSelected && <Check className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <OperationIcon op={operation.op} />
          <span className="text-sm font-medium text-slate-200 truncate">{label}</span>
          <OperationBadge op={operation.op} />
        </div>

        {/* Value display */}
        <div className="text-xs text-slate-400 space-y-0.5">
          {operation.op === 'replace' && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">From:</span>
                <span className="line-through text-slate-500">{formatValue(operation.oldValue)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">To:</span>
                <span className="text-slate-300">{formatValue(operation.value)}</span>
              </div>
            </>
          )}
          {operation.op === 'add' && (
            <div className="flex items-center gap-1">
              <span className="text-emerald-400">{formatValue(operation.value)}</span>
            </div>
          )}
          {operation.op === 'remove' && (
            <div className="flex items-center gap-1">
              <span className="line-through text-red-400">{formatValue(operation.oldValue)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConflictRow({ conflict }: { conflict: ProposalConflict }) {
  const label = labelForJsonPointer(conflict.path).fullLabel;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
      <div className="mt-0.5 w-5 h-5 rounded border border-red-500/30 flex items-center justify-center">
        <Lock className="w-3 h-3 text-red-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-slate-300 truncate">{label}</span>
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded border bg-red-500/20 text-red-400 border-red-500/30">
            Locked
          </span>
        </div>

        <p className="text-xs text-red-400/80 mb-1">{conflict.message}</p>

        <div className="text-xs text-slate-500">
          <span>Attempted: </span>
          <span className="text-slate-400">{formatValue(conflict.operation.value)}</span>
        </div>
      </div>
    </div>
  );
}

function DomainGroup({
  domain,
  operations,
  selectedPaths,
  onTogglePath,
  onToggleAll,
  isExpanded,
  onToggleExpand,
}: {
  domain: string;
  operations: Array<{ operation: PatchOperation; path: JsonPointer; label: string }>;
  selectedPaths: Set<JsonPointer>;
  onTogglePath: (path: JsonPointer) => void;
  onToggleAll: (domain: string, select: boolean) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const selectedCount = operations.filter(o => selectedPaths.has(o.path)).length;
  const allSelected = selectedCount === operations.length;

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <div className="w-full px-4 py-3 flex items-center justify-between bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-sm font-medium text-slate-200">{getDomainLabel(domain)}</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {selectedCount}/{operations.length} selected
          </span>
          <button
            onClick={() => onToggleAll(domain, !allSelected)}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-2 bg-slate-900/20">
          {operations.map(({ operation, path, label }) => (
            <OperationRow
              key={path}
              operation={operation}
              label={label}
              isSelected={selectedPaths.has(path)}
              onToggle={() => onTogglePath(path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProposalReviewDrawer({
  proposal,
  isOpen,
  onClose,
  onApply,
  isApplying = false,
}: ProposalReviewDrawerProps) {
  // State
  const [selectedPaths, setSelectedPaths] = useState<Set<JsonPointer>>(() => {
    // All applicable changes selected by default
    return new Set(proposal.patch.map(op => op.path));
  });
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(() => {
    // Expand first domain by default
    const groups = groupOperationsByDomain(proposal.patch);
    return new Set(groups.slice(0, 1).map(g => g.domain));
  });
  const [copied, setCopied] = useState(false);

  // Grouped operations
  const groupedOperations = useMemo(
    () => groupOperationsByDomain(proposal.patch),
    [proposal.patch]
  );

  // Grouped conflicts by domain
  const groupedConflicts = useMemo(() => {
    const groups: Map<string, ProposalConflict[]> = new Map();
    for (const conflict of proposal.conflicts) {
      const domain = getDomainFromPath(conflict.path);
      if (!groups.has(domain)) {
        groups.set(domain, []);
      }
      groups.get(domain)!.push(conflict);
    }
    return groups;
  }, [proposal.conflicts]);

  // Handlers
  const togglePath = useCallback((path: JsonPointer) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const toggleAllInDomain = useCallback((domain: string, select: boolean) => {
    const group = groupedOperations.find(g => g.domain === domain);
    if (!group) return;

    setSelectedPaths(prev => {
      const next = new Set(prev);
      for (const { path } of group.operations) {
        if (select) {
          next.add(path);
        } else {
          next.delete(path);
        }
      }
      return next;
    });
  }, [groupedOperations]);

  const toggleExpandDomain = useCallback((domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPaths(new Set(proposal.patch.map(op => op.path)));
  }, [proposal.patch]);

  const deselectAll = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  const handleCopyDiff = useCallback(async () => {
    const diff = {
      patch: proposal.patch,
      conflicts: proposal.conflicts,
    };
    await navigator.clipboard.writeText(JSON.stringify(diff, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [proposal]);

  const handleApply = useCallback(async () => {
    await onApply(Array.from(selectedPaths));
  }, [onApply, selectedPaths]);

  if (!isOpen) return null;

  const hasConflicts = proposal.conflicts.length > 0;
  const hasApplicable = proposal.patch.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-white">Review Proposed Changes</h2>
            <p className="text-xs text-slate-500 mt-1">
              {proposal.summary.applicableChanges} change(s) • {proposal.summary.conflicts} conflict(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-300 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary Banner */}
          <div className={`p-3 rounded-lg border ${
            hasConflicts
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
          }`}>
            <div className="flex items-center gap-2">
              {hasConflicts ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400">
                    Some changes conflict with locked fields
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">
                    All changes can be applied
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Applicable Changes */}
          {hasApplicable && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-300">Applicable Changes</h3>
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="text-xs text-cyan-400 hover:text-cyan-300">
                    Select all
                  </button>
                  <span className="text-slate-600">|</span>
                  <button onClick={deselectAll} className="text-xs text-slate-400 hover:text-slate-300">
                    Deselect all
                  </button>
                </div>
              </div>

              {groupedOperations.map(group => (
                <DomainGroup
                  key={group.domain}
                  domain={group.domain}
                  operations={group.operations}
                  selectedPaths={selectedPaths}
                  onTogglePath={togglePath}
                  onToggleAll={toggleAllInDomain}
                  isExpanded={expandedDomains.has(group.domain)}
                  onToggleExpand={() => toggleExpandDomain(group.domain)}
                />
              ))}
            </div>
          )}

          {/* Conflicts Section */}
          {hasConflicts && (
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-medium text-red-400">
                  Locked Field Conflicts ({proposal.conflicts.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                These changes cannot be applied because the fields are locked.
              </p>

              <div className="space-y-2">
                {Array.from(groupedConflicts.entries()).map(([domain, conflicts]) => (
                  <div key={domain} className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      {getDomainLabel(domain)}
                    </h4>
                    {conflicts.map(conflict => (
                      <ConflictRow key={conflict.path} conflict={conflict} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!hasApplicable && !hasConflicts && (
            <div className="text-center py-8">
              <p className="text-slate-500">No changes proposed.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          {/* Provenance Info */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Created by: {proposal.createdBy}</span>
            <span>Expires: {new Date(proposal.expiresAt).toLocaleDateString()}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyDiff}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy diff
                </>
              )}
            </button>

            <div className="flex-1" />

            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300"
            >
              Cancel
            </button>

            <button
              onClick={handleApply}
              disabled={selectedPaths.size === 0 || isApplying}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-500 rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Apply {selectedPaths.size} Change{selectedPaths.size !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
