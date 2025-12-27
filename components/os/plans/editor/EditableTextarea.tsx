'use client';

// components/os/plans/editor/EditableTextarea.tsx
// A simple editable textarea field for plan sections

import { useCallback } from 'react';

interface EditableTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
  helperText?: string;
}

export function EditableTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  readOnly = false,
  helperText,
}: EditableTextareaProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      {helperText && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        readOnly={readOnly}
        className={`w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 resize-none transition-colors ${
          readOnly
            ? 'cursor-not-allowed opacity-75'
            : 'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50'
        }`}
      />
    </div>
  );
}

export default EditableTextarea;
