// lib/contextGraph/domains/historyRefs.ts
// History References Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';

/**
 * HistoryRefs domain tracks references to related diagnostic runs and entities.
 * This enables linking the context graph to its source data.
 */
export const HistoryRefsDomain = z.object({
  // GAP References
  latestGapIaRunId: WithMeta(z.string()),
  latestGapFullRunId: WithMeta(z.string()),
  latestGapHeavyRunId: WithMeta(z.string()),

  // Lab References
  latestWebsiteLabRunId: WithMeta(z.string()),
  latestBrandLabRunId: WithMeta(z.string()),
  latestContentLabRunId: WithMeta(z.string()),
  latestSeoLabRunId: WithMeta(z.string()),
  latestDemandLabRunId: WithMeta(z.string()),
  latestOpsLabRunId: WithMeta(z.string()),
  latestCreativeLabRunId: WithMeta(z.string()),
  latestMediaLabRunId: WithMeta(z.string()),
  latestAudienceLabRunId: WithMeta(z.string()),

  // Media References
  latestMediaPlanIds: WithMetaArray(z.string()),
  latestMediaProgramIds: WithMetaArray(z.string()),
  activeMediaCampaignIds: WithMetaArray(z.string()),

  // Work References
  latestWorkItemIds: WithMetaArray(z.string()),
  activeProjectIds: WithMetaArray(z.string()),

  // Brain References
  latestBrainUpdateAt: WithMeta(z.string()),
  brainInsightIds: WithMetaArray(z.string()),

  // Analytics References
  latestGa4SyncAt: WithMeta(z.string()),
  latestGscSyncAt: WithMeta(z.string()),
  latestGadsSyncAt: WithMeta(z.string()),
  latestGbpSyncAt: WithMeta(z.string()),
});

export type HistoryRefsDomain = z.infer<typeof HistoryRefsDomain>;

/**
 * Create an empty HistoryRefs domain
 */
export function createEmptyHistoryRefsDomain(): HistoryRefsDomain {
  return {
    latestGapIaRunId: { value: null, provenance: [] },
    latestGapFullRunId: { value: null, provenance: [] },
    latestGapHeavyRunId: { value: null, provenance: [] },
    latestWebsiteLabRunId: { value: null, provenance: [] },
    latestBrandLabRunId: { value: null, provenance: [] },
    latestContentLabRunId: { value: null, provenance: [] },
    latestSeoLabRunId: { value: null, provenance: [] },
    latestDemandLabRunId: { value: null, provenance: [] },
    latestOpsLabRunId: { value: null, provenance: [] },
    latestCreativeLabRunId: { value: null, provenance: [] },
    latestMediaLabRunId: { value: null, provenance: [] },
    latestAudienceLabRunId: { value: null, provenance: [] },
    latestMediaPlanIds: { value: [], provenance: [] },
    latestMediaProgramIds: { value: [], provenance: [] },
    activeMediaCampaignIds: { value: [], provenance: [] },
    latestWorkItemIds: { value: [], provenance: [] },
    activeProjectIds: { value: [], provenance: [] },
    latestBrainUpdateAt: { value: null, provenance: [] },
    brainInsightIds: { value: [], provenance: [] },
    latestGa4SyncAt: { value: null, provenance: [] },
    latestGscSyncAt: { value: null, provenance: [] },
    latestGadsSyncAt: { value: null, provenance: [] },
    latestGbpSyncAt: { value: null, provenance: [] },
  };
}
