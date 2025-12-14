// app/api/os/companies/[companyId]/strategy/artifacts/[artifactId]/regenerate/route.ts
// AI Regenerate for Strategy Artifacts
//
// Two modes:
// - 'replace': Generate completely new content
// - 'appendAlternative': Add an alternative section below existing content
//
// NON-NEGOTIABLE: AI may ONLY modify the artifact content in the response
// The client must explicitly Save to persist changes.
// AI must NEVER write/modify Canonical Strategy or Company Context

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyContext } from '@/lib/os/context';
import { getCompanyById } from '@/lib/airtable/companies';
import { getArtifactById, getArtifactsForCompany } from '@/lib/os/strategy/artifacts';
import type { StrategyArtifactType, ArtifactGenerationInputs } from '@/lib/types/strategyArtifact';

export const maxDuration = 120;

// ============================================================================
// Types
// ============================================================================

type RegenerateMode = 'replace' | 'appendAlternative';

// ============================================================================
// System Prompts
// ============================================================================

const REPLACE_SYSTEM_PROMPT = `You are regenerating a strategy artifact with fresh thinking.

Your task is to create a NEW version of this artifact that:
1. Takes a different angle or approach than the current content
2. Is still grounded in the same company context
3. Might surface different insights or priorities
4. Is concise and actionable

Output a JSON object with:
{
  "title": "New title for the artifact",
  "contentMarkdown": "Full markdown content"
}`;

const ALTERNATIVE_SYSTEM_PROMPT = `You are adding an alternative perspective to an existing strategy artifact.

Your task is to:
1. Review the existing content
2. Generate an ALTERNATIVE approach or perspective
3. This alternative should be meaningfully different, not just rephrased
4. Label it clearly as an alternative

Output a JSON object with:
{
  "alternativeSection": "Markdown content for the alternative section (including ## Alternative Approach header)"
}`;

// ============================================================================
// Type-Specific Instructions
// ============================================================================

const TYPE_INSTRUCTIONS: Record<StrategyArtifactType, { replace: string; appendAlternative: string }> = {
  growth_option: {
    replace: 'Generate a different growth opportunity - explore a different lever, audience, or approach.',
    appendAlternative: 'Suggest an alternative way to pursue growth - different channel, different segment, or different value proposition angle.',
  },
  draft_strategy: {
    replace: 'Create a different strategic direction - perhaps more aggressive, more conservative, or focused on different pillars.',
    appendAlternative: 'Propose an alternative strategic approach - different positioning, different priorities, or different sequencing.',
  },
  assumptions: {
    replace: 'Surface different assumptions - dig deeper, challenge obvious ones, or focus on different categories.',
    appendAlternative: 'Identify additional assumptions that might be hidden, or challenge the existing ones with counter-assumptions.',
  },
  risk_analysis: {
    replace: 'Identify different risks - look at different categories, different timeframes, or second-order effects.',
    appendAlternative: 'Add risks that weren\'t considered, or propose different mitigations for the existing risks.',
  },
  channel_plan: {
    replace: 'Plan for a different channel or a fundamentally different approach to the same channel.',
    appendAlternative: 'Suggest an alternative content strategy, different messaging angle, or different success metrics.',
  },
  synthesis: {
    replace: 'Create a different synthesis - prioritize different themes, resolve tensions differently, or recommend a different path.',
    appendAlternative: 'Offer an alternative synthesis that weighs the inputs differently or draws different conclusions.',
  },
};

// ============================================================================
// API Handler
// ============================================================================

type RouteParams = {
  params: Promise<{ companyId: string; artifactId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, artifactId } = await params;
    const body = await request.json();
    const mode: RegenerateMode = body.mode || 'replace';

    if (mode !== 'replace' && mode !== 'appendAlternative') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "replace" or "appendAlternative"' },
        { status: 400 }
      );
    }

    // Fetch artifact, company, context, and other artifacts in parallel
    const [artifact, company, context, allArtifacts] = await Promise.all([
      getArtifactById(artifactId),
      getCompanyById(companyId),
      getCompanyContext(companyId),
      getArtifactsForCompany(companyId),
    ]);

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get other artifacts for context (exclude current)
    const otherArtifacts = allArtifacts.filter(a => a.id !== artifactId);
    const artifactSummaries = otherArtifacts
      .slice(0, 3)
      .map(a => `- ${a.title} (${a.type})`)
      .join('\n');

    // Build the prompt based on mode
    const systemPrompt = mode === 'replace' ? REPLACE_SYSTEM_PROMPT : ALTERNATIVE_SYSTEM_PROMPT;
    const typeInstruction = TYPE_INSTRUCTIONS[artifact.type][mode];

    const prompt = buildRegeneratePrompt(
      company,
      context,
      artifact.type,
      artifact.title,
      artifact.content,
      typeInstruction,
      artifactSummaries,
      mode
    );

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8, // Higher for more variety
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Build generation inputs metadata
    const generationInputs: ArtifactGenerationInputs = {
      contextRevisionId: context?.updatedAt,
      competitionSource: context?.competitors?.length ? 'v4' : null,
      artifactIdsUsed: [artifactId], // Self-reference for regeneration
    };

    if (mode === 'replace') {
      if (!parsed.title || !parsed.contentMarkdown) {
        return NextResponse.json(
          { error: 'AI failed to generate valid replacement content' },
          { status: 500 }
        );
      }

      console.log('[regenerate] Generated replacement for artifact:', artifactId);

      return NextResponse.json({
        mode: 'replace',
        title: parsed.title,
        contentMarkdown: parsed.contentMarkdown,
        generationInputs,
      });
    } else {
      // appendAlternative mode
      if (!parsed.alternativeSection) {
        return NextResponse.json(
          { error: 'AI failed to generate alternative content' },
          { status: 500 }
        );
      }

      // Build the combined content
      const separator = '\n\n---\n\n';
      const combinedContent = artifact.content + separator + parsed.alternativeSection;

      console.log('[regenerate] Generated alternative for artifact:', artifactId);

      return NextResponse.json({
        mode: 'appendAlternative',
        contentMarkdown: combinedContent,
        alternativeSection: parsed.alternativeSection,
        generationInputs,
      });
    }
  } catch (error) {
    console.error('[regenerate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildRegeneratePrompt(
  company: { name: string; website?: string },
  context: Awaited<ReturnType<typeof getCompanyContext>>,
  artifactType: StrategyArtifactType,
  currentTitle: string,
  currentContent: string,
  typeInstruction: string,
  existingArtifactSummaries: string,
  mode: RegenerateMode
): string {
  const competitors = context?.competitors || [];
  const directCompetitors = competitors.filter(c => c.type === 'direct').slice(0, 3);
  const competitorNames = directCompetitors.map(c => c.domain).join(', ') || 'None identified';

  return `
${mode === 'replace' ? 'Regenerate' : 'Add alternative to'} this ${artifactType.replace('_', ' ')} artifact for ${company.name}.

================================
COMPANY CONTEXT
================================
- Business Model: ${context?.businessModel || 'Not specified'}
- Value Proposition: ${context?.valueProposition || 'Not specified'}
- Primary Audience: ${context?.primaryAudience || 'Not specified'}
- Objectives: ${context?.objectives?.join(', ') || 'Not specified'}
- Constraints: ${context?.constraints || 'Not specified'}
- Competitors: ${competitorNames}

================================
CURRENT ARTIFACT
================================
Title: ${currentTitle}

Content:
${currentContent}

================================
OTHER ARTIFACTS IN WORKSPACE
================================
${existingArtifactSummaries || 'None'}

================================
YOUR TASK
================================
${typeInstruction}

Be specific to this company's context. Avoid generic marketing fluff.
Make it actionable and concise.
`.trim();
}
