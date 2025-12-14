// app/api/os/companies/[companyId]/strategy/ai-tools/synthesize/route.ts
// AI Tool: Synthesize Strategy
//
// Synthesizes selected artifacts into a coherent strategy recommendation.
// Creates a 'synthesis' artifact that can be promoted to canonical.
// AI ONLY creates artifacts, NEVER modifies canonical strategy.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyContext } from '@/lib/os/context';
import { getCompanyById } from '@/lib/airtable/companies';
import { createArtifact, getArtifactById } from '@/lib/os/strategy/artifacts';
import type { StrategyArtifact } from '@/lib/types/strategyArtifact';

export const maxDuration = 120;

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a senior strategist synthesizing multiple strategy artifacts into a coherent recommendation.

Your task is to analyze the provided artifacts and create a SYNTHESIS that:
1. Identifies the common themes and tensions
2. Recommends a path forward
3. Acknowledges trade-offs explicitly
4. Is actionable and grounded

================================
OUTPUT FORMAT
================================

Return a JSON object with this structure:

{
  "synthesis": {
    "title": "Strategy Synthesis: [Theme]",
    "summary": "2-3 sentence executive summary of the recommended path",
    "recommendedPath": {
      "name": "Name for the recommended approach",
      "description": "2-3 paragraphs explaining the recommendation",
      "keyPillars": ["Pillar 1", "Pillar 2", "Pillar 3"],
      "primaryObjective": "The main thing this strategy achieves"
    },
    "tradeoffs": [
      {
        "choice": "What we're choosing",
        "sacrifice": "What we're giving up",
        "rationale": "Why this trade-off is acceptable"
      }
    ],
    "openQuestions": ["Question 1", "Question 2"],
    "content": "Full markdown content for the synthesis artifact"
  },
  "reasoning": "Brief explanation of how you arrived at this synthesis"
}

================================
CONTENT STRUCTURE
================================

## Strategy Synthesis: [Theme]

### Executive Summary
_2-3 paragraph summary of the recommended path_

### Recommended Strategic Path
**[Name of Path]**

_Description of the recommended approach..._

### Key Strategic Pillars
1. **Pillar 1**: Description
2. **Pillar 2**: Description
3. **Pillar 3**: Description

### Trade-offs Acknowledged
| We Choose | We Accept | Rationale |
|-----------|-----------|-----------|
| ... | ... | ... |

### Open Questions for Resolution
- Question 1
- Question 2

### Input Artifacts Synthesized
- [List of artifact titles used]

### Next Steps
1. Review and discuss trade-offs
2. Validate key assumptions
3. Consider for promotion to canonical strategy

================================
RULES
================================

1. Find the SYNTHESIS, not just a summary
2. Be explicit about trade-offs - what are we choosing NOT to do?
3. Acknowledge tensions between artifacts
4. Make a clear recommendation (don't hedge everything)
5. Ground recommendations in the company context
6. This is a DRAFT for human review, not a final strategy
7. Include the source artifacts for traceability`;

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
    const { artifactIds } = body;

    if (!artifactIds || !Array.isArray(artifactIds) || artifactIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one artifactId is required' },
        { status: 400 }
      );
    }

    // Fetch company, context, and selected artifacts
    const [company, context, ...artifactResults] = await Promise.all([
      getCompanyById(companyId),
      getCompanyContext(companyId),
      ...artifactIds.map((id: string) => getArtifactById(id)),
    ]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const artifacts = artifactResults.filter((a): a is StrategyArtifact => a !== null);
    if (artifacts.length === 0) {
      return NextResponse.json(
        { error: 'No valid artifacts found' },
        { status: 400 }
      );
    }

    if (artifacts.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 artifacts required for synthesis' },
        { status: 400 }
      );
    }

    // Build the prompt
    const prompt = buildPrompt(company, context, artifacts);

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    if (!parsed.synthesis) {
      return NextResponse.json(
        { error: 'AI failed to generate valid synthesis' },
        { status: 500 }
      );
    }

    // Create synthesis artifact
    const linkedIds = artifacts.map(a => a.id);
    const artifactTitles = artifacts.map(a => a.title);

    const synthesisContent = parsed.synthesis.content ||
      buildDefaultContent(parsed.synthesis, artifactTitles);

    const synthesisArtifact = await createArtifact({
      companyId,
      type: 'synthesis',
      title: parsed.synthesis.title || 'Strategy Synthesis',
      content: synthesisContent,
      source: 'ai_tool',
      linkedContextRevisionId: context?.updatedAt,
      linkedCompetitionSource: context?.competitors?.length ? 'v4' : null,
      linkedArtifactIds: linkedIds,
    });

    console.log('[ai-tools/synthesize] Created synthesis artifact');

    return NextResponse.json({
      artifact: synthesisArtifact,
      summary: parsed.synthesis.summary,
      recommendedPath: parsed.synthesis.recommendedPath,
      tradeoffs: parsed.synthesis.tradeoffs,
      reasoning: parsed.reasoning || 'Synthesized from provided artifacts',
      sourceArtifactCount: artifacts.length,
    });
  } catch (error) {
    console.error('[ai-tools/synthesize] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to synthesize strategy' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildPrompt(
  company: { name: string },
  context: Awaited<ReturnType<typeof getCompanyContext>>,
  artifacts: StrategyArtifact[]
): string {
  const artifactSummaries = artifacts.map(a => `
### ${a.title} (${a.type})
${a.content}
`).join('\n\n---\n\n');

  return `
Synthesize the following strategy artifacts for ${company.name} into a coherent strategic recommendation.

================================
COMPANY CONTEXT
================================
- Business Model: ${context?.businessModel || 'Not specified'}
- Value Proposition: ${context?.valueProposition || 'Not specified'}
- Primary Audience: ${context?.primaryAudience || 'Not specified'}
- Objectives: ${context?.objectives?.join(', ') || 'Not specified'}
- Constraints: ${context?.constraints || 'Not specified'}
- Competitive Category: ${context?.companyCategory || 'Not specified'}

================================
ARTIFACTS TO SYNTHESIZE (${artifacts.length})
================================

${artifactSummaries}

================================
INSTRUCTIONS
================================
1. Find the common themes across these artifacts
2. Identify any tensions or contradictions
3. Recommend a coherent path forward
4. Be explicit about trade-offs
5. Create an actionable synthesis that can be reviewed for promotion to canonical strategy
`.trim();
}

function buildDefaultContent(
  synthesis: {
    title?: string;
    summary?: string;
    recommendedPath?: {
      name?: string;
      description?: string;
      keyPillars?: string[];
      primaryObjective?: string;
    };
    tradeoffs?: Array<{
      choice: string;
      sacrifice: string;
      rationale: string;
    }>;
    openQuestions?: string[];
  },
  artifactTitles: string[]
): string {
  const path = synthesis.recommendedPath || {};
  const tradeoffs = synthesis.tradeoffs || [];
  const questions = synthesis.openQuestions || [];

  let content = `## ${synthesis.title || 'Strategy Synthesis'}\n\n`;

  content += `### Executive Summary\n${synthesis.summary || '_Summary pending_'}\n\n`;

  content += `### Recommended Strategic Path\n`;
  content += `**${path.name || 'Recommended Approach'}**\n\n`;
  content += `${path.description || '_Description pending_'}\n\n`;

  if (path.keyPillars && path.keyPillars.length > 0) {
    content += `### Key Strategic Pillars\n`;
    path.keyPillars.forEach((pillar, i) => {
      content += `${i + 1}. **${pillar}**\n`;
    });
    content += '\n';
  }

  if (tradeoffs.length > 0) {
    content += `### Trade-offs Acknowledged\n\n`;
    content += `| We Choose | We Accept | Rationale |\n`;
    content += `|-----------|-----------|----------|\n`;
    tradeoffs.forEach(t => {
      content += `| ${t.choice} | ${t.sacrifice} | ${t.rationale} |\n`;
    });
    content += '\n';
  }

  if (questions.length > 0) {
    content += `### Open Questions for Resolution\n`;
    questions.forEach(q => {
      content += `- ${q}\n`;
    });
    content += '\n';
  }

  content += `### Input Artifacts Synthesized\n`;
  artifactTitles.forEach(title => {
    content += `- ${title}\n`;
  });
  content += '\n';

  content += `### Next Steps\n`;
  content += `1. Review and discuss trade-offs with stakeholders\n`;
  content += `2. Validate key assumptions identified in source artifacts\n`;
  content += `3. Consider for promotion to canonical strategy\n`;

  return content.trim();
}
