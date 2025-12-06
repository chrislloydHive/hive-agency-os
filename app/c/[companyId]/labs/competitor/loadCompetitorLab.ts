// app/c/[companyId]/labs/competitor/loadCompetitorLab.ts
// Server-side data loader for Competitor Lab - EXPANDED
//
// Includes all expanded competitive intelligence data:
// - Competitors with confidence, trajectory, threats
// - Feature matrix
// - Pricing landscape
// - Messaging overlap
// - Market clusters
// - Threat scores
// - Substitutes
// - Whitespace opportunities (structured)

import { loadContextGraph } from '@/lib/contextGraph/storage';
import type {
  CompetitorProfile,
  FeatureMatrixEntry,
  PricingModel,
  MessageOverlap,
  MarketCluster,
  ThreatScore,
  Substitute,
  WhitespaceOpportunity,
  PriceTier,
} from '@/lib/contextGraph/domains/competitive';

// ============================================================================
// Types
// ============================================================================

export interface CompetitorLabContext {
  companyId: string;
  companyName: string;

  // Positioning Map
  primaryAxis: string | null;
  secondaryAxis: string | null;
  positionSummary: string | null;

  // Competitors
  competitors: CompetitorProfile[];

  // Whitespace (structured)
  whitespaceMap: WhitespaceOpportunity[];
  whitespaceOpportunities: string[]; // Legacy string array

  // Feature Matrix
  featuresMatrix: FeatureMatrixEntry[];

  // Pricing Landscape
  pricingModels: PricingModel[];
  ownPriceTier: PriceTier | null;
  categoryMedianPrice: number | null;

  // Messaging Overlap
  messageOverlap: MessageOverlap[];
  messagingDifferentiationScore: number | null;

  // Market Clusters
  marketClusters: MarketCluster[];

  // Threat Modeling
  threatScores: ThreatScore[];
  overallThreatLevel: number | null;

  // Substitutes
  substitutes: Substitute[];

  // Other competitive data
  competitiveAdvantages: string[];
  competitiveThreats: string[];
  competitiveOpportunities: string[];
  differentiationStrategy: string | null;
  marketTrends: string[];

  // Own position
  ownXPosition: number | null;
  ownYPosition: number | null;

  // Data quality
  dataConfidence: number | null;
  lastValidatedAt: string | null;

  // Context health
  readiness: {
    canRunHighConfidence: boolean;
    missingCritical: string[];
    recommendations: string[];
  };

  // Source/provenance info
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}

// ============================================================================
// Loader
// ============================================================================

export async function loadCompetitorLabContext(
  companyId: string,
  companyName: string
): Promise<CompetitorLabContext> {
  const graph = await loadContextGraph(companyId);

  const competitive = graph?.competitive;
  const identity = graph?.identity;
  const brand = graph?.brand;

  // Extract competitors with all new fields
  const competitors: CompetitorProfile[] = (
    competitive?.competitors?.value ||
    competitive?.primaryCompetitors?.value ||
    []
  ).map((c) => ({
    name: c.name,
    domain: c.domain || c.website || null,
    website: c.website || null,
    category: c.category || null,
    positioning: c.positioning || null,
    estimatedBudget: c.estimatedBudget || null,
    primaryChannels: c.primaryChannels || [],
    strengths: c.strengths || [],
    weaknesses: c.weaknesses || [],
    uniqueClaims: c.uniqueClaims || [],
    offers: c.offers || [],
    pricingSummary: c.pricingSummary || null,
    pricingNotes: c.pricingNotes || null,
    notes: c.notes || null,
    xPosition: c.xPosition ?? c.positionPrimary ?? null,
    yPosition: c.yPosition ?? c.positionSecondary ?? null,
    positionPrimary: c.positionPrimary || null,
    positionSecondary: c.positionSecondary || null,
    // New fields for expanded competitive model
    confidence: c.confidence ?? 0.5,
    lastValidatedAt: c.lastValidatedAt || null,
    trajectory: c.trajectory || null,
    trajectoryReason: c.trajectoryReason || null,
    provenance: c.provenance || [],
    threatLevel: c.threatLevel ?? null,
    threatDrivers: c.threatDrivers || [],
    autoSeeded: c.autoSeeded ?? false,
  }));

  // Extract expanded competitive data
  const featuresMatrix: FeatureMatrixEntry[] = (competitive?.featuresMatrix?.value || []).map((f) => ({
    featureName: f.featureName,
    description: f.description || null,
    companySupport: f.companySupport ?? false,
    competitors: f.competitors || [],
    importance: f.importance ?? 50,
  }));

  const pricingModels: PricingModel[] = (competitive?.pricingModels?.value || []).map((p) => ({
    competitorName: p.competitorName,
    priceTier: p.priceTier,
    pricingNotes: p.pricingNotes || null,
    inferredPricePoint: p.inferredPricePoint ?? null,
    currency: p.currency || 'USD',
    valueForMoneyScore: p.valueForMoneyScore ?? 50,
    modelType: p.modelType || null,
  }));

  const messageOverlap: MessageOverlap[] = (competitive?.messageOverlap?.value || []).map((m) => ({
    theme: m.theme,
    competitorsUsingIt: m.competitorsUsingIt || [],
    overlapScore: m.overlapScore ?? 0,
    suggestion: m.suggestion || null,
    companyUsing: m.companyUsing ?? false,
  }));

  const marketClusters: MarketCluster[] = (competitive?.marketClusters?.value || []).map((c) => ({
    clusterName: c.clusterName,
    description: c.description || null,
    competitors: c.competitors || [],
    clusterPosition: c.clusterPosition || { x: 0, y: 0 },
    threatLevel: c.threatLevel ?? 50,
    whitespaceOpportunity: c.whitespaceOpportunity || null,
    color: c.color || null,
  }));

  const threatScores: ThreatScore[] = (competitive?.threatScores?.value || []).map((t) => ({
    competitorName: t.competitorName,
    threatLevel: t.threatLevel,
    threatDrivers: t.threatDrivers || [],
    timeHorizon: t.timeHorizon || null,
    defensiveActions: t.defensiveActions || [],
  }));

  const substitutes: Substitute[] = (competitive?.substitutes?.value || []).map((s) => ({
    name: s.name,
    domain: s.domain || null,
    reasonCustomersChooseThem: s.reasonCustomersChooseThem || null,
    category: s.category || null,
    threatLevel: s.threatLevel ?? 30,
    counterStrategy: s.counterStrategy || null,
  }));

  const whitespaceMap: WhitespaceOpportunity[] = (competitive?.whitespaceMap?.value || []).map((w) => ({
    name: w.name,
    description: w.description || null,
    position: w.position || { x: 0, y: 0 },
    size: w.size ?? 50,
    strategicFit: w.strategicFit ?? 50,
    captureActions: w.captureActions || [],
  }));

  // Find own position (competitor with category "own")
  const ownCompetitor = competitors.find((c) => c.category === 'own');
  const ownXPosition = ownCompetitor?.xPosition ?? competitive?.ownPositionPrimary?.value ?? null;
  const ownYPosition = ownCompetitor?.yPosition ?? competitive?.ownPositionSecondary?.value ?? null;

  // Check readiness
  const missingCritical: string[] = [];
  const recommendations: string[] = [];

  if (!identity?.industry?.value) missingCritical.push('identity.industry');
  if (!brand?.positioning?.value) missingCritical.push('brand.positioning');

  if (competitors.length === 0) {
    recommendations.push('No competitors defined - run Competitor Lab to analyze the competitive landscape');
  }
  if (!competitive?.primaryAxis?.value) {
    recommendations.push('Positioning axes not defined - needed for competitive mapping');
  }
  if (featuresMatrix.length === 0) {
    recommendations.push('No feature matrix defined - run Competitor Lab to compare features');
  }
  if (pricingModels.length === 0) {
    recommendations.push('No pricing landscape data');
  }
  if (marketClusters.length === 0) {
    recommendations.push('No market clusters identified');
  }

  // Get provenance info
  let lastUpdatedAt: string | null = null;
  let lastUpdatedBy: string | null = null;

  const competitorsProv = competitive?.competitors?.provenance?.[0];
  if (competitorsProv) {
    lastUpdatedAt = competitorsProv.updatedAt || null;
    lastUpdatedBy = competitorsProv.source || null;
  }

  return {
    companyId,
    companyName,

    primaryAxis: competitive?.primaryAxis?.value || null,
    secondaryAxis: competitive?.secondaryAxis?.value || null,
    positionSummary: competitive?.positionSummary?.value || competitive?.positioningSummary?.value || null,

    competitors,

    // Whitespace
    whitespaceMap,
    whitespaceOpportunities: competitive?.whitespaceOpportunities?.value || [],

    // Feature Matrix
    featuresMatrix,

    // Pricing Landscape
    pricingModels,
    ownPriceTier: competitive?.ownPriceTier?.value || null,
    categoryMedianPrice: competitive?.categoryMedianPrice?.value ?? null,

    // Messaging Overlap
    messageOverlap,
    messagingDifferentiationScore: competitive?.messagingDifferentiationScore?.value ?? null,

    // Market Clusters
    marketClusters,

    // Threat Modeling
    threatScores,
    overallThreatLevel: competitive?.overallThreatLevel?.value ?? null,

    // Substitutes
    substitutes,

    competitiveAdvantages: competitive?.competitiveAdvantages?.value || [],
    competitiveThreats: competitive?.competitiveThreats?.value || [],
    competitiveOpportunities: competitive?.competitiveOpportunities?.value || [],
    differentiationStrategy: competitive?.differentiationStrategy?.value || null,
    marketTrends: competitive?.marketTrends?.value || [],

    ownXPosition,
    ownYPosition,

    // Data quality
    dataConfidence: competitive?.dataConfidence?.value ?? null,
    lastValidatedAt: competitive?.lastValidatedAt?.value || null,

    readiness: {
      canRunHighConfidence: missingCritical.length === 0,
      missingCritical,
      recommendations,
    },

    lastUpdatedAt,
    lastUpdatedBy,
  };
}
