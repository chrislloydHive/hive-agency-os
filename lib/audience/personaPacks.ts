// lib/audience/personaPacks.ts
// Persona Packs for Media Lab and Creative Lab
//
// These packs provide pre-formatted persona data optimized for
// specific downstream use cases like media planning and creative briefing.

import type { PersonaSet, Persona } from './personas';
import type { MediaChannelId } from '@/lib/contextGraph/enums';

// ============================================================================
// Media Persona Pack
// ============================================================================

/**
 * Persona formatted for Media Lab consumption
 */
export interface MediaPersona {
  id: string;
  name: string;
  tagline?: string;
  linkedSegmentIds: string[];
  demandState?: string;
  mediaHabits?: string;
  channelsToUse: string[];
  channelsToAvoid: string[];
  triggers: string[];
  objections: string[];
  decisionFactors: string[];
  priority?: 'primary' | 'secondary' | 'tertiary';
}

/**
 * Persona pack optimized for Media Lab planning
 *
 * Contains channel recommendations, behavioral insights, and
 * targeting guidance for media planning.
 */
export interface MediaPersonaPack {
  companyId: string;
  personaSetId: string;
  audienceModelId: string;
  personas: MediaPersona[];
  summary: {
    totalPersonas: number;
    primaryPersonas: number;
    mostCommonChannels: string[];
    channelsToAvoid: string[];
    demandStates: string[];
    commonTriggers: string[];
  };
  generatedAt: string;
}

/**
 * Build a Media Persona Pack from a PersonaSet
 */
export function buildMediaPersonaPack(set: PersonaSet): MediaPersonaPack {
  const personas: MediaPersona[] = set.personas.map(p => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    linkedSegmentIds: p.linkedSegmentIds,
    demandState: p.demandState,
    mediaHabits: p.mediaHabits,
    channelsToUse: p.channelsToUse,
    channelsToAvoid: p.channelsToAvoid,
    triggers: p.triggers,
    objections: p.objections,
    decisionFactors: p.decisionFactors,
    priority: p.priority,
  }));

  // Calculate summary stats
  const channelCounts: Record<string, number> = {};
  const avoidCounts: Record<string, number> = {};
  const demandStates = new Set<string>();
  const triggerCounts: Record<string, number> = {};

  for (const persona of personas) {
    // Count channels to use
    for (const channel of persona.channelsToUse) {
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    }

    // Count channels to avoid
    for (const channel of persona.channelsToAvoid) {
      avoidCounts[channel] = (avoidCounts[channel] || 0) + 1;
    }

    // Collect demand states
    if (persona.demandState) {
      demandStates.add(persona.demandState);
    }

    // Count triggers
    for (const trigger of persona.triggers) {
      const normalized = trigger.toLowerCase().trim();
      triggerCounts[normalized] = (triggerCounts[normalized] || 0) + 1;
    }
  }

  // Get top channels
  const sortedChannels = Object.entries(channelCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([channel]) => channel);

  const sortedAvoidChannels = Object.entries(avoidCounts)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .map(([channel]) => channel);

  const commonTriggers = Object.entries(triggerCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([trigger]) => trigger);

  return {
    companyId: set.companyId,
    personaSetId: set.id,
    audienceModelId: set.audienceModelId,
    personas,
    summary: {
      totalPersonas: personas.length,
      primaryPersonas: personas.filter(p => p.priority === 'primary').length,
      mostCommonChannels: sortedChannels,
      channelsToAvoid: sortedAvoidChannels,
      demandStates: Array.from(demandStates),
      commonTriggers,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Creative Persona Pack
// ============================================================================

/**
 * Persona formatted for Creative Lab consumption
 */
export interface CreativePersona {
  id: string;
  name: string;
  tagline?: string;
  oneSentenceSummary?: string;
  linkedSegmentIds: string[];
  backstory?: string;
  dayInTheLife?: string;
  jobsToBeDone: string[];
  triggers: string[];
  objections: string[];
  keyMessages: string[];
  proofPoints: string[];
  exampleHooks: string[];
  toneGuidance?: string;
  contentFormatsPreferred: string[];
  priority?: 'primary' | 'secondary' | 'tertiary';
}

/**
 * Persona pack optimized for Creative Lab briefs
 *
 * Contains messaging guidance, creative hooks, and
 * narrative elements for creative development.
 */
export interface CreativePersonaPack {
  companyId: string;
  personaSetId: string;
  audienceModelId: string;
  personas: CreativePersona[];
  summary: {
    totalPersonas: number;
    primaryPersonas: number;
    commonJobs: string[];
    commonObjections: string[];
    topFormats: string[];
    allHooks: string[];
  };
  generatedAt: string;
}

/**
 * Build a Creative Persona Pack from a PersonaSet
 */
export function buildCreativePersonaPack(set: PersonaSet): CreativePersonaPack {
  const personas: CreativePersona[] = set.personas.map(p => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    oneSentenceSummary: p.oneSentenceSummary,
    linkedSegmentIds: p.linkedSegmentIds,
    backstory: p.backstory,
    dayInTheLife: p.dayInTheLife,
    jobsToBeDone: p.jobsToBeDone,
    triggers: p.triggers,
    objections: p.objections,
    keyMessages: p.keyMessages,
    proofPoints: p.proofPoints,
    exampleHooks: p.exampleHooks,
    toneGuidance: p.toneGuidance,
    contentFormatsPreferred: p.contentFormatsPreferred,
    priority: p.priority,
  }));

  // Aggregate common themes
  const jobCounts: Record<string, number> = {};
  const objectionCounts: Record<string, number> = {};
  const formatCounts: Record<string, number> = {};
  const allHooks: string[] = [];

  for (const persona of personas) {
    for (const job of persona.jobsToBeDone) {
      const normalized = job.toLowerCase().trim();
      jobCounts[normalized] = (jobCounts[normalized] || 0) + 1;
    }
    for (const objection of persona.objections) {
      const normalized = objection.toLowerCase().trim();
      objectionCounts[normalized] = (objectionCounts[normalized] || 0) + 1;
    }
    for (const format of persona.contentFormatsPreferred) {
      const normalized = format.toLowerCase().trim();
      formatCounts[normalized] = (formatCounts[normalized] || 0) + 1;
    }
    // Collect all example hooks
    for (const hook of persona.exampleHooks) {
      if (hook.trim()) {
        allHooks.push(hook.trim());
      }
    }
  }

  // Get top items
  const getTopItems = (counts: Record<string, number>, limit: number = 5): string[] => {
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  };

  return {
    companyId: set.companyId,
    personaSetId: set.id,
    audienceModelId: set.audienceModelId,
    personas,
    summary: {
      totalPersonas: personas.length,
      primaryPersonas: personas.filter(p => p.priority === 'primary').length,
      commonJobs: getTopItems(jobCounts),
      commonObjections: getTopItems(objectionCounts),
      topFormats: getTopItems(formatCounts),
      allHooks,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a brief text summary of a media persona pack for display
 */
export function getMediaPersonaPackSummary(pack: MediaPersonaPack): string {
  const { summary } = pack;
  const parts: string[] = [];

  parts.push(`${summary.totalPersonas} personas`);

  if (summary.primaryPersonas > 0) {
    parts.push(`${summary.primaryPersonas} primary`);
  }

  if (summary.mostCommonChannels.length > 0) {
    parts.push(`Top channels: ${summary.mostCommonChannels.slice(0, 3).join(', ')}`);
  }

  return parts.join(' · ');
}

/**
 * Get a brief text summary of a creative persona pack for display
 */
export function getCreativePersonaPackSummary(pack: CreativePersonaPack): string {
  const { summary } = pack;
  const parts: string[] = [];

  parts.push(`${summary.totalPersonas} personas`);

  if (summary.allHooks.length > 0) {
    parts.push(`${summary.allHooks.length} example hooks`);
  }

  if (summary.topFormats.length > 0) {
    parts.push(`Formats: ${summary.topFormats.slice(0, 2).join(', ')}`);
  }

  return parts.join(' · ');
}

/**
 * Format a media persona pack for AI prompt consumption
 */
export function formatMediaPersonaPackForPrompt(pack: MediaPersonaPack): string {
  const lines: string[] = [
    `## Target Personas (${pack.personas.length} personas)`,
    '',
  ];

  for (const persona of pack.personas) {
    lines.push(`### ${persona.name}${persona.priority ? ` (${persona.priority})` : ''}`);

    if (persona.tagline) {
      lines.push(`*${persona.tagline}*`);
    }

    if (persona.demandState) {
      lines.push(`Demand State: ${persona.demandState.replace('_', ' ')}`);
    }

    if (persona.mediaHabits) {
      lines.push(`Media Habits: ${persona.mediaHabits}`);
    }

    if (persona.channelsToUse.length > 0) {
      lines.push(`Priority Channels: ${persona.channelsToUse.join(', ')}`);
    }

    if (persona.channelsToAvoid.length > 0) {
      lines.push(`Avoid Channels: ${persona.channelsToAvoid.join(', ')}`);
    }

    if (persona.triggers.length > 0) {
      lines.push(`Triggers: ${persona.triggers.join('; ')}`);
    }

    if (persona.objections.length > 0) {
      lines.push(`Objections: ${persona.objections.join('; ')}`);
    }

    if (persona.decisionFactors.length > 0) {
      lines.push(`Decision Factors: ${persona.decisionFactors.join('; ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a creative persona pack for AI prompt consumption
 */
export function formatCreativePersonaPackForPrompt(pack: CreativePersonaPack): string {
  const lines: string[] = [
    `## Target Personas (${pack.personas.length} personas)`,
    '',
  ];

  for (const persona of pack.personas) {
    lines.push(`### ${persona.name}${persona.priority ? ` (${persona.priority})` : ''}`);

    if (persona.tagline) {
      lines.push(`*${persona.tagline}*`);
    }

    if (persona.oneSentenceSummary) {
      lines.push(persona.oneSentenceSummary);
    }

    if (persona.backstory) {
      lines.push(`\nBackstory: ${persona.backstory}`);
    }

    if (persona.dayInTheLife) {
      lines.push(`\nA Day in Their Life: ${persona.dayInTheLife}`);
    }

    if (persona.jobsToBeDone.length > 0) {
      lines.push(`\nJobs to be Done: ${persona.jobsToBeDone.join('; ')}`);
    }

    if (persona.triggers.length > 0) {
      lines.push(`Triggers: ${persona.triggers.join('; ')}`);
    }

    if (persona.objections.length > 0) {
      lines.push(`Objections: ${persona.objections.join('; ')}`);
    }

    if (persona.keyMessages.length > 0) {
      lines.push(`\nKey Messages: ${persona.keyMessages.join('; ')}`);
    }

    if (persona.proofPoints.length > 0) {
      lines.push(`Proof Points Needed: ${persona.proofPoints.join('; ')}`);
    }

    if (persona.exampleHooks.length > 0) {
      lines.push(`\nExample Hooks:`);
      for (const hook of persona.exampleHooks) {
        lines.push(`- "${hook}"`);
      }
    }

    if (persona.toneGuidance) {
      lines.push(`\nTone Guidance: ${persona.toneGuidance}`);
    }

    if (persona.contentFormatsPreferred.length > 0) {
      lines.push(`Preferred Formats: ${persona.contentFormatsPreferred.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get a single persona brief for creative work
 */
export function getPersonaBrief(persona: Persona): string {
  const lines: string[] = [];

  lines.push(`# ${persona.name}`);

  if (persona.tagline) {
    lines.push(`*${persona.tagline}*`);
  }

  if (persona.oneSentenceSummary) {
    lines.push(`\n${persona.oneSentenceSummary}`);
  }

  if (persona.backstory) {
    lines.push(`\n## Who They Are\n${persona.backstory}`);
  }

  if (persona.dayInTheLife) {
    lines.push(`\n## A Day in Their Life\n${persona.dayInTheLife}`);
  }

  if (persona.jobsToBeDone.length > 0) {
    lines.push(`\n## What They Need (Jobs to be Done)`);
    for (const job of persona.jobsToBeDone) {
      lines.push(`- ${job}`);
    }
  }

  if (persona.triggers.length > 0) {
    lines.push(`\n## What Prompts Action (Triggers)`);
    for (const trigger of persona.triggers) {
      lines.push(`- ${trigger}`);
    }
  }

  if (persona.objections.length > 0) {
    lines.push(`\n## Hesitations & Objections`);
    for (const objection of persona.objections) {
      lines.push(`- ${objection}`);
    }
  }

  if (persona.keyMessages.length > 0) {
    lines.push(`\n## Key Messages That Resonate`);
    for (const msg of persona.keyMessages) {
      lines.push(`- ${msg}`);
    }
  }

  if (persona.proofPoints.length > 0) {
    lines.push(`\n## Proof They Need`);
    for (const proof of persona.proofPoints) {
      lines.push(`- ${proof}`);
    }
  }

  if (persona.exampleHooks.length > 0) {
    lines.push(`\n## Example Hooks`);
    for (const hook of persona.exampleHooks) {
      lines.push(`- "${hook}"`);
    }
  }

  if (persona.toneGuidance) {
    lines.push(`\n## Tone Guidance\n${persona.toneGuidance}`);
  }

  if (persona.mediaHabits) {
    lines.push(`\n## Media Habits\n${persona.mediaHabits}`);
  }

  if (persona.channelsToUse.length > 0) {
    lines.push(`\n## Best Channels: ${persona.channelsToUse.join(', ')}`);
  }

  if (persona.contentFormatsPreferred.length > 0) {
    lines.push(`## Preferred Formats: ${persona.contentFormatsPreferred.join(', ')}`);
  }

  return lines.join('\n');
}
