// components/os/CompanyEditButton.tsx
// Button to trigger the company edit modal

'use client';

import { useState } from 'react';
import type { CompanyRecord } from '@/lib/airtable/companies';
import { CompanyEditModal } from './CompanyEditModal';

interface CompanyEditButtonProps {
  company: CompanyRecord;
  variant?: 'icon' | 'button';
  className?: string;
}

export function CompanyEditButton({ company, variant = 'icon', className = '' }: CompanyEditButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (variant === 'button') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors ${className}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Edit
        </button>
        {isOpen && <CompanyEditModal company={company} onClose={() => setIsOpen(false)} />}
      </>
    );
  }

  // Icon variant (default)
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors ${className}`}
        title="Edit company"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </button>
      {isOpen && <CompanyEditModal company={company} onClose={() => setIsOpen(false)} />}
    </>
  );
}
