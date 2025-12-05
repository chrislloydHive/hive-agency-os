// components/os/ContextHealthPanel.tsx
// Context Health Panel for Brain UI
//
// Displays the health status of a company's Context Graph including:
// - Overall status (healthy/degraded/needs_attention)
// - Critical fields completion
// - Section-by-section breakdown
// - Recommended next actions

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type {
  CompanyContextHealth,
  SectionHealthStats,
} from '@/lib/contextGraph/diagnostics';

// ============================================================================
// Props
// ============================================================================

interface ContextHealthPanelProps {
  health: CompanyContextHealth;
  companyId: string;
  compact?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextHealthPanel({
  health,
  companyId,
  compact = false,
}: ContextHealthPanelProps) {
  const [expanded, setExpanded] = useState(!compact);

  const statusConfig = {
    healthy: {
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      label: 'Healthy',
    },
    degraded: {
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      label: 'Degraded',
    },
    needs_attention: {
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      label: 'Needs Attention',
    },
  };

  const config = statusConfig[health.overallStatus];
  const StatusIcon = config.icon;

  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`w-full p-3 rounded-lg border ${config.border} ${config.bg} flex items-center justify-between hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${config.color}`} />
          <span className="text-sm font-medium text-slate-200">
            Context Health: {config.label}
          </span>
          <span className="text-xs text-slate-400">
            ({health.criticalPopulated}/{health.criticalFields} critical fields)
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden`}>
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => compact && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-5 h-5 ${config.color}`} />
          <div>
            <h3 className="font-semibold text-slate-100">Context Health</h3>
            <p className="text-xs text-slate-400">
              {health.criticalPopulated}/{health.criticalFields} critical fields filled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`text-lg font-bold ${config.color}`}>
              {health.criticalCompletionPercent}%
            </div>
            <div className="text-xs text-slate-500">Critical</div>
          </div>
          {compact && (
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              health.criticalCompletionPercent >= 80
                ? 'bg-emerald-500'
                : health.criticalCompletionPercent >= 50
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${health.criticalCompletionPercent}%` }}
          />
        </div>
      </div>

      {/* Section breakdown */}
      <div className="px-4 pb-4">
        <div className="text-xs text-slate-400 mb-2">Section Breakdown</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {health.sectionHealth
            .filter(s => s.totalFields > 0)
            .slice(0, 8)
            .map((section) => (
              <SectionHealthCard key={section.section} section={section} />
            ))}
        </div>
      </div>

      {/* Missing critical fields */}
      {health.missingCriticalFields.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs text-slate-400 mb-2">Missing Critical Fields</div>
          <div className="flex flex-wrap gap-1">
            {health.missingCriticalFields.slice(0, 6).map((field) => (
              <span
                key={field.path}
                className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30"
              >
                {field.label}
              </span>
            ))}
            {health.missingCriticalFields.length > 6 && (
              <span className="text-xs px-2 py-1 text-slate-500">
                +{health.missingCriticalFields.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recommended actions */}
      {health.recommendedNextActions.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs text-slate-400 mb-2">Fix Next</div>
          <div className="space-y-1">
            {health.recommendedNextActions.slice(0, 3).map((action, idx) => (
              <Link
                key={idx}
                href={`/c/${companyId}${action.path}`}
                className={`flex items-center justify-between p-2 rounded text-sm hover:bg-slate-800/50 transition-colors ${
                  action.priority === 'high'
                    ? 'text-red-400'
                    : action.priority === 'medium'
                    ? 'text-amber-400'
                    : 'text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  {action.action}
                </span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Section Health Card
// ============================================================================

function SectionHealthCard({ section }: { section: SectionHealthStats }) {
  const percent = section.criticalFields > 0
    ? section.criticalCompletionPercent
    : section.completionPercent;

  const color =
    percent >= 80
      ? 'text-emerald-400'
      : percent >= 50
      ? 'text-amber-400'
      : 'text-red-400';

  const bgColor =
    percent >= 80
      ? 'bg-emerald-500'
      : percent >= 50
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <div className="p-2 rounded bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-300 truncate">{section.label}</span>
        <span className={`text-xs font-medium ${color}`}>{percent}%</span>
      </div>
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${bgColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {section.criticalFields > 0 && (
        <div className="text-[10px] text-slate-500 mt-1">
          {section.criticalPopulated}/{section.criticalFields} critical
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Lab Gating Warning Banner
// ============================================================================

interface LabGatingBannerProps {
  flowId: string;
  gatingLevel: 'none' | 'soft' | 'hard';
  warningMessage?: string;
  missingFields: Array<{ label: string; path: string }>;
  companyId: string;
}

export function LabGatingBanner({
  flowId,
  gatingLevel,
  warningMessage,
  missingFields,
  companyId,
}: LabGatingBannerProps) {
  if (gatingLevel === 'none') return null;

  const isHard = gatingLevel === 'hard';

  return (
    <div
      className={`p-4 rounded-lg border ${
        isHard
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-amber-500/10 border-amber-500/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {isHard ? (
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <h4
            className={`font-medium ${
              isHard ? 'text-red-400' : 'text-amber-400'
            }`}
          >
            {isHard ? 'Cannot Run' : 'Low Confidence Warning'}
          </h4>
          <p className="text-sm text-slate-300 mt-1">{warningMessage}</p>

          {missingFields.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-slate-400 mb-1">
                Missing fields:
              </div>
              <div className="flex flex-wrap gap-1">
                {missingFields.map((field) => (
                  <span
                    key={field.path}
                    className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300"
                  >
                    {field.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Link
            href={`/c/${companyId}/brain/setup`}
            className={`inline-flex items-center gap-1 mt-3 text-sm font-medium ${
              isHard
                ? 'text-red-400 hover:text-red-300'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            Go to Setup
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Inline Field Checklist
// ============================================================================

interface FieldChecklistProps {
  requiredFields: Array<{ label: string; path: string; populated: boolean }>;
  compact?: boolean;
}

export function FieldChecklist({ requiredFields, compact = false }: FieldChecklistProps) {
  const populated = requiredFields.filter(f => f.populated);
  const missing = requiredFields.filter(f => !f.populated);

  if (requiredFields.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400">Context:</span>
        <span className="text-emerald-400">{populated.length} ready</span>
        {missing.length > 0 && (
          <>
            <span className="text-slate-500">/</span>
            <span className="text-amber-400">{missing.length} missing</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <div className="text-xs text-slate-400 mb-2">
        For best results, consider filling:
      </div>
      <div className="flex flex-wrap gap-1">
        {requiredFields.map((field) => (
          <span
            key={field.path}
            className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
              field.populated
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {field.populated ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
            {field.label}
          </span>
        ))}
      </div>
    </div>
  );
}
