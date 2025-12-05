// lib/insights/ingestors/demandLabIngestor.ts
// Insight ingestor for Demand Lab diagnostics

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
 * Extract insights from Demand Lab reports
 *
 * Demand Lab typically analyzes:
 * - Demand gen maturity / score
 * - Media mix and budget allocation
 * - Campaign structure & targeting
 * - Measurement & optimization practices
 * - Funnel architecture & key conversion points
 * - Seasonality and promotion patterns (if present)
 */
export async function ingestDemandLab(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'demandLab',
    toolName: 'Demand Lab',
    labId: 'demand',

    extractReportData: extractDemandLabData,
    systemPromptAddendum: `### How to think about Demand Lab

Demand Lab analyzes demand generation and funnel performance:

- Demand gen maturity / score
- Media mix and budget allocation
- Campaign structure & targeting
- Measurement & optimization practices
- Funnel architecture & key conversion points

From this, you should usually output **2–6 insights**, not more.

Examples of insight types that often come from Demand Lab:

- Growth opportunity:
  - "No active paid search despite clear high-intent queries"
  - "Retargeting not in place for website visitors"

- Media allocation / mix:
  - "Budget heavily skewed to awareness; insufficient spend on mid-funnel and conversion"

- Measurement & optimization:
  - "No defined primary KPI and no consistent weekly performance review"

- Funnel / conversion:
  - "Landing pages are not aligned to acquisition campaigns"

Do NOT just restate the overall diagnostic summary.`,
  });
}

function extractDemandLabData(run: DiagnosticRun): string {
  const labData = extractLabData(run);
  const raw = labData.raw;
  const parts: string[] = [];

  // Overall score
  if (labData.score !== null) {
    parts.push(`**Overall Score:** ${labData.score}/100`);
  }

  // Common lab data
  if (labData.issues.length > 0) {
    parts.push(formatArrayItems(labData.issues, 'Issues'));
  }
  if (labData.quickWins.length > 0) {
    parts.push(formatArrayItems(labData.quickWins, 'Quick Wins'));
  }
  if (labData.recommendations.length > 0) {
    parts.push(formatArrayItems(labData.recommendations, 'Recommendations'));
  }

  if (!raw) {
    if (labData.summary) parts.push(`**Summary:** ${labData.summary}`);
    return parts.join('\n\n');
  }

  // Demand-specific subscores
  const scores: Record<string, number | null> = {};
  if (raw.funnelScore !== undefined) scores['Funnel'] = raw.funnelScore as number;
  if (raw.leadCaptureScore !== undefined) scores['Lead Capture'] = raw.leadCaptureScore as number;
  if (raw.nurturingScore !== undefined) scores['Nurturing'] = raw.nurturingScore as number;
  if (raw.campaignScore !== undefined) scores['Campaigns'] = raw.campaignScore as number;
  if (raw.attributionScore !== undefined) scores['Attribution'] = raw.attributionScore as number;

  if (Object.keys(scores).length > 0) {
    parts.push('**Dimension Scores:**');
    parts.push(formatScores(scores));
  }

  // Funnel analysis
  if (raw.funnelAnalysis && typeof raw.funnelAnalysis === 'object') {
    const funnel = raw.funnelAnalysis as Record<string, unknown>;
    if (funnel.summary) {
      parts.push(`**Funnel Summary:** ${funnel.summary}`);
    }
    if (funnel.conversionRates && typeof funnel.conversionRates === 'object') {
      const rates = funnel.conversionRates as Record<string, unknown>;
      const rateList = Object.entries(rates)
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => `- ${k}: ${(Number(v) * 100).toFixed(1)}%`);
      if (rateList.length > 0) {
        parts.push('**Conversion Rates:**');
        parts.push(rateList.join('\n'));
      }
    }
  }

  // Funnel leaks
  if (raw.funnelLeaks && Array.isArray(raw.funnelLeaks)) {
    parts.push(formatArrayItems(raw.funnelLeaks, 'Funnel Leaks'));
  }

  // Lead capture analysis
  if (raw.leadCaptureAnalysis && typeof raw.leadCaptureAnalysis === 'object') {
    const lc = raw.leadCaptureAnalysis as Record<string, unknown>;
    if (lc.summary) {
      parts.push(`**Lead Capture:** ${lc.summary}`);
    }
    if (lc.issues && Array.isArray(lc.issues)) {
      parts.push(formatArrayItems(lc.issues, 'Lead Capture Issues'));
    }
  }

  // Nurture analysis
  if (raw.nurtureAnalysis && typeof raw.nurtureAnalysis === 'object') {
    const nurture = raw.nurtureAnalysis as Record<string, unknown>;
    if (nurture.summary) {
      parts.push(`**Nurturing:** ${nurture.summary}`);
    }
    if (nurture.gaps && Array.isArray(nurture.gaps)) {
      parts.push(formatArrayItems(nurture.gaps, 'Nurture Gaps'));
    }
  }

  // Campaign performance
  if (raw.campaignPerformance && Array.isArray(raw.campaignPerformance)) {
    const campaigns = raw.campaignPerformance as Record<string, unknown>[];
    const campList = campaigns.slice(0, 5).map((c) => {
      const name = c.name || c.campaign || 'Unknown';
      const metric = c.roi !== undefined ? `ROI: ${c.roi}x` : c.performance || '';
      return `- ${name}${metric ? `: ${metric}` : ''}`;
    });
    if (campList.length > 0) {
      parts.push('**Campaign Performance:**');
      parts.push(campList.join('\n'));
    }
  }

  // Attribution gaps
  if (raw.attributionGaps && Array.isArray(raw.attributionGaps)) {
    parts.push(formatArrayItems(raw.attributionGaps, 'Attribution Gaps'));
  }

  // Summary
  if (labData.summary) {
    parts.push(`**Summary:** ${labData.summary}`);
  }

  return parts.join('\n\n');
}
