// components/gap-ia/GapIaNarrativeReport.tsx
// GAP Initial Assessment - Narrative Report (Text-First, Consultant Style)

'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { GapIaRun } from '@/lib/gap/types';
import { buildStackupResult } from '@/lib/gap-ia/stackup';
import { trackEvent } from '@/lib/analytics';
import { getUTM } from '@/lib/utm';
import { CoreMarketingScores } from './CoreMarketingScores';
import { BusinessContextSnapshot } from './BusinessContextSnapshot';
import { getDataConfidenceColor, getDataConfidenceBgColor } from '@/lib/gap/dataConfidence';
import { SocialLocalPresenceCard } from '@/components/gap/SocialLocalPresenceCard';

type Props = {
  run: GapIaRun;
};

export function GapIaNarrativeReport({ run }: Props) {
  const { core, insights, summary, dimensions, breakdown, quickWins } = run;
  const [error, setError] = useState<string | null>(null);

  // Debug logging
  console.log('[GapIaNarrativeReport] Run data:', {
    hasCore: !!core,
    hasInsights: !!insights,
    hasSummary: !!summary,
    hasDimensions: !!dimensions,
    coreKeys: core ? Object.keys(core) : [],
    insightsKeys: insights ? Object.keys(insights) : [],
  });

  console.log('[GapIaNarrativeReport] Core object:', core);
  console.log('[GapIaNarrativeReport] Insights object:', insights);
  console.log('[GapIaNarrativeReport] Core.brand:', core?.brand);
  console.log('[GapIaNarrativeReport] Core.content:', core?.content);
  console.log('[GapIaNarrativeReport] Core.seo:', core?.seo);
  console.log('[GapIaNarrativeReport] Core.website:', core?.website);

  // V3 Metadata debugging
  console.log('[GapIaNarrativeReport] V3 Metadata:', {
    businessContext: run.businessContext,
    digitalFootprint: run.digitalFootprint,
  });

  // TEMPORARY: Full IA output inspection for V3 migration
  console.log('[GapIaNarrativeReport] 🔍 COMPLETE IA OUTPUT:', JSON.stringify(run, null, 2));

  // Check if this is a V2 enhanced run (V3 data mapped to V2 structure)
  const hasV2Data = !!(summary && dimensions && breakdown && quickWins);

  // Get scores with fallbacks
  // PRIORITY: Use V3 dimensions data first (from InitialAssessmentOutput -> mapped to V2 structure)
  // FALLBACK: Use legacy core scores if V3 data not available
  const overallScore = summary?.overallScore || core?.overallScore || core?.marketingReadinessScore || 0;
  const brandScore = dimensions?.brand?.score || core?.brand?.brandScore || 0;
  const contentScore = dimensions?.content?.score || core?.content?.contentScore || 0;
  const seoScore = dimensions?.seo?.score || core?.seo?.seoScore || 0;
  const websiteScore = dimensions?.website?.score || core?.website?.websiteScore || 0;
  const digitalFootprintScore = dimensions?.digitalFootprint?.score || (core as any)?.digitalFootprint?.footprintScore || 0;
  const authorityScore = dimensions?.authority?.score || 0;

  console.log('[GapIaNarrativeReport] Dimension Data Source:', {
    usingV3Dimensions: !!dimensions,
    dimensionsAvailable: dimensions ? Object.keys(dimensions) : [],
    brandScoreSource: dimensions?.brand?.score ? 'V3 dimensions' : 'legacy core',
    contentScoreSource: dimensions?.content?.score ? 'V3 dimensions' : 'legacy core',
  });

  console.log('[GapIaNarrativeReport] Scores:', {
    overallScore,
    brandScore,
    contentScore,
    seoScore,
    websiteScore,
    digitalFootprintScore,
    authorityScore,
  });

  const getGradeLabel = (score: number): string => {
    if (score >= 90) return 'ELITE';
    if (score >= 80) return 'STRONG';
    if (score >= 60) return 'AVERAGE';
    return 'WEAK';
  };

  const gradeLabel = getGradeLabel(overallScore);

  // Helper to generate ASCII-style bar visualization
  const generateBar = (score: number): string => {
    const filled = Math.round(score / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  // Helper to get color classes based on score
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  // Handler for generating full GAP (async with polling)
  const handleGenerateFullGap = async () => {
    // Check if run.id is a valid Airtable record ID
    if (!run.id?.startsWith('rec')) {
      setError('This GAP-IA run uses an older ID format. Please run a new GAP Initial Assessment to generate a Full GAP report.');
      return;
    }

    setError(null);

    try {
      // Get UTM parameters
      const utmParams = getUTM();

      // Fire analytics event: gap_requested
      trackEvent('gap_requested', {
        website: run.url,
      });

      // Step 1: Trigger the background job
      const response = await fetch('/api/gap-plan/from-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gapIaRunId: run.id,
          utm: utmParams,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.message || data.error || 'Failed to start full GAP generation';
        console.error('[GapIaNarrativeReport] API error:', { status: response.status, data });
        throw new Error(errorMsg);
      }

      console.log('[GapIaNarrativeReport] Background job started, redirecting to loading page...');

      // Step 2: Immediately redirect to the loading page with the IA run ID as a query param
      // The loading page will handle polling and redirecting to the final report
      window.location.href = `/growth-acceleration-plan/loading?iaRunId=${run.id}`;
    } catch (err) {
      console.error('[GapIaNarrativeReport] Failed to start full GAP generation:', err);
      const errorMessage = err instanceof Error ? err.message :
                          typeof err === 'string' ? err :
                          'Unknown error occurred';
      setError(errorMessage);
    }
  };

  // Debug view - ALWAYS show for now to see data structure
  const showDebug = false;

  if (showDebug) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 py-8">
        <div className="rounded-lg border border-amber-700 bg-amber-900/20 p-6">
          <h2 className="text-xl font-bold text-amber-400 mb-4">Debug: Raw Run Data</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-2">Full Run Object:</h3>
              <pre className="text-xs text-slate-300 overflow-auto max-h-96 bg-slate-950 p-3 rounded">
                {JSON.stringify(run, null, 2)}
              </pre>
            </div>
            <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded">
              <p className="text-sm text-red-300">
                ⚠️ The core and insights objects are empty. This GAP-IA run may not have completed successfully,
                or the data wasn't generated. Check the run status: <strong>{run.status}</strong>
              </p>
              {run.errorMessage && (
                <p className="text-sm text-red-400 mt-2">
                  Error: {run.errorMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      {/* ====================================================================== */}
      {/* EXECUTIVE SUMMARY */}
      {/* ====================================================================== */}
      <section className="space-y-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold text-slate-100">
            {core.businessName || 'GAP Initial Assessment'}
          </h1>
          <p className="text-sm text-slate-400">{run.url}</p>
          <p className="text-xs text-slate-500 mt-2">
            Powered by Hive — an on-demand marketing operations partner.
          </p>
        </div>

        {/* Data Confidence Badge (aligned with Ops Lab pattern) */}
        {run.dataConfidence && (
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getDataConfidenceBgColor(run.dataConfidence.level)}`}>
              <div className="flex items-center gap-1.5">
                <span className={`text-2xl font-bold tabular-nums ${getDataConfidenceColor(run.dataConfidence.level)}`}>
                  {run.dataConfidence.score}
                </span>
                <span className="text-sm text-slate-400">/100</span>
              </div>
              <div className="border-l border-slate-600 pl-2 ml-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Data Confidence</span>
              </div>
            </div>
            {run.dataConfidence.issues && run.dataConfidence.issues.length > 0 && (
              <div className="text-xs text-slate-500" title={run.dataConfidence.issues.join('; ')}>
                <span className="cursor-help underline decoration-dotted">
                  {run.dataConfidence.issues.length} signal{run.dataConfidence.issues.length > 1 ? 's' : ''} limited
                </span>
              </div>
            )}
          </div>
        )}

        <CoreMarketingScores
          scores={{
            brandScore: brandScore,
            contentScore: contentScore,
            seoScore: seoScore,
            websiteScore: websiteScore,
            authorityScore: authorityScore,
          }}
        />

        <BusinessContextSnapshot
          context={{
            businessType: run.businessContext?.businessType,
            brandTier: run.businessContext?.brandTier,
            maturityStage: run.businessContext?.maturityStage || summary?.maturityStage,
            overallScore: overallScore,
          }}
          coreCompanyType={core?.companyType}
          coreBrandTier={core?.brandTier}
        />

        <details open className="group">
          <summary className="cursor-pointer list-none">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-slate-400 transition-transform group-open:rotate-90">
                ▶
              </span>
              <h2 className="text-xl font-bold text-slate-100">
                Executive Summary
              </h2>
            </div>
          </summary>

          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
            {/* V3 Executive Summary - Uses summary.headlineDiagnosis and summary.narrative */}
            {summary?.narrative ? (
              <div className="prose prose-invert prose-sm max-w-none">
                {/* Headline Diagnosis - Bold lead-in */}
                {summary?.headlineDiagnosis && (
                  <p className="text-base font-semibold text-slate-100 mb-3">
                    {summary.headlineDiagnosis}
                  </p>
                )}
                {/* Full Narrative */}
                <p className="text-sm leading-relaxed text-slate-300">
                  {summary.narrative}
                </p>
              </div>
            ) : (
              <>
                {/* Fallback to old format if V3 narrative not available */}
                <div>
                  <p className="text-xl font-bold text-slate-100">
                    Marketing Readiness Score: {Math.round(overallScore)}/100
                  </p>
                </div>

                {/* Quick Summary - fallback */}
                {core?.quickSummary && (
                  <div>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {core.quickSummary}
                    </p>
                  </div>
                )}

                {/* Overall Summary from insights - fallback */}
                {!core?.quickSummary && insights?.overallSummary && (
                  <div>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {insights.overallSummary}
                    </p>
                  </div>
                )}
              </>
            )}


            {/* Maturity Stage */}
            {core?.marketingMaturity && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Marketing Maturity
                </h3>
                <p className="text-sm text-slate-300">
                  {core.marketingMaturity === 'early' && 'Early-stage'}
                  {core.marketingMaturity === 'developing' && 'Developing'}
                  {core.marketingMaturity === 'advanced' && 'Advanced'}
                  {!['early', 'developing', 'advanced'].includes(core.marketingMaturity) && core.marketingMaturity}
                </p>
              </div>
            )}

            {/* Top Opportunities - prefer summary.topOpportunities, fallback to core.topOpportunities */}
            {((summary?.topOpportunities && summary.topOpportunities.length > 0) ||
              (core?.topOpportunities && core.topOpportunities.length > 0)) && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Top Opportunities
                </h3>
                <ul className="space-y-1 text-sm text-slate-300">
                  {(summary?.topOpportunities || core?.topOpportunities || []).map((opp, idx) => (
                    <li key={idx}>• {opp}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      </section>

      {/* ====================================================================== */}
      {/* HOW TO USE THIS REPORT */}
      {/* ====================================================================== */}
      <div className="rounded-lg border-l-4 border-blue-500 bg-blue-900/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-blue-300 mb-1">How to use this report</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This report shows where marketing is strong, where it is weak, and what to do first. Start with Quick Wins, review Dimension Scores, see how the business stacks up to similar organizations, and then decide whether to request the Full Growth Acceleration Plan.
            </p>
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* EXPORT/SHARE CONTROLS */}
      {/* ====================================================================== */}
      <section className="space-y-3">
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Export & Share</h3>
              <p className="text-xs text-slate-400">Download or share this assessment report</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </button>
              <button
                onClick={async (e) => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    // Show success feedback
                    const button = e.currentTarget as HTMLButtonElement;
                    const originalText = button.innerHTML;
                    button.innerHTML = `
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    `;
                    button.classList.add('bg-green-600');
                    button.classList.remove('bg-slate-700', 'hover:bg-slate-600');
                    setTimeout(() => {
                      button.innerHTML = originalText;
                      button.classList.remove('bg-green-600');
                      button.classList.add('bg-slate-700', 'hover:bg-slate-600');
                    }, 2000);
                  } catch (err) {
                    console.error('Failed to copy link:', err);
                    alert('Failed to copy link to clipboard');
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Link
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================== */}
      {/* QUICK WINS (V2) - with Callout Style */}
      {/* ====================================================================== */}
      {quickWins?.bullets && quickWins.bullets.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">Quick Wins</h2>
              </div>
            </summary>

            {/* Callout Box Introduction */}
            <div className="rounded-lg border-l-4 border-green-500 bg-green-900/10 p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-green-300 mb-1">Start Here</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Quick improvements that can be implemented in the next 30 days without a consultant. Start with these before tackling bigger projects.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-3">
              {quickWins.bullets.map((win, idx) => (
                <div key={idx} className="rounded-lg border border-slate-600/50 bg-slate-800/50 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {win.category}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          win.expectedImpact === 'high' ? 'bg-green-900/30 text-green-400' :
                          win.expectedImpact === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {win.expectedImpact} impact
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          win.effortLevel === 'low' ? 'bg-green-900/20 text-green-400' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {win.effortLevel} effort
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-200 font-medium">
                        {win.action}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* DIMENSION SCORES WITH VISUAL TABLE & CHART */}
      {/* ====================================================================== */}
      <section className="space-y-3">
        <details open className="group">
          <summary className="cursor-pointer list-none">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-slate-400 transition-transform group-open:rotate-90">
                ▶
              </span>
              <h2 className="text-xl font-bold text-slate-100">Dimension Scores</h2>
            </div>
          </summary>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
            {/* Explainer */}
            <div className="rounded-lg border-l-4 border-blue-500 bg-blue-900/10 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-blue-300 mb-1">Understanding the Scores</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Each score is from 0–100 and reflects one part of the marketing system. Lower scores do not mean failure—they show where improvements are likely to have the biggest impact.
                  </p>
                </div>
              </div>
            </div>

            {/* Unified dimension view: bar chart + score + explanation */}
            <div className="space-y-4">
              {/* Brand & Positioning */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">Brand & Positioning</span>
                </div>
                <div className="font-mono text-sm text-slate-400 tracking-wider">
                  {generateBar(brandScore)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {dimensions?.brand?.oneLiner ||
                   (brandScore >= 70 ? 'Brand positioning is reasonably clear' :
                    brandScore >= 50 ? 'Brand clarity needs improvement' :
                    'Brand is unclear or not distinctive')}
                </p>
              </div>

              {/* Content & Messaging */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">Content & Messaging</span>
                </div>
                <div className="font-mono text-sm text-slate-400 tracking-wider">
                  {generateBar(contentScore)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {dimensions?.content?.oneLiner ||
                   (contentScore >= 70 ? 'Content is present and effective' :
                    contentScore >= 50 ? 'Content exists but lacks depth' :
                    'Content is minimal or missing')}
                </p>
              </div>

              {/* SEO & Visibility */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">SEO & Visibility</span>
                </div>
                <div className="font-mono text-sm text-slate-400 tracking-wider">
                  {generateBar(seoScore)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {dimensions?.seo?.oneLiner ||
                   (seoScore >= 70 ? 'SEO basics are in good shape' :
                    seoScore >= 50 ? 'SEO has some gaps to address' :
                    'SEO fundamentals need significant work')}
                </p>
              </div>

              {/* Website & Conversion */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">Website & Conversion</span>
                </div>
                <div className="font-mono text-sm text-slate-400 tracking-wider">
                  {generateBar(websiteScore)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {dimensions?.website?.oneLiner ||
                   (websiteScore >= 70 ? 'Website UX is solid' :
                    websiteScore >= 50 ? 'Website works but has friction points' :
                    'Website has significant UX issues')}
                </p>
              </div>

              {/* Digital Footprint */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">Digital Footprint</span>
                </div>
                <div className="font-mono text-sm text-slate-400 tracking-wider">
                  {generateBar(digitalFootprintScore)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {dimensions?.digitalFootprint?.oneLiner ||
                   (digitalFootprintScore >= 70 ? 'Strong digital presence across channels' :
                    digitalFootprintScore >= 50 ? 'Digital presence exists but needs expansion' :
                    'Digital ecosystem presence is minimal or missing')}
                </p>
              </div>

              {/* Authority & Trust */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">Authority & Trust</span>
                </div>
                <div className="font-mono text-sm text-slate-400 tracking-wider">
                  {generateBar(authorityScore)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {dimensions?.authority?.oneLiner ||
                   (authorityScore >= 70 ? 'Strong authority and trust signals' :
                    authorityScore >= 50 ? 'Building authority and credibility' :
                    'Limited authority and trust signals')}
                </p>
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* ====================================================================== */}
      {/* BUSINESS CONTEXT & SIGNALS */}
      {/* ====================================================================== */}
      {(run.businessContext || run.digitalFootprint) && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Business Context & Signals
                </h2>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-6">
              {/* Explainer */}
              <div className="rounded-lg border-l-4 border-blue-500 bg-blue-900/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-blue-300 mb-1">Business Context</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      This section summarizes the type of business and which channels are in use today. It helps explain why the scores look the way they do.
                    </p>
                  </div>
                </div>
              </div>

              {/* Business Context */}
              {run.businessContext && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-700 pb-2">
                    Business Context
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {run.businessContext.businessType && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Business Type</p>
                        <p className="text-sm text-slate-200 font-medium">
                          {run.businessContext.businessType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                      </div>
                    )}
                    {run.businessContext.maturityStage && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Maturity Stage</p>
                        <p className="text-sm text-slate-200 font-medium">
                          {run.businessContext.maturityStage}
                        </p>
                      </div>
                    )}
                    {run.businessContext.brandTier && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Brand Tier</p>
                        <p className="text-sm text-slate-200 font-medium">
                          {run.businessContext.brandTier.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Content & Website Signals */}
              {core?.content && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-700 pb-2">
                    Content & Website Signals
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Blog/Resources */}
                    {typeof core.content.hasBlogOrResources !== 'undefined' && (
                      <div className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700/50">
                        <span className="text-xs text-slate-400">Blog or Resources</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          core.content.hasBlogOrResources
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-red-900/30 text-red-400'
                        }`}>
                          {core.content.hasBlogOrResources ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}

                    {/* Content Depth */}
                    {core.content.contentDepth && (
                      <div className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700/50">
                        <span className="text-xs text-slate-400">Content Depth</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          core.content.contentDepth === 'deep' ? 'bg-green-900/30 text-green-400' :
                          core.content.contentDepth === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-orange-900/30 text-orange-400'
                        }`}>
                          {core.content.contentDepth}
                        </span>
                      </div>
                    )}

                    {/* Posting Consistency */}
                    {core.content.postingConsistency && (
                      <div className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700/50">
                        <span className="text-xs text-slate-400">Posting Consistency</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          core.content.postingConsistency === 'high' ? 'bg-green-900/30 text-green-400' :
                          core.content.postingConsistency === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-orange-900/30 text-orange-400'
                        }`}>
                          {core.content.postingConsistency}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Digital Footprint Signals */}
              {run.digitalFootprint && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-700 pb-2">
                    Digital Footprint Signals
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Google Business Profile */}
                    <div className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700/50">
                      <span className="text-xs text-slate-400">Google Business Profile</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        run.digitalFootprint.gbp.found
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {run.digitalFootprint.gbp.found ? 'Yes' : 'No'}
                      </span>
                    </div>

                    {/* Reviews */}
                    {run.digitalFootprint.gbp.found && (
                      <div className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700/50">
                        <span className="text-xs text-slate-400">Review Presence</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          run.digitalFootprint.gbp.hasReviews
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-amber-900/30 text-amber-400'
                        }`}>
                          {run.digitalFootprint.gbp.hasReviews ? 'Yes' : 'Unknown'}
                        </span>
                      </div>
                    )}

                    {/* LinkedIn */}
                    <div className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700/50">
                      <span className="text-xs text-slate-400">LinkedIn</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        run.digitalFootprint.linkedin.found
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {run.digitalFootprint.linkedin.found ? 'Yes' : 'No'}
                      </span>
                    </div>

                    {/* Instagram */}
                    <div className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700/50">
                      <span className="text-xs text-slate-400">Instagram</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        run.digitalFootprint.otherSocials.instagram
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {run.digitalFootprint.otherSocials.instagram ? 'Yes' : 'No'}
                      </span>
                    </div>

                    {/* Facebook */}
                    <div className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700/50">
                      <span className="text-xs text-slate-400">Facebook</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        run.digitalFootprint.otherSocials.facebook
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {run.digitalFootprint.otherSocials.facebook ? 'Yes' : 'No'}
                      </span>
                    </div>

                    {/* YouTube */}
                    <div className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700/50">
                      <span className="text-xs text-slate-400">YouTube</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        run.digitalFootprint.otherSocials.youtube
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {run.digitalFootprint.otherSocials.youtube ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>

                  {/* Additional Details (if available) */}
                  {(run.digitalFootprint.gbp.reviewCountBucket !== 'unknown' ||
                    run.digitalFootprint.linkedin.followerBucket !== 'unknown') && (
                    <div className="pt-3 border-t border-slate-700/50 space-y-2">
                      {run.digitalFootprint.gbp.found && run.digitalFootprint.gbp.reviewCountBucket !== 'unknown' && (
                        <div className="text-xs text-slate-400">
                          <span className="font-medium">Reviews:</span> {run.digitalFootprint.gbp.reviewCountBucket}
                          {run.digitalFootprint.gbp.ratingBucket !== 'unknown' && (
                            <span className="ml-2">
                              <span className="font-medium">Rating:</span> {run.digitalFootprint.gbp.ratingBucket}
                            </span>
                          )}
                        </div>
                      )}
                      {run.digitalFootprint.linkedin.found && run.digitalFootprint.linkedin.followerBucket !== 'unknown' && (
                        <div className="text-xs text-slate-400">
                          <span className="font-medium">LinkedIn Followers:</span> {run.digitalFootprint.linkedin.followerBucket}
                          {run.digitalFootprint.linkedin.postingCadence !== 'unknown' && (
                            <span className="ml-2">
                              <span className="font-medium">Posting:</span> {run.digitalFootprint.linkedin.postingCadence}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* SOCIAL & LOCAL PRESENCE (V5 socialFootprint) */}
      {/* ====================================================================== */}
      {run.socialFootprint && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Social & Local Presence
                </h2>
                {run.socialLocalPresenceScore !== undefined && (
                  <span
                    className={`ml-2 rounded px-2 py-1 text-xs font-bold tabular-nums ${
                      run.socialLocalPresenceScore >= 70 ? 'text-green-400' :
                      run.socialLocalPresenceScore >= 50 ? 'text-yellow-400' :
                      'text-orange-400'
                    }`}
                  >
                    {run.socialLocalPresenceScore}/100
                  </span>
                )}
              </div>
            </summary>
            <SocialLocalPresenceCard
              snapshot={run.socialFootprint}
              score={run.socialLocalPresenceScore}
              showDebug={false}
            />
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* COMPETITIVE BENCHMARKING */}
      {/* ====================================================================== */}
      {(() => {
        // Only show if we have businessContext.businessType
        const businessType = run.businessContext?.businessType;
        if (!businessType) return null;

        // Build stack-up comparison data
        const stackup = buildStackupResult(
          {
            brand: brandScore,
            content: contentScore,
            seo: seoScore,
            website: websiteScore,
            digitalFootprint: digitalFootprintScore,
            authority: authorityScore,
          },
          businessType
        );

        // Only render if we have valid comparison data
        if (!stackup.hasData) return null;

        return (
          <section className="space-y-3">
            <details open className="group">
              <summary className="cursor-pointer list-none">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-slate-400 transition-transform group-open:rotate-90">
                    ▶
                  </span>
                  <h2 className="text-xl font-bold text-slate-100">Competitive Benchmarking</h2>
                </div>
              </summary>
              <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/10 p-6 space-y-4">
                {/* Context */}
                <div className="mb-4">
                  <p className="text-sm text-slate-300 mb-2">
                    Compared to <span className="font-semibold text-emerald-400">{stackup.businessTypeLabel}</span>
                  </p>

                  {/* Explainer Callout */}
                  <div className="rounded-lg border-l-4 border-blue-500 bg-blue-900/10 p-4 mt-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-blue-300 mb-1">Reading Benchmarks</h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          These benchmarks compare current scores to typical performance and to top performers in the category. They serve as directional guidance to identify areas that are below average, in line with peers, or close to category leaders.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-2 text-slate-400 font-semibold">Dimension</th>
                        <th className="text-right py-2 px-2 text-slate-400 font-semibold">Current</th>
                        <th className="text-right py-2 px-2 text-slate-400 font-semibold">Typical</th>
                        <th className="text-right py-2 px-2 text-slate-400 font-semibold">Category Leaders</th>
                        <th className="text-left py-2 px-2 text-slate-400 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stackup.rows.map((row) => (
                        <tr key={row.dimensionId} className="border-b border-slate-800 last:border-none">
                          <td className="py-3 px-2 text-slate-200">{row.dimensionLabel}</td>
                          <td className="py-3 px-2 text-right">
                            <span className="font-semibold text-emerald-400">{row.you}</span>
                          </td>
                          <td className="py-3 px-2 text-right text-slate-300">{row.avg}</td>
                          <td className="py-3 px-2 text-right text-slate-300">{row.leader}</td>
                          <td className="py-3 px-2">
                            <span
                              className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                                row.relativeLabel === 'below'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : row.relativeLabel === 'average'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : row.relativeLabel === 'strong'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-emerald-500/30 text-emerald-300'
                              }`}
                            >
                              {row.relativeLabelText}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Visual Progress Bars (Optional Enhancement) */}
                <div className="mt-6 space-y-3">
                  {stackup.rows.map((row) => {
                    const percentage = Math.min(100, row.you);
                    const avgPercentage = Math.min(100, row.avg);
                    const leaderPercentage = Math.min(100, row.leader);

                    return (
                      <div key={`bar-${row.dimensionId}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">{row.dimensionLabel}</span>
                          <span className="text-slate-500">
                            <span className="text-emerald-400 font-semibold">{row.you}</span>
                            {' / '}
                            <span className="text-slate-400">{row.leader}</span>
                          </span>
                        </div>
                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                          {/* Current score */}
                          <div
                            className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                          {/* Average marker */}
                          <div
                            className="absolute top-0 h-full w-0.5 bg-blue-400/50"
                            style={{ left: `${avgPercentage}%` }}
                            title={`Typical: ${row.avg}`}
                          />
                          {/* Leader marker */}
                          <div
                            className="absolute top-0 h-full w-0.5 bg-yellow-400/50"
                            style={{ left: `${leaderPercentage}%` }}
                            title={`Category Leaders: ${row.leader}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span>Current</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-0.5 h-3 bg-blue-400/50" />
                    <span>Typical</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-0.5 h-3 bg-yellow-400/50" />
                    <span>Category Leaders</span>
                  </div>
                </div>
              </div>
            </details>
          </section>
        );
      })()}

      {/* ====================================================================== */}
      {/* BRAND & POSITIONING */}
      {/* ====================================================================== */}
      {(dimensions?.brand || core?.brand || insights?.brandInsights) && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Brand & Positioning
                </h2>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Assessment</h3>
                <span className="text-base font-normal text-slate-400">
                  {Math.round(brandScore)}/100
                </span>
              </div>

              {/* V2 Enhanced - One-liner Summary */}
              {dimensions?.brand?.oneLiner && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Summary
                  </h4>
                  <p className="text-sm font-medium text-slate-200">
                    {dimensions.brand.oneLiner}
                  </p>
                </div>
              )}

              {/* V2 Enhanced - Narrative (Detailed Analysis) */}
              {dimensions?.brand?.narrative && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Detailed Analysis
                  </h4>
                  <div className="text-sm leading-relaxed text-slate-300 space-y-3 whitespace-pre-line">
                    {dimensions.brand.narrative}
                  </div>
                </div>
              )}

              {/* V2 Enhanced - Structured Issues */}
              {dimensions?.brand?.issues && dimensions.brand.issues.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Issues
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {dimensions.brand.issues.map((issue, idx) => (
                      <li key={idx}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* V1 Fallback - Perceived Positioning */}
              {!dimensions?.brand?.oneLiner && core?.brand?.perceivedPositioning && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Perceived Positioning
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {core.brand.perceivedPositioning}
                  </p>
                </div>
              )}

              {/* V1 Fallback - Insights */}
              {!dimensions?.brand?.issues && insights?.brandInsights && insights.brandInsights.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Findings
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {insights.brandInsights.map((insight, idx) => (
                      <li key={idx}>• {insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* CONTENT & MESSAGING */}
      {/* ====================================================================== */}
      {(dimensions?.content || core?.content || insights?.contentInsights) && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Content & Messaging
                </h2>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Assessment</h3>
                <span className="text-base font-normal text-slate-400">
                  {Math.round(contentScore)}/100
                </span>
              </div>

              {/* V2 Enhanced - One-liner Summary */}
              {dimensions?.content?.oneLiner && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Summary
                  </h4>
                  <p className="text-sm font-medium text-slate-200">
                    {dimensions.content.oneLiner}
                  </p>
                </div>
              )}

              {/* V2 Enhanced - Narrative (Detailed Analysis) */}
              {dimensions?.content?.narrative && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Detailed Analysis
                  </h4>
                  <div className="text-sm leading-relaxed text-slate-300 space-y-3 whitespace-pre-line">
                    {dimensions.content.narrative}
                  </div>
                </div>
              )}

              {/* V2 Enhanced - Structured Issues */}
              {dimensions?.content?.issues && dimensions.content.issues.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Issues
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {dimensions.content.issues.map((issue, idx) => (
                      <li key={idx}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* V1 Fallback - Content Focus */}
              {!dimensions?.content?.oneLiner && core?.content?.contentFocus && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Content Focus
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {core.content.contentFocus}
                  </p>
                </div>
              )}

              {/* V1 Fallback - Insights */}
              {!dimensions?.content?.issues && insights?.contentInsights && insights.contentInsights.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Findings
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {insights.contentInsights.map((insight, idx) => (
                      <li key={idx}>• {insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* SEO & VISIBILITY */}
      {/* ====================================================================== */}
      {(dimensions?.seo || core?.seo || insights?.seoInsights) && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  SEO & Visibility
                </h2>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Assessment</h3>
                <span className="text-base font-normal text-slate-400">
                  {Math.round(seoScore)}/100
                </span>
              </div>

              {/* V2 Enhanced - One-liner Summary */}
              {dimensions?.seo?.oneLiner && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Summary
                  </h4>
                  <p className="text-sm font-medium text-slate-200">
                    {dimensions.seo.oneLiner}
                  </p>
                </div>
              )}

              {/* V2 Enhanced - Narrative (Detailed Analysis) */}
              {dimensions?.seo?.narrative && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Detailed Analysis
                  </h4>
                  <div className="text-sm leading-relaxed text-slate-300 space-y-3 whitespace-pre-line">
                    {dimensions.seo.narrative}
                  </div>
                </div>
              )}

              {/* V2 Enhanced - Structured Issues */}
              {dimensions?.seo?.issues && dimensions.seo.issues.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Issues
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {dimensions.seo.issues.map((issue, idx) => (
                      <li key={idx}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* V1 Fallback - On-Page Basics */}
              {!dimensions?.seo?.oneLiner && core?.seo?.onPageBasics && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    On-Page Basics
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {core.seo.onPageBasics}
                  </p>
                </div>
              )}

              {/* V1 Fallback - Insights */}
              {!dimensions?.seo?.issues && insights?.seoInsights && insights.seoInsights.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Findings
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {insights.seoInsights.map((insight, idx) => (
                      <li key={idx}>• {insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* WEBSITE & CONVERSION */}
      {/* ====================================================================== */}
      {(dimensions?.website || core?.website || insights?.websiteInsights) && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Website & Conversion
                </h2>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Assessment</h3>
                <span className="text-base font-normal text-slate-400">
                  {Math.round(websiteScore)}/100
                </span>
              </div>

              {/* V2 Enhanced - One-liner Summary */}
              {dimensions?.website?.oneLiner && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Summary
                  </h4>
                  <p className="text-sm font-medium text-slate-200">
                    {dimensions.website.oneLiner}
                  </p>
                </div>
              )}

              {/* V2 Enhanced - Narrative (Detailed Analysis) */}
              {dimensions?.website?.narrative && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Detailed Analysis
                  </h4>
                  <div className="text-sm leading-relaxed text-slate-300 space-y-3 whitespace-pre-line">
                    {dimensions.website.narrative}
                  </div>
                </div>
              )}

              {/* V2 Enhanced - Structured Issues */}
              {dimensions?.website?.issues && dimensions.website.issues.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Issues
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {dimensions.website.issues.map((issue, idx) => (
                      <li key={idx}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* V1 Fallback - Message Clarity */}
              {!dimensions?.website?.oneLiner && core?.website?.clarityOfMessage && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Message Clarity
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {core.website.clarityOfMessage}
                  </p>
                </div>
              )}

              {/* V1 Fallback - Insights */}
              {!dimensions?.website?.issues && insights?.websiteInsights && insights.websiteInsights.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Findings
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {insights.websiteInsights.map((insight, idx) => (
                      <li key={idx}>• {insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* DIGITAL FOOTPRINT & AUTHORITY */}
      {/* ====================================================================== */}
      {(dimensions?.digitalFootprint || (core as any)?.digitalFootprint) && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Digital Footprint
                </h2>
                <span
                  className={`ml-2 rounded px-2 py-1 text-xs font-bold tabular-nums ${getScoreColor(
                    digitalFootprintScore
                  )}`}
                >
                  {Math.round(digitalFootprintScore)}/100
                </span>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Assessment</h3>
                <span className="text-base font-normal text-slate-400">
                  {Math.round(digitalFootprintScore)}/100
                </span>
              </div>

              {/* V2 Enhanced - One-liner Summary */}
              {dimensions?.digitalFootprint?.oneLiner && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Summary
                  </h4>
                  <p className="text-sm font-medium text-slate-200">
                    {dimensions.digitalFootprint.oneLiner}
                  </p>
                </div>
              )}

              {/* V2 Enhanced - Structured Issues */}
              {dimensions?.digitalFootprint?.issues && dimensions.digitalFootprint.issues.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Issues
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {dimensions.digitalFootprint.issues.map((issue, idx) => (
                      <li key={idx}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* V1 Fallback - Show if no V2 data */}
              {!dimensions?.digitalFootprint && (core as any)?.digitalFootprint && (
                <div>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {digitalFootprintScore >= 70
                      ? 'The brand has a strong digital presence across multiple channels with good visibility, reviews, and authority signals.'
                      : digitalFootprintScore >= 50
                      ? 'The brand has established some digital presence, but there are opportunities to expand reach and strengthen authority across key channels.'
                      : 'The digital ecosystem presence is minimal or missing. Building a comprehensive digital footprint across Google Business Profile, LinkedIn, social media, and review platforms should be a top priority.'}
                  </p>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* AUTHORITY & TRUST */}
      {/* ====================================================================== */}
      {dimensions?.authority && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Authority & Trust
                </h2>
                <span
                  className={`ml-2 rounded px-2 py-1 text-xs font-bold tabular-nums ${getScoreColor(
                    authorityScore
                  )}`}
                >
                  {Math.round(authorityScore)}/100
                </span>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Assessment</h3>
                <span className="text-base font-normal text-slate-400">
                  {Math.round(authorityScore)}/100
                </span>
              </div>

              {/* V2 Enhanced - One-liner Summary */}
              {dimensions?.authority?.oneLiner && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Summary
                  </h4>
                  <p className="text-sm font-medium text-slate-200">
                    {dimensions.authority.oneLiner}
                  </p>
                </div>
              )}

              {/* V2 Enhanced - Issues/Gaps */}
              {dimensions?.authority?.issues && dimensions.authority.issues.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Issues
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {dimensions.authority.issues.map((issue, idx) => (
                      <li key={idx}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* BREAKDOWN (V2) */}
      {/* ====================================================================== */}
      {breakdown?.bullets && breakdown.bullets.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">Key Findings</h2>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-3">
              {/* Explainer */}
              <div className="rounded-lg border-l-4 border-blue-500 bg-blue-900/10 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-blue-300 mb-1">Cross-Cutting Themes</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      These are the most important issues that show up across multiple parts of the marketing system. They can be used to frame the next 60–90 days of work.
                    </p>
                  </div>
                </div>
              </div>

              {breakdown.bullets.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-slate-600/50 bg-slate-800/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {item.category}
                        </span>
                        {item.impactLevel && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-900/30 text-amber-400 font-medium">
                            {item.impactLevel}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-slate-200">
                        {item.statement}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* 90-DAY FOCUS THEME */}
      {/* ====================================================================== */}
      {insights?.recommendedNextStep && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  90-Day Focus
                </h2>
              </div>
            </summary>
            <div className="rounded-lg border-l-4 border-amber-500 bg-amber-900/10 p-6">
              <p className="text-sm leading-relaxed text-slate-300">
                {insights.recommendedNextStep}
              </p>
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* ASSESSMENT SCOPE & METHODOLOGY */}
      {/* ====================================================================== */}
      <section className="space-y-3">
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-slate-400 transition-transform group-open:rotate-90">
                ▶
              </span>
              <h2 className="text-xl font-bold text-slate-100">
                Assessment Scope & Methodology
              </h2>
            </div>
          </summary>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-6">
            {/* Data Confidence Summary */}
            {run.dataConfidence && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                    run.dataConfidence.level === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
                    run.dataConfidence.level === 'medium' ? 'bg-cyan-500/20 text-cyan-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {run.dataConfidence.level} confidence
                  </span>
                  <span className="text-sm text-slate-400">
                    Data Confidence: <span className="font-semibold text-slate-200">{run.dataConfidence.score}/100</span>
                  </span>
                </div>
                <p className="text-sm text-slate-300">{run.dataConfidence.reason}</p>
                {run.dataConfidence.issues && run.dataConfidence.issues.length > 0 && (
                  <ul className="space-y-1">
                    {run.dataConfidence.issues.map((issue, idx) => (
                      <li key={idx} className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="text-amber-400">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* What Was Analyzed */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-700 pb-2">
                What This Assessment Analyzed
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Website</p>
                  <p className="text-sm text-slate-200">Homepage + discovered pages</p>
                </div>
                {run.digitalFootprint && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">External Profiles Checked</p>
                    <div className="flex flex-wrap gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        run.digitalFootprint.gbp.found ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}>GBP</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        run.digitalFootprint.linkedin.found ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}>LinkedIn</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        run.digitalFootprint.otherSocials.instagram ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}>Instagram</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        run.digitalFootprint.otherSocials.facebook ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}>Facebook</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        run.digitalFootprint.otherSocials.youtube ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}>YouTube</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Engine Info */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-700">
              <span>Engine: GAP-IA v3</span>
              <span>Generated: {new Date(run.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
              })}</span>
            </div>
          </div>
        </details>
      </section>

      {/* ====================================================================== */}
      {/* HOW THIS ASSESSMENT WAS GENERATED */}
      {/* ====================================================================== */}
      <section className="space-y-3">
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-300">How this assessment was generated:</span> This report was created by analyzing the website, digital footprint, and business context using AI-driven marketing analysis. Scores and recommendations are based on industry best practices, competitive benchmarks, and pattern recognition across thousands of similar businesses.
          </p>
        </div>
      </section>

      {/* ====================================================================== */}
      {/* FULL GAP CTA */}
      {/* ====================================================================== */}
      <section className="space-y-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-100 mb-2">
                  Want the Full Strategic Plan?
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Get a detailed 90-day roadmap with prioritized actions, benchmarks, and strategic guidance tailored to the current marketing maturity level.
                </p>

                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-700">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  {run.gapFullReportId ? (
                    <a
                      href={`/growth-acceleration-plan/report/${run.gapFullReportId}`}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-semibold rounded-lg transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View Full Report
                    </a>
                  ) : (
                    <button
                      onClick={handleGenerateFullGap}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-semibold rounded-lg transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate Full Report
                    </button>
                  )}
                </div>
              </div>
            </div>
        </div>
      </section>
    </div>
  );
}
