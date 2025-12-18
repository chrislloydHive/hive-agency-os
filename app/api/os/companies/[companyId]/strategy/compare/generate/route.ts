// app/api/os/companies/[companyId]/strategy/compare/generate/route.ts
// POST /api/os/companies/[companyId]/strategy/compare/generate
//
// Generates AI comparison of 2-4 strategies
// All outputs are DRAFTS requiring explicit Apply
//
// STRICT AI RULES:
// - Do not invent facts; if missing context, label as unknown
// - Pros/cons must directly reference strategy text or objective conflicts
// - Recommendation must be conditional ("If your primary objective is X, prefer strategy Y...")

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCompanyById } from '@/lib/airtable/companies';
import { getStrategiesForCompany, getActiveStrategy } from '@/lib/os/strategy';
import { getCompanyContext } from '@/lib/os/context';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createComparison } from '@/lib/os/strategy/comparison';
import {
  hashContext,
  hashObjectives,
  hashStrategy,
} from '@/lib/os/strategy/hashes';
import type {
  StrategyComparison,
  ComparisonBasedOnHashes,
  GenerateComparisonRequest,
  GenerateComparisonResponse,
  ObjectiveCoverageItem,
  DecisionMatrixRow,
  StrategyProsCons,
  StrategyTradeoffs,
  RiskItem,
  ComparisonRecommendation,
  ComparisonDimension,
} from '@/lib/types/strategyComparison';
import type { CompanyStrategy, StrategyObjective } from '@/lib/types/strategy';

export const dynamic = 'force-dynamic';

// ============================================================================
// System Prompt - Strict Rules
// ============================================================================

const COMPARISON_SYSTEM_PROMPT = `You are a strategic marketing advisor helping compare multiple strategies. You must follow STRICT RULES:

## ABSOLUTE RULES (Never violate):
1. DO NOT INVENT FACTS - If information is missing, mark as "unknown" or "insufficient data"
2. ALL PROS/CONS MUST CITE SOURCES - Reference specific strategy text, objectives, or context data
3. RECOMMENDATIONS MUST BE CONDITIONAL - Use "If X is your priority, then strategy Y..." format
4. NEVER CLAIM CERTAINTY - Use confidence levels appropriately

## Analysis Framework:
For each strategy, analyze:
- Objective Coverage: How well does each strategy support stated objectives? (cite objective text)
- Decision Matrix: Score each dimension 0-1 with explanation citing evidence
- Pros/Cons: List with citations from strategy content
- Tradeoffs: What each strategy optimizes for vs. sacrifices (cite strategy text)
- Risks: What could go wrong? Include mitigation strategies

## Dimensions for Decision Matrix:
- alignment: How well does this align with stated objectives?
- feasibility: Can this be executed with current constraints?
- differentiation: How distinctive vs. competition?
- speed: How quickly can this deliver results?
- risk: What's the risk profile? (lower score = higher risk)
- cost: Resource/budget requirements (lower score = higher cost)
- confidence: How confident are we in this strategy's data quality?

## Output Format:
Return valid JSON with this structure:
{
  "objectiveCoverage": [
    {
      "objectiveId": "obj_id",
      "objectiveText": "the objective",
      "perStrategyScore": { "strategy_id": 0.0-1.0 },
      "notes": "Explanation citing strategy text"
    }
  ],
  "decisionMatrix": [
    {
      "dimension": "alignment|feasibility|differentiation|speed|risk|cost|confidence",
      "weight": 0.0-1.0,
      "perStrategyScore": { "strategy_id": 0.0-1.0 },
      "explanation": "Why these scores? Cite evidence."
    }
  ],
  "prosCons": {
    "strategy_id": {
      "pros": [
        { "text": "pro statement", "citation": "From strategy: '...'", "significance": "minor|moderate|major" }
      ],
      "cons": [
        { "text": "con statement", "citation": "Conflicts with objective: '...'", "significance": "minor|moderate|major" }
      ]
    }
  },
  "tradeoffs": {
    "strategy_id": {
      "optimizesFor": ["what this prioritizes"],
      "sacrifices": ["what this deprioritizes"],
      "assumptions": ["what must be true for this to work"]
    }
  },
  "risks": {
    "strategy_id": [
      {
        "risk": "description",
        "severity": "low|medium|high|critical",
        "likelihood": "unlikely|possible|likely",
        "mitigation": "how to address",
        "affectedObjectives": ["obj_ids that could be impacted"]
      }
    ]
  },
  "recommendation": {
    "recommendedStrategyId": "id of overall best fit",
    "rationale": ["reason 1 with citation", "reason 2 with citation"],
    "ifThenNotes": ["If X is your priority, prefer Y because...", "If Z matters most, consider W instead..."],
    "caveats": ["important considerations"],
    "alternativeFor": { "priority_type": "strategy_id" }
  },
  "overallConfidence": "high|medium|low",
  "dataQualityNotes": ["Any concerns about input data quality"]
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
    const body = (await request.json()) as GenerateComparisonRequest;

    // Validate request
    if (!body.strategyIds || body.strategyIds.length < 2 || body.strategyIds.length > 4) {
      return NextResponse.json(
        { error: 'Must provide 2-4 strategy IDs for comparison' },
        { status: 400 }
      );
    }

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Load all strategies
    const allStrategies = await getStrategiesForCompany(companyId);
    const strategyMap = new Map(allStrategies.map(s => [s.id, s]));

    // Validate all requested strategies exist
    const strategies: CompanyStrategy[] = [];
    for (const id of body.strategyIds) {
      const strategy = strategyMap.get(id);
      if (!strategy) {
        return NextResponse.json(
          { error: `Strategy ${id} not found` },
          { status: 404 }
        );
      }
      strategies.push(strategy);
    }

    // Load context
    const context = await getCompanyContext(companyId);
    const contextGraph = await loadContextGraph(companyId);
    const activeStrategy = await getActiveStrategy(companyId);

    // Get objectives (from active strategy or first strategy)
    const objectives = activeStrategy?.objectives || strategies[0]?.objectives || [];

    // Compute current hashes
    const currentHashes: ComparisonBasedOnHashes = {
      contextHash: hashContext(context),
      objectivesHash: hashObjectives(objectives),
      strategyHashes: {},
    };

    // Build strategy titles map and compute hashes
    const strategyTitles: Record<string, string> = {};
    for (const strategy of strategies) {
      strategyTitles[strategy.id] = strategy.title;
      currentHashes.strategyHashes[strategy.id] = hashStrategy({
        title: strategy.title,
        summary: strategy.summary,
        pillars: strategy.pillars,
        strategyFrame: strategy.strategyFrame,
        tradeoffs: strategy.tradeoffs,
      });
    }

    // Build context for AI
    const aiContext = buildComparisonContext({
      company,
      strategies,
      objectives,
      context,
      contextGraph,
      focusObjectives: body.focusObjectives,
    });

    // Call AI
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: COMPARISON_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: aiContext,
        },
      ],
    });

    // Parse AI response
    const aiResult = parseComparisonResponse(message, strategies, objectives);

    if (aiResult.error) {
      return NextResponse.json(
        { error: aiResult.error, details: aiResult.details },
        { status: 500 }
      );
    }

    // Create comparison record
    const comparisonData: Omit<StrategyComparison, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
      companyId,
      strategyIds: body.strategyIds,
      strategyTitles,
      objectiveCoverage: aiResult.objectiveCoverage || [],
      decisionMatrix: aiResult.decisionMatrix || getDefaultDecisionMatrix(strategies),
      prosCons: aiResult.prosCons || {},
      tradeoffs: aiResult.tradeoffs || {},
      risks: aiResult.risks || {},
      recommendation: aiResult.recommendation || getDefaultRecommendation(strategies[0].id),
      basedOnHashes: currentHashes,
      sourcesUsed: {
        contextFields: getUsedContextFields(context, contextGraph),
        objectiveIds: getObjectiveIds(objectives),
        strategyFields: ['title', 'summary', 'pillars', 'plays', 'tradeoffs'],
      },
      generatedByAI: true,
      aiModel: 'claude-sonnet-4-20250514',
      confidence: aiResult.overallConfidence || 'medium',
    };

    // Save comparison as draft
    const comparison = await createComparison(comparisonData);

    const response: GenerateComparisonResponse = {
      success: true,
      comparison,
      inputHashes: currentHashes,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /strategy/compare/generate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate comparison',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildComparisonContext(params: {
  company: { name: string };
  strategies: CompanyStrategy[];
  objectives: (string | StrategyObjective)[];
  context: unknown;
  contextGraph: unknown;
  focusObjectives?: string[];
}): string {
  const { company, strategies, objectives, context, contextGraph, focusObjectives } = params;

  const sections: string[] = [];

  // Company info
  sections.push(`# Company: ${company.name}\n`);

  // Objectives to evaluate against
  sections.push('## Objectives to Evaluate Against');
  if (objectives.length === 0) {
    sections.push('*No objectives defined - evaluate strategies on general merit*\n');
  } else {
    for (let i = 0; i < objectives.length; i++) {
      const obj = objectives[i];
      const objText = typeof obj === 'string' ? obj : obj.text;
      const objId = typeof obj === 'string' ? `obj_${i}` : (obj.id || `obj_${i}`);
      const isFocus = focusObjectives?.includes(objId);
      sections.push(`- [${objId}] ${objText}${isFocus ? ' (PRIORITY FOCUS)' : ''}`);
    }
    sections.push('');
  }

  // Context snapshot
  sections.push('## Business Context');
  if (context && typeof context === 'object') {
    const ctx = context as Record<string, unknown>;
    if (ctx.identity) sections.push(`### Identity\n${JSON.stringify(ctx.identity, null, 2)}\n`);
    if (ctx.audience) sections.push(`### Audience\n${JSON.stringify(ctx.audience, null, 2)}\n`);
    if (ctx.competition) sections.push(`### Competition\n${JSON.stringify(ctx.competition, null, 2)}\n`);
  } else {
    sections.push('*Limited context data available*\n');
  }

  // Strategies to compare
  sections.push('## Strategies to Compare\n');
  for (const strategy of strategies) {
    sections.push(`### Strategy: ${strategy.title} [ID: ${strategy.id}]`);
    sections.push(`Status: ${strategy.status}${strategy.isActive ? ' (ACTIVE)' : ''}`);

    if (strategy.summary) {
      sections.push(`\n**Summary:** ${strategy.summary}`);
    }

    if (strategy.pillars && strategy.pillars.length > 0) {
      sections.push('\n**Strategic Bets:**');
      for (const pillar of strategy.pillars) {
        sections.push(`- ${pillar.title}: ${pillar.description || 'No description'}`);
        if (pillar.tradeoff) sections.push(`  Tradeoff: ${pillar.tradeoff}`);
      }
    }

    if (strategy.plays && strategy.plays.length > 0) {
      sections.push('\n**Tactics/Plays:**');
      for (const play of strategy.plays) {
        sections.push(`- ${play.title}: ${play.description || 'No description'}`);
      }
    }

    if (strategy.tradeoffs) {
      sections.push('\n**Declared Tradeoffs:**');
      const t = strategy.tradeoffs;
      if (t.optimizesFor?.length) sections.push(`- Optimizes for: ${t.optimizesFor.join(', ')}`);
      if (t.sacrifices?.length) sections.push(`- Sacrifices: ${t.sacrifices.join(', ')}`);
      if (t.risks?.length) sections.push(`- Known risks: ${t.risks.join(', ')}`);
    }

    sections.push('\n---\n');
  }

  return sections.join('\n');
}

interface ParsedComparison {
  objectiveCoverage?: ObjectiveCoverageItem[];
  decisionMatrix?: DecisionMatrixRow[];
  prosCons?: Record<string, StrategyProsCons>;
  tradeoffs?: Record<string, StrategyTradeoffs>;
  risks?: Record<string, RiskItem[]>;
  recommendation?: ComparisonRecommendation;
  overallConfidence?: 'high' | 'medium' | 'low';
  error?: string;
  details?: string;
}

function parseComparisonResponse(
  message: Anthropic.Message,
  strategies: CompanyStrategy[],
  objectives: (string | StrategyObjective)[]
): ParsedComparison {
  const content = message.content[0];
  if (content.type !== 'text') {
    return { error: 'Unexpected AI response format' };
  }

  const text = content.text;

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { error: 'Could not extract JSON from AI response', details: text.substring(0, 500) };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and transform objective coverage
    const objectiveCoverage: ObjectiveCoverageItem[] = [];
    if (parsed.objectiveCoverage && Array.isArray(parsed.objectiveCoverage)) {
      for (const item of parsed.objectiveCoverage) {
        objectiveCoverage.push({
          objectiveId: item.objectiveId || 'unknown',
          objectiveText: item.objectiveText || '',
          perStrategyScore: item.perStrategyScore || {},
          notes: item.notes || '',
        });
      }
    }

    // Validate decision matrix
    const decisionMatrix: DecisionMatrixRow[] = [];
    if (parsed.decisionMatrix && Array.isArray(parsed.decisionMatrix)) {
      for (const row of parsed.decisionMatrix) {
        decisionMatrix.push({
          dimension: row.dimension as ComparisonDimension,
          weight: typeof row.weight === 'number' ? row.weight : 1 / 7,
          perStrategyScore: row.perStrategyScore || {},
          explanation: row.explanation || '',
        });
      }
    }

    // Transform pros/cons
    const prosCons: Record<string, StrategyProsCons> = {};
    if (parsed.prosCons && typeof parsed.prosCons === 'object') {
      for (const [strategyId, data] of Object.entries(parsed.prosCons)) {
        const d = data as { pros?: unknown[]; cons?: unknown[] };
        prosCons[strategyId] = {
          pros: (d.pros || []).map((p: unknown) => {
            const pro = p as { text?: string; citation?: string; significance?: string };
            return {
              text: pro.text || '',
              citation: pro.citation,
              significance: (pro.significance as 'minor' | 'moderate' | 'major') || 'moderate',
            };
          }),
          cons: (d.cons || []).map((c: unknown) => {
            const con = c as { text?: string; citation?: string; significance?: string };
            return {
              text: con.text || '',
              citation: con.citation,
              significance: (con.significance as 'minor' | 'moderate' | 'major') || 'moderate',
            };
          }),
        };
      }
    }

    // Transform tradeoffs
    const tradeoffs: Record<string, StrategyTradeoffs> = {};
    if (parsed.tradeoffs && typeof parsed.tradeoffs === 'object') {
      for (const [strategyId, data] of Object.entries(parsed.tradeoffs)) {
        const d = data as { optimizesFor?: string[]; sacrifices?: string[]; assumptions?: string[] };
        tradeoffs[strategyId] = {
          optimizesFor: d.optimizesFor || [],
          sacrifices: d.sacrifices || [],
          assumptions: d.assumptions || [],
        };
      }
    }

    // Transform risks
    const risks: Record<string, RiskItem[]> = {};
    if (parsed.risks && typeof parsed.risks === 'object') {
      for (const [strategyId, riskList] of Object.entries(parsed.risks)) {
        risks[strategyId] = ((riskList as unknown[]) || []).map((r: unknown) => {
          const risk = r as {
            risk?: string;
            severity?: string;
            likelihood?: string;
            mitigation?: string;
            affectedObjectives?: string[];
          };
          return {
            risk: risk.risk || '',
            severity: (risk.severity as RiskItem['severity']) || 'medium',
            likelihood: (risk.likelihood as RiskItem['likelihood']) || 'possible',
            mitigation: risk.mitigation || '',
            affectedObjectives: risk.affectedObjectives,
          };
        });
      }
    }

    // Transform recommendation
    let recommendation: ComparisonRecommendation | undefined;
    if (parsed.recommendation && typeof parsed.recommendation === 'object') {
      const r = parsed.recommendation as {
        recommendedStrategyId?: string;
        rationale?: string[];
        ifThenNotes?: string[];
        caveats?: string[];
        alternativeFor?: Record<string, string>;
      };
      recommendation = {
        recommendedStrategyId: r.recommendedStrategyId || strategies[0]?.id || '',
        rationale: r.rationale || [],
        ifThenNotes: r.ifThenNotes || [],
        caveats: r.caveats || [],
        alternativeFor: r.alternativeFor || {},
      };
    }

    return {
      objectiveCoverage,
      decisionMatrix,
      prosCons,
      tradeoffs,
      risks,
      recommendation,
      overallConfidence: parsed.overallConfidence || 'medium',
    };
  } catch (error) {
    return {
      error: 'Failed to parse AI response JSON',
      details: error instanceof Error ? error.message : 'Unknown parse error',
    };
  }
}

function getDefaultDecisionMatrix(strategies: CompanyStrategy[]): DecisionMatrixRow[] {
  const dimensions: ComparisonDimension[] = [
    'alignment', 'feasibility', 'differentiation', 'speed', 'risk', 'cost', 'confidence'
  ];

  return dimensions.map(dimension => ({
    dimension,
    weight: 1 / dimensions.length,
    perStrategyScore: Object.fromEntries(strategies.map(s => [s.id, 0.5])),
    explanation: 'Unable to generate comparison - manual scoring required',
  }));
}

function getDefaultRecommendation(strategyId: string): ComparisonRecommendation {
  return {
    recommendedStrategyId: strategyId,
    rationale: ['Unable to generate recommendation - manual review required'],
    ifThenNotes: [],
    caveats: ['AI comparison generation failed - please review strategies manually'],
    alternativeFor: {},
  };
}

function getUsedContextFields(context: unknown, contextGraph: unknown): string[] {
  const fields: string[] = [];
  if (context) fields.push('companyContext');
  if (contextGraph) fields.push('contextGraph');
  return fields;
}

function getObjectiveIds(objectives: (string | StrategyObjective)[]): string[] {
  return objectives.map((obj, i) => {
    if (typeof obj === 'string') return `obj_${i}`;
    return obj.id || `obj_${i}`;
  });
}
