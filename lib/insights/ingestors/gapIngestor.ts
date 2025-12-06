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

  // Debug: log what we're working with
  console.log('[gapIngestor:fullGap] Raw keys:', Object.keys(raw));

  // Overall score
  if (run.score !== null) {
    parts.push(`**Overall Score:** ${run.score}/100`);
  }

  // The Full GAP stores data under growthPlan OR fullGap (different versions)
  const growthPlan = (raw.growthPlan || raw.fullGap) as Record<string, unknown> | undefined;
  if (growthPlan) {
    console.log('[gapIngestor:fullGap] growthPlan keys:', Object.keys(growthPlan));
  }

  // Also check for initialAssessment which contains useful data
  const initialAssessment = raw.initialAssessment as Record<string, unknown> | undefined;
  if (initialAssessment) {
    console.log('[gapIngestor:fullGap] initialAssessment keys:', Object.keys(initialAssessment));
  }

  // Extract from initialAssessment if available
  if (initialAssessment) {
    // Overall score from initial assessment
    const iaSummary = initialAssessment.summary as Record<string, unknown> | undefined;
    if (iaSummary?.overallScore && run.score === null) {
      parts.push(`**Overall Score:** ${iaSummary.overallScore}/100`);
    }
    if (iaSummary?.maturityStage) {
      parts.push(`**Maturity Stage:** ${iaSummary.maturityStage}`);
    }
    if (iaSummary?.stageSummary) {
      parts.push(`**Stage Assessment:** ${iaSummary.stageSummary}`);
    }

    // Dimension scores from initial assessment
    const iaDimensions = initialAssessment.dimensions as Record<string, Record<string, unknown>> | undefined;
    if (iaDimensions) {
      const scores: Record<string, number | null> = {};
      for (const [key, dim] of Object.entries(iaDimensions)) {
        if (dim?.score !== undefined) {
          scores[key] = dim.score as number;
        }
      }
      if (Object.keys(scores).length > 0) {
        parts.push('**Dimension Scores:**');
        parts.push(formatScores(scores));
      }
    }

    // Insights from initial assessment
    const iaInsights = initialAssessment.insights as Record<string, unknown> | undefined;
    if (iaInsights) {
      if (Array.isArray(iaInsights.strengths) && iaInsights.strengths.length > 0) {
        parts.push(formatArrayItems(iaInsights.strengths, 'Strengths'));
      }
      if (Array.isArray(iaInsights.weaknesses) && iaInsights.weaknesses.length > 0) {
        parts.push(formatArrayItems(iaInsights.weaknesses, 'Weaknesses'));
      }
      if (Array.isArray(iaInsights.recommendations) && iaInsights.recommendations.length > 0) {
        parts.push(formatArrayItems(iaInsights.recommendations, 'Recommendations'));
      }
    }

    // Quick wins from initial assessment
    if (Array.isArray(initialAssessment.quickWins)) {
      parts.push(formatArrayItems(initialAssessment.quickWins, 'Quick Wins'));
    }
  }

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

  // Check for fullGap.report markdown content
  if (growthPlan) {
    const report = (growthPlan as Record<string, unknown>).report as string | undefined;
    if (report && typeof report === 'string' && report.length > 100) {
      const truncated = report.substring(0, 3000);
      parts.push(`**Full Report (excerpt):**\n${truncated}...`);
    }
  }

  // Summary fallback - always include summary if available
  if (run.summary && run.summary.length > 20) {
    parts.push(`**Summary:** ${run.summary}`);
  }

  // If we still have nothing substantial, try to stringify some of the raw data
  if (parts.length <= 1 && raw) {
    // Log what we have for debugging
    console.log('[gapIngestor] Limited data found, attempting raw extraction');

    // Try to extract narrative content from fullGap object
    if (growthPlan) {
      // Look for any text content in fullGap
      const fg = growthPlan as Record<string, unknown>;

      // Check for markdown/report content
      if (typeof fg.markdown === 'string' && fg.markdown.length > 100) {
        parts.push(`**Report:**\n${(fg.markdown as string).substring(0, 3000)}`);
      } else if (typeof fg.narrative === 'string' && fg.narrative.length > 100) {
        parts.push(`**Narrative:**\n${fg.narrative}`);
      } else if (typeof fg.executiveSummary === 'string') {
        parts.push(`**Executive Summary:** ${fg.executiveSummary}`);
      }

      // Check for sections or dimensions
      if (fg.sections && typeof fg.sections === 'object') {
        const sectionsStr = JSON.stringify(fg.sections, null, 2).substring(0, 2000);
        parts.push(`**Sections:**\n${sectionsStr}`);
      }

      // If still short, stringify the whole fullGap
      if (parts.length <= 1) {
        const fgStr = JSON.stringify(fg, null, 2).substring(0, 3000);
        if (fgStr.length > 200) {
          parts.push(`**Full GAP Data:**\n${fgStr}`);
        }
      }
    }

    // Fallback to raw JSON
    if (parts.length <= 1) {
      const rawStr = JSON.stringify(raw, null, 2).substring(0, 2000);
      if (rawStr.length > 100) {
        parts.push(`**Raw Data:**\n${rawStr}`);
      }
    }
  }

  return parts.join('\n\n');
}
