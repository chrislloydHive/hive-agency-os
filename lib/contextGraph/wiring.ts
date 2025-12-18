// lib/contextGraph/wiring.ts
// Field Wiring Mappings for Context Graph
//
// This file maintains static mappings of:
// - Which modules actually WRITE to each field
// - Which modules actually CONSUME (read) each field
//
// These mappings are used by the diagnostics system to detect:
// - Miswired fields (writer not in primarySources)
// - Orphan writers (writing to undeclared paths)
// - Orphan fields (defined but never written)
// - Unconsumed fields (written but never read)
//
// Keep this file updated when adding new writers or consumers.

import type { WriterModuleId, ConsumerModuleId } from './schema';

// ============================================================================
// Field Writers Registry
// ============================================================================

/**
 * Maps field paths to the modules that actually write them.
 * This should match what's happening in the codebase.
 *
 * When you add a new writer, update this registry.
 */
export const FIELD_WRITERS: Record<string, WriterModuleId[]> = {
  // ===========================================================================
  // Identity Domain
  // ===========================================================================
  'identity.businessName': ['Setup', 'GAP', 'Manual', 'FCB'],
  'identity.businessDescription': ['Setup', 'GAP', 'FCB'],
  'identity.industry': ['Setup', 'GAP', 'GAPHeavy', 'FCB'],
  'identity.businessModel': ['Setup', 'GAP', 'FCB'],
  'identity.primaryOffering': ['Setup', 'GAP', 'FCB'],
  'identity.revenueModel': ['Setup', 'GAP'],
  'audience.icpDescription': ['Setup', 'GAP', 'ICPExtractor', 'StrategicPlan', 'FCB'],
  'identity.marketMaturity': ['Setup', 'GAP', 'GAPHeavy'],
  'identity.geographicFootprint': ['Setup', 'GAP', 'FCB'],
  'identity.serviceArea': ['Setup', 'GAP', 'FCB'],
  'identity.foundedYear': ['Setup', 'FCB'],
  'identity.companySize': ['Setup', 'FCB'],
  'identity.competitiveLandscape': ['GAP', 'GAPHeavy', 'BrandLab', 'FCB'],
  'identity.marketPosition': ['GAP', 'GAPHeavy', 'BrandLab'],
  'identity.primaryCompetitors': ['Setup', 'GAP', 'GAPHeavy', 'FCB'],
  'identity.seasonalityNotes': ['Setup', 'GAP'],
  'identity.peakSeasons': ['Setup', 'GAP'],
  'identity.lowSeasons': ['Setup'],
  'identity.profitCenters': ['Setup'],
  'identity.revenueStreams': ['Setup', 'GAP'],

  // ===========================================================================
  // Audience Domain
  // ===========================================================================
  'audience.primaryAudience': ['Setup', 'GAP', 'AudienceLab', 'FCB'],
  'audience.audienceDescription': ['Setup', 'AudienceLab', 'FCB'],
  'audience.primaryBuyerRoles': ['Setup', 'AudienceLab', 'FCB'],
  'audience.targetDemographics': ['Setup', 'AudienceLab', 'FCB'],
  'audience.buyerTypes': ['Setup', 'AudienceLab', 'FCB'],
  'audience.companyProfile': ['Setup', 'AudienceLab'],
  'audience.coreSegments': ['Setup', 'GAP', 'AudienceLab'],
  'audience.segmentDetails': ['AudienceLab'],
  'audience.demographics': ['Setup', 'GAP', 'AudienceLab', 'FCB'],
  'audience.geos': ['Setup', 'GAP'],
  'audience.primaryMarkets': ['Setup', 'GAP'],
  'audience.behavioralDrivers': ['Setup', 'AudienceLab'],
  'audience.demandStates': ['Setup', 'AudienceLab'],
  'audience.painPoints': ['Setup', 'GAP', 'AudienceLab', 'FCB'],
  'audience.motivations': ['Setup', 'GAP', 'AudienceLab', 'FCB'],
  'audience.personaNames': ['AudienceLab', 'Setup'],
  'audience.personaBriefs': ['AudienceLab'],

  // ===========================================================================
  // Brand Domain
  // ===========================================================================
  'brand.positioning': ['BrandLab', 'GAP', 'Setup'],
  'brand.tagline': ['BrandLab', 'GAP', 'FCB'],
  'brand.missionStatement': ['BrandLab', 'GAP'],
  'brand.valueProps': ['BrandLab', 'GAP', 'CreativeLab'],
  'brand.differentiators': ['BrandLab', 'GAP', 'CreativeLab'],
  'brand.uniqueSellingPoints': ['BrandLab', 'GAP'],
  'brand.toneOfVoice': ['BrandLab', 'CreativeLab', 'FCB'],
  'brand.brandPersonality': ['BrandLab', 'FCB'],
  'brand.voiceDescriptors': ['BrandLab', 'FCB'],
  'brand.brandPromise': ['BrandLab', 'FCB'],
  'brand.messagingPillars': ['BrandLab', 'CreativeLab'],
  'brand.brandPerception': ['BrandLab'],
  'brand.brandStrengths': ['BrandLab', 'GAP'],
  'brand.brandWeaknesses': ['BrandLab', 'GAP'],
  'brand.brandGuidelines': ['Setup', 'BrandLab'],

  // ===========================================================================
  // Objectives Domain
  // ===========================================================================
  'objectives.primaryObjective': ['Setup', 'StrategicPlan', 'QBR'],
  'objectives.secondaryObjectives': ['Setup', 'StrategicPlan'],
  'objectives.primaryBusinessGoal': ['Setup', 'StrategicPlan'],
  'objectives.timeHorizon': ['Setup', 'StrategicPlan'],
  'objectives.kpiLabels': ['Setup', 'StrategicPlan'],
  'objectives.targetCpa': ['Setup', 'MediaLab'],
  'objectives.targetRoas': ['Setup', 'MediaLab'],
  'objectives.revenueGoal': ['Setup', 'StrategicPlan'],
  'objectives.leadGoal': ['Setup', 'StrategicPlan'],

  // ===========================================================================
  // Website Domain
  // ===========================================================================
  'website.websiteScore': ['WebsiteLab', 'GAP'],
  'website.websiteSummary': ['WebsiteLab', 'GAP', 'Setup'],
  'website.conversionBlocks': ['WebsiteLab', 'Setup'],
  'website.conversionOpportunities': ['WebsiteLab', 'Setup'],
  'website.criticalIssues': ['WebsiteLab', 'Setup'],
  'website.quickWins': ['WebsiteLab', 'Setup'],

  // ===========================================================================
  // Performance Media Domain
  // ===========================================================================
  'performanceMedia.mediaSummary': ['DemandLab', 'MediaLab', 'Setup'],
  'performanceMedia.activeChannels': ['DemandLab', 'MediaLab', 'Setup', 'Analytics'],
  'performanceMedia.attributionModel': ['Setup', 'DemandLab'],
  'performanceMedia.mediaIssues': ['DemandLab', 'MediaLab', 'Setup'],
  'performanceMedia.mediaOpportunities': ['DemandLab', 'MediaLab', 'Setup'],

  // ===========================================================================
  // Creative Domain
  // ===========================================================================
  'creative.messaging': ['CreativeLab'],
  'creative.segmentMessages': ['CreativeLab'],
  'creative.creativeTerritories': ['CreativeLab'],
  'creative.campaignConcepts': ['CreativeLab'],
  'creative.guidelines': ['CreativeLab'],
  'creative.channelPatterns': ['CreativeLab'],
  'creative.testingRoadmapItems': ['CreativeLab'],
  'creative.assetSpecs': ['CreativeLab'],
  'creative.coreMessages': ['Setup', 'GAP', 'CreativeLab'],
  'creative.proofPoints': ['Setup', 'GAP', 'BrandLab'],
  'creative.callToActions': ['Setup', 'CreativeLab'],
  'creative.availableFormats': ['Setup', 'CreativeLab'],
  'creative.brandGuidelines': ['Setup', 'BrandLab'],

  // ===========================================================================
  // ProductOffer Domain
  // ===========================================================================
  'productOffer.primaryProducts': ['Setup', 'FCB', 'GAP'],
  'productOffer.services': ['Setup', 'FCB', 'GAP'],
  'productOffer.valueProposition': ['Setup', 'FCB', 'BrandLab', 'GAP'],
  'productOffer.pricingModel': ['Setup', 'FCB'],
  'productOffer.keyDifferentiators': ['Setup', 'FCB', 'BrandLab', 'GAP'],

  // ===========================================================================
  // Budget & Ops Domain
  // ===========================================================================
  'budgetOps.totalMarketingBudget': ['Setup', 'MediaLab'],
  'budgetOps.mediaSpendBudget': ['Setup', 'MediaLab'],
  'budgetOps.budgetPeriod': ['Setup'],
  'budgetOps.avgCustomerValue': ['Setup'],
  'budgetOps.customerLTV': ['Setup'],

  // ===========================================================================
  // Content Domain
  // ===========================================================================
  'content.contentScore': ['ContentLab', 'GAP'],
  'content.contentSummary': ['ContentLab', 'GAP'],

  // ===========================================================================
  // SEO Domain
  // ===========================================================================
  'seo.seoScore': ['SEOLab', 'GAP'],
  'seo.seoSummary': ['SEOLab', 'GAP'],

  // ===========================================================================
  // Ops Domain
  // ===========================================================================
  'ops.opsScore': ['OpsLab', 'GAP'],
  'ops.trackingTools': ['Setup', 'OpsLab'],
  'ops.ga4PropertyId': ['Setup', 'Manual'],
  'ops.ga4ConversionEvents': ['Setup', 'OpsLab'],

  // ===========================================================================
  // Competitive Domain
  // ===========================================================================
  // Core positioning
  'competitive.primaryAxis': ['CompetitorLab', 'BrandLab', 'GAP', 'Setup', 'FCB'],
  'competitive.secondaryAxis': ['CompetitorLab', 'BrandLab', 'GAP', 'Setup', 'FCB'],
  'competitive.positionSummary': ['CompetitorLab', 'BrandLab', 'GAP'],
  'competitive.whitespaceOpportunities': ['CompetitorLab', 'BrandLab', 'GAP'],
  'competitive.whitespaceMap': ['CompetitorLab'],

  // Competitor profiles
  'competitive.competitors': ['CompetitorLab', 'BrandLab', 'GAP', 'Setup', 'FCB'],
  'competitive.primaryCompetitors': ['CompetitorLab', 'BrandLab', 'GAP', 'Setup', 'FCB'],

  // Market position
  'competitive.shareOfVoice': ['CompetitorLab', 'BrandLab', 'GAP'],
  'competitive.marketPosition': ['CompetitorLab', 'BrandLab', 'GAP'],
  'competitive.competitiveAdvantages': ['CompetitorLab', 'BrandLab', 'GAP'],
  'competitive.differentiationStrategy': ['CompetitorLab', 'BrandLab', 'GAP'],
  'competitive.uniqueValueProps': ['CompetitorLab', 'BrandLab', 'GAP'],

  // Threats & Opportunities
  'competitive.competitiveThreats': ['CompetitorLab', 'BrandLab', 'GAP'],
  'competitive.competitiveOpportunities': ['CompetitorLab', 'BrandLab', 'GAP'],
  'competitive.marketTrends': ['CompetitorLab', 'BrandLab', 'GAP'],

  // Legacy positioning
  'competitive.positioningAxes': ['CompetitorLab', 'BrandLab', 'Setup'],
  'competitive.ownPositionPrimary': ['CompetitorLab', 'BrandLab', 'Setup'],
  'competitive.ownPositionSecondary': ['CompetitorLab', 'BrandLab', 'Setup'],
  'competitive.positioningSummary': ['CompetitorLab', 'BrandLab', 'GAP'],

  // Confidence & Freshness (NEW)
  'competitive.dataConfidence': ['CompetitorLab', 'FCB', 'GAP'],
  'competitive.lastValidatedAt': ['CompetitorLab', 'FCB', 'GAP', 'Manual'],

  // Feature Matrix (NEW)
  'competitive.featuresMatrix': ['CompetitorLab', 'FCB', 'GAP', 'Manual'],

  // Pricing Landscape (NEW)
  'competitive.pricingModels': ['CompetitorLab', 'FCB', 'GAP', 'Manual'],
  'competitive.ownPriceTier': ['CompetitorLab', 'Setup', 'Manual'],
  'competitive.categoryMedianPrice': ['CompetitorLab', 'GAP'],

  // Messaging Overlap (NEW)
  'competitive.messageOverlap': ['CompetitorLab', 'BrandLab', 'CreativeLab'],
  'competitive.messagingDifferentiationScore': ['CompetitorLab', 'BrandLab'],

  // Market Clusters (NEW)
  'competitive.marketClusters': ['CompetitorLab', 'GAP'],

  // Threat Modeling (NEW)
  'competitive.threatScores': ['CompetitorLab', 'GAP'],
  'competitive.overallThreatLevel': ['CompetitorLab', 'GAP'],

  // Substitutes (NEW)
  'competitive.substitutes': ['CompetitorLab', 'FCB', 'GAP', 'Manual'],

  // Media/Benchmarks
  'competitive.competitorMediaMix': ['CompetitorLab', 'GAP'],
  'competitive.competitorBudgets': ['CompetitorLab', 'GAP'],
  'competitive.competitorSearchStrategy': ['CompetitorLab', 'GAP', 'SEOLab'],
  'competitive.competitorCreativeThemes': ['CompetitorLab', 'CreativeLab', 'GAP'],
  'competitive.categoryBenchmarks': ['CompetitorLab', 'GAP'],
  'competitive.categoryCpa': ['CompetitorLab', 'GAP'],
  'competitive.categoryRoas': ['CompetitorLab', 'GAP'],
  'competitive.categoryCtr': ['CompetitorLab', 'GAP'],
};

// ============================================================================
// Field Consumers Registry
// ============================================================================

/**
 * Maps field paths to the modules that read/consume them.
 * This helps identify orphaned fields that are written but never used.
 *
 * When you add a new consumer, update this registry.
 */
export const FIELD_CONSUMERS: Record<string, ConsumerModuleId[]> = {
  // ===========================================================================
  // Identity Domain
  // ===========================================================================
  'identity.businessName': ['Blueprint', 'Brain', 'QBR', 'StrategicPlan'],
  'identity.industry': ['AudienceLab', 'MediaLab', 'CreativeLab', 'StrategicPlan', 'Blueprint'],
  'identity.businessModel': ['AudienceLab', 'MediaLab', 'StrategicPlan'],
  'identity.revenueModel': ['MediaLab', 'StrategicPlan'],
  'audience.icpDescription': ['AudienceLab', 'MediaLab', 'CreativeLab', 'StrategicPlan', 'SetupLoader', 'Brain'],
  'identity.marketMaturity': ['StrategicPlan'],
  'identity.geographicFootprint': ['MediaLab', 'AudienceLab'],
  'identity.serviceArea': ['MediaLab'],
  'identity.competitiveLandscape': ['StrategicPlan', 'CreativeLab'],
  'identity.marketPosition': ['StrategicPlan', 'CreativeLab', 'Brain'],
  'identity.primaryCompetitors': ['StrategicPlan', 'Brain'],
  'identity.seasonalityNotes': ['MediaLab', 'StrategicPlan'],
  'identity.peakSeasons': ['MediaLab'],
  'identity.lowSeasons': ['MediaLab'],
  'identity.profitCenters': ['StrategicPlan'],
  'identity.revenueStreams': ['StrategicPlan'],

  // ===========================================================================
  // Audience Domain
  // ===========================================================================
  'audience.primaryAudience': ['MediaLab', 'CreativeLab', 'StrategicPlan', 'Brain'],
  'audience.primaryBuyerRoles': ['CreativeLab', 'MediaLab'],
  'audience.companyProfile': ['MediaLab', 'CreativeLab'],
  'audience.coreSegments': ['MediaLab', 'CreativeLab', 'StrategicPlan', 'SetupLoader'],
  'audience.segmentDetails': ['MediaLab', 'CreativeLab'],
  'audience.demographics': ['MediaLab', 'CreativeLab'],
  'audience.geos': ['MediaLab'],
  'audience.primaryMarkets': ['MediaLab'],
  'audience.behavioralDrivers': ['CreativeLab', 'MediaLab'],
  'audience.demandStates': ['MediaLab', 'CreativeLab'],
  'audience.painPoints': ['CreativeLab', 'AudienceLab'],
  'audience.motivations': ['CreativeLab', 'AudienceLab'],
  'audience.personaNames': ['CreativeLab', 'MediaLab', 'Brain'],
  'audience.personaBriefs': ['CreativeLab', 'MediaLab'],

  // ===========================================================================
  // Brand Domain
  // ===========================================================================
  'brand.positioning': ['CreativeLab', 'StrategicPlan', 'Brain'],
  'brand.tagline': ['CreativeLab', 'Brain'],
  'brand.missionStatement': ['StrategicPlan'],
  'brand.valueProps': ['CreativeLab', 'StrategicPlan'],
  'brand.differentiators': ['CreativeLab', 'StrategicPlan'],
  'brand.uniqueSellingPoints': ['CreativeLab'],
  'brand.toneOfVoice': ['CreativeLab'],
  'brand.brandPersonality': ['CreativeLab'],
  'brand.messagingPillars': ['CreativeLab', 'StrategicPlan'],
  'brand.brandPerception': ['StrategicPlan'],
  'brand.brandStrengths': ['StrategicPlan'],
  'brand.brandWeaknesses': ['StrategicPlan'],
  'brand.brandGuidelines': ['CreativeLab'],

  // ===========================================================================
  // Objectives Domain
  // ===========================================================================
  'objectives.primaryObjective': ['MediaLab', 'CreativeLab', 'StrategicPlan', 'QBR', 'Blueprint'],
  'objectives.secondaryObjectives': ['StrategicPlan'],
  'objectives.primaryBusinessGoal': ['StrategicPlan', 'QBR'],
  'objectives.timeHorizon': ['MediaLab', 'StrategicPlan'],
  'objectives.kpiLabels': ['StrategicPlan', 'QBR', 'Blueprint'],
  'objectives.targetCpa': ['MediaLab', 'Blueprint'],
  'objectives.targetRoas': ['MediaLab', 'Blueprint'],
  'objectives.revenueGoal': ['MediaLab', 'StrategicPlan'],
  'objectives.leadGoal': ['MediaLab', 'StrategicPlan'],

  // ===========================================================================
  // Website Domain
  // ===========================================================================
  'website.websiteScore': ['Blueprint', 'StrategicPlan'],
  'website.websiteSummary': ['StrategicPlan', 'CreativeLab'],
  'website.conversionBlocks': ['StrategicPlan', 'Work'],
  'website.conversionOpportunities': ['StrategicPlan', 'Work'],
  'website.criticalIssues': ['Blueprint', 'Work'],
  'website.quickWins': ['Work', 'Blueprint'],

  // ===========================================================================
  // Performance Media Domain
  // ===========================================================================
  'performanceMedia.mediaSummary': ['StrategicPlan', 'MediaLab'],
  'performanceMedia.activeChannels': ['MediaLab', 'CreativeLab', 'StrategicPlan'],
  'performanceMedia.attributionModel': ['MediaLab'],
  'performanceMedia.mediaIssues': ['StrategicPlan', 'Work'],
  'performanceMedia.mediaOpportunities': ['MediaLab', 'Work'],

  // ===========================================================================
  // Creative Domain
  // ===========================================================================
  'creative.messaging': ['StrategicPlan', 'QBR', 'Brain'],
  'creative.segmentMessages': ['StrategicPlan'],
  'creative.creativeTerritories': ['StrategicPlan', 'Work'],
  'creative.campaignConcepts': ['StrategicPlan', 'Work'],
  'creative.guidelines': ['StrategicPlan'],
  'creative.channelPatterns': ['MediaLab'],
  'creative.testingRoadmapItems': ['Work', 'QBR'],
  'creative.assetSpecs': ['Work'],
  'creative.coreMessages': ['CreativeLab'],
  'creative.proofPoints': ['CreativeLab'],
  'creative.callToActions': ['CreativeLab'],
  'creative.availableFormats': ['CreativeLab'],
  'creative.brandGuidelines': ['CreativeLab'],

  // ===========================================================================
  // Budget & Ops Domain
  // ===========================================================================
  'budgetOps.totalMarketingBudget': ['MediaLab', 'StrategicPlan'],
  'budgetOps.mediaSpendBudget': ['MediaLab', 'StrategicPlan'],
  'budgetOps.budgetPeriod': ['MediaLab'],
  'budgetOps.avgCustomerValue': ['MediaLab'],
  'budgetOps.customerLTV': ['MediaLab'],

  // ===========================================================================
  // Content Domain
  // ===========================================================================
  'content.contentScore': ['Blueprint', 'StrategicPlan'],
  'content.contentSummary': ['StrategicPlan'],

  // ===========================================================================
  // SEO Domain
  // ===========================================================================
  'seo.seoScore': ['Blueprint', 'StrategicPlan'],
  'seo.seoSummary': ['StrategicPlan'],

  // ===========================================================================
  // Ops Domain
  // ===========================================================================
  'ops.opsScore': ['Blueprint', 'StrategicPlan'],
  'ops.trackingTools': ['StrategicPlan'],
  'ops.ga4PropertyId': ['Analytics'],
  'ops.ga4ConversionEvents': ['Analytics', 'StrategicPlan'],

  // ===========================================================================
  // Competitive Domain
  // ===========================================================================
  // Core positioning
  'competitive.primaryAxis': ['QBR', 'Blueprint', 'CreativeLab', 'Brain', 'InsightsEngine'],
  'competitive.secondaryAxis': ['QBR', 'Blueprint', 'CreativeLab', 'Brain', 'InsightsEngine'],
  'competitive.positionSummary': ['QBR', 'Blueprint', 'Brain', 'InsightsEngine'],
  'competitive.whitespaceOpportunities': ['QBR', 'Blueprint', 'StrategicPlan', 'Brain', 'InsightsEngine'],
  'competitive.whitespaceMap': ['QBR', 'Blueprint', 'Brain'],

  // Competitor profiles
  'competitive.competitors': ['QBR', 'Blueprint', 'CreativeLab', 'BrandLab', 'AudienceLab', 'Brain', 'InsightsEngine'],
  'competitive.primaryCompetitors': ['QBR', 'Blueprint', 'CreativeLab', 'BrandLab', 'AudienceLab', 'Brain', 'InsightsEngine'],

  // Market position
  'competitive.shareOfVoice': ['QBR', 'Blueprint', 'InsightsEngine'],
  'competitive.marketPosition': ['QBR', 'Blueprint', 'StrategicPlan', 'InsightsEngine'],
  'competitive.competitiveAdvantages': ['CreativeLab', 'QBR', 'Blueprint', 'InsightsEngine'],
  'competitive.differentiationStrategy': ['CreativeLab', 'QBR', 'Blueprint', 'InsightsEngine'],
  'competitive.uniqueValueProps': ['CreativeLab', 'QBR', 'Blueprint', 'InsightsEngine'],

  // Threats & Opportunities
  'competitive.competitiveThreats': ['QBR', 'Blueprint', 'StrategicPlan', 'InsightsEngine'],
  'competitive.competitiveOpportunities': ['QBR', 'Blueprint', 'StrategicPlan', 'InsightsEngine'],
  'competitive.marketTrends': ['QBR', 'Blueprint', 'StrategicPlan', 'InsightsEngine'],

  // Legacy positioning
  'competitive.positioningAxes': ['QBR', 'Blueprint', 'Brain'],
  'competitive.ownPositionPrimary': ['QBR', 'Blueprint', 'Brain'],
  'competitive.ownPositionSecondary': ['QBR', 'Blueprint', 'Brain'],
  'competitive.positioningSummary': ['QBR', 'Blueprint', 'Brain', 'InsightsEngine'],

  // Confidence & Freshness (NEW)
  'competitive.dataConfidence': ['QBR', 'Blueprint', 'Brain'],
  'competitive.lastValidatedAt': ['QBR', 'Blueprint', 'Brain'],

  // Feature Matrix (NEW)
  'competitive.featuresMatrix': ['QBR', 'Blueprint', 'CreativeLab', 'Brain', 'InsightsEngine'],

  // Pricing Landscape (NEW)
  'competitive.pricingModels': ['QBR', 'Blueprint', 'MediaLab', 'Brain', 'InsightsEngine'],
  'competitive.ownPriceTier': ['QBR', 'Blueprint', 'MediaLab', 'CreativeLab', 'InsightsEngine'],
  'competitive.categoryMedianPrice': ['QBR', 'Blueprint', 'MediaLab', 'InsightsEngine'],

  // Messaging Overlap (NEW)
  'competitive.messageOverlap': ['QBR', 'Blueprint', 'CreativeLab', 'BrandLab', 'InsightsEngine'],
  'competitive.messagingDifferentiationScore': ['QBR', 'Blueprint', 'CreativeLab', 'InsightsEngine'],

  // Market Clusters (NEW)
  'competitive.marketClusters': ['QBR', 'Blueprint', 'Brain', 'InsightsEngine'],

  // Threat Modeling (NEW)
  'competitive.threatScores': ['QBR', 'Blueprint', 'StrategicPlan', 'Brain', 'InsightsEngine'],
  'competitive.overallThreatLevel': ['QBR', 'Blueprint', 'StrategicPlan', 'Brain', 'InsightsEngine'],

  // Substitutes (NEW)
  'competitive.substitutes': ['QBR', 'Blueprint', 'CreativeLab', 'Brain', 'InsightsEngine'],

  // Media/Benchmarks
  'competitive.competitorMediaMix': ['QBR', 'Blueprint', 'MediaLab'],
  'competitive.competitorBudgets': ['QBR', 'Blueprint', 'MediaLab'],
  'competitive.competitorSearchStrategy': ['QBR', 'Blueprint', 'SEOLab'],
  'competitive.competitorCreativeThemes': ['QBR', 'Blueprint', 'CreativeLab'],
  'competitive.categoryBenchmarks': ['QBR', 'Blueprint', 'MediaLab'],
  'competitive.categoryCpa': ['QBR', 'Blueprint', 'MediaLab'],
  'competitive.categoryRoas': ['QBR', 'Blueprint', 'MediaLab'],
  'competitive.categoryCtr': ['QBR', 'Blueprint', 'MediaLab'],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get writers for a field
 */
export function getWritersForField(path: string): WriterModuleId[] {
  return FIELD_WRITERS[path] || [];
}

/**
 * Get consumers for a field
 */
export function getConsumersForField(path: string): ConsumerModuleId[] {
  return FIELD_CONSUMERS[path] || [];
}

/**
 * Check if a writer is registered for a field
 */
export function isWriterRegistered(path: string, writer: WriterModuleId): boolean {
  const writers = FIELD_WRITERS[path];
  return writers ? writers.includes(writer) : false;
}

/**
 * Check if a consumer is registered for a field
 */
export function isConsumerRegistered(path: string, consumer: ConsumerModuleId): boolean {
  const consumers = FIELD_CONSUMERS[path];
  return consumers ? consumers.includes(consumer) : false;
}

/**
 * Get all unique writer modules
 */
export function getAllWriters(): WriterModuleId[] {
  const writers = new Set<WriterModuleId>();
  Object.values(FIELD_WRITERS).forEach(list => list.forEach(w => writers.add(w)));
  return Array.from(writers);
}

/**
 * Get all unique consumer modules
 */
export function getAllConsumers(): ConsumerModuleId[] {
  const consumers = new Set<ConsumerModuleId>();
  Object.values(FIELD_CONSUMERS).forEach(list => list.forEach(c => consumers.add(c)));
  return Array.from(consumers);
}

/**
 * Get all fields a writer writes to
 */
export function getFieldsWrittenBy(writer: WriterModuleId): string[] {
  return Object.entries(FIELD_WRITERS)
    .filter(([_, writers]) => writers.includes(writer))
    .map(([path]) => path);
}

/**
 * Get all fields a consumer reads from
 */
export function getFieldsConsumedBy(consumer: ConsumerModuleId): string[] {
  return Object.entries(FIELD_CONSUMERS)
    .filter(([_, consumers]) => consumers.includes(consumer))
    .map(([path]) => path);
}
