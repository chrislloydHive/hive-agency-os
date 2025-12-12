// app/api/os/strategy/ai-propose/route.ts
// AI-assisted strategy proposal API

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyContext } from '@/lib/os/context';
import { getCompanyById } from '@/lib/airtable/companies';
import type { StrategyPillar, StrategyService } from '@/lib/types/strategy';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, contextOverride } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Fetch company and context
    const [company, context] = await Promise.all([
      getCompanyById(companyId),
      getCompanyContext(companyId),
    ]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const openai = getOpenAI();

    const prompt = buildStrategyPrompt(company, context, contextOverride);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a senior marketing strategist proposing a comprehensive marketing strategy.
Create a strategy with 3-5 strategic pillars that address the company's objectives.
Each pillar should have a clear title, description, priority level, and associated services.
Return your response as a structured JSON object.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Transform AI response to strategy format
    const proposal = {
      title: parsed.title || `${company.name} Marketing Strategy`,
      summary: parsed.summary || 'AI-generated marketing strategy',
      objectives: parsed.objectives || context?.objectives || [],
      pillars: (parsed.pillars || []).map((p: {
        title?: string;
        description?: string;
        priority?: string;
        services?: string[];
        kpis?: string[];
      }, i: number): Omit<StrategyPillar, 'id'> => ({
        title: p.title || `Pillar ${i + 1}`,
        description: p.description || '',
        priority: validatePriority(p.priority),
        services: validateServices(p.services),
        kpis: p.kpis || [],
        order: i,
      })),
      reasoning: parsed.reasoning || 'Based on company context and objectives',
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
  context: Awaited<ReturnType<typeof getCompanyContext>>,
  override?: Record<string, string>
): string {
  return `
Propose a marketing strategy for ${company.name}.

Company Info:
- Website: ${company.website || 'Not specified'}
- Industry: ${company.industry || 'Not specified'}

Context:
- Business Model: ${override?.businessModel || context?.businessModel || 'Not specified'}
- Value Proposition: ${override?.valueProposition || context?.valueProposition || 'Not specified'}
- Primary Audience: ${override?.primaryAudience || context?.primaryAudience || 'Not specified'}
- Secondary Audience: ${context?.secondaryAudience || 'Not specified'}
- Objectives: ${context?.objectives?.join(', ') || 'Grow business'}
- Constraints: ${context?.constraints || 'Standard budget and timeline'}
- Competitive Notes: ${context?.competitorsNotes || 'Competitive market'}

Return a JSON object with this structure:
{
  "title": "Strategy title",
  "summary": "2-3 sentence strategy overview",
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "pillars": [
    {
      "title": "Pillar title",
      "description": "2-3 sentence description of this pillar's approach",
      "priority": "high" | "medium" | "low",
      "services": ["website", "seo", "content", "media", "brand", "social"],
      "kpis": ["KPI 1", "KPI 2"]
    }
  ],
  "reasoning": "Brief explanation of why this strategy was chosen"
}

Create 3-5 pillars that work together to achieve the objectives.
`.trim();
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
