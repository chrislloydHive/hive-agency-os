// components/os/media/MediaEmptyStateCompact.tsx
// Compact empty state for Media section in Dashboard and other compact contexts
//
// Use this when you need a minimal, inline empty state that doesn't
// take up too much vertical space.

export function MediaEmptyStateCompact() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-300">
      <div className="font-medium text-zinc-100">No media program active</div>
      <div className="mt-1 text-xs text-zinc-400">
        This company is not currently running a performance media program with Hive.
      </div>
    </div>
  );
}
