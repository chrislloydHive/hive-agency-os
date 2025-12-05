'use client';

// app/c/[companyId]/brain/context/components/ContextDiagnosticsDrawer.tsx
// Diagnostics Drawer for Context Graph health and issues
//
// Shows:
// - Context health summary
// - Missing critical fields
// - Conflicts from diagnostics
// - Recommended Labs to run next

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { ContextHealthScore, SectionScore } from '@/lib/contextGraph/health';
import type { GraphSanityReport, DiagnosticIssue } from '@/lib/contextGraph/diagnostics';
import type { ContextFieldDef, WriterModuleId } from '@/lib/contextGraph/schema';

// ============================================================================
// Types
// ============================================================================

interface ContextDiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  healthScore: ContextHealthScore | null;
  diagnostics: GraphSanityReport | null;
  isLoading?: boolean;
}

interface LabRecommendation {
  labId: string;
  labName: string;
  path: string;
  reason: string;
  fieldsToFill: number;
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// Helper Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getSeverityColor(severity: 'healthy' | 'degraded' | 'unhealthy'): {
  bg: string;
  text: string;
  border: string;
} {
  switch (severity) {
    case 'healthy':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'degraded':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
    case 'unhealthy':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getLabPath(labId: WriterModuleId, companyId: string): string {
  const labPaths: Record<string, string> = {
    Setup: `/c/${companyId}/brain/setup`,
    GAP: `/c/${companyId}/gap`,
    GAPHeavy: `/c/${companyId}/gap`,
    WebsiteLab: `/c/${companyId}/diagnostics/website-lab`,
    BrandLab: `/c/${companyId}/diagnostics/brand`,
    AudienceLab: `/c/${companyId}/diagnostics/audience`,
    MediaLab: `/c/${companyId}/diagnostics/media`,
    CreativeLab: `/c/${companyId}/labs/creative`,
    ContentLab: `/c/${companyId}/diagnostics/content`,
    SEOLab: `/c/${companyId}/diagnostics/seo`,
    DemandLab: `/c/${companyId}/diagnostics/demand`,
    OpsLab: `/c/${companyId}/diagnostics/ops`,
    StrategicPlan: `/c/${companyId}/strategy`,
    QBR: `/c/${companyId}/qbr`,
  };
  return labPaths[labId] || `/c/${companyId}/brain/setup`;
}

function getLabDisplayName(labId: WriterModuleId): string {
  const labNames: Record<string, string> = {
    Setup: 'Setup Wizard',
    GAP: 'GAP IA',
    GAPHeavy: 'GAP Heavy',
    WebsiteLab: 'Website Lab',
    BrandLab: 'Brand Lab',
    AudienceLab: 'Audience Lab',
    MediaLab: 'Media Lab',
    CreativeLab: 'Creative Lab',
    ContentLab: 'Content Lab',
    SEOLab: 'SEO Lab',
    DemandLab: 'Demand Lab',
    OpsLab: 'Ops Lab',
    StrategicPlan: 'Strategic Plan',
    QBR: 'QBR',
    Manual: 'Manual Entry',
    Analytics: 'Analytics',
    ICPExtractor: 'ICP Extractor',
  };
  return labNames[labId] || labId;
}

function computeLabRecommendations(
  missingFields: ContextFieldDef[],
  companyId: string
): LabRecommendation[] {
  // Group missing fields by their primary sources
  const fieldsByLab = new Map<WriterModuleId, ContextFieldDef[]>();

  for (const field of missingFields) {
    for (const source of field.primarySources) {
      if (!fieldsByLab.has(source)) {
        fieldsByLab.set(source, []);
      }
      fieldsByLab.get(source)!.push(field);
    }
  }

  // Convert to recommendations sorted by field count
  const recommendations: LabRecommendation[] = [];

  for (const [labId, fields] of fieldsByLab) {
    const criticalCount = fields.filter(f => f.critical).length;
    let priority: 'high' | 'medium' | 'low' = 'low';
    if (criticalCount >= 3) priority = 'high';
    else if (criticalCount >= 1) priority = 'medium';

    recommendations.push({
      labId,
      labName: getLabDisplayName(labId),
      path: getLabPath(labId, companyId),
      reason: `Can fill ${fields.length} field${fields.length > 1 ? 's' : ''} (${criticalCount} critical)`,
      fieldsToFill: fields.length,
      priority,
    });
  }

  // Sort by priority then by fields count
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.fieldsToFill - a.fieldsToFill;
  });

  return recommendations.slice(0, 5);
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextDiagnosticsDrawer({
  isOpen,
  onClose,
  companyId,
  healthScore,
  diagnostics,
  isLoading,
}: ContextDiagnosticsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'health' | 'missing' | 'issues' | 'recommendations'>('health');

  // Compute lab recommendations from missing critical fields
  const labRecommendations = healthScore
    ? computeLabRecommendations(healthScore.missingCriticalFields, companyId)
    : [];

  if (!isOpen) return null;

  const severityColors = healthScore
    ? getSeverityColor(healthScore.severity)
    : getSeverityColor('unhealthy');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-xl bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Context Diagnostics
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Health, issues, and recommendations
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-2">
          {[
            { id: 'health', label: 'Health' },
            { id: 'missing', label: `Missing (${healthScore?.missingCriticalFields.length || 0})` },
            { id: 'issues', label: `Issues (${diagnostics?.allIssues.length || 0})` },
            { id: 'recommendations', label: 'Recommendations' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'px-4 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-amber-300 border-b-2 border-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin mb-4" />
              <p className="text-sm text-slate-400">Loading diagnostics...</p>
            </div>
          ) : (
            <>
              {/* Health Tab */}
              {activeTab === 'health' && healthScore && (
                <div className="space-y-6">
                  {/* Overall Score */}
                  <div className={cn(
                    'rounded-lg border p-4',
                    severityColors.bg,
                    severityColors.border
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wide">
                          Overall Health
                        </div>
                        <div className={cn('text-3xl font-bold', severityColors.text)}>
                          {healthScore.overallScore}
                        </div>
                      </div>
                      <div className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium',
                        severityColors.bg,
                        severityColors.text,
                        severityColors.border,
                        'border'
                      )}>
                        {healthScore.severity === 'healthy' ? 'Healthy' :
                         healthScore.severity === 'degraded' ? 'Needs Improvement' :
                         'Weak / Incomplete'}
                      </div>
                    </div>
                  </div>

                  {/* Sub-scores */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Completeness', score: healthScore.completenessScore },
                      { label: 'Critical Coverage', score: healthScore.criticalCoverageScore },
                      { label: 'Freshness', score: healthScore.freshnessScore },
                      { label: 'Confidence', score: healthScore.confidenceScore },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                      >
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                          {item.label}
                        </div>
                        <div className={cn('text-xl font-semibold', getScoreColor(item.score))}>
                          {item.score}%
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                    <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-3">
                      Statistics
                    </h3>
                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                      <div className="text-slate-400">Total Fields</div>
                      <div className="text-slate-200 text-right">{healthScore.stats.totalFields}</div>
                      <div className="text-slate-400">Populated</div>
                      <div className="text-slate-200 text-right">{healthScore.stats.populatedFields}</div>
                      <div className="text-slate-400">Critical Fields</div>
                      <div className="text-slate-200 text-right">{healthScore.stats.criticalFields}</div>
                      <div className="text-slate-400">Critical Populated</div>
                      <div className="text-slate-200 text-right">{healthScore.stats.criticalPopulated}</div>
                      <div className="text-slate-400">Stale Fields</div>
                      <div className={cn(
                        'text-right',
                        healthScore.stats.staleFields > 0 ? 'text-amber-400' : 'text-slate-200'
                      )}>
                        {healthScore.stats.staleFields}
                      </div>
                    </div>
                  </div>

                  {/* Section Scores */}
                  <div>
                    <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-3">
                      Section Breakdown
                    </h3>
                    <div className="space-y-2">
                      {healthScore.sectionScores.map((section) => (
                        <div
                          key={section.section}
                          className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-200">{section.label}</span>
                            <span className={cn(
                              'text-xs font-medium',
                              getScoreColor(section.criticalCoverage)
                            )}>
                              {section.criticalCoverage}% critical
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            <span>{section.populatedFields}/{section.totalFields} fields</span>
                            <span>{section.criticalPopulated}/{section.criticalFields} critical</span>
                            {section.staleFields > 0 && (
                              <span className="text-amber-400">{section.staleFields} stale</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Missing Fields Tab */}
              {activeTab === 'missing' && healthScore && (
                <div className="space-y-3">
                  {healthScore.missingCriticalFields.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
                      <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-emerald-400">All critical fields are populated!</p>
                    </div>
                  ) : (
                    healthScore.missingCriticalFields.map((field) => (
                      <div
                        key={field.path}
                        className="rounded-lg border border-red-500/30 bg-red-500/5 p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-medium text-slate-200">{field.label}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{field.path}</div>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            CRITICAL
                          </span>
                        </div>
                        {field.primarySources.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {field.primarySources.slice(0, 3).map((source) => (
                              <Link
                                key={source}
                                href={getLabPath(source, companyId)}
                                className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                              >
                                {getLabDisplayName(source)}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Issues Tab */}
              {activeTab === 'issues' && diagnostics && (
                <div className="space-y-3">
                  {diagnostics.allIssues.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
                      <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-emerald-400">No schema/wiring issues found!</p>
                    </div>
                  ) : (
                    diagnostics.allIssues.slice(0, 20).map((issue, index) => {
                      const severityColors = {
                        error: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
                        warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
                        info: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
                      }[issue.severity];

                      return (
                        <div
                          key={`${issue.path}-${issue.type}-${index}`}
                          className={cn(
                            'rounded-lg border p-4',
                            severityColors.bg,
                            severityColors.border
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="text-xs text-slate-500 font-mono">{issue.path}</div>
                              <div className={cn('text-sm mt-1', severityColors.text)}>
                                {issue.message}
                              </div>
                            </div>
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded uppercase',
                              severityColors.bg,
                              severityColors.text,
                              severityColors.border,
                              'border'
                            )}>
                              {issue.severity}
                            </span>
                          </div>
                          {issue.suggestion && (
                            <p className="text-xs text-slate-400 mt-2 italic">
                              {issue.suggestion}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                  {diagnostics.allIssues.length > 20 && (
                    <p className="text-xs text-slate-500 text-center">
                      +{diagnostics.allIssues.length - 20} more issues
                    </p>
                  )}
                </div>
              )}

              {/* Recommendations Tab */}
              {activeTab === 'recommendations' && (
                <div className="space-y-4">
                  {labRecommendations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center">
                      <p className="text-sm text-slate-500">No recommendations at this time</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-400">
                        Run these Labs to fill missing critical fields:
                      </p>
                      {labRecommendations.map((rec) => {
                        const priorityColors = {
                          high: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
                          medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
                          low: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
                        }[rec.priority];

                        return (
                          <Link
                            key={rec.labId}
                            href={rec.path}
                            className={cn(
                              'block rounded-lg border p-4 transition-colors hover:bg-slate-800/50',
                              priorityColors.border
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-200">
                                  {rec.labName}
                                </span>
                                <span className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded uppercase',
                                  priorityColors.bg,
                                  priorityColors.text
                                )}>
                                  {rec.priority}
                                </span>
                              </div>
                              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{rec.reason}</p>
                          </Link>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContextDiagnosticsDrawer;
