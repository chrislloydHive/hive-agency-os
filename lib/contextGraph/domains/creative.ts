// lib/contextGraph/domains/creative.ts
// Creative Context Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';

/**
 * Creative format enum
 */
export const CreativeFormat = z.enum([
  'static_image',
  'carousel',
  'video_short',
  'video_long',
  'html5',
  'responsive_display',
  'text_ad',
  'native',
  'audio',
  'ugc',
  'influencer',
  'other',
]);

export type CreativeFormat = z.infer<typeof CreativeFormat>;

/**
 * Creative domain captures creative assets, messaging, and production capabilities.
 * This informs creative strategy and production planning.
 */
export const CreativeDomain = z.object({
  // Inventory
  creativeInventorySummary: WithMeta(z.string()),
  availableFormats: WithMetaArray(CreativeFormat),

  // Brand Guidelines
  brandGuidelines: WithMeta(z.string()),
  visualIdentityNotes: WithMeta(z.string()),

  // Messaging
  coreMessages: WithMetaArray(z.string()),
  proofPoints: WithMetaArray(z.string()),
  callToActions: WithMetaArray(z.string()),

  // Content Gaps
  contentGaps: WithMeta(z.string()),
  formatGaps: WithMetaArray(CreativeFormat),

  // Production
  productionScalability: WithMeta(z.string()),
  ugcPipelines: WithMeta(z.string()),
  productionBudget: WithMeta(z.number()),

  // Performance
  topPerformingCreatives: WithMetaArray(z.string()),
  creativeWearoutNotes: WithMeta(z.string()),
  testingRoadmap: WithMeta(z.string()),

  // Assets
  assetLibraryNotes: WithMeta(z.string()),
  stockVsOriginalRatio: WithMeta(z.string()),
});

export type CreativeDomain = z.infer<typeof CreativeDomain>;

/**
 * Create an empty Creative domain
 */
export function createEmptyCreativeDomain(): CreativeDomain {
  return {
    creativeInventorySummary: { value: null, provenance: [] },
    availableFormats: { value: [], provenance: [] },
    brandGuidelines: { value: null, provenance: [] },
    visualIdentityNotes: { value: null, provenance: [] },
    coreMessages: { value: [], provenance: [] },
    proofPoints: { value: [], provenance: [] },
    callToActions: { value: [], provenance: [] },
    contentGaps: { value: null, provenance: [] },
    formatGaps: { value: [], provenance: [] },
    productionScalability: { value: null, provenance: [] },
    ugcPipelines: { value: null, provenance: [] },
    productionBudget: { value: null, provenance: [] },
    topPerformingCreatives: { value: [], provenance: [] },
    creativeWearoutNotes: { value: null, provenance: [] },
    testingRoadmap: { value: null, provenance: [] },
    assetLibraryNotes: { value: null, provenance: [] },
    stockVsOriginalRatio: { value: null, provenance: [] },
  };
}
