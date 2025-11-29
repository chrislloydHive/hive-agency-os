// lib/os/analytics/dmaIntegration.ts
// DMA Funnel Integration for OS Workspace Analytics
//
// This module provides DMA funnel data from an OS perspective:
// - DMA funnel summary metrics
// - DMA-derived workspace risks and opportunities
// - DMA contribution to OS funnel metrics
// - DMA leads tracking

import { getAuditFunnelSnapshot, type AuditFunnelSnapshot } from '@/lib/ga4Client';
import { getAllInboundLeads } from '@/lib/airtable/inboundLeads';

// ============================================================================
// Types
// ============================================================================

export interface DmaFunnelSummary {
  periodLabel: string;
  auditsStarted: number;
  auditsCompleted: number;
  completionRate: number; // 0-1
  uniqueUsers: number | null;
  completionRateDelta?: number | null; // vs previous period
  auditsStartedDelta?: number | null;
  auditsCompletedDelta?: number | null;
}

export interface DmaChannelPerformanceSummary {
  channel: string;
  started: number;
  completed: number;
  completionRate: number; // 0-1
}

export interface DmaWorkspaceRisk {
  id: string;
  label: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface DmaWorkspaceOpportunity {
  id: string;
  label: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface DmaFunnelOsContribution {
  funnelStages: {
    diagnostics: number; // audits started
    completedDiagnostics: number; // audits completed
    leads: number; // leads created from DMA
  };
  risks: DmaWorkspaceRisk[];
  opportunities: DmaWorkspaceOpportunity[];
  summary: DmaFunnelSummary;
  channelPerformance: DmaChannelPerformanceSummary[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDateRange(start: Date, end: Date): string {
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return 'Last 7 days';
  if (diffDays <= 30) return 'Last 30 days';
  if (diffDays <= 90) return 'Last 90 days';
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================================================
// Main Integration Function
// ============================================================================

/**
 * Get DMA funnel contribution for OS workspace analytics
 *
 * Fetches DMA funnel metrics and derives:
 * - Funnel stage counts for OS funnel
 * - Workspace-level risks and opportunities
 * - Summary metrics with optional deltas vs previous period
 */
export async function getDmaFunnelOsContribution(
  period: { start: Date; end: Date }
): Promise<DmaFunnelOsContribution | null> {
  console.log('[DmaIntegration] Fetching DMA funnel contribution...');

  try {
    // Calculate period strings
    const startStr = toDateString(period.start);
    const endStr = toDateString(period.end);
    const periodDays = Math.round(
      (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Fetch current period snapshot
    let currentSnapshot: AuditFunnelSnapshot;
    try {
      currentSnapshot = await getAuditFunnelSnapshot(startStr, endStr);
    } catch (error) {
      console.warn('[DmaIntegration] Could not fetch DMA snapshot:', error);
      return null;
    }

    // Calculate previous period for delta comparison
    const prevEnd = new Date(period.start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - periodDays);

    let previousSnapshot: AuditFunnelSnapshot | null = null;
    try {
      previousSnapshot = await getAuditFunnelSnapshot(
        toDateString(prevStart),
        toDateString(prevEnd)
      );
    } catch {
      // Previous period data not available, continue without deltas
    }

    // Count DMA leads from the period
    let dmaLeadsCount = 0;
    try {
      const allLeads = await getAllInboundLeads();
      const periodStart = period.start.getTime();
      const periodEnd = period.end.getTime();

      dmaLeadsCount = allLeads.filter((lead) => {
        // Check if lead is from DMA source
        const isDmaSource =
          lead.leadSource?.toLowerCase().includes('dma') ||
          lead.leadSource?.toLowerCase().includes('audit');

        // Check if lead was created within the period
        const createdAt = lead.createdAt ? new Date(lead.createdAt).getTime() : 0;
        const isInPeriod = createdAt >= periodStart && createdAt <= periodEnd;

        return isDmaSource && isInPeriod;
      }).length;
    } catch {
      console.warn('[DmaIntegration] Could not fetch DMA leads count');
    }

    // Build summary with deltas
    const summary: DmaFunnelSummary = {
      periodLabel: formatDateRange(period.start, period.end),
      auditsStarted: currentSnapshot.totals.auditsStarted,
      auditsCompleted: currentSnapshot.totals.auditsCompleted,
      completionRate: currentSnapshot.totals.completionRate,
      uniqueUsers: currentSnapshot.totals.uniqueUsers,
      auditsStartedDelta: previousSnapshot
        ? currentSnapshot.totals.auditsStarted - previousSnapshot.totals.auditsStarted
        : null,
      auditsCompletedDelta: previousSnapshot
        ? currentSnapshot.totals.auditsCompleted - previousSnapshot.totals.auditsCompleted
        : null,
      completionRateDelta: previousSnapshot
        ? currentSnapshot.totals.completionRate - previousSnapshot.totals.completionRate
        : null,
    };

    // Build channel performance summary
    const channelPerformance: DmaChannelPerformanceSummary[] = currentSnapshot.byChannel.map(
      (ch) => ({
        channel: ch.channel,
        started: ch.auditsStarted,
        completed: ch.auditsCompleted,
        completionRate: ch.completionRate,
      })
    );

    // Derive risks and opportunities
    const risks: DmaWorkspaceRisk[] = [];
    const opportunities: DmaWorkspaceOpportunity[] = [];

    // Risk: Low overall completion rate
    if (currentSnapshot.totals.completionRate < 0.3) {
      risks.push({
        id: 'dma-low-completion',
        label: 'DMA funnel completion is low',
        description: `Only ${Math.round(currentSnapshot.totals.completionRate * 100)}% of started audits are being completed. Review the audit flow for friction points.`,
        severity: currentSnapshot.totals.completionRate < 0.2 ? 'high' : 'medium',
      });
    }

    // Risk: Heavy skew to single channel (>70% from one channel)
    if (channelPerformance.length > 1) {
      const totalStarts = channelPerformance.reduce((sum, ch) => sum + ch.started, 0);
      const topChannel = channelPerformance[0]; // Already sorted by volume
      if (topChannel && totalStarts > 0) {
        const topChannelShare = topChannel.started / totalStarts;
        if (topChannelShare > 0.7) {
          risks.push({
            id: 'dma-channel-concentration',
            label: 'DMA traffic concentrated in one channel',
            description: `${Math.round(topChannelShare * 100)}% of audit starts come from "${topChannel.channel}". Diversify acquisition to reduce risk.`,
            severity: 'medium',
          });
        }
      }
    }

    // Risk: Significant drop in volume
    const startedDelta = summary.auditsStartedDelta;
    if (
      startedDelta != null &&
      startedDelta < 0 &&
      currentSnapshot.totals.auditsStarted > 0
    ) {
      const dropPercent = Math.abs(startedDelta) /
        (currentSnapshot.totals.auditsStarted + Math.abs(startedDelta));
      if (dropPercent > 0.3) {
        risks.push({
          id: 'dma-volume-drop',
          label: 'DMA audit volume declined',
          description: `Audit starts dropped by ${Math.round(dropPercent * 100)}% compared to previous period. Investigate traffic sources.`,
          severity: dropPercent > 0.5 ? 'high' : 'medium',
        });
      }
    }

    // Opportunity: High-performing channels with good completion rate
    const highPerformingChannels = channelPerformance.filter(
      (ch) => ch.completionRate >= 0.5 && ch.started >= 10
    );
    if (highPerformingChannels.length > 0) {
      const topPerformer = highPerformingChannels.sort(
        (a, b) => b.completionRate - a.completionRate
      )[0];
      opportunities.push({
        id: 'dma-high-completion-channel',
        label: 'High-converting DMA channel identified',
        description: `"${topPerformer.channel}" has ${Math.round(topPerformer.completionRate * 100)}% completion rate. Consider increasing investment in this channel.`,
        impact: 'high',
      });
    }

    // Opportunity: Good completion but low volume (scaling opportunity)
    const scalingCandidates = channelPerformance.filter(
      (ch) => ch.completionRate >= 0.4 && ch.started < 20 && ch.started >= 5
    );
    if (scalingCandidates.length > 0) {
      opportunities.push({
        id: 'dma-scaling-opportunity',
        label: 'Untapped DMA channels with potential',
        description: `${scalingCandidates.length} channel(s) show good completion rates but low volume. Test scaling: ${scalingCandidates.map((c) => c.channel).join(', ')}.`,
        impact: 'medium',
      });
    }

    // Opportunity: Strong overall performance
    if (currentSnapshot.totals.completionRate >= 0.5 && currentSnapshot.totals.auditsStarted >= 50) {
      opportunities.push({
        id: 'dma-strong-performance',
        label: 'DMA funnel performing well',
        description: `${Math.round(currentSnapshot.totals.completionRate * 100)}% completion rate with ${currentSnapshot.totals.auditsStarted} starts. Consider promoting as a case study.`,
        impact: 'medium',
      });
    }

    // Opportunity: Growing volume
    if (
      startedDelta != null &&
      startedDelta > 0 &&
      previousSnapshot
    ) {
      const growthPercent =
        startedDelta / previousSnapshot.totals.auditsStarted;
      if (growthPercent > 0.2) {
        opportunities.push({
          id: 'dma-volume-growth',
          label: 'DMA audit volume growing',
          description: `Audit starts increased by ${Math.round(growthPercent * 100)}% compared to previous period. Momentum is building.`,
          impact: 'high',
        });
      }
    }

    console.log('[DmaIntegration] DMA contribution computed:', {
      auditsStarted: summary.auditsStarted,
      auditsCompleted: summary.auditsCompleted,
      completionRate: summary.completionRate,
      leads: dmaLeadsCount,
      risks: risks.length,
      opportunities: opportunities.length,
    });

    return {
      funnelStages: {
        diagnostics: currentSnapshot.totals.auditsStarted,
        completedDiagnostics: currentSnapshot.totals.auditsCompleted,
        leads: dmaLeadsCount,
      },
      risks,
      opportunities,
      summary,
      channelPerformance,
    };
  } catch (error) {
    console.error('[DmaIntegration] Error fetching DMA contribution:', error);
    return null;
  }
}

/**
 * Check if DMA integration is available (GA4 configured)
 */
export function isDmaConfigured(): boolean {
  return !!(
    process.env.GA4_PROPERTY_ID &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}
