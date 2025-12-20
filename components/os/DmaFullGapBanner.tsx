'use client';

// components/os/DmaFullGapBanner.tsx
// Banner shown when navigating from Pipeline for a DMA Full GAP lead

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Zap } from 'lucide-react';
import type { InboundLeadItem } from '@/lib/types/pipeline';
import { getMaturityStageColorClasses } from '@/lib/types/pipeline';

interface DmaFullGapBannerProps {
  lead: InboundLeadItem;
  gapRunId?: string | null;
  companyId: string;
}

export function DmaFullGapBanner({ lead, gapRunId, companyId }: DmaFullGapBannerProps) {
  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-xl p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Back to Pipeline + Lead Info */}
        <div className="flex items-start gap-3">
          <Link
            href="/pipeline/opportunities"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Pipeline
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Zap className="w-3 h-3" />
                DMA Full GAP Lead
              </span>
              {lead.gapOverallScore !== null && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Score: {lead.gapOverallScore}
                </span>
              )}
              {lead.gapMaturityStage && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getMaturityStageColorClasses(lead.gapMaturityStage)}`}>
                  {lead.gapMaturityStage}
                </span>
              )}
            </div>

            {/* Contact Info */}
            <div className="mt-1.5 text-xs text-slate-400">
              {lead.name && <span className="font-medium text-slate-300">{lead.name}</span>}
              {lead.name && lead.email && <span className="mx-1.5">·</span>}
              {lead.email && <span>{lead.email}</span>}
            </div>

            {/* Contact Message Preview */}
            {lead.contactMessage && (
              <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 max-w-lg">
                &ldquo;{lead.contactMessage}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {gapRunId && (
            <Link
              href={`/c/${companyId}/diagnostics/gap-plan/${gapRunId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30 transition-colors"
            >
              View GAP Report
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
