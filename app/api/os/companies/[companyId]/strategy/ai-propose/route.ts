// app/api/os/companies/[companyId]/strategy/ai-propose/route.ts
// AI Strategy Proposal Endpoint (Draft-Only)
//
// IMPORTANT: AI never writes directly to Strategy.
// All outputs are proposals that require human approval.
//
// Supports:
// - propose_objectives: Generate objective suggestions
// - propose_strategy: Generate strategic priorities
// - propose_tactics: Generate tactical plays
// - improve_field: AI-assisted field improvement
// - improve_*: Refine existing items

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getActiveStrategy, getStrategyById } from '@/lib/os/strategy';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getStrategyInputs } from '@/lib/os/strategy/strategyInputs';
import { hydrateStrategyFrameFromContext } from '@/lib/os/strategy/strategyHydration';
import { computeHash } from '@/lib/types/strategyOrchestration';
import { saveDraft, type CreateDraftRequest, type DraftScopeType } from '@/lib/os/strategy/drafts';
import { computeAllHashes, type StrategyHashes } from '@/lib/os/strategy/hashes';
import type { StrategyObjective, StrategyPillar, StrategyPlay } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

type ProposalAction =
  | 'propose_objectives'
  | 'improve_objectives'
  | 'propose_strategy'
  | 'improve_strategy'
  | 'propose_tactics'
  | 'improve_tactics'
  | 'improve_field'
  | 'explain_tradeoffs'
  | 'generate_alternatives';

interface AIProposalRequest {
  action: ProposalAction;
  strategyId?: string;
  targetIds?: string[]; // For improve actions - which items to focus on
  additionalContext?: string;
  // For improve_field action
  fieldPath?: string;
  currentValue?: unknown;
  instructions?: string;
}

interface ObjectiveProposal {
  text: string;
  metric?: string;
  target?: string;
  timeframe?: string;
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
}

interface PriorityProposal {
  title: string;
  description: string;
  rationale: string;
  tradeoff: string;
  priority: 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
}

interface TacticProposal {
  title: string;
  description: string;
  priorityId?: string;
  channels: string[];
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
}

interface FieldImprovement {
  fieldPath: string;
  originalValue: unknown;
  improvedValue: unknown;
  rationale: string;
  diff?: string;
}

interface AIProposalResponse {
  action: ProposalAction;
  proposedAt: string;

  // Proposals (only one type populated based on action)
  objectives?: ObjectiveProposal[];
  priorities?: PriorityProposal[];
  tactics?: TacticProposal[];
  fieldImprovement?: FieldImprovement;
  tradeoffExplanation?: string;
  alternatives?: Array<{
    type: 'objective' | 'priority' | 'tactic';
    original: string;
    alternative: string;
    rationale: string;
  }>;

  // Metadata
  inputsUsed: string[];
  inputHashes?: {
    contextHash: string;
    objectivesHash: string;
    strategyHash: string | null;
  };
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];

  // IMPORTANT: Draft-only flag
  isDraft: true;
  requiresApproval: true;
}

// ============================================================================
// System Prompts
// ============================================================================

const OBJECTIVE_PROMPT = `You are a strategic marketing advisor. Generate marketing objectives based on the company context provided.

Each objective should:
- Be specific and measurable
- Have a clear metric and target when possible
- Be achievable within a reasonable timeframe
- Align with the company's positioning and capabilities

Return 3-5 objectives in JSON format:
{
  "objectives": [
    {
      "text": "objective statement",
      "metric": "KPI to measure",
      "target": "specific target (e.g., +25%)",
      "timeframe": "when to achieve",
      "rationale": "why this objective matters",
      "confidence": "high|medium|low"
    }
  ]
}`;

const STRATEGY_PROMPT = `You are a strategic marketing advisor. Generate Strategic Bets based on the company context and objectives provided.

A Strategic Bet is a clear commitment with an explicit tradeoff. Each bet should:
- Be a clear strategic choice (not an activity or tactic)
- Have an explicit tradeoff (what you're explicitly NOT doing)
- Include a clear intent (the expected outcome)
- Align with company positioning and constraints
- Be achievable with available resources

IMPORTANT: Do NOT include KPIs or metrics - those belong in Objectives only.

Return 3-5 strategic bets in JSON format:
{
  "priorities": [
    {
      "title": "bet name (what we're betting on)",
      "description": "the strategic intent - what outcome we expect",
      "rationale": "why this is a good strategic choice",
      "tradeoff": "what we're explicitly NOT doing to make this bet",
      "priority": "high|medium|low",
      "confidence": "high|medium|low"
    }
  ]
}`;

const TACTICS_PROMPT = `You are a tactical marketing advisor. Generate tactical plays to implement the Strategic Bets.

Each tactic should:
- Directly support one or more priorities
- Be actionable and specific
- Have a clear channel and approach
- Include impact and effort estimates

Return 4-8 tactics in JSON format:
{
  "tactics": [
    {
      "title": "tactic name",
      "description": "what this tactic involves",
      "priorityId": "priority this supports (optional)",
      "channels": ["seo", "content", "social", etc.],
      "impact": "high|medium|low",
      "effort": "high|medium|low",
      "rationale": "why this tactic will work",
      "confidence": "high|medium|low"
    }
  ]
}`;

const TRADEOFFS_PROMPT = `You are a strategic advisor explaining tradeoffs. Analyze the current strategy and explain:

1. What the strategy optimizes for
2. What the strategy explicitly sacrifices
3. Risks of this approach
4. When this strategy might need to change

Return a clear explanation of strategic tradeoffs.`;

const IMPROVE_FIELD_PROMPT = `You are a strategic marketing advisor helping improve a specific field value.

Given the current value and company context, suggest an improved version that is:
1. More specific and actionable
2. Better aligned with the company's context
3. Clearer and more compelling
4. Appropriately concise

Return your response in JSON format:
{
  "improvedValue": "The improved field value",
  "rationale": "Why this improvement is better (2-3 sentences)",
  "confidence": "high|medium|low"
}`;

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = (await request.json()) as AIProposalRequest;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    if (!body.action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Validate improve_field has required params
    if (body.action === 'improve_field' && !body.fieldPath) {
      return NextResponse.json(
        { error: 'fieldPath is required for improve_field action' },
        { status: 400 }
      );
    }

    // Load context and strategy
    const contextGraph = await loadContextGraph(companyId);
    const strategy = body.strategyId
      ? await getStrategyById(body.strategyId)
      : await getActiveStrategy(companyId);

    // Load strategy inputs
    let inputs = null;
    try {
      inputs = await getStrategyInputs(companyId);
    } catch (error) {
      console.warn('[ai-propose] Failed to load strategy inputs:', error);
    }

    // Hydrate frame
    const hydratedFrame = hydrateStrategyFrameFromContext(
      strategy?.strategyFrame,
      contextGraph
    );

    // Build context for AI - special handling for improve_field
    let contextForAI: string;
    if (body.action === 'improve_field') {
      contextForAI = buildImproveFieldContext({
        strategy,
        hydratedFrame,
        inputs,
        fieldPath: body.fieldPath!,
        currentValue: body.currentValue,
        instructions: body.instructions,
      });
    } else {
      contextForAI = buildContextForAI({
        strategy,
        hydratedFrame,
        inputs,
        additionalContext: body.additionalContext,
      });
    }

    // Get appropriate prompt
    const systemPrompt = getSystemPrompt(body.action);

    // Call AI
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: contextForAI,
        },
      ],
    });

    // Parse response
    const aiResponse = parseAIResponse(body.action, message, body.fieldPath, body.currentValue);

    // Compute input hashes for staleness tracking using proper hash functions
    const strategyHashes = computeAllHashes(
      contextGraph,
      strategy?.objectives || [],
      {
        title: strategy?.title,
        summary: strategy?.summary,
        pillars: strategy?.pillars,
        strategyFrame: strategy?.strategyFrame,
        tradeoffs: strategy?.tradeoffs,
      },
      strategy?.plays || []
    );

    const inputHashes = {
      contextHash: strategyHashes.contextHash,
      objectivesHash: strategyHashes.objectivesHash,
      strategyHash: strategyHashes.strategyHash,
    };

    // Save drafts to server-side storage for persistence
    const savedDraftIds: string[] = [];
    const strategyId = strategy?.id;

    if (strategyId) {
      try {
        // Save objectives as drafts
        if (aiResponse.objectives && aiResponse.objectives.length > 0) {
          for (let i = 0; i < aiResponse.objectives.length; i++) {
            const obj = aiResponse.objectives[i];
            const draft = await saveDraft({
              companyId,
              strategyId,
              scopeType: 'objective' as DraftScopeType,
              fieldKey: `text`,
              entityId: `proposed_${i}`,
              draftValue: JSON.stringify(obj),
              originalValue: undefined,
              rationale: [obj.rationale],
              confidence: obj.confidence || 'medium',
              sourcesUsed: getInputsUsed(inputs, contextGraph),
              basedOnHashes: {
                contextHash: strategyHashes.contextHash,
                objectivesHash: strategyHashes.objectivesHash,
              },
            });
            savedDraftIds.push(draft.id);
          }
        }

        // Save priorities as drafts
        if (aiResponse.priorities && aiResponse.priorities.length > 0) {
          for (let i = 0; i < aiResponse.priorities.length; i++) {
            const priority = aiResponse.priorities[i];
            const draft = await saveDraft({
              companyId,
              strategyId,
              scopeType: 'priority' as DraftScopeType,
              fieldKey: 'full',
              entityId: `proposed_${i}`,
              draftValue: JSON.stringify(priority),
              originalValue: undefined,
              rationale: [priority.rationale],
              confidence: priority.confidence || 'medium',
              sourcesUsed: getInputsUsed(inputs, contextGraph),
              basedOnHashes: {
                contextHash: strategyHashes.contextHash,
                objectivesHash: strategyHashes.objectivesHash,
                strategyHash: strategyHashes.strategyHash,
              },
            });
            savedDraftIds.push(draft.id);
          }
        }

        // Save tactics as drafts
        if (aiResponse.tactics && aiResponse.tactics.length > 0) {
          for (let i = 0; i < aiResponse.tactics.length; i++) {
            const tactic = aiResponse.tactics[i];
            const draft = await saveDraft({
              companyId,
              strategyId,
              scopeType: 'tactic' as DraftScopeType,
              fieldKey: 'full',
              entityId: `proposed_${i}`,
              draftValue: JSON.stringify(tactic),
              originalValue: undefined,
              rationale: [tactic.rationale],
              confidence: tactic.confidence || 'medium',
              sourcesUsed: getInputsUsed(inputs, contextGraph),
              basedOnHashes: {
                contextHash: strategyHashes.contextHash,
                strategyHash: strategyHashes.strategyHash,
                tacticsHash: strategyHashes.tacticsHash,
              },
            });
            savedDraftIds.push(draft.id);
          }
        }

        // Save field improvement as draft
        if (aiResponse.fieldImprovement && body.fieldPath) {
          const [scopeType, ...fieldParts] = body.fieldPath.split('.');
          const fieldKey = fieldParts.join('.');
          const draft = await saveDraft({
            companyId,
            strategyId,
            scopeType: (scopeType as DraftScopeType) || 'strategy',
            fieldKey: fieldKey || body.fieldPath,
            entityId: undefined,
            draftValue: typeof aiResponse.fieldImprovement.improvedValue === 'string'
              ? aiResponse.fieldImprovement.improvedValue
              : JSON.stringify(aiResponse.fieldImprovement.improvedValue),
            originalValue: typeof aiResponse.fieldImprovement.originalValue === 'string'
              ? aiResponse.fieldImprovement.originalValue
              : JSON.stringify(aiResponse.fieldImprovement.originalValue),
            rationale: [aiResponse.fieldImprovement.rationale],
            confidence: aiResponse.confidence || 'medium',
            sourcesUsed: getInputsUsed(inputs, contextGraph),
            basedOnHashes: {
              contextHash: strategyHashes.contextHash,
              strategyHash: strategyHashes.strategyHash,
            },
          });
          savedDraftIds.push(draft.id);
        }
      } catch (draftError) {
        console.warn('[ai-propose] Failed to save drafts:', draftError);
        // Continue without failing - drafts are best-effort
      }
    }

    // Build response
    const response: AIProposalResponse = {
      action: body.action,
      proposedAt: new Date().toISOString(),
      ...aiResponse,
      inputsUsed: getInputsUsed(inputs, contextGraph),
      inputHashes,
      confidence: aiResponse.confidence || 'medium',
      isDraft: true,
      requiresApproval: true,
    };

    // Add saved draft IDs to response for reference
    const responseWithDrafts = {
      ...response,
      savedDraftIds,
      basedOnHashes: strategyHashes,
    };

    return NextResponse.json(responseWithDrafts);
  } catch (error) {
    console.error('[POST /api/os/companies/[companyId]/strategy/ai-propose] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate proposal' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSystemPrompt(action: ProposalAction): string {
  switch (action) {
    case 'propose_objectives':
    case 'improve_objectives':
      return OBJECTIVE_PROMPT;
    case 'propose_strategy':
    case 'improve_strategy':
      return STRATEGY_PROMPT;
    case 'propose_tactics':
    case 'improve_tactics':
      return TACTICS_PROMPT;
    case 'improve_field':
      return IMPROVE_FIELD_PROMPT;
    case 'explain_tradeoffs':
    case 'generate_alternatives':
      return TRADEOFFS_PROMPT;
    default:
      return STRATEGY_PROMPT;
  }
}

function buildContextForAI(params: {
  strategy: any;
  hydratedFrame: any;
  inputs: any;
  additionalContext?: string;
}): string {
  const { strategy, hydratedFrame, inputs, additionalContext } = params;

  const sections: string[] = [];

  // Strategic Frame
  sections.push('## Strategic Frame');
  if (hydratedFrame.audience.value) {
    sections.push(`- Target Audience: ${hydratedFrame.audience.value}`);
  }
  if (hydratedFrame.offering.value) {
    sections.push(`- Primary Offering: ${hydratedFrame.offering.value}`);
  }
  if (hydratedFrame.valueProp.value) {
    sections.push(`- Value Proposition: ${hydratedFrame.valueProp.value}`);
  }
  if (hydratedFrame.positioning.value) {
    sections.push(`- Market Positioning: ${hydratedFrame.positioning.value}`);
  }
  if (hydratedFrame.constraints.value) {
    sections.push(`- Constraints: ${hydratedFrame.constraints.value}`);
  }

  // Current Strategy
  if (strategy) {
    sections.push('\n## Current Strategy');
    sections.push(`Title: ${strategy.title}`);
    if (strategy.summary) {
      sections.push(`Summary: ${strategy.summary}`);
    }

    if (strategy.objectives?.length > 0) {
      sections.push('\n### Current Objectives');
      for (const obj of strategy.objectives) {
        const text = typeof obj === 'string' ? obj : obj.text;
        sections.push(`- ${text}`);
      }
    }

    if (strategy.pillars?.length > 0) {
      sections.push('\n### Current Priorities');
      for (const pillar of strategy.pillars) {
        sections.push(`- ${pillar.title}: ${pillar.description || 'No description'}`);
      }
    }

    if (strategy.plays?.length > 0) {
      sections.push('\n### Current Tactics');
      for (const play of strategy.plays) {
        sections.push(`- ${play.title}: ${play.description || 'No description'}`);
      }
    }
  }

  // Business Context from Inputs
  if (inputs?.businessReality) {
    sections.push('\n## Business Context');
    if (inputs.businessReality.companyName) {
      sections.push(`- Company: ${inputs.businessReality.companyName}`);
    }
    if (inputs.businessReality.businessModel) {
      sections.push(`- Business Model: ${inputs.businessReality.businessModel}`);
    }
    if (inputs.businessReality.goals?.length > 0) {
      sections.push(`- Goals: ${inputs.businessReality.goals.join(', ')}`);
    }
  }

  // Competition
  if (inputs?.competition?.competitors?.length > 0) {
    sections.push('\n## Competition');
    for (const comp of inputs.competition.competitors.slice(0, 3)) {
      sections.push(`- ${comp.name}: ${comp.description || 'No description'}`);
    }
  }

  // Additional Context
  if (additionalContext) {
    sections.push(`\n## Additional Context\n${additionalContext}`);
  }

  return sections.join('\n');
}

function buildImproveFieldContext(params: {
  strategy: any;
  hydratedFrame: any;
  inputs: any;
  fieldPath: string;
  currentValue?: unknown;
  instructions?: string;
}): string {
  const { strategy, hydratedFrame, inputs, fieldPath, currentValue, instructions } = params;

  const sections: string[] = [];

  // Field being improved
  sections.push('## Field to Improve');
  sections.push(`Field Path: ${fieldPath}`);
  sections.push(`Current Value: ${JSON.stringify(currentValue, null, 2)}`);

  if (instructions) {
    sections.push(`\nSpecial Instructions: ${instructions}`);
  }

  // Company Context (brief)
  sections.push('\n## Company Context');
  if (hydratedFrame.audience.value) {
    sections.push(`- Target Audience: ${hydratedFrame.audience.value}`);
  }
  if (hydratedFrame.offering.value) {
    sections.push(`- Offering: ${hydratedFrame.offering.value}`);
  }
  if (hydratedFrame.valueProp.value) {
    sections.push(`- Value Proposition: ${hydratedFrame.valueProp.value}`);
  }

  // Business Reality (if available)
  if (inputs?.businessReality?.companyName) {
    sections.push(`- Company: ${inputs.businessReality.companyName}`);
  }
  if (inputs?.businessReality?.businessModel) {
    sections.push(`- Business Model: ${inputs.businessReality.businessModel}`);
  }

  // Current Strategy Context
  if (strategy) {
    sections.push('\n## Strategy Context');
    sections.push(`- Strategy: ${strategy.title}`);
    if (strategy.summary) {
      sections.push(`- Summary: ${strategy.summary}`);
    }
  }

  return sections.join('\n');
}

function parseAIResponse(
  action: ProposalAction,
  message: Anthropic.Message,
  fieldPath?: string,
  currentValue?: unknown
): Partial<AIProposalResponse> {
  const content = message.content[0];
  if (content.type !== 'text') {
    return { warnings: ['Unexpected response format'] };
  }

  const text = content.text;

  // Try to extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // For tradeoffs, return as plain text
    if (action === 'explain_tradeoffs') {
      return {
        tradeoffExplanation: text,
        confidence: 'medium',
      };
    }
    return { warnings: ['Could not parse AI response'] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    switch (action) {
      case 'propose_objectives':
      case 'improve_objectives':
        return {
          objectives: parsed.objectives || [],
          confidence: 'medium',
        };
      case 'propose_strategy':
      case 'improve_strategy':
        return {
          priorities: parsed.priorities || [],
          confidence: 'medium',
        };
      case 'propose_tactics':
      case 'improve_tactics':
        return {
          tactics: parsed.tactics || [],
          confidence: 'medium',
        };
      case 'improve_field':
        return {
          fieldImprovement: {
            fieldPath: fieldPath || 'unknown',
            originalValue: currentValue,
            improvedValue: parsed.improvedValue || currentValue,
            rationale: parsed.rationale || 'AI-suggested improvement',
          },
          confidence: parsed.confidence || 'medium',
        };
      case 'generate_alternatives':
        return {
          alternatives: parsed.alternatives || [],
          confidence: 'medium',
        };
      default:
        return { warnings: ['Unknown action type'] };
    }
  } catch (error) {
    return { warnings: ['Failed to parse AI response JSON'] };
  }
}

function getInputsUsed(inputs: any, contextGraph: any): string[] {
  const used: string[] = [];

  if (contextGraph) {
    used.push('Context Graph');
  }

  if (inputs?.businessReality?.companyName) {
    used.push('Business Reality');
  }

  if (inputs?.competition?.competitors?.length > 0) {
    used.push('Competition Data');
  }

  if (inputs?.constraints) {
    used.push('Constraints');
  }

  return used;
}
