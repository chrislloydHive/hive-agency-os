// components/os/media/MediaProgramEmptyState.tsx
// Full-page empty state for the Media tab when no media program is active
//
// AI-First UX: Primary CTA directs users to Media Lab for AI-powered planning.
// Manual setup is available as a secondary option.

'use client';

import Link from 'next/link';
import type { CompanyRecord } from '@/lib/airtable/companies';

interface MediaProgramEmptyStateProps {
  company: CompanyRecord;
  onProgramCreated?: (program: any) => void;
}

export function MediaProgramEmptyState({ company }: MediaProgramEmptyStateProps) {
  return (
    <div className="max-w-xl rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-slate-100">
          No active media program
        </h2>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        Use Media Lab to design an AI-powered media plan based on your company's profile,
        objectives, and budget. Once approved, promote it to an active program and start tracking.
      </p>

      <ul className="mb-5 space-y-2">
        <li className="flex items-start gap-2 text-xs text-slate-500">
          <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>AI-recommended channel mix & budget allocation</span>
        </li>
        <li className="flex items-start gap-2 text-xs text-slate-500">
          <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Seasonal flight planning with forecasting</span>
        </li>
        <li className="flex items-start gap-2 text-xs text-slate-500">
          <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Store-level installs, calls & performance tracking</span>
        </li>
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/c/${company.id}/diagnostics/media?mode=planner`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-sm hover:bg-amber-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Build AI Media Plan
        </Link>

        <Link
          href={`/c/${company.id}/media/program`}
          className="inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-900/70 transition-colors"
        >
          Set up manually (Advanced)
        </Link>
      </div>
    </div>
  );
}
