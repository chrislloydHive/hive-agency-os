// lib/hiveBrain/causalModel.ts
// Causal Model Layer for Hive Brain
//
// Moves from "X is correlated with Y" to "We think X is causing Y change."
// Uses causal graphs with domain knowledge priors and learned relationships.

import type {
  CausalGraph,
  CausalNode,
  CausalEdge,
  CausalExplanation,
} from './types';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Default Causal Graph Templates
// ============================================================================

/**
 * Domain knowledge priors for causal relationships
 * These encode expert knowledge about what typically causes what
 */
const DOMAIN_KNOWLEDGE_EDGES: Array<Omit<CausalEdge, 'from' | 'to'> & { from: string; to: string }> = [
  // Spend → Traffic
  { from: 'paid_search_spend', to: 'paid_search_traffic', strength: 0.8, confidence: 0.9, source: 'domain_knowledge', direction: 'positive' },
  { from: 'paid_social_spend', to: 'paid_social_traffic', strength: 0.7, confidence: 0.85, source: 'domain_knowledge', direction: 'positive' },
  { from: 'display_spend', to: 'display_traffic', strength: 0.6, confidence: 0.8, source: 'domain_knowledge', direction: 'positive' },

  // Traffic → Conversions
  { from: 'paid_search_traffic', to: 'conversions', strength: 0.7, confidence: 0.85, source: 'domain_knowledge', direction: 'positive' },
  { from: 'organic_traffic', to: 'conversions', strength: 0.6, confidence: 0.8, source: 'domain_knowledge', direction: 'positive' },
  { from: 'direct_traffic', to: 'conversions', strength: 0.65, confidence: 0.82, source: 'domain_knowledge', direction: 'positive' },

  // Site Experience → Conversion Rate
  { from: 'site_speed', to: 'conversion_rate', strength: 0.5, confidence: 0.75, source: 'domain_knowledge', direction: 'positive' },
  { from: 'mobile_ux_score', to: 'conversion_rate', strength: 0.45, confidence: 0.7, source: 'domain_knowledge', direction: 'positive' },
  { from: 'bounce_rate', to: 'conversion_rate', strength: -0.6, confidence: 0.8, source: 'domain_knowledge', direction: 'negative' },

  // Creative Quality → CTR
  { from: 'creative_quality', to: 'ctr', strength: 0.6, confidence: 0.75, source: 'domain_knowledge', direction: 'positive' },
  { from: 'ad_relevance', to: 'ctr', strength: 0.55, confidence: 0.72, source: 'domain_knowledge', direction: 'positive' },

  // Persona Activation → Engagement
  { from: 'persona_match', to: 'engagement_rate', strength: 0.5, confidence: 0.7, source: 'domain_knowledge', direction: 'positive' },
  { from: 'persona_match', to: 'conversion_rate', strength: 0.4, confidence: 0.65, source: 'domain_knowledge', direction: 'positive' },

  // Tracking Quality → Data Reliability
  { from: 'tracking_completeness', to: 'attribution_accuracy', strength: 0.7, confidence: 0.85, source: 'domain_knowledge', direction: 'positive' },
  { from: 'tracking_completeness', to: 'conversion_accuracy', strength: 0.65, confidence: 0.8, source: 'domain_knowledge', direction: 'positive' },

  // SEO Factors → Organic Traffic
  { from: 'domain_authority', to: 'organic_traffic', strength: 0.6, confidence: 0.75, source: 'domain_knowledge', direction: 'positive', lagDays: 30 },
  { from: 'content_quality', to: 'organic_traffic', strength: 0.5, confidence: 0.7, source: 'domain_knowledge', direction: 'positive', lagDays: 60 },
  { from: 'technical_seo_score', to: 'organic_traffic', strength: 0.45, confidence: 0.68, source: 'domain_knowledge', direction: 'positive', lagDays: 30 },

  // Brand → Direct Traffic
  { from: 'brand_awareness', to: 'direct_traffic', strength: 0.55, confidence: 0.7, source: 'domain_knowledge', direction: 'positive', lagDays: 90 },
  { from: 'brand_spend', to: 'brand_awareness', strength: 0.5, confidence: 0.65, source: 'domain_knowledge', direction: 'positive', lagDays: 30 },

  // Market Factors
  { from: 'seasonality', to: 'demand', strength: 0.7, confidence: 0.8, source: 'domain_knowledge', direction: 'positive' },
  { from: 'competitor_activity', to: 'cpc', strength: 0.4, confidence: 0.6, source: 'domain_knowledge', direction: 'positive' },

  // Funnel Health
  { from: 'landing_page_quality', to: 'conversion_rate', strength: 0.55, confidence: 0.75, source: 'domain_knowledge', direction: 'positive' },
  { from: 'cta_effectiveness', to: 'conversion_rate', strength: 0.45, confidence: 0.7, source: 'domain_knowledge', direction: 'positive' },
];

/**
 * Standard nodes for a causal graph
 */
const STANDARD_NODES: CausalNode[] = [
  // Spend Nodes
  { id: 'paid_search_spend', name: 'Paid Search Spend', type: 'action', domain: 'media' },
  { id: 'paid_social_spend', name: 'Paid Social Spend', type: 'action', domain: 'media' },
  { id: 'display_spend', name: 'Display Spend', type: 'action', domain: 'media' },
  { id: 'brand_spend', name: 'Brand Spend', type: 'action', domain: 'media' },

  // Traffic Nodes
  { id: 'paid_search_traffic', name: 'Paid Search Traffic', type: 'metric', domain: 'traffic' },
  { id: 'paid_social_traffic', name: 'Paid Social Traffic', type: 'metric', domain: 'traffic' },
  { id: 'display_traffic', name: 'Display Traffic', type: 'metric', domain: 'traffic' },
  { id: 'organic_traffic', name: 'Organic Traffic', type: 'metric', domain: 'traffic' },
  { id: 'direct_traffic', name: 'Direct Traffic', type: 'metric', domain: 'traffic' },

  // Conversion Nodes
  { id: 'conversions', name: 'Conversions', type: 'metric', domain: 'conversion' },
  { id: 'conversion_rate', name: 'Conversion Rate', type: 'metric', domain: 'conversion' },
  { id: 'cpa', name: 'Cost Per Acquisition', type: 'metric', domain: 'conversion' },
  { id: 'roas', name: 'Return on Ad Spend', type: 'metric', domain: 'conversion' },

  // Engagement Nodes
  { id: 'ctr', name: 'Click-Through Rate', type: 'metric', domain: 'engagement' },
  { id: 'engagement_rate', name: 'Engagement Rate', type: 'metric', domain: 'engagement' },
  { id: 'bounce_rate', name: 'Bounce Rate', type: 'metric', domain: 'engagement' },

  // Site Quality Nodes
  { id: 'site_speed', name: 'Site Speed', type: 'state', domain: 'website' },
  { id: 'mobile_ux_score', name: 'Mobile UX Score', type: 'state', domain: 'website' },
  { id: 'landing_page_quality', name: 'Landing Page Quality', type: 'state', domain: 'website' },
  { id: 'cta_effectiveness', name: 'CTA Effectiveness', type: 'state', domain: 'website' },

  // Creative Nodes
  { id: 'creative_quality', name: 'Creative Quality', type: 'state', domain: 'creative' },
  { id: 'ad_relevance', name: 'Ad Relevance', type: 'state', domain: 'creative' },

  // Audience Nodes
  { id: 'persona_match', name: 'Persona Match', type: 'state', domain: 'audience' },

  // Tracking Nodes
  { id: 'tracking_completeness', name: 'Tracking Completeness', type: 'state', domain: 'tracking' },
  { id: 'attribution_accuracy', name: 'Attribution Accuracy', type: 'state', domain: 'tracking' },
  { id: 'conversion_accuracy', name: 'Conversion Accuracy', type: 'state', domain: 'tracking' },

  // SEO Nodes
  { id: 'domain_authority', name: 'Domain Authority', type: 'state', domain: 'seo' },
  { id: 'content_quality', name: 'Content Quality', type: 'state', domain: 'seo' },
  { id: 'technical_seo_score', name: 'Technical SEO Score', type: 'state', domain: 'seo' },

  // Brand Nodes
  { id: 'brand_awareness', name: 'Brand Awareness', type: 'state', domain: 'brand' },

  // External Nodes
  { id: 'seasonality', name: 'Seasonality', type: 'external', domain: 'market' },
  { id: 'competitor_activity', name: 'Competitor Activity', type: 'external', domain: 'market' },
  { id: 'demand', name: 'Market Demand', type: 'external', domain: 'market' },
  { id: 'cpc', name: 'Cost Per Click', type: 'metric', domain: 'media' },
];

// ============================================================================
// Causal Graph Construction
// ============================================================================

/**
 * Create a base causal graph for a vertical using domain knowledge
 */
export function createBaseCausalGraph(verticalId: string): CausalGraph {
  const now = new Date().toISOString();

  return {
    id: `cg_${verticalId}_${Date.now()}`,
    verticalId,
    nodes: [...STANDARD_NODES],
    edges: DOMAIN_KNOWLEDGE_EDGES.map(edge => ({ ...edge })),
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Infer causal relationships for a vertical based on historical data
 * This learns from patterns across companies in the vertical
 */
export async function inferCausalRelationshipsForVertical(
  verticalId: string,
  companyGraphs: CompanyContextGraph[]
): Promise<CausalGraph> {
  // Start with domain knowledge
  const graph = createBaseCausalGraph(verticalId);

  if (companyGraphs.length < 3) {
    // Not enough data to learn, return domain knowledge only
    return graph;
  }

  // Analyze patterns across companies to strengthen/weaken edges
  const edgeStrengths = new Map<string, number[]>();

  for (const companyGraph of companyGraphs) {
    // Extract metrics from context graph
    const metrics = extractMetricsFromGraph(companyGraph);

    // Look for correlations that suggest causal relationships
    for (const edge of graph.edges) {
      const fromMetric = metrics[edge.from];
      const toMetric = metrics[edge.to];

      if (fromMetric !== undefined && toMetric !== undefined) {
        const key = `${edge.from}→${edge.to}`;
        const existing = edgeStrengths.get(key) || [];

        // Simple correlation-based strength estimation
        // In production, this would use proper causal inference
        const observedStrength = estimateRelationshipStrength(fromMetric, toMetric, edge.direction);
        existing.push(observedStrength);
        edgeStrengths.set(key, existing);
      }
    }
  }

  // Update edge strengths based on observed data
  for (const edge of graph.edges) {
    const key = `${edge.from}→${edge.to}`;
    const observations = edgeStrengths.get(key);

    if (observations && observations.length >= 3) {
      // Blend domain knowledge with observed data
      const observedAvg = observations.reduce((a, b) => a + b, 0) / observations.length;
      const blendedStrength = edge.strength * 0.4 + observedAvg * 0.6;
      edge.strength = Math.max(-1, Math.min(1, blendedStrength));
      edge.confidence = Math.min(0.95, edge.confidence + 0.1 * (observations.length / 10));
      edge.source = 'learned';
    }
  }

  graph.updatedAt = new Date().toISOString();

  return graph;
}

/**
 * Extract relevant metrics from a context graph for causal analysis
 */
function extractMetricsFromGraph(graph: CompanyContextGraph): Record<string, number | undefined> {
  const metrics: Record<string, number | undefined> = {};

  // Performance Media metrics
  if (graph.performanceMedia) {
    metrics.cpa = graph.performanceMedia.blendedCpa?.value ?? undefined;
    metrics.roas = graph.performanceMedia.blendedRoas?.value ?? undefined;
    metrics.ctr = graph.performanceMedia.blendedCtr?.value ?? undefined;
  }

  // Website metrics
  if (graph.website) {
    metrics.site_speed = graph.website.pageSpeedScore?.value ?? undefined;
    metrics.mobile_ux_score = graph.website.mobileScore?.value ?? undefined;
  }

  // SEO metrics
  if (graph.seo) {
    metrics.domain_authority = graph.seo.domainAuthority?.value ?? undefined;
    metrics.organic_traffic = graph.seo.organicTraffic?.value ?? undefined;
  }

  // Digital Infrastructure (tracking) - derive from GA4 health status
  if (graph.digitalInfra) {
    const ga4Health = graph.digitalInfra.ga4Health?.value;
    // Convert health status to numeric score
    const healthScores: Record<string, number> = {
      good: 1.0,
      warning: 0.7,
      critical: 0.3,
      unknown: 0.5,
    };
    metrics.tracking_completeness = ga4Health ? healthScores[ga4Health] : undefined;
  }

  return metrics;
}

/**
 * Estimate relationship strength between two metrics
 */
function estimateRelationshipStrength(
  fromValue: number | undefined,
  toValue: number | undefined,
  expectedDirection: 'positive' | 'negative'
): number {
  if (fromValue === undefined || toValue === undefined) {
    return 0;
  }

  // Normalize values (simplified - in production use proper normalization)
  const normalizedFrom = Math.min(1, Math.max(0, fromValue / 100));
  const normalizedTo = Math.min(1, Math.max(0, toValue / 100));

  // Simple correlation estimation
  const correlation = expectedDirection === 'positive'
    ? normalizedFrom * normalizedTo
    : normalizedFrom * (1 - normalizedTo);

  return Math.max(-1, Math.min(1, correlation * 2 - 0.5));
}

// ============================================================================
// Causal Explanation
// ============================================================================

/**
 * Explain an observed change in a metric using the causal model
 */
export function explainObservedChange(
  graph: CausalGraph,
  metric: string,
  changeMagnitude: number,
  recentChanges: Record<string, number>
): CausalExplanation {
  const rootCauses: string[] = [];
  const contributingFactors: string[] = [];
  const evidenceChain: CausalExplanation['evidenceChain'] = [];

  // Find all edges that lead to this metric
  const incomingEdges = graph.edges.filter(e => e.to === metric);

  // Sort by strength to prioritize likely causes
  const sortedEdges = incomingEdges.sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength));

  for (const edge of sortedEdges) {
    const sourceChange = recentChanges[edge.from];
    const node = graph.nodes.find(n => n.id === edge.from);

    if (sourceChange !== undefined && node) {
      const expectedEffect = edge.strength * sourceChange;
      const contribution = Math.abs(expectedEffect / changeMagnitude) * 100;

      if (contribution > 20) {
        rootCauses.push(
          `${node.name} change (${sourceChange > 0 ? '+' : ''}${sourceChange.toFixed(1)}%) ` +
          `likely caused ${contribution.toFixed(0)}% of the ${metric} change`
        );
        evidenceChain.push({
          node: node.name,
          contribution,
          explanation: `${edge.direction === 'positive' ? 'Positive' : 'Negative'} relationship ` +
            `with strength ${edge.strength.toFixed(2)} (confidence: ${(edge.confidence * 100).toFixed(0)}%)`,
        });
      } else if (contribution > 5) {
        contributingFactors.push(
          `${node.name} may have contributed ~${contribution.toFixed(0)}% to the change`
        );
      }
    }
  }

  // Generate counterfactuals
  const counterfactuals = generateCounterfactuals(graph, metric, recentChanges, sortedEdges);

  // Calculate overall confidence
  const confidence = calculateExplanationConfidence(evidenceChain, changeMagnitude);

  return {
    metric,
    rootCauses,
    contributingFactors,
    counterfactuals,
    confidence,
    evidenceChain,
  };
}

/**
 * Generate counterfactual scenarios
 */
function generateCounterfactuals(
  graph: CausalGraph,
  metric: string,
  recentChanges: Record<string, number>,
  incomingEdges: CausalEdge[]
): string[] {
  const counterfactuals: string[] = [];

  for (const edge of incomingEdges.slice(0, 3)) {
    const sourceChange = recentChanges[edge.from];
    const node = graph.nodes.find(n => n.id === edge.from);

    if (node && sourceChange !== undefined) {
      // Alternative scenario: opposite change
      const alternativeChange = -sourceChange;
      const expectedDifference = edge.strength * alternativeChange * 2;

      counterfactuals.push(
        `If ${node.name} had ${alternativeChange > 0 ? 'increased' : 'decreased'} instead, ` +
        `${metric} would likely be ${Math.abs(expectedDifference).toFixed(1)}% ${expectedDifference > 0 ? 'higher' : 'lower'}`
      );
    }
  }

  // Add a "do nothing" counterfactual
  if (Object.keys(recentChanges).length > 0) {
    counterfactuals.push(
      `With no recent changes, ${metric} would likely have remained stable`
    );
  }

  return counterfactuals;
}

/**
 * Calculate confidence in the explanation
 */
function calculateExplanationConfidence(
  evidenceChain: CausalExplanation['evidenceChain'],
  changeMagnitude: number
): number {
  if (evidenceChain.length === 0) {
    return 0.2; // Low confidence if no evidence
  }

  // Higher confidence if we can explain most of the change
  const totalExplained = evidenceChain.reduce((sum, e) => sum + e.contribution, 0);
  const explanationCoverage = Math.min(1, totalExplained / 100);

  // Average confidence of edges used
  const avgEdgeConfidence = evidenceChain.length > 0
    ? 0.7 // Placeholder - would extract from edges in real impl
    : 0;

  return explanationCoverage * 0.6 + avgEdgeConfidence * 0.4;
}

// ============================================================================
// Causal Intervention Analysis
// ============================================================================

/**
 * Predict the effect of an intervention on downstream metrics
 */
export function predictInterventionEffect(
  graph: CausalGraph,
  intervention: { nodeId: string; change: number }
): Record<string, number> {
  const effects: Record<string, number> = {};
  const visited = new Set<string>();

  // BFS to propagate effects through the graph
  const queue: Array<{ nodeId: string; effect: number }> = [
    { nodeId: intervention.nodeId, effect: intervention.change },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);

    effects[current.nodeId] = current.effect;

    // Find downstream effects
    const outgoingEdges = graph.edges.filter(e => e.from === current.nodeId);

    for (const edge of outgoingEdges) {
      const propagatedEffect = current.effect * edge.strength;

      // Only propagate significant effects
      if (Math.abs(propagatedEffect) > 0.01) {
        const existingEffect = effects[edge.to] || 0;
        queue.push({
          nodeId: edge.to,
          effect: existingEffect + propagatedEffect,
        });
      }
    }
  }

  return effects;
}

/**
 * Find the best intervention to achieve a desired outcome
 */
export function findBestIntervention(
  graph: CausalGraph,
  targetMetric: string,
  desiredChange: number
): { nodeId: string; requiredChange: number; confidence: number } | null {
  const candidates: Array<{ nodeId: string; requiredChange: number; confidence: number }> = [];

  // Find all nodes that can affect the target
  const incomingEdges = graph.edges.filter(e => e.to === targetMetric);

  for (const edge of incomingEdges) {
    const node = graph.nodes.find(n => n.id === edge.from);

    if (node && node.type === 'action') {
      // Calculate required change to achieve desired outcome
      const requiredChange = desiredChange / edge.strength;

      // Check if this is feasible (within reasonable bounds)
      if (Math.abs(requiredChange) <= 100) {
        candidates.push({
          nodeId: edge.from,
          requiredChange,
          confidence: edge.confidence,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Return the intervention with highest confidence
  return candidates.sort((a, b) => b.confidence - a.confidence)[0];
}

// ============================================================================
// Export utilities
// ============================================================================

export function getNodeById(graph: CausalGraph, nodeId: string): CausalNode | undefined {
  return graph.nodes.find(n => n.id === nodeId);
}

export function getEdgesFromNode(graph: CausalGraph, nodeId: string): CausalEdge[] {
  return graph.edges.filter(e => e.from === nodeId);
}

export function getEdgesToNode(graph: CausalGraph, nodeId: string): CausalEdge[] {
  return graph.edges.filter(e => e.to === nodeId);
}
