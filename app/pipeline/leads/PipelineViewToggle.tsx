'use client';

// app/pipeline/leads/PipelineViewToggle.tsx
// Combined view with toggle between Board (Kanban) and Table views

import { useState } from 'react';
import type { InboundLeadItem } from '@/lib/types/pipeline';
import { PipelineBoardClient } from './PipelineBoardClient';
import { PipelineTableClient } from './PipelineTableClient';

interface EnrichedLead extends InboundLeadItem {
  companyInfo?: { name: string; industry?: string; sizeBand?: string } | null;
}

interface PipelineViewToggleProps {
  leads: EnrichedLead[];
}

type ViewMode = 'board' | 'table';

export function PipelineViewToggle({ leads }: PipelineViewToggleProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  // Filter to only show DMA Full GAP leads (or all pipeline leads)
  const pipelineLeads = leads.filter(
    (lead) => lead.leadSource === 'DMA Full GAP' || lead.pipelineStage
  );

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('board')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'board'
                ? 'bg-amber-500 text-slate-900'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            Board
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-amber-500 text-slate-900'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Table
          </button>
        </div>

        {/* Lead count */}
        <div className="text-sm text-slate-400">
          {pipelineLeads.length} pipeline lead{pipelineLeads.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'board' ? (
        <PipelineBoardClient leads={pipelineLeads} />
      ) : (
        <PipelineTableClient leads={pipelineLeads} />
      )}
    </div>
  );
}
