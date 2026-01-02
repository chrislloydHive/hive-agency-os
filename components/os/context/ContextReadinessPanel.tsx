// components/os/context/ContextReadinessPanel.tsx
// Context Readiness Panel Component
//
// Reusable panel that shows context readiness status for a company.
// Shows overall readiness %, per-domain rows with status badges,
// and actionable CTAs.

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type {
  ReadinessSummary,
  DomainReadiness,
  RequiredForFeature,
  ReadinessStatus,
  RequirementLevel,
} from '@/lib/os/contextReadiness/types';
import {
  getStatusBadgeLabel,
  getStatusBadgeColor,
  getDomainStatusMessage,
  getDomainWhyMessage,
  getOverallStatusMessage,
  getProgressMessage,
} from '@/lib/os/contextReadiness/messages';
import { DOMAIN_DISPLAY_ORDER } from '@/lib/os/contextReadiness/rules';

// ============================================================================
// Types
// ============================================================================

interface ContextReadinessPanelProps {
  companyId: string;
  requiredFor: RequiredForFeature;
  compact?: boolean;
  className?: string;
  /** Optional pre-loaded summary (for SSR) */
  initialSummary?: ReadinessSummary | null;
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatusIcon({ status }: { status: ReadinessStatus }) {
  switch (status) {
    case 'ready':
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'partial':
      return <AlertCircle className="w-4 h-4 text-amber-400" />;
    case 'missing':
      return <XCircle className="w-4 h-4 text-red-400" />;
  }
}

function RequirementBadge({ level }: { level: RequirementLevel }) {
  const colors = {
    required: 'bg-red-500/10 text-red-400 border-red-500/20',
    recommended: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    optional: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors[level]}`}
    >
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function StatusBadge({ status }: { status: ReadinessStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadgeColor(status)}`}
    >
      {getStatusBadgeLabel(status)}
    </span>
  );
}

function ProgressRing({ percentage }: { percentage: number }) {
  const radius = 20;
  const strokeWidth = 4;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const color =
    percentage >= 80
      ? 'text-green-400'
      : percentage >= 50
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle
          stroke="currentColor"
          className="text-slate-700"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="currentColor"
          className={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <span className={`absolute text-xs font-medium ${color}`}>
        {percentage}%
      </span>
    </div>
  );
}

function DomainRow({
  domain,
  expanded,
  onToggle,
}: {
  domain: DomainReadiness;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetails =
    domain.failedChecks.length > 0 ||
    domain.warnings.length > 0 ||
    domain.labQualityScore !== null;

  return (
    <div className="border-b border-slate-800 last:border-b-0">
      {/* Main row */}
      <div
        className={`flex items-center gap-3 px-3 py-2 ${hasDetails ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
        onClick={hasDetails ? onToggle : undefined}
      >
        {/* Expand indicator */}
        <div className="w-4 flex-shrink-0">
          {hasDetails && (
            expanded ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )
          )}
        </div>

        {/* Status icon */}
        <StatusIcon status={domain.status} />

        {/* Domain name */}
        <span className="flex-1 text-sm text-slate-200">{domain.domainLabel}</span>

        {/* Requirement badge */}
        <RequirementBadge level={domain.requirementLevel} />

        {/* Status badge */}
        <StatusBadge status={domain.status} />

        {/* Primary CTA */}
        {domain.primaryCTA && (
          <Link
            href={domain.primaryCTA.href}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
          >
            {domain.primaryCTA.label}
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="px-3 py-2 pl-11 bg-slate-900/50 border-t border-slate-800">
          {/* Status message */}
          <p className="text-xs text-slate-400 mb-2">
            {getDomainStatusMessage(domain)}
          </p>

          {/* Failed checks */}
          {domain.failedChecks.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                Missing
              </p>
              <ul className="space-y-0.5">
                {domain.failedChecks.map((check, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                    <span className="text-red-400">•</span>
                    <span>
                      {check.label}
                      {check.reason && (
                        <span className="text-slate-500"> - {check.reason}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {domain.warnings.filter(w => !w.relatedField).length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                Warnings
              </p>
              <ul className="space-y-0.5">
                {domain.warnings
                  .filter(w => !w.relatedField)
                  .map((warning, i) => (
                    <li key={i} className="text-xs text-amber-400 flex items-start gap-1">
                      <span>•</span>
                      <span>{warning.message}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Lab quality */}
          {domain.labQualityScore != null && (
            <p className="text-xs text-slate-500">
              Lab quality: {domain.labQualityScore}/100
              {(domain.labQualityScore ?? 100) < 40 && (
                <span className="text-amber-400 ml-1">(low)</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextReadinessPanel({
  companyId,
  requiredFor,
  compact = false,
  className = '',
  initialSummary,
}: ContextReadinessPanelProps) {
  const [summary, setSummary] = useState<ReadinessSummary | null>(initialSummary ?? null);
  const [loading, setLoading] = useState(!initialSummary);
  const [error, setError] = useState<string | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  // Fetch readiness data
  useEffect(() => {
    if (initialSummary) return;

    async function fetchReadiness() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/os/companies/${companyId}/context-readiness?requiredFor=${requiredFor}`
        );
        if (!res.ok) {
          throw new Error('Failed to load readiness data');
        }
        const data = await res.json();
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchReadiness();
  }, [companyId, requiredFor, initialSummary]);

  const toggleDomain = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading context readiness...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-slate-900 border border-red-500/30 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // No data state
  if (!summary) {
    return null;
  }

  // Compact view
  if (compact) {
    return (
      <div
        className={`bg-slate-900 border border-slate-800 rounded-lg p-3 ${className}`}
      >
        <div className="flex items-center gap-3">
          <ProgressRing percentage={summary.overallScore} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">
              {getProgressMessage(summary)}
            </p>
            {summary.nextActionCTA && (
              <Link
                href={summary.nextActionCTA.href}
                className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
              >
                {summary.nextActionCTA.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-lg overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProgressRing percentage={summary.overallScore} />
            <div>
              <h3 className="text-sm font-medium text-slate-200">
                Context Readiness
              </h3>
              <p className="text-xs text-slate-400">
                {getOverallStatusMessage(summary)}
              </p>
            </div>
          </div>
          <StatusBadge status={summary.overallStatus} />
        </div>
      </div>

      {/* Next action banner */}
      {summary.overallStatus !== 'ready' && summary.nextActionCTA && (
        <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between">
          <p className="text-xs text-blue-300">{summary.nextAction}</p>
          <Link
            href={summary.nextActionCTA.href}
            className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            {summary.nextActionCTA.label}
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Domain rows */}
      <div>
        {summary.domains.map((domain) => (
          <DomainRow
            key={domain.domain}
            domain={domain}
            expanded={expandedDomains.has(domain.domain)}
            onToggle={() => toggleDomain(domain.domain)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-800/20">
        <p className="text-[10px] text-slate-500">
          Last computed: {new Date(summary.computedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export default ContextReadinessPanel;
