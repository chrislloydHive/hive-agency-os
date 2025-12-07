// lib/competition-v3/summarizeForContext.ts
// Summarization logic for Context Graph Competitive domain
//
// Takes a full V3 run and produces a normalized summary suitable for
// the Context Graph competitive domain.

import type { CompetitionCompetitor, CompetitionInsights, CompetitorType } from './ui-types';
import type { CompetitionRunV3Payload } from './store';

// ============================================================================
// Types
// ============================================================================

/**
 * Summary format for Context Graph competitive domain
 */
export interface CompetitorSummary {
  name: string;
  url?: string;
  domain?: string;
  type: CompetitorType;
  threat: number;
  icpFit: number;
  valueModelFit: number;
}

/**
 * Competitive summary for Context Graph
 */
export interface CompetitiveSummary {
  primaryCompetitors: CompetitorSummary[];
  alternativeCompetitors: CompetitorSummary[];
  landscapeSummary: string;
  categoryBreakdown: string;
  threatLevel: number;
  lastUpdated: string;
  // Additional fields for Context Graph
  keyRisks: string[];
  keyOpportunities: string[];
  recommendedMoves: {
    now: string[];
    next: string[];
    later: string[];
  };
}

// ============================================================================
// Summarization
// ============================================================================

/**
 * Summarize a V3 competition run for Context Graph storage
 */
export function summarizeForContext(run: CompetitionRunV3Payload): CompetitiveSummary {
  const { competitors, insights, recommendations, createdAt, summary } = run;

  // Convert V3 competitors to UI format for processing
  const uiCompetitors: CompetitionCompetitor[] = competitors.map(c => ({
    id: c.id,
    name: c.name,
    url: c.homepageUrl || undefined,
    domain: c.domain || undefined,
    type: c.classification.type,
    summary: c.summary,
    coordinates: {
      valueModelFit: c.positioning.x,
      icpFit: c.positioning.y,
    },
    scores: {
      icp: c.scores.icpFit,
      businessModel: c.scores.businessModelFit,
      services: c.scores.serviceOverlap,
      valueModel: c.scores.valueModelFit,
      aiOrientation: c.scores.aiOrientation,
      geography: c.scores.geographyFit,
      threat: c.scores.threatScore,
      relevance: c.scores.relevanceScore,
    },
    classification: {
      confidence: c.classification.confidence,
      reasoning: c.classification.reasoning,
    },
  }));

  // Extract primary competitors (direct threats)
  const primary = uiCompetitors
    .filter(c => c.type === 'direct')
    .sort((a, b) => b.scores.threat - a.scores.threat)
    .slice(0, 5);

  // Extract alternative competitors (all other types)
  const alternatives = uiCompetitors
    .filter(c =>
      c.type === 'partial' ||
      c.type === 'fractional' ||
      c.type === 'platform' ||
      c.type === 'internal'
    )
    .sort((a, b) => b.scores.threat - a.scores.threat)
    .slice(0, 10);

  // Compute global threat level from top 3 direct competitors
  const topThreats = primary.slice(0, 3);
  const threatLevel = topThreats.length > 0
    ? Math.round(
        topThreats.reduce((acc, c) => acc + c.scores.threat, 0) /
        topThreats.length
      )
    : 0;

  // Build landscape summary
  const landscapeSummary = buildLandscapeSummary(insights, summary);

  // Build category breakdown
  const categoryBreakdown = buildCategoryBreakdown(summary.byType);

  // Extract insights for Context Graph
  const threatInsights = insights.filter(i => i.category === 'threat');
  const opportunityInsights = insights.filter(
    i => i.category === 'opportunity' || i.category === 'white-space'
  );

  // Extract recommended moves from recommendations
  const recommendedMoves = extractRecommendedMoves(recommendations);

  return {
    primaryCompetitors: primary.map(minify),
    alternativeCompetitors: alternatives.map(minify),
    landscapeSummary,
    categoryBreakdown,
    threatLevel,
    lastUpdated: createdAt,
    keyRisks: threatInsights.map(i => i.description).slice(0, 5),
    keyOpportunities: opportunityInsights.map(i => i.description).slice(0, 5),
    recommendedMoves,
  };
}

/**
 * Minify a competitor to summary format
 */
function minify(c: CompetitionCompetitor): CompetitorSummary {
  return {
    name: c.name,
    url: c.url,
    domain: c.domain,
    type: c.type,
    threat: c.scores.threat,
    icpFit: c.coordinates.icpFit,
    valueModelFit: c.coordinates.valueModelFit,
  };
}

/**
 * Build landscape summary string
 */
function buildLandscapeSummary(
  insights: any[],
  summary: CompetitionRunV3Payload['summary']
): string {
  // Try to find a summary insight
  const summaryInsight = insights.find(i => i.category === 'trend');
  if (summaryInsight?.description) {
    return summaryInsight.description;
  }

  // Build a default summary
  const { totalCompetitors, byType, avgThreatScore } = summary;
  const directCount = byType.direct || 0;
  const partialCount = byType.partial || 0;
  const platformCount = byType.platform || 0;

  let summaryParts: string[] = [];
  summaryParts.push(`Analyzed ${totalCompetitors} competitors.`);

  if (directCount > 0) {
    summaryParts.push(`${directCount} direct threat${directCount !== 1 ? 's' : ''}`);
  }
  if (partialCount > 0) {
    summaryParts.push(`${partialCount} category neighbor${partialCount !== 1 ? 's' : ''}`);
  }
  if (platformCount > 0) {
    summaryParts.push(`${platformCount} platform alternative${platformCount !== 1 ? 's' : ''}`);
  }

  if (avgThreatScore >= 60) {
    summaryParts.push(`Average threat level is high (${avgThreatScore}/100).`);
  } else if (avgThreatScore >= 40) {
    summaryParts.push(`Average threat level is moderate (${avgThreatScore}/100).`);
  } else {
    summaryParts.push(`Average threat level is low (${avgThreatScore}/100).`);
  }

  return summaryParts.join(' ');
}

/**
 * Build category breakdown string
 */
function buildCategoryBreakdown(byType: CompetitionRunV3Payload['summary']['byType']): string {
  const parts: string[] = [];

  if (byType.direct > 0) parts.push(`${byType.direct} direct`);
  if (byType.partial > 0) parts.push(`${byType.partial} partial`);
  if (byType.fractional > 0) parts.push(`${byType.fractional} fractional`);
  if (byType.platform > 0) parts.push(`${byType.platform} platform`);
  if (byType.internal > 0) parts.push(`${byType.internal} internal`);

  return parts.join(', ') || 'No competitors classified';
}

/**
 * Extract recommended moves from strategic recommendations
 */
function extractRecommendedMoves(
  recommendations: any[]
): { now: string[]; next: string[]; later: string[] } {
  const now: string[] = [];
  const next: string[] = [];
  const later: string[] = [];

  // Sort by priority
  const sorted = [...recommendations].sort((a, b) => (a.priority || 2) - (b.priority || 2));

  for (const rec of sorted) {
    const description = rec.title || rec.description;
    if (!description) continue;

    if (rec.priority === 1) {
      now.push(description);
    } else if (rec.priority === 2) {
      next.push(description);
    } else {
      later.push(description);
    }
  }

  // Limit to 3 per category
  return {
    now: now.slice(0, 3),
    next: next.slice(0, 3),
    later: later.slice(0, 3),
  };
}
