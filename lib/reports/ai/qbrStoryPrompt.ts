// lib/reports/ai/qbrStoryPrompt.ts
// AI Prompt for QBR Story Generation
//
// Generates a quarterly business review narrative including:
// - Quarter summary headline
// - KPI performance narrative
// - Context Graph changes/deltas
// - Insight clusters (wins, declines, gaps)
// - Work completed vs planned
// - Recommended next moves

import type { ReportBlock } from '../types';
import type { GenerationContext } from './orchestrator';
import { aiSimple } from '@/lib/ai-gateway';

// ============================================================================
// Context Graph Value Extractors
// ============================================================================

/**
 * Safely extracts a string value from a context graph field
 * Context graph fields have shape: { value: T, provenance: [...] }
 */
function extractString(field: any): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field.value === 'string') return field.value;
  return '';
}

// ============================================================================
// Main Export
// ============================================================================

export async function generateQbrBlocks(
  context: GenerationContext
): Promise<ReportBlock[]> {
  const { companyId, companyName, contextGraph, healthScore } = context;

  // Extract key info from context graph
  const identity = contextGraph?.identity || {};
  const objectives = contextGraph?.objectives || {};

  const prompt = buildQbrPrompt({
    companyName: companyName || extractString(identity.businessName) || 'the company',
    healthScore: healthScore?.overallScore || 0,
    completenessScore: healthScore?.completenessScore || 0,
    freshnessScore: healthScore?.freshnessScore || 0,
    industry: extractString(identity.industry),
    stage: extractString(identity.companyStage),
    primaryObjective: extractString(objectives.primaryObjective),
  });

  try {
    const response = await aiSimple({
      systemPrompt: QBR_SYSTEM_PROMPT,
      taskPrompt: prompt,
      model: 'gpt-4o',
      temperature: 0.4,
      maxTokens: 4000,
      jsonMode: true,
    });

    // Parse the response into blocks
    const blocks = parseQbrResponse(response);
    return blocks;
  } catch (error) {
    console.error('[QBR Story] AI generation failed:', error);
    // Return fallback blocks
    return generateFallbackQbrBlocks(companyName || 'Company');
  }
}

// ============================================================================
// System Prompt
// ============================================================================

const QBR_SYSTEM_PROMPT = `You are a strategic marketing analyst creating a Quarterly Business Review (QBR) narrative.
Your output must be structured JSON that can be parsed into report blocks.

Output Format:
Return a JSON array of report blocks. Each block must have:
- id: unique string
- kind: one of "section_heading", "paragraph", "insight", "metric_block", "delta", "recommendation", "list"
- Additional fields based on kind

Block Types:
1. section_heading: { title: string, subtitle?: string, level: 1|2|3 }
2. paragraph: { title?: string, body: string }
3. insight: { title: string, body: string, severity: "low"|"medium"|"high", category: "win"|"risk"|"opportunity"|"regression", domain?: string }
4. metric_block: { title?: string, metrics: Array<{ label: string, value: string, trend?: "up"|"down"|"flat", delta?: string }> }
5. delta: { label: string, changeType: "added"|"removed"|"strengthened"|"weakened", beforeValue?: string, afterValue?: string, comment?: string }
6. recommendation: { headline: string, priority: "now"|"next"|"later", items: Array<{ id: string, title: string, description: string, estimatedImpact?: "low"|"medium"|"high" }> }
7. list: { title?: string, style: "bullet"|"numbered", items: string[] }

Be specific about what changed this quarter and what actions to take next.`;

// ============================================================================
// Prompt Builder
// ============================================================================

interface QbrContext {
  companyName: string;
  healthScore: number;
  completenessScore: number;
  freshnessScore: number;
  industry: string;
  stage: string;
  primaryObjective: string;
}

function buildQbrPrompt(ctx: QbrContext): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const year = now.getFullYear();

  return `Create a Quarterly Business Review for Q${quarter} ${year} for ${ctx.companyName}.

CURRENT STATE:
- Overall Health Score: ${ctx.healthScore}%
- Data Completeness: ${ctx.completenessScore}%
- Data Freshness: ${ctx.freshnessScore}%

COMPANY IDENTITY:
- Name: ${ctx.companyName}
- Industry: ${ctx.industry || 'Unknown'}
- Stage: ${ctx.stage || 'Unknown'}

OBJECTIVES:
${ctx.primaryObjective ? `Primary: ${ctx.primaryObjective}` : 'Not defined'}

Generate a QBR narrative with these sections:
1. Quarter Headline (section_heading with punchy summary)
2. Executive Summary (paragraph with key takeaways)
3. Health Score Analysis (metric_block showing scores)
4. Key Wins This Quarter (insight blocks with category: "win")
5. Areas Needing Attention (insight blocks with category: "risk" or "regression")
6. Strategic Opportunities (insight blocks with category: "opportunity")
7. Recommended Next Moves (recommendation block with prioritized actions)

Focus on actionable insights. Be honest about gaps.
Return ONLY valid JSON array of blocks. No markdown, no explanation.`;
}

// ============================================================================
// Response Parser
// ============================================================================

function parseQbrResponse(response: string): ReportBlock[] {
  try {
    // Try to extract JSON from the response
    let jsonStr = response;

    // Handle case where response has markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    // Handle different response formats
    let blocks: any[];
    if (Array.isArray(parsed)) {
      blocks = parsed;
    } else if (parsed.blocks && Array.isArray(parsed.blocks)) {
      // Some models wrap array in { blocks: [...] }
      blocks = parsed.blocks;
    } else if (parsed.content && Array.isArray(parsed.content)) {
      // Or { content: [...] }
      blocks = parsed.content;
    } else {
      console.error('[QBR Story] Unexpected response format:', JSON.stringify(parsed).slice(0, 500));
      throw new Error('Response is not an array or does not contain blocks array');
    }

    // Validate and assign IDs/orders
    return blocks.map((block: any, index: number) => ({
      ...block,
      id: block.id || `block-${index}`,
      order: index,
    }));
  } catch (error) {
    console.error('[QBR Story] Failed to parse AI response:', error);
    throw error;
  }
}

// ============================================================================
// Fallback Blocks
// ============================================================================

function generateFallbackQbrBlocks(companyName: string): ReportBlock[] {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const year = now.getFullYear();

  return [
    {
      id: 'heading-1',
      kind: 'section_heading',
      order: 0,
      title: `Q${quarter} ${year} Business Review`,
      subtitle: companyName,
      level: 1,
    } as ReportBlock,
    {
      id: 'para-1',
      kind: 'paragraph',
      order: 1,
      title: 'Report Generation Failed',
      body: `We were unable to automatically generate the QBR due to insufficient context data or a temporary service issue.

Please ensure the company's Context Graph has been populated with:
- Company identity and overview
- Current objectives and KPIs
- Recent work and initiatives

Once this information is available, try generating the QBR again.`,
    } as ReportBlock,
  ];
}
