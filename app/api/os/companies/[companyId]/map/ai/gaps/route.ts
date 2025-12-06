// app/api/os/companies/[companyId]/map/ai/gaps/route.ts
// AI Identify Gaps - LLM scans map to identify strategic gaps
//
// Detects:
// - Missing upstream prerequisites
// - Weak foundations
// - Missing competitive positions
// - Inconsistent message-to-offer alignment
// - Critical missing fields

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { computeContextHealthScore } from '@/lib/contextGraph/health';
import { buildStrategicMapGraph, DOMAIN_LABELS } from '@/lib/contextGraph/strategicMap';
import type { StrategicMapGraph } from '@/lib/contextGraph/strategicMap';

// ============================================================================
// Types
// ============================================================================

interface StrategicGap {
  id: string;
  node: string;
  nodeLabel: string;
  severity: 'high' | 'medium' | 'low';
  type: 'missing_data' | 'weak_foundation' | 'inconsistency' | 'missing_prerequisite' | 'strategic_blind_spot';
  message: string;
  impact: string;
  recommendedFix: string;
  affectedNodes: string[];
  priority: number;
}

interface GapsResponse {
  gaps: StrategicGap[];
  summary: string;
  criticalGapsCount: number;
  totalGapsCount: number;
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
    const conflicts = node.conflictFlags.length > 0
      ? ` Conflicts: ${node.conflictFlags.map(c => c.message).join('; ')}`
      : '';
    const deps = node.dependencyCount > 0 ? ` (${node.dependencyCount} connections)` : '';

    return `- ${node.id}: "${node.label}" [${DOMAIN_LABELS[node.domain]}] - ${status} (${node.completenessScore}%), confidence: ${node.confidenceScore}%, freshness: ${node.freshnessScore}%${deps}${conflicts}${node.valuePreview ? ` Preview: "${node.valuePreview}"` : ''}`;
  }).join('\n');

  const weakEdges = graph.edges
    .filter(e => e.style === 'gap_link' || e.style === 'weak_link')
    .map(edge => {
      const fromNode = graph.nodes.find(n => n.id === edge.from);
      const toNode = graph.nodes.find(n => n.id === edge.to);
      return `- ${fromNode?.label} → ${toNode?.label}: ${edge.style.replace('_', ' ')}`;
    }).join('\n');

  return `
STRATEGIC MAP ANALYSIS
======================
Overall Score: ${graph.mapScore}%
Complete Nodes: ${graph.stats.completeNodes}/${graph.stats.totalNodes}
Empty Nodes: ${graph.stats.emptyNodes}
Known Conflicts: ${graph.stats.totalConflicts}

NODES:
${nodeDescriptions}

WEAK CONNECTIONS:
${weakEdges || 'None identified'}
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
    const systemPrompt = `You are a strategic marketing analyst identifying gaps and weaknesses in a company's strategic context map.

Your task is to identify specific, actionable gaps that are limiting the company's strategic effectiveness.

Gap Types:
- missing_data: Critical information that should be present but isn't
- weak_foundation: Upstream nodes that need strengthening before downstream can work
- inconsistency: Data that contradicts other parts of the strategy
- missing_prerequisite: Dependencies that aren't met
- strategic_blind_spot: Important strategic areas that seem overlooked

Severity Levels:
- high: Blocking strategic execution, needs immediate attention
- medium: Limiting effectiveness, should address soon
- low: Minor gap, nice to fix

Guidelines:
- Be specific about which nodes are affected
- Provide actionable recommendations
- Explain the impact of each gap
- Prioritize by strategic importance`;

    const userPrompt = `Analyze this strategic map and identify all significant gaps:

${mapContext}

Provide your analysis as JSON:
{
  "gaps": [
    {
      "id": "gap-1",
      "node": "node.id",
      "nodeLabel": "Node Label",
      "severity": "high | medium | low",
      "type": "missing_data | weak_foundation | inconsistency | missing_prerequisite | strategic_blind_spot",
      "message": "Clear description of the gap",
      "impact": "What this gap prevents or limits",
      "recommendedFix": "Specific action to address this gap",
      "affectedNodes": ["other.node.ids", "that.are.affected"],
      "priority": 1-10
    }
  ],
  "summary": "Overall summary of the gap analysis",
  "criticalGapsCount": number,
  "totalGapsCount": number
}

Identify 5-10 gaps, ordered by priority (highest first).`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed: GapsResponse = JSON.parse(content);

    return NextResponse.json({
      ...parsed,
      generatedAt: new Date().toISOString(),
      mapScore: mapGraph.mapScore,
    });

  } catch (error) {
    console.error('[Map AI Gaps] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to identify gaps' },
      { status: 500 }
    );
  }
}
