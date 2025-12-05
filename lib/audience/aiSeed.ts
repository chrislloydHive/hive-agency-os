// lib/audience/aiSeed.ts
// AI-powered Audience Model seeding
//
// Generates an initial audience model by analyzing signals from
// various diagnostics and data sources using AI.

import OpenAI from 'openai';
import { z } from 'zod';
import {
  AudienceModel,
  AudienceSegment,
  DemandState,
  createEmptyAudienceModel,
} from './model';
import {
  AudienceSignals,
  CanonicalICP,
  formatSignalsForAiPrompt,
  hasMinimalSignalsForSeeding,
} from './signals';
import { MediaChannelId, MEDIA_CHANNEL_LABELS } from '@/lib/contextGraph/enums';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of AI seeding
 */
export interface AISeedResult {
  success: boolean;
  model?: AudienceModel;
  error?: string;
  confidence: 'high' | 'medium' | 'low';
  signalsUsed: string[];

  /** Whether a canonical ICP was used to constrain generation */
  hasCanonicalICP: boolean;

  /** The canonical ICP description used (if any) */
  canonicalAudienceDescription?: string;

  /** Whether the ICP was inferred (no canonical ICP found) */
  isProvisionalICP: boolean;
}

/**
 * Raw segment from AI response (before validation)
 */
interface RawAISegment {
  name: string;
  description?: string;
  jobsToBeDone?: string[];
  keyPains?: string[];
  keyGoals?: string[];
  primaryDemandState?: string;
  secondaryDemandStates?: string[];
  demographics?: string;
  geos?: string;
  behavioralDrivers?: string[];
  mediaHabits?: string;
  keyObjections?: string[];
  proofPointsNeeded?: string[];
  priorityChannels?: string[];
  avoidChannels?: string[];
  creativeAngles?: string[];
  recommendedFormats?: string[];
  priority?: 'primary' | 'secondary' | 'tertiary';
  estimatedSize?: string;
}

// ============================================================================
// AI Prompt Building
// ============================================================================

/**
 * Build the system prompt for audience model generation
 *
 * IMPORTANT: The prompt changes based on whether a canonical ICP exists:
 * - With ICP: AI must DECOMPOSE the ICP into segments (not change it)
 * - Without ICP: AI can infer from website signals (provisional)
 */
function buildSystemPrompt(canonicalICP: CanonicalICP): string {
  const demandStates = ['unaware', 'problem_aware', 'solution_aware', 'in_market', 'post_purchase'];
  const channelIds = Object.keys(MEDIA_CHANNEL_LABELS).slice(0, 15).join(', ');

  // Core constraint based on whether ICP exists
  let icpConstraint: string;

  if (canonicalICP.hasCanonicalICP) {
    icpConstraint = `
⚠️ CRITICAL CONSTRAINT - CANONICAL ICP DEFINED ⚠️

This company has a DEFINED Ideal Customer Profile (ICP) that you MUST respect:

${canonicalICP.primaryAudience || 'See audience details in the data below.'}

YOUR JOB IS TO DECOMPOSE THIS ICP INTO 2-5 SEGMENTS/PERSONAS.
- You MUST NOT change, broaden, or ignore this ICP
- You MUST NOT invent new audiences outside this ICP
- Each segment you create MUST fit within this canonical ICP
- Think of your segments as sub-groups or variations within this defined audience

For example, if the ICP is "Small business owners aged 35-55 in the US", valid segments would be:
- "Growth-focused SMB owners" (subset of ICP)
- "Risk-averse established business owners" (subset of ICP)

INVALID would be:
- "Enterprise executives" (outside ICP)
- "Young consumers" (outside ICP)
`;
  } else {
    icpConstraint = `
NOTE: No canonical ICP is defined for this company.

You will INFER a provisional target audience from the available signals (website content, diagnostics, etc.).
Your segments should represent a reasonable interpretation of who this company serves.

Since this is inferred, your confidence should be lower and your segments should be more exploratory.
`;
  }

  return `You are an expert marketing strategist AI. Your task is to analyze business and marketing signals to propose audience segments.
${icpConstraint}

Based on the provided data (GAP analysis, Brand analysis, Content analysis, SEO analysis, Demand analysis, existing audience data, and Brain context), propose 2-5 distinct audience segments.

Each segment should be actionable for both Media planning and Creative development.

DEMAND STATES (use exactly these values):
${demandStates.map(s => `- ${s}`).join('\n')}

AVAILABLE CHANNEL IDS (for priorityChannels and avoidChannels):
${channelIds}
(And others like: social_tiktok, youtube, ctv_ott, radio, podcast, direct_mail, affiliate, etc.)

Output your response as valid JSON matching this exact structure:
{
  "overallDescription": "Brief summary of the audience landscape",
  "canonicalAudienceDescription": "Echo the canonical ICP if provided, or state your inferred ICP if not",
  "isProvisionalICP": ${!canonicalICP.hasCanonicalICP},
  "segments": [
    {
      "name": "Segment name (clear, actionable)",
      "description": "2-3 sentence description of who this segment is",
      "jobsToBeDone": ["Job 1", "Job 2"],
      "keyPains": ["Pain 1", "Pain 2"],
      "keyGoals": ["Goal 1", "Goal 2"],
      "primaryDemandState": "one of: unaware, problem_aware, solution_aware, in_market, post_purchase",
      "secondaryDemandStates": ["other demand states they may also be in"],
      "demographics": "Age, income, family status, etc.",
      "geos": "Geographic focus or constraints",
      "behavioralDrivers": ["What drives their behavior"],
      "mediaHabits": "Where they consume media",
      "keyObjections": ["Common objections to address"],
      "proofPointsNeeded": ["What proof/evidence they need"],
      "priorityChannels": ["channel_ids to prioritize"],
      "avoidChannels": ["channel_ids to avoid"],
      "creativeAngles": ["Messaging angles that resonate"],
      "recommendedFormats": ["Content formats: UGC, explainer, carousel, etc."],
      "priority": "primary|secondary|tertiary",
      "estimatedSize": "Large|Medium|Small or descriptive"
    }
  ]
}

Guidelines:
- Create 2-5 segments based on data richness
- Each segment should be distinct and actionable
- Use specific data from the signals to inform each segment
${canonicalICP.hasCanonicalICP ? '- ALL segments MUST fit within the canonical ICP - do not expand beyond it' : '- Infer a reasonable target audience from available signals'}
- Jobs to be done should be functional, emotional, or social
- Demand states should reflect where in the buying journey they are
- Channel recommendations should align with media habits
- Creative angles should address objections and speak to goals
- Be specific, not generic - use insights from the actual data`;
}

/**
 * Build the user prompt with signals data
 */
function buildUserPrompt(signals: AudienceSignals, companyName?: string): string {
  const signalsText = formatSignalsForAiPrompt(signals);

  const intro = companyName
    ? `Analyze the following signals for ${companyName} and propose audience segments:`
    : 'Analyze the following signals and propose audience segments:';

  return `${intro}

${signalsText}

Based on this data, propose 3-7 distinct audience segments.`;
}

// ============================================================================
// Main Seeding Function
// ============================================================================

/**
 * Generate an audience model from signals using AI
 *
 * IMPORTANT: This function now respects canonical ICP from Context Graph.
 * - If canonicalICP.hasCanonicalICP is true, AI will DECOMPOSE the ICP into segments
 * - If no ICP is defined, AI will INFER a provisional ICP from signals
 *
 * @param companyId - The company ID
 * @param signals - Audience signals from diagnostics (includes canonicalICP)
 * @param options - Optional configuration
 * @returns AI seed result with model or error
 */
export async function seedAudienceModelFromSignals(
  companyId: string,
  signals: AudienceSignals,
  options?: {
    companyName?: string;
    createdBy?: string;
  }
): Promise<AISeedResult> {
  console.log('[AudienceSeed] Starting AI seeding for:', companyId, {
    hasCanonicalICP: signals.canonicalICP.hasCanonicalICP,
    icpSource: signals.canonicalICP.source,
  });

  // Check if we have enough data
  if (!hasMinimalSignalsForSeeding(signals)) {
    return {
      success: false,
      error: 'Insufficient signals for AI seeding. Run more diagnostics first.',
      confidence: 'low',
      signalsUsed: [],
      hasCanonicalICP: signals.canonicalICP.hasCanonicalICP,
      isProvisionalICP: !signals.canonicalICP.hasCanonicalICP,
    };
  }

  // Track which signals we're using
  const signalsUsed: string[] = [];
  if (signals.canonicalICP.hasCanonicalICP) signalsUsed.push('Canonical ICP');
  if (signals.sourcesAvailable.gap) signalsUsed.push('GAP Analysis');
  if (signals.sourcesAvailable.brand) signalsUsed.push('Brand Lab');
  if (signals.sourcesAvailable.content) signalsUsed.push('Content Lab');
  if (signals.sourcesAvailable.seo) signalsUsed.push('SEO Lab');
  if (signals.sourcesAvailable.demand) signalsUsed.push('Demand Lab');
  if (signals.sourcesAvailable.contextGraph) signalsUsed.push('Context Graph');
  if (signals.sourcesAvailable.brain) signalsUsed.push('Brain');

  // Determine confidence based on data richness
  // Higher confidence when we have a canonical ICP
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (signals.canonicalICP.hasCanonicalICP) {
    // With ICP, confidence is based on ICP quality + additional signals
    confidence = signalsUsed.length >= 3 ? 'high' : 'medium';
  } else {
    // Without ICP, confidence is lower (provisional)
    if (signalsUsed.length >= 4) {
      confidence = 'medium';
    } else if (signalsUsed.length >= 2) {
      confidence = 'low';
    }
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build prompts with ICP constraint
    const systemPrompt = buildSystemPrompt(signals.canonicalICP);
    const userPrompt = buildUserPrompt(signals, options?.companyName);

    console.log('[AudienceSeed] Calling OpenAI...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: signals.canonicalICP.hasCanonicalICP ? 0.5 : 0.7, // Lower temp for ICP decomposition
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('[AudienceSeed] Parsing AI response...');

    const parsed = JSON.parse(content) as {
      overallDescription?: string;
      canonicalAudienceDescription?: string;
      isProvisionalICP?: boolean;
      segments: RawAISegment[];
    };

    // Validate and transform segments
    const validatedSegments = validateAndTransformSegments(parsed.segments);

    if (validatedSegments.length === 0) {
      throw new Error('AI generated no valid segments');
    }

    // Create the model
    const now = new Date().toISOString();
    const isProvisional = !signals.canonicalICP.hasCanonicalICP;
    const icpDescription = signals.canonicalICP.hasCanonicalICP
      ? signals.canonicalICP.primaryAudience
      : parsed.canonicalAudienceDescription;

    const model: AudienceModel = {
      id: `am_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId,
      version: 1,
      updatedAt: now,
      createdAt: now,
      createdBy: options?.createdBy,
      description: parsed.overallDescription || 'AI-generated audience model',
      segments: validatedSegments,
      notes: isProvisional
        ? `⚠️ PROVISIONAL: No canonical ICP defined. Generated from ${signalsUsed.length} sources: ${signalsUsed.join(', ')}`
        : `Anchored to canonical ICP. Generated from ${signalsUsed.length} sources: ${signalsUsed.join(', ')}`,
      source: 'ai_seeded',
      isCurrentCanonical: false,
    };

    console.log('[AudienceSeed] Successfully generated model with', validatedSegments.length, 'segments', {
      hasCanonicalICP: signals.canonicalICP.hasCanonicalICP,
      isProvisional,
    });

    return {
      success: true,
      model,
      confidence,
      signalsUsed,
      hasCanonicalICP: signals.canonicalICP.hasCanonicalICP,
      canonicalAudienceDescription: icpDescription,
      isProvisionalICP: isProvisional,
    };
  } catch (error) {
    console.error('[AudienceSeed] AI seeding failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI seeding failed',
      confidence: 'low',
      signalsUsed,
      hasCanonicalICP: signals.canonicalICP.hasCanonicalICP,
      isProvisionalICP: !signals.canonicalICP.hasCanonicalICP,
    };
  }
}

// ============================================================================
// Validation and Transformation
// ============================================================================

/**
 * Validate and transform raw AI segments into proper AudienceSegment objects
 */
function validateAndTransformSegments(rawSegments: RawAISegment[]): AudienceSegment[] {
  const validSegments: AudienceSegment[] = [];

  for (const raw of rawSegments) {
    try {
      // Skip segments without a name
      if (!raw.name || typeof raw.name !== 'string') {
        console.warn('[AudienceSeed] Skipping segment without name');
        continue;
      }

      const segment: AudienceSegment = {
        id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: raw.name.trim(),
        description: raw.description?.trim(),
        jobsToBeDone: ensureStringArray(raw.jobsToBeDone),
        keyPains: ensureStringArray(raw.keyPains),
        keyGoals: ensureStringArray(raw.keyGoals),
        primaryDemandState: validateDemandState(raw.primaryDemandState),
        secondaryDemandStates: ensureStringArray(raw.secondaryDemandStates)
          .map(validateDemandState)
          .filter((d): d is DemandState => d !== undefined),
        demographics: raw.demographics?.trim(),
        geos: raw.geos?.trim(),
        behavioralDrivers: ensureStringArray(raw.behavioralDrivers),
        mediaHabits: raw.mediaHabits?.trim(),
        keyObjections: ensureStringArray(raw.keyObjections),
        proofPointsNeeded: ensureStringArray(raw.proofPointsNeeded),
        priorityChannels: validateChannelIds(raw.priorityChannels),
        avoidChannels: validateChannelIds(raw.avoidChannels),
        creativeAngles: ensureStringArray(raw.creativeAngles),
        recommendedFormats: ensureStringArray(raw.recommendedFormats),
        priority: validatePriority(raw.priority),
        estimatedSize: raw.estimatedSize?.trim(),
      };

      validSegments.push(segment);
    } catch (error) {
      console.warn('[AudienceSeed] Failed to validate segment:', error);
      continue;
    }
  }

  return validSegments;
}

/**
 * Ensure a value is a string array
 */
function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Validate a demand state value
 */
function validateDemandState(value: unknown): DemandState | undefined {
  const validStates: DemandState[] = [
    'unaware',
    'problem_aware',
    'solution_aware',
    'in_market',
    'post_purchase',
  ];

  if (typeof value !== 'string') return undefined;

  const normalized = value.toLowerCase().trim().replace(/[- ]/g, '_');
  if (validStates.includes(normalized as DemandState)) {
    return normalized as DemandState;
  }

  return undefined;
}

/**
 * Validate channel IDs
 */
function validateChannelIds(values: unknown): MediaChannelId[] {
  if (!Array.isArray(values)) return [];

  const validIds = Object.keys(MEDIA_CHANNEL_LABELS) as MediaChannelId[];
  const result: MediaChannelId[] = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.toLowerCase().trim().replace(/[- ]/g, '_');

    // Direct match
    if (validIds.includes(normalized as MediaChannelId)) {
      result.push(normalized as MediaChannelId);
      continue;
    }

    // Try mapping common variations
    const mappings: Record<string, MediaChannelId> = {
      'google_search': 'search_google',
      'google': 'search_google',
      'bing': 'search_bing',
      'meta': 'social_meta',
      'facebook': 'social_meta',
      'instagram': 'social_meta',
      'tiktok': 'social_tiktok',
      'linkedin': 'social_linkedin',
      'pinterest': 'social_pinterest',
      'twitter': 'social_x',
      'x': 'social_x',
      'google_maps': 'maps_gbp',
      'gbp': 'maps_gbp',
      'local_services': 'lsa',
      'email': 'email_sms',
      'sms': 'email_sms',
    };

    if (mappings[normalized]) {
      result.push(mappings[normalized]);
    }
  }

  return result;
}

/**
 * Validate priority value
 */
function validatePriority(value: unknown): 'primary' | 'secondary' | 'tertiary' | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'primary' || normalized === 'secondary' || normalized === 'tertiary') {
    return normalized;
  }
  return undefined;
}

// ============================================================================
// Single Segment Expansion
// ============================================================================

/**
 * Result of AI segment expansion
 */
export interface AIExpandSegmentResult {
  success: boolean;
  segment?: AudienceSegment;
  error?: string;
}

/**
 * Expand a single segment from a seed description using AI
 *
 * User provides a brief description like "older men interested in car audio"
 * and AI fleshes it out into a complete segment.
 *
 * @param seed - Brief description of the segment
 * @param context - Optional context about the company/industry
 * @returns Expanded segment
 */
export async function expandSegmentFromSeed(
  seed: string,
  context?: {
    companyName?: string;
    industry?: string;
    existingSegments?: string[]; // Names of existing segments to avoid overlap
  }
): Promise<AIExpandSegmentResult> {
  console.log('[AudienceSeed] Expanding segment from seed:', seed);

  if (!seed || seed.trim().length < 5) {
    return {
      success: false,
      error: 'Please provide a more detailed description (at least a few words)',
    };
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = buildExpandSegmentSystemPrompt();
    const userPrompt = buildExpandSegmentUserPrompt(seed, context);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    const parsed = JSON.parse(content) as RawAISegment;

    // Validate and transform
    const segments = validateAndTransformSegments([parsed]);
    if (segments.length === 0) {
      throw new Error('AI generated an invalid segment');
    }

    console.log('[AudienceSeed] Successfully expanded segment:', segments[0].name);

    return {
      success: true,
      segment: segments[0],
    };
  } catch (error) {
    console.error('[AudienceSeed] Segment expansion failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to expand segment',
    };
  }
}

/**
 * Build system prompt for single segment expansion
 */
function buildExpandSegmentSystemPrompt(): string {
  const demandStates = ['unaware', 'problem_aware', 'solution_aware', 'in_market', 'post_purchase'];
  const channelIds = Object.keys(MEDIA_CHANNEL_LABELS).slice(0, 15).join(', ');

  return `You are an expert marketing strategist AI. Your task is to expand a brief audience segment description into a fully detailed segment profile.

Given a seed description (e.g., "older men interested in car audio"), create a comprehensive segment with actionable details for Media planning and Creative development.

DEMAND STATES (use exactly these values):
${demandStates.map(s => `- ${s}`).join('\n')}

AVAILABLE CHANNEL IDS (for priorityChannels and avoidChannels):
${channelIds}
(And others like: social_tiktok, youtube, ctv_ott, radio, podcast, direct_mail, affiliate, etc.)

Output your response as valid JSON matching this exact structure:
{
  "name": "Segment name (clear, specific, actionable - 2-4 words)",
  "description": "2-3 sentence description expanding on who this segment is",
  "jobsToBeDone": ["Job 1", "Job 2", "Job 3"],
  "keyPains": ["Pain 1", "Pain 2", "Pain 3"],
  "keyGoals": ["Goal 1", "Goal 2", "Goal 3"],
  "primaryDemandState": "one of: unaware, problem_aware, solution_aware, in_market, post_purchase",
  "secondaryDemandStates": ["other relevant demand states"],
  "demographics": "Detailed demographics: age range, income, family status, occupation, etc.",
  "geos": "Geographic focus or 'National' if broadly applicable",
  "behavioralDrivers": ["What drives their behavior and decisions"],
  "mediaHabits": "Where they consume media - platforms, times, formats, devices",
  "keyObjections": ["Common objections they might have"],
  "proofPointsNeeded": ["What proof/evidence they need to convert"],
  "priorityChannels": ["channel_ids to prioritize for reaching them"],
  "avoidChannels": ["channel_ids that won't work well"],
  "creativeAngles": ["Messaging angles that will resonate"],
  "recommendedFormats": ["Content formats: UGC, explainer, testimonial, etc."],
  "priority": "primary|secondary|tertiary",
  "estimatedSize": "Large|Medium|Small with context"
}

Guidelines:
- Create a realistic, specific segment based on the seed
- Fill in ALL fields with thoughtful, actionable content
- Jobs to be done should be functional, emotional, or social
- Demand state should reflect where they likely are in the buying journey
- Channel recommendations should match their media habits
- Creative angles should address their specific pains and goals
- Be specific, not generic - make the segment feel real and actionable`;
}

/**
 * Build user prompt for single segment expansion
 */
function buildExpandSegmentUserPrompt(
  seed: string,
  context?: {
    companyName?: string;
    industry?: string;
    existingSegments?: string[];
  }
): string {
  let prompt = `Expand this audience segment seed into a complete, detailed segment profile:

"${seed}"`;

  if (context?.companyName || context?.industry) {
    prompt += `\n\nContext:`;
    if (context.companyName) {
      prompt += `\n- Company: ${context.companyName}`;
    }
    if (context.industry) {
      prompt += `\n- Industry: ${context.industry}`;
    }
  }

  if (context?.existingSegments && context.existingSegments.length > 0) {
    prompt += `\n\nExisting segments (avoid overlap):
${context.existingSegments.map(s => `- ${s}`).join('\n')}`;
  }

  prompt += `\n\nCreate a comprehensive segment profile based on this seed.`;

  return prompt;
}

// ============================================================================
// Regeneration
// ============================================================================

/**
 * Regenerate an audience model with new AI seeding
 *
 * Creates a new version of the model with fresh AI-generated segments,
 * optionally preserving user-edited segments.
 */
export async function regenerateAudienceModel(
  existingModel: AudienceModel,
  signals: AudienceSignals,
  options?: {
    companyName?: string;
    createdBy?: string;
    preserveEdited?: boolean; // If true, keep segments that were manually edited
  }
): Promise<AISeedResult> {
  const result = await seedAudienceModelFromSignals(
    existingModel.companyId,
    signals,
    options
  );

  if (!result.success || !result.model) {
    return result;
  }

  // Update the model metadata
  result.model.version = existingModel.version + 1;
  result.model.source = 'mixed'; // Regenerated models are considered mixed

  return result;
}
