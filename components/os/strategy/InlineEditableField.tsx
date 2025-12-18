'use client';

// components/os/strategy/InlineEditableField.tsx
// Reusable inline editable field component for Strategic Frame
//
// Features:
// - Collapsed mode: shows value + provenance badge + Edit/AI actions
// - Expanded mode: inline textarea with Save/Cancel
// - Direct API integration for canonical updates
// - Loading state with spinner
// - AI draft integration via FieldAIActions
// - Provenance display (User override, Context, Missing)

import React, { useState, useCallback, useEffect } from 'react';
import {
  Pencil,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Database,
  User,
  Info,
  Sparkles,
} from 'lucide-react';
import { FieldAIActions, type FieldDraft } from '@/components/os/ai/FieldAIActions';

// ============================================================================
// Types
// ============================================================================

/** Field keys for the Strategy Frame */
export type StrategyFrameKey = 'audience' | 'positioning' | 'constraints' | 'valueProp' | 'offering';

/** Provenance source for a field */
export type FieldSource = 'user' | 'context' | 'ai_draft' | 'empty';

/** Field provenance info */
export interface FieldProvenance {
  source: FieldSource;
  sourceLabel?: string;
  contextPath?: string;
}

/** Props for InlineEditableField */
export interface InlineEditableFieldProps {
  /** Field label displayed above the value */
  label: string;
  /** The current field value (may be empty) */
  value: string;
  /** Placeholder when value is empty */
  placeholder?: string;
  /** Provenance info (source, sourceLabel) */
  provenance: FieldProvenance;
  /** Icon to show next to label */
  icon?: React.ReactNode;
  /** Company ID for API calls */
  companyId: string;
  /** Strategy ID for API calls */
  strategyId: string;
  /** Frame field key (e.g., 'audience', 'positioning') */
  fieldKey: StrategyFrameKey;
  /** Whether the field is read-only */
  readOnly?: boolean;

  // AI Draft support
  /** Current AI draft for this field */
  draft?: FieldDraft;
  /** Called when AI generates a draft */
  onDraftReceived?: (draft: FieldDraft) => void;
  /** Called when user applies an AI draft */
  onApplyDraft?: (value: string) => void;
  /** Called when user discards an AI draft */
  onDiscardDraft?: () => void;
  /** Context payload for AI generation */
  contextPayload?: {
    objectives?: unknown[];
    priorities?: unknown[];
    tactics?: unknown[];
    frame?: unknown;
  };

  // Optional callbacks
  /** Called after successful save (for parent state refresh) */
  onSaveSuccess?: (fieldKey: StrategyFrameKey, newValue: string) => void;
  /** Called on save error */
  onSaveError?: (error: Error) => void;
}

// ============================================================================
// Component
// ============================================================================

export function InlineEditableField({
  label,
  value,
  placeholder = 'Not defined',
  provenance,
  icon,
  companyId,
  strategyId,
  fieldKey,
  readOnly = false,
  draft,
  onDraftReceived,
  onApplyDraft,
  onDiscardDraft,
  contextPayload,
  onSaveSuccess,
  onSaveError,
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Confirmation state for "Use this" when replacing user value
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  // Sync edit value when prop changes (e.g., after refresh)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value || '');
    }
  }, [value, isEditing]);

  // Start editing
  const handleStartEdit = useCallback(() => {
    setEditValue(value || '');
    setSaveError(null);
    setIsEditing(true);
  }, [value]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(value || '');
    setSaveError(null);
  }, [value]);

  // Save via canonical API
  const handleSave = useCallback(async () => {
    const trimmedValue = editValue.trim();

    // Don't save if unchanged
    if (trimmedValue === (value || '').trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Build the strategyFrame update
      // The API merges partial frame updates with existing values (server-side)
      const frameUpdate: Record<string, string> = {
        [fieldKey]: trimmedValue,
      };

      const response = await fetch('/api/os/strategy/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId,
          updates: {
            strategyFrame: frameUpdate,
            lastHumanUpdatedAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Failed to save: ${response.statusText}`);
      }

      // Parse and log response
      const responseData = await response.json().catch(() => null);
      console.log(`[InlineEditableField] Save response for ${fieldKey}:`, responseData);

      // Success
      setIsEditing(false);
      console.log(`[InlineEditableField] Calling onSaveSuccess for ${fieldKey} with value:`, trimmedValue);
      onSaveSuccess?.(fieldKey, trimmedValue);

      if (process.env.NODE_ENV === 'development') {
        console.log(`[InlineEditableField] Saved ${fieldKey}:`, trimmedValue);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setSaveError(err.message);
      onSaveError?.(err);
      console.error('[InlineEditableField] Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, fieldKey, strategyId, onSaveSuccess, onSaveError]);

  // Adopt context suggestion (same as save but with current value)
  const handleAdoptContext = useCallback(async () => {
    if (!value) return;

    setShowReplaceConfirm(false);
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch('/api/os/strategy/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId,
          updates: {
            strategyFrame: { [fieldKey]: value },
            lastHumanUpdatedAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to adopt value');
      }

      onSaveSuccess?.(fieldKey, value);

      if (process.env.NODE_ENV === 'development') {
        console.log(`[InlineEditableField] Adopted context value for ${fieldKey}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setSaveError(err.message);
      onSaveError?.(err);
    } finally {
      setIsSaving(false);
    }
  }, [value, fieldKey, strategyId, onSaveSuccess, onSaveError]);

  // Check if user has an existing value that would be replaced
  const hasExistingUserValue = provenance.source === 'user' && Boolean(value?.trim());

  // Initiate adopt context - may require confirmation
  const handleInitiateAdopt = useCallback(() => {
    if (hasExistingUserValue) {
      // Show confirmation before replacing user's value
      setShowReplaceConfirm(true);
    } else {
      // No existing user value, proceed directly
      handleAdoptContext();
    }
  }, [hasExistingUserValue, handleAdoptContext]);

  // Cancel the replace confirmation
  const handleCancelReplace = useCallback(() => {
    setShowReplaceConfirm(false);
  }, []);

  // Provenance badge - uses ownership terminology:
  // - User Override: User has explicitly set this value in Strategy
  // - Context Fact: Inherited from Context (company facts)
  // - AI Draft: AI has proposed this value (pending user approval)
  // - Missing: No value defined anywhere
  const renderSourceBadge = () => {
    switch (provenance.source) {
      case 'user':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <User className="w-3 h-3" />
            User Override
          </span>
        );
      case 'context':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Database className="w-3 h-3" />
            Context Fact
          </span>
        );
      case 'ai_draft':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Sparkles className="w-3 h-3" />
            AI Draft
          </span>
        );
      case 'empty':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            Missing
          </span>
        );
      default:
        return null;
    }
  };

  const hasValue = Boolean(value && value.trim());
  const isUnchanged = editValue.trim() === (value || '').trim();
  const canSave = !isSaving && editValue.trim() && !isUnchanged;

  return (
    <div className="space-y-2">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span className="text-xs font-medium text-slate-300">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {renderSourceBadge()}

          {/* Action buttons when not editing */}
          {!isEditing && !readOnly && !showReplaceConfirm && (
            <>
              {/* Adopt context suggestion */}
              {provenance.source === 'context' && (
                <button
                  onClick={handleInitiateAdopt}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-50"
                  title="Adopt this value as your own"
                >
                  {isSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  Use this
                </button>
              )}

              {/* Edit button */}
              <button
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
                title="Edit this field"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            </>
          )}

          {/* Inline confirmation when replacing existing user value */}
          {showReplaceConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400">Replace your value?</span>
              <button
                onClick={handleAdoptContext}
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Yes
              </button>
              <button
                onClick={handleCancelReplace}
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
              >
                <X className="w-3 h-3" />
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Value Display or Edit Mode */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            disabled={isSaving}
            className="w-full min-h-[80px] p-2 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 disabled:opacity-50"
            placeholder={`Enter ${label.toLowerCase()}...`}
            autoFocus
          />

          {/* Error message */}
          {saveError && (
            <p className="text-xs text-red-400">{saveError}</p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Collapsed value display */}
          <div
            className={`
              text-sm rounded p-2 border
              ${!hasValue
                ? 'bg-slate-800/30 border-slate-700 text-slate-500 italic'
                : 'bg-slate-800/50 border-slate-700 text-slate-200'
              }
            `}
          >
            {value || placeholder}
          </div>

          {/* Source label for context-derived values */}
          {provenance.source === 'context' && provenance.sourceLabel && (
            <div className="text-xs text-slate-500">
              Source: {provenance.sourceLabel}
            </div>
          )}
        </>
      )}

      {/* AI Actions - only show when not editing */}
      {!isEditing && !readOnly && onDraftReceived && onApplyDraft && onDiscardDraft && (
        <FieldAIActions
          fieldKey={`frame.${fieldKey}`}
          currentValue={value || null}
          scope="frame"
          companyId={companyId}
          strategyId={strategyId}
          contextPayload={contextPayload}
          draft={draft}
          onDraftReceived={onDraftReceived}
          onApply={onApplyDraft}
          onDiscard={onDiscardDraft}
        />
      )}
    </div>
  );
}

export default InlineEditableField;
