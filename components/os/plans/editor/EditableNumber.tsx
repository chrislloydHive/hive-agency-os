'use client';

// components/os/plans/editor/EditableNumber.tsx
// An editable number input with currency formatting support

import { useCallback } from 'react';

interface EditableNumberProps {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  readOnly?: boolean;
  helperText?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
}

export function EditableNumber({
  label,
  value,
  onChange,
  placeholder = '0',
  readOnly = false,
  helperText,
  prefix,
  suffix,
  min,
  max,
}: EditableNumberProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === '') {
        onChange(undefined);
      } else {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          onChange(num);
        }
      }
    },
    [onChange]
  );

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      {helperText && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
      <div className="flex items-center gap-1">
        {prefix && (
          <span className="text-sm text-slate-400">{prefix}</span>
        )}
        <input
          type="number"
          value={value ?? ''}
          onChange={handleChange}
          placeholder={placeholder}
          readOnly={readOnly}
          min={min}
          max={max}
          className={`flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 ${
            readOnly
              ? 'cursor-not-allowed opacity-75'
              : 'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50'
          }`}
        />
        {suffix && (
          <span className="text-sm text-slate-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default EditableNumber;
