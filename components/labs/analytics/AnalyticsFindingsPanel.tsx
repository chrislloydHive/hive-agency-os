'use client';

// components/labs/analytics/AnalyticsFindingsPanel.tsx
// Findings and next actions panel

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Info, ArrowRight, Search, DollarSign, BarChart3, MapPin } from 'lucide-react';
import type { AnalyticsLabFinding } from '@/lib/analytics/analyticsTypes';
import { getSeverityColorClass } from '@/lib/analytics/analyticsTypes';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsFindingsPanelProps {
  companyId: string;
  findings: AnalyticsLabFinding[];
}

// ============================================================================
// Component
// ============================================================================

export function AnalyticsFindingsPanel({
  companyId,
  findings,
}: AnalyticsFindingsPanelProps) {
  // Group findings by severity
  const criticalFindings = findings.filter((f) => f.severity === 'critical');
  const highFindings = findings.filter((f) => f.severity === 'high');
  const mediumFindings = findings.filter((f) => f.severity === 'medium');
  const lowFindings = findings.filter((f) => f.severity === 'low');

  const hasFindings = findings.length > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-200">Findings & Next Actions</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasFindings
              ? `${findings.length} finding${findings.length === 1 ? '' : 's'} identified`
              : 'No findings at this time'}
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-2">
          <QuickLink href={`/c/${companyId}/diagnostics/seo`} icon={Search} label="SEO Lab" />
          <QuickLink href={`/c/${companyId}/media`} icon={DollarSign} label="Media Lab" />
          <QuickLink href={`/c/${companyId}/diagnostics`} icon={BarChart3} label="All Diagnostics" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!hasFindings ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-300 font-medium mb-1">Looking good!</p>
            <p className="text-sm text-slate-500">
              No significant issues or opportunities identified at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Critical Findings */}
            {criticalFindings.length > 0 && (
              <FindingsSection
                title="Critical"
                findings={criticalFindings}
                companyId={companyId}
              />
            )}

            {/* High Findings */}
            {highFindings.length > 0 && (
              <FindingsSection
                title="High Priority"
                findings={highFindings}
                companyId={companyId}
              />
            )}

            {/* Medium Findings */}
            {mediumFindings.length > 0 && (
              <FindingsSection
                title="Medium Priority"
                findings={mediumFindings}
                companyId={companyId}
              />
            )}

            {/* Low Findings */}
            {lowFindings.length > 0 && (
              <FindingsSection
                title="Low Priority"
                findings={lowFindings}
                companyId={companyId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Findings Section
// ============================================================================

interface FindingsSectionProps {
  title: string;
  findings: AnalyticsLabFinding[];
  companyId: string;
}

function FindingsSection({ title, findings }: FindingsSectionProps) {
  return (
    <div>
      <h4 className="text-xs font-medium text-slate-400 mb-2">{title}</h4>
      <div className="space-y-2">
        {findings.map((finding, i) => (
          <FindingCard key={finding.id || i} finding={finding} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Finding Card
// ============================================================================

interface FindingCardProps {
  finding: AnalyticsLabFinding;
}

function FindingCard({ finding }: FindingCardProps) {
  const severityClass = getSeverityColorClass(finding.severity);
  const LabIcon = getLabIcon(finding.labSlug);

  return (
    <div className={`p-3 border rounded-lg ${severityClass}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-0.5">
          {finding.severity === 'critical' || finding.severity === 'high' ? (
            <AlertTriangle className="w-4 h-4" />
          ) : finding.severity === 'low' ? (
            <Info className="w-4 h-4" />
          ) : (
            <LabIcon className="w-4 h-4" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="text-sm font-medium text-slate-200 truncate">
              {finding.title}
            </h5>
            <span className="text-xs text-slate-500 shrink-0">
              {finding.labSlug}
            </span>
          </div>

          <p className="text-xs text-slate-400 mb-2 line-clamp-2">
            {finding.description}
          </p>

          {finding.recommendedAction && (
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <ArrowRight className="w-3 h-3" />
              <span className="line-clamp-1">{finding.recommendedAction}</span>
            </div>
          )}

          {/* Metric Change */}
          {finding.changePercent !== undefined && finding.changePercent !== null && (
            <div className="mt-2 text-xs text-slate-500">
              {finding.metric}: {finding.changePercent > 0 ? '+' : ''}{finding.changePercent}%
              {finding.previousValue && finding.currentValue && (
                <span className="ml-1">
                  ({finding.previousValue} → {finding.currentValue})
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Quick Link
// ============================================================================

interface QuickLinkProps {
  href: string;
  icon: typeof Search;
  label: string;
}

function QuickLink({ href, icon: Icon, label }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg transition-colors"
    >
      <Icon className="w-3 h-3" />
      {label}
    </Link>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getLabIcon(labSlug: AnalyticsLabFinding['labSlug']) {
  switch (labSlug) {
    case 'seo':
      return Search;
    case 'media':
      return DollarSign;
    case 'gbp':
      return MapPin;
    default:
      return BarChart3;
  }
}
