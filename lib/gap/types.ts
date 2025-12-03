// lib/gap/types.ts
// Shared types for the GAP system (IA, Plan, Full Report, Heavy Run)

// ============================================================================
// Marketing Maturity & Core Context
// ============================================================================

export type MarketingMaturityStage = 'early' | 'developing' | 'advanced';

export type BrandTier =
  | 'global_category_leader'
  | 'enterprise'
  | 'mid_market'
  | 'smb'
  | 'startup'
  | 'local_business'
  | 'nonprofit'
  | 'other';

export type CompanyType =
  | 'b2b_saas'
  | 'b2c_saas'
  | 'b2b_services'
  | 'b2c_services'
  | 'marketplace'
  | 'ecommerce'
  | 'brick_and_mortar'
  | 'media_publisher'
  | 'nonprofit'
  | 'platform_infrastructure'
  | 'other';

/**
 * Core Marketing Context - shared across GAP-IA, GAP-Plan, and GAP-Full Report
 * This is the canonical shape for lightweight marketing intelligence about a company
 */
export interface CoreMarketingContext {
  url: string;
  domain: string;

  // Business basics
  businessName?: string;
  industry?: string;
  primaryOffer?: string;
  primaryAudience?: string;
  geography?: string;

  // Overall scores and maturity
  overallScore?: number;
  marketingMaturity?: MarketingMaturityStage;
  marketingReadinessScore?: number;

  // Brand tier and company classification
  brandTier?: BrandTier;
  companyType?: CompanyType;

  // Brand dimension
  brand: {
    brandScore?: number;
    perceivedPositioning?: string;
    toneOfVoice?: string;
    visualConsistency?: 'low' | 'medium' | 'high' | null;
  };

  // Content dimension
  content: {
    contentScore?: number;
    hasBlogOrResources?: boolean;
    contentDepth?: 'shallow' | 'medium' | 'deep' | null;
    contentFocus?: string;
    postingConsistency?: 'low' | 'medium' | 'high' | null;
  };

  // SEO dimension
  seo: {
    seoScore?: number;
    appearsIndexable?: boolean | null;
    onPageBasics?: 'ok' | 'issues' | null;
    searchIntentFit?: 'weak' | 'mixed' | 'strong' | null;
  };

  // Website dimension
  website: {
    websiteScore?: number;
    clarityOfMessage?: 'low' | 'medium' | 'high' | null;
    primaryCtaQuality?: 'weak' | 'ok' | 'strong' | null;
    perceivedFriction?: 'low' | 'medium' | 'high' | null;
  };

  // Summary and opportunities
  quickSummary: string;
  topOpportunities: string[];

  // Metadata
  source?: 'gap-ia' | 'full-gap' | 'imported' | 'manual';
  generatedAt?: string;
}

// ============================================================================
// Multi-Page Discovery Types (for shallow URL exploration)
// ============================================================================

export type DiscoveredPageType = 'blog' | 'resource' | 'pricing' | 'case_study' | 'services' | 'other';

export interface DiscoveredPageSnippet {
  url: string;
  type: DiscoveredPageType;
  path: string;
  title?: string;
  snippet: string; // short HTML/text snippet, already truncated
}

export interface ContentSignals {
  blogFound: boolean;
  blogUrlsFound: number;
  pricingFound: boolean;
  resourcePagesFound: number;
  caseStudyPagesFound: number;
  estimatedBlogWordCount?: number | null;
}

export interface MultiPageSnapshot {
  homepage: DiscoveredPageSnippet;
  discoveredPages: DiscoveredPageSnippet[];
  contentSignals: ContentSignals;
}

// ============================================================================
// GAP-IA Run (Lead Magnet / Initial Assessment)
// ============================================================================

export type GapIaStatus = 'pending' | 'running' | 'completed' | 'complete' | 'error' | 'failed';

export type GapIaSource = 'lead-magnet' | 'internal' | 'imported';

// ============================================================================
// Enhanced GAP-IA V2 Types (More Substance, Same Engine)
// ============================================================================

export type ImpactLevel = 'low' | 'medium' | 'high';
export type EffortLevel = 'low' | 'medium';
export type DiagnosticCategory = 'Brand' | 'Content' | 'SEO' | 'Website & Conversion' | 'Other';

export interface DimensionSummary {
  score: number; // 0-100
  label: string;
  oneLiner: string; // 1 sentence interpretive summary
  issues: string[]; // 2-4 short bullets
  narrative?: string; // 2-3 paragraphs of detailed analysis (optional)
}

export interface DigitalFootprintSubscores {
  googleBusinessProfile: number;
  linkedinPresence: number;
  socialPresence: number;
  reviewsReputation: number;
}

export interface AuthoritySubscores {
  domainAuthority: number;
  backlinks: number;
  brandSearchDemand: number;
  industryRecognition: number;
}

export interface DigitalFootprintDimension extends DimensionSummary {
  subscores: DigitalFootprintSubscores;
}

export interface AuthorityDimension extends DimensionSummary {
  subscores: AuthoritySubscores;
}

export interface BreakdownItem {
  category: DiagnosticCategory;
  statement: string; // 1-2 sentences, site-specific
  impactLevel: ImpactLevel;
}

export interface QuickWinItem {
  category: DiagnosticCategory;
  action: string; // 1 sentence action
  expectedImpact: ImpactLevel;
  effortLevel: EffortLevel;
}

export interface GapIaSummary {
  overallScore: number; // 0-100
  maturityStage: string;
  headlineDiagnosis: string; // 1 punchy sentence
  narrative: string; // 2-3 sentence paragraph
  topOpportunities: string[]; // 3-5 bullets
}

export interface GapIaDimensions {
  brand: DimensionSummary;
  content: DimensionSummary;
  seo: DimensionSummary;
  website: DimensionSummary;
  digitalFootprint: DigitalFootprintDimension;
  authority: AuthorityDimension;
}

export interface GapIaBreakdown {
  bullets: BreakdownItem[]; // 3-5
}

export interface GapIaQuickWins {
  bullets: QuickWinItem[]; // 3-5
}

/**
 * Benchmark data for "How You Stack Up" section in GAP-IA
 */
export interface GapIaBenchmarks {
  peerCount: number; // Number of companies in comparison set
  cohortLabel: string; // Human-readable label (e.g., "SaaS companies" or "All companies")
  cohortType: 'exact' | 'broaderCategory' | 'global'; // What level of cohort was used
  overall: {
    score: number;
    percentile: number | null; // 0-100 (your rank among peers)
    median: number | null; // Peer median score
    topQuartile: number | null; // 75th percentile
  };
  dimensions: {
    brand: { score: number; percentile: number | null; median: number | null };
    content: { score: number; percentile: number | null; median: number | null };
    seo: { score: number; percentile: number | null; median: number | null };
    website: { score: number; percentile: number | null; median: number | null };
    authority: { score: number; percentile: number | null; median: number | null };
    digitalFootprint: { score: number; percentile: number | null; median: number | null };
  };
}

/**
 * Enhanced GAP-IA V2 Result Structure
 */
export interface GapIaV2Result {
  summary: GapIaSummary;
  dimensions: GapIaDimensions;
  breakdown: GapIaBreakdown;
  quickWins: GapIaQuickWins;
  benchmarks?: GapIaBenchmarks; // Optional competitive benchmarking data
}

// ============================================================================
// GAP-IA Run (Base)
// ============================================================================

/**
 * Digital Footprint data for frontend display
 */
export interface DigitalFootprintData {
  gbp: {
    found: boolean;
    hasReviews: boolean;
    reviewCountBucket: 'none' | 'few' | 'moderate' | 'many' | 'unknown';
    ratingBucket: 'low' | 'mixed' | 'strong' | 'unknown';
  };
  linkedin: {
    found: boolean;
    followerBucket: 'none' | '0-100' | '100-1k' | '1k-10k' | '10k+' | 'unknown';
    postingCadence: 'none' | 'rare' | 'occasional' | 'consistent' | 'unknown';
  };
  otherSocials: {
    instagram: boolean;
    facebook: boolean;
    youtube: boolean;
  };
}

/**
 * Business Context metadata from V3 engine
 */
export interface BusinessContextData {
  businessType?: string; // e.g., "b2b_saas", "local_business", "ecommerce"
  businessName?: string;
  brandTier?: string; // e.g., "smb", "enterprise", "startup"
  maturityStage?: string; // e.g., "Foundational", "Emerging", "Established"
}

// ============================================================================
// Data Confidence (aligned with Ops Lab pattern)
// ============================================================================

export type GapDataConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Data confidence assessment for GAP-IA reports
 * Indicates how reliable the assessment is based on available signals
 */
export interface GapDataConfidence {
  /** Confidence score from 0-100 */
  score: number;
  /** Confidence level bucket */
  level: GapDataConfidenceLevel;
  /** Human-readable explanation of confidence factors */
  reason: string;
  /** Specific issues that lowered confidence */
  issues?: string[];
}

/**
 * GAP-IA Run - the lightweight initial assessment
 * Used for lead magnets and quick marketing snapshots
 */
export interface GapIaRun {
  id: string;

  // Links to other entities
  companyId?: string;
  inboundLeadId?: string;
  gapPlanRunId?: string;
  gapFullReportId?: string;
  gapHeavyRunId?: string;

  // Basic info
  url: string;
  domain: string;
  normalizedUrl?: string; // For caching/lookup: normalized URL key
  iaPromptVersion?: string; // IA prompt version used (e.g., "ia-v4")

  source: GapIaSource;
  status: GapIaStatus;

  createdAt: string;
  updatedAt: string;

  // Core marketing context (legacy)
  core: CoreMarketingContext;

  // GAP-IA specific insights (legacy)
  insights: {
    overallSummary: string;
    brandInsights: string[];
    contentInsights: string[];
    seoInsights: string[];
    websiteInsights: string[];
    recommendedNextStep?: string;
  };

  // Enhanced V2 fields (optional for backward compatibility)
  summary?: GapIaSummary;
  dimensions?: GapIaDimensions;
  breakdown?: GapIaBreakdown;
  quickWins?: GapIaQuickWins;
  benchmarks?: GapIaBenchmarks;

  // V3 Metadata fields (added for frontend visibility)
  businessContext?: BusinessContextData;
  digitalFootprint?: DigitalFootprintData;

  // Data confidence (aligned with Ops Lab pattern)
  dataConfidence?: GapDataConfidence;

  // Consultant Report fields
  iaReportMarkdown?: string | null;
  iaReportVersion?: string | null; // e.g., "v1"

  // Legacy score fields (for backwards compat)
  overallScore?: number;
  readinessScore?: number;
  maturityStage?: MarketingMaturityStage;

  // Optional error tracking
  errorMessage?: string;
}

// ============================================================================
// Benchmark Cohorts
// ============================================================================

/**
 * Company tier for benchmarking
 * - Tier 1: Enterprise / Iconic / Global (e.g., Apple, Ford, HubSpot)
 * - Tier 2: Growth / Established (strong regional/national players)
 * - Tier 3: Local / Small (local businesses, early-stage startups)
 */
export type CompanyTier = 'Tier 1' | 'Tier 2' | 'Tier 3';

/**
 * Company type / industry category
 */
// Legacy Title Case company type - deprecated, use snake_case CompanyType instead
export type LegacyTitleCaseCompanyType =
  | 'Local Service'
  | 'B2B Service'
  | 'SaaS'
  | 'Ecommerce'
  | 'Manufacturing'
  | 'Healthcare'
  | 'Financial Services'
  | 'Technology'
  | 'Retail'
  | 'Other';

/**
 * Benchmark cohort - computed from companyType + tier
 * Example: "SaaS | Tier 1", "Local Service | Tier 3"
 */
export type BenchmarkCohort = string;

// ============================================================================
// GAP-Plan Run (Minimal shape for now)
// ============================================================================

export type GapPlanRunStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface GapPlanRun {
  id: string;
  companyId?: string;
  url: string;
  domain: string;
  status: GapPlanRunStatus;
  overallScore?: number;
  brandScore?: number;
  contentScore?: number;
  websiteScore?: number;
  seoScore?: number;
  authorityScore?: number;
  maturityStage?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;

  // Benchmarking cohort fields
  benchmarkCohort?: string | null;
  companyType?: string | null;
  tier?: string | null;
}

// ============================================================================
// GAP-Full Report (Minimal shape for now)
// ============================================================================

export type GapFullReportStatus =
  | 'draft'
  | 'processing'
  | 'ready'
  | 'archived'
  | 'error';

export interface GapFullReport {
  id: string;
  companyId?: string;
  gapPlanRunId?: string;
  status: GapFullReportStatus;
  reportType?: 'Initial' | 'Quarterly' | 'Annual';
  overallScore?: number;
  brandScore?: number;
  contentScore?: number;
  websiteScore?: number;
  seoScore?: number;
  authorityScore?: number;
  reportMarkdown?: string | null; // Long-form narrative markdown report
  reportVersion?: string | null; // e.g., "v1"
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// GAP-Heavy Run (Minimal shape for now)
// ============================================================================

export type GapHeavyRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'error'
  | 'cancelled';

export type GapHeavyRunStep =
  | 'init'
  | 'discoverPages'
  | 'analyzePages'
  | 'deepSeoAudit'
  | 'socialDeepDive'
  | 'competitorDeepDive'
  | 'generateArtifacts'
  | 'complete';

export interface GapHeavyRun {
  id: string;
  gapPlanRunId: string;
  companyId?: string;
  gapFullReportId?: string;
  url: string;
  domain: string;
  status: GapHeavyRunStatus;
  currentStep: GapHeavyRunStep;
  stepsCompleted: GapHeavyRunStep[];
  createdAt: string;
  updatedAt: string;
  lastTickAt?: string;
  tickCount: number;
  errorMessage?: string;
}

// ============================================================================
// Priorities v2 - Canonical Types
// ============================================================================

/**
 * Valid priority areas
 */
export type PriorityArea =
  | 'Brand'
  | 'Content'
  | 'SEO'
  | 'Website UX'
  | 'Funnel'
  | 'Other';

/**
 * Valid priority severity levels
 */
export type PrioritySeverity =
  | 'Critical'
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Info';

/**
 * Valid impact levels
 */
export type PriorityImpactLevel =
  | 'Low'
  | 'Medium'
  | 'High';

/**
 * Valid effort sizes
 */
export type PriorityEffortSize =
  | 'Low'
  | 'Medium'
  | 'High';

/**
 * Canonical Priority Item (v2)
 *
 * Represents a single prioritized recommendation from the GAP Engine.
 * Only `id` and `title` are required; all other fields are optional.
 */
export interface PriorityItem {
  /** Unique identifier for this priority */
  id: string;

  /** Human-readable title */
  title: string;

  /** Which pillar/area this priority belongs to */
  area?: PriorityArea;

  /** How severe/urgent this priority is */
  severity?: PrioritySeverity;

  /** Impact level (business value) */
  impact?: PriorityImpactLevel;

  /** Effort required to implement */
  effort?: PriorityEffortSize;

  /** Brief summary (1-2 sentences) */
  summary?: string;

  /** Detailed description */
  description?: string;

  /** Why this matters (rationale) */
  rationale?: string;

  /** Expected outcome if implemented */
  expectedOutcome?: string;

  /** Current status (e.g., "open", "planned", "completed") */
  status?: string;

  /** Any additional metadata */
  [key: string]: unknown;
}

/**
 * Canonical Priorities Payload (v2)
 *
 * Container for all priorities from a GAP run.
 */
export interface PrioritiesPayload {
  /** Array of priority items */
  items: PriorityItem[];

  /** Optional summary of all priorities */
  summary?: string;

  /** Optional theme or focus area */
  theme?: string;

  /** Any additional metadata */
  [key: string]: unknown;
}

// ============================================================================
// Evidence - Real Telemetry Data
// ============================================================================

/**
 * Single telemetry metric
 */
export interface EvidenceMetric {
  /** Metric identifier (e.g., "ga4_sessions_30d") */
  id: string;

  /** Data source (e.g., "ga4", "search_console", "analytics_other", "manual_observation") */
  source: 'ga4' | 'search_console' | 'analytics_other' | 'manual_observation';

  /** Human-readable label */
  label: string;

  /** Metric value */
  value: number | string;

  /** Optional unit (e.g., "%", "sessions", "clicks", "s") */
  unit?: string;

  /** Period this metric covers (e.g., "last_30_days") */
  period?: string;

  /** Comparison period (e.g., "prev_30_days") */
  comparisonPeriod?: string;

  /** Absolute change vs previous period (in same unit as value) */
  change?: number;

  /** Percentage change vs previous period */
  changePercent?: number;

  /** Trend direction */
  direction?: 'up' | 'down' | 'flat' | 'unknown';

  /** Optional pillar/area this metric relates to */
  area?: PriorityArea;

  /** ISO timestamp when this metric was collected */
  timestamp?: string;

  /** Optional dimension breakdown (e.g., ["landing_page", "/pricing"]) */
  dimensionKey?: string[];
}

/**
 * Derived insight from telemetry data
 */
export interface EvidenceInsight {
  /** Insight identifier */
  id: string;

  /** Data source (e.g., "ga4", "search_console", "analytics_other", "manual_observation") */
  source: 'ga4' | 'search_console' | 'analytics_other' | 'manual_observation';

  /** Which pillar/area this insight relates to */
  area: PriorityArea;

  /** Short, actionable insight headline */
  headline: string;

  /** 1-3 sentence explanation (optional) */
  detail?: string;

  /** Severity level */
  severity: PrioritySeverity;

  /** Supporting metric IDs */
  metricIds?: string[];

  /** Optional tag for categorization (e.g., "traffic_drop", "opportunity", "stability") */
  tag?: string;

  // Backward compatibility - deprecated, use headline/detail instead
  /** @deprecated Use headline instead */
  title?: string;

  /** @deprecated Use detail instead */
  description?: string;
}

/**
 * Evidence Payload - Container for all real telemetry data
 */
export interface EvidencePayload {
  /** Array of telemetry metrics */
  metrics?: EvidenceMetric[];

  /** Array of derived insights */
  insights?: EvidenceInsight[];

  /** When this evidence was last updated */
  lastUpdated?: string;

  /** Any additional metadata */
  [key: string]: unknown;
}

// ============================================================================
// Plan - 30/60/90-Day Roadmap
// ============================================================================

/**
 * Time horizon for plan initiatives
 */
export type PlanTimeHorizon = '30_days' | '60_days' | '90_days' | 'beyond_90_days';

/**
 * Status of a plan initiative
 */
export type PlanInitiativeStatus =
  | 'not_started'
  | 'planned'
  | 'in_progress'
  | 'blocked'
  | 'completed';

/**
 * Single initiative in the growth plan
 */
export interface PlanInitiative {
  /** Unique identifier for this initiative */
  id: string;

  /** Human-readable title */
  title: string;

  /** Which pillar/area this initiative belongs to */
  area?: PriorityArea;

  /** Brief summary (1-2 sentences) */
  summary?: string;

  /** Detailed description or implementation notes */
  detail?: string;

  /** Time horizon for this initiative */
  timeHorizon: PlanTimeHorizon;

  /** Current status */
  status?: PlanInitiativeStatus;

  /** Effort required */
  effort?: 'XS' | 'S' | 'M' | 'L' | 'XL' | string;

  /** Expected impact */
  impact?: 'Low' | 'Medium' | 'High' | string;

  /** Link to related priority item */
  priorityId?: string;

  /** Link to related work item (optional future use) */
  workItemId?: string;

  /** Owner or responsible party hint */
  ownerHint?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Any additional metadata */
  [key: string]: unknown;
}

/**
 * Phase grouping for plan initiatives (optional)
 */
export interface PlanPhase {
  /** Unique identifier for this phase */
  id: string;

  /** Phase label (e.g., "First 30 Days", "Next 60 Days") */
  label: string;

  /** Time horizon for this phase */
  timeHorizon: PlanTimeHorizon;

  /** Summary or theme for this phase */
  summary?: string;

  /** Initiatives within this phase */
  initiatives?: PlanInitiative[];

  /** Any additional metadata */
  [key: string]: unknown;
}

/**
 * Plan Payload - Container for 30/60/90-day roadmap
 */
export interface PlanPayload {
  /** Optional phases grouping (if present, initiatives may be nested here) */
  phases?: PlanPhase[];

  /** Flat list of all initiatives (may or may not be nested in phases) */
  initiatives?: PlanInitiative[];

  /** Overall theme for the plan */
  overallTheme?: string;

  /** Narrative summary (1-3 paragraphs) */
  narrativeSummary?: string;

  /** Additional notes */
  notes?: string;

  /** Any additional metadata */
  [key: string]: unknown;
}
