// lib/contextGraph/brandLabWriter.ts
// BrandLab Domain Writer - Maps BrandLabSummary to Context Graph
//
// This writer takes BrandLab diagnostic summary and writes
// normalized facts into the Context Graph.

import type { CompanyContextGraph } from './companyContextGraph';
import type { ProvenanceTag } from './types';
import { setFieldUntyped, setDomainFields, createProvenance } from './mutate';
import { saveContextGraph } from './storage';
import type { BrandLabSummary } from '@/lib/media/diagnosticsInputs';

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
