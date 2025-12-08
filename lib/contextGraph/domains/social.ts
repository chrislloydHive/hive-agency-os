// lib/contextGraph/domains/social.ts
// Social Media & Local Presence Domain
//
// Captures social media presence, Google Business Profile, and local signals.
// This domain is populated by the socialDiscovery module during GAP runs.

import { z } from 'zod';
import { WithMeta } from '../types';

/**
 * Social Media & Local Presence Domain
 *
 * Tracks:
 * - Social media profile URLs and handles
 * - Google Business Profile presence
 * - Confidence scores for detection reliability
 */
export const SocialDomain = z.object({
  // Instagram
  instagramUrl: WithMeta(z.string().nullable()),
  instagramHandle: WithMeta(z.string().nullable()),

  // Facebook
  facebookUrl: WithMeta(z.string().nullable()),

  // TikTok
  tiktokUrl: WithMeta(z.string().nullable()),
  tiktokHandle: WithMeta(z.string().nullable()),

  // X (formerly Twitter)
  xUrl: WithMeta(z.string().nullable()),

  // LinkedIn
  linkedinUrl: WithMeta(z.string().nullable()),
  linkedinHandle: WithMeta(z.string().nullable()),

  // YouTube
  youtubeUrl: WithMeta(z.string().nullable()),

  // Pinterest
  pinterestUrl: WithMeta(z.string().nullable()),

  // Yelp
  yelpUrl: WithMeta(z.string().nullable()),

  // Google Business Profile
  gbpUrl: WithMeta(z.string().nullable()),

  // Confidence Scores (0-100)
  socialConfidence: WithMeta(z.number().min(0).max(100).nullable()),
  gbpConfidence: WithMeta(z.number().min(0).max(100).nullable()),

  // Boolean presence flags (for quick lookups)
  hasInstagram: WithMeta(z.boolean().nullable()),
  hasFacebook: WithMeta(z.boolean().nullable()),
  hasLinkedIn: WithMeta(z.boolean().nullable()),
  hasTikTok: WithMeta(z.boolean().nullable()),
  hasYouTube: WithMeta(z.boolean().nullable()),
  hasGBP: WithMeta(z.boolean().nullable()),

  // Summary narrative
  socialSummary: WithMeta(z.string().nullable()),

  // Discovery metadata
  lastDiscoveryAt: WithMeta(z.string().nullable()),
  discoverySource: WithMeta(z.string().nullable()), // 'gap_ia', 'manual', etc.
});

export type SocialDomain = z.infer<typeof SocialDomain>;

/**
 * Create an empty Social domain
 */
export function createEmptySocialDomain(): SocialDomain {
  return {
    instagramUrl: { value: null, provenance: [] },
    instagramHandle: { value: null, provenance: [] },
    facebookUrl: { value: null, provenance: [] },
    tiktokUrl: { value: null, provenance: [] },
    tiktokHandle: { value: null, provenance: [] },
    xUrl: { value: null, provenance: [] },
    linkedinUrl: { value: null, provenance: [] },
    linkedinHandle: { value: null, provenance: [] },
    youtubeUrl: { value: null, provenance: [] },
    pinterestUrl: { value: null, provenance: [] },
    yelpUrl: { value: null, provenance: [] },
    gbpUrl: { value: null, provenance: [] },
    socialConfidence: { value: null, provenance: [] },
    gbpConfidence: { value: null, provenance: [] },
    hasInstagram: { value: null, provenance: [] },
    hasFacebook: { value: null, provenance: [] },
    hasLinkedIn: { value: null, provenance: [] },
    hasTikTok: { value: null, provenance: [] },
    hasYouTube: { value: null, provenance: [] },
    hasGBP: { value: null, provenance: [] },
    socialSummary: { value: null, provenance: [] },
    lastDiscoveryAt: { value: null, provenance: [] },
    discoverySource: { value: null, provenance: [] },
  };
}
