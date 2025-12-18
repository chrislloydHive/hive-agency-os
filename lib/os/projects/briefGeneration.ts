// lib/os/projects/briefGeneration.ts
// Creative brief generation logic
//
// Generates creative briefs from project strategy using AI.
// Captures source snapshot for traceability.

import Anthropic from '@anthropic-ai/sdk';
import { getProjectById } from '@/lib/airtable/projects';
import {
  getProjectStrategyById,
  getProjectStrategyByProjectId,
} from '@/lib/airtable/projectStrategies';
import {
  createCreativeBrief,
  updateBriefContent,
  createBriefVersion,
  getCreativeBriefByProjectId,
} from '@/lib/airtable/creativeBriefs';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { validateGapReadiness } from './gapGating';
import { getAcceptedBets, calculateStrategyReadiness } from '@/lib/types/projectStrategy';
import type { ProjectType } from '@/lib/types/engagement';
import type { ProjectStrategy, ProjectStrategicFrame } from '@/lib/types/projectStrategy';
import type {
  CreativeBrief,
  BriefContent,
  BriefSourceSnapshot,
  PrintAdBriefContent,
  GenerateBriefResponse,
} from '@/lib/types/creativeBrief';

// ============================================================================
// Types
// ============================================================================

export interface GenerateBriefInput {
  projectId: string;
  mode: 'create' | 'replace' | 'improve';
  guidance?: string;
}

export interface BriefGenerationContext {
  projectType: ProjectType;
  projectName: string;
  strategy: ProjectStrategy;
  companyContext: Record<string, unknown>;
  gapReportId: string;
  gapScore?: number;
}

// ============================================================================
// Source Snapshot
// ============================================================================

/**
 * Create a source snapshot from current strategy state
 * This is frozen at generation time for traceability
 */
export function createSourceSnapshot(
  strategy: ProjectStrategy,
  companyContext: Record<string, unknown>,
  gapReportId: string,
  gapScore?: number
): BriefSourceSnapshot {
  const acceptedBets = getAcceptedBets(strategy);

  return {
    projectStrategyId: strategy.id,
    strategySnapshotAt: new Date().toISOString(),
    projectStrategyFrame: { ...strategy.strategicFrame },
    objectives: strategy.objectives.map(o => ({
      id: o.id,
      text: o.text,
      metric: o.metric,
      target: o.target,
    })),
    acceptedBets: acceptedBets.map(bet => ({
      id: bet.id,
      title: bet.title,
      intent: bet.intent,
      pros: [...bet.pros],
      cons: [...bet.cons],
      tradeoffs: [...bet.tradeoffs],
    })),
    companyContextHash: undefined, // TODO: Add hash computation
    companyName: companyContext.companyName as string | undefined,
    companyAudience: companyContext.audience as string | undefined,
    companyValueProp: companyContext.valueProp as string | undefined,
    gapReportId,
    gapScore,
    inputHashes: {
      // TODO: Add hash computation for staleness detection
    },
  };
}

// ============================================================================
// Brief Generation
// ============================================================================

/**
 * Validate that brief generation is allowed
 */
async function validateBriefGeneration(
  projectId: string
): Promise<{ valid: boolean; context?: BriefGenerationContext; error?: string }> {
  // 1. Get project
  const project = await getProjectById(projectId);
  if (!project) {
    return { valid: false, error: 'Project not found' };
  }

  // 2. Validate GAP readiness
  const gapResult = await validateGapReadiness(project.companyId);
  if (!gapResult.ready) {
    return { valid: false, error: gapResult.blockedReason || 'Full GAP required' };
  }

  // 3. Get project strategy
  const strategy = await getProjectStrategyByProjectId(projectId);
  if (!strategy) {
    return { valid: false, error: 'Project strategy not found' };
  }

  // 4. Validate strategy readiness
  const strategyReadiness = calculateStrategyReadiness(strategy);
  if (!strategyReadiness.ready) {
    return { valid: false, error: strategyReadiness.blockedReason || 'Strategy not ready' };
  }

  // 5. Load company context
  const contextGraph = await loadContextGraph(project.companyId);
  // Extract relevant context from the graph's domains
  const companyContext: Record<string, unknown> = contextGraph
    ? {
        identity: contextGraph.identity,
        brand: contextGraph.brand,
        audience: contextGraph.audience,
        productOffer: contextGraph.productOffer,
        creative: contextGraph.creative,
      }
    : {};

  return {
    valid: true,
    context: {
      projectType: project.type,
      projectName: project.name,
      strategy,
      companyContext,
      gapReportId: gapResult.gapReportId!,
      gapScore: gapResult.gapScore,
    },
  };
}

/**
 * Generate creative brief content using AI
 */
async function generateBriefContentWithAI(
  context: BriefGenerationContext,
  guidance?: string,
  existingContent?: BriefContent
): Promise<BriefContent> {
  const anthropic = new Anthropic();

  const acceptedBets = getAcceptedBets(context.strategy);

  const systemPrompt = `You are a senior creative strategist helping to write creative briefs.
Generate a structured creative brief based on the project strategy and company context provided.

Your output must be valid JSON matching the brief schema for project type: ${context.projectType}

Be concise but comprehensive. Focus on actionable direction for creative teams.`;

  const userPrompt = `Generate a creative brief for the following project:

PROJECT TYPE: ${context.projectType}
PROJECT NAME: ${context.projectName}

STRATEGIC FRAME:
${JSON.stringify(context.strategy.strategicFrame, null, 2)}

OBJECTIVES:
${context.strategy.objectives.map(o => `- ${o.text}${o.metric ? ` (${o.metric}: ${o.target})` : ''}`).join('\n')}

ACCEPTED STRATEGIC BETS:
${acceptedBets.map(bet => `- ${bet.title}: ${bet.intent}
  Pros: ${bet.pros.join(', ')}
  Cons: ${bet.cons.join(', ')}
  Tradeoffs: ${bet.tradeoffs.join(', ')}`).join('\n\n')}

COMPANY CONTEXT:
${JSON.stringify(context.companyContext, null, 2)}

${guidance ? `ADDITIONAL GUIDANCE:\n${guidance}` : ''}

${existingContent ? `EXISTING BRIEF (improve this):\n${JSON.stringify(existingContent, null, 2)}` : ''}

Generate a complete creative brief in JSON format. For a ${context.projectType} project, include all required fields.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      { role: 'user', content: userPrompt },
    ],
    system: systemPrompt,
  });

  // Extract JSON from response
  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in AI response');
  }

  // Parse JSON from response (may be wrapped in markdown code block)
  let jsonText = textContent.text;
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  }

  const generatedContent = JSON.parse(jsonText.trim()) as BriefContent;

  // Ensure projectType is set correctly
  return {
    ...generatedContent,
    projectType: context.projectType,
    projectName: context.projectName,
  } as BriefContent;
}

/**
 * Generate a creative brief for a project
 */
export async function generateCreativeBrief(
  input: GenerateBriefInput
): Promise<GenerateBriefResponse | { error: string }> {
  try {
    // 1. Validate generation is allowed
    const validation = await validateBriefGeneration(input.projectId);
    if (!validation.valid || !validation.context) {
      return { error: validation.error || 'Validation failed' };
    }

    const { context } = validation;

    // 2. Get existing brief for improve mode
    let existingBrief: CreativeBrief | null = null;
    if (input.mode === 'improve' || input.mode === 'replace') {
      existingBrief = await getCreativeBriefByProjectId(input.projectId);
    }

    // 3. Generate content with AI
    const content = await generateBriefContentWithAI(
      context,
      input.guidance,
      input.mode === 'improve' ? existingBrief?.content : undefined
    );

    // 4. Create source snapshot
    const sourceSnapshot = createSourceSnapshot(
      context.strategy,
      context.companyContext,
      context.gapReportId,
      context.gapScore
    );

    // 5. Create or update brief
    let brief: CreativeBrief | null;

    if (input.mode === 'create' || !existingBrief) {
      // Get project for companyId
      const project = await getProjectById(input.projectId);
      if (!project) {
        return { error: 'Project not found' };
      }

      brief = await createCreativeBrief({
        companyId: project.companyId,
        projectId: input.projectId,
        projectType: context.projectType,
        title: `${context.projectName} Creative Brief`,
        content,
        sourceSnapshot,
      });
    } else if (input.mode === 'replace') {
      // Create new version
      brief = await createBriefVersion(
        existingBrief.id,
        content,
        sourceSnapshot
      );
    } else {
      // Improve - update existing
      brief = await updateBriefContent(existingBrief.id, content);
    }

    if (!brief) {
      return { error: 'Failed to save brief' };
    }

    // 6. Return response
    return {
      brief,
      reasoning: 'Brief generated based on project strategy and company context.',
      inputsUsed: {
        projectStrategy: true,
        companyContext: true,
        gapReport: true,
        acceptedBetsCount: getAcceptedBets(context.strategy).length,
      },
      inputsUsedBadges: ['GAP', 'Context', 'Frame', 'Objectives', 'Bets'],
    };
  } catch (error) {
    console.error('[BriefGeneration] Failed to generate brief:', error);
    return { error: error instanceof Error ? error.message : 'Brief generation failed' };
  }
}

// ============================================================================
// Field-Level AI Helper
// ============================================================================

export interface BriefFieldAIInput {
  projectId: string;
  fieldPath: string;
  currentValue?: string;
  action: 'suggest' | 'refine' | 'shorten' | 'expand' | 'variants';
  guidance?: string;
}

export interface BriefFieldAIResult {
  value?: string;
  variants?: string[];
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
}

/**
 * AI helper for individual brief fields
 */
export async function aiHelperForBriefField(
  input: BriefFieldAIInput
): Promise<BriefFieldAIResult | { error: string }> {
  try {
    // Get context
    const validation = await validateBriefGeneration(input.projectId);
    if (!validation.valid || !validation.context) {
      return { error: validation.error || 'Validation failed' };
    }

    const { context } = validation;
    const anthropic = new Anthropic();

    const actionPrompts: Record<string, string> = {
      suggest: 'Generate a suggested value for this field.',
      refine: 'Improve and refine the current value.',
      shorten: 'Make the current value more concise while preserving meaning.',
      expand: 'Expand on the current value with more detail.',
      variants: 'Generate 3 alternative versions of this field.',
    };

    const systemPrompt = `You are a creative strategist helping to write creative briefs.
${actionPrompts[input.action]}

For the field "${input.fieldPath}", provide ${input.action === 'variants' ? 'exactly 3 alternative versions' : 'a single improved value'}.
Output JSON with ${input.action === 'variants' ? '"variants": [...]' : '"value": "..."'} and "reasoning" fields.`;

    const userPrompt = `PROJECT: ${context.projectName} (${context.projectType})

STRATEGIC CONTEXT:
- Objective: ${context.strategy.strategicFrame.projectObjective || 'Not set'}
- Audience: ${context.strategy.strategicFrame.targetAudience || 'Not set'}
- Core Message: ${context.strategy.strategicFrame.coreMessage || 'Not set'}

FIELD: ${input.fieldPath}
CURRENT VALUE: ${input.currentValue || '(empty)'}

${input.guidance ? `GUIDANCE: ${input.guidance}` : ''}

${input.action === 'variants' ? 'Generate 3 distinct alternatives.' : actionPrompts[input.action]}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return { error: 'No response from AI' };
    }

    // Parse JSON response
    let jsonText = textContent.text;
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const result = JSON.parse(jsonText.trim());

    return {
      value: result.value,
      variants: result.variants,
      confidence: 'high',
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error('[BriefGeneration] Field AI helper failed:', error);
    return { error: error instanceof Error ? error.message : 'AI helper failed' };
  }
}
