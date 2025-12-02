// lib/gap-heavy/mapToBlueprint.ts
// Maps GAP Heavy strategic intelligence to Blueprint Focus Areas and Strategic Levers
//
// This module provides functions to convert GapHeavyResult outputs into
// Blueprint-compatible structures for strategic planning integration.

import type {
  GapHeavyResult,
  GapHeavyStrategicPriority,
  GapHeavyOpportunity,
  GapHeavyFunnelGap,
  GapHeavyCompetitor,
} from './strategicTypes';

// ============================================================================
// Types
// ============================================================================

/**
 * A Blueprint Focus Area derived from GAP Heavy strategic priorities
 */
export interface BlueprintFocusArea {
  /** Unique identifier */
  id: string;
  /** Title of the focus area */
  title: string;
  /** Strategic rationale - why this matters */
  rationale: string;
  /** Recommended plays/actions */
  recommendedPlays: string[];
  /** Source priority IDs from GAP Heavy */
  sourcePriorityIds: string[];
  /** Related opportunity IDs */
  relatedOpportunityIds: string[];
  /** Related funnel gap IDs */
  relatedFunnelGapIds: string[];
  /** Priority level for Blueprint */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Time horizon */
  timeHorizon: 'immediate' | 'near-term' | 'mid-term' | 'long-term';
}

/**
 * A Strategic Lever for Blueprint derived from GAP Heavy analysis
 */
export interface BlueprintStrategicLever {
  /** Unique identifier */
  id: string;
  /** Lever name */
  name: string;
  /** Description of the lever */
  description: string;
  /** Expected impact */
  expectedImpact: 'high' | 'medium' | 'low';
  /** Evidence summary */
  evidenceSummary: string;
  /** Related competitors that inform this lever */
  relatedCompetitors: string[];
}

/**
 * Blueprint integration package from GAP Heavy
 */
export interface GapHeavyBlueprintPackage {
  /** Focus areas derived from strategic priorities */
  focusAreas: BlueprintFocusArea[];
  /** Strategic levers derived from visibility and opportunity analysis */
  strategicLevers: BlueprintStrategicLever[];
  /** High-level narrative for Blueprint context */
  strategicNarrative: string;
  /** Data confidence score */
  dataConfidence: number;
  /** Source GAP Heavy result ID/timestamp */
  sourceCreatedAt: string;
}

// ============================================================================
// Main Mapping Function
// ============================================================================

/**
 * Map GAP Heavy result to Blueprint integration package
 *
 * This converts strategic priorities, opportunities, and funnel gaps into
 * Blueprint Focus Areas and Strategic Levers.
 *
 * @param result - GAP Heavy strategic intelligence result
 * @returns Blueprint integration package
 */
export function mapGapHeavyToBlueprint(result: GapHeavyResult): GapHeavyBlueprintPackage {
  // Map strategic priorities to focus areas
  const focusAreas = mapPrioritiesToFocusAreas(
    result.strategicPriorities,
    result.categoryOpportunities,
    result.contentOpportunities,
    result.funnelGaps
  );

  // Derive strategic levers from visibility map and competitors
  const strategicLevers = deriveStrategicLevers(
    result.searchVisibilityMap,
    result.competitorLandscape,
    result.categoryOpportunities,
    result.contentOpportunities
  );

  return {
    focusAreas,
    strategicLevers,
    strategicNarrative: result.strategistNarrative,
    dataConfidence: result.dataConfidence,
    sourceCreatedAt: result.createdAt,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map strategic priorities to Blueprint focus areas
 */
function mapPrioritiesToFocusAreas(
  priorities: GapHeavyStrategicPriority[],
  categoryOpportunities: GapHeavyOpportunity[],
  contentOpportunities: GapHeavyOpportunity[],
  funnelGaps: GapHeavyFunnelGap[]
): BlueprintFocusArea[] {
  return priorities.map((priority, index) => {
    // Determine priority level based on position and related items
    const priorityLevel = index === 0 ? 'critical' : index < 3 ? 'high' : 'medium';

    // Find related opportunities
    const relatedOpps = [
      ...categoryOpportunities.filter(o =>
        priority.relatedOpportunitiesIds?.includes(o.id) ||
        o.title.toLowerCase().includes(priority.title.toLowerCase().split(' ')[0])
      ),
      ...contentOpportunities.filter(o =>
        priority.relatedOpportunitiesIds?.includes(o.id)
      ),
    ];

    // Find related funnel gaps
    const relatedGaps = funnelGaps.filter(g =>
      priority.relatedFunnelGapIds?.includes(g.id)
    );

    // Determine time horizon based on opportunities
    const hasNearTerm = relatedOpps.some(o => o.timeHorizon === 'near-term');
    const timeHorizon = hasNearTerm ? 'near-term' : index === 0 ? 'immediate' : 'mid-term';

    return {
      id: `bf_${priority.id}`,
      title: priority.title,
      rationale: priority.whyItMatters,
      recommendedPlays: priority.recommendedPlays,
      sourcePriorityIds: [priority.id],
      relatedOpportunityIds: relatedOpps.map(o => o.id),
      relatedFunnelGapIds: relatedGaps.map(g => g.id),
      priority: priorityLevel,
      timeHorizon,
    };
  });
}

/**
 * Derive strategic levers from visibility and competitor analysis
 */
function deriveStrategicLevers(
  visibilityMap: GapHeavyResult['searchVisibilityMap'],
  competitors: GapHeavyCompetitor[],
  categoryOpps: GapHeavyOpportunity[],
  contentOpps: GapHeavyOpportunity[]
): BlueprintStrategicLever[] {
  const levers: BlueprintStrategicLever[] = [];

  // Lever 1: Search Visibility (if key channels identified)
  if (visibilityMap.keyChannels.length > 0) {
    levers.push({
      id: 'sl_visibility',
      name: 'Search Visibility',
      description: visibilityMap.summary,
      expectedImpact: 'high',
      evidenceSummary: `Key channels: ${visibilityMap.keyChannels.join(', ')}. Coverage: ${visibilityMap.coverageByIntent.join('; ')}`,
      relatedCompetitors: competitors.slice(0, 3).map(c => c.name),
    });
  }

  // Lever 2: Category Leadership (from high-impact category opportunities)
  const highImpactCatOpps = categoryOpps.filter(o => o.expectedImpact === 'high');
  if (highImpactCatOpps.length > 0) {
    levers.push({
      id: 'sl_category',
      name: 'Category Leadership',
      description: `Opportunity to own key category positions: ${highImpactCatOpps.map(o => o.title).join(', ')}`,
      expectedImpact: 'high',
      evidenceSummary: `${highImpactCatOpps.length} high-impact category opportunities identified`,
      relatedCompetitors: competitors
        .filter(c => c.relativeWeaknesses.length > 0)
        .slice(0, 2)
        .map(c => c.name),
    });
  }

  // Lever 3: Content Authority (from content opportunities)
  const highImpactContentOpps = contentOpps.filter(o => o.expectedImpact === 'high');
  if (highImpactContentOpps.length > 0) {
    levers.push({
      id: 'sl_content',
      name: 'Content Authority',
      description: `Content gaps to fill: ${highImpactContentOpps.map(o => o.title).join(', ')}`,
      expectedImpact: 'medium',
      evidenceSummary: `${highImpactContentOpps.length} high-impact content opportunities identified`,
      relatedCompetitors: [],
    });
  }

  // Lever 4: Competitive Differentiation (if competitors with weaknesses identified)
  const competitorsWithWeaknesses = competitors.filter(c => c.relativeWeaknesses.length > 0);
  if (competitorsWithWeaknesses.length > 0) {
    const weaknesses = competitorsWithWeaknesses.flatMap(c => c.relativeWeaknesses);
    levers.push({
      id: 'sl_differentiation',
      name: 'Competitive Differentiation',
      description: `Leverage competitor weaknesses: ${weaknesses.slice(0, 3).join(', ')}`,
      expectedImpact: 'high',
      evidenceSummary: `${competitorsWithWeaknesses.length} competitors have exploitable weaknesses`,
      relatedCompetitors: competitorsWithWeaknesses.map(c => c.name),
    });
  }

  return levers;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get top focus areas by priority
 */
export function getTopFocusAreas(
  blueprintPackage: GapHeavyBlueprintPackage,
  limit: number = 3
): BlueprintFocusArea[] {
  const priorityOrder: Record<BlueprintFocusArea['priority'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...blueprintPackage.focusAreas]
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, limit);
}

/**
 * Get high-impact strategic levers
 */
export function getHighImpactLevers(
  blueprintPackage: GapHeavyBlueprintPackage
): BlueprintStrategicLever[] {
  return blueprintPackage.strategicLevers.filter(l => l.expectedImpact === 'high');
}
