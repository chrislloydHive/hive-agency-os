// app/c/[companyId]/labs/creative/loadCreativeLab.ts
// Creative Lab Context Loader
//
// Loads Brain-First context from Context Graph for Creative Lab generation.
// Includes scopes: identity, brand, audience, product, objectives, website, media

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getBrainCompanyContext } from '@/lib/brain/companyContext';
import { loadDiagnosticsBundle } from '@/lib/media/diagnosticsLoader';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type {
  MessagingArchitecture,
  SegmentMessage,
  CreativeTerritory,
  CampaignConcept,
  CreativeGuidelines,
} from '@/lib/contextGraph/domains/creative';

// ============================================================================
// Types
// ============================================================================

/**
 * Audience segment for creative targeting
 */
export interface CreativeAudienceSegment {
  name: string;
  description?: string;
  painPoints?: string[];
  goals?: string[];
  jobsToBeDone?: string[];
  demographics?: string;
  priority?: 'primary' | 'secondary' | 'tertiary';
}

/**
 * Brand context for creative alignment
 */
export interface CreativeBrandContext {
  positioning?: string;
  valueProps?: string[];
  differentiators?: string[];
  toneOfVoice?: string;
  brandPersonality?: string;
  messagingPillars?: string[];
  tagline?: string;
}

/**
 * Identity context from Context Graph
 */
export interface CreativeIdentityContext {
  companyName?: string;
  industry?: string;
  icpDescription?: string;
  missionStatement?: string;
  competitorNames?: string[];
}

/**
 * Objectives context from Context Graph
 */
export interface CreativeObjectivesContext {
  primaryObjective?: string;
  kpis?: string[];
  conversionGoals?: string[];
  budgetRange?: string;
}

/**
 * Product/offer context
 */
export interface CreativeProductContext {
  productLines?: string[];
  serviceCategories?: string[];
  pricingTier?: string;
  differentiators?: string[];
}

/**
 * Website insights for conversion optimization
 */
export interface CreativeWebsiteContext {
  conversionBlockers?: string[];
  quickWins?: string[];
  websiteScore?: number;
  uxIssues?: string[];
}

/**
 * Media insights for channel recommendations
 */
export interface CreativeMediaContext {
  channelRecommendations?: string[];
  topPerformingChannels?: string[];
  budgetAllocation?: Record<string, number>;
  mediaMaturity?: string;
}

/**
 * Existing creative output from Context Graph (if any)
 */
export interface ExistingCreativeOutput {
  messaging?: MessagingArchitecture | null;
  segmentMessages?: Record<string, SegmentMessage> | null;
  creativeTerritories?: CreativeTerritory[];
  campaignConcepts?: CampaignConcept[];
  guidelines?: CreativeGuidelines | null;
}

/**
 * Full Creative Lab context
 */
export interface CreativeLabContext {
  // Core identifiers
  companyId: string;
  companyName: string;

  // Context summaries for LLM prompt
  identitySummary: string;
  brandSummary: string;
  audienceSummary: string;
  productSummary: string;
  objectivesSummary: string;
  websiteSummary: string;
  mediaSummary: string;

  // Structured context data
  identity: CreativeIdentityContext;
  brand: CreativeBrandContext;
  audienceSegments: CreativeAudienceSegment[];
  product: CreativeProductContext;
  objectives: CreativeObjectivesContext;
  website: CreativeWebsiteContext;
  media: CreativeMediaContext;

  // Existing creative output (for editing/refinement)
  existingOutput: ExistingCreativeOutput;

  // Readiness indicators
  readiness: {
    hasICP: boolean;
    hasBrandPillars: boolean;
    hasAudienceSegments: boolean;
    hasObjectives: boolean;
    missingCritical: string[];
    canRunHighConfidence: boolean;
  };

  // Raw context graph for reference
  contextGraph: CompanyContextGraph | null;

  // Metadata
  loadedAt: string;
}

// ============================================================================
// Summary Generators
// ============================================================================

function generateIdentitySummary(ctx: CreativeIdentityContext): string {
  const parts: string[] = [];
  if (ctx.companyName) parts.push(`Company: ${ctx.companyName}`);
  if (ctx.industry) parts.push(`Industry: ${ctx.industry}`);
  if (ctx.icpDescription) parts.push(`Target: ${ctx.icpDescription}`);
  if (ctx.missionStatement) parts.push(`Mission: ${ctx.missionStatement}`);
  if (ctx.competitorNames?.length) parts.push(`Competitors: ${ctx.competitorNames.join(', ')}`);
  return parts.join('. ') || 'No identity context available.';
}

function generateBrandSummary(ctx: CreativeBrandContext): string {
  const parts: string[] = [];
  if (ctx.positioning) parts.push(`Positioning: ${ctx.positioning}`);
  if (ctx.valueProps?.length) parts.push(`Value Props: ${ctx.valueProps.join('; ')}`);
  if (ctx.differentiators?.length) parts.push(`Differentiators: ${ctx.differentiators.join('; ')}`);
  if (ctx.toneOfVoice) parts.push(`Tone: ${ctx.toneOfVoice}`);
  if (ctx.brandPersonality) parts.push(`Personality: ${ctx.brandPersonality}`);
  if (ctx.messagingPillars?.length) parts.push(`Pillars: ${ctx.messagingPillars.join(', ')}`);
  return parts.join('. ') || 'No brand context available.';
}

function generateAudienceSummary(segments: CreativeAudienceSegment[]): string {
  if (segments.length === 0) return 'No audience segments defined.';

  const summaries = segments.map((seg) => {
    const parts = [seg.name];
    if (seg.description) parts.push(seg.description);
    if (seg.painPoints?.length) parts.push(`Pains: ${seg.painPoints.slice(0, 3).join(', ')}`);
    if (seg.goals?.length) parts.push(`Goals: ${seg.goals.slice(0, 3).join(', ')}`);
    return parts.join(' - ');
  });

  return summaries.join('\n');
}

function generateProductSummary(ctx: CreativeProductContext): string {
  const parts: string[] = [];
  if (ctx.productLines?.length) parts.push(`Products: ${ctx.productLines.join(', ')}`);
  if (ctx.serviceCategories?.length) parts.push(`Services: ${ctx.serviceCategories.join(', ')}`);
  if (ctx.pricingTier) parts.push(`Pricing: ${ctx.pricingTier}`);
  if (ctx.differentiators?.length) parts.push(`Differentiators: ${ctx.differentiators.join('; ')}`);
  return parts.join('. ') || 'No product context available.';
}

function generateObjectivesSummary(ctx: CreativeObjectivesContext): string {
  const parts: string[] = [];
  if (ctx.primaryObjective) parts.push(`Primary Goal: ${ctx.primaryObjective}`);
  if (ctx.kpis?.length) parts.push(`KPIs: ${ctx.kpis.join(', ')}`);
  if (ctx.conversionGoals?.length) parts.push(`Conversion Goals: ${ctx.conversionGoals.join(', ')}`);
  if (ctx.budgetRange) parts.push(`Budget: ${ctx.budgetRange}`);
  return parts.join('. ') || 'No objectives defined.';
}

function generateWebsiteSummary(ctx: CreativeWebsiteContext): string {
  const parts: string[] = [];
  if (ctx.websiteScore !== undefined) parts.push(`Website Score: ${ctx.websiteScore}/100`);
  if (ctx.conversionBlockers?.length) parts.push(`Conversion Blockers: ${ctx.conversionBlockers.join('; ')}`);
  if (ctx.quickWins?.length) parts.push(`Quick Wins: ${ctx.quickWins.join('; ')}`);
  if (ctx.uxIssues?.length) parts.push(`UX Issues: ${ctx.uxIssues.join('; ')}`);
  return parts.join('. ') || 'No website insights available.';
}

function generateMediaSummary(ctx: CreativeMediaContext): string {
  const parts: string[] = [];
  if (ctx.mediaMaturity) parts.push(`Media Maturity: ${ctx.mediaMaturity}`);
  if (ctx.topPerformingChannels?.length) parts.push(`Top Channels: ${ctx.topPerformingChannels.join(', ')}`);
  if (ctx.channelRecommendations?.length) parts.push(`Recommendations: ${ctx.channelRecommendations.join('; ')}`);
  return parts.join('. ') || 'No media insights available.';
}

// ============================================================================
// Main Loader
// ============================================================================

/**
 * Load Creative Lab context from Context Graph
 *
 * Includes scopes: identity, brand, audience, product, objectives, website, media
 */
export async function loadCreativeLabContext(companyId: string): Promise<CreativeLabContext> {
  console.log('[CreativeLab] Loading context for company:', companyId);

  // Load all sources in parallel
  const [contextGraph, brainContext, diagnosticsBundle] = await Promise.all([
    loadContextGraph(companyId).catch((e) => {
      console.error('[CreativeLab] Failed to load context graph:', e);
      return null;
    }),
    getBrainCompanyContext(companyId).catch((e) => {
      console.error('[CreativeLab] Failed to load brain context:', e);
      return null;
    }),
    loadDiagnosticsBundle(companyId).catch((e) => {
      console.error('[CreativeLab] Failed to load diagnostics:', e);
      return null;
    }),
  ]);

  // Extract identity context
  const identity: CreativeIdentityContext = {};
  if (contextGraph?.identity) {
    identity.companyName = contextGraph.companyName;
    identity.industry = contextGraph.identity.industry?.value || undefined;
    identity.icpDescription = contextGraph.identity.icpDescription?.value || undefined;
    // missionStatement not in schema - skip
    identity.competitorNames = contextGraph.identity.primaryCompetitors?.value || undefined;
  }

  // Extract brand context
  const brand: CreativeBrandContext = {};
  if (contextGraph?.brand) {
    brand.positioning = contextGraph.brand.positioning?.value || undefined;
    brand.valueProps = contextGraph.brand.valueProps?.value || undefined;
    brand.differentiators = contextGraph.brand.differentiators?.value || undefined;
    brand.toneOfVoice = contextGraph.brand.toneOfVoice?.value || undefined;
    brand.brandPersonality = contextGraph.brand.brandPersonality?.value || undefined;
    brand.messagingPillars = contextGraph.brand.messagingPillars?.value || undefined;
    brand.tagline = contextGraph.brand.tagline?.value || undefined;
  }

  // Extract audience segments
  const audienceSegments: CreativeAudienceSegment[] = [];
  if (contextGraph?.audience) {
    const segmentDetails = contextGraph.audience.segmentDetails?.value || [];
    const coreSegments = contextGraph.audience.coreSegments?.value || [];
    const painPoints = contextGraph.audience.painPoints?.value || [];
    const motivations = contextGraph.audience.motivations?.value || [];
    const audienceNeeds = contextGraph.audience.audienceNeeds?.value || [];

    // Use segment details if available
    if (segmentDetails.length > 0) {
      for (const seg of segmentDetails) {
        audienceSegments.push({
          name: seg.name,
          description: seg.description || undefined,
          demographics: seg.demographics || undefined,
          priority: seg.priority || undefined,
          painPoints: painPoints,
          goals: motivations,
          jobsToBeDone: audienceNeeds,
        });
      }
    } else if (coreSegments.length > 0) {
      // Fall back to core segment names
      for (const segName of coreSegments) {
        audienceSegments.push({
          name: segName,
          painPoints: painPoints,
          goals: motivations,
          jobsToBeDone: audienceNeeds,
        });
      }
    }
  }

  // Extract product context
  const product: CreativeProductContext = {};
  if (contextGraph?.productOffer) {
    product.productLines = contextGraph.productOffer.productLines?.value || undefined;
    product.serviceCategories = contextGraph.productOffer.productCategories?.value || undefined;
    product.pricingTier = contextGraph.productOffer.priceRange?.value || undefined;
    product.differentiators = contextGraph.productOffer.uniqueOffers?.value || undefined;
  }

  // Extract objectives context
  const objectives: CreativeObjectivesContext = {};
  if (contextGraph?.objectives) {
    objectives.primaryObjective = contextGraph.objectives.primaryObjective?.value || undefined;
    objectives.kpis = contextGraph.objectives.kpiLabels?.value || undefined;
    objectives.conversionGoals = contextGraph.objectives.conversionGoal?.value
      ? [String(contextGraph.objectives.conversionGoal.value)]
      : undefined;
    // budgetRange not in objectives schema - check budgetOps
  }
  if (contextGraph?.budgetOps) {
    objectives.budgetRange = contextGraph.budgetOps.totalMarketingBudget?.value
      ? `$${contextGraph.budgetOps.totalMarketingBudget.value.toLocaleString()}`
      : undefined;
  }

  // Extract website context
  const website: CreativeWebsiteContext = {};
  if (contextGraph?.website) {
    website.websiteScore = contextGraph.website.websiteScore?.value || undefined;
    website.conversionBlockers = contextGraph.website.conversionBlocks?.value || undefined;
    website.quickWins = contextGraph.website.quickWins?.value || undefined;
    website.uxIssues = contextGraph.website.criticalIssues?.value || undefined;
  }
  // Supplement with diagnostics if available
  if (diagnosticsBundle?.website) {
    if (!website.conversionBlockers && diagnosticsBundle.website.conversionBlocks) {
      website.conversionBlockers = diagnosticsBundle.website.conversionBlocks;
    }
  }

  // Extract media context
  const media: CreativeMediaContext = {};
  if (contextGraph?.performanceMedia) {
    media.topPerformingChannels = contextGraph.performanceMedia.topPerformingChannel?.value
      ? [contextGraph.performanceMedia.topPerformingChannel.value]
      : undefined;
    media.mediaMaturity = contextGraph.performanceMedia.overallHealth?.value || undefined;
    media.channelRecommendations = contextGraph.performanceMedia.activeChannels?.value || undefined;
  }

  // Extract existing creative output
  const existingOutput: ExistingCreativeOutput = {};
  if (contextGraph?.creative) {
    existingOutput.messaging = contextGraph.creative.messaging?.value || null;
    existingOutput.segmentMessages = contextGraph.creative.segmentMessages?.value || null;
    existingOutput.creativeTerritories = contextGraph.creative.creativeTerritories?.value || [];
    existingOutput.campaignConcepts = contextGraph.creative.campaignConcepts?.value || [];
    existingOutput.guidelines = contextGraph.creative.guidelines?.value || null;
  }

  // Check readiness
  const hasICP = Boolean(identity.icpDescription || audienceSegments.length > 0);
  const hasBrandPillars = Boolean(
    brand.positioning || brand.valueProps?.length || brand.messagingPillars?.length
  );
  const hasAudienceSegments = audienceSegments.length > 0;
  const hasObjectives = Boolean(objectives.primaryObjective || objectives.kpis?.length);

  const missingCritical: string[] = [];
  if (!hasICP) missingCritical.push('ICP / Target Audience');
  if (!hasBrandPillars) missingCritical.push('Brand Positioning / Value Props');

  const canRunHighConfidence = hasICP && hasBrandPillars;

  // Generate summaries
  const identitySummary = generateIdentitySummary(identity);
  const brandSummary = generateBrandSummary(brand);
  const audienceSummary = generateAudienceSummary(audienceSegments);
  const productSummary = generateProductSummary(product);
  const objectivesSummary = generateObjectivesSummary(objectives);
  const websiteSummary = generateWebsiteSummary(website);
  const mediaSummary = generateMediaSummary(media);

  console.log('[CreativeLab] Context loaded:', {
    hasICP,
    hasBrandPillars,
    hasAudienceSegments,
    hasObjectives,
    segmentCount: audienceSegments.length,
    canRunHighConfidence,
    missingCritical,
  });

  return {
    companyId,
    companyName: contextGraph?.companyName || companyId,
    identitySummary,
    brandSummary,
    audienceSummary,
    productSummary,
    objectivesSummary,
    websiteSummary,
    mediaSummary,
    identity,
    brand,
    audienceSegments,
    product,
    objectives,
    website,
    media,
    existingOutput,
    readiness: {
      hasICP,
      hasBrandPillars,
      hasAudienceSegments,
      hasObjectives,
      missingCritical,
      canRunHighConfidence,
    },
    contextGraph,
    loadedAt: new Date().toISOString(),
  };
}

/**
 * Get a formatted context summary for LLM prompts
 */
export function formatContextForLLM(context: CreativeLabContext): string {
  const sections: string[] = [];

  sections.push(`## Company Identity\n${context.identitySummary}`);
  sections.push(`## Brand & Positioning\n${context.brandSummary}`);
  sections.push(`## Target Audience\n${context.audienceSummary}`);
  sections.push(`## Product / Offer\n${context.productSummary}`);
  sections.push(`## Business Objectives\n${context.objectivesSummary}`);

  if (context.websiteSummary !== 'No website insights available.') {
    sections.push(`## Website Insights\n${context.websiteSummary}`);
  }

  if (context.mediaSummary !== 'No media insights available.') {
    sections.push(`## Media Insights\n${context.mediaSummary}`);
  }

  return sections.join('\n\n');
}
