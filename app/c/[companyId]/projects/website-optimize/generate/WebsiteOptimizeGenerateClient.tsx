'use client';

// app/c/[companyId]/projects/website-optimize/generate/WebsiteOptimizeGenerateClient.tsx
// Website Optimization Generation Client Component
//
// Handles the generation flow and displays results.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  Search,
  Layout,
  FileText,
  Settings,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import type { FlowReadiness } from '@/lib/os/flow/readiness.shared';
import { LowConfidenceBadge } from '@/components/flows/LowConfidenceBadge';
import type {
  WebsiteOptimizationOutput,
  WebsiteOptimizationRecommendation,
  GenerateWebsiteOptimizationResponse,
} from '@/app/api/os/companies/[companyId]/projects/website-optimize/generate/route';

interface WebsiteOptimizeGenerateClientProps {
  companyId: string;
  companyName: string;
  hasContextGraph: boolean;
  initialReadiness: FlowReadiness | null;
}

type GenerationState = 'idle' | 'generating' | 'complete' | 'error';

export function WebsiteOptimizeGenerateClient({
  companyId,
  companyName,
  hasContextGraph,
  initialReadiness,
}: WebsiteOptimizeGenerateClientProps) {
  const [state, setState] = useState<GenerationState>('idle');
  const [output, setOutput] = useState<WebsiteOptimizationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingDomainsAtGeneration, setMissingDomainsAtGeneration] = useState<string[]>([]);

  // Auto-generate on mount if we have context
  useEffect(() => {
    if (hasContextGraph && state === 'idle') {
      handleGenerate();
    }
  }, [hasContextGraph]);

  const handleGenerate = useCallback(async () => {
    setState('generating');
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/projects/website-optimize/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acknowledgedMissingDomains: true,
          proceedReason: 'website_optimization_flow',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate recommendations');
      }

      const data: GenerateWebsiteOptimizationResponse = await response.json();
      setOutput(data.output);
      setMissingDomainsAtGeneration(data.missingDomainsAtGeneration || []);
      setState('complete');
    } catch (err) {
      console.error('[WebsiteOptimizeGenerate] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations');
      setState('error');
    }
  }, [companyId]);

  // No context graph
  if (!hasContextGraph) {
    return (
      <div className="space-y-6">
        <BackButton companyId={companyId} />

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            No Context Data Found
          </h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Cannot generate website optimization recommendations without existing context data.
          </p>
          <Link
            href={`/c/${companyId}`}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-colors inline-block"
          >
            Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton companyId={companyId} />

      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                <Globe className="w-7 h-7 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  Website Optimization Recommendations
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {companyName}
                </p>
              </div>
            </div>

            {state === 'complete' && (
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            )}
          </div>
        </div>

        {/* Low confidence warning */}
        {missingDomainsAtGeneration.length > 0 && state === 'complete' && (
          <div className="p-4 border-b border-slate-800">
            <LowConfidenceBadge
              missingDomains={missingDomainsAtGeneration}
              variant="block"
            />
          </div>
        )}

        {/* Generation States */}
        <div className="p-6">
          {state === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
              <p className="text-lg text-white font-medium mb-2">
                Analyzing your context...
              </p>
              <p className="text-sm text-slate-400">
                Generating website optimization recommendations
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-lg text-white font-medium mb-2">
                Generation Failed
              </p>
              <p className="text-sm text-slate-400 mb-4">
                {error}
              </p>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {state === 'complete' && output && (
            <RecommendationsDisplay output={output} companyId={companyId} />
          )}
        </div>
      </div>
    </div>
  );
}

// Back button component
function BackButton({ companyId }: { companyId: string }) {
  return (
    <Link
      href={`/c/${companyId}/projects/website-optimize/setup`}
      className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Setup
    </Link>
  );
}

// Recommendations display component
function RecommendationsDisplay({
  output,
  companyId,
}: {
  output: WebsiteOptimizationOutput;
  companyId: string;
}) {
  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Executive Summary
        </h2>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-slate-200 leading-relaxed">
            {output.executiveSummary}
          </p>
        </div>
      </div>

      {/* Current State Analysis */}
      {output.currentStateAnalysis && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
            Current State Analysis
          </h2>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-slate-300 leading-relaxed">
              {output.currentStateAnalysis}
            </p>
          </div>
        </div>
      )}

      {/* Priority Matrix */}
      {output.priorityMatrix && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
            Priority Matrix
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <PriorityQuadrant
              title="Quick Wins"
              subtitle="High Impact, Low Effort"
              items={output.priorityMatrix.quickWins}
              variant="success"
            />
            <PriorityQuadrant
              title="Major Projects"
              subtitle="High Impact, High Effort"
              items={output.priorityMatrix.majorProjects}
              variant="warning"
            />
            <PriorityQuadrant
              title="Fill-Ins"
              subtitle="Low Impact, Low Effort"
              items={output.priorityMatrix.fillIns}
              variant="neutral"
            />
            <PriorityQuadrant
              title="Thankless Tasks"
              subtitle="Low Impact, High Effort"
              items={output.priorityMatrix.thankless}
              variant="danger"
            />
          </div>
        </div>
      )}

      {/* Recommendations */}
      {output.recommendations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
            Recommendations ({output.recommendations.length})
          </h2>
          <div className="space-y-3">
            {output.recommendations.map((rec, idx) => (
              <RecommendationCard key={idx} recommendation={rec} />
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {output.nextSteps.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
            Recommended Next Steps
          </h2>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <ol className="space-y-2">
              {output.nextSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </span>
                  <span className="text-slate-300 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Assumptions & Missing Context */}
      <div className="grid grid-cols-2 gap-4">
        {output.assumptions.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Assumptions
            </h2>
            <ul className="space-y-1.5">
              {output.assumptions.map((assumption, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-slate-600 mt-1">-</span>
                  {assumption}
                </li>
              ))}
            </ul>
          </div>
        )}

        {output.missingContext.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-3">
              Missing Context
            </h2>
            <ul className="space-y-1.5">
              {output.missingContext.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-amber-300/70">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
        <Link
          href={`/c/${companyId}/context`}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
        >
          View Full Context
        </Link>
        <Link
          href={`/c/${companyId}`}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white transition-all"
        >
          Back to Overview
        </Link>
      </div>
    </div>
  );
}

// Priority quadrant component
function PriorityQuadrant({
  title,
  subtitle,
  items,
  variant,
}: {
  title: string;
  subtitle: string;
  items: string[];
  variant: 'success' | 'warning' | 'neutral' | 'danger';
}) {
  const variantStyles = {
    success: 'bg-emerald-500/10 border-emerald-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
    neutral: 'bg-slate-700/30 border-slate-600/30',
    danger: 'bg-red-500/10 border-red-500/30',
  };

  const titleStyles = {
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    neutral: 'text-slate-400',
    danger: 'text-red-400',
  };

  return (
    <div className={`rounded-lg border p-4 ${variantStyles[variant]}`}>
      <h3 className={`text-sm font-medium ${titleStyles[variant]} mb-1`}>
        {title}
      </h3>
      <p className="text-xs text-slate-500 mb-3">{subtitle}</p>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500 italic">None identified</p>
      )}
    </div>
  );
}

// Recommendation card component
function RecommendationCard({
  recommendation,
}: {
  recommendation: WebsiteOptimizationRecommendation;
}) {
  const categoryConfig = {
    quick_win: { icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    conversion: { icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    seo: { icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    ux: { icon: Layout, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    content: { icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    technical: { icon: Settings, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  };

  const config = categoryConfig[recommendation.category] || categoryConfig.quick_win;
  const Icon = config.icon;

  const impactColor = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-slate-400',
  };

  const effortColor = {
    high: 'text-red-400',
    medium: 'text-amber-400',
    low: 'text-emerald-400',
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-4">
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-white font-medium">
              {recommendation.title}
            </h3>
            <span className={`text-xs uppercase tracking-wider ${config.color}`}>
              {recommendation.category.replace('_', ' ')}
            </span>
          </div>

          <p className="text-sm text-slate-400 mb-3">
            {recommendation.description}
          </p>

          <div className="flex items-center gap-4 text-xs">
            <span className={impactColor[recommendation.impact]}>
              Impact: {recommendation.impact}
            </span>
            <span className={effortColor[recommendation.effort]}>
              Effort: {recommendation.effort}
            </span>
          </div>

          {recommendation.rationale && (
            <p className="text-xs text-slate-500 mt-2 italic">
              {recommendation.rationale}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
