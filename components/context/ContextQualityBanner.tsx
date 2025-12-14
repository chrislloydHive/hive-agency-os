// components/context/ContextQualityBanner.tsx
// Context Quality Banner - Shows strategy readiness status

'use client';

import { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import type { CompanyContext, StrategyReadinessResult } from '@/lib/types/context';
import { calculateStrategyReadiness, getFieldLabel } from '@/lib/types/context';

// ============================================================================
// Types
// ============================================================================

export interface ContextQualityBannerProps {
  context: CompanyContext;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextQualityBanner({
  context,
  className = '',
}: ContextQualityBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const readiness = calculateStrategyReadiness(context);

  const config = getStatusConfig(readiness);

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} ${className}`}>
      {/* Main banner */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${config.iconBg}`}>
            <config.Icon className={`w-4 h-4 ${config.iconColor}`} />
          </div>
          <div>
            <p className={`text-sm font-medium ${config.textColor}`}>
              {config.title}
            </p>
            <p className="text-xs text-slate-500">
              {config.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Completeness badge */}
          <span className="text-xs text-slate-400">
            {readiness.completenessScore}% complete
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-800/50">
          <div className="pt-3 space-y-3">
            {/* Missing critical fields */}
            {readiness.missingCritical.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-400 mb-1.5 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Required for strategy
                </p>
                <ul className="space-y-1">
                  {readiness.missingCritical.map(field => (
                    <li key={field} className="text-xs text-slate-400 pl-4">
                      • {getFieldLabel(field)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing recommended fields */}
            {readiness.missingRecommended.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-400 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Recommended for better quality
                </p>
                <ul className="space-y-1">
                  {readiness.missingRecommended.map(field => (
                    <li key={field} className="text-xs text-slate-400 pl-4">
                      • {getFieldLabel(field)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* All good message */}
            {readiness.status === 'ready' && readiness.missingRecommended.length === 0 && (
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-emerald-400 mt-0.5" />
                <p className="text-xs text-slate-400">
                  All key fields are filled. Context is ready for high-quality strategy generation.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

interface StatusConfig {
  Icon: typeof CheckCircle;
  title: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

function getStatusConfig(readiness: StrategyReadinessResult): StatusConfig {
  switch (readiness.status) {
    case 'ready':
      return {
        Icon: CheckCircle,
        title: 'Strategy-ready',
        subtitle: 'Context has all critical information',
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-400',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/5',
        borderColor: 'border-emerald-500/30',
      };
    case 'needs_info':
      return {
        Icon: AlertTriangle,
        title: 'Needs more info',
        subtitle: `${readiness.missingRecommended.length} recommended fields missing`,
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-400',
        textColor: 'text-amber-400',
        bgColor: 'bg-amber-500/5',
        borderColor: 'border-amber-500/30',
      };
    case 'blocked':
      return {
        Icon: XCircle,
        title: 'Missing critical info',
        subtitle: `${readiness.missingCritical.length} required fields missing`,
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-400',
        textColor: 'text-red-400',
        bgColor: 'bg-red-500/5',
        borderColor: 'border-red-500/30',
      };
  }
}

export default ContextQualityBanner;
