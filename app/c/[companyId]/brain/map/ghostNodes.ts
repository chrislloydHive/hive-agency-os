// app/c/[companyId]/brain/map/ghostNodes.ts
// Ghost node generation for Strategic Map 2.0
//
// Ghost nodes represent empty or underpopulated areas of the context graph
// that should be filled. They appear as translucent nodes with suggestions
// for what data is missing.

import type {
  StrategicMapNode,
  StrategicMapGraph,
  StrategicMapNodeDomain,
} from '@/lib/contextGraph/strategicMap';
import type { ContextHealthScore } from '@/lib/contextGraph/health';
import type { GhostNode } from './StrategicMapContext';

// ============================================================================
// Ghost Node Definitions
// ============================================================================

interface GhostNodeDefinition {
  id: string;
  label: string;
  domain: StrategicMapNodeDomain;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  /** Nodes that must be empty/partial for this ghost to appear */
  triggeredByNodes: string[];
  /** Fields this ghost would fill */
  fieldPaths: string[];
}

/**
 * Static definitions of potential ghost nodes
 */
const GHOST_NODE_DEFINITIONS: GhostNodeDefinition[] = [
  // Identity ghosts
  {
    id: 'ghost.identity.mission',
    label: 'Mission & Values',
    domain: 'identity',
    suggestion: 'Define your company mission statement and core values to strengthen brand foundation.',
    priority: 'high',
    triggeredByNodes: ['identity.core'],
    fieldPaths: ['identity.mission', 'identity.values', 'identity.vision'],
  },
  {
    id: 'ghost.identity.history',
    label: 'Company Story',
    domain: 'identity',
    suggestion: 'Add your founding story and key milestones to build brand authenticity.',
    priority: 'low',
    triggeredByNodes: ['identity.core'],
    fieldPaths: ['identity.foundingStory', 'identity.milestones'],
  },

  // Audience ghosts
  {
    id: 'ghost.audience.personas',
    label: 'Buyer Personas',
    domain: 'audience',
    suggestion: 'Create detailed buyer personas to improve targeting precision.',
    priority: 'high',
    triggeredByNodes: ['audience.icp'],
    fieldPaths: ['audience.buyerPersonas', 'audience.decisionMakers'],
  },
  {
    id: 'ghost.audience.journey',
    label: 'Customer Journey',
    domain: 'audience',
    suggestion: 'Map the customer journey to identify key touchpoints and conversion opportunities.',
    priority: 'medium',
    triggeredByNodes: ['audience.icp'],
    fieldPaths: ['audience.customerJourney', 'audience.touchpoints'],
  },
  {
    id: 'ghost.audience.pain',
    label: 'Pain Points',
    domain: 'audience',
    suggestion: 'Document customer pain points to sharpen your value proposition.',
    priority: 'high',
    triggeredByNodes: ['audience.icp'],
    fieldPaths: ['audience.painPoints', 'audience.challenges'],
  },

  // Brand ghosts
  {
    id: 'ghost.brand.voice',
    label: 'Brand Voice',
    domain: 'brand',
    suggestion: 'Define your brand voice and messaging guidelines for consistency.',
    priority: 'medium',
    triggeredByNodes: ['brand.positioning'],
    fieldPaths: ['brand.toneOfVoice', 'brand.messagingGuidelines'],
  },
  {
    id: 'ghost.brand.visual',
    label: 'Visual Identity',
    domain: 'brand',
    suggestion: 'Document your visual brand standards (colors, typography, imagery).',
    priority: 'low',
    triggeredByNodes: ['brand.positioning'],
    fieldPaths: ['brand.visualIdentity', 'brand.brandAssets'],
  },

  // Product/Offer ghosts
  {
    id: 'ghost.productOffer.pricing',
    label: 'Pricing Strategy',
    domain: 'productOffer',
    suggestion: 'Add pricing tiers and strategy to enable better market positioning.',
    priority: 'medium',
    triggeredByNodes: ['productOffer.coreOffers'],
    fieldPaths: ['productOffer.pricingTiers', 'productOffer.pricingStrategy'],
  },
  {
    id: 'ghost.productOffer.differentiators',
    label: 'Product Differentiators',
    domain: 'productOffer',
    suggestion: 'Clearly articulate what makes your offering unique.',
    priority: 'high',
    triggeredByNodes: ['productOffer.coreOffers'],
    fieldPaths: ['productOffer.uniqueFeatures', 'productOffer.differentiators'],
  },

  // Competitive ghosts
  {
    id: 'ghost.competitive.analysis',
    label: 'Competitor Deep Dive',
    domain: 'competitive',
    suggestion: 'Run competitor analysis to understand market positioning opportunities.',
    priority: 'high',
    triggeredByNodes: ['competitive.landscape'],
    fieldPaths: ['competitive.competitorProfiles', 'competitive.swotAnalysis'],
  },
  {
    id: 'ghost.competitive.battlecards',
    label: 'Battle Cards',
    domain: 'competitive',
    suggestion: 'Create sales battle cards to win competitive deals.',
    priority: 'medium',
    triggeredByNodes: ['competitive.landscape'],
    fieldPaths: ['competitive.battleCards', 'competitive.winLossAnalysis'],
  },

  // Website ghosts
  {
    id: 'ghost.website.ux',
    label: 'UX Analysis',
    domain: 'website',
    suggestion: 'Analyze user experience and identify friction points.',
    priority: 'medium',
    triggeredByNodes: ['website.conversionFlow'],
    fieldPaths: ['website.uxAudit', 'website.heatmaps'],
  },

  // SEO ghosts
  {
    id: 'ghost.seo.keywords',
    label: 'Keyword Strategy',
    domain: 'seo',
    suggestion: 'Develop a keyword strategy aligned with business objectives.',
    priority: 'high',
    triggeredByNodes: ['seo.overall'],
    fieldPaths: ['seo.keywordStrategy', 'seo.targetKeywords'],
  },
  {
    id: 'ghost.seo.backlinks',
    label: 'Backlink Profile',
    domain: 'seo',
    suggestion: 'Analyze your backlink profile and identify link building opportunities.',
    priority: 'medium',
    triggeredByNodes: ['seo.overall'],
    fieldPaths: ['seo.backlinkProfile', 'seo.linkBuildingOpps'],
  },

  // Content ghosts
  {
    id: 'ghost.content.pillars',
    label: 'Content Pillars',
    domain: 'content',
    suggestion: 'Define content pillars aligned with audience needs and SEO strategy.',
    priority: 'high',
    triggeredByNodes: ['content.strategy'],
    fieldPaths: ['content.contentPillars', 'content.topicClusters'],
  },
  {
    id: 'ghost.content.calendar',
    label: 'Content Calendar',
    domain: 'content',
    suggestion: 'Create a content calendar for consistent publishing.',
    priority: 'medium',
    triggeredByNodes: ['content.strategy'],
    fieldPaths: ['content.contentCalendar', 'content.publishingSchedule'],
  },

  // Media ghosts
  {
    id: 'ghost.media.channels',
    label: 'Channel Strategy',
    domain: 'media',
    suggestion: 'Define your media channel mix and budget allocation.',
    priority: 'medium',
    triggeredByNodes: ['media.strategy'],
    fieldPaths: ['performanceMedia.channelStrategy', 'performanceMedia.budgetAllocation'],
  },
  {
    id: 'ghost.media.creative',
    label: 'Creative Assets',
    domain: 'media',
    suggestion: 'Develop creative assets and ad variations for testing.',
    priority: 'low',
    triggeredByNodes: ['media.strategy'],
    fieldPaths: ['performanceMedia.creativeAssets', 'performanceMedia.adVariations'],
  },

  // Ops ghosts
  {
    id: 'ghost.ops.tracking',
    label: 'Tracking Setup',
    domain: 'ops',
    suggestion: 'Configure comprehensive tracking and attribution.',
    priority: 'high',
    triggeredByNodes: ['ops.analytics'],
    fieldPaths: ['digitalInfra.trackingSetup', 'digitalInfra.attribution'],
  },

  // Objectives ghosts
  {
    id: 'ghost.objectives.kpis',
    label: 'KPI Framework',
    domain: 'objectives',
    suggestion: 'Define measurable KPIs and success metrics.',
    priority: 'high',
    triggeredByNodes: ['objectives.primary'],
    fieldPaths: ['objectives.kpiFramework', 'objectives.successMetrics'],
  },
  {
    id: 'ghost.objectives.timeline',
    label: 'Goals Timeline',
    domain: 'objectives',
    suggestion: 'Set timeline milestones for your business objectives.',
    priority: 'medium',
    triggeredByNodes: ['objectives.primary'],
    fieldPaths: ['objectives.milestones', 'objectives.quarterlyGoals'],
  },
];

// ============================================================================
// Ghost Node Generation
// ============================================================================

/**
 * Generate ghost nodes based on the current state of the strategic map
 *
 * Ghost nodes appear when:
 * 1. A triggered node is empty or partial
 * 2. The ghost's fields would provide value
 * 3. The health score indicates gaps in that domain
 */
export function generateGhostNodes(
  mapGraph: StrategicMapGraph,
  healthScore: ContextHealthScore | null
): GhostNode[] {
  const ghostNodes: GhostNode[] = [];
  const nodesById = new Map(mapGraph.nodes.map(n => [n.id, n]));

  for (const def of GHOST_NODE_DEFINITIONS) {
    // Check if any triggered node is empty or partial
    const triggeredNodes = def.triggeredByNodes
      .map(id => nodesById.get(id))
      .filter(Boolean) as StrategicMapNode[];

    const shouldShow = triggeredNodes.some(
      node => node.completeness === 'empty' || node.completeness === 'partial'
    );

    if (shouldShow) {
      // Check if health score suggests this domain needs attention
      const domainSection = healthScore?.sectionScores?.find(
        s => s.section === def.domain
      );
      const domainNeedsWork = !domainSection || domainSection.completeness < 70;

      if (domainNeedsWork) {
        ghostNodes.push({
          id: def.id,
          label: def.label,
          domain: def.domain,
          suggestion: def.suggestion,
          priority: def.priority,
          fieldPaths: def.fieldPaths,
        });
      }
    }
  }

  // Sort by priority (high > medium > low)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  ghostNodes.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return ghostNodes;
}

/**
 * Get ghost nodes for a specific domain
 */
export function getGhostNodesForDomain(
  ghostNodes: GhostNode[],
  domain: StrategicMapNodeDomain
): GhostNode[] {
  return ghostNodes.filter(g => g.domain === domain);
}

/**
 * Get the position for a ghost node relative to its trigger nodes
 */
export function getGhostNodePosition(
  ghost: GhostNode,
  existingNodePositions: Record<string, { x: number; y: number }>,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  // Find position near related nodes with slight offset
  const relatedPositions = Object.entries(existingNodePositions)
    .filter(([id]) => id.includes(ghost.domain))
    .map(([, pos]) => pos);

  if (relatedPositions.length > 0) {
    // Position near the centroid of related nodes, offset down and to the right
    const centroidX = relatedPositions.reduce((sum, p) => sum + p.x, 0) / relatedPositions.length;
    const centroidY = relatedPositions.reduce((sum, p) => sum + p.y, 0) / relatedPositions.length;

    return {
      x: Math.min(centroidX + 50, containerWidth - 160),
      y: Math.min(centroidY + 40, containerHeight - 70),
    };
  }

  // Default position if no related nodes found
  return {
    x: containerWidth / 2,
    y: containerHeight / 2,
  };
}

/**
 * Get high-priority ghost nodes that should be highlighted
 */
export function getHighPriorityGhosts(ghostNodes: GhostNode[]): GhostNode[] {
  return ghostNodes.filter(g => g.priority === 'high');
}

/**
 * Get a summary of gaps by domain
 */
export function getGapSummaryByDomain(
  ghostNodes: GhostNode[]
): Record<StrategicMapNodeDomain, { count: number; highPriority: number }> {
  const summary: Record<string, { count: number; highPriority: number }> = {};

  for (const ghost of ghostNodes) {
    if (!summary[ghost.domain]) {
      summary[ghost.domain] = { count: 0, highPriority: 0 };
    }
    summary[ghost.domain].count++;
    if (ghost.priority === 'high') {
      summary[ghost.domain].highPriority++;
    }
  }

  return summary as Record<StrategicMapNodeDomain, { count: number; highPriority: number }>;
}
