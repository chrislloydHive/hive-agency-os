// lib/os/detection/types.ts
// Shared types for the detection system

/**
 * Source of a detected signal
 */
export interface SignalSource {
  type: 'schema-sameAs' | 'direct-link' | 'meta-tag' | 'search-result' | 'api' | 'inferred' | 'pattern-match';
  value: string;
  confidence: number;
  url?: string;
}

/**
 * Social platform identifiers
 */
export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x';

/**
 * Social profile signal
 */
export interface SocialSignal {
  platform: SocialPlatform;
  url: string | null;
  username: string | null;
  confidence: number;
  sources: SignalSource[];
  failureReasons: string[];
}

/**
 * Google Business Profile signal
 */
export interface GBPSignal {
  found: boolean;
  url: string | null;
  placeId: string | null;
  businessName: string | null;
  confidence: number;
  sources: SignalSource[];
  failureReasons: string[];
}

/**
 * Schema.org signal
 */
export interface SchemaSignal {
  type: string;
  url: string | null;
  name: string | null;
  sameAs: string[];
  raw: Record<string, unknown>;
}

/**
 * Discovered page info
 */
export interface DiscoveredPage {
  url: string;
  depth: number;
  status: number | null;
  title: string | null;
  type: 'internal' | 'external';
  linkCount: number;
}

/**
 * Expected page that wasn't found
 */
export interface MissingPage {
  path: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Multi-page discovery result
 */
export interface DiscoveryResult {
  discoveredPages: DiscoveredPage[];
  missingPages: MissingPage[];
  totalLinksFound: number;
  maxDepthReached: number;
  confidence: number;
  errors: string[];
}

/**
 * Detection failure mode
 */
export interface DetectionFailure {
  code: string;
  message: string;
  recoverable: boolean;
  partial?: unknown;
}

/**
 * Complete detection result
 */
export interface DetectionResult {
  success: boolean;
  domain: string;
  gbp: GBPSignal;
  socials: SocialSignal[];
  schema: SchemaSignal[];
  discovery: DiscoveryResult;
  globalConfidence: number;
  failures: DetectionFailure[];
  detectedAt: string;
}

/**
 * Platform URL patterns for detection
 */
export const PLATFORM_PATTERNS: Record<SocialPlatform, RegExp[]> = {
  facebook: [
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:pages\/)?([^\/\?]+)/i,
    /(?:https?:\/\/)?(?:www\.)?fb\.com\/([^\/\?]+)/i,
  ],
  instagram: [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^\/\?]+)/i,
    /(?:https?:\/\/)?(?:www\.)?instagr\.am\/([^\/\?]+)/i,
  ],
  tiktok: [
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([^\/\?]+)/i,
  ],
  youtube: [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c\/|channel\/|user\/|@)?([^\/\?]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^\/\?]+)/i,
  ],
  linkedin: [
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/([^\/\?]+)/i,
  ],
  x: [
    /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([^\/\?]+)/i,
  ],
};

/**
 * Platform domain patterns for URL classification
 */
export const PLATFORM_DOMAINS: Record<SocialPlatform, string[]> = {
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  instagram: ['instagram.com', 'instagr.am'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
  linkedin: ['linkedin.com'],
  x: ['twitter.com', 'x.com'],
};

/**
 * GBP URL patterns
 */
export const GBP_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?google\.com\/maps\/place\/[^\/]+/i,
  /(?:https?:\/\/)?maps\.google\.com\/[^\s]+/i,
  /(?:https?:\/\/)?g\.page\/([^\/\?]+)/i,
  /(?:https?:\/\/)?goo\.gl\/maps\/([^\/\?]+)/i,
  /(?:https?:\/\/)?(?:www\.)?google\.com\/maps\?cid=(\d+)/i,
];

/**
 * Expected pages for completeness check
 */
export const EXPECTED_PAGES = [
  { path: '/about', importance: 'high' as const, reason: 'About page builds trust' },
  { path: '/contact', importance: 'critical' as const, reason: 'Contact page is essential for conversions' },
  { path: '/services', importance: 'high' as const, reason: 'Services page explains offerings' },
  { path: '/products', importance: 'medium' as const, reason: 'Products page for e-commerce' },
  { path: '/pricing', importance: 'medium' as const, reason: 'Pricing transparency' },
  { path: '/blog', importance: 'medium' as const, reason: 'Blog supports SEO and thought leadership' },
  { path: '/team', importance: 'low' as const, reason: 'Team page humanizes brand' },
  { path: '/faq', importance: 'low' as const, reason: 'FAQ reduces support load' },
  { path: '/privacy', importance: 'high' as const, reason: 'Privacy policy is legally required' },
  { path: '/terms', importance: 'medium' as const, reason: 'Terms of service for legal protection' },
];
