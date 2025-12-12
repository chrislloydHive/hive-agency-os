// lib/os/diagnostics/debugInfo.ts
// Diagnostics Debug Info
//
// Provides debug information for diagnostics troubleshooting.
// Used by the DiagnosticsDebugDrawer component.

import { getLatestCompetitionRunV3, type CompetitionRunV3Payload } from '@/lib/competition-v3/store';
import { getBaselineSignalsForCompany, type BaselineSignals } from '@/lib/os/context';

// ============================================================================
// Types
// ============================================================================

/**
 * Classification info from competition analysis
 */
export interface ClassificationDebugInfo {
  archetype?: string;
  vertical?: string;
  marketplaceVertical?: string;
  confidence?: number;
}

/**
 * Competitor summary for debug view
 */
export interface CompetitorDebugInfo {
  domain: string;
  name?: string;
  type?: string;
  threatScore?: number;
  reason?: string;
}

/**
 * Full diagnostics debug payload
 */
export interface DiagnosticsDebugInfo {
  // Baseline signals
  baselineSignals?: {
    hasLabRuns: boolean;
    hasFullGap: boolean;
    hasCompetition: boolean;
    hasWebsiteMetadata: boolean;
    findingsCount: number;
    competitorCount: number;
    signalSources: string[];
  };

  // Competition run info
  competitionRunId?: string;
  competitionStartedAt?: string;
  competitionCompletedAt?: string;
  competitionStatus?: string;

  // Classification (extracted from competitors if available)
  classification?: ClassificationDebugInfo;

  // Summary stats
  summary?: {
    totalCandidates: number;
    totalCompetitors: number;
    byType: Record<string, number>;
    avgThreatScore: number;
  };

  // Top competitors (truncated to 10)
  topCompetitors?: CompetitorDebugInfo[];

  // Error info
  error?: string;
}

// ============================================================================
// Fetch Debug Info
// ============================================================================

/**
 * Fetch diagnostics debug info for a company
 * Combines baseline signals and competition run data
 */
export async function getDiagnosticsDebugInfo(
  companyId: string
): Promise<DiagnosticsDebugInfo> {
  const debugInfo: DiagnosticsDebugInfo = {};

  try {
    // Fetch baseline signals
    const baselineSignals = await getBaselineSignalsForCompany(companyId);
    debugInfo.baselineSignals = {
      hasLabRuns: baselineSignals.hasLabRuns,
      hasFullGap: baselineSignals.hasFullGap,
      hasCompetition: baselineSignals.hasCompetition,
      hasWebsiteMetadata: baselineSignals.hasWebsiteMetadata,
      findingsCount: baselineSignals.findingsCount,
      competitorCount: baselineSignals.competitorCount,
      signalSources: baselineSignals.signalSources,
    };

    // Fetch latest competition run
    const competitionRun = await getLatestCompetitionRunV3(companyId);
    if (competitionRun) {
      debugInfo.competitionRunId = competitionRun.runId;
      debugInfo.competitionStartedAt = competitionRun.createdAt;
      debugInfo.competitionCompletedAt = competitionRun.completedAt ?? undefined;
      debugInfo.competitionStatus = competitionRun.status;

      // Extract summary
      if (competitionRun.summary) {
        debugInfo.summary = {
          totalCandidates: competitionRun.summary.totalCandidates,
          totalCompetitors: competitionRun.summary.totalCompetitors,
          byType: competitionRun.summary.byType,
          avgThreatScore: competitionRun.summary.avgThreatScore,
        };
      }

      // Extract top competitors (truncate to 10)
      if (competitionRun.competitors && competitionRun.competitors.length > 0) {
        // Sort by threat score descending
        const sorted = [...competitionRun.competitors]
          .sort((a, b) => (b.scores?.threatScore ?? 0) - (a.scores?.threatScore ?? 0))
          .slice(0, 10);

        debugInfo.topCompetitors = sorted.map(c => ({
          domain: c.domain || c.homepageUrl || 'unknown',
          name: c.name,
          type: c.classification?.type,
          threatScore: c.scores?.threatScore,
          reason: c.analysis?.whyCompetitor ?? undefined,
        }));

        // Try to extract classification from first competitor's context
        // (Classification isn't stored in the run, but we can infer from competitor types)
        const directCount = competitionRun.competitors.filter(
          c => c.classification?.type === 'direct'
        ).length;
        const platformCount = competitionRun.competitors.filter(
          c => c.classification?.type === 'platform'
        ).length;

        // Infer archetype from competitor mix
        if (directCount > 0 || platformCount > 0) {
          debugInfo.classification = {
            archetype: platformCount > directCount ? 'marketplace' : 'unknown',
            confidence: 0.5, // Low confidence since we're inferring
          };
        }
      }

      // Include error if present
      if (competitionRun.error) {
        debugInfo.error = competitionRun.error;
      }
    }
  } catch (error) {
    console.error('[getDiagnosticsDebugInfo] Error:', error);
    debugInfo.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return debugInfo;
}
