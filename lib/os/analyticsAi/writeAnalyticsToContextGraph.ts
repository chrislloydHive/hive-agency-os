// lib/os/analyticsAi/writeAnalyticsToContextGraph.ts
// Write analytics data to the Context Graph
//
// Pushes analytics nodes into the Context Graph for use by
// GAP-IA, QBR Story View, Brain Insights, and strategy recommendations.
//
// NOTE: Currently a stub that logs what would be written. Full context graph
// integration requires adding 'analytics' as a valid ProvenanceSource.

import type { AnalyticsLabSnapshot } from '@/lib/analytics/analyticsTypes';

// ============================================================================
// Main Function
// ============================================================================

/**
 * Write analytics snapshot to Context Graph
 *
 * Pushes analytics nodes for use by various Hive OS features
 * including GAP-IA, QBR, Brain Insights, and recommendations.
 *
 * NOTE: This is currently a stub that logs what would be written.
 * Analytics data is available via the /api/os/analytics endpoints.
 */
export async function writeAnalyticsToContextGraph(
  companyId: string,
  snapshot: AnalyticsLabSnapshot
): Promise<{ nodesWritten: number; errors: string[] }> {
  console.log('[writeAnalyticsToContextGraph] Would write to Context Graph:', {
    companyId,
    hasGa4: snapshot.hasGa4,
    hasGsc: snapshot.hasGsc,
    hasGbp: snapshot.hasGbp,
    hasMedia: snapshot.hasMedia,
  });

  const nodesToWrite: Array<{ path: string; value: unknown }> = [];

  // GA4 / Traffic metrics
  if (snapshot.hasGa4 && snapshot.sourceGa4) {
    const ga4 = snapshot.sourceGa4;
    nodesToWrite.push({ path: 'performance.sessions', value: ga4.totalSessions });
    nodesToWrite.push({ path: 'performance.conversions', value: ga4.conversions });
    nodesToWrite.push({ path: 'performance.conversionRate', value: ga4.conversionRate });
    if (snapshot.primaryChannelSource) {
      nodesToWrite.push({ path: 'performance.primaryChannel', value: snapshot.primaryChannelSource });
    }
  }

  // GSC / Organic metrics
  if (snapshot.hasGsc && snapshot.sourceSearchConsole) {
    const gsc = snapshot.sourceSearchConsole;
    nodesToWrite.push({ path: 'seo.organicClicks', value: gsc.clicks });
    nodesToWrite.push({ path: 'seo.organicImpressions', value: gsc.impressions });
    nodesToWrite.push({ path: 'seo.avgPosition', value: gsc.avgPosition });
  }

  // GBP metrics
  if (snapshot.hasGbp && snapshot.sourceGbp) {
    const gbp = snapshot.sourceGbp;
    nodesToWrite.push({ path: 'local.gbpViews', value: gbp.views });
    nodesToWrite.push({ path: 'local.gbpCalls', value: gbp.calls });
    const totalActions = gbp.calls + gbp.directionRequests + gbp.websiteClicks;
    nodesToWrite.push({ path: 'local.gbpActions', value: totalActions });
  }

  // Paid media metrics
  if (snapshot.hasMedia && snapshot.sourcePaidMedia) {
    const media = snapshot.sourcePaidMedia;
    nodesToWrite.push({ path: 'media.totalSpend', value: media.spend });
    nodesToWrite.push({ path: 'media.cpa', value: media.cpa });
    if (media.roas) {
      nodesToWrite.push({ path: 'media.roas', value: media.roas });
    }
  }

  // Trend metrics
  if (snapshot.delta.sessionsMoM !== null) {
    nodesToWrite.push({ path: 'performance.sessionsMoM', value: snapshot.delta.sessionsMoM });
  }
  if (snapshot.delta.conversionsMoM !== null) {
    nodesToWrite.push({ path: 'performance.conversionsMoM', value: snapshot.delta.conversionsMoM });
  }
  if (snapshot.delta.organicClicksMoM !== null) {
    nodesToWrite.push({ path: 'seo.organicClicksMoM', value: snapshot.delta.organicClicksMoM });
  }

  console.log('[writeAnalyticsToContextGraph] Nodes prepared (not written):', {
    companyId,
    nodeCount: nodesToWrite.length,
    paths: nodesToWrite.map(n => n.path),
  });

  // Return success - actual write is stubbed out
  return { nodesWritten: nodesToWrite.length, errors: [] };
}
