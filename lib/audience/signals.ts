// lib/audience/signals.ts
// Audience Signals Loader
//
// Consolidates audience-related signals from various diagnostics and data sources
// to provide input for AI-powered audience model seeding.
//
// IMPORTANT: This now extracts canonical ICP from Context Graph (Brain/Setup/GAP)
// and passes it as a hard constraint to the AI model generation.
//
// The canonical ICP is loaded from the new explicit ICP fields:
// - identity.icpDescription
// - audience.primaryAudience
// - audience.primaryBuyerRoles
// - audience.companyProfile

import { loadDiagnosticsBundle } from '@/lib/media/diagnosticsLoader';
import { getBrainCompanyContext } from '@/lib/brain/companyContext';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { loadCanonicalICP } from '@/lib/contextGraph/icpExtractor';
import { buildICPSummary } from '@/lib/contextGraph/icpMapping';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Canonical ICP (Ideal Customer Profile) from Context Graph
 *
 * This is the authoritative target audience defined by the user via:
 * - Setup wizard
 * - Strategic Plan
 * - Manual edits to Context Graph
 * - GAP diagnostics
 *
 * When present, Audience Lab MUST decompose this ICP into segments
 * rather than inventing a new audience.
 */
export interface CanonicalICP {
  /** Whether a canonical ICP is defined */
  hasCanonicalICP: boolean;

  /** The primary audience description (main ICP statement) */
  primaryAudience?: string;

  /** Core segment names already defined */
  coreSegments?: string[];

  /** Demographics from Context Graph */
  demographics?: string;

  /** Geographic focus */
  geos?: string;

  /** Primary markets */
  primaryMarkets?: string[];

  /** Pain points */
  painPoints?: string[];

  /** Motivations / goals */
  motivations?: string[];

  /** Source of the ICP (for provenance) */
  source?: string;

  /** Whether this is a human override (highest priority) */
  isHumanOverride?: boolean;

  /** Confidence level of the ICP */
  confidence?: number;
}

/**
 * Existing audience fields from Context Graph
 */
export interface ExistingAudienceFields {
  coreSegments?: string[];
  segmentDetails?: Array<{
    name: string;
    description: string | null;
    size: string | null;
    priority: 'primary' | 'secondary' | 'tertiary' | null;
    demographics: string | null;
    behaviors: string | null;
  }>;
  demographics?: string;
  ageRanges?: string[];
  genderSplit?: string;
  incomeLevel?: string;
  geos?: string;
  primaryMarkets?: string[];
  secondaryMarkets?: string[];
  behavioralDrivers?: string[];
  purchaseBehaviors?: string[];
  demandStates?: string[];
  mediaHabits?: string;
  culturalNuances?: string;
  languages?: string[];
  audienceNeeds?: string[];
  painPoints?: string[];
  motivations?: string[];
}

/**
 * Audience signals consolidated from all sources
 */
export interface AudienceSignals {
  // Canonical ICP from Context Graph (Brain/Setup/GAP)
  // This is the PRIMARY constraint for audience generation
  canonicalICP: CanonicalICP;

  // Narratives from diagnostics (strategist views)
  gapNarrative?: string;
  brandNarrative?: string;
  contentNarrative?: string;
  seoNarrative?: string;
  demandNarrative?: string;

  // Structured findings from diagnostics
  gapFindings?: {
    businessContext?: {
      businessName?: string;
      industry?: string;
      targetAudience?: string;
      geographicScope?: string;
    };
    maturityStage?: string;
    keyFindings?: string[];
    quickWins?: string[];
  };

  brandFindings?: {
    positioningSummary?: string;
    valueProps?: string[];
    differentiators?: string[];
    brandPerception?: string;
    voiceTone?: string;
    competitivePosition?: string;
    strengths?: string[];
    weaknesses?: string[];
  };

  contentFindings?: {
    keyTopics?: string[];
    contentGaps?: string[];
    audienceNeeds?: string[];
    topPerformingThemes?: string[];
  };

  seoFindings?: {
    keywordThemes?: string[];
    topKeywords?: string[];
    keywordOpportunities?: string[];
    searchDemandNotes?: string;
    localSeoStatus?: string;
  };

  demandFindings?: {
    channelPerformanceSummary?: string;
    bestChannels?: string[];
    weakChannels?: string[];
    demandSources?: string[];
    funnelPerformance?: {
      awareness?: string;
      consideration?: string;
      conversion?: string;
      retention?: string;
    };
  };

  // Existing audience fields from Context Graph
  existingAudienceFields?: ExistingAudienceFields;

  // Brain context
  brainContext?: {
    businessSummary?: string;
    brandSummary?: string;
    audienceSegments?: string[];
    valueProps?: string[];
    differentiators?: string[];
    geographicFootprint?: string;
    seasonalityNotes?: string;
  };

  // Metadata
  sourcesAvailable: {
    gap: boolean;
    brand: boolean;
    content: boolean;
    seo: boolean;
    demand: boolean;
    contextGraph: boolean;
    brain: boolean;
  };

  loadedAt: string;
}

// ============================================================================
// Canonical ICP Extraction
// ============================================================================

/**
 * Extract canonical ICP from Context Graph using the new explicit ICP fields:
 * - identity.icpDescription
 * - audience.primaryAudience
 * - audience.primaryBuyerRoles
 * - audience.companyProfile
 *
 * Falls back to legacy audience fields if new ICP fields are not populated.
 */
async function extractCanonicalICPAsync(companyId: string): Promise<CanonicalICP> {
  const result: CanonicalICP = {
    hasCanonicalICP: false,
  };

  try {
    // Use the new ICP loading function
    const icpResult = await loadCanonicalICP(companyId);

    if (icpResult.hasCanonicalICP) {
      result.hasCanonicalICP = true;
      result.primaryAudience = icpResult.summary || icpResult.icp.primaryAudience;
      result.coreSegments = icpResult.icp.primaryBuyerRoles;
      result.source = icpResult.sources[0];

      // Check if this is a human override (high priority sources)
      const highPrioritySources = ['user', 'manual', 'setup_wizard', 'strategy'];
      result.isHumanOverride = icpResult.sources.some(s => highPrioritySources.includes(s));

      console.log('[AudienceSignals] Canonical ICP loaded from new fields:', {
        hasCanonicalICP: true,
        sources: icpResult.sources,
        isHumanOverride: result.isHumanOverride,
      });

      return result;
    }
  } catch (error) {
    console.warn('[AudienceSignals] Error loading canonical ICP:', error);
  }

  // Fall back to legacy extraction if new fields are empty
  console.log('[AudienceSignals] No canonical ICP from new fields, trying legacy...');
  return extractCanonicalICPLegacy(companyId);
}

/**
 * Legacy extraction from old audience fields (demographics, coreSegments, etc.)
 */
async function extractCanonicalICPLegacy(companyId: string): Promise<CanonicalICP> {
  const result: CanonicalICP = {
    hasCanonicalICP: false,
  };

  const contextGraph = await loadContextGraph(companyId);
  console.log('[AudienceSignals Legacy] Context graph loaded:', !!contextGraph, 'has audience:', !!contextGraph?.audience);

  if (!contextGraph?.audience) {
    console.log('[AudienceSignals Legacy] No audience domain in context graph');
    return result;
  }

  const audience = contextGraph.audience;

  // Check for primary audience / ICP description
  const primaryAudienceValue = audience.demographics?.value;
  const coreSegmentsValue = audience.coreSegments?.value;
  const geosValue = audience.geos?.value;
  const primaryMarketsValue = audience.primaryMarkets?.value;
  const painPointsValue = audience.painPoints?.value;
  const motivationsValue = audience.motivations?.value;

  // Check provenance to see if this came from a high-priority source
  const highPrioritySources = ['user', 'manual', 'setup_wizard', 'strategy'];
  const hasHighPrioritySource = (provenance: { source?: string }[] | undefined): boolean => {
    if (!provenance || provenance.length === 0) return false;
    return provenance.some(p => highPrioritySources.includes(p.source || ''));
  };

  // Check if we have meaningful ICP data
  const hasSegments = coreSegmentsValue && coreSegmentsValue.length > 0;
  const hasDemographics = primaryAudienceValue && primaryAudienceValue.trim().length > 0;
  const hasPrimaryMarkets = primaryMarketsValue && primaryMarketsValue.length > 0;

  console.log('[AudienceSignals Legacy] Audience field values:', {
    demographics: primaryAudienceValue?.substring(0, 50),
    coreSegments: coreSegmentsValue,
    geos: geosValue,
    primaryMarkets: primaryMarketsValue,
    hasSegments,
    hasDemographics,
    hasPrimaryMarkets,
  });

  const audienceProvenance = audience.coreSegments?.provenance || audience.demographics?.provenance;

  if (hasSegments || hasDemographics || hasPrimaryMarkets) {
    result.hasCanonicalICP = true;
    result.coreSegments = coreSegmentsValue || undefined;
    result.demographics = primaryAudienceValue || undefined;
    result.geos = geosValue || undefined;
    result.primaryMarkets = primaryMarketsValue || undefined;
    result.painPoints = painPointsValue || undefined;
    result.motivations = motivationsValue || undefined;

    if (audienceProvenance && audienceProvenance.length > 0) {
      const latestProvenance = audienceProvenance[0];
      result.source = latestProvenance.source;
      result.confidence = latestProvenance.confidence;
      result.isHumanOverride = hasHighPrioritySource(audienceProvenance);
    }

    // Build primary audience description from available data
    const audienceParts: string[] = [];
    if (coreSegmentsValue?.length) {
      audienceParts.push(`Target segments: ${coreSegmentsValue.join(', ')}`);
    }
    if (primaryAudienceValue) {
      audienceParts.push(`Demographics: ${primaryAudienceValue}`);
    }
    if (geosValue) {
      audienceParts.push(`Geography: ${geosValue}`);
    }
    if (primaryMarketsValue?.length) {
      audienceParts.push(`Primary markets: ${primaryMarketsValue.join(', ')}`);
    }

    if (audienceParts.length > 0) {
      result.primaryAudience = audienceParts.join('. ');
    }
  }

  console.log('[AudienceSignals] Canonical ICP extracted (legacy):', {
    hasCanonicalICP: result.hasCanonicalICP,
    source: result.source,
    isHumanOverride: result.isHumanOverride,
    segmentCount: result.coreSegments?.length || 0,
  });

  return result;
}

// ============================================================================
// Main Loader Function
// ============================================================================

/**
 * Load all audience-related signals for a company
 *
 * Consolidates signals from:
 * - Context Graph canonical ICP (PRIMARY CONSTRAINT)
 * - GAP runs (business context, audience hints)
 * - Brand Lab (positioning, perception, audience fit)
 * - Content Lab (audience needs, content gaps)
 * - SEO Lab (search demand, keyword themes)
 * - Demand Lab (channel performance, demand sources)
 * - Context Graph (existing audience domain)
 * - Brain (company context, summaries)
 */
export async function loadAudienceSignalsForCompany(
  companyId: string
): Promise<AudienceSignals> {
  console.log('[AudienceSignals] Loading signals for company:', companyId);

  // Load all sources in parallel
  const [diagnosticsBundle, contextGraph, brainContext, canonicalICP] = await Promise.all([
    loadDiagnosticsBundle(companyId).catch((e) => {
      console.error('[AudienceSignals] Failed to load diagnostics:', e);
      return null;
    }),
    loadContextGraph(companyId).catch((e) => {
      console.error('[AudienceSignals] Failed to load context graph:', e);
      return null;
    }),
    getBrainCompanyContext(companyId).catch((e) => {
      console.error('[AudienceSignals] Failed to load brain context:', e);
      return null;
    }),
    // Extract canonical ICP from the new explicit ICP fields
    extractCanonicalICPAsync(companyId).catch((e) => {
      console.error('[AudienceSignals] Failed to extract canonical ICP:', e);
      return { hasCanonicalICP: false } as CanonicalICP;
    }),
  ]);

  const signals: AudienceSignals = {
    canonicalICP,
    sourcesAvailable: {
      gap: false,
      brand: false,
      content: false,
      seo: false,
      demand: false,
      contextGraph: false,
      brain: false,
    },
    loadedAt: new Date().toISOString(),
  };

  // Extract from diagnostics bundle
  if (diagnosticsBundle) {
    // GAP
    if (diagnosticsBundle.gap) {
      signals.sourcesAvailable.gap = true;
      signals.gapNarrative = diagnosticsBundle.gap.strategistView;
      signals.gapFindings = {
        businessContext: diagnosticsBundle.gap.businessContext,
        maturityStage: diagnosticsBundle.gap.maturityStage,
        keyFindings: diagnosticsBundle.gap.keyFindings,
        quickWins: diagnosticsBundle.gap.quickWins,
      };
    }

    // Brand
    if (diagnosticsBundle.brand) {
      signals.sourcesAvailable.brand = true;
      signals.brandNarrative = diagnosticsBundle.brand.strategistView;
      signals.brandFindings = {
        positioningSummary: diagnosticsBundle.brand.positioningSummary,
        valueProps: diagnosticsBundle.brand.valueProps,
        differentiators: diagnosticsBundle.brand.differentiators,
        brandPerception: diagnosticsBundle.brand.brandPerception,
        voiceTone: diagnosticsBundle.brand.voiceTone,
        competitivePosition: diagnosticsBundle.brand.competitivePosition,
        strengths: diagnosticsBundle.brand.strengths,
        weaknesses: diagnosticsBundle.brand.weaknesses,
      };
    }

    // Content
    if (diagnosticsBundle.content) {
      signals.sourcesAvailable.content = true;
      signals.contentNarrative = diagnosticsBundle.content.strategistView;
      signals.contentFindings = {
        keyTopics: diagnosticsBundle.content.keyTopics,
        contentGaps: diagnosticsBundle.content.contentGaps,
        audienceNeeds: diagnosticsBundle.content.audienceNeeds,
        topPerformingThemes: diagnosticsBundle.content.topPerformingThemes,
      };
    }

    // SEO
    if (diagnosticsBundle.seo) {
      signals.sourcesAvailable.seo = true;
      signals.seoNarrative = diagnosticsBundle.seo.strategistView;
      signals.seoFindings = {
        keywordThemes: diagnosticsBundle.seo.keywordThemes,
        topKeywords: diagnosticsBundle.seo.topKeywords,
        keywordOpportunities: diagnosticsBundle.seo.keywordOpportunities,
        searchDemandNotes: diagnosticsBundle.seo.searchDemandNotes,
        localSeoStatus: diagnosticsBundle.seo.localSeoStatus,
      };
    }

    // Demand
    if (diagnosticsBundle.demand) {
      signals.sourcesAvailable.demand = true;
      signals.demandNarrative = diagnosticsBundle.demand.strategistView;
      signals.demandFindings = {
        channelPerformanceSummary: diagnosticsBundle.demand.channelPerformanceSummary,
        bestChannels: diagnosticsBundle.demand.bestChannels,
        weakChannels: diagnosticsBundle.demand.weakChannels,
        demandSources: diagnosticsBundle.demand.demandSources,
        funnelPerformance: diagnosticsBundle.demand.funnelPerformance,
      };
    }
  }

  // Extract from Context Graph audience domain
  if (contextGraph?.audience) {
    signals.sourcesAvailable.contextGraph = true;
    const audience = contextGraph.audience;

    signals.existingAudienceFields = {
      coreSegments: audience.coreSegments?.value || undefined,
      segmentDetails: audience.segmentDetails?.value || undefined,
      demographics: audience.demographics?.value || undefined,
      ageRanges: audience.ageRanges?.value || undefined,
      genderSplit: audience.genderSplit?.value || undefined,
      incomeLevel: audience.incomeLevel?.value || undefined,
      geos: audience.geos?.value || undefined,
      primaryMarkets: audience.primaryMarkets?.value || undefined,
      secondaryMarkets: audience.secondaryMarkets?.value || undefined,
      behavioralDrivers: audience.behavioralDrivers?.value || undefined,
      purchaseBehaviors: audience.purchaseBehaviors?.value || undefined,
      demandStates: audience.demandStates?.value || undefined,
      mediaHabits: audience.mediaHabits?.value || undefined,
      culturalNuances: audience.culturalNuances?.value || undefined,
      languages: audience.languages?.value || undefined,
      audienceNeeds: audience.audienceNeeds?.value || undefined,
      painPoints: audience.painPoints?.value || undefined,
      motivations: audience.motivations?.value || undefined,
    };
  }

  // Extract from Brain context
  if (brainContext) {
    const hasBrainData = brainContext.businessSummary ||
      brainContext.brandSummary ||
      brainContext.audienceSegments?.length;

    if (hasBrainData) {
      signals.sourcesAvailable.brain = true;
      signals.brainContext = {
        businessSummary: brainContext.businessSummary,
        brandSummary: brainContext.brandSummary,
        audienceSegments: brainContext.audienceSegments,
        valueProps: brainContext.valueProps,
        differentiators: brainContext.differentiators,
        geographicFootprint: brainContext.geographicFootprint,
        seasonalityNotes: brainContext.seasonalityNotes,
      };
    }
  }

  const sourceCount = Object.values(signals.sourcesAvailable).filter(Boolean).length;
  console.log('[AudienceSignals] Loaded signals:', {
    companyId,
    sourcesFound: sourceCount,
    sources: signals.sourcesAvailable,
  });

  return signals;
}

/**
 * Check if signals have enough data for meaningful AI seeding
 */
export function hasMinimalSignalsForSeeding(signals: AudienceSignals): boolean {
  const { sourcesAvailable } = signals;

  // Need at least one diagnostic narrative or existing audience data
  const hasNarrative = Boolean(
    sourcesAvailable.gap ||
    sourcesAvailable.brand ||
    sourcesAvailable.content
  );

  const hasExistingData = Boolean(
    signals.existingAudienceFields?.coreSegments?.length ||
    signals.existingAudienceFields?.segmentDetails?.length
  );

  const hasBrainData = Boolean(signals.brainContext?.audienceSegments?.length);

  return hasNarrative || hasExistingData || hasBrainData;
}

/**
 * Get a summary of available signals for display
 */
export function getSignalsSummary(signals: AudienceSignals): {
  totalSources: number;
  availableSources: string[];
  missingCritical: string[];
  dataRichness: 'low' | 'medium' | 'high';
} {
  const { sourcesAvailable } = signals;

  const availableSources = Object.entries(sourcesAvailable)
    .filter(([, available]) => available)
    .map(([source]) => source);

  const criticalSources = ['gap', 'brand'];
  const missingCritical = criticalSources.filter(
    (s) => !sourcesAvailable[s as keyof typeof sourcesAvailable]
  );

  let dataRichness: 'low' | 'medium' | 'high' = 'low';
  if (availableSources.length >= 4) {
    dataRichness = 'high';
  } else if (availableSources.length >= 2) {
    dataRichness = 'medium';
  }

  return {
    totalSources: availableSources.length,
    availableSources,
    missingCritical,
    dataRichness,
  };
}

/**
 * Format signals into a text prompt for AI consumption
 *
 * IMPORTANT: If canonicalICP.hasCanonicalICP is true, the prompt will
 * prominently feature this as a HARD CONSTRAINT that must not be changed.
 */
export function formatSignalsForAiPrompt(signals: AudienceSignals): string {
  const sections: string[] = [];

  // CANONICAL ICP - This is the PRIMARY constraint if present
  if (signals.canonicalICP.hasCanonicalICP) {
    const icp = signals.canonicalICP;
    const icpLines: string[] = [];

    if (icp.primaryAudience) {
      icpLines.push(icp.primaryAudience);
    }
    if (icp.coreSegments?.length) {
      icpLines.push(`Defined Segments: ${icp.coreSegments.join(', ')}`);
    }
    if (icp.demographics) {
      icpLines.push(`Demographics: ${icp.demographics}`);
    }
    if (icp.geos) {
      icpLines.push(`Geographic Focus: ${icp.geos}`);
    }
    if (icp.primaryMarkets?.length) {
      icpLines.push(`Primary Markets: ${icp.primaryMarkets.join(', ')}`);
    }
    if (icp.painPoints?.length) {
      icpLines.push(`Pain Points: ${icp.painPoints.join(', ')}`);
    }
    if (icp.motivations?.length) {
      icpLines.push(`Motivations: ${icp.motivations.join(', ')}`);
    }

    if (icpLines.length > 0) {
      sections.push(`## ⚠️ CANONICAL TARGET AUDIENCE (DO NOT CHANGE)\nThis is the company's defined Ideal Customer Profile. Your segments MUST fit within this ICP.\n\n${icpLines.join('\n')}`);
    }
  }

  // GAP narrative
  if (signals.gapNarrative) {
    sections.push(`## GAP Analysis\n${signals.gapNarrative}`);
  }

  // Brand narrative
  if (signals.brandNarrative) {
    sections.push(`## Brand Analysis\n${signals.brandNarrative}`);
  }

  // Content narrative
  if (signals.contentNarrative) {
    sections.push(`## Content Analysis\n${signals.contentNarrative}`);
  }

  // SEO narrative
  if (signals.seoNarrative) {
    sections.push(`## SEO Analysis\n${signals.seoNarrative}`);
  }

  // Demand narrative
  if (signals.demandNarrative) {
    sections.push(`## Demand Analysis\n${signals.demandNarrative}`);
  }

  // Existing audience data (only if no canonical ICP - avoid duplication)
  if (!signals.canonicalICP.hasCanonicalICP && signals.existingAudienceFields) {
    const af = signals.existingAudienceFields;
    const audienceLines: string[] = [];

    if (af.coreSegments?.length) {
      audienceLines.push(`Core Segments: ${af.coreSegments.join(', ')}`);
    }
    if (af.demographics) {
      audienceLines.push(`Demographics: ${af.demographics}`);
    }
    if (af.geos) {
      audienceLines.push(`Geographic Focus: ${af.geos}`);
    }
    if (af.behavioralDrivers?.length) {
      audienceLines.push(`Behavioral Drivers: ${af.behavioralDrivers.join(', ')}`);
    }
    if (af.demandStates?.length) {
      audienceLines.push(`Demand States: ${af.demandStates.join(', ')}`);
    }
    if (af.mediaHabits) {
      audienceLines.push(`Media Habits: ${af.mediaHabits}`);
    }
    if (af.painPoints?.length) {
      audienceLines.push(`Pain Points: ${af.painPoints.join(', ')}`);
    }
    if (af.motivations?.length) {
      audienceLines.push(`Motivations: ${af.motivations.join(', ')}`);
    }

    if (audienceLines.length > 0) {
      sections.push(`## Existing Audience Data\n${audienceLines.join('\n')}`);
    }
  }

  // Brain context
  if (signals.brainContext) {
    const bc = signals.brainContext;
    const brainLines: string[] = [];

    if (bc.businessSummary) {
      brainLines.push(`Business Summary: ${bc.businessSummary}`);
    }
    if (bc.audienceSegments?.length && !signals.canonicalICP.hasCanonicalICP) {
      // Only include if no canonical ICP to avoid duplication
      brainLines.push(`Known Segments: ${bc.audienceSegments.join(', ')}`);
    }
    if (bc.valueProps?.length) {
      brainLines.push(`Value Props: ${bc.valueProps.join(', ')}`);
    }
    if (bc.geographicFootprint && !signals.canonicalICP.hasCanonicalICP) {
      brainLines.push(`Geographic Footprint: ${bc.geographicFootprint}`);
    }

    if (brainLines.length > 0) {
      sections.push(`## Brain Context\n${brainLines.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}
