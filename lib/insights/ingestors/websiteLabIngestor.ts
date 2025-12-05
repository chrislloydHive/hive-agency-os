// lib/insights/ingestors/websiteLabIngestor.ts
// Insight ingestor for Website Lab diagnostics

import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import {
  runIngestor,
  extractLabData,
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
  const labData = extractLabData(run);
  const parts: string[] = [];

  // Overall score
  if (labData.score !== null) {
    parts.push(`**Overall Score:** ${labData.score}/100`);
  }

  // Dimension scores
  if (Object.keys(labData.dimensions).length > 0) {
    const scores: Record<string, number | null> = {};
    for (const [key, dim] of Object.entries(labData.dimensions)) {
      if (dim.score !== undefined) {
        scores[key] = dim.score;
      }
    }
    if (Object.keys(scores).length > 0) {
      parts.push('**Dimension Scores:**');
      parts.push(formatScores(scores));
    }
  }

  // Critical issues
  if (labData.issues.length > 0) {
    parts.push(formatArrayItems(labData.issues, 'Critical Issues'));
  }

  // Quick wins
  if (labData.quickWins.length > 0) {
    parts.push(formatArrayItems(labData.quickWins, 'Quick Wins'));
  }

  // Recommendations
  if (labData.recommendations.length > 0) {
    parts.push(formatArrayItems(labData.recommendations, 'Recommendations'));
  }

  // Site assessment specific fields
  const site = labData.siteAssessment;
  if (site) {
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

    // Page assessments
    if (site.pageAssessments && Array.isArray(site.pageAssessments)) {
      const pageIssues: string[] = [];
      for (const page of (site.pageAssessments as any[]).slice(0, 5)) {
        if (page.url && page.issues && Array.isArray(page.issues)) {
          const topIssues = page.issues.slice(0, 2).map((i: any) => typeof i === 'string' ? i : i.title || i).join(', ');
          pageIssues.push(`- ${page.url}: ${topIssues}`);
        }
      }
      if (pageIssues.length > 0) {
        parts.push('**Page-Specific Issues:**');
        parts.push(pageIssues.join('\n'));
      }
    }

    // Consultant report (rich narrative)
    if (site.consultantReport && typeof site.consultantReport === 'string') {
      const truncated = site.consultantReport.substring(0, 2000);
      parts.push(`**Consultant Analysis (excerpt):**\n${truncated}...`);
    }
  }

  // Summary
  if (labData.summary) {
    parts.push(`**Summary:** ${labData.summary}`);
  }

  return parts.join('\n\n');
}
