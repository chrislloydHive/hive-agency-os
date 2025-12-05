// lib/insights/ingestors/audienceLabIngestor.ts
// Insight ingestor for Audience Lab diagnostics

import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import {
  runIngestor,
  extractLabData,
  formatArrayItems,
  type IngestorParams,
  type IngestorResult,
} from './baseIngestor';

/**
 * Extract insights from Audience Lab reports
 */
export async function ingestAudienceLab(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'audienceLab',
    toolName: 'Audience Lab',
    labId: 'audience',

    extractReportData: extractAudienceLabData,
    systemPromptAddendum: `This is an Audience Lab report analyzing target audience and ICP.
Focus on:
- ICP refinement opportunities
- Underserved or overlooked audience segments
- Pain point and motivation insights
- Channel and messaging preferences by segment
- Audience-product fit gaps`,
  });
}

function extractAudienceLabData(run: DiagnosticRun): string {
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

  // ICP summary
  if (raw.icpSummary) {
    parts.push(`**ICP Summary:** ${raw.icpSummary}`);
  }

  // Core segments
  if (raw.coreSegments && Array.isArray(raw.coreSegments)) {
    const segments = raw.coreSegments as Record<string, unknown>[];
    const segmentList = segments.map((s) => {
      const name = s.name || s.label || 'Unnamed';
      const desc = s.description || s.summary || '';
      return `- ${name}: ${desc}`;
    });
    if (segmentList.length > 0) {
      parts.push('**Core Segments:**');
      parts.push(segmentList.join('\n'));
    }
  }

  // Demographics
  if (raw.demographics) {
    parts.push(`**Demographics:** ${raw.demographics}`);
  }

  // Pain points
  if (raw.painPoints && Array.isArray(raw.painPoints)) {
    parts.push(formatArrayItems(raw.painPoints, 'Pain Points'));
  }

  // Motivations
  if (raw.motivations && Array.isArray(raw.motivations)) {
    parts.push(formatArrayItems(raw.motivations, 'Motivations'));
  }

  // Purchase behaviors
  if (raw.purchaseBehaviors && Array.isArray(raw.purchaseBehaviors)) {
    parts.push(formatArrayItems(raw.purchaseBehaviors, 'Purchase Behaviors'));
  }

  // Channel preferences
  if (raw.channelPreferences && Array.isArray(raw.channelPreferences)) {
    parts.push(formatArrayItems(raw.channelPreferences, 'Channel Preferences'));
  }

  // Gaps and opportunities
  if (raw.audienceGaps && Array.isArray(raw.audienceGaps)) {
    parts.push(formatArrayItems(raw.audienceGaps, 'Audience Gaps'));
  }
  if (raw.opportunities && Array.isArray(raw.opportunities)) {
    parts.push(formatArrayItems(raw.opportunities, 'Opportunities'));
  }

  // Personas (if detailed personas exist)
  if (raw.personas && Array.isArray(raw.personas)) {
    const personas = raw.personas as Record<string, unknown>[];
    const personaList = personas.slice(0, 3).map((p) => {
      const name = p.name || 'Unnamed Persona';
      const role = p.role || p.title || '';
      return `- ${name}${role ? ` (${role})` : ''}`;
    });
    if (personaList.length > 0) {
      parts.push('**Key Personas:**');
      parts.push(personaList.join('\n'));
    }
  }

  // Summary
  if (labData.summary) {
    parts.push(`**Summary:** ${labData.summary}`);
  }

  return parts.join('\n\n');
}
