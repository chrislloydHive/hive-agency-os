// components/os/blueprint/BlueprintDiagnosticsColumn.tsx
// Left column: Diagnostics / Findings / Evidence
// Shows what the system sees - the "truth stack"

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BlueprintDimensionGrid } from './BlueprintDimensionGrid';
import { BlueprintIssuesSection } from './BlueprintIssuesSection';
import { BlueprintAnalyticsPanel } from './BlueprintAnalyticsPanel';
import { BlueprintStartHere } from './BlueprintStartHere';
import { getScoreColor, getScoreBgColor, getMaturityStageStyle } from './utils';
import type {
  CompanyData,
  CompanyStrategicSnapshot,
  StrategySynthesis,
  BlueprintPipelineData,
  BrainSummary,
  PerformancePulse,
  BlueprintAnalyticsSummary,
  AnalyticsStrategicInsight,
} from './types';

interface BlueprintDiagnosticsColumnProps {
  company: CompanyData;
  strategySnapshot: CompanyStrategicSnapshot | null;
  strategySynthesis?: StrategySynthesis | null;
  pipelineData?: BlueprintPipelineData | null;
  brainSummary: BrainSummary | null;
  analyticsSummary?: BlueprintAnalyticsSummary | null;
  analyticsInsights?: AnalyticsStrategicInsight[];
  performancePulse?: PerformancePulse | null;
  onSendInsightToWork: (insight: AnalyticsStrategicInsight) => Promise<void>;
}

function SectionHeader({
  icon,
  title,
  description,
  eyebrow,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-5 h-5 text-slate-400 mt-0.5">{icon}</div>
        <div>
          {eyebrow && (
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{eyebrow}</p>
          )}
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function ExecutiveSummaryCard({
  strategySnapshot,
  strategySynthesis,
  pipelineData,
}: {
  strategySnapshot: CompanyStrategicSnapshot | null;
  strategySynthesis?: StrategySynthesis | null;
  pipelineData?: BlueprintPipelineData | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const narrative = strategySynthesis?.strategicNarrative;
  const overallScore = strategySnapshot?.overallScore ?? pipelineData?.diagnostics?.overallScore ?? null;
  const maturityStage = strategySnapshot?.maturityStage;
  const confidence = strategySynthesis?.confidence;

  if (!narrative && !overallScore && !maturityStage) {
    return (
      <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 border-dashed p-4 text-center">
        <p className="text-xs text-slate-500">
          No strategic summary available. Run diagnostics to generate insights.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 p-4">
      {/* Score + Maturity Row */}
      <div className="flex items-center gap-4 mb-3">
        {overallScore !== null && (
          <div className={`rounded-lg px-3 py-2 ${getScoreBgColor(overallScore)}`}>
            <span className={`text-2xl font-bold tabular-nums ${getScoreColor(overallScore)}`}>
              {overallScore}
            </span>
            <span className="text-xs text-slate-500 ml-1">/100</span>
          </div>
        )}
        {maturityStage && (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getMaturityStageStyle(maturityStage)}`}>
            {maturityStage}
          </span>
        )}
        {confidence && (
          <span className={`text-xs px-2 py-0.5 rounded ${
            confidence === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
            confidence === 'medium' ? 'bg-amber-500/20 text-amber-300' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {confidence} confidence
          </span>
        )}
      </div>

      {/* Narrative */}
      {narrative && (
        <div>
          <p className={`text-sm text-slate-300 leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
            {narrative}
          </p>
          {narrative.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-400 hover:text-blue-300 mt-1"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StrengthsCard({ strengths }: { strengths: string[] }) {
  if (strengths.length === 0) return null;

  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4">
      <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Key Strengths
      </h4>
      <ul className="space-y-1.5">
        {strengths.slice(0, 4).map((strength, idx) => (
          <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
            <span className="text-emerald-400 flex-shrink-0 mt-0.5">+</span>
            <span>{strength}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidencePanel({ pipelineData }: { pipelineData?: BlueprintPipelineData | null }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!pipelineData) return null;

  // Check if there's any evidence to show
  const hasEvidence = pipelineData.diagnostics?.toolStatuses?.length > 0;
  if (!hasEvidence) return null;

  return (
    <div className="rounded-lg bg-slate-800/30 border border-slate-700/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="text-xs font-medium text-slate-400">Evidence & Inputs</span>
          <span className="text-[10px] text-slate-600">Optional detail for strategists</span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {/* Tool statuses */}
          {pipelineData.diagnostics?.toolStatuses?.map((tool, idx) => (
            <div key={idx} className="text-xs text-slate-500 p-2 rounded bg-slate-800/50">
              <span className="font-medium text-slate-400">{tool.toolId}</span>:{' '}
              {tool.status} {tool.lastRunAt && `(${tool.lastRunAt})`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BlueprintDiagnosticsColumn({
  company,
  strategySnapshot,
  strategySynthesis,
  pipelineData,
  brainSummary,
  analyticsSummary,
  analyticsInsights,
  performancePulse,
  onSendInsightToWork,
}: BlueprintDiagnosticsColumnProps) {
  const keyStrengths = strategySnapshot?.keyStrengths || [];

  return (
    <div className="space-y-6">
      {/* Start Here - Attention Focus Card */}
      <BlueprintStartHere
        strategySnapshot={strategySnapshot}
        strategySynthesis={strategySynthesis}
        pipelineData={pipelineData}
      />

      {/* Executive Summary */}
      <section id="summary">
        <SectionHeader
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          eyebrow="High-level assessment"
          title="Executive Summary"
          description="AI-generated strategic overview"
        />
        <ExecutiveSummaryCard
          strategySnapshot={strategySnapshot}
          strategySynthesis={strategySynthesis}
          pipelineData={pipelineData}
        />
      </section>

      {/* Dimension Scores */}
      <section id="scores">
        <SectionHeader
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          eyebrow="Marketing performance"
          title="Dimension Scores"
          description="Performance by marketing dimension"
        />
        <BlueprintDimensionGrid pipelineData={pipelineData} />
      </section>

      {/* Key Strengths (if any) */}
      {keyStrengths.length > 0 && (
        <section>
          <StrengthsCard strengths={keyStrengths} />
        </section>
      )}

      {/* Key Issues */}
      <section id="issues">
        <SectionHeader
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          eyebrow="What's limiting performance"
          title="Key Issues"
          description="System-detected gaps grouped by area"
        />
        <BlueprintIssuesSection strategySnapshot={strategySnapshot} />
      </section>

      {/* Analytics & Performance */}
      <section id="analytics">
        <SectionHeader
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
          eyebrow="Traffic & conversion pulse"
          title="Analytics & Performance"
          description="Traffic, search, and conversion metrics"
          action={
            company.ga4PropertyId && (
              <Link
                href={`/c/${company.id}/analytics`}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Deep dive
              </Link>
            )
          }
        />
        <BlueprintAnalyticsPanel
          companyId={company.id}
          summary={analyticsSummary ?? null}
          insights={analyticsInsights}
          onSendInsightToWork={onSendInsightToWork}
          performancePulse={performancePulse}
        />
      </section>

      {/* Brain Summary (if exists) */}
      {brainSummary && brainSummary.total > 0 && (
        <section>
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-sm text-slate-300">
                  <span className="font-semibold text-slate-100">{brainSummary.total}</span> insights in Brain
                </span>
                {brainSummary.recentCount !== undefined && brainSummary.recentCount > 0 && (
                  <span className="text-xs text-emerald-400">+{brainSummary.recentCount} this week</span>
                )}
              </div>
              <Link
                href={`/c/${company.id}/brain`}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                View all
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Evidence Panel (collapsed by default) */}
      <EvidencePanel pipelineData={pipelineData} />
    </div>
  );
}
