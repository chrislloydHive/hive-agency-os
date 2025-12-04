// lib/contextGraph/fusion.ts
// AI Fusion Pipeline for Company Context Graph
//
// This module orchestrates the fusion of all diagnostic data into the
// unified Context Graph. It loads data from all sources, uses AI to
// extract and merge insights, and produces a complete context graph.

import { randomUUID } from 'crypto';
import { CompanyContextGraph, createEmptyContextGraph } from './companyContextGraph';
import { loadContextGraph, saveContextGraph } from './storage';
import { setDomainFields, createProvenance, markFusionComplete, type ProvenanceSource } from './mutate';
import { captureSnapshot, type SnapshotReason } from './history';
import { loadDiagnosticsBundle } from '@/lib/media/diagnosticsLoader';
import type { DiagnosticsBundle } from '@/lib/media/diagnosticsInputs';
import { getCompanyInsights } from '@/lib/airtable/clientBrain';
import { getCompanyById } from '@/lib/airtable/companies';
import type { ClientInsight } from '@/lib/types/clientBrain';

// ============================================================================
// Fusion Types
// ============================================================================

export interface FusionResult {
  success: boolean;
  graph: CompanyContextGraph;
  runId: string;
  sourcesUsed: ProvenanceSource[];
  fieldsUpdated: number;
  errors: string[];
  durationMs: number;
  /** Version ID if one was created */
  versionId?: string;
}

export interface FusionOptions {
  /** Force full rebuild even if graph exists */
  forceRebuild?: boolean;
  /** Only fuse specific domains */
  domains?: string[];
  /** Skip AI-powered fusion (just copy raw data) */
  skipAi?: boolean;
  /** Create a snapshot after fusion (defaults to true) */
  createSnapshot?: boolean;
  /** Reason for the snapshot */
  snapshotReason?: SnapshotReason;
  /** Description for the snapshot */
  snapshotDescription?: string;
}

// ============================================================================
// Main Fusion Function
// ============================================================================

/**
 * Run the full fusion pipeline for a company
 *
 * This is the main entry point for building/updating a company's context graph.
 * It loads all available diagnostics, insights, and company data, then fuses
 * them into a unified context graph.
 */
export async function runFusion(
  companyId: string,
  options: FusionOptions = {}
): Promise<FusionResult> {
  const startTime = Date.now();
  const runId = randomUUID();
  const errors: string[] = [];
  const sourcesUsed: ProvenanceSource[] = [];
  let fieldsUpdated = 0;

  console.log(`[Fusion] Starting fusion for ${companyId} (run: ${runId})`);

  try {
    // 1. Load or create the context graph
    let graph = options.forceRebuild
      ? null
      : await loadContextGraph(companyId);

    // Get company info for new graphs
    const company = await getCompanyById(companyId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    if (!graph) {
      graph = createEmptyContextGraph(companyId, company.name);
      console.log(`[Fusion] Created new graph for ${company.name}`);
    }

    // 2. Load all data sources in parallel
    const [diagnostics, insights] = await Promise.all([
      loadDiagnosticsBundle(companyId).catch((e) => {
        errors.push(`Failed to load diagnostics: ${e.message}`);
        return null;
      }),
      getCompanyInsights(companyId, { limit: 100 }).catch((e) => {
        errors.push(`Failed to load insights: ${e.message}`);
        return [] as ClientInsight[];
      }),
    ]);

    // 3. Fuse company identity from Airtable
    if (company) {
      sourcesUsed.push('airtable');
      const identityResult = fuseCompanyIdentity(graph, company, runId);
      fieldsUpdated += identityResult.fieldsUpdated;
    }

    // 4. Fuse diagnostics
    if (diagnostics) {
      const diagResult = fuseDiagnostics(graph, diagnostics, runId);
      fieldsUpdated += diagResult.fieldsUpdated;
      sourcesUsed.push(...diagResult.sources);
    }

    // 5. Fuse insights (from Client Brain)
    if (insights && insights.length > 0) {
      sourcesUsed.push('brain');
      const insightsResult = fuseInsights(graph, insights, runId);
      fieldsUpdated += insightsResult.fieldsUpdated;
    }

    // 6. Mark fusion complete
    markFusionComplete(graph, runId);

    // 7. Save the graph
    await saveContextGraph(graph);

    // 8. Create snapshot if requested (default: true)
    let versionId: string | undefined;
    const shouldSnapshot = options.createSnapshot !== false;
    if (shouldSnapshot) {
      const changeReason = options.snapshotReason || 'diagnostic_run';
      const version = await captureSnapshot(graph, changeReason, {
        description: options.snapshotDescription || `Fusion run with ${fieldsUpdated} fields updated`,
        triggerRunId: runId,
      });
      if (version) {
        versionId = version.versionId;
        console.log(`[Fusion] Created version ${versionId} for ${company.name}`);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Fusion] Complete for ${company.name}: ${fieldsUpdated} fields, ${durationMs}ms`);

    return {
      success: true,
      graph,
      runId,
      sourcesUsed: [...new Set(sourcesUsed)],
      fieldsUpdated,
      errors,
      durationMs,
      versionId,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    console.error(`[Fusion] Failed for ${companyId}:`, error);

    return {
      success: false,
      graph: createEmptyContextGraph(companyId, 'Unknown'),
      runId,
      sourcesUsed,
      fieldsUpdated,
      errors,
      durationMs,
    };
  }
}

// ============================================================================
// Domain Fusion Functions
// ============================================================================

/**
 * Fuse company identity from Airtable company record
 */
function fuseCompanyIdentity(
  graph: CompanyContextGraph,
  company: Awaited<ReturnType<typeof getCompanyById>>,
  runId: string
): { fieldsUpdated: number } {
  if (!company) return { fieldsUpdated: 0 };

  const provenance = createProvenance('airtable', { runId, confidence: 1.0 });
  let fieldsUpdated = 0;

  // Update identity domain - map Airtable fields to context graph schema
  const identityFields: Record<string, unknown> = {};

  if (company.name) {
    identityFields.businessName = company.name;
    fieldsUpdated++;
  }
  if (company.industry) {
    identityFields.industry = company.industry;
    fieldsUpdated++;
  }
  if (company.companyType) {
    // Map company type to business model enum
    const businessModelMap: Record<string, string> = {
      'SaaS': 'saas',
      'Services': 'services',
      'Marketplace': 'marketplace',
      'eCom': 'ecommerce',
      'Local': 'retail',
      'Other': 'other',
    };
    identityFields.businessModel = businessModelMap[company.companyType] || 'other';
    fieldsUpdated++;
  }
  if (company.region) {
    identityFields.geographicFootprint = company.region;
    fieldsUpdated++;
  }

  if (Object.keys(identityFields).length > 0) {
    setDomainFields(graph, 'identity', identityFields as any, provenance);
  }

  return { fieldsUpdated };
}

/**
 * Fuse all diagnostics into the context graph
 */
function fuseDiagnostics(
  graph: CompanyContextGraph,
  bundle: DiagnosticsBundle,
  runId: string
): { fieldsUpdated: number; sources: ProvenanceSource[] } {
  let fieldsUpdated = 0;
  const sources: ProvenanceSource[] = [];

  // GAP data
  if (bundle.gap) {
    const source: ProvenanceSource = bundle.gap.type === 'gap_ia' ? 'gap_ia' :
      bundle.gap.type === 'gap_full' ? 'gap_full' : 'gap_heavy';
    sources.push(source);
    fieldsUpdated += fuseGapData(graph, bundle.gap, source, runId);
  }

  // Website Lab
  if (bundle.website) {
    sources.push('website_lab');
    fieldsUpdated += fuseWebsiteLabData(graph, bundle.website, runId);
  }

  // Brand Lab
  if (bundle.brand) {
    sources.push('brand_lab');
    fieldsUpdated += fuseBrandLabData(graph, bundle.brand, runId);
  }

  // Content Lab
  if (bundle.content) {
    sources.push('content_lab');
    fieldsUpdated += fuseContentLabData(graph, bundle.content, runId);
  }

  // SEO Lab
  if (bundle.seo) {
    sources.push('seo_lab');
    fieldsUpdated += fuseSeoLabData(graph, bundle.seo, runId);
  }

  // Demand Lab
  if (bundle.demand) {
    sources.push('demand_lab');
    fieldsUpdated += fuseDemandLabData(graph, bundle.demand, runId);
  }

  // Ops Lab
  if (bundle.ops) {
    sources.push('ops_lab');
    fieldsUpdated += fuseOpsLabData(graph, bundle.ops, runId);
  }

  return { fieldsUpdated, sources };
}

/**
 * Fuse GAP data into context graph
 */
function fuseGapData(
  graph: CompanyContextGraph,
  gap: NonNullable<DiagnosticsBundle['gap']>,
  source: ProvenanceSource,
  runId: string
): number {
  const provenance = createProvenance(source, { runId, confidence: 0.9 });
  let fieldsUpdated = 0;

  // Identity from GAP - use correct schema field names
  if (gap.businessContext) {
    const identityFields: Record<string, unknown> = {};
    if (gap.businessContext.businessName) {
      identityFields.businessName = gap.businessContext.businessName;
      fieldsUpdated++;
    }
    if (gap.businessContext.industry) {
      identityFields.industry = gap.businessContext.industry;
      fieldsUpdated++;
    }
    if (gap.businessContext.businessModel) {
      identityFields.businessModel = gap.businessContext.businessModel;
      fieldsUpdated++;
    }
    if (gap.businessContext.geographicScope) {
      identityFields.geographicFootprint = gap.businessContext.geographicScope;
      fieldsUpdated++;
    }
    if (Object.keys(identityFields).length > 0) {
      setDomainFields(graph, 'identity', identityFields as any, provenance);
    }
  }

  // Overall scores
  if (gap.overallScore !== undefined) {
    setDomainFields(graph, 'identity', { readinessScore: gap.overallScore } as any, provenance);
    fieldsUpdated++;
  }

  // Brand scores
  if (gap.dimensionScores?.brand !== undefined) {
    setDomainFields(graph, 'brand', { brandScore: gap.dimensionScores.brand } as any, provenance);
    fieldsUpdated++;
  }

  // Content scores
  if (gap.dimensionScores?.content !== undefined) {
    setDomainFields(graph, 'content', { contentScore: gap.dimensionScores.content } as any, provenance);
    fieldsUpdated++;
  }

  // SEO scores
  if (gap.dimensionScores?.seo !== undefined) {
    setDomainFields(graph, 'seo', { seoScore: gap.dimensionScores.seo } as any, provenance);
    fieldsUpdated++;
  }

  // Website scores
  if (gap.dimensionScores?.website !== undefined) {
    setDomainFields(graph, 'website', { websiteScore: gap.dimensionScores.website } as any, provenance);
    fieldsUpdated++;
  }

  // Quick wins and findings
  if (gap.quickWins && gap.quickWins.length > 0) {
    setDomainFields(graph, 'website', { quickWins: gap.quickWins } as any, provenance);
    fieldsUpdated++;
  }

  return fieldsUpdated;
}

/**
 * Fuse Website Lab data
 */
function fuseWebsiteLabData(
  graph: CompanyContextGraph,
  website: NonNullable<DiagnosticsBundle['website']>,
  runId: string
): number {
  const provenance = createProvenance('website_lab', { runId, confidence: 0.85 });
  let fieldsUpdated = 0;

  const websiteFields: Record<string, unknown> = {};

  if (website.score !== undefined) {
    websiteFields.websiteScore = website.score;
    fieldsUpdated++;
  }
  if (website.strategistView) {
    websiteFields.websiteSummary = website.strategistView;
    fieldsUpdated++;
  }
  if (website.executiveSummary) {
    websiteFields.executiveSummary = website.executiveSummary;
    fieldsUpdated++;
  }
  if (website.funnelIssues && website.funnelIssues.length > 0) {
    websiteFields.conversionBlocks = website.funnelIssues;
    fieldsUpdated++;
  }
  if (website.infraNotes && website.infraNotes.length > 0) {
    websiteFields.infraNotes = website.infraNotes;
    fieldsUpdated++;
  }
  if (website.recommendations && website.recommendations.length > 0) {
    websiteFields.recommendations = website.recommendations;
    fieldsUpdated++;
  }
  if (website.criticalIssues && website.criticalIssues.length > 0) {
    websiteFields.criticalIssues = website.criticalIssues;
    fieldsUpdated++;
  }
  if (website.coreWebVitals) {
    websiteFields.coreWebVitals = website.coreWebVitals;
    fieldsUpdated++;
  }

  if (Object.keys(websiteFields).length > 0) {
    setDomainFields(graph, 'website', websiteFields as any, provenance);
  }

  return fieldsUpdated;
}

/**
 * Fuse Brand Lab data
 */
function fuseBrandLabData(
  graph: CompanyContextGraph,
  brand: NonNullable<DiagnosticsBundle['brand']>,
  runId: string
): number {
  const provenance = createProvenance('brand_lab', { runId, confidence: 0.85 });
  let fieldsUpdated = 0;

  const brandFields: Record<string, unknown> = {};

  if (brand.score !== undefined) {
    brandFields.brandScore = brand.score;
    fieldsUpdated++;
  }
  if (brand.strategistView) {
    brandFields.brandSummary = brand.strategistView;
    fieldsUpdated++;
  }
  if (brand.positioningSummary) {
    brandFields.positioningStatement = brand.positioningSummary;
    fieldsUpdated++;
  }
  if (brand.valueProps && brand.valueProps.length > 0) {
    brandFields.valueProps = brand.valueProps;
    fieldsUpdated++;
  }
  if (brand.differentiators && brand.differentiators.length > 0) {
    brandFields.differentiators = brand.differentiators;
    fieldsUpdated++;
  }
  if (brand.voiceTone) {
    brandFields.brandVoice = brand.voiceTone;
    fieldsUpdated++;
  }
  if (brand.strengths && brand.strengths.length > 0) {
    brandFields.brandStrengths = brand.strengths;
    fieldsUpdated++;
  }
  if (brand.weaknesses && brand.weaknesses.length > 0) {
    brandFields.brandWeaknesses = brand.weaknesses;
    fieldsUpdated++;
  }
  if (brand.competitivePosition) {
    brandFields.competitivePosition = brand.competitivePosition;
    fieldsUpdated++;
  }

  if (Object.keys(brandFields).length > 0) {
    setDomainFields(graph, 'brand', brandFields as any, provenance);
  }

  return fieldsUpdated;
}

/**
 * Fuse Content Lab data
 */
function fuseContentLabData(
  graph: CompanyContextGraph,
  content: NonNullable<DiagnosticsBundle['content']>,
  runId: string
): number {
  const provenance = createProvenance('content_lab', { runId, confidence: 0.85 });
  let fieldsUpdated = 0;

  const contentFields: Record<string, unknown> = {};

  if (content.score !== undefined) {
    contentFields.contentScore = content.score;
    fieldsUpdated++;
  }
  if (content.strategistView) {
    contentFields.contentSummary = content.strategistView;
    fieldsUpdated++;
  }
  if (content.keyTopics && content.keyTopics.length > 0) {
    contentFields.keyTopics = content.keyTopics;
    fieldsUpdated++;
  }
  if (content.contentGaps && content.contentGaps.length > 0) {
    // Convert string gaps to ContentGap objects
    contentFields.contentGaps = content.contentGaps.map((gap: string | { topic?: string }) => ({
      topic: typeof gap === 'string' ? gap : gap.topic || String(gap),
      priority: 'medium' as const,
      audienceNeed: null,
      recommendedFormat: null,
    }));
    fieldsUpdated++;
  }
  if (content.audienceNeeds && content.audienceNeeds.length > 0) {
    contentFields.audienceContentNeeds = content.audienceNeeds;
    fieldsUpdated++;
  }
  if (content.topPerformingThemes && content.topPerformingThemes.length > 0) {
    contentFields.topPerformingThemes = content.topPerformingThemes;
    fieldsUpdated++;
  }
  if (content.productionCapacity) {
    contentFields.productionCapacity = content.productionCapacity;
    fieldsUpdated++;
  }
  if (content.qualityNotes) {
    contentFields.qualityNotes = content.qualityNotes;
    fieldsUpdated++;
  }

  if (Object.keys(contentFields).length > 0) {
    setDomainFields(graph, 'content', contentFields as any, provenance);
  }

  return fieldsUpdated;
}

/**
 * Fuse SEO Lab data
 */
function fuseSeoLabData(
  graph: CompanyContextGraph,
  seo: NonNullable<DiagnosticsBundle['seo']>,
  runId: string
): number {
  const provenance = createProvenance('seo_lab', { runId, confidence: 0.85 });
  let fieldsUpdated = 0;

  const seoFields: Record<string, unknown> = {};

  if (seo.score !== undefined) {
    seoFields.seoScore = seo.score;
    fieldsUpdated++;
  }
  if (seo.strategistView) {
    seoFields.seoSummary = seo.strategistView;
    fieldsUpdated++;
  }
  if (seo.topKeywords && seo.topKeywords.length > 0) {
    seoFields.topKeywords = seo.topKeywords;
    fieldsUpdated++;
  }
  if (seo.keywordOpportunities && seo.keywordOpportunities.length > 0) {
    // Convert to KeywordOpportunity objects
    seoFields.keywordOpportunities = seo.keywordOpportunities.map((kw: string | { keyword?: string }) => ({
      keyword: typeof kw === 'string' ? kw : kw.keyword || String(kw),
      searchVolume: null,
      difficulty: null,
      currentRank: null,
      opportunityScore: null,
      intent: null,
    }));
    fieldsUpdated++;
  }
  if (seo.organicCompetitors && seo.organicCompetitors.length > 0) {
    seoFields.contentOpportunities = seo.organicCompetitors;
    fieldsUpdated++;
  }
  if (seo.domainAuthority !== undefined) {
    seoFields.domainAuthority = seo.domainAuthority;
    fieldsUpdated++;
  }
  if (seo.backlinkProfile) {
    seoFields.backlinkProfile = seo.backlinkProfile;
    fieldsUpdated++;
  }
  if (seo.technicalHealth) {
    seoFields.technicalHealth = seo.technicalHealth;
    fieldsUpdated++;
  }
  if (seo.localSeoStatus) {
    seoFields.localSeoHealth = seo.localSeoStatus;
    fieldsUpdated++;
  }

  if (Object.keys(seoFields).length > 0) {
    setDomainFields(graph, 'seo', seoFields as any, provenance);
  }

  return fieldsUpdated;
}

/**
 * Fuse Demand Lab data
 */
function fuseDemandLabData(
  graph: CompanyContextGraph,
  demand: NonNullable<DiagnosticsBundle['demand']>,
  runId: string
): number {
  const provenance = createProvenance('demand_lab', { runId, confidence: 0.85 });
  let fieldsUpdated = 0;

  const mediaFields: Record<string, unknown> = {};

  if (demand.score !== undefined) {
    mediaFields.mediaScore = demand.score;
    fieldsUpdated++;
  }
  if (demand.strategistView) {
    mediaFields.mediaSummary = demand.strategistView;
    fieldsUpdated++;
  }
  if (demand.channelPerformanceSummary) {
    mediaFields.audienceTargeting = demand.channelPerformanceSummary;
    fieldsUpdated++;
  }
  if (demand.bestChannels && demand.bestChannels.length > 0) {
    // Map to channel enum values
    mediaFields.activeChannels = demand.bestChannels.map(mapChannelName);
    fieldsUpdated++;
  }
  if (demand.weakChannels && demand.weakChannels.length > 0) {
    mediaFields.underperformingChannels = demand.weakChannels.map(mapChannelName);
    fieldsUpdated++;
  }
  if (demand.attributionNotes) {
    mediaFields.attributionModel = demand.attributionNotes;
    fieldsUpdated++;
  }
  if (demand.funnelPerformance) {
    mediaFields.creativeRotation = demand.funnelPerformance;
    fieldsUpdated++;
  }

  if (Object.keys(mediaFields).length > 0) {
    setDomainFields(graph, 'performanceMedia', mediaFields as any, provenance);
  }

  return fieldsUpdated;
}

/**
 * Fuse Ops Lab data
 */
function fuseOpsLabData(
  graph: CompanyContextGraph,
  ops: NonNullable<DiagnosticsBundle['ops']>,
  runId: string
): number {
  const provenance = createProvenance('ops_lab', { runId, confidence: 0.85 });
  let fieldsUpdated = 0;

  const infraFields: Record<string, unknown> = {};

  if (ops.strategistView) {
    infraFields.trackingStackSummary = ops.strategistView;
    fieldsUpdated++;
  }
  if (ops.trackingStackNotes && ops.trackingStackNotes.length > 0) {
    infraFields.trackingTools = ops.trackingStackNotes;
    fieldsUpdated++;
  }
  if (ops.ga4Health) {
    infraFields.ga4Health = ops.ga4Health;
    fieldsUpdated++;
  }
  if (ops.gscHealth) {
    infraFields.searchConsoleHealth = ops.gscHealth;
    fieldsUpdated++;
  }
  if (ops.gbpHealth) {
    infraFields.gbpHealth = ops.gbpHealth;
    fieldsUpdated++;
  }
  if (ops.callTracking) {
    infraFields.callTracking = ops.callTracking;
    fieldsUpdated++;
  }
  if (ops.offlineConversion) {
    infraFields.offlineConversionTracking = ops.offlineConversion;
    fieldsUpdated++;
  }
  if (ops.crmNotes) {
    infraFields.crmAndLeadFlow = ops.crmNotes;
    fieldsUpdated++;
  }
  if (ops.dataQuality) {
    infraFields.dataQuality = ops.dataQuality;
    fieldsUpdated++;
  }
  if (ops.measurementLimitations && ops.measurementLimitations.length > 0) {
    infraFields.measurementLimits = ops.measurementLimitations.join('; ');
    fieldsUpdated++;
  }
  if (ops.techStack && ops.techStack.length > 0) {
    infraFields.trackingTools = ops.techStack;
    fieldsUpdated++;
  }

  if (Object.keys(infraFields).length > 0) {
    setDomainFields(graph, 'digitalInfra', infraFields as any, provenance);
  }

  // Also update ops domain
  const opsFields: Record<string, unknown> = {};
  if (ops.techStack && ops.techStack.length > 0) {
    opsFields.techStack = ops.techStack;
    fieldsUpdated++;
  }

  if (Object.keys(opsFields).length > 0) {
    setDomainFields(graph, 'ops', opsFields as any, provenance);
  }

  return fieldsUpdated;
}

/**
 * Fuse insights from Client Brain
 */
function fuseInsights(
  graph: CompanyContextGraph,
  insights: ClientInsight[],
  runId: string
): { fieldsUpdated: number } {
  const provenance = createProvenance('brain', { runId, confidence: 0.8 });
  let fieldsUpdated = 0;

  // Group insights by category
  const byCategory: Record<string, ClientInsight[]> = {};
  for (const insight of insights) {
    if (!byCategory[insight.category]) {
      byCategory[insight.category] = [];
    }
    byCategory[insight.category].push(insight);
  }

  // Map insights to domains
  if (byCategory.brand && byCategory.brand.length > 0) {
    const titles = byCategory.brand.slice(0, 5).map((i) => i.title);
    setDomainFields(graph, 'brand', { brandStrengths: titles } as any, provenance);
    fieldsUpdated++;
  }

  if (byCategory.content && byCategory.content.length > 0) {
    const titles = byCategory.content.slice(0, 5).map((i) => i.title);
    setDomainFields(graph, 'content', { contentPillars: titles } as any, provenance);
    fieldsUpdated++;
  }

  if (byCategory.seo && byCategory.seo.length > 0) {
    const titles = byCategory.seo.slice(0, 5).map((i) => i.title);
    setDomainFields(graph, 'seo', { seoRecommendations: titles } as any, provenance);
    fieldsUpdated++;
  }

  if (byCategory.website && byCategory.website.length > 0) {
    const titles = byCategory.website.slice(0, 5).map((i) => i.title);
    setDomainFields(graph, 'website', { quickWins: titles } as any, provenance);
    fieldsUpdated++;
  }

  if (byCategory.competitive && byCategory.competitive.length > 0) {
    const competitors = byCategory.competitive.slice(0, 5).map((i) => i.title);
    setDomainFields(graph, 'identity', { competitors } as any, provenance);
    fieldsUpdated++;
  }

  if (byCategory.product && byCategory.product.length > 0) {
    const products = byCategory.product.slice(0, 5).map((i) => i.title);
    setDomainFields(graph, 'productOffer', { heroProducts: products } as any, provenance);
    fieldsUpdated++;
  }

  return { fieldsUpdated };
}

// ============================================================================
// Helper Functions
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
