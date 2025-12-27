// app/api/os/companies/[companyId]/strategy/ai-propose-field/route.ts
// Field-level AI improvement proposals
//
// Returns a draft improvement for a single field without writing to DB.
// User must explicitly apply the draft.
//
// Supports scopes:
// - frame: Strategy Frame fields (audience, positioning, etc.)
// - strategy: Priority fields (title, description, rationale)
// - tactic: Tactic fields (title, description)
// - objective: Objective fields (text, metric)

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { loadContextGraph } from '@/lib/contextGraph/storage';

// ============================================================================
// Types
// ============================================================================

type FieldScope = 'frame' | 'strategy' | 'tactic' | 'objective';

interface RequestBody {
  strategyId: string;
  scope: FieldScope;
  fieldKey: string;
  currentValue: string | null;
  itemId?: string;
  context?: {
    objectives?: unknown[];
    priorities?: unknown[];
    tactics?: unknown[];
    frame?: unknown;
    goalStatement?: string;
  };
}

interface FieldProposalResponse {
  draftValue: string;
  rationale: string[];
  confidence: 'high' | 'medium' | 'low';
  sourcesUsed: string[];
  warnings?: string[];
}

// ============================================================================
// Field-Specific Prompts
// ============================================================================

function getFieldPrompt(
  scope: FieldScope,
  fieldKey: string,
  currentValue: string | null,
  contextSummary: string,
  hasGoalStatement: boolean = false
): string {
  const currentValueText = currentValue
    ? `Current value: "${currentValue}"`
    : 'No current value (field is empty)';

  // Add goal alignment instructions when goalStatement is present
  const goalAlignmentInstructions = hasGoalStatement
    ? `
CRITICAL - Goal Alignment:
If a STRATEGY GOAL is provided above, you MUST:
- Ensure your improvement directly supports achieving that goal
- Do NOT introduce concepts unrelated to the stated goal
- Keep recommendations focused on the user's stated intent
`
    : '';

  const baseInstructions = `
You are helping improve a strategy field. Your goal is to make the content more:
- Specific and actionable
- Clear and concise
- Aligned with the company's context and objectives
${goalAlignmentInstructions}
${currentValueText}

Context about the company:
${contextSummary}

Return your response in this exact JSON format:
{
  "draftValue": "Your improved text here",
  "rationale": ["Reason 1 for the change", "Reason 2 for the change"],
  "confidence": "high" | "medium" | "low",
  "sourcesUsed": ["context", "objectives", "strategy", "tactics", "goal"] // which inputs you used
}

Only return valid JSON, no other text.
`;

  // Field-specific guidance
  const fieldGuidance: Record<string, Record<string, string>> = {
    frame: {
      audience: `
Improve the target audience description.
Make it specific: who are they, what do they need, what motivates them?
Include demographics, psychographics, or firmographics as relevant.
`,
      offering: `
Improve the primary offering description.
Be specific about what the company provides and the value it delivers.
Focus on outcomes, not features.
`,
      valueProp: `
Improve the value proposition.
Make it compelling and differentiated.
Focus on the unique benefit the customer receives.
`,
      positioning: `
Improve the market positioning statement.
Make it clear where the company sits relative to alternatives.
Include the key differentiator.
`,
      constraints: `
Clarify the operational constraints.
Include legal, regulatory, geographic, or resource limitations.
Be specific about what the company cannot or should not do.
`,
    },
    strategy: {
      title: `
Improve the strategic priority title.
Make it action-oriented and concise (3-7 words).
It should clearly communicate the strategic direction.
`,
      description: `
Improve the strategic priority description.
Explain what this priority means in practice.
Include why it matters and how success will be measured.
`,
      rationale: `
Improve the rationale for this strategic priority.
Explain WHY this priority was chosen over alternatives.
Include the tradeoffs being made.
`,
    },
    tactic: {
      title: `
Improve the tactic title.
Make it specific and actionable.
It should be clear what will be done.
`,
      description: `
Improve the tactic description.
Detail the implementation approach.
Include expected outcomes and how it supports the strategy.
`,
    },
    objective: {
      text: `
Improve the objective statement.
Make it specific, measurable, and time-bound if possible.
Focus on outcomes, not activities.
`,
      metric: `
Improve the success metric.
Make it quantifiable and trackable.
Include the baseline and target if known.
`,
    },
  };

  const guidance = fieldGuidance[scope]?.[fieldKey] || `Improve this ${scope} ${fieldKey} field.`;

  return `${baseInstructions}\n\nSpecific guidance for this field:\n${guidance}`;
}

// ============================================================================
// Build Context Summary
// ============================================================================

function buildContextSummary(
  contextGraph: unknown,
  requestContext?: RequestBody['context']
): { summary: string; sourcesAvailable: string[]; hasGoalStatement: boolean } {
  const parts: string[] = [];
  const sources: string[] = [];
  let hasGoalStatement = false;

  // Goal Statement (from strategy record) - prioritize this as it represents user intent
  if (requestContext?.goalStatement && typeof requestContext.goalStatement === 'string' && requestContext.goalStatement.trim()) {
    hasGoalStatement = true;
    sources.push('goal');
    parts.push(`STRATEGY GOAL: "${requestContext.goalStatement.trim()}"`);
  }

  // Context Graph data
  if (contextGraph && typeof contextGraph === 'object') {
    sources.push('context');
    const graph = contextGraph as Record<string, unknown>;

    // Identity
    if (graph.identity) {
      const identity = graph.identity as Record<string, unknown>;
      const businessModel = (identity.businessModel as { value?: string })?.value;
      const marketPosition = (identity.marketPosition as { value?: string })?.value;
      if (businessModel) parts.push(`Business Model: ${businessModel}`);
      if (marketPosition) parts.push(`Market Position: ${marketPosition}`);
    }

    // Audience
    if (graph.audience) {
      const audience = graph.audience as Record<string, unknown>;
      const primaryAudience = (audience.primaryAudience as { value?: string })?.value;
      if (primaryAudience) parts.push(`Primary Audience: ${primaryAudience}`);
    }

    // Product/Offer
    if (graph.productOffer) {
      const product = graph.productOffer as Record<string, unknown>;
      const valueProposition = (product.valueProposition as { value?: string })?.value;
      if (valueProposition) parts.push(`Value Proposition: ${valueProposition}`);
    }
  }

  // Objectives from request context
  if (requestContext?.objectives && Array.isArray(requestContext.objectives)) {
    sources.push('objectives');
    const objTexts = requestContext.objectives
      .slice(0, 5)
      .map((o: unknown) => {
        if (typeof o === 'object' && o !== null) {
          return (o as Record<string, unknown>).text || (o as Record<string, unknown>).objective;
        }
        return String(o);
      })
      .filter(Boolean);
    if (objTexts.length > 0) {
      parts.push(`Objectives:\n${objTexts.map((t) => `- ${t}`).join('\n')}`);
    }
  }

  // Priorities from request context
  if (requestContext?.priorities && Array.isArray(requestContext.priorities)) {
    sources.push('strategy');
    const priorityTexts = requestContext.priorities
      .slice(0, 5)
      .map((p: unknown) => {
        if (typeof p === 'object' && p !== null) {
          const pr = p as Record<string, unknown>;
          return pr.title || pr.name;
        }
        return null;
      })
      .filter(Boolean);
    if (priorityTexts.length > 0) {
      parts.push(`Strategic Bets:\n${priorityTexts.map((t) => `- ${t}`).join('\n')}`);
    }
  }

  // Tactics from request context
  if (requestContext?.tactics && Array.isArray(requestContext.tactics)) {
    sources.push('tactics');
    const tacticTexts = requestContext.tactics
      .slice(0, 5)
      .map((t: unknown) => {
        if (typeof t === 'object' && t !== null) {
          return (t as Record<string, unknown>).title;
        }
        return null;
      })
      .filter(Boolean);
    if (tacticTexts.length > 0) {
      parts.push(`Tactics:\n${tacticTexts.map((t) => `- ${t}`).join('\n')}`);
    }
  }

  // Frame from request context
  if (requestContext?.frame && typeof requestContext.frame === 'object') {
    const frame = requestContext.frame as Record<string, unknown>;
    const frameFields = ['audience', 'offering', 'valueProp', 'positioning', 'constraints'];
    const frameParts: string[] = [];
    for (const field of frameFields) {
      const fieldData = frame[field];
      if (fieldData && typeof fieldData === 'object') {
        const value = (fieldData as Record<string, unknown>).value;
        if (value && typeof value === 'string') {
          frameParts.push(`${field}: ${value}`);
        }
      }
    }
    if (frameParts.length > 0) {
      parts.push(`Strategy Frame:\n${frameParts.join('\n')}`);
    }
  }

  return {
    summary: parts.length > 0 ? parts.join('\n\n') : 'No context available.',
    sourcesAvailable: [...new Set(sources)],
    hasGoalStatement,
  };
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body: RequestBody = await request.json();

    const { strategyId, scope, fieldKey, currentValue, context } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    if (!scope || !fieldKey) {
      return NextResponse.json({ error: 'scope and fieldKey are required' }, { status: 400 });
    }

    // Load context graph
    let contextGraph = null;
    try {
      contextGraph = await loadContextGraph(companyId);
    } catch (err) {
      console.warn('[ai-propose-field] Failed to load context graph:', err);
    }

    // Build context summary
    const { summary: contextSummary, sourcesAvailable, hasGoalStatement } = buildContextSummary(contextGraph, context);

    // Build prompt (with goal alignment when goalStatement is present)
    const prompt = getFieldPrompt(scope, fieldKey, currentValue, contextSummary, hasGoalStatement);

    // Call Claude
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Parse response
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let parsed: FieldProposalResponse;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error('[ai-propose-field] Failed to parse AI response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Ensure sourcesUsed only contains sources we actually had
    const validSources = parsed.sourcesUsed?.filter((s) =>
      sourcesAvailable.includes(s)
    ) || sourcesAvailable;

    const response: FieldProposalResponse = {
      draftValue: parsed.draftValue || currentValue || '',
      rationale: parsed.rationale || [],
      confidence: parsed.confidence || 'medium',
      sourcesUsed: validSources,
      warnings: parsed.warnings,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/os/companies/[companyId]/strategy/ai-propose-field] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate field proposal' },
      { status: 500 }
    );
  }
}
