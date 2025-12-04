// lib/contextGraph/views/mediaContext.ts
// Media Planning Context View
//
// Provides everything the Media Lab planner needs in one object,
// instead of scattered calls across multiple modules.

import { loadContextGraph } from '../storage';
import { getNeedsRefreshReport } from '../needsRefresh';
import {
  computeContextHealthScore,
  convertNeedsRefreshReport,
  type NeedsRefreshFlag,
} from '../contextHealth';
import type { CompanyContextGraph } from '../companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * KPI targets structure for media planning
 */
export interface KpiTargets {
  targetCpa: number | null;
  targetCpl: number | null;
  targetRoas: number | null;
  targetMer: number | null;
  timeHorizon: string | null;
}

/**
 * Media channel hints from context
 */
export interface MediaHints {
  activeChannels: string[];
  topPerformingChannel: string | null;
  underperformingChannels: string[];
}

/**
 * Media Planning Context - unified view for media planning AI
 */
export interface MediaPlanningContext {
  /** Full context graph reference */
  graph: CompanyContextGraph;

  /** Company identity */
  company: {
    id: string;
    name: string;
    industry: string | null;
    businessModel: string | null;
    marketMaturity: string | null;
    geographicFootprint: string | null;
    seasonalityNotes: string | null;
  };

  /** Marketing objectives and KPIs */
  objectives: {
    primaryObjective: string | null;
    primaryBusinessGoal: string | null;
    kpis: KpiTargets;
  };

  /** Brand context */
  brand: {
    positioning: string | null;
    valueProps: string[];
    differentiators: string[];
    toneOfVoice: string | null;
  };

  /** Audience context */
  audience: {
    coreSegments: string[];
    demographics: string | null;
    geos: string | null;
    primaryMarkets: string[];
    behavioralDrivers: string[];
    painPoints: string[];
  };

  /** Digital infrastructure */
  digitalInfra: {
    trackingHealth: string | null;
    ga4Health: string | null;
    measurementLimits: string | null;
    attributionModel: string | null;
  };

  /** Historical performance */
  historical: {
    pastPerformance: string | null;
    seasonality: string | null;
    keyLearnings: string[];
    historicalCpa: number | null;
    historicalRoas: number | null;
  };

  /** Media performance hints */
  mediaHints: MediaHints;

  /** Budget context */
  budget: {
    totalMonthlySpend: number | null;
  };

  /** Context health metrics */
  contextHealthScore: number;
  needsRefresh: NeedsRefreshFlag[];
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get the complete media planning context for a company
 *
 * This is the primary entry point for Media Lab planner prefill and AI prompts.
 * It loads the context graph and extracts all relevant fields into a clean,
 * purpose-built structure.
 *
 * @param companyId The company ID
 * @returns MediaPlanningContext or null if no graph exists
 */
export async function getMediaPlanningContext(
  companyId: string
): Promise<MediaPlanningContext | null> {
  // Load the context graph
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    return null;
  }

  // Get needs-refresh report
  const refreshReport = getNeedsRefreshReport(graph);
  const needsRefresh = convertNeedsRefreshReport(refreshReport);
  const contextHealthScore = computeContextHealthScore(needsRefresh);

  return {
    graph,

    company: {
      id: graph.companyId,
      name: graph.companyName,
      industry: graph.identity.industry.value,
      businessModel: graph.identity.businessModel.value,
      marketMaturity: graph.identity.marketMaturity.value,
      geographicFootprint: graph.identity.geographicFootprint.value,
      seasonalityNotes: graph.identity.seasonalityNotes.value,
    },

    objectives: {
      primaryObjective: graph.objectives.primaryObjective.value,
      primaryBusinessGoal: graph.objectives.primaryBusinessGoal.value,
      kpis: {
        targetCpa: graph.objectives.targetCpa.value,
        targetCpl: graph.objectives.targetCpl.value,
        targetRoas: graph.objectives.targetRoas.value,
        targetMer: graph.objectives.targetMer.value,
        timeHorizon: graph.objectives.timeHorizon.value,
      },
    },

    brand: {
      positioning: graph.brand.positioning.value,
      valueProps: graph.brand.valueProps.value ?? [],
      differentiators: graph.brand.differentiators.value ?? [],
      toneOfVoice: graph.brand.toneOfVoice.value,
    },

    audience: {
      coreSegments: graph.audience.coreSegments.value ?? [],
      demographics: graph.audience.demographics.value,
      geos: graph.audience.geos.value,
      primaryMarkets: graph.audience.primaryMarkets.value ?? [],
      behavioralDrivers: graph.audience.behavioralDrivers.value ?? [],
      painPoints: graph.audience.painPoints.value ?? [],
    },

    digitalInfra: {
      trackingHealth: graph.digitalInfra.trackingStackSummary.value,
      ga4Health: graph.digitalInfra.ga4Health.value,
      measurementLimits: graph.digitalInfra.measurementLimits.value,
      attributionModel: graph.digitalInfra.attributionModel.value,
    },

    historical: {
      pastPerformance: graph.historical.pastPerformanceSummary.value,
      seasonality: graph.historical.seasonalityOverlays.value,
      keyLearnings: graph.historical.keyLearnings.value ?? [],
      historicalCpa: graph.historical.historicalCpa.value,
      historicalRoas: graph.historical.historicalRoas.value,
    },

    mediaHints: {
      activeChannels: (graph.performanceMedia.activeChannels.value ?? []) as string[],
      topPerformingChannel: graph.performanceMedia.topPerformingChannel.value as string | null,
      underperformingChannels: (graph.performanceMedia.underperformingChannels.value ?? []) as string[],
    },

    budget: {
      totalMonthlySpend: graph.performanceMedia.totalMonthlySpend.value,
    },

    contextHealthScore,
    needsRefresh,
  };
}

/**
 * Build a compact context string for AI prompts
 *
 * @param ctx The media planning context
 * @returns Formatted string for inclusion in AI prompts
 */
export function buildMediaPlanningPromptContext(ctx: MediaPlanningContext): string {
  const sections: string[] = [];

  // Company
  sections.push(`## Company
- Name: ${ctx.company.name}
- Industry: ${ctx.company.industry || 'Unknown'}
- Business Model: ${ctx.company.businessModel || 'Unknown'}
- Market Maturity: ${ctx.company.marketMaturity || 'Unknown'}
- Geographic Footprint: ${ctx.company.geographicFootprint || 'Unknown'}
- Seasonality: ${ctx.company.seasonalityNotes || 'None noted'}`);

  // Objectives
  sections.push(`## Objectives
- Primary Objective: ${ctx.objectives.primaryObjective || 'Not set'}
- Business Goal: ${ctx.objectives.primaryBusinessGoal || 'Not set'}
- Target CPA: ${ctx.objectives.kpis.targetCpa ? `$${ctx.objectives.kpis.targetCpa}` : 'Not set'}
- Target ROAS: ${ctx.objectives.kpis.targetRoas ? `${ctx.objectives.kpis.targetRoas}x` : 'Not set'}
- Time Horizon: ${ctx.objectives.kpis.timeHorizon || 'Not set'}`);

  // Brand
  if (ctx.brand.positioning || ctx.brand.valueProps.length > 0) {
    sections.push(`## Brand
- Positioning: ${ctx.brand.positioning || 'Not defined'}
- Value Props: ${ctx.brand.valueProps.length > 0 ? ctx.brand.valueProps.join(', ') : 'None'}
- Tone: ${ctx.brand.toneOfVoice || 'Not defined'}`);
  }

  // Audience
  if (ctx.audience.coreSegments.length > 0 || ctx.audience.demographics) {
    sections.push(`## Target Audience
- Core Segments: ${ctx.audience.coreSegments.length > 0 ? ctx.audience.coreSegments.join(', ') : 'Not defined'}
- Demographics: ${ctx.audience.demographics || 'Not defined'}
- Markets: ${ctx.audience.primaryMarkets.length > 0 ? ctx.audience.primaryMarkets.join(', ') : 'Not defined'}
- Pain Points: ${ctx.audience.painPoints.length > 0 ? ctx.audience.painPoints.join(', ') : 'Not captured'}`);
  }

  // Historical
  if (ctx.historical.pastPerformance || ctx.historical.historicalCpa) {
    sections.push(`## Historical Performance
- Summary: ${ctx.historical.pastPerformance || 'No historical data'}
- Historical CPA: ${ctx.historical.historicalCpa ? `$${ctx.historical.historicalCpa}` : 'Unknown'}
- Historical ROAS: ${ctx.historical.historicalRoas ? `${ctx.historical.historicalRoas}x` : 'Unknown'}
- Key Learnings: ${ctx.historical.keyLearnings.length > 0 ? ctx.historical.keyLearnings.slice(0, 3).join('; ') : 'None'}`);
  }

  // Media hints
  if (ctx.mediaHints.activeChannels.length > 0 || ctx.mediaHints.topPerformingChannel) {
    sections.push(`## Current Media Performance
- Active Channels: ${ctx.mediaHints.activeChannels.length > 0 ? ctx.mediaHints.activeChannels.join(', ') : 'None'}
- Top Channel: ${ctx.mediaHints.topPerformingChannel || 'Unknown'}
- Underperforming: ${ctx.mediaHints.underperformingChannels.length > 0 ? ctx.mediaHints.underperformingChannels.join(', ') : 'None'}`);
  }

  // Context health
  sections.push(`## Context Health
- Score: ${ctx.contextHealthScore}%
- Areas needing attention: ${ctx.needsRefresh.length > 0 ? ctx.needsRefresh.slice(0, 3).map(f => `${f.domain}.${f.field}`).join(', ') : 'None'}`);

  return sections.join('\n\n');
}
