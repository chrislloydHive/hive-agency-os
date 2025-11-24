// lib/diagnostics/types.ts
// Central type definitions for OS Diagnostics (v2 schema with JSON fields)

// ============================================================================
// Base Types
// ============================================================================

export type Pillar = 'brand' | 'content' | 'seo' | 'websiteUx' | 'funnel';

export type Severity = 'low' | 'medium' | 'high';
export type Impact = 'low' | 'medium' | 'high';
export type Effort = 'low' | 'medium' | 'high';

// ============================================================================
// Issues
// ============================================================================

/**
 * A single diagnostic issue found in a pillar
 */
export type Issue = {
  id: string;
  title: string;
  description: string;
  pillar: Pillar;
  severity: Severity;
};

// ============================================================================
// Priorities
// ============================================================================

/**
 * A prioritized action item (may span multiple pillars)
 */
export type Priority = {
  id: string;
  title: string;
  description?: string;
  pillar: Pillar | 'multi'; // Single pillar or cross-pillar
  impact: Impact;
  effort: Effort;
  rationale: string;
};

// ============================================================================
// Pillar Scores
// ============================================================================

/**
 * Score + metadata for a single pillar
 */
export type PillarScore = {
  pillar: Pillar;
  score: number; // 1-10
  justification: string;
  issues?: Issue[]; // Optional: issues specific to this pillar
};

// ============================================================================
// Growth Plan
// ============================================================================

/**
 * Strategic growth recommendations
 * Uses PlanPayload format from lib/gap/types.ts
 */
export type GrowthPlan = import('@/lib/gap/types').PlanPayload;

// Legacy types for backward compatibility
export type QuickWin = {
  id: string;
  title: string;
  description: string;
  pillar?: Pillar;
  estimatedImpact?: Impact;
  estimatedEffort?: Effort;
};

export type StrategicInitiative = {
  id: string;
  title: string;
  description: string;
  pillar?: Pillar | 'multi';
  timeline?: string; // e.g. "3-6 months"
  expectedOutcome?: string;
};

// ============================================================================
// Evidence
// ============================================================================

/**
 * All evidence collected during diagnostics (snapshots, raw data, etc.)
 */
export type Evidence = {
  websiteUx?: WebsiteUxEvidence;
  brand?: BrandEvidence;
  content?: ContentEvidence;
  seo?: SeoEvidence;
  funnel?: FunnelEvidence;
  [key: string]: any; // Allow for additional evidence types
};

// Pillar-specific evidence types
export type WebsiteUxEvidence = {
  url: string;
  structure: {
    title?: string;
    metaDescription?: string;
    h1?: string;
    heroText?: string;
    primaryCtaAboveFold: boolean;
    hasContactForm: boolean;
  };
  speed: {
    performanceScore?: number;
    lcp?: number; // Largest Contentful Paint
    cls?: number; // Cumulative Layout Shift
    inp?: number; // Interaction to Next Paint
  };
};

export type BrandEvidence = {
  url: string;
  visual: {
    hasLogo: boolean;
    logoLocation?: 'header' | 'footer' | 'other' | null;
    logoAltText?: string;
    hasFavicon: boolean;
    primaryColors?: string[]; // Extracted from CSS or images
    hasConsistentStyling: boolean;
  };
  messaging: {
    tagline?: string; // Short phrase near logo or hero
    heroHeadline?: string; // Main H1
    heroValueProp?: string; // H1 + first paragraph
    hasAboutPage: boolean;
    hasTestimonials: boolean;
    hasCaseStudies: boolean;
    hasClientLogos: boolean;
  };
  credibility: {
    hasSocialProof: boolean; // "Trusted by", testimonials, etc.
    hasContactInfo: boolean;
    hasTeamPage: boolean;
    certifications?: string[]; // Text mentions of certifications, awards
    pressmentions?: boolean;
  };
  tone: {
    // Optional AI-derived characterization
    perceivedTone?: 'professional' | 'casual' | 'technical' | 'friendly' | 'mixed';
    confidenceLevel?: 'low' | 'medium' | 'high';
  };
};

export type ContentEvidence = {
  // Placeholder for future content diagnostic evidence
  [key: string]: any;
};

export type SeoEvidence = {
  // Placeholder for future SEO diagnostic evidence
  [key: string]: any;
};

export type FunnelEvidence = {
  // Placeholder for future funnel diagnostic evidence
  [key: string]: any;
};

// ============================================================================
// Full OS Diagnostic Result
// ============================================================================

/**
 * Complete OS diagnostic output for a single run
 * This is the canonical type used across the entire OS pipeline
 */
export type OsDiagnosticResult = {
  /** Overall score across all pillars (1-10) */
  overallScore: number;

  /** Per-pillar scores and justifications */
  pillarScores: PillarScore[];

  /** All prioritized action items */
  priorities: Priority[];

  /** Growth plan (quick wins + strategic initiatives) */
  plan: GrowthPlan;

  /** All evidence collected (snapshots, raw data) */
  evidence: Evidence;

  /** Schema version for future compatibility */
  schemaVersion: string; // e.g. "v1"

  /** Optional metadata */
  metadata?: {
    runDate?: string;
    companyId?: string;
    snapshotId?: string;
    gapRunId?: string;
  };
};

// ============================================================================
// Helper Types for Scores Object
// ============================================================================

/**
 * Structured scores object for Scores JSON field
 */
export type ScoresJson = {
  overallScore: number;
  pillarScores: PillarScore[];
};

/**
 * Structured diagnostics object for Diagnostics JSON field
 */
export type DiagnosticsJson = {
  issuesByPillar: Record<Pillar, Issue[]>;
  summary?: string;
  commentary?: string;
};

// ============================================================================
// Backwards Compatibility Types (for migration)
// ============================================================================

/**
 * Legacy Website/UX types (to be phased out)
 * Kept for backwards compatibility during migration
 */
export type WebsiteUxIssue = {
  id: string;
  title: string;
  description: string;
  severity: Severity;
};

export type WebsiteUxPriority = {
  id: string;
  title: string;
  impact: Impact;
  effort: Effort;
  rationale: string;
};

export type WebsiteUxDiagnostic = {
  score: number;
  justification: string;
  issues: WebsiteUxIssue[];
  priorities: WebsiteUxPriority[];
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert legacy WebsiteUxDiagnostic to new OsDiagnosticResult format
 */
export function websiteUxDiagnosticToOsResult(
  diagnostic: WebsiteUxDiagnostic,
  evidence: WebsiteUxEvidence,
  metadata?: OsDiagnosticResult['metadata']
): OsDiagnosticResult {
  // Convert issues to new format
  const issues: Issue[] = diagnostic.issues.map((issue) => ({
    ...issue,
    pillar: 'websiteUx' as Pillar,
  }));

  // Convert priorities to new format
  const priorities: Priority[] = diagnostic.priorities.map((priority) => ({
    ...priority,
    pillar: 'websiteUx' as Pillar,
    description: priority.rationale, // Map rationale to description
  }));

  // Create pillar score
  const pillarScores: PillarScore[] = [
    {
      pillar: 'websiteUx',
      score: diagnostic.score,
      justification: diagnostic.justification,
      issues,
    },
  ];

  // Create basic growth plan from priorities
  const plan: GrowthPlan = {
    quickWins: priorities
      .filter((p) => p.effort === 'low' && p.impact !== 'low')
      .slice(0, 3)
      .map((p, idx) => ({
        id: `qw-${idx + 1}`,
        title: p.title,
        description: p.description || p.rationale,
        pillar: p.pillar as Pillar,
        estimatedImpact: p.impact,
        estimatedEffort: p.effort,
      })),
    strategicInitiatives: priorities
      .filter((p) => p.effort !== 'low' || p.impact === 'high')
      .slice(0, 3)
      .map((p, idx) => ({
        id: `si-${idx + 1}`,
        title: p.title,
        description: p.description || p.rationale,
        pillar: p.pillar as Pillar,
      })),
    recommendedFocusAreas: ['Website/UX'],
  };

  return {
    overallScore: diagnostic.score,
    pillarScores,
    priorities,
    plan,
    evidence: {
      websiteUx: evidence,
    },
    schemaVersion: 'v1',
    metadata,
  };
}

/**
 * Get a pillar score by pillar name
 */
export function getPillarScore(
  result: OsDiagnosticResult,
  pillar: Pillar
): number | null {
  const pillarScore = result.pillarScores.find((ps) => ps.pillar === pillar);
  return pillarScore?.score ?? null;
}

/**
 * Get issues for a specific pillar
 */
export function getIssuesForPillar(
  result: OsDiagnosticResult,
  pillar: Pillar
): Issue[] {
  const pillarScore = result.pillarScores.find((ps) => ps.pillar === pillar);
  return pillarScore?.issues ?? [];
}

// ============================================================================
// DIAGNOSTIC ACTION BOARD TYPES (Action-First UI)
// ============================================================================

/**
 * Generic Diagnostic Action Board Types
 *
 * These types define a reusable, diagnostic-agnostic Action Board system
 * that works across Website, SEO, Brand, Content, and other diagnostics.
 *
 * Core Principle:
 * - Action-first (not report-first)
 * - Evidence-based with clear rationale
 * - Prioritization via impact/effort matrix
 * - Playbook grouping for related actions
 */

import { z } from 'zod';

// Service Areas (extends existing Pillar concept)
export const ServiceAreaSchema = z.enum([
  'brand',
  'content',
  'website',
  'seo',
  'authority',
  'analytics',
  'cross_cutting',
]);

export type ServiceArea = z.infer<typeof ServiceAreaSchema>;

// Priority Buckets (Time Horizons)
export const ActionBucketSchema = z.enum(['now', 'next', 'later']);
export type ActionBucket = z.infer<typeof ActionBucketSchema>;

// Generic Diagnostic Dimension
export const DiagnosticDimensionSchema = z.string();
export type DiagnosticDimension = z.infer<typeof DiagnosticDimensionSchema>;

// ============================================================================
// DIAGNOSTIC ACTION (Core Action Unit)
// ============================================================================

/**
 * A single actionable item synthesized from diagnostic analysis.
 * This is the atomic unit displayed in the Action Board.
 */
export const DiagnosticActionSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Concise, action-oriented title */
  title: z.string(),

  /** Detailed description of what to do */
  description: z.string(),

  /** Why this matters (rationale/evidence) */
  rationale: z.string(),

  /** Which diagnostic dimension this improves */
  dimension: DiagnosticDimensionSchema,

  /** Which Hive service area owns this */
  serviceArea: ServiceAreaSchema,

  /** Impact score (1-5, higher = bigger impact) */
  impactScore: z.number().min(1).max(5),

  /** Effort score (1-5, higher = more effort) */
  effortScore: z.number().min(1).max(5),

  /** Estimated conversion/metric lift (percentage) */
  estimatedLift: z.number().optional(),

  /** Priority bucket (when to do this) */
  bucket: ActionBucketSchema,

  /** Tags for filtering (e.g., "cta", "trust", "pricing") */
  tags: z.array(z.string()).optional(),

  /** Related personas (if applicable) */
  personas: z.array(z.string()).optional(),

  /** Related pages/URLs (if applicable) */
  pages: z.array(z.string()).optional(),

  /** Evidence references (links back to diagnostic data) */
  evidenceRefs: z.array(
    z.object({
      type: z.string(), // e.g., "issue", "persona", "heuristic", "keyword"
      id: z.string(),
      description: z.string().optional(),
    })
  ).optional(),

  /** Playbook grouping (e.g., "CTA Overhaul", "Trust Signals") */
  playbook: z.string().optional(),

  /** Recommended assignee role */
  recommendedRole: z.string().optional(),

  /** Recommended timebox (e.g., "1-3 days", "1 week") */
  recommendedTimebox: z.string().optional(),

  /** Current status (for Work queue integration) */
  status: z.enum(['backlog', 'planned', 'in_progress', 'done']).default('backlog'),
});

export type DiagnosticAction = z.infer<typeof DiagnosticActionSchema>;

// ============================================================================
// DIAGNOSTIC THEME (Grouping Mechanism)
// ============================================================================

/**
 * A thematic grouping of related actions.
 */
export const DiagnosticThemeSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Theme label (e.g., "Trust Signals", "Technical SEO") */
  label: z.string(),

  /** Description of the theme */
  description: z.string(),

  /** Priority level */
  priority: z.enum(['critical', 'important', 'nice_to_have']),

  /** Linked dimensions */
  linkedDimensions: z.array(DiagnosticDimensionSchema).optional(),

  /** Linked personas */
  linkedPersonas: z.array(z.string()).optional(),

  /** Linked pages */
  linkedPages: z.array(z.string()).optional(),

  /** Expected impact summary */
  expectedImpactSummary: z.string().optional(),

  /** Icon/visual identifier (optional) */
  icon: z.string().optional(),
});

export type DiagnosticTheme = z.infer<typeof DiagnosticThemeSchema>;

// ============================================================================
// EXPERIMENT IDEA (A/B Test Recommendation)
// ============================================================================

/**
 * A proposed experiment/test to validate hypotheses.
 */
export const ExperimentIdeaSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Hypothesis statement */
  hypothesis: z.string(),

  /** Test description */
  description: z.string(),

  /** Success metric */
  metric: z.string(),

  /** Pages/areas to test on */
  scope: z.array(z.string()).optional(),

  /** Expected lift (percentage) */
  expectedLift: z.number().optional(),

  /** Effort score (1-5) */
  effortScore: z.number().min(1).max(5),

  /** Related service area */
  serviceArea: ServiceAreaSchema.optional(),
});

export type ExperimentIdea = z.infer<typeof ExperimentIdeaSchema>;

// ============================================================================
// STRATEGIC PROJECT (Broader Strategic Recommendation)
// ============================================================================

/**
 * A strategic project recommendation (not a tactical action).
 */
export const StrategicProjectSchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Title of the strategic project */
  title: z.string(),

  /** Detailed description */
  description: z.string(),

  /** Reasoning/rationale */
  reasoning: z.string(),

  /** Expected impact */
  expectedImpact: z.string().optional(),

  /** Time horizon (e.g., "2-3 months", "Q2 2024") */
  timeHorizon: z.string().optional(),

  /** Linked findings (evidence refs) */
  linkedFindings: z.array(z.string()).optional(),

  /** Related service areas */
  serviceAreas: z.array(ServiceAreaSchema).optional(),
});

export type StrategicProject = z.infer<typeof StrategicProjectSchema>;

// ============================================================================
// DIAGNOSTIC ACTION BOARD (Top-Level Structure)
// ============================================================================

/**
 * The complete action-first diagnostic output.
 * This is what the Action Board UI renders.
 */
export const DiagnosticActionBoardSchema = z.object({
  /** Diagnostic type (e.g., "website", "seo", "brand") */
  diagnosticType: z.string(),

  /** Company ID */
  companyId: z.string(),

  /** Company name */
  companyName: z.string().optional(),

  /** Target URL (if applicable) */
  targetUrl: z.string().optional(),

  /** Overall diagnostic score (0-100) */
  overallScore: z.number().min(0).max(100),

  /** Grade label (e.g., "elite", "strong", "average", "weak") */
  gradeLabel: z.string().optional(),

  /** Short, action-focused summary (2-3 paragraphs) */
  summary: z.string(),

  /** Key themes identified */
  themes: z.array(DiagnosticThemeSchema),

  /** NOW bucket: do these immediately (0-30 days) */
  now: z.array(DiagnosticActionSchema),

  /** NEXT bucket: do these soon (30-90 days) */
  next: z.array(DiagnosticActionSchema),

  /** LATER bucket: do these eventually (90+ days) */
  later: z.array(DiagnosticActionSchema),

  /** Proposed experiments/tests */
  experiments: z.array(ExperimentIdeaSchema).optional(),

  /** Strategic projects recommended */
  strategicProjects: z.array(StrategicProjectSchema).optional(),

  /** Available filter options */
  filterOptions: z.object({
    /** All tags present across actions */
    tags: z.array(z.string()),
    /** All personas present across actions */
    personas: z.array(z.string()),
    /** All service areas present */
    serviceAreas: z.array(ServiceAreaSchema),
    /** All playbooks present */
    playbooks: z.array(z.string()),
  }).optional(),

  /** Metadata */
  metadata: z.object({
    /** When this diagnostic was run */
    runDate: z.string(),
    /** Diagnostic run ID (for linking to full report) */
    runId: z.string().optional(),
    /** Pages analyzed (count) */
    pagesAnalyzed: z.number().optional(),
    /** Any other diagnostic-specific metadata */
    custom: z.record(z.string(), z.any()).optional(),
  }).optional(),
});

export type DiagnosticActionBoard = z.infer<typeof DiagnosticActionBoardSchema>;

// ============================================================================
// FILTERING & GROUPING HELPERS
// ============================================================================

/**
 * Filter criteria for actions
 */
export type ActionFilters = {
  serviceArea?: ServiceArea;
  dimension?: DiagnosticDimension;
  persona?: string;
  page?: string;
  tags?: string[];
  bucket?: ActionBucket;
  playbook?: string;
  search?: string;
};

/**
 * Filter actions by criteria
 */
export function filterActions(
  actions: DiagnosticAction[],
  filters: ActionFilters
): DiagnosticAction[] {
  return actions.filter((action) => {
    if (filters.serviceArea && action.serviceArea !== filters.serviceArea) {
      return false;
    }
    if (filters.dimension && action.dimension !== filters.dimension) {
      return false;
    }
    if (filters.bucket && action.bucket !== filters.bucket) {
      return false;
    }
    if (filters.playbook && action.playbook !== filters.playbook) {
      return false;
    }
    if (filters.persona) {
      const personas = action.personas || [];
      if (!personas.includes(filters.persona)) {
        return false;
      }
    }
    if (filters.page) {
      const pages = action.pages || [];
      if (!pages.includes(filters.page)) {
        return false;
      }
    }
    if (filters.tags && filters.tags.length > 0) {
      const actionTags = action.tags || [];
      if (!filters.tags.some((tag) => actionTags.includes(tag))) {
        return false;
      }
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchableText = `${action.title} ${action.description} ${action.rationale}`.toLowerCase();
      if (!searchableText.includes(searchLower)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Group actions by service area
 */
export function groupByServiceArea(
  actions: DiagnosticAction[]
): Record<ServiceArea, DiagnosticAction[]> {
  const groups: Record<ServiceArea, DiagnosticAction[]> = {
    brand: [],
    content: [],
    website: [],
    seo: [],
    authority: [],
    analytics: [],
    cross_cutting: [],
  };

  for (const action of actions) {
    groups[action.serviceArea].push(action);
  }

  return groups;
}

/**
 * Group actions by playbook
 */
export function groupByPlaybook(
  actions: DiagnosticAction[]
): Record<string, DiagnosticAction[]> {
  const groups: Record<string, DiagnosticAction[]> = {};

  for (const action of actions) {
    const playbook = action.playbook || 'Ungrouped';
    if (!groups[playbook]) {
      groups[playbook] = [];
    }
    groups[playbook].push(action);
  }

  return groups;
}

/**
 * Group actions by dimension
 */
export function groupByDimension(
  actions: DiagnosticAction[]
): Record<string, DiagnosticAction[]> {
  const groups: Record<string, DiagnosticAction[]> = {};

  for (const action of actions) {
    if (!groups[action.dimension]) {
      groups[action.dimension] = [];
    }
    groups[action.dimension].push(action);
  }

  return groups;
}

// ============================================================================
// SERVICE AREA LABELS & STYLING
// ============================================================================

/**
 * Get human-readable label for service area
 */
export function getServiceAreaLabel(area: ServiceArea): string {
  const labels: Record<ServiceArea, string> = {
    brand: 'Brand',
    content: 'Content',
    website: 'Website',
    seo: 'SEO',
    authority: 'Authority',
    analytics: 'Analytics',
    cross_cutting: 'Cross-Cutting',
  };
  return labels[area];
}

/**
 * Get color class for service area (Tailwind)
 */
export function getServiceAreaColor(area: ServiceArea): string {
  const colors: Record<ServiceArea, string> = {
    brand: 'bg-purple-600/20 text-purple-400',
    content: 'bg-blue-600/20 text-blue-400',
    website: 'bg-green-600/20 text-green-400',
    seo: 'bg-orange-600/20 text-orange-400',
    authority: 'bg-red-600/20 text-red-400',
    analytics: 'bg-slate-600/20 text-slate-400',
    cross_cutting: 'bg-slate-600/20 text-slate-400',
  };
  return colors[area];
}
