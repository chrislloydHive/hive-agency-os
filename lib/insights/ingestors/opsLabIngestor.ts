// lib/insights/ingestors/opsLabIngestor.ts
// Insight ingestor for Ops Lab diagnostics

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
 * Extract insights from Ops Lab reports
 */
export async function ingestOpsLab(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'opsLab',
    toolName: 'Ops Lab',
    labId: 'ops',

    extractReportData: extractOpsLabData,
    systemPromptAddendum: `This is an Ops Lab report analyzing marketing operations and processes.
Focus on:
- Process bottlenecks and efficiency improvements
- Automation opportunities
- Tool stack consolidation
- Data quality and hygiene issues
- Team capacity and workflow optimization`,
  });
}

function extractOpsLabData(run: DiagnosticRun): string {
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

  // Ops-specific subscores
  const scores: Record<string, number | null> = {};
  if (raw.processScore !== undefined) scores['Process'] = raw.processScore as number;
  if (raw.toolStackScore !== undefined) scores['Tool Stack'] = raw.toolStackScore as number;
  if (raw.automationScore !== undefined) scores['Automation'] = raw.automationScore as number;
  if (raw.dataQualityScore !== undefined) scores['Data Quality'] = raw.dataQualityScore as number;
  if (raw.capacityScore !== undefined) scores['Capacity'] = raw.capacityScore as number;

  if (Object.keys(scores).length > 0) {
    parts.push('**Dimension Scores:**');
    parts.push(formatScores(scores));
  }

  // Tool stack analysis
  if (raw.toolStackAnalysis && typeof raw.toolStackAnalysis === 'object') {
    const stack = raw.toolStackAnalysis as Record<string, unknown>;
    if (stack.summary) {
      parts.push(`**Tool Stack:** ${stack.summary}`);
    }
    if (stack.tools && Array.isArray(stack.tools)) {
      parts.push(formatArrayItems(stack.tools, 'Current Tools'));
    }
    if (stack.overlaps && Array.isArray(stack.overlaps)) {
      parts.push(formatArrayItems(stack.overlaps, 'Tool Overlaps'));
    }
    if (stack.gaps && Array.isArray(stack.gaps)) {
      parts.push(formatArrayItems(stack.gaps, 'Tool Gaps'));
    }
  }

  // Process bottlenecks
  if (raw.bottlenecks && Array.isArray(raw.bottlenecks)) {
    parts.push(formatArrayItems(raw.bottlenecks, 'Process Bottlenecks'));
  }

  // Automation opportunities
  if (raw.automationOpportunities && Array.isArray(raw.automationOpportunities)) {
    const opps = raw.automationOpportunities as Record<string, unknown>[];
    const oppList = opps.slice(0, 5).map((o) => {
      const name = o.name || o.process || o.title || 'Unknown';
      const savings = o.savings || o.timeSaved || o.impact || '';
      return `- ${name}${savings ? ` (${savings})` : ''}`;
    });
    if (oppList.length > 0) {
      parts.push('**Automation Opportunities:**');
      parts.push(oppList.join('\n'));
    }
  }

  // Data quality issues
  if (raw.dataQualityIssues && Array.isArray(raw.dataQualityIssues)) {
    parts.push(formatArrayItems(raw.dataQualityIssues, 'Data Quality Issues'));
  }

  // Capacity analysis
  if (raw.capacityAnalysis && typeof raw.capacityAnalysis === 'object') {
    const cap = raw.capacityAnalysis as Record<string, unknown>;
    if (cap.summary) {
      parts.push(`**Capacity:** ${cap.summary}`);
    }
    if (cap.overloaded && Array.isArray(cap.overloaded)) {
      parts.push(formatArrayItems(cap.overloaded, 'Overloaded Areas'));
    }
  }

  // Workflow improvements
  if (raw.workflowImprovements && Array.isArray(raw.workflowImprovements)) {
    parts.push(formatArrayItems(raw.workflowImprovements, 'Workflow Improvements'));
  }

  // Summary
  if (labData.summary) {
    parts.push(`**Summary:** ${labData.summary}`);
  }

  return parts.join('\n\n');
}
