// components/context/canonical/CanonicalFieldRow.tsx
// Canonical Field Row Component
//
// Displays a single canonical field with status, provenance, and actions.
// Supports inline editing, confirmation, and status transitions.

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Check,
  Edit2,
  Plus,
  X,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type {
  CanonicalFieldDefinition,
  CanonicalFieldKey,
  ContextFieldRecord,
  ContextFieldStatus,
} from '@/lib/os/context/schema';
import { ConfidenceBadge } from './ConfidenceBadge';
import { ProvenanceBadges } from './ProvenanceBadges';

// ============================================================================
// Types
// ============================================================================

export interface CanonicalFieldRowProps {
  fieldDef: CanonicalFieldDefinition;
  fieldRecord?: ContextFieldRecord;
  onSave: (key: CanonicalFieldKey, value: string) => Promise<void>;
  onConfirm: (key: CanonicalFieldKey) => Promise<void>;
}

// ============================================================================
// Status Badge Component
// ============================================================================

interface StatusBadgeProps {
  status: ContextFieldStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    missing: {
      label: 'Missing',
      icon: AlertCircle,
      colors: 'bg-red-500/10 text-red-400 border-red-500/30',
    },
    proposed: {
      label: 'Proposed',
      icon: Clock,
      colors: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    confirmed: {
      label: 'Confirmed',
      icon: CheckCircle2,
      colors: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium
        rounded-full border select-none
        ${config.colors}
      `}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CanonicalFieldRow({
  fieldDef,
  fieldRecord,
  onSave,
  onConfirm,
}: CanonicalFieldRowProps) {
  // Determine status
  const status: ContextFieldStatus = fieldRecord?.status || 'missing';
  const value = fieldRecord?.value || '';
  const hasValue = value && value.trim().length > 0;

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog for editing confirmed fields
  const [showEditConfirmDialog, setShowEditConfirmDialog] = useState(false);

  // Tooltip for description
  const [showDescTooltip, setShowDescTooltip] = useState(false);
  const descTooltipRef = useRef<HTMLDivElement>(null);

  // Input ref for auto-focus
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Reset edit value when field record changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleStartEdit = useCallback(() => {
    if (status === 'confirmed') {
      // Show confirmation dialog before editing confirmed fields
      setShowEditConfirmDialog(true);
    } else {
      setEditValue(value);
      setIsEditing(true);
      setError(null);
    }
  }, [status, value]);

  const handleConfirmEdit = useCallback(() => {
    // User confirmed they want to edit a confirmed field
    setShowEditConfirmDialog(false);
    setEditValue(value);
    setIsEditing(true);
    setError(null);
  }, [value]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  }, [value]);

  const handleSave = useCallback(async () => {
    if (!editValue.trim()) {
      setError('Value cannot be empty');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(fieldDef.key, editValue.trim());
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [editValue, fieldDef.key, onSave]);

  const handleConfirm = useCallback(async () => {
    setIsConfirming(true);
    setError(null);

    try {
      await onConfirm(fieldDef.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setIsConfirming(false);
    }
  }, [fieldDef.key, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancelEdit();
      }
    },
    [handleSave, handleCancelEdit]
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="group relative py-3 px-4 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
      {/* Edit Confirmed Field Dialog */}
      {showEditConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 max-w-sm mx-4 shadow-xl">
            <h3 className="text-sm font-medium text-white mb-2">Edit Confirmed Field?</h3>
            <p className="text-xs text-slate-400 mb-4">
              Editing a confirmed field will change its status to "Proposed" until you confirm it again.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEditConfirmDialog(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEdit}
                className="px-3 py-1.5 text-xs bg-amber-500 text-slate-900 rounded hover:bg-amber-400"
              >
                Edit Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Row: Label + Status + Provenance */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2">
          {/* Label with help tooltip */}
          <div className="relative">
            <span
              className="text-sm font-medium text-slate-200 flex items-center gap-1 cursor-help"
              onMouseEnter={() => setShowDescTooltip(true)}
              onMouseLeave={() => setShowDescTooltip(false)}
            >
              {fieldDef.label}
              {fieldDef.requiredForStrategyFrame && (
                <span className="text-red-400 text-xs">*</span>
              )}
              <HelpCircle className="w-3 h-3 text-slate-500" />
            </span>

            {showDescTooltip && (
              <div
                ref={descTooltipRef}
                className="absolute left-0 top-full mt-1 z-50 w-64 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-lg"
              >
                <p className="text-xs text-slate-400">{fieldDef.description}</p>
                {fieldDef.requiredForStrategyFrame && (
                  <p className="text-xs text-amber-400 mt-1">Required for Strategy Frame</p>
                )}
              </div>
            )}
          </div>

          <StatusBadge status={status} />
        </div>

        <div className="flex items-center gap-2">
          {/* Confidence */}
          {fieldRecord?.confidence !== undefined && (
            <ConfidenceBadge confidence={fieldRecord.confidence} />
          )}

          {/* Provenance */}
          {fieldRecord?.sources && fieldRecord.sources.length > 0 && (
            <ProvenanceBadges sources={fieldRecord.sources} maxVisible={2} />
          )}
        </div>
      </div>

      {/* Value Row */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter value..."
            rows={3}
            className="w-full px-3 py-2 text-sm text-slate-200 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              ⌘+Enter to save, Esc to cancel
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-300 disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !editValue.trim()}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-cyan-500 text-slate-900 rounded hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Check className="w-3 h-3" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          {/* Value display */}
          <div className="flex-1 min-w-0">
            {hasValue ? (
              <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
                {value}
              </p>
            ) : (
              <p className="text-sm text-slate-500 italic">— Missing —</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {status === 'missing' && (
              <button
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/20"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}

            {status === 'proposed' && (
              <>
                <button
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-300 border border-slate-700 rounded hover:border-slate-600"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {isConfirming ? (
                    <>Confirming...</>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      Confirm
                    </>
                  )}
                </button>
              </>
            )}

            {status === 'confirmed' && (
              <button
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-300 border border-slate-700 rounded hover:border-slate-600"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

export default CanonicalFieldRow;
