// components/os/blueprint/BlueprintIssuesSection.tsx
// Grouped issues/findings section with accordion-style category groups
// Shows issues from key gaps with severity badges

'use client';

import { useState } from 'react';
import { getCategoryColor } from './utils';
import type { CompanyStrategicSnapshot } from './types';

interface BlueprintIssuesSectionProps {
  strategySnapshot: CompanyStrategicSnapshot | null;
  className?: string;
}

interface GroupedIssue {
  category: string;
  issues: string[];
}

// Categorize issues by keyword detection
function categorizeIssue(issue: string): string {
  const lowerIssue = issue.toLowerCase();
  if (lowerIssue.includes('brand') || lowerIssue.includes('position') || lowerIssue.includes('messaging') || lowerIssue.includes('tagline')) {
    return 'Brand';
  }
  if (lowerIssue.includes('content') || lowerIssue.includes('copy') || lowerIssue.includes('blog') || lowerIssue.includes('article')) {
    return 'Content';
  }
  if (lowerIssue.includes('seo') || lowerIssue.includes('search') || lowerIssue.includes('keyword') || lowerIssue.includes('ranking')) {
    return 'SEO';
  }
  if (lowerIssue.includes('website') || lowerIssue.includes('ux') || lowerIssue.includes('design') || lowerIssue.includes('page') || lowerIssue.includes('navigation') || lowerIssue.includes('mobile')) {
    return 'Website';
  }
  if (lowerIssue.includes('demand') || lowerIssue.includes('lead') || lowerIssue.includes('conversion') || lowerIssue.includes('funnel') || lowerIssue.includes('cta')) {
    return 'Demand';
  }
  if (lowerIssue.includes('ops') || lowerIssue.includes('analytics') || lowerIssue.includes('tracking') || lowerIssue.includes('automation')) {
    return 'Ops';
  }
  return 'Other';
}

function groupIssuesByCategory(issues: string[]): GroupedIssue[] {
  const groups: Record<string, string[]> = {};

  for (const issue of issues) {
    const category = categorizeIssue(issue);
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(issue);
  }

  // Sort categories in a logical order
  const categoryOrder = ['Brand', 'Website', 'Content', 'SEO', 'Demand', 'Ops', 'Other'];
  return categoryOrder
    .filter((cat) => groups[cat]?.length > 0)
    .map((category) => ({
      category,
      issues: groups[category],
    }));
}

function CategoryAccordion({ group }: { group: GroupedIssue }) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = getCategoryColor(group.category);

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${colors.text}`}>{group.category}</span>
          <span className="text-xs text-slate-500">
            {group.issues.length} {group.issues.length === 1 ? 'issue' : 'issues'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {group.issues.map((issue, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-2 rounded bg-slate-800/50"
            >
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5" />
              <p className="text-xs text-slate-300">{issue}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyIssuesState() {
  return (
    <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm font-medium text-emerald-400">Looking Good</span>
      </div>
      <p className="text-xs text-slate-400">
        No critical issues detected. Keep monitoring your diagnostics.
      </p>
    </div>
  );
}

export function BlueprintIssuesSection({ strategySnapshot, className = '' }: BlueprintIssuesSectionProps) {
  const issues = strategySnapshot?.keyGaps || [];

  if (issues.length === 0) {
    return <EmptyIssuesState />;
  }

  const groupedIssues = groupIssuesByCategory(issues);

  return (
    <div className={`space-y-2 ${className}`}>
      {groupedIssues.map((group) => (
        <CategoryAccordion key={group.category} group={group} />
      ))}
    </div>
  );
}
