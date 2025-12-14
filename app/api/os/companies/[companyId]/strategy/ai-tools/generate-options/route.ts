// app/api/os/companies/[companyId]/strategy/ai-tools/generate-options/route.ts
// AI Tool: Option Generator
//
// Generates 2-4 growth_option artifacts based on company context.
// AI ONLY creates artifacts, NEVER modifies canonical strategy.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyContext } from '@/lib/os/context';
import { getCompanyById } from '@/lib/airtable/companies';
import { createArtifact } from '@/lib/os/strategy/artifacts';
import type { StrategyArtifact } from '@/lib/types/strategyArtifact';

export const maxDuration = 120;

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a senior growth strategist generating strategic options for marketing exploration.

Your task is to generate 2-4 distinct GROWTH OPTIONS based on the company context provided.

Each growth option should be:
1. Concrete and actionable (not generic)
2. Grounded in the company's actual context
3. Different from each other (explore different levers)
4. Realistic given constraints

================================
OUTPUT FORMAT
================================

Return a JSON object with this structure:

{
  "options": [
    {
      "title": "Growth Option: [Name]",
      "description": "1-2 sentence summary of this option",
      "primaryLever": "The main strategic lever (e.g., 'audience expansion', 'conversion optimization', 'channel diversification', 'content moat', 'brand differentiation')",
      "whyItCouldWork": "2-3 sentences explaining why this option makes sense given the context",
      "keyRisks": ["Risk 1", "Risk 2"],
      "content": "Full markdown content for the artifact (3-5 paragraphs with headers)"
    }
  ],
  "reasoning": "Brief explanation of why these options were generated"
}

================================
CONTENT STRUCTURE
================================

Each option's content should follow this markdown structure:

## Growth Option: [Name]

### Summary
_Brief description of the opportunity_

### Primary Lever
_What strategic lever does this pull?_

### Why It Could Work
_Given the company context, why is this a good bet?_

### Key Assumptions
_What must be true for this to succeed?_

### Key Risks
- Risk 1
- Risk 2

### Next Steps to Validate
1. Step 1
2. Step 2

================================
RULES
================================

1. Generate 2-4 options (prefer 3)
2. Each option should explore a DIFFERENT strategic lever
3. Reference specific context fields (audience, constraints, competition)
4. Be honest about risks - don't oversell
5. Options should be mutually exclusive but not contradictory
6. Avoid generic SaaS playbook options unless context indicates SaaS`;

// ============================================================================
// API Handler
// ============================================================================

type RouteParams = {
  params: Promise<{ companyId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    // Fetch company and context
    const [company, context] = await Promise.all([
      getCompanyById(companyId),
      getCompanyContext(companyId),
    ]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Build the prompt
    const prompt = buildPrompt(company, context);

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8, // Higher creativity for diverse options
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    if (!parsed.options || !Array.isArray(parsed.options) || parsed.options.length === 0) {
      return NextResponse.json(
        { error: 'AI failed to generate valid options' },
        { status: 500 }
      );
    }

    // Create artifacts for each option
    const createdArtifacts: StrategyArtifact[] = [];

    for (const option of parsed.options) {
      const artifact = await createArtifact({
        companyId,
        type: 'growth_option',
        title: option.title || 'Growth Option',
        content: option.content || buildDefaultContent(option),
        source: 'ai_tool',
        linkedContextRevisionId: context?.updatedAt,
        linkedCompetitionSource: context?.competitors?.length ? 'v4' : null,
      });
      createdArtifacts.push(artifact);
    }

    console.log('[ai-tools/generate-options] Created', createdArtifacts.length, 'artifacts');

    return NextResponse.json({
      artifacts: createdArtifacts,
      reasoning: parsed.reasoning || 'Generated based on company context',
      count: createdArtifacts.length,
    });
  } catch (error) {
    console.error('[ai-tools/generate-options] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate options' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildPrompt(
  company: { name: string; website?: string; industry?: string },
  context: Awaited<ReturnType<typeof getCompanyContext>>
): string {
  const competitors = context?.competitors || [];
  const directCount = competitors.filter(c => c.type === 'direct').length;
  const indirectCount = competitors.filter(c => c.type === 'indirect').length;

  return `
Generate growth options for ${company.name}.

================================
COMPANY INFO
================================
- Website: ${company.website || 'Not specified'}
- Industry: ${company.industry || 'Not specified'}

================================
CONTEXT
================================
- Business Model: ${context?.businessModel || 'Not specified'}
- Value Proposition: ${context?.valueProposition || 'Not specified'}
- Primary Audience: ${context?.primaryAudience || 'Not specified'}
- ICP Description: ${context?.icpDescription || 'Not specified'}
- Objectives: ${context?.objectives?.join(', ') || 'Not specified'}
- Constraints: ${context?.constraints || 'Not specified'}
- Budget: ${context?.budget || 'Not specified'}
- Geographic Scope: ${context?.geographicScope || 'Not specified'}

================================
COMPETITION
================================
- Category: ${context?.companyCategory || 'Not specified'}
- Direct Competitors: ${directCount}
- Indirect Competitors: ${indirectCount}
- Competitive Notes: ${context?.competitorsNotes || 'None'}

================================
INSTRUCTIONS
================================
Generate 2-4 growth options that could help this company achieve their objectives.
Each option should explore a different strategic lever.
Ground each option in the specific context provided.
`.trim();
}

function buildDefaultContent(option: {
  title?: string;
  description?: string;
  primaryLever?: string;
  whyItCouldWork?: string;
  keyRisks?: string[];
}): string {
  return `
## ${option.title || 'Growth Option'}

### Summary
${option.description || '_Description pending_'}

### Primary Lever
${option.primaryLever || '_Lever pending_'}

### Why It Could Work
${option.whyItCouldWork || '_Analysis pending_'}

### Key Risks
${option.keyRisks?.map(r => `- ${r}`).join('\n') || '- _Risks pending_'}

### Next Steps to Validate
1. Define success metrics
2. Run a small pilot
3. Measure and iterate
`.trim();
}
