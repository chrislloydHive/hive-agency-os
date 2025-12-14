// app/api/os/companies/[companyId]/strategy/artifacts/[artifactId]/copilot/route.ts
// Strategy Artifact Copilot API
//
// Helps users flesh out, rewrite, or improve artifact content with AI assistance.
//
// NON-NEGOTIABLE RULES:
// - This endpoint NEVER persists anything
// - It ONLY returns suggested content
// - It NEVER writes to canonical strategy, company context, or hive brain
// - All edits are local until user explicitly saves
//
// Response includes suggested content + notes about assumptions made.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getArtifactById } from '@/lib/os/strategy/artifacts';
import { getStrategyInputs, computeStrategyReadiness } from '@/lib/os/strategy/strategyInputs';
import type { StrategyArtifactType } from '@/lib/types/strategyArtifact';

export const maxDuration = 120;

// ============================================================================
// Types
// ============================================================================

type CopilotIntent =
  | 'flesh_out'    // Expand brief notes into fuller content
  | 'rewrite'      // Rewrite with better structure/clarity
  | 'add_missing'  // Add sections that are typically expected
  | 'actionable'   // Make more specific and actionable
  | 'tighten';     // Condense and remove fluff

type ApplyMode = 'replace' | 'append' | 'insert';

interface CopilotRequest {
  intent: CopilotIntent;
  userPrompt: string;
  applyMode: ApplyMode;
  cursorIndex?: number;
  currentContent: string;
  artifactType: StrategyArtifactType;
}

interface CopilotResponse {
  suggestedContent: string;
  notes?: string[];
}

// ============================================================================
// Intent Instructions
// ============================================================================

const INTENT_INSTRUCTIONS: Record<CopilotIntent, string> = {
  flesh_out: `TASK: Flesh out and expand the user's notes into fuller, more complete content.
- Turn bullet points into paragraphs where appropriate
- Add supporting detail and context
- Maintain the user's original intent and key points
- Keep their voice and structure where possible
- Fill in obvious gaps but flag assumptions`,

  rewrite: `TASK: Rewrite the content with better structure and clarity.
- Improve organization and flow
- Clarify vague statements
- Use more precise language
- Keep the core meaning intact
- Maintain a professional but accessible tone`,

  add_missing: `TASK: Add sections or content that are typically expected for this artifact type.
- Identify what's missing based on best practices
- Add appropriate sections with clear headers
- Keep additions relevant to the existing content
- Flag new sections clearly so user knows what was added`,

  actionable: `TASK: Make the content more specific and actionable.
- Replace vague language with concrete specifics
- Add measurable targets where appropriate
- Include clear next steps or recommendations
- Ground generic statements in company-specific context
- Make it something someone could actually execute`,

  tighten: `TASK: Condense and remove fluff while preserving meaning.
- Remove redundant phrases and filler words
- Combine similar points
- Keep only essential information
- Maintain clarity despite brevity
- Preserve key insights and decisions`,
};

// ============================================================================
// Artifact Type Templates
// ============================================================================

const ARTIFACT_TYPE_GUIDANCE: Record<StrategyArtifactType, string> = {
  draft_strategy: `A draft strategy should include:
- Strategic direction/thesis
- Key priorities (2-4)
- Target outcomes
- Resource allocation guidance
- Timeline/phasing if relevant`,

  growth_option: `A growth option should include:
- The opportunity being explored
- Why it's worth pursuing now
- Key assumptions
- Expected impact
- Required resources
- Key risks`,

  channel_plan: `A channel plan should include:
- Channel selection rationale
- Target audience for this channel
- Content/messaging approach
- Success metrics
- Budget considerations
- Timeline/cadence`,

  assumptions: `An assumptions document should include:
- Market assumptions (demand, competition)
- Customer assumptions (behavior, preferences)
- Internal assumptions (capabilities, resources)
- Risk level for each assumption
- How to validate or invalidate`,

  risk_analysis: `A risk analysis should include:
- Risk categories (market, execution, financial)
- Likelihood and impact assessment
- Mitigation strategies
- Early warning indicators
- Contingency plans`,

  synthesis: `A synthesis should include:
- Key themes from inputs
- Areas of alignment
- Points of tension/tradeoffs
- Recommended path forward
- What's still uncertain`,
};

// ============================================================================
// API Handler
// ============================================================================

type RouteParams = {
  params: Promise<{ companyId: string; artifactId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse<CopilotResponse | { error: string }>> {
  try {
    const { companyId, artifactId } = await params;
    const body = await request.json() as CopilotRequest;

    const {
      intent,
      userPrompt,
      currentContent,
      artifactType,
    } = body;

    // Validate intent
    if (!INTENT_INSTRUCTIONS[intent]) {
      return NextResponse.json(
        { error: `Invalid intent: ${intent}` },
        { status: 400 }
      );
    }

    if (!userPrompt?.trim() && !currentContent?.trim()) {
      return NextResponse.json(
        { error: 'Please provide either a prompt or existing content' },
        { status: 400 }
      );
    }

    // Fetch artifact and strategy inputs in parallel
    const [artifact, strategyInputs] = await Promise.all([
      getArtifactById(artifactId),
      getStrategyInputs(companyId),
    ]);

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    // Check strategy readiness and build warnings
    const readiness = computeStrategyReadiness(strategyInputs);
    const notes: string[] = [];

    if (!readiness.isReady) {
      notes.push(`Strategy inputs ${readiness.completenessPercent}% complete`);
      for (const warning of readiness.warnings.slice(0, 2)) {
        notes.push(`Assumption: ${warning.fixHint} (${warning.message.split('—')[0].trim()})`);
      }
    }

    // Build the prompt
    const systemPrompt = buildSystemPrompt(intent, artifactType);
    const userMessage = buildUserMessage(
      userPrompt,
      currentContent,
      strategyInputs,
      artifactType
    );

    // Call Anthropic
    const anthropic = new Anthropic();
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
    });

    // Extract response
    const aiResponse = completion.content[0];
    if (aiResponse.type !== 'text') {
      return NextResponse.json(
        { error: 'Unexpected AI response type' },
        { status: 500 }
      );
    }

    // Parse the response - AI returns JSON with suggestedContent and optional notes
    let suggestedContent: string;
    let aiNotes: string[] = [];

    try {
      const parsed = JSON.parse(aiResponse.text);
      suggestedContent = parsed.suggestedContent || parsed.content || '';
      if (parsed.notes && Array.isArray(parsed.notes)) {
        aiNotes = parsed.notes;
      }
    } catch {
      // If not JSON, treat entire response as content
      suggestedContent = aiResponse.text;
    }

    // Combine notes
    const allNotes = [...notes, ...aiNotes].filter(Boolean);

    console.log('[artifact-copilot] Generated suggestion for', artifactId, {
      intent,
      contentLength: suggestedContent.length,
      notes: allNotes.length,
    });

    return NextResponse.json({
      suggestedContent,
      notes: allNotes.length > 0 ? allNotes : undefined,
    });

  } catch (error) {
    console.error('[artifact-copilot] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestion' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Prompt Builders
// ============================================================================

function buildSystemPrompt(intent: CopilotIntent, artifactType: StrategyArtifactType): string {
  return `You are an expert strategy consultant helping improve a strategy artifact.

${INTENT_INSTRUCTIONS[intent]}

ARTIFACT TYPE EXPECTATIONS:
${ARTIFACT_TYPE_GUIDANCE[artifactType]}

OUTPUT FORMAT:
Return a JSON object:
{
  "suggestedContent": "The improved markdown content",
  "notes": ["Brief note about changes", "Assumption made: X"]
}

RULES:
- Preserve the user's voice and perspective where possible
- Be specific to the company context provided
- Avoid generic marketing language
- If you make assumptions, note them explicitly
- Keep content concise and executable
- Use markdown formatting appropriately`;
}

function buildUserMessage(
  userPrompt: string,
  currentContent: string,
  inputs: Awaited<ReturnType<typeof getStrategyInputs>>,
  artifactType: StrategyArtifactType
): string {
  const sections: string[] = [];

  // User's intent
  sections.push(`## What the user wants
${userPrompt || '(User did not provide specific guidance - use your judgment based on the intent)'}`);

  // Current content
  sections.push(`## Current Artifact Content
${currentContent || '(Empty - generate from scratch based on context)'}`);

  // Company context
  sections.push(`## Company Context

**Business Reality:**
- Business Model: ${inputs.businessReality.businessModel || 'Not specified'}
- Primary Offering: ${inputs.businessReality.primaryOffering || 'Not specified'}
- Primary Audience: ${inputs.businessReality.primaryAudience || 'Not specified'}
- ICP: ${inputs.businessReality.icpDescription || 'Not specified'}
- Goals: ${inputs.businessReality.goals.length > 0 ? inputs.businessReality.goals.join(', ') : 'Not specified'}
- Value Proposition: ${inputs.businessReality.valueProposition || 'Not specified'}

**Constraints:**
- Budget: ${formatBudget(inputs.constraints)}
- Compliance: ${inputs.constraints.complianceRequirements.join(', ') || 'None specified'}
- Channel Restrictions: ${inputs.constraints.channelRestrictions.length > 0 ? inputs.constraints.channelRestrictions.map(r => r.channelId).join(', ') : 'None'}

**Competition:**
- Position: ${inputs.competition.positionSummary || 'Not analyzed'}
- Key Competitors: ${inputs.competition.competitors.slice(0, 3).map(c => c.name).join(', ') || 'Not identified'}
- Advantages: ${inputs.competition.competitiveAdvantages.join(', ') || 'Not identified'}

**Hive Capabilities:**
- Services: ${inputs.executionCapabilities.serviceTaxonomy.slice(0, 5).join(', ') || 'Not configured'}`);

  // Artifact type reminder
  sections.push(`## Artifact Type: ${artifactType.replace('_', ' ')}
Remember the expectations for this type when improving the content.`);

  return sections.join('\n\n');
}

function formatBudget(constraints: Awaited<ReturnType<typeof getStrategyInputs>>['constraints']): string {
  if (constraints.minBudget && constraints.maxBudget) {
    return `$${constraints.minBudget.toLocaleString()} - $${constraints.maxBudget.toLocaleString()}`;
  }
  if (constraints.maxBudget) {
    return `Up to $${constraints.maxBudget.toLocaleString()}`;
  }
  if (constraints.minBudget) {
    return `At least $${constraints.minBudget.toLocaleString()}`;
  }
  return 'Not specified';
}
