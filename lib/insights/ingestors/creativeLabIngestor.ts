// lib/insights/ingestors/creativeLabIngestor.ts
// Insight ingestor for Creative Lab diagnostics

import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import {
  runIngestor,
  safeExtractRawJson,
  formatArrayItems,
  type IngestorParams,
  type IngestorResult,
} from './baseIngestor';

/**
 * Extract insights from Creative Lab reports
 */
export async function ingestCreativeLab(params: IngestorParams): Promise<IngestorResult> {
  return runIngestor(params, {
    toolId: 'creativeLab',
    toolName: 'Creative Lab',
    labId: 'creative',

    extractReportData: extractCreativeLabData,
    systemPromptAddendum: `This is a Creative Lab report analyzing messaging architecture and creative strategy.
Focus on:
- Messaging clarity and differentiation gaps
- Audience resonance improvements
- Creative territory opportunities
- Campaign concept recommendations
- Brand consistency across creative output`,
  });
}

function extractCreativeLabData(run: DiagnosticRun): string {
  const raw = safeExtractRawJson(run);
  if (!raw) return run.summary || '';

  const parts: string[] = [];

  // Overall score
  if (run.score !== null) {
    parts.push(`**Overall Score:** ${run.score}/100`);
  }

  // Core messaging
  if (raw.coreMessaging && typeof raw.coreMessaging === 'object') {
    const msg = raw.coreMessaging as Record<string, unknown>;
    if (msg.valueProposition) {
      parts.push(`**Value Proposition:** ${msg.valueProposition}`);
    }
    if (msg.pillars && Array.isArray(msg.pillars)) {
      parts.push(formatArrayItems(msg.pillars, 'Messaging Pillars'));
    }
    if (msg.proofPoints && Array.isArray(msg.proofPoints)) {
      parts.push(formatArrayItems(msg.proofPoints, 'Proof Points'));
    }
  }

  // Audience messaging
  if (raw.audienceMessaging && Array.isArray(raw.audienceMessaging)) {
    const audiences = raw.audienceMessaging as Record<string, unknown>[];
    const audienceList = audiences.slice(0, 3).map((a) => {
      const segment = a.segment || a.audience || 'Unknown';
      const headline = a.headline || a.message || '';
      return `- ${segment}: "${headline}"`;
    });
    if (audienceList.length > 0) {
      parts.push('**Audience Messaging:**');
      parts.push(audienceList.join('\n'));
    }
  }

  // Creative territories
  if (raw.creativeTerritories && Array.isArray(raw.creativeTerritories)) {
    const territories = raw.creativeTerritories as Record<string, unknown>[];
    const terrList = territories.slice(0, 3).map((t) => {
      const name = t.name || t.theme || 'Unknown';
      const desc = t.description || '';
      return `- ${name}: ${desc}`;
    });
    if (terrList.length > 0) {
      parts.push('**Creative Territories:**');
      parts.push(terrList.join('\n'));
    }
  }

  // Campaign concepts
  if (raw.campaignConcepts && Array.isArray(raw.campaignConcepts)) {
    const concepts = raw.campaignConcepts as Record<string, unknown>[];
    const conceptList = concepts.slice(0, 3).map((c) => {
      const name = c.name || c.concept || 'Unknown';
      const hook = c.hook || c.headline || '';
      return `- ${name}: "${hook}"`;
    });
    if (conceptList.length > 0) {
      parts.push('**Campaign Concepts:**');
      parts.push(conceptList.join('\n'));
    }
  }

  // Voice and tone
  if (raw.voiceTone && typeof raw.voiceTone === 'object') {
    const vt = raw.voiceTone as Record<string, unknown>;
    if (vt.summary) {
      parts.push(`**Voice & Tone:** ${vt.summary}`);
    }
    if (vt.attributes && Array.isArray(vt.attributes)) {
      parts.push(formatArrayItems(vt.attributes, 'Voice Attributes'));
    }
  }

  // Visual guidelines
  if (raw.visualGuidelines && typeof raw.visualGuidelines === 'object') {
    const vg = raw.visualGuidelines as Record<string, unknown>;
    if (vg.summary) {
      parts.push(`**Visual Direction:** ${vg.summary}`);
    }
  }

  // Gaps and opportunities
  if (raw.messagingGaps && Array.isArray(raw.messagingGaps)) {
    parts.push(formatArrayItems(raw.messagingGaps, 'Messaging Gaps'));
  }
  if (raw.creativeOpportunities && Array.isArray(raw.creativeOpportunities)) {
    parts.push(formatArrayItems(raw.creativeOpportunities, 'Creative Opportunities'));
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
