'use client';

// components/media/cockpit/TimeRangeSelector.tsx
// Time range selector for Media Lab cockpit
//
// Provides preset time range options and integrates with useMediaTimeRange hook

import { TIME_RANGE_OPTIONS, type TimeRangePreset } from '@/lib/media/cockpit';

interface TimeRangeSelectorProps {
  value: TimeRangePreset;
  onChange: (preset: TimeRangePreset) => void;
  className?: string;
}

export function TimeRangeSelector({ value, onChange, className = '' }: TimeRangeSelectorProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {TIME_RANGE_OPTIONS.map((option) => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === option.key
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-300'
          }`}
          title={option.label}
        >
          {option.shortLabel}
        </button>
      ))}
    </div>
  );
}

export default TimeRangeSelector;
