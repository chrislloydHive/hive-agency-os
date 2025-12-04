// lib/contextGraph/domains/content.ts
// Content & Creative Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';

/**
 * Creative Asset definition
 */
export const CreativeAsset = z.object({
  type: z.enum(['video', 'image', 'copy', 'landing_page', 'email', 'social', 'other']),
  name: z.string(),
  status: z.enum(['available', 'needs_refresh', 'missing']),
  quality: z.enum(['high', 'medium', 'low']).nullable(),
  notes: z.string().nullable(),
});

export type CreativeAsset = z.infer<typeof CreativeAsset>;

/**
 * Content Gap definition
 */
export const ContentGap = z.object({
  topic: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  audienceNeed: z.string().nullable(),
  recommendedFormat: z.string().nullable(),
});

export type ContentGap = z.infer<typeof ContentGap>;

/**
 * Content domain captures content strategy, assets, and gaps.
 * This informs creative development and content marketing.
 */
export const ContentDomain = z.object({
  // Content Health
  contentScore: WithMeta(z.number()),
  contentSummary: WithMeta(z.string()),

  // Topics & Themes
  keyTopics: WithMetaArray(z.string()),
  topPerformingThemes: WithMetaArray(z.string()),
  contentPillars: WithMetaArray(z.string()),

  // Content Inventory
  creativeInventorySummary: WithMeta(z.string()),
  creativeAssets: WithMetaArray(CreativeAsset),
  availableFormats: WithMetaArray(z.string()),

  // Gaps & Opportunities
  contentGaps: WithMetaArray(ContentGap),
  audienceContentNeeds: WithMetaArray(z.string()),
  competitorContentAdvantages: WithMetaArray(z.string()),

  // Messaging
  coreMessages: WithMetaArray(z.string()),
  proofPoints: WithMetaArray(z.string()),
  callToActions: WithMetaArray(z.string()),

  // Guidelines
  brandGuidelines: WithMeta(z.string()),
  toneGuidelines: WithMeta(z.string()),
  styleNotes: WithMeta(z.string()),

  // Production
  productionCapacity: WithMeta(z.string()),
  productionScalability: WithMeta(z.string()),
  ugcPipelines: WithMeta(z.string()),

  // Quality
  qualityNotes: WithMeta(z.string()),
  consistencyScore: WithMeta(z.number()),
});

export type ContentDomain = z.infer<typeof ContentDomain>;

/**
 * Create an empty Content domain
 */
export function createEmptyContentDomain(): ContentDomain {
  return {
    contentScore: { value: null, provenance: [] },
    contentSummary: { value: null, provenance: [] },
    keyTopics: { value: [], provenance: [] },
    topPerformingThemes: { value: [], provenance: [] },
    contentPillars: { value: [], provenance: [] },
    creativeInventorySummary: { value: null, provenance: [] },
    creativeAssets: { value: [], provenance: [] },
    availableFormats: { value: [], provenance: [] },
    contentGaps: { value: [], provenance: [] },
    audienceContentNeeds: { value: [], provenance: [] },
    competitorContentAdvantages: { value: [], provenance: [] },
    coreMessages: { value: [], provenance: [] },
    proofPoints: { value: [], provenance: [] },
    callToActions: { value: [], provenance: [] },
    brandGuidelines: { value: null, provenance: [] },
    toneGuidelines: { value: null, provenance: [] },
    styleNotes: { value: null, provenance: [] },
    productionCapacity: { value: null, provenance: [] },
    productionScalability: { value: null, provenance: [] },
    ugcPipelines: { value: null, provenance: [] },
    qualityNotes: { value: null, provenance: [] },
    consistencyScore: { value: null, provenance: [] },
  };
}
