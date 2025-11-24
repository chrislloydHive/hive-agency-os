// components/gap/GapIaReportPreview.tsx
// Human-readable preview of GAP-IA V2 JSON results

"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import type { GapIaV2Result } from "@/lib/gap/types";

interface GapIaReportPreviewProps {
  ia: GapIaV2Result | any | null; // Accept GapIaRun or GapIaV2Result
}

export function GapIaReportPreview({ ia }: GapIaReportPreviewProps) {
  if (!ia) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 text-center text-slate-400">
        No GAP-IA report available yet.
      </div>
    );
  }

  // Extract V2 fields from either GapIaRun or GapIaV2Result
  const summary = ia.summary;
  const dimensions = ia.dimensions;
  const breakdown = ia.breakdown;
  const quickWins = ia.quickWins;
  const benchmarks = ia.benchmarks;

  // Debug logging
  console.log('[GapIaReportPreview] Received data:', {
    hasSummary: !!summary,
    hasDimensions: !!dimensions,
    hasBreakdown: !!breakdown,
    hasQuickWins: !!quickWins,
    hasBenchmarks: !!benchmarks,
    dimensionKeys: dimensions ? Object.keys(dimensions) : [],
    benchmarkData: benchmarks,
    fullObject: ia,
  });

  // If no V2 fields, show legacy warning
  if (!summary && !dimensions) {
    return (
      <div className="rounded-lg border border-amber-700 bg-amber-900/20 p-6">
        <h3 className="mb-2 text-lg font-semibold text-amber-400">
          Legacy GAP-IA Format
        </h3>
        <p className="text-sm text-slate-300">
          This GAP-IA run uses the legacy format and doesn't have V2 enhanced fields (summary, dimensions, breakdown, quickWins).
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Run a new GAP-IA analysis to see the enhanced report.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-100">
          Executive Summary
        </h2>

        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Overall Score:</span>
            <span className="text-2xl font-bold text-emerald-400">
              {summary.overallScore}/100
            </span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Maturity:</span>
            <span className="text-sm font-medium text-slate-200">
              {summary.maturityStage}
            </span>
          </div>
        </div>

        <div className="mb-3 rounded bg-slate-800/50 p-3">
          <p className="text-base font-medium italic text-slate-200">
            {summary.headlineDiagnosis}
          </p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{summary.narrative}</ReactMarkdown>
        </div>

        {summary.topOpportunities && summary.topOpportunities.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-300">
              Top Opportunities:
            </h3>
            <ul className="space-y-1.5">
              {summary.topOpportunities.map((opp: string, idx: number) => (
                <li key={idx} className="flex gap-2 text-sm text-slate-300">
                  <span className="text-emerald-400">→</span>
                  <span>{opp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Dimension Scores - Combined Visual + Explanations */}
      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-100">
          Dimension Scores
        </h2>

        <div className="space-y-6">
          {Object.entries(dimensions).map(([key, dim]: [string, any]) => {
            const score = dim.score ?? 0;
            const percentage = Math.min(Math.max(score, 0), 100);

            return (
              <div key={key} className="space-y-2">
                {/* Dimension Header with Score */}
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-slate-200">
                    {dim.label}
                  </span>
                  <span className="text-xl font-bold text-emerald-400">
                    {score}/100
                  </span>
                </div>

                {/* Visual Bar Chart */}
                <div className="flex items-center gap-2">
                  <div className="flex h-6 flex-1 items-center gap-0.5">
                    {/* Filled blocks */}
                    {Array.from({ length: Math.floor(percentage / 10) }).map((_, i) => (
                      <div
                        key={`filled-${i}`}
                        className="h-full flex-1 rounded-sm bg-emerald-500"
                      />
                    ))}
                    {/* Empty blocks */}
                    {Array.from({ length: 10 - Math.floor(percentage / 10) }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="h-full flex-1 rounded-sm bg-slate-800"
                        style={{
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(148, 163, 184, 0.1) 2px, rgba(148, 163, 184, 0.1) 4px)'
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-emerald-400">
                    {score}
                  </span>
                </div>

                {/* What It Means */}
                <p className="text-sm text-slate-300">
                  {dim.oneLiner}
                </p>

                {/* Issues (if any) */}
                {dim.issues && dim.issues.length > 0 && (
                  <ul className="mt-2 space-y-1 border-l-2 border-red-500/30 pl-3">
                    {dim.issues.map((issue: string, idx: number) => (
                      <li
                        key={idx}
                        className="flex gap-2 text-xs text-slate-400"
                      >
                        <span className="text-red-400">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* How You Stack Up - Competitive Benchmarks */}
      {benchmarks && benchmarks.peerCount >= 3 && (
        <section className="rounded-lg border border-emerald-700/50 bg-emerald-900/10 p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">
            How You Stack Up
          </h2>

          <div className="mb-4 rounded-lg bg-slate-800/50 p-4">
            <p className="text-sm text-slate-300">
              Compared to{' '}
              <span className="font-semibold text-emerald-400">
                {benchmarks.peerCount} {benchmarks.cohortLabel}
              </span>
              {benchmarks.cohortType === 'global' && (
                <span className="ml-1 text-xs text-slate-500">
                  (no specific cohort match)
                </span>
              )}
            </p>
          </div>

          {/* Overall Percentile */}
          <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-lg font-medium text-slate-200">
                Overall Performance
              </span>
              {benchmarks.overall.percentile !== null && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-400">
                    {benchmarks.overall.percentile}th
                  </div>
                  <div className="text-xs text-slate-400">percentile</div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span>Your score: {benchmarks.overall.score}</span>
              {benchmarks.overall.median !== null && (
                <>
                  <span>•</span>
                  <span>Peer median: {Math.round(benchmarks.overall.median)}</span>
                </>
              )}
              {benchmarks.overall.topQuartile !== null && (
                <>
                  <span>•</span>
                  <span>Top 25%: {Math.round(benchmarks.overall.topQuartile)}</span>
                </>
              )}
            </div>
          </div>

          {/* Dimension Benchmarks */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">
              Dimension Benchmarks
            </h3>

            {Object.entries(benchmarks.dimensions).map(([key, dim]: [string, any]) => {
              if (!dim || dim.percentile === null) return null;

              const percentile = dim.percentile || 0;
              const isStrong = percentile >= 75;
              const isWeak = percentile < 50;

              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/30 p-3"
                >
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium capitalize text-slate-200">
                        {key === 'seo' ? 'SEO' : key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      {isStrong && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                          Strong
                        </span>
                      )}
                      {isWeak && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-400">
                          Below Average
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>Score: {dim.score}</span>
                      {dim.median !== null && (
                        <>
                          <span>•</span>
                          <span>Peer median: {Math.round(dim.median)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        isStrong
                          ? 'text-emerald-400'
                          : isWeak
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {percentile}th
                    </div>
                    <div className="text-xs text-slate-500">percentile</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Key Findings */}
      {breakdown && breakdown.bullets && breakdown.bullets.length > 0 && (
        <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">
            Key Findings
          </h2>

          <div className="space-y-3">
            {breakdown.bullets.map((item: any, idx: number) => (
              <div
                key={idx}
                className="rounded border-l-2 border-amber-500 bg-slate-800/50 p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {item.category}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      item.impactLevel === "high"
                        ? "text-red-400"
                        : item.impactLevel === "medium"
                        ? "text-amber-400"
                        : "text-slate-400"
                    }`}
                  >
                    {item.impactLevel} impact
                  </span>
                </div>
                <p className="text-sm text-slate-200">{item.statement}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Wins */}
      {quickWins && quickWins.bullets && quickWins.bullets.length > 0 && (
        <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">
            Quick Wins (30 Days)
          </h2>

          <div className="space-y-3">
            {quickWins.bullets.map((item: any, idx: number) => (
              <div
                key={idx}
                className="rounded border-l-2 border-emerald-500 bg-slate-800/50 p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {item.category}
                  </span>
                  <span className="text-xs text-slate-400">
                    {item.effortLevel} effort
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span
                    className={`text-xs font-medium ${
                      item.expectedImpact === "high"
                        ? "text-emerald-400"
                        : item.expectedImpact === "medium"
                        ? "text-amber-400"
                        : "text-slate-400"
                    }`}
                  >
                    {item.expectedImpact} impact
                  </span>
                </div>
                <p className="text-sm text-slate-200">{item.action}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
