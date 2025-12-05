// lib/insights/ingestors/brandLabIngestor.ts
// Insight ingestor for Brand Lab diagnostics

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
 * Extract insights from Brand Lab reports
 */
export async function ingestBrandLab(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'brandLab',
    toolName: 'Brand Lab',
    labId: 'brand',

    extractReportData: extractBrandLabData,
    systemPromptAddendum: `This is a Brand Lab report analyzing brand health, clarity, and positioning.
Focus on:
- Brand clarity and memorability gaps
- Consistency issues across touchpoints
- Differentiation opportunities vs. competitors
- Brand story effectiveness and messaging alignment
- Value proposition clarity`,
  });
}

function extractBrandLabData(run: DiagnosticRun): string {
  const raw = safeExtractRawJson(run);
  if (!raw) return run.summary || '';

  const parts: string[] = [];

  // Overall score
  if (run.score !== null) {
    parts.push(`**Overall Score:** ${run.score}/100`);
  }

  // Subscores
  const scores: Record<string, number | null> = {};
  if (raw.positioningScore !== undefined) scores['Positioning'] = raw.positioningScore as number;
  if (raw.messagingScore !== undefined) scores['Messaging'] = raw.messagingScore as number;
  if (raw.visualIdentityScore !== undefined) scores['Visual Identity'] = raw.visualIdentityScore as number;
  if (raw.coherenceScore !== undefined) scores['Coherence'] = raw.coherenceScore as number;
  if (raw.differentiationScore !== undefined) scores['Differentiation'] = raw.differentiationScore as number;

  if (Object.keys(scores).length > 0) {
    parts.push('**Dimension Scores:**');
    parts.push(formatScores(scores));
  }

  // Positioning summary
  if (raw.positioningSummary) {
    parts.push(`**Positioning:** ${raw.positioningSummary}`);
  }

  // Value propositions
  if (raw.valueProps && Array.isArray(raw.valueProps)) {
    parts.push(formatArrayItems(raw.valueProps, 'Value Propositions'));
  }

  // Brand personality
  if (raw.brandPersonality) {
    parts.push(`**Brand Personality:** ${raw.brandPersonality}`);
  }

  // Voice and tone
  if (raw.voiceTone) {
    parts.push(`**Voice & Tone:** ${raw.voiceTone}`);
  }

  // Differentiators
  if (raw.differentiators && Array.isArray(raw.differentiators)) {
    parts.push(formatArrayItems(raw.differentiators, 'Differentiators'));
  }

  // Strengths and weaknesses
  if (raw.brandStrengths && Array.isArray(raw.brandStrengths)) {
    parts.push(formatArrayItems(raw.brandStrengths, 'Brand Strengths'));
  }
  if (raw.brandWeaknesses && Array.isArray(raw.brandWeaknesses)) {
    parts.push(formatArrayItems(raw.brandWeaknesses, 'Brand Weaknesses'));
  }

  // Competitive position
  if (raw.competitivePosition) {
    parts.push(`**Competitive Position:** ${raw.competitivePosition}`);
  }

  // Consistency issues
  if (raw.consistencyIssues && Array.isArray(raw.consistencyIssues)) {
    parts.push(formatArrayItems(raw.consistencyIssues, 'Consistency Issues'));
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
