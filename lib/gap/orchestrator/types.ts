// lib/gap/orchestrator/types.ts
// Types for the Full GAP Dual-Mode system

import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { ClientInsight } from '@/lib/types/clientBrain';
import type { GapIaRun, GapIaDimensions, GapIaSummary, GapIaQuickWins } from '../types';
import type { LabId } from '@/lib/contextGraph/labContext';

// ============================================================================
// Execution Modes
// ============================================================================

/**
 * Full GAP execution mode
 *
 * - lead_magnet: Original mode for public lead magnet. No DB writes, no context graph,
 *                no insights, no provenance. Produces narrative PDF-style report.
 *
 * - os_orchestrator: Context-first mode for Hive OS. Runs labs, merges context,
 *                    writes canonical values, extracts insights, snapshots results.
 */
export type FullGAPMode = 'lead_magnet' | 'os_orchestrator';

// ============================================================================
// Lab Refinement Types
// ============================================================================

/**
 * Fields that a Lab can refine in the Context Graph
 */
export interface LabRefinedContext {
  domain: string;
  field: string;
  value: unknown;
  confidence: number;
}

/**
 * Diagnostic output from a Lab run in refinement mode
 */
export interface LabDiagnostics {
  labId: LabId;
  score: number | null;
  summary: string | null;
  issues: string[];
  recommendations: string[];
  runId?: string;
}

/**
 * Output from a Lab run in refinement mode
 * Labs in refinement mode do NOT produce full narrative reports.
 * They return structured context updates and insights.
 */
export interface LabRefinementOutput {
  labId: LabId;
  labName: string;
  success: boolean;
  error?: string;

  /** Context field updates to merge */
  refinedContext: LabRefinedContext[];

  /** Diagnostic summary for the Lab */
  diagnostics: LabDiagnostics;

  /** Insights extracted from this Lab */
  insights: LabInsightUnit[];

  /** Run ID for provenance tracking */
  runId: string;

  /** Duration in ms */
  durationMs: number;

  /** Raw engine data for canonical field extraction */
  rawEngineData?: unknown;
}

/**
 * Insight extracted during Lab refinement
 */
export interface LabInsightUnit {
  title: string;
  summary: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation?: string;
  rationale?: string;
  sourceLabId: LabId;
}

// ============================================================================
// GAP Core Engine Types (Structured, not narrative)
// ============================================================================

/**
 * Structured output from the GAP Core Engine
 * This is machine-readable, NOT the lead magnet narrative
 *
 * GAP Plan runs MUST populate this structure to enable Context Graph hydration.
 * Empty arrays + unknowns[] are acceptable when data is missing.
 */
export interface GAPStructuredOutput {
  /** Scores by dimension */
  scores: {
    overall: number;
    brand: number;
    content: number;
    seo: number;
    website: number;
    authority: number;
    digitalFootprint: number;
  };

  /** Maturity assessment */
  maturityStage: 'emerging' | 'growth' | 'mature' | 'enterprise' | 'unknown' | string;

  /** Per-dimension diagnostics */
  dimensionDiagnostics: Array<{
    dimension: string;
    score: number;
    summary: string;
    strengths: string[];
    gaps: string[];
    opportunities: string[];
  }>;

  /** Cross-dimensional key findings */
  keyFindings: Array<{
    type: 'strength' | 'gap' | 'opportunity' | 'risk';
    title: string;
    description: string;
    dimensions: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;

  /** Recommended next steps (prioritized) */
  recommendedNextSteps: Array<{
    title: string;
    description: string;
    priority: number;
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    dimension: string;
  }>;

  /** KPIs to track */
  kpisToWatch: Array<{
    name: string;
    description: string;
    targetValue?: string;
    dimension: string;
  }>;

  // =========================================================================
  // Extended Fields for Context Graph Completeness (v2)
  // These fields are REQUIRED for GAP Plan to meaningfully populate Context Graph
  // =========================================================================

  /**
   * Primary product/service offerings
   * Maps to: productOffer.primaryProducts, productOffer.valueProposition
   */
  primaryOffers?: Array<{
    name: string;
    description?: string;
    targetAudience?: string;
    priceTier?: 'low' | 'mid' | 'high' | 'unknown';
  }>;

  /**
   * Known competitors
   * Maps to: competitive.competitors, identity.primaryCompetitors
   */
  competitors?: Array<{
    name: string;
    domain?: string;
    positioningNote?: string;
  }>;

  /**
   * Audience/ICP summary
   * Maps to: audience.icpDescription, audience.painPoints
   */
  audienceSummary?: {
    icpDescription: string;
    keyPainPoints: string[];
    buyingTriggers?: string[];
  };

  /**
   * Brand identity notes (inferred from website/content)
   * Maps to: brand.toneOfVoice, brand.brandPersonality, brand.differentiators
   */
  brandIdentityNotes?: {
    tone?: string[];
    personality?: string[];
    differentiationSummary?: string;
  };

  /**
   * Items that could not be determined (for transparency)
   * Used for debugging and to guide follow-up Lab runs
   */
  unknowns?: string[];
}

// ============================================================================
// Context Health Types
// ============================================================================

/**
 * Context health assessment
 */
export interface ContextHealthAssessment {
  completeness: number; // 0-100
  freshness: number; // 0-100
  missingCriticalFields: string[];
  staleFields: string[];
  staleSections: string[];
  recommendations: string[];
}

// ============================================================================
// Orchestrator Input/Output Types
// ============================================================================

/**
 * Input for the OS Orchestrator
 */
export interface OrchestratorInput {
  companyId: string;

  /** Optional: Existing GAP IA run to incorporate */
  gapIaRun?: Partial<GapIaRun>;

  /** Optional: Force specific labs to run */
  forceLabs?: LabId[];

  /** Optional: Skip certain labs */
  skipLabs?: LabId[];

  /** Optional: Skip context merge (dry run) */
  dryRun?: boolean;
}

/**
 * Output from the OS Orchestrator
 * This is structured data for the OS UI, NOT a narrative report.
 */
export interface OrchestratorOutput {
  mode: 'os_orchestrator';
  success: boolean;
  error?: string;

  /** Context state before orchestration */
  contextBefore: CompanyContextGraph;

  /** Context state after orchestration */
  contextAfter: CompanyContextGraph;

  /** Context health before and after */
  healthBefore: ContextHealthAssessment;
  healthAfter: ContextHealthAssessment;

  /** Labs that were run */
  labsRun: LabId[];

  /** Lab outputs */
  labOutputs: LabRefinementOutput[];

  /** Structured GAP findings */
  gapStructured: GAPStructuredOutput;

  /** Extracted insights */
  insights: ClientInsight[];

  /** Snapshot ID for history/QBR */
  snapshotId: string;

  /** Timing */
  durationMs: number;
  startedAt: string;
  completedAt: string;
}

// ============================================================================
// Lab Run Plan Types
// ============================================================================

/**
 * A lab that needs to be run to fill context gaps
 */
export interface LabRunPlanItem {
  labId: LabId;
  labName: string;
  reason: string;
  fieldsToFill: string[];
  priority: number; // 1 = highest
  estimatedDurationMs: number;
}

/**
 * Plan for which labs to run
 */
export interface LabRunPlan {
  labs: LabRunPlanItem[];
  totalEstimatedDurationMs: number;
  missingFieldsCount: number;
}

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * GAP Snapshot for history and QBR
 */
export interface GAPSnapshot {
  id: string;
  companyId: string;
  timestamp: string;

  contextBefore: CompanyContextGraph;
  contextAfter: CompanyContextGraph;

  gapFindings: GAPStructuredOutput;
  insights: ClientInsight[];

  labsRun: LabId[];

  /** Change summary */
  changes: {
    fieldsUpdated: number;
    fieldsAdded: number;
    insightsCreated: number;
    scoreChange: number;
  };
}
