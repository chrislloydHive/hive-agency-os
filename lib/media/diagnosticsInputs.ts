// lib/media/diagnosticsInputs.ts
// Type definitions for all diagnostic lab outputs used in Media Planning prefill
//
// These types represent the summarized outputs from GAP, Website Lab, Brand Lab,
// Content Lab, SEO Lab, Demand Lab, and Ops Lab that feed into media planning.

// ============================================================================
// GAP Run Summaries (IA / Full / Heavy)
// ============================================================================

export type GapRunType = 'gap_ia' | 'gap_full' | 'gap_heavy';

export interface GapRunSummary {
  /** Type of GAP run */
  type: GapRunType;
  /** Run ID for reference */
  runId?: string;
  /** Overall marketing health score (0-100) */
  overallScore?: number;
  /** Strategist-facing summary (long-form) */
  strategistView?: string;
  /** Executive summary (shorter) */
  executiveSummary?: string;
  /** Key findings from the assessment */
  keyFindings?: string[];
  /** Quick wins identified */
  quickWins?: string[];
  /** Priority areas for improvement */
  priorityAreas?: string[];
  /** Maturity stage assessment */
  maturityStage?: string;
  /** Readiness score for paid media */
  readinessScore?: number;
  /** Dimension scores (brand, content, seo, website) */
  dimensionScores?: {
    brand?: number;
    content?: number;
    seo?: number;
    website?: number;
    digitalFootprint?: number;
    authority?: number;
  };
  /** Business context extracted */
  businessContext?: {
    businessName?: string;
    industry?: string;
    businessModel?: string;
    targetAudience?: string;
    geographicScope?: string;
  };
  /** Created timestamp */
  createdAt?: string;
}

// ============================================================================
// Website Lab Summary
// ============================================================================

export interface WebsiteLabSummary {
  /** Run ID for reference */
  runId?: string;
  /** Overall website/UX score (0-100) */
  score?: number;
  /** Strategist-facing summary */
  strategistView?: string;
  /** Executive summary */
  executiveSummary?: string;
  /** Identified funnel issues */
  funnelIssues?: string[];
  /** Conversion blockers */
  conversionBlocks?: string[];
  /** Infrastructure notes (tracking, forms, GA4, etc.) */
  infraNotes?: string[];
  /** Mobile experience notes */
  mobileNotes?: string;
  /** Page speed assessment */
  pageSpeedNotes?: string;
  /** Core Web Vitals summary */
  coreWebVitals?: {
    lcp?: string;
    fid?: string;
    cls?: string;
    overall?: string;
  };
  /** Top recommendations */
  recommendations?: string[];
  /** Critical issues to fix */
  criticalIssues?: string[];
  /** Created timestamp */
  createdAt?: string;
}

// ============================================================================
// Brand Lab Summary
// ============================================================================

export interface BrandLabSummary {
  /** Run ID for reference */
  runId?: string;
  /** Brand health score (0-100) */
  score?: number;
  /** Strategist-facing summary */
  strategistView?: string;
  /** Brand positioning summary */
  positioningSummary?: string;
  /** Value propositions identified */
  valueProps?: string[];
  /** Key differentiators */
  differentiators?: string[];
  /** Brand perception in market */
  brandPerception?: string;
  /** Brand voice/tone notes */
  voiceTone?: string;
  /** Visual identity notes */
  visualIdentity?: string;
  /** Competitive positioning */
  competitivePosition?: string;
  /** Brand strengths */
  strengths?: string[];
  /** Brand weaknesses */
  weaknesses?: string[];
  /** Created timestamp */
  createdAt?: string;
}

// ============================================================================
// Content Lab Summary
// ============================================================================

export interface ContentLabSummary {
  /** Run ID for reference */
  runId?: string;
  /** Content health score (0-100) */
  score?: number;
  /** Strategist-facing summary */
  strategistView?: string;
  /** Key topics covered well */
  keyTopics?: string[];
  /** Content gaps identified */
  contentGaps?: string[];
  /** Audience needs analysis */
  audienceNeeds?: string[];
  /** Content types assessment */
  contentTypes?: {
    blog?: string;
    video?: string;
    guides?: string;
    caseStudies?: string;
    social?: string;
  };
  /** Content production capacity notes */
  productionCapacity?: string;
  /** Top performing content themes */
  topPerformingThemes?: string[];
  /** Content quality assessment */
  qualityNotes?: string;
  /** Created timestamp */
  createdAt?: string;
}

// ============================================================================
// SEO Lab Summary
// ============================================================================

export interface SeoLabSummary {
  /** Run ID for reference */
  runId?: string;
  /** SEO health score (0-100) */
  score?: number;
  /** Strategist-facing summary */
  strategistView?: string;
  /** Key keyword themes */
  keywordThemes?: string[];
  /** Organic competitors identified */
  organicCompetitors?: string[];
  /** Search demand notes */
  searchDemandNotes?: string;
  /** Technical SEO health */
  technicalHealth?: string;
  /** Backlink profile summary */
  backlinkProfile?: string;
  /** Domain authority/rating */
  domainAuthority?: number;
  /** Top ranking keywords */
  topKeywords?: string[];
  /** Keyword opportunities */
  keywordOpportunities?: string[];
  /** Local SEO status (if applicable) */
  localSeoStatus?: string;
  /** Created timestamp */
  createdAt?: string;
}

// ============================================================================
// Demand Lab Summary
// ============================================================================

export interface DemandLabSummary {
  /** Run ID for reference */
  runId?: string;
  /** Demand generation score (0-100) */
  score?: number;
  /** Strategist-facing summary */
  strategistView?: string;
  /** Channel performance summary */
  channelPerformanceSummary?: string;
  /** Best performing channels */
  bestChannels?: string[];
  /** Weak/underperforming channels */
  weakChannels?: string[];
  /** Primary demand sources */
  demandSources?: string[];
  /** Attribution insights */
  attributionNotes?: string;
  /** Funnel performance by stage */
  funnelPerformance?: {
    awareness?: string;
    consideration?: string;
    conversion?: string;
    retention?: string;
  };
  /** Lead quality assessment */
  leadQualityNotes?: string;
  /** Customer acquisition cost trends */
  cacTrends?: string;
  /** Created timestamp */
  createdAt?: string;
}

// ============================================================================
// Ops Lab Summary
// ============================================================================

export interface OpsLabSummary {
  /** Run ID for reference */
  runId?: string;
  /** Operations health score (0-100) */
  score?: number;
  /** Strategist-facing summary */
  strategistView?: string;
  /** Tracking stack notes */
  trackingStackNotes?: string[];
  /** GA4 health status */
  ga4Health?: string;
  /** Google Search Console status */
  gscHealth?: string;
  /** Google Business Profile status */
  gbpHealth?: string;
  /** Call tracking setup */
  callTracking?: string;
  /** Offline conversion tracking */
  offlineConversion?: string;
  /** CRM integration notes */
  crmNotes?: string;
  /** Data quality assessment */
  dataQuality?: string;
  /** Measurement limitations */
  measurementLimitations?: string[];
  /** Tech stack components */
  techStack?: string[];
  /** Created timestamp */
  createdAt?: string;
}

// ============================================================================
// Combined Diagnostics Bundle
// ============================================================================

/**
 * Bundle of all diagnostic summaries for a company
 * Any or all fields may be undefined if the diagnostic hasn't been run
 */
export interface DiagnosticsBundle {
  /** Company ID this bundle belongs to */
  companyId: string;
  /** GAP assessment summary (any type) */
  gap?: GapRunSummary;
  /** Website Lab summary */
  website?: WebsiteLabSummary;
  /** Brand Lab summary */
  brand?: BrandLabSummary;
  /** Content Lab summary */
  content?: ContentLabSummary;
  /** SEO Lab summary */
  seo?: SeoLabSummary;
  /** Demand Lab summary */
  demand?: DemandLabSummary;
  /** Ops Lab summary */
  ops?: OpsLabSummary;
  /** Timestamp when bundle was assembled */
  assembledAt: string;
  /** Which sources had data */
  availableSources: {
    gap: boolean;
    website: boolean;
    brand: boolean;
    content: boolean;
    seo: boolean;
    demand: boolean;
    ops: boolean;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Source identifier for prefilled fields
 */
export type DiagnosticSourceId =
  | 'gap_ia'
  | 'gap_full'
  | 'gap_heavy'
  | 'website_lab'
  | 'brand_lab'
  | 'content_lab'
  | 'seo_lab'
  | 'demand_lab'
  | 'ops_lab';

/**
 * Field metadata from diagnostic sources
 */
export interface DiagnosticFieldMeta {
  /** Which diagnostic provided this value */
  source: DiagnosticSourceId;
  /** Confidence score 0-1 */
  confidence: number;
  /** When the source data was generated */
  sourceTimestamp?: string;
  /** Additional context about the extraction */
  extractionNotes?: string;
}
