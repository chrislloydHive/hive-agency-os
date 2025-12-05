// lib/insights/ingestors/mediaLabIngestor.ts
// Insight ingestor for Media Lab diagnostics

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
 * Extract insights from Media Lab reports
 */
export async function ingestMediaLab(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'mediaLab',
    toolName: 'Media Lab',
    labId: 'media',

    extractReportData: extractMediaLabData,
    systemPromptAddendum: `This is a Media Lab report analyzing performance media and paid advertising.
Focus on:
- Channel mix optimization opportunities
- Budget allocation recommendations
- Targeting and audience alignment
- Attribution and measurement gaps
- Quick wins for improved ROAS/CPA`,
  });
}

function extractMediaLabData(run: DiagnosticRun): string {
  const raw = safeExtractRawJson(run);
  if (!raw) return run.summary || '';

  const parts: string[] = [];

  // Overall score
  if (run.score !== null) {
    parts.push(`**Overall Score:** ${run.score}/100`);
  }

  // Subscores
  const scores: Record<string, number | null> = {};
  if (raw.channelMixScore !== undefined) scores['Channel Mix'] = raw.channelMixScore as number;
  if (raw.targetingScore !== undefined) scores['Targeting'] = raw.targetingScore as number;
  if (raw.budgetEfficiencyScore !== undefined) scores['Budget Efficiency'] = raw.budgetEfficiencyScore as number;
  if (raw.attributionScore !== undefined) scores['Attribution'] = raw.attributionScore as number;
  if (raw.creativeScore !== undefined) scores['Creative'] = raw.creativeScore as number;

  if (Object.keys(scores).length > 0) {
    parts.push('**Dimension Scores:**');
    parts.push(formatScores(scores));
  }

  // Active channels
  if (raw.activeChannels && Array.isArray(raw.activeChannels)) {
    parts.push(formatArrayItems(raw.activeChannels, 'Active Channels'));
  }

  // Channel performance
  if (raw.channelPerformance && Array.isArray(raw.channelPerformance)) {
    const channels = raw.channelPerformance as Record<string, unknown>[];
    const channelList = channels.slice(0, 5).map((c) => {
      const name = c.channel || c.name || 'Unknown';
      const roas = c.roas !== undefined ? `ROAS: ${c.roas}x` : '';
      const cpa = c.cpa !== undefined ? `CPA: $${c.cpa}` : '';
      const metrics = [roas, cpa].filter(Boolean).join(', ');
      return `- ${name}${metrics ? `: ${metrics}` : ''}`;
    });
    if (channelList.length > 0) {
      parts.push('**Channel Performance:**');
      parts.push(channelList.join('\n'));
    }
  }

  // Budget allocation
  if (raw.currentAllocation && typeof raw.currentAllocation === 'object') {
    const alloc = raw.currentAllocation as Record<string, unknown>;
    const allocList = Object.entries(alloc)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => `- ${k}: ${v}%`);
    if (allocList.length > 0) {
      parts.push('**Current Budget Allocation:**');
      parts.push(allocList.join('\n'));
    }
  }

  // Recommended allocation
  if (raw.recommendedAllocation && typeof raw.recommendedAllocation === 'object') {
    const alloc = raw.recommendedAllocation as Record<string, unknown>;
    const allocList = Object.entries(alloc)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => `- ${k}: ${v}%`);
    if (allocList.length > 0) {
      parts.push('**Recommended Allocation:**');
      parts.push(allocList.join('\n'));
    }
  }

  // Blended metrics
  if (raw.blendedCpa !== undefined) {
    parts.push(`**Blended CPA:** $${raw.blendedCpa}`);
  }
  if (raw.blendedRoas !== undefined) {
    parts.push(`**Blended ROAS:** ${raw.blendedRoas}x`);
  }

  // Targeting gaps
  if (raw.targetingGaps && Array.isArray(raw.targetingGaps)) {
    parts.push(formatArrayItems(raw.targetingGaps, 'Targeting Gaps'));
  }

  // Attribution issues
  if (raw.attributionIssues && Array.isArray(raw.attributionIssues)) {
    parts.push(formatArrayItems(raw.attributionIssues, 'Attribution Issues'));
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
