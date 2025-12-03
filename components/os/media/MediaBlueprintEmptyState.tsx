// components/os/media/MediaBlueprintEmptyState.tsx
// Empty state for Media & Demand section in Blueprint view
//
// Provides more context about what media features would be available
// and a link to the Media tab for setup.

import Link from 'next/link';

interface MediaBlueprintEmptyStateProps {
  companyId: string;
}

export function MediaBlueprintEmptyState({ companyId }: MediaBlueprintEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300">
      <div className="font-medium text-zinc-100">No media program in scope</div>
      <p className="mt-1 text-xs text-zinc-400">
        This blueprint currently assumes no active performance media program for this company.
        If you start managing paid media, add a media program to unlock demand diagnostics and
        store-level performance views.
      </p>
      <div className="mt-3">
        <Link
          href={`/c/${companyId}/media`}
          className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800 transition-colors"
        >
          Go to Media
        </Link>
      </div>
    </div>
  );
}
