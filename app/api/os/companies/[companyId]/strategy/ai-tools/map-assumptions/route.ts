// app/api/os/companies/[companyId]/strategy/ai-tools/map-assumptions/route.ts
// AI Tool: Assumption & Risk Mapper
//
// Analyzes selected artifacts to extract key assumptions and risks.
// Creates one 'assumptions' artifact and one 'risk_analysis' artifact.
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

const SYSTEM_PROMPT = `You are a strategic analyst specializing in identifying assumptions and risks in marketing strategies.

Your task is to analyze the provided artifacts and extract:
1. KEY ASSUMPTIONS - What must be true for these strategies to work?
2. KEY RISKS - What could go wrong? What are the threats?

================================
OUTPUT FORMAT
================================

Return a JSON object with this structure:

{
  "assumptions": {
    "title": "Key Assumptions",
    "items": [
      {
        "assumption": "Clear statement of the assumption",
        "category": "market" | "customer" | "competitive" | "operational" | "financial",
        "criticality": "high" | "medium" | "low",
        "validationMethod": "How to test/validate this assumption",
        "sourceArtifact": "Which artifact this came from (by title)"
      }
    ],
    "content": "Full markdown content for the assumptions artifact"
  },
  "risks": {
    "title": "Risk Analysis",
    "items": [
      {
        "risk": "Clear statement of the risk",
        "category": "market" | "execution" | "competitive" | "resource" | "timing",
        "impact": "high" | "medium" | "low",
        "likelihood": "high" | "medium" | "low",
        "mitigation": "How to mitigate this risk",
        "sourceArtifact": "Which artifact this came from (by title)"
      }
    ],
    "content": "Full markdown content for the risk analysis artifact"
  },
  "reasoning": "Brief explanation of your analysis approach"
}

================================
ASSUMPTIONS CONTENT STRUCTURE
================================

## Key Assumptions

### Critical Assumptions (Must Validate)
| Assumption | Category | Validation Method |
|------------|----------|-------------------|
| ... | ... | ... |

### Supporting Assumptions
| Assumption | Category | Validation Method |
|------------|----------|-------------------|
| ... | ... | ... |

### Validation Priority
1. First assumption to validate...
2. Second assumption to validate...

================================
RISKS CONTENT STRUCTURE
================================

## Risk Analysis

### Risk Matrix
| Risk | Impact | Likelihood | Priority |
|------|--------|------------|----------|
| ... | ... | ... | ... |

### Mitigation Strategies
#### [Risk Name]
- Mitigation approach...

### Contingency Plans
_What to do if key risks materialize..._

================================
RULES
================================

1. Extract assumptions that are IMPLICIT in the artifacts (not explicitly stated)
2. Identify risks specific to the strategy, not generic business risks
3. Connect each item back to its source artifact
4. Prioritize by criticality/impact
5. Be specific - avoid generic assumptions/risks
6. Include at least 3-5 assumptions and 3-5 risks`;

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

    // Build the prompt
    const prompt = buildPrompt(company, context, artifacts);

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    if (!parsed.assumptions || !parsed.risks) {
      return NextResponse.json(
        { error: 'AI failed to generate valid analysis' },
        { status: 500 }
      );
    }

    // Create artifacts
    const linkedIds = artifacts.map(a => a.id);
    const createdArtifacts: StrategyArtifact[] = [];

    // Create assumptions artifact
    const assumptionsArtifact = await createArtifact({
      companyId,
      type: 'assumptions',
      title: parsed.assumptions.title || 'Key Assumptions',
      content: parsed.assumptions.content || buildAssumptionsContent(parsed.assumptions.items),
      source: 'ai_tool',
      linkedContextRevisionId: context?.updatedAt,
      linkedArtifactIds: linkedIds,
    });
    createdArtifacts.push(assumptionsArtifact);

    // Create risk analysis artifact
    const risksArtifact = await createArtifact({
      companyId,
      type: 'risk_analysis',
      title: parsed.risks.title || 'Risk Analysis',
      content: parsed.risks.content || buildRisksContent(parsed.risks.items),
      source: 'ai_tool',
      linkedContextRevisionId: context?.updatedAt,
      linkedArtifactIds: linkedIds,
    });
    createdArtifacts.push(risksArtifact);

    console.log('[ai-tools/map-assumptions] Created assumptions and risk artifacts');

    return NextResponse.json({
      artifacts: createdArtifacts,
      reasoning: parsed.reasoning || 'Analyzed provided artifacts for assumptions and risks',
      sourceArtifactCount: artifacts.length,
    });
  } catch (error) {
    console.error('[ai-tools/map-assumptions] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to map assumptions' },
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
Analyze the following strategy artifacts for ${company.name} and extract key assumptions and risks.

================================
COMPANY CONTEXT
================================
- Business Model: ${context?.businessModel || 'Not specified'}
- Primary Audience: ${context?.primaryAudience || 'Not specified'}
- Objectives: ${context?.objectives?.join(', ') || 'Not specified'}
- Constraints: ${context?.constraints || 'Not specified'}

================================
ARTIFACTS TO ANALYZE (${artifacts.length})
================================

${artifactSummaries}

================================
INSTRUCTIONS
================================
1. Identify the key ASSUMPTIONS embedded in these artifacts
2. Identify the key RISKS associated with these strategies
3. Connect each assumption/risk to its source artifact
4. Prioritize by criticality and impact
5. Suggest validation methods and mitigations
`.trim();
}

function buildAssumptionsContent(items: Array<{
  assumption: string;
  category: string;
  criticality: string;
  validationMethod: string;
  sourceArtifact: string;
}>): string {
  if (!items || items.length === 0) {
    return '## Key Assumptions\n\n_No assumptions identified_';
  }

  const critical = items.filter(i => i.criticality === 'high');
  const other = items.filter(i => i.criticality !== 'high');

  let content = '## Key Assumptions\n\n';

  if (critical.length > 0) {
    content += '### Critical Assumptions (Must Validate)\n\n';
    content += '| Assumption | Category | Validation Method |\n';
    content += '|------------|----------|-------------------|\n';
    critical.forEach(i => {
      content += `| ${i.assumption} | ${i.category} | ${i.validationMethod} |\n`;
    });
    content += '\n';
  }

  if (other.length > 0) {
    content += '### Supporting Assumptions\n\n';
    content += '| Assumption | Category | Validation Method |\n';
    content += '|------------|----------|-------------------|\n';
    other.forEach(i => {
      content += `| ${i.assumption} | ${i.category} | ${i.validationMethod} |\n`;
    });
  }

  return content.trim();
}

function buildRisksContent(items: Array<{
  risk: string;
  category: string;
  impact: string;
  likelihood: string;
  mitigation: string;
  sourceArtifact: string;
}>): string {
  if (!items || items.length === 0) {
    return '## Risk Analysis\n\n_No risks identified_';
  }

  let content = '## Risk Analysis\n\n';
  content += '### Risk Matrix\n\n';
  content += '| Risk | Impact | Likelihood | Priority |\n';
  content += '|------|--------|------------|----------|\n';

  items.forEach(i => {
    const priority = getPriority(i.impact, i.likelihood);
    content += `| ${i.risk} | ${i.impact} | ${i.likelihood} | ${priority} |\n`;
  });

  content += '\n### Mitigation Strategies\n\n';
  items.forEach(i => {
    content += `**${i.risk}**\n- ${i.mitigation}\n\n`;
  });

  return content.trim();
}

function getPriority(impact: string, likelihood: string): string {
  if (impact === 'high' && likelihood === 'high') return 'Critical';
  if (impact === 'high' || likelihood === 'high') return 'High';
  if (impact === 'medium' && likelihood === 'medium') return 'Medium';
  return 'Low';
}
