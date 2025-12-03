// components/os/blueprint/BlueprintStartHere.tsx
// "Start Here" attention focus card at top of left column
// Shows critical issues and top opportunities to guide strategists

'use client';

import type {
  CompanyStrategicSnapshot,
  StrategySynthesis,
  BlueprintPipelineData,
  PrioritizedAction,
} from './types';
import { dedupeIssues, dedupeOpportunities } from './utils';

interface BlueprintStartHereProps {
  strategySnapshot: CompanyStrategicSnapshot | null;
  strategySynthesis?: StrategySynthesis | null;
  pipelineData?: BlueprintPipelineData | null;
}

interface HighlightItem {
  type: 'issue' | 'opportunity';
  title: string;
  description?: string;
  severity?: string;
  impact?: string;
  effort?: string;
  area?: string;
}

/**
 * Extract top items for "Start Here" card
 * - Critical/high severity issues first
 * - High impact, low effort opportunities
 */
function extractHighlights(
  strategySnapshot: CompanyStrategicSnapshot | null,
  strategySynthesis?: StrategySynthesis | null,
  pipelineData?: BlueprintPipelineData | null
): HighlightItem[] {
  const highlights: HighlightItem[] = [];

  // 1. Get critical issues from pipeline (deduplicated)
  const issues = pipelineData?.diagnostics?.issues || [];
  const dedupedIssues = dedupeIssues(issues);
  const criticalIssues = dedupedIssues.filter(
    (i) => i.severity === 'critical' || i.severity === 'high'
  );

  // Add top 2 critical issues
  criticalIssues.slice(0, 2).forEach((issue) => {
    highlights.push({
      type: 'issue',
      title: issue.title,
      description: issue.description,
      severity: issue.severity,
      area: issue.area,
    });
  });

  // 2. Get top opportunities from synthesis (deduplicated)
  const actions = strategySynthesis?.prioritizedActions || [];
  const dedupedActions = dedupeOpportunities(actions);
  // Sort by impact (high first) then effort (low first)
  const impactOrder = { high: 0, medium: 1, low: 2 };
  const effortOrder = { low: 0, medium: 1, high: 2 };

  const sortedActions = [...dedupedActions].sort((a, b) => {
    const impactDiff = (impactOrder[a.impact] || 2) - (impactOrder[b.impact] || 2);
    if (impactDiff !== 0) return impactDiff;
    return (effortOrder[a.effort] || 1) - (effortOrder[b.effort] || 1);
  });

  // Add top 2 high-impact opportunities (prefer low effort)
  const topOpps = sortedActions
    .filter((a) => a.impact === 'high')
    .slice(0, 2);

  topOpps.forEach((action) => {
    highlights.push({
      type: 'opportunity',
      title: action.title,
      description: action.description,
      impact: action.impact,
      effort: action.effort,
      area: action.area,
    });
  });

  // Fallback: Use keyGaps from strategySnapshot if no issues found
  if (highlights.filter((h) => h.type === 'issue').length === 0 && strategySnapshot?.keyGaps?.length) {
    strategySnapshot.keyGaps.slice(0, 2).forEach((gap) => {
      highlights.push({
        type: 'issue',
        title: gap,
        severity: 'high',
      });
    });
  }

  return highlights.slice(0, 4); // Max 4 items total
}

function IssueItem({ item }: { item: HighlightItem }) {
  const severityColors = {
    critical: 'bg-red-500/20 text-red-300 border-red-500/30',
    high: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  const colorClass = severityColors[item.severity as keyof typeof severityColors] || severityColors.medium;

  return (
    <div className="flex items-start gap-2">
      <div className="flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 font-medium">{item.title}</p>
        {item.area && (
          <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded border mt-1 ${colorClass}`}>
            {item.area}
          </span>
        )}
      </div>
    </div>
  );
}

function OpportunityItem({ item }: { item: HighlightItem }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 font-medium">{item.title}</p>
        <div className="flex items-center gap-2 mt-1">
          {item.impact && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {item.impact} impact
            </span>
          )}
          {item.effort && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/30">
              {item.effort} effort
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function BlueprintStartHere({
  strategySnapshot,
  strategySynthesis,
  pipelineData,
}: BlueprintStartHereProps) {
  const highlights = extractHighlights(strategySnapshot, strategySynthesis, pipelineData);

  // Don't show if no highlights
  if (highlights.length === 0) {
    return null;
  }

  const issues = highlights.filter((h) => h.type === 'issue');
  const opportunities = highlights.filter((h) => h.type === 'opportunity');

  return (
    <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-slate-800/50 to-emerald-500/10 border border-amber-500/20 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-amber-300">Start Here</h3>
          <p className="text-[10px] text-slate-400">Top priorities based on your diagnostics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Critical Issues */}
        {issues.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Fix First</p>
            <div className="space-y-3">
              {issues.map((item, idx) => (
                <IssueItem key={`issue-${idx}`} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Quick Wins */}
        {opportunities.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Quick Wins</p>
            <div className="space-y-3">
              {opportunities.map((item, idx) => (
                <OpportunityItem key={`opp-${idx}`} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
