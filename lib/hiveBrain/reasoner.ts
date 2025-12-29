// lib/hiveBrain/reasoner.ts
// Hive Reasoner - Central Thinking Engine
//
// The Hive Reasoner sits on top of:
// - Context Graphs (all companies)
// - Meta-memory (global learnings)
// - Global embeddings
// - Benchmarks
// - Autopilot logs
//
// It performs high-level strategic reasoning across the entire Hive,
// identifying patterns, generating hypotheses, and recommending actions.

import { loadContextGraph } from '../contextGraph/storage';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  ReasonerQuery,
  ReasonerConclusion,
  ReasonerEvidence,
} from './types';

// ============================================================================
// Cross-Company Analysis
// ============================================================================

/**
 * Aggregate data structure for cross-company analysis
 */
interface CompanySnapshot {
  companyId: string;
  companyName: string;
  verticalId: string | null;
  industry: string | null;
  metrics: {
    cpa?: number;
    roas?: number;
    conversionRate?: number;
    leads?: number;
    revenue?: number;
  };
  activeChannels: string[];
  topChannel: string | null;
  healthScore: number;
  creativeTrends: string[];
  audienceSegments: string[];
}

/**
 * Load snapshots for multiple companies
 */
async function loadCompanySnapshots(
  companyIds: string[]
): Promise<CompanySnapshot[]> {
  const snapshots: CompanySnapshot[] = [];

  for (const companyId of companyIds) {
    const graph = await loadContextGraph(companyId);
    if (!graph) continue;

    snapshots.push(extractSnapshot(graph));
  }

  return snapshots;
}

/**
 * Extract a snapshot from a context graph
 */
function extractSnapshot(graph: CompanyContextGraph): CompanySnapshot {
  const mediaChannels = (graph.performanceMedia.activeChannels.value ?? []) as string[];

  return {
    companyId: graph.companyId,
    companyName: graph.companyName,
    verticalId: graph.identity.industry?.value ?? null, // Using industry as vertical identifier
    industry: graph.identity.industry.value,
    metrics: {
      cpa: graph.performanceMedia.blendedCpa?.value as number | undefined,
      roas: graph.performanceMedia.blendedRoas?.value as number | undefined,
      conversionRate: graph.performanceMedia.blendedCtr?.value as number | undefined, // Using CTR as proxy
    },
    activeChannels: mediaChannels,
    topChannel: graph.performanceMedia.topPerformingChannel.value as string | null,
    healthScore: computeSimpleHealthScore(graph),
    creativeTrends: graph.performanceMedia.topCreatives.value ?? [],
    audienceSegments: graph.audience.coreSegments.value ?? [],
  };
}

/**
 * Compute a simple health score from the graph
 */
function computeSimpleHealthScore(graph: CompanyContextGraph): number {
  let score = 0;
  let factors = 0;

  // Brand completeness
  if (graph.brand.positioning.value) { score += 1; factors += 1; }
  if (graph.brand.valueProps.value?.length) { score += 1; factors += 1; }

  // Audience completeness
  if (graph.audience.coreSegments.value?.length) { score += 1; factors += 1; }
  if (graph.audience.painPoints.value?.length) { score += 1; factors += 1; }

  // Media data
  const activeChannels = graph.performanceMedia.activeChannels.value;
  if (activeChannels && Array.isArray(activeChannels) && activeChannels.length > 0) {
    score += 1;
    factors += 1;
  }

  return factors > 0 ? score / factors : 0;
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Detected pattern across companies
 */
interface DetectedPattern {
  type: 'correlation' | 'trend' | 'anomaly' | 'cluster';
  description: string;
  affectedCompanies: string[];
  confidence: number;
  evidence: string;
}

/**
 * Detect patterns across company snapshots
 */
function detectPatterns(snapshots: CompanySnapshot[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Group by vertical
  const byVertical = new Map<string, CompanySnapshot[]>();
  for (const snap of snapshots) {
    const vertical = snap.verticalId || 'unknown';
    if (!byVertical.has(vertical)) {
      byVertical.set(vertical, []);
    }
    byVertical.get(vertical)!.push(snap);
  }

  // Detect channel preference patterns by vertical
  for (const [vertical, verticalSnapshots] of byVertical) {
    if (verticalSnapshots.length < 2) continue;

    const channelCounts = new Map<string, number>();
    for (const snap of verticalSnapshots) {
      if (snap.topChannel) {
        channelCounts.set(
          snap.topChannel,
          (channelCounts.get(snap.topChannel) || 0) + 1
        );
      }
    }

    // Find dominant channel
    for (const [channel, count] of channelCounts) {
      const ratio = count / verticalSnapshots.length;
      if (ratio >= 0.6 && count >= 2) {
        patterns.push({
          type: 'cluster',
          description: `${channel} is the dominant top-performing channel in ${vertical} vertical (${Math.round(ratio * 100)}% of companies)`,
          affectedCompanies: verticalSnapshots
            .filter((s) => s.topChannel === channel)
            .map((s) => s.companyId),
          confidence: ratio,
          evidence: `${count} of ${verticalSnapshots.length} companies`,
        });
      }
    }
  }

  // Detect CPA outliers
  const cpas = snapshots
    .filter((s) => s.metrics.cpa !== undefined)
    .map((s) => ({ companyId: s.companyId, cpa: s.metrics.cpa! }));

  if (cpas.length >= 3) {
    const avgCpa = cpas.reduce((sum, c) => sum + c.cpa, 0) / cpas.length;
    const stdDev = Math.sqrt(
      cpas.reduce((sum, c) => sum + Math.pow(c.cpa - avgCpa, 2), 0) / cpas.length
    );

    for (const { companyId, cpa } of cpas) {
      if (Math.abs(cpa - avgCpa) > 2 * stdDev) {
        const direction = cpa > avgCpa ? 'high' : 'low';
        patterns.push({
          type: 'anomaly',
          description: `Company ${companyId} has anomalously ${direction} CPA ($${cpa.toFixed(2)} vs avg $${avgCpa.toFixed(2)})`,
          affectedCompanies: [companyId],
          confidence: 0.8,
          evidence: `${Math.abs(cpa - avgCpa).toFixed(2)} std devs from mean`,
        });
      }
    }
  }

  // Detect health score patterns
  const lowHealthCompanies = snapshots.filter((s) => s.healthScore < 0.4);
  if (lowHealthCompanies.length >= 2) {
    patterns.push({
      type: 'trend',
      description: `${lowHealthCompanies.length} companies have incomplete context graphs (health < 40%)`,
      affectedCompanies: lowHealthCompanies.map((s) => s.companyId),
      confidence: 0.9,
      evidence: `Average health: ${(lowHealthCompanies.reduce((sum, s) => sum + s.healthScore, 0) / lowHealthCompanies.length * 100).toFixed(0)}%`,
    });
  }

  return patterns;
}

// ============================================================================
// Hypothesis Generation
// ============================================================================

/**
 * Generate causal hypotheses from patterns
 */
function generateCausalHypotheses(
  patterns: DetectedPattern[],
  _snapshots: CompanySnapshot[]
): string[] {
  const hypotheses: string[] = [];

  for (const pattern of patterns) {
    switch (pattern.type) {
      case 'cluster':
        if (pattern.description.includes('dominant top-performing channel')) {
          const channel = pattern.description.split(' is ')[0];
          hypotheses.push(
            `${channel} may have inherently better audience match for this vertical's customer base`
          );
          hypotheses.push(
            `Competitors in this vertical may have trained the audience to expect ${channel} advertising`
          );
        }
        break;

      case 'anomaly':
        if (pattern.description.includes('CPA')) {
          const isHigh = pattern.description.includes('high CPA');
          if (isHigh) {
            hypotheses.push(
              `High CPA may indicate poor audience targeting or creative fatigue`
            );
            hypotheses.push(
              `High CPA may indicate market saturation or increased competition`
            );
          } else {
            hypotheses.push(
              `Low CPA may indicate untapped audience segment or effective creative strategy`
            );
          }
        }
        break;

      case 'trend':
        if (pattern.description.includes('incomplete context graphs')) {
          hypotheses.push(
            `Incomplete context may be causing suboptimal AI recommendations`
          );
          hypotheses.push(
            `Companies with incomplete profiles may be newer clients needing onboarding`
          );
        }
        break;
    }
  }

  // Cross-reference hypotheses with data
  const uniqueHypotheses = [...new Set(hypotheses)];
  return uniqueHypotheses.slice(0, 5); // Return top 5
}

// ============================================================================
// Recommendation Generation
// ============================================================================

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  patterns: DetectedPattern[],
  hypotheses: string[],
  _snapshots: CompanySnapshot[]
): string[] {
  const recommendations: string[] = [];

  // From patterns
  for (const pattern of patterns) {
    if (pattern.type === 'cluster' && pattern.description.includes('dominant')) {
      recommendations.push(
        `Consider ${pattern.description.split(' is ')[0]} as default channel for new companies in this vertical`
      );
    }

    if (pattern.type === 'anomaly' && pattern.description.includes('high CPA')) {
      recommendations.push(
        `Investigate ${pattern.affectedCompanies[0]} for creative refresh or audience expansion opportunities`
      );
    }

    if (pattern.type === 'trend' && pattern.description.includes('incomplete')) {
      recommendations.push(
        `Prioritize context graph completion for ${pattern.affectedCompanies.length} companies to improve AI quality`
      );
    }
  }

  // From hypotheses
  if (hypotheses.some((h) => h.includes('creative fatigue'))) {
    recommendations.push(
      'Run creative refresh diagnostic across high-CPA accounts'
    );
  }

  if (hypotheses.some((h) => h.includes('audience targeting'))) {
    recommendations.push(
      'Audit audience definitions and consider persona regeneration for affected companies'
    );
  }

  return [...new Set(recommendations)].slice(0, 5);
}

// ============================================================================
// Main Reasoning Function
// ============================================================================

/**
 * Run the Hive Reasoner to answer a strategic question
 *
 * @param query The reasoning query
 * @param allCompanyIds All company IDs to consider
 * @returns Structured conclusion with findings and recommendations
 */
export async function reason(
  query: ReasonerQuery,
  allCompanyIds: string[]
): Promise<ReasonerConclusion> {

  // Apply filters
  let companyIds = allCompanyIds;
  if (query.companyFilter?.length) {
    companyIds = companyIds.filter((id) => query.companyFilter!.includes(id));
  }

  // Load company snapshots
  const snapshots = await loadCompanySnapshots(companyIds);

  // Apply vertical filter
  let filteredSnapshots = snapshots;
  if (query.verticalFilter?.length) {
    filteredSnapshots = snapshots.filter((s) =>
      s.verticalId && query.verticalFilter!.includes(s.verticalId)
    );
  }

  // Detect patterns
  const patterns = detectPatterns(filteredSnapshots);

  // Generate hypotheses
  const hypotheses = generateCausalHypotheses(patterns, filteredSnapshots);

  // Generate recommendations
  const recommendations = generateRecommendations(
    patterns,
    hypotheses,
    filteredSnapshots
  );

  // Build evidence
  const evidence: ReasonerEvidence[] = patterns.map((p) => ({
    type: p.type === 'correlation' ? 'correlation' : 'pattern',
    description: p.description,
    companyIds: p.affectedCompanies,
    strength: p.confidence > 0.8 ? 'strong' : p.confidence > 0.5 ? 'moderate' : 'weak',
    dataPoints: p.affectedCompanies.length,
  }));

  // Extract affected verticals
  const affectedVerticals = [
    ...new Set(
      filteredSnapshots
        .filter((s) => s.verticalId)
        .map((s) => s.verticalId!)
    ),
  ];

  // Calculate overall confidence
  const avgPatternConfidence =
    patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
      : 0.5;

  const conclusion: ReasonerConclusion = {
    question: query.question,
    findings: patterns.map((p) => p.description),
    causalHypotheses: hypotheses,
    recommendedActions: recommendations,
    affectedVerticals,
    confidence: avgPatternConfidence,
    evidence,
    analyzedAt: new Date().toISOString(),
    companiesAnalyzed: filteredSnapshots.length,
  };

  return conclusion;
}

// ============================================================================
// Specialized Reasoning Functions
// ============================================================================

/**
 * Ask a question about a specific vertical
 */
export async function askAboutVertical(
  verticalId: string,
  question: string,
  companyIds: string[]
): Promise<ReasonerConclusion> {
  return reason(
    {
      question,
      verticalFilter: [verticalId],
      depth: 'standard',
    },
    companyIds
  );
}

/**
 * Compare performance across verticals
 */
export async function compareVerticals(
  companyIds: string[]
): Promise<{
  verticalRankings: Array<{
    verticalId: string;
    avgHealthScore: number;
    companyCount: number;
    topChannel: string | null;
  }>;
  insights: string[];
}> {
  const snapshots = await loadCompanySnapshots(companyIds);

  // Group by vertical
  const byVertical = new Map<string, CompanySnapshot[]>();
  for (const snap of snapshots) {
    const vertical = snap.verticalId || 'unknown';
    if (!byVertical.has(vertical)) {
      byVertical.set(vertical, []);
    }
    byVertical.get(vertical)!.push(snap);
  }

  // Compute rankings
  const verticalRankings = Array.from(byVertical.entries())
    .map(([verticalId, snaps]) => {
      const avgHealth =
        snaps.reduce((sum, s) => sum + s.healthScore, 0) / snaps.length;

      // Find most common top channel
      const channelCounts = new Map<string, number>();
      for (const snap of snaps) {
        if (snap.topChannel) {
          channelCounts.set(
            snap.topChannel,
            (channelCounts.get(snap.topChannel) || 0) + 1
          );
        }
      }
      let topChannel: string | null = null;
      let maxCount = 0;
      for (const [channel, count] of channelCounts) {
        if (count > maxCount) {
          maxCount = count;
          topChannel = channel;
        }
      }

      return {
        verticalId,
        avgHealthScore: avgHealth,
        companyCount: snaps.length,
        topChannel,
      };
    })
    .sort((a, b) => b.avgHealthScore - a.avgHealthScore);

  // Generate insights
  const insights: string[] = [];

  if (verticalRankings.length >= 2) {
    const top = verticalRankings[0];
    const bottom = verticalRankings[verticalRankings.length - 1];

    insights.push(
      `${top.verticalId} has the highest average health score (${(top.avgHealthScore * 100).toFixed(0)}%)`
    );

    if (top.avgHealthScore - bottom.avgHealthScore > 0.3) {
      insights.push(
        `Significant health gap between top and bottom verticals (${((top.avgHealthScore - bottom.avgHealthScore) * 100).toFixed(0)}% difference)`
      );
    }
  }

  // Channel diversity insights
  const uniqueTopChannels = new Set(
    verticalRankings.map((v) => v.topChannel).filter(Boolean)
  );
  if (uniqueTopChannels.size === 1) {
    insights.push(
      `All verticals share the same top channel: ${[...uniqueTopChannels][0]}`
    );
  } else if (uniqueTopChannels.size > 3) {
    insights.push(
      `High channel diversity across verticals - each may need specialized strategy`
    );
  }

  return { verticalRankings, insights };
}

/**
 * Identify companies that need attention
 */
export async function identifyAttentionNeeded(
  companyIds: string[]
): Promise<{
  urgent: Array<{ companyId: string; reason: string }>;
  watchlist: Array<{ companyId: string; reason: string }>;
}> {
  const snapshots = await loadCompanySnapshots(companyIds);

  const urgent: Array<{ companyId: string; reason: string }> = [];
  const watchlist: Array<{ companyId: string; reason: string }> = [];

  for (const snap of snapshots) {
    // Critical health score
    if (snap.healthScore < 0.3) {
      urgent.push({
        companyId: snap.companyId,
        reason: `Very low context health (${(snap.healthScore * 100).toFixed(0)}%)`,
      });
      continue;
    }

    // No active channels
    if (snap.activeChannels.length === 0) {
      urgent.push({
        companyId: snap.companyId,
        reason: 'No active media channels detected',
      });
      continue;
    }

    // Low health score (watchlist)
    if (snap.healthScore < 0.5) {
      watchlist.push({
        companyId: snap.companyId,
        reason: `Low context health (${(snap.healthScore * 100).toFixed(0)}%)`,
      });
    }

    // High CPA outlier (need vertical context for this)
    if (snap.metrics.cpa && snap.metrics.cpa > 100) {
      watchlist.push({
        companyId: snap.companyId,
        reason: `High CPA ($${snap.metrics.cpa.toFixed(2)})`,
      });
    }
  }

  return { urgent, watchlist };
}

/**
 * Get global Hive summary
 */
export async function getHiveSummary(companyIds: string[]): Promise<{
  totalCompanies: number;
  healthDistribution: { healthy: number; warning: number; critical: number };
  topChannels: Array<{ channel: string; count: number }>;
  verticalBreakdown: Array<{ vertical: string; count: number }>;
  keyInsights: string[];
}> {
  const snapshots = await loadCompanySnapshots(companyIds);

  // Health distribution
  const healthDistribution = {
    healthy: snapshots.filter((s) => s.healthScore >= 0.7).length,
    warning: snapshots.filter((s) => s.healthScore >= 0.4 && s.healthScore < 0.7).length,
    critical: snapshots.filter((s) => s.healthScore < 0.4).length,
  };

  // Top channels
  const channelCounts = new Map<string, number>();
  for (const snap of snapshots) {
    for (const channel of snap.activeChannels) {
      channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
    }
  }
  const topChannels = Array.from(channelCounts.entries())
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Vertical breakdown
  const verticalCounts = new Map<string, number>();
  for (const snap of snapshots) {
    const vertical = snap.verticalId || 'Unknown';
    verticalCounts.set(vertical, (verticalCounts.get(vertical) || 0) + 1);
  }
  const verticalBreakdown = Array.from(verticalCounts.entries())
    .map(([vertical, count]) => ({ vertical, count }))
    .sort((a, b) => b.count - a.count);

  // Key insights
  const keyInsights: string[] = [];

  const healthyPercent = (healthDistribution.healthy / snapshots.length) * 100;
  keyInsights.push(
    `${healthyPercent.toFixed(0)}% of companies have healthy context graphs`
  );

  if (healthDistribution.critical > 0) {
    keyInsights.push(
      `${healthDistribution.critical} companies need immediate attention`
    );
  }

  if (topChannels.length > 0) {
    keyInsights.push(
      `${topChannels[0].channel} is the most used channel (${topChannels[0].count} companies)`
    );
  }

  return {
    totalCompanies: snapshots.length,
    healthDistribution,
    topChannels,
    verticalBreakdown,
    keyInsights,
  };
}
