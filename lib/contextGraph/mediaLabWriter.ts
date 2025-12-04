// lib/contextGraph/mediaLabWriter.ts
// MediaLab Domain Writer - Maps MediaLabData to Context Graph
//
// This writer takes MediaLab data (plans, channels, flights) and writes
// normalized facts into the Context Graph.

import type { CompanyContextGraph } from './companyContextGraph';
import type { ProvenanceTag } from './types';
import { setFieldUntyped, setDomainFields, createProvenance } from './mutate';
import { saveContextGraph } from './storage';
import type {
  MediaLabData,
  MediaPlanWithDetails,
  MediaChannelKey,
  MediaObjective,
} from '@/lib/types/mediaLab';

// ============================================================================
// MAPPING CONFIGURATION
// ============================================================================

/**
 * Default confidence for MediaLab mappings
 */
const MEDIA_LAB_CONFIDENCE = 0.75;

/**
 * Map MediaObjective to PrimaryObjective enum value
 */
function mapObjectiveToEnum(objective: MediaObjective | null): string | null {
  if (!objective) return null;
  const mapping: Record<MediaObjective, string> = {
    installs: 'installs',
    leads: 'lead_generation',
    store_visits: 'store_traffic',
    calls: 'lead_generation', // calls are a form of lead gen
    awareness: 'awareness',
  };
  return mapping[objective] || null;
}

/**
 * Map MediaChannelKey to MediaChannelId enum value
 */
function mapChannelToEnum(channel: MediaChannelKey): string {
  const mapping: Record<MediaChannelKey, string> = {
    google_search: 'google_search',
    google_lsas: 'google_lsa',
    google_maps_gbp: 'google_gbp',
    google_youtube: 'youtube',
    google_display: 'google_display',
    paid_social_meta: 'meta',
    microsoft_search: 'microsoft_ads',
    tiktok_social: 'tiktok',
    display_retarg: 'programmatic',
    email_marketing: 'email',
    affiliate: 'affiliate',
    radio: 'radio',
    tv: 'tv',
    streaming_audio: 'spotify',
    out_of_home: 'ooh',
    print: 'print',
    direct_mail: 'direct_mail',
    other: 'other',
  };
  return mapping[channel] || 'other';
}

/**
 * Create provenance tag for MediaLab source
 */
function createMediaLabProvenance(
  runId: string | undefined,
  confidence: number = MEDIA_LAB_CONFIDENCE
): ProvenanceTag {
  return createProvenance('media_lab', {
    runId,
    sourceRunId: runId,
    confidence,
    validForDays: 60, // Media plans valid for ~60 days
  });
}

// ============================================================================
// MAIN WRITER FUNCTION
// ============================================================================

export interface MediaLabWriterResult {
  fieldsUpdated: number;
  updatedPaths: string[];
  skippedPaths: string[];
  errors: string[];
}

/**
 * Write MediaLab data to Context Graph
 *
 * @param graph - The context graph to update
 * @param data - MediaLabData containing plans, channels, flights
 * @param runId - Optional run ID for provenance tracking
 * @returns Summary of what was updated
 */
export function writeMediaLabToGraph(
  graph: CompanyContextGraph,
  data: MediaLabData,
  runId?: string
): MediaLabWriterResult {
  const summary: MediaLabWriterResult = {
    fieldsUpdated: 0,
    updatedPaths: [],
    skippedPaths: [],
    errors: [],
  };

  const provenance = createMediaLabProvenance(runId);
  const highConfProvenance = createMediaLabProvenance(runId, 0.85);

  try {
    // ========================================================================
    // Summary-level fields
    // ========================================================================
    if (data.summary) {
      // Primary objective
      if (data.summary.primaryObjective) {
        const mappedObjective = mapObjectiveToEnum(data.summary.primaryObjective);
        if (mappedObjective) {
          setFieldUntyped(graph, 'objectives', 'primaryObjective', mappedObjective, highConfProvenance);
          summary.fieldsUpdated++;
          summary.updatedPaths.push('objectives.primaryObjective');
        }
      }

      // Primary markets
      if (data.summary.primaryMarkets) {
        const markets = data.summary.primaryMarkets.split(',').map(m => m.trim()).filter(Boolean);
        if (markets.length > 0) {
          setFieldUntyped(graph, 'audience', 'primaryMarkets', markets, provenance);
          summary.fieldsUpdated++;
          summary.updatedPaths.push('audience.primaryMarkets');
        }
      }

      // Total active budget
      if (data.summary.totalActiveBudget != null && data.summary.totalActiveBudget > 0) {
        setFieldUntyped(graph, 'budgetOps', 'mediaSpendBudget', data.summary.totalActiveBudget, highConfProvenance);
        summary.fieldsUpdated++;
        summary.updatedPaths.push('budgetOps.mediaSpendBudget');
      }
    }

    // ========================================================================
    // Aggregate from plans
    // ========================================================================
    const activePlans = data.plans.filter(p => p.status === 'active');

    if (activePlans.length > 0) {
      // Collect all active channels from all active plans
      const allChannels = new Set<string>();
      const channelAllocations: Array<{ channel: string; amount: number; percentage: number | null }> = [];

      for (const plan of activePlans) {
        for (const channel of plan.channels) {
          const mappedChannel = mapChannelToEnum(channel.channel);
          allChannels.add(mappedChannel);

          if (channel.budgetAmount || channel.budgetSharePct) {
            channelAllocations.push({
              channel: mappedChannel,
              amount: channel.budgetAmount || 0,
              percentage: channel.budgetSharePct,
            });
          }
        }
      }

      // Active channels
      if (allChannels.size > 0) {
        setFieldUntyped(graph, 'performanceMedia', 'activeChannels', Array.from(allChannels), highConfProvenance);
        summary.fieldsUpdated++;
        summary.updatedPaths.push('performanceMedia.activeChannels');
      }

      // Budget allocations
      if (channelAllocations.length > 0) {
        const allocations = channelAllocations.map(a => ({
          channel: a.channel,
          amount: a.amount,
          percentage: a.percentage,
          period: 'monthly' as const,
          notes: null,
        }));
        setFieldUntyped(graph, 'budgetOps', 'currentAllocation', allocations, provenance);
        summary.fieldsUpdated++;
        summary.updatedPaths.push('budgetOps.currentAllocation');
      }

      // Collect seasonal bursts/flights
      const flights = activePlans.flatMap(p => p.flights);
      if (flights.length > 0) {
        const flightSummary = flights.map(f => ({
          name: f.name,
          season: f.season,
          startDate: f.startDate,
          endDate: f.endDate,
          budget: f.budget,
          primaryChannels: f.primaryChannels.map(mapChannelToEnum),
        }));

        // Store flights summary in historical domain
        const flightNotes = flights.map(f =>
          `${f.name}: ${f.startDate || 'TBD'} - ${f.endDate || 'TBD'} ($${f.budget || 'TBD'})`
        ).join('; ');

        if (flightNotes) {
          setFieldUntyped(graph, 'historical', 'seasonalityOverlays', flightNotes, provenance);
          summary.fieldsUpdated++;
          summary.updatedPaths.push('historical.seasonalityOverlays');
        }
      }
    }

    // ========================================================================
    // Update history refs
    // ========================================================================
    if (runId) {
      setDomainFields(
        graph,
        'historyRefs',
        { latestMediaLabRunId: runId } as Record<string, unknown>,
        provenance
      );
      summary.fieldsUpdated++;
      summary.updatedPaths.push('historyRefs.latestMediaLabRunId');
    }

  } catch (error) {
    summary.errors.push(`Error writing MediaLab data: ${error}`);
  }

  console.log(
    `[MediaLabWriter] Updated ${summary.fieldsUpdated} fields, errors: ${summary.errors.length}`
  );

  return summary;
}

/**
 * Write MediaLab data to Context Graph and save
 */
export async function writeMediaLabAndSave(
  companyId: string,
  data: MediaLabData,
  runId?: string
): Promise<{
  graph: CompanyContextGraph;
  summary: MediaLabWriterResult;
}> {
  const { loadContextGraph } = await import('./storage');
  const { createEmptyContextGraph } = await import('./companyContextGraph');

  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, companyId);
  }

  const summary = writeMediaLabToGraph(graph, data, runId);
  await saveContextGraph(graph, 'media_lab');

  return { graph, summary };
}
