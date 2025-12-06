// components/qbr/QuarterSelector.tsx
// Quarter selection dropdown for QBR Story View

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Calendar } from 'lucide-react';
import { getCurrentQuarter, getPreviousQuarter } from '@/lib/qbr/qbrTypes';

interface Props {
  companyId: string;
  selectedQuarter: string;
}

export function QuarterSelector({ companyId, selectedQuarter }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Generate available quarters (current and 3 previous)
  const quarters: string[] = [];
  let q = getCurrentQuarter();
  for (let i = 0; i < 4; i++) {
    quarters.push(q);
    q = getPreviousQuarter(q);
  }

  const handleSelect = (quarter: string) => {
    setOpen(false);
    router.push(`/c/${companyId}/qbr/story?quarter=${quarter}`);
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
      >
        <Calendar className="h-4 w-4 text-slate-500" />
        <span>{selectedQuarter}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
          {quarters.map((quarter) => (
            <button
              key={quarter}
              onClick={() => handleSelect(quarter)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                quarter === selectedQuarter
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}
            >
              {quarter}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
