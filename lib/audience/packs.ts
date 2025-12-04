// lib/audience/packs.ts
// Audience Packs for Media Lab and Creative Lab
//
// These packs provide pre-formatted audience data optimized for
// specific downstream use cases.

import type { AudienceModel, AudienceSegment, DemandState } from './model';
import type { MediaChannelId } from '@/lib/contextGraph/enums';

// ============================================================================
// Media Audience Pack
// ============================================================================

/**
 * Audience segment formatted for Media Lab consumption
 */
export interface MediaAudienceSegment {
  id: string;
  name: string;
  description?: string;
  demandState?: DemandState;
  priorityChannels: MediaChannelId[];
  avoidChannels: MediaChannelId[];
  behavioralDrivers: string[];
  keyObjections: string[];
  proofPointsNeeded: string[];
  priority?: 'primary' | 'secondary' | 'tertiary';
  estimatedSize?: string;
}

/**
 * Audience pack optimized for Media Lab planning
 *
 * Contains channel recommendations, behavioral insights, and
 * targeting guidance for media planning.
 */
export interface MediaAudiencePack {
  companyId: string;
  modelId: string;
  modelVersion: number;
  segments: MediaAudienceSegment[];
  summary: {
    totalSegments: number;
    primarySegments: number;
    mostCommonChannels: MediaChannelId[];
    channelsToAvoid: MediaChannelId[];
    demandStateDistribution: Record<DemandState, number>;
  };
  generatedAt: string;
}

/**
 * Build a Media Audience Pack from an Audience Model
 */
export function buildMediaAudiencePack(model: AudienceModel): MediaAudiencePack {
  const segments: MediaAudienceSegment[] = model.segments.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    demandState: s.primaryDemandState,
    priorityChannels: s.priorityChannels || [],
    avoidChannels: s.avoidChannels || [],
    behavioralDrivers: s.behavioralDrivers || [],
    keyObjections: s.keyObjections || [],
    proofPointsNeeded: s.proofPointsNeeded || [],
    priority: s.priority,
    estimatedSize: s.estimatedSize,
  }));

  // Calculate summary stats
  const channelCounts: Record<MediaChannelId, number> = {} as Record<MediaChannelId, number>;
  const avoidCounts: Record<MediaChannelId, number> = {} as Record<MediaChannelId, number>;
  const demandStateCounts: Record<DemandState, number> = {
    unaware: 0,
    problem_aware: 0,
    solution_aware: 0,
    in_market: 0,
    post_purchase: 0,
  };

  for (const segment of segments) {
    // Count priority channels
    for (const channel of segment.priorityChannels) {
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    }

    // Count avoid channels
    for (const channel of segment.avoidChannels) {
      avoidCounts[channel] = (avoidCounts[channel] || 0) + 1;
    }

    // Count demand states
    if (segment.demandState) {
      demandStateCounts[segment.demandState]++;
    }
  }

  // Get top channels
  const sortedChannels = Object.entries(channelCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([channel]) => channel as MediaChannelId);

  const sortedAvoidChannels = Object.entries(avoidCounts)
    .filter(([, count]) => count >= 2) // Only include if multiple segments avoid
    .sort(([, a], [, b]) => b - a)
    .map(([channel]) => channel as MediaChannelId);

  return {
    companyId: model.companyId,
    modelId: model.id,
    modelVersion: model.version,
    segments,
    summary: {
      totalSegments: segments.length,
      primarySegments: segments.filter(s => s.priority === 'primary').length,
      mostCommonChannels: sortedChannels,
      channelsToAvoid: sortedAvoidChannels,
      demandStateDistribution: demandStateCounts,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Creative Audience Pack
// ============================================================================

/**
 * Audience segment formatted for Creative Lab consumption
 */
export interface CreativeAudienceSegment {
  id: string;
  name: string;
  description?: string;
  jobsToBeDone: string[];
  keyPains: string[];
  keyGoals: string[];
  creativeAngles: string[];
  recommendedFormats: string[];
  proofPointsNeeded: string[];
  keyObjections: string[];
  demandState?: DemandState;
  demographics?: string;
  priority?: 'primary' | 'secondary' | 'tertiary';
}

/**
 * Audience pack optimized for Creative Lab briefs
 *
 * Contains messaging angles, format recommendations, and
 * emotional triggers for creative development.
 */
export interface CreativeAudiencePack {
  companyId: string;
  modelId: string;
  modelVersion: number;
  segments: CreativeAudienceSegment[];
  summary: {
    totalSegments: number;
    primarySegments: number;
    commonPains: string[];
    commonGoals: string[];
    topCreativeAngles: string[];
    topFormats: string[];
  };
  generatedAt: string;
}

/**
 * Build a Creative Audience Pack from an Audience Model
 */
export function buildCreativeAudiencePack(model: AudienceModel): CreativeAudiencePack {
  const segments: CreativeAudienceSegment[] = model.segments.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    jobsToBeDone: s.jobsToBeDone || [],
    keyPains: s.keyPains || [],
    keyGoals: s.keyGoals || [],
    creativeAngles: s.creativeAngles || [],
    recommendedFormats: s.recommendedFormats || [],
    proofPointsNeeded: s.proofPointsNeeded || [],
    keyObjections: s.keyObjections || [],
    demandState: s.primaryDemandState,
    demographics: s.demographics,
    priority: s.priority,
  }));

  // Aggregate common themes
  const painCounts: Record<string, number> = {};
  const goalCounts: Record<string, number> = {};
  const angleCounts: Record<string, number> = {};
  const formatCounts: Record<string, number> = {};

  for (const segment of segments) {
    for (const pain of segment.keyPains) {
      const normalized = pain.toLowerCase().trim();
      painCounts[normalized] = (painCounts[normalized] || 0) + 1;
    }
    for (const goal of segment.keyGoals) {
      const normalized = goal.toLowerCase().trim();
      goalCounts[normalized] = (goalCounts[normalized] || 0) + 1;
    }
    for (const angle of segment.creativeAngles) {
      const normalized = angle.toLowerCase().trim();
      angleCounts[normalized] = (angleCounts[normalized] || 0) + 1;
    }
    for (const format of segment.recommendedFormats) {
      const normalized = format.toLowerCase().trim();
      formatCounts[normalized] = (formatCounts[normalized] || 0) + 1;
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
    companyId: model.companyId,
    modelId: model.id,
    modelVersion: model.version,
    segments,
    summary: {
      totalSegments: segments.length,
      primarySegments: segments.filter(s => s.priority === 'primary').length,
      commonPains: getTopItems(painCounts),
      commonGoals: getTopItems(goalCounts),
      topCreativeAngles: getTopItems(angleCounts),
      topFormats: getTopItems(formatCounts),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a brief text summary of an audience pack for display
 */
export function getMediaPackSummary(pack: MediaAudiencePack): string {
  const { summary } = pack;
  const parts: string[] = [];

  parts.push(`${summary.totalSegments} segments`);

  if (summary.primarySegments > 0) {
    parts.push(`${summary.primarySegments} primary`);
  }

  if (summary.mostCommonChannels.length > 0) {
    parts.push(`Top channels: ${summary.mostCommonChannels.slice(0, 3).join(', ')}`);
  }

  return parts.join(' · ');
}

/**
 * Get a brief text summary of a creative pack for display
 */
export function getCreativePackSummary(pack: CreativeAudiencePack): string {
  const { summary } = pack;
  const parts: string[] = [];

  parts.push(`${summary.totalSegments} segments`);

  if (summary.topCreativeAngles.length > 0) {
    parts.push(`Top angles: ${summary.topCreativeAngles.slice(0, 2).join(', ')}`);
  }

  if (summary.topFormats.length > 0) {
    parts.push(`Formats: ${summary.topFormats.slice(0, 2).join(', ')}`);
  }

  return parts.join(' · ');
}

/**
 * Format a media pack for AI prompt consumption
 */
export function formatMediaPackForPrompt(pack: MediaAudiencePack): string {
  const lines: string[] = [
    `## Audience Model (${pack.segments.length} segments)`,
    '',
  ];

  for (const segment of pack.segments) {
    lines.push(`### ${segment.name}${segment.priority ? ` (${segment.priority})` : ''}`);

    if (segment.description) {
      lines.push(segment.description);
    }

    if (segment.demandState) {
      lines.push(`Demand State: ${segment.demandState.replace('_', ' ')}`);
    }

    if (segment.priorityChannels.length > 0) {
      lines.push(`Priority Channels: ${segment.priorityChannels.join(', ')}`);
    }

    if (segment.avoidChannels.length > 0) {
      lines.push(`Avoid Channels: ${segment.avoidChannels.join(', ')}`);
    }

    if (segment.behavioralDrivers.length > 0) {
      lines.push(`Behavioral Drivers: ${segment.behavioralDrivers.join(', ')}`);
    }

    if (segment.keyObjections.length > 0) {
      lines.push(`Key Objections: ${segment.keyObjections.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a creative pack for AI prompt consumption
 */
export function formatCreativePackForPrompt(pack: CreativeAudiencePack): string {
  const lines: string[] = [
    `## Audience Model (${pack.segments.length} segments)`,
    '',
  ];

  for (const segment of pack.segments) {
    lines.push(`### ${segment.name}${segment.priority ? ` (${segment.priority})` : ''}`);

    if (segment.description) {
      lines.push(segment.description);
    }

    if (segment.demographics) {
      lines.push(`Demographics: ${segment.demographics}`);
    }

    if (segment.demandState) {
      lines.push(`Demand State: ${segment.demandState.replace('_', ' ')}`);
    }

    if (segment.jobsToBeDone.length > 0) {
      lines.push(`Jobs to be Done: ${segment.jobsToBeDone.join(', ')}`);
    }

    if (segment.keyPains.length > 0) {
      lines.push(`Key Pains: ${segment.keyPains.join(', ')}`);
    }

    if (segment.keyGoals.length > 0) {
      lines.push(`Key Goals: ${segment.keyGoals.join(', ')}`);
    }

    if (segment.creativeAngles.length > 0) {
      lines.push(`Creative Angles: ${segment.creativeAngles.join(', ')}`);
    }

    if (segment.recommendedFormats.length > 0) {
      lines.push(`Recommended Formats: ${segment.recommendedFormats.join(', ')}`);
    }

    if (segment.proofPointsNeeded.length > 0) {
      lines.push(`Proof Points Needed: ${segment.proofPointsNeeded.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
