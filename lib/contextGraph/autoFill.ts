// lib/contextGraph/autoFill.ts
// Smart Auto-Fill Context Orchestrator
//
// Single-click silent bulk refinement that:
// - Runs FCB + Labs Refinement pipelines
// - Fills empty/weak fields automatically
// - Never overwrites human-entered values or higher-priority sources
// - Updates Context Graph + Context Health
//
// COVERAGE:
// - FCB covers: identity, audience, brand, productOffer, website
// - Labs cover: audience, brand, creative, competitive, website
//
// DOES NOT AUTO-FILL (manual-only):
// - Objectives (primaryObjective, revenueGoal, leadGoal, etc.)
// - KPIs (kpiLabels, targetCpa, targetRoas)
// - Budget (totalMarketingBudget, mediaSpendBudget)
// - Constraints (timeHorizon, budgetPeriod)
//
// These require human input because they represent business decisions,
// not facts that can be inferred from website content.

import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from './storage';
import { computeContextHealthScore, type ContextHealthScore } from './health';
import { runFoundationalContextBuilder, type FCBRunResult } from './fcb';
import {
  runLabRefinement,
  type LabRefinementRunResult,
  type RefinementLabId,
} from '@/lib/labs/refinementRunner';
import { isHumanSource } from './sourcePriority';
import type { CompanyContextGraph, DomainName } from './companyContextGraph';
import type { WithMetaType } from './types';

// ============================================================================
// Coverage Constants
// ============================================================================

/**
 * Domains that Smart Auto-Fill CAN populate (via FCB + Labs)
 */
export const AUTO_FILL_COVERED_DOMAINS = [
  'identity',
  'audience',
  'brand',
  'creative',
  'competitive',
  'productOffer',
  'website',
  'content',
  'seo',
  'performanceMedia',
] as const;

/**
 * Domains that require manual human input (not auto-fillable)
 */
export const MANUAL_ONLY_DOMAINS = [
  'objectives',
  'budgetOps',
] as const;

/**
 * Specific fields that are manual-only (for UI hints)
 */
export const MANUAL_ONLY_FIELDS = [
  'objectives.primaryObjective',
  'objectives.primaryBusinessGoal',
  'objectives.secondaryObjectives',
  'objectives.revenueGoal',
  'objectives.leadGoal',
  'objectives.targetCpa',
  'objectives.targetRoas',
  'objectives.kpiLabels',
  'objectives.timeHorizon',
  'budgetOps.totalMarketingBudget',
  'budgetOps.mediaSpendBudget',
  'budgetOps.budgetPeriod',
  'budgetOps.avgCustomerValue',
  'budgetOps.customerLTV',
] as const;

/**
 * Check if a field path is manual-only
 */
export function isManualOnlyField(path: string): boolean {
  return (MANUAL_ONLY_FIELDS as readonly string[]).includes(path) ||
    MANUAL_ONLY_DOMAINS.some(domain => path.startsWith(`${domain}.`));
}

/**
 * Labs available for Smart Auto-Fill refinement
 * These are Labs that have refinement mode implemented
 */
const AVAILABLE_REFINEMENT_LABS: RefinementLabId[] = [
  'audience',
  'brand',
  'creative',
  'competitor',
  'website',
];

/**
 * Check if a lab is available for refinement
 * (All current labs are available, but this allows for future feature flags)
 */
function isLabAvailable(labId: RefinementLabId): boolean {
  return AVAILABLE_REFINEMENT_LABS.includes(labId);
}

// ============================================================================
// Types
// ============================================================================

export interface SmartAutoFillOptions {
  /** Force run FCB even if it ran recently */
  forceRunFCB?: boolean;
  /** Include GAP pass (default false for now - heavy) */
  includeGAPPass?: boolean;
  /** Force run Labs even if completeness is high */
  forceRunLabs?: boolean;
}

export interface SmartAutoFillResult {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  fieldsConsidered: number;
  fieldsUpdated: number;
  fieldsSkippedHumanOverride: number;
  fieldsSkippedHighPriority: number;
  labsRun: string[];
  fcbRun: boolean;
  fcbResult?: FCBRunResult;
  gapRun: boolean;
  labResults: Record<'audience' | 'brand' | 'creative' | 'competitor' | 'website', LabRefinementRunResult | null>;
  contextHealthBefore?: Pick<ContextHealthScore, 'overallScore' | 'completenessScore' | 'criticalCoverageScore' | 'severity'>;
  contextHealthAfter?: Pick<ContextHealthScore, 'overallScore' | 'completenessScore' | 'criticalCoverageScore' | 'severity'>;
  error?: string;
}

// ============================================================================
// Higher Priority Sources (Labs should never overwrite these)
// ============================================================================

const HIGHER_PRIORITY_SOURCES = [
  'user',
  'manual',
  'qbr',
  'strategy',
  'setup_wizard',
  'gap_heavy',
];

/**
 * Check if existing source has higher priority than auto-fill pipelines
 */
function hasHigherPriorityThanAutoFill(source?: string): boolean {
  return source ? HIGHER_PRIORITY_SOURCES.includes(source) : false;
}

// ============================================================================
// Field Analysis Helpers
// ============================================================================

interface FieldAnalysis {
  totalFields: number;
  emptyFields: number;
  lowConfidenceFields: number;
  humanOverrideFields: number;
  highPriorityFields: number;
  candidateForUpdate: number;
}

/**
 * Analyze the context graph to determine which fields are candidates for auto-fill
 */
function analyzeContextGraph(graph: CompanyContextGraph): FieldAnalysis {
  const analysis: FieldAnalysis = {
    totalFields: 0,
    emptyFields: 0,
    lowConfidenceFields: 0,
    humanOverrideFields: 0,
    highPriorityFields: 0,
    candidateForUpdate: 0,
  };

  const domains: DomainName[] = [
    'identity',
    'brand',
    'audience',
    'creative',
    'objectives',
    'productOffer',
    'website',
    'content',
    'seo',
    'performanceMedia',
    'competitive',
  ];

  for (const domainName of domains) {
    const domainObj = graph[domainName];
    if (!domainObj || typeof domainObj !== 'object') continue;

    for (const [fieldName, fieldData] of Object.entries(domainObj)) {
      if (!fieldData || typeof fieldData !== 'object') continue;
      if (!('value' in fieldData) || !('provenance' in fieldData)) continue;

      analysis.totalFields++;

      const field = fieldData as WithMetaType<unknown>;
      const isEmpty = field.value === null || field.value === undefined ||
        (Array.isArray(field.value) && field.value.length === 0);
      const topProvenance = field.provenance?.[0];
      const confidence = topProvenance?.confidence ?? 0.5;
      const source = topProvenance?.source;

      if (isEmpty) {
        analysis.emptyFields++;
      }

      if (confidence < 0.5 && !isEmpty) {
        analysis.lowConfidenceFields++;
      }

      if (isHumanSource(source)) {
        analysis.humanOverrideFields++;
      } else if (hasHigherPriorityThanAutoFill(source)) {
        analysis.highPriorityFields++;
      }

      // Candidate for update: empty OR low confidence, AND not protected
      if ((isEmpty || confidence < 0.5) && !isHumanSource(source) && !hasHigherPriorityThanAutoFill(source)) {
        analysis.candidateForUpdate++;
      }
    }
  }

  return analysis;
}

/**
 * Check if FCB should run based on heuristics
 *
 * For Smart Auto-Fill, we're more aggressive about running FCB because:
 * 1. User explicitly clicked "Auto-Fill" - they want fields filled
 * 2. FCB extractors may have been improved since last run
 * 3. Critical fields like ICP may not have been extracted before
 */
async function shouldRunFCB(
  companyId: string,
  graph: CompanyContextGraph | null,
  forceRun: boolean
): Promise<boolean> {
  // If force, always run
  if (forceRun) return true;

  // If no graph exists, run FCB
  if (!graph) return true;

  // Check if critical fields are missing - if so, run FCB
  const criticalFields = [
    { domain: 'identity', field: 'icpDescription' },
    { domain: 'identity', field: 'industry' },
    { domain: 'identity', field: 'businessModel' },
    { domain: 'audience', field: 'primaryAudience' },
    { domain: 'brand', field: 'positioning' },
  ];

  for (const { domain, field } of criticalFields) {
    const domainObj = graph[domain as keyof CompanyContextGraph] as Record<string, WithMetaType<unknown>> | undefined;
    if (!domainObj) continue;
    const fieldData = domainObj[field];
    const isEmpty = !fieldData?.value ||
      (typeof fieldData.value === 'string' && !fieldData.value.trim()) ||
      (Array.isArray(fieldData.value) && fieldData.value.length === 0);

    if (isEmpty) {
      console.log(`[AutoFill] FCB needed: critical field ${domain}.${field} is empty`);
      return true;
    }
  }

  // Check if FCB has run before (look for 'fcb' source in provenance)
  let fcbHasRun = false;
  const domains = ['identity', 'brand', 'audience', 'productOffer', 'website'] as const;

  for (const domainName of domains) {
    const domainObj = graph[domainName];
    if (!domainObj || typeof domainObj !== 'object') continue;

    for (const fieldData of Object.values(domainObj)) {
      if (!fieldData || typeof fieldData !== 'object') continue;
      const field = fieldData as WithMetaType<unknown>;
      if (field.provenance?.some((p) => p.source === 'fcb')) {
        fcbHasRun = true;
        break;
      }
    }
    if (fcbHasRun) break;
  }

  // If FCB never ran, run it
  if (!fcbHasRun) return true;

  // Check last FCB run date from meta - more aggressive: 7 days instead of 30
  const lastFcbAt = graph.meta.lastFusionAt;
  if (lastFcbAt) {
    const daysSinceLastRun = (Date.now() - new Date(lastFcbAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastRun > 7) {
      console.log(`[AutoFill] FCB needed: last run was ${daysSinceLastRun.toFixed(1)} days ago`);
      return true; // Run if older than 7 days
    }
  }

  // Default: don't re-run
  return false;
}

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Run Smart Auto-Fill Context
 *
 * Orchestrates FCB + Labs Refinement to fill in as many empty/weak fields
 * as possible while respecting human overrides and source priority.
 */
export async function runSmartAutoFillContext(
  companyId: string,
  options: SmartAutoFillOptions = {}
): Promise<SmartAutoFillResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  console.log(`[AutoFill] Starting Smart Auto-Fill for ${companyId}`);

  const result: SmartAutoFillResult = {
    startedAt,
    finishedAt: '',
    durationMs: 0,
    fieldsConsidered: 0,
    fieldsUpdated: 0,
    fieldsSkippedHumanOverride: 0,
    fieldsSkippedHighPriority: 0,
    labsRun: [],
    fcbRun: false,
    gapRun: false,
    labResults: {
      audience: null,
      brand: null,
      creative: null,
      competitor: null,
      website: null,
    },
  };

  try {
    // =========================================================================
    // Step 1: Load company and baseline state
    // =========================================================================

    const company = await getCompanyById(companyId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    // Load current Context Graph
    let graph = await loadContextGraph(companyId);

    // Compute baseline Context Health
    const healthBefore = await computeContextHealthScore(companyId);
    result.contextHealthBefore = {
      overallScore: healthBefore.overallScore,
      completenessScore: healthBefore.completenessScore,
      criticalCoverageScore: healthBefore.criticalCoverageScore,
      severity: healthBefore.severity,
    };

    console.log(`[AutoFill] Baseline health: ${healthBefore.overallScore}% (${healthBefore.severity})`);

    // Analyze candidate fields
    if (graph) {
      const analysis = analyzeContextGraph(graph);
      result.fieldsConsidered = analysis.candidateForUpdate;
      result.fieldsSkippedHumanOverride = analysis.humanOverrideFields;
      result.fieldsSkippedHighPriority = analysis.highPriorityFields;

      console.log(`[AutoFill] Field analysis:`, {
        total: analysis.totalFields,
        candidates: analysis.candidateForUpdate,
        humanOverrides: analysis.humanOverrideFields,
        highPriority: analysis.highPriorityFields,
      });
    }

    // =========================================================================
    // Step 2: Optionally run FCB
    // =========================================================================

    const runFcb = await shouldRunFCB(companyId, graph, options.forceRunFCB || false);

    if (runFcb && company.domain) {
      console.log(`[AutoFill] Running FCB for ${company.name}...`);
      try {
        const fcbResult = await runFoundationalContextBuilder(
          companyId,
          company.domain,
          company.name,
          { reason: 'Smart Auto-Fill Context' }
        );
        result.fcbRun = true;
        result.fcbResult = fcbResult;
        result.fieldsUpdated += fcbResult.fieldsWritten;

        console.log(`[AutoFill] FCB complete: ${fcbResult.fieldsWritten} fields written, ${fcbResult.fieldsSkipped} skipped`);
      } catch (fcbError) {
        console.error(`[AutoFill] FCB failed:`, fcbError);
        // Continue with Labs even if FCB fails
      }
    } else {
      console.log(`[AutoFill] Skipping FCB (already run recently or no domain)`);
    }

    // =========================================================================
    // Step 3: Run Labs Refinement
    // =========================================================================

    // Reload graph after FCB
    graph = await loadContextGraph(companyId);

    // Get available labs (filter by what's implemented)
    const labsToRun = AVAILABLE_REFINEMENT_LABS.filter(isLabAvailable);

    console.log(`[AutoFill] Running ${labsToRun.length} Labs: ${labsToRun.join(', ')}`);
    console.log(`[AutoFill] Note: Objectives, KPIs, Budget fields are manual-only and will not be auto-filled`);

    for (const labId of labsToRun) {
      console.log(`[AutoFill] Running ${labId} Lab refinement...`);
      try {
        const labResult = await runLabRefinement({
          companyId,
          labId,
          forceRun: options.forceRunLabs || false,
        });

        result.labResults[labId] = labResult;
        result.labsRun.push(labId);

        // Track updates
        if (labResult.applyResult) {
          result.fieldsUpdated += labResult.applyResult.updated;
          result.fieldsSkippedHumanOverride += labResult.applyResult.skippedHumanOverride;
          result.fieldsSkippedHighPriority += labResult.applyResult.skippedHigherPriority;
        }

        console.log(`[AutoFill] ${labId} Lab complete:`, {
          refined: labResult.refinement.refinedContext.length,
          updated: labResult.applyResult?.updated || 0,
          skippedHuman: labResult.applyResult?.skippedHumanOverride || 0,
        });
      } catch (labError) {
        console.error(`[AutoFill] ${labId} Lab failed:`, labError);
        // Continue with other Labs
      }
    }

    // =========================================================================
    // Step 4: Optional GAP pass (disabled by default)
    // =========================================================================

    if (options.includeGAPPass) {
      // TODO: Integrate GAP orchestrator in OS mode
      console.log(`[AutoFill] GAP pass requested but not yet implemented`);
      result.gapRun = false;
    }

    // =========================================================================
    // Step 5: Recompute Context Health
    // =========================================================================

    const healthAfter = await computeContextHealthScore(companyId);
    result.contextHealthAfter = {
      overallScore: healthAfter.overallScore,
      completenessScore: healthAfter.completenessScore,
      criticalCoverageScore: healthAfter.criticalCoverageScore,
      severity: healthAfter.severity,
    };

    const improvement = healthAfter.overallScore - healthBefore.overallScore;
    console.log(`[AutoFill] Health after: ${healthAfter.overallScore}% (${healthAfter.severity}), improvement: ${improvement > 0 ? '+' : ''}${improvement}`);

    // =========================================================================
    // Step 6: Finalize result
    // =========================================================================

    result.finishedAt = new Date().toISOString();
    result.durationMs = Date.now() - startTime;

    console.log(`[AutoFill] Complete in ${result.durationMs}ms:`, {
      fcbRun: result.fcbRun,
      labsRun: result.labsRun,
      fieldsUpdated: result.fieldsUpdated,
      healthImprovement: improvement,
    });

    return result;
  } catch (error) {
    console.error(`[AutoFill] Error:`, error);

    result.finishedAt = new Date().toISOString();
    result.durationMs = Date.now() - startTime;
    result.error = error instanceof Error ? error.message : 'Unknown error';

    return result;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { analyzeContextGraph, shouldRunFCB };
