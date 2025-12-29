// app/api/os/programs/[programId]/ai/draft/route.ts
// AI Co-planner: Scoped Draft Generation
//
// Generates draft content for specific sections:
// - deliverables, milestones, kpis, risks, dependencies, summary
//
// Returns a PROPOSAL that must be explicitly applied by the user.
// AI cannot set status to ready/committed or create Work items.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getPlanningProgram } from '@/lib/airtable/planningPrograms';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { createProposal } from '@/lib/os/programs/proposals';
import {
  ProposalTypeSchema,
  validateProposalPayload,
  type ProposalType,
  type PlanningProgram,
} from '@/lib/types/program';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

export const maxDuration = 60;

// ============================================================================
// Types
// ============================================================================

type RouteParams = {
  params: Promise<{ programId: string }>;
};

interface DraftRequest {
  type: ProposalType;
  scope?: string; // Optional focus area
  instructions?: string; // Optional user instructions
}

// ============================================================================
// System Prompts by Type
// ============================================================================

const SYSTEM_PROMPTS: Record<ProposalType, string> = {
  deliverables: `You are a senior program manager drafting deliverables for a marketing program.

Your job is to propose specific, actionable deliverables that achieve the program's goals.

RULES:
1. Each deliverable must have a clear title and description
2. Effort should be realistic: S (1-2 days), M (3-5 days), L (1-2 weeks)
3. Inputs should list what's needed before starting
4. Acceptance criteria should be measurable and verifiable
5. Maximum 8 deliverables unless more are explicitly requested
6. Avoid generic deliverables - tie them to the specific tactic/goal
7. Order deliverables logically (dependencies first)

OUTPUT FORMAT (strict JSON array):
[
  {
    "title": "Deliverable name",
    "description": "What this deliverable produces and why it matters",
    "effort": "S" | "M" | "L",
    "inputs": ["Input 1", "Input 2"],
    "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
    "kpisLinked": ["KPI name if applicable"]
  }
]`,

  milestones: `You are a senior program manager drafting milestones for a marketing program.

Your job is to propose key checkpoints that track program progress.

RULES:
1. Milestones mark completion of meaningful work chunks
2. Target weeks are relative to program start (week 1, 2, etc.)
3. Link milestones to specific deliverables when possible
4. 4-6 milestones is typical for a 30-60 day program
5. First milestone should be achievable within 1-2 weeks
6. Final milestone should represent program completion

OUTPUT FORMAT (strict JSON array):
[
  {
    "title": "Milestone name",
    "targetWeek": 2,
    "description": "What this milestone signifies",
    "deliverablesLinked": ["Deliverable title 1"]
  }
]`,

  kpis: `You are a senior program manager defining KPIs for a marketing program.

Your job is to propose measurable success metrics.

RULES:
1. KPIs should be specific and measurable
2. Include the measurement method (how we'll know)
3. Targets should be realistic given the program scope
4. 3-5 KPIs is typical - focus on what matters most
5. Link KPIs to business outcomes, not activities
6. Include both leading indicators and lagging results

OUTPUT FORMAT (strict JSON array):
[
  {
    "name": "KPI name",
    "target": "Specific target (e.g., 'Increase by 25%', '>500/month')",
    "measurementMethod": "How we measure this"
  }
]`,

  risks: `You are a senior program manager identifying risks for a marketing program.

Your job is to anticipate what could go wrong and how to mitigate it.

RULES:
1. Focus on realistic, program-specific risks
2. Impact levels: low (delays), med (scope reduction), high (program failure)
3. Mitigations should be actionable, not generic
4. 3-6 risks is typical
5. Consider dependencies, resources, timeline, and external factors

OUTPUT FORMAT (strict JSON array):
[
  {
    "risk": "What could go wrong",
    "impact": "low" | "med" | "high",
    "mitigation": "How to reduce likelihood or impact"
  }
]`,

  dependencies: `You are a senior program manager identifying dependencies for a marketing program.

Your job is to list what this program needs from others.

RULES:
1. Dependencies are things this program needs but doesn't control
2. Explain why each dependency is needed
3. Identify owner when possible
4. 3-6 dependencies is typical
5. Consider: assets, approvals, data, tools, other teams

OUTPUT FORMAT (strict JSON array):
[
  {
    "dependency": "What is needed",
    "whyNeeded": "Why this is required",
    "owner": "Who owns this (if known)"
  }
]`,

  summary: `You are a senior program manager writing a program summary.

Your job is to create a clear, concise program overview.

RULES:
1. One-liner should capture the essence in one sentence
2. Outcomes should be 3-5 measurable results
3. Scope In: what is definitely included
4. Scope Out: what is explicitly excluded
5. Be specific to this program, not generic

OUTPUT FORMAT (strict JSON object):
{
  "oneLiner": "One sentence summary of the program",
  "outcomes": ["Outcome 1", "Outcome 2", "Outcome 3"],
  "scopeIn": ["Included item 1", "Included item 2"],
  "scopeOut": ["Excluded item 1", "Excluded item 2"]
}`,

  full_program: ``, // Handled by separate endpoint
};

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { programId } = await params;
    const body = (await request.json()) as DraftRequest;

    // Validate type
    const typeResult = ProposalTypeSchema.safeParse(body.type);
    if (!typeResult.success) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${ProposalTypeSchema.options.join(', ')}` },
        { status: 400 }
      );
    }

    const type = typeResult.data;

    // full_program should use /draft-full endpoint
    if (type === 'full_program') {
      return NextResponse.json(
        { error: 'Use /ai/draft-full for full program drafts' },
        { status: 400 }
      );
    }

    // Load program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Load context for richer generation
    const contextGraph = await loadContextGraph(program.companyId);

    // Build prompt
    const prompt = buildPrompt(program, contextGraph, type, body.scope, body.instructions);

    // Call Anthropic
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      system: SYSTEM_PROMPTS[type],
    });

    // Extract content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Parse JSON from response
    const payload = parseJsonResponse(textContent.text);

    // Validate payload
    const validation = validateProposalPayload(type, payload);
    if (!validation.success) {
      console.error('[ai/draft] Invalid payload:', validation.error);
      return NextResponse.json(
        { error: `AI generated invalid response: ${validation.error}` },
        { status: 500 }
      );
    }

    // Create proposal (stored in memory)
    const proposal = createProposal(programId, type, validation.data, body.instructions);

    return NextResponse.json({
      proposal,
      message: 'Draft generated. Review and apply when ready.',
    });
  } catch (error) {
    console.error('[ai/draft] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate draft' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildPrompt(
  program: PlanningProgram,
  context: CompanyContextGraph | null,
  type: ProposalType,
  scope?: string,
  instructions?: string
): string {
  const parts: string[] = [];

  // Program context
  parts.push(`PROGRAM: ${program.title}`);
  parts.push(`STATUS: ${program.status}`);

  if (program.origin.tacticTitle) {
    parts.push(`SOURCE TACTIC: ${program.origin.tacticTitle}`);
  }

  if (program.scope.summary) {
    parts.push(`PROGRAM INTENT: ${program.scope.summary}`);
  }

  // Existing content (for context, not to duplicate)
  if (program.scope.deliverables.length > 0) {
    parts.push(`\nEXISTING DELIVERABLES (${program.scope.deliverables.length}):`);
    program.scope.deliverables.slice(0, 5).forEach(d => {
      parts.push(`- ${d.title}: ${d.description || 'No description'}`);
    });
    if (program.scope.deliverables.length > 5) {
      parts.push(`... and ${program.scope.deliverables.length - 5} more`);
    }
  }

  if (program.planDetails.milestones.length > 0) {
    parts.push(`\nEXISTING MILESTONES (${program.planDetails.milestones.length}):`);
    program.planDetails.milestones.forEach(m => {
      parts.push(`- ${m.title}`);
    });
  }

  if (program.success.kpis.length > 0) {
    parts.push(`\nEXISTING KPIs (${program.success.kpis.length}):`);
    program.success.kpis.forEach(k => {
      parts.push(`- ${k.label}: ${k.target || 'No target'}`);
    });
  }

  // Workstreams
  if (program.scope.workstreams.length > 0) {
    parts.push(`\nWORKSTREAMS: ${program.scope.workstreams.join(', ')}`);
  }

  // Company context
  if (context) {
    parts.push(`\n--- COMPANY CONTEXT ---`);
    if (context.companyName) {
      parts.push(`Company: ${context.companyName}`);
    }
    if (context.identity?.businessModel?.value) {
      parts.push(`Business Model: ${context.identity.businessModel.value}`);
    }
    if (context.audience?.icpDescription?.value) {
      parts.push(`Target Audience: ${context.audience.icpDescription.value}`);
    }
    if (context.objectives?.primaryObjective?.value) {
      parts.push(`Primary Objective: ${context.objectives.primaryObjective.value}`);
    }
  }

  // User instructions
  if (scope) {
    parts.push(`\n--- FOCUS AREA ---`);
    parts.push(scope);
  }

  if (instructions) {
    parts.push(`\n--- INSTRUCTIONS ---`);
    parts.push(instructions);
  }

  // Final instruction
  parts.push(`\n--- TASK ---`);
  parts.push(`Generate ${type} for this program. Return valid JSON only, no markdown.`);

  return parts.join('\n');
}

function parseJsonResponse(text: string): unknown {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/[[{][\s\S]*[\]}]/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[ai/draft] JSON parse error:', e, 'Text:', text.slice(0, 500));
    throw new Error('Failed to parse AI response as JSON');
  }
}
