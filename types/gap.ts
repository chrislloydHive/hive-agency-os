/**
 * GAP (Growth Acceleration Plan) Run Types
 * 
 * Defines the step-based workflow for generating GAP plans
 */

import type { AssessmentResult } from '@/lib/unified-assessment';
import type {
  GrowthAccelerationPlan,
  QuickWin,
  StrategicInitiative,
  Scorecard,
  ExecutiveSummary,
  SectionAnalysis,
  CompetitorAnalysis,
  MarketAnalysis,
  PositioningAnalysis,
  DataAvailability,
} from '@/lib/growth-plan/types';
import type { SiteFeatures } from '@/lib/eval/siteFeatures';
import type { SiteElementContext } from '@/lib/growth-plan/html-context';
import type { ContentInventory } from '@/lib/growth-plan/analyzeContentInventory';
import type { TechnicalSeoSignals } from '@/lib/growth-plan/types';

export type GapRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type GapRunStep =
  | 'init'
  | 'assessment'
  | 'fetch_html'
  | 'extract_features'
  | 'discover_pages'
  | 'fetch_extra_pages'
  | 'content_inventory'
  | 'technical_seo'
  | 'section_website'
  | 'section_seo'
  | 'section_content'
  | 'section_brand'
  | 'quick_wins'
  | 'strategic_initiatives'
  | 'scoring'
  | 'executive_summary'
  | 'assemble_plan'
  | 'done';

export interface GapRunState {
  // Identity
  runId: string;
  planId: string;
  url: string;
  competitors: string[];
  status: GapRunStatus;
  step: GapRunStep; // Current step (required, use 'init' as default)
  currentStep: GapRunStep | null; // Legacy alias for step
  completedSteps: GapRunStep[];
  createdAt: string;
  updatedAt: string;
  error?: string | null;
  
  // Live teaser line for the loader
  currentFinding?: string;
  
  // Metadata
  companyName?: string;
  
  // Options
  options?: {
    snapshotId?: string;
    email?: string;
    preferences?: {
      focusAreas?: string[];
      timeHorizon?: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
      resourceConstraints?: string;
    };
    enableDebug?: boolean;
    onProgress?: (finding: string, progress?: number, stage?: string) => void | Promise<void>;
  };

  // Step 1: Assessment
  assessment?: AssessmentResult | null;
  assessmentError?: Error | null;

  // Step 1.5: HTML fetch
  htmlByUrl?: Record<string, string>;
  attemptedUrls?: string[];
  successfulUrls?: string[];
  failedUrls?: string[];

  // Step 0: Features
  features?: SiteFeatures | null;

  // Step: Discover pages
  discoveredPages?: string[];

  // Step: Site element context
  siteElementContext?: SiteElementContext;
  competitorContexts?: SiteElementContext[];

  // Step: Content inventory
  contentInventory?: ContentInventory;

  // Step: Technical SEO
  technicalSeoSignals?: TechnicalSeoSignals;

  // Step: Data availability
  dataAvailability?: DataAvailability;

  // Step: Section analyses
  websiteSectionAnalysis?: SectionAnalysis;
  seoSectionAnalysis?: SectionAnalysis;
  contentSectionAnalysis?: SectionAnalysis;
  brandSectionAnalysis?: SectionAnalysis;
  websiteConversionAnalysis?: any; // WebsiteConversionAnalysis type

  // Step: Competitor/Market/Positioning
  competitorAnalysis?: CompetitorAnalysis;
  marketAnalysis?: MarketAnalysis;
  positioningAnalysis?: PositioningAnalysis;

  // Step: Quick wins
  quickWins?: QuickWin[];

  // Step: Strategic initiatives
  strategicInitiatives?: StrategicInitiative[];

  // Step: Scoring
  scorecard?: Scorecard;
  detectedMaturity?: string;

  // Step: Executive summary
  executiveSummary?: ExecutiveSummary;

  // Step: Final plan
  gapId?: string;
  plan?: GrowthAccelerationPlan;
  
  // Legacy fields for backward compatibility
  websiteUrl?: string; // Alias for url
  crawlResultId?: string;
  websiteAssessmentId?: string;
  contentAssessmentId?: string;
  seoAssessmentId?: string;
  brandAssessmentId?: string;
}

/**
 * Assessment result status
 */
export type AssessmentStatus = 'ok' | 'partial';

/**
 * Website assessment result
 */
export interface WebsiteAssessmentResult {
  id: string;
  status: AssessmentStatus;
  reason?: string; // e.g., 'timeout'
  data: any | null; // Full assessment data if status === 'ok', null if partial
  createdAt: string;
}

/**
 * Content assessment result
 */
export interface ContentAssessmentResult {
  id: string;
  status: AssessmentStatus;
  reason?: string;
  data: any | null;
  createdAt: string;
}

/**
 * SEO assessment result
 */
export interface SeoAssessmentResult {
  id: string;
  status: AssessmentStatus;
  reason?: string;
  data: any | null;
  createdAt: string;
}

/**
 * Brand assessment result
 */
export interface BrandAssessmentResult {
  id: string;
  status: AssessmentStatus;
  reason?: string;
  data: any | null;
  createdAt: string;
}

