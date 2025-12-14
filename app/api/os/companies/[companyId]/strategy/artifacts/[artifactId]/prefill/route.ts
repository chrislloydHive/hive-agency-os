// app/api/os/companies/[companyId]/strategy/artifacts/[artifactId]/prefill/route.ts
// AI Prefill for Strategy Artifacts
//
// Generates prefilled title + markdown content based on:
// - Company Context summary
// - Competition summary (V4 if available)
// - Hive Brain defaults (if present)
// - Existing artifacts (for coherence)
//
// NON-NEGOTIABLE: AI may ONLY create/modify Strategy Artifacts
// AI must NEVER write/modify Canonical Strategy or Company Context

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyContext } from '@/lib/os/context';
import { getCompanyById } from '@/lib/airtable/companies';
import { getArtifactById, getArtifactsForCompany, updateArtifact } from '@/lib/os/strategy/artifacts';
import type { StrategyArtifactType, ArtifactGenerationInputs } from '@/lib/types/strategyArtifact';

export const maxDuration = 120;

// ============================================================================
// Type-Specific System Prompts
// ============================================================================

const TYPE_PROMPTS: Record<StrategyArtifactType, string> = {
  growth_option: `You are generating a Growth Option artifact. Focus on:
- Specific opportunity (not vague)
- Target audience segment
- Expected impact (revenue/engagement potential)
- Key constraints and risks
- Quick validation tests (how to cheaply test this)

Structure:
## Growth Option: [Specific Name]

### Opportunity
[What is the specific growth opportunity?]

### Target Audience
[Who exactly would this serve? Be specific.]

### Expected Impact
- Revenue potential: [estimate or range]
- Timeline: [realistic timeframe]
- Confidence: [high/medium/low with reasoning]

### Constraints
[What limitations or dependencies exist?]

### Key Risks
- [Risk 1]
- [Risk 2]

### Quick Tests
1. [Low-cost way to validate]
2. [Another validation approach]`,

  draft_strategy: `You are generating a Draft Strategy artifact. Focus on:
- Clear positioning statement
- 3-5 strategic pillars with rationale
- Priority moves (what to do first)
- Sequencing (order of operations)

Structure:
## Draft Strategy: [Focus Area]

### Positioning
[How this company should position itself in the market]

### Strategic Pillars
1. **[Pillar 1]**: [Description and why it matters]
2. **[Pillar 2]**: [Description and why it matters]
3. **[Pillar 3]**: [Description and why it matters]

### Priority Moves
1. [First thing to do and why]
2. [Second priority]
3. [Third priority]

### Sequencing
[What order should things happen in? What are the dependencies?]

### Success Metrics
| Metric | Current State | Target | Timeline |
|--------|--------------|--------|----------|
| [KPI 1] | [baseline] | [goal] | [when] |`,

  assumptions: `You are generating a Key Assumptions artifact. Focus on:
- Making implicit beliefs explicit
- Categorizing by type (market, customer, competitive, operational)
- Validation signals (what would prove/disprove each)
- What would falsify each assumption

Structure:
## Key Assumptions

### Market Assumptions
| Assumption | Confidence | Validation Signal | What Would Falsify |
|------------|-----------|-------------------|-------------------|
| [belief] | High/Med/Low | [evidence to look for] | [what would prove wrong] |

### Customer Assumptions
| Assumption | Confidence | Validation Signal | What Would Falsify |
|------------|-----------|-------------------|-------------------|
| [belief] | High/Med/Low | [evidence to look for] | [what would prove wrong] |

### Competitive Assumptions
| Assumption | Confidence | Validation Signal | What Would Falsify |
|------------|-----------|-------------------|-------------------|
| [belief] | High/Med/Low | [evidence to look for] | [what would prove wrong] |

### Critical Unknowns
[What do we need to learn that we don't know?]

### Validation Priority
1. [Most important assumption to validate first]
2. [Second priority]`,

  risk_analysis: `You are generating a Risk Analysis artifact. Focus on:
- Specific risks (not generic)
- Impact and likelihood assessment
- Concrete mitigation strategies
- Tradeoffs being made

Structure:
## Risk Analysis

### Risk Register
| Risk | Impact | Likelihood | Priority | Owner |
|------|--------|------------|----------|-------|
| [specific risk] | High/Med/Low | High/Med/Low | P1/P2/P3 | TBD |

### Mitigation Strategies
#### [Risk 1]
- **Mitigation**: [What we'll do to reduce likelihood]
- **Contingency**: [What we'll do if it happens]

### Strategic Tradeoffs
| We're Choosing | We're Accepting | Rationale |
|---------------|-----------------|-----------|
| [choice] | [downside] | [why] |

### Dependencies & Blockers
- [Dependency 1]: [status]
- [Dependency 2]: [status]

### Monitoring Plan
[How will we detect if risks are materializing?]`,

  channel_plan: `You are generating a Channel Plan artifact. Focus on:
- Specific channel and why it's relevant
- Target audience on this channel
- Content/approach strategy
- Success metrics

Structure:
## Channel Plan: [Channel Name]

### Why This Channel
[Why this channel matters for this company]

### Target Audience on Channel
[Who we're reaching and their behavior on this channel]

### Approach
[How we'll show up on this channel - tone, format, frequency]

### Content Strategy
| Content Type | Frequency | Purpose |
|-------------|-----------|---------|
| [type] | [cadence] | [goal] |

### Success Metrics
- [Metric 1]: [target]
- [Metric 2]: [target]

### Resource Requirements
[What's needed to execute this well]`,

  synthesis: `You are generating a Synthesis artifact. Focus on:
- Key themes across inputs
- Tensions and contradictions
- Recommended path forward
- Trade-offs being made

Structure:
## Synthesis: [Theme]

### Executive Summary
[2-3 paragraphs summarizing the strategic direction]

### Key Themes
1. **[Theme 1]**: [Explanation]
2. **[Theme 2]**: [Explanation]

### Tensions Identified
- [Tension 1]: [How we're resolving it]
- [Tension 2]: [How we're resolving it]

### Recommended Path
[Clear recommendation with rationale]

### Trade-offs Acknowledged
| Choosing | Over | Because |
|----------|------|---------|
| [option A] | [option B] | [reasoning] |

### Open Questions
- [Question 1]
- [Question 2]`,
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

    // Get other artifacts for coherence (exclude current)
    const otherArtifacts = allArtifacts.filter(a => a.id !== artifactId);
    const artifactSummaries = otherArtifacts
      .slice(0, 5) // Limit to 5 for context length
      .map(a => `- ${a.title} (${a.type}): ${a.content.slice(0, 100)}...`)
      .join('\n');

    // Build the prompt
    const prompt = buildPrefillPrompt(
      company,
      context,
      artifact.type,
      artifactSummaries
    );

    const typePrompt = TYPE_PROMPTS[artifact.type];

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${typePrompt}

================================
RULES
================================
1. Be SPECIFIC to this company's context - no generic marketing fluff
2. Use concrete numbers and examples where possible
3. Make it actionable - what should they actually do?
4. Keep it concise - quality over quantity
5. This is a STARTING POINT for editing, not a final document
6. Output valid JSON with "title" and "contentMarkdown" fields`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    if (!parsed.title || !parsed.contentMarkdown) {
      return NextResponse.json(
        { error: 'AI failed to generate valid content' },
        { status: 500 }
      );
    }

    // Build generation inputs metadata
    const generationInputs: ArtifactGenerationInputs = {
      contextRevisionId: context?.updatedAt,
      competitionSource: context?.competitors?.length ? 'v4' : null,
      hiveBrainVersion: undefined, // TODO: Add when Hive Brain versioning exists
      artifactIdsUsed: otherArtifacts.slice(0, 5).map(a => a.id),
    };

    // Update the artifact with generated content
    const updatedArtifact = await updateArtifact({
      artifactId,
      updates: {
        title: parsed.title,
        content: parsed.contentMarkdown,
      },
    });

    console.log('[prefill] Generated prefill for artifact:', {
      artifactId,
      type: artifact.type,
      titleLength: parsed.title.length,
      contentLength: parsed.contentMarkdown.length,
    });

    return NextResponse.json({
      title: parsed.title,
      contentMarkdown: parsed.contentMarkdown,
      artifact: updatedArtifact,
      generationInputs,
    });
  } catch (error) {
    console.error('[prefill] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate prefill' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildPrefillPrompt(
  company: { name: string; website?: string; industry?: string },
  context: Awaited<ReturnType<typeof getCompanyContext>>,
  artifactType: StrategyArtifactType,
  existingArtifactSummaries: string
): string {
  const competitors = context?.competitors || [];
  const directCompetitors = competitors.filter(c => c.type === 'direct').slice(0, 3);
  const competitorNames = directCompetitors.map(c => c.domain).join(', ') || 'None identified';

  return `
Generate a ${artifactType.replace('_', ' ')} artifact for ${company.name}.

================================
COMPANY INFO
================================
- Name: ${company.name}
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

================================
COMPETITION
================================
- Category: ${context?.companyCategory || 'Not specified'}
- Direct Competitors: ${competitorNames}
- Competitive Notes: ${context?.competitorsNotes || 'None'}

================================
EXISTING ARTIFACTS (for coherence)
================================
${existingArtifactSummaries || 'None yet'}

================================
OUTPUT FORMAT
================================
Return a JSON object with:
{
  "title": "Artifact Title (include type prefix like 'Growth Option: ...' or 'Draft Strategy: ...')",
  "contentMarkdown": "Full markdown content following the structure above"
}
`.trim();
}
