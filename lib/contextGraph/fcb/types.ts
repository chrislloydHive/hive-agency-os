// lib/contextGraph/fcb/types.ts
// Types for Foundational Context Builder (FCB)
//
// FCB auto-populates 40-60% of the Context Graph from public signals
// like the company website, metadata, and social profiles.

import type { ContextSource } from '../types';

// ============================================================================
// Signal Collection Types
// ============================================================================

/**
 * Raw page content from a scraped URL
 */
export interface PageContent {
  /** URL of the page */
  url: string;
  /** Raw HTML content */
  html: string;
  /** Extracted text content (no HTML tags) */
  text: string;
  /** Page title */
  title?: string;
  /** Load time in milliseconds */
  loadTimeMs?: number;
}

/**
 * Structured metadata extracted from HTML
 */
export interface MetaTags {
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
  robots?: string;
}

/**
 * OpenGraph metadata for social sharing
 */
export interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
  siteName?: string;
  url?: string;
}

/**
 * Schema.org structured data
 */
export interface SchemaOrgData {
  organization?: {
    name?: string;
    description?: string;
    url?: string;
    logo?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      addressCountry?: string;
    };
    contactPoint?: {
      telephone?: string;
      email?: string;
      contactType?: string;
    };
    sameAs?: string[]; // Social profile URLs
  };
  localBusiness?: {
    name?: string;
    description?: string;
    priceRange?: string;
    openingHours?: string[];
    areaServed?: string[];
    serviceArea?: string[];
  };
  product?: {
    name?: string;
    description?: string;
    offers?: {
      price?: string;
      priceCurrency?: string;
    };
  }[];
  service?: {
    name?: string;
    description?: string;
    provider?: string;
    areaServed?: string[];
  }[];
}

/**
 * Social media profile links discovered on the website
 */
export interface SocialLinks {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
}

/**
 * Complete signal bundle collected from a company's web presence
 */
export interface SignalBundle {
  /** Company ID in the system */
  companyId: string;
  /** Company domain (e.g., example.com) */
  domain: string;
  /** Company name from system */
  companyName: string;

  // ============================================================================
  // Raw Page Content
  // ============================================================================

  /** Homepage content */
  homepage: PageContent;
  /** About page content (if found) */
  aboutPage?: PageContent;
  /** Services/Products page content (if found) */
  servicesPage?: PageContent;
  /** Pricing page content (if found) */
  pricingPage?: PageContent;
  /** Contact page content (if found) */
  contactPage?: PageContent;

  // ============================================================================
  // Structured Metadata
  // ============================================================================

  /** HTML meta tags */
  metaTags: MetaTags;
  /** OpenGraph metadata */
  openGraph: OpenGraphData;
  /** Schema.org structured data */
  schemaOrg?: SchemaOrgData;

  // ============================================================================
  // External Signals
  // ============================================================================

  /** Social media profile links */
  socialLinks: SocialLinks;
  /** Google Business Profile data (if available in system) */
  gbpData?: Record<string, unknown>;

  // ============================================================================
  // Existing System Data (Optional Boost)
  // ============================================================================

  /** Latest GAP IA data if available */
  latestGapIa?: Record<string, unknown>;
  /** Latest Website Lab data if available */
  latestWebsiteLab?: Record<string, unknown>;

  // ============================================================================
  // Metadata
  // ============================================================================

  /** Timestamp when signals were collected */
  collectedAt: string;
  /** Collection diagnostics */
  collectionDiagnostics: CollectionDiagnostic[];
}

/**
 * Diagnostic from signal collection
 */
export interface CollectionDiagnostic {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  /** Optional URL or field that triggered this diagnostic */
  context?: string;
}

// ============================================================================
// Extractor Types
// ============================================================================

/**
 * A single field extraction from an extractor
 */
export interface ExtractedField {
  /** Full path to the field (e.g., "identity.businessDescription") */
  path: string;
  /** Extracted value */
  value: unknown;
  /** Confidence score 0-1 */
  confidence: number;
  /** Why this value was extracted */
  reasoning?: string;
}

/**
 * Diagnostic from an extractor
 */
export interface ExtractorDiagnostic {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  /** Field path if applicable */
  fieldPath?: string;
}

/**
 * Result from a single extractor
 */
export interface ExtractorResult {
  /** Extracted fields */
  fields: ExtractedField[];
  /** Diagnostics from extraction */
  diagnostics: ExtractorDiagnostic[];
  /** Source that should be used for provenance */
  source: ContextSource;
}

/**
 * Extractor function signature
 */
export type ExtractorFn = (signals: SignalBundle) => Promise<ExtractorResult>;

/**
 * Registry of extractors by domain
 */
export interface ExtractorRegistry {
  identity: ExtractorFn;
  audience: ExtractorFn;
  productOffer: ExtractorFn;
  brand: ExtractorFn;
  website: ExtractorFn;
  competitive: ExtractorFn;
}

// ============================================================================
// FCB Run Types
// ============================================================================

/**
 * Result from a complete FCB run
 */
export interface FCBRunResult {
  /** Whether the run succeeded */
  success: boolean;
  /** Company ID */
  companyId: string;
  /** Run ID for tracking */
  runId: string;
  /** Timestamp when run started */
  startedAt: string;
  /** Timestamp when run completed */
  completedAt: string;
  /** Duration in milliseconds */
  durationMs: number;

  /** Total fields extracted across all extractors */
  totalFieldsExtracted: number;
  /** Fields written to the graph (some may be skipped due to priority) */
  fieldsWritten: number;
  /** Fields skipped (human override or higher priority source) */
  fieldsSkipped: number;

  /** Results by extractor/domain */
  extractorResults: {
    identity: ExtractorSummary;
    audience: ExtractorSummary;
    productOffer: ExtractorSummary;
    brand: ExtractorSummary;
    website: ExtractorSummary;
    competitive: ExtractorSummary;
  };

  /** All diagnostics from the run */
  diagnostics: (CollectionDiagnostic | ExtractorDiagnostic)[];

  /** Error if run failed */
  error?: string;
}

/**
 * Summary from a single extractor
 */
export interface ExtractorSummary {
  /** Number of fields extracted */
  fieldsExtracted: number;
  /** Number of fields written */
  fieldsWritten: number;
  /** Number of fields skipped */
  fieldsSkipped: number;
  /** Average confidence of extracted fields */
  avgConfidence: number;
  /** Field paths that were written */
  writtenPaths: string[];
  /** Field paths that were skipped (with reason) */
  skippedPaths: Array<{ path: string; reason: string }>;
}

// ============================================================================
// FCB Target Fields
// ============================================================================

/**
 * Fields that FCB targets for extraction
 * These are the foundational fields that can be reliably extracted from
 * website signals with varying confidence levels.
 */
export const FCB_TARGET_FIELDS = {
  // Identity fields (high confidence from website)
  identity: [
    'identity.businessName',
    'identity.businessDescription',
    'identity.industry',
    'identity.businessModel',
    'identity.primaryOffering',
    'identity.geographicFootprint',
    'identity.serviceArea',
    'identity.foundedYear',
    'identity.companySize',
  ],

  // Audience fields (medium confidence - inferred)
  audience: [
    'audience.primaryAudience',
    'audience.audienceDescription',
    'audience.targetDemographics',
    'audience.buyerTypes',
  ],

  // Product/Offer fields (high confidence from services/pricing pages)
  productOffer: [
    'productOffer.primaryProducts',
    'productOffer.services',
    'productOffer.valueProposition',
    'productOffer.pricingModel',
    'productOffer.keyDifferentiators',
  ],

  // Brand fields (medium confidence from voice/tone analysis)
  brand: [
    'brand.tagline',
    'brand.voiceDescriptors',
    'brand.brandPromise',
    'brand.brandPersonality',
    'brand.toneOfVoice',
  ],

  // Website fields (high confidence from page structure)
  website: [
    'website.primaryCTA',
    'website.keyPages',
    'website.conversionGoals',
    'website.mainNavigation',
    'website.hasContactForm',
    'website.hasLiveChat',
    'website.hasBlog',
  ],

  // Competitive fields (low confidence - inferred from mentions)
  competitive: [
    'competitive.primaryCompetitors',
    'competitive.positioningAxes',
    'competitive.positioningSummary',
  ],
} as const;

/**
 * All target field paths flattened
 */
export type FCBTargetFieldPath =
  | (typeof FCB_TARGET_FIELDS.identity)[number]
  | (typeof FCB_TARGET_FIELDS.audience)[number]
  | (typeof FCB_TARGET_FIELDS.productOffer)[number]
  | (typeof FCB_TARGET_FIELDS.brand)[number]
  | (typeof FCB_TARGET_FIELDS.website)[number]
  | (typeof FCB_TARGET_FIELDS.competitive)[number];
