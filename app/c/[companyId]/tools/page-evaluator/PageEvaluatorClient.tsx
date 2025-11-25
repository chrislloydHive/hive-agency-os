'use client';

import { useState } from 'react';
import type { PageEvaluationResult } from '@/lib/gap-heavy/types';

interface PageEvaluatorClientProps {
  companyId: string;
  defaultUrl: string;
}

export function PageEvaluatorClient({
  companyId,
  defaultUrl,
}: PageEvaluatorClientProps) {
  const [pageUrl, setPageUrl] = useState(defaultUrl);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<PageEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    if (!pageUrl.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setIsEvaluating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/tools/page-evaluator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          pageUrl: pageUrl.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Evaluation failed');
      }

      setResult(data.result);
    } catch (err) {
      console.error('[PageEvaluator] Error:', err);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't evaluate this page. Please check the URL and try again."
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isEvaluating) {
      handleEvaluate();
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Evaluate a Page
          </h2>
          <p className="text-xs text-slate-500">
            Enter a URL to analyze content quality, UX, and conversion optimization
          </p>
        </div>

        <div className="flex gap-3">
          <input
            type="url"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com/page"
            disabled={isEvaluating}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
          />
          <button
            onClick={handleEvaluate}
            disabled={isEvaluating || !pageUrl.trim()}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isEvaluating ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Evaluating...
              </>
            ) : (
              'Evaluate Page'
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-5">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-300 mb-1">
                Evaluation Failed
              </h3>
              <p className="text-sm text-red-400/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <>
          {/* Scores */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
              Scores
            </h2>

            {/* Overall Score - Large Display */}
            <div className="mb-6 rounded-xl border border-slate-700/50 bg-[#050509]/50 p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Overall Score
              </p>
              <p className="text-5xl font-bold tabular-nums text-slate-100">
                {result.overallScore}
              </p>
              <p className="text-xs text-slate-500 mt-1">out of 100</p>
            </div>

            {/* Individual Scores - Progress Bars */}
            <div className="space-y-4">
              <ScoreBar
                label="Content Quality"
                score={result.contentScore}
                description="Clarity, relevance, comprehensiveness"
              />
              <ScoreBar
                label="User Experience"
                score={result.uxScore}
                description="Navigation, readability, accessibility"
              />
              <ScoreBar
                label="Conversion Optimization"
                score={result.conversionScore}
                description="CTAs, forms, trust signals"
              />
            </div>
          </div>

          {/* Page Metadata */}
          {(result.pageTitle || result.h1 || result.raw?.primaryCtaText) && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
                Page Information
              </h2>
              <div className="space-y-3">
                {result.pageTitle && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                      Page Title
                    </p>
                    <p className="text-sm text-slate-200">{result.pageTitle}</p>
                  </div>
                )}
                {result.h1 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                      H1 Heading
                    </p>
                    <p className="text-sm text-slate-200">{result.h1}</p>
                  </div>
                )}
                {result.raw?.primaryCtaText && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                      Primary CTA
                    </p>
                    <p className="text-sm text-slate-200">
                      {result.raw.primaryCtaText}
                    </p>
                  </div>
                )}
                {result.raw?.wordCount !== undefined && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                      Word Count
                    </p>
                    <p className="text-sm text-slate-200 tabular-nums">
                      {result.raw.wordCount.toLocaleString()} words
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Diagnostics - 3 Sections */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Content Diagnostics */}
            <DiagnosticSection
              title="Content"
              issues={result.contentIssues}
              recommendations={result.contentRecommendations}
              color="blue"
            />

            {/* UX Diagnostics */}
            <DiagnosticSection
              title="User Experience"
              issues={result.uxIssues}
              recommendations={result.uxRecommendations}
              color="purple"
            />

            {/* Conversion Diagnostics */}
            <DiagnosticSection
              title="Conversion"
              issues={result.conversionIssues}
              recommendations={result.conversionRecommendations}
              color="emerald"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Score Bar Component
// ============================================================================

interface ScoreBarProps {
  label: string;
  score: number;
  description?: string;
}

function ScoreBar({ label, score, description }: ScoreBarProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-slate-200">{label}</p>
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
        <p
          className={`text-lg font-semibold tabular-nums ${getScoreTextColor(
            score
          )}`}
        >
          {score}
        </p>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${getScoreColor(
            score
          )}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Diagnostic Section Component
// ============================================================================

interface DiagnosticSectionProps {
  title: string;
  issues: string[];
  recommendations: string[];
  color: 'blue' | 'purple' | 'emerald';
}

function DiagnosticSection({
  title,
  issues,
  recommendations,
  color,
}: DiagnosticSectionProps) {
  const colorClasses = {
    blue: {
      border: 'border-blue-900/50',
      bg: 'bg-blue-950/30',
      text: 'text-blue-400',
      dot: 'bg-blue-500',
    },
    purple: {
      border: 'border-purple-900/50',
      bg: 'bg-purple-950/30',
      text: 'text-purple-400',
      dot: 'bg-purple-500',
    },
    emerald: {
      border: 'border-emerald-900/50',
      bg: 'bg-emerald-950/30',
      text: 'text-emerald-400',
      dot: 'bg-emerald-500',
    },
  };

  const colors = colorClasses[color];

  const hasIssues = issues.length > 0;
  const hasRecommendations = recommendations.length > 0;

  return (
    <div
      className={`rounded-2xl border ${colors.border} ${colors.bg} p-5 h-full flex flex-col`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
        <h3
          className={`text-sm font-semibold uppercase tracking-wide ${colors.text}`}
        >
          {title}
        </h3>
      </div>

      <div className="space-y-4 flex-1">
        {/* Issues */}
        {hasIssues ? (
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Issues</p>
            <ul className="space-y-2">
              {issues.map((issue, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs">
                  <span className="text-red-400 flex-shrink-0 mt-0.5">⚠</span>
                  <span className="text-slate-300 leading-relaxed">
                    {issue}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Issues</p>
            <p className="text-xs text-slate-500 italic">
              No issues detected
            </p>
          </div>
        )}

        {/* Recommendations */}
        {hasRecommendations ? (
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">
              Recommendations
            </p>
            <ul className="space-y-2">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs">
                  <span className="text-emerald-400 flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span className="text-slate-300 leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">
              Recommendations
            </p>
            <p className="text-xs text-slate-500 italic">
              No recommendations
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
