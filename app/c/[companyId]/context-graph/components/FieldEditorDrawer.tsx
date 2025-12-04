'use client';

// app/c/[companyId]/context-graph/components/FieldEditorDrawer.tsx
// Slide-over drawer for editing a context graph field

import { useState, useEffect } from 'react';
import type { ProvenanceTag } from '@/lib/contextGraph/types';

interface FieldEditorDrawerProps {
  path: string;
  value: unknown;
  provenance: unknown[];
  onSave: (path: string, newValue: unknown) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

/**
 * Determine the editor type based on the value
 */
function getEditorType(value: unknown): 'text' | 'number' | 'array' | 'boolean' | 'unsupported' {
  if (value === null || value === undefined) {
    return 'text'; // Default to text for null values
  }
  if (Array.isArray(value)) {
    // Check if it's an array of strings
    if (value.every(v => typeof v === 'string' || v === null)) {
      return 'array';
    }
    return 'unsupported';
  }
  if (typeof value === 'string') {
    return 'text';
  }
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  return 'unsupported';
}

/**
 * Format source name
 */
function formatSource(source: string | undefined): string {
  if (!source) return 'Unknown';
  return source
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format date
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Unknown';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export function FieldEditorDrawer({
  path,
  value,
  provenance,
  onSave,
  onClose,
  isLoading,
}: FieldEditorDrawerProps) {
  const editorType = getEditorType(value);

  // State for edited value
  const [editedValue, setEditedValue] = useState<string>(() => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join('\n');
    return String(value);
  });

  // Reset edited value when value changes
  useEffect(() => {
    if (value === null || value === undefined) {
      setEditedValue('');
    } else if (Array.isArray(value)) {
      setEditedValue(value.join('\n'));
    } else {
      setEditedValue(String(value));
    }
  }, [value]);

  // Handle save
  const handleSave = async () => {
    let newValue: unknown;

    switch (editorType) {
      case 'text':
        newValue = editedValue.trim() || null;
        break;
      case 'number':
        const num = parseFloat(editedValue);
        newValue = isNaN(num) ? null : num;
        break;
      case 'boolean':
        newValue = editedValue === 'true';
        break;
      case 'array':
        newValue = editedValue
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        break;
      default:
        return;
    }

    await onSave(path, newValue);
  };

  const typedProvenance = provenance as ProvenanceTag[];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-slate-900 border-l border-slate-800 shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Edit Field</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Path */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Field Path
            </label>
            <code className="block text-sm text-slate-300 bg-slate-800 px-3 py-2 rounded-lg font-mono">
              {path}
            </code>
          </div>

          {/* Editor */}
          {editorType === 'unsupported' ? (
            <div className="mb-6">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-sm text-amber-400">
                  Editing is only supported for simple values (strings, numbers, arrays of strings).
                  Complex objects cannot be edited through this interface.
                </p>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Current Value (Read-only)
                </label>
                <pre className="text-sm text-slate-300 bg-slate-800 px-3 py-2 rounded-lg overflow-auto max-h-60">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                {editorType === 'array' ? 'Value (one item per line)' : 'Value'}
              </label>

              {editorType === 'boolean' ? (
                <select
                  value={editedValue}
                  onChange={(e) => setEditedValue(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : editorType === 'number' ? (
                <input
                  type="number"
                  value={editedValue}
                  onChange={(e) => setEditedValue(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Enter a number..."
                />
              ) : (
                <textarea
                  value={editedValue}
                  onChange={(e) => setEditedValue(e.target.value)}
                  rows={editorType === 'array' ? 8 : 4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                  placeholder={editorType === 'array' ? 'Enter values, one per line...' : 'Enter value...'}
                />
              )}

              {editorType === 'array' && (
                <p className="mt-2 text-xs text-slate-500">
                  Enter one value per line. Empty lines will be ignored.
                </p>
              )}
            </div>
          )}

          {/* Provenance Summary */}
          {typedProvenance.length > 0 && (
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Provenance History
              </label>
              <div className="space-y-2">
                {typedProvenance.slice(0, 5).map((p, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg text-sm ${
                      i === 0 ? 'bg-slate-800 border border-slate-700' : 'bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-300">
                        {formatSource(p.source)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(p.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>Confidence: {Math.round((p.confidence || 0) * 100)}%</span>
                      {p.sourceRunId && (
                        <span className="font-mono text-slate-500">
                          Run: {p.sourceRunId.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    {p.notes && (
                      <p className="mt-1 text-xs text-slate-500">{p.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {editorType !== 'unsupported' && (
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
