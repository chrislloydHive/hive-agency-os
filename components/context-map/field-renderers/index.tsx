// components/context-map/field-renderers/index.tsx
// Type-specific field input renderers for Schema V2 context fields

'use client';

import { useState, useCallback } from 'react';
import { X, Plus, ExternalLink, ChevronLeft } from 'lucide-react';
import type { UnifiedFieldEntry, SelectOption } from '@/lib/contextGraph/unifiedRegistry';
import {
  CANONICAL_CONVERSION_ACTIONS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type ConversionActionCategory,
} from '@/lib/constants/conversionActions';

// ============================================================================
// Types
// ============================================================================

export interface FieldRendererProps {
  field: UnifiedFieldEntry;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
}

// ============================================================================
// Text Field Renderer
// ============================================================================

export function TextFieldRenderer({
  field,
  value,
  onChange,
  readOnly,
  autoFocus,
}: FieldRendererProps) {
  const stringValue = typeof value === 'string' ? value : '';
  const isLongText = field.description?.toLowerCase().includes('notes') ||
                     field.description?.toLowerCase().includes('summary');

  if (isLongText) {
    return (
      <textarea
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        autoFocus={autoFocus}
        placeholder={field.description || (field.label ? `Enter ${field.label.toLowerCase()}...` : 'Enter value...')}
        className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 min-h-[100px] resize-y disabled:opacity-50 disabled:cursor-not-allowed"
      />
    );
  }

  return (
    <input
      type="text"
      value={stringValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={readOnly}
      autoFocus={autoFocus}
      placeholder={field.description || (field.label ? `Enter ${field.label.toLowerCase()}...` : 'Enter value...')}
      className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

// ============================================================================
// Select Field Renderer (Single Selection with Optional "Other" Support)
// ============================================================================

// Helper to check if a field is the conversion action field (for special UX)
function isConversionActionField(field: UnifiedFieldEntry): boolean {
  return field.key === 'gtm.conversionAction' || field.legacyPath === 'primaryConversionAction';
}

// Get grouped options for conversion action field
function getGroupedConversionActions(): Map<ConversionActionCategory, typeof CANONICAL_CONVERSION_ACTIONS> {
  const grouped = new Map<ConversionActionCategory, typeof CANONICAL_CONVERSION_ACTIONS>();
  for (const category of CATEGORY_ORDER) {
    const actions = CANONICAL_CONVERSION_ACTIONS.filter(a => a.category === category);
    if (actions.length > 0) {
      grouped.set(category, actions);
    }
  }
  return grouped;
}

export function SelectFieldRenderer({
  field,
  value,
  onChange,
  readOnly,
}: FieldRendererProps) {
  const stringValue = typeof value === 'string' ? value : '';
  const options = field.options || [];
  const isConversionField = isConversionActionField(field);

  // Check if the current value is a custom value (not in preset options)
  const isCustomValue = stringValue && stringValue !== 'custom' && !options.some(opt => opt.value === stringValue);
  const [showCustomInput, setShowCustomInput] = useState(stringValue === 'custom' || isCustomValue);
  const [customValue, setCustomValue] = useState(isCustomValue ? stringValue : '');

  // Handle select change
  const handleSelectChange = (newValue: string) => {
    if (newValue === 'custom') {
      setShowCustomInput(true);
      // Don't change the stored value yet - wait for custom input
    } else {
      setShowCustomInput(false);
      setCustomValue('');
      onChange(newValue);
    }
  };

  // Handle custom input change
  const handleCustomChange = (newValue: string) => {
    setCustomValue(newValue);
    onChange(newValue);
  };

  // If allowCustomOptions and showing custom input
  if (field.allowCustomOptions && showCustomInput) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            setShowCustomInput(false);
            setCustomValue('');
            onChange('');
          }}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
          Back to options
        </button>
        <div>
          <input
            type="text"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            disabled={readOnly}
            placeholder={isConversionField
              ? "Enter custom action (e.g., 'Subscribe to newsletter')"
              : `Enter custom ${field.label.toLowerCase()}...`}
            className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-purple-500/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            autoFocus
          />
          <p className="mt-1 text-[10px] text-slate-500">
            {isConversionField
              ? 'Enter a verb phrase describing the action (e.g., "Subscribe to newsletter", "Join waitlist")'
              : `Enter a custom value for ${field.label.toLowerCase()}`}
          </p>
        </div>
      </div>
    );
  }

  // For conversion action field, show grouped options
  if (isConversionField) {
    const groupedActions = getGroupedConversionActions();

    return (
      <div className="space-y-2">
        <select
          value={stringValue}
          onChange={(e) => handleSelectChange(e.target.value)}
          disabled={readOnly}
          className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select conversion action...</option>
          {Array.from(groupedActions.entries()).map(([category, actions]) => (
            <optgroup key={category} label={CATEGORY_LABELS[category]}>
              {actions.map((action) => (
                <option key={action.key} value={action.key}>
                  {action.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {/* Description of selected action */}
        {stringValue && stringValue !== 'custom' && (
          <p className="text-[10px] text-slate-500">
            {CANONICAL_CONVERSION_ACTIONS.find(a => a.key === stringValue)?.description ||
              'Example tracking: GA4 event generate_lead / form_submit / booking_completed'}
          </p>
        )}
      </div>
    );
  }

  // Default select for non-conversion action fields
  return (
    <div className="space-y-2">
      <select
        value={stringValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        disabled={readOnly}
        className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Select {field.label.toLowerCase()}...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// Multi-Select Field Renderer (Chip Selection)
// ============================================================================

export function MultiSelectFieldRenderer({
  field,
  value,
  onChange,
  readOnly,
}: FieldRendererProps) {
  const [customInput, setCustomInput] = useState('');
  const selectedValues = Array.isArray(value) ? value as string[] : [];
  const options = field.options || [];

  const handleToggle = useCallback((optionValue: string) => {
    if (readOnly) return;

    if (selectedValues.includes(optionValue)) {
      onChange(selectedValues.filter(v => v !== optionValue));
    } else {
      onChange([...selectedValues, optionValue]);
    }
  }, [selectedValues, onChange, readOnly]);

  const handleAddCustom = useCallback(() => {
    if (!customInput.trim() || readOnly) return;

    const newValue = customInput.trim().toLowerCase();
    if (!selectedValues.includes(newValue)) {
      onChange([...selectedValues, newValue]);
    }
    setCustomInput('');
  }, [customInput, selectedValues, onChange, readOnly]);

  const handleRemove = useCallback((val: string) => {
    if (readOnly) return;
    onChange(selectedValues.filter(v => v !== val));
  }, [selectedValues, onChange, readOnly]);

  // Check if a value is a predefined option
  const isPredefinedOption = (val: string) => options.some(o => o.value === val);
  const getOptionLabel = (val: string) => {
    const opt = options.find(o => o.value === val);
    return opt?.label || val;
  };

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((val) => (
            <span
              key={val}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                isPredefinedOption(val)
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              }`}
            >
              {getOptionLabel(val)}
              {!readOnly && (
                <button
                  onClick={() => handleRemove(val)}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Options grid */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {options
            .filter(opt => !selectedValues.includes(opt.value))
            .map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleToggle(opt.value)}
                className="px-2.5 py-1 text-xs font-medium text-slate-400 bg-slate-800 border border-slate-700 rounded-full hover:text-cyan-300 hover:border-cyan-500/50 transition-colors"
              >
                + {opt.label}
              </button>
            ))}
        </div>
      )}

      {/* Custom value input (if allowed) */}
      {field.allowCustomOptions && !readOnly && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustom();
              }
            }}
            placeholder="Add custom value..."
            className="flex-1 px-3 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
          />
          <button
            onClick={handleAddCustom}
            disabled={!customInput.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// List Field Renderer (User-Defined List)
// ============================================================================

export function ListFieldRenderer({
  field,
  value,
  onChange,
  readOnly,
  autoFocus,
}: FieldRendererProps) {
  const [newItem, setNewItem] = useState('');
  const items = Array.isArray(value) ? value as string[] : [];

  const handleAdd = useCallback(() => {
    if (!newItem.trim() || readOnly) return;
    onChange([...items, newItem.trim()]);
    setNewItem('');
  }, [newItem, items, onChange, readOnly]);

  const handleRemove = useCallback((index: number) => {
    if (readOnly) return;
    onChange(items.filter((_, i) => i !== index));
  }, [items, onChange, readOnly]);

  return (
    <div className="space-y-2">
      {/* Existing items */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg group"
            >
              <span className="flex-1 text-sm text-slate-300">{item}</span>
              {!readOnly && (
                <button
                  onClick={() => handleRemove(index)}
                  className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new item */}
      {!readOnly && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            autoFocus={autoFocus && items.length === 0}
            placeholder={`Add ${field.label.toLowerCase()}...`}
            className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
          <button
            onClick={handleAdd}
            disabled={!newItem.trim()}
            className="px-3 py-2 text-sm font-medium bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && readOnly && (
        <p className="text-sm text-slate-500 italic">No items</p>
      )}
    </div>
  );
}

// ============================================================================
// URL Field Renderer
// ============================================================================

export function UrlFieldRenderer({
  field,
  value,
  onChange,
  readOnly,
  autoFocus,
}: FieldRendererProps) {
  const stringValue = typeof value === 'string' ? value : '';
  const [isValid, setIsValid] = useState(true);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (newValue) {
      try {
        new URL(newValue);
        setIsValid(true);
      } catch {
        setIsValid(false);
      }
    } else {
      setIsValid(true);
    }
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type="url"
          value={stringValue}
          onChange={(e) => handleChange(e.target.value)}
          disabled={readOnly}
          autoFocus={autoFocus}
          placeholder="https://..."
          className={`w-full px-3 py-2.5 pr-10 text-sm bg-slate-800 border rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
            isValid
              ? 'border-slate-700 focus:border-cyan-500/50'
              : 'border-red-500/50 focus:border-red-500'
          }`}
        />
        {stringValue && isValid && (
          <a
            href={stringValue}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
      {!isValid && stringValue && (
        <p className="text-xs text-red-400">Please enter a valid URL</p>
      )}
    </div>
  );
}

// ============================================================================
// Number Field Renderer
// ============================================================================

export function NumberFieldRenderer({
  field,
  value,
  onChange,
  readOnly,
  autoFocus,
}: FieldRendererProps) {
  const numValue = typeof value === 'number' ? value : '';

  return (
    <input
      type="number"
      value={numValue}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val ? parseFloat(val) : null);
      }}
      disabled={readOnly}
      autoFocus={autoFocus}
      placeholder={field.description || (field.label ? `Enter ${field.label.toLowerCase()}...` : 'Enter value...')}
      className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

// ============================================================================
// Main Field Input Component
// ============================================================================

export interface FieldInputProps extends Omit<FieldRendererProps, 'field'> {
  field: UnifiedFieldEntry | undefined;
  fallbackType?: string;
}

/**
 * Renders the appropriate input component based on field type
 */
export function FieldInput({
  field,
  value,
  onChange,
  readOnly,
  autoFocus,
  fallbackType = 'text',
}: FieldInputProps) {
  // If no field metadata, render basic text input
  if (!field) {
    return (
      <TextFieldRenderer
        field={{ valueType: fallbackType as 'text' } as UnifiedFieldEntry}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        autoFocus={autoFocus}
      />
    );
  }

  // Select renderer based on valueType
  switch (field.valueType) {
    case 'select':
      return (
        <SelectFieldRenderer
          field={field}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          autoFocus={autoFocus}
        />
      );

    case 'multi-select':
      return (
        <MultiSelectFieldRenderer
          field={field}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          autoFocus={autoFocus}
        />
      );

    case 'list':
    case 'string[]':
    case 'array':
      return (
        <ListFieldRenderer
          field={field}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          autoFocus={autoFocus}
        />
      );

    case 'url':
      return (
        <UrlFieldRenderer
          field={field}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          autoFocus={autoFocus}
        />
      );

    case 'number':
      return (
        <NumberFieldRenderer
          field={field}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          autoFocus={autoFocus}
        />
      );

    case 'text':
    case 'string':
    default:
      return (
        <TextFieldRenderer
          field={field}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          autoFocus={autoFocus}
        />
      );
  }
}

// ============================================================================
// Value Preview Helper
// ============================================================================

/**
 * Get a display-friendly preview of a value based on field type
 */
export function getValuePreview(
  value: unknown,
  field?: UnifiedFieldEntry,
  maxLength: number = 50
): string {
  if (value === null || value === undefined) return '(empty)';

  if (!field) {
    return typeof value === 'string'
      ? (value.length > maxLength ? value.slice(0, maxLength) + '...' : value)
      : String(value);
  }

  switch (field.valueType) {
    case 'select':
      if (typeof value === 'string' && field.options) {
        const opt = field.options.find(o => o.value === value);
        return opt?.label || value;
      }
      return String(value);

    case 'multi-select':
    case 'list':
    case 'string[]':
    case 'array':
      if (Array.isArray(value)) {
        if (value.length === 0) return '(empty)';
        if (field.valueType === 'multi-select' && field.options) {
          // Map values to labels
          const labels = value.map(v => {
            const opt = field.options?.find(o => o.value === v);
            return opt?.label || v;
          });
          return labels.length > 2
            ? `${labels.slice(0, 2).join(', ')}... +${labels.length - 2}`
            : labels.join(', ');
        }
        return value.length > 2
          ? `${value.slice(0, 2).join(', ')}... +${value.length - 2}`
          : value.join(', ');
      }
      return String(value);

    case 'url':
      if (typeof value === 'string') {
        try {
          const url = new URL(value);
          return url.hostname;
        } catch {
          return value.length > maxLength ? value.slice(0, maxLength) + '...' : value;
        }
      }
      return String(value);

    default:
      if (typeof value === 'string') {
        return value.length > maxLength ? value.slice(0, maxLength) + '...' : value;
      }
      return String(value);
  }
}
