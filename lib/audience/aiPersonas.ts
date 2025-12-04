// lib/audience/aiPersonas.ts
// AI-powered Persona generation from Audience Models
//
// Generates human-centered personas by analyzing audience segments,
// behavioral drivers, and demand states. Personas are optimized for
// creative briefing and media planning.

import OpenAI from 'openai';
import {
  Persona,
  PersonaSet,
  createEmptyPersonaSet,
} from './personas';
import { AudienceModel, AudienceSegment } from './model';
import { MEDIA_CHANNEL_LABELS } from '@/lib/contextGraph/enums';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of AI persona generation
 */
export interface AIPersonaResult {
  success: boolean;
  personaSet?: PersonaSet;
  error?: string;
  confidence: 'high' | 'medium' | 'low';
  segmentsUsed: string[];
}

/**
 * Raw persona from AI response (before validation)
 */
interface RawAIPersona {
  name: string;
  tagline?: string;
  linkedSegmentNames?: string[];
  oneSentenceSummary?: string;
  backstory?: string;
  dayInTheLife?: string;
  jobsToBeDone?: string[];
  triggers?: string[];
  objections?: string[];
  decisionFactors?: string[];
  demandState?: string;
  mediaHabits?: string;
  channelsToUse?: string[];
  channelsToAvoid?: string[];
  contentFormatsPreferred?: string[];
  keyMessages?: string[];
  proofPoints?: string[];
  exampleHooks?: string[];
  toneGuidance?: string;
  priority?: 'primary' | 'secondary' | 'tertiary';
}

// ============================================================================
// AI Prompt Building
// ============================================================================

/**
 * Build the system prompt for persona generation
 */
function buildSystemPrompt(): string {
  const channelExamples = Object.keys(MEDIA_CHANNEL_LABELS).slice(0, 10).join(', ');

  return `You are an expert marketing strategist and creative brief writer. Your task is to create vivid, human-centered personas from audience segments.

These personas will be used for:
1. Creative briefing - to help creatives understand who they're speaking to
2. Media planning - to guide channel selection and targeting
3. Content strategy - to inform content themes and formats
4. Campaign development - to align messaging with audience needs

For each persona, create a compelling human character that brings the audience segment to life. Use specific details, realistic scenarios, and actionable insights.

PERSONA REQUIREMENTS:
- Each persona should represent 1-3 related segments
- Create 3-7 personas (fewer for narrow audiences, more for diverse markets)
- Make each persona distinct and memorable
- Include both functional and emotional drivers
- Provide specific, actionable media and creative guidance
- Use natural, conversational language

OUTPUT FORMAT (JSON):
{
  "personas": [
    {
      "name": "A memorable first name + descriptor (e.g., 'Budget-Conscious Brad', 'Enterprise Emma')",
      "tagline": "A catchy 5-8 word summary of who this person is",
      "linkedSegmentNames": ["Segment 1", "Segment 2"],
      "oneSentenceSummary": "One sentence capturing their core situation and need",
      "backstory": "2-3 paragraphs about their life, work, and how they came to need this product/service",
      "dayInTheLife": "What a typical day looks like, including when/how they might encounter the brand",
      "jobsToBeDone": ["Functional job 1", "Emotional job 2", "Social job 3"],
      "triggers": ["What prompts them to start looking for a solution"],
      "objections": ["Their hesitations and concerns about purchasing"],
      "decisionFactors": ["What they weigh when making a decision"],
      "demandState": "Where they are in the journey: unaware, problem_aware, solution_aware, in_market, post_purchase",
      "mediaHabits": "Where and how they consume media throughout their day",
      "channelsToUse": ["search_google", "social_meta", "youtube", "etc."],
      "channelsToAvoid": ["Channels that won't reach them effectively"],
      "contentFormatsPreferred": ["Video", "UGC", "Testimonials", "How-to guides", "etc."],
      "keyMessages": ["Core messages that will resonate with this persona"],
      "proofPoints": ["Types of proof/evidence they need to believe claims"],
      "exampleHooks": ["Attention-grabbing headlines or hooks for this persona"],
      "toneGuidance": "How to speak to this persona - formal/casual, technical/simple, aspirational/practical",
      "priority": "primary|secondary|tertiary"
    }
  ]
}

AVAILABLE CHANNELS (for channelsToUse/channelsToAvoid):
${channelExamples}, and more...

GUIDELINES:
- Make backstories feel real - include specific details about their situation
- Day in the life should show natural touchpoints for the brand
- Jobs should include functional (what they need to accomplish), emotional (how they want to feel), and social (how they want to be perceived)
- Triggers should be specific events or realizations
- Objections should be real concerns, not strawmen
- Example hooks should be ready-to-use copy that would grab attention
- Be specific and actionable - avoid generic marketing-speak`;
}

/**
 * Build the user prompt with audience model data
 */
function buildUserPrompt(model: AudienceModel, companyContext?: string): string {
  const segmentDescriptions = model.segments.map(seg => {
    const parts = [
      `### ${seg.name}`,
      seg.description ? `Description: ${seg.description}` : '',
      seg.primaryDemandState ? `Demand State: ${seg.primaryDemandState}` : '',
      seg.demographics ? `Demographics: ${seg.demographics}` : '',
      seg.jobsToBeDone?.length ? `Jobs to be done: ${seg.jobsToBeDone.join('; ')}` : '',
      seg.keyPains?.length ? `Key pains: ${seg.keyPains.join('; ')}` : '',
      seg.keyGoals?.length ? `Key goals: ${seg.keyGoals.join('; ')}` : '',
      seg.behavioralDrivers?.length ? `Behavioral drivers: ${seg.behavioralDrivers.join('; ')}` : '',
      seg.keyObjections?.length ? `Objections: ${seg.keyObjections.join('; ')}` : '',
      seg.mediaHabits ? `Media habits: ${seg.mediaHabits}` : '',
      seg.creativeAngles?.length ? `Creative angles: ${seg.creativeAngles.join('; ')}` : '',
      seg.priority ? `Priority: ${seg.priority}` : '',
    ].filter(Boolean);

    return parts.join('\n');
  }).join('\n\n');

  const contextBlock = companyContext
    ? `\n\nCOMPANY CONTEXT:\n${companyContext}`
    : '';

  return `Based on the following audience segments, create 3-7 vivid, human-centered personas for marketing and creative briefing.
${contextBlock}

AUDIENCE MODEL: ${model.description || 'Untitled Model'}

SEGMENTS:
${segmentDescriptions}

Create personas that bring these segments to life as real people. Each persona should link to one or more segments and provide specific, actionable guidance for creative and media teams.`;
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate personas from an audience model using AI
 *
 * @param model - The audience model with segments
 * @param options - Optional configuration
 * @returns AI persona generation result
 */
export async function generatePersonasFromAudienceModel(
  model: AudienceModel,
  options?: {
    companyContext?: string;
    createdBy?: string;
  }
): Promise<AIPersonaResult> {
  console.log('[AIPersonas] Starting persona generation for model:', model.id);

  // Validate we have segments to work with
  if (!model.segments || model.segments.length === 0) {
    return {
      success: false,
      error: 'No segments in audience model. Add segments before generating personas.',
      confidence: 'low',
      segmentsUsed: [],
    };
  }

  const segmentsUsed = model.segments.map(s => s.name);

  // Determine confidence based on segment richness
  const richSegments = model.segments.filter(s =>
    s.jobsToBeDone?.length || s.behavioralDrivers?.length || s.keyPains?.length
  );

  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (richSegments.length >= model.segments.length * 0.7) {
    confidence = 'high';
  } else if (richSegments.length >= model.segments.length * 0.3) {
    confidence = 'medium';
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(model, options?.companyContext);

    console.log('[AIPersonas] Calling OpenAI...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8, // Slightly higher for creative writing
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('[AIPersonas] Parsing AI response...');

    const parsed = JSON.parse(content) as {
      personas: RawAIPersona[];
    };

    // Validate and transform personas
    const validatedPersonas = validateAndTransformPersonas(
      parsed.personas,
      model.segments
    );

    if (validatedPersonas.length === 0) {
      throw new Error('AI generated no valid personas');
    }

    // Create the persona set
    const now = new Date().toISOString();
    const personaSet: PersonaSet = {
      id: `pset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      companyId: model.companyId,
      audienceModelId: model.id,
      createdAt: now,
      updatedAt: now,
      personas: validatedPersonas,
      version: 1,
      source: 'ai_seeded',
      notes: `Generated from ${segmentsUsed.length} segments: ${segmentsUsed.join(', ')}`,
    };

    console.log('[AIPersonas] Successfully generated', validatedPersonas.length, 'personas');

    return {
      success: true,
      personaSet,
      confidence,
      segmentsUsed,
    };
  } catch (error) {
    console.error('[AIPersonas] Persona generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Persona generation failed',
      confidence: 'low',
      segmentsUsed,
    };
  }
}

// ============================================================================
// Validation and Transformation
// ============================================================================

/**
 * Validate and transform raw AI personas into proper Persona objects
 */
function validateAndTransformPersonas(
  rawPersonas: RawAIPersona[],
  segments: AudienceSegment[]
): Persona[] {
  const validPersonas: Persona[] = [];
  const now = new Date().toISOString();

  // Create a map of segment names to IDs for linking
  const segmentNameToId = new Map<string, string>();
  segments.forEach(seg => {
    segmentNameToId.set(seg.name.toLowerCase(), seg.id);
  });

  for (const raw of rawPersonas) {
    try {
      // Skip personas without a name
      if (!raw.name || typeof raw.name !== 'string') {
        console.warn('[AIPersonas] Skipping persona without name');
        continue;
      }

      // Link to segment IDs based on names
      const linkedSegmentIds: string[] = [];
      if (raw.linkedSegmentNames) {
        for (const segName of raw.linkedSegmentNames) {
          const normalizedName = segName.toLowerCase().trim();
          // Try exact match first
          if (segmentNameToId.has(normalizedName)) {
            linkedSegmentIds.push(segmentNameToId.get(normalizedName)!);
          } else {
            // Try partial match
            for (const [name, id] of segmentNameToId) {
              if (name.includes(normalizedName) || normalizedName.includes(name)) {
                linkedSegmentIds.push(id);
                break;
              }
            }
          }
        }
      }

      const persona: Persona = {
        id: `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: raw.name.trim(),
        tagline: raw.tagline?.trim(),
        linkedSegmentIds,
        oneSentenceSummary: raw.oneSentenceSummary?.trim(),
        backstory: raw.backstory?.trim(),
        dayInTheLife: raw.dayInTheLife?.trim(),
        jobsToBeDone: ensureStringArray(raw.jobsToBeDone),
        triggers: ensureStringArray(raw.triggers),
        objections: ensureStringArray(raw.objections),
        decisionFactors: ensureStringArray(raw.decisionFactors),
        demandState: raw.demandState?.trim(),
        mediaHabits: raw.mediaHabits?.trim(),
        channelsToUse: ensureStringArray(raw.channelsToUse),
        channelsToAvoid: ensureStringArray(raw.channelsToAvoid),
        contentFormatsPreferred: ensureStringArray(raw.contentFormatsPreferred),
        keyMessages: ensureStringArray(raw.keyMessages),
        proofPoints: ensureStringArray(raw.proofPoints),
        exampleHooks: ensureStringArray(raw.exampleHooks),
        toneGuidance: raw.toneGuidance?.trim(),
        priority: validatePriority(raw.priority),
        updatedAt: now,
        createdAt: now,
      };

      validPersonas.push(persona);
    } catch (error) {
      console.warn('[AIPersonas] Failed to validate persona:', error);
      continue;
    }
  }

  return validPersonas;
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
// Regeneration
// ============================================================================

/**
 * Regenerate personas with new AI generation
 *
 * Creates a new version of the persona set with fresh AI-generated personas.
 */
export async function regeneratePersonas(
  existingSet: PersonaSet,
  model: AudienceModel,
  options?: {
    companyContext?: string;
    createdBy?: string;
  }
): Promise<AIPersonaResult> {
  const result = await generatePersonasFromAudienceModel(model, options);

  if (!result.success || !result.personaSet) {
    return result;
  }

  // Update the set metadata
  result.personaSet.id = existingSet.id; // Keep the same ID
  result.personaSet.version = existingSet.version + 1;
  result.personaSet.source = 'mixed'; // Regenerated sets are considered mixed

  return result;
}

// ============================================================================
// Single Persona Generation
// ============================================================================

/**
 * Generate a single persona for a specific segment
 */
export async function generatePersonaForSegment(
  segment: AudienceSegment,
  companyId: string,
  options?: {
    companyContext?: string;
    existingPersonaNames?: string[]; // To avoid duplicate names
  }
): Promise<{ success: boolean; persona?: Persona; error?: string }> {
  console.log('[AIPersonas] Generating single persona for segment:', segment.name);

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const avoidNames = options?.existingPersonaNames?.length
      ? `\n\nIMPORTANT: Do NOT use these names (already taken): ${options.existingPersonaNames.join(', ')}`
      : '';

    const prompt = `Create a single vivid, human-centered persona for this audience segment:

SEGMENT: ${segment.name}
${segment.description ? `Description: ${segment.description}` : ''}
${segment.demographics ? `Demographics: ${segment.demographics}` : ''}
${segment.jobsToBeDone?.length ? `Jobs: ${segment.jobsToBeDone.join('; ')}` : ''}
${segment.keyPains?.length ? `Pains: ${segment.keyPains.join('; ')}` : ''}
${segment.behavioralDrivers?.length ? `Drivers: ${segment.behavioralDrivers.join('; ')}` : ''}
${segment.mediaHabits ? `Media habits: ${segment.mediaHabits}` : ''}
${options?.companyContext ? `\nCompany context: ${options.companyContext}` : ''}
${avoidNames}

Create ONE persona that brings this segment to life. Output as JSON with these fields:
- name, tagline, oneSentenceSummary, backstory, dayInTheLife
- jobsToBeDone, triggers, objections, decisionFactors
- demandState, mediaHabits, channelsToUse, channelsToAvoid, contentFormatsPreferred
- keyMessages, proofPoints, exampleHooks, toneGuidance`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating vivid marketing personas. Output valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    const raw = JSON.parse(content) as RawAIPersona;
    const now = new Date().toISOString();

    const persona: Persona = {
      id: `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: raw.name?.trim() || `${segment.name} Persona`,
      tagline: raw.tagline?.trim(),
      linkedSegmentIds: [segment.id],
      oneSentenceSummary: raw.oneSentenceSummary?.trim(),
      backstory: raw.backstory?.trim(),
      dayInTheLife: raw.dayInTheLife?.trim(),
      jobsToBeDone: ensureStringArray(raw.jobsToBeDone),
      triggers: ensureStringArray(raw.triggers),
      objections: ensureStringArray(raw.objections),
      decisionFactors: ensureStringArray(raw.decisionFactors),
      demandState: raw.demandState?.trim(),
      mediaHabits: raw.mediaHabits?.trim(),
      channelsToUse: ensureStringArray(raw.channelsToUse),
      channelsToAvoid: ensureStringArray(raw.channelsToAvoid),
      contentFormatsPreferred: ensureStringArray(raw.contentFormatsPreferred),
      keyMessages: ensureStringArray(raw.keyMessages),
      proofPoints: ensureStringArray(raw.proofPoints),
      exampleHooks: ensureStringArray(raw.exampleHooks),
      toneGuidance: raw.toneGuidance?.trim(),
      priority: undefined,
      updatedAt: now,
      createdAt: now,
    };

    return { success: true, persona };
  } catch (error) {
    console.error('[AIPersonas] Single persona generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Persona generation failed',
    };
  }
}
