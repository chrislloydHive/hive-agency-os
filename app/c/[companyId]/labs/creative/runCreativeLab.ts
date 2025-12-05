// app/c/[companyId]/labs/creative/runCreativeLab.ts
// Creative Lab LLM Pipeline
//
// Executes the Creative Lab generation using AI to produce:
// - Messaging architecture (core value prop, supporting points, proof points, differentiators)
// - Segment-specific messaging (per-segment value props, headlines, CTAs)
// - Creative territories (themes, visual direction, tone)
// - Campaign concepts (insights, example ads, channels)
// - Creative guidelines (voice, tone, visual, testing roadmap)

import OpenAI from 'openai';
import { z } from 'zod';
import type { CreativeLabContext } from './loadCreativeLab';
import { formatContextForLLM } from './loadCreativeLab';
import type {
  MessagingArchitecture,
  SegmentMessage,
  CreativeTerritory,
  CampaignConcept,
  CreativeGuidelines,
  ChannelPatterns,
  CampaignConceptExtended,
  TestingRoadmapItem,
  AssetSpec,
  TestingPlan,
} from '@/lib/contextGraph/domains/creative';

// ============================================================================
// Types
// ============================================================================

/**
 * Complete Creative Lab output (Phase 2 - basic)
 */
export interface CreativeLabOutput {
  messaging: MessagingArchitecture;
  segmentMessages: Record<string, SegmentMessage>;
  creativeTerritories: CreativeTerritory[];
  campaignConcepts: CampaignConcept[];
  guidelines: CreativeGuidelines;
}

/**
 * Extended Creative Lab output (Phase 3 - with channel patterns, testing, asset specs)
 */
export interface CreativeLabOutputExtended extends CreativeLabOutput {
  /** Channel-specific creative patterns */
  channelPatterns: ChannelPatterns;
  /** Campaign concepts with testing plans */
  campaignConceptsExtended: CampaignConceptExtended[];
  /** Prioritized testing roadmap */
  testingRoadmap: TestingRoadmapItem[];
  /** Asset specifications for production */
  assetSpecs: AssetSpec[];
}

/**
 * Result of running Creative Lab
 */
export interface CreativeLabRunResult {
  success: boolean;
  output?: CreativeLabOutput;
  outputExtended?: CreativeLabOutputExtended;
  error?: string;
  confidence: 'high' | 'medium' | 'low';
  runId: string;
  runAt: string;
  /** Whether extended output was generated (with channels, testing, assets) */
  hasExtendedOutput: boolean;
}

/**
 * Zod schema for validating basic LLM output
 */
const CreativeLabOutputSchema = z.object({
  messaging: z.object({
    coreValueProp: z.string(),
    supportingPoints: z.array(z.string()),
    proofPoints: z.array(z.string()),
    differentiators: z.array(z.string()),
  }),
  segmentMessages: z.record(
    z.string(),
    z.object({
      valueProp: z.string(),
      painsAddressed: z.array(z.string()),
      outcomes: z.array(z.string()),
      objections: z.record(z.string(), z.string()),
      exampleHeadlines: z.array(z.string()),
      ctas: z.array(z.string()),
    })
  ),
  creativeTerritories: z.array(
    z.object({
      name: z.string(),
      theme: z.string(),
      visualDirection: z.string(),
      tone: z.string(),
      exampleHeadlines: z.array(z.string()),
      formats: z.array(z.string()),
    })
  ),
  campaignConcepts: z.array(
    z.object({
      name: z.string(),
      insight: z.string(),
      concept: z.string(),
      exampleAds: z.array(z.string()),
      channels: z.array(z.string()),
      measurement: z.array(z.string()),
    })
  ),
  guidelines: z.object({
    voice: z.string(),
    tone: z.string(),
    visual: z.string(),
    testingRoadmap: z.array(z.string()),
  }),
});

/**
 * Zod schema for extended output with channel patterns, testing, and asset specs
 */
const CreativeLabExtendedOutputSchema = CreativeLabOutputSchema.extend({
  // Channel patterns: channel -> segment -> pattern
  channelPatterns: z.record(
    z.string(),
    z.record(
      z.string(),
      z.object({
        angles: z.array(z.string()),
        hooks: z.array(z.string()),
        formats: z.array(z.string()),
        exampleAds: z.array(z.string()),
      })
    )
  ),
  // Campaign concepts with testing plans
  campaignConceptsExtended: z.array(
    z.object({
      name: z.string(),
      insight: z.string(),
      concept: z.string(),
      exampleAds: z.array(z.string()),
      channels: z.array(z.string()),
      measurement: z.array(z.string()),
      testingPlan: z.object({
        hypotheses: z.array(z.string()),
        variants: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
            hypothesis: z.string(),
          })
        ),
        metrics: z.array(z.string()),
        targetKPIs: z.record(z.string(), z.string()),
        sampleSize: z.string().optional(),
        duration: z.string().optional(),
      }).optional(),
    })
  ),
  // Testing roadmap
  testingRoadmap: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      campaignConceptName: z.string().optional(),
      channel: z.string(),
      segment: z.string().optional(),
      priority: z.enum(['high', 'medium', 'low']),
      status: z.enum(['planned', 'in_progress', 'completed', 'paused']).default('planned'),
      expectedImpact: z.string(),
      effort: z.enum(['S', 'M', 'L']),
      dependsOn: z.array(z.string()).optional(),
      hypotheses: z.array(z.string()),
      successMetrics: z.array(z.string()),
    })
  ),
  // Asset specs
  assetSpecs: z.array(
    z.object({
      id: z.string(),
      campaignConceptName: z.string(),
      channel: z.string(),
      assetType: z.enum([
        'static_image', 'carousel', 'video_15s', 'video_30s', 'video_60s',
        'html5', 'responsive_display', 'text_ad', 'landing_page', 'email',
        'social_post', 'other',
      ]),
      specs: z.object({
        dimensions: z.string().optional(),
        duration: z.string().optional(),
        fileFormat: z.string().optional(),
        maxFileSize: z.string().optional(),
        platformRequirements: z.array(z.string()).optional(),
      }),
      copySlots: z.array(
        z.object({
          name: z.string(),
          maxChars: z.number().optional(),
          suggestedCopy: z.string(),
          alternatives: z.array(z.string()).optional(),
        })
      ),
      visualNotes: z.string(),
      territoryName: z.string().optional(),
      segment: z.string().optional(),
      priority: z.enum(['high', 'medium', 'low']).default('medium'),
      status: z.enum(['brief', 'in_production', 'review', 'approved', 'live']).default('brief'),
    })
  ),
});

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build the system prompt for Creative Lab
 */
function buildSystemPrompt(extended: boolean = false): string {
  const basePrompt = `You are CreativeLab, an expert creative strategist AI.

Your task is to generate a complete creative strategy system based on the company's Brand, Audience, and Objectives.

CRITICAL CONSTRAINTS:
1. You MUST work within the provided Brand positioning and ICP - DO NOT change or expand them
2. All messaging must align with the established brand voice and values
3. Creative concepts must target the defined audience segments
4. Recommendations must support the stated business objectives`;

  const basicOutput = `
OUTPUT REQUIREMENTS:
Generate a complete creative strategy as valid JSON matching this exact structure:

{
  "messaging": {
    "coreValueProp": "The single most compelling reason to choose this company (one powerful sentence)",
    "supportingPoints": ["3-5 supporting messages that reinforce the core value prop"],
    "proofPoints": ["3-5 pieces of evidence, stats, testimonials that back up claims"],
    "differentiators": ["3-5 key ways this company differs from competitors"]
  },
  "segmentMessages": {
    "Segment Name": {
      "valueProp": "Segment-specific value proposition",
      "painsAddressed": ["Specific pains this segment experiences"],
      "outcomes": ["Desired outcomes they seek"],
      "objections": {
        "Objection 1": "Response to objection 1",
        "Objection 2": "Response to objection 2"
      },
      "exampleHeadlines": ["3-5 headlines that resonate with this segment"],
      "ctas": ["2-4 CTAs appropriate for this segment"]
    }
  },
  "creativeTerritories": [
    {
      "name": "Territory name (2-3 words)",
      "theme": "Central theme of this territory",
      "visualDirection": "Visual style guidance",
      "tone": "Tone of voice for this territory",
      "exampleHeadlines": ["3-5 headlines in this territory"],
      "formats": ["Recommended ad formats: static, video, carousel, etc."]
    }
  ],
  "campaignConcepts": [
    {
      "name": "Campaign name",
      "insight": "The audience insight driving this campaign",
      "concept": "The creative concept / big idea",
      "exampleAds": ["2-3 example ad descriptions"],
      "channels": ["Recommended channels for this campaign"],
      "measurement": ["Key metrics to measure success"]
    }
  ],
  "guidelines": {
    "voice": "Description of the brand voice",
    "tone": "Tone guidance that varies by context",
    "visual": "Visual identity guidelines for creative execution",
    "testingRoadmap": ["Recommended tests to optimize creative performance"]
  }
}`;

  const extendedOutput = `
OUTPUT REQUIREMENTS:
Generate a COMPREHENSIVE creative strategy as valid JSON matching this exact structure:

{
  "messaging": {
    "coreValueProp": "The single most compelling reason to choose this company (one powerful sentence)",
    "supportingPoints": ["3-5 supporting messages that reinforce the core value prop"],
    "proofPoints": ["3-5 pieces of evidence, stats, testimonials that back up claims"],
    "differentiators": ["3-5 key ways this company differs from competitors"]
  },
  "segmentMessages": {
    "Segment Name": {
      "valueProp": "Segment-specific value proposition",
      "painsAddressed": ["Specific pains this segment experiences"],
      "outcomes": ["Desired outcomes they seek"],
      "objections": { "Objection": "Response" },
      "exampleHeadlines": ["3-5 headlines"],
      "ctas": ["2-4 CTAs"]
    }
  },
  "creativeTerritories": [
    {
      "name": "Territory name",
      "theme": "Central theme",
      "visualDirection": "Visual style",
      "tone": "Tone of voice",
      "exampleHeadlines": ["Headlines"],
      "formats": ["Formats"]
    }
  ],
  "campaignConcepts": [
    {
      "name": "Campaign name",
      "insight": "Audience insight",
      "concept": "Creative concept",
      "exampleAds": ["Ad descriptions"],
      "channels": ["Channels"],
      "measurement": ["Metrics"]
    }
  ],
  "guidelines": {
    "voice": "Brand voice description",
    "tone": "Tone guidance",
    "visual": "Visual identity guidelines",
    "testingRoadmap": ["Testing recommendations"]
  },
  "channelPatterns": {
    "google_ads": {
      "Segment Name": {
        "angles": ["Creative angles that work for Google Ads"],
        "hooks": ["Attention-grabbing hooks for search/display"],
        "formats": ["responsive_search", "responsive_display", "pmax"],
        "exampleAds": ["Example ad copy/descriptions"]
      }
    },
    "meta": {
      "Segment Name": {
        "angles": ["Creative angles for Meta/Facebook/Instagram"],
        "hooks": ["Scroll-stopping hooks"],
        "formats": ["static_image", "carousel", "video_short", "reels"],
        "exampleAds": ["Example ad descriptions"]
      }
    },
    "linkedin": {
      "Segment Name": {
        "angles": ["Professional angles for LinkedIn"],
        "hooks": ["Business-focused hooks"],
        "formats": ["sponsored_content", "carousel", "video"],
        "exampleAds": ["Example ad descriptions"]
      }
    }
  },
  "campaignConceptsExtended": [
    {
      "name": "Campaign name",
      "insight": "Audience insight",
      "concept": "Creative concept",
      "exampleAds": ["Ad descriptions"],
      "channels": ["Channels"],
      "measurement": ["Metrics"],
      "testingPlan": {
        "hypotheses": ["What we believe will happen"],
        "variants": [
          {
            "name": "Control",
            "description": "Current approach",
            "hypothesis": "Baseline performance"
          },
          {
            "name": "Variant A",
            "description": "Test variation",
            "hypothesis": "Expected improvement and why"
          }
        ],
        "metrics": ["primary: conversions", "secondary: CTR", "guardrail: CPA"],
        "targetKPIs": {
          "CTR": "+15% vs control",
          "conversion_rate": "+10% vs control"
        },
        "sampleSize": "1000 conversions per variant",
        "duration": "2-4 weeks"
      }
    }
  ],
  "testingRoadmap": [
    {
      "id": "test_1",
      "name": "Test name",
      "description": "What we're testing and why",
      "campaignConceptName": "Linked campaign (optional)",
      "channel": "meta",
      "segment": "Primary ICP (optional)",
      "priority": "high",
      "status": "planned",
      "expectedImpact": "Expected improvement in key metrics",
      "effort": "M",
      "dependsOn": [],
      "hypotheses": ["If we do X, then Y will happen because Z"],
      "successMetrics": ["CTR > 2%", "CPA < $50"]
    }
  ],
  "assetSpecs": [
    {
      "id": "asset_1",
      "campaignConceptName": "Campaign this asset supports",
      "channel": "meta",
      "assetType": "static_image",
      "specs": {
        "dimensions": "1080x1080",
        "fileFormat": "JPG/PNG",
        "maxFileSize": "30MB"
      },
      "copySlots": [
        {
          "name": "primary_text",
          "maxChars": 125,
          "suggestedCopy": "Suggested primary text",
          "alternatives": ["Alt 1", "Alt 2"]
        },
        {
          "name": "headline",
          "maxChars": 40,
          "suggestedCopy": "Headline copy"
        },
        {
          "name": "cta",
          "suggestedCopy": "Learn More"
        }
      ],
      "visualNotes": "Visual direction for this asset",
      "territoryName": "Authority",
      "segment": "Enterprise CTOs",
      "priority": "high",
      "status": "brief"
    }
  ]
}

ADDITIONAL GUIDELINES FOR EXTENDED OUTPUT:
1. Create channelPatterns for EACH provided channel (from Media context)
2. Each campaignConceptExtended MUST have a testingPlan
3. testingRoadmap should have 3-5 prioritized tests
4. assetSpecs should include 2-3 production-ready briefs per campaign
5. IDs should be unique (test_1, test_2, asset_1, asset_2, etc.)`;

  const guidelines = `

GUIDELINES:
1. Create 2-4 creative territories that offer distinct conceptual spaces
2. Create 2-3 campaign concepts that bring territories to life
3. Segment messages must be created for EACH audience segment provided
4. All content must be specific and actionable, not generic
5. Headlines should be punchy and attention-grabbing
6. CTAs should drive specific actions aligned with objectives
7. Testing roadmap should prioritize high-impact experiments`;

  return basePrompt + (extended ? extendedOutput : basicOutput) + guidelines;
}

/**
 * Build the user prompt with context
 */
function buildUserPrompt(context: CreativeLabContext, extended: boolean = false): string {
  const formattedContext = formatContextForLLM(context);

  // Build segment list for segment messages
  const segmentNames = context.audienceSegments.map((s) => s.name);

  // Build channel list for extended output
  const activeChannels = context.media.channelRecommendations || [];
  const topChannels = context.media.topPerformingChannels || [];
  const allChannels = [...new Set([...activeChannels, ...topChannels])];

  let prompt = `Generate a complete creative strategy for this company:

${formattedContext}

${segmentNames.length > 0 ? `\n## Audience Segments to Target\nCreate segment-specific messaging for each of these segments:\n${segmentNames.map((s) => `- ${s}`).join('\n')}` : ''}`;

  if (extended && allChannels.length > 0) {
    prompt += `

## Active Media Channels
Generate channel-specific patterns for these channels:
${allChannels.map((c) => `- ${c}`).join('\n')}

${context.media.mediaMaturity ? `Media Maturity: ${context.media.mediaMaturity}` : ''}
${context.objectives.budgetRange ? `Budget Range: ${context.objectives.budgetRange}` : ''}`;
  }

  prompt += `

Based on this context, generate a comprehensive creative strategy system.

Remember:
- Do NOT change the brand positioning or ICP
- All creative must serve the defined audience segments
- Align all recommendations with the stated business objectives
- Be specific and actionable, not generic`;

  if (extended) {
    prompt += `
- Generate channel patterns for ALL provided channels
- Include testing plans for each campaign concept
- Create a prioritized testing roadmap
- Generate production-ready asset specs`;
  }

  return prompt;
}

// ============================================================================
// Main Run Function
// ============================================================================

/**
 * Options for running Creative Lab
 */
export interface RunCreativeLabOptions {
  /** Generate extended output with channel patterns, testing, and asset specs */
  extended?: boolean;
}

/**
 * Run the Creative Lab to generate creative strategy
 *
 * @param context - Creative Lab context loaded from Context Graph
 * @param options - Run options (extended mode, etc.)
 * @returns Creative Lab run result with output or error
 */
export async function runCreativeLab(
  context: CreativeLabContext,
  options: RunCreativeLabOptions = {}
): Promise<CreativeLabRunResult> {
  const { extended = false } = options;
  const runId = `creative_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const runAt = new Date().toISOString();

  // Determine if we should run extended mode based on available context
  const hasMediaContext = Boolean(
    context.media.channelRecommendations?.length ||
    context.media.topPerformingChannels?.length
  );
  const shouldRunExtended = extended && hasMediaContext;

  console.log('[CreativeLab] Starting run:', runId, {
    companyId: context.companyId,
    canRunHighConfidence: context.readiness.canRunHighConfidence,
    segmentCount: context.audienceSegments.length,
    extended: shouldRunExtended,
    hasMediaContext,
  });

  // Check readiness
  if (!context.readiness.canRunHighConfidence) {
    console.warn('[CreativeLab] Missing critical data:', context.readiness.missingCritical);
    // Still allow run but with lower confidence
  }

  // Determine confidence based on readiness
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (context.readiness.canRunHighConfidence && context.readiness.hasAudienceSegments) {
    confidence = 'high';
  } else if (context.readiness.hasICP || context.readiness.hasBrandPillars) {
    confidence = 'medium';
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = buildSystemPrompt(shouldRunExtended);
    const userPrompt = buildUserPrompt(context, shouldRunExtended);

    console.log('[CreativeLab] Calling OpenAI...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: shouldRunExtended ? 16000 : 8000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('[CreativeLab] Parsing and validating response...');

    // Parse and validate
    const parsed = JSON.parse(content);

    if (shouldRunExtended) {
      // Validate extended output
      const validated = CreativeLabExtendedOutputSchema.parse(parsed);

      console.log('[CreativeLab] Successfully generated extended creative strategy:', {
        runId,
        territoryCount: validated.creativeTerritories.length,
        conceptCount: validated.campaignConcepts.length,
        conceptsExtendedCount: validated.campaignConceptsExtended.length,
        segmentMessageCount: Object.keys(validated.segmentMessages).length,
        channelPatternCount: Object.keys(validated.channelPatterns).length,
        testingRoadmapCount: validated.testingRoadmap.length,
        assetSpecCount: validated.assetSpecs.length,
      });

      return {
        success: true,
        output: validated,
        outputExtended: validated,
        confidence,
        runId,
        runAt,
        hasExtendedOutput: true,
      };
    } else {
      // Validate basic output
      const validated = CreativeLabOutputSchema.parse(parsed);

      console.log('[CreativeLab] Successfully generated creative strategy:', {
        runId,
        territoryCount: validated.creativeTerritories.length,
        conceptCount: validated.campaignConcepts.length,
        segmentMessageCount: Object.keys(validated.segmentMessages).length,
      });

      return {
        success: true,
        output: validated,
        confidence,
        runId,
        runAt,
        hasExtendedOutput: false,
      };
    }
  } catch (error) {
    console.error('[CreativeLab] Run failed:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation failed: ${error.errors.map((e) => e.message).join(', ')}`,
        confidence: 'low',
        runId,
        runAt,
        hasExtendedOutput: false,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Creative Lab run failed',
      confidence: 'low',
      runId,
      runAt,
      hasExtendedOutput: false,
    };
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that Creative Lab can run with high confidence
 *
 * Returns validation result with specific feedback
 */
export function validateCreativeLabReadiness(context: CreativeLabContext): {
  canRun: boolean;
  canRunHighConfidence: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Critical requirements
  if (!context.readiness.hasICP) {
    issues.push('No ICP / Target Audience defined');
    suggestions.push('Complete the ICP section in Setup to define your target audience');
  }

  if (!context.readiness.hasBrandPillars) {
    issues.push('No Brand positioning / value props defined');
    suggestions.push('Complete the Brand section in Setup to define positioning and value props');
  }

  // Recommended but not required
  if (!context.readiness.hasAudienceSegments) {
    suggestions.push('Run Audience Lab to create detailed audience segments for better targeting');
  }

  if (!context.readiness.hasObjectives) {
    suggestions.push('Define business objectives to help align creative with goals');
  }

  if (context.audienceSegments.length === 0) {
    suggestions.push('Add audience segments for segment-specific messaging');
  }

  return {
    canRun: true, // Always allow run
    canRunHighConfidence: context.readiness.canRunHighConfidence,
    issues,
    suggestions,
  };
}

/**
 * Regenerate specific parts of the creative strategy
 */
export async function regenerateCreativeSection(
  context: CreativeLabContext,
  section: 'messaging' | 'territories' | 'concepts' | 'guidelines',
  existingOutput: CreativeLabOutput
): Promise<CreativeLabRunResult> {
  const runId = `creative_regen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const runAt = new Date().toISOString();

  console.log('[CreativeLab] Regenerating section:', section, runId);

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build section-specific prompt
    const sectionPrompts: Record<string, string> = {
      messaging: 'Regenerate only the messaging architecture (coreValueProp, supportingPoints, proofPoints, differentiators)',
      territories: 'Regenerate only the creative territories (name, theme, visualDirection, tone, exampleHeadlines, formats)',
      concepts: 'Regenerate only the campaign concepts (name, insight, concept, exampleAds, channels, measurement)',
      guidelines: 'Regenerate only the guidelines (voice, tone, visual, testingRoadmap)',
    };

    const systemPrompt = buildSystemPrompt();
    const userPrompt = `${buildUserPrompt(context)}

SPECIAL INSTRUCTION: ${sectionPrompts[section]}

Keep all other sections the same as provided below:
${JSON.stringify(existingOutput, null, 2)}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8, // Slightly higher for variation
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    const parsed = JSON.parse(content);
    const validated = CreativeLabOutputSchema.parse(parsed);

    return {
      success: true,
      output: validated,
      confidence: context.readiness.canRunHighConfidence ? 'high' : 'medium',
      runId,
      runAt,
      hasExtendedOutput: false,
    };
  } catch (error) {
    console.error('[CreativeLab] Regeneration failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Regeneration failed',
      confidence: 'low',
      runId,
      runAt,
      hasExtendedOutput: false,
    };
  }
}
