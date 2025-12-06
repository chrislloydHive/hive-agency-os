// app/api/os/companies/[companyId]/map/node-summary/route.ts
// API route to generate AI summaries for Strategic Map nodes

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import type { StrategicMapNode } from '@/lib/contextGraph/strategicMap';

// ============================================================================
// Types
// ============================================================================

interface RequestBody {
  nodeId: string;
  nodeLabel: string;
  nodeDomain: string;
  fieldPaths: string[];
  completeness: string;
  confidence: string;
  provenanceKind: string;
  valuePreview?: string;
}

interface NodeSummaryResponse {
  summary: string;
  confidence: number;
  recommendations: string[];
  relatedQuestions: string[];
  generatedAt: string;
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

    // Extract value from WithMeta wrapper
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

    const {
      nodeId,
      nodeLabel,
      nodeDomain,
      fieldPaths,
      completeness,
      confidence,
      provenanceKind,
      valuePreview,
    } = body;

    // Validate required fields
    if (!nodeId || !nodeLabel || !nodeDomain) {
      return NextResponse.json(
        { error: 'Missing required fields: nodeId, nodeLabel, nodeDomain' },
        { status: 400 }
      );
    }

    // Load context graph for additional context
    const graph = await loadContextGraph(companyId);
    const nodeContext = extractNodeContext(graph, fieldPaths);

    // Build the prompt
    const systemPrompt = `You are a strategic marketing analyst helping to summarize company context data.
Your task is to provide a concise, actionable summary of a specific context node.

Guidelines:
- Be specific and actionable
- Focus on strategic implications
- Identify gaps and opportunities
- Keep summaries to 2-3 sentences
- Provide 2-3 concrete recommendations
- Suggest 2-3 follow-up questions the user might want to explore`;

    const userPrompt = `Analyze this context node for a company:

Node: ${nodeLabel}
Domain: ${nodeDomain}
Node ID: ${nodeId}

Current Status:
- Completeness: ${completeness}
- Confidence: ${confidence}
- Data Source: ${provenanceKind}
${valuePreview ? `- Current Value Preview: "${valuePreview}"` : ''}

Field Data:
${JSON.stringify(nodeContext, null, 2)}

Please provide:
1. A 2-3 sentence summary of this node's strategic importance and current state
2. 2-3 specific recommendations to improve or leverage this context
3. 2-3 follow-up questions to explore

Format your response as JSON with this structure:
{
  "summary": "...",
  "recommendations": ["...", "...", "..."],
  "relatedQuestions": ["...", "...", "..."]
}`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);

    const response: NodeSummaryResponse = {
      summary: parsed.summary || 'Unable to generate summary.',
      confidence: confidence === 'high' ? 0.9 : confidence === 'medium' ? 0.7 : 0.5,
      recommendations: parsed.recommendations || [],
      relatedQuestions: parsed.relatedQuestions || [],
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Node Summary API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
