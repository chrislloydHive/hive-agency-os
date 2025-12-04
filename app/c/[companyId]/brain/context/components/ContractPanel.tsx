'use client';

// app/c/[companyId]/context/components/ContractPanel.tsx
// Contract Status Panel Component
//
// Shows required and recommended fields per domain with completion status.
// Triggers AI healing for missing fields.

import { useState, useMemo } from 'react';
import type { ContractStatus, ContractViolation, GraphContractStatus } from '@/lib/contextGraph/governance/contracts';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

interface ContractPanelProps {
  companyId: string;
  contractStatus: GraphContractStatus;
  onNavigateToField?: (path: string) => void;
  onFixMissing?: (violations: ContractViolation[]) => void;
  onRunDiagnostic?: (lab: string) => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getLabForDomain(domain: DomainName): string | null {
  const labMap: Record<string, string> = {
    brand: 'Brand Lab',
    audience: 'Audience Lab',
    performanceMedia: 'Media Lab',
    creative: 'Creative Lab',
    seo: 'SEO Lab',
    content: 'Content Lab',
    website: 'Website Lab',
    identity: 'Company Setup',
    objectives: 'Strategy Lab',
    digitalInfra: 'Analytics Lab',
  };
  return labMap[domain] ?? null;
}

function getCompletionColor(percent: number): string {
  if (percent >= 90) return 'text-emerald-400';
  if (percent >= 70) return 'text-amber-400';
  return 'text-red-400';
}

// ============================================================================
// Main Component
// ============================================================================

export function ContractPanel({
  companyId,
  contractStatus,
  onNavigateToField,
  onFixMissing,
  onRunDiagnostic,
}: ContractPanelProps) {
  const [expandedDomains, setExpandedDomains] = useState<Set<DomainName>>(new Set());
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);

  const filteredDomains = useMemo(() => {
    const domains = contractStatus.domainStatuses;
    if (showOnlyIncomplete) {
      return domains.filter(d => !d.isComplete || d.violations.length > 0);
    }
    return domains;
  }, [contractStatus.domainStatuses, showOnlyIncomplete]);

  const toggleDomain = (domain: DomainName) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const requiredViolations = contractStatus.domainStatuses
    .flatMap(d => d.violations)
    .filter(v => v.type === 'missing_required' || v.type === 'conditional_missing');

  return (
    <div className="space-y-4">
      {/* Header with Overall Status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-100">Contract Status</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className={cn(
              'text-lg font-semibold',
              getCompletionColor(contractStatus.completenessScore)
            )}>
              {contractStatus.completenessScore}%
            </span>
            <span className="text-[11px] text-slate-500">
              {contractStatus.overallComplete ? 'Complete' : `${contractStatus.criticalViolations} required fields missing`}
            </span>
          </div>
        </div>

        {/* Fix All Button */}
        {requiredViolations.length > 0 && onFixMissing && (
          <button
            onClick={() => onFixMissing(requiredViolations)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              'bg-amber-500 hover:bg-amber-400 text-slate-900'
            )}
          >
            Fix {requiredViolations.length} Missing
          </button>
        )}
      </div>

      {/* Filter Toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showOnlyIncomplete}
          onChange={(e) => setShowOnlyIncomplete(e.target.checked)}
          className="h-3 w-3 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
        />
        <span className="text-[11px] text-slate-400">Show only incomplete</span>
      </label>

      {/* Domain List */}
      <div className="space-y-2">
        {filteredDomains.map((domainStatus) => {
          const isExpanded = expandedDomains.has(domainStatus.domain);
          const percent = domainStatus.requiredTotal > 0
            ? Math.round((domainStatus.requiredMet / domainStatus.requiredTotal) * 100)
            : 100;
          const lab = getLabForDomain(domainStatus.domain);
          const hasViolations = domainStatus.violations.length > 0;

          return (
            <div
              key={domainStatus.domain}
              className={cn(
                'rounded-lg border overflow-hidden',
                domainStatus.isComplete
                  ? 'border-slate-800 bg-slate-900/30'
                  : 'border-amber-500/30 bg-amber-500/5'
              )}
            >
              {/* Domain Header */}
              <button
                onClick={() => toggleDomain(domainStatus.domain)}
                className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {/* Status Indicator */}
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      domainStatus.isComplete ? 'bg-emerald-500' : 'bg-amber-500'
                    )}
                  />
                  <span className="text-sm font-medium text-slate-100 capitalize">
                    {domainStatus.domain.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          percent >= 100 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className={cn('text-xs font-medium w-8', getCompletionColor(percent))}>
                      {percent}%
                    </span>
                  </div>

                  {/* Expand Icon */}
                  <svg
                    className={cn(
                      'w-4 h-4 text-slate-500 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-slate-800/50">
                  {/* Stats */}
                  <div className="pt-3 flex items-center gap-4 text-[11px] text-slate-500">
                    <span>
                      Required: {domainStatus.requiredMet}/{domainStatus.requiredTotal}
                    </span>
                    <span>
                      Recommended: {domainStatus.recommendedMet}/{domainStatus.recommendedTotal}
                    </span>
                  </div>

                  {/* Violations */}
                  {hasViolations && (
                    <div className="mt-3 space-y-2">
                      {domainStatus.violations.map((violation, idx) => (
                        <div
                          key={`${violation.path}-${idx}`}
                          className={cn(
                            'rounded-md px-2.5 py-2 text-xs',
                            violation.severity === 'error'
                              ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                              : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{violation.message}</p>
                              <button
                                onClick={() => onNavigateToField?.(violation.path)}
                                className="text-[10px] font-mono text-slate-500 hover:text-slate-300 mt-0.5"
                              >
                                {violation.path}
                              </button>
                            </div>
                            {violation.severity === 'error' && (
                              <span className="flex-shrink-0 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-medium text-red-300">
                                Required
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Run Lab Button */}
                  {lab && hasViolations && onRunDiagnostic && (
                    <button
                      onClick={() => onRunDiagnostic(lab)}
                      className={cn(
                        'mt-3 w-full px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        'border border-slate-700 text-slate-300 hover:bg-slate-800'
                      )}
                    >
                      Run {lab} to populate fields
                    </button>
                  )}

                  {/* All Complete */}
                  {!hasViolations && domainStatus.isComplete && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      All contract requirements met
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredDomains.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center">
          <p className="text-sm text-slate-500">All domains are complete!</p>
        </div>
      )}
    </div>
  );
}

export default ContractPanel;
