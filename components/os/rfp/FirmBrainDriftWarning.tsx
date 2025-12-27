'use client';

// components/os/rfp/FirmBrainDriftWarning.tsx
// Shows warning when Firm Brain has changed since RFP creation

import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { FirmBrainDriftDetails } from '@/lib/os/ai/firmBrainSnapshot';

interface FirmBrainDriftWarningProps {
  drift: FirmBrainDriftDetails;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export function FirmBrainDriftWarning({
  drift,
  onRegenerate,
  regenerating = false,
}: FirmBrainDriftWarningProps) {
  if (!drift.hasDrifted) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <div className="text-xs">
          <p className="text-amber-300">{drift.message}</p>
          {drift.recommendation && (
            <p className="text-amber-400/70 mt-0.5">{drift.recommendation}</p>
          )}
        </div>
      </div>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1.5 px-2 py-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
          {regenerating ? 'Updating...' : 'Regenerate'}
        </button>
      )}
    </div>
  );
}

/**
 * Compact drift indicator for header
 */
export function DriftIndicator({
  hasDrifted,
}: {
  hasDrifted: boolean;
}) {
  if (!hasDrifted) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-amber-400"
      title="Firm Brain has changed since this RFP was created"
    >
      <AlertTriangle className="w-3 h-3" />
      Drift
    </span>
  );
}
