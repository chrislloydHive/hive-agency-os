// lib/contextGraph/creativeLabWriter.ts
// Creative Lab Domain Writer - Maps Creative Lab output to Context Graph
//
// This writer takes Creative Lab output (messaging, territories, concepts, guidelines)
// and writes normalized facts into the Context Graph.

import type { CompanyContextGraph } from './companyContextGraph';
import type { ProvenanceTag } from './types';
import { setFieldUntyped, setDomainFields, createProvenance } from './mutate';
import { saveContextGraph } from './storage';
import type {
  MessagingArchitecture,
  SegmentMessage,
  CreativeTerritory,
  CampaignConcept,
  CreativeGuidelines,
  ChannelPatterns,
  CampaignConceptExtended,
  TestingRoadmapItem,
  AssetSpec,
} from './domains/creative';

// ============================================================================
// Types
// ============================================================================

/**
 * Creative Lab output structure (basic)
 */
export interface CreativeLabOutput {
  messaging: MessagingArchitecture;
  segmentMessages: Record<string, SegmentMessage>;
  creativeTerritories: CreativeTerritory[];
  campaignConcepts: CampaignConcept[];
  guidelines: CreativeGuidelines;
}

/**
 * Extended Creative Lab output structure (with channel patterns, testing, assets)
 */
export interface CreativeLabOutputExtended extends CreativeLabOutput {
  channelPatterns?: ChannelPatterns;
  campaignConceptsExtended?: CampaignConceptExtended[];
  testingRoadmap?: TestingRoadmapItem[];
  assetSpecs?: AssetSpec[];
}

/**
 * Result of writing Creative Lab output to Context Graph
 */
export interface CreativeLabWriterResult {
  fieldsUpdated: number;
  updatedPaths: string[];
  skippedPaths: string[];
  errors: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default confidence for Creative Lab mappings
 */
const CREATIVE_LAB_CONFIDENCE = 0.8;
const CREATIVE_LAB_CONFIDENCE_LOW = 0.65;

// ============================================================================
// Provenance Helpers
// ============================================================================

/**
 * Create provenance tag for Creative Lab source
 */
function createCreativeLabProvenance(
  runId: string | undefined,
  confidence: number = CREATIVE_LAB_CONFIDENCE
): ProvenanceTag {
  return createProvenance('creative_lab', {
    runId,
    sourceRunId: runId,
    confidence,
    validForDays: 90, // Creative strategy valid for ~90 days
  });
}

// ============================================================================
// Main Writer Function
// ============================================================================

/**
 * Write Creative Lab output to Context Graph
 *
 * @param graph - The context graph to update
 * @param output - Creative Lab output data (basic or extended)
 * @param runId - Optional run ID for provenance tracking
 * @returns Summary of what was updated
 */
export function writeCreativeLabToGraph(
  graph: CompanyContextGraph,
  output: CreativeLabOutput | CreativeLabOutputExtended,
  runId?: string
): CreativeLabWriterResult {
  const summary: CreativeLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  const provenance = createCreativeLabProvenance(runId);
  const lowConfProvenance = createCreativeLabProvenance(runId, CREATIVE_LAB_CONFIDENCE_LOW);

  try {
    // ========================================================================
    // Write Messaging Architecture
    // ========================================================================
    if (output.messaging) {
      setFieldUntyped(
        graph,
        'creative',
        'messaging',
        output.messaging,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('creative.messaging');

      // Also populate legacy fields for backward compatibility
      if (output.messaging.proofPoints?.length) {
        setFieldUntyped(
          graph,
          'creative',
          'proofPoints',
          output.messaging.proofPoints,
          lowConfProvenance
        );
        summary.fieldsUpdated++;
        summary.updatedPaths.push('creative.proofPoints');
      }

      if (output.messaging.differentiators?.length) {
        // Also write to brand domain for cross-reference
        setFieldUntyped(
          graph,
          'brand',
          'differentiators',
          output.messaging.differentiators,
          lowConfProvenance
        );
        summary.fieldsUpdated++;
        summary.updatedPaths.push('brand.differentiators');
      }
    }

    // ========================================================================
    // Write Segment Messages
    // ========================================================================
    if (output.segmentMessages && Object.keys(output.segmentMessages).length > 0) {
      setFieldUntyped(
        graph,
        'creative',
        'segmentMessages',
        output.segmentMessages,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('creative.segmentMessages');

      // Extract all CTAs across segments for legacy field
      const allCtas = new Set<string>();
      for (const segMsg of Object.values(output.segmentMessages)) {
        if (segMsg.ctas) {
          for (const cta of segMsg.ctas) {
            allCtas.add(cta);
          }
        }
      }
      if (allCtas.size > 0) {
        setFieldUntyped(
          graph,
          'creative',
          'callToActions',
          Array.from(allCtas),
          lowConfProvenance
        );
        summary.fieldsUpdated++;
        summary.updatedPaths.push('creative.callToActions');
      }

      // Extract core messages from segment value props
      const coreMessages = Object.values(output.segmentMessages)
        .map((seg) => seg.valueProp)
        .filter(Boolean);
      if (coreMessages.length > 0) {
        setFieldUntyped(
          graph,
          'creative',
          'coreMessages',
          coreMessages,
          lowConfProvenance
        );
        summary.fieldsUpdated++;
        summary.updatedPaths.push('creative.coreMessages');
      }
    }

    // ========================================================================
    // Write Creative Territories
    // ========================================================================
    if (output.creativeTerritories?.length) {
      setFieldUntyped(
        graph,
        'creative',
        'creativeTerritories',
        output.creativeTerritories,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('creative.creativeTerritories');
    }

    // ========================================================================
    // Write Campaign Concepts
    // ========================================================================
    if (output.campaignConcepts?.length) {
      setFieldUntyped(
        graph,
        'creative',
        'campaignConcepts',
        output.campaignConcepts,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('creative.campaignConcepts');
    }

    // ========================================================================
    // Write Guidelines
    // ========================================================================
    if (output.guidelines) {
      setFieldUntyped(
        graph,
        'creative',
        'guidelines',
        output.guidelines,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('creative.guidelines');

      // Also populate legacy fields
      if (output.guidelines.voice) {
        setFieldUntyped(
          graph,
          'brand',
          'toneOfVoice',
          output.guidelines.voice,
          lowConfProvenance
        );
        summary.fieldsUpdated++;
        summary.updatedPaths.push('brand.toneOfVoice');
      }

      if (output.guidelines.visual) {
        setFieldUntyped(
          graph,
          'creative',
          'visualIdentityNotes',
          output.guidelines.visual,
          lowConfProvenance
        );
        summary.fieldsUpdated++;
        summary.updatedPaths.push('creative.visualIdentityNotes');
      }

      if (output.guidelines.testingRoadmap?.length) {
        setFieldUntyped(
          graph,
          'creative',
          'testingRoadmap',
          output.guidelines.testingRoadmap.join('\n'),
          lowConfProvenance
        );
        summary.fieldsUpdated++;
        summary.updatedPaths.push('creative.testingRoadmap');
      }
    }

    // ========================================================================
    // Write Extended Fields (Phase 3)
    // ========================================================================
    const extendedOutput = output as CreativeLabOutputExtended;

    // Channel Patterns
    if (extendedOutput.channelPatterns && Object.keys(extendedOutput.channelPatterns).length > 0) {
      setFieldUntyped(
        graph,
        'creative',
        'channelPatterns',
        extendedOutput.channelPatterns,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('creative.channelPatterns');
    }

    // Extended Campaign Concepts (with testing plans)
    if (extendedOutput.campaignConceptsExtended?.length) {
      setFieldUntyped(
        graph,
        'creative',
        'campaignConceptsExtended',
        extendedOutput.campaignConceptsExtended,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('creative.campaignConceptsExtended');
    }

    // Testing Roadmap Items
    if (extendedOutput.testingRoadmap?.length) {
      setFieldUntyped(
        graph,
        'creative',
        'testingRoadmapItems',
        extendedOutput.testingRoadmap,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('creative.testingRoadmapItems');
    }

    // Asset Specs
    if (extendedOutput.assetSpecs?.length) {
      setFieldUntyped(
        graph,
        'creative',
        'assetSpecs',
        extendedOutput.assetSpecs,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('creative.assetSpecs');
    }

    // ========================================================================
    // Update history refs
    // ========================================================================
    if (runId) {
      setDomainFields(
        graph,
        'historyRefs',
        { latestCreativeLabRunId: runId } as Record<string, unknown>,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('historyRefs.latestCreativeLabRunId');
    }

  } catch (error) {
    summary.errors.push(`Error writing CreativeLab data: ${error}`);
  }

  console.log(
    `[CreativeLabWriter] Updated ${summary.fieldsUpdated} fields, errors: ${summary.errors.length}`
  );

  return summary;
}

/**
 * Write Creative Lab output to Context Graph and save
 */
export async function writeCreativeLabAndSave(
  companyId: string,
  output: CreativeLabOutput | CreativeLabOutputExtended,
  runId?: string
): Promise<{
  graph: CompanyContextGraph;
  summary: CreativeLabWriterResult;
}> {
  const { loadContextGraph } = await import('./storage');
  const { createEmptyContextGraph } = await import('./companyContextGraph');

  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, companyId);
  }

  const summary = writeCreativeLabToGraph(graph, output, runId);
  await saveContextGraph(graph, 'creative_lab');

  return { graph, summary };
}

// ============================================================================
// Partial Writers for Section Updates
// ============================================================================

/**
 * Write only messaging architecture to Context Graph
 */
export async function writeMessagingToGraph(
  companyId: string,
  messaging: MessagingArchitecture,
  runId?: string
): Promise<CreativeLabWriterResult> {
  const { loadContextGraph } = await import('./storage');
  const { createEmptyContextGraph } = await import('./companyContextGraph');

  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, companyId);
  }

  const summary: CreativeLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  const provenance = createCreativeLabProvenance(runId);

  try {
    setFieldUntyped(graph, 'creative', 'messaging', messaging, provenance);
    summary.fieldsUpdated++;
    summary.updatedPaths.push('creative.messaging');

    await saveContextGraph(graph, 'creative_lab');
  } catch (error) {
    summary.errors.push(`Error writing messaging: ${error}`);
  }

  return summary;
}

/**
 * Write only creative territories to Context Graph
 */
export async function writeTerrritoriesToGraph(
  companyId: string,
  territories: CreativeTerritory[],
  runId?: string
): Promise<CreativeLabWriterResult> {
  const { loadContextGraph } = await import('./storage');
  const { createEmptyContextGraph } = await import('./companyContextGraph');

  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, companyId);
  }

  const summary: CreativeLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  const provenance = createCreativeLabProvenance(runId);

  try {
    setFieldUntyped(graph, 'creative', 'creativeTerritories', territories, provenance);
    summary.fieldsUpdated++;
    summary.updatedPaths.push('creative.creativeTerritories');

    await saveContextGraph(graph, 'creative_lab');
  } catch (error) {
    summary.errors.push(`Error writing territories: ${error}`);
  }

  return summary;
}

/**
 * Write only campaign concepts to Context Graph
 */
export async function writeCampaignConceptsToGraph(
  companyId: string,
  concepts: CampaignConcept[],
  runId?: string
): Promise<CreativeLabWriterResult> {
  const { loadContextGraph } = await import('./storage');
  const { createEmptyContextGraph } = await import('./companyContextGraph');

  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, companyId);
  }

  const summary: CreativeLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  const provenance = createCreativeLabProvenance(runId);

  try {
    setFieldUntyped(graph, 'creative', 'campaignConcepts', concepts, provenance);
    summary.fieldsUpdated++;
    summary.updatedPaths.push('creative.campaignConcepts');

    await saveContextGraph(graph, 'creative_lab');
  } catch (error) {
    summary.errors.push(`Error writing campaign concepts: ${error}`);
  }

  return summary;
}

/**
 * Write only guidelines to Context Graph
 */
export async function writeGuidelinesToGraph(
  companyId: string,
  guidelines: CreativeGuidelines,
  runId?: string
): Promise<CreativeLabWriterResult> {
  const { loadContextGraph } = await import('./storage');
  const { createEmptyContextGraph } = await import('./companyContextGraph');

  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, companyId);
  }

  const summary: CreativeLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  const provenance = createCreativeLabProvenance(runId);

  try {
    setFieldUntyped(graph, 'creative', 'guidelines', guidelines, provenance);
    summary.fieldsUpdated++;
    summary.updatedPaths.push('creative.guidelines');

    await saveContextGraph(graph, 'creative_lab');
  } catch (error) {
    summary.errors.push(`Error writing guidelines: ${error}`);
  }

  return summary;
}
