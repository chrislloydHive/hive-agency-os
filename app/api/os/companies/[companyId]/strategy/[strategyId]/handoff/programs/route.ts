// app/api/os/companies/[companyId]/strategy/[strategyId]/handoff/programs/route.ts
// Generate Programs & Work from Strategy
//
// WHY: Single endpoint for AI-first handoff from Strategy to executable Programs.
// Loads all upstream context and generates a structured proposal that the user can review and apply.
//
// FLOW: Strategy + Context → AI Generation → StrategyProgramProposal (draft)

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStrategyById } from '@/lib/os/strategy';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeAllHashes } from '@/lib/os/strategy/hashes';
import {
  type StrategyProgramProposal,
  type ProposedProgram,
  type ProposedInitiative,
  type ProposedWorkItem,
  type ExtendedProgramType,
  generateProgramKey,
  generateInitiativeKey,
  generateWorkKey,
  inferProgramTypesFromTactics,
  sequenceToPhase,
  impactToPriority,
  PROGRAM_TYPE_TO_CATEGORY,
} from '@/lib/os/strategy/strategyToPrograms';
import { saveDraft } from '@/lib/os/strategy/drafts';

// ============================================================================
// Types
// ============================================================================

interface GenerateProgramsRequest {
  /** Optional: Only include these tactic IDs (if not provided, uses all) */
  tacticIds?: string[];
  /** Optional: Only generate these program types */
  programTypes?: ExtendedProgramType[];
}

interface GenerateProgramsResponse {
  proposal: StrategyProgramProposal;
  draftId?: string;
}

// ============================================================================
// POST Handler - Generate Programs Proposal
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; strategyId: string }> }
) {
  try {
    const { companyId, strategyId } = await params;
    const body = (await request.json()) as GenerateProgramsRequest;

    console.log('[handoff/programs] Starting generation:', { companyId, strategyId });

    // 1. Load strategy
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    if (strategy.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Strategy does not belong to this company' },
        { status: 403 }
      );
    }

    // 2. Load context
    const context = await loadContextGraph(companyId);

    // 3. Compute hashes for staleness tracking
    const hashes = computeAllHashes(
      context,
      strategy.objectives || [],
      {
        title: strategy.title,
        summary: strategy.summary,
        pillars: strategy.pillars,
        strategyFrame: strategy.strategyFrame,
        tradeoffs: strategy.tradeoffs,
      },
      strategy.plays || []
    );

    // 4. Filter tactics if specified
    let tactics = strategy.plays || [];
    if (body.tacticIds && body.tacticIds.length > 0) {
      tactics = tactics.filter(t => body.tacticIds!.includes(t.id));
    }

    // 5. Determine program types
    let programTypes = body.programTypes;
    if (!programTypes || programTypes.length === 0) {
      // Infer from tactic channels
      const allChannels = tactics.flatMap(t => t.channels || []);
      programTypes = inferProgramTypesFromTactics(allChannels);
    }

    // 6. Build AI prompt
    const prompt = buildGenerationPrompt(strategy, tactics, context, programTypes);

    // 7. Call AI
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const aiContent = message.content[0];
    if (aiContent.type !== 'text') {
      throw new Error('Unexpected AI response type');
    }

    // 8. Parse AI response
    const aiResponse = parseAIResponse(aiContent.text);

    // 9. Build proposal with stable keys
    const proposal = buildProposal(
      companyId,
      strategyId,
      strategy,
      aiResponse,
      hashes,
      programTypes
    );

    // 10. Save proposal as draft
    let draftId: string | undefined;
    try {
      const draft = await saveDraft({
        companyId,
        strategyId,
        scopeType: 'strategy',
        fieldKey: 'handoff_proposal',
        entityId: proposal.id,
        draftValue: JSON.stringify(proposal),
        originalValue: undefined,
        rationale: [aiResponse.reasoning || 'AI-generated program handoff proposal'],
        confidence: aiResponse.confidence || 'medium',
        sourcesUsed: ['context', 'objectives', 'strategy', 'tactics'],
        basedOnHashes: hashes,
      });
      draftId = draft.id;
    } catch (err) {
      console.warn('[handoff/programs] Failed to save draft:', err);
    }

    console.log('[handoff/programs] Generated proposal:', {
      proposalId: proposal.id,
      programCount: proposal.programs.length,
      draftId,
    });

    const response: GenerateProgramsResponse = {
      proposal,
      draftId,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[handoff/programs] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate programs' },
      { status: 500 }
    );
  }
}

// ============================================================================
// AI Prompt Building
// ============================================================================

function buildGenerationPrompt(
  strategy: NonNullable<Awaited<ReturnType<typeof getStrategyById>>>,
  tactics: NonNullable<Awaited<ReturnType<typeof getStrategyById>>>['plays'],
  context: unknown,
  programTypes: ExtendedProgramType[]
): string {
  const objectives = strategy.objectives || [];
  const priorities = strategy.pillars || [];

  return `You are a strategic marketing program planner. Your task is to convert a marketing strategy into executable programs and work items.

## INPUT: Strategy
Title: ${strategy.title}
Summary: ${strategy.summary || 'No summary'}

### Objectives
${objectives.map((o, i) => {
  const obj = typeof o === 'string' ? { text: o, metric: undefined, target: undefined } : o;
  return `${i + 1}. ${obj.text}${obj.metric ? ` (Metric: ${obj.metric}${obj.target ? ` Target: ${obj.target}` : ''})` : ''}`;
}).join('\n')}

### Strategic Bets
${priorities.map((p, i) => `${i + 1}. **${p.title}**: ${p.description}`).join('\n')}

### Tactics
${(tactics || []).map((t, i) => `${i + 1}. **${t.title}**: ${t.description || 'No description'}
   - Channels: ${(t.channels || []).join(', ') || 'Not specified'}
   - Impact: ${t.impact || 'medium'}
   - Effort: ${t.effort || 'medium'}`).join('\n\n')}

## INPUT: Company Context
${JSON.stringify(context, null, 2).slice(0, 3000)}...

## TASK
Generate programs for these types: ${programTypes.join(', ')}

For each program, create:
1. Initiatives (3-5 per program) with clear outcomes
2. Work items (2-4 per initiative) that are small enough to execute in 1-5 days

## OUTPUT FORMAT
Return a JSON object with this structure:
\`\`\`json
{
  "programs": [
    {
      "programType": "website|content|seo|media|brand|analytics|demand",
      "title": "Program title",
      "summary": "2-3 sentence summary",
      "objectiveFraming": "Why this program matters for objectives",
      "currentState": "Brief assessment of current state",
      "priorities": [{"label": "Priority 1", "rationale": "Why"}],
      "readinessGates": [{"gate": "Gate name", "criteria": ["criterion 1"]}],
      "initiatives": [
        {
          "title": "Initiative title",
          "description": "What this achieves",
          "expectedImpact": "Description of expected impact",
          "impactLevel": "high|medium|low",
          "dependencies": ["dependency 1"],
          "kpis": ["KPI 1"],
          "effort": "S|M|L",
          "sequence": "now|next|later",
          "rationale": "Why this initiative matters",
          "objectiveIds": ["objective IDs this supports"],
          "priorityIds": ["priority IDs this supports"],
          "tacticIds": ["tactic IDs this implements"],
          "workItems": [
            {
              "title": "Short actionable title (6-10 words)",
              "description": "What needs to be done (2-3 sentences)",
              "howToImplement": "Step-by-step guide",
              "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
              "effort": "S|M|L",
              "impact": "high|medium|low",
              "whyItMatters": "Reference to objective + strategy rationale"
            }
          ]
        }
      ],
      "objectiveIds": ["all objective IDs this program addresses"],
      "priorityIds": ["all priority IDs this program addresses"],
      "tacticIds": ["all tactic IDs this program implements"]
    }
  ],
  "reasoning": "Brief explanation of how programs were structured",
  "confidence": "high|medium|low",
  "warnings": ["Any concerns or notes"]
}
\`\`\`

## IMPORTANT RULES
1. Work items should be 1-5 days of effort
2. Include "whyItMatters" referencing specific objectives/priorities
3. Use "now" for immediate priorities, "next" for near-term, "later" for future
4. Every initiative must link back to at least one objective
5. Be specific - avoid generic titles like "Improve X"`;
}

// ============================================================================
// Response Parsing
// ============================================================================

interface AIGeneratedProgram {
  programType: ExtendedProgramType;
  title: string;
  summary: string;
  objectiveFraming: string;
  currentState: string;
  priorities: Array<{ label: string; rationale?: string }>;
  readinessGates: Array<{ gate: string; criteria: string[] }>;
  initiatives: Array<{
    title: string;
    description: string;
    expectedImpact: string;
    impactLevel: 'high' | 'medium' | 'low';
    dependencies: string[];
    kpis: string[];
    effort: 'S' | 'M' | 'L';
    sequence: 'now' | 'next' | 'later';
    rationale: string;
    objectiveIds: string[];
    priorityIds: string[];
    tacticIds: string[];
    workItems: Array<{
      title: string;
      description: string;
      howToImplement?: string;
      acceptanceCriteria: string[];
      effort: 'S' | 'M' | 'L';
      impact: 'high' | 'medium' | 'low';
      whyItMatters: string;
    }>;
  }>;
  objectiveIds: string[];
  priorityIds: string[];
  tacticIds: string[];
}

interface AIResponse {
  programs: AIGeneratedProgram[];
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

function parseAIResponse(text: string): AIResponse {
  // Extract JSON from response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      programs: parsed.programs || [],
      reasoning: parsed.reasoning || '',
      confidence: parsed.confidence || 'medium',
      warnings: parsed.warnings || [],
    };
  } catch (error) {
    console.error('[handoff/programs] Failed to parse AI response:', error);
    throw new Error('Failed to parse AI-generated programs');
  }
}

// ============================================================================
// Proposal Building
// ============================================================================

function buildProposal(
  companyId: string,
  strategyId: string,
  strategy: NonNullable<Awaited<ReturnType<typeof getStrategyById>>>,
  aiResponse: AIResponse,
  hashes: ReturnType<typeof computeAllHashes>,
  programTypes: ExtendedProgramType[]
): StrategyProgramProposal {
  const proposalId = `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Collect all objective/priority/tactic IDs for source linkage
  const allObjectiveIds = new Set<string>();
  const allPriorityIds = new Set<string>();
  const allTacticIds = new Set<string>();

  // Build programs with stable keys
  const programs: ProposedProgram[] = aiResponse.programs.map(aiProgram => {
    const programKey = generateProgramKey(companyId, strategyId, aiProgram.programType);

    // Build initiatives with stable keys
    const initiatives: ProposedInitiative[] = aiProgram.initiatives.map(aiInit => {
      const initiativeKey = generateInitiativeKey(programKey, aiInit.title);

      // Build work items with stable keys
      const workItems: ProposedWorkItem[] = aiInit.workItems.map(aiWork => {
        const workKey = generateWorkKey(initiativeKey, aiWork.title);

        return {
          workKey,
          title: aiWork.title,
          description: aiWork.description,
          howToImplement: aiWork.howToImplement,
          acceptanceCriteria: aiWork.acceptanceCriteria || [],
          effort: aiWork.effort || 'M',
          impact: aiWork.impact || 'medium',
          suggestedPriority: impactToPriority(aiWork.impact || 'medium'),
          category: PROGRAM_TYPE_TO_CATEGORY[aiProgram.programType] || 'other',
          tags: [aiProgram.programType, ...aiInit.kpis.slice(0, 2)],
          whyItMatters: aiWork.whyItMatters || '',
          ownerPlaceholder: 'TBD',
          dueDatePlaceholder: aiInit.sequence === 'now' ? 'Week 1-2' : aiInit.sequence === 'next' ? 'Week 3-4' : 'Week 5+',
        };
      });

      // Track IDs
      aiInit.objectiveIds.forEach(id => allObjectiveIds.add(id));
      aiInit.priorityIds.forEach(id => allPriorityIds.add(id));
      aiInit.tacticIds.forEach(id => allTacticIds.add(id));

      return {
        initiativeKey,
        title: aiInit.title,
        description: aiInit.description,
        expectedImpact: aiInit.expectedImpact,
        impactLevel: aiInit.impactLevel || 'medium',
        dependencies: aiInit.dependencies || [],
        kpis: aiInit.kpis || [],
        effort: aiInit.effort || 'M',
        sequence: aiInit.sequence || 'next',
        rationale: aiInit.rationale || '',
        workItems,
        objectiveIds: aiInit.objectiveIds || [],
        priorityIds: aiInit.priorityIds || [],
        tacticIds: aiInit.tacticIds || [],
      };
    });

    // Build sequencing phases from initiatives
    const sequencing = buildSequencingPhases(initiatives);

    // Track IDs
    aiProgram.objectiveIds.forEach(id => allObjectiveIds.add(id));
    aiProgram.priorityIds.forEach(id => allPriorityIds.add(id));
    aiProgram.tacticIds.forEach(id => allTacticIds.add(id));

    return {
      programKey,
      programType: aiProgram.programType,
      title: aiProgram.title,
      summary: aiProgram.summary,
      objectiveFraming: aiProgram.objectiveFraming || '',
      currentState: aiProgram.currentState || '',
      priorities: aiProgram.priorities || [],
      sequencing,
      readinessGates: aiProgram.readinessGates || [],
      initiatives,
      objectiveIds: aiProgram.objectiveIds || [],
      priorityIds: aiProgram.priorityIds || [],
      tacticIds: aiProgram.tacticIds || [],
    };
  });

  return {
    id: proposalId,
    companyId,
    source: {
      strategyId,
      strategyTitle: strategy.title,
      objectiveIds: Array.from(allObjectiveIds),
      priorityIds: Array.from(allPriorityIds),
      tacticIds: Array.from(allTacticIds),
      basedOnHashes: hashes,
    },
    programs,
    reasoning: aiResponse.reasoning,
    confidence: aiResponse.confidence,
    warnings: aiResponse.warnings,
    createdAt: new Date().toISOString(),
    status: 'draft',
  };
}

/**
 * Build sequencing phases from initiatives grouped by sequence
 */
function buildSequencingPhases(initiatives: ProposedInitiative[]): Array<{ phase: string; items: string[] }> {
  const phases: Record<string, string[]> = {
    'Phase 1: Immediate': [],
    'Phase 2: Near-term': [],
    'Phase 3: Future': [],
  };

  for (const init of initiatives) {
    const phaseName = sequenceToPhase(init.sequence);
    phases[phaseName].push(init.title);
  }

  return Object.entries(phases)
    .filter(([_, items]) => items.length > 0)
    .map(([phase, items]) => ({ phase, items }));
}
