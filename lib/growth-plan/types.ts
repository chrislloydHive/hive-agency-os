/**
 * Growth Acceleration Plan (GAP) Types
 * 
 * TypeScript interfaces for the Growth Acceleration Plan (GAP).
 * Defines the structure for generating actionable growth plans based on assessment data.
 */

import type { ContentInventory } from './analyzeContentInventory';
import type { SiteFeatures } from '@/lib/eval/siteFeatures';

/**
 * Scorecard
 * Overall and sub-scores for different service areas
 */
export interface Scorecard {
  overall?: number;
  website?: number;
  content?: number;
  brand?: number;
  seo?: number;
  authority?: number; // Authority & Trust score
  evaluatedDimensions: ('website' | 'content' | 'seo' | 'brand' | 'authority')[];
}

/**
 * Opportunity
 * Represents a growth opportunity (quick win or strategic initiative)
 */
export type Opportunity = QuickWin | StrategicInitiative;

/**
 * Executive Summary
 * High-level summary of the Growth Acceleration Plan (GAP) reflecting all dimensions
 * Updated: expectedOutcomes is now an array of strings (matching SYSTEM prompt schema)
 */
export interface ExecutiveSummary {
  overallScore?: number; // Optional if not evaluated
  maturityStage: string;
  narrative: string; // 150–250 word plain-language summary
  strengths: string[]; // Mix of website, brand, content, SEO, competitors
  keyIssues: string[]; // Cross-cutting issues, not just UX
  strategicPriorities: string[]; // 3–5 big rocks for the next 90 days
  expectedOutcomes: string[]; // Array of expected outcomes (was: single string)
}

/**
 * Data Availability
 * Tracks what data was actually available during analysis
 */
export interface DataAvailability {
  siteCrawl: {
    attemptedUrls: string[];
    successfulUrls: string[];
    failedUrls: string[];
    coverageLevel: 'minimal' | 'partial' | 'good'; // based on how many key templates we got
  };
  technicalSeo: {
    lighthouseAvailable: boolean;
    coreWebVitalsAvailable: boolean;
    metaTagsParsed: boolean;
    indexabilityChecked: boolean;
    websiteScoringAvailable: boolean; // Whether website scoring completed successfully
  };
  competitors: {
    providedByUser: boolean;
    autoDiscovered: boolean;
    competitorCount: number;
  };
  contentInventory: {
    blogDetected: boolean;
    caseStudiesDetected: boolean;
    aboutPageDetected: boolean;
    faqDetected: boolean;
  };
  analytics: {
    googleAnalyticsDetected: boolean;
    gtmDetected: boolean;
    otherAnalyticsDetected: boolean;
  };
  insightsAvailable: boolean; // Whether insights generation completed successfully
  overallConfidence: 'low' | 'medium' | 'high';
}

/**
 * Technical SEO Signals
 * Data-driven technical SEO indicators
 */
export interface TechnicalSeoSignals {
  lighthousePerformanceScore?: number;   // e.g. 66
  lighthouseSeoScore?: number;          // optional
  hasMultipleH1?: boolean;
  hasCanonicalTagIssues?: boolean;      // true if missing/duplicate/etc.
  internalLinkCount?: number;           // approximate count of internal links on key pages
  metaTagsPresent?: boolean;
  indexabilityIssues?: string[];        // e.g. ['noindex on key page']
  notes?: string[];                     // raw notes from the technical probe
}

/**
 * Section Analysis Card Level (for small dashboards)
 * Short, punchy, high-level summary for card displays
 */
export interface SectionAnalysisCardLevel {
  verdict: string;  // 1–2 sentence high-level diagnosis
  summary: string;  // 1–2 sentence card-friendly summary
}

/**
 * Section Analysis Deep Dive (for diagnostics)
 * Detailed diagnostic content with specific findings
 */
export interface SectionAnalysisDeepDive {
  strengths: string[];      // 2–5 very specific bullets
  issues: string[];         // 3–5 very specific problem statements
  recommendations: string[]; // 3–7 actionable steps
  impactEstimate: string;  // e.g., "High – improving this would meaningfully increase conversions"
}

/**
 * Section Analysis (Rich Diagnostic)
 * Detailed analysis for a specific service area with rich diagnostics
 * Updated to match SYSTEM prompt structure with cardLevel and deepDive
 */
export interface SectionAnalysis {
  // Core identification
  label: string;           // e.g., "Brand & Positioning"
  score: number;            // 0-100
  grade: string;            // e.g., "A", "B", "C", "D", "F" or "Strong", "Developing", etc.
  
  // Card-level content (for small dashboards)
  cardLevel: SectionAnalysisCardLevel;
  
  // Deep dive content (for diagnostics)
  deepDive: SectionAnalysisDeepDive;
  
  // Legacy fields (for backward compatibility)
  verdict?: string;          // Deprecated: use cardLevel.verdict
  summary?: string;          // Deprecated: use cardLevel.summary
  strengths?: string[];      // Deprecated: use deepDive.strengths
  issues?: string[];        // Deprecated: use deepDive.issues
  recommendations?: string[]; // Deprecated: use deepDive.recommendations
  impactEstimate?: string;  // Deprecated: use deepDive.impactEstimate
  keyFindings?: string[];  // Deprecated: use deepDive.issues instead
  quickWins?: string[];    // Deprecated: use deepDive.recommendations instead
  deeperInitiatives?: string[]; // Deprecated: use deepDive.recommendations instead
  maturityNotes?: string;  // Optional commentary on maturity vs peers
}

/**
 * Market analysis summary
 */
export interface MarketAnalysis {
  category: string;
  commonPainPoints: string[];
  commonClaims: string[];
  pricingPatterns: string[];
  ICPProfiles: string[];
  categoryTrends: string[];
  differentiationWhitespace: string[];
 }

/**
 * Positioning Analysis
 * Analysis of how the company positions itself in the market
 */
export interface PositioningAnalysis {
  primaryAudience: string;          // e.g. "individuals looking for local personal trainers"
  geographicFocus: string;          // e.g. "hyper-local / neighborhood-focused in [regions]" or "national / remote"
  localSearchLanguage?: string[];   // e.g. ["search by neighborhood", "find trainers near you", "in your neighborhood"]
  corePositioningStatement: string; // summary of 'who we are for' and 'what we offer'
  keyThemes: string[];              // repeated ideas (e.g. local, flexible, tech-enabled, premium, budget, etc.)
  differentiationSignals: string[]; // how they attempt to stand out
  evidenceFromSite: string[];       // exact phrases or sections that support this reading
}

/**
 * Social Strength
 * Strength level of social media presence
 */
export type SocialStrength = "none" | "weak" | "present" | "strong";

/**
 * Social Signals
 * Detected social media presence and activity
 */
export interface SocialSignals {
  hasLinkedIn: boolean;
  hasFacebook: boolean;
  hasInstagram: boolean;
  linkedinUrls: string[];
  facebookUrls: string[];
  instagramUrls: string[];
  linkedinStrength?: SocialStrength;
  facebookStrength?: SocialStrength;
  instagramStrength?: SocialStrength;
}

/**
 * Strategic priority for growth initiatives
 */
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Time horizon for action items
 */
export type TimeHorizon = 'immediate' | 'short_term' | 'medium_term' | 'long_term';

/**
 * Roadmap Initiative (from SYSTEM prompt)
 * Represents a single initiative in the roadmap with all required fields
 */
export interface RoadmapInitiative {
  title: string;
  description: string; // 2–4 sentences
  sectionKey: 'brand' | 'content' | 'seo' | 'website';
  priority: 'P0' | 'P1' | 'P2'; // P0 = critical, P1 = important, P2 = nice-to-have
  complexity: 'S' | 'M' | 'L'; // Small, Medium, Large
  expectedImpact: string;
  ownerHint: string; // e.g., "Marketing Lead", "Web Dev", "Founder"
}

/**
 * Roadmap (from SYSTEM prompt)
 * Three buckets: now (0–30 days), next (30–90 days), later (90–180+ days)
 */
export interface Roadmap {
  now: RoadmapInitiative[];   // 0–30 days
  next: RoadmapInitiative[];  // 30–90 days
  later: RoadmapInitiative[]; // 90–180+ days
}

/**
 * Full GAP Plan Response (from LLM)
 * Complete JSON structure matching SYSTEM prompt schema
 * 
 * Top-level keys (per SYSTEM prompt):
 * - gapId: string
 * - companyName: string
 * - websiteUrl: string
 * - generatedAt: ISO timestamp
 * - executiveSummary: { overallScore, maturityStage, narrative, strengths[], keyIssues[], strategicPriorities[] }
 * - scorecard: { brandScore, contentScore, seoScore, websiteScore, overallScore }
 * - sectionAnalyses: { brand, content, seo, website } (each with cardLevel and deepDive)
 * - accelerators: string[] (3–5 strategic pillars)
 * - roadmap: { now[], next[], later[] } (initiatives)
 * - expectedOutcomes: string[] (top-level array)
 */
export interface FullGapPlanResponse {
  gapId: string;
  companyName: string;
  websiteUrl: string;
  generatedAt: string; // ISO timestamp
  
  executiveSummary: {
    overallScore: number;
    maturityStage: string;
    narrative: string; // 2–4 paragraph overview
    strengths: string[];
    keyIssues: string[];
    strategicPriorities: string[];
    expectedOutcomes?: string[]; // Optional array inside executiveSummary
  };
  
  scorecard: {
    brandScore: number;
    contentScore: number;
    seoScore: number;
    websiteScore: number;
    overallScore: number;
  };
  
  sectionAnalyses: {
    brand?: SectionAnalysis;
    content?: SectionAnalysis;
    seo?: SectionAnalysis;
    website?: SectionAnalysis;
  };
  
  accelerators: string[]; // 3–5 strategic pillars
  
  roadmap: Roadmap;
  
  expectedOutcomes: string[]; // Top-level array
}

/**
 * Expected impact level
 */
export type ImpactLevel = 'transformational' | 'high' | 'medium' | 'low';

/**
 * Resource requirement level
 */
export type ResourceLevel = 'minimal' | 'moderate' | 'significant' | 'major';

/**
 * Growth action item
 * Represents a single actionable initiative
 */
export interface GrowthAction {
  id: string;
  title: string;
  description: string;
  priority: PriorityLevel;
  timeHorizon: TimeHorizon;
  impact: ImpactLevel;
  resourceRequirement: ResourceLevel;
  
  // Specific details
  specificChanges: string[]; // Detailed changes needed
  expectedOutcome: string; // What success looks like
  successMetrics: string[]; // How to measure success
  potentialScoreGain?: number; // Points this could add to overall score (0-20)
  
  // Resource details
  estimatedEffort: string; // e.g., "2-3 weeks", "1 month"
  requiredSkills?: string[]; // Skills needed
  dependencies?: string[]; // Other actions this depends on
  
  // Service area
  serviceArea: 'brandingAndImpact' | 'contentAndEngagement' | 'websiteAndConversion' | 'seoAndVisibility' | 'cross_cutting';
  
  // Evidence
  evidence?: string; // Why this action is needed (from assessment)
  pillar?: string; // Related rubric pillar ID
}

/**
 * Quick win action (can be immediate, short_term, medium_term, or long_term)
 * High-impact, low-effort actions for immediate results
 */
export interface QuickWin extends GrowthAction {
  timeHorizon: TimeHorizon; // Allow all time horizons: immediate, short_term, medium_term, long_term
  quickWinReason: string; // Why this is a quick win
  expectedTimeline: string; // e.g., "Week 1-2", "Within 30 days"
}

/**
 * Strategic initiative (90-day+ horizon)
 * Larger, more comprehensive growth initiatives
 */
export interface StrategicInitiative extends GrowthAction {
  timeHorizon: 'medium_term' | 'long_term';
  phases?: InitiativePhase[]; // Breakdown into phases
  totalDuration: string; // Total time estimate
  investmentLevel: 'low' | 'medium' | 'high';
  expectedROI?: string; // Expected return on investment
}

/**
 * Phase within a strategic initiative
 */
export interface InitiativePhase {
  phaseNumber: number;
  name: string;
  duration: string;
  deliverables: string[];
  milestones: string[];
}

/**
 * Resource requirement breakdown
 */
export interface ResourceRequirement {
  type: 'internal' | 'external' | 'tool' | 'budget';
  description: string;
  estimatedCost?: string; // e.g., "$500/month", "Included in existing tools"
  urgency: 'immediate' | 'soon' | 'later';
}

/**
 * Growth focus area
 * Groups related actions by strategic theme
 */
export interface GrowthFocusArea {
  id: string;
  name: string;
  description: string;
  priority: PriorityLevel;
  actions: GrowthAction[];
  expectedImpact: string; // Overall impact description
  successCriteria: string[]; // How to know this focus area is successful
}

/**
 * Growth Acceleration Plan (GAP)
 * Complete structured growth plan based on assessment
 */
/**
 * Debug payload for Growth Acceleration Plan (GAP) calibration
 * Only included in development mode
 */
export interface GAPDebug {
  features: {
    siteFeatures: SiteFeatures; // SiteFeatures blueprint (canonical signal structure)
    siteElementContext: {
      pages: Array<{
        pageUrl: string;
        type: string;
        title?: string;
        headings: string[];
        navItems: string[];
        ctaLabels: string[];
        sectionTitles: string[];
      }>;
    };
    contentInventory: ContentInventory;
    technicalSeoSignals: TechnicalSeoSignals;
    positioningAnalysis: PositioningAnalysis;
    assessment: {
      overallScore: number;
      maturityStage: string;
      brandScore: number;
      contentScore: number;
      websiteScore: number;
    };
    dataAvailability: DataAvailability;
  };
  rubricScores: {
    dimensions: Array<{
      name: string;
      weight: number;
      components: Array<{
        name: string;
        score: number;
        max: number;
      }>;
      score: number;
    }>;
    overallScore: number;
    rawDimensionScores?: Record<string, number>; // Scores before floors applied
    rawBrandScore?: number; // Brand score before floors (for debug)
  };
  finalScores: {
    overall: number;
    website?: number;
    content?: number;
    seo?: number;
    brand?: number;
    authority?: number;
    evaluatedDimensions: string[];
    adjustedDimensionScores?: Record<string, number>; // Scores after floors applied
    brandAfterFloors?: number; // Brand score after brand floors (for debug)
  };
}

/**
 * V2 Strategic Diagnosis
 * Growth bottleneck analysis and ICP definition
 */
export interface StrategicDiagnosis {
  growthBottleneck: string; // 1-2 sentences: what's limiting growth
  bottleneckCategory: 'Discovery' | 'Conversion' | 'Retention' | 'Positioning' | 'Product-Market Fit' | 'Other';
  whyThisMatters: string; // Brief explanation of business impact

  primaryIcp: {
    label: string; // e.g., "B2B SaaS founders"
    description: string; // 2-3 sentences
    keyPainPoints: string[]; // 3-5 bullets
    keyObjections: string[]; // 3-5 bullets
  };

  secondaryIcp?: {
    label: string;
    description: string;
  };
}

/**
 * V2 Channel Recommendation
 * Specific guidance for a marketing channel
 */
export interface ChannelRecommendation {
  summary: string; // 2-4 sentence overview of current state & opportunity
  keyPlays: string[]; // 3-6 bullets of what to actually do in this channel
}

/**
 * V2 Enhanced Action Item
 * Concrete action with impact/effort/confidence scoring
 */
export interface GapActionV2 {
  id: string; // stable ID within the report
  title: string; // e.g., "Rewrite homepage hero for clarity"
  description: string; // 2-3 sentences explaining what & why
  category: 'Brand' | 'Content' | 'SEO' | 'Website & Conversion' | 'Authority' | 'Email' | 'Paid' | 'Other';
  channel: string; // free-text, e.g., "Website & Conversion" or "SEO & Content"
  timeHorizon: 'Immediate' | 'Short Term' | 'Medium Term' | 'Long Term';
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  confidence: 'low' | 'medium' | 'high';
  dependencies?: string[]; // IDs of actions that should come first
  ownerHint?: string; // "Marketing", "Founder", "Web dev"
}

/**
 * V2 Action Reference
 * Reference to an action with optional rationale
 */
export interface GapActionRef {
  actionId: string;
  rationale?: string; // why it belongs in this bucket / accelerator
}

/**
 * V2 Benchmark Metric
 * Performance metric with peer comparison
 */
export interface BenchmarkMetric {
  value: number | null;
  median: number | null;
  topQuartile: number | null;
  percentile: number | null;
}

/**
 * V2 Strategic Outcome
 * High-level business outcome from executing the plan
 */
export interface StrategicOutcome {
  label: string; // "Stronger User Engagement"
  description: string; // 2-3 sentences
  linkedScores: string[]; // which metrics this outcome relates to
}

export interface GrowthAccelerationPlan {
  // Metadata
  gapId: string;
  companyName: string;
  websiteUrl: string;
  generatedAt: string; // ISO timestamp
  assessmentSnapshotId?: string; // Link to source snapshot
  planVersion?: 'v1' | 'v2'; // Plan version (v2 = new enhanced format, v1 or missing = legacy)

  // ============================================================================
  // V2 ENHANCED FIELDS (optional for backward compatibility)
  // ============================================================================

  // V2: Enhanced Executive Summary
  executiveSummaryV2?: {
    overallScore: number;
    maturityStage: string;
    headline: string; // 1-sentence positioning of where they stand
    narrative: string; // 3-6 paragraphs, true executive summary
    keyStrengths: string[]; // 3-6
    keyIssues: string[]; // 3-6 (biggest structural problems)
    strategicTheme: string; // e.g., "You're conversion-ready but under-discovered"
  };

  // V2: Strategic Diagnosis (bottleneck + ICP)
  strategicDiagnosis?: StrategicDiagnosis;

  // V2: Channel-by-Channel Recommendations
  channelRecommendations?: {
    websiteAndConversion?: ChannelRecommendation;
    seoAndContent?: ChannelRecommendation;
    emailAndNurture?: ChannelRecommendation;
    paidSearch?: ChannelRecommendation;
    paidSocial?: ChannelRecommendation;
    socialOrganic?: ChannelRecommendation;
    partnerships?: ChannelRecommendation;
    brandAndPositioning?: ChannelRecommendation;
  };

  // V2: Full Action Inventory (20-40 actions)
  actions?: GapActionV2[];

  // V2: Roadmap with Action References
  roadmapV2?: {
    immediate: GapActionRef[]; // 1-2 weeks
    shortTerm: GapActionRef[]; // 2-6 weeks
    mediumTerm: GapActionRef[]; // 6-12 weeks
    longTerm: GapActionRef[]; // 12-24 weeks
  };

  // V2: Top Accelerators (subset of actions)
  accelerators?: GapActionRef[]; // 3-6 highest leverage actions

  // V2: Enhanced Benchmarks
  benchmarksV2?: {
    peerCount: number;
    cohortLabel: string; // e.g., "SaaS / Tier 2"
    overall: BenchmarkMetric;
    website: BenchmarkMetric;
    brand: BenchmarkMetric;
    content: BenchmarkMetric;
    seo: BenchmarkMetric;
    authority: BenchmarkMetric;
  };

  // V2: Strategic Outcomes
  strategicOutcomes?: StrategicOutcome[]; // 3-4, high-level "what improves if you execute"

  // ============================================================================
  // V1 LEGACY FIELDS (kept for backward compatibility)
  // ============================================================================

  // Executive summary
  executiveSummary: ExecutiveSummary;
  
  // Quick wins (30-day actions)
  quickWins: QuickWin[];
  
  // Strategic initiatives (90-day+ actions)
  strategicInitiatives: StrategicInitiative[];
  
  // Focus areas (grouped by theme)
  focusAreas: GrowthFocusArea[];
  
  // Resource requirements
  resourceRequirements: ResourceRequirement[];
  
  // Timeline overview
  timeline: {
    immediate: GrowthAction[]; // 0-30 days
    shortTerm: GrowthAction[]; // 30-90 days
    mediumTerm: GrowthAction[]; // 90-180 days
    longTerm: GrowthAction[]; // 180+ days
  };
  
  // Expected outcomes
  expectedOutcomes: {
    thirtyDays: {
      scoreImprovement: number; // Expected score increase
      keyMetrics: string[];
      milestones: string[];
    };
    ninetyDays: {
      scoreImprovement: number;
      keyMetrics: string[];
      milestones: string[];
    };
    sixMonths: {
      scoreImprovement: number;
      keyMetrics: string[];
      milestones: string[];
    };
  };
  
  // Risk mitigation
  risks: Array<{
    risk: string;
    mitigation: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: ImpactLevel;
  }>;
  
  // Next steps
  nextSteps: string[]; // Immediate next steps to get started
  
  // Section analyses (detailed breakdowns by service area)
  // New format: keyed by brand | content | seo | website
  sectionAnalyses?: {
    brand?: SectionAnalysis;
    content?: SectionAnalysis;
    seo?: SectionAnalysis;
    website?: SectionAnalysis;
  };
  
  // Legacy format (for backward compatibility)
  // @deprecated Use sectionAnalyses.brand/content/seo/website instead
  sectionAnalysesLegacy?: {
    websiteAndConversion?: SectionAnalysis;
    seoAndVisibility?: SectionAnalysis;
    contentAndMessaging?: SectionAnalysis;
    brandAndPositioning?: SectionAnalysis;
  };
  
  // Competitor analysis
  competitorAnalysis?: CompetitorAnalysis;

  // Market analysis
  marketAnalysis: MarketAnalysis;

  // Positioning analysis
  positioningAnalysis: PositioningAnalysis;

  // Data availability tracking
  dataAvailability: DataAvailability;
  
  // Scorecard (optional, may be added separately)
  scorecard?: Scorecard;
  
  // Social signals (optional)
  socialSignals?: SocialSignals;

  // Consultant Report fields
  gapReportMarkdown?: string | null;
  gapReportVersion?: string | null; // e.g., "v1"

  // Debug payload (dev mode only)
  debug?: GAPDebug;
}

/**
 * Competitor Analysis
 * Detailed analysis comparing the main site against competitors
 */
export interface CompetitorAnalysis {
  competitorsReviewed: string[];
  categorySummary: string;
  positioningPatterns: string[];
  differentiationOpportunities: string[];
  contentFootprintSummary: string[];
  seoVisibilitySummary: string[];
  messagingComparison: string[];
  recommendations: string[];
}

/**
 * Growth Acceleration Plan (GAP) API Request
 */
export interface GrowthAccelerationPlanRequest {
  website_url: string;
  snapshot_id?: string; // Optional: use existing snapshot
  email?: string;
  preferences?: {
    focusAreas?: string[]; // Specific areas to focus on
    timeHorizon?: TimeHorizon; // Preferred time horizon
    resourceConstraints?: string; // Budget/skill constraints
  };
}

/**
 * Growth Acceleration Plan (GAP) API Response
 */
export interface GrowthAccelerationPlanResponse {
  ok: true;
  gapId: string;
  runId?: string; // Optional: present when using async job-based architecture
  planId?: string; // Optional: present when using step-based architecture
  status?: "queued" | "running" | "completed" | "failed" | "pending"; // Optional: present when using async job-based architecture
  shareUrl?: string; // Optional: Unique shareable URL (only present when plan is included)
  plan?: GrowthAccelerationPlan; // Optional: only present when completed synchronously
  currentFinding?: string; // Optional: current finding message for loader
  progress?: number; // Optional: progress percentage (0-100)
  stage?: string; // Optional: current stage/step name
}

/**
 * Growth Acceleration Plan (GAP) API Error Response
 */
export interface GrowthAccelerationPlanError {
  ok: false;
  error: string;
}

export type GrowthAccelerationPlanApiResponse = GrowthAccelerationPlanResponse | GrowthAccelerationPlanError;

