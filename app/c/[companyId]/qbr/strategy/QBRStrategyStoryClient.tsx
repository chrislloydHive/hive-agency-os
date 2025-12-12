'use client';

// REUSE REQUIRED
// - Must reuse existing Context Workspace section components if present
// - Must map to Context Graph domains (no parallel context model)
// - Must render existing Proposal type (no new diff format)

// app/c/[companyId]/qbr/strategy/QBRStrategyStoryClient.tsx
// QBR Strategy Story - Client Component
//
// Executive-ready narrative view. Print/PDF friendly.
// Structured as a strategy memo, not a dashboard.

import type { QBRData } from '@/lib/os/qbr';
import {
  QBRStoryHeader,
  QBRSection,
  QBRSubsection,
  QBRNarrative,
  QBRBulletList,
} from '@/components/qbr';
import { QBRHighlights } from '@/components/qbr/QBRHighlights';
import { QBRNextActions } from '@/components/qbr/QBRNextActions';

interface QBRStrategyStoryClientProps {
  data: QBRData;
}

export function QBRStrategyStoryClient({ data }: QBRStrategyStoryClientProps) {
  return (
    <div className="min-h-screen bg-white print:bg-white">
      <div className="mx-auto max-w-3xl px-8 py-12 print:max-w-none print:px-12">
        {/* Header */}
        <QBRStoryHeader
          companyName={data.companyName}
          generatedAt={data.generatedAt}
          dataFreshness={data.dataFreshness}
          dataSources={data.dataSources}
        />

        {/* Section 1: Executive Summary */}
        <QBRSection number={1} title="Executive Summary">
          <QBRNarrative>
            This review synthesizes the strategic position, decisions, and execution
            priorities for {data.companyName}. Below are the key points that matter
            this quarter.
          </QBRNarrative>
          <QBRHighlights bullets={data.executiveSummary} />
        </QBRSection>

        {/* Section 2: Current State */}
        <QBRSection number={2} title="Current State">
          {/* Context Snapshot */}
          <QBRSubsection title="Business Context">
            {data.currentState.businessModel || data.currentState.valueProposition ? (
              <div className="space-y-4">
                {data.currentState.businessModel && (
                  <QBRNarrative>
                    <span className="font-medium">Business Model:</span>{' '}
                    {data.currentState.businessModel}
                  </QBRNarrative>
                )}
                {data.currentState.valueProposition && (
                  <QBRNarrative>
                    <span className="font-medium">Value Proposition:</span>{' '}
                    {data.currentState.valueProposition}
                  </QBRNarrative>
                )}
              </div>
            ) : (
              <p className="text-slate-500 italic">
                Business context not yet defined. Complete Context setup to populate.
              </p>
            )}
          </QBRSubsection>

          {/* Competitive Position */}
          <QBRSubsection title="Competitive Position">
            {data.currentState.competitiveCategory || data.currentState.competitivePositioning ? (
              <div className="space-y-4">
                {data.currentState.competitiveCategory && (
                  <QBRNarrative>
                    Operating in the <span className="font-medium">{data.currentState.competitiveCategory}</span> category.
                  </QBRNarrative>
                )}
                {data.currentState.competitivePositioning && (
                  <QBRNarrative>
                    {data.currentState.competitivePositioning}
                  </QBRNarrative>
                )}
                {data.currentState.topCompetitors && data.currentState.topCompetitors.length > 0 && (
                  <div className="mt-2 text-sm text-slate-600">
                    <span className="text-slate-500">Key competitors:</span>{' '}
                    {data.currentState.topCompetitors.join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 italic">
                Run Competition Analysis to establish competitive positioning.
              </p>
            )}
          </QBRSubsection>

          {/* Audience */}
          <QBRSubsection title="Target Audience">
            {data.currentState.primaryAudience || data.currentState.audienceInsight ? (
              <div className="space-y-4">
                {data.currentState.primaryAudience && (
                  <QBRNarrative>
                    <span className="font-medium">Primary audience:</span>{' '}
                    {data.currentState.primaryAudience}
                  </QBRNarrative>
                )}
                {data.currentState.audienceInsight && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                    {data.currentState.audienceInsight}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 italic">
                Complete Audience Lab to define target segments.
              </p>
            )}
          </QBRSubsection>
        </QBRSection>

        {/* Section 3: What Changed */}
        <QBRSection number={3} title="What Changed">
          {data.whatChanged.strategyUpdates.length > 0 ||
           data.whatChanged.mediaScenarioSelected ||
           data.whatChanged.majorAssumptions.length > 0 ? (
            <>
              {data.whatChanged.strategyUpdates.length > 0 && (
                <QBRSubsection title="Strategy Updates">
                  <QBRBulletList items={data.whatChanged.strategyUpdates} />
                </QBRSubsection>
              )}

              {data.whatChanged.mediaScenarioSelected && (
                <QBRSubsection title="Media Scenario Selected">
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <span className="font-medium text-purple-800">
                      {data.whatChanged.mediaScenarioSelected}
                    </span>
                  </div>
                </QBRSubsection>
              )}

              {data.whatChanged.majorAssumptions.length > 0 && (
                <QBRSubsection title="Major Assumptions">
                  <QBRBulletList items={data.whatChanged.majorAssumptions} />
                </QBRSubsection>
              )}
            </>
          ) : (
            <p className="text-slate-500 italic py-4">
              No significant changes recorded. Update Strategy or run labs to capture changes.
            </p>
          )}
        </QBRSection>

        {/* Section 4: Decisions Made */}
        <QBRSection number={4} title="Decisions Made">
          {/* Strategy Pillars */}
          {data.decisionsMade.strategyPillars.length > 0 && (
            <QBRSubsection title="Strategic Pillars">
              <div className="space-y-4">
                {data.decisionsMade.strategyPillars.map((pillar, i) => (
                  <div
                    key={i}
                    className="p-4 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-slate-900">{pillar.title}</h4>
                        <p className="text-slate-600 mt-1">{pillar.description}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        pillar.priority === 'high'
                          ? 'bg-emerald-100 text-emerald-700'
                          : pillar.priority === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        {pillar.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </QBRSubsection>
          )}

          {/* Media Approach */}
          {data.decisionsMade.mediaApproach && (
            <QBRSubsection title="Media Approach">
              <div className="space-y-3">
                {data.decisionsMade.mediaApproach.objective && (
                  <QBRNarrative>
                    <span className="font-medium">Objective:</span>{' '}
                    {data.decisionsMade.mediaApproach.objective}
                  </QBRNarrative>
                )}
                {data.decisionsMade.mediaApproach.topChannels.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-slate-700">Priority Channels:</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {data.decisionsMade.mediaApproach.topChannels.map((channel, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                        >
                          {channel}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {data.decisionsMade.mediaApproach.budgetFocus && (
                  <p className="text-sm text-slate-600">
                    {data.decisionsMade.mediaApproach.budgetFocus}
                  </p>
                )}
              </div>
            </QBRSubsection>
          )}

          {/* Execution Priorities */}
          {data.decisionsMade.executionPriorities.length > 0 && (
            <QBRSubsection title="Execution Priorities">
              <div className="space-y-2">
                {data.decisionsMade.executionPriorities.map((priority, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    <span className="w-6 h-6 flex items-center justify-center bg-slate-200 text-slate-700 rounded-full text-sm font-medium">
                      {i + 1}
                    </span>
                    <span className="text-slate-800">{priority}</span>
                  </div>
                ))}
              </div>
            </QBRSubsection>
          )}

          {/* Empty state */}
          {data.decisionsMade.strategyPillars.length === 0 &&
           !data.decisionsMade.mediaApproach &&
           data.decisionsMade.executionPriorities.length === 0 && (
            <p className="text-slate-500 italic py-4">
              No decisions recorded. Define Strategy pillars and run labs to capture decisions.
            </p>
          )}
        </QBRSection>

        {/* Section 5: What's Next */}
        <QBRSection number={5} title="What's Next">
          <QBRNextActions data={data.whatsNext} />
        </QBRSection>

        {/* Section 6: Risks & Confidence */}
        <QBRSection number={6} title="Risks & Confidence">
          <div className="grid md:grid-cols-2 gap-6 print:grid-cols-2">
            {/* Key Risks */}
            <div>
              <QBRSubsection title="Key Risks">
                {data.risksAndConfidence.keyRisks.length > 0 ? (
                  <div className="space-y-2">
                    {data.risksAndConfidence.keyRisks.map((risk, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"
                      >
                        <span className="text-amber-500 mt-0.5">!</span>
                        <span className="text-amber-800">{risk}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">
                    No significant risks identified
                  </p>
                )}
              </QBRSubsection>
            </div>

            {/* Needs Validation */}
            <div>
              <QBRSubsection title="Needs Validation">
                {data.risksAndConfidence.needsValidation.length > 0 ? (
                  <div className="space-y-2">
                    {data.risksAndConfidence.needsValidation.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <span className="text-slate-400 mt-0.5">?</span>
                        <span className="text-slate-700">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">
                    All key assumptions validated
                  </p>
                )}
              </QBRSubsection>
            </div>
          </div>
        </QBRSection>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-200 print:mt-8 print:pt-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div>
              Generated by Hive OS
            </div>
            <div>
              {new Date(data.generatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </footer>
      </div>

      {/* Print-only page break hints */}
      <style jsx global>{`
        @media print {
          .print\\:page-break-before {
            page-break-before: always;
          }
          .print\\:page-break-after {
            page-break-after: always;
          }
          .print\\:avoid-break {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
