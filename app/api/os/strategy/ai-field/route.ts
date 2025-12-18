// app/api/os/strategy/ai-field/route.ts
// Field-Level AI Assistance API
//
// Provides AI-powered field improvements:
// - suggest: Generate a new value
// - refine: Improve current value
// - shorten: Make more concise
// - expand: Add more detail
// - variants: Generate 2-4 alternatives
// - addPros, addCons, addTradeoffs: For list fields

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyContext } from '@/lib/os/context';
import { getActiveStrategy, getStrategyById } from '@/lib/os/strategy';
import { getCompanyById } from '@/lib/airtable/companies';
import { normalizeFrame } from '@/lib/types/strategy';

export const maxDuration = 60;

// ============================================================================
// Types
// ============================================================================

type FieldAIAction =
  | 'suggest'
  | 'refine'
  | 'shorten'
  | 'expand'
  | 'variants'
  | 'addPros'
  | 'addCons'
  | 'addTradeoffs';

interface FieldRequest {
  companyId: string;
  strategyId?: string;
  fieldType: string; // e.g., "frame.audience", "objective.title", "bet.thesis"
  currentValue: string | string[];
  action: FieldAIAction;
  guidance?: string;
  context?: Record<string, unknown>; // Additional context about the item being edited
}

// ============================================================================
// Action Configs
// ============================================================================

const ACTION_PROMPTS: Record<FieldAIAction, string> = {
  suggest: 'Generate a new, high-quality value for this field based on the strategy context.',
  refine: 'Improve and polish the current value while preserving its core meaning. Make it clearer, more professional, and more impactful.',
  shorten: 'Make this value more concise without losing essential meaning. Target 50% shorter.',
  expand: 'Add more detail and depth to this value. Provide additional context, examples, or specificity.',
  variants: 'Generate 3 alternative versions of this value, each with a different angle or emphasis.',
  addPros: 'Generate 2-3 additional advantages/pros for this strategic bet.',
  addCons: 'Generate 2-3 additional risks/cons for this strategic bet.',
  addTradeoffs: 'Generate 2-3 tradeoffs that come with this strategic decision.',
};

// ============================================================================
// Field Type Configs
// ============================================================================

const FIELD_CONFIGS: Record<string, { label: string; context: string }> = {
  'frame.audience': {
    label: 'Target Audience',
    context: 'This defines who the marketing strategy is targeting. Be specific about demographics, psychographics, and needs.',
  },
  'frame.offering': {
    label: 'Offering',
    context: 'This describes what the company offers. Focus on the core product/service value.',
  },
  'frame.valueProp': {
    label: 'Value Proposition',
    context: 'This is the unique value the company provides. Make it compelling and differentiated.',
  },
  'frame.positioning': {
    label: 'Positioning',
    context: 'This defines how the company wants to be perceived in the market relative to competitors.',
  },
  'frame.constraints': {
    label: 'Constraints',
    context: 'These are limitations, restrictions, or boundaries for the strategy (budget, compliance, etc.).',
  },
  'objective.title': {
    label: 'Objective Title',
    context: 'This should be a clear, measurable strategic objective. Use action verbs.',
  },
  'objective.description': {
    label: 'Objective Description',
    context: 'Describe what success looks like for this objective. Be specific about outcomes.',
  },
  'bet.title': {
    label: 'Strategic Bet Title',
    context: 'Name this strategic initiative clearly and memorably.',
  },
  'bet.thesis': {
    label: 'Bet Thesis',
    context: 'The core hypothesis this bet is testing. State what you believe will happen if this bet succeeds.',
  },
  'bet.description': {
    label: 'Bet Description',
    context: 'Explain what this strategic bet entails and why it matters.',
  },
  'bet.rationale': {
    label: 'Bet Rationale',
    context: 'Explain why this bet makes sense given the competitive landscape and company context.',
  },
  'bet.pros': {
    label: 'Bet Pros',
    context: 'Advantages and benefits of pursuing this strategic bet.',
  },
  'bet.cons': {
    label: 'Bet Cons',
    context: 'Risks and disadvantages of this strategic bet.',
  },
  'bet.tradeoffs': {
    label: 'Bet Tradeoffs',
    context: 'What you\'re giving up or compromising by making this bet.',
  },
  'tactic.title': {
    label: 'Tactic Title',
    context: 'A specific, actionable marketing tactic. Start with an action verb.',
  },
  'tactic.description': {
    label: 'Tactic Description',
    context: 'Describe what will be done, how, and expected outcomes.',
  },
};

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: FieldRequest = await request.json();
    const { companyId, strategyId, fieldType, currentValue, action, guidance, context: itemContext } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    if (!fieldType) {
      return NextResponse.json({ error: 'Missing fieldType' }, { status: 400 });
    }

    if (!action || !Object.keys(ACTION_PROMPTS).includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Fetch company, context, and strategy
    const [company, companyContext, strategy] = await Promise.all([
      getCompanyById(companyId),
      getCompanyContext(companyId),
      strategyId ? getStrategyById(strategyId) : getActiveStrategy(companyId),
    ]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Build the prompt
    const systemPrompt = buildSystemPrompt(fieldType, action);
    const userPrompt = buildUserPrompt(fieldType, currentValue, action, company, companyContext, strategy, guidance, itemContext);

    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: action === 'variants' ? 0.9 : 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Transform response based on action
    const result = transformFieldResponse(action, parsed, currentValue);

    return NextResponse.json({
      fieldType,
      action,
      ...result,
      inputsUsed: getInputsUsed(companyContext, strategy),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] strategy/ai-field error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI field action failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildSystemPrompt(fieldType: string, action: FieldAIAction): string {
  const fieldConfig = FIELD_CONFIGS[fieldType] || { label: fieldType, context: '' };
  const actionPrompt = ACTION_PROMPTS[action];

  return `You are a senior marketing strategist helping improve strategy content.

FIELD: ${fieldConfig.label}
FIELD CONTEXT: ${fieldConfig.context}

YOUR TASK: ${actionPrompt}

OUTPUT FORMAT (JSON):
${action === 'variants' ? `{
  "variants": ["Alternative 1", "Alternative 2", "Alternative 3"],
  "reasoning": "Brief explanation of the different angles"
}` : ['addPros', 'addCons', 'addTradeoffs'].includes(action) ? `{
  "items": ["Item 1", "Item 2", "Item 3"],
  "reasoning": "Brief explanation"
}` : `{
  "value": "The improved/generated value",
  "reasoning": "Brief explanation of changes/approach"
}`}

RULES:
1. Be professional and strategic in tone
2. Be specific and actionable, not generic
3. Consider the competitive context when relevant
4. Maintain consistency with existing strategy elements
5. ${action === 'shorten' ? 'Be ruthlessly concise - remove filler words' : 'Provide substantive content'}`;
}

function buildUserPrompt(
  fieldType: string,
  currentValue: string | string[],
  action: FieldAIAction,
  company: { name: string; website?: string; industry?: string },
  context: Awaited<ReturnType<typeof getCompanyContext>>,
  strategy: Awaited<ReturnType<typeof getActiveStrategy>>,
  guidance?: string,
  itemContext?: Record<string, unknown>
): string {
  const frame = normalizeFrame(strategy?.strategyFrame);

  // Company context
  const companySection = `COMPANY: ${company.name}
Industry: ${company.industry || 'Not specified'}`;

  // Strategic frame for context
  const frameSection = frame ? `
STRATEGIC FRAME:
${frame.audience ? `- Audience: ${frame.audience}` : ''}
${frame.valueProp ? `- Value Prop: ${frame.valueProp}` : ''}
${frame.positioning ? `- Positioning: ${frame.positioning}` : ''}`.trim() : '';

  // Current value
  const currentValueSection = Array.isArray(currentValue)
    ? `CURRENT VALUE:\n${currentValue.map((v, i) => `${i + 1}. ${v}`).join('\n')}`
    : `CURRENT VALUE:\n${currentValue || '(empty)'}`;

  // Item context (e.g., the bet being edited)
  const itemContextSection = itemContext
    ? `ITEM CONTEXT:\n${JSON.stringify(itemContext, null, 2)}`
    : '';

  // Guidance
  const guidanceSection = guidance ? `ADDITIONAL GUIDANCE: ${guidance}` : '';

  return `
${companySection}
${frameSection}

${currentValueSection}

${itemContextSection}
${guidanceSection}

Now ${action === 'suggest' ? 'generate' : action} this field value.
`.trim();
}

function transformFieldResponse(
  action: FieldAIAction,
  parsed: Record<string, unknown>,
  currentValue: string | string[]
): { value: string | string[] | { variants: string[] }; reasoning: string } {
  const reasoning = (parsed.reasoning as string) || 'Generated based on context.';

  if (action === 'variants') {
    return {
      value: { variants: (parsed.variants as string[]) || [] },
      reasoning,
    };
  }

  if (['addPros', 'addCons', 'addTradeoffs'].includes(action)) {
    // For list additions, return items to be appended
    const newItems = (parsed.items as string[]) || [];
    const existingItems = Array.isArray(currentValue) ? currentValue : [];
    return {
      value: [...existingItems, ...newItems],
      reasoning,
    };
  }

  // Standard single value response
  return {
    value: (parsed.value as string) || '',
    reasoning,
  };
}

function getInputsUsed(
  context: Awaited<ReturnType<typeof getCompanyContext>>,
  strategy: Awaited<ReturnType<typeof getActiveStrategy>>
): Record<string, boolean> {
  const frame = normalizeFrame(strategy?.strategyFrame);

  return {
    Frame: !!(frame?.audience || frame?.valueProp || frame?.positioning),
    Objectives: !!(strategy?.objectives && strategy.objectives.length > 0),
    Context: !!(context?.businessModel || context?.valueProposition),
  };
}
