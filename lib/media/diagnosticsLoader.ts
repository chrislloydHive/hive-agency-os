// lib/media/diagnosticsLoader.ts
// Load latest diagnostics per company for Media Planning prefill
//
// This module loads the most recent diagnostic run results from each tool
// and transforms them into the standardized DiagnosticsBundle format.

import type {
  DiagnosticsBundle,
  GapRunSummary,
  WebsiteLabSummary,
  BrandLabSummary,
  ContentLabSummary,
  SeoLabSummary,
  DemandLabSummary,
  OpsLabSummary,
} from './diagnosticsInputs';
import {
  listDiagnosticRunsForCompany,
  type DiagnosticRun,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';
import { getGapIaRunsForCompanyOrDomain } from '@/lib/airtable/gapIaRuns';
import { getCompanyById } from '@/lib/airtable/companies';
import { getDiagnosticDetailsByRunId, parseDiagnosticData } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Main Loader Function
// ============================================================================

/**
 * Load all available diagnostic summaries for a company
 * Returns a DiagnosticsBundle with whatever data is available
 */
export async function loadDiagnosticsBundle(
  companyId: string
): Promise<DiagnosticsBundle> {
  console.log('[diagnosticsLoader] Loading diagnostics bundle for:', companyId);

  const assembledAt = new Date().toISOString();

  // Load all diagnostic types in parallel
  const [gap, website, brand, content, seo, demand, ops] = await Promise.all([
    loadLatestGapRun(companyId).catch((e) => {
      console.error('[diagnosticsLoader] Failed to load GAP:', e);
      return undefined;
    }),
    loadLatestWebsiteLab(companyId).catch((e) => {
      console.error('[diagnosticsLoader] Failed to load Website Lab:', e);
      return undefined;
    }),
    loadLatestBrandLab(companyId).catch((e) => {
      console.error('[diagnosticsLoader] Failed to load Brand Lab:', e);
      return undefined;
    }),
    loadLatestContentLab(companyId).catch((e) => {
      console.error('[diagnosticsLoader] Failed to load Content Lab:', e);
      return undefined;
    }),
    loadLatestSeoLab(companyId).catch((e) => {
      console.error('[diagnosticsLoader] Failed to load SEO Lab:', e);
      return undefined;
    }),
    loadLatestDemandLab(companyId).catch((e) => {
      console.error('[diagnosticsLoader] Failed to load Demand Lab:', e);
      return undefined;
    }),
    loadLatestOpsLab(companyId).catch((e) => {
      console.error('[diagnosticsLoader] Failed to load Ops Lab:', e);
      return undefined;
    }),
  ]);

  const bundle: DiagnosticsBundle = {
    companyId,
    gap,
    website,
    brand,
    content,
    seo,
    demand,
    ops,
    assembledAt,
    availableSources: {
      gap: !!gap,
      website: !!website,
      brand: !!brand,
      content: !!content,
      seo: !!seo,
      demand: !!demand,
      ops: !!ops,
    },
  };

  const sourceCount = Object.values(bundle.availableSources).filter(Boolean).length;
  console.log('[diagnosticsLoader] Bundle assembled:', {
    companyId,
    sourcesFound: sourceCount,
    sources: bundle.availableSources,
  });

  return bundle;
}

// ============================================================================
// Individual Loaders
// ============================================================================

/**
 * Load the latest GAP run (IA, Full, or Heavy) for a company
 */
async function loadLatestGapRun(companyId: string): Promise<GapRunSummary | undefined> {
  // Get company domain for domain-based matching
  const company = await getCompanyById(companyId);
  const domain = company?.website
    ? new URL(company.website.startsWith('http') ? company.website : `https://${company.website}`).hostname.replace(/^www\./, '')
    : '';

  // Try GAP-IA runs first (most common)
  const gapIaRuns = await getGapIaRunsForCompanyOrDomain(companyId, domain, 1);

  if (gapIaRuns.length > 0) {
    const run = gapIaRuns[0];
    if (run.status === 'completed') {
      return transformGapIaToSummary(run);
    }
  }

  // Also check Diagnostic Runs table for gapSnapshot, gapHeavy
  const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
    limit: 10,
  });

  // Find latest GAP-type run
  const gapRun = diagnosticRuns.find(
    (r) =>
      (r.toolId === 'gapSnapshot' || r.toolId === 'gapHeavy' || r.toolId === 'gapPlan') &&
      r.status === 'complete'
  );

  if (gapRun) {
    return transformDiagnosticRunToGapSummary(gapRun);
  }

  return undefined;
}

/**
 * Load the latest Website Lab run for a company
 */
async function loadLatestWebsiteLab(companyId: string): Promise<WebsiteLabSummary | undefined> {
  const runs = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'websiteLab',
    limit: 1,
    status: 'complete',
  });

  if (runs.length === 0) return undefined;

  const run = runs[0];
  return transformWebsiteLabRun(run);
}

/**
 * Load the latest Brand Lab run for a company
 */
async function loadLatestBrandLab(companyId: string): Promise<BrandLabSummary | undefined> {
  const runs = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'brandLab',
    limit: 1,
    status: 'complete',
  });

  if (runs.length === 0) return undefined;

  const run = runs[0];
  return transformBrandLabRun(run);
}

/**
 * Load the latest Content Lab run for a company
 */
async function loadLatestContentLab(companyId: string): Promise<ContentLabSummary | undefined> {
  const runs = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'contentLab',
    limit: 1,
    status: 'complete',
  });

  if (runs.length === 0) return undefined;

  const run = runs[0];
  return transformContentLabRun(run);
}

/**
 * Load the latest SEO Lab run for a company
 */
async function loadLatestSeoLab(companyId: string): Promise<SeoLabSummary | undefined> {
  const runs = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'seoLab',
    limit: 1,
    status: 'complete',
  });

  if (runs.length === 0) return undefined;

  const run = runs[0];
  return transformSeoLabRun(run);
}

/**
 * Load the latest Demand Lab run for a company
 */
async function loadLatestDemandLab(companyId: string): Promise<DemandLabSummary | undefined> {
  const runs = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'demandLab',
    limit: 1,
    status: 'complete',
  });

  if (runs.length === 0) return undefined;

  const run = runs[0];
  return transformDemandLabRun(run);
}

/**
 * Load the latest Ops Lab run for a company
 */
async function loadLatestOpsLab(companyId: string): Promise<OpsLabSummary | undefined> {
  const runs = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'opsLab',
    limit: 1,
    status: 'complete',
  });

  if (runs.length === 0) return undefined;

  const run = runs[0];
  return transformOpsLabRun(run);
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform a GAP-IA run to GapRunSummary
 */
function transformGapIaToSummary(run: any): GapRunSummary {
  // Handle V2 format
  if (run.summary) {
    return {
      type: 'gap_ia',
      runId: run.id,
      overallScore: run.summary?.overallScore || run.overallScore,
      strategistView: run.summary?.strategistView || run.iaReportMarkdown,
      executiveSummary: run.summary?.executiveSummary,
      keyFindings: run.summary?.keyFindings || [],
      quickWins: run.quickWins?.map((qw: any) => qw.recommendation || qw) || [],
      priorityAreas: run.summary?.priorityAreas || [],
      maturityStage: run.maturityStage,
      readinessScore: run.readinessScore,
      dimensionScores: {
        brand: run.brandScore || run.dimensions?.brand?.score,
        content: run.contentScore || run.dimensions?.content?.score,
        seo: run.seoScore || run.dimensions?.seo?.score,
        website: run.websiteScore || run.dimensions?.website?.score,
        digitalFootprint: run.digitalFootprintScore,
        authority: run.authorityScore,
      },
      businessContext: {
        businessName: run.core?.businessName || run.businessContext?.businessName,
        industry: run.core?.industry || run.businessContext?.industry,
        businessModel: run.businessContext?.businessModel,
        targetAudience: run.businessContext?.targetAudience,
        geographicScope: run.core?.geographicScope || run.businessContext?.geographicScope,
      },
      createdAt: run.createdAt,
    };
  }

  // Handle legacy format
  return {
    type: 'gap_ia',
    runId: run.id,
    overallScore: run.overallScore,
    strategistView: run.iaReportMarkdown || run.insights?.overallSummary,
    keyFindings: [
      ...(run.insights?.brandInsights || []),
      ...(run.insights?.contentInsights || []),
      ...(run.insights?.seoInsights || []),
      ...(run.insights?.websiteInsights || []),
    ].slice(0, 10),
    quickWins: run.core?.topOpportunities || [],
    priorityAreas: [],
    maturityStage: run.maturityStage,
    readinessScore: run.readinessScore,
    dimensionScores: {
      brand: run.brandScore,
      content: run.contentScore,
      seo: run.seoScore,
      website: run.websiteScore,
      digitalFootprint: run.digitalFootprintScore,
      authority: run.authorityScore,
    },
    businessContext: {
      businessName: run.core?.businessName,
      industry: run.core?.industry,
    },
    createdAt: run.createdAt,
  };
}

/**
 * Transform a Diagnostic Run to GapRunSummary
 */
function transformDiagnosticRunToGapSummary(run: DiagnosticRun): GapRunSummary {
  const raw = run.rawJson as any;
  const meta = run.metadata as any;

  // Determine GAP type
  let type: 'gap_ia' | 'gap_full' | 'gap_heavy' = 'gap_ia';
  if (run.toolId === 'gapHeavy') type = 'gap_heavy';
  else if (run.toolId === 'gapPlan') type = 'gap_full';

  return {
    type,
    runId: run.id,
    overallScore: run.score ?? undefined,
    strategistView: run.summary ?? undefined,
    executiveSummary: raw?.summary?.executiveSummary || raw?.executiveSummary,
    keyFindings: raw?.keyFindings || meta?.keyFindings || [],
    quickWins: raw?.quickWins || meta?.quickWins || [],
    priorityAreas: raw?.priorityAreas || meta?.priorityAreas || [],
    maturityStage: raw?.maturityStage || meta?.maturityStage,
    dimensionScores: {
      brand: raw?.scores?.brand || meta?.brandScore,
      content: raw?.scores?.content || meta?.contentScore,
      seo: raw?.scores?.seo || meta?.seoScore,
      website: raw?.scores?.website || meta?.websiteScore,
    },
    businessContext: raw?.businessContext || meta?.businessContext,
    createdAt: run.createdAt,
  };
}

/**
 * Transform a Website Lab run
 *
 * HARD CUTOVER: V5 is the ONLY authoritative source.
 * We extract from v5Diagnostic first, falling back to siteAssessment only for
 * backwards-compatible field mapping (siteAssessment is now derived from V5).
 */
function transformWebsiteLabRun(run: DiagnosticRun): WebsiteLabSummary {
  const raw = run.rawJson as any;
  const meta = run.metadata as any;

  // V5 PREFERRED: Extract v5Diagnostic first
  const v5Diagnostic = raw?.v5Diagnostic ||
    raw?.rawEvidence?.labResultV4?.v5Diagnostic ||
    raw?.rawEvidence?.v5Diagnostic;

  // Fallback to siteAssessment (which is now derived from V5)
  const siteAssessment = raw?.rawEvidence?.labResultV4?.siteAssessment || raw?.siteAssessment;

  // Use V5 score and justification if available
  const score = run.score ?? v5Diagnostic?.score ?? siteAssessment?.overallScore ?? siteAssessment?.score ?? undefined;
  const executiveSummary = v5Diagnostic?.scoreJustification || siteAssessment?.executiveSummary || siteAssessment?.summary;

  // Extract issues from V5 blockingIssues or fallback to siteAssessment
  let conversionBlocks: string[] = [];
  if (v5Diagnostic?.blockingIssues?.length) {
    conversionBlocks = v5Diagnostic.blockingIssues
      .filter((i: any) => i.whyItBlocks)
      .map((i: any) => `${i.page}: ${i.whyItBlocks}`)
      .slice(0, 5);
  } else {
    conversionBlocks = extractIssuesByCategory(siteAssessment?.issues, 'conversion');
  }

  // Extract recommendations from V5 quickWins or fallback to siteAssessment
  let recommendations: string[] = [];
  if (v5Diagnostic?.quickWins?.length) {
    recommendations = v5Diagnostic.quickWins
      .filter((w: any) => w.action || w.title)
      .map((w: any) => w.action || w.title)
      .slice(0, 10);
  } else {
    recommendations = siteAssessment?.recommendations?.slice(0, 10) || [];
  }

  return {
    runId: run.id,
    score,
    strategistView: run.summary ?? siteAssessment?.consultantReport ?? undefined,
    executiveSummary,
    funnelIssues: extractIssuesByCategory(siteAssessment?.issues, 'funnel'),
    conversionBlocks,
    infraNotes: extractInfraFromMetadata(meta),
    mobileNotes: meta?.mobileScore ? `Mobile score: ${meta.mobileScore}` : undefined,
    pageSpeedNotes: meta?.pageSpeedScore ? `PageSpeed score: ${meta.pageSpeedScore}` : undefined,
    coreWebVitals: meta?.coreWebVitals,
    recommendations,
    criticalIssues: siteAssessment?.criticalIssues?.slice(0, 5) || [],
    createdAt: run.createdAt,
  };
}

/**
 * Transform a Brand Lab run
 */
function transformBrandLabRun(run: DiagnosticRun): BrandLabSummary {
  const raw = run.rawJson as any;
  const meta = run.metadata as any;

  return {
    runId: run.id,
    score: run.score ?? undefined,
    strategistView: run.summary ?? undefined,
    positioningSummary: raw?.positioning || meta?.positioning,
    valueProps: raw?.valueProps || meta?.valueProps || [],
    differentiators: raw?.differentiators || meta?.differentiators || [],
    brandPerception: raw?.brandPerception || meta?.brandPerception,
    voiceTone: raw?.voiceTone || meta?.voiceTone,
    visualIdentity: raw?.visualIdentity || meta?.visualIdentity,
    competitivePosition: raw?.competitivePosition || meta?.competitivePosition,
    strengths: raw?.strengths || meta?.strengths || [],
    weaknesses: raw?.weaknesses || meta?.weaknesses || [],
    createdAt: run.createdAt,
  };
}

/**
 * Transform a Content Lab run
 */
function transformContentLabRun(run: DiagnosticRun): ContentLabSummary {
  const raw = run.rawJson as any;
  const meta = run.metadata as any;

  return {
    runId: run.id,
    score: run.score ?? undefined,
    strategistView: run.summary ?? undefined,
    keyTopics: raw?.keyTopics || meta?.keyTopics || [],
    contentGaps: raw?.contentGaps || meta?.contentGaps || [],
    audienceNeeds: raw?.audienceNeeds || meta?.audienceNeeds || [],
    contentTypes: raw?.contentTypes || meta?.contentTypes,
    productionCapacity: raw?.productionCapacity || meta?.productionCapacity,
    topPerformingThemes: raw?.topPerformingThemes || meta?.topPerformingThemes || [],
    qualityNotes: raw?.qualityNotes || meta?.qualityNotes,
    createdAt: run.createdAt,
  };
}

/**
 * Transform an SEO Lab run
 */
function transformSeoLabRun(run: DiagnosticRun): SeoLabSummary {
  const raw = run.rawJson as any;
  const meta = run.metadata as any;

  return {
    runId: run.id,
    score: run.score ?? undefined,
    strategistView: run.summary ?? undefined,
    keywordThemes: raw?.keywordThemes || meta?.keywordThemes || [],
    organicCompetitors: raw?.organicCompetitors || meta?.organicCompetitors || [],
    searchDemandNotes: raw?.searchDemandNotes || meta?.searchDemandNotes,
    technicalHealth: raw?.technicalHealth || meta?.technicalHealth,
    backlinkProfile: raw?.backlinkProfile || meta?.backlinkProfile,
    domainAuthority: raw?.domainAuthority || meta?.domainAuthority,
    topKeywords: raw?.topKeywords || meta?.topKeywords || [],
    keywordOpportunities: raw?.keywordOpportunities || meta?.keywordOpportunities || [],
    localSeoStatus: raw?.localSeoStatus || meta?.localSeoStatus,
    createdAt: run.createdAt,
  };
}

/**
 * Transform a Demand Lab run
 */
function transformDemandLabRun(run: DiagnosticRun): DemandLabSummary {
  const raw = run.rawJson as any;
  const meta = run.metadata as any;

  return {
    runId: run.id,
    score: run.score ?? undefined,
    strategistView: run.summary ?? undefined,
    channelPerformanceSummary: raw?.channelPerformanceSummary || meta?.channelPerformanceSummary,
    bestChannels: raw?.bestChannels || meta?.bestChannels || [],
    weakChannels: raw?.weakChannels || meta?.weakChannels || [],
    demandSources: raw?.demandSources || meta?.demandSources || [],
    attributionNotes: raw?.attributionNotes || meta?.attributionNotes,
    funnelPerformance: raw?.funnelPerformance || meta?.funnelPerformance,
    leadQualityNotes: raw?.leadQualityNotes || meta?.leadQualityNotes,
    cacTrends: raw?.cacTrends || meta?.cacTrends,
    createdAt: run.createdAt,
  };
}

/**
 * Transform an Ops Lab run
 */
function transformOpsLabRun(run: DiagnosticRun): OpsLabSummary {
  const raw = run.rawJson as any;
  const meta = run.metadata as any;

  return {
    runId: run.id,
    score: run.score ?? undefined,
    strategistView: run.summary ?? undefined,
    trackingStackNotes: raw?.trackingStackNotes || meta?.trackingStackNotes || [],
    ga4Health: raw?.ga4Health || meta?.ga4Health || meta?.ga4Status,
    gscHealth: raw?.gscHealth || meta?.gscHealth || meta?.gscStatus,
    gbpHealth: raw?.gbpHealth || meta?.gbpHealth || meta?.gbpStatus,
    callTracking: raw?.callTracking || meta?.callTracking,
    offlineConversion: raw?.offlineConversion || meta?.offlineConversion,
    crmNotes: raw?.crmNotes || meta?.crmNotes,
    dataQuality: raw?.dataQuality || meta?.dataQuality,
    measurementLimitations: raw?.measurementLimitations || meta?.measurementLimitations || [],
    techStack: raw?.techStack || meta?.techStack || [],
    createdAt: run.createdAt,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract issues by category from a list of issues
 */
function extractIssuesByCategory(issues: any[] | undefined, category: string): string[] {
  if (!issues || !Array.isArray(issues)) return [];

  return issues
    .filter((issue) => {
      const issueCategory = (issue.category || '').toLowerCase();
      return issueCategory.includes(category);
    })
    .map((issue) => issue.title || issue.description || String(issue))
    .slice(0, 5);
}

/**
 * Extract infrastructure notes from metadata
 */
function extractInfraFromMetadata(meta: any): string[] {
  if (!meta) return [];

  const notes: string[] = [];

  if (meta.ga4Status) notes.push(`GA4: ${meta.ga4Status}`);
  if (meta.gtmStatus) notes.push(`GTM: ${meta.gtmStatus}`);
  if (meta.hasContactForm !== undefined) {
    notes.push(`Contact forms: ${meta.hasContactForm ? 'Yes' : 'No'}`);
  }
  if (meta.hasPhoneNumbers !== undefined) {
    notes.push(`Phone tracking: ${meta.hasPhoneNumbers ? 'Phone numbers found' : 'No phone numbers'}`);
  }
  if (meta.hasLiveChat !== undefined) {
    notes.push(`Live chat: ${meta.hasLiveChat ? 'Yes' : 'No'}`);
  }

  return notes;
}
