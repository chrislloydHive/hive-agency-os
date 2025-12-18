// app/api/os/strategy/ai-propose/route.ts
// AI-assisted strategy proposal API
//
// Uses Competition V4 category definition and validated competitors
// to ground strategy recommendations in competitive landscape.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyContext } from '@/lib/os/context';
import { getActiveStrategy } from '@/lib/os/strategy';
import { getCompanyById } from '@/lib/airtable/companies';
import type { StrategyPillar, StrategyService, StrategyFrame } from '@/lib/types/strategy';
import { normalizeFrame } from '@/lib/types/strategy';
import type { CompanyContext, Competitor } from '@/lib/types/context';

export const maxDuration = 120;

// ============================================================================
// System Prompt
// ============================================================================

const STRATEGY_SYSTEM_PROMPT = `You are a senior marketing strategist creating a marketing strategy grounded in competitive positioning.

Your strategy MUST be anchored in the company's competitive landscape:
1. STATE the competitive category the company operates in
2. REFERENCE competitor dynamics (types and patterns, not brand spam)
3. JUSTIFY each pillar based on competitive positioning

================================
OUTPUT REQUIREMENTS
================================

Your response must be a JSON object with this structure:

{
  "title": "Strategy title",
  "summary": "2-3 sentence strategy overview that explicitly mentions the competitive category",
  "competitiveCategory": "The category this company competes in (from context)",
  "competitivePositioning": "1-2 sentences on how this company should position vs competitors",
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "pillars": [
    {
      "title": "Pillar title",
      "description": "2-3 sentence description including competitive rationale",
      "competitiveRationale": "Why this pillar matters given the competitive landscape",
      "priority": "high" | "medium" | "low",
      "services": ["website", "seo", "content", "media", "brand", "social"],
      "kpis": ["KPI 1", "KPI 2"]
    }
  ],
  "reasoning": "Brief explanation of why this strategy was chosen given the competitive context"
}

================================
RULES
================================

1. ALWAYS state the competitive category in the summary
2. Each pillar MUST include competitiveRationale explaining why it matters vs competitors
3. Do NOT spam competitor brand names - reference competitor TYPES (e.g., "direct marketplace competitors", "national players", "local specialists")
4. Ground recommendations in what will differentiate this company
5. Create 3-5 pillars that form a coherent competitive strategy
6. Be specific about WHY each pillar matters for winning in this category`;

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, contextOverride } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Fetch company, context, and current strategy (for frame)
    const [company, context, currentStrategy] = await Promise.all([
      getCompanyById(companyId),
      getCompanyContext(companyId),
      getActiveStrategy(companyId),
    ]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get the normalized frame from current strategy
    const frame = normalizeFrame(currentStrategy?.strategyFrame);

    const openai = getOpenAI();

    const prompt = buildStrategyPrompt(company, context, contextOverride, frame);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: STRATEGY_SYSTEM_PROMPT,
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

    // Transform AI response to strategy format
    const proposal = {
      title: parsed.title || `${company.name} Marketing Strategy`,
      summary: parsed.summary || 'AI-generated marketing strategy',
      competitiveCategory: parsed.competitiveCategory || context?.companyCategory || null,
      competitivePositioning: parsed.competitivePositioning || null,
      objectives: parsed.objectives || context?.objectives || [],
      pillars: (parsed.pillars || []).map((p: {
        title?: string;
        description?: string;
        competitiveRationale?: string;
        priority?: string;
        services?: string[];
        kpis?: string[];
      }, i: number): Omit<StrategyPillar, 'id'> & { competitiveRationale?: string } => ({
        title: p.title || `Pillar ${i + 1}`,
        description: p.description || '',
        competitiveRationale: p.competitiveRationale || undefined,
        priority: validatePriority(p.priority),
        services: validateServices(p.services),
        kpis: p.kpis || [],
        order: i,
      })),
      reasoning: parsed.reasoning || 'Based on company context and competitive landscape',
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      proposal,
      confidence: 0.8,
      sources: ['company_context', 'ai_analysis'],
    });
  } catch (error) {
    console.error('[API] strategy/ai-propose error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI propose failed' },
      { status: 500 }
    );
  }
}

function buildStrategyPrompt(
  company: { name: string; website?: string; industry?: string },
  context: CompanyContext | null,
  override?: Record<string, string>,
  frame?: StrategyFrame
): string {
  // Build competitor summary by type
  const competitors = context?.competitors || [];
  const directCompetitors = competitors.filter(c => c.type === 'direct');
  const indirectCompetitors = competitors.filter(c => c.type === 'indirect');
  const adjacentCompetitors = competitors.filter(c => c.type === 'adjacent');

  const competitorSummary = buildCompetitorSummary(directCompetitors, indirectCompetitors, adjacentCompetitors);

  // Build frame section if frame exists
  const hasFrame = frame && (frame.audience || frame.offering || frame.valueProp || frame.positioning);
  const frameSection = hasFrame ? `
================================
STRATEGIC FRAME${frame.isLocked ? ' (LOCKED - DO NOT MODIFY)' : ''}
================================
${frame.audience ? `- Target Audience: ${frame.audience}` : ''}
${frame.offering ? `- Offering: ${frame.offering}` : ''}
${frame.valueProp ? `- Value Proposition: ${frame.valueProp}` : ''}
${frame.positioning ? `- Positioning: ${frame.positioning}` : ''}
${frame.constraints ? `- Constraints: ${frame.constraints}` : ''}
${frame.successMetrics?.length ? `- Success Metrics: ${frame.successMetrics.join(', ')}` : ''}
${frame.nonGoals?.length ? `- Non-Goals: ${frame.nonGoals.join(', ')}` : ''}
${frame.isLocked ? '\n⚠️ The strategic frame is LOCKED. Your strategy must align with these values without proposing changes to them.' : ''}
` : '';

  return `
Propose a marketing strategy for ${company.name}.

================================
COMPANY INFO
================================
- Website: ${company.website || 'Not specified'}
- Industry: ${company.industry || 'Not specified'}
${frameSection}
================================
COMPETITIVE CATEGORY
================================
${context?.companyCategory || 'Category not specified - infer from business model and audience'}

================================
COMPETITORS
================================
${competitorSummary}

================================
COMPETITIVE NOTES
================================
${context?.competitorsNotes || 'No competitive notes available'}

================================
BUSINESS CONTEXT
================================
- Business Model: ${override?.businessModel || context?.businessModel || 'Not specified'}
- Value Proposition: ${override?.valueProposition || context?.valueProposition || frame?.valueProp || 'Not specified'}
- Primary Audience: ${override?.primaryAudience || context?.primaryAudience || frame?.audience || 'Not specified'}
- Secondary Audience: ${context?.secondaryAudience || 'Not specified'}
- Objectives: ${context?.objectives?.join(', ') || 'Grow business'}
- Constraints: ${context?.constraints || frame?.constraints || 'Standard budget and timeline'}

================================
INSTRUCTIONS
================================
Create a 3-5 pillar strategy that:
1. Is grounded in the competitive category above
2. Addresses specific competitive dynamics
3. Differentiates this company in its market
${hasFrame && frame?.isLocked ? '4. MUST align with the locked strategic frame values' : ''}
${hasFrame && frame?.nonGoals?.length ? `5. Explicitly AVOID these non-goals: ${frame.nonGoals.join(', ')}` : ''}

Reference competitor TYPES (direct, indirect, adjacent) not brand names.
`.trim();
}

/**
 * Build a competitor summary grouped by type
 */
function buildCompetitorSummary(
  direct: Competitor[],
  indirect: Competitor[],
  adjacent: Competitor[]
): string {
  const parts: string[] = [];

  if (direct.length > 0) {
    const domains = direct.slice(0, 5).map(c => c.domain).join(', ');
    parts.push(`Direct competitors (${direct.length}): ${domains}`);
  }

  if (indirect.length > 0) {
    const domains = indirect.slice(0, 3).map(c => c.domain).join(', ');
    parts.push(`Indirect competitors (${indirect.length}): ${domains}`);
  }

  if (adjacent.length > 0) {
    const domains = adjacent.slice(0, 3).map(c => c.domain).join(', ');
    parts.push(`Adjacent competitors (${adjacent.length}): ${domains}`);
  }

  if (parts.length === 0) {
    return 'No competitors identified yet';
  }

  return parts.join('\n');
}

function validatePriority(priority?: string): 'high' | 'medium' | 'low' {
  if (priority === 'high' || priority === 'medium' || priority === 'low') {
    return priority;
  }
  return 'medium';
}

const VALID_SERVICES: StrategyService[] = [
  'website', 'seo', 'content', 'media', 'brand', 'social', 'email', 'analytics', 'conversion', 'other'
];

function validateServices(services?: string[]): StrategyService[] {
  if (!services || !Array.isArray(services)) {
    return [];
  }
  return services.filter((s): s is StrategyService =>
    VALID_SERVICES.includes(s as StrategyService)
  );
}
