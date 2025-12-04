// lib/contextGraph/updateFromPersonas.ts
// Update Context Graph from Persona Set
//
// Writes persona data into the Context Graph audience domain
// with proper provenance tracking from 'audience_personas'.

import type { CompanyContextGraph } from './companyContextGraph';
import type { PersonaSet, Persona } from '@/lib/audience/personas';
import type { ProvenanceTag } from './types';
import { setDomainFields, createProvenance } from './mutate';
import { saveContextGraph } from './storage';

// ============================================================================
// Types
// ============================================================================

export interface UpdateFromPersonasResult {
  success: boolean;
  fieldsUpdated: string[];
  error?: string;
}

// ============================================================================
// Main Update Function
// ============================================================================

/**
 * Update Context Graph audience domain from a Persona Set
 *
 * This function:
 * 1. Aggregates persona data into summary fields
 * 2. Updates the audience domain with provenance = 'audience_personas'
 * 3. Saves the updated graph
 *
 * @param graph - The Context Graph to update
 * @param personaSet - The PersonaSet to extract data from
 * @param options - Additional options
 * @returns Result indicating success and fields updated
 */
export async function updateGraphFromPersonaSet(
  graph: CompanyContextGraph,
  personaSet: PersonaSet,
  options?: {
    setRunId?: string;
    notes?: string;
    saveGraph?: boolean; // If true, saves the graph after update (default: true)
  }
): Promise<UpdateFromPersonasResult> {
  const shouldSave = options?.saveGraph !== false;

  try {
    console.log('[updateFromPersonas] Updating graph from persona set:', personaSet.id);

    // Create provenance tag for this update
    const provenance: ProvenanceTag = createProvenance('audience_personas', {
      confidence: 0.9,
      sourceRunId: personaSet.id,
      runId: options?.setRunId,
      notes: options?.notes || 'Audience Personas set',
      validForDays: 120, // 4 months
    });

    // Extract aggregated data from personas
    const aggregated = aggregatePersonaData(personaSet.personas);
    const fieldsUpdated: string[] = [];

    // Update audience domain fields
    const audienceUpdates: Record<string, unknown> = {};

    // Persona Names
    if (aggregated.personaNames.length > 0) {
      audienceUpdates.personaNames = aggregated.personaNames;
      fieldsUpdated.push('personaNames');
    }

    // Persona Briefs (for quick reference)
    if (aggregated.personaBriefs.length > 0) {
      audienceUpdates.personaBriefs = aggregated.personaBriefs;
      fieldsUpdated.push('personaBriefs');
    }

    // Jobs to be Done (aggregated across personas)
    if (aggregated.jobsToBeDone.length > 0) {
      audienceUpdates.audienceNeeds = aggregated.jobsToBeDone;
      fieldsUpdated.push('audienceNeeds');
    }

    // Triggers (what prompts action)
    if (aggregated.triggers.length > 0) {
      audienceUpdates.audienceTriggers = aggregated.triggers;
      fieldsUpdated.push('audienceTriggers');
    }

    // Objections (hesitations and concerns)
    if (aggregated.objections.length > 0) {
      audienceUpdates.audienceObjections = aggregated.objections;
      fieldsUpdated.push('audienceObjections');
    }

    // Decision Factors
    if (aggregated.decisionFactors.length > 0) {
      audienceUpdates.decisionFactors = aggregated.decisionFactors;
      fieldsUpdated.push('decisionFactors');
    }

    // Key Messages (that resonate)
    if (aggregated.keyMessages.length > 0) {
      audienceUpdates.keyMessages = aggregated.keyMessages;
      fieldsUpdated.push('keyMessages');
    }

    // Proof Points (what evidence they need)
    if (aggregated.proofPoints.length > 0) {
      audienceUpdates.proofPointsNeeded = aggregated.proofPoints;
      fieldsUpdated.push('proofPointsNeeded');
    }

    // Example Hooks (ready-to-use copy hooks)
    if (aggregated.exampleHooks.length > 0) {
      audienceUpdates.exampleHooks = aggregated.exampleHooks;
      fieldsUpdated.push('exampleHooks');
    }

    // Media Habits (aggregated)
    if (aggregated.mediaHabits.length > 0) {
      audienceUpdates.mediaHabits = aggregated.mediaHabits.join(' | ');
      fieldsUpdated.push('mediaHabits');
    }

    // Preferred Channels (aggregated from channelsToUse)
    if (aggregated.preferredChannels.length > 0) {
      audienceUpdates.preferredChannels = aggregated.preferredChannels;
      fieldsUpdated.push('preferredChannels');
    }

    // Content Formats Preferred
    if (aggregated.contentFormats.length > 0) {
      audienceUpdates.contentFormatsPreferred = aggregated.contentFormats;
      fieldsUpdated.push('contentFormatsPreferred');
    }

    // Tone Guidance (aggregated)
    if (aggregated.toneGuidance.length > 0) {
      audienceUpdates.toneGuidance = aggregated.toneGuidance.join(' | ');
      fieldsUpdated.push('toneGuidance');
    }

    // Apply the updates
    if (Object.keys(audienceUpdates).length > 0) {
      setDomainFields(graph, 'audience', audienceUpdates as any, provenance);
    }

    // Save the graph if requested
    if (shouldSave && fieldsUpdated.length > 0) {
      await saveContextGraph(graph);
      console.log('[updateFromPersonas] Saved graph with', fieldsUpdated.length, 'audience fields');
    }

    return {
      success: true,
      fieldsUpdated,
    };
  } catch (error) {
    console.error('[updateFromPersonas] Failed to update graph:', error);
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

interface PersonaBrief {
  name: string;
  tagline: string | null;
  oneSentenceSummary: string | null;
  priority: string | null;
}

interface AggregatedPersonaData {
  personaNames: string[];
  personaBriefs: PersonaBrief[];
  jobsToBeDone: string[];
  triggers: string[];
  objections: string[];
  decisionFactors: string[];
  keyMessages: string[];
  proofPoints: string[];
  exampleHooks: string[];
  mediaHabits: string[];
  preferredChannels: string[];
  contentFormats: string[];
  toneGuidance: string[];
}

/**
 * Aggregate data from multiple personas into summary arrays
 */
function aggregatePersonaData(personas: Persona[]): AggregatedPersonaData {
  const result: AggregatedPersonaData = {
    personaNames: [],
    personaBriefs: [],
    jobsToBeDone: [],
    triggers: [],
    objections: [],
    decisionFactors: [],
    keyMessages: [],
    proofPoints: [],
    exampleHooks: [],
    mediaHabits: [],
    preferredChannels: [],
    contentFormats: [],
    toneGuidance: [],
  };

  for (const persona of personas) {
    // Persona name
    if (persona.name) {
      result.personaNames.push(persona.name);
    }

    // Persona brief
    result.personaBriefs.push({
      name: persona.name,
      tagline: persona.tagline || null,
      oneSentenceSummary: persona.oneSentenceSummary || null,
      priority: persona.priority || null,
    });

    // Jobs to be done
    if (persona.jobsToBeDone?.length) {
      result.jobsToBeDone.push(...persona.jobsToBeDone);
    }

    // Triggers
    if (persona.triggers?.length) {
      result.triggers.push(...persona.triggers);
    }

    // Objections
    if (persona.objections?.length) {
      result.objections.push(...persona.objections);
    }

    // Decision factors
    if (persona.decisionFactors?.length) {
      result.decisionFactors.push(...persona.decisionFactors);
    }

    // Key messages
    if (persona.keyMessages?.length) {
      result.keyMessages.push(...persona.keyMessages);
    }

    // Proof points
    if (persona.proofPoints?.length) {
      result.proofPoints.push(...persona.proofPoints);
    }

    // Example hooks
    if (persona.exampleHooks?.length) {
      result.exampleHooks.push(...persona.exampleHooks);
    }

    // Media habits
    if (persona.mediaHabits) {
      result.mediaHabits.push(persona.mediaHabits);
    }

    // Preferred channels
    if (persona.channelsToUse?.length) {
      result.preferredChannels.push(...persona.channelsToUse);
    }

    // Content formats
    if (persona.contentFormatsPreferred?.length) {
      result.contentFormats.push(...persona.contentFormatsPreferred);
    }

    // Tone guidance
    if (persona.toneGuidance) {
      result.toneGuidance.push(persona.toneGuidance);
    }
  }

  // Deduplicate arrays (case-insensitive for strings)
  result.jobsToBeDone = dedupeStrings(result.jobsToBeDone);
  result.triggers = dedupeStrings(result.triggers);
  result.objections = dedupeStrings(result.objections);
  result.decisionFactors = dedupeStrings(result.decisionFactors);
  result.keyMessages = dedupeStrings(result.keyMessages);
  result.proofPoints = dedupeStrings(result.proofPoints);
  result.exampleHooks = dedupeStrings(result.exampleHooks);
  result.preferredChannels = dedupeStrings(result.preferredChannels);
  result.contentFormats = dedupeStrings(result.contentFormats);

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
 * Check if the Context Graph has persona data from Audience Personas
 */
export function hasPersonasData(graph: CompanyContextGraph): boolean {
  const audience = graph.audience;
  if (!audience) return false;

  // Check if any provenance has source = 'audience_personas'
  const fieldsToCheck = [
    (audience as any).personaNames,
    (audience as any).personaBriefs,
    (audience as any).audienceTriggers,
    (audience as any).audienceObjections,
  ];

  for (const field of fieldsToCheck) {
    if (field?.provenance?.some((p: ProvenanceTag) => p.source === 'audience_personas')) {
      return true;
    }
  }

  return false;
}

/**
 * Get the last Audience Personas update timestamp from the graph
 */
export function getLastPersonasUpdate(graph: CompanyContextGraph): string | null {
  const audience = graph.audience;
  if (!audience) return null;

  // Find the most recent audience_personas provenance
  let latestDate: string | null = null;

  const fieldsToCheck = [
    (audience as any).personaNames,
    (audience as any).personaBriefs,
  ];

  for (const field of fieldsToCheck) {
    const personasProvenance = field?.provenance?.find(
      (p: ProvenanceTag) => p.source === 'audience_personas'
    );
    if (personasProvenance?.updatedAt) {
      if (!latestDate || personasProvenance.updatedAt > latestDate) {
        latestDate = personasProvenance.updatedAt;
      }
    }
  }

  return latestDate;
}
