// components/os/media/MediaProgramEmptyState.tsx
// Full-page empty state for the Media tab when no media program is active
//
// This is shown when navigating to the Media tab for a company that
// doesn't have an active media program.

import type { CompanyRecord } from '@/lib/airtable/companies';

interface MediaProgramEmptyStateProps {
  company: CompanyRecord;
}

export function MediaProgramEmptyState({ company }: MediaProgramEmptyStateProps) {
  return (
    <div className="max-w-xl rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-6">
      <h2 className="text-base font-semibold text-zinc-100">
        No media program active for this company
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        This company is not currently running performance media with Hive. When a media program
        is active, this view will show channel mix, installs, calls, and store-level performance.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-400">
        <li>Paid search and social performance</li>
        <li>Google Maps / GBP actions</li>
        <li>Local Services Ads and call tracking</li>
        <li>Store-level visibility and demand scores</li>
      </ul>
      {/* Future: Wire this up to toggle Media Program Status=active */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="inline-flex items-center rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled
        >
          Add Media Program (coming soon)
        </button>
      </div>
    </div>
  );
}
