'use client';

// components/os/media/MediaIssuesPanel.tsx
// Issues & Opportunities panel for Media Lab v2
//
// Displays AI-generated media/analytics findings sorted by severity.
// Shows recommendations and allows refreshing findings.

import {
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Info,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { RefreshAnalyticsFindingsButton } from '@/components/os/RefreshAnalyticsFindingsButton';
import type { MediaFinding } from '@/lib/os/findings/mediaFindings';
import {
  getSeverityColorClasses,
  getSeverityLabel,
} from '@/lib/os/findings/mediaFindings';

// ============================================================================
// Types
// ============================================================================

interface MediaIssuesPanelProps {
  companyId: string;
  findings: MediaFinding[];
  /** Whether analytics is connected (show refresh button if true) */
  hasAnalytics?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

function SeverityIcon({ severity }: { severity: MediaFinding['severity'] }) {
  const iconClass = 'w-4 h-4';

  switch (severity) {
    case 'critical':
      return <AlertTriangle className={`${iconClass} text-red-400`} />;
    case 'high':
      return <AlertCircle className={`${iconClass} text-orange-400`} />;
    case 'medium':
      return <Info className={`${iconClass} text-amber-400`} />;
    case 'low':
    default:
      return <CheckCircle className={`${iconClass} text-slate-400`} />;
  }
}

function FindingCard({ finding }: { finding: MediaFinding }) {
  const severityColors = getSeverityColorClasses(finding.severity);

  return (
    <div className="bg-slate-800/30 rounded-lg p-4 hover:bg-slate-800/50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Severity Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <SeverityIcon severity={finding.severity} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${severityColors}`}
            >
              {getSeverityLabel(finding.severity)}
            </span>
            {finding.isAiGenerated && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </span>
            )}
            {finding.category && (
              <span className="text-[10px] text-slate-500">{finding.category}</span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium text-slate-200 mb-1">
            {finding.title}
          </h4>

          {/* Description */}
          {finding.description && finding.description !== finding.title && (
            <p className="text-xs text-slate-400 mb-2 line-clamp-2">
              {finding.description}
            </p>
          )}

          {/* Recommendation */}
          {finding.recommendation && (
            <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-slate-700/50">
              <ChevronRight className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-400 italic">
                {finding.recommendation}
              </p>
            </div>
          )}

          {/* Meta */}
          {(finding.location || finding.estimatedImpact) && (
            <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
              {finding.location && <span>Location: {finding.location}</span>}
              {finding.estimatedImpact && (
                <span>Impact: {finding.estimatedImpact}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaIssuesPanel({
  companyId,
  findings,
  hasAnalytics = false,
}: MediaIssuesPanelProps) {
  // Count findings by severity
  const severityCounts = findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Issues & Opportunities
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {findings.length > 0
                ? `${findings.length} finding${findings.length !== 1 ? 's' : ''} from analytics & media diagnostics`
                : 'AI-generated insights from analytics data'}
            </p>
          </div>

          {/* Refresh Button (if analytics is connected) */}
          {hasAnalytics && (
            <RefreshAnalyticsFindingsButton companyId={companyId} size="sm" />
          )}
        </div>

        {/* Severity Summary */}
        {findings.length > 0 && (
          <div className="flex items-center gap-3 mt-3">
            {severityCounts.critical ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {severityCounts.critical} critical
              </span>
            ) : null}
            {severityCounts.high ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-orange-400">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                {severityCounts.high} high
              </span>
            ) : null}
            {severityCounts.medium ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {severityCounts.medium} medium
              </span>
            ) : null}
            {severityCounts.low ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                {severityCounts.low} low
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {findings.length > 0 ? (
          <div className="space-y-3">
            {findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800/50 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-sm font-medium text-slate-300 mb-1">
              No findings yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {hasAnalytics
                ? "Use 'Refresh Findings' above to generate AI insights from your analytics data."
                : 'Analytics findings will appear here once generated by diagnostics or scheduled jobs.'}
            </p>
            {hasAnalytics && (
              <div className="flex justify-center">
                <RefreshAnalyticsFindingsButton companyId={companyId} size="md" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MediaIssuesPanel;
