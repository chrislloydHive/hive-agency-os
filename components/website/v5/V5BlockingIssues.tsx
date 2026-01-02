'use client';
// components/website/v5/V5BlockingIssues.tsx
// V5 Blocking Issues - Ranked cards with page-anchored issues and concrete fixes

import type { V5BlockingIssue, V5PersonaType } from '@/lib/types/websiteLabV5';
import { PERSONA_LABELS } from '@/lib/types/websiteLabV5';

type Props = {
  issues: V5BlockingIssue[];
};

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { label: 'High', bg: 'bg-red-500/20', text: 'text-red-300', ring: 'ring-red-500/50' },
    medium: { label: 'Medium', bg: 'bg-amber-500/20', text: 'text-amber-300', ring: 'ring-amber-500/50' },
    low: { label: 'Low', bg: 'bg-blue-500/20', text: 'text-blue-300', ring: 'ring-blue-500/50' },
  };

  const { label, bg, text, ring } = config[severity];

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${bg} ${text} ring-1 ${ring}`}>
      {label}
    </span>
  );
}

function PersonaChip({ persona }: { persona: V5PersonaType }) {
  const label = PERSONA_LABELS[persona] || persona.replace(/_/g, ' ');
  return (
    <span className="px-2 py-0.5 rounded text-xs bg-slate-700/50 text-slate-300">
      {label}
    </span>
  );
}

function IssueCard({ issue, rank }: { issue: V5BlockingIssue; rank: number }) {
  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-slate-400">#{rank}</span>
          <SeverityBadge severity={issue.severity} />
          <code className="text-sm font-mono text-slate-200 bg-slate-700/50 px-2 py-0.5 rounded">
            {issue.page}
          </code>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Problem */}
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Problem
          </h4>
          <p className="text-sm text-slate-200">
            {issue.whyItBlocks}
          </p>
        </div>

        {/* Affected Personas */}
        {issue.affectedPersonas?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Affects
            </h4>
            <div className="flex flex-wrap gap-1">
              {issue.affectedPersonas.map((persona) => (
                <PersonaChip key={persona} persona={persona} />
              ))}
            </div>
          </div>
        )}

        {/* Fix */}
        <div className="border-t border-slate-700/50 pt-4">
          <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-2">
            Recommended Fix
          </h4>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
            <p className="text-sm text-slate-200 font-medium mb-1">
              {issue.concreteFix.what}
            </p>
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">Location:</span> {issue.concreteFix.where}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function V5BlockingIssues({ issues }: Props) {
  if (!issues || issues.length === 0) {
    return (
      <div className="border border-slate-700 rounded-lg bg-slate-800/30 p-6 text-center">
        <div className="text-emerald-400 text-lg mb-2">✓</div>
        <p className="text-slate-400">No blocking issues identified.</p>
        <p className="text-sm text-slate-500 mt-1">
          The website appears to have no critical conversion blockers.
        </p>
      </div>
    );
  }

  // Sort by severity for consistent display
  const sortedIssues = [...issues].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  // Count by severity
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          Blocking Issues
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({issues.length} found)
          </span>
        </h3>
        <div className="flex items-center gap-3 text-xs">
          {highCount > 0 && (
            <span className="text-red-400">{highCount} high</span>
          )}
          {mediumCount > 0 && (
            <span className="text-amber-400">{mediumCount} medium</span>
          )}
          {lowCount > 0 && (
            <span className="text-blue-400">{lowCount} low</span>
          )}
        </div>
      </div>

      {/* Issue cards */}
      <div className="space-y-4">
        {sortedIssues.map((issue, i) => (
          <IssueCard key={issue.id} issue={issue} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
