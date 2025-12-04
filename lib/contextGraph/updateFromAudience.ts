// lib/contextGraph/updateFromAudience.ts
// Update Context Graph from Audience Model
//
// Writes the canonical audience model data into the Context Graph
// audience domain with proper provenance tracking.

import type { CompanyContextGraph } from './companyContextGraph';
import type { AudienceModel, AudienceSegment } from '@/lib/audience/model';
import type { ProvenanceTag } from './types';
import { setDomainFields, createProvenance } from './mutate';
import { saveContextGraph } from './storage';

// ============================================================================
// Types
// ============================================================================

export interface UpdateFromAudienceResult {
  success: boolean;
  fieldsUpdated: string[];
  error?: string;
}

// ============================================================================
// Main Update Function
// ============================================================================

/**
 * Update Context Graph audience domain from an Audience Model
 *
 * This function:
 * 1. Aggregates segment data into summary fields
 * 2. Updates the audience domain with provenance = 'audience_lab'
 * 3. Saves the updated graph
 *
 * @param graph - The Context Graph to update
 * @param model - The Audience Model to extract data from
 * @param options - Additional options
 * @returns Result indicating success and fields updated
 */
export async function updateGraphFromAudienceModel(
  graph: CompanyContextGraph,
  model: AudienceModel,
  options?: {
    modelRunId?: string;
    notes?: string;
    saveGraph?: boolean; // If true, saves the graph after update (default: true)
  }
): Promise<UpdateFromAudienceResult> {
  const shouldSave = options?.saveGraph !== false;

  try {
    console.log('[updateFromAudience] Updating graph from audience model:', model.id);

    // Create provenance tag for this update
    const provenance: ProvenanceTag = createProvenance('audience_lab', {
      confidence: 0.9,
      sourceRunId: model.id,
      runId: options?.modelRunId,
      notes: options?.notes || 'Audience Lab canonical model',
      validForDays: 120, // 4 months
    });

    // Extract aggregated data from segments
    const aggregated = aggregateSegmentData(model.segments);
    const fieldsUpdated: string[] = [];

    // Update audience domain fields
    // Note: We use setDomainFields which replaces values (not merges)
    // This is intentional - Audience Lab is the canonical source for these fields

    const audienceUpdates: Record<string, unknown> = {};

    // Core Segments (names)
    if (aggregated.segmentNames.length > 0) {
      audienceUpdates.coreSegments = aggregated.segmentNames;
      fieldsUpdated.push('coreSegments');
    }

    // Segment Details (full segment objects converted to Context Graph format)
    if (model.segments.length > 0) {
      audienceUpdates.segmentDetails = model.segments.map(s => ({
        name: s.name,
        description: s.description || null,
        size: s.estimatedSize || null,
        priority: s.priority || null,
        demographics: s.demographics || null,
        behaviors: s.behavioralDrivers?.join(', ') || null,
      }));
      fieldsUpdated.push('segmentDetails');
    }

    // Demographics (aggregated)
    if (aggregated.allDemographics.length > 0) {
      audienceUpdates.demographics = aggregated.allDemographics.join(' | ');
      fieldsUpdated.push('demographics');
    }

    // Geos (aggregated)
    if (aggregated.allGeos.length > 0) {
      audienceUpdates.geos = aggregated.allGeos.join(' | ');
      fieldsUpdated.push('geos');
    }

    // Behavioral Drivers (deduplicated)
    if (aggregated.behavioralDrivers.length > 0) {
      audienceUpdates.behavioralDrivers = aggregated.behavioralDrivers;
      fieldsUpdated.push('behavioralDrivers');
    }

    // Demand States (deduplicated)
    if (aggregated.demandStates.length > 0) {
      audienceUpdates.demandStates = aggregated.demandStates;
      fieldsUpdated.push('demandStates');
    }

    // Media Habits (aggregated)
    if (aggregated.mediaHabits.length > 0) {
      audienceUpdates.mediaHabits = aggregated.mediaHabits.join(' | ');
      fieldsUpdated.push('mediaHabits');
    }

    // Pain Points (deduplicated from keyPains)
    if (aggregated.painPoints.length > 0) {
      audienceUpdates.painPoints = aggregated.painPoints;
      fieldsUpdated.push('painPoints');
    }

    // Motivations (deduplicated from keyGoals)
    if (aggregated.motivations.length > 0) {
      audienceUpdates.motivations = aggregated.motivations;
      fieldsUpdated.push('motivations');
    }

    // Audience Needs (jobs to be done)
    if (aggregated.audienceNeeds.length > 0) {
      audienceUpdates.audienceNeeds = aggregated.audienceNeeds;
      fieldsUpdated.push('audienceNeeds');
    }

    // Preferred Channels (aggregated from priorityChannels)
    if (aggregated.preferredChannels.length > 0) {
      audienceUpdates.preferredChannels = aggregated.preferredChannels;
      fieldsUpdated.push('preferredChannels');
    }

    // Apply the updates
    if (Object.keys(audienceUpdates).length > 0) {
      setDomainFields(graph, 'audience', audienceUpdates as any, provenance);
    }

    // Save the graph if requested
    if (shouldSave && fieldsUpdated.length > 0) {
      await saveContextGraph(graph);
      console.log('[updateFromAudience] Saved graph with', fieldsUpdated.length, 'audience fields');
    }

    return {
      success: true,
      fieldsUpdated,
    };
  } catch (error) {
    console.error('[updateFromAudience] Failed to update graph:', error);
    return {
      success: false,
      fieldsUpdated: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Data Aggregation
// ============================================================================

interface AggregatedSegmentData {
  segmentNames: string[];
  allDemographics: string[];
  allGeos: string[];
  behavioralDrivers: string[];
  demandStates: string[];
  mediaHabits: string[];
  painPoints: string[];
  motivations: string[];
  audienceNeeds: string[];
  preferredChannels: string[];
}

/**
 * Aggregate data from multiple segments into summary arrays
 */
function aggregateSegmentData(segments: AudienceSegment[]): AggregatedSegmentData {
  const result: AggregatedSegmentData = {
    segmentNames: [],
    allDemographics: [],
    allGeos: [],
    behavioralDrivers: [],
    demandStates: [],
    mediaHabits: [],
    painPoints: [],
    motivations: [],
    audienceNeeds: [],
    preferredChannels: [],
  };

  for (const segment of segments) {
    // Segment name
    if (segment.name) {
      result.segmentNames.push(segment.name);
    }

    // Demographics
    if (segment.demographics) {
      result.allDemographics.push(segment.demographics);
    }

    // Geos
    if (segment.geos) {
      result.allGeos.push(segment.geos);
    }

    // Behavioral drivers
    if (segment.behavioralDrivers?.length) {
      result.behavioralDrivers.push(...segment.behavioralDrivers);
    }

    // Demand states
    if (segment.primaryDemandState) {
      result.demandStates.push(segment.primaryDemandState);
    }
    if (segment.secondaryDemandStates?.length) {
      result.demandStates.push(...segment.secondaryDemandStates);
    }

    // Media habits
    if (segment.mediaHabits) {
      result.mediaHabits.push(segment.mediaHabits);
    }

    // Pain points (from keyPains)
    if (segment.keyPains?.length) {
      result.painPoints.push(...segment.keyPains);
    }

    // Motivations (from keyGoals)
    if (segment.keyGoals?.length) {
      result.motivations.push(...segment.keyGoals);
    }

    // Audience needs (from jobsToBeDone)
    if (segment.jobsToBeDone?.length) {
      result.audienceNeeds.push(...segment.jobsToBeDone);
    }

    // Preferred channels
    if (segment.priorityChannels?.length) {
      result.preferredChannels.push(...segment.priorityChannels);
    }
  }

  // Deduplicate arrays (case-insensitive for strings)
  result.behavioralDrivers = dedupeStrings(result.behavioralDrivers);
  result.demandStates = dedupeStrings(result.demandStates);
  result.painPoints = dedupeStrings(result.painPoints);
  result.motivations = dedupeStrings(result.motivations);
  result.audienceNeeds = dedupeStrings(result.audienceNeeds);
  result.preferredChannels = dedupeStrings(result.preferredChannels);

  return result;
}

/**
 * Deduplicate string array (case-insensitive)
 */
function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of arr) {
    const lower = item.toLowerCase().trim();
    if (!seen.has(lower) && item.trim().length > 0) {
      seen.add(lower);
      result.push(item.trim());
    }
  }

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if the Context Graph has audience data from Audience Lab
 */
export function hasAudienceLabData(graph: CompanyContextGraph): boolean {
  const audience = graph.audience;
  if (!audience) return false;

  // Check if any provenance has source = 'audience_lab'
  const fieldsToCheck = [
    audience.coreSegments,
    audience.segmentDetails,
    audience.demographics,
    audience.behavioralDrivers,
    audience.demandStates,
  ];

  for (const field of fieldsToCheck) {
    if (field?.provenance?.some(p => p.source === 'audience_lab')) {
      return true;
    }
  }

  return false;
}

/**
 * Get the last Audience Lab update timestamp from the graph
 */
export function getLastAudienceLabUpdate(graph: CompanyContextGraph): string | null {
  const audience = graph.audience;
  if (!audience) return null;

  // Find the most recent audience_lab provenance
  let latestDate: string | null = null;

  const fieldsToCheck = [
    audience.coreSegments,
    audience.segmentDetails,
    audience.demographics,
  ];

  for (const field of fieldsToCheck) {
    const labProvenance = field?.provenance?.find(p => p.source === 'audience_lab');
    if (labProvenance?.updatedAt) {
      if (!latestDate || labProvenance.updatedAt > latestDate) {
        latestDate = labProvenance.updatedAt;
      }
    }
  }

  return latestDate;
}
