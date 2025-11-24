// components/os/GapRunsPanel.tsx
import { fetchRecentGapRuns } from '@/lib/gap/airtable';

export default async function GapRunsPanel() {
  const runs = await fetchRecentGapRuns(10);

  if (runs.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <h2 className="text-lg font-semibold text-neutral-100">GAP Runs</h2>
        <p className="mt-2 text-sm text-neutral-400">
          No GAP runs found yet. Generate a Growth Acceleration Plan to see it
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-neutral-100">GAP Runs</h2>
        {/* Optional: link to full list later */}
        {/* <a href="/gap-runs" className="text-xs text-neutral-400 hover:text-neutral-200">
          View all
        </a> */}
      </div>

      <div className="text-xs text-neutral-400 grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 mb-1 px-1">
        <span>Business</span>
        <span className="text-right">Overall</span>
        <span className="text-right">Maturity</span>
        <span className="text-right">Quick Wins</span>
      </div>

      <div className="space-y-1">
        {runs.map((run) => (
          <a
            key={run.id}
            href={`/growth-acceleration-plan?planId=${encodeURIComponent(run.planId)}`}
            className="flex items-center justify-between rounded-xl px-2 py-2 hover:bg-neutral-800 transition"
          >
            <div className="flex flex-col">
              <span className="text-sm text-neutral-100 truncate">
                {run.businessName || run.url}
              </span>
              <span className="text-xs text-neutral-500 truncate">
                {run.url}
              </span>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <div className="text-right">
                <div className="font-semibold text-neutral-100">
                  {run.overallScore ?? 0}
                </div>
                <div className="text-neutral-500">Score</div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center rounded-full px-2 py-0.5 border border-neutral-700 text-[11px] uppercase tracking-wide">
                  {run.maturityStage || '—'}
                </span>
              </div>

              <div className="text-right">
                <div className="font-semibold text-neutral-100">
                  {run.quickWinsCount ?? 0}
                </div>
                <div className="text-neutral-500">Quick wins</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
