// components/context-map/AddNodeModal.tsx
// Modal for manually adding a new context node
// Updated for Schema V2 with type-specific field inputs

'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { ZONE_DEFINITIONS } from './constants';
import { getSchemaV2FieldsForZone } from '@/lib/contextGraph/unifiedRegistry';
import { FieldInput } from './field-renderers';
import type { ZoneId } from './types';

interface AddNodeModalProps {
  isOpen: boolean;
  zoneId: ZoneId;
  existingNodeKeys: Set<string>;
  onClose: () => void;
  onSubmit: (fieldKey: string, value: unknown) => Promise<void>;
}

export function AddNodeModal({
  isOpen,
  zoneId,
  existingNodeKeys,
  onClose,
  onSubmit,
}: AddNodeModalProps) {
  const [selectedField, setSelectedField] = useState<string>('');
  const [value, setValue] = useState<unknown>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get zone metadata
  const zone = ZONE_DEFINITIONS.find(z => z.id === zoneId);

  // Get available fields for this zone that don't already have values
  // Uses Schema V2 registry for strict field set
  const availableFields = useMemo(() => {
    const zoneFields = getSchemaV2FieldsForZone(zoneId);
    return zoneFields.filter(field => !existingNodeKeys.has(field.key));
  }, [zoneId, existingNodeKeys]);

  // Get selected field metadata
  const selectedFieldMeta = useMemo(() => {
    return availableFields.find(f => f.key === selectedField);
  }, [availableFields, selectedField]);

  // Reset value when field selection changes (different field types need different defaults)
  useEffect(() => {
    if (!selectedFieldMeta) {
      setValue('');
      return;
    }
    // Set appropriate default based on field type
    switch (selectedFieldMeta.valueType) {
      case 'list':
      case 'string[]':
      case 'array':
      case 'multi-select':
        setValue([]);
        break;
      default:
        setValue('');
    }
  }, [selectedField, selectedFieldMeta]);

  // Check if value is "empty" based on type
  const isValueEmpty = (val: unknown): boolean => {
    if (val === null || val === undefined || val === '') return true;
    if (Array.isArray(val) && val.length === 0) return true;
    if (typeof val === 'string' && !val.trim()) return true;
    return false;
  };

  const handleSubmit = async () => {
    if (!selectedField || isValueEmpty(value)) {
      setError('Please select a field and enter a value');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Trim string values, pass others as-is
      const finalValue = typeof value === 'string' ? value.trim() : value;
      await onSubmit(selectedField, finalValue);
      // Reset and close
      setSelectedField('');
      setValue('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add context');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-slate-900/95 backdrop-blur-md border border-slate-600 rounded-xl shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${zone?.color || '#64748b'}20` }}
            >
              <Plus className="w-4 h-4" style={{ color: zone?.color || '#94a3b8' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Add Context</h2>
              <p className="text-xs text-slate-500">{zone?.label || 'Unknown Zone'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Field Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Select Field
            </label>
            {availableFields.length > 0 ? (
              <select
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50"
              >
                <option value="">Choose a field...</option>
                {availableFields.map(field => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-sm text-slate-500 text-center">
                  All fields in this zone already have values
                </p>
              </div>
            )}
          </div>

          {/* Field description */}
          {selectedFieldMeta?.description && (
            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <p className="text-xs text-slate-400">{selectedFieldMeta.description}</p>
            </div>
          )}

          {/* Value Input - Type-specific based on field schema */}
          {selectedField && selectedFieldMeta && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Value
              </label>
              <FieldInput
                field={selectedFieldMeta}
                value={value}
                onChange={setValue}
                autoFocus
              />
              {selectedFieldMeta.aiPromptHint && (
                <p className="mt-1.5 text-[10px] text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Hint: {selectedFieldMeta.aiPromptHint}
                </p>
              )}
            </div>
          )}

          {/* Info about proposal workflow */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-400/80">
              This will create a <strong>proposed</strong> value. You&apos;ll need to confirm it to lock it in.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedField || isValueEmpty(value) || isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-500 text-slate-900 rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add as Proposed
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
