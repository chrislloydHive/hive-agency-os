// app/api/os/strategy/ai-propose/route.ts
// AI-assisted strategy proposal API
//
// Uses Competition V4 category definition and validated competitors
// to ground strategy recommendations in competitive landscape.
//
// SRM-AWARE: Checks Strategy-Ready Minimum before generating.
// If SRM not ready: produces high-level conditional strategy with Missing Inputs section.
// If SRM ready: produces detailed strategy referencing confirmed context fields.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyContext } from '@/lib/os/context';
import { getCompanyById } from '@/lib/airtable/companies';
import { getOrCreateContextGraphRecord } from '@/lib/contextGraph';
import {
  isStrategyReady,
  SRM_FIELD_LABELS,
  type StrategyReadinessResult,
} from '@/lib/contextGraph/readiness';
import type { StrategyPillar, StrategyService } from '@/lib/types/strategy';
import type { CompanyContext, Competitor } from '@/lib/types/context';

export const maxDuration = 120;

// ============================================================================
// System Prompts
// ============================================================================

/**
 * System prompt for FULL strategy generation (when SRM is ready)
 */
const STRATEGY_SYSTEM_PROMPT_FULL = `You are a senior marketing strategist creating a marketing strategy grounded in competitive positioning.

Your strategy MUST be anchored in the company's competitive landscape:
1. STATE the competitive category the company operates in
2. REFERENCE competitor dynamics (types and patterns, not brand spam)
3. JUSTIFY each pillar based on competitive positioning
4. Reference confirmed context fields using "Given X..." format

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
      "description": "2-3 sentence description including competitive rationale. Start with 'Given [confirmed context field]...'",
      "competitiveRationale": "Why this pillar matters given the competitive landscape",
      "priority": "high" | "medium" | "low",
      "services": ["website", "seo", "content", "media", "brand", "social"],
      "kpis": ["KPI 1", "KPI 2"]
    }
  ],
  "reasoning": "Brief explanation of why this strategy was chosen given the competitive context",
  "confirmedFieldsUsed": ["businessModel", "primaryAudience", "competitors", ...]
}

================================
RULES
================================

1. ALWAYS state the competitive category in the summary
2. Each pillar MUST include competitiveRationale explaining why it matters vs competitors
3. Do NOT spam competitor brand names - reference competitor TYPES (e.g., "direct marketplace competitors", "national players", "local specialists")
4. Ground recommendations in what will differentiate this company
5. Create 3-5 pillars that form a coherent competitive strategy
6. Be specific about WHY each pillar matters for winning in this category
7. Reference at least 5 confirmed context fields using "Given [field]..." format in pillar descriptions
8. Do NOT use generic SaaS defaults unless businessModel explicitly indicates SaaS`;

/**
 * System prompt for INCOMPLETE context (when SRM is NOT ready)
 */
const STRATEGY_SYSTEM_PROMPT_INCOMPLETE = `You are a senior marketing strategist creating a PRELIMINARY marketing strategy based on LIMITED information.

IMPORTANT: The company context is incomplete. You must:
1. Keep recommendations HIGH-LEVEL and CONDITIONAL
2. EXPLICITLY STATE your assumptions
3. Include a "Missing Inputs" section listing what information would improve the strategy
4. Use conditional language ("If...", "Assuming...", "Should X be confirmed...")

================================
OUTPUT REQUIREMENTS
================================

Your response must be a JSON object with this structure:

{
  "title": "Strategy title (Preliminary)",
  "summary": "2-3 sentence overview noting this is preliminary due to incomplete context",
  "competitiveCategory": "The category this company competes in (best guess based on available info)",
  "competitivePositioning": "1-2 sentences on positioning (conditional on assumptions)",
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "pillars": [
    {
      "title": "Pillar title",
      "description": "2-3 sentence description using conditional language",
      "competitiveRationale": "Why this pillar matters (with caveats)",
      "priority": "medium",
      "services": ["website", "seo", "content", "media", "brand", "social"],
      "kpis": ["KPI 1", "KPI 2"]
    }
  ],
  "reasoning": "Brief explanation noting this is preliminary",
  "missingInputs": "Plain language list of missing information that would improve this strategy",
  "assumptions": ["Assumption 1", "Assumption 2", ...]
}

================================
RULES
================================

1. Keep pillars HIGH-LEVEL - avoid specific tactical recommendations
2. Use "medium" priority for most pillars (cannot confidently prioritize without full context)
3. ALWAYS include missingInputs and assumptions fields
4. Each pillar description should use conditional language
5. Be honest about uncertainty
6. Create 2-4 pillars maximum (fewer pillars due to limited confidence)`;

// Legacy alias for backwards compatibility
const STRATEGY_SYSTEM_PROMPT = STRATEGY_SYSTEM_PROMPT_FULL;

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

    // Fetch company, context, and context graph (for SRM check)
    const [company, context, contextGraphRecord] = await Promise.all([
      getCompanyById(companyId),
      getCompanyContext(companyId),
      getOrCreateContextGraphRecord(companyId).catch(() => null),
    ]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Check SRM readiness
    let srmResult: StrategyReadinessResult | null = null;
    let isSrmReady = false;
    let missingSrmLabels: string[] = [];

    if (contextGraphRecord?.graph) {
      srmResult = isStrategyReady(contextGraphRecord.graph);
      isSrmReady = srmResult.ready;
      missingSrmLabels = srmResult.missing.map(m => m.label);
      console.log('[ai-propose] SRM check:', {
        ready: isSrmReady,
        missing: missingSrmLabels,
        completeness: srmResult.completenessPercent,
      });
    } else {
      console.log('[ai-propose] No context graph, treating as incomplete');
    }

    // Note: Competition source is determined by the signals bundle in the draft system.
    // For AI propose, we just indicate that competitors exist if they do.
    // The actual competition source (v3/v4) is tracked when strategies are created via
    // the full draft flow. For now, we'll mark as null and let the caller determine.
    const hasCompetitors = (context?.competitors?.length ?? 0) > 0;
    const competitionSource: 'v3' | 'v4' | null = null; // Determined by draft system when saving

    const openai = getOpenAI();

    // Use different prompt based on SRM readiness
    const systemPrompt = isSrmReady
      ? STRATEGY_SYSTEM_PROMPT_FULL
      : STRATEGY_SYSTEM_PROMPT_INCOMPLETE;

    const prompt = isSrmReady
      ? buildStrategyPromptFull(company, context, contextOverride)
      : buildStrategyPromptIncomplete(company, context, contextOverride, missingSrmLabels);

    console.log('[ai-propose] Using prompt mode:', isSrmReady ? 'FULL' : 'INCOMPLETE');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: isSrmReady ? 0.7 : 0.5, // Lower temperature for incomplete context
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Transform AI response to strategy format
    const proposal = {
      title: parsed.title || `${company.name} Marketing Strategy${!isSrmReady ? ' (Preliminary)' : ''}`,
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
      // SRM-aware fields
      missingInputs: parsed.missingInputs || (isSrmReady ? undefined : `Missing: ${missingSrmLabels.join(', ')}`),
      assumptions: parsed.assumptions || [],
      generatedWithIncompleteContext: !isSrmReady,
      confirmedFieldsUsed: parsed.confirmedFieldsUsed || [],
    };

    // Version metadata for the response
    const versionMetadata = {
      baseContextRevisionId: context?.updatedAt || null,
      hiveBrainRevisionId: null, // TODO: Add when Hive Brain versioning is implemented
      competitionSourceUsed: competitionSource,
      srmReady: isSrmReady,
      srmCompleteness: srmResult?.completenessPercent ?? 0,
      missingSrmFields: missingSrmLabels,
    };

    return NextResponse.json({
      proposal,
      confidence: isSrmReady ? 0.8 : 0.5, // Lower confidence for incomplete context
      sources: ['company_context', 'ai_analysis', hasCompetitors ? 'competition_data' : null].filter(Boolean),
      versionMetadata,
    });
  } catch (error) {
    console.error('[API] strategy/ai-propose error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI propose failed' },
      { status: 500 }
    );
  }
}

/**
 * Build prompt for FULL strategy generation (SRM ready)
 */
function buildStrategyPromptFull(
  company: { name: string; website?: string; industry?: string },
  context: CompanyContext | null,
  override?: Record<string, string>
): string {
  const competitors = context?.competitors || [];
  const directCompetitors = competitors.filter(c => c.type === 'direct');
  const indirectCompetitors = competitors.filter(c => c.type === 'indirect');
  const adjacentCompetitors = competitors.filter(c => c.type === 'adjacent');
  const competitorSummary = buildCompetitorSummary(directCompetitors, indirectCompetitors, adjacentCompetitors);

  // Build confirmed fields section
  const confirmedFields: string[] = [];
  if (context?.businessModel) confirmedFields.push(`Business Model: ${context.businessModel}`);
  if (context?.primaryAudience) confirmedFields.push(`Primary Audience: ${context.primaryAudience}`);
  if (context?.valueProposition) confirmedFields.push(`Value Proposition: ${context.valueProposition}`);
  if (context?.icpDescription) confirmedFields.push(`ICP Description: ${context.icpDescription}`);
  if (context?.objectives?.length) confirmedFields.push(`Primary Objective: ${context.objectives[0]}`);
  if (context?.constraints) confirmedFields.push(`Constraints: ${context.constraints}`);
  if (context?.budget) confirmedFields.push(`Budget: ${context.budget}`);

  return `
Propose a marketing strategy for ${company.name}.

================================
COMPANY INFO
================================
- Website: ${company.website || 'Not specified'}
- Industry: ${company.industry || 'Not specified'}

================================
CONFIRMED CONTEXT FIELDS (Reference these as "Given X...")
================================
${confirmedFields.join('\n') || 'None confirmed'}

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
ADDITIONAL CONTEXT
================================
- Secondary Audience: ${context?.secondaryAudience || 'Not specified'}
- Geographic Scope: ${context?.geographicScope || 'Not specified'}
- Price Range: ${context?.priceRange || 'Not specified'}

================================
INSTRUCTIONS
================================
Create a 3-5 pillar strategy that:
1. Is grounded in the competitive category above
2. Addresses specific competitive dynamics
3. Differentiates this company in its market
4. References confirmed context fields using "Given [field]..." format
5. Does NOT use generic SaaS defaults unless businessModel explicitly indicates SaaS

Reference competitor TYPES (direct, indirect, adjacent) not brand names.
Include "confirmedFieldsUsed" array listing which confirmed fields you referenced.
`.trim();
}

/**
 * Build prompt for INCOMPLETE strategy generation (SRM NOT ready)
 */
function buildStrategyPromptIncomplete(
  company: { name: string; website?: string; industry?: string },
  context: CompanyContext | null,
  override: Record<string, string> | undefined,
  missingSrmFields: string[]
): string {
  const competitors = context?.competitors || [];
  const directCompetitors = competitors.filter(c => c.type === 'direct');
  const indirectCompetitors = competitors.filter(c => c.type === 'indirect');
  const adjacentCompetitors = competitors.filter(c => c.type === 'adjacent');
  const competitorSummary = buildCompetitorSummary(directCompetitors, indirectCompetitors, adjacentCompetitors);

  return `
Propose a PRELIMINARY marketing strategy for ${company.name}.

⚠️ IMPORTANT: Context is INCOMPLETE. Generate a high-level, conditional strategy.

================================
MISSING INFORMATION
================================
The following key fields are missing:
${missingSrmFields.map(f => `- ${f}`).join('\n') || '- None specified'}

================================
COMPANY INFO
================================
- Website: ${company.website || 'Not specified'}
- Industry: ${company.industry || 'Not specified'}

================================
AVAILABLE CONTEXT (may be incomplete)
================================
- Business Model: ${override?.businessModel || context?.businessModel || 'NOT SPECIFIED'}
- Value Proposition: ${override?.valueProposition || context?.valueProposition || 'NOT SPECIFIED'}
- Primary Audience: ${override?.primaryAudience || context?.primaryAudience || 'NOT SPECIFIED'}
- Objectives: ${context?.objectives?.join(', ') || 'NOT SPECIFIED'}
- Constraints: ${context?.constraints || 'NOT SPECIFIED'}

================================
COMPETITIVE CATEGORY
================================
${context?.companyCategory || 'NOT SPECIFIED - make your best inference'}

================================
COMPETITORS
================================
${competitorSummary}

================================
INSTRUCTIONS
================================
Create a 2-4 pillar PRELIMINARY strategy that:
1. Uses conditional language ("If...", "Assuming...", "Should X be confirmed...")
2. Keeps recommendations HIGH-LEVEL (avoid specific tactics)
3. Uses "medium" priority for most pillars
4. Explicitly lists assumptions you're making
5. Includes a "missingInputs" field describing what information would improve this strategy

This is a PRELIMINARY strategy that will be refined when more context is available.
`.trim();
}

// Legacy function for backwards compatibility
function buildStrategyPrompt(
  company: { name: string; website?: string; industry?: string },
  context: CompanyContext | null,
  override?: Record<string, string>
): string {
  return buildStrategyPromptFull(company, context, override);
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
