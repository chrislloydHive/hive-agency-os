// lib/media/sources/index.ts
// Barrel export for media source adapters

export { ga4Adapter, fetchGa4MediaEvents, mapGa4SourceToChannel } from './ga4';
export { googleAdsAdapter, fetchGoogleAdsMediaEvents, mapGoogleAdsChannelType } from './googleAds';
export { gbpAdapter, fetchGbpMediaEvents } from './gbp';
export { lsaAdapter, fetchLsaMediaEvents } from './lsa';
export { callrailAdapter, fetchCallrailMediaEvents, inferChannelFromCallrailSource } from './callrail';
export { ctmAdapter, fetchCtmMediaEvents } from './ctm';

import type { MediaSourceAdapter, MediaActualsSource } from '../performanceTypes';
import { ga4Adapter } from './ga4';
import { googleAdsAdapter } from './googleAds';
import { gbpAdapter } from './gbp';
import { lsaAdapter } from './lsa';
import { callrailAdapter } from './callrail';
import { ctmAdapter } from './ctm';

/**
 * Registry of all source adapters
 */
export const SOURCE_ADAPTERS: Record<MediaActualsSource, MediaSourceAdapter | undefined> = {
  ga4: ga4Adapter,
  google_ads: googleAdsAdapter,
  gbp: gbpAdapter,
  lsa: lsaAdapter,
  callrail: callrailAdapter,
  ctm: ctmAdapter,
  meta_ads: undefined,      // TODO: Implement
  microsoft_ads: undefined, // TODO: Implement
  manual: undefined,        // Manual import - no adapter needed
};

/**
 * Get adapter for a source
 */
export function getSourceAdapter(source: MediaActualsSource): MediaSourceAdapter | undefined {
  return SOURCE_ADAPTERS[source];
}

/**
 * Get all enabled adapters
 */
export function getEnabledAdapters(): MediaSourceAdapter[] {
  return Object.values(SOURCE_ADAPTERS).filter((a): a is MediaSourceAdapter => a !== undefined);
}
