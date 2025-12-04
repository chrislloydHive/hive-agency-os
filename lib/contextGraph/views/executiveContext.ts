// lib/contextGraph/views/executiveContext.ts
// Executive Summary Context View
//
// Provides a high-level overview for executive reports
// and strategic briefings.

import { loadContextGraph } from '../storage';
import { getNeedsRefreshReport } from '../needsRefresh';
import {
  computeContextHealthScore,
  convertNeedsRefreshReport,
  type NeedsRefreshFlag,
} from '../contextHealth';
import type { CompanyContextGraph } from '../companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Executive summary data
 */
export interface ExecutiveSummary {
  /** Who - company identity */
  who: string | null;
  /** What - business model */
  what: string | null;
  /** Target audience */
  audience: string[];
  /** Brand position */
  brand: string | null;
  /** Primary objective */
  objective: string | null;
  /** Performance summary */
  performance: string | null;
  /** Key strengths */
  strengths: string[];
  /** Key gaps */
  gaps: string[];
}

/**
 * Executive Context - high-level strategic view
 */
export interface ExecutiveContext {
  /** Full context graph reference */
  graph: CompanyContextGraph;

  /** Company ID */
  companyId: string;

  /** Company name */
  companyName: string;

  /** Executive summary fields */
  summary: ExecutiveSummary;

  /** Key metrics */
  metrics: {
    overallHealthScore: number | null;
    totalMonthlySpend: number | null;
    blendedCpa: number | null;
    blendedRoas: number | null;
  };

  /** Context health metrics */
  contextHealthScore: number;
  needsRefresh: NeedsRefreshFlag[];

  /** Last updated */
  lastUpdated: string | null;
  lastFusionAt: string | null;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get the executive summary context for a company
 *
 * This provides a high-level view suitable for executive reports,
 * client briefings, and strategic overviews.
 *
 * @param companyId The company ID
 * @returns ExecutiveContext or null if no graph exists
 */
export async function getExecutiveSummaryContext(
  companyId: string
): Promise<ExecutiveContext | null> {
  // Load the context graph
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    return null;
  }

  // Get needs-refresh report
  const refreshReport = getNeedsRefreshReport(graph);
  const needsRefresh = convertNeedsRefreshReport(refreshReport);
  const contextHealthScore = computeContextHealthScore(needsRefresh);

  return {
    graph,
    companyId: graph.companyId,
    companyName: graph.companyName,

    summary: {
      who: graph.identity.businessName.value || graph.companyName,
      what: graph.identity.businessModel.value,
      audience: graph.audience.coreSegments.value ?? [],
      brand: graph.brand.positioning.value,
      objective: graph.objectives.primaryObjective.value,
      performance: graph.historical.pastPerformanceSummary.value,
      strengths: graph.brand.brandStrengths.value ?? [],
      gaps: graph.brand.brandWeaknesses.value ?? [],
    },

    metrics: {
      overallHealthScore: graph.performanceMedia.mediaScore.value,
      totalMonthlySpend: graph.performanceMedia.totalMonthlySpend.value,
      blendedCpa: graph.performanceMedia.blendedCpa.value,
      blendedRoas: graph.performanceMedia.blendedRoas.value,
    },

    contextHealthScore,
    needsRefresh,

    lastUpdated: graph.meta.updatedAt,
    lastFusionAt: graph.meta.lastFusionAt,
  };
}

/**
 * Build a compact executive brief for reports
 *
 * @param ctx The executive context
 * @returns Formatted string for executive reports
 */
export function buildExecutiveBrief(ctx: ExecutiveContext): string {
  const lines: string[] = [];

  lines.push(`# ${ctx.companyName} - Executive Brief`);
  lines.push('');

  // Summary
  lines.push(`## Overview`);
  if (ctx.summary.who) lines.push(`**Company:** ${ctx.summary.who}`);
  if (ctx.summary.what) lines.push(`**Business Model:** ${ctx.summary.what}`);
  if (ctx.summary.brand) lines.push(`**Positioning:** ${ctx.summary.brand}`);
  if (ctx.summary.objective) lines.push(`**Primary Objective:** ${ctx.summary.objective}`);
  lines.push('');

  // Audience
  if (ctx.summary.audience.length > 0) {
    lines.push(`## Target Audience`);
    ctx.summary.audience.forEach((seg) => lines.push(`- ${seg}`));
    lines.push('');
  }

  // Key metrics
  if (ctx.metrics.totalMonthlySpend || ctx.metrics.blendedCpa || ctx.metrics.blendedRoas) {
    lines.push(`## Key Metrics`);
    if (ctx.metrics.totalMonthlySpend) {
      lines.push(`- Monthly Spend: $${ctx.metrics.totalMonthlySpend.toLocaleString()}`);
    }
    if (ctx.metrics.blendedCpa) {
      lines.push(`- Blended CPA: $${ctx.metrics.blendedCpa.toFixed(2)}`);
    }
    if (ctx.metrics.blendedRoas) {
      lines.push(`- Blended ROAS: ${ctx.metrics.blendedRoas.toFixed(2)}x`);
    }
    lines.push('');
  }

  // Strengths & Gaps
  if (ctx.summary.strengths.length > 0 || ctx.summary.gaps.length > 0) {
    lines.push(`## Strengths & Gaps`);
    if (ctx.summary.strengths.length > 0) {
      lines.push(`**Strengths:**`);
      ctx.summary.strengths.slice(0, 3).forEach((s) => lines.push(`+ ${s}`));
    }
    if (ctx.summary.gaps.length > 0) {
      lines.push(`**Gaps:**`);
      ctx.summary.gaps.slice(0, 3).forEach((g) => lines.push(`- ${g}`));
    }
    lines.push('');
  }

  // Performance summary
  if (ctx.summary.performance) {
    lines.push(`## Performance Summary`);
    lines.push(ctx.summary.performance);
    lines.push('');
  }

  // Context health
  lines.push(`## Data Health`);
  lines.push(`Context completeness score: ${ctx.contextHealthScore}%`);
  if (ctx.needsRefresh.length > 0) {
    lines.push(`Areas needing attention: ${ctx.needsRefresh.length}`);
  }

  return lines.join('\n');
}
