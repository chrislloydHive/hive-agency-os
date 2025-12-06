// app/api/os/companies/[companyId]/map/node-insights/route.ts
// API route to generate AI insights for Strategic Map nodes

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getInsightsForCompany } from '@/lib/insights/repo';

// ============================================================================
// Types
// ============================================================================

interface RequestBody {
  nodeId: string;
  nodeLabel: string;
  nodeDomain: string;
  fieldPaths: string[];
}

interface NodeInsight {
  id: string;
  type: 'opportunity' | 'gap' | 'strength' | 'risk';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  relatedInsightId?: string;
}

// ============================================================================
// OpenAI Client
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// Helper: Extract node context from graph
// ============================================================================

function extractNodeContext(
  graph: Awaited<ReturnType<typeof loadContextGraph>>,
  fieldPaths: string[]
): Record<string, unknown> {
  if (!graph) return {};

  const context: Record<string, unknown> = {};

  for (const path of fieldPaths) {
    const parts = path.split('.');
    let current: unknown = graph;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        current = undefined;
        break;
      }
    }

    if (current && typeof current === 'object' && 'value' in current) {
      context[path] = (current as { value: unknown }).value;
    } else if (current !== undefined) {
      context[path] = current;
    }
  }

  return context;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body: RequestBody = await request.json();

    const { nodeId, nodeLabel, nodeDomain, fieldPaths } = body;

    if (!nodeId || !nodeLabel || !nodeDomain) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Load context graph and existing insights in parallel
    const [graph, existingInsights] = await Promise.all([
      loadContextGraph(companyId),
      getInsightsForCompany(companyId).catch(() => []),
    ]);

    const nodeContext = extractNodeContext(graph, fieldPaths);

    // Filter existing insights related to this domain
    const domainInsights = existingInsights.filter(
      insight => insight.category === nodeDomain ||
                 insight.contextPaths?.some(path => path.startsWith(nodeDomain))
    );

    // Build the prompt
    const systemPrompt = `You are a strategic marketing analyst generating actionable insights.
Analyze company context data and identify strategic insights.

Guidelines:
- Focus on actionable, specific insights
- Categorize as: opportunity, gap, strength, or risk
- Prioritize by business impact (high, medium, low)
- Mark insights that can be acted upon immediately as actionable
- Keep descriptions concise but informative`;

    const userPrompt = `Analyze this context node and generate strategic insights:

Node: ${nodeLabel}
Domain: ${nodeDomain}

Field Data:
${JSON.stringify(nodeContext, null, 2)}

Existing Domain Insights:
${domainInsights.length > 0
  ? domainInsights.map(i => `- ${i.title}: ${i.body}`).join('\n')
  : 'None available'}

Generate 2-4 insights. Format your response as JSON:
{
  "insights": [
    {
      "type": "opportunity|gap|strength|risk",
      "title": "Short title",
      "description": "Detailed description",
      "priority": "high|medium|low",
      "actionable": true/false
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);

    // Transform to NodeInsight format with IDs
    const insights: NodeInsight[] = (parsed.insights || []).map(
      (insight: Omit<NodeInsight, 'id'>, index: number) => ({
        id: `${nodeId}-insight-${index}`,
        type: insight.type || 'opportunity',
        title: insight.title || 'Untitled Insight',
        description: insight.description || '',
        priority: insight.priority || 'medium',
        actionable: insight.actionable ?? false,
      })
    );

    return NextResponse.json({ insights });

  } catch (error) {
    console.error('[Node Insights API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
