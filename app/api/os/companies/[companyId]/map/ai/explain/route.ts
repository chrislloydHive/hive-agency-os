// app/api/os/companies/[companyId]/map/ai/explain/route.ts
// AI Explain Map - Generate strategic narrative for the entire map
//
// Generates a 6-10 sentence strategic narrative covering:
// - Flow from identity → audience → brand → offers → execution
// - Misalignments and contradictions
// - Upstream/downstream bottlenecks
// - Overall strategic coherence

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { buildStrategicMapGraph, DOMAIN_LABELS } from '@/lib/contextGraph/strategicMap';
import type { StrategicMapGraph, StrategicMapNode } from '@/lib/contextGraph/strategicMap';

// ============================================================================
// Types
// ============================================================================

interface ExplainResponse {
  narrative: string;
  sections: {
    title: string;
    content: string;
    type: 'strength' | 'weakness' | 'opportunity' | 'risk';
  }[];
  keyTakeaways: string[];
  overallAssessment: 'strong' | 'moderate' | 'weak';
  confidenceScore: number;
}

// ============================================================================
// OpenAI Client
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// Helper: Build context for AI
// ============================================================================

function buildMapContext(graph: StrategicMapGraph): string {
  const nodeDescriptions = graph.nodes.map(node => {
    const status = node.completeness === 'full' ? 'complete' :
                   node.completeness === 'partial' ? 'partially complete' : 'empty';
    const source = node.provenanceKind === 'human' ? 'human-verified' :
                   node.provenanceKind === 'ai' ? 'AI-generated' : 'mixed sources';
    const conflicts = node.conflictFlags.length > 0
      ? ` Issues: ${node.conflictFlags.map(c => c.message).join(', ')}`
      : '';

    return `- ${node.label} (${DOMAIN_LABELS[node.domain]}): ${status}, ${source}, score ${node.completenessScore}%${conflicts}${node.valuePreview ? ` - "${node.valuePreview}"` : ''}`;
  }).join('\n');

  const edgeDescriptions = graph.edges.map(edge => {
    const fromNode = graph.nodes.find(n => n.id === edge.from);
    const toNode = graph.nodes.find(n => n.id === edge.to);
    return `- ${fromNode?.label} → ${toNode?.label}: ${edge.style.replace('_', ' ')}`;
  }).join('\n');

  return `
STRATEGIC MAP OVERVIEW
======================
Overall Score: ${graph.mapScore}%
Total Nodes: ${graph.stats.totalNodes}
Complete: ${graph.stats.completeNodes}
Partial: ${graph.stats.partialNodes}
Empty: ${graph.stats.emptyNodes}
Human-verified: ${graph.stats.humanNodes}
AI-generated: ${graph.stats.aiNodes}
Conflicts: ${graph.stats.totalConflicts}

NODES:
${nodeDescriptions}

CONNECTIONS:
${edgeDescriptions}
`;
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

    // Load data
    const [graph, health] = await Promise.all([
      loadContextGraph(companyId),
      computeContextHealthScore(companyId),
    ]);

    if (!graph) {
      return NextResponse.json(
        { error: 'No context graph found' },
        { status: 404 }
      );
    }

    const mapGraph = buildStrategicMapGraph(graph, health);
    const mapContext = buildMapContext(mapGraph);

    // Build the prompt
    const systemPrompt = `You are a strategic marketing consultant analyzing a company's strategic context map.
The map shows how different aspects of their marketing strategy connect and flow:
Identity → Audience → Brand → Product/Offers → Competitive Position → Website/Content/Media → Objectives

Your task is to provide a clear, actionable strategic narrative.

Guidelines:
- Be direct and specific, not generic
- Identify concrete misalignments and bottlenecks
- Point out contradictions in strategy
- Highlight dependencies that are broken or weak
- Focus on actionable insights
- Write in a professional but accessible tone`;

    const userPrompt = `Analyze this strategic map and generate a comprehensive narrative:

${mapContext}

Provide your analysis as JSON:
{
  "narrative": "A 6-10 sentence strategic narrative covering the overall strategic flow, key strengths, main weaknesses, and critical dependencies.",
  "sections": [
    {
      "title": "Section title",
      "content": "2-3 sentence analysis",
      "type": "strength | weakness | opportunity | risk"
    }
  ],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "overallAssessment": "strong | moderate | weak",
  "confidenceScore": 0.0-1.0
}

Generate 3-5 sections covering the most important strategic observations.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed: ExplainResponse = JSON.parse(content);

    return NextResponse.json({
      ...parsed,
      generatedAt: new Date().toISOString(),
      mapScore: mapGraph.mapScore,
    });

  } catch (error) {
    console.error('[Map AI Explain] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate explanation' },
      { status: 500 }
    );
  }
}
