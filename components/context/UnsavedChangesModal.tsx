// components/context/UnsavedChangesModal.tsx
// Modal shown when user attempts to regenerate with unsaved changes
//
// TRUST: This modal prevents accidental loss of user edits by requiring
// explicit confirmation before regeneration overwrites unsaved changes.

'use client';

import { useCallback } from 'react';
import { AlertTriangle, Save, X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface UnsavedChangesModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close the modal without taking action */
  onClose: () => void;
  /** Save changes first, then regenerate */
  onSaveAndRegenerate: () => void;
  /** Discard changes and regenerate (dangerous) */
  onDiscardAndRegenerate?: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Whether regeneration is in progress */
  isRegenerating?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function UnsavedChangesModal({
  isOpen,
  onClose,
  onSaveAndRegenerate,
  onDiscardAndRegenerate,
  isSaving = false,
  isRegenerating = false,
}: UnsavedChangesModalProps) {
  const isLoading = isSaving || isRegenerating;

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <h2 id="unsaved-changes-title" className="text-lg font-semibold text-white">
              Unsaved Changes
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-sm text-slate-300 mb-4">
            You have unsaved changes that will be lost if you regenerate now.
            Would you like to save your changes first?
          </p>
          <p className="text-xs text-slate-500">
            Regenerating will create a new AI-generated draft based on the latest diagnostics.
            Your current edits will be replaced.
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-t border-slate-700 bg-slate-800/50">
          {/* Primary action: Save & Regenerate */}
          <button
            onClick={onSaveAndRegenerate}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-cyan-500 text-slate-900 rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {isSaving ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full" />
                Saving...
              </>
            ) : isRegenerating ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full" />
                Regenerating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save & Regenerate
              </>
            )}
          </button>

          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {/* Optional: Discard option (more dangerous, shown smaller) */}
        {onDiscardAndRegenerate && (
          <div className="px-4 pb-4 pt-0">
            <button
              onClick={onDiscardAndRegenerate}
              disabled={isLoading}
              className="w-full text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Discard changes and regenerate anyway
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
