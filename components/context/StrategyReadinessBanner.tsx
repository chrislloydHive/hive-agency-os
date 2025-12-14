// components/context/StrategyReadinessBanner.tsx
// Strategy Readiness Banner
//
// Shows whether the context is "Strategy-Ready" based on SRM criteria.
// Does NOT block editing - purely informational.
//
// Supports two modes:
// 1. Full Context Graph mode (graph prop) - uses full SRM checker
// 2. CompanyContext mode (context prop) - uses lightweight mapping

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { CompanyContext } from '@/lib/types/context';
import {
  isStrategyReady,
  type StrategyReadinessResult,
  type MissingSrmField,
  type StaleSrmField,
} from '@/lib/contextGraph/readiness';
import { getFixBlockersLink } from '@/lib/os/strategy/strategyInputsHelpers';

// ============================================================================
// Types
// ============================================================================

interface StrategyReadinessBannerProps {
  /** The full Context Graph to check (preferred) */
  graph?: CompanyContextGraph | null;
  /** The CompanyContext to check (fallback for flat context) */
  context?: CompanyContext | null;
  /** Company ID for Fix button deep linking */
  companyId?: string;
  /** Optional: Compact mode for smaller displays */
  compact?: boolean;
  /** Optional: Show Fix button when not ready */
  showFixButton?: boolean;
}

// ============================================================================
// SRM Mapping for CompanyContext (flat structure)
// ============================================================================

/**
 * SRM requirements mapped to CompanyContext fields
 * CANONICALIZATION: Removed objectives check - objectives belong in Strategy, not Context
 */
const CONTEXT_SRM_REQUIREMENTS = [
  {
    label: 'Business Model',
    reason: 'Strategy must understand how the business makes money',
    check: (ctx: CompanyContext) => Boolean(ctx.businessModel?.trim()),
  },
  {
    label: 'Primary Audience',
    reason: 'Strategy must target a defined audience',
    check: (ctx: CompanyContext) => Boolean(ctx.primaryAudience?.trim()),
  },
  {
    label: 'Audience Description',
    reason: 'Strategy needs audience context beyond just a name',
    check: (ctx: CompanyContext) => Boolean(ctx.icpDescription?.trim()),
  },
  {
    label: 'Value Proposition',
    reason: 'Strategy must articulate why customers choose you',
    check: (ctx: CompanyContext) => Boolean(ctx.valueProposition?.trim()),
  },
  // NOTE: Marketing Objectives REMOVED - objectives belong in Strategy, not Context
  // Per canonicalization doctrine, goals/objectives are set IN Strategy, not as Context inputs
  {
    label: 'Budget',
    reason: 'Strategy must operate within budget realities',
    check: (ctx: CompanyContext) => Boolean(ctx.budget?.trim()),
  },
  {
    label: 'Competitors',
    reason: 'Strategy needs competitive context',
    check: (ctx: CompanyContext) => Boolean(ctx.competitors && ctx.competitors.length > 0),
  },
] as const;

/**
 * Check SRM requirements against a CompanyContext (flat structure)
 */
function checkContextSrm(context: CompanyContext): StrategyReadinessResult {
  const missing: MissingSrmField[] = [];
  let presentCount = 0;

  for (const req of CONTEXT_SRM_REQUIREMENTS) {
    if (req.check(context)) {
      presentCount++;
    } else {
      missing.push({
        domain: 'context',
        fieldPath: req.label.toLowerCase().replace(/\s+/g, '_'),
        reason: req.reason,
        label: req.label,
      });
    }
  }

  const totalRequired = CONTEXT_SRM_REQUIREMENTS.length;
  const completenessPercent = Math.round((presentCount / totalRequired) * 100);

  return {
    ready: missing.length === 0,
    missing,
    stale: [], // CompanyContext doesn't have provenance for staleness checking
    presentCount,
    totalRequired,
    completenessPercent,
  };
}

// ============================================================================
// Component
// ============================================================================

export function StrategyReadinessBanner({
  graph,
  context,
  companyId,
  compact = false,
  showFixButton = true,
}: StrategyReadinessBannerProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate readiness - prefer graph, fallback to context
  const result = useMemo<StrategyReadinessResult | null>(() => {
    if (graph) {
      return isStrategyReady(graph);
    }
    if (context) {
      return checkContextSrm(context);
    }
    return null;
  }, [graph, context]);

  // Get blocked keys for Fix button deep link
  const blockedKeys = useMemo(() => {
    if (!result) return [];
    return result.missing.map(m => `${m.domain}.${m.fieldPath}`);
  }, [result]);

  // Build Fix button URL
  const fixUrl = useMemo(() => {
    if (!companyId || blockedKeys.length === 0) return null;
    return getFixBlockersLink(companyId, blockedKeys);
  }, [companyId, blockedKeys]);

  // No data = don't render
  if (!result) {
    return null;
  }

  const { ready, missing, stale, presentCount, totalRequired, completenessPercent } = result;

  // Determine status color and icon
  const isFullyReady = ready && stale.length === 0;
  const needsReview = ready && stale.length > 0;

  const statusColor = isFullyReady
    ? 'text-emerald-400'
    : needsReview
    ? 'text-amber-400'
    : 'text-red-400';

  const bgColor = isFullyReady
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : needsReview
    ? 'bg-amber-500/10 border-amber-500/20'
    : 'bg-red-500/10 border-red-500/20';

  const StatusIcon = isFullyReady ? CheckCircle : needsReview ? Clock : AlertCircle;

  // Status text
  const statusText = isFullyReady
    ? 'Strategy-Ready'
    : needsReview
    ? `Strategy-Ready (${stale.length} field${stale.length > 1 ? 's' : ''} stale)`
    : `Not Strategy-Ready (${missing.length} missing)`;

  // Compact mode - just show status
  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgColor}`}>
        <StatusIcon className={`w-4 h-4 ${statusColor}`} />
        <span className={`text-sm font-medium ${statusColor}`}>{statusText}</span>
        {showFixButton && fixUrl && !isFullyReady && (
          <Link
            href={fixUrl}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded transition-colors ml-2"
          >
            <Wrench className="w-3 h-3" />
            Fix
          </Link>
        )}
      </div>
    );
  }

  // Full banner
  return (
    <div className={`rounded-lg border ${bgColor} overflow-hidden`}>
      {/* Header - always visible */}
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 hover:bg-white/5 transition-colors flex-1 text-left"
        >
          <StatusIcon className={`w-5 h-5 ${statusColor}`} />
          <div className="text-left">
            <span className={`text-sm font-medium ${statusColor}`}>{statusText}</span>
            <span className="text-xs text-slate-500 ml-2">
              ({presentCount}/{totalRequired} fields • {completenessPercent}%)
            </span>
          </div>
          {(missing.length > 0 || stale.length > 0) && (
            expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
            )
          )}
        </button>

        {/* Fix Button */}
        {showFixButton && fixUrl && !isFullyReady && (
          <Link
            href={fixUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg transition-colors ml-3"
          >
            <Wrench className="w-3.5 h-3.5" />
            Fix {missing.length > 1 ? `${missing.length} fields` : ''}
          </Link>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (missing.length > 0 || stale.length > 0) && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          {/* Missing fields */}
          {missing.length > 0 && (
            <div className="pt-3">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Missing Required Fields
              </h4>
              <ul className="space-y-1.5">
                {missing.map((field) => (
                  <MissingFieldItem key={`${field.domain}.${field.fieldPath}`} field={field} />
                ))}
              </ul>
            </div>
          )}

          {/* Stale fields */}
          {stale.length > 0 && (
            <div className={missing.length > 0 ? 'pt-2' : 'pt-3'}>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Stale Fields (Needs Review)
              </h4>
              <ul className="space-y-1.5">
                {stale.map((field) => (
                  <StaleFieldItem key={`${field.domain}.${field.fieldPath}`} field={field} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function MissingFieldItem({ field }: { field: MissingSrmField }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
      <div>
        <span className="text-slate-200">{field.label}</span>
        <span className="text-slate-500 ml-1.5">— {field.reason}</span>
      </div>
    </li>
  );
}

function StaleFieldItem({ field }: { field: StaleSrmField }) {
  const ageDays = Math.round(field.freshness.ageDays);
  return (
    <li className="flex items-start gap-2 text-sm">
      <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div>
        <span className="text-slate-200">{field.label}</span>
        <span className="text-slate-500 ml-1.5">
          — Last updated {ageDays} day{ageDays !== 1 ? 's' : ''} ago
        </span>
      </div>
    </li>
  );
}

export default StrategyReadinessBanner;
