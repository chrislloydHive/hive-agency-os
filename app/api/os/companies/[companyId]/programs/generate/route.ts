// app/api/os/companies/[companyId]/programs/generate/route.ts
// AI Program Generation Endpoint
//
// Generates Program drafts using AI based on:
// - Context Graph (identity, audience, objectives, constraints)
// - Canonical Strategy (if exists)
// - Domain-specific Lab findings (Website Lab or Content Lab)
//
// Program Types:
// - website: Website Program using Website Lab findings
// - content: Content Program using Content Lab findings
//
// Modes:
// - create: Generate a fresh program draft
// - refresh: Improve an existing program draft
//
// Returns a proposal (never auto-persists)

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { readStrategyFromContextGraph } from '@/lib/contextGraph/domain-writers/strategyWriter';
import { getProgramById } from '@/lib/airtable/programs';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type {
  ProgramGenerationMode,
  ProgramType,
  AIProgramDraft,
  GenerateProgramResponse,
  ProgramRecord,
  ProgramPriority,
  ProgramPhase,
  ProgramExclusion,
  ProgramReadinessGate,
  ProgramInputsSnapshot,
} from '@/lib/types/program';

export const maxDuration = 120;

// ============================================================================
// System Prompts
// ============================================================================

const WEBSITE_SYSTEM_PROMPT = `You are a senior marketing strategist creating a Website Program for a company.

A Website Program sits BETWEEN Strategy and Planning:
- Strategy defines the "what" and "why" (goals, positioning, audience)
- Programs define the "how" at a domain level (priorities, sequencing, readiness criteria)
- Planners execute with specific work items (you do NOT create work items)

Your job is to translate strategy and current website state into a prioritized, sequenced program that guides website work.

================================
YOUR OUTPUTS
================================

You must produce a complete Website Program draft with:

1. OBJECTIVE FRAMING (2-3 sentences)
   - What is the website trying to achieve?
   - How does this connect to the business strategy?

2. CURRENT STATE SUMMARY (2-4 sentences)
   - What is the website's current condition?
   - What are the key gaps between current state and objectives?

3. PRIORITIES (3-5 items, ordered)
   - What should website work focus on, in what order?
   - Each priority needs a clear label and rationale

4. SEQUENCING (3 phases)
   - Phase 1: Fix fundamentals (what must be fixed first)
   - Phase 2: Build conversion paths (optimize for goals)
   - Phase 3: Optimize and measure (ongoing improvement)
   - Each phase has 3-5 specific items

5. EXCLUSIONS (2-4 items)
   - What is explicitly OUT OF SCOPE for this program?
   - Prevents scope creep and clarifies focus

6. READINESS GATES (2-4 gates)
   - What must be true before specific work can start?
   - E.g., "Traffic-ready landing page exists" with specific criteria

7. ASSUMPTIONS (2-4 items)
   - What are you assuming based on the context?

8. UNKNOWNS (1-3 items)
   - What information is missing that could change the program?

9. DEPENDENCIES (1-3 items)
   - What external factors does this program depend on?

================================
OUTPUT FORMAT
================================

Return a JSON object matching this structure exactly:

{
  "title": "Company Name Website Program",
  "summary": "1-2 sentence program summary",
  "objectiveFraming": "2-3 sentences on objectives",
  "currentStateSummary": "2-4 sentences on current state",
  "priorities": [
    { "label": "Priority name", "rationale": "Why this priority matters" }
  ],
  "sequencing": [
    { "phase": "Phase 1: Fix fundamentals", "items": ["item1", "item2", "item3"] }
  ],
  "exclusions": [
    { "item": "What's excluded", "reason": "Why it's excluded" }
  ],
  "readinessGates": [
    { "gate": "Gate name", "criteria": ["criterion1", "criterion2"] }
  ],
  "assumptions": ["Assumption 1", "Assumption 2"],
  "unknowns": ["Unknown 1"],
  "dependencies": ["Dependency 1"],
  "reasoning": "Brief explanation of how you arrived at this program"
}

================================
RULES
================================

1. Be SPECIFIC - reference actual context (company name, audience, objectives)
2. Be REALISTIC - consider constraints (budget, timeline, capabilities)
3. Be HONEST - clearly state assumptions and unknowns
4. Focus on WEBSITE domain only - not content strategy, media, or other domains
5. DO NOT create work items or tasks - only priorities and sequencing
6. DO NOT recommend tactics - stay at program level
7. Priorities should be ACTIONABLE but not granular
8. Sequencing should be LOGICAL - dependencies flow correctly
9. Readiness gates should be MEASURABLE - clear pass/fail criteria`;

const CONTENT_SYSTEM_PROMPT = `You are a senior content strategist creating a Content Program for a company.

A Content Program sits BETWEEN Strategy and Planning:
- Strategy defines the "what" and "why" (goals, positioning, audience)
- Programs define the "how" at a domain level (priorities, sequencing, readiness criteria)
- Planners execute with specific work items (you do NOT create work items)

Your job is to translate strategy and content state into a prioritized, sequenced program that guides content creation and distribution.

================================
YOUR OUTPUTS
================================

You must produce a complete Content Program draft with:

1. OBJECTIVE FRAMING (2-3 sentences)
   - What is the content trying to achieve?
   - How does this connect to the business strategy?

2. CURRENT STATE SUMMARY (2-4 sentences)
   - What is the content's current condition?
   - What are the key gaps between current state and objectives?

3. PRIORITIES (3-5 items, ordered)
   - What should content work focus on, in what order?
   - Each priority needs a clear label and rationale

4. SEQUENCING (3 phases)
   - Phase 1: Foundation (establish core content pillars)
   - Phase 2: Build pipeline (create sustainable production)
   - Phase 3: Optimize and scale (ongoing improvement)
   - Each phase has 3-5 specific items

5. EXCLUSIONS (2-4 items)
   - What is explicitly OUT OF SCOPE for this program?
   - Prevents scope creep and clarifies focus

6. READINESS GATES (2-4 gates)
   - What must be true before specific content work can start?
   - E.g., "Brand guidelines documented" with specific criteria

7. ASSUMPTIONS (2-4 items)
   - What are you assuming based on the context?

8. UNKNOWNS (1-3 items)
   - What information is missing that could change the program?

9. DEPENDENCIES (1-3 items)
   - What external factors does this program depend on?

================================
OUTPUT FORMAT
================================

Return a JSON object matching this structure exactly:

{
  "title": "Company Name Content Program",
  "summary": "1-2 sentence program summary",
  "objectiveFraming": "2-3 sentences on objectives",
  "currentStateSummary": "2-4 sentences on current state",
  "priorities": [
    { "label": "Priority name", "rationale": "Why this priority matters" }
  ],
  "sequencing": [
    { "phase": "Phase 1: Foundation", "items": ["item1", "item2", "item3"] }
  ],
  "exclusions": [
    { "item": "What's excluded", "reason": "Why it's excluded" }
  ],
  "readinessGates": [
    { "gate": "Gate name", "criteria": ["criterion1", "criterion2"] }
  ],
  "assumptions": ["Assumption 1", "Assumption 2"],
  "unknowns": ["Unknown 1"],
  "dependencies": ["Dependency 1"],
  "reasoning": "Brief explanation of how you arrived at this program"
}

================================
RULES
================================

1. Be SPECIFIC - reference actual context (company name, audience, objectives)
2. Be REALISTIC - consider constraints (budget, timeline, capabilities)
3. Be HONEST - clearly state assumptions and unknowns
4. Focus on CONTENT domain only - not website, media buying, or other domains
5. DO NOT create work items or tasks - only priorities and sequencing
6. DO NOT recommend specific content pieces - stay at program level
7. Priorities should be ACTIONABLE but not granular
8. Sequencing should be LOGICAL - dependencies flow correctly
9. Readiness gates should be MEASURABLE - clear pass/fail criteria`;

/**
 * Get the system prompt for a given program type
 */
function getSystemPrompt(programType: ProgramType): string {
  switch (programType) {
    case 'content':
      return CONTENT_SYSTEM_PROMPT;
    case 'website':
    default:
      return WEBSITE_SYSTEM_PROMPT;
  }
}

// ============================================================================
// API Handler
// ============================================================================

type RouteParams = {
  params: Promise<{ companyId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    const mode: ProgramGenerationMode = body.mode || 'create';
    const programType: ProgramType = body.programType || 'website';
    const existingProgramId: string | undefined = body.existingProgramId;

    // Validate refresh mode has existing program
    if (mode === 'refresh' && !existingProgramId) {
      return NextResponse.json(
        { error: 'existingProgramId required for refresh mode' },
        { status: 400 }
      );
    }

    // Fetch all inputs in parallel
    const [contextGraph, strategyData, existingProgram] = await Promise.all([
      loadContextGraph(companyId),
      readStrategyFromContextGraph(companyId),
      existingProgramId ? getProgramById(existingProgramId) : null,
    ]);

    // Build the prompt based on program type
    const prompt = buildPrompt(
      companyId,
      contextGraph,
      strategyData,
      mode,
      programType,
      existingProgram
    );

    // Call Anthropic with program-type-specific system prompt
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        { role: 'user', content: prompt },
      ],
      system: getSystemPrompt(programType),
    });

    // Extract content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Parse JSON from response
    const parsed = parseAIResponse(textContent.text);

    // Build the draft with program-type-specific defaults
    const programLabel = programType === 'content' ? 'Content' : 'Website';
    const draft: AIProgramDraft = {
      title: (parsed.title as string) || `${contextGraph?.companyName || 'Company'} ${programLabel} Program`,
      summary: (parsed.summary as string) || `${programLabel} program generated by AI.`,
      objectiveFraming: (parsed.objectiveFraming as string) || '',
      currentStateSummary: (parsed.currentStateSummary as string) || '',
      priorities: validatePriorities(parsed.priorities),
      sequencing: validateSequencing(parsed.sequencing, programType),
      exclusions: validateExclusions(parsed.exclusions, programType),
      readinessGates: validateReadinessGates(parsed.readinessGates, programType),
      assumptions: Array.isArray(parsed.assumptions) ? (parsed.assumptions as string[]) : [],
      unknowns: Array.isArray(parsed.unknowns) ? (parsed.unknowns as string[]) : [],
      dependencies: Array.isArray(parsed.dependencies) ? (parsed.dependencies as string[]) : [],
      inputsSnapshot: buildInputsSnapshot(companyId, contextGraph, strategyData, programType),
    };

    // Compute inputs used from actual data availability (not truthy objects)
    const hasContext = !!(contextGraph && contextGraph.companyName);
    const hasStrategy = !!(strategyData && Object.keys(strategyData).length > 0);
    const hasWebsiteLab = !!(contextGraph?.website?.executiveSummary?.value);
    const hasContentLab = !!(contextGraph?.content?.contentSummary?.value);

    const result: GenerateProgramResponse = {
      draft,
      reasoning: (parsed.reasoning as string) || 'Generated based on available context.',
      programType,
      inputsUsed: {
        hasContext,
        hasStrategy,
        hasWebsiteLab,
        hasContentLab,
      },
    };

    console.log('[programs/generate] Generated draft for', companyId, 'type:', programType, 'mode:', mode);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[programs/generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate program' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

interface StrategyData {
  id?: string;
  positioning?: { value?: string };
  primaryObjective?: { value?: string };
  strategicThemes?: { value?: string[] };
}

function buildPrompt(
  companyId: string,
  contextGraph: CompanyContextGraph | null,
  strategyData: StrategyData | null,
  mode: ProgramGenerationMode,
  programType: ProgramType,
  existingProgram: ProgramRecord | null
): string {
  const parts: string[] = [];
  const programLabel = programType === 'content' ? 'Content' : 'Website';

  // Mode instruction
  if (mode === 'refresh' && existingProgram) {
    parts.push(`MODE: REFRESH - Improve the existing ${programLabel} Program draft based on the latest inputs.
Do NOT start from scratch. Build on the existing program while incorporating any new information.

EXISTING PROGRAM:
${JSON.stringify(existingProgram.plan, null, 2)}

---`);
  } else {
    parts.push(`MODE: CREATE - Generate a fresh ${programLabel} Program draft.`);
  }

  // Company info
  parts.push(`
================================
COMPANY INFORMATION
================================
Company ID: ${companyId}
Company Name: ${contextGraph?.companyName || 'Unknown'}
`);

  // Context Graph data
  if (contextGraph) {
    parts.push(`
================================
CONTEXT (from Context Graph)
================================

IDENTITY:
- Business Name: ${contextGraph.identity?.businessName?.value || 'Not specified'}
- Business Model: ${contextGraph.identity?.businessModel?.value || 'Not specified'}
- Industry: ${contextGraph.identity?.industry?.value || 'Not specified'}
- Value Proposition: ${contextGraph.productOffer?.valueProposition?.value || 'Not specified'}

AUDIENCE:
- Primary Audience: ${contextGraph.audience?.primaryAudience?.value || 'Not specified'}
- Demographics: ${contextGraph.audience?.demographics?.value || 'Not specified'}
- ICP Description: ${contextGraph.identity?.icpDescription?.value || 'Not specified'}

OBJECTIVES:
- Primary Objective: ${contextGraph.objectives?.primaryObjective?.value || 'Not specified'}
- Secondary Objectives: ${contextGraph.objectives?.secondaryObjectives?.value?.join(', ') || 'Not specified'}

CONSTRAINTS:
- Budget Range: ${formatBudget(contextGraph.operationalConstraints?.minBudget?.value ?? undefined, contextGraph.operationalConstraints?.maxBudget?.value ?? undefined)}
- Launch Deadlines: ${contextGraph.operationalConstraints?.launchDeadlines?.value?.join(', ') || 'Not specified'}
- Blackout Periods: ${contextGraph.operationalConstraints?.blackoutPeriods?.value?.join(', ') || 'None'}
`);

    // Lab findings based on program type
    if (programType === 'content') {
      // Content Lab findings
      if (contextGraph.content?.contentSummary?.value) {
        parts.push(`
================================
CONTENT LAB FINDINGS (Current State)
================================
- Content Score: ${contextGraph.content.contentScore?.value || 'Not assessed'}
- Content Summary: ${contextGraph.content.contentSummary?.value || 'No assessment available'}

Key Topics:
${(contextGraph.content.keyTopics?.value || []).map(t => `- ${t}`).join('\n') || '- None identified'}

Content Pillars:
${(contextGraph.content.contentPillars?.value || []).map(p => `- ${p}`).join('\n') || '- None identified'}

Content Gaps:
${(contextGraph.content.contentGaps?.value || []).map(g => `- ${g.topic} (${g.priority}): ${g.audienceNeed || 'No audience need specified'}`).join('\n') || '- None identified'}

Audience Content Needs:
${(contextGraph.content.audienceContentNeeds?.value || []).map(n => `- ${n}`).join('\n') || '- None identified'}

Core Messages:
${(contextGraph.content.coreMessages?.value || []).map(m => `- ${m}`).join('\n') || '- None identified'}
`);
      } else {
        parts.push(`
================================
CONTENT LAB FINDINGS
================================
No Content Lab assessment available. Base program on general best practices and strategy.
`);
      }
    } else {
      // Website Lab findings
      if (contextGraph.website?.executiveSummary?.value) {
        parts.push(`
================================
WEBSITE LAB FINDINGS (Current State)
================================
- Website Score: ${contextGraph.website.websiteScore?.value || 'Not assessed'}
- Executive Summary: ${contextGraph.website.executiveSummary?.value || 'No assessment available'}

Critical Issues:
${(contextGraph.website.criticalIssues?.value || []).map(i => `- ${i}`).join('\n') || '- None identified'}

Quick Wins:
${(contextGraph.website.quickWins?.value || []).map(i => `- ${i}`).join('\n') || '- None identified'}

Conversion Blocks:
${(contextGraph.website.conversionBlocks?.value || []).map(i => `- ${i}`).join('\n') || '- None identified'}
`);
      } else {
        parts.push(`
================================
WEBSITE LAB FINDINGS
================================
No Website Lab assessment available. Base program on general best practices and strategy.
`);
      }
    }
  } else {
    parts.push(`
================================
CONTEXT
================================
No Context Graph available. Generate a generic ${programLabel.toLowerCase()} program that can be refined later.
`);
  }

  // Strategy data
  if (strategyData) {
    parts.push(`
================================
STRATEGY (Canonical)
================================
- Positioning: ${strategyData.positioning?.value || 'Not defined'}
- Primary Objective: ${strategyData.primaryObjective?.value || 'Not defined'}
- Strategic Themes: ${strategyData.strategicThemes?.value?.join(', ') || 'Not defined'}
`);
  } else {
    parts.push(`
================================
STRATEGY
================================
No canonical strategy defined. Focus on foundational ${programLabel.toLowerCase()} improvements.
`);
  }

  // Instructions
  parts.push(`
================================
INSTRUCTIONS
================================
Generate a comprehensive ${programLabel} Program draft based on the above inputs.
${mode === 'refresh' ? 'Improve and refine the existing program while incorporating any new context.' : 'Create a fresh program that addresses the current state and aligns with strategy.'}

Return your response as a valid JSON object.
`);

  return parts.join('\n');
}

function formatBudget(min?: number, max?: number): string {
  if (!min && !max) return 'Not specified';
  if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  if (min) return `Min $${min.toLocaleString()}`;
  if (max) return `Max $${max.toLocaleString()}`;
  return 'Not specified';
}

function parseAIResponse(text: string): Record<string, unknown> {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[programs/generate] No JSON found in response:', text.slice(0, 500));
    throw new Error('AI response did not contain valid JSON');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[programs/generate] Failed to parse JSON:', e);
    throw new Error('Failed to parse AI response as JSON');
  }
}

function validatePriorities(priorities: unknown): ProgramPriority[] {
  if (!Array.isArray(priorities)) {
    return [
      { label: 'Messaging clarity', rationale: 'Ensure value proposition is clear' },
      { label: 'CTA optimization', rationale: 'Reduce friction in conversion paths' },
      { label: 'Page structure', rationale: 'Align layout with user intent' },
    ];
  }
  return priorities.map((p: { label?: string; rationale?: string }) => ({
    label: p.label || 'Priority',
    rationale: p.rationale || '',
  }));
}

function validateSequencing(sequencing: unknown, programType: ProgramType): ProgramPhase[] {
  if (!Array.isArray(sequencing)) {
    if (programType === 'content') {
      return [
        { phase: 'Phase 1: Foundation', items: ['Define content pillars', 'Establish brand voice'] },
        { phase: 'Phase 2: Build pipeline', items: ['Create editorial calendar', 'Set up production workflow'] },
        { phase: 'Phase 3: Optimize and scale', items: ['Analyze performance', 'Expand successful formats'] },
      ];
    }
    return [
      { phase: 'Phase 1: Fix fundamentals', items: ['Address critical issues', 'Fix mobile experience'] },
      { phase: 'Phase 2: Build conversion paths', items: ['Optimize CTAs', 'Streamline forms'] },
      { phase: 'Phase 3: Optimize and measure', items: ['Implement tracking', 'Set up testing'] },
    ];
  }
  return sequencing.map((s: { phase?: string; items?: string[] }) => ({
    phase: s.phase || 'Phase',
    items: Array.isArray(s.items) ? s.items : [],
  }));
}

function validateExclusions(exclusions: unknown, programType: ProgramType): ProgramExclusion[] {
  if (!Array.isArray(exclusions)) {
    if (programType === 'content') {
      return [
        { item: 'Website UX changes', reason: 'Handled by Website Program' },
        { item: 'Paid media strategy', reason: 'Handled by Media Program' },
      ];
    }
    return [
      { item: 'Content strategy', reason: 'Handled by Content Program' },
      { item: 'Paid media', reason: 'Handled by Media Program' },
    ];
  }
  return exclusions.map((e: { item?: string; reason?: string }) => ({
    item: e.item || 'Exclusion',
    reason: e.reason || '',
  }));
}

function validateReadinessGates(gates: unknown, programType: ProgramType): ProgramReadinessGate[] {
  if (!Array.isArray(gates)) {
    if (programType === 'content') {
      return [
        { gate: 'Brand guidelines documented', criteria: ['Tone and voice defined', 'Visual style guide available'] },
        { gate: 'Content calendar active', criteria: ['Editorial calendar created', 'Publishing workflow defined'] },
      ];
    }
    return [
      { gate: 'Traffic-ready landing page', criteria: ['Page loads in under 3s', 'Mobile responsive', 'Clear CTA'] },
      { gate: 'Conversion tracking active', criteria: ['Analytics configured', 'Goals defined'] },
    ];
  }
  return gates.map((g: { gate?: string; criteria?: string[] }) => ({
    gate: g.gate || 'Gate',
    criteria: Array.isArray(g.criteria) ? g.criteria : [],
  }));
}

function buildInputsSnapshot(
  companyId: string,
  contextGraph: CompanyContextGraph | null,
  strategyData: StrategyData | null,
  programType: ProgramType
): ProgramInputsSnapshot {
  return {
    companyId,
    contextRevisionId: contextGraph?.meta?.lastSnapshotId || undefined,
    strategyId: strategyData?.id,
    // Website-specific
    websiteLabRunId: programType === 'website' ? undefined : undefined, // Would need lab run tracking
    websiteLabSummary: programType === 'website' ? contextGraph?.website?.executiveSummary?.value?.slice(0, 500) : undefined,
    // Content-specific
    contentLabRunId: programType === 'content' ? undefined : undefined, // Would need lab run tracking
    contentLabSummary: programType === 'content' ? contextGraph?.content?.contentSummary?.value?.slice(0, 500) : undefined,
    // Shared
    constraints: {
      minBudget: contextGraph?.operationalConstraints?.minBudget?.value || undefined,
      maxBudget: contextGraph?.operationalConstraints?.maxBudget?.value || undefined,
      timeline: contextGraph?.operationalConstraints?.launchDeadlines?.value?.[0] || undefined,
    },
    capturedAt: new Date().toISOString(),
  };
}
