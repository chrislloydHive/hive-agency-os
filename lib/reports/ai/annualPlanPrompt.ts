// lib/reports/ai/annualPlanPrompt.ts
// AI Prompt for Annual Plan Generation
//
// Generates a comprehensive annual marketing and strategic plan including:
// - SWOT summary
// - Strategic pillars
// - Annual objectives
// - Channel strategy
// - Key initiatives
// - Budget mix guidance
// - KPIs for the year
// - Risks + mitigations

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

/**
 * Safely extracts an array of strings from a context graph field
 */
function extractStringArray(field: any): string[] {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (Array.isArray(field.value)) return field.value;
  return [];
}

// ============================================================================
// Main Export
// ============================================================================

export async function generateAnnualPlanBlocks(
  context: GenerationContext
): Promise<ReportBlock[]> {
  const { companyId, companyName, contextGraph, healthScore } = context;

  // Extract key info from context graph
  const identity = contextGraph?.identity || {};
  const audience = contextGraph?.audience || {};
  const brand = contextGraph?.brand || {};
  const competitive = contextGraph?.competitive || {};
  const objectives = contextGraph?.objectives || {};

  const prompt = buildAnnualPlanPrompt({
    companyName: companyName || extractString(identity.businessName) || 'the company',
    industry: extractString(identity.industry) || 'unknown',
    valueProposition: extractString(identity.valueProposition) || '',
    primaryAudience: extractString(audience.icpDescription) || '',
    brandVoice: extractString(brand.voice) || '',
    competitors: extractStringArray(competitive.primaryCompetitors),
    primaryObjective: extractString(objectives.primaryObjective),
    kpis: extractStringArray(objectives.kpiLabels),
    healthScore: healthScore?.overallScore || 0,
  });

  try {
    const response = await aiSimple({
      systemPrompt: ANNUAL_PLAN_SYSTEM_PROMPT,
      taskPrompt: prompt,
      model: 'gpt-4o',
      temperature: 0.4,
      maxTokens: 4000,
      jsonMode: true,
    });

    // Parse the response into blocks
    const blocks = parseAnnualPlanResponse(response);
    return blocks;
  } catch (error) {
    console.error('[Annual Plan] AI generation failed:', error);
    // Return fallback blocks
    return generateFallbackAnnualPlanBlocks(companyName || 'Company');
  }
}

// ============================================================================
// System Prompt
// ============================================================================

const ANNUAL_PLAN_SYSTEM_PROMPT = `You are a strategic marketing consultant creating an annual marketing plan.
Your output must be structured JSON that can be parsed into report blocks.

Output Format:
Return a JSON array of report blocks. Each block must have:
- id: unique string
- kind: one of "section_heading", "paragraph", "swot", "pillar", "list", "metric_block", "initiative", "risk", "budget_mix"
- Additional fields based on kind

Block Types:
1. section_heading: { title: string, subtitle?: string, level: 1|2|3 }
2. paragraph: { title?: string, body: string }
3. swot: { strengths: string[], weaknesses: string[], opportunities: string[], threats: string[] }
4. pillar: { name: string, description: string, objectives: string[], keyResults: string[] }
5. list: { title?: string, style: "bullet"|"numbered", items: string[] }
6. metric_block: { title?: string, metrics: Array<{ label: string, value: string, delta?: string }> }
7. initiative: { name: string, description: string, quarter: string, expectedOutcome: string }
8. risk: { risks: Array<{ id: string, title: string, likelihood: "low"|"medium"|"high", impact: "low"|"medium"|"high", mitigation: string }> }
9. budget_mix: { allocations: Array<{ channel: string, percentage: number, rationale?: string }> }

Be specific, actionable, and data-driven. Avoid generic advice.`;

// ============================================================================
// Prompt Builder
// ============================================================================

interface PlanContext {
  companyName: string;
  industry: string;
  valueProposition: string;
  primaryAudience: string;
  brandVoice: string;
  competitors: string[];
  primaryObjective: string;
  kpis: string[];
  healthScore: number;
}

function buildAnnualPlanPrompt(ctx: PlanContext): string {
  const year = new Date().getFullYear();

  return `Create an annual marketing plan for ${year} for ${ctx.companyName}.

COMPANY CONTEXT:
- Industry: ${ctx.industry}
- Value Proposition: ${ctx.valueProposition || 'Not defined'}
- Primary Audience: ${ctx.primaryAudience || 'Not defined'}
- Brand Voice: ${ctx.brandVoice || 'Not defined'}
- Key Competitors: ${ctx.competitors.length > 0 ? ctx.competitors.join(', ') : 'Not identified'}
- Current Marketing Health Score: ${ctx.healthScore}%

EXISTING OBJECTIVES:
${ctx.primaryObjective ? `Primary: ${ctx.primaryObjective}` : 'None defined'}
${ctx.kpis.length > 0 ? `Key KPIs: ${ctx.kpis.join(', ')}` : ''}

Generate a comprehensive annual plan with these sections:
1. Executive Summary (section_heading + paragraph)
2. SWOT Analysis (swot block)
3. Strategic Pillars (2-3 pillar blocks)
4. Annual Objectives & KPIs (metric_block)
5. Channel Strategy (list)
6. Key Initiatives by Quarter (initiative blocks for Q1-Q4)
7. Budget Allocation (budget_mix)
8. Risks & Mitigations (risk block)

Return ONLY valid JSON array of blocks. No markdown, no explanation.`;
}

// ============================================================================
// Response Parser
// ============================================================================

function parseAnnualPlanResponse(response: string): ReportBlock[] {
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
      console.error('[Annual Plan] Unexpected response format:', JSON.stringify(parsed).slice(0, 500));
      throw new Error('Response is not an array or does not contain blocks array');
    }

    // Validate and assign IDs/orders
    return blocks.map((block: any, index: number) => ({
      ...block,
      id: block.id || `block-${index}`,
      order: index,
    }));
  } catch (error) {
    console.error('[Annual Plan] Failed to parse AI response:', error);
    throw error;
  }
}

// ============================================================================
// Fallback Blocks
// ============================================================================

function generateFallbackAnnualPlanBlocks(companyName: string): ReportBlock[] {
  const year = new Date().getFullYear();

  return [
    {
      id: 'heading-1',
      kind: 'section_heading',
      order: 0,
      title: `${year} Annual Marketing Plan`,
      subtitle: companyName,
      level: 1,
    } as ReportBlock,
    {
      id: 'para-1',
      kind: 'paragraph',
      order: 1,
      title: 'Plan Generation Failed',
      body: `We were unable to automatically generate the annual plan due to insufficient context data or a temporary service issue.

Please ensure the company's Context Graph has been populated with:
- Company identity and value proposition
- Target audience information
- Brand positioning
- Competitive landscape
- Business objectives

Once this information is available, try generating the plan again.`,
    } as ReportBlock,
  ];
}
