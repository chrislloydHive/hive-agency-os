// lib/insights/ingestors/seoLabIngestor.ts
// Insight ingestor for SEO Lab diagnostics

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
 * Extract insights from SEO Lab reports
 */
export async function ingestSeoLab(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'seoLab',
    toolName: 'SEO Lab',
    labId: 'seo',

    extractReportData: extractSeoLabData,
    systemPromptAddendum: `This is an SEO Lab report with technical SEO, on-page, authority, and SERP analysis.
Focus on:
- Critical and high-severity technical issues
- Content and on-page optimization gaps
- Authority and backlink opportunities
- Keyword ranking opportunities
- Quick wins with high impact and low effort`,
  });
}

function extractSeoLabData(run: DiagnosticRun): string {
  const raw = safeExtractRawJson(run);
  if (!raw) return run.summary || '';

  const parts: string[] = [];

  // Overall score
  const overallScore = run.score ?? (raw.overallScore as number | undefined);
  if (overallScore !== null && overallScore !== undefined) {
    parts.push(`**Overall Score:** ${overallScore}/100`);
  }

  // Maturity stage
  if (raw.maturityStage) {
    parts.push(`**SEO Maturity:** ${raw.maturityStage}`);
  }

  // Subscores
  if (raw.subscores && Array.isArray(raw.subscores)) {
    const scores: Record<string, number | null> = {};
    for (const sub of raw.subscores) {
      const s = sub as Record<string, unknown>;
      if (s.label && s.score !== undefined) {
        scores[String(s.label)] = s.score as number;
      }
    }
    if (Object.keys(scores).length > 0) {
      parts.push('**Dimension Scores:**');
      parts.push(formatScores(scores));
    }
  }

  // Top strengths
  if (raw.topStrengths && Array.isArray(raw.topStrengths)) {
    parts.push(formatArrayItems(raw.topStrengths, 'Top Strengths'));
  }

  // Top gaps
  if (raw.topGaps && Array.isArray(raw.topGaps)) {
    parts.push(formatArrayItems(raw.topGaps, 'Top Gaps'));
  }

  // Issues by severity
  if (raw.issues && Array.isArray(raw.issues)) {
    const issues = raw.issues as Record<string, unknown>[];
    const critical = issues.filter((i) => i.severity === 'critical');
    const high = issues.filter((i) => i.severity === 'high');

    if (critical.length > 0) {
      const critList = critical.slice(0, 5).map((i) => `- ${i.title || i.description}`);
      parts.push('**Critical Issues:**');
      parts.push(critList.join('\n'));
    }
    if (high.length > 0) {
      const highList = high.slice(0, 5).map((i) => `- ${i.title || i.description}`);
      parts.push('**High-Severity Issues:**');
      parts.push(highList.join('\n'));
    }
  }

  // Quick wins
  if (raw.quickWins && Array.isArray(raw.quickWins)) {
    const wins = raw.quickWins as Record<string, unknown>[];
    const winList = wins.slice(0, 5).map((w) => {
      const title = w.title || w.description || 'Unknown';
      const impact = w.impact ? ` (${w.impact} impact)` : '';
      return `- ${title}${impact}`;
    });
    if (winList.length > 0) {
      parts.push('**Quick Wins:**');
      parts.push(winList.join('\n'));
    }
  }

  // SEO projects
  if (raw.seoProjects && Array.isArray(raw.seoProjects)) {
    const projects = raw.seoProjects as Record<string, unknown>[];
    const projList = projects.slice(0, 5).map((p) => {
      const title = p.title || p.name || 'Unknown';
      const timeframe = p.timeframe || p.horizon || '';
      return `- ${title}${timeframe ? ` (${timeframe})` : ''}`;
    });
    if (projList.length > 0) {
      parts.push('**SEO Projects:**');
      parts.push(projList.join('\n'));
    }
  }

  // GSC metrics
  if (raw.gscMetrics && typeof raw.gscMetrics === 'object') {
    const gsc = raw.gscMetrics as Record<string, unknown>;
    const metrics: string[] = [];
    if (gsc.totalClicks !== undefined) metrics.push(`Clicks: ${gsc.totalClicks}`);
    if (gsc.totalImpressions !== undefined) metrics.push(`Impressions: ${gsc.totalImpressions}`);
    if (gsc.avgCtr !== undefined) metrics.push(`CTR: ${(Number(gsc.avgCtr) * 100).toFixed(1)}%`);
    if (gsc.avgPosition !== undefined) metrics.push(`Avg Position: ${Number(gsc.avgPosition).toFixed(1)}`);
    if (metrics.length > 0) {
      parts.push('**GSC Metrics:**');
      parts.push(metrics.map((m) => `- ${m}`).join('\n'));
    }
  }

  // Top queries
  if (raw.topQueries && Array.isArray(raw.topQueries)) {
    const queries = raw.topQueries as Record<string, unknown>[];
    const queryList = queries.slice(0, 5).map((q) => {
      const query = q.query || q.keyword || 'Unknown';
      const pos = q.position !== undefined ? ` (pos: ${Number(q.position).toFixed(1)})` : '';
      return `- "${query}"${pos}`;
    });
    if (queryList.length > 0) {
      parts.push('**Top Queries:**');
      parts.push(queryList.join('\n'));
    }
  }

  // Summary
  if (run.summary) {
    parts.push(`**Summary:** ${run.summary}`);
  }

  return parts.join('\n\n');
}
