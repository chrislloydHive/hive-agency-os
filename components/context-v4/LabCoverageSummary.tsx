'use client';

// components/context-v4/LabCoverageSummary.tsx
// Lab Coverage Summary Panel
//
// Displays cards for each lab that has run, showing:
// - Status (completed, running, failed, not run)
// - Findings count from lab output
// - Proposed facts count
// - Buttons to view findings or filter to that lab's facts

import { useState, useEffect } from 'react';
import {
  Beaker,
  Check,
  Clock,
  XCircle,
  AlertTriangle,
  Eye,
  Filter,
  ChevronDown,
  ChevronUp,
  Swords,
  Globe,
  Sparkles,
  TrendingDown,
  ShieldAlert,
  Star,
  Users,
} from 'lucide-react';
import type {
  LabCoverageSummaryResponse,
  LabRunSummary,
  LabKey,
} from '@/lib/types/labSummary';

interface LabCoverageSummaryProps {
  companyId: string;
  onViewFindings: (labKey: LabKey) => void;
  onFilterByLab: (labKey: LabKey) => void;
  onRefresh?: () => void;
}

// Lab icons
const LAB_ICONS: Record<LabKey, React.ReactNode> = {
  websiteLab: <Globe className="w-5 h-5" />,
  competitionLab: <Swords className="w-5 h-5" />,
  brandLab: <Sparkles className="w-5 h-5" />,
  gapPlan: <Beaker className="w-5 h-5" />,
  audienceLab: <Users className="w-5 h-5" />,
};

// Quality badge configuration
function getQualityBadgeStyles(qualityBand: string) {
  switch (qualityBand) {
    case 'Excellent':
      return {
        bgColor: 'bg-green-500/20',
        textColor: 'text-green-400',
        borderColor: 'border-green-500/30',
        icon: <Star className="w-3 h-3" />,
      };
    case 'Good':
      return {
        bgColor: 'bg-blue-500/20',
        textColor: 'text-blue-400',
        borderColor: 'border-blue-500/30',
        icon: <Check className="w-3 h-3" />,
      };
    case 'Weak':
      return {
        bgColor: 'bg-amber-500/20',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        icon: <AlertTriangle className="w-3 h-3" />,
      };
    case 'Poor':
      return {
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
        borderColor: 'border-red-500/30',
        icon: <ShieldAlert className="w-3 h-3" />,
      };
    default:
      return {
        bgColor: 'bg-slate-500/20',
        textColor: 'text-slate-400',
        borderColor: 'border-slate-500/30',
        icon: null,
      };
  }
}

// Status colors and icons
function getStatusDisplay(status: LabRunSummary['status']) {
  switch (status) {
    case 'completed':
      return {
        icon: <Check className="w-4 h-4" />,
        bgColor: 'bg-emerald-500/20',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        label: 'Completed',
      };
    case 'running':
      return {
        icon: <Clock className="w-4 h-4 animate-pulse" />,
        bgColor: 'bg-amber-500/20',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        label: 'Running',
      };
    case 'failed':
      return {
        icon: <XCircle className="w-4 h-4" />,
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
        borderColor: 'border-red-500/30',
        label: 'Failed',
      };
    case 'pending':
      return {
        icon: <Clock className="w-4 h-4" />,
        bgColor: 'bg-slate-500/20',
        textColor: 'text-slate-400',
        borderColor: 'border-slate-500/30',
        label: 'Pending',
      };
    case 'not_run':
    default:
      return {
        icon: <AlertTriangle className="w-4 h-4" />,
        bgColor: 'bg-slate-800',
        textColor: 'text-slate-500',
        borderColor: 'border-slate-700',
        label: 'Not Run',
      };
  }
}

function LabCard({
  lab,
  onViewFindings,
  onFilterByLab,
}: {
  lab: LabRunSummary;
  onViewFindings: () => void;
  onFilterByLab: () => void;
}) {
  const status = getStatusDisplay(lab.status);
  const hasUnmappedFindings = lab.findingsCount > 0 && lab.proposedFactsCount === 0;
  const hasPendingReview = lab.pendingReviewCount > 0;

  return (
    <div
      className={`flex flex-col p-4 rounded-lg border ${status.bgColor} ${status.borderColor}`}
    >
      {/* Header - uses flex-wrap so badge drops to next line on narrow cards */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
        <div className="flex items-center gap-2">
          <span className={`shrink-0 ${status.textColor}`}>
            {LAB_ICONS[lab.labKey]}
          </span>
          <span className="font-medium text-white">{lab.displayName}</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded ${status.bgColor} ${status.textColor}`}>
          {status.icon}
          <span className="text-xs font-medium">{status.label}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 mb-3 line-clamp-2">{lab.description}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <p className="text-lg font-semibold text-white">{lab.findingsCount}</p>
          <p className="text-xs text-slate-400">Findings</p>
        </div>
        <div className="text-center p-2 bg-slate-800/50 rounded">
          <p className={`text-lg font-semibold ${hasPendingReview ? 'text-amber-400' : 'text-white'}`}>
            {lab.proposedFactsCount}
          </p>
          <p className="text-xs text-slate-400">Proposed Facts</p>
        </div>
      </div>

      {/* Unmapped Warning */}
      {hasUnmappedFindings && (
        <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 px-2 py-1.5 rounded mb-3">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="text-xs">0 proposed facts (none mapped)</span>
        </div>
      )}

      {/* Pending Review Badge */}
      {hasPendingReview && (
        <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 px-2 py-1.5 rounded mb-3">
          <Eye className="w-3.5 h-3.5" />
          <span className="text-xs">{lab.pendingReviewCount} pending review</span>
        </div>
      )}

      {/* Quality Badge */}
      {lab.quality && (
        <div className="mb-3">
          <div className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded border ${getQualityBadgeStyles(lab.quality.qualityBand).bgColor} ${getQualityBadgeStyles(lab.quality.qualityBand).borderColor}`}>
            <div className="flex items-center gap-1.5">
              <span className={getQualityBadgeStyles(lab.quality.qualityBand).textColor}>
                {getQualityBadgeStyles(lab.quality.qualityBand).icon}
              </span>
              <span className={`text-xs font-medium ${getQualityBadgeStyles(lab.quality.qualityBand).textColor}`}>
                Quality: {lab.quality.score}
              </span>
              <span className={`text-xs ${getQualityBadgeStyles(lab.quality.qualityBand).textColor} opacity-70`}>
                ({lab.quality.qualityBand})
              </span>
            </div>
            {/* Regression indicator */}
            {lab.quality.regression?.isRegression && (
              <div className="flex items-center gap-1 text-red-400">
                <TrendingDown className="w-3 h-3" />
                <span className="text-xs">{lab.quality.regression.pointDifference} pts</span>
              </div>
            )}
          </div>
          {/* Quality warning for Weak/Poor */}
          {(lab.quality.qualityBand === 'Weak' || lab.quality.qualityBand === 'Poor') && (
            <p className="text-xs text-amber-400/70 mt-1">
              {lab.quality.qualityBand === 'Poor'
                ? 'Low-quality output — findings may be generic or under-evidenced'
                : 'Some quality issues detected — review findings carefully'}
            </p>
          )}
        </div>
      )}

      {/* Completed At */}
      {lab.completedAt && (
        <p className="text-xs text-slate-500 mb-3">
          Completed {new Date(lab.completedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      )}

      {/* Error Message */}
      {lab.errorMessage && (
        <p className="text-xs text-red-400 bg-red-500/10 px-2 py-1.5 rounded mb-3 line-clamp-2">
          {lab.errorMessage}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={onViewFindings}
          disabled={lab.status === 'not_run'}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded text-sm font-medium transition-colors"
        >
          <Eye className="w-4 h-4" />
          View Findings
        </button>
        {lab.proposedFactsCount > 0 && (
          <button
            onClick={onFilterByLab}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded text-sm font-medium transition-colors"
          >
            <Filter className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function LabCoverageSummary({
  companyId,
  onViewFindings,
  onFilterByLab,
  onRefresh,
}: LabCoverageSummaryProps) {
  const [data, setData] = useState<LabCoverageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/os/companies/${companyId}/labs/summary`, {
          cache: 'no-store',
        });
        const json = await response.json();

        if (!json.ok) {
          throw new Error(json.error || 'Failed to load lab summary');
        }

        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [companyId]);

  if (loading) {
    return (
      <div className="mb-6 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
        <div className="flex items-center gap-2 text-slate-400">
          <Beaker className="w-5 h-5 animate-pulse" />
          <span>Loading lab summary...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <div className="flex items-center gap-2 text-red-400">
          <XCircle className="w-5 h-5" />
          <span>Error loading lab summary: {error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Check if any labs have run
  const labsRun = data.labs.filter(lab => lab.status !== 'not_run');
  const hasLabsRun = labsRun.length > 0;

  // Summary stats
  const completedLabs = labsRun.filter(lab => lab.status === 'completed').length;
  const failedLabs = labsRun.filter(lab => lab.status === 'failed').length;

  return (
    <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Beaker className="w-5 h-5 text-purple-400" />
          <span className="font-medium text-white">Labs Run</span>
          {hasLabsRun && (
            <span className="text-sm text-slate-400">
              {completedLabs} completed
              {failedLabs > 0 && <span className="text-red-400"> | {failedLabs} failed</span>}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400">
              <span className="text-white font-medium">{data.totalFindings}</span> findings
            </span>
            <span className="text-slate-400">
              <span className="text-amber-400 font-medium">{data.totalPendingReview}</span> pending
            </span>
          </div>

          {expanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 pt-0">
          {!hasLabsRun ? (
            <div className="text-center py-8 text-slate-500">
              <Beaker className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No labs have run yet</p>
              <p className="text-sm mt-1">Run Website Lab or Competition Lab to generate context</p>
            </div>
          ) : (
            <>
              {/* Unmapped Findings Warning */}
              {data.labsWithUnmappedFindings.length > 0 && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-200 font-medium text-sm">
                        Some labs have findings but no proposed facts
                      </p>
                      <p className="text-amber-300/70 text-xs mt-1">
                        View findings to manually promote them to the review queue
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Lab Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.labs.map((lab) => (
                  <LabCard
                    key={lab.labKey}
                    lab={lab}
                    onViewFindings={() => onViewFindings(lab.labKey)}
                    onFilterByLab={() => onFilterByLab(lab.labKey)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
