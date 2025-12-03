// components/os/blueprint/utils.ts
// Shared utility functions for Blueprint components

import { formatDistanceToNow } from 'date-fns';
import type { ReactNode } from 'react';
import type { ToolIcon } from '@/lib/tools/registry';

export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

export function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-slate-500/20';
  if (score >= 80) return 'bg-emerald-500/20';
  if (score >= 60) return 'bg-amber-500/20';
  return 'bg-red-500/20';
}

export function getScoreLabel(score: number | null): string {
  if (score === null) return 'N/A';
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Weak';
  return 'Critical';
}

export function getScoreStatusColor(score: number | null): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  if (score === null) {
    return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', label: 'N/A' };
  }
  if (score >= 80) {
    return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Strong' };
  }
  if (score >= 60) {
    return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Moderate' };
  }
  if (score >= 40) {
    return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', label: 'Weak' };
  }
  return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', label: 'Critical' };
}

export function getMaturityStageStyle(stage: string | undefined): string {
  switch (stage) {
    case 'World-Class':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'Advanced':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'Good':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'Developing':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    case 'Basic':
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

export function getImpactStyle(impact: 'high' | 'medium' | 'low'): string {
  switch (impact) {
    case 'high':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'medium':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'low':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

export function getEffortStyle(effort: 'low' | 'medium' | 'high'): string {
  switch (effort) {
    case 'low':
      return 'bg-emerald-500/20 text-emerald-300';
    case 'medium':
      return 'bg-amber-500/20 text-amber-300';
    case 'high':
      return 'bg-red-500/20 text-red-300';
  }
}

export function getUrgencyStyle(urgency: 'now' | 'next' | 'later'): { bg: string; text: string; border: string; label: string } {
  switch (urgency) {
    case 'now':
      return { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', label: 'Run Now' };
    case 'next':
      return { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30', label: 'Run Next' };
    case 'later':
      return { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', label: 'Later' };
  }
}

export function getRecommendationImpactStyle(impact: 'high' | 'medium' | 'low'): { bg: string; text: string; label: string } {
  switch (impact) {
    case 'high':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'High Impact' };
    case 'medium':
      return { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Medium Impact' };
    case 'low':
      return { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Low Impact' };
  }
}

// Category colors for grouping issues
export const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  Brand: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  Content: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  SEO: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  Website: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  Demand: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  Ops: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  Other: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
};

export function getCategoryColor(category: string): { bg: string; text: string; border: string } {
  return categoryColors[category] || categoryColors.Other;
}

// ============================================================================
// Deduplication Utilities
// ============================================================================

/**
 * Deduplicate an array by a composite key function
 * @param items Array of items to deduplicate
 * @param keyFn Function that generates a unique key for each item
 * @returns Deduplicated array (first occurrence kept)
 */
export function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item).toLowerCase().trim();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Deduplicate issues by title + category composite key
 */
export function dedupeIssues<T extends { title: string; area?: string; category?: string }>(
  issues: T[]
): T[] {
  return dedupeByKey(issues, (issue) => {
    const category = issue.area || issue.category || 'general';
    return `${issue.title}|${category}`;
  });
}

/**
 * Deduplicate opportunities/actions by title
 */
export function dedupeOpportunities<T extends { title: string }>(opportunities: T[]): T[] {
  return dedupeByKey(opportunities, (opp) => opp.title);
}
