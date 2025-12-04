// lib/contextGraph/updateFromDiagnostics.ts
// Mappers to update Context Graph from diagnostic outputs
//
// These functions take diagnostic summaries and update the appropriate
// fields in the context graph with proper provenance tracking.

import type { CompanyContextGraph } from './companyContextGraph';
import type { ProvenanceTag } from './types';
import { setDomainFields, setFieldUntyped, createProvenance, type ProvenanceSource } from './mutate';
import type {
  GapRunSummary,
  WebsiteLabSummary,
  BrandLabSummary,
  ContentLabSummary,
  SeoLabSummary,
  DemandLabSummary,
  OpsLabSummary,
} from '@/lib/media/diagnosticsInputs';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create provenance tag for a diagnostic source
 */
function diagnosticProvenance(
  source: ProvenanceSource,
  runId?: string,
  confidence: number = 0.85
): ProvenanceTag {
  return createProvenance(source, {
    runId,
    sourceRunId: runId,
    confidence,
  });
}

/**
 * Map GAP run type to context source
 */
function gapTypeToSource(type: string): ProvenanceSource {
  switch (type) {
    case 'gap_ia':
      return 'gap_ia';
    case 'gap_full':
      return 'gap_full';
    case 'gap_heavy':
      return 'gap_heavy';
    default:
      return 'gap_ia';
  }
}

// ============================================================================
// GAP Mappers
// ============================================================================

/**
 * Update context graph from GAP run summary
 */
export function updateGraphFromGap(
  graph: CompanyContextGraph,
  gap: GapRunSummary
): { fieldsUpdated: number } {
  let fieldsUpdated = 0;
  const source = gapTypeToSource(gap.type);
  const provenance = diagnosticProvenance(source, gap.runId, 0.9);

  // Identity domain updates
  if (gap.businessContext) {
    const { businessContext } = gap;

    if (businessContext.businessName) {
      setFieldUntyped(graph, 'identity', 'businessName', businessContext.businessName, provenance);
      fieldsUpdated++;
    }
    if (businessContext.industry) {
      setFieldUntyped(graph, 'identity', 'industry', businessContext.industry, provenance);
      fieldsUpdated++;
    }
    if (businessContext.businessModel) {
      setFieldUntyped(graph, 'identity', 'businessModel', businessContext.businessModel, provenance);
      fieldsUpdated++;
    }
    if (businessContext.geographicScope) {
      setFieldUntyped(graph, 'identity', 'geographicFootprint', businessContext.geographicScope, provenance);
      fieldsUpdated++;
    }
  }

  // Brand domain updates
  if (gap.dimensionScores?.brand !== undefined) {
    setDomainFields(graph, 'brand', { brandScore: gap.dimensionScores.brand } as any, provenance);
    fieldsUpdated++;
  }

  // Content domain updates
  if (gap.dimensionScores?.content !== undefined) {
    setDomainFields(graph, 'content', { contentScore: gap.dimensionScores.content } as any, provenance);
    fieldsUpdated++;
  }

  // SEO domain updates
  if (gap.dimensionScores?.seo !== undefined) {
    setDomainFields(graph, 'seo', { seoScore: gap.dimensionScores.seo } as any, provenance);
    fieldsUpdated++;
  }

  // Website domain updates
  if (gap.dimensionScores?.website !== undefined) {
    setDomainFields(graph, 'website', { websiteScore: gap.dimensionScores.website } as any, provenance);
    fieldsUpdated++;
  }

  // Quick wins and findings
  if (gap.quickWins && gap.quickWins.length > 0) {
    setDomainFields(graph, 'website', { quickWins: gap.quickWins } as any, provenance);
    fieldsUpdated++;
  }

  if (gap.priorityAreas && gap.priorityAreas.length > 0) {
    setDomainFields(graph, 'content', { priorityAreas: gap.priorityAreas } as any, provenance);
    fieldsUpdated++;
  }

  // Update history refs
  const refField = gap.type === 'gap_ia' ? 'latestGapIaRunId' :
                   gap.type === 'gap_full' ? 'latestGapFullRunId' : 'latestGapHeavyRunId';
  if (gap.runId) {
    setDomainFields(graph, 'historyRefs', { [refField]: gap.runId } as any, provenance);
    fieldsUpdated++;
  }

  return { fieldsUpdated };
}

// ============================================================================
// Website Lab Mapper
// ============================================================================

/**
 * Update context graph from Website Lab summary
 */
export function updateGraphFromWebsiteLab(
  graph: CompanyContextGraph,
  website: WebsiteLabSummary
): { fieldsUpdated: number } {
  let fieldsUpdated = 0;
  const provenance = diagnosticProvenance('website_lab', website.runId, 0.85);

  if (website.score !== undefined) {
    setDomainFields(graph, 'website', { websiteScore: website.score } as any, provenance);
    fieldsUpdated++;
  }

  if (website.strategistView) {
    setDomainFields(graph, 'website', { websiteSummary: website.strategistView } as any, provenance);
    fieldsUpdated++;
  }

  if (website.executiveSummary) {
    setDomainFields(graph, 'website', { executiveSummary: website.executiveSummary } as any, provenance);
    fieldsUpdated++;
  }

  if (website.funnelIssues && website.funnelIssues.length > 0) {
    setDomainFields(graph, 'website', { conversionBlocks: website.funnelIssues } as any, provenance);
    fieldsUpdated++;
  }

  if (website.conversionBlocks && website.conversionBlocks.length > 0) {
    setFieldUntyped(graph, 'website', 'conversionBlocks', website.conversionBlocks, provenance);
    fieldsUpdated++;
  }

  if (website.criticalIssues && website.criticalIssues.length > 0) {
    setDomainFields(graph, 'website', { criticalIssues: website.criticalIssues } as any, provenance);
    fieldsUpdated++;
  }

  if (website.recommendations && website.recommendations.length > 0) {
    setDomainFields(graph, 'website', { recommendations: website.recommendations } as any, provenance);
    fieldsUpdated++;
  }

  // Infrastructure notes go to digitalInfra
  if (website.infraNotes && website.infraNotes.length > 0) {
    setDomainFields(graph, 'digitalInfra', { trackingTools: website.infraNotes } as any, provenance);
    fieldsUpdated++;
  }

  if (website.coreWebVitals) {
    setDomainFields(graph, 'website', { coreWebVitals: website.coreWebVitals } as any, provenance);
    fieldsUpdated++;
  }

  // Update history refs
  if (website.runId) {
    setDomainFields(graph, 'historyRefs', { latestWebsiteLabRunId: website.runId } as any, provenance);
    fieldsUpdated++;
  }

  return { fieldsUpdated };
}

// ============================================================================
// Brand Lab Mapper
// ============================================================================

/**
 * Update context graph from Brand Lab summary
 */
export function updateGraphFromBrandLab(
  graph: CompanyContextGraph,
  brand: BrandLabSummary
): { fieldsUpdated: number } {
  let fieldsUpdated = 0;
  const provenance = diagnosticProvenance('brand_lab', brand.runId, 0.85);

  if (brand.score !== undefined) {
    setDomainFields(graph, 'brand', { brandScore: brand.score } as any, provenance);
    fieldsUpdated++;
  }

  if (brand.strategistView) {
    setDomainFields(graph, 'brand', { brandSummary: brand.strategistView } as any, provenance);
    fieldsUpdated++;
  }

  if (brand.positioningSummary) {
    setFieldUntyped(graph, 'brand', 'positioning', brand.positioningSummary, provenance);
    fieldsUpdated++;
  }

  if (brand.valueProps && brand.valueProps.length > 0) {
    setFieldUntyped(graph, 'brand', 'valueProps', brand.valueProps, provenance);
    fieldsUpdated++;
  }

  if (brand.differentiators && brand.differentiators.length > 0) {
    setFieldUntyped(graph, 'brand', 'differentiators', brand.differentiators, provenance);
    fieldsUpdated++;
  }

  if (brand.brandPerception) {
    setDomainFields(graph, 'brand', { brandPerception: brand.brandPerception } as any, provenance);
    fieldsUpdated++;
  }

  if (brand.voiceTone) {
    setFieldUntyped(graph, 'brand', 'toneOfVoice', brand.voiceTone, provenance);
    fieldsUpdated++;
  }

  if (brand.competitivePosition) {
    setFieldUntyped(graph, 'brand', 'competitivePosition', brand.competitivePosition, provenance);
    fieldsUpdated++;
  }

  if (brand.strengths && brand.strengths.length > 0) {
    setDomainFields(graph, 'brand', { brandStrengths: brand.strengths } as any, provenance);
    fieldsUpdated++;
  }

  if (brand.weaknesses && brand.weaknesses.length > 0) {
    setDomainFields(graph, 'brand', { brandWeaknesses: brand.weaknesses } as any, provenance);
    fieldsUpdated++;
  }

  // Update history refs
  if (brand.runId) {
    setDomainFields(graph, 'historyRefs', { latestBrandLabRunId: brand.runId } as any, provenance);
    fieldsUpdated++;
  }

  return { fieldsUpdated };
}

// ============================================================================
// Content Lab Mapper
// ============================================================================

/**
 * Update context graph from Content Lab summary
 */
export function updateGraphFromContentLab(
  graph: CompanyContextGraph,
  content: ContentLabSummary
): { fieldsUpdated: number } {
  let fieldsUpdated = 0;
  const provenance = diagnosticProvenance('content_lab', content.runId, 0.85);

  if (content.score !== undefined) {
    setDomainFields(graph, 'content', { contentScore: content.score } as any, provenance);
    fieldsUpdated++;
  }

  if (content.strategistView) {
    setDomainFields(graph, 'content', { contentSummary: content.strategistView } as any, provenance);
    fieldsUpdated++;
  }

  if (content.keyTopics && content.keyTopics.length > 0) {
    setFieldUntyped(graph, 'content', 'keyTopics', content.keyTopics, provenance);
    fieldsUpdated++;
  }

  if (content.contentGaps && content.contentGaps.length > 0) {
    // Convert strings to ContentGap objects
    const gaps = content.contentGaps.map((gap: string | { topic?: string }) => ({
      topic: typeof gap === 'string' ? gap : gap.topic || String(gap),
      priority: 'medium' as const,
      audienceNeed: null,
      recommendedFormat: null,
    }));
    setDomainFields(graph, 'content', { contentGaps: gaps } as any, provenance);
    fieldsUpdated++;
  }

  if (content.audienceNeeds && content.audienceNeeds.length > 0) {
    setDomainFields(graph, 'content', { audienceContentNeeds: content.audienceNeeds } as any, provenance);
    fieldsUpdated++;
  }

  if (content.topPerformingThemes && content.topPerformingThemes.length > 0) {
    setDomainFields(graph, 'content', { topPerformingThemes: content.topPerformingThemes } as any, provenance);
    fieldsUpdated++;
  }

  if (content.productionCapacity) {
    setDomainFields(graph, 'content', { productionCapacity: content.productionCapacity } as any, provenance);
    fieldsUpdated++;
  }

  // Update history refs
  if (content.runId) {
    setDomainFields(graph, 'historyRefs', { latestContentLabRunId: content.runId } as any, provenance);
    fieldsUpdated++;
  }

  return { fieldsUpdated };
}

// ============================================================================
// SEO Lab Mapper
// ============================================================================

/**
 * Update context graph from SEO Lab summary
 */
export function updateGraphFromSeoLab(
  graph: CompanyContextGraph,
  seo: SeoLabSummary
): { fieldsUpdated: number } {
  let fieldsUpdated = 0;
  const provenance = diagnosticProvenance('seo_lab', seo.runId, 0.85);

  if (seo.score !== undefined) {
    setDomainFields(graph, 'seo', { seoScore: seo.score } as any, provenance);
    fieldsUpdated++;
  }

  if (seo.strategistView) {
    setDomainFields(graph, 'seo', { seoSummary: seo.strategistView } as any, provenance);
    fieldsUpdated++;
  }

  if (seo.topKeywords && seo.topKeywords.length > 0) {
    setFieldUntyped(graph, 'seo', 'topKeywords', seo.topKeywords, provenance);
    fieldsUpdated++;
  }

  if (seo.keywordOpportunities && seo.keywordOpportunities.length > 0) {
    const opportunities = seo.keywordOpportunities.map((kw: string | { keyword?: string }) => ({
      keyword: typeof kw === 'string' ? kw : kw.keyword || String(kw),
      searchVolume: null,
      difficulty: null,
      currentRank: null,
      opportunityScore: null,
      intent: null,
    }));
    setDomainFields(graph, 'seo', { keywordOpportunities: opportunities } as any, provenance);
    fieldsUpdated++;
  }

  if (seo.organicCompetitors && seo.organicCompetitors.length > 0) {
    setDomainFields(graph, 'seo', { organicCompetitors: seo.organicCompetitors } as any, provenance);
    fieldsUpdated++;
  }

  if (seo.domainAuthority !== undefined) {
    setFieldUntyped(graph, 'seo', 'domainAuthority', seo.domainAuthority, provenance);
    fieldsUpdated++;
  }

  if (seo.backlinkProfile) {
    setDomainFields(graph, 'seo', { backlinkProfile: seo.backlinkProfile } as any, provenance);
    fieldsUpdated++;
  }

  if (seo.technicalHealth) {
    setDomainFields(graph, 'seo', { technicalHealth: seo.technicalHealth } as any, provenance);
    fieldsUpdated++;
  }

  if (seo.localSeoStatus) {
    setDomainFields(graph, 'seo', { localSeoHealth: seo.localSeoStatus } as any, provenance);
    fieldsUpdated++;
  }

  // Update history refs
  if (seo.runId) {
    setDomainFields(graph, 'historyRefs', { latestSeoLabRunId: seo.runId } as any, provenance);
    fieldsUpdated++;
  }

  return { fieldsUpdated };
}

// ============================================================================
// Demand Lab Mapper
// ============================================================================

/**
 * Update context graph from Demand Lab summary
 */
export function updateGraphFromDemandLab(
  graph: CompanyContextGraph,
  demand: DemandLabSummary
): { fieldsUpdated: number } {
  let fieldsUpdated = 0;
  const provenance = diagnosticProvenance('demand_lab', demand.runId, 0.85);

  if (demand.score !== undefined) {
    setDomainFields(graph, 'performanceMedia', { mediaScore: demand.score } as any, provenance);
    fieldsUpdated++;
  }

  if (demand.strategistView) {
    setDomainFields(graph, 'performanceMedia', { mediaSummary: demand.strategistView } as any, provenance);
    fieldsUpdated++;
  }

  if (demand.channelPerformanceSummary) {
    setDomainFields(graph, 'performanceMedia', { audienceTargeting: demand.channelPerformanceSummary } as any, provenance);
    fieldsUpdated++;
  }

  if (demand.bestChannels && demand.bestChannels.length > 0) {
    const channels = demand.bestChannels.map(mapChannelName);
    setDomainFields(graph, 'performanceMedia', { activeChannels: channels } as any, provenance);
    fieldsUpdated++;
  }

  if (demand.weakChannels && demand.weakChannels.length > 0) {
    const channels = demand.weakChannels.map(mapChannelName);
    setDomainFields(graph, 'performanceMedia', { underperformingChannels: channels } as any, provenance);
    fieldsUpdated++;
  }

  if (demand.attributionNotes) {
    setDomainFields(graph, 'performanceMedia', { attributionModel: demand.attributionNotes } as any, provenance);
    fieldsUpdated++;
  }

  // Historical performance
  if (demand.cacTrends) {
    setDomainFields(graph, 'historical', { pastPerformanceSummary: demand.cacTrends } as any, provenance);
    fieldsUpdated++;
  }

  // Update history refs
  if (demand.runId) {
    setDomainFields(graph, 'historyRefs', { latestDemandLabRunId: demand.runId } as any, provenance);
    fieldsUpdated++;
  }

  return { fieldsUpdated };
}

// ============================================================================
// Ops Lab Mapper
// ============================================================================

/**
 * Update context graph from Ops Lab summary
 */
export function updateGraphFromOpsLab(
  graph: CompanyContextGraph,
  ops: OpsLabSummary
): { fieldsUpdated: number } {
  let fieldsUpdated = 0;
  const provenance = diagnosticProvenance('ops_lab', ops.runId, 0.85);

  if (ops.strategistView) {
    setDomainFields(graph, 'digitalInfra', { trackingStackSummary: ops.strategistView } as any, provenance);
    fieldsUpdated++;
  }

  if (ops.trackingStackNotes && ops.trackingStackNotes.length > 0) {
    setDomainFields(graph, 'digitalInfra', { trackingTools: ops.trackingStackNotes } as any, provenance);
    fieldsUpdated++;
  }

  if (ops.ga4Health) {
    setDomainFields(graph, 'digitalInfra', { ga4Health: ops.ga4Health } as any, provenance);
    fieldsUpdated++;
  }

  if (ops.gscHealth) {
    setDomainFields(graph, 'digitalInfra', { searchConsoleHealth: ops.gscHealth } as any, provenance);
    fieldsUpdated++;
  }

  if (ops.gbpHealth) {
    setDomainFields(graph, 'digitalInfra', { gbpHealth: ops.gbpHealth } as any, provenance);
    fieldsUpdated++;
  }

  if (ops.callTracking) {
    const hasCallTracking = ops.callTracking.toLowerCase().includes('enabled') ||
                            ops.callTracking.toLowerCase().includes('active') ||
                            ops.callTracking.toLowerCase().includes('yes');
    setDomainFields(graph, 'digitalInfra', { callTracking: hasCallTracking } as any, provenance);
    fieldsUpdated++;
  }

  if (ops.offlineConversion) {
    const hasOfflineConversion = ops.offlineConversion.toLowerCase().includes('enabled') ||
                                  ops.offlineConversion.toLowerCase().includes('active') ||
                                  ops.offlineConversion.toLowerCase().includes('yes');
    setDomainFields(graph, 'digitalInfra', { offlineConversionTracking: hasOfflineConversion } as any, provenance);
    fieldsUpdated++;
  }

  if (ops.crmNotes) {
    setDomainFields(graph, 'digitalInfra', { crmAndLeadFlow: ops.crmNotes } as any, provenance);
    fieldsUpdated++;
  }

  if (ops.dataQuality) {
    setDomainFields(graph, 'digitalInfra', { dataQuality: ops.dataQuality } as any, provenance);
    fieldsUpdated++;
  }

  if (ops.measurementLimitations && ops.measurementLimitations.length > 0) {
    setDomainFields(graph, 'digitalInfra', { measurementLimits: ops.measurementLimitations.join('; ') } as any, provenance);
    fieldsUpdated++;
  }

  if (ops.techStack && ops.techStack.length > 0) {
    setDomainFields(graph, 'ops', { techStack: ops.techStack } as any, provenance);
    fieldsUpdated++;
  }

  // Update history refs
  if (ops.runId) {
    setDomainFields(graph, 'historyRefs', { latestOpsLabRunId: ops.runId } as any, provenance);
    fieldsUpdated++;
  }

  return { fieldsUpdated };
}

// ============================================================================
// Helper: Channel Name Mapping
// ============================================================================

/**
 * Map channel name strings to MediaChannelId enum values
 */
function mapChannelName(channel: string): string {
  const normalized = channel.toLowerCase().replace(/[^a-z0-9]/g, '');

  const channelMap: Record<string, string> = {
    googlesearch: 'google_search',
    googleads: 'google_search',
    googleppc: 'google_search',
    ppc: 'google_search',
    sem: 'google_search',
    search: 'google_search',
    pmax: 'google_pmax',
    performancemax: 'google_pmax',
    youtube: 'youtube',
    display: 'google_display',
    gdn: 'google_display',
    facebook: 'meta',
    instagram: 'meta',
    meta: 'meta',
    facebookads: 'meta',
    linkedin: 'linkedin',
    tiktok: 'tiktok',
    bing: 'microsoft_ads',
    microsoftads: 'microsoft_ads',
    programmatic: 'programmatic',
    dsp: 'programmatic',
    dv360: 'dv360',
    spotify: 'spotify',
    podcast: 'podcast',
    ctv: 'ctv',
    tv: 'tv',
    radio: 'radio',
    ooh: 'ooh',
    print: 'print',
    directmail: 'direct_mail',
    email: 'email',
    sms: 'sms',
    affiliate: 'affiliate',
    influencer: 'influencer',
    organic: 'organic_social',
    organicsocial: 'organic_social',
    seo: 'seo',
  };

  return channelMap[normalized] || 'other';
}
