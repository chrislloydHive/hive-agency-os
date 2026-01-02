'use client';

// app/c/[companyId]/context/components/InlineEditor.tsx
// Inline Field Editor Component
//
// Allows editing context graph field values directly in the UI.
// Supports text, multiline, and JSON modes.
// Changes go through the governed update pipeline.

import { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type EditorMode = 'text' | 'multiline' | 'json';

interface InlineEditorProps {
  path: string;
  value: string | null;
  label: string;
  companyId: string;
  mode?: EditorMode;
  isLocked?: boolean;
  lockReason?: string;
  onSave: (newValue: string) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function detectEditorMode(value: string | null): EditorMode {
  if (!value) return 'text';

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object') return 'json';
  } catch {
    // Not JSON
  }

  // Check if multiline
  if (value.includes('\n') || value.length > 200) return 'multiline';

  return 'text';
}

function formatJsonForEdit(value: string | null): string {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function InlineEditor({
  path,
  value,
  label,
  companyId,
  mode: initialMode,
  isLocked = false,
  lockReason,
  onSave,
  onCancel,
}: InlineEditorProps) {
  const detectedMode = initialMode ?? detectEditorMode(value);
  const [mode, setMode] = useState<EditorMode>(detectedMode);
  const [editValue, setEditValue] = useState(
    mode === 'json' ? formatJsonForEdit(value) : (value ?? '')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) {
        inputRef.current.select();
      }
    }
  }, []);

  // Validate JSON when in JSON mode
  useEffect(() => {
    if (mode === 'json' && editValue.trim()) {
      try {
        JSON.parse(editValue);
        setJsonError(null);
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      }
    } else {
      setJsonError(null);
    }
  }, [editValue, mode]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }

    // Enter saves for single line, Cmd/Ctrl+Enter for multiline/JSON
    if (e.key === 'Enter') {
      if (mode === 'text' || (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    }
  }, [mode, onCancel]);

  const handleSave = async () => {
    // Users can always edit - lock status is informational only
    // The user's edit will override the lock

    if (mode === 'json' && jsonError) {
      setError('Please fix JSON syntax errors before saving');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // For JSON mode, compact the JSON
      let finalValue = editValue;
      if (mode === 'json' && editValue.trim()) {
        finalValue = JSON.stringify(JSON.parse(editValue));
      }

      const result = await onSave(finalValue);

      if (!result.success) {
        setError(result.error ?? 'Failed to save');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = editValue !== (value ?? '');

  return (
    <div className="rounded-lg border border-amber-500/50 bg-slate-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-slate-100">{label}</h4>
          <p className="text-[11px] text-slate-500 font-mono">{path}</p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-md p-0.5">
          {(['text', 'multiline', 'json'] as EditorMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-2 py-1 text-[10px] rounded transition-colors',
                mode === m
                  ? 'bg-amber-500/30 text-amber-300'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {m === 'text' ? 'Text' : m === 'multiline' ? 'Multi' : 'JSON'}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        {mode === 'text' ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLocked || isSaving}
            className={cn(
              'w-full rounded-md border bg-slate-950 px-3 py-2 text-sm text-slate-100',
              'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50',
              isLocked && 'opacity-50 cursor-not-allowed',
              error ? 'border-red-500' : 'border-slate-700'
            )}
            placeholder="Enter value..."
          />
        ) : (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLocked || isSaving}
            rows={mode === 'json' ? 10 : 4}
            className={cn(
              'w-full rounded-md border bg-slate-950 px-3 py-2 text-sm text-slate-100 font-mono',
              'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50',
              'resize-y min-h-[100px]',
              isLocked && 'opacity-50 cursor-not-allowed',
              error || jsonError ? 'border-red-500' : 'border-slate-700'
            )}
            placeholder={mode === 'json' ? '{\n  "key": "value"\n}' : 'Enter value...'}
          />
        )}

        {/* JSON Error */}
        {jsonError && (
          <p className="mt-1 text-[11px] text-red-400">{jsonError}</p>
        )}
      </div>

      {/* Lock Warning */}
      {isLocked && lockReason && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-red-300">{lockReason}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-[10px] text-slate-500">
          {mode === 'text' ? (
            'Press Enter to save, Esc to cancel'
          ) : (
            <>Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">⌘</kbd>+<kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">Enter</kbd> to save</>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLocked || isSaving || (mode === 'json' && !!jsonError) || !hasChanges}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-medium transition-colors',
              'bg-amber-500 hover:bg-amber-400 text-slate-900',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-slate-900/30 border-t-slate-900 animate-spin" />
                Saving...
              </span>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InlineEditor;
