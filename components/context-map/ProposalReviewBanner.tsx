// components/context-map/ProposalReviewBanner.tsx
// Banner showing pending AI proposals with quick actions

'use client';

import { Sparkles, CheckCheck, X, Eye } from 'lucide-react';
import type { HydratedContextNode } from '@/lib/contextGraph/nodes';
import { DOMAIN_TO_ZONE } from './constants';

interface ProposalReviewBannerProps {
  nodes: HydratedContextNode[];
  onReviewClick: () => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

interface ProposalStats {
  total: number;
  byZone: Record<string, number>;
  batchIds: Set<string>;
}

function getProposalStats(nodes: HydratedContextNode[]): ProposalStats {
  const byZone: Record<string, number> = {};
  const batchIds = new Set<string>();
  let total = 0;

  for (const node of nodes) {
    if (node.pendingProposal) {
      total++;
      const zoneId = DOMAIN_TO_ZONE[node.category] || 'overflow';
      byZone[zoneId] = (byZone[zoneId] || 0) + 1;

      if (node.proposalBatchId) {
        batchIds.add(node.proposalBatchId);
      }
    }
  }

  return { total, byZone, batchIds };
}

export function ProposalReviewBanner({
  nodes,
  onReviewClick,
  onAcceptAll,
  onRejectAll,
}: ProposalReviewBannerProps) {
  const stats = getProposalStats(nodes);

  if (stats.total === 0) {
    return null;
  }

  const zoneCount = Object.keys(stats.byZone).length;
  const zoneText = zoneCount === 1 ? '1 zone' : `${zoneCount} zones`;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20">
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>

        {/* Message */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-amber-200">
            AI suggested {stats.total} {stats.total === 1 ? 'change' : 'changes'}
          </span>
          <span className="text-xs text-amber-400/70">
            across {zoneText}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Accept All */}
        {onAcceptAll && (
          <button
            onClick={onAcceptAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium rounded transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Accept All
          </button>
        )}

        {/* Reject All */}
        {onRejectAll && (
          <button
            onClick={onRejectAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Reject All
          </button>
        )}

        {/* Review Button */}
        <button
          onClick={onReviewClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          Review
        </button>
      </div>
    </div>
  );
}
