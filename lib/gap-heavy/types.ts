// lib/gap-heavy/types.ts
// Heavy Worker V4 - Evidence Collection Types
//
// Heavy Worker V4 is the evidence collection layer for GAP Heavy. It runs
// modular diagnostic modules (seo, content, website, brand, demand) to gather
// raw data that feeds into the Strategic Intelligence Orchestrator.
//
// IMPORTANT: Heavy Worker V4 collects EVIDENCE. Strategic analysis and
// competitive intelligence is handled by strategicOrchestrator.ts, which
// produces the GapHeavyResult (see strategicTypes.ts).
//
// For the GAP Heavy strategic intelligence output types, see:
// - strategicTypes.ts - GapHeavyResult and related types
// - strategicOrchestrator.ts - Strategic synthesis logic
// - mapToBlueprint.ts - Blueprint integration
// - mapToWork.ts - Work Items integration

// ============================================================================
// Diagnostic Module Keys
// ============================================================================

/**
 * Diagnostic modules available in Heavy Worker V4
 *
 * Each module is responsible for a specific domain of analysis:
 * - seo: SEO & visibility analysis
 * - content: Content quality & messaging
 * - website: Website UX & conversion
 * - brand: Brand presence & positioning
 * - demand: GA4 + traffic layer analysis
 * - ops: Operations & execution health
 */
export type DiagnosticModuleKey =
  | 'seo'
  | 'content'
  | 'website'
  | 'brand'
  | 'demand'
  | 'ops';

// ============================================================================
// Diagnostic Module Result
// ============================================================================

/**
 * Result from a single diagnostic module execution
 *
 * Each module produces a standardized result that includes:
 * - Status tracking (pending → running → completed/failed)
 * - Timestamps for performance monitoring
 * - Core outputs: score, summary, issues, recommendations
 * - Raw evidence for downstream processing
 */
export interface DiagnosticModuleResult {
  /** Which module produced this result */
  module: DiagnosticModuleKey;

  /** Current status of this module's execution */
  status: 'pending' | 'running' | 'completed' | 'failed';

  /** When this module started execution */
  startedAt?: string; // ISO timestamp

  /** When this module completed execution */
  completedAt?: string; // ISO timestamp

  /** Numeric score for this module (0-100 scale) */
  score?: number;

  /** High-level summary of findings */
  summary?: string;

  /** List of issues discovered */
  issues?: string[];

  /** List of actionable recommendations */
  recommendations?: string[];

  /** Raw evidence data for this module (free-form JSON) */
  rawEvidence?: unknown;
}

// ============================================================================
// Page Evaluation Result
// ============================================================================

/**
 * Result from evaluating a single web page
 *
 * This type represents a comprehensive evaluation of a specific page,
 * including content quality, UX, and conversion optimization.
 * Can be used standalone or as part of Heavy Worker V4 runs.
 */
export interface PageEvaluationResult {
  /** The URL of the page that was evaluated */
  url: string;

  /** Page metadata */
  pageTitle?: string;
  metaDescription?: string;
  h1?: string;

  // ========================================================================
  // Scores (0-100 scale)
  // ========================================================================

  /** Content quality score (clarity, relevance, comprehensiveness) */
  contentScore: number;

  /** User experience score (navigation, readability, accessibility) */
  uxScore: number;

  /** Conversion optimization score (CTAs, forms, trust signals) */
  conversionScore: number;

  /** Overall page score (weighted average of above) */
  overallScore: number;

  // ========================================================================
  // Content Diagnostics
  // ========================================================================

  /** Issues found with content quality */
  contentIssues: string[];

  /** Recommendations to improve content */
  contentRecommendations: string[];

  // ========================================================================
  // UX Diagnostics
  // ========================================================================

  /** Issues found with user experience */
  uxIssues: string[];

  /** Recommendations to improve UX */
  uxRecommendations: string[];

  // ========================================================================
  // Conversion Diagnostics
  // ========================================================================

  /** Issues found with conversion optimization */
  conversionIssues: string[];

  /** Recommendations to improve conversion */
  conversionRecommendations: string[];

  // ========================================================================
  // Optional Telemetry (from GA4 if available)
  // ========================================================================

  /** GA4 metrics for this page (if available) */
  ga4Snapshot?: {
    /** Number of sessions on this page */
    sessions?: number;

    /** Number of engaged sessions */
    engagedSessions?: number;

    /** Engagement rate (0-1) */
    engagementRate?: number;

    /** Number of conversions attributed to this page */
    conversions?: number;
  };

  // ========================================================================
  // Raw Extracted Data
  // ========================================================================

  /** Raw extracted information for downstream use */
  raw?: {
    /** Hero section copy/text */
    heroCopy?: string;

    /** Primary CTA button text */
    primaryCtaText?: string | null;

    /** Location of the primary CTA on the page */
    primaryCtaLocation?: 'hero' | 'nav' | 'footer' | 'inline' | 'unknown';

    /** Trust signals found on page (testimonials, logos, etc.) */
    trustSignals?: string[];

    /** Word count of main content */
    wordCount?: number;
  };
}

// ============================================================================
// Brand Evidence
// ============================================================================

/**
 * Tone spectrum for brand sentiment analysis
 */
export type ToneSpectrum =
  | 'premium'
  | 'technical'
  | 'playful'
  | 'serious'
  | 'friendly'
  | 'luxury'
  | 'minimal'
  | 'warm'
  | 'authoritative'
  | 'neutral';

/**
 * Brand archetype classification
 */
export type BrandArchetype =
  | 'innovator'
  | 'trusted_guide'
  | 'challenger'
  | 'operator'
  | 'authority'
  | 'unknown';

/**
 * Brand & Positioning evidence collected by the Brand module
 *
 * This captures key brand elements extracted from the homepage and marketing materials,
 * including messaging clarity, differentiation, and trust signals.
 *
 * V2 UPGRADES:
 * - Cross-page consistency analysis
 * - Sentiment & tone spectrum
 * - Brand archetype classification
 * - CTA & value prop scoring
 * - Brand maturity level
 * - Competitor context
 */
export interface BrandEvidence {
  /** Primary tagline (typically hero H1 text) */
  primaryTagline?: string;

  /** Supporting subheadline from hero section */
  supportingSubheadline?: string;

  /** Interpreted summary of value proposition (what they do / for whom) */
  valuePropositionSummary?: string;

  /** How clearly the target audience is communicated */
  audienceClarityLevel: 'clear' | 'somewhat_clear' | 'unclear';

  /** Strength of differentiation from competitors */
  differentiationLevel: 'strong' | 'moderate' | 'weak';

  /** Tone/voice descriptors extracted from copy */
  toneDescriptors?: string[];

  /** Whether trust signals are present */
  trustSignalsPresent: boolean;

  /** Examples of trust signals found */
  trustSignalsExamples?: string[];

  /** Density of social proof elements on the page */
  socialProofDensity?: 'none' | 'light' | 'moderate' | 'heavy';

  /** Notes about visual/brand consistency */
  visualConsistencyHints?: string[];

  /** Optional notes about competitor overlap (if competitor data available) */
  competitorOverlapNotes?: string;

  /** Raw text snippets extracted from pages (for grounding recommendations) */
  rawSnippets?: {
    /** Hero section text (H1 + surrounding copy) */
    heroText?: string;

    /** First paragraph(s) from About page */
    aboutSnippet?: string;

    /** First paragraph(s) from Solutions/Services page */
    solutionsSnippet?: string;

    /** CTA button texts found across pages */
    ctaTexts?: string[];
  };

  // ========================================================================
  // V2 UPGRADES: Enhanced Brand Analysis Fields
  // ========================================================================

  /** Cross-page messaging consistency analysis */
  // TODO: Populate via LLM call in runBrandModule
  crossPageConsistency?: {
    /** Overarching messaging theme across pages */
    messagingTheme: string;

    /** How consistent the messaging is across pages */
    consistencyLevel: 'strong' | 'moderate' | 'weak';

    /** Specific inconsistencies found (if any) */
    inconsistencies?: string[];
  };

  /** Tone spectrum classification (can have multiple tones) */
  // TODO: Populate via LLM call analyzing copy sentiment
  sentimentToneSpectrum?: ToneSpectrum[];

  /** Primary brand archetype classification */
  // TODO: Populate via LLM call analyzing positioning & copy
  brandArchetype?: BrandArchetype;

  /** Quality score for CTAs (0-100) */
  // TODO: Compute based on CTA clarity, specificity, and placement
  ctaQualityScore?: number;

  /** Clarity score for value proposition (0-100) */
  // TODO: Compute based on value prop specificity and differentiation
  valuePropClarityScore?: number;

  /** Brand maturity stage assessment */
  // TODO: Infer from trust signals, social proof density, and content depth
  brandMaturityLevel?: 'emerging' | 'developing' | 'established' | 'category_leader';

  /** Competitor brand context and differentiation analysis */
  // TODO: Populate via Bing search or outbound link analysis
  competitorBrandContext?: {
    /** List of identified competitors */
    competitors: {
      /** Competitor name */
      name: string;

      /** Competitor website URL */
      url: string;

      /** Competitor tagline (if found) */
      tagline?: string;

      /** Brief positioning summary */
      positioningSummary?: string;
    }[];

    /** Analysis of how this brand differentiates from competitors */
    differentiationNotes: string;
  };
}

// ============================================================================
// Evidence Pack
// ============================================================================

/**
 * Shared evidence collection across all diagnostic modules
 *
 * The EvidencePack is a centralized store for all data collected during
 * the Heavy Worker run. It's organized into high-level categories:
 * - presence: What exists (pages, content, social profiles, etc.)
 * - demand: Traffic, engagement, market signals
 * - performance: Speed, UX metrics, technical health
 *
 * Each module can read from and write to the EvidencePack.
 * The modules array tracks the status and results of each module.
 *
 * This is intentionally loose/flexible for now - we'll formalize the schema
 * as the modular architecture matures.
 */
export interface EvidencePack {
  /** Evidence about what exists (pages, content, profiles, etc.) */
  presence?: Record<string, unknown>;

  /** Evidence about demand/traffic (GA4, search volume, engagement) */
  demand?: Record<string, unknown>;

  /** Evidence about performance (speed, UX, technical health) */
  performance?: Record<string, unknown>;

  /** Brand & positioning evidence from Brand module */
  brand?: BrandEvidence;

  /** Content strategy evidence from Content module */
  // Import type: import type { ContentEvidence } from './modules/content';
  content?: any; // ContentEvidence - using any for now to avoid circular imports

  /** Website UX evidence from Website module */
  // Import type: import type { WebsiteEvidence } from './modules/website';
  website?: any; // WebsiteEvidence - using any for now to avoid circular imports

  /** Website Lab V4/V5 result (Multi-Page UX & Conversion Lab) */
  // Import type: import type { WebsiteUXLabResultV4 } from './modules/websiteLab';
  websiteLabV4?: any; // WebsiteUXLabResultV4 - using any for now to avoid circular imports

  /** Website Action Plan (prioritized work items from Website Lab) */
  websiteActionPlan?: any; // Using any for now to avoid circular imports

  /** Brand Lab result (Brand health, clarity, positioning & coherence) */
  // Import type: import type { BrandLabResult } from './modules/brandLab';
  brandLab?: any; // BrandLabResult - using any for now to avoid circular imports

  /** Website Narrative Report (client-facing consultant-grade report) */
  // Import type: import type { WebsiteNarrativeReport } from './modules/websiteNarrativeReport';
  websiteNarrative?: any; // WebsiteNarrativeReport - using any for now to avoid circular imports

  /** Per-page evaluations (optional) */
  pageEvaluations?: PageEvaluationResult[];

  /** Results from each diagnostic module */
  modules: DiagnosticModuleResult[];
}
