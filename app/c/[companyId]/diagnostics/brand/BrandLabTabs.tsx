// app/c/[companyId]/diagnostics/brand/BrandLabTabs.tsx
// Brand Lab Tabbed Interface - Actions | Narrative | Refinement

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { DiagnosticActionBoard } from '@/lib/diagnostics/types';
import type { BrandCompetitiveLandscape, BrandNarrativeReport } from '@/lib/gap-heavy/modules/brandLab';
import type { LabRefinementRunResult } from '@/lib/labs/refinementTypes';
import { DiagnosticActionBoard as ActionBoardComponent } from '@/components/os/diagnostics/DiagnosticActionBoard';
import { CompetitiveSnapshot } from './CompetitiveSnapshot';
import { BrandNarrativeTab } from './BrandNarrativeTab';
import { RefinementSummary } from '@/components/labs/RefinementSummary';

type Tab = 'actions' | 'narrative' | 'refinement';

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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('actions');
  const [isRunningRefinement, setIsRunningRefinement] = useState(false);
  const [refinementResult, setRefinementResult] = useState<LabRefinementRunResult | null>(null);

  // Run Brand Lab refinement
  const runRefinement = useCallback(async () => {
    setIsRunningRefinement(true);
    setRefinementResult(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/labs/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labId: 'brand' }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[BrandLab] Refinement failed:', data.error);
        return;
      }

      setRefinementResult(data.result);
      router.refresh(); // Refresh page to update context
    } catch (error) {
      console.error('[BrandLab] Refinement error:', error);
    } finally {
      setIsRunningRefinement(false);
    }
  }, [companyId, router]);

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
            <button
              onClick={() => setActiveTab('refinement')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'refinement'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Refinement
              {refinementResult && (
                <span className="ml-2 rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                  {refinementResult.applyResult?.updated || 0}
                </span>
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

      {activeTab === 'refinement' && (
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-100">Brand Lab Refinement</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Refine brand context in Brain using AI analysis. Labs respect human overrides and source priorities.
                </p>
              </div>
              <button
                onClick={runRefinement}
                disabled={isRunningRefinement}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunningRefinement ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refining...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Run Refinement
                  </>
                )}
              </button>
            </div>

            {/* Refinement Result */}
            {refinementResult ? (
              <RefinementSummary result={refinementResult} showDetails />
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-200 mb-2">
                  Run Brand Lab Refinement
                </h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Analyze current brand context and propose refinements to positioning, value props, tone of voice, and messaging pillars. Changes are written to Brain with full provenance tracking.
                </p>
              </div>
            )}

            {/* Info Box */}
            <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
              <h4 className="text-sm font-medium text-slate-200 mb-2">How Refinement Mode Works</h4>
              <ul className="text-xs text-slate-400 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">1.</span>
                  Loads current brand context from Brain
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">2.</span>
                  AI analyzes and proposes delta updates (not full replacements)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">3.</span>
                  Respects human overrides — never overwrites user-entered values
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">4.</span>
                  Records provenance with confidence scores for traceability
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
