// app/api/os/companies/[companyId]/map/ai/opportunities/route.ts
// AI Identify Opportunities - Detect leverage points in the strategic map
//
// Detects:
// - Strong brand but weak ICP targeting
// - Strong offers but no content strategy
// - Strong website but no SEO
// - Underutilized strengths
// - Quick wins

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { buildStrategicMapGraph, DOMAIN_LABELS } from '@/lib/contextGraph/strategicMap';
import type { StrategicMapGraph } from '@/lib/contextGraph/strategicMap';

// ============================================================================
// Types
// ============================================================================

interface StrategicOpportunity {
  id: string;
  title: string;
  type: 'leverage_strength' | 'quick_win' | 'amplify_connection' | 'unlock_potential' | 'optimize_flow';
  description: string;
  currentState: string;
  potentialOutcome: string;
  effortLevel: 'low' | 'medium' | 'high';
  impactLevel: 'low' | 'medium' | 'high';
  relatedNodes: string[];
  actionSteps: string[];
  priority: number;
}

interface OpportunitiesResponse {
  opportunities: StrategicOpportunity[];
  summary: string;
  highImpactCount: number;
  quickWinCount: number;
  totalCount: number;
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
  // Identify strengths (complete nodes)
  const strengths = graph.nodes
    .filter(n => n.completeness === 'full' || n.completenessScore >= 75)
    .map(n => `- ${n.label}: ${n.completenessScore}% complete, ${n.provenanceKind} source`)
    .join('\n');

  // Identify weak nodes
  const weaknesses = graph.nodes
    .filter(n => n.completeness === 'partial' || n.completenessScore < 50)
    .map(n => `- ${n.label}: ${n.completenessScore}% complete${n.valuePreview ? ` - "${n.valuePreview}"` : ''}`)
    .join('\n');

  // Strong edges
  const strongEdges = graph.edges
    .filter(e => e.style === 'strong_alignment' || e.style === 'human_verified')
    .map(edge => {
      const fromNode = graph.nodes.find(n => n.id === edge.from);
      const toNode = graph.nodes.find(n => n.id === edge.to);
      return `- ${fromNode?.label} → ${toNode?.label}: ${edge.style.replace('_', ' ')}`;
    }).join('\n');

  // All node descriptions
  const allNodes = graph.nodes.map(node => {
    return `- ${node.id}: "${node.label}" [${DOMAIN_LABELS[node.domain]}] - ${node.completenessScore}% complete, ${node.confidenceScore}% confidence${node.valuePreview ? ` - "${node.valuePreview}"` : ''}`;
  }).join('\n');

  return `
STRATEGIC MAP ANALYSIS
======================
Overall Score: ${graph.mapScore}%

STRENGTHS (Complete/Strong Nodes):
${strengths || 'No fully complete nodes yet'}

WEAKNESSES (Incomplete Nodes):
${weaknesses || 'None identified'}

STRONG CONNECTIONS:
${strongEdges || 'No strong alignments yet'}

ALL NODES:
${allNodes}

STATISTICS:
- Complete Nodes: ${graph.stats.completeNodes}/${graph.stats.totalNodes}
- Human-verified: ${graph.stats.humanNodes}
- AI-generated: ${graph.stats.aiNodes}
- Average Freshness: ${graph.stats.averageFreshness}%
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
    const systemPrompt = `You are a strategic marketing consultant identifying growth opportunities in a company's strategic context map.

Your task is to find leverage points where existing strengths can be amplified or where small improvements can unlock significant value.

Opportunity Types:
- leverage_strength: A strong node that could power improvements elsewhere
- quick_win: Low effort, high impact improvement
- amplify_connection: Strengthen a connection to multiply value
- unlock_potential: Remove a blocker to release latent value
- optimize_flow: Improve the strategic flow between nodes

Look for patterns like:
- Strong brand but weak audience targeting → leverage brand to define ICP
- Strong offers but no content → content strategy opportunity
- Strong website but no SEO → SEO quick win
- Complete strategy but missing execution nodes → activation opportunity

Guidelines:
- Focus on actionable opportunities
- Prioritize high-impact, low-effort options
- Be specific about which nodes are involved
- Provide clear action steps`;

    const userPrompt = `Analyze this strategic map and identify growth opportunities:

${mapContext}

Provide your analysis as JSON:
{
  "opportunities": [
    {
      "id": "opp-1",
      "title": "Short opportunity title",
      "type": "leverage_strength | quick_win | amplify_connection | unlock_potential | optimize_flow",
      "description": "Clear description of the opportunity",
      "currentState": "What exists now that enables this opportunity",
      "potentialOutcome": "What success looks like if this opportunity is pursued",
      "effortLevel": "low | medium | high",
      "impactLevel": "low | medium | high",
      "relatedNodes": ["node.ids", "involved"],
      "actionSteps": ["Step 1", "Step 2", "Step 3"],
      "priority": 1-10
    }
  ],
  "summary": "Overall summary of the opportunity landscape",
  "highImpactCount": number,
  "quickWinCount": number,
  "totalCount": number
}

Identify 5-8 opportunities, ordered by priority (highest first). Prioritize quick wins and high-impact opportunities.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed: OpportunitiesResponse = JSON.parse(content);

    return NextResponse.json({
      ...parsed,
      generatedAt: new Date().toISOString(),
      mapScore: mapGraph.mapScore,
    });

  } catch (error) {
    console.error('[Map AI Opportunities] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to identify opportunities' },
      { status: 500 }
    );
  }
}
