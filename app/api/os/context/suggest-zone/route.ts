// app/api/os/context/suggest-zone/route.ts
// AI-assisted context suggestions for a specific zone
//
// DOCTRINE: AI Proposes, Humans Decide
// This endpoint generates proposals for missing context in a zone.
// All suggestions require user approval before persisting.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyContext, getBaselineSignalsForCompany } from '@/lib/os/context';
import { FIELD_REGISTRY, getFieldsForZone } from '@/lib/contextMap/fieldRegistry';
import { createProposalBatch, saveProposalBatch } from '@/lib/contextGraph/nodes';
import type { ZoneId } from '@/components/context-map/types';

export const maxDuration = 60;

// Zone-specific prompts for better context generation
const ZONE_PROMPTS: Record<ZoneId, string> = {
  'business-reality': `
Focus on the company's core identity:
- Business model (how they make money)
- Company category/industry classification
- Key market signals
`,
  'brand': `
Focus on brand positioning:
- Brand positioning statement
- Voice and tone
- Core values and differentiators
`,
  'offer': `
Focus on what the company sells:
- Value proposition (why customers choose them)
- Primary products or services
- Key features and benefits
`,
  'objectives': `
Focus on business objectives:
- Primary business objective for the next 6-12 months
- Secondary objectives that support the primary goal
- Key metrics and KPIs they track
`,
  'constraints': `
Focus on operational constraints:
- Budget limitations (min/max spend)
- Resource constraints (team, time, expertise)
- Market or regulatory constraints
`,
  'audience': `
Focus on target audience:
- Primary audience/ideal customer profile
- Audience segments and their characteristics
- Pain points and motivations
- Where they spend time online
`,
  'go-to-market': `
Focus on go-to-market strategy:
- Primary conversion action
- Distribution channels
- Performance media approach
`,
  'competitive': `
Focus on competitive landscape:
- Top 3-5 direct competitors (factual list only)
- Notes on competitive dynamics
`,
  'execution': `
Focus on execution capabilities:
- Creative/brand assets
- Marketing capabilities
`,
  'overflow': `
Focus on additional context that doesn't fit other categories:
- Historical context
- Operational details
- Digital infrastructure
`,
};

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, zoneId, force = false } = body as {
      companyId: string;
      zoneId: ZoneId;
      force?: boolean; // If true, generate suggestions even if fields have values
    };

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    if (!zoneId) {
      return NextResponse.json({ error: 'Missing zoneId' }, { status: 400 });
    }

    // Load company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Load existing context
    const existingContext = await getCompanyContext(companyId);

    // Get fields for this zone
    const zoneFields = getFieldsForZone(zoneId);

    // Find empty/missing fields in this zone (or all fields if force=true)
    const missingFields = force
      ? zoneFields // Force mode: suggest for all fields
      : zoneFields.filter((field) => {
          const path = field.legacyPath;
          // Check if field is empty in current context
          const value = path.split('.').reduce((obj, key) => {
            if (obj && typeof obj === 'object' && key in obj) {
              return (obj as Record<string, unknown>)[key];
            }
            return undefined;
          }, existingContext as unknown);

          return value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0);
        });

    if (missingFields.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No missing fields in this zone',
        proposals: [],
      });
    }

    console.log(`[suggest-zone] Zone ${zoneId}: ${missingFields.length} fields to suggest (force=${force})`);
    console.log(`[suggest-zone] Fields:`, missingFields.map(f => f.key));

    // Get baseline signals for grounding
    const signals = await getBaselineSignalsForCompany(companyId);

    // Build zone-specific prompt
    const zonePrompt = ZONE_PROMPTS[zoneId] || 'Generate context for this zone.';
    const fieldsList = missingFields.map((f) => `- ${f.label} (${f.key})`).join('\n');

    const systemPrompt = `
You are the Context Modeling Engine for Hive OS, a marketing operations platform.

Your job is to generate USEFUL PROPOSALS for context fields based on company information.

RULES:
1. ALWAYS provide a concrete, actionable value - never "Needs confirmation" or placeholder text as the value.
2. Use the company name, domain, and existing context to infer reasonable values.
3. For fields you're less certain about, use lower confidence (0.4-0.6) but still provide a best guess.
4. For fields with good evidence, use higher confidence (0.7-0.9).
5. The "reasoning" field should explain your logic, including any uncertainty.

VALUE GUIDELINES:
- For quality/status fields: Use descriptive assessments like "Good - modern design with clear navigation" or "Needs improvement - limited content depth"
- For score fields: Use qualitative descriptions like "Strong", "Moderate", "Developing", "Needs attention"
- For text fields: Provide specific, relevant content based on what you can infer
- For array fields: Provide 2-4 relevant items

ZONE FOCUS:
${zonePrompt}

OUTPUT FORMAT:
Return a JSON object with a "suggestions" array. Each suggestion must have:
{
  "fieldKey": "the.field.key",
  "value": "A CONCRETE suggested value - never placeholder text",
  "confidence": 0.6,
  "reasoning": "Why this value was suggested, including any caveats"
}

Generate suggestions for ALL requested fields with your best assessment.
`.trim();

    const userPrompt = `
Company: ${company.name}
Website: ${company.domain || company.website || 'Unknown'}

EXISTING CONTEXT (use this to inform your suggestions):
${JSON.stringify(existingContext, null, 2)}

ADDITIONAL SIGNALS:
- Website Title: ${signals.websiteTitle || 'Not available'}
- Website Description: ${signals.websiteMetaDescription || 'Not available'}
- Has completed diagnostic labs: ${signals.hasLabRuns ? 'Yes' : 'No'}
- Has GAP analysis: ${signals.hasFullGap ? 'Yes' : 'No'}
- Number of findings: ${signals.findingsCount || 0}

FIELDS TO SUGGEST (Zone: "${zoneId}"):
${fieldsList}

Based on the company name, website, and existing context, provide your best assessment for EACH field listed above. Use the existing context to maintain consistency. If the company appears to be in a specific industry or has certain characteristics, reflect that in your suggestions.
`.trim();

    // Call OpenAI
    let openai;
    try {
      openai = getOpenAI();
    } catch (error) {
      console.error('[suggest-zone] OpenAI initialization failed:', error);
      return NextResponse.json(
        { error: 'OpenAI not configured. Check OPENAI_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    console.log(`[suggest-zone] Calling OpenAI for ${missingFields.length} fields...`);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content || '{}';
    let parsed: { suggestions?: Array<{
      fieldKey: string;
      value: unknown;
      confidence: number;
      reasoning: string;
    }> };

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('[context/suggest-zone] Failed to parse AI response:', raw);
      return NextResponse.json(
        { error: 'AI returned invalid JSON', raw },
        { status: 500 }
      );
    }

    const suggestions = parsed.suggestions || [];

    if (suggestions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'AI could not generate suggestions with confidence',
        proposals: [],
      });
    }

    // Map suggestions to proposal format
    const proposals = suggestions.map((s) => {
      const fieldEntry = FIELD_REGISTRY.find((f) => f.key === s.fieldKey);
      return {
        fieldPath: s.fieldKey,
        fieldLabel: fieldEntry?.label || s.fieldKey,
        proposedValue: s.value,
        currentValue: null,
        reasoning: s.reasoning,
        confidence: Math.min(0.95, Math.max(0.3, s.confidence)),
      };
    });

    // Create and save proposal batch
    const batch = createProposalBatch(
      companyId,
      proposals,
      'ai_assist', // Valid trigger type
      `AI-generated proposals for zone: ${zoneId}`,
      `zone:${zoneId}`
    );

    // Try to save the batch, but don't fail if it doesn't work
    // (Airtable table might not exist yet)
    let saved = false;
    let batchId = batch.id;
    try {
      const result = await saveProposalBatch(batch);
      saved = !!result;
      if (result) {
        batchId = result.batchId;
      }
    } catch (saveError) {
      console.warn('[context/suggest-zone] Could not save proposal batch:', saveError);
    }

    console.log(
      `[context/suggest-zone] Created ${proposals.length} proposals for zone ${zoneId} in company ${company.name} (saved: ${saved})`
    );

    return NextResponse.json({
      success: true,
      batch: {
        id: batchId,
        proposalCount: proposals.length,
        zoneId,
        persisted: saved,
      },
      proposals: proposals.map((p) => ({
        fieldPath: p.fieldPath,
        fieldLabel: p.fieldLabel,
        proposedValue: p.proposedValue,
        confidence: p.confidence,
        reasoning: p.reasoning,
      })),
      // IMPORTANT: Flag that these are proposals requiring user approval
      requiresUserApproval: true,
    });
  } catch (error) {
    console.error('[API] context/suggest-zone error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Zone suggestion failed' },
      { status: 500 }
    );
  }
}
