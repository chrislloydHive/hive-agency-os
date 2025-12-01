// app/c/[companyId]/diagnostics/brand/BrandNarrativeTab.tsx
// Brand Narrative Tab - Consultant-style report view

'use client';

import { useState, useEffect } from 'react';
import type { BrandNarrativeReport } from '@/lib/gap-heavy/modules/brandLab';

type Props = {
  companyId: string;
  initialNarrative?: BrandNarrativeReport | null;
};

export function BrandNarrativeTab({ companyId, initialNarrative }: Props) {
  const [narrative, setNarrative] = useState<BrandNarrativeReport | null>(initialNarrative || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/brand-lab/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate narrative');
      }

      setNarrative(data.narrative);
    } catch (err) {
      console.error('Narrative generation error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // If no narrative exists, show generation prompt
  if (!narrative && !isLoading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-8 text-center">
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-200 mb-2">
          No Narrative Report Yet
        </h3>
        <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
          Generate a consultant-style narrative report from your Brand Lab results.
          This creates a detailed, long-form analysis of brand health, positioning,
          and strategic recommendations.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          className="rounded-lg bg-blue-500/20 px-6 py-3 text-sm font-medium text-blue-300 transition-all hover:bg-blue-500/30 border border-blue-500/50"
        >
          Generate Narrative Report
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-blue-500"></div>
          <span className="text-sm font-medium text-slate-300">
            Generating narrative report...
          </span>
        </div>
        <p className="text-xs text-slate-400">
          This may take 30-60 seconds...
        </p>
      </div>
    );
  }

  // Narrative exists - render it
  if (!narrative) return null;

  return (
    <div className="space-y-8">
      {/* Meta Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Brand Narrative Report</h2>
          <p className="text-sm text-slate-400">
            Generated: {new Date(narrative.meta.generatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-slate-100">
            {narrative.meta.brandScore}/100
          </span>
          <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">
            {narrative.meta.benchmarkLabel}
          </span>
        </div>
      </div>

      {/* Executive Summary */}
      <NarrativeSection
        title="Executive Summary"
        content={narrative.executiveSummary}
        highlight
      />

      {/* Main Sections */}
      <div className="grid gap-6">
        <NarrativeSection title="Brand Story" content={narrative.brandStorySection} />
        <NarrativeSection title="Positioning" content={narrative.positioningSection} />
        <NarrativeSection title="Messaging" content={narrative.messagingSection} />
        <NarrativeSection title="Trust & Credibility" content={narrative.trustSection} />
        <NarrativeSection title="Visual Brand" content={narrative.visualSection} />
        <NarrativeSection title="Audience Fit" content={narrative.audienceFitSection} />
      </div>

      {/* Priority Themes */}
      <NarrativeSection title="Priority Themes" content={narrative.priorityThemesSection} />

      {/* Quick Wins & Strategic Initiatives */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-5">
          <h3 className="text-sm font-semibold text-green-300 mb-3">Quick Wins</h3>
          <ul className="space-y-2">
            {narrative.quickWinsBullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-green-400 mt-0.5">+</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-5">
          <h3 className="text-sm font-semibold text-blue-300 mb-3">Strategic Initiatives</h3>
          <ul className="space-y-2">
            {narrative.strategicInitiativesBullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-blue-400 mt-0.5">*</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Risks */}
      <NarrativeSection
        title="Risks"
        content={narrative.risksSection}
        warning
      />

      {/* Sequencing */}
      <NarrativeSection
        title="Recommended Sequencing"
        content={narrative.recommendedSequencingSection}
      />

      {/* Dev: Raw JSON */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="mt-8">
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-xs text-slate-500 hover:text-slate-400"
          >
            {showRawJson ? 'Hide' : 'Show'} Raw JSON (Dev)
          </button>
          {showRawJson && (
            <pre className="mt-2 rounded-lg bg-slate-800 p-4 text-xs text-slate-300 overflow-auto max-h-[400px]">
              {JSON.stringify(narrative, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Regenerate Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="text-sm text-slate-400 hover:text-slate-300 disabled:opacity-50"
        >
          Regenerate Report
        </button>
      </div>
    </div>
  );
}

// Helper component for narrative sections
function NarrativeSection({
  title,
  content,
  highlight,
  warning
}: {
  title: string;
  content: string;
  highlight?: boolean;
  warning?: boolean;
}) {
  const borderClass = warning
    ? 'border-orange-500/30 bg-orange-500/5'
    : highlight
    ? 'border-blue-500/30 bg-blue-500/5'
    : 'border-slate-700 bg-slate-900/30';

  return (
    <div className={`rounded-lg border p-5 ${borderClass}`}>
      <h3 className="text-sm font-semibold text-slate-300 mb-3">{title}</h3>
      <div className="prose prose-sm prose-invert max-w-none">
        <p className="whitespace-pre-line text-sm text-slate-400 leading-relaxed">
          {content}
        </p>
      </div>
    </div>
  );
}
