// app/api/os/programs/[programId]/ai/draft-full/route.ts
// AI Co-planner: Full Program Draft Generation
//
// Generates a complete program plan using ALL available inputs:
// - Company Context (Context Graph snapshot)
// - Latest Labs (WebsiteLab, Brand, SEO, Competition if available)
// - Strategy goal, objectives, bets, and tactics
// - The source tactic that created this program
// - WorkstreamType + templates
//
// Returns a PROPOSAL that must be explicitly applied by the user.
// AI cannot set status to ready/committed or create Work items.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getPlanningProgram } from '@/lib/airtable/planningPrograms';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getActiveStrategy } from '@/lib/os/strategy';
import { createProposal } from '@/lib/os/programs/proposals';
import {
  FullProgramDraftPayloadSchema,
  type PlanningProgram,
} from '@/lib/types/program';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { CompanyStrategy } from '@/lib/types/strategy';

export const maxDuration = 120;

// ============================================================================
// Types
// ============================================================================

type RouteParams = {
  params: Promise<{ programId: string }>;
};

interface DraftFullRequest {
  instructions?: string;
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a senior program manager creating a complete program plan.

A Program sits between Strategy and Execution:
- Strategy defines goals and tactics (the "what" and "why")
- Programs define detailed plans (the "how" - deliverables, milestones, KPIs)
- Work Items are created when the program is committed (not by you)

Your job is to create a comprehensive, actionable program plan.

================================
OUTPUT CONTRACT (STRICT JSON)
================================

Return a JSON object with this EXACT structure:

{
  "summary": {
    "oneLiner": "One sentence describing the program's purpose",
    "rationale": "2-3 sentences on why this program matters and how it connects to strategy",
    "scopeIn": ["What is definitely included (3-5 items)"],
    "scopeOut": ["What is explicitly excluded (2-4 items)"]
  },
  "outcomes": [
    {
      "name": "Outcome name",
      "metric": "How we measure it",
      "target": "Specific target value",
      "timeframe": "When (optional)"
    }
  ],
  "kpis": [
    {
      "name": "KPI name",
      "target": "Target value",
      "measurementMethod": "How we measure"
    }
  ],
  "deliverables": [
    {
      "title": "Deliverable title",
      "description": "What this produces",
      "effort": "S" | "M" | "L",
      "inputs": ["What's needed to start"],
      "acceptanceCriteria": ["How we know it's done"],
      "kpisLinked": ["Related KPI names"]
    }
  ],
  "milestones": [
    {
      "title": "Milestone title",
      "targetWeek": 2,
      "description": "What this checkpoint represents",
      "deliverablesLinked": ["Related deliverable titles"]
    }
  ],
  "assumptions": ["Assumption 1", "Assumption 2"],
  "constraints": ["Constraint 1", "Constraint 2"],
  "dependencies": [
    {
      "dependency": "What is needed",
      "whyNeeded": "Why this is required",
      "owner": "Who owns this"
    }
  ],
  "risks": [
    {
      "risk": "What could go wrong",
      "impact": "low" | "med" | "high",
      "mitigation": "How to address"
    }
  ],
  "executionPlan": [
    {
      "phase": "Phase 1: Name",
      "goal": "What this phase accomplishes",
      "deliverablesLinked": ["Deliverable titles in this phase"]
    }
  ]
}

================================
RULES
================================

1. DELIVERABLES (max 12):
   - Be specific to the tactic/goal, not generic
   - Each must have clear acceptance criteria
   - Order by dependency (what comes first)
   - Effort: S (1-2 days), M (3-5 days), L (1-2 weeks)

2. MILESTONES (4-6):
   - Reference deliverables by exact title
   - Target weeks are relative to program start
   - First milestone should be achievable in 1-2 weeks
   - Final milestone represents program completion

3. KPIs (3-5):
   - Focus on outcomes, not activities
   - Targets must be specific and measurable
   - Include both leading and lagging indicators

4. RISKS (3-5):
   - Be realistic, not generic
   - Impact levels matter: low=delays, med=scope cut, high=failure
   - Mitigations must be actionable

5. DEPENDENCIES (2-4):
   - Focus on what you don't control
   - Identify owner when possible

6. EXECUTION PLAN (2-4 phases):
   - Logical progression of work
   - Each phase should have clear deliverables

================================
GUARDRAILS
================================

- DO NOT set program status to ready or committed
- DO NOT create work items
- DO NOT assume access to resources not mentioned
- Focus on what can realistically be achieved
- Be honest about assumptions and risks`;

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { programId } = await params;
    const body = (await request.json()) as DraftFullRequest;

    // Load program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Load all context in parallel
    const [contextGraph, strategy] = await Promise.all([
      loadContextGraph(program.companyId),
      getActiveStrategy(program.companyId).catch(() => null),
    ]);

    // Build comprehensive prompt
    const prompt = buildFullPrompt(
      program,
      contextGraph,
      strategy,
      body.instructions
    );

    // Call Anthropic
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
      system: SYSTEM_PROMPT,
    });

    // Extract content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Parse JSON from response
    const rawPayload = parseJsonResponse(textContent.text);

    // Validate with zod
    const validation = FullProgramDraftPayloadSchema.safeParse(rawPayload);
    if (!validation.success) {
      console.error('[ai/draft-full] Validation failed:', validation.error.format());
      return NextResponse.json(
        {
          error: 'AI generated invalid response structure',
          details: validation.error.format(),
        },
        { status: 500 }
      );
    }

    // Create proposal (stored in memory)
    const proposal = createProposal(
      programId,
      'full_program',
      validation.data,
      body.instructions
    );

    // Add stats for UI
    const stats = {
      deliverables: validation.data.deliverables.length,
      milestones: validation.data.milestones.length,
      kpis: validation.data.kpis.length,
      risks: validation.data.risks.length,
      dependencies: validation.data.dependencies.length,
      assumptions: validation.data.assumptions.length,
      constraints: validation.data.constraints.length,
    };

    return NextResponse.json({
      proposal,
      stats,
      message: 'Full program draft generated. Review each section and apply when ready.',
    });
  } catch (error) {
    console.error('[ai/draft-full] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate full program draft' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildFullPrompt(
  program: PlanningProgram,
  context: CompanyContextGraph | null,
  strategy: CompanyStrategy | null,
  instructions?: string
): string {
  const parts: string[] = [];

  // ========== PROGRAM INFO ==========
  parts.push('='.repeat(50));
  parts.push('PROGRAM TO PLAN');
  parts.push('='.repeat(50));
  parts.push(`Title: ${program.title}`);
  parts.push(`Status: ${program.status}`);

  if (program.origin.tacticTitle) {
    parts.push(`\nSOURCE TACTIC: ${program.origin.tacticTitle}`);
  }

  if (program.scope.summary) {
    parts.push(`\nCURRENT INTENT: ${program.scope.summary}`);
  }

  if (program.scope.workstreams.length > 0) {
    parts.push(`\nWORKSTREAMS: ${program.scope.workstreams.join(', ')}`);
  }

  // Existing content (if any)
  if (program.scope.deliverables.length > 0) {
    parts.push(`\nEXISTING DELIVERABLES (${program.scope.deliverables.length}):`);
    program.scope.deliverables.forEach(d => {
      parts.push(`- ${d.title}`);
    });
    parts.push('(Consider these when generating - avoid exact duplicates)');
  }

  if (program.planDetails.milestones.length > 0) {
    parts.push(`\nEXISTING MILESTONES: ${program.planDetails.milestones.map(m => m.title).join(', ')}`);
  }

  if (program.success.kpis.length > 0) {
    parts.push(`\nEXISTING KPIs: ${program.success.kpis.map(k => k.label).join(', ')}`);
  }

  // ========== COMPANY CONTEXT ==========
  if (context) {
    parts.push('\n' + '='.repeat(50));
    parts.push('COMPANY CONTEXT');
    parts.push('='.repeat(50));

    if (context.companyName) {
      parts.push(`Company: ${context.companyName}`);
    }

    // Identity
    if (context.identity) {
      const identity = context.identity;
      if (identity.businessName?.value) parts.push(`Business: ${identity.businessName.value}`);
      if (identity.businessModel?.value) parts.push(`Model: ${identity.businessModel.value}`);
      if (identity.industry?.value) parts.push(`Industry: ${identity.industry.value}`);
    }

    // Product/Offer
    if (context.productOffer?.valueProposition?.value) {
      parts.push(`\nValue Proposition: ${context.productOffer.valueProposition.value}`);
    }

    // Audience
    if (context.audience) {
      const audience = context.audience;
      if (audience.icpDescription?.value) {
        parts.push(`\nTarget Audience: ${audience.icpDescription.value}`);
      }
      if (audience.primaryAudience?.value) {
        parts.push(`Primary Segment: ${audience.primaryAudience.value}`);
      }
    }

    // Objectives
    if (context.objectives) {
      const obj = context.objectives;
      if (obj.primaryObjective?.value) {
        parts.push(`\nPrimary Objective: ${obj.primaryObjective.value}`);
      }
      if (obj.secondaryObjectives?.value?.length) {
        parts.push(`Secondary Objectives: ${obj.secondaryObjectives.value.join(', ')}`);
      }
    }

    // Constraints
    if (context.operationalConstraints) {
      const constraints = context.operationalConstraints;
      const budgetParts: string[] = [];
      if (constraints.minBudget?.value) budgetParts.push(`min $${constraints.minBudget.value.toLocaleString()}`);
      if (constraints.maxBudget?.value) budgetParts.push(`max $${constraints.maxBudget.value.toLocaleString()}`);
      if (budgetParts.length) {
        parts.push(`\nBudget: ${budgetParts.join(', ')}`);
      }
      if (constraints.launchDeadlines?.value?.length) {
        parts.push(`Deadlines: ${constraints.launchDeadlines.value.join(', ')}`);
      }
    }

    // Website Lab findings (if relevant)
    if (context.website?.executiveSummary?.value) {
      parts.push('\n--- Website Lab Findings ---');
      parts.push(context.website.executiveSummary.value);
      if (context.website.criticalIssues?.value?.length) {
        parts.push(`Critical Issues: ${context.website.criticalIssues.value.slice(0, 3).join('; ')}`);
      }
      if (context.website.quickWins?.value?.length) {
        parts.push(`Quick Wins: ${context.website.quickWins.value.slice(0, 3).join('; ')}`);
      }
    }

    // Content findings
    if (context.content?.contentSummary?.value) {
      parts.push('\n--- Content Findings ---');
      parts.push(context.content.contentSummary.value);
    }

    // Brand
    if (context.brand?.positioning?.value) {
      parts.push(`\nBrand Positioning: ${context.brand.positioning.value}`);
    }
  }

  // ========== STRATEGY ==========
  if (strategy) {
    parts.push('\n' + '='.repeat(50));
    parts.push('STRATEGY');
    parts.push('='.repeat(50));

    if (strategy.summary) {
      parts.push(`Goal: ${strategy.summary}`);
    }

    // Objectives
    if (strategy.objectives && strategy.objectives.length > 0) {
      parts.push('\nObjectives:');
      strategy.objectives.slice(0, 5).forEach((obj) => {
        // Handle both string and StrategyObjective formats
        const text = typeof obj === 'string' ? obj : obj.text;
        parts.push(`- ${text}`);
      });
    }

    // Strategic Bets (pillars)
    if (strategy.pillars && strategy.pillars.length > 0) {
      parts.push('\nStrategic Bets:');
      strategy.pillars.slice(0, 3).forEach((pillar) => {
        parts.push(`- ${pillar.title || 'Unnamed'}: ${pillar.description || ''}`);
      });
    }

    // Tactics (plays)
    if (strategy.plays && strategy.plays.length > 0) {
      const activeTactics = strategy.plays.filter(t => t.status === 'active' || t.status === 'proven');

      if (activeTactics.length > 0) {
        parts.push('\nActive Tactics:');
        activeTactics.slice(0, 5).forEach(t => {
          parts.push(`- ${t.title || 'Unnamed'}: ${t.description || ''}`);
        });
      }
    }
  }

  // ========== USER INSTRUCTIONS ==========
  if (instructions) {
    parts.push('\n' + '='.repeat(50));
    parts.push('SPECIAL INSTRUCTIONS');
    parts.push('='.repeat(50));
    parts.push(instructions);
  }

  // ========== FINAL INSTRUCTION ==========
  parts.push('\n' + '='.repeat(50));
  parts.push('TASK');
  parts.push('='.repeat(50));
  parts.push(`Generate a complete program plan for "${program.title}".`);
  parts.push('Return valid JSON only, matching the exact structure specified.');
  parts.push('Do not include markdown code blocks or any text outside the JSON.');

  return parts.join('\n');
}

function parseJsonResponse(text: string): unknown {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[ai/draft-full] No JSON found in response:', text.slice(0, 500));
    throw new Error('No JSON found in AI response');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[ai/draft-full] JSON parse error:', e);
    throw new Error('Failed to parse AI response as JSON');
  }
}
