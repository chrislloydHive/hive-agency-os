// components/os/blueprint/BlueprintHeaderSummary.tsx
// Full-width strategist header for the Blueprint page
// Shows: company info, overall score, maturity, confidence, last updated, action buttons
//
// MIGRATION: This component now supports CompanySummary as an optional prop.
// When summary is provided, it takes precedence for company info and scores.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  getScoreColor,
  getScoreBgColor,
  getMaturityStageStyle,
  formatRelativeTime,
} from './utils';
import type { CompanyData, StrategySynthesis, BlueprintPipelineData, CompanySummary } from './types';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';

interface BlueprintHeaderSummaryProps {
  // Option 1: Traditional props (backward compatible)
  company: CompanyData;
  strategySnapshot: CompanyStrategicSnapshot | null;
  strategySynthesis?: StrategySynthesis | null;
  pipelineData?: BlueprintPipelineData | null;
  lastUpdated?: string | null;
  onRerunBlueprint?: () => void;
  isRerunning?: boolean;

  // Option 2: New unified data model (preferred)
  summary?: CompanySummary;
}

export function BlueprintHeaderSummary({
  company,
  strategySnapshot,
  strategySynthesis,
  pipelineData,
  lastUpdated,
  onRerunBlueprint,
  isRerunning,
  summary,
}: BlueprintHeaderSummaryProps) {
  const [isNarrativeExpanded, setIsNarrativeExpanded] = useState(false);

  // When summary is provided, prefer its values
  const companyName = summary?.meta.name ?? company.name;
  const companyId = summary?.companyId ?? company.id;
  const companyWebsite = summary?.meta.url ?? company.website;
  const companyDomain = summary?.meta.domain ?? company.domain;
  const hasMediaProgram = summary?.media.hasMediaProgram ?? company.hasMediaProgram;

  // Scores: prefer summary, then strategy snapshot, then pipeline
  const overallScore = summary?.scores.latestBlueprintScore ??
    strategySnapshot?.overallScore ??
    pipelineData?.diagnostics?.overallScore ?? null;
  const maturityStage = summary?.scores.maturityStage ?? strategySnapshot?.maturityStage;

  // Confidence from summary or synthesis
  const confidenceFromSummary = summary?.scores.confidenceLabel?.toLowerCase() as 'high' | 'medium' | 'low' | undefined;
  const confidence = confidenceFromSummary ?? strategySynthesis?.confidence;

  // Narrative from synthesis or strategy snapshot
  const narrative = strategySynthesis?.strategicNarrative || strategySnapshot?.headlineRecommendation;

  // Health tag from summary
  const healthTag = summary?.meta.healthTag;

  // Confidence score mapping
  const confidenceScore = confidence === 'high' ? 85 : confidence === 'medium' ? 60 : confidence === 'low' ? 35 : null;
  const confidenceLabel = confidence ? confidence.charAt(0).toUpperCase() + confidence.slice(1) : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Left: Company Info + Maturity + Health */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-semibold text-slate-100 truncate">{companyName}</h1>
            {maturityStage && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getMaturityStageStyle(maturityStage)}`}>
                {maturityStage}
              </span>
            )}
            {healthTag && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                healthTag === 'Healthy'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : healthTag === 'At Risk'
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
              }`}>
                {healthTag}
              </span>
            )}
          </div>
          {companyWebsite && (
            <a
              href={companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              {companyDomain || companyWebsite}
            </a>
          )}
          {narrative && (
            <div className="mt-3">
              <p className={`text-sm text-slate-300 leading-relaxed ${isNarrativeExpanded ? '' : 'line-clamp-2'}`}>
                {narrative}
              </p>
              {narrative.length > 150 && (
                <button
                  onClick={() => setIsNarrativeExpanded(!isNarrativeExpanded)}
                  className="text-xs text-amber-400 hover:text-amber-300 mt-1 transition-colors"
                >
                  {isNarrativeExpanded ? '← Show less' : 'Read more →'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center: Score Pills */}
        <div className="flex items-center gap-4 lg:px-6 lg:border-l lg:border-r lg:border-slate-800">
          {/* Overall Score */}
          {overallScore !== null && (
            <div className={`rounded-xl px-4 py-3 ${getScoreBgColor(overallScore)}`}>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-3xl font-bold tabular-nums ${getScoreColor(overallScore)}`}>
                  {overallScore}
                </span>
                <span className="text-sm text-slate-500">/100</span>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Health Score</p>
            </div>
          )}

          {/* Confidence Score - matches ToolReportLayout style */}
          {confidenceScore !== null && confidenceLabel && (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              confidence === 'high' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
              confidence === 'medium' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
              'bg-red-500/10 text-red-300 border-red-500/30'
            }`}>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Data:</span>
              {confidenceLabel} ({confidenceScore}%)
            </span>
          )}
        </div>

        {/* Right: Actions + Last Updated */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {onRerunBlueprint && (
              <button
                onClick={onRerunBlueprint}
                disabled={isRerunning}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRerunning ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Re-run Blueprint
                  </>
                )}
              </button>
            )}
            <Link
              href={`/c/${companyId}/work`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              View Work
            </Link>
          </div>
          {lastUpdated && (
            <p className="text-[10px] text-slate-500">
              Last updated {formatRelativeTime(lastUpdated)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
