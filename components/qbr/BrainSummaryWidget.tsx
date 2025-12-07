'use client';

// components/qbr/BrainSummaryWidget.tsx
// Data Confidence widget and Context & Assumptions panel for QBR Story
//
// Shows BrainSummary data including:
// - Data confidence score with link to Explorer
// - Domain health status
// - Context deltas (what changed this quarter)
// - Lab status badges

import Link from 'next/link';
import {
  Brain,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Info,
  ArrowUpRight,
  FlaskConical,
  Sparkles,
} from 'lucide-react';
import type {
  BrainSummary,
  BrainDomainHealth,
  BrainLabSummary,
  BrainInsightItem,
} from '@/lib/brain/summaryTypes';
import {
  getDomainHealthTier,
  getWeakDomains,
  getConfidenceLabel,
} from '@/lib/brain/summaryTypes';

// ============================================================================
// Data Confidence Header Widget
// ============================================================================

interface DataConfidenceWidgetProps {
  brainSummary: BrainSummary;
  companyId: string;
}

export function DataConfidenceWidget({
  brainSummary,
  companyId,
}: DataConfidenceWidgetProps) {
  const { dataConfidenceScore, domains } = brainSummary;
  const weakDomains = getWeakDomains(domains, 70);
  const confidenceLabel = getConfidenceLabel(dataConfidenceScore);

  // Color based on score
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getBgColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/30';
    if (score >= 50) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <div className={`p-3 rounded-lg border ${getBgColor(dataConfidenceScore)} flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-800/50 rounded-lg">
          <Brain className={`w-4 h-4 ${getScoreColor(dataConfidenceScore)}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300">Data Confidence</span>
            <span className={`text-sm font-bold ${getScoreColor(dataConfidenceScore)}`}>
              {dataConfidenceScore}%
            </span>
            <span className="text-[10px] text-slate-500">({confidenceLabel})</span>
          </div>
          {weakDomains.length > 0 && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              {weakDomains.length} domain{weakDomains.length > 1 ? 's' : ''} below threshold:
              {' '}
              {weakDomains.slice(0, 3).map(d => d.label).join(', ')}
              {weakDomains.length > 3 && ` +${weakDomains.length - 3} more`}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/c/${companyId}/brain/explorer`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-md transition-colors"
        >
          Open Explorer
          <ArrowUpRight className="w-3 h-3" />
        </Link>
        <Link
          href={`/c/${companyId}/brain/context`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md transition-colors"
        >
          Review Gaps
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Context & Assumptions Chapter
// ============================================================================

interface ContextAssumptionsChapterProps {
  brainSummary: BrainSummary;
  companyId: string;
}

export function ContextAssumptionsChapter({
  brainSummary,
  companyId,
}: ContextAssumptionsChapterProps) {
  const { domains, contextDeltas, insights, labs } = brainSummary;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      {/* Chapter header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-800/30">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            Context & Assumptions
          </h2>
        </div>
        <Link
          href={`/c/${companyId}/brain/insights`}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-slate-300 transition-colors"
        >
          View All Insights
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="p-4 space-y-4">
        {/* Domain Health Grid */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Domain Health</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {domains.slice(0, 8).map((domain) => (
              <DomainHealthPill key={domain.id} domain={domain} companyId={companyId} />
            ))}
          </div>
        </div>

        {/* Context Deltas */}
        {contextDeltas.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">
              What Changed This Quarter
            </p>
            <div className="space-y-1.5">
              {contextDeltas.slice(0, 5).map((delta) => (
                <div
                  key={delta.id}
                  className="flex items-start gap-2 p-2 bg-slate-800/30 rounded-md"
                >
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    delta.changeType === 'added' ? 'bg-emerald-500/20 text-emerald-400' :
                    delta.changeType === 'removed' ? 'bg-red-500/20 text-red-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {delta.changeType}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 truncate">{delta.label}</p>
                    <p className="text-[10px] text-slate-500 truncate">{delta.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Insights */}
        {insights.topInsights.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">
              Top Context Insights
            </p>
            <div className="space-y-1.5">
              {insights.topInsights.slice(0, 3).map((insight) => (
                <InsightRow key={insight.id} insight={insight} />
              ))}
            </div>
          </div>
        )}

        {/* Lab Status */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Lab Status</p>
          <div className="flex flex-wrap gap-2">
            {labs.map((lab) => (
              <LabStatusBadge key={lab.id} lab={lab} companyId={companyId} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function DomainHealthPill({
  domain,
  companyId,
}: {
  domain: BrainDomainHealth;
  companyId: string;
}) {
  const tier = getDomainHealthTier(domain.healthScore);

  const tierStyles = {
    strong: 'border-emerald-500/30 text-emerald-400',
    needs_work: 'border-amber-500/30 text-amber-400',
    critical: 'border-red-500/30 text-red-400',
  };

  const tierLabels = {
    strong: 'Strong',
    needs_work: 'Needs Work',
    critical: 'Critical',
  };

  return (
    <Link
      href={`/c/${companyId}/brain/context?section=${domain.id}`}
      className={`flex items-center justify-between p-2 rounded-md border bg-slate-800/30 hover:bg-slate-800/50 transition-colors ${tierStyles[tier]}`}
    >
      <span className="text-xs font-medium text-slate-300">{domain.label}</span>
      <span className="text-[10px]">{tierLabels[tier]}</span>
    </Link>
  );
}

function InsightRow({ insight }: { insight: BrainInsightItem }) {
  const severityIcons = {
    critical: <AlertTriangle className="w-3 h-3 text-red-400" />,
    warning: <Info className="w-3 h-3 text-amber-400" />,
    info: <CheckCircle className="w-3 h-3 text-blue-400" />,
  };

  return (
    <div className="flex items-start gap-2 p-2 bg-slate-800/30 rounded-md">
      {severityIcons[insight.severity]}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300">{insight.title}</p>
        {insight.description && (
          <p className="text-[10px] text-slate-500 truncate">{insight.description}</p>
        )}
      </div>
    </div>
  );
}

function LabStatusBadge({
  lab,
  companyId,
}: {
  lab: BrainLabSummary;
  companyId: string;
}) {
  const statusStyles = {
    fresh: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    stale: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    not_run: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };

  const statusLabels = {
    fresh: 'Recent',
    stale: 'Stale',
    not_run: 'Not run',
  };

  return (
    <Link
      href={lab.href || `/c/${companyId}/brain/labs`}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors hover:opacity-80 ${statusStyles[lab.status]}`}
    >
      <FlaskConical className="w-3 h-3" />
      {lab.label}
      <span className="opacity-70">({statusLabels[lab.status]})</span>
    </Link>
  );
}

// ============================================================================
// Lab Status Badge for Chapter Headers
// ============================================================================

interface ChapterLabBadgeProps {
  labId: string;
  labs: BrainLabSummary[];
  companyId: string;
}

export function ChapterLabBadge({ labId, labs, companyId }: ChapterLabBadgeProps) {
  const lab = labs.find(l => l.id === labId);
  if (!lab) return null;

  const statusStyles = {
    fresh: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    stale: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    not_run: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };

  const statusLabels = {
    fresh: 'Lab run recent',
    stale: 'Lab run stale',
    not_run: 'Lab not run',
  };

  return (
    <Link
      href={`${lab.href}?from=qbr`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors hover:opacity-80 ${statusStyles[lab.status]}`}
    >
      <FlaskConical className="w-2.5 h-2.5" />
      {statusLabels[lab.status]}
    </Link>
  );
}
