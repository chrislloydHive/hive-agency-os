// lib/diagnostics/demand-lab/types.ts
// Demand Lab Diagnostic Output Types
//
// These types define the structure of Demand Lab diagnostic results that flow through:
// - Diagnostic runs
// - UI reports
// - Work item creation
// - Brain / Blueprint integration

// ============================================================================
// Maturity Stages
// ============================================================================

/**
 * Demand generation maturity stages
 * - unproven: No clear demand engine, ad-hoc efforts
 * - emerging: Some campaigns, early signals, experimenting
 * - scaling: Consistent campaigns, measurable results, optimization underway
 * - established: Proven demand engine, strong ROI, sophisticated targeting
 */
export type DemandMaturityStage = 'unproven' | 'emerging' | 'scaling' | 'established';

// ============================================================================
// Issues
// ============================================================================

/** Issue category - human-readable for UI display */
export type DemandIssueCategory =
  | 'Channel Mix'
  | 'Targeting'
  | 'Creative'
  | 'Funnel'
  | 'Measurement';

export type DemandIssueSeverity = 'low' | 'medium' | 'high';

export interface DemandLabIssue {
  id: string;
  category: DemandIssueCategory;
  severity: DemandIssueSeverity;
  title: string;
  description: string;
}

// ============================================================================
// Quick Wins
// ============================================================================

export interface DemandLabQuickWin {
  id: string;
  category: string;
  action: string;
  expectedImpact: 'low' | 'medium' | 'high';
  effortLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Projects
// ============================================================================

export interface DemandLabProject {
  id: string;
  category: string;
  title: string;
  description: string;
  timeHorizon: 'near-term' | 'mid-term' | 'long-term';
  impact: 'low' | 'medium' | 'high';
}

// ============================================================================
// Company Types (for company-type-aware scoring)
// ============================================================================

/**
 * Normalized company type for demand scoring
 * Used to adjust scoring weights based on business model
 */
export type DemandCompanyType =
  | 'b2b_services'
  | 'local_service'
  | 'ecommerce'
  | 'saas'
  | 'other'
  | 'unknown';

/** @deprecated Use DemandCompanyType instead */
export type CompanyType = DemandCompanyType;

// ============================================================================
// Dimension Scores
// ============================================================================

/** Dimension keys - camelCase for consistency */
export type DemandDimensionKey =
  | 'channelMix'
  | 'targeting'
  | 'creative'
  | 'funnel'
  | 'measurement';

export type DemandDimensionStatus = 'weak' | 'moderate' | 'strong';

/** Evidence and findings that support a dimension score */
export interface DemandDimensionEvidence {
  /** What was found (positive signals) */
  found: string[];
  /** What was missing or problematic */
  missing: string[];
  /** Specific data points or metrics */
  dataPoints: Record<string, string | number | boolean>;
}

export interface DemandLabDimension {
  key: DemandDimensionKey;
  label: string;
  score: number; // 0-100
  status: DemandDimensionStatus;
  summary: string;
  issues: DemandLabIssue[];
  /** Detailed evidence and findings supporting the score */
  evidence?: DemandDimensionEvidence;
}

// ============================================================================
// Data Confidence
// ============================================================================

export type DataConfidenceLevel = 'low' | 'medium' | 'high';

export interface DemandDataConfidence {
  score: number; // 0-100
  level: DataConfidenceLevel;
  reason: string;
}

// ============================================================================
// Analytics Snapshot
// ============================================================================

export interface DemandAnalyticsSnapshot {
  /** Traffic mix by channel (percentages as decimals 0-1) */
  trafficMix: Record<string, number>;

  /** Top traffic channels */
  topChannels: string[];

  /**
   * Overall conversion rate as a FRACTION (0.03 = 3%)
   * NOT a percentage. If > 1.0, it's likely misconfigured.
   */
  conversionRate: number | null;

  /** Paid traffic percentage (0-1 decimal) */
  paidShare: number | null;

  /** Session volume (if available) */
  sessionVolume?: number | null;

  /** Total conversions (if available) */
  totalConversions?: number;

  // Legacy alias for backwards compatibility
  /** @deprecated Use paidShare instead */
  paidTrafficShare?: number | null;

  /** @deprecated Use sessionVolume instead */
  totalSessions?: number;
}

// ============================================================================
// Main Report Type
// ============================================================================

export interface DemandLabResult {
  /** Overall demand generation score (0-100) */
  overallScore: number;

  /** Maturity stage assessment */
  maturityStage: DemandMaturityStage;

  /** Data confidence assessment */
  dataConfidence: DemandDataConfidence;

  /** Narrative summary (2-3 sentences from strategist perspective) */
  narrativeSummary: string;

  /** Dimension scores and analysis */
  dimensions: DemandLabDimension[];

  /** All issues found */
  issues: DemandLabIssue[];

  /** Quick wins (high impact, low effort) */
  quickWins: DemandLabQuickWin[];

  /** Strategic projects */
  projects: DemandLabProject[];

  /** Analytics snapshot (if available) */
  analyticsSnapshot?: DemandAnalyticsSnapshot;

  /** Detailed findings from the analysis */
  findings?: DemandLabFindings;

  /** Timestamp */
  generatedAt: string;

  /** Company ID */
  companyId?: string;

  /** Website URL analyzed */
  url?: string;

  /** Company type for company-aware scoring (normalized) */
  companyType?: DemandCompanyType | null;
}

/** Detailed findings from the demand lab analysis */
export interface DemandLabFindings {
  /** Pages that were crawled and analyzed */
  pagesAnalyzed: AnalyzedPage[];
  /** CTAs discovered on the site */
  ctasFound: DiscoveredCta[];
  /** Tracking technologies detected */
  trackingDetected: TrackingTech[];
  /** Landing page analysis */
  landingPageInsights?: LandingPageInsights;
  /** Channel insights from analytics */
  channelInsights?: ChannelInsights;
}

export interface AnalyzedPage {
  url: string;
  title: string | null;
  type: 'homepage' | 'landing' | 'pricing' | 'contact' | 'other';
  hasForm: boolean;
  hasCta: boolean;
}

export interface DiscoveredCta {
  text: string;
  type: 'demo' | 'trial' | 'contact' | 'download' | 'subscribe' | 'buy' | 'learn' | 'other';
  pageUrl: string;
  isPrimary: boolean;
}

export interface TrackingTech {
  name: string;
  type: 'analytics' | 'retargeting' | 'conversion' | 'tag_manager';
  detected: boolean;
}

export interface LandingPageInsights {
  totalPages: number;
  dedicatedLandingPages: number;
  pagesWithForms: number;
  pagesWithClearCta: number;
  urls: string[];
}

export interface ChannelInsights {
  topChannels: Array<{ name: string; share: number }>;
  paidVsOrganic: { paid: number; organic: number };
  hasMultiChannel: boolean;
}

// ============================================================================
// Engine Result Wrapper
// ============================================================================

export interface DemandLabEngineResult {
  success: boolean;
  score?: number;
  summary?: string;
  report?: DemandLabResult;
  error?: string;
}

// ============================================================================
// Analyzer Input/Output Types
// ============================================================================

export interface DemandAnalyzerInput {
  companyId?: string;
  url: string;
  companyType?: string | null;
  workspaceId?: string;
  // Legacy alias
  websiteUrl?: string;
}

export interface LandingPageSignals {
  /** Number of landing pages detected */
  landingPageCount: number;

  /** Has dedicated landing pages (vs just homepage) */
  hasDedicatedLandingPages: boolean;

  /** Landing page URLs found */
  landingPageUrls: string[];

  /** Has clear offer/value prop on landing pages */
  hasOfferClarity: boolean;

  /** Has form on landing pages */
  hasLeadCaptureForm: boolean;
}

export interface CtaSignals {
  /** Number of CTAs found */
  ctaCount: number;

  /** Primary CTA text (if identifiable) */
  primaryCta: string | null;

  /** CTA types found */
  ctaTypes: ('demo' | 'trial' | 'contact' | 'download' | 'subscribe' | 'buy' | 'learn' | 'other')[];

  /** CTA clarity score (0-100) */
  ctaClarityScore: number;

  /** Multiple competing CTAs? */
  hasCompetingCtas: boolean;
}

export interface TrackingSignals {
  /** Has UTM parameters in any links */
  hasUtmTracking: boolean;

  /** Has conversion tracking (form, thank you page patterns) */
  hasConversionTracking: boolean;

  /** Has analytics (GA, GTM, etc) */
  hasAnalytics: boolean;

  /** Has retargeting pixels (FB, Google, LinkedIn) */
  hasRetargetingPixels: boolean;
}

export interface AdScentSignals {
  /** Has ad landing page patterns (utm_source in links, ad-specific pages) */
  hasAdLandingPatterns: boolean;

  /** Message consistency hints */
  messageConsistency: 'strong' | 'moderate' | 'weak' | 'unknown';
}

export interface DemandAnalyzerOutput {
  /** Company ID */
  companyId?: string;

  /** URL analyzed */
  url: string;

  /** Company type for scoring context (normalized) */
  companyType: DemandCompanyType;

  /** Landing page signals */
  landingPages: LandingPageSignals;

  /** CTA signals */
  ctas: CtaSignals;

  /** Tracking signals */
  tracking: TrackingSignals;

  /** Ad scent trail signals */
  adScent: AdScentSignals;

  /** Analytics snapshot (from GA4 if available) */
  analyticsSnapshot?: DemandAnalyticsSnapshot;

  /** Data confidence */
  dataConfidence: DemandDataConfidence;

  // V2 detection flags for company-type-aware scoring
  /** Has paid traffic based on analytics or pixel detection */
  hasPaidTraffic: boolean;

  /** Has retargeting infrastructure */
  hasRetargetingSignals: boolean;

  /** Has dedicated landing pages (not just homepage) */
  hasDedicatedLandingPages: boolean;

  /** Has clear primary call-to-action */
  hasClearPrimaryCTA: boolean;

  /** Has lead capture forms */
  hasLeadCapture: boolean;

  /** UTM usage level */
  utmUsageLevel: 'none' | 'some' | 'consistent';

  /** Has conversion events implemented */
  conversionEventsImplemented: boolean;

  /** Likely has remarketing infrastructure */
  remarketingInfraLikely: boolean;
}

// ============================================================================
// Scoring Output Types
// ============================================================================

export interface DemandScoringOutput {
  dimensions: DemandLabDimension[];
  overallScore: number;
  maturityStage: DemandMaturityStage;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status from score
 */
export function getStatusFromScore(score: number): DemandDimensionStatus {
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'weak';
}

/**
 * Get maturity stage from overall score
 */
export function getMaturityFromScore(score: number): DemandMaturityStage {
  if (score >= 85) return 'established';
  if (score >= 70) return 'scaling';
  if (score >= 50) return 'emerging';
  return 'unproven';
}

/**
 * Get human-readable label for maturity stage
 */
export function getMaturityStageLabel(stage: DemandMaturityStage): string {
  const labels: Record<DemandMaturityStage, string> = {
    unproven: 'Unproven',
    emerging: 'Emerging',
    scaling: 'Scaling',
    established: 'Established',
  };
  return labels[stage] || stage;
}

/**
 * Get color class for maturity stage
 */
export function getMaturityStageColor(stage: DemandMaturityStage): string {
  const colors: Record<DemandMaturityStage, string> = {
    unproven: 'text-slate-400',
    emerging: 'text-amber-400',
    scaling: 'text-cyan-400',
    established: 'text-emerald-400',
  };
  return colors[stage] || 'text-slate-400';
}

/**
 * Get color class for dimension status
 */
export function getDimensionStatusColor(status: DemandDimensionStatus): string {
  const colors: Record<DemandDimensionStatus, string> = {
    weak: 'text-red-400',
    moderate: 'text-amber-400',
    strong: 'text-emerald-400',
  };
  return colors[status] || 'text-slate-400';
}

/**
 * Get color class for data confidence level
 */
export function getDataConfidenceColor(level: DataConfidenceLevel): string {
  const colors: Record<DataConfidenceLevel, string> = {
    low: 'text-amber-400',
    medium: 'text-cyan-400',
    high: 'text-emerald-400',
  };
  return colors[level] || 'text-slate-400';
}

/**
 * Get dimension label from key
 */
export function getDimensionLabel(key: DemandDimensionKey): string {
  const labels: Record<DemandDimensionKey, string> = {
    channelMix: 'Channel Mix & Budget',
    targeting: 'Targeting & Segmentation',
    creative: 'Creative & Messaging',
    funnel: 'Funnel Architecture',
    measurement: 'Measurement & Optimization',
  };
  return labels[key] || key;
}

/**
 * Map issue category to dimension key
 */
export function mapCategoryToDimensionKey(category: string): DemandDimensionKey | null {
  const c = category.toLowerCase();
  if (c.includes('channel')) return 'channelMix';
  if (c.includes('target')) return 'targeting';
  if (c.includes('creative') || c.includes('messaging')) return 'creative';
  if (c.includes('funnel')) return 'funnel';
  if (c.includes('measure')) return 'measurement';
  return null;
}

/**
 * Generate a unique ID for an issue
 */
export function generateIssueId(category: DemandIssueCategory, index: number): string {
  const catKey = category.toLowerCase().replace(/\s+/g, '-');
  return `demand-${catKey}-${index}-${Date.now().toString(36)}`;
}
