// lib/insights/ingestors/contentLabIngestor.ts
// Insight ingestor for Content Lab diagnostics

import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import {
  runIngestor,
  safeExtractRawJson,
  formatScores,
  formatArrayItems,
  type IngestorParams,
  type IngestorResult,
} from './baseIngestor';

/**
 * Extract insights from Content Lab reports
 */
export async function ingestContentLab(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'contentLab',
    toolName: 'Content Lab',
    labId: 'content',

    extractReportData: extractContentLabData,
    systemPromptAddendum: `This is a Content Lab report analyzing content inventory and strategy.
Focus on:
- Content gaps and topic authority opportunities
- Quality improvements needed
- Content strategy alignment with business goals
- SEO content integration opportunities
- Content distribution and promotion gaps`,
  });
}

function extractContentLabData(run: DiagnosticRun): string {
  const raw = safeExtractRawJson(run);
  if (!raw) return run.summary || '';

  const parts: string[] = [];

  // Overall score
  if (run.score !== null) {
    parts.push(`**Overall Score:** ${run.score}/100`);
  }

  // Subscores
  const scores: Record<string, number | null> = {};
  if (raw.strategyScore !== undefined) scores['Strategy'] = raw.strategyScore as number;
  if (raw.qualityScore !== undefined) scores['Quality'] = raw.qualityScore as number;
  if (raw.coverageScore !== undefined) scores['Coverage'] = raw.coverageScore as number;
  if (raw.seoScore !== undefined) scores['SEO'] = raw.seoScore as number;
  if (raw.distributionScore !== undefined) scores['Distribution'] = raw.distributionScore as number;

  if (Object.keys(scores).length > 0) {
    parts.push('**Dimension Scores:**');
    parts.push(formatScores(scores));
  }

  // Content inventory summary
  if (raw.inventorySummary && typeof raw.inventorySummary === 'object') {
    const inv = raw.inventorySummary as Record<string, unknown>;
    const stats: string[] = [];
    if (inv.totalPieces !== undefined) stats.push(`Total pieces: ${inv.totalPieces}`);
    if (inv.blogPosts !== undefined) stats.push(`Blog posts: ${inv.blogPosts}`);
    if (inv.caseStudies !== undefined) stats.push(`Case studies: ${inv.caseStudies}`);
    if (inv.resources !== undefined) stats.push(`Resources: ${inv.resources}`);
    if (stats.length > 0) {
      parts.push('**Content Inventory:**');
      parts.push(stats.map((s) => `- ${s}`).join('\n'));
    }
  }

  // Content gaps
  if (raw.contentGaps && Array.isArray(raw.contentGaps)) {
    parts.push(formatArrayItems(raw.contentGaps, 'Content Gaps'));
  }

  // Topic opportunities
  if (raw.topicOpportunities && Array.isArray(raw.topicOpportunities)) {
    parts.push(formatArrayItems(raw.topicOpportunities, 'Topic Opportunities'));
  }

  // Quality issues
  if (raw.qualityIssues && Array.isArray(raw.qualityIssues)) {
    parts.push(formatArrayItems(raw.qualityIssues, 'Quality Issues'));
  }

  // Top performing content
  if (raw.topPerformers && Array.isArray(raw.topPerformers)) {
    const performers = raw.topPerformers as Record<string, unknown>[];
    const perfList = performers.slice(0, 5).map((p) => {
      const title = p.title || p.name || 'Unknown';
      const metric = p.metric || p.performance || '';
      return `- ${title}${metric ? ` (${metric})` : ''}`;
    });
    if (perfList.length > 0) {
      parts.push('**Top Performing Content:**');
      parts.push(perfList.join('\n'));
    }
  }

  // Underperforming content
  if (raw.underperformers && Array.isArray(raw.underperformers)) {
    parts.push(formatArrayItems(raw.underperformers, 'Underperforming Content'));
  }

  // Content strategy alignment
  if (raw.strategyAlignment) {
    parts.push(`**Strategy Alignment:** ${raw.strategyAlignment}`);
  }

  // Distribution analysis
  if (raw.distributionAnalysis && typeof raw.distributionAnalysis === 'object') {
    const dist = raw.distributionAnalysis as Record<string, unknown>;
    if (dist.summary) {
      parts.push(`**Distribution:** ${dist.summary}`);
    }
    if (dist.gaps && Array.isArray(dist.gaps)) {
      parts.push(formatArrayItems(dist.gaps, 'Distribution Gaps'));
    }
  }

  // Quick wins
  if (raw.quickWins && Array.isArray(raw.quickWins)) {
    parts.push(formatArrayItems(raw.quickWins, 'Quick Wins'));
  }

  // Recommendations
  if (raw.recommendations && Array.isArray(raw.recommendations)) {
    parts.push(formatArrayItems(raw.recommendations, 'Recommendations'));
  }

  // Summary
  if (run.summary) {
    parts.push(`**Summary:** ${run.summary}`);
  }

  return parts.join('\n\n');
}
