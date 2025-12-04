// lib/contextGraph/views/creativeContext.ts
// Creative Brief Context View
//
// Provides everything the Creative Lab needs to generate
// creative concepts, copy, and messaging.

import { loadContextGraph } from '../storage';
import { getNeedsRefreshReport } from '../needsRefresh';
import {
  computeContextHealthScore,
  convertNeedsRefreshReport,
  type NeedsRefreshFlag,
} from '../contextHealth';
import type { CompanyContextGraph } from '../companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Creative Brief Context - unified view for creative generation
 */
export interface CreativeBriefContext {
  /** Full context graph reference */
  graph: CompanyContextGraph;

  /** Company identity for context */
  company: {
    id: string;
    name: string;
    industry: string | null;
  };

  /** Brand context - core for creative work */
  brand: {
    positioning: string | null;
    tagline: string | null;
    toneOfVoice: string | null;
    brandPersonality: string | null;
    valueProps: string[];
    differentiators: string[];
    uniqueSellingPoints: string[];
    messagingPillars: string[];
    brandStrengths: string[];
  };

  /** Product/Offer context */
  productOffer: {
    heroProducts: string[];
    productLines: string[];
    pricingNotes: string | null;
    uniqueOffers: string[];
    conversionOffers: string[];
    leadMagnets: string[];
  };

  /** Audience context for targeting creative */
  audience: {
    coreSegments: string[];
    demographics: string | null;
    painPoints: string[];
    motivations: string[];
    audienceNeeds: string[];
    mediaHabits: string | null;
    preferredChannels: string[];
  };

  /** Persona data from Audience Lab - key for creative messaging */
  personas: {
    names: string[];
    briefs: Array<{
      name?: string;
      tagline?: string | null;
      oneSentenceSummary?: string | null;
      priority?: string | null;
    }>;
    triggers: string[];
    objections: string[];
    decisionFactors: string[];
    keyMessages: string[];
    proofPointsNeeded: string[];
    exampleHooks: string[];
    contentFormatsPreferred: string[];
    toneGuidance: string | null;
  };

  /** Media hints for channel-specific creative */
  mediaHints: {
    activeChannels: string[];
    topPerformingChannel: string | null;
    topCreatives: string[];
  };

  /** Competitive context */
  competitive: {
    primaryCompetitors: string[];
    competitivePosition: string | null;
  };

  /** Context health metrics */
  contextHealthScore: number;
  needsRefresh: NeedsRefreshFlag[];
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get the complete creative brief context for a company
 *
 * This is the primary entry point for Creative Lab.
 * It loads the context graph and extracts all brand, audience,
 * and product information relevant to creative generation.
 *
 * @param companyId The company ID
 * @returns CreativeBriefContext or null if no graph exists
 */
export async function getCreativeBriefContext(
  companyId: string
): Promise<CreativeBriefContext | null> {
  // Load the context graph
  const graph = await loadContextGraph(companyId);

  if (!graph) {
    return null;
  }

  // Get needs-refresh report
  const refreshReport = getNeedsRefreshReport(graph);
  const needsRefresh = convertNeedsRefreshReport(refreshReport);
  const contextHealthScore = computeContextHealthScore(needsRefresh);

  return {
    graph,

    company: {
      id: graph.companyId,
      name: graph.companyName,
      industry: graph.identity.industry.value,
    },

    brand: {
      positioning: graph.brand.positioning.value,
      tagline: graph.brand.tagline.value,
      toneOfVoice: graph.brand.toneOfVoice.value,
      brandPersonality: graph.brand.brandPersonality.value,
      valueProps: graph.brand.valueProps.value ?? [],
      differentiators: graph.brand.differentiators.value ?? [],
      uniqueSellingPoints: graph.brand.uniqueSellingPoints.value ?? [],
      messagingPillars: graph.brand.messagingPillars.value ?? [],
      brandStrengths: graph.brand.brandStrengths.value ?? [],
    },

    productOffer: {
      heroProducts: graph.productOffer.heroProducts.value ?? [],
      productLines: graph.productOffer.productLines.value ?? [],
      pricingNotes: graph.productOffer.pricingNotes.value,
      uniqueOffers: graph.productOffer.uniqueOffers.value ?? [],
      conversionOffers: graph.productOffer.conversionOffers.value ?? [],
      leadMagnets: graph.productOffer.leadMagnets.value ?? [],
    },

    audience: {
      coreSegments: graph.audience.coreSegments.value ?? [],
      demographics: graph.audience.demographics.value,
      painPoints: graph.audience.painPoints.value ?? [],
      motivations: graph.audience.motivations.value ?? [],
      audienceNeeds: graph.audience.audienceNeeds.value ?? [],
      mediaHabits: graph.audience.mediaHabits.value,
      preferredChannels: graph.audience.preferredChannels.value ?? [],
    },

    personas: {
      names: graph.audience.personaNames?.value ?? [],
      briefs: graph.audience.personaBriefs?.value ?? [],
      triggers: graph.audience.audienceTriggers?.value ?? [],
      objections: graph.audience.audienceObjections?.value ?? [],
      decisionFactors: graph.audience.decisionFactors?.value ?? [],
      keyMessages: graph.audience.keyMessages?.value ?? [],
      proofPointsNeeded: graph.audience.proofPointsNeeded?.value ?? [],
      exampleHooks: graph.audience.exampleHooks?.value ?? [],
      contentFormatsPreferred: graph.audience.contentFormatsPreferred?.value ?? [],
      toneGuidance: graph.audience.toneGuidance?.value ?? null,
    },

    mediaHints: {
      activeChannels: (graph.performanceMedia.activeChannels.value ?? []) as string[],
      topPerformingChannel: graph.performanceMedia.topPerformingChannel.value as string | null,
      topCreatives: graph.performanceMedia.topCreatives.value ?? [],
    },

    competitive: {
      primaryCompetitors: graph.identity.primaryCompetitors.value ?? [],
      competitivePosition: graph.brand.competitivePosition.value,
    },

    contextHealthScore,
    needsRefresh,
  };
}

/**
 * Build a compact context string for Creative AI prompts
 *
 * @param ctx The creative brief context
 * @returns Formatted string for inclusion in AI prompts
 */
export function buildCreativePromptContext(ctx: CreativeBriefContext): string {
  const sections: string[] = [];

  // Company
  sections.push(`## Company
- Name: ${ctx.company.name}
- Industry: ${ctx.company.industry || 'Unknown'}`);

  // Brand - most important for creative
  sections.push(`## Brand Identity
- Positioning: ${ctx.brand.positioning || 'Not defined'}
- Tagline: ${ctx.brand.tagline || 'None'}
- Tone of Voice: ${ctx.brand.toneOfVoice || 'Not defined'}
- Brand Personality: ${ctx.brand.brandPersonality || 'Not defined'}
- Value Props: ${ctx.brand.valueProps.length > 0 ? ctx.brand.valueProps.join(', ') : 'None'}
- Differentiators: ${ctx.brand.differentiators.length > 0 ? ctx.brand.differentiators.join(', ') : 'None'}
- Messaging Pillars: ${ctx.brand.messagingPillars.length > 0 ? ctx.brand.messagingPillars.join(', ') : 'None'}`);

  // Product/Offers
  if (ctx.productOffer.heroProducts.length > 0 || ctx.productOffer.uniqueOffers.length > 0) {
    sections.push(`## Products & Offers
- Hero Products: ${ctx.productOffer.heroProducts.length > 0 ? ctx.productOffer.heroProducts.join(', ') : 'None specified'}
- Unique Offers: ${ctx.productOffer.uniqueOffers.length > 0 ? ctx.productOffer.uniqueOffers.join(', ') : 'None'}
- Lead Magnets: ${ctx.productOffer.leadMagnets.length > 0 ? ctx.productOffer.leadMagnets.join(', ') : 'None'}
- Pricing Notes: ${ctx.productOffer.pricingNotes || 'None'}`);
  }

  // Audience - critical for creative targeting
  sections.push(`## Target Audience
- Core Segments: ${ctx.audience.coreSegments.length > 0 ? ctx.audience.coreSegments.join(', ') : 'Not defined'}
- Demographics: ${ctx.audience.demographics || 'Not defined'}
- Pain Points: ${ctx.audience.painPoints.length > 0 ? ctx.audience.painPoints.join(', ') : 'Not captured'}
- Motivations: ${ctx.audience.motivations.length > 0 ? ctx.audience.motivations.join(', ') : 'Not captured'}
- Media Habits: ${ctx.audience.mediaHabits || 'Unknown'}`);

  // Personas - rich insights for creative messaging
  if (ctx.personas.names.length > 0) {
    sections.push(`## Personas
- Named Personas: ${ctx.personas.names.join(', ')}
- Triggers (what prompts action): ${ctx.personas.triggers.length > 0 ? ctx.personas.triggers.slice(0, 5).join(', ') : 'Not captured'}
- Objections (hesitations): ${ctx.personas.objections.length > 0 ? ctx.personas.objections.slice(0, 5).join(', ') : 'Not captured'}
- Decision Factors: ${ctx.personas.decisionFactors.length > 0 ? ctx.personas.decisionFactors.slice(0, 5).join(', ') : 'Not captured'}
- Key Messages: ${ctx.personas.keyMessages.length > 0 ? ctx.personas.keyMessages.slice(0, 5).join(', ') : 'Not defined'}
- Proof Points Needed: ${ctx.personas.proofPointsNeeded.length > 0 ? ctx.personas.proofPointsNeeded.slice(0, 5).join(', ') : 'None specified'}
- Example Hooks: ${ctx.personas.exampleHooks.length > 0 ? ctx.personas.exampleHooks.slice(0, 3).join(' | ') : 'None'}
- Preferred Content Formats: ${ctx.personas.contentFormatsPreferred.length > 0 ? ctx.personas.contentFormatsPreferred.join(', ') : 'Not specified'}
- Tone Guidance: ${ctx.personas.toneGuidance || 'Not specified'}`);
  }

  // Competitive context
  if (ctx.competitive.primaryCompetitors.length > 0) {
    sections.push(`## Competitive Context
- Key Competitors: ${ctx.competitive.primaryCompetitors.join(', ')}
- Competitive Position: ${ctx.competitive.competitivePosition || 'Not defined'}`);
  }

  // Media performance hints
  if (ctx.mediaHints.activeChannels.length > 0) {
    sections.push(`## Media Context
- Active Channels: ${ctx.mediaHints.activeChannels.join(', ')}
- Top Performing Channel: ${ctx.mediaHints.topPerformingChannel || 'Unknown'}
- Top Creatives: ${ctx.mediaHints.topCreatives.length > 0 ? ctx.mediaHints.topCreatives.slice(0, 3).join(', ') : 'None tracked'}`);
  }

  return sections.join('\n\n');
}
