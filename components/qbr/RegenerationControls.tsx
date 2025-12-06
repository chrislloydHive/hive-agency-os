// components/qbr/RegenerationControls.tsx
// Regeneration controls for QBR Story View

'use client';

import { useState, useRef, useEffect } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
import type { RegenerationMode, QbrDomain } from '@/lib/qbr/qbrTypes';

interface Props {
  onRegenerate: (opts: { mode: RegenerationMode; domain?: string }) => void;
  disabled?: boolean;
  domain?: QbrDomain;
  compact?: boolean;
}

const MODES: { value: RegenerationMode; label: string; desc: string }[] = [
  { value: 'full_rewrite', label: 'Full Rewrite', desc: 'Generate new content from scratch' },
  { value: 'clarity', label: 'Improve Clarity', desc: 'Make the text clearer and more precise' },
  { value: 'shorter', label: 'Make Shorter', desc: 'Condense the content' },
  { value: 'longer', label: 'Make Longer', desc: 'Expand with more detail' },
];

export function RegenerationControls({ onRegenerate, disabled, domain, compact }: Props) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (mode: RegenerationMode) => {
    setOpen(false);
    onRegenerate({ mode, domain });
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="p-1.5 bg-slate-700/50 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Regenerate"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
            {MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => handleSelect(mode.value)}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className="h-4 w-4" />
        <span>Regenerate</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => handleSelect(mode.value)}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-700 transition-colors"
            >
              <div className="text-sm text-slate-200">{mode.label}</div>
              <div className="text-xs text-slate-500">{mode.desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
