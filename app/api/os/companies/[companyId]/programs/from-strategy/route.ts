// app/api/os/companies/[companyId]/programs/from-strategy/route.ts
// Strategy → Programs → Work Handoff: Generate Draft
//
// AI-FIRST: Generates program drafts from tactics WITHOUT writing canonical data.
// Drafts are persisted server-side and require explicit Apply to create Programs/Work.
//
// Flow: Selected Tactics → AI Generation → Save Draft → Return draftId
//
// DEDUPE: Uses stable keys:
//   - programKey = companyId + strategyId + programType
//   - initiativeKey = programKey + normalize(title)
//   - workKey = initiativeKey + normalize(workTitle)

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStrategyById } from '@/lib/os/strategy';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { inferProgramTypesFromTactics } from '@/lib/os/strategy/strategyToPrograms';
import { saveHandoffDraft, getHandoffDraftStats } from '@/lib/os/programs/handoffDrafts';
import { computeAllHashes } from '@/lib/os/strategy/hashes';
import type { StrategyPlay } from '@/lib/types/strategy';
import type {
  ExtendedProgramType,
  DraftProgram,
  DraftInitiative,
  DraftWorkItem,
  GenerateHandoffResponse,
  generateProgramKey,
  generateInitiativeKey,
  generateWorkKey,
} from '@/lib/types/programHandoff';

// ============================================================================
// Types
// ============================================================================

interface FromStrategyRequest {
  /** Strategy ID to pull tactics from */
  strategyId: string;
  /** Tactic IDs to promote (required) */
  tacticIds: string[];
}

// ============================================================================
// POST Handler - Generate and Save Draft
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = (await request.json()) as FromStrategyRequest;

    const { strategyId, tacticIds } = body;

    if (!strategyId) {
      return NextResponse.json(
        { error: 'Missing strategyId' },
        { status: 400 }
      );
    }

    if (!tacticIds || tacticIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing tacticIds - select at least one tactic to promote' },
        { status: 400 }
      );
    }

    console.log('[from-strategy] Generating draft programs:', { companyId, strategyId, tacticCount: tacticIds.length });

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

    // 2. Filter tactics
    const allTactics = strategy.plays || [];
    const selectedTactics = allTactics.filter(t => tacticIds.includes(t.id));

    if (selectedTactics.length === 0) {
      return NextResponse.json(
        { error: 'No matching tactics found for provided IDs' },
        { status: 400 }
      );
    }

    // 3. Load context for AI
    const context = await loadContextGraph(companyId);

    // 4. Infer program types from tactic channels
    const allChannels = selectedTactics.flatMap(t => t.channels || []);
    const programTypes = inferProgramTypesFromTactics(allChannels);

    if (programTypes.length === 0) {
      // Default to content if no channels specified
      programTypes.push('content');
    }

    // 5. Compute hashes for staleness detection
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

    // 6. Generate programs via AI
    const prompt = buildPrompt(strategy, selectedTactics, context, programTypes);

    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiContent = message.content[0];
    if (aiContent.type !== 'text') {
      throw new Error('Unexpected AI response type');
    }

    // 7. Parse AI response and add stable keys
    const { programs, reasoning, warnings } = parseAIResponse(
      aiContent.text,
      selectedTactics,
      programTypes,
      companyId,
      strategyId
    );

    // 8. Save draft to database (upserts by draftKey)
    const objectives = strategy.objectives || [];
    const objectiveIds = objectives.map((o: { id?: string }) => o.id).filter(Boolean) as string[];
    const priorityIds = (strategy.pillars || []).map((p: { id?: string }) => p.id).filter(Boolean) as string[];

    const savedDraft = await saveHandoffDraft({
      companyId,
      strategyId,
      strategyTitle: strategy.title || 'Untitled Strategy',
      tacticIds,
      programs,
      reasoning,
      warnings,
      basedOnHashes: {
        strategyHash: hashes.strategyHash,
        objectivesHash: hashes.objectivesHash,
        tacticsHash: hashes.tacticsHash,
      },
      linkedObjectiveIds: objectiveIds,
      linkedPriorityIds: priorityIds,
    });

    // 9. Return response with draft info
    const stats = getHandoffDraftStats(savedDraft);

    console.log('[from-strategy] Saved draft:', {
      draftId: savedDraft.id,
      programCount: stats.programCount,
      initiativeCount: stats.initiativeCount,
      workItemCount: stats.workItemCount,
    });

    const response: GenerateHandoffResponse = {
      success: true,
      draftId: savedDraft.id,
      draftKey: savedDraft.draftKey,
      programs: savedDraft.programs,
      reasoning: savedDraft.reasoning,
      warnings: savedDraft.warnings,
      stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[from-strategy] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate programs' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET Handler - Retrieve existing draft for this strategy
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get('strategyId');

    if (!strategyId) {
      return NextResponse.json(
        { error: 'Missing strategyId query param' },
        { status: 400 }
      );
    }

    const { getHandoffDraftByKey } = await import('@/lib/os/programs/handoffDrafts');
    const draft = await getHandoffDraftByKey(companyId, strategyId);

    if (!draft) {
      return NextResponse.json({ draft: null });
    }

    const { getHandoffDraftStats: getStats } = await import('@/lib/os/programs/handoffDrafts');
    const stats = getStats(draft);

    return NextResponse.json({
      draft,
      stats,
    });
  } catch (error) {
    console.error('[from-strategy] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get draft' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Prompt Building
// ============================================================================

function buildPrompt(
  strategy: NonNullable<Awaited<ReturnType<typeof getStrategyById>>>,
  tactics: StrategyPlay[],
  context: unknown,
  programTypes: ExtendedProgramType[]
): string {
  const objectives = strategy.objectives || [];

  return `You are a strategic marketing program planner. Convert selected tactics into executable programs.

## Strategy Context
Title: ${strategy.title}
Summary: ${strategy.summary || 'No summary'}

### Objectives
${objectives.map((o, i) => {
  const obj = typeof o === 'string' ? { text: o } : o;
  return `${i + 1}. ${obj.text}`;
}).join('\n')}

### Selected Tactics to Convert
${tactics.map((t, i) => `${i + 1}. **${t.title}** (ID: ${t.id})
   - Description: ${t.description || 'No description'}
   - Channels: ${(t.channels || []).join(', ') || 'Not specified'}
   - Impact: ${t.impact || 'medium'}
   - Effort: ${t.effort || 'medium'}`).join('\n\n')}

## Task
Convert these ${tactics.length} tactics into draft programs. Group related tactics into programs by type.

Program types to consider: ${programTypes.join(', ')}

For each program:
1. Create 2-4 initiatives derived from the tactics
2. Each initiative should have 2-3 work items

## Output Format
Return JSON:
\`\`\`json
{
  "reasoning": "Brief explanation of how tactics were grouped",
  "warnings": ["Any concerns or gaps"],
  "programs": [
    {
      "programType": "content|website|seo|media|brand|analytics|demand",
      "title": "Program title",
      "summary": "2-3 sentences",
      "objectiveFraming": "How this supports objectives",
      "tacticIds": ["ids of tactics included"],
      "initiatives": [
        {
          "title": "Initiative",
          "description": "What it achieves",
          "expectedImpact": "Expected outcome",
          "impactLevel": "high|medium|low",
          "effort": "S|M|L",
          "sequence": "now|next|later",
          "workItems": [
            {
              "title": "Work item title",
              "description": "What to do",
              "effort": "S|M|L",
              "category": "content|website|seo|etc"
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

Return ONLY valid JSON, no additional text.`;
}

// ============================================================================
// Response Parsing with Stable Keys
// ============================================================================

function normalizeForKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

function parseAIResponse(
  text: string,
  tactics: StrategyPlay[],
  programTypes: ExtendedProgramType[],
  companyId: string,
  strategyId: string
): { programs: DraftProgram[]; reasoning: string; warnings: string[] } {
  // Extract JSON from response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate and normalize programs with stable keys
    const programs: DraftProgram[] = (parsed.programs || []).map((p: Record<string, unknown>) => {
      const programType = programTypes.includes(p.programType as ExtendedProgramType)
        ? (p.programType as ExtendedProgramType)
        : programTypes[0];

      const programKey = `${companyId}:${strategyId}:${programType}`;

      const initiatives: DraftInitiative[] = ((p.initiatives || []) as Record<string, unknown>[]).map(i => {
        const initiativeTitle = String(i.title || 'Untitled Initiative');
        const initiativeKey = `${programKey}:${normalizeForKey(initiativeTitle)}`;

        const workItems: DraftWorkItem[] = ((i.workItems || []) as Record<string, unknown>[]).map(w => {
          const workTitle = String(w.title || 'Untitled Work Item');
          const workKey = `${initiativeKey}:${normalizeForKey(workTitle)}`;

          return {
            workKey,
            title: workTitle,
            description: String(w.description || ''),
            effort: (['S', 'M', 'L'].includes(w.effort as string) ? w.effort : 'M') as 'S' | 'M' | 'L',
            category: String(w.category || 'other'),
          };
        });

        return {
          initiativeKey,
          title: initiativeTitle,
          description: String(i.description || ''),
          expectedImpact: String(i.expectedImpact || ''),
          impactLevel: (['high', 'medium', 'low'].includes(i.impactLevel as string)
            ? i.impactLevel
            : 'medium') as 'high' | 'medium' | 'low',
          effort: (['S', 'M', 'L'].includes(i.effort as string) ? i.effort : 'M') as 'S' | 'M' | 'L',
          sequence: (['now', 'next', 'later'].includes(i.sequence as string)
            ? i.sequence
            : 'next') as 'now' | 'next' | 'later',
          workItems,
        };
      });

      return {
        programKey,
        programType,
        title: String(p.title || 'Untitled Program'),
        summary: String(p.summary || ''),
        objectiveFraming: String(p.objectiveFraming || ''),
        tacticIds: Array.isArray(p.tacticIds)
          ? p.tacticIds.filter((id: unknown) => tactics.some(t => t.id === id))
          : tactics.map(t => t.id),
        initiatives,
      };
    });

    return {
      programs,
      reasoning: String(parsed.reasoning || 'Tactics grouped by channel affinity'),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
    };
  } catch (err) {
    console.error('[from-strategy] Failed to parse AI response:', err);

    // Return a fallback structure with stable keys
    const programType = programTypes[0] || 'content';
    const programKey = `${companyId}:${strategyId}:${programType}`;

    return {
      programs: [{
        programKey,
        programType,
        title: `${programType.charAt(0).toUpperCase() + programType.slice(1)} Program`,
        summary: 'Program generated from selected tactics',
        objectiveFraming: 'Supports strategic objectives',
        tacticIds: tactics.map(t => t.id),
        initiatives: tactics.map(t => {
          const initiativeKey = `${programKey}:${normalizeForKey(t.title)}`;
          return {
            initiativeKey,
            title: t.title,
            description: t.description || '',
            expectedImpact: 'Supports tactic execution',
            impactLevel: (t.impact || 'medium') as 'high' | 'medium' | 'low',
            effort: (t.effort || 'M') as 'S' | 'M' | 'L',
            sequence: 'next' as const,
            workItems: [{
              workKey: `${initiativeKey}:${normalizeForKey('execute_' + t.title)}`,
              title: `Execute: ${t.title}`,
              description: t.description || 'Complete this tactic',
              effort: (t.effort || 'M') as 'S' | 'M' | 'L',
              category: (t.channels?.[0] || 'other'),
            }],
          };
        }),
      }],
      reasoning: 'Fallback: Each tactic converted to an initiative',
      warnings: ['AI response parsing failed, using fallback structure'],
    };
  }
}
