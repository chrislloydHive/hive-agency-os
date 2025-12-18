// lib/os/briefs/generation.ts
// AI-powered brief generation
//
// AI Prompting (HARD CONSTRAINTS):
// - Pass Context and GAP as separate blocks
// - Instruction must include:
//   "Respect context, optimize against GAP"
//   "Use accepted bets as the decision layer"
//   "Do not add recommendations not supported by bets"
// - Output must be strict JSON matching schema
// - Reject unknown keys or paragraph advice

import Anthropic from '@anthropic-ai/sdk';
import { validateBriefGeneration, type BriefValidationResult } from './validation';
import { loadBriefInputs, buildGenerationContext, deriveCoreSuggestions, type MappedBriefInputs } from './inputMapping';
import { parseAndValidateBriefResponse } from './schemas';
import {
  createBrief,
  updateBrief,
  getBriefById,
} from '@/lib/airtable/briefs';
import type {
  Brief,
  BriefType,
  BriefCore,
  BriefExtension,
  BriefTraceability,
  BriefGenerationMode,
  CreativeCampaignExtension,
  SeoExtension,
  ContentExtension,
  WebsiteExtension,
} from '@/lib/types/brief';
import { createEmptyExtension } from '@/lib/types/brief';

// ============================================================================
// Types
// ============================================================================

export interface GenerateBriefResult {
  success: boolean;
  brief?: Brief;
  error?: string;
  inputsUsed?: {
    contextUsed: boolean;
    gapUsed: boolean;
    betsUsed: boolean;
  };
}

interface AIGeneratedBrief {
  core: BriefCore;
  extension: BriefExtension;
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate a brief using AI
 *
 * @param companyId - Company ID
 * @param engagementId - Engagement ID (optional - briefs are project/work-centric)
 * @param projectId - Project ID
 * @param workItemId - Work item ID (for prescribed work briefs)
 * @param type - Brief type
 * @param mode - Generation mode (create, replace, improve)
 * @param guidance - Optional user guidance for generation
 */
export async function generateBrief(
  companyId: string,
  engagementId: string | undefined,
  projectId: string | undefined,
  workItemId: string | undefined,
  type: BriefType,
  mode: BriefGenerationMode,
  guidance?: string
): Promise<GenerateBriefResult> {
  // 1. Validate requirements
  const validation = await validateBriefGeneration({
    companyId,
    projectId,
    type,
  });

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || 'Brief generation validation failed',
    };
  }

  // 2. Load and map inputs
  const inputs = await loadBriefInputs(companyId, projectId);
  const context = buildGenerationContext(inputs);

  // 3. Get existing brief if mode is replace/improve
  let existingBrief: Brief | null = null;
  if (mode !== 'create' && projectId) {
    const { getBriefByProjectId } = await import('@/lib/airtable/briefs');
    existingBrief = await getBriefByProjectId(projectId);
  }

  // 4. Generate brief content using AI
  let generatedContent: AIGeneratedBrief;
  try {
    generatedContent = await generateBriefContent(
      type,
      inputs,
      mode,
      existingBrief,
      guidance
    );
  } catch (error) {
    console.error('[BriefGeneration] AI generation failed:', error);
    return {
      success: false,
      error: 'Failed to generate brief content. Please try again.',
    };
  }

  // 5. Build traceability
  const traceability: BriefTraceability = {
    sourceContextSnapshotId: inputs.traceability.contextSnapshotId,
    sourceGapRunId: inputs.traceability.gapRunId,
    sourceStrategicBetIds: inputs.traceability.strategicBetIds,
    inputHashes: {
      contextHash: hashString(JSON.stringify(inputs.contextInputs)),
      gapHash: hashString(JSON.stringify(inputs.gapInputs)),
      betsHash: hashString(JSON.stringify(inputs.betInputs)),
    },
  };

  // 6. Create or update brief
  let brief: Brief | null;

  if (mode === 'create' || !existingBrief) {
    // Create new brief - engagementId is optional, briefs are project/work-centric
    brief = await createBrief({
      companyId,
      engagementId, // Optional
      projectId,
      workItemId,
      title: generateBriefTitle(type, inputs),
      type,
    });

    if (brief) {
      brief = await updateBrief(brief.id, {
        core: generatedContent.core,
        extension: generatedContent.extension,
        traceability,
        status: 'draft',
      });
    }
  } else {
    // Update existing brief
    brief = await updateBrief(existingBrief.id, {
      core: generatedContent.core,
      extension: generatedContent.extension,
      traceability,
      status: 'draft',
    });
  }

  if (!brief) {
    return {
      success: false,
      error: 'Failed to save brief. Please try again.',
    };
  }

  return {
    success: true,
    brief,
    inputsUsed: {
      contextUsed: !!inputs.contextInputs.targetAudience,
      gapUsed: inputs.gapInputs.primaryBlockers.length > 0,
      betsUsed: inputs.betInputs.acceptedBets.length > 0,
    },
  };
}

// ============================================================================
// AI Generation
// ============================================================================

/**
 * Generate brief content using AI with Zod validation and auto-retry
 */
async function generateBriefContent(
  type: BriefType,
  inputs: MappedBriefInputs,
  mode: BriefGenerationMode,
  existingBrief: Brief | null,
  guidance?: string
): Promise<AIGeneratedBrief> {
  const anthropic = new Anthropic();

  // Build system prompt
  const systemPrompt = buildSystemPrompt(type);

  // Build user prompt with inputs
  const userPrompt = buildUserPrompt(type, inputs, mode, existingBrief, guidance);

  // First attempt
  let responseText = await callAI(anthropic, systemPrompt, userPrompt);
  let validationResult = parseAndValidateBriefResponse(type, responseText);

  // If first attempt fails, retry once with correction prompt
  if (!validationResult.success) {
    console.warn('[BriefGeneration] First attempt failed, retrying with correction prompt:', validationResult.error);

    const correctionPrompt = `Your previous response was invalid: ${validationResult.error}

Fix this JSON to match the schema exactly. Return ONLY valid JSON. No markdown, no commentary, no explanation.

Previous response that failed:
${responseText}

Return the corrected JSON object only:`;

    responseText = await callAI(anthropic, systemPrompt, correctionPrompt);
    validationResult = parseAndValidateBriefResponse(type, responseText);

    // If still fails, throw structured error
    if (!validationResult.success) {
      console.error('[BriefGeneration] Retry also failed:', validationResult.error);
      throw new BriefGenerationError(
        'AI_VALIDATION_FAILED',
        'Failed to generate valid brief',
        `AI returned invalid JSON after retry: ${validationResult.error}`,
        validationResult.stage === 'schema_validation' ? validationResult.issues : undefined
      );
    }
  }

  return {
    core: validationResult.data.core as BriefCore,
    extension: validationResult.data.extension as BriefExtension,
  };
}

/**
 * Call AI and extract text response
 */
async function callAI(
  anthropic: Anthropic,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/**
 * Custom error class for brief generation failures
 */
class BriefGenerationError extends Error {
  constructor(
    public code: string,
    public title: string,
    message: string,
    public issues?: unknown[]
  ) {
    super(message);
    this.name = 'BriefGenerationError';
  }
}

/**
 * Build system prompt for brief generation
 */
function buildSystemPrompt(type: BriefType): string {
  return `You are a strategic marketing brief writer for a B2B marketing agency.

Your task is to generate a structured brief that will guide all subsequent work.

CRITICAL RULES (NON-NEGOTIABLE):
1. RESPECT CONTEXT - Use the provided context as factual constraints
2. OPTIMIZE AGAINST GAP - Address the identified problems and opportunities
3. USE ACCEPTED BETS AS THE DECISION LAYER - The strategic bets are the decisions that have been made. Do not contradict them.
4. DO NOT ADD RECOMMENDATIONS NOT SUPPORTED BY BETS - Only include what is justified by the accepted strategic bets

OUTPUT FORMAT (STRICTLY ENFORCED):
- Return ONLY valid JSON
- No markdown code blocks
- No commentary or explanation
- No text before or after the JSON
- The JSON must match the exact schema below

Brief Type: ${type}

You must output a JSON object with this exact structure:
{
  "core": {
    "objective": "What this brief aims to achieve",
    "targetAudience": "Who this work is for",
    "problemToSolve": "The key problem this work addresses",
    "singleMindedFocus": "The single most important focus/message",
    "constraints": ["Array of constraints and limitations"],
    "successDefinition": "How we'll know this worked",
    "assumptions": ["Array of assumptions we're making"]
  },
  "extension": {
    ${getExtensionSchemaForType(type)}
  }
}

Output ONLY the JSON object. No other text.`;
}

/**
 * Get extension schema description for a brief type
 */
function getExtensionSchemaForType(type: BriefType): string {
  switch (type) {
    case 'creative':
    case 'campaign':
      return `"keyMessage": "The primary message to communicate",
    "supportingMessages": ["Messages that reinforce the key message"],
    "visualDirection": "Visual style guidance",
    "tone": "Tone of voice",
    "cta": "Call to action",
    "mandatories": ["Required elements"],
    "formatSpecs": {"size": "", "dimensions": "", "colorMode": "", "channels": []}`;

    case 'seo':
      return `"searchIntent": "Primary search intent to target",
    "priorityTopics": ["Topics to focus on"],
    "keywordThemes": ["Keyword themes and clusters"],
    "technicalConstraints": ["Technical requirements"],
    "measurementWindow": "Window for measuring results"`;

    case 'content':
      return `"contentPillars": ["Pillars to build around"],
    "journeyStage": "Customer journey stage",
    "cadence": "Publishing cadence",
    "distributionChannels": ["Where content will be distributed"]`;

    case 'website':
      return `"primaryUserFlows": ["User flows to design for"],
    "conversionGoals": ["Conversion objectives"],
    "informationArchitectureNotes": "IA notes",
    "cmsConstraints": "CMS requirements"`;

    default:
      return `"notes": "Additional notes"`;
  }
}

/**
 * Build user prompt with all inputs
 */
function buildUserPrompt(
  type: BriefType,
  inputs: MappedBriefInputs,
  mode: BriefGenerationMode,
  existingBrief: Brief | null,
  guidance?: string
): string {
  const sections: string[] = [];

  // Mode instruction
  if (mode === 'improve' && existingBrief) {
    sections.push(`MODE: Improve the existing brief. Make it stronger while preserving the core direction.

EXISTING BRIEF:
${JSON.stringify({ core: existingBrief.core, extension: existingBrief.extension }, null, 2)}`);
  } else if (mode === 'replace' && existingBrief) {
    sections.push(`MODE: Replace the existing brief with a fresh perspective. You may diverge significantly.`);
  } else {
    sections.push(`MODE: Create a new brief from scratch.`);
  }

  // Context block
  sections.push(`
=== CONTEXT (Respect as factual constraints) ===

Target Audience:
${inputs.contextInputs.targetAudience || 'Not specified'}

Brand Attributes:
${inputs.contextInputs.brandAttributes || 'Not specified'}

Operational Constraints:
${inputs.contextInputs.constraints.length > 0 ? inputs.contextInputs.constraints.join('\n') : 'None specified'}

Capabilities:
${inputs.contextInputs.capabilities.length > 0 ? inputs.contextInputs.capabilities.join('\n') : 'Not specified'}`);

  // GAP block
  sections.push(`
=== GAP ANALYSIS (Optimize against these) ===

Primary Blockers to Address:
${inputs.gapInputs.primaryBlockers.length > 0 ? inputs.gapInputs.primaryBlockers.map((b, i) => `${i + 1}. ${b}`).join('\n') : 'None identified'}

Ranked Opportunities:
${inputs.gapInputs.rankedOpportunities.length > 0 ? inputs.gapInputs.rankedOpportunities.map((o, i) => `${i + 1}. ${o}`).join('\n') : 'None identified'}

Blind Spots/Uncertainties:
${inputs.gapInputs.blindSpots.length > 0 ? inputs.gapInputs.blindSpots.join('\n') : 'None identified'}

Data Confidence Level: ${inputs.gapInputs.confidenceLevel}%`);

  // Strategic Bets block (DECISION LAYER)
  sections.push(`
=== STRATEGIC BETS (Decision layer - ONLY these guide the brief) ===

${inputs.betInputs.acceptedBets.length > 0
    ? inputs.betInputs.acceptedBets.map((bet, i) => `
BET ${i + 1}: ${bet.title}
Intent: ${bet.intent}
Pros: ${bet.pros.join(', ') || 'None listed'}
Cons: ${bet.cons.join(', ') || 'None listed'}
Tradeoffs: ${bet.tradeoffs.join(', ') || 'None listed'}
${bet.scope ? `Scope: ${bet.scope}` : ''}
${bet.exclusions && bet.exclusions.length > 0 ? `Exclusions: ${bet.exclusions.join(', ')}` : ''}
`).join('\n')
    : 'WARNING: No accepted strategic bets. Brief will be limited.'}`);

  // User guidance
  if (guidance) {
    sections.push(`
=== USER GUIDANCE ===
${guidance}`);
  }

  // Final instruction
  sections.push(`
Generate the ${type} brief as a JSON object following the exact schema provided.
Remember: ONLY use what is supported by the accepted strategic bets.`);

  return sections.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a title for the brief
 */
function generateBriefTitle(type: BriefType, inputs: MappedBriefInputs): string {
  const primaryBet = inputs.betInputs.acceptedBets[0];
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

  if (primaryBet) {
    return `${typeLabel} Brief: ${primaryBet.title}`;
  }

  return `${typeLabel} Brief - ${new Date().toLocaleDateString()}`;
}

/**
 * Simple hash function for change detection
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
