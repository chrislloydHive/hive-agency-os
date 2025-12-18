// app/api/os/strategy/ai-generate/route.ts
// Column-Level AI Generation API
//
// Generates objectives, bets, or tactics based on strategy context.
// Modes: create (append), replace (drafts only), improve (rewrite)

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyContext } from '@/lib/os/context';
import { getActiveStrategy, getStrategyById } from '@/lib/os/strategy';
import { getCompanyById } from '@/lib/airtable/companies';
import type { StrategyFrame } from '@/lib/types/strategy';
import { normalizeFrame } from '@/lib/types/strategy';

export const maxDuration = 120;

// ============================================================================
// Types
// ============================================================================

type GenerateType = 'objectives' | 'bets' | 'tactics';
type GenerateMode = 'create' | 'replace' | 'improve';

interface GenerateRequest {
  companyId: string;
  strategyId?: string;
  type: GenerateType;
  mode: GenerateMode;
  guidance?: string;
  existingItems?: unknown[];
}

// ============================================================================
// System Prompts
// ============================================================================

const OBJECTIVES_SYSTEM_PROMPT = `You are a senior marketing strategist defining strategic objectives.

Given the company's strategic frame (audience, positioning, value prop, constraints), generate clear, measurable objectives that will guide strategy execution.

OUTPUT FORMAT (JSON):
{
  "objectives": [
    {
      "title": "Objective title (action-oriented)",
      "description": "Brief description of what success looks like",
      "timeframe": "Q1 2025" | "H1 2025" | "2025",
      "metrics": ["Metric 1", "Metric 2"]
    }
  ],
  "reasoning": "Brief explanation of why these objectives were chosen"
}

RULES:
1. Create 3-5 objectives that are MECE (mutually exclusive, collectively exhaustive)
2. Each objective should be measurable and time-bound
3. Objectives should align with the strategic frame
4. Focus on outcomes, not activities
5. Be specific but not overly tactical`;

const BETS_SYSTEM_PROMPT = `You are a senior marketing strategist defining strategic bets.

Strategic bets are mid-layer decision objects that bridge objectives to tactics. Each bet represents a significant investment of resources and attention.

OUTPUT FORMAT (JSON):
{
  "bets": [
    {
      "title": "Strategic Bet title",
      "thesis": "The core hypothesis this bet is testing",
      "description": "2-3 sentences explaining the bet",
      "rationale": "Why this bet makes sense given the competitive landscape",
      "linkedObjectiveIds": [],
      "pros": ["Advantage 1", "Advantage 2"],
      "cons": ["Risk 1", "Risk 2"],
      "tradeoffs": ["Tradeoff 1"],
      "priority": "high" | "medium" | "low",
      "confidence": "high" | "medium" | "low",
      "timeHorizon": "short" | "medium" | "long",
      "resourceIntensity": "low" | "medium" | "high"
    }
  ],
  "reasoning": "Brief explanation of bet selection strategy"
}

RULES:
1. Create 3-5 strategic bets that cover key areas
2. Each bet must have a clear thesis (hypothesis to test)
3. Include honest pros AND cons for each bet
4. Tradeoffs should explain what you're giving up
5. Bets should be non-overlapping but collectively address objectives
6. Reference competitive dynamics in rationale`;

const TACTICS_SYSTEM_PROMPT = `You are a senior marketing strategist defining tactics.

Tactics are specific, executable actions that implement strategic bets. They should be concrete enough to assign to a team member.

OUTPUT FORMAT (JSON):
{
  "tactics": [
    {
      "title": "Tactic title (action verb)",
      "description": "What specifically will be done",
      "linkedBetIds": [],
      "owner": "Role or team responsible",
      "timeline": "Q1 2025" | "Ongoing",
      "channels": ["website", "social", "email", "content", "media", "other"],
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low"
    }
  ],
  "reasoning": "Brief explanation of tactic prioritization"
}

RULES:
1. Create 5-10 tactics per accepted bet
2. Each tactic should be specific and actionable
3. Include clear ownership and timeline
4. Link each tactic to its parent bet(s)
5. Balance quick wins with larger initiatives
6. Consider channel mix and resource allocation`;

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { companyId, strategyId, type, mode, guidance, existingItems } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    if (!type || !['objectives', 'bets', 'tactics'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be: objectives, bets, or tactics' }, { status: 400 });
    }

    if (!mode || !['create', 'replace', 'improve'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode. Must be: create, replace, or improve' }, { status: 400 });
    }

    // Fetch company, context, and strategy
    const [company, context, strategy] = await Promise.all([
      getCompanyById(companyId),
      getCompanyContext(companyId),
      strategyId ? getStrategyById(strategyId) : getActiveStrategy(companyId),
    ]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Build prompt based on type
    const systemPrompt = getSystemPrompt(type);
    const userPrompt = buildUserPrompt(type, mode, company, context, strategy, guidance, existingItems);

    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Transform response based on type
    const result = transformResponse(type, parsed, mode);

    return NextResponse.json({
      type,
      mode,
      items: result.items,
      reasoning: result.reasoning,
      inputsUsed: getInputsUsed(context, strategy),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] strategy/ai-generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI generation failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSystemPrompt(type: GenerateType): string {
  switch (type) {
    case 'objectives':
      return OBJECTIVES_SYSTEM_PROMPT;
    case 'bets':
      return BETS_SYSTEM_PROMPT;
    case 'tactics':
      return TACTICS_SYSTEM_PROMPT;
  }
}

function buildUserPrompt(
  type: GenerateType,
  mode: GenerateMode,
  company: { name: string; website?: string; industry?: string },
  context: Awaited<ReturnType<typeof getCompanyContext>>,
  strategy: Awaited<ReturnType<typeof getActiveStrategy>>,
  guidance?: string,
  existingItems?: unknown[]
): string {
  const frame = normalizeFrame(strategy?.strategyFrame);

  // Build context sections
  const companySection = `
COMPANY: ${company.name}
Website: ${company.website || 'Not specified'}
Industry: ${company.industry || 'Not specified'}`;

  const frameSection = buildFrameSection(frame);

  const contextSection = context ? `
BUSINESS CONTEXT:
- Business Model: ${context.businessModel || 'Not specified'}
- Value Proposition: ${context.valueProposition || frame?.valueProp || 'Not specified'}
- Primary Audience: ${context.primaryAudience || frame?.audience || 'Not specified'}
- Competitive Category: ${context.companyCategory || 'Not specified'}
- Differentiators: ${context.differentiators?.join(', ') || 'Not specified'}` : '';

  // Build type-specific context
  let typeContext = '';
  if (type === 'bets' || type === 'tactics') {
    const objectives = strategy?.objectives || [];
    typeContext += `
CURRENT OBJECTIVES:
${objectives.map((o, i) => `${i + 1}. ${typeof o === 'string' ? o : (o as { text?: string }).text || o}`).join('\n')}`;
  }

  if (type === 'tactics') {
    const pillars = strategy?.pillars || [];
    const acceptedBets = pillars.filter(p => p.status === 'active');
    typeContext += `

ACCEPTED STRATEGIC BETS (generate tactics for these):
${acceptedBets.map((b, i) => `${i + 1}. ${b.title}: ${b.description || ''}`).join('\n')}`;
  }

  // Mode-specific instructions
  const modeInstructions = {
    create: 'Generate NEW items to ADD to the existing list.',
    replace: 'Generate items to REPLACE draft items only. Preserve any accepted items.',
    improve: 'REWRITE and ENHANCE the existing items while preserving their intent.',
  };

  // Existing items for improve mode
  const existingSection = existingItems && existingItems.length > 0 && mode === 'improve' ? `
EXISTING ITEMS TO IMPROVE:
${JSON.stringify(existingItems, null, 2)}` : '';

  // Guidance
  const guidanceSection = guidance ? `
ADDITIONAL GUIDANCE:
${guidance}` : '';

  return `
${companySection}
${frameSection}
${contextSection}
${typeContext}

MODE: ${mode.toUpperCase()}
${modeInstructions[mode]}
${existingSection}
${guidanceSection}

Generate ${type} now.
`.trim();
}

function buildFrameSection(frame: StrategyFrame | null): string {
  if (!frame) return '';

  const parts: string[] = ['STRATEGIC FRAME:'];
  if (frame.audience) parts.push(`- Target Audience: ${frame.audience}`);
  if (frame.offering) parts.push(`- Offering: ${frame.offering}`);
  if (frame.valueProp) parts.push(`- Value Proposition: ${frame.valueProp}`);
  if (frame.positioning) parts.push(`- Positioning: ${frame.positioning}`);
  if (frame.constraints) parts.push(`- Constraints: ${frame.constraints}`);

  return parts.length > 1 ? parts.join('\n') : '';
}

function transformResponse(
  type: GenerateType,
  parsed: Record<string, unknown>,
  mode: GenerateMode
): { items: unknown[]; reasoning: string } {
  const reasoning = (parsed.reasoning as string) || 'Generated based on strategy context.';

  switch (type) {
    case 'objectives':
      return {
        items: ((parsed.objectives as unknown[]) || []).map((obj: unknown, i: number) => ({
          id: `obj_draft_${Date.now()}_${i}`,
          ...(obj as object),
          status: 'draft',
          provenance: { source: 'ai', generatedAt: new Date().toISOString() },
        })),
        reasoning,
      };

    case 'bets':
      return {
        items: ((parsed.bets as unknown[]) || []).map((bet: unknown, i: number) => ({
          id: `bet_draft_${Date.now()}_${i}`,
          ...(bet as object),
          status: 'draft',
          provenance: { source: 'ai', generatedAt: new Date().toISOString() },
        })),
        reasoning,
      };

    case 'tactics':
      return {
        items: ((parsed.tactics as unknown[]) || []).map((tactic: unknown, i: number) => ({
          id: `tactic_draft_${Date.now()}_${i}`,
          ...(tactic as object),
          isDerived: true,
          isPinned: false,
          status: 'proposed',
          provenance: { source: 'ai', generatedAt: new Date().toISOString() },
        })),
        reasoning,
      };
  }
}

function getInputsUsed(
  context: Awaited<ReturnType<typeof getCompanyContext>>,
  strategy: Awaited<ReturnType<typeof getActiveStrategy>>
): Record<string, boolean> {
  const frame = normalizeFrame(strategy?.strategyFrame);

  return {
    Frame: !!(frame?.audience || frame?.valueProp || frame?.positioning),
    Objectives: !!(strategy?.objectives && strategy.objectives.length > 0),
    Bets: !!(strategy?.pillars && strategy.pillars.length > 0),
    Context: !!(context?.businessModel || context?.valueProposition),
    Competitors: !!(context?.competitors && context.competitors.length > 0),
  };
}
