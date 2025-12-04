// lib/contextGraph/audienceLabWriter.ts
// AudienceLab Domain Writer - Maps AudienceModel to Context Graph
//
// This writer takes AudienceModel data (segments, personas, demand states)
// and writes normalized facts into the Context Graph.

import type { CompanyContextGraph } from './companyContextGraph';
import type { ProvenanceTag } from './types';
import { setFieldUntyped, setDomainFields, createProvenance } from './mutate';
import { saveContextGraph } from './storage';
import type { AudienceModel, AudienceSegment } from '@/lib/audience/model';

// ============================================================================
// MAPPING CONFIGURATION
// ============================================================================

/**
 * Default confidence for AudienceLab mappings
 * Higher for core segments/personas (0.8), lower for inferred (0.65)
 */
const AUDIENCE_LAB_CONFIDENCE = 0.8;
const AUDIENCE_LAB_CONFIDENCE_LOW = 0.65;

/**
 * Create provenance tag for AudienceLab source
 */
function createAudienceLabProvenance(
  runId: string | undefined,
  confidence: number = AUDIENCE_LAB_CONFIDENCE
): ProvenanceTag {
  return createProvenance('audience_lab', {
    runId,
    sourceRunId: runId,
    confidence,
    validForDays: 90, // Audience models valid for ~90 days
  });
}

/**
 * Extract segment names grouped by priority
 */
function extractSegmentsByPriority(
  segments: AudienceSegment[]
): { primary: string[]; secondary: string[]; tertiary: string[] } {
  const result = { primary: [] as string[], secondary: [] as string[], tertiary: [] as string[] };

  for (const segment of segments) {
    if (segment.priority === 'primary') {
      result.primary.push(segment.name);
    } else if (segment.priority === 'secondary') {
      result.secondary.push(segment.name);
    } else if (segment.priority === 'tertiary') {
      result.tertiary.push(segment.name);
    } else {
      // Default to secondary if no priority
      result.secondary.push(segment.name);
    }
  }

  return result;
}

/**
 * Aggregate unique values from all segments
 */
function aggregateArrayField(segments: AudienceSegment[], field: keyof AudienceSegment): string[] {
  const values = new Set<string>();
  for (const segment of segments) {
    const fieldValue = segment[field];
    if (Array.isArray(fieldValue)) {
      for (const v of fieldValue) {
        if (typeof v === 'string' && v.trim()) {
          values.add(v.trim());
        }
      }
    }
  }
  return Array.from(values);
}

// ============================================================================
// MAIN WRITER FUNCTION
// ============================================================================

export interface AudienceLabWriterResult {
  fieldsUpdated: number;
  updatedPaths: string[];
  skippedPaths: string[];
  errors: string[];
}

/**
 * Write AudienceModel to Context Graph
 *
 * @param graph - The context graph to update
 * @param model - AudienceModel from Audience Lab
 * @param runId - Optional run ID for provenance tracking
 * @returns Summary of what was updated
 */
export function writeAudienceLabToGraph(
  graph: CompanyContextGraph,
  model: AudienceModel,
  runId?: string
): AudienceLabWriterResult {
  const summary: AudienceLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  const provenance = createAudienceLabProvenance(runId || model.id);
  const lowConfProvenance = createAudienceLabProvenance(runId || model.id, AUDIENCE_LAB_CONFIDENCE_LOW);

  try {
    const segments = model.segments || [];

    if (segments.length === 0) {
      summary.skippedPaths.push('No segments in model');
      return summary;
    }

    // ========================================================================
    // Core Segments
    // ========================================================================
    const segmentsByPriority = extractSegmentsByPriority(segments);

    // Primary segments as core segments
    if (segmentsByPriority.primary.length > 0) {
      setFieldUntyped(graph, 'audience', 'coreSegments', segmentsByPriority.primary, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.coreSegments');
    }

    // Full segment details
    const segmentDetails = segments.map(s => ({
      name: s.name,
      description: s.description || null,
      size: s.estimatedSize || null,
      priority: s.priority || null,
      demographics: s.demographics || null,
      behaviors: s.behavioralDrivers?.join(', ') || null,
    }));

    if (segmentDetails.length > 0) {
      setFieldUntyped(graph, 'audience', 'segmentDetails', segmentDetails, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.segmentDetails');
    }

    // ========================================================================
    // Persona Briefs
    // ========================================================================
    const personaBriefs = segments.map(s => ({
      name: s.name,
      tagline: s.description?.substring(0, 100) || null,
      oneSentenceSummary: s.description || null,
      priority: s.priority || null,
    }));

    if (personaBriefs.length > 0) {
      setFieldUntyped(graph, 'audience', 'personaBriefs', personaBriefs, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.personaBriefs');

      // Also populate persona names
      const personaNames = segments.map(s => s.name);
      setFieldUntyped(graph, 'audience', 'personaNames', personaNames, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.personaNames');
    }

    // ========================================================================
    // Jobs to Be Done / Pain Points / Motivations
    // ========================================================================
    const jobsToBeDone = aggregateArrayField(segments, 'jobsToBeDone');
    if (jobsToBeDone.length > 0) {
      setFieldUntyped(graph, 'audience', 'audienceNeeds', jobsToBeDone, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.audienceNeeds');
    }

    const painPoints = aggregateArrayField(segments, 'keyPains');
    if (painPoints.length > 0) {
      setFieldUntyped(graph, 'audience', 'painPoints', painPoints, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.painPoints');
    }

    const goals = aggregateArrayField(segments, 'keyGoals');
    if (goals.length > 0) {
      setFieldUntyped(graph, 'audience', 'motivations', goals, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.motivations');
    }

    // ========================================================================
    // Objections / Decision Factors
    // ========================================================================
    const objections = aggregateArrayField(segments, 'keyObjections');
    if (objections.length > 0) {
      setFieldUntyped(graph, 'audience', 'audienceObjections', objections, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.audienceObjections');
    }

    const proofPoints = aggregateArrayField(segments, 'proofPointsNeeded');
    if (proofPoints.length > 0) {
      setFieldUntyped(graph, 'audience', 'proofPointsNeeded', proofPoints, provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.proofPointsNeeded');
    }

    // ========================================================================
    // Behavioral Drivers
    // ========================================================================
    const behavioralDrivers = aggregateArrayField(segments, 'behavioralDrivers');
    if (behavioralDrivers.length > 0) {
      setFieldUntyped(graph, 'audience', 'behavioralDrivers', behavioralDrivers, lowConfProvenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.behavioralDrivers');
    }

    // ========================================================================
    // Demand States
    // ========================================================================
    const demandStates = new Set<string>();
    for (const segment of segments) {
      if (segment.primaryDemandState) {
        demandStates.add(segment.primaryDemandState);
      }
      if (segment.secondaryDemandStates) {
        for (const state of segment.secondaryDemandStates) {
          demandStates.add(state);
        }
      }
    }

    if (demandStates.size > 0) {
      setFieldUntyped(graph, 'audience', 'demandStates', Array.from(demandStates), provenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.demandStates');
    }

    // ========================================================================
    // Channel Preferences
    // ========================================================================
    const priorityChannels = new Set<string>();
    const avoidChannels = new Set<string>();

    for (const segment of segments) {
      if (segment.priorityChannels) {
        for (const ch of segment.priorityChannels) {
          priorityChannels.add(ch);
        }
      }
      if (segment.avoidChannels) {
        for (const ch of segment.avoidChannels) {
          avoidChannels.add(ch);
        }
      }
    }

    if (priorityChannels.size > 0) {
      setFieldUntyped(graph, 'audience', 'preferredChannels', Array.from(priorityChannels), lowConfProvenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.preferredChannels');
    }

    // ========================================================================
    // Content Preferences
    // ========================================================================
    const contentFormats = aggregateArrayField(segments, 'recommendedFormats');
    if (contentFormats.length > 0) {
      setFieldUntyped(graph, 'audience', 'contentFormatsPreferred', contentFormats, lowConfProvenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.contentFormatsPreferred');
    }

    const creativeAngles = aggregateArrayField(segments, 'creativeAngles');
    if (creativeAngles.length > 0) {
      setFieldUntyped(graph, 'audience', 'exampleHooks', creativeAngles, lowConfProvenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.exampleHooks');
    }

    // ========================================================================
    // Demographics aggregate
    // ========================================================================
    const demographicsNotes: string[] = [];
    for (const segment of segments) {
      if (segment.demographics) {
        demographicsNotes.push(`${segment.name}: ${segment.demographics}`);
      }
    }
    if (demographicsNotes.length > 0) {
      setFieldUntyped(graph, 'audience', 'demographics', demographicsNotes.join('; '), lowConfProvenance);
      summary.fieldsUpdated++;
      summary.updatedPaths.push('audience.demographics');
    }

    // ========================================================================
    // Update history refs
    // ========================================================================
    if (runId || model.id) {
      setDomainFields(
        graph,
        'historyRefs',
        { latestAudienceLabRunId: runId || model.id } as Record<string, unknown>,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('historyRefs.latestAudienceLabRunId');
    }

  } catch (error) {
    summary.errors.push(`Error writing AudienceLab data: ${error}`);
  }

  console.log(
    `[AudienceLabWriter] Updated ${summary.fieldsUpdated} fields, errors: ${summary.errors.length}`
  );

  return summary;
}

/**
 * Write AudienceModel to Context Graph and save
 */
export async function writeAudienceLabAndSave(
  companyId: string,
  model: AudienceModel,
  runId?: string
): Promise<{
  graph: CompanyContextGraph;
  summary: AudienceLabWriterResult;
}> {
  const { loadContextGraph } = await import('./storage');
  const { createEmptyContextGraph } = await import('./companyContextGraph');

  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, companyId);
  }

  const summary = writeAudienceLabToGraph(graph, model, runId);
  await saveContextGraph(graph, 'audience_lab');

  return { graph, summary };
}
