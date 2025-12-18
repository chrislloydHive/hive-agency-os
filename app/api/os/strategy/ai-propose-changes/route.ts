// app/api/os/strategy/ai-propose-changes/route.ts
// AI-powered bidirectional strategy evolution proposals
//
// Analyzes Objectives ⇄ Strategy ⇄ Tactics and proposes changes
// in any direction. All proposals are drafts requiring explicit Apply.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyContext } from '@/lib/os/context';
import { getActiveStrategy } from '@/lib/os/strategy';
import { normalizeObjectives } from '@/lib/types/strategy';
import type {
  StrategyProposal,
  StrategyProposalRequest,
  StrategyProposalResponse,
  StrategyHealthSignals,
  StrategyObjectiveV6,
  StrategyPriorityV6,
  StrategyTacticV6,
  ProposalSource,
} from '@/lib/types/strategyBidirectional';
import {
  calculateHealthSignals,
  generateProposalId,
  toObjectiveV6,
  toPriorityV6,
  toTacticV6,
} from '@/lib/types/strategyBidirectional';

export const maxDuration = 120;

// ============================================================================
// System Prompts for Different Analysis Directions
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are a senior strategist analyzing marketing strategy alignment.
Your role is to propose changes that improve alignment between Objectives, Strategy, and Tactics.

RULES:
1. All proposals are SUGGESTIONS - never silent overwrites
2. If an item is marked as "locked", you can ONLY propose a recommendation card (targetIsLocked: true)
3. Be specific about WHY each change is needed
4. Reference the source items that led to each proposal
5. Rate confidence as: high (evidence-based), medium (logical inference), low (hypothesis)

OUTPUT FORMAT:
Return a JSON object with:
{
  "proposals": [
    {
      "type": "objective" | "strategy" | "tactic",
      "action": "add" | "modify" | "remove",
      "targetId": "string or null for add",
      "proposedChange": { ...the change data... },
      "rationale": "Why this change is needed",
      "confidence": "high" | "medium" | "low",
      "relatedItemIds": ["ids of items that influenced this"],
      "targetIsLocked": false
    }
  ],
  "analysisSummary": "2-3 sentence summary of the analysis"
}`;

const DIRECTION_PROMPTS: Record<string, string> = {
  objectives_to_strategy: `
ANALYSIS DIRECTION: Objectives → Strategy
Analyze the objectives and suggest strategy changes that would better achieve them.

LOOK FOR:
- Objectives without strategy support
- Misaligned priorities (strategy not serving key objectives)
- Missing strategic priorities needed for objectives
- Conflicting strategy elements that block objectives

PROPOSE:
- New strategic priorities to serve uncovered objectives
- Reweighting priority importance based on objective importance
- Strategy refinements to better align with objectives`,

  strategy_to_objectives: `
ANALYSIS DIRECTION: Strategy → Objectives
Analyze the strategy and suggest objective refinements.

LOOK FOR:
- Vague objectives that strategy can't clearly support
- Missing success metrics that strategy implies
- Objectives that could be split for clarity
- Redundant or overlapping objectives

PROPOSE:
- Refined objective wording with clearer outcomes
- New success metrics based on strategy KPIs
- Splitting complex objectives into measurable parts
- Consolidating redundant objectives`,

  tactics_to_strategy: `
ANALYSIS DIRECTION: Tactics → Strategy
Analyze tactical learnings and suggest strategy adjustments.

LOOK FOR:
- Tactics that don't fit current priorities (may suggest new ones)
- Over-committed priorities (too many tactics)
- Under-resourced priorities (no tactical support)
- Tactics suggesting strategy scope changes

PROPOSE:
- Priority reordering based on tactical feasibility
- New priorities discovered through tactical execution
- Strategy scope adjustments based on what's working
- Contradiction resolution between strategy and tactics`,

  tactics_to_objectives: `
ANALYSIS DIRECTION: Tactics → Objectives
Analyze tactical discoveries and suggest new objectives.

LOOK FOR:
- Tactics uncovering new opportunities
- Tactics revealing objectives that should be retired
- Success from tactics suggesting new goals
- Tactical blockers suggesting objective changes

PROPOSE:
- New objectives discovered through tactical execution
- Flagging obsolete objectives that tactics can't support
- Objective refinements based on tactical learnings
- New success metrics from tactical results`,

  strategy_to_tactics: `
ANALYSIS DIRECTION: Strategy → Tactics
Analyze strategy and suggest tactics to implement it.

LOOK FOR:
- Priorities without tactical support
- Strategy elements needing specific tactics
- Tactical gaps for achieving objectives
- Missing channels or approaches

PROPOSE:
- New tactics to support unsupported priorities
- Tactic refinements to better align with strategy
- Effort/impact rebalancing for strategy fit
- New tactical approaches for objectives`,

  objectives_to_tactics: `
ANALYSIS DIRECTION: Objectives → Tactics
Analyze objectives and suggest tactics to achieve them.

LOOK FOR:
- Objectives without tactical path
- Objectives needing more/different tactics
- Quick wins for high-priority objectives
- Tactical gaps blocking objective achievement

PROPOSE:
- New tactics to achieve underserved objectives
- Tactic prioritization based on objective importance
- Effort-appropriate tactics for objectives
- Tactical experiments for uncertain objectives`,

  full_alignment: `
ANALYSIS DIRECTION: Full Alignment Check
Analyze the entire Objectives ⇄ Strategy ⇄ Tactics chain.

LOOK FOR:
- Broken links (objectives without strategy, strategy without tactics)
- Misalignments between layers
- Contradictions and conflicts
- Coverage gaps

PROPOSE:
- Changes at any layer to improve alignment
- Prioritize based on impact on overall coherence
- Focus on high-confidence, high-impact proposals`,
};

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: StrategyProposalRequest = await request.json();
    const { companyId, strategyId, analyzeDirection, focusItemIds, maxProposals = 10 } = body;

    if (!companyId || !strategyId) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, strategyId' },
        { status: 400 }
      );
    }

    // Fetch strategy and context
    const [strategy, context] = await Promise.all([
      getActiveStrategy(companyId),
      getCompanyContext(companyId),
    ]);

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Normalize strategy data to V6 format
    const objectives: StrategyObjectiveV6[] = normalizeObjectives(strategy.objectives)
      .map(toObjectiveV6);

    const priorities: StrategyPriorityV6[] = strategy.pillars.map(p =>
      toPriorityV6(p, []) // No linkage data in legacy format
    );

    const tactics: StrategyTacticV6[] = (strategy.plays || []).map(p =>
      toTacticV6(p)
    );

    // Calculate current health signals
    const healthSignals = calculateHealthSignals(objectives, priorities, tactics);

    // Build AI prompt
    const directionPrompt = DIRECTION_PROMPTS[analyzeDirection] || DIRECTION_PROMPTS.full_alignment;

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${BASE_SYSTEM_PROMPT}\n\n${directionPrompt}`,
        },
        {
          role: 'user',
          content: buildAnalysisPrompt(
            strategy.title,
            objectives,
            priorities,
            tactics,
            context,
            focusItemIds
          ),
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Transform AI response to typed proposals
    const proposals: StrategyProposal[] = (parsed.proposals || [])
      .slice(0, maxProposals)
      .map((p: {
        type?: string;
        action?: string;
        targetId?: string;
        proposedChange?: Record<string, unknown>;
        rationale?: string;
        confidence?: string;
        relatedItemIds?: string[];
        targetIsLocked?: boolean;
      }) => ({
        id: generateProposalId(),
        type: validateProposalType(p.type),
        action: validateProposalAction(p.action),
        targetId: p.targetId || undefined,
        proposedChange: p.proposedChange || {},
        rationale: p.rationale || 'AI-suggested change',
        confidence: validateConfidence(p.confidence),
        source: analyzeDirection as ProposalSource,
        relatedItemIds: p.relatedItemIds || [],
        generatedAt: new Date().toISOString(),
        targetIsLocked: p.targetIsLocked || false,
      }));

    const result: StrategyProposalResponse = {
      proposals,
      analysisSummary: parsed.analysisSummary || 'Analysis complete',
      healthSignals,
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] ai-propose-changes error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI proposal failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildAnalysisPrompt(
  strategyTitle: string,
  objectives: StrategyObjectiveV6[],
  priorities: StrategyPriorityV6[],
  tactics: StrategyTacticV6[],
  context: Awaited<ReturnType<typeof getCompanyContext>>,
  focusItemIds?: string[]
): string {
  const objectivesSection = objectives.map(o =>
    `- [${o.id}] ${o.text}${o.isLocked ? ' (LOCKED)' : ''}${o.metric ? ` | Metric: ${o.metric}` : ''}`
  ).join('\n');

  const prioritiesSection = priorities.map(p =>
    `- [${p.id}] ${p.title}${p.isLocked ? ' (LOCKED)' : ''} | Priority: ${p.priority}
    Description: ${p.description}
    Linked Objectives: ${p.objectiveIds?.join(', ') || 'none'}`
  ).join('\n\n');

  const tacticsSection = tactics.map(t =>
    `- [${t.id}] ${t.title}${t.isLocked ? ' (LOCKED)' : ''}
    Impact: ${t.expectedImpact || t.impact || 'medium'} | Effort: ${t.effortSize || 'm'}
    Objectives: ${t.objectiveIds?.join(', ') || 'none'}
    Priorities: ${t.priorityIds?.join(', ') || 'none'}
    Status: ${t.status}`
  ).join('\n\n');

  const focusSection = focusItemIds?.length
    ? `\n\nFOCUS ON THESE ITEMS: ${focusItemIds.join(', ')}`
    : '';

  return `
STRATEGY: ${strategyTitle}

================================
COMPANY CONTEXT
================================
- Category: ${context?.companyCategory || 'Not specified'}
- Primary Audience: ${context?.primaryAudience || 'Not specified'}
- Business Model: ${context?.businessModel || 'Not specified'}

================================
OBJECTIVES (${objectives.length})
================================
${objectivesSection || 'No objectives defined'}

================================
STRATEGIC PRIORITIES (${priorities.length})
================================
${prioritiesSection || 'No priorities defined'}

================================
TACTICS (${tactics.length})
================================
${tacticsSection || 'No tactics defined'}
${focusSection}

Analyze the alignment and propose changes. Remember:
- Respect locked items (can only recommend, not modify)
- Be specific about rationale
- Include related item IDs that influenced each proposal
`.trim();
}

function validateProposalType(type?: string): 'objective' | 'strategy' | 'tactic' {
  if (type === 'objective' || type === 'strategy' || type === 'tactic') {
    return type;
  }
  return 'strategy';
}

function validateProposalAction(action?: string): 'add' | 'modify' | 'remove' {
  if (action === 'add' || action === 'modify' || action === 'remove') {
    return action;
  }
  return 'modify';
}

function validateConfidence(confidence?: string): 'high' | 'medium' | 'low' {
  if (confidence === 'high' || confidence === 'medium' || confidence === 'low') {
    return confidence;
  }
  return 'medium';
}
