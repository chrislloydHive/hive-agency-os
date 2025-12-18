// app/api/os/strategy/ai-evaluation/route.ts
// AI-powered evaluation generation for strategy items
//
// Generates Pros/Cons/Tradeoffs/Risks based on context + item details.
// Returns draft values that user must explicitly apply.

import { NextRequest, NextResponse } from 'next/server';
import { getActiveStrategy } from '@/lib/os/strategy';
import { getCompanyContext } from '@/lib/os/context';
import type { StrategyEvaluation, StrategyRisk } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

interface AiEvaluationRequest {
  companyId: string;
  itemType: 'priority' | 'tactic';
  itemId: string;
  itemTitle: string;
  itemDescription?: string;
  /** Optional: linked objective for context */
  linkedObjective?: string;
  /** Optional: linked priority for context */
  linkedPriority?: string;
}

interface AiEvaluationResponse {
  evaluation: StrategyEvaluation;
  reasoning: string;
  generatedAt: string;
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: AiEvaluationRequest = await request.json();
    const { companyId, itemType, itemId, itemTitle, itemDescription, linkedObjective, linkedPriority } = body;

    if (!companyId || !itemType || !itemId || !itemTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, itemType, itemId, itemTitle' },
        { status: 400 }
      );
    }

    // Get strategy and context for AI input
    const [strategy, context] = await Promise.all([
      getActiveStrategy(companyId),
      getCompanyContext(companyId),
    ]);

    // Get frame from strategy (if available)
    const frame = strategy?.strategyFrame;

    // Build context for AI - prefer frame values over context values
    const aiContext = {
      company: {
        name: 'Company', // Company name is on Company record, not context
        industry: context?.companyCategory || 'Unknown',
        primaryOffering: frame?.offering || context?.valueProposition || 'Unknown',
        targetAudience: frame?.audience || context?.icpDescription || context?.primaryAudience || 'Unknown',
        positioning: frame?.positioning || 'Unknown',
        valueProp: frame?.valueProp || context?.valueProposition || 'Unknown',
        constraints: frame?.constraints || context?.constraints || null,
        nonGoals: frame?.nonGoals || [],
      },
      strategy: {
        title: strategy?.title || 'No strategy',
        summary: strategy?.summary || '',
        objectives: strategy?.objectives || [],
        priorities: strategy?.pillars?.map(p => p.title) || [],
        frameLocked: frame?.isLocked || false,
      },
      item: {
        type: itemType,
        title: itemTitle,
        description: itemDescription,
        linkedObjective,
        linkedPriority,
      },
    };

    // Generate evaluation using AI
    // For now, we'll use a structured template approach
    // In production, this would call an LLM API
    const evaluation = await generateEvaluation(aiContext);

    const response: AiEvaluationResponse = {
      evaluation,
      reasoning: `Generated based on ${itemType} "${itemTitle}" in context of ${aiContext.company.name}'s strategy.`,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] ai-evaluation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate evaluation' },
      { status: 500 }
    );
  }
}

// ============================================================================
// AI Generation (placeholder for LLM integration)
// ============================================================================

async function generateEvaluation(context: {
  company: {
    name: string;
    industry: string;
    primaryOffering: string;
    targetAudience: string;
    positioning?: string;
    valueProp?: string;
    constraints?: string | null;
    nonGoals?: string[];
  };
  strategy: {
    title: string;
    summary: string;
    objectives: unknown[];
    priorities: string[];
    frameLocked?: boolean;
  };
  item: {
    type: 'priority' | 'tactic';
    title: string;
    description?: string;
    linkedObjective?: string;
    linkedPriority?: string;
  };
}): Promise<StrategyEvaluation> {
  // TODO: Replace with actual LLM call
  // For now, generate structured placeholder content based on item type

  const isPriority = context.item.type === 'priority';
  const itemTitle = context.item.title;
  const hasPositioning = context.company.positioning && context.company.positioning !== 'Unknown';

  // Generate contextual pros - enhanced with frame data
  const pros: string[] = [
    `Aligns with ${context.company.name}'s focus on ${context.company.primaryOffering}`,
    isPriority
      ? `Addresses key market opportunity in ${context.company.industry}`
      : `Supports strategic priority: ${context.item.linkedPriority || context.strategy.priorities[0] || 'growth'}`,
  ];
  if (hasPositioning) {
    pros.push(`Reinforces market positioning: ${context.company.positioning}`);
  }

  // Generate contextual cons
  const cons: string[] = [
    isPriority
      ? `May require significant resource investment`
      : `Execution complexity requires dedicated focus`,
    `Could face competitive pressure in implementation`,
  ];

  // Generate tradeoffs
  const tradeoffs: string[] = [
    isPriority
      ? `Prioritizing this means de-emphasizing other strategic areas`
      : `Committing to this tactic limits flexibility for alternatives`,
  ];

  // Add non-goal awareness to tradeoffs if available
  if (context.company.nonGoals && context.company.nonGoals.length > 0) {
    tradeoffs.push(`Must stay aligned with non-goals: ${context.company.nonGoals.slice(0, 2).join(', ')}`);
  }

  // Generate risks with mitigations
  const risks: StrategyRisk[] = [
    {
      risk: isPriority
        ? `Market conditions may shift during execution`
        : `Expected results may take longer to materialize`,
      mitigation: `Monitor KPIs monthly and adjust approach as needed`,
      likelihood: 'medium',
      impact: 'medium',
    },
    {
      risk: `Resource constraints could limit full execution`,
      mitigation: `Phase implementation and prioritize high-impact elements`,
      likelihood: 'low',
      impact: 'high',
    },
  ];

  // Add constraint-aware risk if constraints are defined
  if (context.company.constraints) {
    risks.push({
      risk: `Known constraints may limit execution options`,
      mitigation: `Plan within defined constraints: ${context.company.constraints.substring(0, 100)}`,
      likelihood: 'medium',
      impact: 'medium',
    });
  }

  // Generate assumptions
  const assumptions: string[] = [
    `Target audience (${context.company.targetAudience}) remains stable`,
    `Current team capacity is sufficient for execution`,
    isPriority
      ? `Market trends support this strategic direction`
      : `This tactic will contribute measurably to the linked objective`,
  ];

  return {
    pros,
    cons,
    tradeoffs,
    risks,
    assumptions,
    dependencies: [],
  };
}
