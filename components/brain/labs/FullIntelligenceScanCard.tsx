// components/brain/labs/FullIntelligenceScanCard.tsx
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface FullScanCardProps {
  companyId: string;
  lastScanCompletedAt?: string | null;
  lastScanToolsCount?: number | null;
}

export function FullIntelligenceScanCard({
  companyId,
  lastScanCompletedAt,
  lastScanToolsCount,
}: FullScanCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/os/companies/${companyId}/diagnostics/full-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || 'Failed to start scan');
      } else {
        setMessage('Full Intelligence Scan started. Diagnostics will update as runs complete.');
      }
    } catch (e) {
      setMessage('Failed to start scan. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  const lastScanText = lastScanCompletedAt
    ? `Last scan: ${formatDistanceToNow(new Date(lastScanCompletedAt))} ago`
    : 'Last scan: not available';

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-100">Full Intelligence Scan</h2>
        <p className="text-xs text-slate-400">
          Run all core diagnostics (GAP, Competition, Website, Brand, Content, SEO, Demand, Ops) to refresh this company&apos;s intelligence.
        </p>
        <p className="text-[11px] text-slate-500">
          {lastScanText}
          {lastScanToolsCount ? ` · ${lastScanToolsCount} tools` : ''}
        </p>
        {message && <p className="text-[11px] text-slate-400">{message}</p>}
      </div>
      <div className="flex flex-col gap-2 md:items-end">
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? 'Running Full Scan…' : 'Run Full Intelligence Scan'}
        </button>
      </div>
    </div>
  );
}
