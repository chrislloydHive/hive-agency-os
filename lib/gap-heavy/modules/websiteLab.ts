// lib/gap-heavy/modules/websiteLab.ts
// Website Diagnostics V4/V5 - The Flagship OS UX & Conversion Lab
//
// Evolution from V3.1 (single-page) to V4/V5 (multi-page UX lab):
// - Multi-page spider (Home, Product, Pricing, About, Contact, Resources)
// - Desktop + mobile screenshot + vision-model analysis
// - Conversion funnel mapping & dead-end detection
// - Intent classification (per page + global)
// - Heuristic UX evaluator (Nielsen/Baymard/CXL style)
// - Persona-based behavioral simulation
// - Trends over time and benchmarking
// - Tight OS integration: Diagnostics → Scorecard → Work → Growth Plan

import type { WebsiteEvidenceV3, WebsiteUXAssessmentV3 } from './website';

// ============================================================================
// V4/V5 TYPE DEFINITIONS
// ============================================================================

/**
 * Page type classification for multi-page analysis
 */
export type WebsitePageType =
  | 'home'
  | 'product'
  | 'service'
  | 'pricing'
  | 'about'
  | 'contact'
  | 'blog'
  | 'resource'
  | 'other';

/**
 * Primary intent classification per page
 */
export type PageIntent =
  | 'educate'
  | 'convert'
  | 'compare'
  | 'explore'
  | 'validate'
  | 'support'
  | 'other';

/**
 * Funnel stage in conversion journey
 */
export type FunnelStage =
  | 'awareness'
  | 'consideration'
  | 'decision'
  | 'retention'
  | 'none';

/**
 * Layout density classification
 */
export type LayoutDensity = 'sparse' | 'balanced' | 'crowded';

/**
 * Persona types for behavioral simulation
 */
export type PersonaType =
  | 'first_time'
  | 'ready_to_buy'
  | 'researcher'
  | 'comparison_shopper'
  | 'mobile_user';

/**
 * Benchmark label based on overall score
 */
export type BenchmarkLabel = 'elite' | 'strong' | 'average' | 'weak';

// ============================================================================
// PAGE-LEVEL STRUCTURES
// ============================================================================

/**
 * Discovered page during site crawl phase
 * Used for prioritization before full analysis
 */
export interface DiscoveredPage {
  /** Full URL of the page */
  url: string;

  /** Normalized path (e.g., "/pricing") */
  path: string;

  /** Page type classification */
  type: WebsitePageType;

  /** Whether this is a primary/key page (in main nav or high priority) */
  isPrimary: boolean;

  /** Priority score for analysis (higher = more important, 0-100) */
  priorityScore: number;

  /** Link text that led to this page (if discovered via link) */
  linkText?: string;

  /** Whether page was found in navigation */
  inNavigation?: boolean;
}

/**
 * Raw page snapshot captured during spider phase
 */
export interface WebsitePageSnapshot {
  /** Full URL of the page */
  url: string;

  /** Page type classification */
  type: WebsitePageType;

  /** Raw HTML content */
  html: string;

  /** Normalized path (e.g., "/pricing") */
  path: string;

  /** Whether this is a primary/key page */
  isPrimary?: boolean;

  /** Priority score (optional, for sorting) */
  priorityScore?: number;
}

/**
 * Vision analysis results from screenshot + vision LLM
 */
export interface PageVisionAnalysis {
  /** Whether page has a hero image */
  hasHeroImage: boolean;

  /** Whether text overlays images */
  overTextOnImage: boolean;

  /** Perceived clarity from visual perspective (0-100) */
  perceivedClarityScore: number;

  /** Whitespace usage score (0-100) */
  whitespaceScore: number;

  /** Layout density classification */
  layoutDensity: LayoutDensity;

  /** Key visual observations */
  keyVisualObservations: string[];

  /** Mobile-specific notes (if mobile screenshot analyzed) */
  mobileNotes?: string[];
}

/**
 * Intent analysis per page
 */
export interface PageIntentAnalysis {
  /** Primary intent of the page */
  primaryIntent: PageIntent;

  /** How clear the intent is (0-100) */
  clarityScore: number;

  /** Notes where layout/content conflicts with intent */
  misalignmentNotes: string[];
}

/**
 * Complete evidence for a single page (combines V3 + V4 enhancements)
 */
export interface WebsitePageEvidenceV4 {
  /** Full URL */
  url: string;

  /** Normalized path */
  path: string;

  /** Page type */
  type: WebsitePageType;

  /** Page title */
  title: string | null;

  /** Whether this is a primary page */
  isPrimary: boolean;

  /** Existing V3 evidence, but scoped per page */
  evidenceV3: WebsiteEvidenceV3;

  /** Vision/screenshot analysis (optional, V4.1) */
  vision?: PageVisionAnalysis;

  /** Intent + role analysis (V4.2) */
  pageIntent?: PageIntentAnalysis;

  /** Funnel stage classification (V4.3) */
  funnelStage?: FunnelStage;
}

// ============================================================================
// SITE GRAPH & NAVIGATION
// ============================================================================

/**
 * Edge/link between pages in the site graph
 */
export interface SiteGraphEdge {
  /** Source page path */
  fromPath: string;

  /** Destination page path */
  toPath: string;

  /** Link text (if available) */
  linkText?: string;
}

/**
 * Site graph representing all analyzed pages and their relationships
 */
export interface WebsiteSiteGraphV4 {
  /** All page evidences */
  pages: WebsitePageEvidenceV4[];

  /** Links between pages */
  edges: SiteGraphEdge[];

  /** Primary entry path (typically "/") */
  primaryEntryPath: string;
}

// ============================================================================
// PERSONA SIMULATION
// ============================================================================

/**
 * Result of persona-based behavioral simulation (Enhanced V5.7)
 */
export interface WebsiteUXLabPersonaResult {
  /** Persona type */
  persona: PersonaType;

  /** What the persona is trying to achieve */
  goal: string;

  /** Whether they succeeded */
  success: boolean;

  /** Perceived clarity from this persona's perspective (0-100) */
  perceivedClarityScore: number;

  /** Friction points encountered */
  frictionNotes: string[];

  /** Sequence of page paths taken */
  stepsTaken: string[];

  /** Abstract time/steps to reach goal */
  timeToGoalEstimate: number;

  // ========================================================================
  // V5.7 ENHANCEMENTS
  // ========================================================================

  /** Expected optimal path for this persona */
  expectedPath?: string[];

  /** Specific fixes for this persona's journey */
  personaSpecificFixes?: string[];

  /** Pain points ranked by severity */
  painPoints?: Array<{
    issue: string;
    severity: 'high' | 'medium' | 'low';
    location: string;
  }>;
}

// ============================================================================
// HEURISTIC EVALUATION
// ============================================================================

/**
 * Individual heuristic finding
 */
export interface HeuristicFinding {
  /** Unique ID for this finding */
  id: string;

  /** Rule name */
  rule: string;

  /** Severity level */
  severity: 'low' | 'medium' | 'high';

  /** Description of the issue */
  description: string;

  /** Page path where issue was found (if applicable) */
  pagePath?: string;
}

/**
 * Aggregated heuristic UX summary
 */
export interface HeuristicUxSummary {
  /** All findings */
  findings: HeuristicFinding[];

  /** Overall heuristic score (0-100) */
  overallScore: number;
}

// ============================================================================
// CTA INTELLIGENCE ENGINE (V5.1)
// ============================================================================

/**
 * Individual CTA analysis
 */
export interface CtaAnalysis {
  /** CTA text */
  text: string;

  /** CTA type (button, link, nav item) */
  type: 'button' | 'link' | 'nav' | 'form_submit';

  /** Page path where found */
  pagePath: string;

  /** Position on page */
  position: 'above_fold' | 'mid_page' | 'below_fold';

  /** Clarity score (0-100) */
  clarityScore: number;

  /** Action verb strength (0-100) */
  actionScore: number;

  /** Urgency/scarcity present */
  urgencyScore: number;

  /** Value communication score */
  valueScore: number;

  /** Overall CTA quality (0-100) */
  overallScore: number;

  /** Issues identified */
  issues: string[];

  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * CTA pattern analysis across site
 */
export interface CtaPatternAnalysis {
  /** Primary CTA identified */
  primaryCta?: string;

  /** Is primary CTA consistent across pages? */
  primaryCtaConsistent: boolean;

  /** Competing CTAs detected */
  competingCtas: string[];

  /** Pages missing CTAs */
  pagesMissingCtas: string[];

  /** Dead CTAs (don't lead anywhere useful) */
  deadCtas: string[];

  /** CTA consistency score (0-100) */
  consistencyScore: number;
}

/**
 * Complete CTA intelligence summary
 */
export interface CtaIntelligence {
  /** All CTAs found across site */
  ctas: CtaAnalysis[];

  /** CTA pattern analysis */
  patterns: CtaPatternAnalysis;

  /** Summary score (0-100) */
  summaryScore: number;

  /** Key recommendations */
  recommendations: string[];

  /** Narrative summary */
  narrative: string;
}

// ============================================================================
// CONTENT INTELLIGENCE ENGINE (V5.2)
// ============================================================================

/**
 * Headline analysis
 */
export interface HeadlineAnalysis {
  /** Headline text */
  text: string;

  /** Page path */
  pagePath: string;

  /** Headline type (h1, h2, etc.) */
  level: 'h1' | 'h2' | 'h3';

  /** Clarity score (0-100) */
  clarityScore: number;

  /** Specificity (generic vs specific) */
  specificityScore: number;

  /** Benefit vs feature ratio */
  benefitFocused: boolean;

  /** Issues */
  issues: string[];
}

/**
 * Content quality metrics
 */
export interface ContentQualityMetrics {
  /** Reading level (Flesch-Kincaid grade) */
  readingLevel: number;

  /** Jargon density (0-100, lower is better) */
  jargonDensity: number;

  /** Clarity score (0-100) */
  clarityScore: number;

  /** Repetition/redundancy detected */
  redundancyIssues: string[];

  /** Benefit vs feature ratio (0-100) */
  benefitRatio: number;

  /** Proof-backed claims count */
  proofBackedClaims: number;

  /** ICP alignment score (0-100) */
  icpAlignmentScore: number;
}

/**
 * Complete content intelligence summary
 */
export interface ContentIntelligence {
  /** Headlines analyzed */
  headlines: HeadlineAnalysis[];

  /** Overall content quality metrics */
  qualityMetrics: ContentQualityMetrics;

  /** Value proposition strength (0-100) */
  valuePropositionStrength: number;

  /** Summary score (0-100) */
  summaryScore: number;

  /** Key improvements */
  improvements: string[];

  /** Narrative summary */
  narrative: string;
}

// ============================================================================
// TRUST SIGNAL PATTERN LIBRARY (V5.3)
// ============================================================================

/**
 * Individual trust signal detected
 */
export interface TrustSignal {
  /** Signal type */
  type:
    | 'testimonial'
    | 'logo'
    | 'case_study'
    | 'metric'
    | 'award'
    | 'certification'
    | 'partnership'
    | 'team'
    | 'guarantee'
    | 'security_badge'
    | 'press_mention';

  /** Page path where found */
  pagePath: string;

  /** Signal text/description */
  description: string;

  /** Position on page */
  position: 'above_fold' | 'mid_page' | 'below_fold';

  /** Credibility score (0-100) */
  credibilityScore: number;
}

/**
 * Trust signal distribution analysis
 */
export interface TrustDistribution {
  /** Trust density per page (0-5 scale) */
  densityByPage: Record<string, number>;

  /** Average density across site */
  averageDensity: number;

  /** Pages with no trust signals */
  pagesMissingTrust: string[];

  /** Trust placement score (0-100) */
  placementScore: number;
}

/**
 * Complete trust analysis summary
 */
export interface TrustAnalysis {
  /** All trust signals found */
  signals: TrustSignal[];

  /** Distribution analysis */
  distribution: TrustDistribution;

  /** Overall trust density (0-5) */
  overallDensity: number;

  /** Trust score (0-100) */
  trustScore: number;

  /** Fixes recommended */
  fixes: string[];

  /** Narrative summary */
  narrative: string;
}

// ============================================================================
// VISUAL + BRAND EVALUATION 2.0 (V5.4)
// ============================================================================

/**
 * Color harmony analysis
 */
export interface ColorHarmony {
  /** Primary colors detected */
  primaryColors: string[];

  /** Color harmony score (0-100) */
  harmonyScore: number;

  /** Contrast issues */
  contrastIssues: string[];

  /** Accessibility compliance (WCAG) */
  accessibilityScore: number;
}

/**
 * Typography analysis
 */
export interface TypographyAnalysis {
  /** Font families detected */
  fontFamilies: string[];

  /** Font pairing consistency (0-100) */
  pairingScore: number;

  /** Readability score (0-100) */
  readabilityScore: number;

  /** Typography issues */
  issues: string[];
}

/**
 * Layout & scannability analysis
 */
export interface LayoutAnalysis {
  /** Layout scannability (0-100) */
  scannabilityScore: number;

  /** Visual hierarchy clarity (0-100) */
  hierarchyScore: number;

  /** Whitespace usage (0-100) */
  whitespaceScore: number;

  /** Layout modernity (0-100) */
  modernityScore: number;
}

/**
 * Hero aesthetics analysis
 */
export interface HeroAesthetics {
  /** Hero visual appeal (0-100) */
  appealScore: number;

  /** Hero clarity (0-100) */
  clarityScore: number;

  /** Hero focal point clear */
  hasClearFocalPoint: boolean;

  /** Issues */
  issues: string[];
}

/**
 * Complete visual + brand evaluation
 */
export interface VisualBrandEvaluation {
  /** Color harmony analysis */
  colorHarmony: ColorHarmony;

  /** Typography analysis */
  typography: TypographyAnalysis;

  /** Layout analysis */
  layout: LayoutAnalysis;

  /** Hero aesthetics */
  hero: HeroAesthetics;

  /** Overall visual modernity (0-100) */
  visualModernityScore: number;

  /** Brand consistency score (0-100) */
  brandConsistencyScore: number;

  /** Overall visual score (0-100) */
  overallVisualScore: number;

  /** Recommendations */
  recommendations: string[];

  /** Narrative summary */
  narrative: string;
}

// ============================================================================
// IMPACT MATRIX (V5.5)
// ============================================================================

/**
 * Impact matrix item (issue/opportunity with prioritization)
 */
export interface ImpactMatrixItem {
  /** Issue or opportunity ID */
  id: string;

  /** Title */
  title: string;

  /** Description */
  description: string;

  /** Impact score (1-5) */
  impact: 1 | 2 | 3 | 4 | 5;

  /** Effort score (1-5) */
  effort: 1 | 2 | 3 | 4 | 5;

  /** Estimated conversion lift % */
  estimatedLift: number;

  /** Priority bucket */
  priority: 'now' | 'next' | 'later';

  /** Related UX dimensions */
  dimensions: WebsiteUxDimensionKey[];

  /** Evidence/rationale */
  rationale: string;
}

/**
 * Complete impact matrix
 */
export interface ImpactMatrix {
  /** All items */
  items: ImpactMatrixItem[];

  /** Quick wins (high impact, low effort) */
  quickWins: ImpactMatrixItem[];

  /** Major projects (high impact, high effort) */
  majorProjects: ImpactMatrixItem[];

  /** Fill-ins (low impact, low effort) */
  fillIns: ImpactMatrixItem[];

  /** Time sinks (low impact, high effort) */
  timeSinks: ImpactMatrixItem[];

  /** Narrative summary */
  narrative: string;
}

// ============================================================================
// SCENT TRAIL ANALYSIS (V5.6)
// ============================================================================

/**
 * Message continuity issue
 */
export interface ScentMismatch {
  /** Mismatch type */
  type: 'promise' | 'cta' | 'headline' | 'narrative';

  /** From page */
  fromPage: string;

  /** To page */
  toPage: string;

  /** Description of mismatch */
  description: string;

  /** Severity */
  severity: 'high' | 'medium' | 'low';
}

/**
 * Scent trail continuity analysis
 */
export interface ScentTrailAnalysis {
  /** Promise continuity score (0-100) */
  promiseContinuityScore: number;

  /** CTA continuity score (0-100) */
  ctaContinuityScore: number;

  /** Headline consistency score (0-100) */
  headlineConsistencyScore: number;

  /** Narrative coherence score (0-100) */
  narrativeCoherenceScore: number;

  /** Overall scent trail score (0-100) */
  overallScore: number;

  /** Mismatches detected */
  mismatches: ScentMismatch[];

  /** Fixes recommended */
  fixes: string[];

  /** Narrative summary */
  narrative: string;
}

// ============================================================================
// STRATEGIST VIEWS (V5.8, V5.9)
// ============================================================================

/**
 * Conversion Strategist View - LLM-generated conversion-focused analysis
 */
export interface ConversionStrategistView {
  /** Overall conversion readiness score (0-100) */
  conversionReadinessScore: number;

  /** Main narrative from conversion strategist perspective */
  narrative: string;

  /** Funnel blockers identified */
  funnelBlockers: string[];

  /** Conversion opportunities */
  opportunities: string[];

  /** Recommended tests to run */
  testRecommendations: string[];
}

/**
 * Copywriting Strategist View - LLM-generated messaging analysis
 */
export interface CopywritingStrategistView {
  /** Overall messaging clarity score (0-100) */
  messagingClarityScore: number;

  /** Main narrative from copywriting perspective */
  narrative: string;

  /** Tone assessment */
  toneAnalysis: {
    detectedTone: string;
    consistencyScore: number;
    alignmentWithICP: string;
  };

  /** Messaging issues */
  messagingIssues: string[];

  /** Differentiation clarity */
  differentiationAnalysis: {
    isUniquenessCanonClear: boolean;
    competitivePositioning: string;
    recommendations: string[];
  };

  /** Rewrite suggestions */
  rewriteSuggestions: Array<{
    section: string;
    current: string;
    suggested: string;
    rationale: string;
  }>;
}

/**
 * Combined strategist views
 */
export interface StrategistViews {
  /** Conversion strategist perspective */
  conversion: ConversionStrategistView;

  /** Copywriting strategist perspective */
  copywriting: CopywritingStrategistView;

  /** General strategist overview (optional) */
  general?: string;
}

// ============================================================================
// ANALYTICS INTEGRATION HOOKS (V5.10, V5.11, V5.12)
// ============================================================================

/**
 * GA4 Page Metrics (skeleton for future OAuth integration)
 */
export interface GA4PageMetrics {
  /** Page path */
  path: string;

  /** Pageviews */
  pageviews: number;

  /** Unique pageviews */
  uniquePageviews: number;

  /** Average time on page (seconds) */
  avgTimeOnPage: number;

  /** Bounce rate (%) */
  bounceRate: number;

  /** Exit rate (%) */
  exitRate: number;
}

/**
 * GA4 Funnel Metrics
 */
export interface GA4FunnelMetrics {
  /** Funnel step name */
  step: string;

  /** Users entering this step */
  usersEntered: number;

  /** Users completing this step */
  usersCompleted: number;

  /** Completion rate (%) */
  completionRate: number;

  /** Average time in step (seconds) */
  avgTimeInStep: number;
}

/**
 * GA4 Integration Data (skeleton)
 */
export interface GA4Integration {
  /** Is GA4 connected? */
  connected: boolean;

  /** Page-level metrics */
  pageMetrics?: GA4PageMetrics[];

  /** Funnel metrics */
  funnelMetrics?: GA4FunnelMetrics[];

  /** Overall engagement rate */
  engagementRate?: number;

  /** Top landing pages */
  topLandingPages?: Array<{ path: string; sessions: number }>;
}

/**
 * Google Search Console Data (skeleton)
 */
export interface SearchConsoleIntegration {
  /** Is GSC connected? */
  connected: boolean;

  /** Top keywords */
  topKeywords?: Array<{
    keyword: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;

  /** Coverage issues */
  coverageIssues?: Array<{
    type: string;
    affectedPages: number;
  }>;

  /** Indexing status */
  indexingStatus?: {
    indexed: number;
    notIndexed: number;
    issues: string[];
  };

  /** CTR anomalies */
  ctrAnomalies?: Array<{
    page: string;
    expectedCtr: number;
    actualCtr: number;
    issue: string;
  }>;
}

/**
 * Heatmap Integration Data (Clarity, HotJar skeleton)
 */
export interface HeatmapIntegration {
  /** Is heatmap tool connected? */
  connected: boolean;

  /** Tool name (e.g., "Clarity", "HotJar") */
  tool?: string;

  /** Scroll depth by page */
  scrollDepth?: Array<{
    page: string;
    avgScrollDepth: number;
    scrollToBottom: number;
  }>;

  /** Rage clicks detected */
  rageClicks?: Array<{
    page: string;
    element: string;
    count: number;
  }>;

  /** Dead clicks (clicks with no action) */
  deadClicks?: Array<{
    page: string;
    element: string;
    count: number;
  }>;

  /** Exit zones */
  exitZones?: Array<{
    page: string;
    zone: string;
    exitRate: number;
  }>;
}

/**
 * Combined Analytics Data
 */
export interface AnalyticsIntegrations {
  /** GA4 data */
  ga4?: GA4Integration;

  /** Search Console data */
  searchConsole?: SearchConsoleIntegration;

  /** Heatmap data */
  heatmap?: HeatmapIntegration;
}

// ============================================================================
// SITE-LEVEL ASSESSMENT (V4/V5 Enhanced)
// ============================================================================

/**
 * Page-level score breakdown
 */
export interface PageLevelScore {
  /** Page path */
  path: string;

  /** Page type */
  type: WebsitePageType;

  /** UX score for this page (0-100) */
  score: number;

  /** Strengths of this page */
  strengths: string[];

  /** Weaknesses of this page */
  weaknesses: string[];
}

/**
 * UX dimension keys for section analyses (consultant report format)
 */
export type WebsiteUxDimensionKey =
  | 'overall_experience'
  | 'hero_and_value_prop'
  | 'navigation_and_structure'
  | 'trust_and_social_proof'
  | 'conversion_flow'
  | 'content_and_clarity'
  | 'visual_and_mobile'
  | 'intent_alignment';

/**
 * Quick Win action item (high-impact, low-effort)
 */
export interface WebsiteQuickWin {
  /** Title of the quick win */
  title: string;

  /** Detailed description */
  description: string;

  /** Expected impact */
  impact: 'high' | 'medium' | 'low';

  /** Required effort */
  effort: 'low' | 'medium' | 'high';

  /** Which UX dimension(s) this improves */
  dimensions: WebsiteUxDimensionKey[];

  /** Timeline estimate (e.g., "1-2 days", "1 week") */
  timeline?: string;
}

/**
 * Strategic Initiative (longer-horizon improvement)
 */
export interface WebsiteStrategicInitiative {
  /** Title of the initiative */
  title: string;

  /** Detailed description */
  description: string;

  /** Expected impact */
  impact: 'high' | 'medium' | 'low';

  /** Required effort */
  effort: 'low' | 'medium' | 'high';

  /** Which UX dimension(s) this improves */
  dimensions: WebsiteUxDimensionKey[];

  /** Time horizon (e.g., "2-4 weeks", "1-2 months") */
  timeHorizon?: string;

  /** Rationale for why this matters */
  rationale?: string;
}

/**
 * Section Analysis for a specific UX dimension (consultant report format)
 */
export interface WebsiteUxSectionAnalysis {
  /** Section title (e.g., "Hero & Value Proposition") */
  title: string;

  /** Dimension key */
  dimension: WebsiteUxDimensionKey;

  /** Score for this dimension (0-100) */
  score?: number;

  /** One-line verdict/diagnosis */
  verdict?: string;

  /** Narrative analysis (2-4 paragraphs) */
  narrative: string;

  /** Key findings (3-5 bullet points) */
  keyFindings: string[];

  /** Quick wins specific to this dimension */
  quickWins: WebsiteQuickWin[];

  /** Deeper initiatives specific to this dimension */
  deeperInitiatives: WebsiteStrategicInitiative[];
}

/**
 * Enhanced Website UX Assessment for V4/V5
 * Extends V3 assessment with multi-page, persona, and funnel insights
 */
export interface WebsiteUXAssessmentV4 extends WebsiteUXAssessmentV3 {
  // ========================================================================
  // V4/V5 ENHANCEMENTS
  // ========================================================================

  /** Page-level scores for each analyzed page */
  pageLevelScores: PageLevelScore[];

  /** Funnel health score (0-100) */
  funnelHealthScore: number;

  /** Multi-page consistency score (0-100) */
  multiPageConsistencyScore: number;

  /** Benchmark label */
  benchmarkLabel?: BenchmarkLabel;

  // ========================================================================
  // CONSULTANT REPORT ENHANCEMENTS (V5)
  // ========================================================================

  /** Executive summary: 2-3 paragraph LLM-generated overview explaining the score and key findings */
  executiveSummary?: string;

  /** Top strengths (3-5 items) */
  strengths?: string[];

  /** Key issues (3-5 items) */
  keyIssues?: string[];

  /** Top 3-5 quick wins (cross-dimensional) */
  quickWins?: WebsiteQuickWin[];

  /** Strategic initiatives (longer-horizon improvements) */
  strategicInitiatives?: WebsiteStrategicInitiative[];

  /** 2-3 most important focus areas */
  focusAreas?: WebsiteUxDimensionKey[];

  /** Expected outcomes by timeline */
  expectedOutcomes?: {
    /** 30-day outcomes */
    thirtyDays?: string[];
    /** 90-day outcomes */
    ninetyDays?: string[];
    /** 6-month outcomes */
    sixMonths?: string[];
  };

  /** Section analyses per UX dimension */
  sectionAnalyses?: WebsiteUxSectionAnalysis[];
}

// ============================================================================
// COMPLETE LAB RESULT
// ============================================================================

/**
 * Complete Website UX Lab Result (V4/V5)
 *
 * This is the flagship data structure that contains:
 * - Site graph (all pages + edges)
 * - Persona simulation results
 * - Heuristic findings
 * - Enhanced site-level assessment
 * - Phase 1 Intelligence Engines (CTA, Content, Trust, Visual, Impact, Scent)
 */
export interface WebsiteUXLabResultV4 {
  /** Site graph with all pages and relationships */
  siteGraph: WebsiteSiteGraphV4;

  /** Persona-based behavioral simulation results */
  personas: WebsiteUXLabPersonaResult[];

  /** Heuristic UX evaluation summary */
  heuristics: HeuristicUxSummary;

  /** Aggregated, upgraded site assessment */
  siteAssessment: WebsiteUXAssessmentV4;

  // ========================================================================
  // PHASE 1: CORE INTELLIGENCE ENGINES (V5.1-5.6)
  // ========================================================================

  /** CTA Intelligence analysis (V5.1) */
  ctaIntelligence?: CtaIntelligence;

  /** Content Intelligence analysis (V5.2) */
  contentIntelligence?: ContentIntelligence;

  /** Trust Signal analysis (V5.3) */
  trustAnalysis?: TrustAnalysis;

  /** Visual + Brand evaluation (V5.4) */
  visualBrandEvaluation?: VisualBrandEvaluation;

  /** Impact Matrix prioritization (V5.5) */
  impactMatrix?: ImpactMatrix;

  /** Scent Trail continuity analysis (V5.6) */
  scentTrailAnalysis?: ScentTrailAnalysis;

  // ========================================================================
  // PHASE 2: STRATEGIST VIEWS + ANALYTICS (V5.7-5.12)
  // ========================================================================

  /** Strategist views (conversion, copywriting, general) (V5.8, V5.9) */
  strategistViews?: StrategistViews;

  /** Analytics integrations (GA4, Search Console, Heatmap) (V5.10-5.12) */
  analyticsIntegrations?: AnalyticsIntegrations;

  // ========================================================================
  // PHASE 3: GRADE HISTORY (V5.13)
  // ========================================================================

  /** Historical grade tracking (V5.13) */
  gradeHistory?: GradeHistoryEntry[];
}

// ============================================================================
// GRADE HISTORY TRACKING (V5.13)
// ============================================================================

/**
 * Individual grade history entry
 */
export interface GradeHistoryEntry {
  /** Timestamp of this run */
  timestamp: string;

  /** Overall UX score at this time */
  score: number;

  /** Benchmark label (e.g., "good", "excellent") */
  benchmarkLabel: string;

  /** Key metrics at this point in time */
  metrics: {
    funnelHealth?: number;
    multiPageConsistency?: number;
    ctaQuality?: number;
    contentClarity?: number;
    trustScore?: number;
    visualScore?: number;
  };

  /** What changed since last run */
  changesSinceLast?: string[];
}

// ============================================================================
// AI REWRITE MODE (V5.14)
// ============================================================================

/**
 * AI Rewrite request
 */
export interface RewriteRequest {
  /** Type of rewrite */
  rewriteType: 'hero' | 'valueProp' | 'cta' | 'servicePage' | 'full_page';

  /** Current content */
  currentContent: string;

  /** Target audience / ICP */
  targetAudience?: string;

  /** Desired tone */
  tone?: 'direct' | 'conversational' | 'premium' | 'technical';
}

/**
 * AI Rewrite response
 */
export interface RewriteResponse {
  /** Original content */
  original: string;

  /** Rewrite variations */
  variations: Array<{
    style: 'direct' | 'conversational' | 'premium';
    content: string;
    rationale: string;
  }>;
}

// ============================================================================
// WIREFRAME GENERATOR (V5.15)
// ============================================================================

/**
 * Wireframe generation request
 */
export interface WireframeRequest {
  /** Page type */
  pageType: 'home' | 'pricing' | 'service' | 'about' | 'contact' | 'landing';

  /** Target ICP */
  targetICP?: string;

  /** Key conversion goal */
  conversionGoal?: string;

  /** Include sections */
  sections?: string[];
}

/**
 * Wireframe response (text-based layout)
 */
export interface WireframeResponse {
  /** Page type */
  pageType: string;

  /** Text-based wireframe */
  wireframe: string;

  /** Section breakdown */
  sections: Array<{
    name: string;
    purpose: string;
    elements: string[];
    copyGuidance: string;
  }>;

  /** Hierarchy notes */
  hierarchyNotes: string[];
}

// ============================================================================
// SCREENSHOT ABSTRACTION (V4.1)
// ============================================================================

/**
 * Screenshot capture result
 */
export interface WebsiteScreenshot {
  /** Page path */
  path: string;

  /** Viewport type */
  viewport: 'desktop' | 'mobile';

  /** Image URL or reference */
  imageUrl: string;
}

/**
 * Screenshot set for a page (desktop + mobile)
 */
export interface WebsiteScreenshotSet {
  /** Page path */
  pagePath: string;

  /** Desktop screenshot */
  desktop?: WebsiteScreenshot;

  /** Mobile screenshot */
  mobile?: WebsiteScreenshot;
}

// ============================================================================
// WEBSITE LAB ENGINE INTERFACE
// ============================================================================

/**
 * Main entry point for Website Diagnostics V4/V5
 *
 * This is the single orchestrator that V4/V5 features plug into.
 */
export interface WebsiteDiagnosticsEngine {
  /**
   * Run complete Website Lab analysis
   *
   * @param websiteUrl - Homepage URL to start from
   * @returns Complete lab result with multi-page analysis
   */
  runWebsiteLab(websiteUrl: string): Promise<WebsiteUXLabResultV4>;

  /**
   * Discover key pages from homepage
   *
   * @param websiteUrl - Homepage URL
   * @returns Array of page snapshots (HTML + metadata)
   */
  discoverPages(websiteUrl: string): Promise<WebsitePageSnapshot[]>;

  /**
   * Extract evidence from a single page
   *
   * @param snapshot - Page snapshot with HTML
   * @returns Page evidence with V3 + V4 enhancements
   */
  extractPageEvidence(snapshot: WebsitePageSnapshot): Promise<WebsitePageEvidenceV4>;

  /**
   * Build site graph from page evidences
   *
   * @param pages - All page evidences
   * @returns Site graph with edges
   */
  buildSiteGraph(pages: WebsitePageEvidenceV4[]): WebsiteSiteGraphV4;

  /**
   * Capture screenshots for pages
   *
   * @param pages - Page snapshots to screenshot
   * @returns Screenshot sets (desktop + mobile)
   */
  captureScreenshots(pages: WebsitePageSnapshot[]): Promise<WebsiteScreenshotSet[]>;

  /**
   * Analyze screenshots with vision LLM
   *
   * @param screenshotSets - Screenshot sets to analyze
   * @returns Vision analysis results per page
   */
  analyzeVision(screenshotSets: WebsiteScreenshotSet[]): Promise<Map<string, PageVisionAnalysis>>;

  /**
   * Map conversion funnels and detect dead ends
   *
   * @param siteGraph - Site graph
   * @returns Funnel health score + dead end report
   */
  mapConversionFunnels(siteGraph: WebsiteSiteGraphV4): {
    funnelHealthScore: number;
    deadEnds: string[];
    funnelPaths: string[][];
  };

  /**
   * Classify intent for each page
   *
   * @param pages - Page evidences
   * @returns Intent classifications per page
   */
  classifyPageIntents(pages: WebsitePageEvidenceV4[]): Promise<Map<string, PageIntentAnalysis>>;

  /**
   * Run heuristic UX evaluation
   *
   * @param siteGraph - Site graph
   * @returns Heuristic findings and score
   */
  evaluateHeuristics(siteGraph: WebsiteSiteGraphV4): HeuristicUxSummary;

  /**
   * Simulate persona behaviors
   *
   * @param siteGraph - Site graph
   * @returns Persona simulation results
   */
  simulatePersonas(siteGraph: WebsiteSiteGraphV4): Promise<WebsiteUXLabPersonaResult[]>;

  /**
   * Generate final site assessment
   *
   * @param siteGraph - Site graph
   * @param personas - Persona results
   * @param heuristics - Heuristic summary
   * @returns Complete V4 assessment
   */
  generateSiteAssessment(
    siteGraph: WebsiteSiteGraphV4,
    personas: WebsiteUXLabPersonaResult[],
    heuristics: HeuristicUxSummary
  ): Promise<WebsiteUXAssessmentV4>;
}
