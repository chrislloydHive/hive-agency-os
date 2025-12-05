// lib/insights/ingestors/gapIngestor.ts
// Insight ingestor for GAP IA and Full GAP diagnostics

import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import {
  runIngestor,
  safeExtractRawJson,
  formatScores,
  formatArrayItems,
  type IngestorParams,
  type IngestorResult,
} from './baseIngestor';

// ============================================================================
// GAP IA Ingestor
// ============================================================================

/**
 * Extract insights from GAP IA (Initial Assessment) reports
 */
export async function ingestGapSnapshot(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'gapSnapshot',
    toolName: 'GAP IA (Initial Assessment)',
    labId: null,
    extractReportData: extractGapSnapshotData,
    systemPromptAddendum: `This is an Initial Assessment report that scores companies on overall marketing maturity.
Focus on:
- Quick wins that can improve scores immediately
- The most impactful areas to address first
- Red flags that indicate deeper issues
- Patterns across dimensions that suggest root causes`,
  });
}

function extractGapSnapshotData(run: DiagnosticRun): string {
  const raw = safeExtractRawJson(run);
  if (!raw) return run.summary || '';

  const parts: string[] = [];

  // Overall score
  if (run.score !== null) {
    parts.push(`**Overall Score:** ${run.score}/100`);
  }

  // Maturity stage
  const ia = raw.initialAssessment as Record<string, unknown> | undefined;
  if (ia?.summary) {
    const summary = ia.summary as Record<string, unknown>;
    if (summary.maturityStage) {
      parts.push(`**Maturity Stage:** ${summary.maturityStage}`);
    }
    if (summary.stageSummary) {
      parts.push(`**Stage Assessment:** ${summary.stageSummary}`);
    }
  }

  // Dimension scores
  if (ia?.dimensions) {
    const dims = ia.dimensions as Record<string, Record<string, unknown>>;
    const scores: Record<string, number | null> = {};
    for (const [key, dim] of Object.entries(dims)) {
      if (dim?.score !== undefined) {
        scores[key] = dim.score as number;
      }
    }
    if (Object.keys(scores).length > 0) {
      parts.push('**Dimension Scores:**');
      parts.push(formatScores(scores));
    }
  }

  // Insights
  if (ia?.insights) {
    const insights = ia.insights as Record<string, unknown>;
    if (Array.isArray(insights.strengths) && insights.strengths.length > 0) {
      parts.push(formatArrayItems(insights.strengths, 'Strengths'));
    }
    if (Array.isArray(insights.weaknesses) && insights.weaknesses.length > 0) {
      parts.push(formatArrayItems(insights.weaknesses, 'Weaknesses'));
    }
    if (Array.isArray(insights.recommendations) && insights.recommendations.length > 0) {
      parts.push(formatArrayItems(insights.recommendations, 'Recommendations'));
    }
  }

  // Quick wins
  if (ia?.quickWins && Array.isArray(ia.quickWins)) {
    parts.push(formatArrayItems(ia.quickWins, 'Quick Wins'));
  }

  // Summary
  if (run.summary) {
    parts.push(`**Summary:** ${run.summary}`);
  }

  return parts.join('\n\n');
}

// ============================================================================
// Full GAP Ingestor
// ============================================================================

/**
 * Extract insights from Full GAP (Heavy) reports
 */
export async function ingestFullGap(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'gapHeavy',
    toolName: 'Full GAP Analysis',
    labId: null,
    extractReportData: extractFullGapData,
    systemPromptAddendum: `This is a comprehensive Full GAP analysis covering multiple marketing dimensions.
Focus on:
- Cross-dimensional insights and patterns
- Strategic priorities based on multiple data sources
- Competitive positioning opportunities
- Resource allocation recommendations
- High-impact quick wins across channels`,
  });
}

function extractFullGapData(run: DiagnosticRun): string {
  const raw = safeExtractRawJson(run);
  if (!raw) return run.summary || '';

  const parts: string[] = [];

  // Overall score
  if (run.score !== null) {
    parts.push(`**Overall Score:** ${run.score}/100`);
  }

  // The Full GAP stores data under growthPlan
  const growthPlan = raw.growthPlan as Record<string, unknown> | undefined;

  if (growthPlan) {
    // Scorecard with dimension scores
    const scorecard = growthPlan.scorecard as Record<string, number> | undefined;
    if (scorecard) {
      const scores: Record<string, number | null> = {};
      for (const [key, value] of Object.entries(scorecard)) {
        if (typeof value === 'number' && key !== 'overall') {
          scores[key] = value;
        }
      }
      if (Object.keys(scores).length > 0) {
        parts.push('**Dimension Scores:**');
        parts.push(formatScores(scores));
      }
    }

    // Executive summary narrative
    const execSummary = growthPlan.executiveSummary as Record<string, unknown> | undefined;
    if (execSummary?.narrative) {
      parts.push(`**Executive Summary:** ${execSummary.narrative}`);
    }
    if (execSummary?.keyIssues && Array.isArray(execSummary.keyIssues)) {
      parts.push(formatArrayItems(execSummary.keyIssues, 'Key Issues'));
    }
    if (execSummary?.strategicPriorities && Array.isArray(execSummary.strategicPriorities)) {
      parts.push(formatArrayItems(execSummary.strategicPriorities, 'Strategic Priorities'));
    }

    // Quick wins
    const quickWins = growthPlan.quickWins as Array<Record<string, unknown>> | undefined;
    if (quickWins && Array.isArray(quickWins)) {
      const quickWinTitles = quickWins.map(w => w.title || w.description).filter(Boolean);
      if (quickWinTitles.length > 0) {
        parts.push(formatArrayItems(quickWinTitles, 'Quick Wins'));
      }
    }

    // Strategic initiatives
    const initiatives = growthPlan.strategicInitiatives as Array<Record<string, unknown>> | undefined;
    if (initiatives && Array.isArray(initiatives)) {
      const initTitles = initiatives.map(i => `${i.title}: ${i.description}`).filter(Boolean);
      if (initTitles.length > 0) {
        parts.push(formatArrayItems(initTitles, 'Strategic Initiatives'));
      }
    }

    // 90-day roadmap
    const roadmap = growthPlan.roadmap as Array<Record<string, unknown>> | undefined;
    if (roadmap && Array.isArray(roadmap)) {
      const roadmapItems = roadmap.map(r => `${r.phase}: ${r.focus}`).filter(Boolean);
      if (roadmapItems.length > 0) {
        parts.push(formatArrayItems(roadmapItems, '90-Day Roadmap'));
      }
    }

    // KPIs to watch
    const kpis = growthPlan.kpis as string[] | undefined;
    if (kpis && Array.isArray(kpis)) {
      parts.push(formatArrayItems(kpis, 'KPIs to Watch'));
    }

    // Dimension narratives
    const dimNarratives = growthPlan.dimensionNarratives as Record<string, string> | undefined;
    if (dimNarratives) {
      for (const [dim, narrative] of Object.entries(dimNarratives)) {
        if (narrative) {
          parts.push(`**${dim.charAt(0).toUpperCase() + dim.slice(1)} Assessment:** ${narrative}`);
        }
      }
    }

    // Section analyses (findings per dimension)
    const sectionAnalyses = growthPlan.sectionAnalyses as Record<string, Record<string, unknown>> | undefined;
    if (sectionAnalyses) {
      for (const [dim, analysis] of Object.entries(sectionAnalyses)) {
        if (analysis?.keyFindings && Array.isArray(analysis.keyFindings) && analysis.keyFindings.length > 0) {
          parts.push(formatArrayItems(analysis.keyFindings, `${dim.charAt(0).toUpperCase() + dim.slice(1)} Findings`));
        }
      }
    }
  }

  // Also check for refinedMarkdown (the full report text)
  const refinedMarkdown = raw.refinedMarkdown as string | undefined;
  if (refinedMarkdown && typeof refinedMarkdown === 'string' && refinedMarkdown.length > 100) {
    // Include a truncated version of the markdown for context
    const truncated = refinedMarkdown.substring(0, 3000);
    parts.push(`**Full Report (excerpt):**\n${truncated}...`);
  }

  // Summary fallback
  if (parts.length === 1 && run.summary) {
    parts.push(`**Summary:** ${run.summary}`);
  }

  return parts.join('\n\n');
}
