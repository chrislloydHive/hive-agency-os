// lib/insights/ingestors/websiteLabIngestor.ts
// Insight ingestor for Website Lab diagnostics

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
 * Extract insights from Website Lab reports
 */
export async function ingestWebsiteLab(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'websiteLab',
    toolName: 'Website Lab',
    labId: 'website',

    extractReportData: extractWebsiteLabData,
    systemPromptAddendum: `This is a Website Lab report analyzing website UX and conversion optimization.
Focus on:
- Conversion blockers and friction points
- User experience improvements with clear impact
- Messaging and copy recommendations
- Technical optimizations for performance
- Page-specific issues that affect the user journey`,
  });
}

function extractWebsiteLabData(run: DiagnosticRun): string {
  const raw = safeExtractRawJson(run);
  if (!raw) return run.summary || '';

  const parts: string[] = [];

  // Overall score
  if (run.score !== null) {
    parts.push(`**Overall Score:** ${run.score}/100`);
  }

  // Site assessment
  const site = raw.siteAssessment as Record<string, unknown> | undefined;
  if (site) {
    // Dimension scores
    if (site.dimensions && typeof site.dimensions === 'object') {
      const dims = site.dimensions as Record<string, Record<string, unknown>>;
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

    // Critical issues
    if (site.criticalIssues && Array.isArray(site.criticalIssues)) {
      parts.push(formatArrayItems(site.criticalIssues, 'Critical Issues'));
    }

    // Quick wins
    if (site.quickWins && Array.isArray(site.quickWins)) {
      parts.push(formatArrayItems(site.quickWins, 'Quick Wins'));
    }

    // CTA analysis
    if (site.ctaAnalysis && typeof site.ctaAnalysis === 'object') {
      const cta = site.ctaAnalysis as Record<string, unknown>;
      if (cta.summary) {
        parts.push(`**CTA Analysis:** ${cta.summary}`);
      }
      if (cta.issues && Array.isArray(cta.issues)) {
        parts.push(formatArrayItems(cta.issues, 'CTA Issues'));
      }
    }

    // Messaging clarity
    if (site.messagingClarity) {
      parts.push(`**Messaging Clarity:** ${site.messagingClarity}`);
    }
  }

  // Page-by-page analysis
  const pages = raw.pageAnalysis as unknown[] | undefined;
  if (pages && Array.isArray(pages) && pages.length > 0) {
    const pageIssues: string[] = [];
    for (const page of pages.slice(0, 5)) {
      const p = page as Record<string, unknown>;
      if (p.url && p.issues && Array.isArray(p.issues)) {
        const url = String(p.url);
        const topIssues = (p.issues as string[]).slice(0, 2).join(', ');
        pageIssues.push(`- ${url}: ${topIssues}`);
      }
    }
    if (pageIssues.length > 0) {
      parts.push('**Page-Specific Issues:**');
      parts.push(pageIssues.join('\n'));
    }
  }

  // Site graph (navigation structure)
  const siteGraph = raw.siteGraph as Record<string, unknown> | undefined;
  if (siteGraph?.navigationScore !== undefined) {
    parts.push(`**Navigation Score:** ${siteGraph.navigationScore}/100`);
  }
  if (siteGraph?.recommendations && Array.isArray(siteGraph.recommendations)) {
    parts.push(formatArrayItems(siteGraph.recommendations, 'Navigation Recommendations'));
  }

  // Conversion opportunities
  if (raw.conversionOpportunities && Array.isArray(raw.conversionOpportunities)) {
    parts.push(formatArrayItems(raw.conversionOpportunities, 'Conversion Opportunities'));
  }

  // Summary
  if (run.summary) {
    parts.push(`**Summary:** ${run.summary}`);
  }

  return parts.join('\n\n');
}
