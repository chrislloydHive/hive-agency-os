// components/context/ConfidenceTooltip.tsx
// Confidence Tooltip Component
//
// Displays confidence status (high confidence or needs review) with hover tooltip.
// Used in ContextField and other field-level components.

'use client';

import { useState, useRef } from 'react';
import { Info } from 'lucide-react';
import type { FieldConfidenceNote } from '@/lib/contextGraph/confidence/getFieldConfidence';

export interface ConfidenceTooltipProps {
  note: FieldConfidenceNote;
}

export function ConfidenceTooltip({ note }: ConfidenceTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative inline-flex ml-1.5">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-0.5 rounded-full transition-colors ${
          note.isHighConfidence
            ? 'text-emerald-400/60 hover:text-emerald-400'
            : 'text-amber-400/60 hover:text-amber-400'
        }`}
      >
        <Info className="w-3 h-3" />
      </button>
      {isOpen && (
        <div
          ref={tooltipRef}
          className="absolute left-0 top-full mt-1 z-50 w-48 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-lg"
        >
          {note.isHighConfidence ? (
            <p className="text-xs text-emerald-400">
              <span className="font-medium">High confidence</span>
            </p>
          ) : (
            <div className="text-xs">
              <p className="text-amber-400 font-medium">Needs review</p>
              {note.reason && (
                <p className="text-slate-400 mt-0.5">{note.reason}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
