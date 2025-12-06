'use client';

// app/c/[companyId]/brain/context/explorer/ExplorerSearchResults.tsx
// Search results dropdown for the explorer

import { memo } from 'react';
import { Circle, RefreshCw, ChevronRight } from 'lucide-react';
import type { GraphFieldUi, ContextDomainId } from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';

// ============================================================================
// Types
// ============================================================================

interface ExplorerSearchResultsProps {
  results: GraphFieldUi[];
  onSelect: (field: GraphFieldUi) => void;
  needsRefreshPaths: Set<string>;
}

// ============================================================================
// Domain Colors
// ============================================================================

const DOMAIN_COLORS: Record<string, string> = {
  identity: '#f59e0b',
  brand: '#8b5cf6',
  audience: '#ec4899',
  productOffer: '#10b981',
  competitive: '#ef4444',
  website: '#3b82f6',
  content: '#6366f1',
  seo: '#14b8a6',
  performanceMedia: '#f97316',
  creative: '#a855f7',
  objectives: '#06b6d4',
  ops: '#64748b',
  digitalInfra: '#475569',
  budgetOps: '#84cc16',
  historical: '#78716c',
  operationalConstraints: '#94a3b8',
  storeRisk: '#fbbf24',
  historyRefs: '#9ca3af',
};

// ============================================================================
// Component
// ============================================================================

export const ExplorerSearchResults = memo(function ExplorerSearchResults({
  results,
  onSelect,
  needsRefreshPaths,
}: ExplorerSearchResultsProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="max-h-80 overflow-y-auto">
        {results.map(field => {
          const domainMeta = CONTEXT_DOMAIN_META[field.domain as ContextDomainId];
          const domainColor = DOMAIN_COLORS[field.domain] || '#64748b';
          const hasValue = field.value !== null && field.value !== '';
          const needsRefresh = needsRefreshPaths.has(field.path);

          return (
            <button
              key={field.path}
              onClick={() => onSelect(field)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-b-0"
            >
              {/* Domain indicator */}
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: domainColor }}
              />

              {/* Field info */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200 truncate">
                    {field.label}
                  </span>
                  {needsRefresh && (
                    <RefreshCw className="w-3 h-3 text-orange-400 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-slate-500">
                    {domainMeta?.label || field.domain}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span className="text-[10px] text-slate-600 truncate">
                    {field.path}
                  </span>
                </div>
              </div>

              {/* Value preview */}
              <div className="shrink-0 max-w-[200px]">
                {hasValue ? (
                  <span className="text-xs text-slate-400 truncate block">
                    {field.value && field.value.length > 40
                      ? field.value.substring(0, 40) + '...'
                      : field.value}
                  </span>
                ) : (
                  <span className="text-xs text-slate-600 italic">Empty</span>
                )}
              </div>

              {/* Completeness dot */}
              <Circle
                className={`w-2 h-2 shrink-0 ${
                  hasValue ? 'text-emerald-400' : 'text-slate-600'
                }`}
                fill="currentColor"
              />
            </button>
          );
        })}
      </div>

      {results.length === 10 && (
        <div className="px-4 py-2 bg-slate-700/30 text-xs text-slate-500 text-center">
          Showing first 10 results. Type more to narrow down.
        </div>
      )}
    </div>
  );
});
