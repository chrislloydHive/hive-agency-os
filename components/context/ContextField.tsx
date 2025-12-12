// components/context/ContextField.tsx
// Context Field Component
//
// Renders a labeled input (text or textarea) with optional confidence tooltip.
// Used for editable context fields in Context Workspace and other context editors.

'use client';

import type { CompanyContext } from '@/lib/types/context';
import { getFieldConfidence } from '@/lib/contextGraph/confidence/getFieldConfidence';
import { ConfidenceTooltip } from './ConfidenceTooltip';

export interface ContextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  fieldName?: string;
  confidenceNotes?: CompanyContext['confidenceNotes'];
  className?: string;
  disabled?: boolean;
}

export function ContextField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
  fieldName,
  confidenceNotes,
  className = '',
  disabled = false,
}: ContextFieldProps) {
  const inputClasses =
    'w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none disabled:opacity-50 disabled:cursor-not-allowed';

  // Get confidence note for this field
  const note = fieldName ? getFieldConfidence(fieldName, confidenceNotes) : null;

  return (
    <div className={className}>
      <label className="flex items-center text-xs font-medium text-slate-400 mb-1.5">
        {label}
        {note && <ConfidenceTooltip note={note} />}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={inputClasses}
          disabled={disabled}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClasses}
          disabled={disabled}
        />
      )}
    </div>
  );
}
