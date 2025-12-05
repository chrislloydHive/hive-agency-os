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

  // Strategic themes
  if (raw.strategicThemes && Array.isArray(raw.strategicThemes)) {
    parts.push(formatArrayItems(raw.strategicThemes, 'Strategic Themes'));
  }

  // Module scores
  if (raw.modules && typeof raw.modules === 'object') {
    const modules = raw.modules as Record<string, Record<string, unknown>>;
    const scores: Record<string, number | null> = {};
    for (const [key, mod] of Object.entries(modules)) {
      if (mod?.score !== undefined) {
        scores[key] = mod.score as number;
      }
    }
    if (Object.keys(scores).length > 0) {
      parts.push('**Module Scores:**');
      parts.push(formatScores(scores));
    }
  }

  // Top issues across modules
  if (raw.topIssues && Array.isArray(raw.topIssues)) {
    parts.push(formatArrayItems(raw.topIssues, 'Top Issues'));
  }

  // Top opportunities
  if (raw.topOpportunities && Array.isArray(raw.topOpportunities)) {
    parts.push(formatArrayItems(raw.topOpportunities, 'Top Opportunities'));
  }

  // Roadmap priorities
  if (raw.roadmap && Array.isArray(raw.roadmap)) {
    parts.push(formatArrayItems(raw.roadmap, 'Roadmap Priorities'));
  }

  // Competitor analysis summary
  if (raw.competitorAnalysis && typeof raw.competitorAnalysis === 'object') {
    const comp = raw.competitorAnalysis as Record<string, unknown>;
    if (comp.summary) {
      parts.push(`**Competitive Summary:** ${comp.summary}`);
    }
  }

  // Summary
  if (run.summary) {
    parts.push(`**Summary:** ${run.summary}`);
  }

  return parts.join('\n\n');
}
