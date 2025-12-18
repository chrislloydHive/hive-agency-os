// lib/contextGraph/brandLabWriter.ts
// BrandLab Domain Writer - Maps BrandLabSummary AND BrandLabResult.findings to Context Graph
//
// This writer takes BrandLab diagnostic output and writes
// normalized facts into the Context Graph.
//
// IMPORTANT: This writer MUST populate canonical findings fields:
// - brand.positioning (from findings.positioning.statement)
// - productOffer.valueProposition (from findings.valueProp)
// - brand.differentiators (from findings.differentiators.bullets)
// - audience.primaryAudience (from findings.icp.primaryAudience)

import type { CompanyContextGraph } from './companyContextGraph';
import type { ProvenanceTag } from './types';
import { setFieldUntyped, setDomainFields, createProvenance } from './mutate';
import { saveContextGraph } from './storage';
import type { BrandLabSummary } from '@/lib/media/diagnosticsInputs';
import type { BrandLabResult, BrandLabFindings } from '@/lib/diagnostics/brand-lab/types';
import { validateAndSanitizeBrandFindings } from '@/lib/diagnostics/brand-lab/types';

// ============================================================================
// MAPPING CONFIGURATION
// ============================================================================

/**
 * Default confidence for BrandLab mappings
 * Higher for positioning/values (0.8), lower for visual hints (0.7)
 */
const BRAND_LAB_CONFIDENCE = 0.8;
const BRAND_LAB_CONFIDENCE_LOW = 0.7;

/**
 * Create provenance tag for BrandLab source
 */
function createBrandLabProvenance(
  runId: string | undefined,
  confidence: number = BRAND_LAB_CONFIDENCE
): ProvenanceTag {
  return createProvenance('brand_lab', {
    runId,
    sourceRunId: runId,
    confidence,
    validForDays: 60, // Brand assessments valid for ~60 days
  });
}

/**
 * Check if a value is meaningful (not null, undefined, empty string, or empty array)
 */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

// ============================================================================
// MAIN WRITER FUNCTION
// ============================================================================

export interface BrandLabWriterResult {
  fieldsUpdated: number;
  updatedPaths: string[];
  skippedPaths: string[];
  errors: string[];
}

/**
 * Write BrandLabSummary to Context Graph
 *
 * @param graph - The context graph to update
 * @param data - BrandLabSummary from diagnostic run
 * @param runId - Optional run ID for provenance tracking
 * @returns Summary of what was updated
 */
export function writeBrandLabToGraph(
  graph: CompanyContextGraph,
  data: BrandLabSummary,
  runId?: string
): BrandLabWriterResult {
  const summary: BrandLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  const provenance = createBrandLabProvenance(runId || data.runId);
  const lowConfProvenance = createBrandLabProvenance(runId || data.runId, BRAND_LAB_CONFIDENCE_LOW);

  try {
    // ========================================================================
    // Positioning & Values
    // ========================================================================

    // Positioning statement
    if (isMeaningfulValue(data.positioningSummary)) {
      setFieldUntyped(graph, 'brand', 'positioning', data.positioningSummary, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.positioning');
    }

    // Value propositions
    if (isMeaningfulValue(data.valueProps)) {
      setFieldUntyped(graph, 'brand', 'valueProps', data.valueProps, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.valueProps');
    }

    // Differentiators
    if (isMeaningfulValue(data.differentiators)) {
      setFieldUntyped(graph, 'brand', 'differentiators', data.differentiators, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.differentiators');
    }

    // ========================================================================
    // Brand Voice
    // ========================================================================

    // Voice/Tone
    if (isMeaningfulValue(data.voiceTone)) {
      setFieldUntyped(graph, 'brand', 'toneOfVoice', data.voiceTone, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.toneOfVoice');
    }

    // ========================================================================
    // Brand Perception
    // ========================================================================

    // Perception
    if (isMeaningfulValue(data.brandPerception)) {
      setFieldUntyped(graph, 'brand', 'brandPerception', data.brandPerception, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.brandPerception');
    }

    // Strengths
    if (isMeaningfulValue(data.strengths)) {
      setFieldUntyped(graph, 'brand', 'brandStrengths', data.strengths, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.brandStrengths');
    }

    // Weaknesses
    if (isMeaningfulValue(data.weaknesses)) {
      setFieldUntyped(graph, 'brand', 'brandWeaknesses', data.weaknesses, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.brandWeaknesses');
    }

    // ========================================================================
    // Competitive Position
    // ========================================================================

    if (isMeaningfulValue(data.competitivePosition)) {
      setFieldUntyped(graph, 'brand', 'competitivePosition', data.competitivePosition, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.competitivePosition');
    }

    // ========================================================================
    // Visual Identity (lower confidence)
    // ========================================================================

    if (isMeaningfulValue(data.visualIdentity)) {
      setFieldUntyped(graph, 'brand', 'visualIdentitySummary', data.visualIdentity, lowConfProvenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.visualIdentitySummary');
    }

    // ========================================================================
    // Strategist view as additional context
    // ========================================================================

    if (isMeaningfulValue(data.strategistView)) {
      // Store the full strategist view in messaging pillars or brand personality
      setFieldUntyped(graph, 'brand', 'brandPersonality', data.strategistView, lowConfProvenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.brandPersonality');
    }

    // ========================================================================
    // Update history refs
    // ========================================================================

    const refId = runId || data.runId;
    if (refId) {
      setDomainFields(
        graph,
        'historyRefs',
        { latestBrandLabRunId: refId } as Record<string, unknown>,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('historyRefs.latestBrandLabRunId');
    }

  } catch (error) {
    summary.errors.push(`Error writing BrandLab data: ${error}`);
  }

  console.log(
    `[BrandLabWriter] Updated ${summary.fieldsUpdated} fields, errors: ${summary.errors.length}`
  );

  return summary;
}

/**
 * Write BrandLabSummary to Context Graph and save
 */
export async function writeBrandLabAndSave(
  companyId: string,
  data: BrandLabSummary,
  runId?: string
): Promise<{
  graph: CompanyContextGraph;
  summary: BrandLabWriterResult;
}> {
  const { loadContextGraph } = await import('./storage');
  const { createEmptyContextGraph } = await import('./companyContextGraph');

  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, companyId);
  }

  const summary = writeBrandLabToGraph(graph, data, runId);
  await saveContextGraph(graph, 'brand_lab');

  return { graph, summary };
}

// ============================================================================
// BANNED EVALUATIVE PHRASES (findings must be facts, not assessments)
// ============================================================================

const BANNED_EVALUATIVE_PHRASES = [
  'is vague',
  'is unclear',
  'could be sharper',
  'could be clearer',
  'could be stronger',
  'could be better',
  'could be more',
  'needs work',
  'needs improvement',
  'needs to be',
  'is present but',
  'is partially',
  'is somewhat',
  'is not clearly',
  'has gaps',
  'serviceable but',
  'positioning is',
  'value prop is',
  'differentiation is',
];

/**
 * Check if text contains banned evaluative phrases
 * Returns true if the text is evaluative (and should be rejected)
 */
function isEvaluativeText(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_EVALUATIVE_PHRASES.some(phrase => lower.includes(phrase));
}

/**
 * Validate that a finding value is customer-facing copy (not evaluation)
 */
function isValidFindingValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < 10) return false;
  if (isEvaluativeText(trimmed)) return false;
  return true;
}

// ============================================================================
// CANONICAL FINDINGS WRITER (BrandLabResult.findings → Context Graph)
// ============================================================================

/**
 * Write canonical findings from BrandLabResult to Context Graph
 *
 * This writes the customer-facing canonical findings:
 * - brand.positioning from findings.positioning or valueProp
 * - productOffer.valueProposition from findings.valueProp
 * - brand.differentiators from findings.differentiators.bullets
 * - audience.primaryAudience from findings.icp.primaryAudience
 * - brand.messagingPillars from findings.messaging.pillars
 *
 * HARD RULE: Rejects evaluative text like "Positioning is vague..."
 */
export function writeCanonicalFindingsToGraph(
  graph: CompanyContextGraph,
  findings: BrandLabFindings,
  runId?: string
): BrandLabWriterResult {
  const summary: BrandLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  const provenance = createBrandLabProvenance(runId, BRAND_LAB_CONFIDENCE);

  try {
    // ========================================================================
    // 1. Value Proposition → productOffer.valueProposition
    // ========================================================================
    if (findings.valueProp?.headline && findings.valueProp?.description) {
      const valueProposition = `${findings.valueProp.headline} — ${findings.valueProp.description}`;

      if (isValidFindingValue(valueProposition)) {
        setFieldUntyped(graph, 'productOffer', 'valueProposition', valueProposition, provenance);
        summary.fieldsUpdated++;
        summary.updatedPaths.push('productOffer.valueProposition');
      } else {
        summary.skippedPaths.push('productOffer.valueProposition (evaluative or empty)');
      }
    }

    // ========================================================================
    // 2. Positioning → brand.positioning
    // ========================================================================
    // Try to get from findings.positioning first, then fallback to valueProp headline
    let positioningStatement: string | undefined;

    if (findings.positioning?.statement) {
      positioningStatement = findings.positioning.statement;
    } else if (findings.positioning?.summary) {
      positioningStatement = findings.positioning.summary;
    } else if (findings.valueProp?.headline) {
      positioningStatement = findings.valueProp.headline;
    }

    if (positioningStatement && isValidFindingValue(positioningStatement)) {
      setFieldUntyped(graph, 'brand', 'positioning', positioningStatement, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('brand.positioning');
    } else {
      summary.skippedPaths.push('brand.positioning (evaluative or empty)');
    }

    // ========================================================================
    // 3. Differentiators → brand.differentiators
    // ========================================================================
    if (findings.differentiators?.bullets && findings.differentiators.bullets.length > 0) {
      // Filter out any evaluative bullets
      const validBullets = findings.differentiators.bullets.filter(b =>
        b && b.trim().length > 5 && !isEvaluativeText(b)
      );

      if (validBullets.length > 0) {
        setFieldUntyped(graph, 'brand', 'differentiators', validBullets, provenance);
        summary.fieldsUpdated++;
        summary.updatedPaths.push('brand.differentiators');
      } else {
        summary.skippedPaths.push('brand.differentiators (all evaluative or empty)');
      }
    }

    // ========================================================================
    // 4. ICP / Primary Audience → audience.primaryAudience
    // ========================================================================
    if (findings.icp?.primaryAudience && isValidFindingValue(findings.icp.primaryAudience)) {
      setFieldUntyped(graph, 'audience', 'primaryAudience', findings.icp.primaryAudience, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.primaryAudience');
    } else {
      summary.skippedPaths.push('audience.primaryAudience (evaluative or empty)');
    }

    // Also write buyer roles if available
    if (findings.icp?.buyerRoles && findings.icp.buyerRoles.length > 0) {
      const validRoles = findings.icp.buyerRoles.filter(r => r && r.trim().length > 0);
      if (validRoles.length > 0) {
        setFieldUntyped(graph, 'audience', 'buyerRoles', validRoles, provenance);
        summary.fieldsUpdated++;
        summary.updatedPaths.push('audience.buyerRoles');
      }
    }

    // ========================================================================
    // 5. Messaging Pillars → brand.messagingPillars
    // ========================================================================
    if (findings.messaging?.pillars && findings.messaging.pillars.length > 0) {
      const pillarStrings = findings.messaging.pillars
        .filter(p => p.title && !isEvaluativeText(p.title))
        .map(p => p.support ? `${p.title}: ${p.support}` : p.title);

      if (pillarStrings.length > 0) {
        setFieldUntyped(graph, 'brand', 'messagingPillars', pillarStrings, provenance);
        summary.fieldsUpdated++;
        summary.updatedPaths.push('brand.messagingPillars');
      }
    }

    // ========================================================================
    // 6. Tone of Voice → brand.toneOfVoice (only if enabled)
    // ========================================================================
    if (findings.toneOfVoice?.enabled && findings.toneOfVoice?.descriptor) {
      if (isValidFindingValue(findings.toneOfVoice.descriptor)) {
        setFieldUntyped(graph, 'brand', 'toneOfVoice', findings.toneOfVoice.descriptor, provenance);
        summary.fieldsUpdated++;
        summary.updatedPaths.push('brand.toneOfVoice');
      }
    }

  } catch (error) {
    summary.errors.push(`Error writing canonical findings: ${error}`);
  }

  console.log(
    `[BrandLabWriter] Canonical findings: updated ${summary.fieldsUpdated} fields, skipped ${summary.skippedPaths.length}`
  );

  return summary;
}

// ============================================================================
// SANITY CHECKS (Fail-Fast Validation)
// ============================================================================

/**
 * Validate that findings have concrete, non-evaluative content
 * Returns array of validation errors (empty = valid)
 */
function validateFindingsForWrite(findings: BrandLabFindings): string[] {
  const errors: string[] = [];

  // Value Proposition sanity check
  if (findings.valueProp) {
    const { headline, description } = findings.valueProp;
    if (headline && isEvaluativeText(headline)) {
      errors.push(`valueProp.headline is evaluative: "${headline.slice(0, 50)}..."`);
    }
    if (description && isEvaluativeText(description)) {
      errors.push(`valueProp.description is evaluative: "${description.slice(0, 50)}..."`);
    }
  }

  // Positioning sanity check
  if (findings.positioning) {
    const { statement, summary } = findings.positioning;
    if (statement && isEvaluativeText(statement)) {
      errors.push(`positioning.statement is evaluative: "${statement.slice(0, 50)}..."`);
    }
    if (summary && isEvaluativeText(summary)) {
      errors.push(`positioning.summary is evaluative: "${summary.slice(0, 50)}..."`);
    }
  }

  // Differentiators sanity check - at least one non-evaluative bullet required
  if (findings.differentiators?.bullets) {
    const validBullets = findings.differentiators.bullets.filter(
      b => b && b.trim().length > 5 && !isEvaluativeText(b)
    );
    if (findings.differentiators.bullets.length > 0 && validBullets.length === 0) {
      errors.push('All differentiators are evaluative or too short');
    }
  }

  // ICP sanity check
  if (findings.icp?.primaryAudience && isEvaluativeText(findings.icp.primaryAudience)) {
    errors.push(`icp.primaryAudience is evaluative: "${findings.icp.primaryAudience.slice(0, 50)}..."`);
  }

  return errors;
}

/**
 * Write full BrandLabResult (including findings) to Context Graph and save
 *
 * This is the PREFERRED entry point for Brand Lab diagnostic runs.
 * It writes both the legacy BrandLabSummary fields AND the canonical findings.
 *
 * SANITY CHECK: Validates findings before writing to prevent garbage data.
 */
export async function writeBrandLabResultAndSave(
  companyId: string,
  result: BrandLabResult,
  runId?: string
): Promise<{
  graph: CompanyContextGraph;
  legacySummary: BrandLabWriterResult;
  findingsSummary: BrandLabWriterResult;
}> {
  const { loadContextGraph } = await import('./storage');
  const { createEmptyContextGraph } = await import('./companyContextGraph');

  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, companyId);
  }

  // SANITY CHECK: Validate and sanitize findings before writing
  // This strips competitive claims and evaluative statements
  let sanitizedFindings: BrandLabFindings | undefined;
  if (result.findings) {
    const { sanitized, validation } = validateAndSanitizeBrandFindings(result.findings);
    sanitizedFindings = sanitized;

    if (!validation.valid) {
      console.warn('[BrandLabWriter] SANITY CHECK: Stripped fields with competitive/evaluative content:', validation.strippedFields);
    }

    // Also run legacy validation for additional checks
    const validationErrors = validateFindingsForWrite(sanitized);
    if (validationErrors.length > 0) {
      console.warn('[BrandLabWriter] Additional validation warnings:', validationErrors);
    }
  }

  // 1. Extract and write legacy BrandLabSummary (for backward compatibility)
  // NOTE: Use sanitized findings for legacy data too
  const legacyData: BrandLabSummary = {
    runId,
    score: result.overallScore,
    strategistView: result.narrativeSummary,
    positioningSummary: sanitizedFindings?.positioning?.summary,
    valueProps: sanitizedFindings?.valueProp ? [sanitizedFindings.valueProp.headline] : undefined,
    differentiators: sanitizedFindings?.differentiators?.bullets,
    voiceTone: sanitizedFindings?.toneOfVoice?.descriptor,
  };
  const legacySummary = writeBrandLabToGraph(graph, legacyData, runId);

  // 2. Write canonical findings (NEW - the customer-facing outputs)
  // NOTE: Use sanitized findings that have competitive claims stripped
  let findingsSummary: BrandLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  if (sanitizedFindings) {
    findingsSummary = writeCanonicalFindingsToGraph(graph, sanitizedFindings, runId);
  }

  // 3. Save the graph
  await saveContextGraph(graph, 'brand_lab');

  console.log(`[BrandLabWriter] Total: legacy=${legacySummary.fieldsUpdated}, findings=${findingsSummary.fieldsUpdated}`);

  // INVARIANT CHECK: Log error if findings existed but weren't written
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_BRAND_LAB) {
    const hasInputFindings = !!(sanitizedFindings?.positioning?.statement || sanitizedFindings?.valueProp?.headline);
    const hasOutputPositioning = !!(graph.brand as any)?.positioning?.value;
    const hasOutputValueProp = !!(graph.productOffer as any)?.valueProposition?.value;

    if (hasInputFindings && (!hasOutputPositioning || !hasOutputValueProp)) {
      console.error('[BrandLabWriter] INVARIANT VIOLATION: Canonical findings exist but graph is missing data', {
        runId,
        inputHasPositioning: !!sanitizedFindings?.positioning?.statement,
        inputHasValueProp: !!sanitizedFindings?.valueProp?.headline,
        graphHasPositioning: hasOutputPositioning,
        graphHasValueProp: hasOutputValueProp,
        skippedPaths: findingsSummary.skippedPaths,
      });
    }
  }

  return { graph, legacySummary, findingsSummary };
}
