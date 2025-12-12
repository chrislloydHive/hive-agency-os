// app/api/os/context/regenerate/route.ts
// Regenerate Context Draft from Existing Baseline
//
// This endpoint:
// 1. Uses existing baselineSignals (does NOT re-run diagnostics)
// 2. Generates a new AI context draft
// 3. Returns the draft without saving automatically
//
// Used by "Regenerate from diagnostics" link when saved context already exists.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getBaselineSignalsForCompany,
  getCompanyContext,
  getCompetitionSummaryForCompany,
  inferCompanyCategoryAndHints,
} from '@/lib/os/context';
import type { CompanyContext, ContextDraft, ContextAiInput, Competitor } from '@/lib/types/context';
import { parseCompetitors } from '@/lib/types/context';

export const maxDuration = 60; // 1 minute for AI generation only

// ============================================================================
// System Prompt for Context Generation
// ============================================================================

const SYSTEM_PROMPT = `
You are the Context Modeling Engine for Hive OS.

Your job is to create accurate, grounded company context based on diagnostic signals.

STRICT RULES:
1. NEVER assume the company is a marketing agency unless the inputs explicitly say so.
2. ALWAYS anchor context to the company's name, domain, and detected industry hints provided.
3. Use ONLY information provided in the input. Do not add new facts or invent details.
4. If you are uncertain about a detail, leave it as null or write "Needs confirmation" instead of inventing details.
5. Context must be high-level, strategic, actionable, and precise.
6. Pay attention to the "detectedIndustry", "detectedAudienceHints", and "detectedBusinessModelHints" fields.
7. If "competitionSummary" is provided, use it to:
   - Refine businessModel by understanding what competitors do
   - Inform companyCategory based on competitor types
   - Shape objectives with awareness of competitive positioning
   - Build a STRUCTURED competitors array with rich data
   - Extract marketSignals from competitor landscape insights

OUTPUT FORMAT:
Return a JSON object with ONLY these keys (use null if you cannot determine a value with confidence):
{
  "businessModel": string | null,
  "primaryAudience": string | null,
  "secondaryAudience": string | null,
  "valueProposition": string | null,
  "objectives": string[] | null,
  "constraints": string | null,
  "competitorsNotes": string | null,
  "marketSignals": string[] | null,
  "companyCategory": string | null,
  "competitors": [
    {
      "domain": string (required, lowercase),
      "name": string | null,
      "offerOverlap": number (0-100, how much their offering overlaps),
      "jtbdMatch": boolean (do they solve the same jobs-to-be-done),
      "geoRelevance": number (0-100, geographic market overlap),
      "type": "direct" | "indirect" | "adjacent",
      "confidence": number (0-100, how confident you are in this assessment)
    }
  ],
  "summary": string
}

COMPETITOR TYPE DEFINITIONS:
- "direct": Same target audience, same core offering, head-to-head competition
- "indirect": Different approach to solving the same problem, or adjacent offering
- "adjacent": Related market/category but different core business model

Include up to 10 competitors if available. Prioritize direct competitors first.
NEVER include fields not shown above.
`.trim();

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body as { companyId: string };

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    console.log('[regenerate] Starting for:', company.name);

    // Get existing baseline signals
    const signals = await getBaselineSignalsForCompany(companyId);

    // Check if we have enough signal
    const hasSignal = signals.hasLabRuns || signals.hasFullGap || signals.hasCompetition || signals.hasWebsiteMetadata;

    if (!hasSignal) {
      return NextResponse.json(
        { error: 'INSUFFICIENT_SIGNAL', message: 'No baseline data available. Run diagnostics first.' },
        { status: 400 }
      );
    }

    console.log('[regenerate] Using existing signals:', signals.signalSources);

    // Load existing context and competition summary in parallel
    const [existingContext, competitionSummary] = await Promise.all([
      getCompanyContext(companyId),
      getCompetitionSummaryForCompany(companyId),
    ]);

    // Infer company category and hints
    const inferred = inferCompanyCategoryAndHints({
      companyName: company.name ?? '',
      domain: company.domain ?? company.website ?? '',
      websiteTitle: signals.websiteTitle ?? '',
      websiteMetaDescription: signals.websiteMetaDescription ?? '',
    });

    // Build AI input
    const aiInput: ContextAiInput = {
      companyName: company.name ?? '',
      domain: company.domain ?? company.website ?? '',
      currentContext: existingContext,
      diagnosticsSummary: {
        website: '',
        seo: '',
        content: '',
        brand: '',
      },
      detectedIndustry: inferred.detectedIndustry,
      detectedAudienceHints: inferred.detectedAudienceHints,
      detectedBusinessModelHints: inferred.detectedBusinessModelHints,
      competitionSummary,
    };

    // Call OpenAI
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here is the company context input as JSON. Generate the context.\n\n${JSON.stringify(aiInput, null, 2)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content || '{}';
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('[regenerate] Failed to parse AI response:', raw);
      parsed = {};
    }

    // Parse competitors from AI output
    const aiCompetitors = parseCompetitors(parsed.competitors, 'ai');

    // Build context from AI output
    const generatedContext: CompanyContext = {
      companyId,
      businessModel: (parsed.businessModel as string) || undefined,
      primaryAudience: (parsed.primaryAudience as string) || undefined,
      secondaryAudience: (parsed.secondaryAudience as string) || undefined,
      valueProposition: (parsed.valueProposition as string) || undefined,
      objectives: Array.isArray(parsed.objectives) ? (parsed.objectives as string[]) : undefined,
      constraints: (parsed.constraints as string) || undefined,
      competitorsNotes: (parsed.competitorsNotes as string) || undefined,
      competitors: aiCompetitors.length > 0 ? aiCompetitors : undefined,
      marketSignals: Array.isArray(parsed.marketSignals) ? (parsed.marketSignals as string[]) : undefined,
      companyCategory: (parsed.companyCategory as string) || inferred.companyCategory || undefined,
      isAiGenerated: true,
    };

    // Create draft (but do NOT save to Airtable - return only)
    const contextDraft: ContextDraft = {
      companyId,
      context: generatedContext,
      source: 'ai/baseline-v1',
      createdAt: new Date().toISOString(),
      summary: (parsed.summary as string) || 'Context regenerated from diagnostics',
    };

    console.log('[regenerate] Generated draft for:', company.name);

    return NextResponse.json({
      success: true,
      contextDraft,
    });
  } catch (error) {
    console.error('[regenerate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Regeneration failed' },
      { status: 500 }
    );
  }
}
