/**
 * Analysis Progress Model
 * 
 * Defines the multi-step analysis lifecycle for Growth Acceleration Plan (GAP) generation.
 * This model is shared between API routes and React components to provide
 * consistent progress tracking and user feedback.
 * 
 * Pure TypeScript - no React dependencies.
 */

/**
 * Analysis Step Identifiers
 * 
 * Represents each stage of the Growth Acceleration Plan (GAP) analysis pipeline.
 */
export type AnalysisStepId =
  | "init"
  | "crawl"
  | "extractFeatures"
  | "scoreWebsite"
  | "scoreContent"
  | "scoreSEO"
  | "scoreBrand"
  | "scoreAuthority"
  | "assemblePlan"
  | "finalize";

/**
 * Analysis Step Definition
 * 
 * Contains metadata for a single step in the analysis pipeline.
 */
export interface AnalysisStep {
  /** Unique identifier for this step */
  id: AnalysisStepId;
  
  /** Full label for display in UI (e.g., "Evaluating Website & Conversion") */
  label: string;
  
  /** Short label for compact UI (e.g., "Website") */
  shortLabel: string;
  
  /** Detailed explanation of what's happening during this step */
  description: string;
  
  /** Minimum target display time for this step in seconds */
  estimatedSeconds: number;
  
  /** Optional bullet points providing more detail about what's happening */
  details?: string[];
}

/**
 * All Analysis Steps
 * 
 * Ordered array of all steps in the Growth Acceleration Plan (GAP) analysis pipeline.
 * The order defines the sequence of execution.
 */
export const ANALYSIS_STEPS: AnalysisStep[] = [
  {
    id: "init",
    label: "Preparing analysis",
    shortLabel: "Init",
    description:
      "Validating the URL, loading configuration, and preparing the analysis pipeline for this website.",
    estimatedSeconds: 10,
    details: [
      "Validate URL format and normalize domain.",
      "Load Hive Growth Acceleration Plan (GAP) configuration.",
      "Set up internal job ID and logging context.",
    ],
  },
  {
    id: "crawl",
    label: "Crawling key pages",
    shortLabel: "Crawl",
    description:
      "Fetching the homepage and key linked pages to build a snapshot of your site's navigation, layout, and content structure.",
    estimatedSeconds: 45,
    details: [
      "Request homepage HTML and critical navigation links.",
      "Capture primary navigation labels and top-level information architecture.",
      "Identify key page types: product, solutions, pricing, resources, contact.",
    ],
  },
  {
    id: "extractFeatures",
    label: "Extracting site signals",
    shortLabel: "Signals",
    description:
      "Parsing HTML to detect calls-to-action, trust signals, content types, navigation patterns, and SEO metadata that will inform the scorecard.",
    estimatedSeconds: 45,
    details: [
      "Detect CTAs, forms, and conversion entry points.",
      "Identify social proof: testimonials, case studies, customer logos.",
      "Extract SEO metadata, headings, internal links, and content blocks.",
    ],
  },
  {
    id: "scoreWebsite",
    label: "Evaluating Website & Conversion",
    shortLabel: "Website",
    description:
      "Grading how effectively the site turns visitors into leads, including CTA visibility, page hierarchy, conversion paths, and friction points.",
    estimatedSeconds: 35,
    details: [
      "Score hero clarity, CTA placement, and scroll path.",
      "Evaluate conversion paths and friction (forms, navigation, messaging).",
      "Identify primary UX blockers and quick conversion wins.",
    ],
  },
  {
    id: "scoreContent",
    label: "Evaluating Content & Engagement",
    shortLabel: "Content",
    description:
      "Assessing depth and coverage of content across the funnel, including blogs, resources, case studies, and how well they support your core offer.",
    estimatedSeconds: 40,
    details: [
      "Score content depth across awareness, consideration, and decision stages.",
      "Check for presence of blogs, resources, and case studies.",
      "Identify missing topics and content gaps versus typical buyer journey.",
    ],
  },
  {
    id: "scoreSEO",
    label: "Evaluating SEO & Visibility",
    shortLabel: "SEO",
    description:
      "Checking on-page SEO fundamentals, internal linking, performance indicators, and the presence of pages that support discoverability.",
    estimatedSeconds: 40,
    details: [
      "Review basic technical and on-page SEO signals.",
      "Evaluate internal linking patterns and navigation depth.",
      "Identify opportunities for search-driven landing pages.",
    ],
  },
  {
    id: "scoreBrand",
    label: "Evaluating Brand & Positioning",
    shortLabel: "Brand",
    description:
      "Reviewing the clarity of your value proposition, ideal customer definition, differentiation vs. competitors, and consistency of visual identity.",
    estimatedSeconds: 40,
    details: [
      "Evaluate value proposition clarity in the hero and key pages.",
      "Assess ICP clarity and how well messaging speaks to that ICP.",
      "Review visual consistency and overall brand system signals.",
    ],
  },
  {
    id: "scoreAuthority",
    label: "Evaluating Authority & Trust",
    shortLabel: "Authority",
    description:
      "Detecting testimonials, case studies, customer logos, reviews, and other proof points that signal credibility and reduce buyer risk.",
    estimatedSeconds: 35,
    details: [
      "Score presence and strength of case studies and customer stories.",
      "Review testimonials, review platform badges, and press logos.",
      "Identify opportunities to surface proof more prominently.",
    ],
  },
  {
    id: "assemblePlan",
    label: "Assembling Growth Acceleration Plan (GAP)",
    shortLabel: "Plan",
    description:
      "Synthesizing all scores and signals into an executive summary, prioritized quick wins, strategic initiatives, and a time-phased roadmap.",
    estimatedSeconds: 35,
    details: [
      "Align website, content, SEO, brand, and authority scores.",
      "Prioritize quick wins and strategic initiatives by impact and effort.",
      "Organize recommendations into a 30/60/90+ day roadmap.",
    ],
  },
  {
    id: "finalize",
    label: "Finalizing report",
    shortLabel: "Finalize",
    description:
      "Polishing the narrative, cross-checking scores, and preparing the visual report for review and export.",
    estimatedSeconds: 20,
    details: [
      "Finalize executive summary and section narratives.",
      "Cross-check consistency between scores and written analysis.",
      "Prepare the report layout for on-screen review and export.",
    ],
  },
];

/**
 * Get Analysis Progress Percent
 * 
 * Computes the percentage complete based on the current step ID.
 * 
 * @param currentId - The ID of the current step
 * @returns Percentage complete (0-100)
 * 
 * @example
 * ```ts
 * getAnalysisProgressPercent("scoreWebsite") // Returns 40 (4th step out of 10)
 * getAnalysisProgressPercent("finalize") // Returns 100
 * ```
 */
export function getAnalysisProgressPercent(currentId: AnalysisStepId): number {
  const index = ANALYSIS_STEPS.findIndex((s) => s.id === currentId);
  if (index === -1) return 0;
  
  const total = ANALYSIS_STEPS.length;
  return Math.round(((index + 1) / total) * 100);
}

/**
 * Get Analysis Step by ID
 * 
 * Helper to retrieve a step definition by its ID.
 * 
 * @param id - The step ID to look up
 * @returns The AnalysisStep object, or undefined if not found
 */
export function getAnalysisStep(id: AnalysisStepId): AnalysisStep | undefined {
  return ANALYSIS_STEPS.find((s) => s.id === id);
}

/**
 * Get Next Analysis Step
 * 
 * Returns the step that comes after the given step ID.
 * 
 * @param currentId - The current step ID
 * @returns The next AnalysisStep, or undefined if current is the last step
 */
export function getNextAnalysisStep(currentId: AnalysisStepId): AnalysisStep | undefined {
  const index = ANALYSIS_STEPS.findIndex((s) => s.id === currentId);
  if (index === -1 || index >= ANALYSIS_STEPS.length - 1) return undefined;
  
  return ANALYSIS_STEPS[index + 1];
}

/**
 * Get Previous Analysis Step
 * 
 * Returns the step that comes before the given step ID.
 * 
 * @param currentId - The current step ID
 * @returns The previous AnalysisStep, or undefined if current is the first step
 */
export function getPreviousAnalysisStep(currentId: AnalysisStepId): AnalysisStep | undefined {
  const index = ANALYSIS_STEPS.findIndex((s) => s.id === currentId);
  if (index <= 0) return undefined;
  
  return ANALYSIS_STEPS[index - 1];
}

/**
 * Check if Analysis Step is Complete
 * 
 * Determines if a given step has been completed based on the current step.
 * 
 * @param stepId - The step ID to check
 * @param currentId - The current step ID
 * @returns true if the step is complete, false otherwise
 */
export function isAnalysisStepComplete(stepId: AnalysisStepId, currentId: AnalysisStepId): boolean {
  const stepIndex = ANALYSIS_STEPS.findIndex((s) => s.id === stepId);
  const currentIndex = ANALYSIS_STEPS.findIndex((s) => s.id === currentId);
  
  if (stepIndex === -1 || currentIndex === -1) return false;
  
  return stepIndex < currentIndex;
}

/**
 * Check if Analysis Step is Active
 * 
 * Determines if a given step is currently being executed.
 * 
 * @param stepId - The step ID to check
 * @param currentId - The current step ID
 * @returns true if the step is active, false otherwise
 */
export function isAnalysisStepActive(stepId: AnalysisStepId, currentId: AnalysisStepId): boolean {
  return stepId === currentId;
}

