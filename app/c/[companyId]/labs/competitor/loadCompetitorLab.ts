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
import { getCompanyById } from '@/lib/airtable/companies';
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
import {
  isB2CCompany,
  B2C_ALLOWED_COMPETITOR_TYPES,
  getPositioningAxes,
  type B2CPositioningAxes,
} from '@/lib/competition-v3/b2cRetailClassifier';
import {
  detectVerticalCategory,
  getVerticalTerminology,
  getAllowedTypesForVertical,
} from '@/lib/competition-v3/verticalClassifier';
import {
  filterSelfCompetitors,
  type CompanyIdentity,
} from '@/lib/competition-v3/cleanup/selfCompetitorFilter';
import type { QueryContext, CompetitorType, VerticalCategory } from '@/lib/competition-v3/types';

// ============================================================================
// Domain Normalization Helpers
// ============================================================================

/**
 * Normalize a domain for comparison - removes protocol, www, and trailing slashes
 */
function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  let normalized = domain.toLowerCase().trim();
  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '');
  // Remove www.
  normalized = normalized.replace(/^www\./, '');
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  // Remove path
  normalized = normalized.split('/')[0];
  return normalized || null;
}

/**
 * Check if two domains are the same company (handles various formats)
 */
function isSameDomain(domain1: string | null | undefined, domain2: string | null | undefined): boolean {
  const norm1 = normalizeDomain(domain1);
  const norm2 = normalizeDomain(domain2);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2;
}

// ============================================================================
// Types
// ============================================================================

export interface CompetitorLabContext {
  companyId: string;
  companyName: string;

  // Business Model Category (B2C vs B2B)
  isB2C: boolean;
  businessModelCategory: 'B2B' | 'B2C' | 'Hybrid' | null;
  allowedCompetitorTypes: CompetitorType[];

  // Vertical Category Intelligence (V3.5)
  verticalCategory: VerticalCategory;
  subVertical: string | null;
  verticalTerminology: {
    customer: string;
    customers: string;
    product: string;
    products: string;
    competitor: string;
    competitors: string;
    market: string;
    differentiationFocus: string[];
    threatFocus: string[];
  };

  // Positioning Map
  primaryAxis: string | null;
  secondaryAxis: string | null;
  positionSummary: string | null;
  positioningAxes: B2CPositioningAxes | null;

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

  // Fetch company to get the company domain for self-filtering
  let companyDomain: string | null = null;
  let companyWebsite: string | null = null;
  try {
    const company = await getCompanyById(companyId);
    companyDomain = normalizeDomain(company?.domain || company?.website);
    companyWebsite = company?.website || null;
  } catch (e) {
    console.warn('[loadCompetitorLabContext] Could not fetch company for domain filtering:', e);
  }

  const competitive = graph?.competitive;
  const identity = graph?.identity;
  const brand = graph?.brand;

  // Extract competitors with all new fields
  const allCompetitors: CompetitorProfile[] = (
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
    // V3.5 fields
    businessModelCategory: c.businessModelCategory || null,
    jtbdMatches: c.jtbdMatches ?? null,
    offerOverlapScore: c.offerOverlapScore ?? null,
    signalsVerified: c.signalsVerified ?? null,
    // Vertical classification
    verticalCategory: c.verticalCategory || null,
    subVertical: c.subVertical || null,
  }));

  // CRITICAL: Filter out self-competitors using 4-layer detection
  // This ensures the company NEVER appears as a competitor through:
  // 1. Exact domain match
  // 2. Normalized root domain match
  // 3. Name similarity threshold (Levenshtein distance)
  // 4. Brand alias comparison (company name variations)
  const companyIdentity: CompanyIdentity = {
    name: companyName,
    domain: companyDomain,
    website: companyWebsite,
    aliases: [], // Could be extended to include known aliases
  };

  const { filtered: competitors, removed: selfCompetitorMatches } = filterSelfCompetitors(
    companyIdentity,
    allCompetitors
  );

  // Log removal details for debugging
  if (selfCompetitorMatches.length > 0) {
    console.log(`[loadCompetitorLabContext] Removed ${selfCompetitorMatches.length} self-competitor(s):`);
    for (const { candidate, check } of selfCompetitorMatches) {
      console.log(`  - "${candidate.name}" (${check.matchType}): ${check.reason}`);
    }
  }

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

  // ============================================================================
  // FINAL SELF-COMPETITOR FILTER (bulletproof last line of defense)
  // ============================================================================
  // This runs right before returning to UI, guaranteeing no self-competitors slip through
  const companyNameNorm = companyName?.toLowerCase().trim();
  let finalFilteredCompetitors = competitors.filter((c) => {
    const d = normalizeDomain(c.domain);
    const n = c.name?.toLowerCase().trim();

    const isSelfByDomain = d && companyDomain && d === companyDomain;
    const isSelfByName = n && companyNameNorm && n === companyNameNorm;

    if (isSelfByDomain) {
      console.warn(`[loadCompetitorLabContext] FINAL FILTER removed self-competitor by domain: "${c.name}" (${c.domain})`);
      return false;
    }
    if (isSelfByName) {
      console.warn(`[loadCompetitorLabContext] FINAL FILTER removed self-competitor by name: "${c.name}"`);
      return false;
    }
    return true;
  });

  // ============================================================================
  // B2C DETECTION & FILTERING
  // ============================================================================
  // Build minimal QueryContext to detect B2C status
  const queryContext: QueryContext = {
    businessName: companyName,
    domain: companyDomain,
    industry: identity?.industry?.value || null,
    businessModel: identity?.businessModel?.value || null,
    businessModelCategory: (identity as any)?.businessModelCategory?.value || null,
    icpDescription: identity?.icpDescription?.value || graph?.audience?.primaryAudience?.value || null,
    icpStage: null,
    targetIndustries: graph?.audience?.segmentDetails?.value?.map((s: any) => s.industry).filter(Boolean) || [],
    primaryOffers: graph?.productOffer?.productLines?.value || [],
    serviceModel: null,
    pricePositioning: null,
    valueProposition: brand?.valueProps?.value?.[0] || null,
    differentiators: brand?.differentiators?.value || [],
    geography: identity?.geographicFootprint?.value || null,
    serviceRegions: [],
    aiOrientation: null,
    invalidCompetitors: competitive?.invalidCompetitors?.value || [],
  };

  const companyIsB2C = isB2CCompany(queryContext);

  // Detect vertical category
  const verticalResult = detectVerticalCategory(queryContext);
  const verticalCategory = verticalResult.verticalCategory;
  const subVertical = verticalResult.subVertical;
  const terminology = getVerticalTerminology(verticalCategory);

  console.log(`[loadCompetitorLabContext] Vertical: ${verticalCategory}${subVertical ? ` (${subVertical})` : ''}`);

  // Get allowed types based on vertical (more specific than B2C alone)
  const allowedTypes = getAllowedTypesForVertical(verticalCategory);

  // Filter out B2B-only competitor types for B2C companies
  if (companyIsB2C) {
    const beforeCount = finalFilteredCompetitors.length;
    finalFilteredCompetitors = finalFilteredCompetitors.filter((c) => {
      // Use businessModelCategory as a proxy for competitor type
      const compType = c.businessModelCategory?.toLowerCase();
      if (compType === 'fractional' || compType === 'internal') {
        console.log(`[loadCompetitorLabContext] B2C FILTER removed ${compType} competitor: "${c.name}"`);
        return false;
      }
      return true;
    });
    if (beforeCount !== finalFilteredCompetitors.length) {
      console.log(`[loadCompetitorLabContext] B2C filter removed ${beforeCount - finalFilteredCompetitors.length} competitors`);
    }
  }

  // Get appropriate positioning axes for B2C vs B2B
  const positioningAxesConfig = getPositioningAxes(queryContext);

  return {
    companyId,
    companyName,

    // B2C Detection
    isB2C: companyIsB2C,
    businessModelCategory: queryContext.businessModelCategory,
    allowedCompetitorTypes: allowedTypes,

    // Vertical Category Intelligence
    verticalCategory,
    subVertical,
    verticalTerminology: {
      customer: terminology.customer,
      customers: terminology.customers,
      product: terminology.product,
      products: terminology.products,
      competitor: terminology.competitor,
      competitors: terminology.competitors,
      market: terminology.market,
      differentiationFocus: terminology.differentiation,
      threatFocus: terminology.threats,
    },

    primaryAxis: companyIsB2C
      ? positioningAxesConfig.xAxis.label
      : competitive?.primaryAxis?.value || null,
    secondaryAxis: companyIsB2C
      ? positioningAxesConfig.yAxis.label
      : competitive?.secondaryAxis?.value || null,
    positionSummary: competitive?.positionSummary?.value || competitive?.positioningSummary?.value || null,
    positioningAxes: positioningAxesConfig,

    competitors: finalFilteredCompetitors,

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
