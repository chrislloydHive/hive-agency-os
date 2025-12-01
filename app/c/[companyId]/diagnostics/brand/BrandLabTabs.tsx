// app/c/[companyId]/diagnostics/brand/BrandLabTabs.tsx
// Brand Lab Tabbed Interface - Actions | Narrative

'use client';

import { useState } from 'react';
import type { DiagnosticActionBoard } from '@/lib/diagnostics/types';
import type { BrandCompetitiveLandscape, BrandNarrativeReport } from '@/lib/gap-heavy/modules/brandLab';
import { DiagnosticActionBoard as ActionBoardComponent } from '@/components/os/diagnostics/DiagnosticActionBoard';
import { CompetitiveSnapshot } from './CompetitiveSnapshot';
import { BrandNarrativeTab } from './BrandNarrativeTab';

type Tab = 'actions' | 'narrative';

type Props = {
  actionBoard: DiagnosticActionBoard;
  competitiveLandscape?: BrandCompetitiveLandscape;
  initialNarrative?: BrandNarrativeReport | null;
  companyId: string;
};

export function BrandLabTabs({
  actionBoard,
  competitiveLandscape,
  initialNarrative,
  companyId,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('actions');

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex gap-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('actions')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'actions'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Actions
              <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-xs">
                {actionBoard.now.length + actionBoard.next.length + actionBoard.later.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('narrative')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'narrative'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Narrative
              {initialNarrative && (
                <span className="ml-2 text-xs text-green-400">*</span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'actions' && (
        <div>
          {/* Competitive Snapshot Card (if available) */}
          {competitiveLandscape && (
            <div className="border-b border-slate-800 bg-slate-900/30">
              <div className="mx-auto max-w-7xl px-6 py-6">
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-100">
                        Competitive Snapshot
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                          {competitiveLandscape.primaryCompetitors.length} competitors
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          competitiveLandscape.differentiationScore >= 70
                            ? 'bg-green-500/20 text-green-300'
                            : competitiveLandscape.differentiationScore >= 50
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          Diff: {competitiveLandscape.differentiationScore}
                        </span>
                      </div>
                    </div>
                    <svg
                      className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <CompetitiveSnapshot competitiveLandscape={competitiveLandscape} />
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* Action Board */}
          <ActionBoardComponent board={actionBoard} />
        </div>
      )}

      {activeTab === 'narrative' && (
        <div className="mx-auto max-w-4xl px-6 py-8">
          <BrandNarrativeTab
            companyId={companyId}
            initialNarrative={initialNarrative}
          />
        </div>
      )}
    </div>
  );
}
