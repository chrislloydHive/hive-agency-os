// lib/os/insights/insightExtractors.ts
// Data extractors that pull information from various sources
// to feed into the Insight Engine pattern detection

import { getCompanyStrategySnapshot, type CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import { getCompanyFindings } from '@/lib/os/findings/companyFindings';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';
import type { ScoreHistory } from './insightTypes';
import { getContextGraphStats } from '@/lib/contextGraph/storage';

// Simplified context health data for insight generation
export interface ContextHealthData {
  overallScore: number;
  staleFieldCount: number;
  missingCriticalCount: number;
}

// Local types for extractors
export interface SnapshotData {
  overallScore: number | null;
  dimensions: Record<string, number | null>;
  focusAreas: string[];
  lastUpdated: string;
}

export interface FindingData {
  id: string;
  labSlug: string;
  severity: string;
  category: string;
  description: string;
  createdAt: string;
}

// ============================================================================
// Snapshot Extractor
// ============================================================================

/**
 * Extract current snapshot data for a company
 */
export async function extractCurrentSnapshot(companyId: string): Promise<SnapshotData | null> {
  try {
    const snapshot = await getCompanyStrategySnapshot(companyId);
    if (!snapshot) return null;

    return {
      overallScore: snapshot.overallScore ?? null,
      dimensions: {}, // CompanyStrategicSnapshot doesn't have dimension scores
      focusAreas: snapshot.focusAreas || [],
      lastUpdated: snapshot.updatedAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error('[insightExtractors] Error extracting snapshot:', error);
    return null;
  }
}

// ============================================================================
// Score History Extractor
// ============================================================================

/**
 * Extract score history for trend analysis
 * NOTE: In a full implementation, this would query historical snapshots
 * For now, we simulate with current data
 */
export async function extractScoreHistory(
  companyId: string,
  _periods: number = 4
): Promise<ScoreHistory[]> {
  try {
    const currentSnapshot = await getCompanyStrategySnapshot(companyId);
    if (!currentSnapshot) return [];

    // For now, return current as single data point
    // TODO: Implement historical snapshot tracking
    const history: ScoreHistory[] = [{
      date: currentSnapshot.updatedAt || new Date().toISOString(),
      overallScore: currentSnapshot.overallScore ?? null,
      dimensions: {},
    }];

    return history;
  } catch (error) {
    console.error('[insightExtractors] Error extracting score history:', error);
    return [];
  }
}

// ============================================================================
// Findings Extractor
// ============================================================================

/**
 * Extract findings data for pattern analysis
 */
export async function extractFindings(companyId: string): Promise<FindingData[]> {
  try {
    const findings = await getCompanyFindings(companyId);

    return findings.map((f: DiagnosticDetailFinding) => ({
      id: f.id || 'unknown',
      labSlug: f.labSlug || 'unknown',
      severity: f.severity || 'medium',
      category: f.category || 'general',
      description: f.description || '',
      createdAt: f.createdAt || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('[insightExtractors] Error extracting findings:', error);
    return [];
  }
}

// ============================================================================
// Combined Data Extractor
// ============================================================================

export interface ExtractedInsightData {
  companyId: string;
  currentSnapshot: SnapshotData | null;
  previousSnapshot: SnapshotData | null;
  scoreHistory: ScoreHistory[];
  findings: FindingData[];
  /** Context health data from the Context Graph */
  contextHealth: ContextHealthData | null;
  extractedAt: string;
}

/**
 * Extract all data needed for insight generation
 */
export async function extractAllInsightData(companyId: string): Promise<ExtractedInsightData> {
  // Run extractions in parallel
  const [currentSnapshot, scoreHistory, findings, contextHealth] = await Promise.all([
    extractCurrentSnapshot(companyId),
    extractScoreHistory(companyId),
    extractFindings(companyId),
    extractContextHealth(companyId),
  ]);

  // For now, previousSnapshot is simulated
  // TODO: Implement proper historical comparison
  const previousSnapshot: SnapshotData | null = null;

  return {
    companyId,
    currentSnapshot,
    previousSnapshot,
    scoreHistory,
    findings,
    contextHealth,
    extractedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Context Health Extractor
// ============================================================================

/**
 * Extract context health data from the Context Graph
 * Used for generating context-related insights (stale data, low completeness)
 */
export async function extractContextHealth(companyId: string): Promise<ContextHealthData | null> {
  try {
    const stats = await getContextGraphStats(companyId);
    if (!stats) return null;

    // Convert completeness score to overall health score
    // A simple proxy: completenessScore is the overall health
    return {
      overallScore: stats.completenessScore,
      staleFieldCount: 0, // TODO: Track staleness in graph stats
      missingCriticalCount: Math.round((100 - stats.completenessScore) / 10), // Estimate
    };
  } catch (error) {
    console.error('[insightExtractors] Error extracting context health:', error);
    return null;
  }
}

// ============================================================================
// Lab-Specific Extractors
// ============================================================================

/**
 * Extract findings by lab for theme-specific insights
 */
export async function extractFindingsByLab(
  companyId: string
): Promise<Record<string, FindingData[]>> {
  const findings = await extractFindings(companyId);

  const byLab: Record<string, FindingData[]> = {};

  for (const finding of findings) {
    const lab = finding.labSlug || 'unknown';
    if (!byLab[lab]) {
      byLab[lab] = [];
    }
    byLab[lab].push(finding);
  }

  return byLab;
}

/**
 * Count findings by severity
 */
export function countFindingsBySeverity(
  findings: FindingData[]
): Record<string, number> {
  const counts: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const finding of findings) {
    const severity = finding.severity.toLowerCase();
    if (severity in counts) {
      counts[severity]++;
    }
  }

  return counts;
}

/**
 * Get severity distribution summary
 */
export function getSeverityDistribution(findings: FindingData[]): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  criticalPercent: number;
  highPercent: number;
} {
  const counts = countFindingsBySeverity(findings);
  const total = findings.length;

  return {
    total,
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
    criticalPercent: total > 0 ? Math.round((counts.critical / total) * 100) : 0,
    highPercent: total > 0 ? Math.round((counts.high / total) * 100) : 0,
  };
}

// ============================================================================
// Graph-Based Insight Extractors
// ============================================================================

import type { RelationshipGraph, RelationshipNode, RelationshipEdge } from '@/lib/os/context';
import type { Insight, InsightSeverity } from './insightTypes';

/**
 * Graph insight result with severity and details
 */
export interface GraphInsight {
  type: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  affectedNodes: string[];
  suggestedAction?: string;
}

/**
 * Extract disconnected product/offer nodes
 * Finds product/offer nodes that have no outgoing dependencies to other domains
 * Severity: HIGH - Products without context links are likely underutilized
 */
export function extractDisconnectedOffers(graph: RelationshipGraph): GraphInsight | null {
  // Find productOffer domain nodes
  const offerNodes = graph.nodes.filter(n => n.domain === 'productOffer' && !n.isGhost);

  if (offerNodes.length === 0) return null;

  // Check which offer nodes have no outgoing edges to other domains
  const disconnectedOffers: RelationshipNode[] = [];

  for (const node of offerNodes) {
    const outgoingEdges = graph.edges.filter(e => e.fromNodeId === node.id);
    const crossDomainEdges = outgoingEdges.filter(e => {
      const targetNode = graph.nodes.find(n => n.id === e.toNodeId);
      return targetNode && targetNode.domain !== 'productOffer';
    });

    // Also check incoming edges from other domains
    const incomingCrossDomain = graph.edges.filter(e => {
      if (e.toNodeId !== node.id) return false;
      const sourceNode = graph.nodes.find(n => n.id === e.fromNodeId);
      return sourceNode && sourceNode.domain !== 'productOffer';
    });

    if (crossDomainEdges.length === 0 && incomingCrossDomain.length === 0) {
      disconnectedOffers.push(node);
    }
  }

  if (disconnectedOffers.length === 0) return null;

  return {
    type: 'disconnected_offers',
    severity: 'warning',
    title: 'Product/Offer Data Not Connected',
    message: `${disconnectedOffers.length} product/offer field${disconnectedOffers.length > 1 ? 's' : ''} ${disconnectedOffers.length > 1 ? 'are' : 'is'} not linked to other context domains. This may indicate incomplete product positioning.`,
    affectedNodes: disconnectedOffers.map(n => n.id),
    suggestedAction: 'Connect product features to brand positioning and audience pain points.',
  };
}

/**
 * Extract audience fields without content connections
 * Finds audience definitions that don't feed into content strategy
 * Severity: MEDIUM - Audience data should inform content
 */
export function extractAudienceWithoutContent(graph: RelationshipGraph): GraphInsight | null {
  // Find audience domain nodes that are populated
  const audienceNodes = graph.nodes.filter(
    n => n.domain === 'audience' && !n.isGhost && n.status === 'healthy'
  );

  if (audienceNodes.length === 0) return null;

  // Check for edges to content domain
  const contentDomains = ['content', 'creative', 'social'];
  const disconnectedAudience: RelationshipNode[] = [];

  for (const node of audienceNodes) {
    const outgoingToContent = graph.edges.filter(e => {
      if (e.fromNodeId !== node.id) return false;
      const targetNode = graph.nodes.find(n => n.id === e.toNodeId);
      return targetNode && contentDomains.includes(targetNode.domain);
    });

    if (outgoingToContent.length === 0) {
      disconnectedAudience.push(node);
    }
  }

  if (disconnectedAudience.length === 0) return null;

  return {
    type: 'audience_without_content',
    severity: 'info',
    title: 'Audience Data Not Driving Content',
    message: `${disconnectedAudience.length} audience field${disconnectedAudience.length > 1 ? 's' : ''} ${disconnectedAudience.length > 1 ? 'are' : 'is'} not connected to content strategy. Audience insights may not be fully leveraged.`,
    affectedNodes: disconnectedAudience.map(n => n.id),
    suggestedAction: 'Ensure audience segments and pain points inform your content and messaging strategy.',
  };
}

/**
 * Extract channel/social data without strategy connections
 * Finds channels defined but not connected to targeting or content
 * Severity: MEDIUM - Channels need strategic context
 */
export function extractChannelsWithoutStrategy(graph: RelationshipGraph): GraphInsight | null {
  // Find social/channel nodes
  const channelNodes = graph.nodes.filter(
    n => n.domain === 'social' && !n.isGhost && n.status === 'healthy'
  );

  if (channelNodes.length === 0) return null;

  // Check for strategic connections
  const strategyDomains = ['content', 'performanceMedia', 'objectives', 'audience'];
  const orphanedChannels: RelationshipNode[] = [];

  for (const node of channelNodes) {
    // Check both incoming and outgoing edges
    const strategyEdges = graph.edges.filter(e => {
      const isOutgoing = e.fromNodeId === node.id;
      const isIncoming = e.toNodeId === node.id;
      if (!isOutgoing && !isIncoming) return false;

      const otherNodeId = isOutgoing ? e.toNodeId : e.fromNodeId;
      const otherNode = graph.nodes.find(n => n.id === otherNodeId);
      return otherNode && strategyDomains.includes(otherNode.domain);
    });

    if (strategyEdges.length === 0) {
      orphanedChannels.push(node);
    }
  }

  if (orphanedChannels.length === 0) return null;

  return {
    type: 'channels_without_strategy',
    severity: 'info',
    title: 'Channels Missing Strategic Links',
    message: `${orphanedChannels.length} social/channel field${orphanedChannels.length > 1 ? 's' : ''} ${orphanedChannels.length > 1 ? 'are' : 'is'} not connected to strategic objectives or content planning.`,
    affectedNodes: orphanedChannels.map(n => n.id),
    suggestedAction: 'Link channel presence to content strategy and campaign objectives.',
  };
}

/**
 * Extract weakly connected brand nodes
 * Finds brand positioning that doesn't cascade to other domains
 * Severity: LOW - Brand should influence multiple areas
 */
export function extractWeaklyConnectedBrand(graph: RelationshipGraph): GraphInsight | null {
  // Find brand domain nodes that are populated
  const brandNodes = graph.nodes.filter(
    n => n.domain === 'brand' && !n.isGhost && n.status === 'healthy'
  );

  if (brandNodes.length === 0) return null;

  // Count outgoing edges per node
  const weaklyConnected: Array<{ node: RelationshipNode; connectionCount: number }> = [];
  const minExpectedConnections = 2; // Brand fields should typically connect to 2+ other domains

  for (const node of brandNodes) {
    const outgoingEdges = graph.edges.filter(e => e.fromNodeId === node.id);
    const uniqueTargetDomains = new Set(
      outgoingEdges
        .map(e => graph.nodes.find(n => n.id === e.toNodeId))
        .filter((n): n is RelationshipNode => n !== undefined && n.domain !== 'brand')
        .map(n => n.domain)
    );

    if (uniqueTargetDomains.size < minExpectedConnections) {
      weaklyConnected.push({ node, connectionCount: uniqueTargetDomains.size });
    }
  }

  if (weaklyConnected.length === 0) return null;

  // Only report if majority of brand fields are weakly connected
  if (weaklyConnected.length < brandNodes.length * 0.5) return null;

  return {
    type: 'weakly_connected_brand',
    severity: 'info',
    title: 'Brand Not Fully Cascading',
    message: `Brand positioning is only connected to ${weaklyConnected[0]?.connectionCount || 0} other domain${(weaklyConnected[0]?.connectionCount || 0) === 1 ? '' : 's'}. Strong brands typically influence content, creative, and audience targeting.`,
    affectedNodes: weaklyConnected.map(w => w.node.id),
    suggestedAction: 'Ensure brand voice and positioning are reflected in content guidelines and audience targeting.',
  };
}

/**
 * Run all graph-based insight extractors
 * Returns an array of detected issues
 */
export function extractGraphInsights(graph: RelationshipGraph): GraphInsight[] {
  const insights: GraphInsight[] = [];

  const disconnectedOffers = extractDisconnectedOffers(graph);
  if (disconnectedOffers) insights.push(disconnectedOffers);

  const audienceWithoutContent = extractAudienceWithoutContent(graph);
  if (audienceWithoutContent) insights.push(audienceWithoutContent);

  const channelsWithoutStrategy = extractChannelsWithoutStrategy(graph);
  if (channelsWithoutStrategy) insights.push(channelsWithoutStrategy);

  const weaklyConnectedBrand = extractWeaklyConnectedBrand(graph);
  if (weaklyConnectedBrand) insights.push(weaklyConnectedBrand);

  return insights;
}

/**
 * Convert a GraphInsight to a full Insight object
 */
export function graphInsightToInsight(
  graphInsight: GraphInsight,
  companyId: string
): Insight {
  return {
    id: `graph-${graphInsight.type}-${Date.now()}`,
    type: 'emerging_risk',
    theme: 'overall',
    severity: graphInsight.severity,
    title: graphInsight.title,
    message: graphInsight.message,
    evidence: graphInsight.affectedNodes.map(nodeId => ({
      type: 'metric' as const,
      label: 'Affected field',
      currentValue: nodeId,
    })),
    recommendedActions: graphInsight.suggestedAction
      ? [{
          title: 'Address connection gap',
          description: graphInsight.suggestedAction,
          effort: 'moderate' as const,
          linkPath: `/c/${companyId}/brain/context?view=relationships`,
        }]
      : [],
    generatedAt: new Date().toISOString(),
    timeframe: 'this_week',
    confidence: 75,
    metadata: {
      extractorType: 'graph',
      affectedNodeCount: graphInsight.affectedNodes.length,
    },
  };
}
