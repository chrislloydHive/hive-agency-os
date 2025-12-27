'use client';

// app/settings/rfp/insights/page.tsx
// Firm-Scoped RFP Outcome Insights Page
//
// Shows correlation analysis between bid readiness signals and RFP outcomes
// across all companies (institutional learning).

import { useState, useEffect } from 'react';
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
  Calendar,
  Building2,
} from 'lucide-react';
import type { OutcomeAnalysisResult, OutcomeInsight, LossReasonAnalysis } from '@/lib/os/rfp/analyzeOutcomes';
import type { OutcomeTimeRange } from '@/lib/airtable/rfp';

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
    sampleSize: number;
    timeRange: OutcomeTimeRange;
    minConfidence: string;
    totalRfps: number;
  };
}

// ============================================================================
// Sub-components
// ============================================================================

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: OutcomeTimeRange;
  onChange: (v: OutcomeTimeRange) => void;
}) {
  const options: { value: OutcomeTimeRange; label: string }[] = [
    { value: '90d', label: '90 days' },
    { value: '180d', label: '180 days' },
    { value: '365d', label: '1 year' },
    { value: 'all', label: 'All time' },
  ];

  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-slate-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as OutcomeTimeRange)}
        className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-purple-500 focus:border-purple-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

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
        Complete more RFPs with outcomes (won/lost) to unlock institutional learning insights.
        We need at least 5 completed RFPs with submission snapshots to generate meaningful analysis.
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function FirmRfpInsightsPage() {
  const [timeRange, setTimeRange] = useState<OutcomeTimeRange>('365d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisResponse | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/os/rfp/outcomes/analysis?timeRange=${timeRange}&minConfidence=low`
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
  }, [timeRange]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-300 text-sm mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Settings
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">RFP Outcome Insights</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Firm-Wide
              </span>
            </div>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
            <h2 className="text-xl font-semibold text-slate-200 mb-2">Analysis Error</h2>
            <p className="text-slate-400">{error}</p>
          </div>
        ) : !data ? null : !data.analysis.isStatisticallyMeaningful ? (
          <EmptyState />
        ) : (
          <div className="space-y-8">
            {/* Summary Card */}
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  data.isPredictive
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {data.isPredictive ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Info className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-semibold text-white">
                      {data.isPredictive ? 'Readiness Signals Are Predictive' : 'Building Institutional Data'}
                    </h2>
                    {data.isPredictive && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Validated
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300">{data.summary}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {data.analysis.overallWinRate}%
                  </div>
                  <div className="text-sm text-slate-500">Win Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {data.meta.sampleSize}
                  </div>
                  <div className="text-sm text-slate-500">Complete Records</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {data.analysis.insights.length}
                  </div>
                  <div className="text-sm text-slate-500">Insights Found</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white capitalize">
                    {data.meta.timeRange === 'all' ? 'All' : data.meta.timeRange.replace('d', '')}
                  </div>
                  <div className="text-sm text-slate-500">
                    {data.meta.timeRange === 'all' ? 'Time' : 'Days'}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Insights */}
            {data.topInsights.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  Top Insights
                </h3>
                <div className="grid gap-4">
                  {data.topInsights.map((insight, i) => (
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
                  insights={data.insightsByCategory.score_threshold}
                  defaultExpanded={true}
                />
                <CategorySection
                  title="Recommendations"
                  icon={CheckCircle2}
                  insights={data.insightsByCategory.recommendation}
                />
                <CategorySection
                  title="Risk Acknowledgement"
                  icon={Shield}
                  insights={data.insightsByCategory.acknowledgement}
                />
                <CategorySection
                  title="Critical Risks"
                  icon={AlertTriangle}
                  insights={data.insightsByCategory.risk}
                />
              </div>
            </div>

            {/* Loss Reasons */}
            {data.analysis.lossReasons.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  Loss Reason Analysis
                </h3>
                <div className="space-y-2">
                  {data.analysis.lossReasons.map((reason, i) => (
                    <LossReasonCard key={i} reason={reason} />
                  ))}
                </div>
              </div>
            )}

            {/* Meta Info */}
            <div className="text-sm text-slate-500 border-t border-slate-800 pt-4">
              <p>
                Analysis based on {data.meta.sampleSize} RFPs with complete data
                {data.meta.timeRange !== 'all' && ` from the last ${data.meta.timeRange.replace('d', ' days')}`}.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
