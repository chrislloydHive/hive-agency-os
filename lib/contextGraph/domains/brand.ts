// lib/contextGraph/domains/brand.ts
// Brand & Positioning Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';

/**
 * Brand domain captures brand identity, positioning, and perception.
 * This informs creative strategy and messaging.
 */
export const BrandDomain = z.object({
  // Core Brand
  positioning: WithMeta(z.string()),
  tagline: WithMeta(z.string()),
  missionStatement: WithMeta(z.string()),

  // Value Proposition
  valueProps: WithMetaArray(z.string()),
  differentiators: WithMetaArray(z.string()),
  uniqueSellingPoints: WithMetaArray(z.string()),

  // Brand Voice
  toneOfVoice: WithMeta(z.string()),
  brandPersonality: WithMeta(z.string()),
  messagingPillars: WithMetaArray(z.string()),

  // Brand Perception
  brandPerception: WithMeta(z.string()),
  brandStrengths: WithMetaArray(z.string()),
  brandWeaknesses: WithMetaArray(z.string()),

  // Visual Identity
  visualIdentitySummary: WithMeta(z.string()),
  brandColors: WithMetaArray(z.string()),
  brandGuidelines: WithMeta(z.string()),

  // Competitive Position
  competitivePosition: WithMeta(z.string()),
  shareOfVoice: WithMeta(z.string()),
});

export type BrandDomain = z.infer<typeof BrandDomain>;

/**
 * Create an empty Brand domain
 */
export function createEmptyBrandDomain(): BrandDomain {
  return {
    positioning: { value: null, provenance: [] },
    tagline: { value: null, provenance: [] },
    missionStatement: { value: null, provenance: [] },
    valueProps: { value: [], provenance: [] },
    differentiators: { value: [], provenance: [] },
    uniqueSellingPoints: { value: [], provenance: [] },
    toneOfVoice: { value: null, provenance: [] },
    brandPersonality: { value: null, provenance: [] },
    messagingPillars: { value: [], provenance: [] },
    brandPerception: { value: null, provenance: [] },
    brandStrengths: { value: [], provenance: [] },
    brandWeaknesses: { value: [], provenance: [] },
    visualIdentitySummary: { value: null, provenance: [] },
    brandColors: { value: [], provenance: [] },
    brandGuidelines: { value: null, provenance: [] },
    competitivePosition: { value: null, provenance: [] },
    shareOfVoice: { value: null, provenance: [] },
  };
}
