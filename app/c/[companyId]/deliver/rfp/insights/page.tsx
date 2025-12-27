'use client';

// app/c/[companyId]/deliver/rfp/insights/page.tsx
// RFP Outcome Insights Page
//
// Internal page that shows correlation analysis between bid readiness signals
// and RFP outcomes (won/lost).

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Target,
  Shield,
  Gauge,
} from 'lucide-react';
import type { OutcomeAnalysisResult, OutcomeInsight, LossReasonAnalysis } from '@/lib/os/rfp/analyzeOutcomes';

// ============================================================================
// Types
// ============================================================================

interface AnalysisResponse {
  analysis: OutcomeAnalysisResult;
  topInsights: OutcomeInsight[];
  isPredictive: boolean;
  summary: string;
  insightsByCategory: {
    score_threshold: OutcomeInsight[];
    recommendation: OutcomeInsight[];
    acknowledgement: OutcomeInsight[];
    risk: OutcomeInsight[];
  };
  meta: {
    totalRfps: number;
    analyzedRfps: number;
    completeRecords: number;
  };
}

// ============================================================================
// Sub-components
// ============================================================================

function ConfidenceBadge({ confidence }: { confidence: 'low' | 'medium' | 'high' }) {
  const styles = {
    low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${styles[confidence]}`}>
      {confidence} confidence
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 5) {
    return (
      <span className="flex items-center gap-1 text-emerald-400">
        <TrendingUp className="w-4 h-4" />
        +{delta}%
      </span>
    );
  } else if (delta < -5) {
    return (
      <span className="flex items-center gap-1 text-red-400">
        <TrendingDown className="w-4 h-4" />
        {delta}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-slate-400">
      <Minus className="w-4 h-4" />
      {delta > 0 ? '+' : ''}{delta}%
    </span>
  );
}

function InsightCard({ insight }: { insight: OutcomeInsight }) {
  return (
    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-slate-200">{insight.signal}</span>
            <ConfidenceBadge confidence={insight.confidence} />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <DeltaBadge delta={insight.winRateDelta} />
            <span className="text-slate-500">
              {insight.sampleSize} RFPs
            </span>
          </div>
          {insight.recommendation && (
            <p className="mt-2 text-sm text-slate-400">{insight.recommendation}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  title,
  icon: Icon,
  insights,
  defaultExpanded = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  insights: OutcomeInsight[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (insights.length === 0) return null;

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-purple-400" />
          <span className="font-medium text-slate-200">{title}</span>
          <span className="text-sm text-slate-500">({insights.length})</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="p-4 space-y-3 bg-slate-900/50">
          {insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

function LossReasonCard({ reason }: { reason: LossReasonAnalysis }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-slate-200 capitalize">{reason.reason}</span>
        <span className="text-sm text-slate-500">
          avg score: {reason.avgReadinessScore}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-red-400 font-medium">{reason.count}</span>
        <span className="text-sm text-slate-500">({reason.percentage}%)</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="w-12 h-12 text-slate-600 mb-4" />
      <h3 className="text-lg font-medium text-slate-300 mb-2">
        Not Enough Data Yet
      </h3>
      <p className="text-slate-500 max-w-md">
        Complete more RFPs with outcomes (won/lost) to unlock outcome correlation insights.
        We need at least 5 completed RFPs to generate meaningful analysis.
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function RfpInsightsPage() {
  const params = useParams();
  const companyId = params.companyId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisResponse | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/rfps/outcomes`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch analysis');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysis();
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-8">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-slate-200 mb-2">Analysis Error</h2>
        <p className="text-slate-400">{error}</p>
        <Link
          href={`/c/${companyId}/deliver/rfp`}
          className="mt-4 text-purple-400 hover:text-purple-300"
        >
          Back to RFPs
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { analysis, topInsights, isPredictive, summary, insightsByCategory, meta } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link
            href={`/c/${companyId}/deliver/rfp`}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-300 text-sm mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to RFPs
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">Outcome Insights</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                Internal
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {!analysis.isStatisticallyMeaningful ? (
          <EmptyState />
        ) : (
          <div className="space-y-8">
            {/* Summary Card */}
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  isPredictive
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {isPredictive ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Info className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-semibold text-white">
                      {isPredictive ? 'Readiness Signals Are Predictive' : 'Building Historical Data'}
                    </h2>
                    {isPredictive && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Validated
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300">{summary}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-700">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {analysis.overallWinRate}%
                  </div>
                  <div className="text-sm text-slate-500">Overall Win Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {analysis.completeRecords}
                  </div>
                  <div className="text-sm text-slate-500">Complete Records</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {analysis.insights.length}
                  </div>
                  <div className="text-sm text-slate-500">Insights Found</div>
                </div>
              </div>
            </div>

            {/* Top Insights */}
            {topInsights.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  Top Insights
                </h3>
                <div className="grid gap-4">
                  {topInsights.map((insight, i) => (
                    <InsightCard key={i} insight={insight} />
                  ))}
                </div>
              </div>
            )}

            {/* Insights by Category */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                All Insights by Category
              </h3>
              <div className="space-y-3">
                <CategorySection
                  title="Score Thresholds"
                  icon={Gauge}
                  insights={insightsByCategory.score_threshold}
                  defaultExpanded={true}
                />
                <CategorySection
                  title="Recommendations"
                  icon={CheckCircle2}
                  insights={insightsByCategory.recommendation}
                />
                <CategorySection
                  title="Risk Acknowledgement"
                  icon={Shield}
                  insights={insightsByCategory.acknowledgement}
                />
                <CategorySection
                  title="Critical Risks"
                  icon={AlertTriangle}
                  insights={insightsByCategory.risk}
                />
              </div>
            </div>

            {/* Loss Reasons */}
            {analysis.lossReasons.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  Loss Reason Analysis
                </h3>
                <div className="space-y-2">
                  {analysis.lossReasons.map((reason, i) => (
                    <LossReasonCard key={i} reason={reason} />
                  ))}
                </div>
              </div>
            )}

            {/* Meta Info */}
            <div className="text-sm text-slate-500 border-t border-slate-800 pt-4">
              <p>
                Analysis based on {meta.analyzedRfps} RFPs out of {meta.totalRfps} total.
                {meta.completeRecords < meta.analyzedRfps && (
                  <span>
                    {' '}({meta.analyzedRfps - meta.completeRecords} missing snapshot or outcome data)
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
