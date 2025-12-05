// lib/contextGraph/domains/creative.ts
// Creative Context Domain
//
// Extended schema for Creative Lab output including:
// - Messaging architecture (core value prop, supporting points, differentiators)
// - Segment-specific messaging (per-segment value props, headlines, CTAs)
// - Creative territories (themes, visual direction, tone)
// - Campaign concepts (insights, example ads, channels)
// - Brand/creative guidelines (voice, tone, visual, testing roadmap)
// - Channel patterns (channel-specific angles, hooks, formats)
// - Testing roadmap (prioritized experiments linked to concepts)
// - Asset specs (production-ready briefs for creative assets)

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { MediaChannelId } from '../enums';

/**
 * Creative format enum
 */
export const CreativeFormat = z.enum([
  'static_image',
  'carousel',
  'video_short',
  'video_long',
  'html5',
  'responsive_display',
  'text_ad',
  'native',
  'audio',
  'ugc',
  'influencer',
  'other',
]);

export type CreativeFormat = z.infer<typeof CreativeFormat>;

// ============================================================================
// Messaging Architecture Schema
// ============================================================================

/**
 * Core messaging architecture - the foundational value proposition and proof points
 */
export const MessagingArchitecture = z.object({
  /** The core value proposition - the single most compelling reason to choose */
  coreValueProp: z.string(),
  /** Supporting messaging points that reinforce the core value prop */
  supportingPoints: z.array(z.string()),
  /** Proof points - evidence, stats, testimonials that back up claims */
  proofPoints: z.array(z.string()),
  /** Key differentiators from competitors */
  differentiators: z.array(z.string()),
});

export type MessagingArchitecture = z.infer<typeof MessagingArchitecture>;

// ============================================================================
// Segment-Specific Messaging Schema
// ============================================================================

/**
 * Messaging customized for a specific audience segment
 */
export const SegmentMessage = z.object({
  /** Segment-specific value proposition */
  valueProp: z.string(),
  /** Specific pain points this segment experiences that we address */
  painsAddressed: z.array(z.string()),
  /** Desired outcomes this segment is seeking */
  outcomes: z.array(z.string()),
  /** Common objections and how to handle them */
  objections: z.record(z.string(), z.string()),
  /** Example headlines that resonate with this segment */
  exampleHeadlines: z.array(z.string()),
  /** Recommended CTAs for this segment */
  ctas: z.array(z.string()),
});

export type SegmentMessage = z.infer<typeof SegmentMessage>;

// ============================================================================
// Creative Territory Schema
// ============================================================================

/**
 * A creative territory - a conceptual space for creative execution
 */
export const CreativeTerritory = z.object({
  /** Territory name (e.g., "Authority", "Transformation") */
  name: z.string(),
  /** Central theme of this territory */
  theme: z.string(),
  /** Visual direction guidance */
  visualDirection: z.string(),
  /** Tone of voice for this territory */
  tone: z.string(),
  /** Example headlines in this territory */
  exampleHeadlines: z.array(z.string()),
  /** Recommended ad formats for this territory */
  formats: z.array(z.string()),
});

export type CreativeTerritory = z.infer<typeof CreativeTerritory>;

// ============================================================================
// Campaign Concept Schema
// ============================================================================

/**
 * A campaign concept - a specific creative campaign idea
 */
export const CampaignConcept = z.object({
  /** Campaign name */
  name: z.string(),
  /** The audience insight driving this campaign */
  insight: z.string(),
  /** The creative concept / big idea */
  concept: z.string(),
  /** Example ad executions */
  exampleAds: z.array(z.string()),
  /** Recommended channels for this campaign */
  channels: z.array(z.string()),
  /** Metrics to measure success */
  measurement: z.array(z.string()),
});

export type CampaignConcept = z.infer<typeof CampaignConcept>;

// ============================================================================
// Creative Guidelines Schema
// ============================================================================

/**
 * Creative and brand guidelines for consistent execution
 */
export const CreativeGuidelines = z.object({
  /** Brand voice description */
  voice: z.string(),
  /** Tone guidance (can vary by context) */
  tone: z.string(),
  /** Visual identity guidelines */
  visual: z.string(),
  /** Recommended testing roadmap for creative optimization */
  testingRoadmap: z.array(z.string()),
});

export type CreativeGuidelines = z.infer<typeof CreativeGuidelines>;

// ============================================================================
// Channel Pattern Schema (Phase 3)
// ============================================================================

/**
 * Channel-specific creative pattern for a segment
 */
export const ChannelSegmentPattern = z.object({
  /** Creative angles that work for this channel/segment */
  angles: z.array(z.string()),
  /** Hook styles that grab attention */
  hooks: z.array(z.string()),
  /** Recommended ad formats */
  formats: z.array(z.string()),
  /** Example ad descriptions */
  exampleAds: z.array(z.string()),
});

export type ChannelSegmentPattern = z.infer<typeof ChannelSegmentPattern>;

/**
 * Channel patterns - channel -> segment -> pattern mapping
 */
export const ChannelPatterns = z.record(
  z.string(), // channel ID (google_ads, meta, linkedin, etc.)
  z.record(z.string(), ChannelSegmentPattern) // segment name -> pattern
);

export type ChannelPatterns = z.infer<typeof ChannelPatterns>;

// ============================================================================
// Testing Plan & Roadmap Schema (Phase 3)
// ============================================================================

/**
 * Test variant for A/B testing
 */
export const TestVariant = z.object({
  /** Variant name */
  name: z.string(),
  /** What's different in this variant */
  description: z.string(),
  /** Hypothesis for this variant */
  hypothesis: z.string(),
});

export type TestVariant = z.infer<typeof TestVariant>;

/**
 * Testing plan for a campaign concept
 */
export const TestingPlan = z.object({
  /** Core hypotheses to test */
  hypotheses: z.array(z.string()),
  /** Test variants to run */
  variants: z.array(TestVariant),
  /** Metrics to measure */
  metrics: z.array(z.string()),
  /** Target KPIs with expected lifts */
  targetKPIs: z.record(z.string(), z.string()), // kpi name -> target value/lift
  /** Recommended sample size */
  sampleSize: z.string().optional(),
  /** Recommended test duration */
  duration: z.string().optional(),
});

export type TestingPlan = z.infer<typeof TestingPlan>;

/**
 * Testing priority level
 */
export const TestPriority = z.enum(['high', 'medium', 'low']);
export type TestPriority = z.infer<typeof TestPriority>;

/**
 * Test status
 */
export const TestStatus = z.enum(['planned', 'in_progress', 'completed', 'paused']);
export type TestStatus = z.infer<typeof TestStatus>;

/**
 * Testing roadmap item - a prioritized test linked to a campaign concept
 */
export const TestingRoadmapItem = z.object({
  /** Unique ID for this test */
  id: z.string(),
  /** Test name */
  name: z.string(),
  /** What we're testing */
  description: z.string(),
  /** Linked campaign concept name (for cross-reference) */
  campaignConceptName: z.string().optional(),
  /** Primary channel for this test */
  channel: z.string(),
  /** Target audience segment */
  segment: z.string().optional(),
  /** Priority level */
  priority: TestPriority,
  /** Current status */
  status: TestStatus.default('planned'),
  /** Expected impact on key metrics */
  expectedImpact: z.string(),
  /** Effort estimate (S/M/L) */
  effort: z.enum(['S', 'M', 'L']),
  /** Dependencies on other tests */
  dependsOn: z.array(z.string()).optional(),
  /** Hypotheses to validate */
  hypotheses: z.array(z.string()),
  /** Success metrics */
  successMetrics: z.array(z.string()),
});

export type TestingRoadmapItem = z.infer<typeof TestingRoadmapItem>;

// ============================================================================
// Asset Spec Schema (Phase 3)
// ============================================================================

/**
 * Asset type enum
 */
export const AssetType = z.enum([
  'static_image',
  'carousel',
  'video_15s',
  'video_30s',
  'video_60s',
  'html5',
  'responsive_display',
  'text_ad',
  'landing_page',
  'email',
  'social_post',
  'other',
]);

export type AssetType = z.infer<typeof AssetType>;

/**
 * Copy slot for an asset
 */
export const CopySlot = z.object({
  /** Slot name (e.g., "headline", "body", "cta") */
  name: z.string(),
  /** Max character count */
  maxChars: z.number().optional(),
  /** Suggested copy */
  suggestedCopy: z.string(),
  /** Alternative options */
  alternatives: z.array(z.string()).optional(),
});

export type CopySlot = z.infer<typeof CopySlot>;

/**
 * Asset specification for creative production
 */
export const AssetSpec = z.object({
  /** Unique ID for this asset spec */
  id: z.string(),
  /** Linked campaign concept name */
  campaignConceptName: z.string(),
  /** Target channel */
  channel: z.string(),
  /** Asset type */
  assetType: AssetType,
  /** Asset dimensions/format specs */
  specs: z.object({
    dimensions: z.string().optional(), // e.g., "1080x1080", "16:9"
    duration: z.string().optional(), // for video
    fileFormat: z.string().optional(),
    maxFileSize: z.string().optional(),
    platformRequirements: z.array(z.string()).optional(),
  }),
  /** Copy slots with suggested copy */
  copySlots: z.array(CopySlot),
  /** Visual direction notes */
  visualNotes: z.string(),
  /** Creative territory this aligns with */
  territoryName: z.string().optional(),
  /** Target segment */
  segment: z.string().optional(),
  /** Production priority */
  priority: TestPriority.default('medium'),
  /** Production status */
  status: z.enum(['brief', 'in_production', 'review', 'approved', 'live']).default('brief'),
});

export type AssetSpec = z.infer<typeof AssetSpec>;

// ============================================================================
// Extended Campaign Concept Schema (Phase 3)
// ============================================================================

/**
 * Extended campaign concept with testing plan
 */
export const CampaignConceptExtended = CampaignConcept.extend({
  /** Testing plan for this concept */
  testingPlan: TestingPlan.optional(),
});

export type CampaignConceptExtended = z.infer<typeof CampaignConceptExtended>;

// ============================================================================
// Main Creative Domain Schema
// ============================================================================

/**
 * Creative domain captures creative assets, messaging architecture, and production capabilities.
 * This informs creative strategy and production planning.
 *
 * Extended in Phase 2 to support full Creative Lab output:
 * - Messaging architecture with segment-specific variations
 * - Creative territories for conceptual direction
 * - Campaign concepts with channel recommendations
 * - Brand/creative guidelines
 */
export const CreativeDomain = z.object({
  // ===========================================================================
  // NEW: Creative Lab Output (Phase 2)
  // ===========================================================================

  /** Core messaging architecture */
  messaging: WithMeta(MessagingArchitecture),

  /** Segment-specific messaging (keyed by segment name) */
  segmentMessages: WithMeta(z.record(z.string(), SegmentMessage)),

  /** Creative territories for campaign development */
  creativeTerritories: WithMetaArray(CreativeTerritory),

  /** Campaign concepts derived from territories and insights */
  campaignConcepts: WithMetaArray(CampaignConcept),

  /** Creative and brand guidelines */
  guidelines: WithMeta(CreativeGuidelines),

  // ===========================================================================
  // NEW: Phase 3 - Channel Patterns, Testing, Asset Specs
  // ===========================================================================

  /** Channel-specific creative patterns (channel -> segment -> pattern) */
  channelPatterns: WithMeta(ChannelPatterns),

  /** Extended campaign concepts with testing plans (replaces campaignConcepts when available) */
  campaignConceptsExtended: WithMetaArray(CampaignConceptExtended),

  /** Prioritized testing roadmap */
  testingRoadmapItems: WithMetaArray(TestingRoadmapItem),

  /** Asset specifications for production */
  assetSpecs: WithMetaArray(AssetSpec),

  // ===========================================================================
  // Legacy Fields (Phase 1 - kept for backward compatibility)
  // ===========================================================================

  // Inventory
  creativeInventorySummary: WithMeta(z.string()),
  availableFormats: WithMetaArray(CreativeFormat),

  // Brand Guidelines (legacy - use `guidelines` for new implementations)
  brandGuidelines: WithMeta(z.string()),
  visualIdentityNotes: WithMeta(z.string()),

  // Messaging (legacy - use `messaging` for new implementations)
  coreMessages: WithMetaArray(z.string()),
  proofPoints: WithMetaArray(z.string()),
  callToActions: WithMetaArray(z.string()),

  // Content Gaps
  contentGaps: WithMeta(z.string()),
  formatGaps: WithMetaArray(CreativeFormat),

  // Production
  productionScalability: WithMeta(z.string()),
  ugcPipelines: WithMeta(z.string()),
  productionBudget: WithMeta(z.number()),

  // Performance
  topPerformingCreatives: WithMetaArray(z.string()),
  creativeWearoutNotes: WithMeta(z.string()),
  testingRoadmap: WithMeta(z.string()),

  // Assets
  assetLibraryNotes: WithMeta(z.string()),
  stockVsOriginalRatio: WithMeta(z.string()),
});

export type CreativeDomain = z.infer<typeof CreativeDomain>;

/**
 * Create an empty Creative domain
 */
export function createEmptyCreativeDomain(): CreativeDomain {
  return {
    // New Phase 2 fields
    messaging: { value: null, provenance: [] },
    segmentMessages: { value: null, provenance: [] },
    creativeTerritories: { value: [], provenance: [] },
    campaignConcepts: { value: [], provenance: [] },
    guidelines: { value: null, provenance: [] },

    // New Phase 3 fields
    channelPatterns: { value: null, provenance: [] },
    campaignConceptsExtended: { value: [], provenance: [] },
    testingRoadmapItems: { value: [], provenance: [] },
    assetSpecs: { value: [], provenance: [] },

    // Legacy Phase 1 fields
    creativeInventorySummary: { value: null, provenance: [] },
    availableFormats: { value: [], provenance: [] },
    brandGuidelines: { value: null, provenance: [] },
    visualIdentityNotes: { value: null, provenance: [] },
    coreMessages: { value: [], provenance: [] },
    proofPoints: { value: [], provenance: [] },
    callToActions: { value: [], provenance: [] },
    contentGaps: { value: null, provenance: [] },
    formatGaps: { value: [], provenance: [] },
    productionScalability: { value: null, provenance: [] },
    ugcPipelines: { value: null, provenance: [] },
    productionBudget: { value: null, provenance: [] },
    topPerformingCreatives: { value: [], provenance: [] },
    creativeWearoutNotes: { value: null, provenance: [] },
    testingRoadmap: { value: null, provenance: [] },
    assetLibraryNotes: { value: null, provenance: [] },
    stockVsOriginalRatio: { value: null, provenance: [] },
  };
}
